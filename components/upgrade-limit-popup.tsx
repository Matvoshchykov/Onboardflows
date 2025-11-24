"use client"

import { useState, useEffect } from "react"
import { Check, Crown, ArrowRight, X } from "lucide-react"

type UpgradeLimitPopupProps = {
  limitType: "blocks" | "flows"
  currentCount: number
  maxCount: number
  onUpgrade: () => void
  onClose?: () => void
}

const advantages = [
  "30 blocks per flow (vs 5 on free)",
  "3 flows per experience (vs 1 on free)",
  "Advanced analytics & insights",
  "Export data to CSV",
  "Priority support"
]

export function UpgradeLimitPopup({ limitType, currentCount, maxCount, onUpgrade, onClose }: UpgradeLimitPopupProps) {
  const [showCheckmarks, setShowCheckmarks] = useState(false)

  useEffect(() => {
    // Animate checkmarks sequentially
    const timer = setTimeout(() => {
      setShowCheckmarks(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl border border-border max-w-md mx-4 p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Small and discreet */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">
            {limitType === "blocks" ? "Block Limit Reached" : "Flow Limit Reached"}
          </h2>
          <p className="text-muted-foreground">
            You've reached your limit of {maxCount} {limitType === "blocks" ? "blocks" : "flows"} on the free plan.
          </p>
        </div>

        {/* Advantages List with Animated Checkmarks */}
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground mb-3">Upgrade to Premium and get:</h3>
          {advantages.map((advantage, index) => (
            <div
              key={index}
              className="flex items-center gap-3 transition-all duration-300"
              style={{
                opacity: showCheckmarks ? 1 : 0,
                transform: showCheckmarks ? 'translateX(0)' : 'translateX(-10px)',
                transitionDelay: `${index * 100}ms`
              }}
            >
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check 
                    className="w-3.5 h-3.5 text-primary"
                    style={{
                      opacity: showCheckmarks ? 1 : 0,
                      transform: showCheckmarks ? 'scale(1)' : 'scale(0)',
                      transition: `opacity 0.2s ${index * 100}ms, transform 0.2s ${index * 100}ms`
                    }}
                  />
                </div>
              </div>
              <span className="text-sm text-foreground">{advantage}</span>
            </div>
          ))}
        </div>

        {/* Upgrade Button */}
        <button
          onClick={onUpgrade}
          className="w-full py-3 px-6 rounded-lg font-medium shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-center gap-2 text-white"
          style={{ backgroundColor: '#3b82f6' }}
        >
          <span>Upgrade to Premium</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

