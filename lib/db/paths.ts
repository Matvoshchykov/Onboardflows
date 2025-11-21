import { supabase } from '../supabase'

export interface FlowPath {
  id: string
  session_id: string
  node_id: string
  order_index: number
  visited_at: string
}

/**
 * Track a node visit in the flow path
 */
export async function trackPathNode(
  sessionId: string,
  nodeId: string,
  orderIndex: number
): Promise<FlowPath | null> {
  try {
    // Check if session exists and flow is active
    const { data: session } = await supabase
      .from('flow_sessions')
      .select('flow_id, flow:flows!inner(active)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      console.log('Session not found')
      return null
    }

    // Use upsert to handle duplicate visits gracefully
    const { data, error } = await supabase
      .from('flow_paths')
      .upsert({
        session_id: sessionId,
        node_id: nodeId,
        order_index: orderIndex
      }, {
        onConflict: 'session_id,node_id,order_index'
      })
      .select()
      .single()

    if (error) {
      console.error('Error tracking path node:', error)
      return null
    }

    return data as FlowPath
  } catch (error) {
    console.error('Error tracking path node:', error)
    return null
  }
}

/**
 * Get the complete path for a session
 */
export async function getSessionPath(sessionId: string): Promise<FlowPath[]> {
  try {
    const { data, error } = await supabase
      .from('flow_paths')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error getting session path:', error)
      return []
    }

    return (data || []) as FlowPath[]
  } catch (error) {
    console.error('Error getting session path:', error)
    return []
  }
}


