"use client"

import { useState, useEffect, useRef } from "react"
import { Trash2, Edit3, Plus, X, Image as ImageIcon, Video, Upload, File, Check } from 'lucide-react'
import type { PageComponent } from "./page-editor"
import { useTheme } from "./theme-provider"
import { uploadFileToStorage, compressImageUnder1MB, extractVideoThumbnail, fileToDataURL, deleteFileFromStorage } from "@/lib/utils"

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
}

export function PagePreview({ 
  components, 
  viewMode, 
  selectedComponent, 
  onSelectComponent, 
  onDeleteComponent,
  onUpdateComponent,
  previewMode = false
}: PagePreviewProps) {
  return (
    <div className="w-full">
      <div
        className={`w-full transition-all relative ${
          viewMode === "desktop" ? "w-full" : "w-full max-w-md mx-auto"
        }`}
      >
        <div className={`space-y-4 sm:space-y-6 flex flex-col items-center ${previewMode ? 'pt-5 pb-5' : ''} ${components.length === 1 || components.length === 2 ? '' : ''}`}>
          {components.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Drag components here to build your page
            </div>
          ) : (
            components.map((component, index) => (
              <div
                key={component.id}
                data-preview-component={index === 0 ? 'first' : undefined}
                onClick={previewMode ? undefined : () => onSelectComponent(component)}
                className={`relative group rounded-xl p-4 sm:p-6 transition-all ${
                  previewMode ? '' : 'cursor-pointer'
                } ${
                  selectedComponent?.id === component.id
                    ? "bg-card shadow-neumorphic-pressed ring-2 ring-primary/20"
                    : "bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed"
                } w-full min-h-[150px] sm:min-h-[200px] flex flex-col justify-center overflow-visible`}
                style={{ maxWidth: '840px' }}
              >
                <ComponentRenderer 
                  component={component} 
                  onUpdateComponent={previewMode ? undefined : (onUpdateComponent ? (config) => onUpdateComponent(component.id, config) : undefined)}
                />
                
                {/* Only show edit/delete buttons if not in preview mode */}
                {!previewMode && !onUpdateComponent && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectComponent(component)
                      }}
                      className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteComponent(component.id)
                      }}
                      className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!previewMode && onUpdateComponent && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteComponent(component.id)
                      }}
                      className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-destructive"
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
  multiline = false 
}: { 
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  multiline?: boolean
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
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`${className} focus:outline-none bg-transparent resize-none border-none p-0 m-0`}
          autoFocus
          placeholder={placeholder}
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
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${className} focus:outline-none bg-transparent border-none p-0 m-0`}
        autoFocus
        placeholder={placeholder}
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
        setEditValue(value)
      }}
      className={`cursor-text hover:underline hover:decoration-orange-500 transition-colors inline-block ${className}`}
      style={{ minWidth: multiline ? 'auto' : '1ch' }}
    >
      {value || placeholder}
    </span>
  )
}

export function ComponentRenderer({ 
  component, 
  onUpdateComponent 
}: { 
  component: PageComponent
  onUpdateComponent?: (config: Record<string, any>) => void
}) {
  const config = component.config

  const updateConfig = (updates: Record<string, any>) => {
    if (onUpdateComponent) {
      onUpdateComponent({ ...config, ...updates })
    }
  }

  switch (component.type) {
    case "text-input":
      return (
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
        <div className="p-6">
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
      
      const handleFileUpload = async (file: File) => {
        setUploading(true)
        try {
          // Check if it's an image - compress and store original
          if (file.type.startsWith('image/')) {
            // Compress image to under 1MB for bucket storage
            const compressedFile = await compressImageUnder1MB(file)
            
            // Upload compressed version to bucket
            const thumbnailUrl = await uploadFileToStorage(compressedFile, 'uploads', 'files', false)
            
            // Convert original to data URL for high-quality display
            const originalDataUrl = await fileToDataURL(file)
            
            if (thumbnailUrl) {
              setFilePreview(originalDataUrl) // Show original in preview
              setUploadedFileName(file.name)
              if (onUpdateComponent) {
                updateConfig({ 
                  fileUrl: thumbnailUrl, // Compressed thumbnail in bucket
                  fileOriginal: originalDataUrl, // Original for display
                  fileName: file.name, 
                  fileType: file.type 
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
            
            // Convert original video to data URL for high-quality display
            const originalVideoDataUrl = await fileToDataURL(file)
            
            if (thumbnailUrl) {
              setFilePreview(originalVideoDataUrl) // Show original video in preview
              setUploadedFileName(file.name)
              if (onUpdateComponent) {
                updateConfig({ 
                  fileUrl: thumbnailUrl, // Compressed thumbnail in bucket
                  fileOriginal: originalVideoDataUrl, // Original video for display
                  fileName: file.name,
                  fileType: file.type
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
      
      // Load file preview from config on mount (prefer original over thumbnail)
      useEffect(() => {
        if (!filePreview) {
          const original = config.fileOriginal || null
          const url = config.fileUrl || null
          const fileName = config.fileName || null
          
          if (original) {
            setFilePreview(original)
            setUploadedFileName(fileName)
          } else if (url) {
            setFilePreview(url)
            setUploadedFileName(fileName)
          }
        }
      }, [config.fileUrl || null, config.fileOriginal || null, config.fileName || null, filePreview])
      
      const isImage = uploadedFileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(uploadedFileName)
      const isVideo = uploadedFileName && /\.(mp4|webm|ogg|mov)$/i.test(uploadedFileName)
      
      return (
        <div>
          <label className="block text-xs font-medium mb-1.5">
            {onUpdateComponent ? (
              <EditableText
                value={config.label || "Upload your documents"}
                onChange={(value) => updateConfig({ label: value })}
                className="text-xs font-medium"
                placeholder="Upload your documents"
              />
            ) : (
              config.label || "Upload your documents"
            )}
          </label>
          <div
            className={`border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors ${
              onUpdateComponent ? 'cursor-pointer' : ''
            } ${uploading ? 'opacity-50' : ''}`}
            onDrop={onUpdateComponent ? handleFileDrop : undefined}
            onDragOver={onUpdateComponent ? (e) => e.preventDefault() : undefined}
            onClick={onUpdateComponent ? () => fileInputRef.current?.click() : undefined}
          >
            {filePreview || config.fileOriginal || config.fileUrl ? (
              <div className="space-y-2 w-full">
                {isImage ? (
                  <div className="w-full">
                    <img
                      src={filePreview || config.fileOriginal || config.fileUrl}
                      alt={uploadedFileName || "Uploaded image"}
                      className="w-full h-auto max-h-[400px] sm:max-h-[500px] object-contain rounded-lg mx-auto"
                    />
                    {uploadedFileName && (
                      <p className="text-xs text-muted-foreground mt-2 text-center truncate px-2">
                        {uploadedFileName}
                      </p>
                    )}
                  </div>
                ) : isVideo ? (
                  <div className="w-full">
                    <video
                      src={filePreview || config.fileOriginal || config.fileUrl}
                      controls
                      className="w-full h-auto max-h-[400px] sm:max-h-[500px] rounded-lg mx-auto"
                    />
                    {uploadedFileName && (
                      <p className="text-xs text-muted-foreground mt-2 text-center truncate px-2">
                        {uploadedFileName}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <File className="w-12 h-12 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate max-w-full px-2">{uploadedFileName}</p>
                  </div>
                )}
                {onUpdateComponent && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      // Delete file from storage if it exists
                      if (config.fileUrl && typeof config.fileUrl === 'string' && config.fileUrl.startsWith('http')) {
                        await deleteFileFromStorage(config.fileUrl, 'uploads')
                      }
                      setFilePreview(null)
                      setUploadedFileName(null)
                      updateConfig({ fileUrl: null, fileOriginal: null, fileName: null, fileType: null })
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove file
                  </button>
                )}
              </div>
            ) : (
              <>
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground">Uploading...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {onUpdateComponent ? (
                        <EditableText
                          value={config.acceptedTypes || "PDF, DOC, DOCX, Images, Videos (max 10MB)"}
                          onChange={(value) => updateConfig({ acceptedTypes: value })}
                          className="text-[10px] text-muted-foreground"
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
      const [videoPreview, setVideoPreview] = useState<string | null>(config.videoUrl || null)
      const [uploadingVideo, setUploadingVideo] = useState(false)
      
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
          // Extract thumbnail from video
          const thumbnail = await extractVideoThumbnail(file)
          if (!thumbnail) {
            console.error('Failed to extract video thumbnail')
            setUploadingVideo(false)
            return
          }

          // Compress thumbnail to under 1MB
          const compressedThumbnail = await compressImageUnder1MB(thumbnail)
          
          // Upload compressed thumbnail to bucket
          const thumbnailUrl = await uploadFileToStorage(compressedThumbnail, 'uploads', 'images', false)
          
          // Convert original video to data URL for high-quality display
          const originalVideoDataUrl = await fileToDataURL(file)
          
          if (thumbnailUrl) {
            setVideoPreview(originalVideoDataUrl) // Show original video in preview
            if (onUpdateComponent) {
              updateConfig({ 
                videoUrl: thumbnailUrl, // Compressed thumbnail in bucket
                videoOriginal: originalVideoDataUrl, // Original video for display
                videoFile: file.name,
                videoType: file.type
              })
            }
          }
        } catch (error) {
          console.error('Error uploading video:', error)
        } finally {
          setUploadingVideo(false)
        }
      }
      
      // Load video preview from config on mount (prefer original over thumbnail)
      useEffect(() => {
        if (!videoPreview) {
          const original = config.videoOriginal || null
          const url = config.videoUrl || null
          
          if (original) {
            setVideoPreview(original)
          } else if (url) {
            setVideoPreview(url)
          }
        }
      }, [config.videoUrl || null, config.videoOriginal || null, videoPreview])
      
      return (
        <div>
          <h3 className="text-xs font-medium mb-3">
            {onUpdateComponent ? (
              <EditableText
                value={config.title || "Watch this instructional video"}
                onChange={(value) => updateConfig({ title: value })}
                className="text-xs font-medium"
                placeholder="Watch this instructional video"
              />
            ) : (
              config.title || "Watch this instructional video"
            )}
          </h3>
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
            {videoPreview || config.videoOriginal || config.videoUrl ? (
              <video
                src={videoPreview || config.videoOriginal || config.videoUrl}
                controls
                className={`w-full rounded-xl ${
                  onUpdateComponent 
                    ? 'h-full object-contain' 
                    : 'h-auto max-h-[600px] object-contain'
                }`}
                style={{ maxWidth: '100%' }}
              />
            ) : (
              <>
                {uploadingVideo ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] text-muted-foreground">Uploading video...</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[10px] text-muted-foreground">Drop video or click to upload</p>
                    </div>
                    {onUpdateComponent && (
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileSelect}
                        className="hidden"
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {onUpdateComponent ? (
              <EditableText
                value={config.description || "This video is required to continue"}
                onChange={(value) => updateConfig({ description: value })}
                className="text-[10px] text-muted-foreground"
                placeholder="This video is required to continue"
              />
            ) : (
              config.description || "This video is required to continue"
            )}
          </p>
        </div>
      )
    }

    case "text-instruction":
      return (
        <div>
          <h3 className="text-xs font-medium mb-2">
            {onUpdateComponent ? (
              <EditableText
                value={config.title || "Welcome to our onboarding"}
                onChange={(value) => updateConfig({ title: value })}
                className="text-xs font-medium"
                placeholder="Welcome to our onboarding"
              />
            ) : (
              config.title || "Welcome to our onboarding"
            )}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {onUpdateComponent ? (
              <EditableText
                value={config.text || "This is a text instruction block. Use it for guidance, onboarding steps, expectations, disclaimers, etc."}
                onChange={(value) => updateConfig({ text: value })}
                className="text-xs text-muted-foreground leading-relaxed block"
                placeholder="This is a text instruction block. Use it for guidance, onboarding steps, expectations, disclaimers, etc."
                multiline
              />
            ) : (
              config.text || "This is a text instruction block. Use it for guidance, onboarding steps, expectations, disclaimers, etc."
            )}
          </p>
        </div>
      )

      case "multiple-choice":
      const options = config.options || ["Option A", "Option B", "Option C"]
      const canAddOption = options.length < 6
      const canRemoveOption = options.length > 1
      
      return (
        <div>
          <h3 className="text-xs font-medium mb-3">
            {onUpdateComponent ? (
              <EditableText
                value={config.title || "Select your answer"}
                onChange={(value) => updateConfig({ title: value })}
                className="text-xs font-medium"
                placeholder="Select your answer"
              />
            ) : (
              config.title || "Select your answer"
            )}
          </h3>
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
          <h3 className="text-xs font-medium mb-3">
            {onUpdateComponent ? (
              <EditableText
                value={config.title || "Select all that apply"}
                onChange={(value) => updateConfig({ title: value })}
                className="text-xs font-medium"
                placeholder="Select all that apply"
              />
            ) : (
              config.title || "Select all that apply"
            )}
          </h3>
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
          <label className="block text-xs font-medium mb-1.5">
            {onUpdateComponent ? (
              <EditableText
                value={config.label || "What is your name?"}
                onChange={(value) => updateConfig({ label: value })}
                className="text-xs font-medium"
                placeholder="What is your name?"
              />
            ) : (
              config.label || "What is your name?"
            )}
          </label>
          <input
            type="text"
            placeholder={config.placeholder || "Type your answer here..."}
            className="w-full bg-card border-none rounded-xl px-3 py-2 text-xs shadow-neumorphic-inset focus:outline-none"
            readOnly
          />
        </div>
      )

    case "header":
      return (
        <div>
          <h2 className="text-lg font-bold">
            {onUpdateComponent ? (
              <EditableText
                value={config.title || "Header Title"}
                onChange={(value) => updateConfig({ title: value })}
                className="text-lg font-bold"
                placeholder="Header Title"
              />
            ) : (
              config.title || "Header Title"
            )}
          </h2>
        </div>
      )

    case "link-button":
      return (
        <div className="flex flex-col items-center">
          {onUpdateComponent && (
            <div className="w-full mb-2">
              <input
                type="url"
                value={config.url || ""}
                onChange={(e) => updateConfig({ url: e.target.value })}
                placeholder="https://example.com"
                className="w-full bg-card border-none rounded-xl px-3 py-2 text-xs shadow-neumorphic-inset focus:outline-none"
              />
            </div>
          )}
          <a
            href={config.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-xs font-medium"
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
          </a>
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
      
      const handleImageUpload = async (file: File) => {
        setUploadingImage(true)
        try {
          // Compress image to under 1MB for bucket storage
          const compressedFile = await compressImageUnder1MB(file)
          
          // Upload compressed version to bucket
          const thumbnailUrl = await uploadFileToStorage(compressedFile, 'uploads', 'images', false)
          
          // Convert original to data URL for high-quality display
          const originalDataUrl = await fileToDataURL(file)
          
          if (thumbnailUrl) {
            setImagePreview(originalDataUrl) // Show original in preview
            if (onUpdateComponent) {
              updateConfig({ 
                imageUrl: thumbnailUrl, // Compressed thumbnail in bucket
                imageOriginal: originalDataUrl, // Original for display
                imageFile: file.name, 
                imageType: file.type 
              })
            }
          }
        } catch (error) {
          console.error('Error uploading image:', error)
        } finally {
          setUploadingImage(false)
        }
      }
      
      // Load image preview from config on mount (prefer original over thumbnail)
      useEffect(() => {
        if (!imagePreview) {
          const original = config.imageOriginal || null
          const url = config.imageUrl || null
          
          if (original) {
            setImagePreview(original)
          } else if (url) {
            setImagePreview(url)
          }
        }
      }, [config.imageUrl || null, config.imageOriginal || null, imagePreview])
      
      return (
        <div>
          <h3 className="text-xs font-medium mb-3">
            {onUpdateComponent ? (
              <EditableText
                value={config.title || "Image Title"}
                onChange={(value) => updateConfig({ title: value })}
                className="text-xs font-medium"
                placeholder="Image Title"
              />
            ) : (
              config.title || "Image Title"
            )}
          </h3>
          <div
            className={`w-full bg-muted rounded-xl flex items-center justify-center shadow-neumorphic-inset ${
              onUpdateComponent ? 'cursor-pointer hover:bg-muted/70' : ''
            } transition-colors relative ${uploadingImage ? 'opacity-50' : ''} ${
              onUpdateComponent ? 'aspect-video overflow-hidden' : 'min-h-[300px]'
            }`}
            onDrop={onUpdateComponent ? handleImageDrop : undefined}
            onDragOver={onUpdateComponent ? (e) => e.preventDefault() : undefined}
            onClick={onUpdateComponent ? () => imageInputRef.current?.click() : undefined}
          >
            {imagePreview || config.imageOriginal || config.imageUrl || config.url ? (
              <img
                src={imagePreview || config.imageOriginal || config.imageUrl || config.url}
                alt={config.alt || "Image"}
                className={`w-full rounded-xl ${
                  onUpdateComponent 
                    ? 'h-full object-cover' 
                    : 'h-auto max-h-[600px] object-contain'
                }`}
                style={{ maxWidth: '100%' }}
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

    case "scale-slider":
      return (
        <div>
          <label className="block text-xs font-medium mb-3">
            {onUpdateComponent ? (
              <EditableText
                value={config.label || "Rate your experience level"}
                onChange={(value) => updateConfig({ label: value })}
                className="text-xs font-medium"
                placeholder="Rate your experience level"
              />
            ) : (
              config.label || "Rate your experience level"
            )}
          </label>
          <div className="px-2">
            <input
              type="range"
              min={config.min ?? 1}
              max={config.max ?? 100}
              defaultValue={
                config.default ??
                Math.round(((config.min ?? 1) + (config.max ?? 100)) / 2)
              }
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
              <span>
                {onUpdateComponent ? (
                  <EditableText
                    value={config.minLabel || String(config.min ?? 1)}
                    onChange={(value) => updateConfig({ minLabel: value })}
                    className="text-[10px] text-muted-foreground"
                    placeholder={String(config.min ?? 1)}
                  />
                ) : (
                  config.minLabel || String(config.min ?? 1)
                )}
              </span>
              <span>
                {onUpdateComponent ? (
                  <EditableText
                    value={config.maxLabel || String(config.max ?? 100)}
                    onChange={(value) => updateConfig({ maxLabel: value })}
                    className="text-[10px] text-muted-foreground"
                    placeholder={String(config.max ?? 100)}
                  />
                ) : (
                  config.maxLabel || String(config.max ?? 100)
                )}
              </span>
            </div>
          </div>
        </div>
      )

        default:
      return <div>Unknown component</div>
  }
}


