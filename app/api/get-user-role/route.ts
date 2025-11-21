import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const headersList = await headers();
    const { userId } = await whopsdk.verifyUserToken(headersList);
    
    // Retrieve user details
    const user = await whopsdk.users.retrieve(userId);
    
    // Note: Access level should be checked per experience/company, not globally
    // The listCompanies method doesn't exist in the Whop SDK
    // For proper admin access checking, use checkAccess per experience/company
    // This endpoint returns customer by default for security
    
    // Default to customer for security - actual role should be checked per experience/company
    return NextResponse.json({ role: "customer", accessLevel: "customer" }, { status: 200 });
  } catch (error) {
    console.error("Error getting user role:", error);
    // Default to customer for security
    return NextResponse.json({ role: "customer", accessLevel: "customer" }, { status: 200 });
  }
}
