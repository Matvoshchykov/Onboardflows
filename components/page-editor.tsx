"use client"

import { useState, useEffect } from "react"
import { X, Smartphone, Monitor, Plus, ChevronDown, ArrowUpDown, GripVertical } from 'lucide-react'
import { toast } from "sonner"
import type { FlowNode } from "./flow-builder"
import { ComponentLibrary } from "./component-library"
import { PagePreview } from "./page-preview"
import { ComponentSettings } from "./component-settings"

export type ComponentType = 
  | "video-step"
  | "text-instruction"
  | "header"
  | "multiple-choice"
  | "checkbox-multi"
  | "short-answer"
  | "long-answer"
  | "scale-slider"
  | "file-upload"
  | "link-button"
  | "image"
  | "text-input"
  | "preference-poll"
  | "role-selector"
  | "commitment-assessment"
  | "feature-rating"
  | "kpi-input"
  | "communication-style"
  | "privacy-consent"
  | "video-embed"

export type PageComponent = {
  id: string
  type: ComponentType
  config: Record<string, any>
  order?: number
}

// Component categories
const DISPLAY_UPLOAD_TYPES: ComponentType[] = ["video-step", "file-upload"]
const QUESTION_TYPES: ComponentType[] = [
  "multiple-choice",
  "checkbox-multi",
  "short-answer",
  "scale-slider"
]
// Text instruction can be used in addition to question components
const TEXT_INSTRUCTION_TYPE: ComponentType = "text-instruction"
const TEXT_HEADER_TYPES: ComponentType[] = ["text-instruction", "header"]

type PageEditorProps = {
  node: FlowNode
  onClose: () => void
  onSave: (node: FlowNode) => void
}

// Editable page title component
function EditablePageTitle({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])

  const handleBlur = () => {
    onChange(editValue)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="text-base font-bold bg-transparent border-b-2 border-primary focus:outline-none"
        autoFocus
      />
    )
  }

  return (
    <h2 
      className="text-base font-bold cursor-text hover:bg-primary/10 rounded px-2 py-1 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      Edit: {value}
    </h2>
  )
}

