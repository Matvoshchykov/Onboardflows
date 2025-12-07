import { supabase, isSupabaseConfigured } from '../supabase'
import type { Flow, FlowNode } from '@/components/flow-builder'
import type { LogicBlock } from '@/components/flow-canvas'

// Validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

// Generate unique UUID for flows (compatible with PostgreSQL UUID type)
function generateFlowId(): string {
  // Use crypto.randomUUID() if available (browser API), otherwise generate UUID v4 format
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: Generate UUID v4 format manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export interface FlowData {
  nodes: FlowNode[]
  logicBlocks?: LogicBlock[]
  collapsedComponents?: Record<string, boolean>
}

export interface FlowRecord {
  id: string
  title: string
  active: boolean
  flow_data: FlowData
  icon_url?: string
  experience_id?: string
  created_at: string
  updated_at: string
}

// Cache for flows to avoid repeated database calls
const flowCache = new Map<string, { flow: FlowRecord; timestamp: number }>()
const CACHE_TTL = 5000 // 5 seconds cache

// Save queue to batch operations
let saveQueue: Map<string, { flow: Flow; timestamp: number }> = new Map()
let saveTimeout: NodeJS.Timeout | null = null
const SAVE_DEBOUNCE_MS = 300 // Batch saves within 300ms

/**
 * Save or update a flow in the database (optimized with instant cache update)
 * Returns immediately after updating cache, saves to DB in background
 */
export async function saveFlow(flow: Flow): Promise<FlowRecord | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, flow not saved to database')
    return null
  }

  const flowData: FlowData = {
    nodes: flow.nodes,
    logicBlocks: flow.logicBlocks || [],
    collapsedComponents: (flow as any).collapsedComponents || {}
  }

  // Ensure flow has a unique UUID
  let flowId = flow.id
  if (!flowId || !isValidUUID(flowId)) {
    flowId = generateFlowId()
  }

  // INSTANT: Update cache immediately (optimistic update)
  const flowRecord: FlowRecord = {
    id: flowId,
    title: flow.title,
    active: flow.status === 'Live',
    flow_data: flowData,
    icon_url: flow.icon_url,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  flowCache.set(flowId, { flow: flowRecord, timestamp: Date.now() })
  clearFlowCache() // Clear all flows cache to force refresh

  // Queue for background save (debounced)
  saveQueue.set(flowId, { flow, timestamp: Date.now() })

  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  // Debounce saves - batch multiple saves together
  saveTimeout = setTimeout(async () => {
    const flowsToSave = Array.from(saveQueue.values())
    saveQueue.clear()

    // Save all queued flows in parallel
    await Promise.allSettled(
      flowsToSave.map(async ({ flow }) => {
        try {
          const flowData: FlowData = {
            nodes: flow.nodes,
            logicBlocks: flow.logicBlocks || [],
            collapsedComponents: (flow as any).collapsedComponents || {}
          }
          const flowId = flow.id || generateFlowId()

          // First, get the existing flow to preserve experience_id
          const { data: existingFlow } = await supabase
            .from('flows')
            .select('experience_id')
            .eq('id', flowId)
            .single()
          
          const upsertData: any = {
            id: flowId,
            title: flow.title,
            active: flow.status === 'Live',
            flow_data: flowData,
            updated_at: new Date().toISOString(),
            ...(flow.icon_url && { icon_url: flow.icon_url })
          }
          
          // Preserve experience_id if it exists
          if (existingFlow?.experience_id) {
            upsertData.experience_id = existingFlow.experience_id
          }
          
          await supabase
            .from('flows')
            .upsert(upsertData, {
              onConflict: 'id'
            })
        } catch (error) {
          console.error('Background save error:', error)
        }
      })
    )
  }, SAVE_DEBOUNCE_MS)

  // Return immediately with cached data
  return flowRecord
}

/**
 * Load a flow from the database by ID and experience_id (optimized with caching)
 */
export async function loadFlow(flowId: string, experienceId: string): Promise<Flow | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot load flow')
    return null
  }

  // Check cache first
  const cached = flowCache.get(flowId)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    const flowRecord = cached.flow
    return {
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: flowRecord.active ? 'Live' : 'Draft',
      nodes: flowRecord.flow_data.nodes || [],
      logicBlocks: flowRecord.flow_data.logicBlocks || [],
      collapsedComponents: flowRecord.flow_data.collapsedComponents || {},
      icon_url: flowRecord.icon_url
    } as Flow & { collapsedComponents?: Record<string, boolean> }
  }

  try {
    // Only select needed fields for faster queries - filter by experience_id
    const { data, error } = await supabase
      .from('flows')
      .select('id, title, active, flow_data, experience_id, icon_url, created_at, updated_at')
      .eq('id', flowId)
      .eq('experience_id', experienceId)
      .not('experience_id', 'is', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error loading flow:', error)
      return null
    }

    if (!data) return null

    const flowRecord = data as FlowRecord
    // Update cache
    flowCache.set(flowId, { flow: flowRecord, timestamp: Date.now() })

    return {
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: flowRecord.active ? 'Live' : 'Draft',
      nodes: flowRecord.flow_data.nodes || [],
      logicBlocks: flowRecord.flow_data.logicBlocks || [],
      collapsedComponents: flowRecord.flow_data.collapsedComponents || {},
      icon_url: flowRecord.icon_url
    } as Flow & { collapsedComponents?: Record<string, boolean> }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error: Failed to connect to Supabase while loading flow')
    } else if (error instanceof Error) {
      console.error('Error loading flow:', error.message)
    }
    return null
  }
}

