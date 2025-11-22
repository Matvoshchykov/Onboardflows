import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import FlowBuilder from "@/components/flow-builder";

export default async function ExperiencePage({
	params,
}: {
	params: Promise<{ experienceId: string }>;
}) {
	const { experienceId } = await params;
	const headersList = await headers();
	
	let accessLevel: string = "unknown";
	
	try {
		// Ensure the user is logged in on whop.
		const { userId } = await whopsdk.verifyUserToken(headersList);
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

		accessLevel = access.access_level === "admin" ? "owner" : "customer";
	} catch (error) {
		// If auth fails, still show UI for development
		console.error("Auth error:", error);
		accessLevel = "owner"; // Default to owner for development
	}

	const isAdmin = accessLevel === "owner";

	// If customer, redirect to flow page
	if (!isAdmin) {
		const { redirect } = await import("next/navigation");
		redirect(`/experiences/${experienceId}/flow`);
	}

	// If owner, show FlowBuilder (creation dashboard)
	return (
		<div className="flex flex-col h-screen">
			<div className="flex-1 overflow-hidden">
				<FlowBuilder isAdmin={true} />
			</div>
		</div>
	);
}
