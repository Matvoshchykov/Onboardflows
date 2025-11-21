"use client"

import { useState } from "react"

type ChatModalProps = {
  onClose: () => void
  onCreateFlow: (goal: string) => void
}

export function ChatModal({ onClose, onCreateFlow }: ChatModalProps) {
  const [goal, setGoal] = useState("")

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-8 w-full max-w-md shadow-neumorphic-raised">
        <h2 className="text-xl font-bold mb-2">Create New Flow</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          What is the goal of this onboarding flow?
        </p>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g., Increase Pro Plan signups"
          className="w-full bg-card shadow-neumorphic-inset rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 mb-6 transition-all duration-300 text-sm placeholder:text-muted-foreground"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-card text-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => goal && onCreateFlow(goal)}
            disabled={!goal}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Create Flow
          </button>
        </div>
      </div>
    </div>
  )
}
