import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const headersList = await headers();
    const { userId } = await whopsdk.verifyUserToken(headersList);
    
    return NextResponse.json({ 
      userId
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    return NextResponse.json(
      { error: "Failed to get user information" },
      { status: 500 }
    );
  }
}

