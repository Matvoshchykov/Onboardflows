"use client"

import { useState, useEffect } from "react"
import { Download, TrendingUp, Users, CheckCircle2, Clock } from "lucide-react"
import { getFlowAnalytics, type AnalyticsData, type CompletedSessionData } from "@/lib/db/analytics"
import type { Flow } from "./flow-builder"

type FlowAnalyticsProps = {
  flow: Flow
}

export function FlowAnalytics({ flow }: FlowAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true)
      try {
        const nodeTitles = flow.nodes.map(n => ({ id: n.id, title: n.title || 'Untitled' }))
        const data = await getFlowAnalytics(flow.id, nodeTitles)
        setAnalytics(data)
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

    // Create CSV headers
    const headers = ['User ID', 'Started At', 'Completed At', 'Duration (seconds)', 'Path Taken', 'Answers']
    
    // Create CSV rows
    const rows = analytics.sessions.map(session => {
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
        session.userId,
        new Date(session.startedAt).toLocaleString(),
        new Date(session.completedAt).toLocaleString(),
        session.duration.toString(),
        pathString,
        answersString
      ]
    })

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Create download link
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

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Error loading analytics</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-background overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Flow Analytics</h2>
          <button
            onClick={exportToCSV}
            disabled={analytics.sessions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-6 shadow-neumorphic-raised">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Total Started</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{analytics.totalSessions}</p>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-neumorphic-raised">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
              <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{analytics.completedSessions}</p>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-neumorphic-raised">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-[#3b82f6]" />
              <h3 className="text-sm font-medium text-muted-foreground">Completion Rate</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{analytics.completionRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Sessions Table */}
        {analytics.sessions.length > 0 ? (
          <div className="bg-card rounded-xl shadow-neumorphic-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Path</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Answers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analytics.sessions.map((session, idx) => (
                    <tr key={session.sessionId} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                      <td className="px-4 py-3 text-sm text-foreground font-mono">{session.userId.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(session.startedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(session.duration)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex flex-wrap gap-1">
                          {session.path.map((p, i) => (
                            <span key={i} className="inline-flex items-center">
                              <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs">{p.nodeTitle}</span>
                              {i < session.path.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="space-y-1 max-w-md">
                          {session.responses.map((r, i) => {
                            const answerValue = Array.isArray(r.answer)
                              ? r.answer.join(', ')
                              : typeof r.answer === 'object'
                                ? JSON.stringify(r.answer)
                                : String(r.answer)
                            return (
                              <div key={i} className="text-xs">
                                <span className="font-medium text-muted-foreground">{r.nodeTitle}:</span>{' '}
                                <span className="text-foreground">{answerValue}</span>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-12 shadow-neumorphic-raised text-center">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No completed sessions yet</p>
            <p className="text-sm text-muted-foreground mt-2">Analytics will appear here once users complete the flow</p>
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
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

