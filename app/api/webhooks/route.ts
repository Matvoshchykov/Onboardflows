import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { upsertUserMembership } from "@/lib/db/memberships";

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
		const userId = (payment as any).user?.id || (payment as any).user_id || (payment as any).customer_id;
		const companyId = (payment as any).company?.id || (payment as any).company_id;
		const paymentId = payment.id || (payment as any).receipt_id;
		const metadata = (payment.metadata || {}) as {
			user_id?: string;
			plan_type?: string;
			company_id?: string;
		};
		
		// Use metadata if available, otherwise use direct fields
		const finalUserId = metadata.user_id || userId;
		const finalCompanyId = metadata.company_id || companyId;
		const planType = metadata.plan_type || "premium-monthly";
		
		console.log("[PAYMENT DATA]", {
			userId: finalUserId,
			companyId: finalCompanyId,
			paymentId,
			planType,
			metadata
		});
		
		if (!finalUserId || !finalCompanyId) {
			console.error("Missing user_id or company_id in payment. Payment object:", payment);
			return;
		}
		
		console.log(`[ACTIVATING MEMBERSHIP] User: ${finalUserId}, Company: ${finalCompanyId}, Plan: ${planType}`);
		
		// Update or create user membership
		const result = await upsertUserMembership(
			finalUserId,
			true, // membership_active = true
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
