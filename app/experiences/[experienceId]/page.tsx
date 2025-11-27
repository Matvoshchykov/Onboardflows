import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import FlowBuilder from "@/components/flow-builder";
import { getUserMembership, upsertUserMembership } from "@/lib/db/memberships";

export default async function ExperiencePage({
	params,
}: {
	params: Promise<{ experienceId: string }>;
}) {
	const { experienceId } = await params;
	const { userId } = await whopsdk.verifyUserToken(await headers());
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

	// Check membership status before loading FlowBuilder
	// Use type assertion to bypass build cache type issues
	let membership = await (getUserMembership as any)(userId);
	if (!membership) {
		membership = await (upsertUserMembership as any)(userId, false);
	}
	const membershipActive = membership?.membership_active || false;

	// If admin (team member), show FlowBuilder (creation dashboard)
	if (access.access_level === "admin") {
		return (
			<div className="flex flex-col h-screen relative">
				<div className="flex-1 overflow-hidden">
					<FlowBuilder 
						isAdmin={true} 
						experienceId={experienceId}
						userId={userId}
						membershipActive={membershipActive}
					/>
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
}
