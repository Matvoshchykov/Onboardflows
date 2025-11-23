import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { upsertUserMembership } from "@/lib/db/memberships";

export async function POST(request: NextRequest): Promise<Response> {
	// Validate the webhook to ensure it's from Whop
	const requestBodyText = await request.text();
	const headers = Object.fromEntries(request.headers);
	const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });

	console.log("[WEBHOOK RECEIVED]", webhookData.type, webhookData.data);

	// Handle the webhook event
	if (webhookData.type === "payment.succeeded") {
		// Fire and forget - don't wait for the handler to complete
		handlePaymentSucceeded(webhookData.data).catch(console.error);
	}

	// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
	return new Response("OK", { status: 200 });
}

async function handlePaymentSucceeded(payment: Payment) {
	try {
		console.log("[PAYMENT SUCCEEDED]", JSON.stringify(payment, null, 2));
		
		// Extract metadata from the payment
		// Check both payment.metadata and payment.checkout_configuration?.metadata
		const metadata = (payment.metadata || (payment as any).checkout_configuration?.metadata || {}) as {
			user_id?: string;
			plan_type?: string;
			company_id?: string;
		};
		
		console.log("[PAYMENT METADATA]", metadata);
		
		if (!metadata.user_id || !metadata.company_id) {
			console.error("Missing user_id or company_id in payment metadata. Payment object:", payment);
			// Try to get from payment object directly
			const userId = (payment as any).user_id || (payment as any).customer_id;
			const companyId = (payment as any).company_id;
			
			if (userId && companyId) {
				console.log("Using fallback user_id and company_id from payment object");
				await upsertUserMembership(
					userId,
					companyId,
					true,
					(payment as any).receipt_id || (payment as any).id,
					metadata.plan_type || "premium-monthly"
				);
				return;
			}
			return;
		}
		
		const userId = metadata.user_id;
		const companyId = metadata.company_id;
		const planType = metadata.plan_type || "premium-monthly";
		const receiptId = (payment as any).receipt_id || (payment as any).id || payment.id;
		
		console.log(`[ACTIVATING MEMBERSHIP] User: ${userId}, Company: ${companyId}, Plan: ${planType}`);
		
		// Update or create user membership
		const result = await upsertUserMembership(
			userId,
			companyId,
			true, // membership_active = true
			receiptId,
			planType
		);
		
		if (result) {
			console.log(`[MEMBERSHIP ACTIVATED] User ${userId} for company ${companyId}, Membership ID: ${result.id}`);
		} else {
			console.error(`[MEMBERSHIP ACTIVATION FAILED] User ${userId} for company ${companyId}`);
		}
	} catch (error) {
		console.error("Error handling payment succeeded:", error);
	}
}
