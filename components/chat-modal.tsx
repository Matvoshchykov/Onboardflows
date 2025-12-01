"use client"

import { useState, useRef, useEffect } from "react"
import { X, Save, Upload, Image as ImageIcon } from "lucide-react"
import { compressImage } from "@/lib/image-compression"

type ChatModalProps = {
  onClose: () => void
  onCreateFlow: (name: string, iconUrl?: string) => Promise<void>
}

export function ChatModal({ onClose, onCreateFlow }: ChatModalProps) {
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const [iconSize, setIconSize] = useState(80)

  const handleIconSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    try {
      // Compress the image
      const compressedFile = await compressImage(file, 512, 512, 0.8)
      setIconFile(compressedFile)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string)
      }
      reader.readAsDataURL(compressedFile)
    } catch (error) {
      console.error('Error processing image:', error)
      alert('Failed to process image. Please try again.')
    }
  }

  const handleRemoveIcon = () => {
    setIconPreview(null)
    setIconFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Measure left column height and set icon size to match (square)
  useEffect(() => {
    const updateIconSize = () => {
      if (leftColumnRef.current) {
        const height = leftColumnRef.current.offsetHeight
        setIconSize(height)
      }
    }
    
    updateIconSize()
    window.addEventListener('resize', updateIconSize)
    return () => window.removeEventListener('resize', updateIconSize)
  }, [name, isCreating])

  const handleCreate = async () => {
    if (!name.trim()) return

    setIsCreating(true)
    try {
      let iconUrl: string | undefined

      // Upload icon if provided
      if (iconFile) {
        const formData = new FormData()
        formData.append('file', iconFile)

        const response = await fetch('/api/upload-flow-icon', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to upload icon')
        }

        const data = await response.json()
        iconUrl = data.url
      }

      await onCreateFlow(name.trim(), iconUrl)
    } catch (error) {
      console.error('Error creating flow:', error)
      alert(error instanceof Error ? error.message : 'Failed to create flow. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={(e) => {
        // Close modal when clicking outside the card
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-card rounded-lg p-6 w-full max-w-md border border-border/30 shadow-lg relative">
        <div className="flex items-start gap-4">
          {/* Left side: Name and Create button - Compact */}
          <div ref={leftColumnRef} className="flex-1 flex flex-col gap-3">
            {/* Flow Name Input */}
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim() && !isCreating) {
                    handleCreate()
                  }
                }}
                placeholder="Flow name"
                className="w-full bg-background/50 border border-border/30 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 text-sm placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="w-full rounded-md bg-primary text-primary-foreground transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium py-1.5 px-4 flex items-center justify-center gap-2 hover:bg-primary/90"
            >
              <Save className="w-4 h-4" />
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>

          {/* Right side: Icon Upload - Square, 1:1, same height as name + button + gap */}
          <div className="flex-shrink-0">
            {iconPreview ? (
              <div className="relative" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                <img
                  src={iconPreview}
                  alt="Icon preview"
                  className="w-full h-full object-cover rounded-md border border-border/30"
                />
                <button
                  type="button"
                  onClick={handleRemoveIcon}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:bg-destructive/90 transition-colors shadow-sm"
                  title="Remove icon"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block" style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
                <div className="w-full h-full border border-dashed border-border/40 rounded-md flex items-center justify-center hover:border-primary/50 hover:bg-muted/30 transition-all duration-200 group">
                  <ImageIcon className="w-5 h-5 text-muted-foreground/60 group-hover:text-primary/70 transition-colors" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
