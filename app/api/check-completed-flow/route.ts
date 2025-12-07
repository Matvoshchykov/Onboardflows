import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { hasUserCompletedFlow } from "@/lib/db/sessions";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const flowId = searchParams.get("flowId");
    
    if (!userId || !flowId) {
      return NextResponse.json(
        { error: "userId and flowId are required" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const { userId: verifiedUserId } = await whopsdk.verifyUserToken(await headers());
    
    // Ensure the userId matches the authenticated user
    if (userId !== verifiedUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const hasCompleted = await hasUserCompletedFlow(userId, flowId);
    
    return NextResponse.json({ hasCompleted });
  } catch (error) {
    console.error("Error checking completed flow:", error);
    return NextResponse.json(
      { error: "Failed to check completed flow" },
      { status: 500 }
    );
  }
}


