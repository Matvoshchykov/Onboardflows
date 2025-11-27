"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Crown } from "lucide-react"
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
    yearlyPrice: 290,
    flows: 3,
    blocks: 20,
    features: [
      "5 flows per shop/community",
      "Up to 20 blocks per flow",
      "All premium components",
      "Advanced logic blocks",
      "A/B testing capabilities",
      "Priority support",
      "Analytics & insights",
      "Custom branding"
    ],
    popular: true,
  },
  {
    id: "premium-yearly" as PlanType,
    name: "Premium",
    description: "Best value for long-term growth",
    monthlyPrice: 29,
    yearlyPrice: 290,
    flows: 3,
    blocks: 20,
    features: [
      "5 flows per shop/community",
      "Up to 20 blocks per flow",
      "All premium components",
      "Advanced logic blocks",
      "A/B testing capabilities",
      "Priority support",
      "Analytics & insights",
      "Custom branding",
      "Save 17% vs monthly"
    ],
    popular: false,
  },
]

export default function UpgradePage() {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<PlanType>("free")
  const [isYearly, setIsYearly] = useState(false)

  // Get current plan from localStorage
  useEffect(() => {
    const savedPlan = localStorage.getItem("currentPlan") as PlanType
    if (savedPlan) {
      setCurrentPlan(savedPlan)
      // Set yearly toggle if current plan is yearly
      if (savedPlan === "premium-yearly") {
        setIsYearly(true)
      }
    }
  }, [])

  const handleBuy = (planId: PlanType) => {
    // TODO: Implement payment processing
    console.log(`Buying plan: ${planId}`)
    const plan = pricingPlans.find(p => p.id === planId)
    const planName = plan?.name || "Premium"
    toast.success(`Upgrading to ${planName} plan...`)
    
    // Update current plan
    localStorage.setItem("currentPlan", planId)
    setCurrentPlan(planId)
    
    // Navigate back after purchase
    setTimeout(() => {
      router.back()
    }, 1500)
  }

  // Show all plans, but adjust pricing based on yearly toggle
  const displayedPlans = pricingPlans.filter(p => 
    p.id === "free" || 
    (isYearly && p.id === "premium-yearly") || 
    (!isYearly && p.id === "premium-monthly")
  )

  return (
    <section className="py-24 px-4" aria-labelledby="pricing-heading">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 id="pricing-heading" className="text-4xl font-bold text-balance mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground text-balance mb-8">
            Select the perfect plan for your onboarding needs. Upgrade or downgrade at any time.
          </p>

          {/* Toggle */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center justify-center gap-4">
              <span
                className={`text-sm font-medium w-16 text-center ${!isYearly ? "text-foreground" : "text-muted-foreground"}`}
                id="monthly-label"
              >
                Monthly
              </span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isYearly ? "bg-primary" : "bg-muted"
                }`}
                role="switch"
                aria-checked={isYearly}
                aria-label="Toggle between monthly and yearly billing"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isYearly ? "translate-x-6" : "translate-x-1"
                  }`}
                  aria-hidden="true"
                />
              </button>
              <span
                className={`text-sm font-medium w-16 text-center ${isYearly ? "text-foreground" : "text-muted-foreground"}`}
                id="yearly-label"
              >
                Yearly
              </span>
            </div>
            <div className="min-h-[24px] flex justify-center">
              {isYearly && (
                <Badge variant="secondary" aria-label="17% savings with yearly billing">
                  Save 17%
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto" role="list" aria-label="Pricing plans">
          {displayedPlans.map((plan, index) => {
            const isCurrentPlan = plan.id === currentPlan
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
                } ${isCurrentPlan ? "ring-2 ring-primary/50" : ""}`}
                role="listitem"
                aria-labelledby={`plan-${index}-title`}
                aria-describedby={`plan-${index}-description plan-${index}-price`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" aria-label="Most popular plan">
                    Most Popular
                  </Badge>
                )}

                {isCurrentPlan && (
                  <Badge className="absolute top-6 right-6 bg-[#3b82f6] text-white" aria-label="Current plan">
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Current
                  </Badge>
                )}

                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold" id={`plan-${index}-title`}>
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-balance" id={`plan-${index}-description`}>
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4" id={`plan-${index}-price`}>
                    <span
                      className="text-4xl font-bold"
                      aria-label={`${price} dollars per ${period}`}
                    >
                      ${price}
                    </span>
                    {period !== "Forever" && (
                      <span className="text-muted-foreground" aria-hidden="true">
                        /{period}
                      </span>
                    )}
                    {period === "per year" && (
                      <div
                        className="text-sm text-muted-foreground mt-1"
                        aria-label={`Equivalent to ${Math.round(plan.yearlyPrice / 12)} dollars per month when billed annually`}
                      >
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
                      !plan.popular && !isCurrentPlan
                        ? "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:border-gray-600"
                        : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    disabled={isCurrentPlan}
                    onClick={() => handleBuy(plan.id)}
                    aria-label={`Get started with ${plan.name} plan for $${price} per ${period}`}
                  >
                    {isCurrentPlan ? "Current Plan" : "Get Started"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground">All plans include a 14-day free trial. No credit card required.</p>
        </div>
      </div>
    </section>
  )
}