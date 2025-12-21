import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { upsertUserMembership, type UserMembership } from "@/lib/db/memberships";

export async function POST(request: NextRequest): Promise<Response> {
	try {
		// 1. Read body as text FIRST
		const requestBodyText = await request.text();
		
		// 2. Convert headers to plain object
		const headers = Object.fromEntries(request.headers);
		
		// Debug: Log ALL headers to see what's actually arriving (as suggested by Whop)
		console.log("[WEBHOOK DEBUG] All headers:", headers);
		console.log("[WEBHOOK DEBUG] Body length:", requestBodyText.length);
		
		// Check for webhook headers (Whop uses webhook-signature and webhook-timestamp)
		// SDK should check both webhook-* and svix-* formats automatically
		const webhookSignature = headers['webhook-signature'] || headers['Webhook-Signature'] || headers['WEBHOOK-SIGNATURE'];
		const webhookTimestamp = headers['webhook-timestamp'] || headers['Webhook-Timestamp'] || headers['WEBHOOK-TIMESTAMP'];
		const svixSignature = headers['svix-signature'] || headers['Svix-Signature'] || headers['SVIX-SIGNATURE'];
		const svixTimestamp = headers['svix-timestamp'] || headers['Svix-Timestamp'] || headers['SVIX-TIMESTAMP'];
		
		console.log("[WEBHOOK DEBUG] webhook-signature:", webhookSignature ? 'FOUND' : 'NOT FOUND');
		console.log("[WEBHOOK DEBUG] webhook-timestamp:", webhookTimestamp || 'NOT FOUND');
		console.log("[WEBHOOK DEBUG] svix-signature:", svixSignature ? 'FOUND' : 'NOT FOUND');
		console.log("[WEBHOOK DEBUG] svix-timestamp:", svixTimestamp || 'NOT FOUND');
		console.log("[WEBHOOK DEBUG] Has webhook secret:", !!process.env.WHOP_WEBHOOK_SECRET);
		
		// 3. Unwrap and validate webhook
		// The SDK's unwrap() should automatically check for both webhook-* and svix-* header formats
		let webhookData;
		try {
			webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });
			console.log("[WEBHOOK RECEIVED] Type:", webhookData.type);
			console.log("[WEBHOOK RECEIVED] ID:", (webhookData as any).id);
			console.log("[WEBHOOK DATA]", JSON.stringify(webhookData.data, null, 2));
		} catch (validationError) {
			console.error("[WEBHOOK VALIDATION ERROR]", validationError);
			console.error("[WEBHOOK VALIDATION ERROR] Message:", validationError instanceof Error ? validationError.message : String(validationError));
			console.error("[WEBHOOK VALIDATION ERROR] If headers are missing, check:");
			console.error("  1. Vercel configuration - may be stripping custom headers");
			console.error("  2. SDK version - ensure @whop/sdk supports webhook-* headers");
			console.error("  3. Webhook URL in Whop dashboard matches deployed URL");
			// Return 200 to prevent retries, but log the error
			return new Response("OK", { status: 200 });
		}

		// Handle the webhook event
		if (webhookData.type === "payment.succeeded") {
			console.log("[PAYMENT.SUCCEEDED] Processing payment...");
			// Fire and forget - don't wait for the handler to complete
			handlePaymentSucceeded(webhookData.data).catch(console.error);
		} else if (webhookData.type === "membership.activated") {
			console.log("[MEMBERSHIP.ACTIVATED] Processing membership activation...");
			// Fire and forget - don't wait for the handler to complete
			handleMembershipActivated(webhookData.data).catch(console.error);
		} else if (webhookData.type === "membership.deactivated") {
			console.log("[MEMBERSHIP.DEACTIVATED] Processing membership deactivation...");
			// Fire and forget - don't wait for the handler to complete
			handleMembershipDeactivated(webhookData.data).catch(console.error);
		} else {
			console.log("[WEBHOOK IGNORED] Event type:", webhookData.type);
		}

		// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
		return new Response("OK", { status: 200 });
	} catch (error) {
		console.error("[WEBHOOK ERROR]", error);
		console.error("[WEBHOOK ERROR] Details:", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		// Return 200 to prevent infinite retries
		return new Response("OK", { status: 200 });
	}
}

