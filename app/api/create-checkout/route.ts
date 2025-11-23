import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";

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
    
    // Get company ID that owns the app (biz_XXXXX)
    // This should be set as an environment variable
    let finalCompanyId = companyId || process.env.WHOP_APP_COMPANY_ID;
    
    if (!finalCompanyId) {
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
    
    // Use static plan IDs instead of creating dynamic plans
    // Monthly plan: $30/month - plan_fRm4hsD3EmxaH
    // Yearly plan: $280/year - plan_2lsaaTulZeLKY
    const planId = planType === "premium-yearly" 
      ? "plan_2lsaaTulZeLKY"  // Yearly plan ($280/year)
      : "plan_fRm4hsD3EmxaH"; // Monthly plan ($30/month)
    
    console.log("Creating checkout configuration with static plan:", {
      planId,
      planType,
      metadata: { user_id: userId, plan_type: planType, company_id: finalCompanyId }
    });
    
    // Create checkout configuration using static plan ID
    const checkoutConfiguration = await whopsdk.checkoutConfigurations.create({
      plan_id: planId, // Use static plan ID instead of creating dynamic plan
      metadata: {
        user_id: userId,
        plan_type: planType,
        company_id: finalCompanyId,
      },
    });
    
    const checkoutConfig = checkoutConfiguration as any;
    
    console.log("Checkout created successfully:", {
      id: checkoutConfig.id,
      planId: checkoutConfig.plan_id || checkoutConfig.plan?.id || planId
    });
    
    // Return checkout ID and plan ID
    if (!checkoutConfig.id) {
      throw new Error("Invalid checkout configuration response: missing checkout ID");
    }
    
    // Use the plan_id from response or fallback to the one we used
    const responsePlanId = checkoutConfig.plan_id || checkoutConfig.plan?.id || planId;
    
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
