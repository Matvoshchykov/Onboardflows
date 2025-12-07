"use client"

import { useState } from "react"
import { X, Crown } from "lucide-react"
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
    monthlyPrice: 19.99,
    yearlyPrice: 190,
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
    monthlyPrice: 19.99,
    yearlyPrice: 190, // $19.99 * 12 * 0.79 = $190 (approximately 20% savings)
    flows: 5,
    blocks: 30,
    features: [
      "5 flows per whop",
      "30 blocks per flow",
      "Advanced analytics",
      "Export data",
      "Priority support",
      "Save 20%"
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

    // For premium-monthly, redirect to static checkout link
    if (planId === "premium-monthly") {
      window.location.href = "https://whop.com/checkout/plan_Eds0CKZHj3xiQ"
      return
    }

    // For premium-yearly, redirect to static checkout link
    if (planId === "premium-yearly") {
      window.location.href = "https://whop.com/checkout/plan_8rq7G9zrL0SgF"
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

      // Create checkout configuration (fallback for other plans)
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

      console.log("Opening payment modal with:", { 
        checkoutId, 
        planId: whopPlanId,
        experienceId,
        iframeSdkAvailable: !!iframeSdk
      })

      // Open payment modal using Whop iframe SDK
      // According to Whop SDK: inAppPurchase requires checkout configuration ID and plan ID
      const purchasePromise = iframeSdk.inAppPurchase({
        id: checkoutId, // Checkout configuration ID (required)
        planId: whopPlanId, // Plan ID from the checkout configuration (required)
      }).catch((purchaseError: any) => {
        console.error("inAppPurchase error:", purchaseError)
        console.error("inAppPurchase error details:", {
          message: purchaseError?.message,
          error: purchaseError?.error,
          status: purchaseError?.status,
          checkoutId,
          planId: whopPlanId
        })
        throw purchaseError
      })

      // Add timeout to prevent infinite loading (60 seconds - increased for payment processing)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Payment modal timeout - the payment window may not have opened. Please try again."))
        }, 60000)
      })

      // Race between purchase and timeout
      const res = await Promise.race([purchasePromise, timeoutPromise]) as any

      console.log("Payment modal response:", res)
      console.log("Payment response details:", JSON.stringify(res, null, 2))

      if (res && res.status === "ok") {
        toast.success("Payment successful! Your membership has been activated.")
        // Redirect to creator canvas area
        setTimeout(() => {
          if (experienceId) {
            window.location.href = `/experiences/${experienceId}`
          } else {
            window.location.reload()
          }
        }, 1500)
      } else {
        console.error("Payment failed:", res)
        // Check for different error response formats
        let errorMessage = "Payment was cancelled or failed"
        if (res) {
          if (res.message) errorMessage = res.message
          else if (res.error) errorMessage = typeof res.error === 'string' ? res.error : res.error.message || errorMessage
          else if (typeof res === 'string') errorMessage = res
          else if (res.status && res.status !== "ok") {
            errorMessage = `Payment failed with status: ${res.status}`
          }
        }
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-background rounded-lg border border-border w-full max-w-4xl mx-4 relative max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: 'none' }}
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
          <div className="text-center mb-6">
            <h1 className="font-bold text-balance mb-2 text-[28px] sm:text-[34px] flex items-center justify-center gap-2" style={{ color: '#3b82f6', fontWeight: '700' }}>
              <Crown className="w-7 h-7 sm:w-9 sm:h-9" style={{ color: '#3b82f6' }} />
              Upgrade to Premium
            </h1>
            <p className="text-sm text-muted-foreground text-balance">
              Unlock advanced features and analytics
            </p>
          </div>

          {/* Pricing Cards - Only show Premium plans */}
          <div className="grid md:grid-cols-2 gap-4" role="list" aria-label="Pricing plans">
            {displayedPlans.filter(plan => plan.id !== "free").map((plan, index) => {
              const price = plan.id === "premium-yearly" ? plan.yearlyPrice : plan.monthlyPrice
              const period = plan.id === "premium-yearly" ? "per year" : "per month"
              const isYearly = plan.id === "premium-yearly"
              const isMonthly = plan.id === "premium-monthly"

              return (
                <Card
                  key={plan.id}
                  className="relative flex flex-col"
                  style={{
                    border: (isYearly || isMonthly) ? '2px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: (isYearly || isMonthly) ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none',
                    animation: (isYearly || isMonthly) ? 'pulseHighlight 2s ease-in-out infinite' : 'none'
                  }}
                  role="listitem"
                >
                  {(isYearly || isMonthly) && (
                    <style>{`
                      @keyframes pulseHighlight {
                        0%, 100% {
                          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
                        }
                        50% {
                          box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
                        }
                      }
                    `}</style>
                  )}

                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-xl font-bold" style={{ color: '#3b82f6', fontWeight: '700' }}>
                      Premium
                    </CardTitle>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">
                        ${typeof price === 'number' && price % 1 !== 0 ? price.toFixed(2) : price}
                      </span>
                      <span className="text-muted-foreground text-lg">
                        /{period}
                      </span>
                      {isYearly && (
                        <div className="text-xs text-muted-foreground mt-1">
                          ${(plan.yearlyPrice / 12).toFixed(2)}/month billed annually
                          <div className="text-[#3b82f6] font-medium mt-0.5">
                            Save 20%
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow">
                    <ul className="space-y-2" aria-label="Premium plan features">
                      {plan.features.filter(f => f !== "Save 20%").map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-[#3b82f6] mt-0.5 flex-shrink-0" aria-hidden="true" />
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

