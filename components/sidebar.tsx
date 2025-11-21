"use client"

import { useState, useEffect } from "react"
import { Plus, FileText, Moon, Sun } from 'lucide-react'
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
}

export function Sidebar({ flows, selectedFlow, onSelectFlow, onCreateFlow, isCollapsed, onToggleCollapse }: SidebarProps) {
  // Sidebar is always expanded now (no collapse functionality)
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

  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return (
    <>
      <div
        className={cn(
          "relative flex h-screen flex-col bg-neutral-50 dark:bg-neutral-900 transition-all duration-300 ease-in-out border-r border-neutral-200 dark:border-neutral-800 z-30",
          isMobile 
            ? "w-16 absolute inset-y-0 left-0 shadow-lg"
            : "w-16"
        )}
      >

      {showNewIndicatorPopup && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-neutral-50 dark:bg-neutral-900 px-6 py-4 shadow-[8px_8px_16px_rgba(0,0,0,0.2),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.5),-8px_-8px_16px_rgba(255,255,255,0.05)] border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Creating new flow...</p>
        </div>
      )}


      <div className="px-3 pb-3 space-y-3" style={{ marginTop: '10px' }}>
        <button 
          onClick={handleNewFlow}
          className="w-full aspect-square rounded-xl p-3 shadow-neumorphic-raised hover:shadow-neumorphic-pressed active:shadow-neumorphic-pressed transition-all duration-300 bg-primary text-primary-foreground touch-manipulation relative overflow-hidden group flex items-center justify-center"
          title="Create new flow"
        >
          <Plus className="h-8 w-8 relative z-10" style={{ 
            filter: 'drop-shadow(0 1px 2px rgba(255,255,255,0.5))'
          }} />
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <div className="flex-1 px-3 py-3 space-y-2">
        {flows.map((flow) => (
          <button
            key={flow.id}
            onClick={() => onSelectFlow(flow)}
            className={cn(
              "w-full rounded-xl p-2 min-h-[44px] shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.4),-4px_-4px_8px_rgba(255,255,255,0.02)] transition-all hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.01)] cursor-pointer flex items-center justify-center group relative",
              selectedFlow?.id === flow.id && "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.02)]"
            )}
          >
            <div className={cn(
              "rounded-lg shadow-[2px_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.3)]",
              "bg-neutral-300 dark:bg-neutral-700 p-2"
            )}>
              <FileText className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
            </div>
            {/* Tooltip on hover - opposite theme */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {flow.title}
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 pb-3 mt-auto">
        <button
          onClick={toggleTheme}
          className="w-full rounded-lg bg-neutral-50 dark:bg-neutral-900 p-2 min-h-[44px] shadow-[3px_3px_6px_rgba(0,0,0,0.08),-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_6px_rgba(0,0,0,0.35),-3px_-3px_6px_rgba(255,255,255,0.02)] transition-all hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.25),-2px_-2px_4px_rgba(255,255,255,0.01)] flex items-center justify-center"
          title={mounted && theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          ) : (
            <Moon className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
          )}
        </button>
      </div>
      </div>
    </>
  )
}
