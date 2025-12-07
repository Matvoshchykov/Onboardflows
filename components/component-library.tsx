"use client"

import { Video, AlignLeft, CheckSquare, ListChecks, FileText, Heading, SlidersHorizontal, Upload, Link2, Image as ImageIcon } from 'lucide-react'
import type { ComponentType } from "./page-editor"

const components: { type: ComponentType; icon: any; title: string; description: string }[] = [
  {
    type: "video-step",
    icon: Video,
    title: "Video Step Block",
    description: "Show a welcome/explainer video with optional CTA"
  },
  {
    type: "text-instruction",
    icon: AlignLeft,
    title: "Text / Instruction Block",
    description: "Rich text for guidance, steps, disclaimers"
  },
  {
    type: "header",
    icon: Heading,
    title: "Header / Title",
    description: "Large title or heading text"
  },
  {
    type: "multiple-choice",
    icon: CheckSquare,
    title: "Multiple Choice Question",
    description: "Single-select answers for segmentation"
  },
  {
    type: "checkbox-multi",
    icon: ListChecks,
    title: "Checkbox / Multi-select",
    description: "Multiple selections for interests, goals"
  },
  {
    type: "short-answer",
    icon: FileText,
    title: "Short Answer Input",
    description: "1-line input for names, handles, etc."
  },
  {
    type: "scale-slider",
    icon: SlidersHorizontal,
    title: "Scale / Slider Question",
    description: "Range slider for experience, budget, etc."
  },
  {
    type: "file-upload",
    icon: Upload,
    title: "File Upload Block",
    description: "Collect documents, assets, resumes"
  },
  {
    type: "link-button",
    icon: Link2,
    title: "Link Button",
    description: "Clickable button with URL link"
  },
  {
    type: "image",
    icon: ImageIcon,
    title: "Image",
    description: "Display an image"
  }
]

type ComponentLibraryProps = {
  onDragStart?: (type: ComponentType, e: React.MouseEvent) => void
  onAddComponent?: (type: ComponentType) => void
}

export function ComponentLibrary({ onDragStart, onAddComponent }: ComponentLibraryProps) {
  return (
    <div style={{ zoom: '1', transform: 'scale(1)', fontSize: '12px' }}>
      {components.map((component, index) => {
        const Icon = component.icon
        return (
          <button
            key={component.type}
            onClick={(e) => {
              e.stopPropagation()
              if (onAddComponent) {
                onAddComponent(component.type)
              }
            }}
            onMouseDown={(e) => {
              if (onDragStart && !onAddComponent) {
                onDragStart(component.type, e)
              }
            }}
            className="w-full text-left rounded-lg bg-card/40 backdrop-blur-sm hover:bg-card/70 transition-all duration-200 cursor-pointer border border-border/20"
            style={{ 
              zoom: '1', 
              transform: 'scale(1)',
              fontSize: '12px',
              padding: '6px 8px',
              marginBottom: index < components.length - 1 ? '4px' : '0',
              whiteSpace: 'nowrap'
            }}
          >
            <div className="flex items-center" style={{ gap: '6px' }}>
              <div className="bg-muted/40 rounded flex items-center justify-center flex-shrink-0" style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px', maxWidth: '14px', maxHeight: '14px' }}>
                <Icon style={{ width: '8px', height: '8px', minWidth: '8px', minHeight: '8px', maxWidth: '8px', maxHeight: '8px' }} />
              </div>
              <div className="flex items-center" style={{ gap: '6px', flex: '1 1 0', minWidth: 0, overflow: 'visible' }}>
                <h4 className="font-medium" style={{ fontSize: '12px', lineHeight: '1.2', margin: 0, padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>{component.title}</h4>
                <span className="text-muted-foreground" style={{ fontSize: '11px', lineHeight: '1.2', margin: 0, padding: 0, whiteSpace: 'nowrap', overflow: 'visible' }}>{component.description}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
