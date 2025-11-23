import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { upsertUserMembership } from "@/lib/db/memberships";

export async function POST(request: NextRequest): Promise<Response> {
	try {
		// Validate the webhook to ensure it's from Whop
		const requestBodyText = await request.text();
		
		// Get all headers - check both direct access and from entries
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
			// Also add lowercase version for case-insensitive matching
			headers[key.toLowerCase()] = value;
		});
		
		// Also try getting headers directly (in case they're in a different format)
		const webhookSignature = 
			request.headers.get('webhook-signature') ||
			request.headers.get('Webhook-Signature') ||
			request.headers.get('WEBHOOK-SIGNATURE') ||
			headers['webhook-signature'] ||
			headers['Webhook-Signature'];
			
		const webhookTimestamp = 
			request.headers.get('webhook-timestamp') ||
			request.headers.get('Webhook-Timestamp') ||
			request.headers.get('WEBHOOK-TIMESTAMP') ||
			headers['webhook-timestamp'] ||
			headers['Webhook-Timestamp'];
		
		console.log("[WEBHOOK REQUEST] Received POST request");
		console.log("[WEBHOOK REQUEST] Body length:", requestBodyText.length);
		console.log("[WEBHOOK REQUEST] webhook-signature:", webhookSignature || 'NOT FOUND');
		console.log("[WEBHOOK REQUEST] webhook-timestamp:", webhookTimestamp || 'NOT FOUND');
		console.log("[WEBHOOK REQUEST] Has webhook secret:", !!process.env.WHOP_WEBHOOK_SECRET);
		
		// If headers are missing, this might be a test webhook or the headers were stripped
		// Try to parse the body directly to see if it's a valid webhook payload
		if (!webhookSignature || !webhookTimestamp) {
			console.warn("[WEBHOOK WARNING] Missing signature headers - might be a test webhook");
			
			// Try to parse the body as JSON to see if it's a valid webhook payload
			try {
				const bodyJson = JSON.parse(requestBodyText);
				console.log("[WEBHOOK TEST] Body appears to be JSON:", {
					type: bodyJson.type,
					hasData: !!bodyJson.data,
					api_version: bodyJson.api_version
				});
				
				// For test webhooks without signature, we can't verify but we can still process
				// In production, you should only process verified webhooks
				if (process.env.NODE_ENV === 'development' || process.env.ALLOW_UNVERIFIED_WEBHOOKS === 'true') {
					console.warn("[WEBHOOK WARNING] Processing unverified webhook (development/test mode)");
					if (bodyJson.type === "payment.succeeded") {
						handlePaymentSucceeded(bodyJson.data).catch(console.error);
					}
					return new Response("OK", { status: 200 });
				}
			} catch (parseError) {
				console.error("[WEBHOOK ERROR] Failed to parse body as JSON:", parseError);
			}
			
			// Return 200 but don't process if we can't verify
			console.error("[WEBHOOK ERROR] Cannot verify webhook without signature headers");
			return new Response("OK", { status: 200 });
		}
		
		let webhookData;
		try {
			webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });
			console.log("[WEBHOOK RECEIVED]", webhookData.type);
			console.log("[WEBHOOK DATA]", JSON.stringify(webhookData.data, null, 2));
		} catch (validationError) {
			console.error("[WEBHOOK VALIDATION ERROR]", validationError);
			console.error("[WEBHOOK VALIDATION ERROR] Message:", validationError instanceof Error ? validationError.message : String(validationError));
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
