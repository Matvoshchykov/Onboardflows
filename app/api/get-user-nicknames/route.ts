import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    await whopsdk.verifyUserToken(headersList);
    
    const { userIds } = await request.json();
    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fetch user data from Whop for each user ID
    const userDataMap: Record<string, string> = {};
    
    // Note: Whop SDK might need batch retrieval, for now we'll do individual calls
    // In production, you might want to cache this or use a batch endpoint if available
    for (const userId of userIds) {
      try {
        const user = await whopsdk.users.retrieve(userId);
        userDataMap[userId] = user.name || user.username || `User ${userId.slice(0, 8)}`;
      } catch (error) {
        // If user retrieval fails, use a fallback
        userDataMap[userId] = `User ${userId.slice(0, 8)}`;
      }
    }

    return NextResponse.json({ userDataMap });
  } catch (error) {
    console.error("Error getting user nicknames:", error);
    // Return empty map on error
    return NextResponse.json({ userDataMap: {} });
  }
}

