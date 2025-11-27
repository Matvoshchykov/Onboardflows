"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

const pricingPlans = [
  {
    name: "Free",
    price: 0,
    period: "Forever",
    description: "Perfect for getting started",
    features: [
      "1 flow",
      "5 blocks per flow",
      "No analytics",
    ],
    popular: false,
  },
  {
    name: "Premium",
    price: 29.99,
    period: "per month",
    description: "Ideal for growing communities",
    features: [
      "5 flows per whop community",
      "20 blocks per flow",
      "Advanced analytics",
      "Priority support",
    ],
    popular: false,
  },
  {
    name: "Premium",
    price: 290,
    period: "per year",
    description: "Best value for long-term growth",
    features: [
      "5 flows per whop community",
      "20 blocks per flow",
      "Advanced analytics",
      "Priority support",
    ],
    popular: true,
  },
]

type PricingSectionProps = {
  currentPlan?: "free" | "premium-monthly" | "premium-yearly"
}

export function PricingSection({ currentPlan = "free" }: PricingSectionProps) {
  const getPlanKey = (plan: typeof pricingPlans[0], index: number): string => {
    if (plan.price === 0) return "free"
    if (plan.period === "per month") return "premium-monthly"
    return "premium-yearly"
  }

  const isCurrentPlan = (plan: typeof pricingPlans[0], index: number): boolean => {
    const planKey = getPlanKey(plan, index)
    return planKey === currentPlan
  }

  return (
    <section className="py-8 px-4" aria-labelledby="pricing-heading">
      <div className="max-w-5xl mx-auto">
        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-4" role="list" aria-label="Pricing plans">
          {pricingPlans.map((plan, index) => {
            const planKey = getPlanKey(plan, index)
            const isCurrent = isCurrentPlan(plan, index)
            return (
            <Card
              key={`${plan.name}-${index}`}
              className={`relative flex flex-col h-[600px] ${plan.popular ? "border-blue-600 shadow-lg scale-105" : ""}`}
              role="listitem"
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white border-blue-600" aria-label="Most popular plan">
                  Most Popular
                </Badge>
              )}

              <CardHeader className="text-center pb-4">
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <span className="text-4xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">
                        ${plan.price}
                      </span>
                      <span className="text-muted-foreground">
                        /{plan.period}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {plan.description}
                </p>
              </CardHeader>

              <CardContent className="flex-grow px-4">
                <ul className="space-y-6" aria-label={`${plan.name} plan features`}>
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="px-4 pb-4">
                <button
                  className={`w-full h-11 px-8 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isCurrent 
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
                      : "text-white"
                  }`}
                  style={{ 
                    backgroundColor: isCurrent ? '#9ca3af' : '#2563eb' 
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = '#1d4ed8'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.backgroundColor = '#2563eb'
                    }
                  }}
                  disabled={isCurrent}
                  onClick={(e) => {
                    if (isCurrent) {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                >
                  {isCurrent && planKey === "free" ? "Current Plan" : "Get Started"}
                </button>
              </CardFooter>
            </Card>
          )
          })}
        </div>
      </div>
    </section>
  )
}
