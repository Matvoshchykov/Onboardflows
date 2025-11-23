"use client"

import { Settings } from 'lucide-react'
import type { PageComponent } from "./page-editor"
import { useState, useEffect } from "react"

type ComponentSettingsProps = {
  component: PageComponent | null
  onUpdateConfig: (config: Record<string, any>) => void
}

export function ComponentSettings({ component, onUpdateConfig }: ComponentSettingsProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({})

  useEffect(() => {
    if (component) {
      setLocalConfig(component.config)
    }
  }, [component])

  if (!component) {
    return (
      <div className="w-[320px] bg-card border-l border-border flex flex-col items-center justify-center text-muted-foreground p-6">
        <Settings className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm text-center">Select a component to configure its settings</p>
      </div>
    )
  }

  const handleChange = (key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value }
    setLocalConfig(newConfig)
    onUpdateConfig(newConfig)
  }

  const renderSettings = () => {
    switch (component.type) {
      case "text-input":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Label</label>
              <input
                type="text"
                value={localConfig.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                placeholder="What is your main challenge?"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Placeholder</label>
              <input
                type="text"
                value={localConfig.placeholder || ""}
                onChange={(e) => handleChange("placeholder", e.target.value)}
                placeholder="Type your answer..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
              />
            </div>
          </>
        )

      case "preference-poll":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Rank your priorities"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Options (comma separated)</label>
              <textarea
                value={(localConfig.options || []).join(", ")}
                onChange={(e) => handleChange("options", e.target.value.split(",").map((s: string) => s.trim()))}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
          </>
        )

      case "role-selector":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Select your role"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Roles (comma separated)</label>
              <textarea
                value={(localConfig.roles || []).join(", ")}
                onChange={(e) => handleChange("roles", e.target.value.split(",").map((s: string) => s.trim()))}
                placeholder="Creator, Manager, Developer"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
          </>
        )

      case "commitment-assessment":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Choose your level"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Tiers (comma separated)</label>
              <textarea
                value={(localConfig.tiers || []).join(", ")}
                onChange={(e) => handleChange("tiers", e.target.value.split(",").map((s: string) => s.trim()))}
                placeholder="Starter, Pro, Enterprise"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
          </>
        )

      case "feature-rating":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Rate features"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Features (comma separated)</label>
              <textarea
                value={(localConfig.features || []).join(", ")}
                onChange={(e) => handleChange("features", e.target.value.split(",").map((s: string) => s.trim()))}
                placeholder="Analytics, Automation, Reports"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
          </>
        )

      case "kpi-input":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Label</label>
              <input
                type="text"
                value={localConfig.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                placeholder="What is your goal?"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Unit</label>
              <input
                type="text"
                value={localConfig.unit || ""}
                onChange={(e) => handleChange("unit", e.target.value)}
                placeholder="users, sales, etc."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      case "communication-style":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Preferred learning style"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Styles (comma separated)</label>
              <textarea
                value={(localConfig.styles || []).join(", ")}
                onChange={(e) => handleChange("styles", e.target.value.split(",").map((s: string) => s.trim()))}
                placeholder="Videos, Webinars, Docs, Email"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
          </>
        )

      case "privacy-consent":
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Consent Text</label>
            <textarea
              value={localConfig.text || ""}
              onChange={(e) => handleChange("text", e.target.value)}
              placeholder="Privacy policy text..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
            />
          </div>
        )

      case "video-embed":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Video title"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Video URL</label>
              <input
                type="url"
                value={localConfig.videoUrl || ""}
                onChange={(e) => handleChange("videoUrl", e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={localConfig.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Video description..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
          </>
        )

      case "file-upload":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Label</label>
              <input
                type="text"
                value={localConfig.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                placeholder="Upload documents"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Accepted File Types</label>
              <input
                type="text"
                value={localConfig.acceptedTypes || ""}
                onChange={(e) => handleChange("acceptedTypes", e.target.value)}
                placeholder="PDF, DOC, DOCX"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      case "multiple-choice":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title / Header</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Select your answer"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Options (one per line)</label>
              <textarea
                value={(localConfig.options || []).join("\n")}
                onChange={(e) => handleChange("options", e.target.value.split("\n").filter(s => s.trim()))}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">Add one option per line</p>
            </div>
          </>
        )

      case "checkbox-multi":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title / Header</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Select all that apply"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Options (one per line)</label>
              <textarea
                value={(localConfig.options || []).join("\n")}
                onChange={(e) => handleChange("options", e.target.value.split("\n").filter(s => s.trim()))}
                placeholder="Interest 1&#10;Interest 2&#10;Interest 3"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">Add one option per line</p>
            </div>
          </>
        )

      case "short-answer":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Question</label>
              <input
                type="text"
                value={localConfig.question || ""}
                onChange={(e) => handleChange("question", e.target.value)}
                placeholder="What is your name?"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Instructions (optional)</label>
              <textarea
                value={localConfig.instructions || ""}
                onChange={(e) => handleChange("instructions", e.target.value)}
                placeholder="Please provide a short answer..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px]"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Placeholder</label>
              <input
                type="text"
                value={localConfig.placeholder || ""}
                onChange={(e) => handleChange("placeholder", e.target.value)}
                placeholder="Type your answer..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      case "header":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Header Title"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      case "link-button":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={localConfig.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Add information about this button..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">URL</label>
              <input
                type="url"
                value={localConfig.url || ""}
                onChange={(e) => handleChange("url", e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Button Label</label>
              <input
                type="text"
                value={localConfig.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                placeholder="Click here"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      case "image":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Image Title"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Alt Text</label>
              <input
                type="text"
                value={localConfig.alt || ""}
                onChange={(e) => handleChange("alt", e.target.value)}
                placeholder="Image description"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">Drag and drop an image file or click the placeholder to upload</p>
          </>
        )

      case "scale-slider":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Label / Header</label>
              <input
                type="text"
                value={localConfig.label || ""}
                onChange={(e) => handleChange("label", e.target.value)}
                placeholder="Rate your experience level"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Minimum Value</label>
              <input
                type="number"
                value={localConfig.min ?? 1}
                onChange={(e) => handleChange("min", parseInt(e.target.value) || 1)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Maximum Value</label>
              <input
                type="number"
                value={localConfig.max ?? 100}
                onChange={(e) => handleChange("max", parseInt(e.target.value) || 100)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Default Value</label>
              <input
                type="number"
                value={localConfig.default ?? 50}
                onChange={(e) => handleChange("default", parseInt(e.target.value) || 50)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Minimum Label</label>
              <input
                type="text"
                value={localConfig.minLabel || ""}
                onChange={(e) => handleChange("minLabel", e.target.value)}
                placeholder="1"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Maximum Label</label>
              <input
                type="text"
                value={localConfig.maxLabel || ""}
                onChange={(e) => handleChange("maxLabel", e.target.value)}
                placeholder="100"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      case "text-instruction":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title (optional)</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Instruction title"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Content</label>
              <textarea
                value={localConfig.content || ""}
                onChange={(e) => handleChange("content", e.target.value)}
                placeholder="Enter your instructions or text content here..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[200px]"
              />
            </div>
          </>
        )

      case "video-step":
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={localConfig.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Welcome Video"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Video URL</label>
              <input
                type="url"
                value={localConfig.videoUrl || ""}
                onChange={(e) => handleChange("videoUrl", e.target.value)}
                placeholder="https://youtube.com/... or https://vimeo.com/..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={localConfig.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Video description or instructions..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">CTA Button Text (optional)</label>
              <input
                type="text"
                value={localConfig.ctaText || ""}
                onChange={(e) => handleChange("ctaText", e.target.value)}
                placeholder="Continue"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )

      default:
        return <p className="text-sm text-muted-foreground">No settings available</p>
    }
  }

  return (
    <div className="w-[320px] bg-card border-l border-border overflow-y-auto">
      <div className="p-6 border-b border-border">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Component Settings</h3>
      </div>
      
      <div className="p-6">
        {renderSettings()}
      </div>
    </div>
  )
}
