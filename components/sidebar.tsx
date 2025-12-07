"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, FileText, Trash2 } from 'lucide-react'
import { cn } from "@/lib/utils"
import type { Flow } from "./flow-builder"

type SidebarProps = {
  flows: Flow[]
  selectedFlow: Flow | null
  onSelectFlow: (flow: Flow) => void
  onCreateFlow: () => void
  onDeleteFlow: (flow: Flow) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

type FlowButtonProps = {
  flow: Flow
  isSelected: boolean
  onSelect: () => void
  onDelete: (flow: Flow) => void
}

function FlowButton({ flow, isSelected, onSelect, onDelete }: FlowButtonProps) {
  const [imageError, setImageError] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top + rect.height / 2 - 7, // Center vertically with logo, moved up 7px
        left: rect.right + 8
      })
    }
    setShowTooltip(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setShowTooltip(false)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to delete "${flow.title}"? This action cannot be undone.`)) {
      onDelete(flow)
    }
  }

  return (
    <>
      <div 
        className="relative" 
        style={{ overflow: 'visible' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          ref={buttonRef}
          onClick={onSelect}
          className={cn(
            "w-full aspect-square rounded-xl p-0 shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.4),-4px_-4px_8px_rgba(255,255,255,0.02)] transition-all hover:shadow-[2px_2px_4px_rgba(0,0,0,0.05),-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[2px_2px_4px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.01)] cursor-pointer flex items-center justify-center relative overflow-hidden",
            isSelected && "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1),inset_-4px_-4px_8px_rgba(255,255,255,0.9)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.02)]"
          )}
        >
          {flow.icon_url && !imageError ? (
            <img
              src={flow.icon_url}
              alt={flow.title}
              className="w-full h-full object-cover rounded-xl"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className={cn(
              "w-full h-full rounded-xl shadow-[2px_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[2px_2px_4px_rgba(0,0,0,0.3)]",
              "bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center"
            )}>
              <FileText className="text-neutral-500 dark:text-neutral-400" style={{ width: '15px', height: '15px' }} />
            </div>
          )}
          {/* Delete button - red trash icon overlapping top right, only visible on hover */}
          {isHovered && (
            <button
              onClick={handleDelete}
              className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all z-10"
              style={{
                transform: 'translate(25%, -25%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.2s ease-in-out'
              }}
              title={`Delete ${flow.title}`}
            >
              <Trash2 className="w-2.5 h-2.5 text-white" />
            </button>
          )}
        </button>
      </div>
      {/* Tooltip on hover - sleek small card */}
      {showTooltip && (
        <div 
          className="fixed px-3 py-2 bg-card border border-border/30 rounded-lg shadow-lg pointer-events-none whitespace-nowrap backdrop-blur-sm"
          style={{ 
            zIndex: 99999,
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateY(-50%)',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--foreground)'
          }}
        >
          {flow.title}
        </div>
      )}
    </>
  )
}

export function Sidebar({ flows, selectedFlow, onSelectFlow, onCreateFlow, onDeleteFlow, isCollapsed, onToggleCollapse }: SidebarProps) {
  // Sidebar is always expanded now (no collapse functionality)
  const [expandedFolders, setExpandedFolders] = useState<string[]>(["indicators"])
  const [showNewIndicatorPopup, setShowNewIndicatorPopup] = useState(false)

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
          "relative flex h-screen flex-col bg-neutral-50 dark:bg-neutral-900 transition-all duration-300 ease-in-out border-r border-gray-400 dark:border-gray-500 z-30",
          isMobile 
            ? "w-16 absolute inset-y-0 left-0 shadow-lg"
            : "w-16"
        )}
        style={{ borderRightWidth: '1px', overflow: 'visible' }}
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

      <div className="flex-1 px-3 py-3 space-y-2" style={{ overflow: 'visible' }}>
        {flows.map((flow) => (
          <FlowButton
            key={flow.id}
            flow={flow}
            isSelected={selectedFlow?.id === flow.id}
            onSelect={() => onSelectFlow(flow)}
            onDelete={onDeleteFlow}
          />
        ))}
      </div>

      </div>
    </>
  )
}