export function PageEditor({ node, onClose, onSave }: PageEditorProps) {
  // Helper to normalize pageComponents to array format
  const normalizeToArray = (pageComponents: any): PageComponent[] => {
    if (!pageComponents) return []
    if (Array.isArray(pageComponents)) {
      // Ensure all components have order property
      return pageComponents.map((comp, index) => ({
        ...comp,
        order: comp.order ?? index
      })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    // Convert old object format to array
    if (typeof pageComponents === 'object') {
      const components: PageComponent[] = []
      if (pageComponents.textInstruction) {
        components.push({ ...pageComponents.textInstruction, order: 0 })
      }
      if (pageComponents.displayUpload) {
        components.push({ ...pageComponents.displayUpload, order: 1 })
      }
      if (pageComponents.question) {
        components.push({ ...pageComponents.question, order: 2 })
      }
      return components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    return []
  }

  const [pageTitle, setPageTitle] = useState(node.title)
  const [components, setComponents] = useState<PageComponent[]>(() => 
    normalizeToArray(node.pageComponents)
  )
  const [selectedComponent, setSelectedComponent] = useState<PageComponent | null>(null)
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop")
  const [draggingComponent, setDraggingComponent] = useState<ComponentType | null>(null)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false)
  const [draggedComponentId, setDraggedComponentId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Load existing components when node changes
  useEffect(() => {
    setPageTitle(node.title)
    setComponents(normalizeToArray(node.pageComponents))
  }, [node])

  // Handle drag start for reordering components
  const handleComponentDragStart = (componentId: string, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', componentId)
    setDraggedComponentId(componentId)
  }

  // Handle drag over for reordering
  const handleComponentDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  // Handle drop for reordering
  const handleComponentDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId) return

    const draggedIndex = components.findIndex(c => c.id === draggedId)
    if (draggedIndex === -1 || draggedIndex === targetIndex) {
      setDraggedComponentId(null)
      setDragOverIndex(null)
      return
    }

    const newComponents = [...components]
    const [dragged] = newComponents.splice(draggedIndex, 1)
    newComponents.splice(targetIndex, 0, dragged)
    
    // Update order property
    const updatedComponents = newComponents.map((comp, index) => ({
      ...comp,
      order: index
    }))

    setComponents(updatedComponents)
    setDraggedComponentId(null)
    setDragOverIndex(null)
  }

  // Handle drag end
  const handleComponentDragEnd = () => {
    setDraggedComponentId(null)
    setDragOverIndex(null)
  }

  const handleDragStart = (type: ComponentType, e: React.MouseEvent) => {
    // Check if component type is already added
    if (DISPLAY_UPLOAD_TYPES.includes(type) && components.some(c => DISPLAY_UPLOAD_TYPES.includes(c.type))) {
      toast.error("Only one display/upload block allowed", {
        description: "Remove the existing display or upload block before adding another.",
      })
      return
    }
    if (QUESTION_TYPES.includes(type) && components.some(c => QUESTION_TYPES.includes(c.type))) {
      toast.error("Only one question block allowed", {
        description: "Remove the existing question block before adding another.",
      })
      return
    }
    if (type === TEXT_INSTRUCTION_TYPE && components.some(c => c.type === TEXT_INSTRUCTION_TYPE)) {
      toast.error("Only one text instruction block allowed", {
        description: "Remove the existing text instruction block before adding another.",
      })
      return
    }
    
    setDraggingComponent(type)
    setDragPosition({ x: e.clientX, y: e.clientY })
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (draggingComponent) {
      setDragPosition({ x: e.clientX, y: e.clientY })
    }
  }

  const handleDragEnd = (e: React.MouseEvent) => {
    if (draggingComponent && e.buttons === 0) {
      let config: Record<string, any> = {}
      
      // Initialize default options for choice-based questions
      if (draggingComponent === "multiple-choice") {
        config = { options: ["Option A", "Option B", "Option C"] }
      } else if (draggingComponent === "checkbox-multi") {
        config = { options: ["Interest A", "Interest B", "Interest C"] }
      } else if (draggingComponent === "scale-slider") {
        // Default 1–100 slider for scoring logic
        config = {
          min: 1,
          max: 100,
          default: 50,
          minLabel: "1",
          maxLabel: "100",
        }
      }
      
      const newComponent: PageComponent = {
        id: Date.now().toString(),
        type: draggingComponent,
        config,
        order: components.length
      }

      setComponents(prev => [...prev, newComponent].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setDraggingComponent(null)
    }
  }

  const handleDeleteComponent = (id: string) => {
    const updated = components.filter(c => c.id !== id)
      .map((comp, index) => ({ ...comp, order: index }))
    setComponents(updated)
    if (selectedComponent?.id === id) {
      setSelectedComponent(null)
    }
  }

  const handleUpdateComponent = (id: string, config: Record<string, any>) => {
    setComponents(prev => prev.map(comp => 
      comp.id === id ? { ...comp, config: { ...comp.config, ...config } } : comp
    ))
    if (selectedComponent?.id === id) {
      setSelectedComponent({ ...selectedComponent, config: { ...selectedComponent.config, ...config } })
    }
  }

  const handleSave = () => {
    const updatedNode: FlowNode = {
      ...node,
      title: pageTitle,
      components: components.length,
      pageComponents: components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // Save as array with order
    }
    onSave(updatedNode)
  }

  // Sort components by order for display
  const sortedComponents = [...components].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div 
      className="fixed inset-2 bg-background z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
    >
      <div className="bg-card px-4 py-3 flex items-center justify-between border-b border-border shadow-neumorphic-subtle">
        <div className="flex-1">
          <EditablePageTitle
            value={pageTitle}
            onChange={setPageTitle}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card shadow-neumorphic-inset rounded-lg p-1">
            <button
              onClick={() => setViewMode("desktop")}
              className={`px-2.5 py-1.5 rounded-md transition-all duration-300 ${
                viewMode === "desktop" ? "bg-card shadow-neumorphic-raised" : "hover:bg-muted"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("mobile")}
              className={`px-2.5 py-1.5 rounded-md transition-all duration-300 ${
                viewMode === "mobile" ? "bg-card shadow-neumorphic-raised" : "hover:bg-muted"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300 text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-background">
          <div className="w-full max-w-6xl mx-auto py-8 px-6">
            <PagePreview
              components={sortedComponents}
              viewMode={viewMode}
              selectedComponent={selectedComponent}
              onSelectComponent={setSelectedComponent}
              onDeleteComponent={handleDeleteComponent}
              onUpdateComponent={handleUpdateComponent}
              onComponentDragStart={handleComponentDragStart}
              onComponentDragOver={handleComponentDragOver}
              onComponentDrop={handleComponentDrop}
              onComponentDragEnd={handleComponentDragEnd}
              draggedComponentId={draggedComponentId}
              dragOverIndex={dragOverIndex}
            />
          </div>
        </div>
        
        
        <div className="fixed right-0 z-40" style={{ top: '80px', paddingRight: '8px' }}>
          <div className="relative">
            {/* Dropdown button - long and thin, matching logic block dropdown */}
            <button
              onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
              className="w-[230px] h-8 bg-background/80 backdrop-blur-sm rounded-lg shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all border border-border/30 flex items-center justify-center gap-2 px-3"
              title={isLibraryExpanded ? "Collapse Components" : "Expand Components"}
            >
              <span className="text-xs font-medium text-muted-foreground">Components</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isLibraryExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown content - show components as they appear in preview */}
            {isLibraryExpanded && (
              <div className="absolute top-full right-0 mt-2 w-[246px] max-h-[600px] overflow-y-auto bg-card rounded-lg p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shadow-lg">
                <div className="mb-2">
                  <ComponentLibrary onDragStart={handleDragStart} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {draggingComponent && (
        <div
          className="fixed pointer-events-none z-[100] bg-card/95 backdrop-blur-sm shadow-neumorphic-raised rounded-lg px-3 py-2 border border-muted/30"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <p className="text-xs font-medium">{draggingComponent}</p>
        </div>
      )}
    </div>
  )
}
