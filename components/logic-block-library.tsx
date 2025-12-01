"use client"

import { ChevronRight } from 'lucide-react'
import type { LogicBlock } from './flow-canvas'

const logicBlockTypes: LogicBlock['type'][] = ["if-else", "multi-path", "score-threshold", "a-b-test"]

const getLogicBlockDisplayName = (type: LogicBlock['type']): string => {
  switch (type) {
    case "if-else":
      return "IF / ELSE"
    case "multi-path":
      return "MULTI-PATH"
    case "score-threshold":
      return "SCORE CHECK"
    case "a-b-test":
      return "A/B TEST"
    default:
      return type.toUpperCase()
  }
}

const getLogicBlockGlowColor = (type: LogicBlock['type']): string => {
  switch (type) {
    case "if-else":
      return "#10b981" // Green
    case "multi-path":
      return "#3b82f6" // Blue
    case "score-threshold":
      return "#f59e0b" // Amber/Orange
    case "a-b-test":
      return "#8b5cf6" // Purple
    default:
      return "#10b981"
  }
}

type LogicBlockLibraryProps = {
  onDragStart: (type: LogicBlock['type'], e: React.MouseEvent) => void
  isExpanded: boolean
  onToggle: () => void
}

export function LogicBlockLibrary({ onDragStart, isExpanded, onToggle }: LogicBlockLibraryProps) {
  return (
    <div className="relative flex items-center">
      {/* Circular Button */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggle()
        }}
        className="w-8.5 h-8.5 rounded-full bg-card/80 backdrop-blur-sm text-foreground opacity-70 shadow-neumorphic-subtle hover:shadow-neumorphic-raised hover:opacity-100 transition-all duration-300 flex items-center justify-center z-50 relative border border-border/30"
        title="Logic Blocks"
        style={{ width: '34px', height: '34px' }}
      >
        <ChevronRight 
          className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Expanded Panel - Horizontal Line */}
      {isExpanded && (
        <div className="absolute flex items-center z-40 animate-in fade-in slide-in-from-left-2 duration-300" style={{ gap: '15px', left: '45px' }}>
          {logicBlockTypes.map((blockType) => {
            const glowColor = getLogicBlockGlowColor(blockType)
            return (
              <div
                key={blockType}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDragStart(blockType, e)
                }}
                className="rounded-full bg-card/80 backdrop-blur-sm border border-border/30 shadow-neumorphic-subtle hover:shadow-neumorphic-raised hover:opacity-100 cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-105 font-bold italic text-foreground opacity-70 whitespace-nowrap select-none"
                style={{ 
                  userSelect: 'none', 
                  WebkitUserSelect: 'none',
                  fontSize: '0.52rem', // 20% smaller than 0.65rem
                  paddingLeft: '6.8px', // 20% smaller than 8.5px
                  paddingRight: '6.8px',
                  paddingTop: '4.8px', // 20% smaller than 6px
                  paddingBottom: '4.8px',
                  boxShadow: `0 0 0 1px ${glowColor}40, 0 0 4px ${glowColor}30, 0 0 8px ${glowColor}20`
                }}
              >
                {getLogicBlockDisplayName(blockType)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
