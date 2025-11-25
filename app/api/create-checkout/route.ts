import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";

// Pricing in cents (from upgrade-modal.tsx)
const PRICING = {
  "premium-monthly": {
    renewalPrice: 3000, // $30.00 in cents
    billingPeriod: 1,
    billingPeriodUnit: "month" as const,
  },
  "premium-yearly": {
    renewalPrice: 28000, // $280.00 in cents
    billingPeriod: 1,
    billingPeriodUnit: "year" as const,
  },
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify user is authenticated
    const { userId } = await whopsdk.verifyUserToken(await headers());
    
    // Get request body
    const body = await request.json();
    const { planType, companyId, experienceId } = body; // planType: 'premium-monthly' or 'premium-yearly'
    
    if (!planType) {
      return NextResponse.json(
        { error: { message: "Missing planType", type: "bad_request" } },
        { status: 400 }
      );
    }

    // Verify experienceId is provided
    if (!experienceId) {
      return NextResponse.json(
        { error: { message: "Missing experienceId", type: "bad_request" } },
        { status: 400 }
      );
    }

    // Verify user has access to the experience (both customer and admin can create checkouts)
    const access = await whopsdk.users.checkAccess(experienceId, { id: userId });
    
    if (!access.has_access) {
      return NextResponse.json(
        { 
          error: {
            message: "You do not have access to this experience.",
            type: "permission_denied"
          }
        },
        { status: 403 }
      );
    }
    
    // Get company ID that owns the app (biz_XXXXX) - required for checkout configuration
    const appCompanyId = process.env.WHOP_APP_COMPANY_ID;
    
    if (!appCompanyId) {
      return NextResponse.json(
        { 
          error: {
            message: "Company ID is required for checkout. Please set WHOP_APP_COMPANY_ID environment variable.",
            type: "missing_company_id"
          }
        },
        { status: 400 }
      );
    }

    // Validate plan type
    if (planType !== "premium-monthly" && planType !== "premium-yearly") {
      return NextResponse.json(
        { 
          error: {
            message: `Invalid planType: ${planType}. Must be 'premium-monthly' or 'premium-yearly'.`,
            type: "invalid_plan_type"
          }
        },
        { status: 400 }
      );
    }

    // Get pricing configuration for the plan
    const pricing = PRICING[planType as keyof typeof PRICING];
    
    // Validate minimum recurring amount ($1.00 = 100 cents)
    if (pricing.renewalPrice < 100) {
      return NextResponse.json(
        { 
          error: {
            message: "Recurring plan price must be at least $1.00 (100 cents).",
            type: "invalid_price"
          }
        },
        { status: 400 }
      );
    }

    console.log("Creating dynamic checkout configuration:", {
      planType,
      pricing,
      appCompanyId,
      experienceId,
      userId,
    });

    // Create dynamic checkout configuration with plan object
    // Following the recurring plan checklist:
    // - Use cents for all amounts ✓
    // - Set billing period correctly ✓
    // - Plan type must be "renewal" ✓
    // - No initial_price (recurring only) ✓
    const checkoutConfiguration = await whopsdk.checkoutConfigurations.create({
      plan: {
        company_id: appCompanyId, // App owner's company ID (biz_XXXXX)
        initial_price: 0, // No initial fee for recurring plans
        renewal_price: pricing.renewalPrice, // Price in cents per billing cycle
        plan_type: "renewal", // Required for recurring plans
        billing_period: pricing.billingPeriod, // 1
        billing_period_unit: pricing.billingPeriodUnit, // "month" or "year"
      } as any, // Type assertion needed as SDK types may be incomplete
      metadata: {
        user_id: userId,
        plan_type: planType, // 'premium-monthly' or 'premium-yearly'
        company_id: appCompanyId, // App owner's company
        experience_id: experienceId, // The whop company the user is accessing
      },
    });
    
    const checkoutConfig = checkoutConfiguration as any;
    
    console.log("Checkout created successfully:", {
      id: checkoutConfig.id,
      planId: checkoutConfig.plan_id || checkoutConfig.plan?.id,
      plan: checkoutConfig.plan,
    });
    
    // Return checkout ID and plan ID
    if (!checkoutConfig.id) {
      throw new Error("Invalid checkout configuration response: missing checkout ID");
    }
    
    // Extract plan ID from response
    const responsePlanId = checkoutConfig.plan_id || checkoutConfig.plan?.id;
    
    if (!responsePlanId) {
      throw new Error("Invalid checkout configuration response: missing plan ID");
    }
    
    return NextResponse.json({
      checkoutId: checkoutConfig.id,
      planId: responsePlanId,
    });
    
  } catch (error) {
    console.error("Error creating checkout:", error);
    
    // Extract error details
    let errorMessage = "Failed to create checkout";
    let statusCode = 500;
    
    if (error && typeof error === 'object') {
      // Check for Whop SDK error structure
      if ('response' in error) {
        const response = (error as any).response;
        if (response?.status) {
          statusCode = response.status;
        }
        if (response?.data) {
          // Return the error data directly if it's an object
          if (typeof response.data === 'object') {
            return NextResponse.json(response.data, { status: statusCode });
          }
          errorMessage = JSON.stringify(response.data);
        }
      }
      // Check for direct error property
      if ('error' in error && typeof (error as any).error === 'object') {
        return NextResponse.json((error as any).error, { status: statusCode });
      }
      // Check for message property
      if ('message' in error) {
        errorMessage = String((error as any).message);
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        error: {
          message: errorMessage,
          type: "checkout_creation_error"
        }
      },
      { status: statusCode }
    );
  }
}