// Cache for all flows list (keyed by experienceId)
let allFlowsCache: { flows: Flow[]; timestamp: number; experienceId: string } | null = null
const ALL_FLOWS_CACHE_TTL = 3000 // 3 seconds cache

/**
 * Load all flows from the database for a specific experience_id (optimized with caching and minimal data)
 */
export async function loadAllFlows(experienceId: string): Promise<Flow[]> {
  if (!isSupabaseConfigured || !supabase) {
    const errorMsg = 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  if (!experienceId || experienceId.trim() === '') {
    console.warn('[loadAllFlows] experienceId is required')
    return []
  }

  // Check cache first (keyed by experienceId)
  const cacheKey = experienceId
  if (allFlowsCache && allFlowsCache.experienceId === cacheKey && (Date.now() - allFlowsCache.timestamp) < ALL_FLOWS_CACHE_TTL) {
    return allFlowsCache.flows
  }

  try {
      // Only select minimal fields needed for list view - filter by experience_id
      const { data, error } = await supabase
        .from('flows')
        .select('id, title, active, experience_id, icon_url, created_at, updated_at')
        .eq('experience_id', experienceId)
        .not('experience_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50) // Reduced from 100

    if (error) {
      // Only throw for critical errors (table doesn't exist)
      if (error.code === 'PGRST205') {
        const errorMsg = 'Database table "flows" does not exist. Please run the SQL schema from supabase/schema.sql in your Supabase SQL editor.'
        console.error('Error loading flows:', errorMsg)
        throw new Error(errorMsg)
      }
      // For other errors, log but return empty array to allow flow creation
      console.warn('Error loading flows from database:', error.message || error)
      console.warn('Returning empty array - you can still create new flows')
      // Update cache with empty array (keyed by experienceId)
      allFlowsCache = { flows: [], timestamp: Date.now(), experienceId: cacheKey }
      return []
    }

    // If no data, return empty array (no flows exist yet)
    if (!data || data.length === 0) {
      console.log('No flows found in database')
      // Update cache with empty array (keyed by experienceId)
      allFlowsCache = { flows: [], timestamp: Date.now(), experienceId: cacheKey }
      return []
    }

    // Minimal processing - no flow_data parsing for list view
    const flows = data.map((flowRecord: any) => ({
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: flowRecord.active ? 'Live' : 'Draft',
      nodes: [], // Will be loaded when flow is selected
      logicBlocks: [], // Will be loaded when flow is selected
      icon_url: flowRecord.icon_url
    }))

    // Update cache (keyed by experienceId)
    allFlowsCache = { flows, timestamp: Date.now(), experienceId: cacheKey }

    return flows
  } catch (error) {
    // Only re-throw critical errors (table doesn't exist)
    if (error instanceof Error && error.message.includes('does not exist')) {
      throw error
    }
    
    // For network errors or other issues, log and return empty array
    // This allows users to still create flows even if fetching fails
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('Network error loading flows. Returning empty array - you can still create new flows')
      console.warn('Original error:', error)
    } else if (error instanceof Error) {
      console.warn('Error loading flows:', error.message)
      console.warn('Returning empty array - you can still create new flows')
    } else {
      console.warn('Unknown error loading flows:', error)
      console.warn('Returning empty array - you can still create new flows')
    }
    
    // Update cache with empty array (keyed by experienceId)
    allFlowsCache = { flows: [], timestamp: Date.now(), experienceId: cacheKey }
    return []
  }
}

/**
 * Clear flow cache (useful after saves)
 */
export function clearFlowCache(flowId?: string): void {
  if (flowId) {
    flowCache.delete(flowId)
  } else {
    flowCache.clear()
    allFlowsCache = null
  }
}

/**
 * Create a new flow in the database
 */
export async function createFlow(title: string, experienceId: string, iconUrl?: string): Promise<Flow | null> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (!experienceId || experienceId.trim() === '') {
    throw new Error('experienceId is required to create a flow')
  }

  try {
    const flowId = generateFlowId()
    const newFlow: FlowData = {
      nodes: [{
        id: `node-${Date.now()}`,
        title: 'Start Node',
        components: 0,
        completion: 0,
        position: { x: 100, y: 100 },
        connections: []
      }],
      logicBlocks: []
    }

    const insertData: any = {
      id: flowId,
      title,
      active: false,
      flow_data: newFlow,
      experience_id: experienceId,
      ...(iconUrl && { icon_url: iconUrl })
    }

    console.log(`[createFlow] Creating flow "${title}" with experienceId: ${experienceId}`)
    console.log(`[createFlow] Insert data (before insert):`, JSON.stringify(insertData, null, 2))

    const { data, error } = await supabase
      .from('flows')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // Handle Supabase errors
      let errorMsg = `Failed to create flow: ${error.message || 'Unknown error'}`
      
      if (error.code === 'PGRST205') {
        errorMsg = 'Database table "flows" does not exist. Please run the SQL schema from supabase/schema.sql in your Supabase SQL editor.'
      } else if (error.code === '23505') {
        errorMsg = 'A flow with this ID already exists. Please try again.'
      } else if (error.code === 'PGRST301' || error.code === 'PGRST302') {
        errorMsg = 'Database connection error. Please check your Supabase configuration.'
      }
      
      console.error('Error creating flow in database:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      throw new Error(errorMsg)
    }

    if (!data) {
      throw new Error('Failed to create flow: No data returned from database')
    }

    const flowRecord = data as FlowRecord
    console.log(`[createFlow] Successfully created flow "${title}" with ID: ${flowRecord.id}`)
    console.log(`[createFlow] Saved flow experience_id: ${flowRecord.experience_id || 'NULL'}`)
    
    // Verify the saved experience_id matches what we sent
    if (flowRecord.experience_id !== experienceId) {
      console.error(`[createFlow] ERROR: experience_id mismatch! Expected: ${experienceId}, Got: ${flowRecord.experience_id}`)
    }
    
    return {
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: 'Draft',
      nodes: flowRecord.flow_data.nodes || [],
      logicBlocks: flowRecord.flow_data.logicBlocks || [],
      icon_url: flowRecord.icon_url
    }
  } catch (error) {
    // Handle network errors (TypeError: Failed to fetch)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      const errorMsg = 'Network error: Failed to connect to Supabase. Please check:\n1. Your NEXT_PUBLIC_SUPABASE_URL is correct\n2. Your Supabase project is active\n3. There are no network restrictions'
      console.error('Network error creating flow:', errorMsg)
      console.error('Original error:', error)
      throw new Error(errorMsg)
    }
    
    // Handle other errors
    if (error instanceof Error) {
      console.error('Error creating flow:', error.message)
      console.error('Error stack:', error.stack)
      // Re-throw if it already has a good message
      if (error.message.includes('Failed to create flow') || error.message.includes('Database')) {
        throw error
      }
      throw new Error(`Failed to create flow: ${error.message}`)
    }
    
    // Handle empty or unknown error objects
    console.error('Unknown error creating flow:', error)
    throw new Error('Failed to create flow: Unknown error occurred')
  }
}

