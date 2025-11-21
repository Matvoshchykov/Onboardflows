"use client"

import { useState, useEffect } from "react"
import { X, Smartphone, Monitor, Plus, ChevronDown } from 'lucide-react'
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
  // Helper to check if pageComponents is in object format
  const isObjectFormat = (pc: typeof node.pageComponents): pc is { displayUpload?: PageComponent; question?: PageComponent; textInstruction?: PageComponent } => {
    return pc !== undefined && !Array.isArray(pc)
  }

  const [pageTitle, setPageTitle] = useState(node.title)
  const [displayUpload, setDisplayUpload] = useState<PageComponent | null>(
    isObjectFormat(node.pageComponents) ? (node.pageComponents.displayUpload || null) : null
  )
  const [question, setQuestion] = useState<PageComponent | null>(
    isObjectFormat(node.pageComponents) ? (node.pageComponents.question || null) : null
  )
  const [textInstruction, setTextInstruction] = useState<PageComponent | null>(
    isObjectFormat(node.pageComponents) ? (node.pageComponents.textInstruction || null) : null
  )
  const [selectedComponent, setSelectedComponent] = useState<PageComponent | null>(null)
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop")
  const [draggingComponent, setDraggingComponent] = useState<ComponentType | null>(null)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false)

  // Load existing components when node changes
  useEffect(() => {
    setPageTitle(node.title)
    if (isObjectFormat(node.pageComponents)) {
      setDisplayUpload(node.pageComponents.displayUpload || null)
      setQuestion(node.pageComponents.question || null)
      setTextInstruction(node.pageComponents.textInstruction || null)
    } else {
      setDisplayUpload(null)
      setQuestion(null)
      setTextInstruction(null)
    }
  }, [node])

  const handleDragStart = (type: ComponentType, e: React.MouseEvent) => {
    // Check if component type is already added
    if (DISPLAY_UPLOAD_TYPES.includes(type) && displayUpload) {
      toast.error("Only one display/upload block allowed", {
        description: "Remove the existing display or upload block before adding another.",
      })
      return
    }
    if (QUESTION_TYPES.includes(type) && question) {
      toast.error("Only one question block allowed", {
        description: "Remove the existing question block before adding another.",
      })
      return
    }
    if (type === TEXT_INSTRUCTION_TYPE && textInstruction) {
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
        config
      }

      if (DISPLAY_UPLOAD_TYPES.includes(draggingComponent)) {
        setDisplayUpload(newComponent)
      } else if (QUESTION_TYPES.includes(draggingComponent)) {
        setQuestion(newComponent)
      } else if (draggingComponent === TEXT_INSTRUCTION_TYPE) {
        setTextInstruction(newComponent)
      }

      setDraggingComponent(null)
    }
  }

  const handleDeleteComponent = (id: string) => {
    if (displayUpload?.id === id) {
      setDisplayUpload(null)
    }
    if (question?.id === id) {
      setQuestion(null)
    }
    if (textInstruction?.id === id) {
      setTextInstruction(null)
    }
    if (selectedComponent?.id === id) {
      setSelectedComponent(null)
    }
  }

  const handleUpdateComponent = (id: string, config: Record<string, any>) => {
    if (displayUpload?.id === id) {
      setDisplayUpload({ ...displayUpload, config })
    }
    if (question?.id === id) {
      setQuestion({ ...question, config })
    }
    if (textInstruction?.id === id) {
      setTextInstruction({ ...textInstruction, config })
    }
    if (selectedComponent?.id === id) {
      setSelectedComponent({ ...selectedComponent, config })
    }
  }

  const handleSave = () => {
    const componentCount = (displayUpload ? 1 : 0) + (question ? 1 : 0) + (textInstruction ? 1 : 0)
    const updatedNode: FlowNode = {
      ...node,
      title: pageTitle,
      components: componentCount,
      pageComponents: {
        displayUpload: displayUpload || undefined,
        question: question || undefined,
        textInstruction: textInstruction || undefined
      }
    }
    onSave(updatedNode)
  }

  const components = [
    ...(textInstruction ? [textInstruction] : []),
    ...(displayUpload ? [displayUpload] : []),
    ...(question ? [question] : [])
  ]

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
              components={components}
              viewMode={viewMode}
              selectedComponent={selectedComponent}
              onSelectComponent={setSelectedComponent}
              onDeleteComponent={handleDeleteComponent}
              onUpdateComponent={handleUpdateComponent}
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
