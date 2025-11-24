"use client"

import { memo, useState, useRef, useEffect } from "react"
import { FileText, Eye, Crown, Plus, Trash2, ChevronDown } from 'lucide-react'
import type { FlowNode } from "./flow-builder"
import type { PageComponent, ComponentType } from "./page-editor"
import { ComponentLibrary } from "./component-library"
import { ComponentRenderer } from "./page-preview"

// Flow block colors - same as analytics for consistency
const FLOW_BLOCK_COLORS = [
  "#10b981", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
]

// Get unique color for a flow block based on its index
const getFlowBlockColor = (index: number): string => {
  return FLOW_BLOCK_COLORS[index % FLOW_BLOCK_COLORS.length]
}

// Helper function to normalize pageComponents to array format
function normalizePageComponents(pageComponents: any): PageComponent[] {
  if (!pageComponents) return []
  // If it's already an array, return it sorted by order
  if (Array.isArray(pageComponents)) {
    return [...pageComponents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  // If it's the old object format, convert it to array
  if (typeof pageComponents === 'object') {
    const components: PageComponent[] = []
    if (pageComponents.textInstruction) components.push({ ...pageComponents.textInstruction, order: 0 })
    if (pageComponents.displayUpload) components.push({ ...pageComponents.displayUpload, order: 1 })
    if (pageComponents.question) components.push({ ...pageComponents.question, order: 2 })
    return components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return []
}

type FlowNodeComponentProps = {
  node: FlowNode
  index: number
  selected: boolean
  dragging: boolean
  isConnectedAsTarget: boolean
  incomingColor: string | null
  isMobile: boolean
  theme: string | undefined
  collapsed: boolean
  showComponentLibrary: boolean
  membershipActive: boolean
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void
  onStartConnection: (e: React.MouseEvent, nodeId: string) => void
  onEndConnection: (e: React.MouseEvent, nodeId: string) => void
  onPreview: (e: React.MouseEvent, nodeId: string) => void
  onUpdateTitle: (nodeId: string, title: string) => void
  onUpgrade: () => void
  onResize: (nodeId: string, height: number) => void
  onToggleCollapse: () => void
  onToggleComponentLibrary: () => void
  onAddComponent: (type: ComponentType) => void
  onUpdateComponent: (id: string, config: any) => void
  onDeleteComponent: (id: string) => void
}

export const FlowNodeComponent = memo(function FlowNodeComponent({
  node,
  index,
  selected,
  dragging,
  isConnectedAsTarget,
  incomingColor,
  isMobile,
  theme,
  collapsed,
  showComponentLibrary,
  membershipActive,
  onMouseDown,
  onStartConnection,
  onEndConnection,
  onPreview,
  onUpdateTitle,
  onUpgrade,
  onResize,
  onToggleCollapse,
  onToggleComponentLibrary,
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent
}: FlowNodeComponentProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(node.title)
  const blockColor = getFlowBlockColor(index)
  const hasConnection = node.connections.length > 0
  const cardRef = useRef<HTMLDivElement>(null)
  
  const components = normalizePageComponents(node.pageComponents)

  // Measure height on mount and when content changes
  useEffect(() => {
    if (cardRef.current) {
      // We need to measure the total height of the node including components
      // But the parent only cared about the card height for connection lines?
      // Let's check flow-canvas.tsx:
      // const height = (card as HTMLElement).offsetHeight
      // It was selecting .flow-block-card
      // So we should measure the cardRef which is the .flow-block-card
      const height = cardRef.current.offsetHeight
      onResize(node.id, height)
    }
  }, [node.id, node.components, node.completion, onResize])

  const handleTitleSubmit = () => {
    if (titleValue.trim() && titleValue !== node.title) {
      onUpdateTitle(node.id, titleValue.trim())
    } else {
      setTitleValue(node.title)
    }
    setEditingTitle(false)
  }

  return (
    <div
      className={`node-card absolute ${selected ? 'ring-2 ring-primary/50 rounded-xl' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        zIndex: dragging ? 20 : 10,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
    >
      <div 
        ref={cardRef}
        className="flow-block-card bg-card rounded-xl p-5 w-[300px] hover:shadow-neumorphic-pressed transition-all duration-300 shadow-neumorphic-raised relative"
      >
        {/* Input port */}
        <div 
          className="connection-port absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-40 hover:scale-150 transition-transform cursor-crosshair"
          style={{
            backgroundColor: isConnectedAsTarget ? (incomingColor ?? "#10b981") : "var(--muted-foreground)",
            borderColor: isConnectedAsTarget ? (incomingColor ?? "#10b981") : "var(--muted-foreground)",
            borderWidth: "2px",
          }}
          title="Connection point"
          onMouseUp={(e) => onEndConnection(e, node.id)}
        />
      
        {/* Eye button for preview */}
        <button
          onClick={(e) => onPreview(e, node.id)}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300 text-muted-foreground hover:text-foreground z-10 touch-manipulation"
          style={{
            minWidth: isMobile ? '44px' : 'auto',
            minHeight: isMobile ? '44px' : 'auto',
            touchAction: 'manipulation'
          }}
          title="Preview this page"
        >
          <Eye className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 shadow-neumorphic-subtle p-2">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 pr-8">
            <div className="flex items-center gap-2 mb-1">
              <div className="relative flex-1">
                <h3 
                  className="font-semibold text-sm cursor-text hover:opacity-80 transition-opacity"
                  style={{ color: blockColor, visibility: editingTitle ? 'hidden' : 'visible' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingTitle(true)
                    setTitleValue(node.title)
                  }}
                >
                  {node.title}
                </h3>
                {editingTitle && (
                  <input
                    type="text"
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSubmit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleTitleSubmit()
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false)
                        setTitleValue(node.title)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-sm bg-transparent border-none focus:outline-none absolute left-0 top-0 w-full caret-current"
                    style={{ color: blockColor }}
                    autoFocus
                  />
                )}
              </div>
              {/* Upgrade button - only show when membership is not active */}
              {!membershipActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpgrade()
                  }}
                  className="flex items-center gap-1 underline font-medium text-xs whitespace-nowrap flex-shrink-0"
                  style={{ color: '#3b82f6' }}
                >
                  <Crown className="w-3 h-3" />
                  <span>Upgrade</span>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {node.components} Components / {node.completion}% Complete
            </p>
          </div>
        </div>

        {/* Output port */}
        <div
          className="connection-port absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full z-40 hover:scale-150 transition-transform cursor-crosshair touch-manipulation"
          style={{
            backgroundColor: hasConnection ? "#10b981" : "var(--muted-foreground)",
            borderColor: hasConnection ? "#10b981" : "var(--muted-foreground)",
            borderWidth: "2px",
            width: isMobile ? '44px' : '12px',
            height: isMobile ? '44px' : '12px',
            touchAction: 'manipulation'
          }}
          title="Connect to another block"
          onMouseDown={(e) => onStartConnection(e, node.id)}
          onTouchStart={(e) => {
            e.stopPropagation()
            const touch = e.touches[0]
            const syntheticEvent = {
              ...e,
              clientX: touch.clientX,
              clientY: touch.clientY,
              stopPropagation: () => {},
              preventDefault: () => {}
            } as unknown as React.MouseEvent
            onStartConnection(syntheticEvent, node.id)
          }}
        />

        {/* Baby blue + circle button - halfway on flow block and halfway off (when no components) */}
        {components.length === 0 && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-50 flex flex-col items-center"
            style={{ transform: 'translate(-50%, calc(50% - 5px))' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleComponentLibrary()
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="w-8 h-6 rounded-full text-white transition-colors flex items-center justify-center shadow-lg touch-manipulation"
              style={{ 
                backgroundColor: '#5DADE2',
                boxShadow: '0 2px 8px rgba(93, 173, 226, 0.4)',
                minWidth: isMobile ? '44px' : '32px',
                minHeight: isMobile ? '44px' : '24px',
                touchAction: 'manipulation'
              }}
              title="Add Component"
            >
              <Plus className="w-4 h-4" />
            </button>
            
            {/* Component Library Dropdown */}
            {showComponentLibrary && (
              <div 
                data-component-library-dropdown
                className="absolute top-full left-1/2 -translate-x-1/2 w-[300px] bg-card rounded-lg p-3 shadow-lg border border-border z-50 mt-2"
              >
                <ComponentLibrary 
                  onAddComponent={onAddComponent}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Components section below the block (outside the card dimensions) - centered */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-[300px]">
        
        {/* Display components as previews with inline editing */}
        {components.length > 0 && !collapsed && (
          <div className="pt-[25px] space-y-[25px]">
            {components.map((component, idx) => {
              const isLastComponent = idx === components.length - 1
              return (
                <div key={component.id} className="relative">
                  <div
                    className="relative group bg-card rounded-lg border border-border/30 shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // Check if any input/textarea is focused (editing)
                        const activeElement = document.activeElement
                        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                          return
                        }
                        onDeleteComponent(component.id)
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity p-1.5 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed active:shadow-neumorphic-pressed text-destructive z-10 touch-manipulation"
                      style={{
                        minWidth: isMobile ? '44px' : 'auto',
                        minHeight: isMobile ? '44px' : 'auto',
                        touchAction: 'manipulation'
                      }}
                      title="Delete component"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    {/* Component Preview (editable inline) */}
                    <div className="p-4">
                      <ComponentRenderer
                        component={component}
                        onUpdateComponent={(config) => onUpdateComponent(component.id, config)}
                      />
                    </div>
                    
                    {/* Baby blue + circle button - halfway on component and halfway off (only for last component) */}
                    {isLastComponent && (
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-50 flex flex-col items-center"
                        style={{ transform: 'translate(-50%, calc(50% + 10px))' }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleComponentLibrary()
                          }}
                          className="w-8 h-6 rounded-full text-white transition-colors flex items-center justify-center shadow-lg"
                          style={{ 
                            backgroundColor: '#5DADE2',
                            boxShadow: '0 2px 8px rgba(93, 173, 226, 0.4)'
                          }}
                          title="Add Component"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        
                        {/* Retract/Expand arrow */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleCollapse()
                          }}
                          onTouchStart={(e) => e.stopPropagation()}
                          className="mt-1 p-1 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-muted-foreground hover:text-foreground touch-manipulation"
                          style={{
                            minWidth: isMobile ? '44px' : 'auto',
                            minHeight: isMobile ? '44px' : 'auto',
                            touchAction: 'manipulation'
                          }}
                          title={collapsed ? "Expand components" : "Collapse components"}
                        >
                          <ChevronDown 
                            className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} 
                          />
                        </button>
                        
                        {/* Component Library Dropdown */}
                        {showComponentLibrary && (
                          <div 
                            data-component-library-dropdown
                            className="absolute top-full left-1/2 -translate-x-1/2 w-[300px] bg-card rounded-lg p-3 shadow-lg border border-border z-50 mt-2"
                          >
                            <ComponentLibrary 
                              onAddComponent={onAddComponent}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Baby blue + circle button - halfway on flow block when collapsed */}
        {components.length > 0 && collapsed && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 z-50 flex flex-col items-center"
            style={{ transform: 'translate(-50%, calc(-50% + 10px))' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleComponentLibrary()
              }}
              className="w-8 h-6 rounded-full text-white transition-colors flex items-center justify-center shadow-lg"
              style={{ 
                backgroundColor: '#5DADE2',
                boxShadow: '0 2px 8px rgba(93, 173, 226, 0.4)'
              }}
              title="Add Component"
            >
              <Plus className="w-4 h-4" />
            </button>
            
            {/* Retract/Expand arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleCollapse()
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="mt-1 p-1 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-muted-foreground hover:text-foreground touch-manipulation"
              style={{
                minWidth: isMobile ? '44px' : 'auto',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation'
              }}
              title={collapsed ? "Expand components" : "Collapse components"}
            >
              <ChevronDown 
                className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {/* Component Library Dropdown */}
            {showComponentLibrary && (
              <div 
                data-component-library-dropdown
                className="absolute top-full left-1/2 -translate-x-1/2 w-[300px] bg-card rounded-lg p-3 shadow-lg border border-border z-50 mt-2"
              >
                <ComponentLibrary 
                  onAddComponent={onAddComponent}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.node === nextProps.node &&
    prevProps.index === nextProps.index &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.isConnectedAsTarget === nextProps.isConnectedAsTarget &&
    prevProps.incomingColor === nextProps.incomingColor &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.theme === nextProps.theme &&
    prevProps.collapsed === nextProps.collapsed &&
    prevProps.showComponentLibrary === nextProps.showComponentLibrary &&
    prevProps.membershipActive === nextProps.membershipActive
  )
})