/**
 * Delete a flow from the database and all associated data
 */
export async function deleteFlow(flowId: string, experienceId: string, flowData?: any): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot delete flow')
    return false
  }

  try {
    // First, load the flow to get its data (if not provided)
    let flowToDelete = flowData
    if (!flowToDelete) {
      const { data, error: fetchError } = await supabase
        .from('flows')
        .select('flow_data, icon_url')
        .eq('id', flowId)
        .eq('experience_id', experienceId)
        .single()

      if (fetchError) {
        console.error('Error fetching flow for deletion:', fetchError)
        return false
      }

      flowToDelete = data
    }

    // Delete flow icon from storage if it exists
    if (flowToDelete?.icon_url && typeof flowToDelete.icon_url === 'string' && flowToDelete.icon_url.startsWith('http')) {
      const { deleteFileFromStorage } = await import('@/lib/utils')
      await deleteFileFromStorage(flowToDelete.icon_url, 'uploads')
    }

    // Delete all component files (images, videos) from all nodes
    if (flowToDelete?.flow_data?.nodes) {
      const { deleteComponentFiles } = await import('@/lib/utils')
      const deletePromises: Promise<void>[] = []
      
      for (const node of flowToDelete.flow_data.nodes) {
        if (node.pageComponents) {
          // Handle both array and object formats
          const components = Array.isArray(node.pageComponents) 
            ? node.pageComponents 
            : Object.values(node.pageComponents).filter(Boolean)
          
          for (const component of components) {
            if (component && component.type) {
              deletePromises.push(deleteComponentFiles(component))
            }
          }
        }
      }
      
      // Delete all component files in parallel
      await Promise.all(deletePromises)
    }

    // Delete the flow record (this will cascade delete sessions, responses, and paths due to ON DELETE CASCADE)
    const { error } = await supabase
      .from('flows')
      .delete()
      .eq('id', flowId)
      .eq('experience_id', experienceId)
      .not('experience_id', 'is', null)

    if (error) {
      console.error('Error deleting flow:', error)
      return false
    }

    // Clear cache
    flowCache.delete(flowId)

    return true
  } catch (error) {
    console.error('Error deleting flow:', error)
    return false
  }
}

