import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { getFlowAnalytics } from "@/lib/db/analytics";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId");
    
    if (!flowId) {
      return NextResponse.json(
        { error: "flowId is required" },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const { userId } = await whopsdk.verifyUserToken(await headers());

    // Get flow nodes from request
    const flowNodesParam = searchParams.get("flowNodes");
    if (!flowNodesParam) {
      return NextResponse.json(
        { error: "flowNodes is required" },
        { status: 400 }
      );
    }

    let flowNodes: Array<{ id: string; title: string }>;
    try {
      flowNodes = JSON.parse(flowNodesParam);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid flowNodes format" },
        { status: 400 }
      );
    }

    const analytics = await getFlowAnalytics(flowId, flowNodes);
    
    return NextResponse.json({ analytics });
  } catch (error) {
    console.error("Error getting flow analytics:", error);
    return NextResponse.json(
      { error: "Failed to get flow analytics" },
      { status: 500 }
    );
  }
}


