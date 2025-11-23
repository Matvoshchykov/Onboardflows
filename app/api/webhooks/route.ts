import type { Payment } from "@whop/sdk/resources.js";
import type { NextRequest } from "next/server";
import { whopsdk } from "@/lib/whop-sdk";
import { upsertUserMembership } from "@/lib/db/memberships";

export async function POST(request: NextRequest): Promise<Response> {
	try {
		// Validate the webhook to ensure it's from Whop
		const requestBodyText = await request.text();
		
		// Get all headers - log everything to debug
		const allHeaders: Record<string, string> = {};
		const headerEntries: Array<[string, string]> = [];
		request.headers.forEach((value, key) => {
			allHeaders[key] = value;
			allHeaders[key.toLowerCase()] = value;
			headerEntries.push([key, value]);
		});
		
		// Log ALL headers for debugging
		console.log("[WEBHOOK REQUEST] Received POST request");
		console.log("[WEBHOOK REQUEST] Body length:", requestBodyText.length);
		console.log("[WEBHOOK REQUEST] Body content:", requestBodyText);
		console.log("[WEBHOOK REQUEST] All headers:", JSON.stringify(headerEntries, null, 2));
		
		// Check for headers in various formats and locations
		const webhookSignature = 
			request.headers.get('webhook-signature') ||
			request.headers.get('Webhook-Signature') ||
			request.headers.get('WEBHOOK-SIGNATURE') ||
			request.headers.get('x-webhook-signature') ||
			request.headers.get('X-Webhook-Signature') ||
			allHeaders['webhook-signature'] ||
			allHeaders['Webhook-Signature'] ||
			allHeaders['x-webhook-signature'];
			
		const webhookTimestamp = 
			request.headers.get('webhook-timestamp') ||
			request.headers.get('Webhook-Timestamp') ||
			request.headers.get('WEBHOOK-TIMESTAMP') ||
			request.headers.get('x-webhook-timestamp') ||
			request.headers.get('X-Webhook-Timestamp') ||
			allHeaders['webhook-timestamp'] ||
			allHeaders['Webhook-Timestamp'] ||
			allHeaders['x-webhook-timestamp'];
		
		// Check if headers might be in Vercel's special header
		const vercelScHeaders = request.headers.get('x-vercel-sc-headers');
		if (vercelScHeaders) {
			console.log("[WEBHOOK REQUEST] x-vercel-sc-headers found:", vercelScHeaders);
			try {
				const scHeaders = JSON.parse(vercelScHeaders);
				console.log("[WEBHOOK REQUEST] Parsed sc-headers:", JSON.stringify(scHeaders, null, 2));
				// Merge these headers into our headers object
				Object.entries(scHeaders).forEach(([key, value]) => {
					if (typeof value === 'string') {
						allHeaders[key] = value;
						allHeaders[key.toLowerCase()] = value;
					}
				});
				// Re-check for webhook headers after merging
				if (!webhookSignature) {
					const sig = scHeaders['webhook-signature'] || scHeaders['Webhook-Signature'] || scHeaders['WEBHOOK-SIGNATURE'];
					if (sig) {
						console.log("[WEBHOOK REQUEST] Found webhook-signature in x-vercel-sc-headers");
					}
				}
				if (!webhookTimestamp) {
					const ts = scHeaders['webhook-timestamp'] || scHeaders['Webhook-Timestamp'] || scHeaders['WEBHOOK-TIMESTAMP'];
					if (ts) {
						console.log("[WEBHOOK REQUEST] Found webhook-timestamp in x-vercel-sc-headers");
					}
				}
			} catch (e) {
				console.error("[WEBHOOK REQUEST] Failed to parse x-vercel-sc-headers:", e);
			}
		}
		
		console.log("[WEBHOOK REQUEST] webhook-signature:", webhookSignature || 'NOT FOUND');
		console.log("[WEBHOOK REQUEST] webhook-timestamp:", webhookTimestamp || 'NOT FOUND');
		console.log("[WEBHOOK REQUEST] Has webhook secret:", !!process.env.WHOP_WEBHOOK_SECRET);
		
		// If headers are still missing after checking all locations, log error
		if (!webhookSignature || !webhookTimestamp) {
			console.error("[WEBHOOK ERROR] Missing signature headers after checking all locations");
			console.error("[WEBHOOK ERROR] This should not happen - Whop webhooks should include these headers");
			console.error("[WEBHOOK ERROR] Check Vercel configuration or contact Whop support");
			return new Response("OK", { status: 200 });
		}
		
		// Headers are present, try to unwrap and verify
		let webhookData;
		try {
			webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers: allHeaders });
			console.log("[WEBHOOK RECEIVED]", webhookData.type);
			console.log("[WEBHOOK DATA]", JSON.stringify(webhookData.data, null, 2));
		} catch (validationError) {
			console.error("[WEBHOOK VALIDATION ERROR]", validationError);
			console.error("[WEBHOOK VALIDATION ERROR] Message:", validationError instanceof Error ? validationError.message : String(validationError));
			console.error("[WEBHOOK VALIDATION ERROR] Headers used:", {
				'webhook-signature': webhookSignature,
				'webhook-timestamp': webhookTimestamp
			});
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
