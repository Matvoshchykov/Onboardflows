import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { getUserMembership, upsertUserMembership } from "@/lib/db/memberships";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify user is authenticated
    const { userId } = await whopsdk.verifyUserToken(await headers());
    
    // Get companyId from query params
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json(
        { error: "Missing companyId" },
        { status: 400 }
      );
    }
    
    // Get or create user membership
    let membership = await getUserMembership(userId, companyId);
    
    // If no membership exists, create one with membership_active = false (free plan)
    if (!membership) {
      membership = await upsertUserMembership(userId, companyId, false);
    }
    
    if (!membership) {
      return NextResponse.json(
        { error: "Failed to get or create membership" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      membershipActive: membership.membership_active,
      maxFlows: membership.membership_active ? 3 : 1,
      maxBlocksPerFlow: membership.membership_active ? 30 : 5,
    });
  } catch (error) {
    console.error("Error checking membership:", error);
    return NextResponse.json(
      { error: "Failed to check membership" },
      { status: 500 }
    );
  }
}

