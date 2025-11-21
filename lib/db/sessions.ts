import { supabase } from '../supabase'

export interface FlowSession {
  id: string
  user_id: string
  flow_id: string
  started_at: string
  completed_at: string | null
  current_step_index: number
  is_completed: boolean
}

/**
 * Start a new flow session
 */
export async function startFlowSession(
  userId: string,
  flowId: string
): Promise<FlowSession | null> {
  try {
    // Only start session if flow is active
    const { data: flow } = await supabase
      .from('flows')
      .select('active')
      .eq('id', flowId)
      .single()

    if (!flow || !flow.active) {
      console.log('Flow is not active, skipping session creation')
      return null
    }

    const { data, error } = await supabase
      .from('flow_sessions')
      .insert({
        user_id: userId,
        flow_id: flowId,
        current_step_index: 0,
        is_completed: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error starting flow session:', error)
      return null
    }

    return data as FlowSession
  } catch (error) {
    console.error('Error starting flow session:', error)
    return null
  }
}

/**
 * Update session current step
 */
export async function updateSessionStep(
  sessionId: string,
  stepIndex: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('flow_sessions')
      .update({ current_step_index: stepIndex })
      .eq('id', sessionId)

    if (error) {
      console.error('Error updating session step:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating session step:', error)
    return false
  }
}

/**
 * Complete a flow session
 */
export async function completeFlowSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('flow_sessions')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      console.error('Error completing flow session:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error completing flow session:', error)
    return false
  }
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<FlowSession | null> {
  try {
    const { data, error } = await supabase
      .from('flow_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('Error getting session:', error)
      return null
    }

    return data as FlowSession
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}


