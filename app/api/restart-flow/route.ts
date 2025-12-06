import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { supabase } from "@/lib/supabase";

// Note: This deletes completed sessions to allow restart
// In a production app, you might want to keep historical data
// and instead mark sessions as "restarted" or create a new session type

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Delete all completed sessions for this user and flow to allow restart
    const { error } = await supabase
      .from('flow_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('flow_id', flowId)
      .eq('is_completed', true);

    if (error) {
      console.error('Error deleting completed sessions:', error);
      return NextResponse.json(
        { error: "Failed to restart flow" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restarting flow:", error);
    return NextResponse.json(
      { error: "Failed to restart flow" },
      { status: 500 }
    );
  }
}