/**
 * Toggle flow active status
 */
export async function toggleFlowActive(flowId: string, active: boolean, experienceId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot toggle flow active')
    return false
  }

  try {
    console.log(`[toggleFlowActive] Starting - flowId: ${flowId}, active: ${active}, experienceId: ${experienceId}`)
    
    // If setting a flow to active, first deactivate all other flows for this experience
    if (active) {
      console.log(`[toggleFlowActive] Deactivating other flows for experience ${experienceId}`)
      const { error: deactivateError, data: deactivateData } = await supabase
        .from('flows')
        .update({ active: false })
        .eq('experience_id', experienceId)
        .neq('id', flowId)
        .select()

      if (deactivateError) {
        console.error('[toggleFlowActive] Error deactivating other flows:', deactivateError)
        console.error('[toggleFlowActive] Deactivate error details:', JSON.stringify(deactivateError, null, 2))
        return false
      }
      console.log('[toggleFlowActive] Deactivated other flows:', deactivateData?.length || 0, 'flows')
    }

    // First, verify the flow exists and get its current state
    const { data: existingFlow, error: fetchError } = await supabase
      .from('flows')
      .select('id, active, experience_id')
      .eq('id', flowId)
      .single()

    if (fetchError) {
      console.error('[toggleFlowActive] Error fetching flow:', fetchError)
      return false
    }

    if (!existingFlow) {
      console.error('[toggleFlowActive] Flow not found:', flowId)
      return false
    }

    console.log('[toggleFlowActive] Existing flow state:', {
      id: existingFlow.id,
      active: existingFlow.active,
      experience_id: existingFlow.experience_id
    })

    // Update the flow by ID - when disabling, we don't need experience_id check
    // When enabling, we already deactivated others above
    const { error, data } = await supabase
      .from('flows')
      .update({ 
        active,
        updated_at: new Date().toISOString()
      })
      .eq('id', flowId)
      .select()

    if (error) {
      console.error('[toggleFlowActive] Error updating flow:', error)
      console.error('[toggleFlowActive] Update error details:', JSON.stringify(error, null, 2))
      return false
    }

    if (!data || data.length === 0) {
      console.error('[toggleFlowActive] No data returned from update')
      return false
    }

    console.log(`[toggleFlowActive] Successfully updated flow ${flowId} active status to ${active}`, data)
    
    // Verify the update was successful by reading it back
    const { data: verifyData, error: verifyError } = await supabase
      .from('flows')
      .select('id, active')
      .eq('id', flowId)
      .single()
    
    if (verifyError) {
      console.error('[toggleFlowActive] Error verifying flow active status:', verifyError)
      return false
    } else {
      console.log('[toggleFlowActive] Verified flow active status:', verifyData?.active, 'Expected:', active)
      if (verifyData?.active !== active) {
        console.error('[toggleFlowActive] WARNING: Flow active status mismatch! Database shows:', verifyData?.active, 'but expected:', active)
        return false
      }
    }

    // Clear cache to force refresh
    clearFlowCache()

    return true
  } catch (error) {
    console.error('[toggleFlowActive] Exception:', error)
    if (error instanceof Error) {
      console.error('[toggleFlowActive] Error message:', error.message)
      console.error('[toggleFlowActive] Error stack:', error.stack)
    }
    return false
  }
}

/**
 * Find the active flow (where active = true) for a specific experience
 */
export async function getActiveFlow(experienceId: string): Promise<Flow | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot get active flow')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('flows')
      .select('id, title, active, flow_data, experience_id, icon_url, created_at, updated_at')
      .eq('active', true)
      .eq('experience_id', experienceId)
      .not('experience_id', 'is', null)
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No active flow found
        return null
      }
      console.error('Error getting active flow:', error)
      return null
    }

    if (!data) return null

    const flowRecord = data as FlowRecord
    return {
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: 'Live',
      nodes: flowRecord.flow_data.nodes || [],
      logicBlocks: flowRecord.flow_data.logicBlocks || [],
      icon_url: flowRecord.icon_url
    }
  } catch (error) {
    console.error('Error getting active flow:', error)
    return null
  }
}

