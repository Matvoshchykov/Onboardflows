"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"

type FlowSuccessProps = {
  onClose?: () => void
}

export function FlowSuccess({ onClose }: FlowSuccessProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showMessage, setShowMessage] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    setIsVisible(true)
    setTimeout(() => setShowMessage(true), 500)
  }, [])

  return (
    <div className="fixed inset-0 bg-background z-[200] flex items-center justify-center p-4">
      <div 
        className={`text-center space-y-6 transition-all duration-500 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Success Icon with Animation */}
        <div className="flex justify-center">
          <div 
            className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#22c55e] flex items-center justify-center transition-all duration-700 ${
              isVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-180'
            }`}
            style={{
              boxShadow: '0 0 40px rgba(34, 197, 94, 0.5)'
            }}
          >
            <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
          </div>
        </div>
        
        {/* Success Message */}
        {showMessage && (
          <div className="space-y-3 animate-fade-in">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Onboarding Flow Complete! 🎉
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              This onboarding experience was created using FlowBuilder
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

