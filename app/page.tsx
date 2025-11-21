import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import FlowBuilder from "@/components/flow-builder"

// Root page - check user access level from token
// Access level is determined by checking if user has admin/creator access
export default async function Home() {
  let isAdmin = false;
  
  try {
    const headersList = await headers();
    const { userId } = await whopsdk.verifyUserToken(headersList);
    
    // Check if user is a creator/owner by checking their companies or user properties
    // If user has companies or is a creator, they should have admin access
    try {
      const user = await whopsdk.users.retrieve(userId);
      
      // Try to check if user has companies (indicating they're a creator)
      // Note: Adjust this based on actual Whop SDK methods available
      try {
        const companies = await (whopsdk.users as any).listCompanies?.(userId) || [];
        if (companies && companies.length > 0) {
          isAdmin = true;
        }
      } catch (e) {
        // If listCompanies doesn't exist, check user properties
        if ((user as any).role === "creator" || (user as any).type === "creator") {
          isAdmin = true;
        }
      }
    } catch (userError) {
      console.error("Error checking user:", userError);
      isAdmin = false;
    }
  } catch (error) {
    // If auth fails, default to customer for security
    console.error("Auth error:", error);
    isAdmin = false;
  }
  
  return <FlowBuilder isAdmin={isAdmin} />
}
