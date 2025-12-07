import { supabase } from '../supabase'
import { FlowSession } from './sessions'
import { FlowResponse } from './responses'
import { FlowPath } from './paths'

export interface AnalyticsData {
  totalSessions: number
  completedSessions: number
  completionRate: number
  dropOffRate: number
  averageDuration: number // in seconds
  sessions: CompletedSessionData[]
  pathAnalytics: PathAnalytics
  answerDistribution: AnswerDistribution
  nodeVisitStats: NodeVisitStats
  videoViewingStats: VideoViewingStats
}

export interface PathAnalytics {
  mostCommonPath: Array<{ nodeId: string; nodeTitle: string }>
  pathFrequency: Map<string, number>
}

export interface AnswerDistribution {
  [nodeId: string]: {
    [questionType: string]: {
      [answer: string]: number
    }
  }
}

export interface NodeVisitStats {
  [nodeId: string]: {
    nodeTitle: string
    visitCount: number
    avgTimeSpent: number // in seconds
  }
}

export interface VideoViewingStats {
  [componentId: string]: {
    componentTitle: string
    viewCount: number
    avgViewingTime: number // in seconds
    totalViewingTime: number // in seconds
  }
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
        dropOffRate: 0,
        averageDuration: 0,
        sessions: [],
        pathAnalytics: {
          mostCommonPath: [],
          pathFrequency: new Map()
        },
        answerDistribution: {},
        nodeVisitStats: {},
        videoViewingStats: {}
      }
    }

    const sessions = (allSessions || []) as FlowSession[]
    const totalSessions = sessions.length
    // Only count sessions that are actually completed - never count completed sessions as dropped
    const completedSessions = sessions.filter(s => s.is_completed === true).length
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

    // Get completed sessions with their paths and responses
    // IMPORTANT: Only include sessions that are explicitly marked as completed
    // If a user completes the flow and then leaves, it should NOT count as dropped
    const completedSessionIds = sessions.filter(s => s.is_completed === true).map(s => s.id)
    
    // Calculate drop-off rate: only count incomplete sessions as dropped
    // Completed sessions are never counted as dropped, even if user leaves after completion
    const incompleteSessions = totalSessions - completedSessions
    const dropOffRate = totalSessions > 0 ? (incompleteSessions / totalSessions) * 100 : 0

    if (completedSessionIds.length === 0) {
      return {
        totalSessions,
        completedSessions,
        completionRate,
        dropOffRate: Math.round(dropOffRate * 100) / 100,
        averageDuration: 0,
        sessions: [],
        pathAnalytics: {
          mostCommonPath: [],
          pathFrequency: new Map()
        },
        answerDistribution: {},
        nodeVisitStats: {},
        videoViewingStats: {}
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
    const durations: number[] = []
    const pathFrequencyMap = new Map<string, number>()
    const answerDistMap: AnswerDistribution = {}
    const nodeVisitMap: Map<string, { count: number; totalTime: number }> = new Map()
    
    completedSessionIds.forEach(sessionId => {
      const session = sessions.find(s => s.id === sessionId)!
      const sessionPaths = pathData.filter(p => p.session_id === sessionId).sort((a, b) => a.order_index - b.order_index)
      const sessionResponses = responseData.filter(r => r.session_id === sessionId)

      const duration = session.completed_at && session.started_at
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)
        : 0
      
      durations.push(duration)

      const pathKey = sessionPaths.map(p => p.node_id).join('→')
      pathFrequencyMap.set(pathKey, (pathFrequencyMap.get(pathKey) || 0) + 1)

      // Track node visits
      sessionPaths.forEach((p, idx) => {
        const nodeId = p.node_id
        const existing = nodeVisitMap.get(nodeId) || { count: 0, totalTime: 0 }
        // Estimate time spent: divide total duration by number of nodes
        const timeSpent = idx < sessionPaths.length - 1 
          ? duration / sessionPaths.length 
          : duration - (duration / sessionPaths.length * (sessionPaths.length - 1))
        nodeVisitMap.set(nodeId, {
          count: existing.count + 1,
          totalTime: existing.totalTime + timeSpent
        })
      })

      // Track answer distribution
      sessionResponses.forEach(r => {
        if (!answerDistMap[r.node_id]) {
          answerDistMap[r.node_id] = {}
        }
        if (!answerDistMap[r.node_id][r.question_type]) {
          answerDistMap[r.node_id][r.question_type] = {}
        }
        const answerKey = Array.isArray(r.answer) 
          ? r.answer.join(',') 
          : typeof r.answer === 'object' 
            ? JSON.stringify(r.answer) 
            : String(r.answer)
        answerDistMap[r.node_id][r.question_type][answerKey] = 
          (answerDistMap[r.node_id][r.question_type][answerKey] || 0) + 1
      })

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

    // Calculate average duration
    const averageDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0

    // Find most common path
    let mostCommonPathKey = ''
    let maxFreq = 0
    pathFrequencyMap.forEach((freq, pathKey) => {
      if (freq > maxFreq) {
        maxFreq = freq
        mostCommonPathKey = pathKey
      }
    })

    const mostCommonPath = mostCommonPathKey
      ? mostCommonPathKey.split('→').map(nodeId => ({
          nodeId,
          nodeTitle: nodeMap.get(nodeId) || 'Unknown'
        }))
      : []

    // Convert node visit stats
    const nodeVisitStats: NodeVisitStats = {}
    nodeVisitMap.forEach((stats, nodeId) => {
      nodeVisitStats[nodeId] = {
        nodeTitle: nodeMap.get(nodeId) || 'Unknown',
        visitCount: stats.count,
        avgTimeSpent: Math.round(stats.totalTime / stats.count)
      }
    })

    // Calculate video viewing stats
    const videoViewingMap: Map<string, { count: number; totalTime: number; title: string }> = new Map()
    responseData.forEach(r => {
      if (r.question_type === 'video-step' && r.answer) {
        try {
          // Handle both object and parsed JSON string
          let answer: any = r.answer
          if (typeof answer === 'string') {
            answer = JSON.parse(answer)
          }
          
          if (answer && typeof answer === 'object') {
            const componentId = answer.componentId || answer.component_id || r.node_id
            const viewingTime = answer.viewingTime || answer.viewing_time || 0
            
            if (componentId && typeof viewingTime === 'number' && viewingTime > 0) {
              const existing = videoViewingMap.get(componentId) || { count: 0, totalTime: 0, title: 'Video' }
              videoViewingMap.set(componentId, {
                count: existing.count + 1,
                totalTime: existing.totalTime + viewingTime,
                title: existing.title
              })
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    })

    const videoViewingStats: VideoViewingStats = {}
    videoViewingMap.forEach((stats, componentId) => {
      videoViewingStats[componentId] = {
        componentTitle: stats.title,
        viewCount: stats.count,
        avgViewingTime: Math.round(stats.totalTime / stats.count),
        totalViewingTime: Math.round(stats.totalTime)
      }
    })

    return {
      totalSessions,
      completedSessions,
      completionRate: Math.round(completionRate * 100) / 100,
      dropOffRate: Math.round(dropOffRate * 100) / 100,
      averageDuration,
      sessions: Array.from(sessionsMap.values()),
      pathAnalytics: {
        mostCommonPath,
        pathFrequency: pathFrequencyMap
      },
      answerDistribution: answerDistMap,
      nodeVisitStats,
      videoViewingStats
    }
  } catch (error) {
    console.error('Error getting flow analytics:', error)
      return {
        totalSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        dropOffRate: 0,
        averageDuration: 0,
        sessions: [],
        pathAnalytics: {
          mostCommonPath: [],
          pathFrequency: new Map()
        },
        answerDistribution: {},
        nodeVisitStats: {},
        videoViewingStats: {}
      }
  }
}

