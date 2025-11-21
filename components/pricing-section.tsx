"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

const pricingPlans = [
  {
    name: "Starter",
    description: "Perfect for individuals and small projects",
    monthlyPrice: 9,
    yearlyPrice: 90,
    features: ["Up to 5 projects", "10GB storage", "Basic support", "Standard templates", "Email notifications"],
    popular: false,
  },
  {
    name: "Professional",
    description: "Ideal for growing teams and businesses",
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: [
      "Unlimited projects",
      "100GB storage",
      "Priority support",
      "Premium templates",
      "Advanced analytics",
      "Team collaboration",
      "Custom integrations",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large organizations with advanced needs",
    monthlyPrice: 99,
    yearlyPrice: 990,
    features: [
      "Everything in Professional",
      "Unlimited storage",
      "24/7 dedicated support",
      "Custom development",
      "Advanced security",
      "SSO integration",
      "API access",
      "White-label options",
    ],
    popular: false,
  },
]

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <section className="py-24 px-4" aria-labelledby="pricing-heading">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 id="pricing-heading" className="text-4xl font-bold text-balance mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground text-balance mb-8">
            Select the perfect plan for your needs. Upgrade or downgrade at any time.
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
          {pricingPlans.map((plan, index) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col h-[600px] ${plan.popular ? "border-primary shadow-lg scale-105" : ""}`}
              role="listitem"
              aria-labelledby={`plan-${index}-title`}
              aria-describedby={`plan-${index}-description plan-${index}-price`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" aria-label="Most popular plan">
                  Most Popular
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
                    aria-label={`${isYearly ? plan.yearlyPrice : plan.monthlyPrice} dollars per ${isYearly ? "year" : "month"}`}
                  >
                    ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground" aria-hidden="true">
                    /{isYearly ? "year" : "month"}
                  </span>
                  {isYearly && (
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
                  aria-label={`Get started with ${plan.name} plan for $${isYearly ? plan.yearlyPrice : plan.monthlyPrice} per ${isYearly ? "year" : "month"}`}
                >
                  Get Started
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground">All plans include a 14-day free trial. No credit card required.</p>
        </div>
      </div>
    </section>
  )
}
