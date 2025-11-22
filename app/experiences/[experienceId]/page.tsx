import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import FlowBuilder from "@/components/flow-builder";

export default async function ExperiencePage({
	params,
}: {
	params: Promise<{ experienceId: string }>;
}) {
	const { experienceId } = await params;
	
	try {
		// Verify user token - throws on validation failure
		const { userId } = await whopsdk.verifyUserToken(await headers());
		
		// Check access to the experience
		const access = await whopsdk.users.checkAccess(experienceId, { id: userId });

		if (!access.has_access) {
			return (
				<div className="flex flex-col p-8 gap-4">
					<h1 className="text-9">Access denied</h1>
					<p className="text-3 text-gray-10">You do not have access to this experience.</p>
				</div>
			);
		}

		// If customer, redirect to flow page
		if (access.access_level === "customer") {
			const { redirect } = await import("next/navigation");
			redirect(`/experiences/${experienceId}/flow`);
		}

		// If admin (team member), show FlowBuilder (creation dashboard)
		if (access.access_level === "admin") {
			return (
				<div className="flex flex-col h-screen">
					<div className="flex-1 overflow-hidden">
						<FlowBuilder isAdmin={true} />
					</div>
				</div>
			);
		}

		// Fallback for any other access level
		return (
			<div className="flex flex-col p-8 gap-4">
				<h1 className="text-9">Access denied</h1>
				<p className="text-3 text-gray-10">Invalid access level.</p>
			</div>
		);
	} catch (error) {
		// verifyUserToken throws on validation failure
		console.error("Auth error:", error);
		return (
			<div className="flex flex-col p-8 gap-4">
				<h1 className="text-9">Authentication failed</h1>
				<p className="text-3 text-gray-10">Please ensure you are logged in.</p>
			</div>
		);
	}
}
