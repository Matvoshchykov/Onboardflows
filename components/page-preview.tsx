"use client"

import { useState, useEffect, useRef } from "react"
import { Trash2, Edit3, Plus, X, Image as ImageIcon, Video, Upload, File, Check, Download, AlignLeft, AlignCenter, AlignRight, ChevronLeft, VideoOff, GripVertical } from 'lucide-react'
import type { PageComponent } from "./page-editor"
import { useTheme } from "./theme-provider"
import { uploadFileToStorage, compressImageUnder1MB, extractVideoThumbnail, deleteFileFromStorage, convertImageTo16x9, compressVideo } from "@/lib/utils"

// No animation needed - browser's default caret blinking only affects the caret itself
const blinkAnimation = ``

type PagePreviewProps = {
  components: PageComponent[]
  viewMode: "desktop" | "mobile"
  selectedComponent: PageComponent | null
  onSelectComponent: (component: PageComponent) => void
  onDeleteComponent: (id: string) => void
  onUpdateComponent?: (id: string, config: Record<string, any>) => void
  previewMode?: boolean
  isMobile?: boolean
  onVideoWatched?: (componentId: string, watched: boolean) => void
  onVideoTimeUpdate?: (componentId: string, time: number) => void
  onComponentDragStart?: (componentId: string, e: React.DragEvent) => void
  onComponentDragOver?: (index: number, e: React.DragEvent) => void
  onComponentDrop?: (index: number, e: React.DragEvent) => void
  onComponentDragEnd?: () => void
  draggedComponentId?: string | null
  dragOverIndex?: number | null
}

