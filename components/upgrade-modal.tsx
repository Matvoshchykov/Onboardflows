"use client"

import { X } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { toast } from "sonner"

type PlanType = "free" | "premium-monthly" | "premium-yearly"

const pricingPlans = [
  {
    id: "free" as PlanType,
    name: "Free",
    description: "Perfect for getting started with onboarding flows",
    monthlyPrice: 0,
    yearlyPrice: 0,
    flows: 1,
    blocks: 20,
    features: [
      "1 onboarding flow",
      "Up to 20 blocks per flow",
      "File uploads (images & videos)",
      "Unique onboarding blocks",
      "Basic components",
      "Community support"
    ],
    popular: false,
  },
  {
    id: "premium-monthly" as PlanType,
    name: "Premium",
    description: "Ideal for growing teams and businesses",
    monthlyPrice: 29,
    yearlyPrice: 278.40,
    flows: 3,
    blocks: 20,
    features: [
      "3 flows per shop/community",
      "Up to 20 blocks per flow",
      "All premium components",
      "Advanced logic blocks",
      "A/B testing capabilities",
      "Priority support",
      "Analytics & insights",
      "Custom branding"
    ],
    popular: false,
  },
  {
    id: "premium-yearly" as PlanType,
    name: "Premium",
    description: "Best value for long-term growth",
    monthlyPrice: 29,
    yearlyPrice: 278.40,
    flows: 3,
    blocks: 20,
    features: [
      "3 flows per shop/community",
      "Up to 20 blocks per flow",
      "All premium components",
      "Advanced logic blocks",
      "A/B testing capabilities",
      "Priority support",
      "Analytics & insights",
      "Custom branding",
      "Save 20% vs monthly"
    ],
    popular: true,
  },
]

type UpgradeModalProps = {
  onClose: () => void
  currentPlan?: PlanType
}

export function UpgradeModal({ onClose, currentPlan = "free" }: UpgradeModalProps) {
  const handleBuy = (planId: PlanType) => {
    console.log(`Buying plan: ${planId}`)
    const plan = pricingPlans.find(p => p.id === planId)
    const planName = plan?.name || "Premium"
    toast.success(`Upgrading to ${planName} plan...`)
    
    localStorage.setItem("currentPlan", planId)
    
    setTimeout(() => {
      onClose()
    }, 1500)
  }

  // Show all 3 plans
  const displayedPlans = pricingPlans

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-balance mb-4">
              Choose Your Plan
            </h1>
            <p className="text-lg text-muted-foreground text-balance mb-6">
              Select the perfect plan for your onboarding needs. Upgrade or downgrade at any time.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6" role="list" aria-label="Pricing plans">
            {displayedPlans.map((plan, index) => {
              const price = plan.id === "free" 
                ? 0 
                : (plan.id === "premium-yearly" ? plan.yearlyPrice : plan.monthlyPrice)
              const period = plan.id === "free" 
                ? "Forever" 
                : (plan.id === "premium-yearly" ? "per year" : "per month")

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col h-[600px] ${
                    plan.popular ? "border-primary shadow-lg scale-105" : ""
                  }`}
                  role="listitem"
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" aria-label="Most popular plan">
                      Most Popular
                    </Badge>
                  )}

                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl font-bold">
                      {plan.name}
                    </CardTitle>
                    <CardDescription className="text-balance">
                      {plan.description}
                    </CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">
                        ${price}
                      </span>
                      {period !== "Forever" && (
                        <span className="text-muted-foreground">
                          /{period}
                        </span>
                      )}
                      {period === "per year" && (
                        <div className="text-sm text-muted-foreground mt-1">
                          ${Math.round(plan.yearlyPrice / 12)}/month billed annually
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow">
                    <div className="mb-6 space-y-2">
                      <div className="flex items-center gap-2 text-base">
                        <Check className="w-5 h-5 text-[#3b82f6] flex-shrink-0" />
                        <span className="font-medium">{plan.flows} flow{plan.flows > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 text-base">
                        <Check className="w-5 h-5 text-[#3b82f6] flex-shrink-0" />
                        <span className="font-medium">Up to {plan.blocks} blocks per flow</span>
                      </div>
                    </div>
                    <ul className="space-y-3" aria-label={`${plan.name} plan features`}>
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${
                        !plan.popular
                          ? "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:border-gray-600"
                          : ""
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      onClick={() => handleBuy(plan.id)}
                      aria-label={`Get started with ${plan.name} plan for $${price} per ${period}`}
                    >
                      Get Started
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

