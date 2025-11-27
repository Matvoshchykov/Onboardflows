"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { useIframeSdk } from "@whop/react"
import { useParams } from "next/navigation"

type PlanType = "free" | "premium-monthly" | "premium-yearly"

const pricingPlans = [
  {
    id: "free" as PlanType,
    name: "Free",
    description: "Perfect for getting started with onboarding flows",
    monthlyPrice: 0,
    yearlyPrice: 0,
    flows: 1,
    blocks: 5,
    features: [
      "1 flow",
      "5 blocks per flow",
      "No analytics"
    ],
    popular: false,
  },
  {
    id: "premium-monthly" as PlanType,
    name: "Premium",
    description: "Ideal for growing teams and businesses",
    monthlyPrice: 30,
    yearlyPrice: 280,
    flows: 5,
    blocks: 30,
    features: [
      "5 flows per whop",
      "30 blocks per flow",
      "Advanced analytics",
      "Export data",
      "Priority support"
    ],
    popular: false,
  },
  {
    id: "premium-yearly" as PlanType,
    name: "Premium",
    description: "Best value for long-term growth",
    monthlyPrice: 30,
    yearlyPrice: 280, // $30 * 12 * 0.78 = $280 (approximately 22% savings)
    flows: 5,
    blocks: 30,
    features: [
      "5 flows per whop",
      "30 blocks per flow",
      "Advanced analytics",
      "Export data",
      "Priority support",
      "Save 22%"
    ],
    popular: false,
  },
]

type UpgradeModalProps = {
  onClose: () => void
  currentPlan?: PlanType
}

export function UpgradeModal({ onClose, currentPlan = "free" }: UpgradeModalProps) {
  const iframeSdk = useIframeSdk()
  const params = useParams()
  const experienceId = params?.experienceId as string
  const [isProcessing, setIsProcessing] = useState(false)

  const handleBuy = async (planId: PlanType) => {
    if (planId === "free") {
      toast.info("You're already on the free plan")
      return
    }

    if (!iframeSdk) {
      toast.error("Payment system not available. Please try again later.")
      return
    }

    setIsProcessing(true)

    try {
      // Get company ID
      const companyIdResponse = await fetch(`/api/get-company-id?experienceId=${experienceId}`)
      if (!companyIdResponse.ok) {
        throw new Error("Failed to get company ID")
      }
      const { companyId } = await companyIdResponse.json()

      // Create checkout configuration
      const checkoutResponse = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planType: planId,
          companyId: companyId,
          experienceId: experienceId, // Also pass experienceId as fallback
        }),
      })

      if (!checkoutResponse.ok) {
        // Get response text first to see what we're dealing with
        const responseText = await checkoutResponse.text()
        console.error("Checkout error - Status:", checkoutResponse.status)
        console.error("Checkout error - Response:", responseText)
        
        let errorData: any = null
        try {
          // Try to parse the response text
          // Handle case where responseText might be a stringified JSON string
          const textToParse = responseText.startsWith('"') && responseText.endsWith('"') 
            ? JSON.parse(responseText) 
            : responseText
          errorData = typeof textToParse === 'string' ? JSON.parse(textToParse) : textToParse
        } catch (e) {
          // If not JSON, use the text as error message
          console.error("Failed to parse error response:", e)
          throw new Error(responseText || `HTTP ${checkoutResponse.status}: Failed to create checkout`)
        }
        
        console.error("Checkout error - Parsed:", errorData)
        
        // Extract error message from nested error object if present
        let errorMessage = "Failed to create checkout"
        if (errorData) {
          if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error
            } else if (errorData.error.message) {
              errorMessage = errorData.error.message
            } else if (errorData.error.type) {
              errorMessage = `${errorData.error.type}: ${errorData.error.message || 'Unknown error'}`
            }
          } else if (errorData.details) {
            errorMessage = errorData.details
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else if (typeof errorData === 'string') {
            errorMessage = errorData
          }
        }
        
        if (responseText && errorMessage === "Failed to create checkout") {
          errorMessage = responseText
        }
        
        throw new Error(errorMessage)
      }

      const responseData = await checkoutResponse.json()
      const { checkoutId, planId: whopPlanId } = responseData
      
      if (!checkoutId || !whopPlanId) {
        console.error("Invalid checkout response:", responseData)
        throw new Error("Invalid checkout response: missing checkoutId or planId")
      }

      console.log("Opening payment modal with:", { checkoutId, planId: whopPlanId })

      // Open payment modal using Whop iframe SDK with timeout
      const purchasePromise = iframeSdk.inAppPurchase({
        planId: whopPlanId,
        id: checkoutId,
      })

      // Add timeout to prevent infinite loading (30 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Payment modal timeout - the payment window may not have opened. Please try again."))
        }, 30000)
      })

      // Race between purchase and timeout
      const res = await Promise.race([purchasePromise, timeoutPromise]) as any

      console.log("Payment modal response:", res)

      if (res.status === "ok") {
        toast.success("Payment successful! Your membership has been activated.")
        // Refresh the page to update membership status
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        console.error("Payment failed:", res)
        const errorMessage = (res as any).message || (res as any).error || "Payment was cancelled or failed"
        toast.error(errorMessage)
        setIsProcessing(false)
      }
    } catch (error) {
      console.error("Error processing payment:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to process payment. Please try again."
      toast.error(errorMessage)
      setIsProcessing(false)
    }
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
                  className="relative flex flex-col h-[600px]"
                  role="listitem"
                >

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
                          <div className="text-primary font-medium mt-1">
                            Save 22% vs monthly
                          </div>
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
                      className="w-full text-white"
                      variant="default"
                      size="lg"
                      onClick={() => handleBuy(plan.id)}
                      disabled={isProcessing || plan.id === "free"}
                      aria-label={`Get started with ${plan.name} plan for $${price} per ${period}`}
                      style={plan.id !== "free" ? { backgroundColor: '#3b82f6' } : {}}
                    >
                      {isProcessing ? "Processing..." : plan.id === "free" ? "Current Plan" : "Get Started"}
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

