import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";

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
    
    // Get access to retrieve company information
    const access = await whopsdk.users.checkAccess(experienceId, { id: userId });
    
    if (!access.has_access) {
      return NextResponse.json(
        { error: "User does not have access to this experience" },
        { status: 403 }
      );
    }
    
    // Get the actual company_id from the experience using Whop SDK
    const experience = await whopsdk.experiences.retrieve(experienceId);
    const companyId = (experience as any).company_id || (experience as any).company?.id;
    
    if (!companyId) {
      console.error("Experience does not have a company_id:", experience);
      return NextResponse.json(
        { error: "Experience does not have a company_id" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      companyId: companyId,
      experienceId: experienceId
    });
  } catch (error) {
    console.error("Error getting company ID:", error);
    return NextResponse.json(
      { error: "Failed to get company ID" },
      { status: 500 }
    );
  }
}

