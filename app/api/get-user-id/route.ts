import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const headersList = await headers();
    const { userId } = await whopsdk.verifyUserToken(headersList);
    return NextResponse.json({ userId });
  } catch (error) {
    console.error("Error getting user ID:", error);
    // Return a temporary user ID for development
    return NextResponse.json({ userId: `temp-${Date.now()}` });
  }
}

