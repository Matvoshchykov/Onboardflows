"use client"

import { PricingSection } from "./pricing-section"

type PlanSelectionModalProps = {
  onClose: () => void
  currentPlan?: "free" | "premium-monthly" | "premium-yearly"
}

export function PlanSelectionModal({ onClose, currentPlan = "free" }: PlanSelectionModalProps) {
  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm overflow-y-auto py-4" 
      onClick={onClose}
    >
      <div 
        className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <PricingSection currentPlan={currentPlan} />
        </div>
      </div>
    </div>
  )
}

