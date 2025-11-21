"use client"

import { useState, useEffect } from "react"
import { Check, Loader2 } from "lucide-react"
import { toggleFlowActive } from "@/lib/db/flows"
import { toast } from "sonner"

type UploadFlowModalProps = {
  onClose: () => void
  flowId: string
  flowTitle: string
  onSuccess?: () => void
}

type StepStatus = "pending" | "loading" | "completed" | "error"

const verificationSteps = [
  { id: "validate", label: "Validating flow structure" },
  { id: "check-connections", label: "Checking node connections" },
  { id: "verify-components", label: "Verifying components" },
  { id: "upload", label: "Uploading to database" },
  { id: "activate", label: "Activating flow" },
]

export function UploadFlowModal({ onClose, flowId, flowTitle, onSuccess }: UploadFlowModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    verificationSteps.reduce((acc, step) => ({ ...acc, [step.id]: "pending" }), {})
  )

  useEffect(() => {
    // Start verification process
    const verifyAndUpload = async () => {
      for (let i = 0; i < verificationSteps.length; i++) {
        const step = verificationSteps[i]
        
        // Set current step to loading
        setCurrentStep(i)
        setStepStatuses(prev => ({ ...prev, [step.id]: "loading" }))
        
        // Simulate step processing with delay
        await new Promise(resolve => setTimeout(resolve, 800))
        
        // Set step to completed
        setStepStatuses(prev => ({ ...prev, [step.id]: "completed" }))
        
        // On last step (activate), actually update the database
        if (step.id === "activate") {
          try {
            const success = await toggleFlowActive(flowId, true)
            if (!success) {
              throw new Error("Failed to activate flow")
            }
            // Set step to completed
            setStepStatuses(prev => ({ ...prev, [step.id]: "completed" }))
            
            // Show success toast and close immediately
            toast.success("Flow uploaded and activated successfully")
            onSuccess?.()
            onClose()
          } catch (error) {
            console.error("Error activating flow:", error)
            setStepStatuses(prev => ({ ...prev, [step.id]: "error" }))
            toast.error("Failed to activate flow")
          }
          break // Stop the loop after activating
        }
      }
    }

    verifyAndUpload()
  }, [flowId, onClose, onSuccess])

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Uploading Flow</h2>
          <p className="text-sm text-muted-foreground">{flowTitle}</p>
        </div>

        <div className="space-y-3">
          {verificationSteps.map((step, index) => {
            const status = stepStatuses[step.id]
            const isActive = currentStep === index
            
            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive ? "bg-primary/10" : ""
                }`}
              >
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {status === "completed" ? (
                    <div className="w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  ) : status === "loading" ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : status === "error" ? (
                    <div className="w-5 h-5 rounded-full bg-red-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <span 
                  className={`text-sm transition-colors ${
                    status === "completed" 
                      ? "text-foreground" 
                      : status === "loading"
                      ? "text-primary font-medium"
                      : status === "error"
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