async function handlePaymentSucceeded(payment: Payment) {
	try {
		console.log("[PAYMENT SUCCEEDED]", JSON.stringify(payment, null, 2));
		
		// Extract data from payment according to webhook format:
		// - payment.user.id or payment.user_id for userId
		// - payment.company.id or payment.company_id for companyId
		// - payment.metadata for custom metadata
		// - payment.id for payment ID
		const userId: string | undefined = (payment as any).user?.id || (payment as any).user_id || (payment as any).customer_id;
		const companyId: string | undefined = (payment as any).company?.id || (payment as any).company_id;
		const paymentId: string | undefined = payment.id || (payment as any).receipt_id;
		const metadata = (payment.metadata || {}) as {
			user_id?: string;
			plan_type?: string;
			company_id?: string;
		};
		
		// Use metadata if available, otherwise use direct fields
		// Explicitly type as string after validation
		const finalUserId: string = metadata.user_id || userId || '';
		const finalCompanyId: string = metadata.company_id || companyId || '';
		const planType: string = metadata.plan_type || "premium-monthly";
		
		console.log("[PAYMENT DATA]", {
			userId: finalUserId,
			companyId: finalCompanyId,
			paymentId,
			planType,
			metadata
		});
		
		// Validate required fields
		if (!finalUserId || !finalCompanyId) {
			console.error("Missing user_id or company_id in payment. Payment object:", payment);
			return;
		}
		
		console.log(`[ACTIVATING MEMBERSHIP] User: ${finalUserId}, Company: ${finalCompanyId}, Plan: ${planType}`);
		
		// Update or create user membership
		// Use type assertion to bypass build cache type issues
		const result = await (upsertUserMembership as any)(
			finalUserId,
			true,
			paymentId,
			planType
		);
		
		if (result) {
			console.log(`[MEMBERSHIP ACTIVATED] User ${finalUserId} for company ${finalCompanyId}, Membership ID: ${result.id}`);
		} else {
			console.error(`[MEMBERSHIP ACTIVATION FAILED] User ${finalUserId} for company ${finalCompanyId}`);
		}
	} catch (error) {
		console.error("Error handling payment succeeded:", error);
	}
}

async function handleMembershipActivated(membership: any) {
	try {
		console.log("[MEMBERSHIP ACTIVATED]", JSON.stringify(membership, null, 2));
		
		// Extract user_id from membership webhook data
		// Membership webhook may have different structure than payment
		const userId: string | undefined = 
			(membership as any).user?.id || 
			(membership as any).user_id || 
			(membership as any).customer_id ||
			(membership as any).member?.id ||
			(membership as any).member_id;
		
		// Extract company_id if available
		const companyId: string | undefined = 
			(membership as any).company?.id || 
			(membership as any).company_id ||
			(membership as any).experience?.id ||
			(membership as any).experience_id;
		
		// Extract plan information if available
		const planId: string | undefined = 
			(membership as any).plan?.id || 
			(membership as any).plan_id;
		
		// Determine plan type from plan_id or metadata
		const metadata = (membership.metadata || {}) as {
			user_id?: string;
			plan_type?: string;
			company_id?: string;
		};
		
		// Use metadata if available, otherwise use direct fields
		const finalUserId: string = metadata.user_id || userId || '';
		const finalCompanyId: string = metadata.company_id || companyId || '';
		
		// Determine plan type - check if it's monthly or yearly based on plan_id or metadata
		let planType: string = metadata.plan_type || "premium-monthly";
		if (planId) {
			// Check for plan IDs: plan_5AkO6N2HzVGnm (monthly) or plan_89uDJIAjz0XFJ (yearly)
			if (planId.includes("monthly") || planId.includes("5AkO6N2HzVGnm")) {
				planType = "premium-monthly";
			} else if (planId.includes("yearly") || planId.includes("89uDJIAjz0XFJ")) {
				planType = "premium-yearly";
			}
		}
		
		console.log("[MEMBERSHIP DATA]", {
			userId: finalUserId,
			companyId: finalCompanyId,
			planId,
			planType,
			metadata,
			rawMembership: membership
		});
		
		// Validate required fields
		if (!finalUserId) {
			console.error("Missing user_id in membership activation. Membership object:", membership);
			return;
		}
		
		console.log(`[ACTIVATING MEMBERSHIP] User: ${finalUserId}, Company: ${finalCompanyId || 'N/A'}, Plan: ${planType}`);
		
		// Update or create user membership - activate it
		// Use type assertion to bypass build cache type issues
		const result = await (upsertUserMembership as any)(
			finalUserId,
			true, // membership_active = true
			planId, // Use plan_id as payment_id if available
			planType
		);
		
		if (result) {
			console.log(`[MEMBERSHIP ACTIVATED] User ${finalUserId} for company ${finalCompanyId || 'N/A'}, Membership ID: ${result.id}`);
		} else {
			console.error(`[MEMBERSHIP ACTIVATION FAILED] User ${finalUserId} for company ${finalCompanyId || 'N/A'}`);
		}
	} catch (error) {
		console.error("Error handling membership activated:", error);
	}
}