export function PagePreview({ 
  components, 
  viewMode, 
  selectedComponent, 
  onSelectComponent, 
  onDeleteComponent,
  onUpdateComponent,
  previewMode = false,
  isMobile = false,
  onVideoWatched,
  onVideoTimeUpdate,
  onComponentDragStart,
  onComponentDragOver,
  onComponentDrop,
  onComponentDragEnd,
  draggedComponentId,
  dragOverIndex
}: PagePreviewProps) {
  return (
    <div className="w-full">
      <div
        className={`w-full transition-all relative ${
          viewMode === "desktop" ? "w-full" : "w-full max-w-md mx-auto"
        }`}
      >
        <div className={`flex flex-col items-center ${previewMode || isMobile ? '' : ''}`} style={previewMode || isMobile ? {} : { gap: '10px' }}>
          {components.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Drag components here to build your page
            </div>
          ) : previewMode || isMobile ? (
            // In preview/real flow: combine all components into one big card
            <div
              className="relative group rounded-xl p-4 sm:p-6 bg-card shadow-neumorphic-raised w-full flex flex-col overflow-visible"
              style={{ maxWidth: '840px', gap: '10px' }}
            >
              {components.map((component, index) => (
                <div
                  key={component.id}
                  data-preview-component={index === 0 ? 'first' : undefined}
                  className="w-full"
                >
                  <ComponentRenderer 
                    component={component} 
                    onUpdateComponent={undefined}
                    isMobile={isMobile}
                    isPreviewMode={previewMode}
                    onVideoWatched={onVideoWatched}
                    onVideoTimeUpdate={onVideoTimeUpdate}
                  />
                </div>
              ))}
            </div>
          ) : (
            // Editor mode: separate cards for each component
            components.map((component, index) => (
              <div
                key={component.id}
                data-preview-component={index === 0 ? 'first' : undefined}
                draggable={!previewMode && !isMobile && onComponentDragStart !== undefined}
                onDragStart={(e) => {
                  if (!previewMode && !isMobile && onComponentDragStart) {
                    onComponentDragStart(component.id, e)
                  }
                }}
                onDragOver={(e) => {
                  if (!previewMode && !isMobile && onComponentDragOver) {
                    onComponentDragOver(index, e)
                  }
                }}
                onDrop={(e) => {
                  if (!previewMode && !isMobile && onComponentDrop) {
                    onComponentDrop(index, e)
                  }
                }}
                onDragEnd={() => {
                  if (!previewMode && !isMobile && onComponentDragEnd) {
                    onComponentDragEnd()
                  }
                }}
                onClick={(previewMode || isMobile) ? undefined : () => onSelectComponent(component)}
                className={`relative group rounded-xl p-4 sm:p-6 transition-all ${
                  (previewMode || isMobile) ? '' : 'cursor-pointer'
                } ${
                  selectedComponent?.id === component.id
                    ? "bg-card shadow-neumorphic-pressed ring-2 ring-primary/20"
                    : "bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed"
                } ${
                  draggedComponentId === component.id ? 'opacity-50' : ''
                } ${
                  dragOverIndex === index ? 'ring-2 ring-primary/50' : ''
                } w-full flex flex-col justify-center overflow-visible`}
                style={{ maxWidth: '840px' }}
              >
                {/* Drag handle - visible on hover */}
                {!previewMode && !isMobile && onComponentDragStart && (
                  <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <ComponentRenderer 
                  component={component} 
                  onUpdateComponent={previewMode ? undefined : (onUpdateComponent ? (config) => onUpdateComponent(component.id, config) : undefined)}
                  isMobile={isMobile}
                  isPreviewMode={previewMode}
                  onVideoWatched={onVideoWatched}
                  onVideoTimeUpdate={onVideoTimeUpdate}
                />
                
                {/* Only show edit/delete buttons if not in preview mode */}
                {!previewMode && !onUpdateComponent && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-50 pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        onSelectComponent(component)
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                      }}
                      className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all pointer-events-auto"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        onDeleteComponent(component.id)
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                      }}
                      className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-destructive pointer-events-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!previewMode && onUpdateComponent && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        onDeleteComponent(component.id)
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                      }}
                      className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-destructive pointer-events-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Editable text component for inline editing
function EditableText({ 
  value, 
  onChange, 
  className = "",
  placeholder = "",
  multiline = false,
  maxLength
}: { 
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
}) {
  const { theme } = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  
  // Caret color opposite of theme: dark theme = light caret, light theme = dark caret
  const caretColor = theme === 'dark' ? '#ffffff' : '#000000'

  // Sync editValue when value prop changes (but not while editing)
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
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          value={editValue}
          onChange={(e) => {
            if (!maxLength || e.target.value.length <= maxLength) {
              setEditValue(e.target.value)
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`${className} focus:outline-none bg-transparent resize-none border-none p-0 m-0`}
          autoFocus
          placeholder={placeholder}
          maxLength={maxLength}
          style={{ 
            caretColor: caretColor,
            width: '100%',
            minHeight: 'auto'
          }}
        />
      )
    }
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => {
          if (!maxLength || e.target.value.length <= maxLength) {
            setEditValue(e.target.value)
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${className} focus:outline-none bg-transparent border-none p-0 m-0`}
        autoFocus
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ 
          caretColor: caretColor,
          width: '100%'
        }}
      />
    )
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
        setEditValue(value || '')
      }}
      className={`cursor-text hover:underline hover:decoration-orange-500 transition-colors inline-block ${className}`}
      style={{ minWidth: multiline ? 'auto' : '1ch', position: 'relative' }}
    >
      {value || placeholder}
    </span>
  )
}

export function ComponentRenderer({ 
  component, 
  onUpdateComponent,
  isMobile = false,
  isPreviewMode = false,
  onVideoWatched,
  onVideoTimeUpdate
}: { 
  component: PageComponent
  onUpdateComponent?: (config: Record<string, any>) => void
  isMobile?: boolean
  isPreviewMode?: boolean
  onVideoWatched?: (componentId: string, watched: boolean) => void
  onVideoTimeUpdate?: (componentId: string, time: number) => void
}) {
  const { theme } = useTheme()
  const config = component.config

  const updateConfig = (updates: Record<string, any>) => {
    if (onUpdateComponent) {
      // Remove empty text fields (title, label, text, description) from config
      const cleanedUpdates: Record<string, any> = { ...updates }
      const textFields = ['title', 'label', 'text', 'description']
      textFields.forEach(field => {
        if (cleanedUpdates[field] !== undefined) {
          const value = cleanedUpdates[field]
          if (!value || (typeof value === 'string' && value.trim().length === 0)) {
            // Set to null to delete the field
            cleanedUpdates[field] = null
          }
        }
      })
      
      // Merge with existing config, removing null fields
      const newConfig = { ...config, ...cleanedUpdates }
      Object.keys(newConfig).forEach(key => {
        if (newConfig[key] === null) {
          delete newConfig[key]
        }
      })
      
      onUpdateComponent(newConfig)
    }
  }

  switch (component.type) {
    case "text-input":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <label className="block text-sm font-medium mb-2">
            {config.label || "What is your main challenge right now?"}
          </label>
          <textarea
            placeholder={config.placeholder || "Type your answer here..."}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            readOnly
          />
        </div>
      )

    case "preference-poll":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <h3 className="text-sm font-medium mb-4">{config.title || "Rank your top priorities"}</h3>
          <div className="space-y-2">
            {(config.options || ["Feature A", "Feature B", "Feature C"]).map((option: string, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <span className="w-6 h-6 bg-background rounded flex items-center justify-center text-xs font-semibold">
                  {idx + 1}
                </span>
                <span>{option}</span>
              </div>
            ))}
          </div>
        </div>
      )

    case "role-selector":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <h3 className="text-sm font-medium mb-4">{config.title || "Select your role"}</h3>
          <div className="space-y-2">
            {(config.roles || ["Creator", "Manager", "Developer"]).map((role: string, idx: number) => (
              <label key={idx} className="flex items-center gap-3 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
                <input type="radio" name="role" className="w-4 h-4 accent-primary" />
                <span>{role}</span>
              </label>
            ))}
          </div>
        </div>
      )

    case "commitment-assessment":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <h3 className="text-sm font-medium mb-4">{config.title || "Choose your commitment level"}</h3>
          <div className="grid grid-cols-3 gap-3">
            {(config.tiers || ["Starter", "Professional", "Enterprise"]).map((tier: string, idx: number) => (
              <button key={idx} className="p-4 bg-muted rounded-xl hover:bg-primary/10 hover:border-primary border-2 border-transparent transition-all">
                <div className="font-medium">{tier}</div>
              </button>
            ))}
          </div>
        </div>
      )

    case "feature-rating":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <h3 className="text-sm font-medium mb-4">{config.title || "Rate your interest in these features"}</h3>
          <div className="space-y-4">
            {(config.features || ["Analytics", "Automation", "Integrations"]).map((feature: string, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span>{feature}</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div key={star} className="w-6 h-6 text-muted-foreground hover:text-primary cursor-pointer">★</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case "kpi-input":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <label className="block text-sm font-medium mb-2">
            {config.label || "What is your target goal?"}
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder={config.placeholder || "Enter number"}
              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              readOnly
            />
            <span className="flex items-center text-muted-foreground">{config.unit || "units"}</span>
          </div>
        </div>
      )

    case "communication-style":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <h3 className="text-sm font-medium mb-4">{config.title || "How do you prefer to learn?"}</h3>
          <div className="grid grid-cols-2 gap-3">
            {(config.styles || ["Video Tutorials", "Live Webinars", "Documentation", "Email"]).map((style: string, idx: number) => (
              <button key={idx} className="p-3 bg-muted rounded-lg hover:bg-primary/10 hover:border-primary border-2 border-transparent transition-all text-sm">
                {style}
              </button>
            ))}
          </div>
        </div>
      )

    case "privacy-consent":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <div className="bg-muted rounded-xl p-4 mb-4">
            <p className="text-sm text-muted-foreground">
              {config.text || "We collect and process your data to provide our services. By checking this box, you agree to our Privacy Policy."}
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="w-4 h-4 rounded border-2 border-[#22c55e] bg-[#22c55e] flex items-center justify-center flex-shrink-0 mt-1">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm">
              I agree to the <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </span>
          </label>
        </div>
      )

    case "video-embed":
      return (
        <div className={isPreviewMode ? "p-0" : "p-6"}>
          <h3 className="text-sm font-medium mb-4">{config.title || "Watch this instructional video"}</h3>
          <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
            <Video className="w-12 h-12 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {config.description || "This video is required to continue"}
          </p>
        </div>
      )

    case "file-upload": {
      const fileInputRef = useRef<HTMLInputElement>(null)
      const [filePreview, setFilePreview] = useState<string | null>(config.fileUrl || null)
      const [uploading, setUploading] = useState(false)
      const [uploadedFileName, setUploadedFileName] = useState<string | null>(config.fileName || null)
      
      // In preview mode (real onboarding), show files as downloadable list
      const isPreviewMode = !onUpdateComponent
      
      const handleFileDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        if (!onUpdateComponent) return
        
        const file = e.dataTransfer.files[0]
        if (!file) return
        
        await handleFileUpload(file)
      }
      
      const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !onUpdateComponent) return
        
        await handleFileUpload(file)
      }
      
      // Helper to filter out data URLs - only allow HTTP/HTTPS URLs (storage URLs)
      const isValidStorageUrl = (url: string | null | undefined): boolean => {
        if (!url) return false
        // Only allow HTTP/HTTPS URLs (storage URLs), reject data URLs
        return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
      }
      
      const handleFileUpload = async (file: File) => {
        setUploading(true)
        try {
          // Check if it's an image - compress and upload
          if (file.type.startsWith('image/')) {
            // Compress image to under 1MB for bucket storage
            const compressedFile = await compressImageUnder1MB(file)
            
            // Upload compressed version to bucket (ONLY store storage URL, never data URL)
            const fileStorageUrl = await uploadFileToStorage(compressedFile, 'uploads', 'files', false)
            
            if (fileStorageUrl) {
              setFilePreview(fileStorageUrl) // Show storage URL in preview
              setUploadedFileName(file.name)
              if (onUpdateComponent) {
                updateConfig({ 
                  fileUrl: fileStorageUrl, // Storage URL only - minimizes database payload size
                  fileName: file.name, 
                  fileType: file.type 
                  // Note: Removed fileOriginal to minimize payload size - use fileUrl instead
                })
              }
            }
          } else if (file.type.startsWith('video/')) {
            // Extract thumbnail from video
            const thumbnail = await extractVideoThumbnail(file)
            if (!thumbnail) {
              console.error('Failed to extract video thumbnail')
              setUploading(false)
              return
            }

            // Compress thumbnail to under 1MB
            const compressedThumbnail = await compressImageUnder1MB(thumbnail)
            
            // Upload compressed thumbnail to bucket
            const thumbnailUrl = await uploadFileToStorage(compressedThumbnail, 'uploads', 'files', false)
            
            // Upload original video to storage (ALWAYS use storage, never data URL)
            const videoStorageUrl = await uploadFileToStorage(file, 'uploads', 'files', false)
            
            if (thumbnailUrl && videoStorageUrl) {
              setFilePreview(videoStorageUrl) // Show video storage URL in preview
              setUploadedFileName(file.name)
              if (onUpdateComponent) {
                updateConfig({ 
                  fileUrl: videoStorageUrl, // Storage URL only - minimizes database payload size
                  fileName: file.name,
                  fileType: file.type
                  // Note: Removed fileOriginal to minimize payload size - use fileUrl instead
                })
              }
            }
          } else {
            // For other file types, just upload as-is
            const fileUrl = await uploadFileToStorage(file, 'uploads', 'files')
            
            if (fileUrl) {
              setFilePreview(fileUrl)
              setUploadedFileName(file.name)
              if (onUpdateComponent) {
                updateConfig({ fileUrl, fileName: file.name, fileType: file.type })
              }
            }
          }
        } catch (error) {
          console.error('Error uploading file:', error)
        } finally {
          setUploading(false)
        }
      }
      
      // Load file preview from config on mount - only use storage URLs, filter out data URLs
      useEffect(() => {
        if (!filePreview) {
          // Prefer fileUrl, fallback to fileOriginal (but only if it's a storage URL)
          const url = config.fileUrl || null
          const original = config.fileOriginal || null
          const fileName = config.fileName || null
          
          // Only use valid storage URLs, filter out data URLs
          if (isValidStorageUrl(url)) {
            setFilePreview(url)
            setUploadedFileName(fileName)
          } else if (isValidStorageUrl(original)) {
            setFilePreview(original)
            setUploadedFileName(fileName)
          }
        }
      }, [config.fileUrl, config.fileOriginal, config.fileName, filePreview])
      
      const isImage = uploadedFileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(uploadedFileName)
      const isVideo = uploadedFileName && /\.(mp4|webm|ogg|mov)$/i.test(uploadedFileName)
      
      return (
        <div>
          {onUpdateComponent ? (
            <EditableText
              value={config.label || ""}
              onChange={(value) => updateConfig({ label: value })}
              className="text-xs font-medium mb-1.5 block"
              placeholder="Upload your documents"
            />
          ) : (
            // Only render label if it exists and is not empty
            config.label && typeof config.label === 'string' && config.label.trim().length > 0 && (
              <label className="block text-xs font-medium mb-1.5">
                {config.label}
              </label>
            )
          )}
          <div
            className={`rounded-xl p-6 text-center transition-colors ${
              onUpdateComponent ? 'cursor-pointer' : ''
            } ${uploading ? 'opacity-50' : ''} bg-card shadow-neumorphic-subtle`}
            onDrop={onUpdateComponent ? handleFileDrop : undefined}
            onDragOver={onUpdateComponent ? (e) => e.preventDefault() : undefined}
            onClick={onUpdateComponent ? () => fileInputRef.current?.click() : undefined}
          >
            {(filePreview || config.fileUrl) && isValidStorageUrl(filePreview || config.fileUrl) ? (
              <div className="space-y-2 w-full">
                {isPreviewMode ? (
                  // Real onboarding: sleek download bar darker than surrounding
                  <div className="w-full">
                    <div 
                      className={`flex items-center justify-between p-4 rounded-xl transition-all hover:shadow-lg ${
                        theme === 'dark' 
                          ? 'bg-[hsl(220,9%,6%)]' 
                          : 'bg-[hsl(220,13%,88%)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className={`w-5 h-5 flex-shrink-0 ${
                          theme === 'dark' 
                            ? 'text-[hsl(220,14%,96%)]' 
                            : 'text-[hsl(220,9%,10%)]'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            theme === 'dark' 
                              ? 'text-[hsl(220,14%,96%)]' 
                              : 'text-[hsl(220,9%,10%)]'
                          }`}>
                            {uploadedFileName || "Download file"}
                          </p>
                          {config.fileType && (
                            <p className={`text-xs ${
                              theme === 'dark' 
                                ? 'text-[hsl(220,14%,83%)]' 
                                : 'text-[hsl(220,9%,25%)]'
                            }`}>
                              {config.fileType}
                      </p>
                    )}
                  </div>
                    </div>
                      <a
                        href={config.fileUrl || filePreview || '#'}
                        download={uploadedFileName || 'file'}
                        className={`flex items-center justify-center w-8 h-8 transition-colors ${
                          theme === 'dark' 
                            ? 'text-[hsl(220,14%,96%)] hover:text-[hsl(220,14%,83%)]' 
                            : 'text-[hsl(220,9%,10%)] hover:text-[hsl(220,9%,25%)]'
                        }`}
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                ) : (
                  // Component editor: sleek download bar darker than surrounding
                  <div className="w-full">
                    <div 
                      className={`flex items-center justify-between p-4 rounded-xl transition-all hover:shadow-lg ${
                        theme === 'dark' 
                          ? 'bg-[hsl(220,9%,6%)]' 
                          : 'bg-[hsl(220,13%,88%)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className={`w-5 h-5 flex-shrink-0 ${
                          theme === 'dark' 
                            ? 'text-[hsl(220,14%,96%)]' 
                            : 'text-[hsl(220,9%,10%)]'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            theme === 'dark' 
                              ? 'text-[hsl(220,14%,96%)]' 
                              : 'text-[hsl(220,9%,10%)]'
                          }`}>
                            {uploadedFileName || "Download file"}
                          </p>
                          {config.fileType && (
                            <p className={`text-xs ${
                              theme === 'dark' 
                                ? 'text-[hsl(220,14%,83%)]' 
                                : 'text-[hsl(220,9%,25%)]'
                            }`}>
                              {config.fileType}
                      </p>
                    )}
                  </div>
                  </div>
                      <a
                        href={config.fileUrl || filePreview || '#'}
                        download={uploadedFileName || 'file'}
                        className={`flex items-center justify-center w-8 h-8 transition-colors ${
                          theme === 'dark' 
                            ? 'text-[hsl(220,14%,96%)] hover:text-[hsl(220,14%,83%)]' 
                            : 'text-[hsl(220,9%,10%)] hover:text-[hsl(220,9%,25%)]'
                        }`}
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                    {onUpdateComponent !== undefined && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      // Delete file from storage if it exists
                      if (config.fileUrl && typeof config.fileUrl === 'string' && config.fileUrl.startsWith('http')) {
                        await deleteFileFromStorage(config.fileUrl, 'uploads')
                      }
                      setFilePreview(null)
                      setUploadedFileName(null)
                          updateConfig({ fileUrl: null, fileName: null, fileType: null })
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                        className="text-xs text-destructive hover:underline mt-2"
                  >
                    Remove file
                  </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-white">Uploading...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto mb-1.5 text-white" />
                    <p className="text-xs text-white">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-[10px] text-white/80 mt-1">
                      {onUpdateComponent ? (
                        <EditableText
                          value={config.acceptedTypes || "PDF, DOC, DOCX, Images, Videos (max 10MB)"}
                          onChange={(value) => updateConfig({ acceptedTypes: value })}
                          className="text-[10px] text-white/80"
                          placeholder="PDF, DOC, DOCX, Images, Videos (max 10MB)"
                        />
                      ) : (
                        config.acceptedTypes || "PDF, DOC, DOCX, Images, Videos (max 10MB)"
                      )}
                    </p>
                  </>
                )}
                {onUpdateComponent && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={config.acceptedTypes || "*/*"}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )
    }

    case "video-step": {
      const videoInputRef = useRef<HTMLInputElement>(null)
      const [videoPreview, setVideoPreview] = useState<string | null>(null)
      const [uploadingVideo, setUploadingVideo] = useState(false)
      const [useIframe, setUseIframe] = useState(false)
      
      // Helper to filter out data URLs - only allow HTTP/HTTPS URLs (storage URLs)
      const isValidStorageUrl = (url: string | null | undefined): boolean => {
        if (!url) return false
        // Only allow HTTP/HTTPS URLs (storage URLs), reject data URLs
        return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
      }
      
      // Helper to check if URL is a video file (not a thumbnail image)
      const isVideoUrl = (url: string | null | undefined): boolean => {
        if (!url || !isValidStorageUrl(url)) return false
        // Check if URL ends with video extension or contains /videos/ folder (not /images/)
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v']
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        const lowerUrl = url.toLowerCase()
        
        // Reject if it's clearly an image
        if (imageExtensions.some(ext => lowerUrl.endsWith(ext))) return false
        if (lowerUrl.includes('/images/')) return false
        
        // Accept if it has video extension or is in /videos/ folder
        return videoExtensions.some(ext => lowerUrl.endsWith(ext)) || lowerUrl.includes('/videos/')
      }
      
      // Get video source - always use storage URL, never data URL
      const getVideoSource = (): string | null => {
        if (onUpdateComponent) {
          // Component editor: show thumbnail (videoUrl - can be image)
          const url = config.videoUrl || null
          return isValidStorageUrl(url) ? url : null
        } else {
          // Preview/onboarding: show video (MUST be video URL, not thumbnail image)
          const original = config.videoOriginal || null
          const url = config.videoUrl || null
          
          // In preview mode, ONLY use video URLs (not image thumbnails)
          // Prefer videoOriginal, but only if it's actually a video file
          if (isValidStorageUrl(original) && isVideoUrl(original)) return original
          // Fallback to videoUrl only if it's actually a video (not a thumbnail)
          if (isValidStorageUrl(url) && isVideoUrl(url)) return url
          // If videoOriginal exists but is an image (old data), don't use videoUrl thumbnail
          return null
        }
      }
      
      // Use videoPreview state if available, otherwise fallback to getVideoSource()
      // This ensures state is properly synced, especially on mobile
      const videoSource = videoPreview || getVideoSource()
      
      // Debug logging for video source resolution
      if (!onUpdateComponent && videoSource) {
        console.log('[Video Debug] Video source resolved', {
          videoSource,
          videoPreview,
          getVideoSourceResult: getVideoSource(),
          isMobile,
          componentId: component.id,
          isValidUrl: isValidStorageUrl(videoSource),
          isVideo: isVideoUrl(videoSource)
        })
      } else if (!onUpdateComponent && !videoSource) {
        console.error('[Video Debug] No video source available', {
          videoPreview,
          getVideoSourceResult: getVideoSource(),
          configVideoUrl: config.videoUrl,
          configVideoOriginal: config.videoOriginal,
          isMobile,
          componentId: component.id
        })
      }
      
      const handleVideoDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        if (!onUpdateComponent) return
        
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('video/')) {
          await handleVideoUpload(file)
        }
      }
      
      const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type.startsWith('video/') && onUpdateComponent) {
          await handleVideoUpload(file)
        }
      }
      
      const handleVideoUpload = async (file: File) => {
        setUploadingVideo(true)
        try {
          // Compress video to reduce storage size
          const compressedVideo = await compressVideo(file, 10) // Max 10MB
          
          // Extract thumbnail from video (16:9)
          const thumbnail = await extractVideoThumbnail(compressedVideo)
          if (!thumbnail) {
            console.error('Failed to extract video thumbnail')
            setUploadingVideo(false)
            return
          }

          // Compress thumbnail to under 1MB
          const compressedThumbnail = await compressImageUnder1MB(thumbnail)
          
          // Upload compressed thumbnail to bucket
          const thumbnailUrl = await uploadFileToStorage(compressedThumbnail, 'uploads', 'images', false)
          
          // Upload compressed video to storage (ALWAYS use storage, never data URL)
          const videoStorageUrl = await uploadFileToStorage(compressedVideo, 'uploads', 'videos', false)
          
          if (thumbnailUrl && videoStorageUrl) {
            // In component editor, show thumbnail; in preview/onboarding, show video
            if (onUpdateComponent) {
              setVideoPreview(thumbnailUrl) // Show thumbnail in editor
            } else {
              setVideoPreview(videoStorageUrl) // Show video in preview
            }
            
            if (onUpdateComponent) {
              // ONLY store storage URLs, never data URLs - minimizes database payload size
              updateConfig({ 
                videoUrl: thumbnailUrl, // Compressed thumbnail in bucket (for editor)
                videoOriginal: videoStorageUrl, // Compressed video URL in storage (for onboarding)
                videoFile: file.name,
                videoType: file.type
                // Note: Removed any data URL fields to minimize payload size
              })
            }
          }
        } catch (error) {
          console.error('Error uploading video:', error)
        } finally {
          setUploadingVideo(false)
        }
      }
      
      // Load video preview from config on mount - only use storage URLs, filter out data URLs
      useEffect(() => {
        console.log('[Video Debug] useEffect triggered', {
          onUpdateComponent,
          isMobile,
          videoUrl: config.videoUrl,
          videoOriginal: config.videoOriginal,
          componentId: component.id
        })
        
        if (onUpdateComponent) {
          // Component editor: show thumbnail (can be image)
          const url = config.videoUrl || null
          if (isValidStorageUrl(url)) {
            console.log('[Video Debug] Editor mode: Setting thumbnail URL', url)
            setVideoPreview(url)
          } else {
            console.warn('[Video Debug] Editor mode: Invalid thumbnail URL', url)
            setVideoPreview(null)
          }
        } else {
          // Preview/onboarding: show video (MUST be video URL, not thumbnail image)
          const original = config.videoOriginal || null
          const url = config.videoUrl || null
          
          console.log('[Video Debug] Preview/Onboarding mode: Checking video sources', {
            original,
            originalIsValid: isValidStorageUrl(original),
            originalIsVideo: original ? isVideoUrl(original) : false,
            url,
            urlIsValid: isValidStorageUrl(url),
            urlIsVideo: url ? isVideoUrl(url) : false
          })
          
          // Only use valid video URLs, never image thumbnails
          if (isValidStorageUrl(original) && isVideoUrl(original)) {
            console.log('[Video Debug] Using videoOriginal:', original)
            setVideoPreview(original)
          } else if (isValidStorageUrl(url) && isVideoUrl(url)) {
            console.log('[Video Debug] Using videoUrl:', url)
            setVideoPreview(url)
          } else {
            console.error('[Video Debug] No valid video source found', {
              original,
              url,
              originalValid: isValidStorageUrl(original),
              originalVideo: original ? isVideoUrl(original) : false,
              urlValid: isValidStorageUrl(url),
              urlVideo: url ? isVideoUrl(url) : false
            })
            setVideoPreview(null)
          }
        }
      }, [config.videoUrl, config.videoOriginal, onUpdateComponent, isMobile])
      
      // Video URL for preview/onboarding
      const videoUrl = !onUpdateComponent ? (videoSource || videoPreview || '') : null
      
      // Comprehensive debugging for video URL
      useEffect(() => {
        if (!onUpdateComponent && videoUrl) {
          console.log('[Video Debug] Video URL resolved:', {
            videoUrl,
            isMobile,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            componentId: component.id
          })
          
          // Test if URL is accessible
          fetch(videoUrl, { method: 'HEAD', mode: 'no-cors' })
            .then(() => console.log('[Video Debug] Video URL is accessible'))
            .catch((err) => console.error('[Video Debug] Video URL fetch test failed:', err))
        } else if (!onUpdateComponent && !videoUrl) {
          console.error('[Video Debug] NO VIDEO URL AVAILABLE', {
            videoSource,
            videoPreview,
            configVideoUrl: config.videoUrl,
            configVideoOriginal: config.videoOriginal,
            componentId: component.id,
            isMobile
          })
        }
      }, [videoUrl, isMobile, onUpdateComponent, videoSource, videoPreview, component.id, config.videoUrl, config.videoOriginal])
      
      return (
        <div>
          {onUpdateComponent ? (
            <EditableText
              value={config.title || ""}
              onChange={(value) => updateConfig({ title: value })}
              className="text-xs font-medium mb-3"
              placeholder="Watch this instructional video"
            />
          ) : (
            // Only render title if it exists and is not empty
            config.title && typeof config.title === 'string' && config.title.trim().length > 0 && (
              <h3 className="text-xs font-medium mb-3">
                {config.title}
              </h3>
            )
          )}
          <div
            className={`aspect-video bg-muted rounded-xl flex items-center justify-center shadow-neumorphic-inset ${
              onUpdateComponent ? 'cursor-pointer hover:bg-muted/70' : ''
            } transition-colors relative ${uploadingVideo ? 'opacity-50' : ''} ${
              onUpdateComponent ? 'overflow-hidden' : ''
            }`}
            onDrop={onUpdateComponent ? handleVideoDrop : undefined}
            onDragOver={onUpdateComponent ? (e) => e.preventDefault() : undefined}
            onClick={onUpdateComponent ? () => videoInputRef.current?.click() : undefined}
          >
            {(videoSource || videoPreview) ? (
              onUpdateComponent ? (
                // Component editor: show thumbnail image
                <img
                  src={videoSource || videoPreview || ''}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    console.error('Thumbnail load error:', videoSource || videoPreview)
                    setVideoPreview(null)
                  }}
                />
              ) : (
                // Preview/onboarding: show video - comprehensive mobile debugging and fallbacks
                <>
                  {useIframe && isMobile ? (
                    <iframe
                      src={videoUrl || ''}
                      className="w-full rounded-xl aspect-video"
                      style={{
                        border: 'none',
                        minHeight: '200px'
                      }}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      onError={() => {
                        console.error('[Video Debug] Iframe failed, trying video element')
                        setUseIframe(false)
                      }}
                    />
                  ) : (
              <video
                      key={`${videoUrl || ''}-${isMobile}`}
                      src={videoUrl || ''}
                      poster={config.videoUrl || undefined}
                controls
                      playsInline
                      webkit-playsinline="true"
                      muted={false}
                      preload="metadata"
                      autoPlay={false}
                className={`w-full rounded-xl ${
                        isPreviewMode
                          ? 'h-full object-cover aspect-video'
                    : 'h-auto max-h-[600px] object-contain'
                }`}
                      style={{ 
                        maxWidth: '100%',
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        objectFit: 'contain',
                        WebkitPlaysinline: 'true',
                        WebkitAppearance: 'none'
                      } as React.CSSProperties}
                      onTouchStart={(e) => {
                        // Force video to load on first touch on mobile
                        const video = e.currentTarget
                        if (video.readyState === 0) {
                          video.load()
                        }
                      }}
                      onClick={(e) => {
                        // On mobile, ensure video plays on click
                        const video = e.currentTarget
                        if (isMobile && video.paused) {
                          video.play().catch((err) => {
                            console.error('[Video Debug] Play failed on click:', err)
                          })
                        }
                      }}
                      onLoadStart={() => {
                        console.log('[Video Debug] Video load started', {
                          src: videoUrl,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget
                        console.log('[Video Debug] Video metadata loaded SUCCESS', {
                          duration: video.duration,
                          videoWidth: video.videoWidth,
                          videoHeight: video.videoHeight,
                          readyState: video.readyState,
                          networkState: video.networkState,
                          src: video.src,
                          currentSrc: video.currentSrc,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                      onLoadedData={(e) => {
                        const video = e.currentTarget
                        console.log('[Video Debug] Video data loaded', {
                          readyState: video.readyState,
                          networkState: video.networkState,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                      onCanPlay={(e) => {
                        const video = e.currentTarget
                        console.log('[Video Debug] Video CAN PLAY', {
                          readyState: video.readyState,
                          networkState: video.networkState,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                      onPlay={(e) => {
                        const video = e.currentTarget
                        console.log('[Video Debug] Video PLAYING', {
                          currentTime: video.currentTime,
                          duration: video.duration,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget
                        const currentTime = video.currentTime
                        const duration = video.duration
                        if (onVideoTimeUpdate && duration > 0) {
                          onVideoTimeUpdate(component.id, currentTime)
                        }
                        if (config.requiredToWatch && duration > 0 && currentTime >= duration - 0.5) {
                          if (onVideoWatched) {
                            onVideoWatched(component.id, true)
                          }
                        }
                      }}
                      onEnded={() => {
                        if (onVideoWatched) {
                          onVideoWatched(component.id, true)
                        }
                      }}
                      onError={(e) => {
                        const video = e.currentTarget
                        const errorDetails = {
                          errorCode: video.error?.code,
                          errorMessage: video.error?.message,
                          networkState: video.networkState,
                          readyState: video.readyState,
                          src: video.src,
                          currentSrc: video.currentSrc,
                          videoUrl,
                          isMobile,
                          componentId: component.id,
                          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                          videoSupports: {
                            canPlayTypeMP4: video.canPlayType('video/mp4'),
                            canPlayTypeWebM: video.canPlayType('video/webm'),
                            canPlayTypeOGG: video.canPlayType('video/ogg')
                          }
                        }
                        
                        console.error('[Video Debug] VIDEO ELEMENT FAILED', errorDetails)
                        
                        if (video.error) {
                          switch (video.error.code) {
                            case 1:
                              console.error('[Video Debug] Error: Media aborted')
                              break
                            case 2:
                              console.error('[Video Debug] Error: Network error - check CORS/URL accessibility')
                              console.error('[Video Debug] iOS Fix: Ensure Supabase Storage bucket has CORS headers:')
                              console.error('[Video Debug] - Access-Control-Allow-Origin: *')
                              console.error('[Video Debug] - Access-Control-Allow-Methods: GET, HEAD, OPTIONS')
                              console.error('[Video Debug] - Accept-Ranges: bytes (for range requests)')
                              break
                            case 3:
                              console.error('[Video Debug] Error: Decode failed - codec not supported')
                              console.error('[Video Debug] iOS Fix: Video must be H.264 + AAC codec in .mp4 container')
                              console.error('[Video Debug] - Current file may be H.265, VP9, AV1, or WebM')
                              console.error('[Video Debug] - Re-encode to H.264 + AAC for iOS compatibility')
                              break
                            case 4:
                              console.error('[Video Debug] Error: Source not supported - format/codec issue')
                              console.error('[Video Debug] iOS Fix: Check MIME type is video/mp4 (not application/octet-stream)')
                              console.error('[Video Debug] - Verify Supabase Storage returns Content-Type: video/mp4')
                              break
                          }
                        }
                        
                        // On mobile, try iframe as fallback
                        if (isMobile && !useIframe) {
                          console.log('[Video Debug] Trying iframe fallback on mobile')
                          setUseIframe(true)
                        }
                      }}
                      onWaiting={(e) => {
                        console.warn('[Video Debug] Video buffering', {
                          currentTime: e.currentTarget.currentTime,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                      onStalled={(e) => {
                        console.error('[Video Debug] Video stalled (network issue)', {
                          networkState: e.currentTarget.networkState,
                          readyState: e.currentTarget.readyState,
                          isMobile,
                          componentId: component.id
                        })
                      }}
                    />
                  )}
                </>
              )
            ) : (
              <>
                {uploadingVideo ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] text-muted-foreground">Uploading video...</p>
                  </div>
                ) : onUpdateComponent ? (
                  <>
                    <div className="text-center">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[10px] text-muted-foreground">Drop video or click to upload</p>
                    </div>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileSelect}
                      className="hidden"
                    />
                  </>
                ) : (
                  <div className="text-center">
                    <VideoOff className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground">The creator hasn't set up a video on this card.</p>
                  </div>
                )}
              </>
            )}
          </div>
          {onUpdateComponent ? (
            <EditableText
              value={config.description || ""}
              onChange={(value) => updateConfig({ description: value })}
              className="text-[10px] text-muted-foreground mt-2"
              placeholder="This video is required to continue"
            />
          ) : (
            // Only render description if it exists and is not empty
            config.description && typeof config.description === 'string' && config.description.trim().length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                {config.description}
              </p>
            )
          )}
        </div>
      )
    }

    case "text-instruction": {
      const [showAlignmentMenu, setShowAlignmentMenu] = useState(false)
      const alignment = config.textAlign || "left"
      const alignmentClasses = {
        left: "text-left",
        center: "text-center",
        right: "text-right"
      }
      
      // Don't render at all in preview/real flow if text is empty
      if (!onUpdateComponent && (!config.text || config.text.trim().length === 0)) {
        return null
      }
      
      return (
        <div className="relative group w-full">
          {onUpdateComponent ? (
            <EditableText
              value={config.text || ""}
              onChange={(value) => updateConfig({ text: value })}
              className={`text-xs text-muted-foreground leading-relaxed block ${alignmentClasses[alignment as keyof typeof alignmentClasses]}`}
              placeholder="This is a text instruction block. Use it for guidance, onboarding steps, expectations, disclaimers, etc."
              multiline
              maxLength={100}
            />
          ) : (
            // Only render text if it exists and is not empty
            config.text && typeof config.text === 'string' && config.text.trim().length > 0 && (
              <p className={`text-xs text-muted-foreground leading-relaxed ${alignmentClasses[alignment as keyof typeof alignmentClasses]}`}>
                {config.text}
              </p>
            )
          )}
          {onUpdateComponent && (
            <div className="absolute right-0 top-0 flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAlignmentMenu(!showAlignmentMenu)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
              >
                <ChevronLeft className={`w-3 h-3 transition-transform ${showAlignmentMenu ? 'rotate-90' : '-rotate-90'}`} />
              </button>
              {showAlignmentMenu && (
                <div className="absolute right-6 top-0 bg-card border border-border rounded-lg shadow-lg p-1 flex flex-col gap-1 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateConfig({ textAlign: "left" })
                      setShowAlignmentMenu(false)
                    }}
                    className={`p-2 hover:bg-muted rounded flex items-center gap-2 ${alignment === "left" ? "bg-muted" : ""}`}
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateConfig({ textAlign: "center" })
                      setShowAlignmentMenu(false)
                    }}
                    className={`p-2 hover:bg-muted rounded flex items-center gap-2 ${alignment === "center" ? "bg-muted" : ""}`}
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateConfig({ textAlign: "right" })
                      setShowAlignmentMenu(false)
                    }}
                    className={`p-2 hover:bg-muted rounded flex items-center gap-2 ${alignment === "right" ? "bg-muted" : ""}`}
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

      case "multiple-choice":
      const options = config.options || ["Option A", "Option B", "Option C"]
      const canAddOption = options.length < 6
      const canRemoveOption = options.length > 1
      
      return (
        <div>
          {onUpdateComponent ? (
            <EditableText
              value={config.title || ""}
              onChange={(value) => updateConfig({ title: value })}
              className={`text-xs font-medium ${isPreviewMode ? 'mb-2' : 'mb-3'}`}
              placeholder="Select your answer"
            />
          ) : (
            // Only render title if it exists and is not empty
            config.title && typeof config.title === 'string' && config.title.trim().length > 0 && (
              <h3 className={`text-xs font-medium ${isPreviewMode ? 'mb-2' : 'mb-3'}`}>
                {config.title}
              </h3>
            )
          )}
          <div className="space-y-1.5">
            {options.map((option: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all">
                <div className="w-4 h-4 rounded border-2 border-[#22c55e] bg-[#22c55e] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs flex-1">
                  {onUpdateComponent ? (
                    <EditableText
                      value={option}
                      onChange={(value) => {
                        const newOptions = [...options]
                        newOptions[idx] = value
                        updateConfig({ options: newOptions })
                      }}
                      className="text-xs"
                      placeholder={`Option ${idx + 1}`}
                    />
                  ) : (
                    option
                  )}
                </span>
                {onUpdateComponent && canRemoveOption && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const newOptions = options.filter((_: string, i: number) => i !== idx)
                      updateConfig({ options: newOptions })
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                    title="Remove option"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
                {onUpdateComponent && canAddOption && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const newOptions = [...options, `Option ${String.fromCharCode(65 + options.length)}`]
                  updateConfig({ options: newOptions })
                }}
                className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-xs text-muted-foreground"
              >
                <Plus className="w-3 h-3" />
                Add Option
              </button>
            )}
          </div>
        </div>
      )

    case "checkbox-multi":
      const checkboxOptions = config.options || ["Interest A", "Interest B", "Interest C"]
      const canAddCheckboxOption = checkboxOptions.length < 6
      const canRemoveCheckboxOption = checkboxOptions.length > 1
      
      return (
        <div>
          {onUpdateComponent ? (
            <EditableText
              value={config.title || ""}
              onChange={(value) => updateConfig({ title: value })}
              className="text-xs font-medium mb-3"
              placeholder="Select all that apply"
            />
          ) : (
            // Only render title if it exists and is not empty
            config.title && typeof config.title === 'string' && config.title.trim().length > 0 && (
              <h3 className="text-xs font-medium mb-3">
                {config.title}
              </h3>
            )
          )}
          <div className="space-y-1.5">
            {checkboxOptions.map((option: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all">
                <div className="w-4 h-4 rounded border-2 border-[#22c55e] bg-[#22c55e] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs flex-1">
                  {onUpdateComponent ? (
                    <EditableText
                      value={option}
                      onChange={(value) => {
                        const newOptions = [...checkboxOptions]
                        newOptions[idx] = value
                        updateConfig({ options: newOptions })
                      }}
                      className="text-xs"
                      placeholder={`Interest ${idx + 1}`}
                    />
                  ) : (
                    option
                  )}
                </span>
                {onUpdateComponent && canRemoveCheckboxOption && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const newOptions = checkboxOptions.filter((_: string, i: number) => i !== idx)
                      updateConfig({ options: newOptions })
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                    title="Remove option"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {onUpdateComponent && canAddCheckboxOption && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const newOptions = [...checkboxOptions, `Interest ${String.fromCharCode(65 + checkboxOptions.length)}`]
                  updateConfig({ options: newOptions })
                }}
                className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-xs text-muted-foreground"
              >
                <Plus className="w-3 h-3" />
                Add Option
              </button>
            )}
          </div>
        </div>
      )

    case "short-answer":
      return (
        <div>
          {onUpdateComponent ? (
            <EditableText
              value={config.label || ""}
              onChange={(value) => updateConfig({ label: value })}
              className={`text-xs font-medium ${isPreviewMode ? 'mb-1.5' : 'mb-2'} block`}
              placeholder="What is your name?"
            />
          ) : (
            // Only render label if it exists and is not empty
            config.label && typeof config.label === 'string' && config.label.trim().length > 0 && (
              <label className={`block text-xs font-medium ${isPreviewMode ? 'mb-1.5' : 'mb-2'}`}>
                {config.label}
              </label>
            )
          )}
          <input
            type="text"
            placeholder={config.placeholder || "Type your answer here..."}
            className="w-full bg-card border-none rounded-xl px-4 py-3 shadow-neumorphic-inset focus:outline-none focus:ring-2 focus:ring-primary"
            readOnly={!onUpdateComponent}
          />
        </div>
      )

    case "header": {
      const [showAlignmentMenu, setShowAlignmentMenu] = useState(false)
      const alignment = config.textAlign || "left"
      const alignmentClasses = {
        left: "text-left",
        center: "text-center",
        right: "text-right"
      }
      
      // Don't render at all in preview/real flow if title is empty or doesn't exist
      if (!onUpdateComponent && (!config.title || config.title.trim().length === 0)) {
        return null
      }
      
      return (
        <div className="relative group w-full">
          {onUpdateComponent ? (
            <EditableText
              value={config.title || ""}
              onChange={(value) => updateConfig({ title: value })}
              className={`text-lg font-bold ${alignmentClasses[alignment as keyof typeof alignmentClasses]}`}
              placeholder="Header Title"
              maxLength={20}
            />
          ) : (
            // Only render title if it exists and is not empty - bold, bigger font, and gray in preview/real flow
            config.title && typeof config.title === 'string' && config.title.trim().length > 0 && (
              <h2 className={`font-bold text-muted-foreground ${alignmentClasses[alignment as keyof typeof alignmentClasses]}`} style={{ fontWeight: '700', fontSize: '46px' }}>
                {config.title}
              </h2>
            )
          )}
          {onUpdateComponent && (
            <div className="absolute right-0 top-0 flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAlignmentMenu(!showAlignmentMenu)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
              >
                <ChevronLeft className={`w-3 h-3 transition-transform ${showAlignmentMenu ? 'rotate-90' : '-rotate-90'}`} />
              </button>
              {showAlignmentMenu && (
                <div className="absolute right-6 top-0 bg-card border border-border rounded-lg shadow-lg p-1 flex flex-col gap-1 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateConfig({ textAlign: "left" })
                      setShowAlignmentMenu(false)
                    }}
                    className={`p-2 hover:bg-muted rounded flex items-center gap-2 ${alignment === "left" ? "bg-muted" : ""}`}
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateConfig({ textAlign: "center" })
                      setShowAlignmentMenu(false)
                    }}
                    className={`p-2 hover:bg-muted rounded flex items-center gap-2 ${alignment === "center" ? "bg-muted" : ""}`}
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateConfig({ textAlign: "right" })
                      setShowAlignmentMenu(false)
                    }}
                    className={`p-2 hover:bg-muted rounded flex items-center gap-2 ${alignment === "right" ? "bg-muted" : ""}`}
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    case "link-button":
      const linkUrl = config.url || "#"
      const isValidUrl = linkUrl && linkUrl !== "#" && (linkUrl.startsWith('http://') || linkUrl.startsWith('https://'))
      
      return (
        <div className="flex flex-col items-center w-full" onClick={(e) => e.stopPropagation()}>
          {onUpdateComponent && (
            <>
              <div className="w-full mb-3 relative">
                <input
                  type="text"
                  value={config.description || ""}
                  onChange={(e) => {
                    const value = e.target.value
                    updateConfig({ description: value })
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  placeholder="Add information about this button..."
                  className="w-full bg-card border-none rounded-xl px-3 py-2 text-xs shadow-neumorphic-inset focus:outline-none pointer-events-auto"
                />
              </div>
            <div className="w-full mb-2">
              <input
                type="url"
                value={config.url || ""}
                onChange={(e) => updateConfig({ url: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                placeholder="https://example.com"
                className="w-full bg-card border-none rounded-xl px-3 py-2 text-xs shadow-neumorphic-inset focus:outline-none pointer-events-auto"
              />
            </div>
            </>
          )}
          {/* Show description above button with spacing */}
          {!onUpdateComponent && config.description && typeof config.description === 'string' && config.description.trim().length > 0 && (
            <p className="text-xs text-muted-foreground mb-3 text-center max-w-md">
              {config.description}
            </p>
          )}
          {isValidUrl ? (
          <a
              href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
              className={`w-full block px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-xs font-medium text-center ${
                onUpdateComponent ? 'pointer-events-none cursor-default' : 'cursor-pointer'
              }`}
              onClick={(e) => {
                // Prevent clicking in editor mode
                if (onUpdateComponent) {
                  e.preventDefault()
                  return
                }
                // Ensure navigation happens on mobile
                if (linkUrl && linkUrl !== "#") {
                  e.preventDefault()
                  window.open(linkUrl, '_blank', 'noopener,noreferrer')
                }
              }}
          >
            {onUpdateComponent ? (
              <EditableText
                value={config.label || ""}
                onChange={(value) => updateConfig({ label: value })}
                className="text-xs font-medium"
                placeholder="Click here"
              />
            ) : (
              (config.label && typeof config.label === 'string' && config.label.trim().length > 0) ? config.label : "Click here"
            )}
          </a>
          ) : (
            <button
              disabled={!isValidUrl}
              className={`w-full block px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed text-center ${
                onUpdateComponent ? 'pointer-events-none cursor-default' : ''
              }`}
            >
              {onUpdateComponent ? (
                <EditableText
                  value={config.label || "Click here"}
                  onChange={(value) => updateConfig({ label: value })}
                  className="text-xs font-medium"
                  placeholder="Click here"
                />
              ) : (
                config.label || "Click here"
              )}
            </button>
          )}
        </div>
      )

    case "image": {
      const imageInputRef = useRef<HTMLInputElement>(null)
      const [imagePreview, setImagePreview] = useState<string | null>(config.imageUrl || null)
      const [uploadingImage, setUploadingImage] = useState(false)
      
      const handleImageDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        if (!onUpdateComponent) return
        
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('image/')) {
          await handleImageUpload(file)
        }
      }
      
      const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && file.type.startsWith('image/') && onUpdateComponent) {
          await handleImageUpload(file)
        }
      }
      
      // Helper to filter out data URLs - only allow HTTP/HTTPS URLs (storage URLs)
      const isValidStorageUrl = (url: string | null | undefined): boolean => {
        if (!url) return false
        // Only allow HTTP/HTTPS URLs (storage URLs), reject data URLs
        return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
      }
      
      const handleImageUpload = async (file: File) => {
        setUploadingImage(true)
        try {
          // Convert to 16:9 aspect ratio
          const convertedFile = await convertImageTo16x9(file)
          
          // Compress image to under 1MB for bucket storage
          const compressedFile = await compressImageUnder1MB(convertedFile)
          
          // Upload compressed version to bucket (ONLY store storage URL, never data URL)
          const imageStorageUrl = await uploadFileToStorage(compressedFile, 'uploads', 'images', false)
          
          if (imageStorageUrl) {
            setImagePreview(imageStorageUrl) // Show storage URL in preview
            if (onUpdateComponent) {
              updateConfig({ 
                imageUrl: imageStorageUrl, // Storage URL only - minimizes database payload size
                imageFile: file.name, 
                imageType: file.type 
                // Note: Removed imageOriginal to minimize payload size - use imageUrl instead
              })
            }
          }
        } catch (error) {
          console.error('Error uploading image:', error)
        } finally {
          setUploadingImage(false)
        }
      }
      
      // Load image preview from config on mount - only use storage URLs, filter out data URLs
      useEffect(() => {
        if (!imagePreview) {
          // Prefer imageUrl, fallback to imageOriginal (but only if it's a storage URL)
          const url = config.imageUrl || null
          const original = config.imageOriginal || null
          
          // Only use valid storage URLs, filter out data URLs
          if (isValidStorageUrl(url)) {
            setImagePreview(url)
          } else if (isValidStorageUrl(original)) {
            setImagePreview(original)
          }
        }
      }, [config.imageUrl, config.imageOriginal, imagePreview])
      
      return (
        <div>
          {onUpdateComponent ? (
            <EditableText
              value={config.title || ""}
              onChange={(value) => updateConfig({ title: value })}
              className="text-xs font-medium mb-3"
              placeholder="Image Title"
            />
          ) : (
            // Only render title if it exists and is not empty
            config.title && typeof config.title === 'string' && config.title.trim().length > 0 && (
              <h3 className="text-xs font-medium mb-3">
                {config.title}
              </h3>
            )
          )}
          <div
            className={`w-full bg-muted rounded-xl flex items-center justify-center shadow-neumorphic-inset ${
              onUpdateComponent ? 'cursor-pointer hover:bg-muted/70' : ''
            } transition-colors relative ${uploadingImage ? 'opacity-50' : ''} ${
              onUpdateComponent || isPreviewMode ? 'aspect-video overflow-hidden' : 'min-h-[300px]'
            }`}
            onDrop={onUpdateComponent ? handleImageDrop : undefined}
            onDragOver={onUpdateComponent ? (e) => e.preventDefault() : undefined}
            onClick={onUpdateComponent ? () => imageInputRef.current?.click() : undefined}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt={config.alt || "Image"}
                className={`w-full rounded-xl ${
                  onUpdateComponent 
                    ? 'h-full object-cover' 
                    : isPreviewMode
                      ? 'h-full object-cover aspect-video'
                    : 'h-auto max-h-[600px] object-contain'
                }`}
                style={{ maxWidth: '100%' }}
                onError={(e) => {
                  console.error('Image load error:', imagePreview)
                  setImagePreview(null)
                }}
              />
            ) : (
              <>
                {uploadingImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] text-muted-foreground">Uploading image...</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[10px] text-muted-foreground">Drop image or click to upload</p>
                    </div>
                    {onUpdateComponent && (
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        className="hidden"
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )
    }

    case "scale-slider": {
      const minValue = config.min ?? 1
      const maxValue = config.max ?? 100
      const defaultValue = config.default ?? Math.round((minValue + maxValue) / 2)
      const [sliderValue, setSliderValue] = useState(defaultValue)
      
      // Update slider value when min/max changes
      useEffect(() => {
        const newDefault = Math.round((minValue + maxValue) / 2)
        if (sliderValue < minValue) {
          setSliderValue(minValue)
        } else if (sliderValue > maxValue) {
          setSliderValue(maxValue)
        } else if (config.default === undefined) {
          setSliderValue(newDefault)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [minValue, maxValue])
      
      return (
        <div onClick={(e) => e.stopPropagation()}>
          {onUpdateComponent ? (
            <EditableText
              value={config.label || ""}
              onChange={(value) => updateConfig({ label: value })}
              className="text-xs font-medium mb-3 block"
              placeholder="Rate your experience level"
            />
          ) : (
            // Only render label if it exists and is not empty
            config.label && typeof config.label === 'string' && config.label.trim().length > 0 && (
              <label className="block text-xs font-medium mb-3">
                {config.label}
              </label>
            )
          )}
          {onUpdateComponent && (
            <div className="mb-3 flex gap-2 items-center">
              <div className="flex-1">
                <label className="block text-[10px] text-muted-foreground mb-1">Min</label>
                <input
                  type="number"
                  value={minValue}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value) || 1
                    updateConfig({ min: newMin })
                    // Update slider value if it's out of new range
                    if (sliderValue < newMin) {
                      setSliderValue(newMin)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full bg-card border-none rounded-lg px-2 py-1 text-xs shadow-neumorphic-inset focus:outline-none pointer-events-auto"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-muted-foreground mb-1">Max</label>
                <input
                  type="number"
                  value={maxValue}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value) || 100
                    updateConfig({ max: newMax })
                    // Update slider value if it's out of new range
                    if (sliderValue > newMax) {
                      setSliderValue(newMax)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full bg-card border-none rounded-lg px-2 py-1 text-xs shadow-neumorphic-inset focus:outline-none pointer-events-auto"
                />
              </div>
            </div>
          )}
          <div className="px-2">
            <input
              type="range"
              min={minValue}
              max={maxValue}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseInt(e.target.value))}
              className="w-full"
            />
            {!onUpdateComponent && (
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{minValue}</span>
                <span>{maxValue}</span>
              </div>
            )}
          </div>
        </div>
      )
    }

        default:
      return <div>Unknown component</div>
  }
}


