"use client"

import { ChevronDown } from 'lucide-react'
import { useRef, useState, useLayoutEffect } from 'react'
import type { LogicBlock } from './flow-canvas'

const logicBlockTypes: LogicBlock['type'][] = ["if-else", "multi-path", "score-threshold", "a-b-test"]

const getLogicBlockOutputColors = (type: LogicBlock['type'], pathCount: number = 4) => {
  if (type === "if-else") {
    return ["#10b981", "#ef4444"] // Green for true, Red for false
  } else if (type === "multi-path") {
    const allColors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"]
    return allColors.slice(0, pathCount)
  } else if (type === "a-b-test") {
    return ["#8b5cf6", "#f59e0b"] // Purple for A, Orange for B
  } else { // score-threshold
    return ["#10b981", "#84cc16", "#f59e0b", "#ef4444"] // Green to Red gradient - MATCH CANVAS EXACTLY
  }
}

type LogicBlockLibraryProps = {
  onDragStart: (type: LogicBlock['type'], e: React.MouseEvent) => void
}

function LogicBlockCard({ blockType, onDragStart }: { blockType: LogicBlock['type'], onDragStart: (type: LogicBlock['type'], e: React.MouseEvent) => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const inputFieldRef = useRef<HTMLDivElement>(null)
  const outputRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const mockPortRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] // For colored circles in descriptions
  const multiPathInputRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const [portPositions, setPortPositions] = useState({ input: 0, outputs: [0, 0] })
  // Match canvas logic: multi-path uses paths.length, others use 2
  const pathCount = blockType === "multi-path" ? 2 : (blockType === "if-else" || blockType === "score-threshold" || blockType === "a-b-test" ? 2 : 2)
  const outputColors = getLogicBlockOutputColors(blockType, pathCount)

  useLayoutEffect(() => {
    if (cardRef.current) {
      // Input port is centered on the card
      const cardHeight = cardRef.current.offsetHeight
      setPortPositions(prev => ({ ...prev, input: cardHeight / 2 }))
      
      // Output ports: equally spaced like canvas blocks
      const pathCount = blockType === "multi-path" ? 2 : 2
      // Equal spacing: divide card height by (pathCount + 1) and space evenly
      const spacing = cardHeight / (pathCount + 1)
      const outputs = Array.from({ length: pathCount }, (_, idx) => spacing * (idx + 1))
      setPortPositions(prev => ({ ...prev, outputs }))
    }
  }, [blockType])

  // Create exact copy of canvas logic block structure
  const getBlockPreview = () => {
    switch (blockType) {
      case "if-else":
        return (
          <div 
            ref={cardRef}
            className="rounded-xl p-1.5 w-[230px] relative shadow-neumorphic-raised border border-border/30 bg-card select-none text-[8px] shadow-lg" 
          >

                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    IF / ELSE Logic
                  </div>
                  
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-1">
                      {[''].map((condition, slotIdx) => (
                        <div key={slotIdx} className="flex items-center gap-1">
                          {slotIdx > 0 && (
                            <span className="text-[#10b981] font-bold uppercase text-[8px] px-0.5">AND</span>
                          )}
                          <div className="flex-1 relative">
                            <div ref={inputFieldRef} className="flex items-center gap-0.5 px-2 py-1 text-[9px] rounded-lg bg-card shadow-neumorphic-inset border-2 border-transparent min-h-[24px]">
                              <span className="text-muted-foreground text-[8px]">Drop variable or type condition</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Routing explanation */}
                    <div className="space-y-1 mt-1.5 text-[8px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div ref={mockPortRefs[0]} className="w-2 h-2 rounded-full" style={{ backgroundColor: outputColors[0] }}></div>
                        <span>If true → connects to page A</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div ref={mockPortRefs[1]} className="w-2 h-2 rounded-full" style={{ backgroundColor: outputColors[1] }}></div>
                        <span>If false → connects to page B</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
      case "multi-path":
        return (
          <div 
            ref={cardRef}
            className="rounded-xl p-1.5 w-[230px] relative shadow-neumorphic-raised border border-border/30 bg-card select-none text-[8px] shadow-lg" 
          >

                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Multi-Path Switch
                  </div>
                  
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    {['', ''].map((path, idx) => (
                      <div key={idx} className="relative flex items-center gap-0.5">
                        <div ref={multiPathInputRefs[idx]} className="flex-1 relative">
                          <input
                            type="text"
                            placeholder={`Answer ${idx + 1} → Page ID`}
                            value={path}
                            readOnly
                            className="w-full px-2 py-1 pr-6 text-[9px] rounded-lg bg-card shadow-neumorphic-inset focus:outline-none border-2 border-transparent transition-colors"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
      case "score-threshold":
  return (
          <div 
            ref={cardRef}
            className="rounded-xl p-1.5 w-[230px] relative shadow-neumorphic-raised border border-border/30 bg-card select-none text-[8px] shadow-lg" 
          >

                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Score Threshold
                  </div>
                  
                  <div className="space-y-1 text-[8px] text-muted-foreground pb-[15px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      placeholder="Threshold (1–100)"
                      readOnly
                      className="w-full px-2 py-1 text-[9px] rounded-lg bg-card shadow-neumorphic-inset focus:outline-none"
                    />
                    <p className="flex items-center gap-1.5">
                      <span
                        ref={mockPortRefs[0]}
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: outputColors[0] }}
                      />
                      Score ≥ threshold → connect this port to the "high score" page
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span
                        ref={mockPortRefs[1]}
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: outputColors[1] }}
                      />
                      Score &lt; threshold → connect this port to the "low score" page
                    </p>
                  </div>
                </div>
              )
      case "a-b-test":
        return (
          <div 
            ref={cardRef}
            className="rounded-xl p-1.5 w-[230px] relative shadow-neumorphic-raised border border-border/30 bg-card select-none text-[8px] shadow-lg" 
          >

                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    A/B Test
                  </div>
                  
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    <p ref={inputFieldRef} className="text-[8px] text-muted-foreground">
                      Randomly routes 50% of users to each connected page
                    </p>
                    <div className="space-y-1 mt-1.5 text-[8px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div ref={mockPortRefs[0]} className="w-2 h-2 rounded-full" style={{ backgroundColor: outputColors[0] }}></div>
                        <span>50% → connects to page A</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div ref={mockPortRefs[1]} className="w-2 h-2 rounded-full" style={{ backgroundColor: outputColors[1] }}></div>
                        <span>50% → connects to page B</span>
                      </div>
              </div>
              </div>
            </div>
              )
    }
  }

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragStart(blockType, e)
      }}
      className="cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.02] select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {getBlockPreview()}
    </div>
  )
}

export function LogicBlockLibrary({ onDragStart }: LogicBlockLibraryProps) {
  return (
    <div className="flex flex-col h-full">
      {logicBlockTypes.map((blockType, index) => (
        <div key={blockType} className="relative">
          <LogicBlockCard blockType={blockType} onDragStart={onDragStart} />
          {index < logicBlockTypes.length - 1 && (
            <div className="flex flex-col items-center">
              <div 
                className="bg-black"
                style={{
                  width: '2px',
                  height: '10px',
                  marginTop: '0',
                  marginBottom: '0'
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
