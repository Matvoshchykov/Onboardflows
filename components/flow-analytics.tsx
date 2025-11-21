"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, TrendingUp, Users, CheckCircle2, Clock, TrendingDown, BarChart3, PieChart, Activity } from "lucide-react"
import { getFlowAnalytics, type AnalyticsData, type CompletedSessionData } from "@/lib/db/analytics"
import type { Flow } from "./flow-builder"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, Legend } from "recharts"

type FlowAnalyticsProps = {
  flow: Flow
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

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"]

export function FlowAnalytics({ flow }: FlowAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userNicknames, setUserNicknames] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true)
      try {
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
  }, [flow.id, flow.nodes])

  const exportToCSV = () => {
    if (!analytics || analytics.sessions.length === 0) return

    const headers = ['User', 'Started At', 'Completed At', 'Duration (seconds)', 'Path Taken', 'Answers']
    
    const rows = analytics.sessions.map(session => {
      const userDisplay = userNicknames[session.userId] || session.userId.slice(0, 8)
      const pathString = session.path.map(p => p.nodeTitle).join(' → ')
      const answersString = session.responses.map(r => {
        const answerValue = Array.isArray(r.answer) 
          ? r.answer.join(', ') 
          : typeof r.answer === 'object' 
            ? JSON.stringify(r.answer) 
            : String(r.answer)
        return `${r.nodeTitle}: ${answerValue}`
      }).join(' | ')
      
      return [
        userDisplay,
        new Date(session.startedAt).toLocaleString(),
        new Date(session.completedAt).toLocaleString(),
        session.duration.toString(),
        pathString,
        answersString
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

  // Prepare chart data
  const nodeVisitChartData = useMemo(() => {
    if (!analytics?.nodeVisitStats) return []
    return Object.entries(analytics.nodeVisitStats)
      .map(([nodeId, stats]) => ({
        name: stats.nodeTitle.length > 20 ? stats.nodeTitle.slice(0, 20) + '...' : stats.nodeTitle,
        visits: stats.visitCount,
        avgTime: stats.avgTimeSpent
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)
  }, [analytics])

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

  return (
    <div className="h-full w-full bg-background overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Flow Analytics</h2>
          <button
            onClick={exportToCSV}
            disabled={analytics.sessions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

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

        {/* Charts Row */}
        {analytics.sessions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Completion Pie Chart */}
            <div className="bg-card rounded-lg p-4 shadow-neumorphic-raised">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">Completion Overview</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <RechartsPieChart>
                  <Pie
                    data={completionChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {completionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Node Visit Chart */}
            {nodeVisitChartData.length > 0 && (
              <div className="bg-card rounded-lg p-4 shadow-neumorphic-raised">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground">Top Visited Nodes</h3>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={nodeVisitChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Compact Sessions Table */}
        {analytics.sessions.length > 0 ? (
          <div className="bg-card rounded-lg shadow-neumorphic-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Path</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Answers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analytics.sessions.map((session, idx) => {
                    const userDisplay = userNicknames[session.userId] || session.userId.slice(0, 8)
                    return (
                      <tr key={session.sessionId} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/10 hover:bg-muted/20'}>
                        <td className="px-3 py-2 text-xs text-foreground font-medium">{userDisplay}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(session.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatDuration(session.duration)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex flex-wrap gap-0.5">
                            {session.path.map((p, i) => {
                              const colorIndex = i % CONNECTION_COLORS.length
                              return (
                                <span key={i} className="inline-flex items-center gap-0.5">
                                  <span 
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" 
                                    style={{ backgroundColor: CONNECTION_COLORS[colorIndex] }}
                                  >
                                    {p.nodeTitle.length > 15 ? p.nodeTitle.slice(0, 15) + '...' : p.nodeTitle}
                                  </span>
                                  {i < session.path.length - 1 && <span className="text-muted-foreground">→</span>}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-foreground max-w-md">
                          <div className="space-y-0.5">
                            {session.responses.slice(0, 3).map((r, i) => {
                              const answerValue = Array.isArray(r.answer)
                                ? r.answer.join(', ')
                                : typeof r.answer === 'object'
                                  ? JSON.stringify(r.answer)
                                  : String(r.answer)
                              const truncatedAnswer = answerValue.length > 30 ? answerValue.slice(0, 30) + '...' : answerValue
                              return (
                                <div key={i} className="text-[10px]">
                                  <span className="font-medium text-muted-foreground">{r.nodeTitle}:</span>{' '}
                                  <span className="text-foreground">{truncatedAnswer}</span>
                                </div>
                              )
                            })}
                            {session.responses.length > 3 && (
                              <div className="text-[10px] text-muted-foreground">+{session.responses.length - 3} more</div>
                            )}
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
