import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get("experienceId");
    
    if (!experienceId) {
      return NextResponse.json({ error: "experienceId is required" }, { status: 400 });
    }

    const headersList = await headers();
    const { userId } = await whopsdk.verifyUserToken(headersList);
    const access = await whopsdk.users.checkAccess(experienceId, { id: userId });

    if (!access.has_access) {
      return NextResponse.json({ accessLevel: "none" }, { status: 200 });
    }

    const accessLevel = access.access_level === "admin" ? "owner" : "customer";
    return NextResponse.json({ accessLevel });
  } catch (error) {
    console.error("Error getting access level:", error);
    // Default to customer for development
    return NextResponse.json({ accessLevel: "customer" }, { status: 200 });
  }
}

