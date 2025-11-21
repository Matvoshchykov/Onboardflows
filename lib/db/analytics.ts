import { supabase } from '../supabase'
import { FlowSession } from './sessions'
import { FlowResponse } from './responses'
import { FlowPath } from './paths'

export interface AnalyticsData {
  totalSessions: number
  completedSessions: number
  completionRate: number
  sessions: CompletedSessionData[]
}

export interface CompletedSessionData {
  sessionId: string
  userId: string
  startedAt: string
  completedAt: string
  duration: number // in seconds
  path: Array<{
    nodeId: string
    nodeTitle: string
    orderIndex: number
    visitedAt: string
  }>
  responses: Array<{
    nodeId: string
    nodeTitle: string
    questionType: string
    answer: any
    answeredAt: string
  }>
}

/**
 * Get analytics data for a flow
 */
export async function getFlowAnalytics(flowId: string, flowNodes: Array<{ id: string; title: string }>): Promise<AnalyticsData> {
  try {
    // Get all sessions for this flow
    const { data: allSessions, error: sessionsError } = await supabase
      .from('flow_sessions')
      .select('*')
      .eq('flow_id', flowId)
      .order('started_at', { ascending: false })

    if (sessionsError) {
      console.error('Error getting sessions:', sessionsError)
      return {
        totalSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        sessions: []
      }
    }

    const sessions = (allSessions || []) as FlowSession[]
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.is_completed).length
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

    // Get completed sessions with their paths and responses
    const completedSessionIds = sessions.filter(s => s.is_completed).map(s => s.id)
    
    if (completedSessionIds.length === 0) {
      return {
        totalSessions,
        completedSessions,
        completionRate,
        sessions: []
      }
    }

    // Get paths for all completed sessions
    const { data: paths, error: pathsError } = await supabase
      .from('flow_paths')
      .select('*')
      .in('session_id', completedSessionIds)
      .order('order_index', { ascending: true })

    if (pathsError) {
      console.error('Error getting paths:', pathsError)
    }

    const pathData = (paths || []) as FlowPath[]

    // Get responses for all completed sessions
    const { data: responses, error: responsesError } = await supabase
      .from('flow_responses')
      .select('*')
      .in('session_id', completedSessionIds)
      .order('answered_at', { ascending: true })

    if (responsesError) {
      console.error('Error getting responses:', responsesError)
    }

    const responseData = (responses || []) as FlowResponse[]

    // Create a node lookup map
    const nodeMap = new Map(flowNodes.map(n => [n.id, n.title]))

    // Group paths and responses by session
    const sessionsMap = new Map<string, CompletedSessionData>()
    
    completedSessionIds.forEach(sessionId => {
      const session = sessions.find(s => s.id === sessionId)!
      const sessionPaths = pathData.filter(p => p.session_id === sessionId)
      const sessionResponses = responseData.filter(r => r.session_id === sessionId)

      const duration = session.completed_at && session.started_at
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)
        : 0

      sessionsMap.set(sessionId, {
        sessionId,
        userId: session.user_id,
        startedAt: session.started_at,
        completedAt: session.completed_at || '',
        duration,
        path: sessionPaths.map(p => ({
          nodeId: p.node_id,
          nodeTitle: nodeMap.get(p.node_id) || 'Unknown',
          orderIndex: p.order_index,
          visitedAt: p.visited_at
        })),
        responses: sessionResponses.map(r => ({
          nodeId: r.node_id,
          nodeTitle: nodeMap.get(r.node_id) || 'Unknown',
          questionType: r.question_type,
          answer: r.answer,
          answeredAt: r.answered_at
        }))
      })
    })

    return {
      totalSessions,
      completedSessions,
      completionRate: Math.round(completionRate * 100) / 100,
      sessions: Array.from(sessionsMap.values())
    }
  } catch (error) {
    console.error('Error getting flow analytics:', error)
    return {
      totalSessions: 0,
      completedSessions: 0,
      completionRate: 0,
      sessions: []
    }
  }
}

