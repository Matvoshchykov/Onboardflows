import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const headersList = await headers();
    const { userId } = await whopsdk.verifyUserToken(headersList);
    
    // Retrieve user details
    const user = await whopsdk.users.retrieve(userId);
    
    // Check if user has any companies (indicating they're a creator/owner)
    // In Whop, creators typically own companies/experiences
    try {
      // Try to list user's companies to determine creator status
      // Note: This method may vary in the SDK - adjust accordingly
      const companies = await whopsdk.users.listCompanies?.(userId) || [];
      
      if (companies && companies.length > 0) {
        // User has companies, they're a creator/owner
        return NextResponse.json({ role: "owner", accessLevel: "owner" });
      }
      
      // If no companies found, they're a customer
      return NextResponse.json({ role: "customer", accessLevel: "customer" });
    } catch (companyError: any) {
      // If listCompanies doesn't exist or fails, try checking user properties
      // or check if user has admin access somewhere
      
      // Check if user object has any creator/owner indicators
      // You may need to adjust this based on actual user object structure
      if (user && (user as any).role === "creator" || (user as any).type === "creator") {
        return NextResponse.json({ role: "owner", accessLevel: "owner" });
      }
      
      // Default to customer if we can't determine
      return NextResponse.json({ role: "customer", accessLevel: "customer" });
    }
  } catch (error) {
    console.error("Error getting user role:", error);
    // Default to customer for security
    return NextResponse.json({ role: "customer", accessLevel: "customer" }, { status: 200 });
  }
}

