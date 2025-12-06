"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Waveform } from 'lucide-react'
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
  }
}

// Get the + icon color for each logic block type
const getLogicBlockColor = (type: LogicBlock['type']): string => {
  switch (type) {
    case "if-else":
      return "#ef4444" // Red
    case "multi-path":
      return "#3b82f6" // Blue (first output port)
    case "score-threshold":
      return "#10b981" // Green (first output port)
    case "a-b-test":
      return "#f59e0b" // Orange
  }
}

// Get + icon color - different colors for different blocks
const getPlusIconColor = (type: LogicBlock['type']): string => {
  switch (type) {
    case "if-else":
      return "#f59e0b" // Orange
    case "multi-path":
      return "#ef4444" // Red
    case "score-threshold":
      return "#f59e0b" // Orange
    case "a-b-test":
      return "#ef4444" // Red
  }
}

type LogicBlockLibraryProps = {
  onAddLogicBlock: (type: LogicBlock['type']) => void
  addBlockButtonRef?: React.RefObject<HTMLButtonElement | null>
}

export function LogicBlockLibrary({ onAddLogicBlock, addBlockButtonRef }: LogicBlockLibraryProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [hoveredBubble, setHoveredBubble] = useState<LogicBlock['type'] | null>(null)
  const [buttonPosition, setButtonPosition] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const updatePosition = () => {
      if (addBlockButtonRef?.current) {
        const rect = addBlockButtonRef.current.getBoundingClientRect()
        setButtonPosition({
          top: rect.top - 10 - 36, // 10px above add block button (36px = h-9)
          right: window.innerWidth - rect.right // Same right position
        })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [addBlockButtonRef])

  if (!buttonPosition) return null

  return (
    <>
      {/* Green button - same shape as add block button, 10px above it, matching "all changes saved" colorway */}
      <button
        ref={buttonRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed w-16 h-9 shadow-neumorphic-raised rounded-lg flex items-center justify-center hover:shadow-neumorphic-pressed transition-all duration-300 cursor-pointer pointer-events-auto z-[100]"
        style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: '#10b981',
          top: `${buttonPosition.top}px`,
          right: `${buttonPosition.right}px`
        }}
        title="Logic Blocks"
      >
        <Waveform className="w-5 h-5" />
      </button>

      {/* Hover transfer area - invisible bridge between button and bubbles */}
      {isHovered && (
        <div
          className="fixed z-[98]"
          style={{
            top: `${buttonPosition.top - 200}px`, // Above button, extend upward
            right: `${buttonPosition.right - 20}px`, // Extend left and right
            width: '104px', // Wider than button for easier hover
            height: '250px', // Large area to bridge button and bubbles
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      )}

      {/* Vertical popup with bubbles - appears on hover, pops up */}
      {isHovered && (
        <div
          className="fixed z-[99] flex flex-col-reverse"
          style={{
            bottom: `${window.innerHeight - buttonPosition.top - 18 - 10 - 10 - 5 + 20 + 20 + 10}px`, // Moved up another 10px (increase bottom = move up)
            right: `${buttonPosition.right - 5 - 5 + 50 - 20 - 5 - 3 - 10}px`, // Moved right 10px more (decrease right = move right)
            transform: 'translateX(0)',
            alignItems: 'flex-end',
            gap: '12px' // More spacing between circles
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {logicBlockTypes.map((blockType, index) => {
            const bubbleColor = getLogicBlockColor(blockType)
            const isHoveredBubble = hoveredBubble === blockType

  return (
    <div
                key={blockType}
                className="relative flex items-center"
                style={{
                  opacity: 0,
                  transform: 'translateY(10px)',
                  animation: `bubblePopUp 0.3s ease-out ${index * 0.05}s forwards`
                }}
                onMouseEnter={() => setHoveredBubble(blockType)}
                onMouseLeave={() => setHoveredBubble(null)}
              >
                {/* Button matching Add Block button shape exactly (w-16 h-9) */}
                <button
                  onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
                    onAddLogicBlock(blockType)
                    setIsHovered(false)
                    setHoveredBubble(null)
                  }}
                  className="w-16 h-9 bg-card border border-border shadow-neumorphic-raised rounded-lg flex items-center justify-center hover:shadow-neumorphic-pressed transition-all duration-300 cursor-pointer pointer-events-auto"
                >
                  <Plus className="w-4 h-4" style={{ color: bubbleColor }} />
                </button>
                
                {/* Name label - slides in from left on hover, text color matches circle */}
                {isHoveredBubble && (
                  <div
                    className="absolute right-full mr-3 flex items-center"
                    style={{
                      animation: 'slideInLeft 0.3s ease-out forwards'
                    }}
                  >
                    <div
                      className="px-3 py-1.5 font-medium whitespace-nowrap bg-card border border-border"
                style={{
                        color: bubbleColor, // Same color as the circle
                        borderRadius: '20px',
                        fontSize: '0.85rem' // 15% smaller than text-sm (0.875rem * 0.85 = 0.744rem, using 0.85rem)
                      }}
                    >
                      {getLogicBlockDisplayName(blockType)}
                    </div>
            </div>
          )}
        </div>
            )
          })}
    </div>
      )}
      <style>{`
        @keyframes bubblePopUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  )
}
