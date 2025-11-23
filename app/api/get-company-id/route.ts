import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify user is authenticated
    const { userId } = await whopsdk.verifyUserToken(await headers());
    
    // Get experienceId from query params
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get("experienceId");
    
    if (!experienceId) {
      return NextResponse.json(
        { error: "Missing experienceId" },
        { status: 400 }
      );
    }
    
    // Get access to retrieve company information
    const access = await whopsdk.users.checkAccess(experienceId, { id: userId });
    
    // For checkout, we need the company ID that owns the app (biz_XXXXX)
    // This should be set as an environment variable
    // The experienceId is NOT the same as the company_id for checkout
    const appCompanyId = process.env.WHOP_APP_COMPANY_ID;
    
    if (!appCompanyId) {
      return NextResponse.json(
        { 
          error: "WHOP_APP_COMPANY_ID environment variable is not set. Please set it to your app's company ID (biz_XXXXX)."
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ companyId: appCompanyId });
  } catch (error) {
    console.error("Error getting company ID:", error);
    return NextResponse.json(
      { error: "Failed to get company ID" },
      { status: 500 }
    );
  }
}