async function handleMembershipDeactivated(membership: any) {
	try {
		console.log("[MEMBERSHIP DEACTIVATED]", JSON.stringify(membership, null, 2));
		
		// Extract user_id from membership webhook data
		const userId: string | undefined = 
			(membership as any).user?.id || 
			(membership as any).user_id || 
			(membership as any).customer_id ||
			(membership as any).member?.id ||
			(membership as any).member_id;
		
		// Extract company_id if available
		const companyId: string | undefined = 
			(membership as any).company?.id || 
			(membership as any).company_id ||
			(membership as any).experience?.id ||
			(membership as any).experience_id;
		
		// Extract plan information if available
		const planId: string | undefined = 
			(membership as any).plan?.id || 
			(membership as any).plan_id;
		
		// Determine plan type from plan_id or metadata
		const metadata = (membership.metadata || {}) as {
			user_id?: string;
			plan_type?: string;
			company_id?: string;
		};
		
		// Use metadata if available, otherwise use direct fields
		const finalUserId: string = metadata.user_id || userId || '';
		const finalCompanyId: string = metadata.company_id || companyId || '';
		
		// Determine plan type - check if it's monthly or yearly based on plan_id
		let planType: string = metadata.plan_type || "premium-monthly";
		if (planId) {
			// Check for plan IDs: plan_5AkO6N2HzVGnm (monthly) or plan_89uDJIAjz0XFJ (yearly)
			if (planId.includes("monthly") || planId.includes("5AkO6N2HzVGnm")) {
				planType = "premium-monthly";
			} else if (planId.includes("yearly") || planId.includes("89uDJIAjz0XFJ")) {
				planType = "premium-yearly";
			}
		}
		
		console.log("[MEMBERSHIP DEACTIVATION DATA]", {
			userId: finalUserId,
			companyId: finalCompanyId,
			planId,
			planType,
			metadata,
			rawMembership: membership
		});
		
		// Validate required fields
		if (!finalUserId) {
			console.error("Missing user_id in membership deactivation. Membership object:", membership);
			return;
		}
		
		console.log(`[DEACTIVATING MEMBERSHIP] User: ${finalUserId}, Company: ${finalCompanyId || 'N/A'}, Plan: ${planType}`);
		
		// Update or create user membership - deactivate it
		// Use type assertion to bypass build cache type issues
		const result = await (upsertUserMembership as any)(
			finalUserId,
			false, // membership_active = false
			planId, // Use plan_id as payment_id if available
			planType
		);
		
		if (result) {
			console.log(`[MEMBERSHIP DEACTIVATED] User ${finalUserId} for company ${finalCompanyId || 'N/A'}, Membership ID: ${result.id}`);
		} else {
			console.error(`[MEMBERSHIP DEACTIVATION FAILED] User ${finalUserId} for company ${finalCompanyId || 'N/A'}`);
		}
	} catch (error) {
		console.error("Error handling membership deactivated:", error);
	}
}
