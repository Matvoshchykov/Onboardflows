"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus, Folder, FileText, TrendingUp, Moon, Sun, ShoppingBag, Play } from 'lucide-react'
import { cn } from "@/lib/utils"
import { useTheme } from "./theme-provider"
import type { Flow } from "./flow-builder"

type SidebarProps = {
  flows: Flow[]
  selectedFlow: Flow | null
  onSelectFlow: (flow: Flow) => void
  onCreateFlow: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onGoLive?: () => void
  isLive?: boolean
}

export function Sidebar({ flows, selectedFlow, onSelectFlow, onCreateFlow, isCollapsed, onToggleCollapse, onGoLive, isLive = false }: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<string[]>(["indicators"])
  const [showNewIndicatorPopup, setShowNewIndicatorPopup] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, toggleTheme } = useTheme()

  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folder) ? prev.filter((f) => f !== folder) : [...prev, folder]
    )
  }

  const handleNewFlow = () => {
    onCreateFlow()
    setShowNewIndicatorPopup(true)
    setTimeout(() => setShowNewIndicatorPopup(false), 2000)
  }

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col bg-neutral-50 dark:bg-neutral-900 transition-all duration-300 ease-in-out border-r border-neutral-200 dark:border-neutral-800",
        isCollapsed ? "w-16" : "w-80"
      )}
    >
      <button
        onClick={onToggleCollapse}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 rounded-lg bg-neutral-50/70 dark:bg-neutral-900/70 backdrop-blur-sm p-1.5 shadow-[3px_3px_6px_rgba(0,0,0,0.08),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.35),-3px_-3px_6px_rgba(255,255,255,0.02)] transition-all hover:bg-neutral-50 hover:dark:bg-neutral-900"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
        )}
      </button>

      {showNewIndicatorPopup && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-neutral-50 dark:bg-neutral-900 px-6 py-4 shadow-[8px_8px_16px_rgba(0,0,0,0.2),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,255,255,0.05)] border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Creating new flow...</p>
        </div>
      )}


      <div className="px-3 pb-3 space-y-3" style={{ marginTop: '10px' }}>
        {isCollapsed ? (
          <>
            <button 
              onClick={handleNewFlow}
              className="w-full rounded-xl p-2.5 shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300 bg-primary text-primary-foreground"
              style={{ marginTop: '15px' }}
            >
              <Plus className="h-4 w-4 mx-auto" />
            </button>
            <button 
              onClick={onGoLive}
              className="w-full rounded-xl p-2.5 shadow-[6px_6px_12px_rgba(0,0,0,0.2),-2px_-2px_6px_rgba(255,255,255,0.05)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.1)] transition-all hover:shadow-[3px_3px_6px_rgba(0,0,0,0.15),-1px_-1px_3px_rgba(255,255,255,0.03)] dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-1px_-1px_3px_rgba(255,255,255,0.05)] group relative"
              style={{ 
                backgroundColor: isLive ? '#22c55e' : 'white',
                color: isLive ? 'white' : '#6b7280'
              }}
              title="Launch the onboarding flow to their community"
            >
              <Play className={`h-4 w-4 mx-auto ${isLive ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'}`} />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={handleNewFlow}
              className="w-full rounded-xl py-2.5 text-sm font-semibold shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300 bg-primary text-primary-foreground"
            >
              New Flow
            </button>
            <button 
              onClick={onGoLive}
              className="w-full rounded-xl py-2.5 text-sm font-semibold shadow-[6px_6px_12px_rgba(0,0,0,0.25),-2px_-2px_6px_rgba(255,255,255,0.1)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.5),-2px_-2px_8px_rgba(255,255,255,0.15)] transition-all hover:shadow-[3px_3px_6px_rgba(0,0,0,0.2),-1px_-1px_3px_rgba(255,255,255,0.05)] dark:hover:shadow-[3px_3px_6px_rgba(0,0,0,0.4),-1px_-1px_3px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 group relative"
              style={{ 
                backgroundColor: isLive ? '#22c55e' : 'white',
                color: isLive ? 'white' : '#6b7280'
              }}
              title="Launch the onboarding flow to their community"
            >
              <Play className="h-4 w-4" />
              {!isCollapsed && <span>Go Live</span>}
            </button>
          </>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-3">
          <div className="mb-6">
            <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-600">Recent Flows</h3>
            <div className="space-y-2">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  onClick={() => onSelectFlow(flow)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 px-3 py-2.5 shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.4),-4px_-4px_8px_rgba(255,255,255,0.02)] transition-all hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.01)] cursor-pointer",
                    selectedFlow?.id === flow.id && "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.02)]"
                  )}
                >
                  <div className={cn(
                    "rounded-lg p-1.5 shadow-[2px_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.3)]",
                    "bg-neutral-300 dark:bg-neutral-700"
                  )}>
                    <FileText className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{flow.title}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-600">{flow.dateCreated}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-3 pb-3 mt-auto">
        {isCollapsed ? (
          <button
            onClick={toggleTheme}
            className="w-full rounded-lg bg-neutral-50 dark:bg-neutral-900 p-2 shadow-[3px_3px_6px_rgba(0,0,0,0.08),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.35),-3px_-3px_6px_rgba(255,255,255,0.02)] transition-all hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25),-2px_-2px_4px_rgba(255,255,255,0.01)]"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4 text-neutral-600 dark:text-neutral-400 mx-auto" />
            ) : (
              <Moon className="h-4 w-4 text-neutral-600 dark:text-neutral-400 mx-auto" />
            )}
          </button>
        ) : (
          <button
            onClick={toggleTheme}
            className="w-full rounded-lg bg-neutral-50 dark:bg-neutral-900 py-2.5 px-3 shadow-[3px_3px_6px_rgba(0,0,0,0.08),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.35),-3px_-3px_6px_rgba(255,255,255,0.02)] transition-all hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25),-2px_-2px_4px_rgba(255,255,255,0.01)] flex items-center justify-center gap-2"
          >
            {mounted && theme === "dark" ? (
              <>
                <Sun className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Dark Mode</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
