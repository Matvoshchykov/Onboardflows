"use client"

import { useState } from "react"
import { X, Crown, Check } from "lucide-react"
import { toast } from "sonner"

type PlanType = "free" | "premium-monthly" | "premium-yearly"

type PlanSelectionModalProps = {
  onClose: () => void
  currentPlan?: PlanType
}

export function PlanSelectionModal({ onClose, currentPlan = "free" }: PlanSelectionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(currentPlan)

  const plans = [
    {
      id: "free" as PlanType,
      name: "Free",
      price: "$0",
      period: "Forever",
      flows: 1,
      blocks: 5,
      features: [
        "1 onboarding flow",
        "Maximum 5 blocks per flow",
        "Basic components",
        "File uploads (images & videos)",
        "Community support"
      ],
      buttonText: "Current Plan",
      buttonDisabled: true
    },
    {
      id: "premium-monthly" as PlanType,
      name: "Premium",
      price: "$29",
      period: "per month",
      flows: 3,
      blocks: 20,
      features: [
        "3 flows per shop/community",
        "Maximum 20 blocks per flow",
        "All premium components",
        "Advanced logic blocks",
        "A/B testing capabilities",
        "Priority support",
        "Analytics & insights",
        "Custom branding"
      ],
      buttonText: "Upgrade to Monthly",
      buttonDisabled: false
    },
    {
      id: "premium-yearly" as PlanType,
      name: "Premium",
      price: "$290",
      period: "per year",
      flows: 3,
      blocks: 20,
      features: [
        "3 flows per shop/community",
        "Maximum 20 blocks per flow",
        "All premium components",
        "Advanced logic blocks",
        "A/B testing capabilities",
        "Priority support",
        "Analytics & insights",
        "Custom branding",
        "Save 17% vs monthly"
      ],
      buttonText: "Upgrade to Yearly",
      buttonDisabled: false,
      popular: true
    }
  ]

  const handleBuy = (planId: PlanType) => {
    // TODO: Implement payment processing
    console.log(`Buying plan: ${planId}`)
    const planName = plans.find(p => p.id === planId)?.name || "Premium"
    toast.success(`Upgrading to ${planName} plan...`)
    // Close modal after purchase
    setTimeout(() => {
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-card rounded-2xl p-8 w-full max-w-4xl shadow-neumorphic-raised max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Crown className="w-6 h-6 text-[#3b82f6]" />
              Choose Your Plan
            </h2>
            <p className="text-sm text-muted-foreground">
              Select the perfect plan for your onboarding needs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan
            const isSelected = plan.id === selectedPlan

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl p-6 bg-card shadow-neumorphic-raised transition-all duration-300 ${
                  isCurrentPlan
                    ? "ring-2 ring-[#3b82f6] shadow-lg"
                    : isSelected
                    ? "ring-2 ring-primary/30"
                    : "hover:shadow-neumorphic-pressed"
                }`}
                onClick={() => !plan.buttonDisabled && setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#3b82f6] text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <div className="bg-[#3b82f6] text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Current
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period !== "Forever" && (
                      <span className="text-sm text-muted-foreground">/{plan.period}</span>
                    )}
                  </div>
                </div>

                <div className="mb-6 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />
                    <span className="font-medium">{plan.flows} flow{plan.flows > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-[#3b82f6] flex-shrink-0" />
                    <span className="font-medium">Up to {plan.blocks} blocks per flow</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6 min-h-[200px]">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!plan.buttonDisabled) {
                      handleBuy(plan.id)
                    }
                  }}
                  disabled={plan.buttonDisabled}
                  className={`w-full py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                    plan.buttonDisabled
                      ? "bg-muted text-muted-foreground cursor-not-allowed shadow-neumorphic-inset"
                      : isCurrentPlan
                      ? "bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/50 hover:shadow-[#3b82f6]/70"
                      : "bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed"
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

