import { supabase } from "../supabase";

export interface UserMembership {
  id: string;
  user_id: string;
  company_id: string;
  membership_active: boolean;
  payment_id?: string;
  plan_type?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get user membership for a specific company
 */
export async function getUserMembership(
  userId: string,
  companyId: string
): Promise<UserMembership | null> {
  const { data, error } = await supabase
    .from("user_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No membership found
      return null;
    }
    console.error("Error fetching user membership:", error);
    return null;
  }

  return data as UserMembership;
}

/**
 * Create or update user membership
 */
export async function upsertUserMembership(
  userId: string,
  companyId: string,
  membershipActive: boolean,
  paymentId?: string,
  planType?: string
): Promise<UserMembership | null> {
  const { data, error } = await supabase
    .from("user_memberships")
    .upsert(
      {
        user_id: userId,
        company_id: companyId,
        membership_active: membershipActive,
        payment_id: paymentId,
        plan_type: planType,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,company_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting user membership:", error);
    return null;
  }

  return data as UserMembership;
}

/**
 * Get membership limits based on active status
 */
export function getMembershipLimits(membershipActive: boolean): {
  maxFlows: number;
  maxBlocksPerFlow: number;
} {
  if (membershipActive) {
    return {
      maxFlows: 3,
      maxBlocksPerFlow: 30,
    };
  }
  return {
    maxFlows: 1,
    maxBlocksPerFlow: 5,
  };
}

