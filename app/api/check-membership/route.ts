import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { getUserMembership, upsertUserMembership } from "@/lib/db/memberships";

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
    
    // Get user membership (user-wide, not per company/experience)
    // Use type assertion to bypass build cache type issues
    let membership = await (getUserMembership as any)(userId);
    
    // If no membership exists, create one with membership_active = false (free plan)
    if (!membership) {
      membership = await upsertUserMembership(userId, false);
    }
    
    if (!membership) {
      return NextResponse.json(
        { error: "Failed to get or create membership" },
        { status: 500 }
      );
    }
    
    // Count flows for this specific experience_id
    const { loadAllFlows } = await import("@/lib/db/flows");
    // Use type assertion to bypass build cache type issues
    const flowsForThisExperience = await (loadAllFlows as any)(experienceId);
    const currentFlowCount = flowsForThisExperience.length;
    
    // Limits are per experience_id
    const membershipActive = membership.membership_active;
    const maxFlows = membershipActive ? 5 : 1;
    const maxBlocksPerFlow = membershipActive ? 30 : 5;
    
    return NextResponse.json({
      membershipActive: membershipActive,
      maxFlows: maxFlows,
      maxBlocksPerFlow: maxBlocksPerFlow,
      currentFlowCount: currentFlowCount,
    });
  } catch (error) {
    console.error("Error checking membership:", error);
    return NextResponse.json(
      { error: "Failed to check membership" },
      { status: 500 }
    );
  }
}

