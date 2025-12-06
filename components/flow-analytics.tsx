"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, TrendingUp, Users, CheckCircle2, Clock, TrendingDown, PieChart, Activity, Lock } from "lucide-react"
import { getFlowAnalytics, type AnalyticsData, type CompletedSessionData } from "@/lib/db/analytics"
import type { Flow } from "./flow-builder"
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts"
import { UpgradeModal } from "./upgrade-modal"

type FlowAnalyticsProps = {
  flow: Flow
  membershipActive?: boolean
}

// Connection colors matching flow canvas
const CONNECTION_COLORS = [
  "#10b981", // green (default)
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
]

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6"]

// Get color for a node based on its index in the flow
const getNodeColor = (nodeId: string, flowNodes: Array<{ id: string; title: string }>): string => {
  const nodeIndex = flowNodes.findIndex(n => n.id === nodeId)
  if (nodeIndex === -1) return CHART_COLORS[0]
  return CHART_COLORS[nodeIndex % CHART_COLORS.length]
}

export function FlowAnalytics({ flow, membershipActive = false }: FlowAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userNicknames, setUserNicknames] = useState<Record<string, string>>({})
  const [isMobile, setIsMobile] = useState(false)
  const [nodeVisitPage, setNodeVisitPage] = useState(0)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true)
      try {
        // For free users, show fully fake mock data
        if (!membershipActive) {
          // Generate complete fake analytics data with all components
          const mockNodeTitles = flow.nodes.map(n => ({ id: n.id, title: n.title || 'Untitled' }))
          
          // Generate fake node visit stats
          const mockNodeVisitStats: Record<string, { nodeTitle: string; visitCount: number; avgTimeSpent: number }> = {}
          mockNodeTitles.forEach((node, idx) => {
            mockNodeVisitStats[node.id] = {
              nodeTitle: node.title,
              visitCount: Math.floor(Math.random() * 30) + 10,
              avgTimeSpent: Math.floor(Math.random() * 60) + 15
            }
          })
          
          // Generate fake sessions with paths and responses
          const mockSessions: CompletedSessionData[] = []
          const mockUserIds = ['user_001', 'user_002', 'user_003', 'user_004', 'user_005', 'user_006', 'user_007', 'user_008']
          const mockNicknames: Record<string, string> = {
            'user_001': 'John Doe',
            'user_002': 'Jane Smith',
            'user_003': 'Bob Johnson',
            'user_004': 'Alice Williams',
            'user_005': 'Charlie Brown',
            'user_006': 'Diana Prince',
            'user_007': 'Eve Adams',
            'user_008': 'Frank Miller'
          }
          
          for (let i = 0; i < 10; i++) {
            const userId = mockUserIds[i % mockUserIds.length]
            const sessionId = `session_${String(i + 1).padStart(3, '0')}`
            const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            const duration = Math.floor(Math.random() * 300) + 120
            const completedTime = new Date(startTime.getTime() + duration * 1000)
            
            // Generate fake path (visit 3-6 nodes)
            const pathLength = Math.floor(Math.random() * 4) + 3
            const shuffledNodes = [...mockNodeTitles].sort(() => Math.random() - 0.5)
            const path = shuffledNodes.slice(0, pathLength).map((node, idx) => ({
              nodeId: node.id,
              nodeTitle: node.title,
              orderIndex: idx,
              visitedAt: new Date(startTime.getTime() + idx * 30 * 1000).toISOString()
            }))
            
            // Generate fake responses
            const responses = path.slice(0, pathLength - 1).map((pathNode, idx) => {
              const node = flow.nodes.find(n => n.id === pathNode.nodeId)
              const components = node?.pageComponents || []
              const questionComponent = Array.isArray(components) 
                ? components.find((c: any) => ['multiple-choice', 'checkbox-multi', 'short-answer', 'scale-slider'].includes(c.type))
                : null
              
              let answer: any = 'Sample Answer'
              if (questionComponent?.type === 'multiple-choice') {
                const options = questionComponent.config?.options || ['Option A', 'Option B', 'Option C']
                answer = options[Math.floor(Math.random() * options.length)]
              } else if (questionComponent?.type === 'checkbox-multi') {
                const options = questionComponent.config?.options || ['Option A', 'Option B', 'Option C']
                answer = options.slice(0, Math.floor(Math.random() * options.length) + 1)
              } else if (questionComponent?.type === 'scale-slider') {
                answer = Math.floor(Math.random() * 100) + 1
              }
              
              return {
                nodeId: pathNode.nodeId,
                nodeTitle: pathNode.nodeTitle,
                questionType: questionComponent?.type || 'short-answer',
                answer: answer,
                answeredAt: new Date(startTime.getTime() + (idx + 1) * 30 * 1000).toISOString()
              }
            })
            
            mockSessions.push({
              userId,
              sessionId,
              startedAt: startTime.toISOString(),
              completedAt: completedTime.toISOString(),
              duration,
              path,
              responses
            })
          }
          
          setUserNicknames(mockNicknames)
          
          // Generate fake path analytics
          const mockPathFrequency = new Map<string, number>()
          mockSessions.forEach(session => {
            const pathKey = session.path.map(p => p.nodeId).join('→')
            mockPathFrequency.set(pathKey, (mockPathFrequency.get(pathKey) || 0) + 1)
          })
          
          // Get most common path
          const mostCommonPathKey = Array.from(mockPathFrequency.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || ''
          const mostCommonPath = mostCommonPathKey
            ? mostCommonPathKey.split('→').map(id => {
                const node = mockNodeTitles.find(n => n.id === id)
                return node ? { nodeId: node.id, nodeTitle: node.title } : null
              }).filter(Boolean) as Array<{ nodeId: string; nodeTitle: string }>
            : []
          
          const mockAnalytics: AnalyticsData = {
            totalSessions: 42,
            completedSessions: 28,
            completionRate: 66.7,
            dropOffRate: 33.3,
            averageDuration: 245,
            sessions: mockSessions,
            pathAnalytics: {
              mostCommonPath,
              pathFrequency: mockPathFrequency
            },
            answerDistribution: {},
            nodeVisitStats: mockNodeVisitStats,
            videoViewingStats: {}
          }
          setAnalytics(mockAnalytics)
          setIsLoading(false)
          return
        }

        const nodeTitles = flow.nodes.map(n => ({ id: n.id, title: n.title || 'Untitled' }))
        const data = await getFlowAnalytics(flow.id, nodeTitles)
        setAnalytics(data)

        // Load user nicknames
        if (data.sessions.length > 0) {
          const userIds = [...new Set(data.sessions.map(s => s.userId))]
          try {
            const response = await fetch('/api/get-user-nicknames', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userIds })
            })
            const { userDataMap } = await response.json()
            setUserNicknames(userDataMap || {})
          } catch (error) {
            console.error('Error loading nicknames:', error)
          }
        }
      } catch (error) {
        console.error('Error loading analytics:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadAnalytics()
    
    // Set up auto-refresh every 30 seconds to catch new completed sessions
    const refreshInterval = setInterval(() => {
      loadAnalytics()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval)
  }, [flow.id, flow.nodes, membershipActive])

  // Prepare chart data - filter out deleted nodes
  const nodeVisitChartData = useMemo(() => {
    if (!analytics?.nodeVisitStats) return []
    const existingNodeIds = new Set(flow.nodes.map(n => n.id))
    return Object.entries(analytics.nodeVisitStats)
      .filter(([nodeId]) => existingNodeIds.has(nodeId)) // Only include nodes that still exist
      .map(([nodeId, stats]) => ({
        nodeId,
        name: stats.nodeTitle.length > 20 ? stats.nodeTitle.slice(0, 20) + '...' : stats.nodeTitle,
        visits: stats.visitCount,
        avgTime: stats.avgTimeSpent
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)
  }, [analytics, flow.nodes])

  const completionChartData = useMemo(() => {
    if (!analytics) return []
    return [
      { name: 'Completed', value: analytics.completedSessions, fill: '#10b981' },
      { name: 'Dropped Off', value: analytics.totalSessions - analytics.completedSessions, fill: '#ef4444' }
    ]
  }, [analytics])

  const pathFrequencyData = useMemo(() => {
    if (!analytics?.pathAnalytics.pathFrequency) return []
    const paths = Array.from(analytics.pathAnalytics.pathFrequency.entries())
      .map(([pathKey, freq]) => ({
        path: pathKey.split('→').length + ' nodes',
        count: freq
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
    return paths
  }, [analytics])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-xs text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-xs text-muted-foreground">Error loading analytics</div>
      </div>
    )
  }

  const exportToCSV = () => {
    if (!analytics || analytics.sessions.length === 0) return

    const headers = [
      'User ID',
      'User Nickname', 
      'Session ID',
      'Started At (UTC)',
      'Completed At (UTC)',
      'Duration (seconds)',
      'Duration (formatted)',
      'Completion Status',
      'Path Taken (Node IDs)',
      'Path Taken (Node Titles)',
      'Total Nodes Visited',
      'Response Count',
      'All Responses (JSON)',
      'Individual Responses'
    ]
    
    const rows = analytics.sessions.map(session => {
      const userDisplay = userNicknames[session.userId] || session.userId.slice(0, 8)
      const pathTitles = session.path.map(p => p.nodeTitle).join(' → ')
      const pathIds = session.path.map(p => p.nodeId).join(' → ')
      
      // Format individual responses for better CSV analysis
      const responsesFormatted = session.responses.map(r => {
        const answerValue = Array.isArray(r.answer) 
          ? r.answer.join('; ') 
          : typeof r.answer === 'object' 
            ? JSON.stringify(r.answer) 
            : String(r.answer)
        return `${r.nodeTitle} [${r.nodeId}]: ${answerValue}`
      }).join(' | ')
      
      const allResponsesJson = JSON.stringify(session.responses.map(r => ({
        nodeId: r.nodeId,
        nodeTitle: r.nodeTitle,
        questionType: r.questionType,
        answer: r.answer,
        answeredAt: r.answeredAt
      })))
      
      return [
        session.userId,
        userDisplay,
        session.sessionId,
        new Date(session.startedAt).toISOString(),
        new Date(session.completedAt).toISOString(),
        session.duration.toString(),
        formatDuration(session.duration),
        'Completed',
        pathIds,
        pathTitles,
        session.path.length.toString(),
        session.responses.length.toString(),
        allResponsesJson,
        responsesFormatted
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `flow-analytics-${flow.id}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="h-full w-full bg-background overflow-y-auto p-4 relative">
      {/* Export Button - Top Right */}
      <button
        onClick={membershipActive ? exportToCSV : () => setShowUpgradeModal(true)}
        disabled={membershipActive && (!analytics || analytics.sessions.length === 0)}
        className="fixed right-4 z-50 font-medium transition-all duration-300 flex items-center justify-center shadow-neumorphic-raised hover:shadow-neumorphic-pressed active:shadow-neumorphic-pressed touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          top: 'calc(3.5rem + 8px - 50px)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          minWidth: isMobile ? '80px' : '190px',
          minHeight: isMobile ? '44px' : '32px',
          padding: isMobile ? '0 16px' : '0 12px',
          fontSize: isMobile ? '0.75rem' : '0.827rem',
          borderRadius: '10px'
        }}
        title={!membershipActive ? "Premium only - Upgrade to export" : "Export CSV"}
      >
          {!membershipActive ? (
            <>
              <Lock className={isMobile ? 'w-4 h-4 mr-2' : 'w-4 h-4 mr-1.5'} />
              <span>Premium only</span>
            </>
          ) : (
            <>
              <Download className={isMobile ? 'w-4 h-4 mr-2' : 'w-4 h-4 mr-1.5'} />
              <span>Export CSV</span>
            </>
          )}
        </button>
      </div>

      {/* Blurred mock data for free users - show fake data but blurred */}
      <div className={!membershipActive ? 'blur-sm' : ''}>
      
      <div className="max-w-7xl mx-auto space-y-4 pt-8">

        {/* Stats Cards - Smaller */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-card rounded-lg p-3 shadow-neumorphic-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Started</h3>
            </div>
            <p className="text-xl font-bold text-foreground">{analytics.totalSessions}</p>
          </div>

          <div className="bg-card rounded-lg p-3 shadow-neumorphic-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Completed</h3>
            </div>
            <p className="text-xl font-bold text-foreground">{analytics.completedSessions}</p>
          </div>

          <div className="bg-card rounded-lg p-3 shadow-neumorphic-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-[#3b82f6]" />
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Complete %</h3>
            </div>
            <p className="text-xl font-bold text-foreground">{analytics.completionRate.toFixed(1)}%</p>
          </div>

          <div className="bg-card rounded-lg p-3 shadow-neumorphic-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-[#ef4444]" />
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Drop-off</h3>
            </div>
            <p className="text-xl font-bold text-foreground">{analytics.dropOffRate.toFixed(1)}%</p>
          </div>

          <div className="bg-card rounded-lg p-3 shadow-neumorphic-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Avg Duration</h3>
            </div>
            <p className="text-xl font-bold text-foreground">{formatDuration(analytics.averageDuration)}</p>
          </div>
        </div>

        {/* Charts Row - Pie Chart and Visited Nodes Side by Side */}
        {analytics.sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Completion Pie Chart */}
            <div className="bg-card rounded-lg p-4 shadow-neumorphic-raised relative">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">Completion Overview</h3>
              </div>
              {/* Pie Chart Container - Centered and Symmetrical */}
              <div className="flex flex-col items-center justify-center py-4" style={{ minHeight: '280px' }}>
                {/* Pie Chart - Centered */}
                <div className="relative flex items-center justify-center mb-4" style={{ width: '240px', height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={completionChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        animationBegin={0}
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {completionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legends - Balanced below chart */}
                <div className="flex items-center justify-center gap-6 flex-wrap">
                  {completionChartData.map((entry, index) => {
                    const total = completionChartData.reduce((sum, e) => sum + e.value, 0)
                    const percentage = Math.round((entry.value / total) * 100)
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2"
                      >
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: entry.fill }}
                        />
                        <span className="text-[10px] text-foreground whitespace-nowrap">
                          {entry.name}: {entry.value} ({percentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Top Visited Nodes - List View */}
            {nodeVisitChartData.length > 0 && (() => {
              const itemsPerPage = 6
              const startIndex = nodeVisitPage * itemsPerPage
              const endIndex = startIndex + itemsPerPage
              const displayedNodes = nodeVisitChartData.slice(startIndex, endIndex)
              const hasMore = endIndex < nodeVisitChartData.length
              const hasPrevious = nodeVisitPage > 0
              
              return (
                <div className="bg-card rounded-lg p-4 shadow-neumorphic-raised relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-foreground">Top Visited Nodes</h3>
                  </div>
                  <div className="space-y-2">
                    {displayedNodes.map((node, displayIndex) => {
                      const actualIndex = startIndex + displayIndex
                      const percentage = analytics.completedSessions > 0 
                        ? Math.round((node.visits / analytics.completedSessions) * 100)
                        : 0
                      // Get color based on node ID to match flow canvas colors
                      const nodeColor = getNodeColor(node.nodeId, flow.nodes)
                      return (
                        <div key={actualIndex} className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span 
                                className="text-[10px] font-medium truncate" 
                                style={{ color: nodeColor }}
                                title={node.name.length > 30 ? node.name : undefined}
                              >
                                {node.name.length > 30 ? node.name.slice(0, 30) + '...' : node.name}
                              </span>
                              <span className="text-[10px] font-semibold text-muted-foreground ml-2">{node.visits}</span>
                            </div>
                            <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ 
                                  width: `${percentage}%`,
                                  backgroundColor: nodeColor,
                                  transition: 'width 1s ease-out'
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[9px] text-muted-foreground">{formatDuration(node.avgTime)} avg</span>
                              <span className="text-[9px] text-muted-foreground">{percentage}%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Previous and Next buttons at bottom with space */}
                  {(hasMore || hasPrevious) && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() => setNodeVisitPage(prev => Math.max(0, prev - 1))}
                        disabled={!hasPrevious}
                        className="text-[10px] text-neutral-900 dark:text-neutral-100 underline hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setNodeVisitPage(prev => prev + 1)}
                        disabled={!hasMore}
                        className="text-[10px] text-neutral-900 dark:text-neutral-100 underline hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Enhanced Sessions Table with Better Data Display */}
        {analytics.sessions.length > 0 ? (
          <div className="bg-card rounded-xl shadow-neumorphic-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/30 border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Started</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Path</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Responses</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analytics.sessions.map((session, idx) => {
                    const userDisplay = userNicknames[session.userId] || session.userId.slice(0, 8)
                    return (
                      <tr key={session.sessionId} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/10 hover:bg-muted/20'}>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-foreground font-medium">{userDisplay}</span>
                            <span className="text-[8px] text-muted-foreground font-mono">{session.userId.slice(0, 12)}...</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[9px] text-muted-foreground/70">
                              {new Date(session.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-foreground font-medium">{formatDuration(session.duration)}</span>
                            <span className="text-[9px] text-muted-foreground/70">{session.duration}s</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {session.path.slice(0, 3).map((p, i) => {
                                const colorIndex = i % CONNECTION_COLORS.length
                                return (
                                  <span key={i} className="inline-flex items-center gap-0.5">
                                    <span 
                                      className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" 
                                      style={{ backgroundColor: CONNECTION_COLORS[colorIndex] }}
                                      title={p.nodeTitle}
                                    >
                                      {p.nodeTitle.length > 12 ? p.nodeTitle.slice(0, 12) + '...' : p.nodeTitle}
                                    </span>
                                    {i < Math.min(session.path.length, 3) - 1 && <span className="text-muted-foreground text-[8px]">→</span>}
                                  </span>
                                )
                              })}
                            </div>
                            {session.path.length > 3 && (
                              <span className="text-[8px] text-muted-foreground">+{session.path.length - 3} more</span>
                            )}
                            <span className="text-[8px] text-muted-foreground/70 font-mono">{session.path.length} nodes</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            {session.responses.slice(0, 3).map((r, i) => {
                              const answerValue = Array.isArray(r.answer)
                                ? r.answer.join(', ')
                                : typeof r.answer === 'object'
                                  ? JSON.stringify(r.answer)
                                  : String(r.answer)
                              const truncatedAnswer = answerValue.length > 25 ? answerValue.slice(0, 25) + '...' : answerValue
                              return (
                                <div key={i} className="text-[9px]">
                                  <span className="font-medium text-muted-foreground">{r.nodeTitle}:</span>{' '}
                                  <span className="text-foreground">{truncatedAnswer}</span>
                                </div>
                              )
                            })}
                            {session.responses.length > 3 && (
                              <span className="text-[8px] text-muted-foreground">+{session.responses.length - 3} more</span>
                            )}
                            <span className="text-[8px] text-muted-foreground/70">{session.responses.length} total</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5 text-[8px] text-muted-foreground/70">
                            <span>Session: {session.sessionId.slice(0, 8)}...</span>
                            <span>Path: {session.path.map(p => p.nodeId.slice(0, 6)).join('→')}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-lg p-8 shadow-neumorphic-raised text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-xs text-muted-foreground">No completed sessions yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Analytics will appear here once users complete the flow</p>
          </div>
        )}
      </div>
      </div>

      {/* Free plan overlay - lock overlay on top of blurred data */}
      {!membershipActive && (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card rounded-xl p-8 shadow-neumorphic-raised border border-border max-w-md mx-4 text-center pointer-events-auto">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold mb-2 text-foreground">Advanced Analytics</h3>
            <p className="text-muted-foreground mb-6">
              You need Premium to access advanced analytics and export your data.
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full py-3 px-6 rounded-lg font-medium shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-white"
              style={{ backgroundColor: '#3b82f6' }}
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentPlan="free"
        />
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${remainingMinutes}m`
}
