"use client"

import { useState } from "react"
import { X, Save } from "lucide-react"

type ChatModalProps = {
  onClose: () => void
  onCreateFlow: (name: string) => Promise<void>
}

export function ChatModal({ onClose, onCreateFlow }: ChatModalProps) {
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return

    setIsCreating(true)
    try {
      await onCreateFlow(name.trim())
    } catch (error) {
      console.error('Error creating flow:', error)
      alert('Failed to create flow. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-card rounded-lg p-6 w-full max-w-sm border border-border relative">
        {/* Small X exit button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card hover:bg-muted transition-colors flex items-center justify-center border border-border"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
        
        {/* Flow Name Input */}
        <div className="mb-4">
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
            className="w-full bg-card shadow-neumorphic-inset rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-300 text-sm placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleCreate}
          disabled={!name.trim() || isCreating}
          className="w-full rounded-lg bg-primary text-primary-foreground border border-primary/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium py-2 px-4 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isCreating ? 'Creating...' : 'Create Flow'}
        </button>
      </div>
    </div>
  )
}
