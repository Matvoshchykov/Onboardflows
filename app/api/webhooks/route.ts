import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { upsertUserMembership } from "@/lib/db/memberships";

export async function POST(request: NextRequest): Promise<Response> {
	try {
		// Validate the webhook to ensure it's from Whop
		const requestBodyText = await request.text();
		const headers = Object.fromEntries(request.headers);
		
		console.log("[WEBHOOK REQUEST] Received POST request");
		console.log("[WEBHOOK REQUEST] Headers:", Object.keys(headers));
		console.log("[WEBHOOK REQUEST] webhook-signature:", headers['webhook-signature'] || headers['Webhook-Signature'] || 'NOT FOUND');
		console.log("[WEBHOOK REQUEST] webhook-timestamp:", headers['webhook-timestamp'] || headers['Webhook-Timestamp'] || 'NOT FOUND');
		
		let webhookData;
		try {
			webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });
			console.log("[WEBHOOK RECEIVED]", webhookData.type);
			console.log("[WEBHOOK DATA]", JSON.stringify(webhookData.data, null, 2));
		} catch (validationError) {
			console.error("[WEBHOOK VALIDATION ERROR]", validationError);
			console.error("[WEBHOOK VALIDATION ERROR] Message:", validationError instanceof Error ? validationError.message : String(validationError));
			// Return 200 to prevent retries, but log the error
			// This might happen with test webhooks or if headers are missing
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
