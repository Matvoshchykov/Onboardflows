import { supabase } from '../supabase'

export interface FlowResponse {
  id: string
  session_id: string
  node_id: string
  question_type: string
  answer: any // JSONB - can be string, number, array, etc.
  answered_at: string
}

/**
 * Save a user's answer to a question
 */
export async function saveResponse(
  sessionId: string,
  nodeId: string,
  questionType: string,
  answer: any
): Promise<FlowResponse | null> {
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

    const { data, error } = await supabase
      .from('flow_responses')
      .insert({
        session_id: sessionId,
        node_id: nodeId,
        question_type: questionType,
        answer: answer
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving response:', error)
      return null
    }

    return data as FlowResponse
  } catch (error) {
    console.error('Error saving response:', error)
    return null
  }
}

/**
 * Get all responses for a session
 */
export async function getSessionResponses(sessionId: string): Promise<FlowResponse[]> {
  try {
    const { data, error } = await supabase
      .from('flow_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('answered_at', { ascending: true })

    if (error) {
      console.error('Error getting session responses:', error)
      return []
    }

    return (data || []) as FlowResponse[]
  } catch (error) {
    console.error('Error getting session responses:', error)
    return []
  }
}

/**
 * Get response for a specific node in a session
 */
export async function getNodeResponse(
  sessionId: string,
  nodeId: string
): Promise<FlowResponse | null> {
  try {
    const { data, error } = await supabase
      .from('flow_responses')
      .select('*')
      .eq('session_id', sessionId)
      .eq('node_id', nodeId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      console.error('Error getting node response:', error)
      return null
    }

    return data as FlowResponse
  } catch (error) {
    console.error('Error getting node response:', error)
    return null
  }
}


