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
}

export interface FlowRecord {
  id: string
  title: string
  active: boolean
  flow_data: FlowData
  icon_url?: string | null
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
    logicBlocks: flow.logicBlocks || []
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
            logicBlocks: flow.logicBlocks || []
          }
          const flowId = flow.id || generateFlowId()

          await supabase
            .from('flows')
            .upsert({
              id: flowId,
              title: flow.title,
              active: flow.status === 'Live',
              flow_data: flowData,
              updated_at: new Date().toISOString()
            }, {
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
 * Load a flow from the database by ID (optimized with caching)
 */
export async function loadFlow(flowId: string): Promise<Flow | null> {
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
      logicBlocks: flowRecord.flow_data.logicBlocks || []
    }
  }

  try {
    // Only select needed fields for faster queries
    const { data, error } = await supabase
      .from('flows')
      .select('id, title, active, flow_data, created_at, updated_at')
      .eq('id', flowId)
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
      iconUrl: flowRecord.icon_url || undefined
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error: Failed to connect to Supabase while loading flow')
    } else if (error instanceof Error) {
      console.error('Error loading flow:', error.message)
    }
    return null
  }
}

// Cache for all flows list
let allFlowsCache: { flows: Flow[]; timestamp: number } | null = null
const ALL_FLOWS_CACHE_TTL = 3000 // 3 seconds cache

/**
 * Load all flows from the database (optimized with caching and minimal data)
 */
export async function loadAllFlows(): Promise<Flow[]> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, returning empty flows array')
    return []
  }

  // Check cache first
  if (allFlowsCache && (Date.now() - allFlowsCache.timestamp) < ALL_FLOWS_CACHE_TTL) {
    return allFlowsCache.flows
  }

  try {
      // Only select minimal fields needed for list view - this is MUCH faster
      const { data, error } = await supabase
        .from('flows')
        .select('id, title, active, icon_url, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50) // Reduced from 100

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('Database table does not exist. Please run the SQL schema from supabase/schema.sql')
      } else {
        console.error('Error loading flows:', error)
      }
      return []
    }

    if (!data) return []

    // Minimal processing - no flow_data parsing for list view
    const flows = data.map((flowRecord: any) => ({
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: flowRecord.active ? 'Live' : 'Draft',
      nodes: [], // Will be loaded when flow is selected
      logicBlocks: [], // Will be loaded when flow is selected
      iconUrl: flowRecord.icon_url || undefined
    }))

    // Update cache
    allFlowsCache = { flows, timestamp: Date.now() }

    return flows
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error: Failed to connect to Supabase')
    } else if (error instanceof Error) {
      console.error('Error loading flows:', error.message)
    }
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
export async function createFlow(title: string): Promise<Flow | null> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
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

    const { data, error } = await supabase
      .from('flows')
      .insert({
        id: flowId,
        title,
        active: false,
        flow_data: newFlow
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating flow in database:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      throw error // Throw error instead of silently failing
    }

    const flowRecord = data as FlowRecord
    return {
      id: flowRecord.id,
      title: flowRecord.title,
      dateCreated: new Date(flowRecord.created_at).toISOString().split('T')[0],
      status: 'Draft',
      nodes: flowRecord.flow_data.nodes || [],
      logicBlocks: flowRecord.flow_data.logicBlocks || [],
      iconUrl: flowRecord.icon_url || undefined
    }
  } catch (error) {
    console.error('Error creating flow:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error // Re-throw to let caller handle it
  }
}

/**
 * Delete a flow from the database
 */
export async function deleteFlow(flowId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('flows')
      .delete()
      .eq('id', flowId)

    if (error) {
      console.error('Error deleting flow:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting flow:', error)
    return false
  }
}

/**
 * Toggle flow active status
 */
export async function toggleFlowActive(flowId: string, active: boolean): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot toggle flow active')
    return false
  }

  try {
    // If setting a flow to active, first deactivate all other flows
    if (active) {
      const { error: deactivateError, data: deactivateData } = await supabase
        .from('flows')
        .update({ active: false })
        .neq('id', flowId)
        .select()

      if (deactivateError) {
        console.error('Error deactivating other flows:', deactivateError)
        console.error('Deactivate error details:', JSON.stringify(deactivateError, null, 2))
        return false
      }
      console.log('Deactivated other flows:', deactivateData)
    }

    // Use update (not upsert) since we're only changing the active status
    // Upsert would require all NOT NULL fields like 'title' which we don't have here
    const { error, data } = await supabase
      .from('flows')
      .update({ 
        active,
        updated_at: new Date().toISOString()
      })
      .eq('id', flowId)
      .select()

    if (error) {
      console.error('Error toggling flow active:', error)
      console.error('Update error details:', JSON.stringify(error, null, 2))
      return false
    }

    console.log(`Successfully set flow ${flowId} active status to ${active}`, data)
    
    // Verify the update was successful by reading it back
    const { data: verifyData, error: verifyError } = await supabase
      .from('flows')
      .select('id, active')
      .eq('id', flowId)
      .single()
    
    if (verifyError) {
      console.error('Error verifying flow active status:', verifyError)
    } else {
      console.log('Verified flow active status:', verifyData?.active, 'Expected:', active)
      if (verifyData?.active !== active) {
        console.error('WARNING: Flow active status mismatch! Database shows:', verifyData?.active, 'but expected:', active)
      }
    }

    // Clear cache to force refresh
    clearFlowCache()

    return true
  } catch (error) {
    console.error('Error toggling flow active:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return false
  }
}

/**
 * Find the active flow (where active = true)
 */
export async function getActiveFlow(): Promise<Flow | null> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot get active flow')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('flows')
      .select('id, title, active, flow_data, created_at, updated_at')
      .eq('active', true)
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
      logicBlocks: flowRecord.flow_data.logicBlocks || []
    }
  } catch (error) {
    console.error('Error getting active flow:', error)
    return null
  }
}

