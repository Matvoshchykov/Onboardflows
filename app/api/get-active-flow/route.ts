import { NextRequest, NextResponse } from "next/server";
import { getActiveFlow } from "@/lib/db/flows";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get("experienceId");

    if (!experienceId) {
      return NextResponse.json(
        { error: "experienceId is required" },
        { status: 400 }
      );
    }

    const flow = await getActiveFlow(experienceId);
    
    if (!flow) {
      return NextResponse.json(
        { error: "No active flow found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("Error getting active flow:", error);
    return NextResponse.json(
      { error: "Failed to load flow" },
      { status: 500 }
    );
  }
}







