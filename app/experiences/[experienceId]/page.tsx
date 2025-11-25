import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import FlowBuilder from "@/components/flow-builder";
import Link from "next/link";
import { Button } from "@whop/react/components";

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

	// Determine if user can create checkouts (anyone with access can)
	const canCreateCheckout = access.has_access;

	// If customer, redirect to flow page
	if (access.access_level === "customer") {
		const { redirect } = await import("next/navigation");
		redirect(`/experiences/${experienceId}/flow`);
	}

	// If admin (team member), show FlowBuilder (creation dashboard)
	if (access.access_level === "admin") {
		return (
			<div className="flex flex-col h-screen relative">
				{/* Debug Info Bar */}
				<div className="absolute top-0 left-0 right-0 z-50 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs">
					<div className="flex items-center gap-4 flex-wrap">
						<div>
							<span className="font-semibold text-gray-700 dark:text-gray-300">User ID:</span>
							<span className="ml-2 text-gray-600 dark:text-gray-400 font-mono">{userId}</span>
						</div>
						<div>
							<span className="font-semibold text-gray-700 dark:text-gray-300">Company ID:</span>
							<span className="ml-2 text-gray-600 dark:text-gray-400 font-mono">{experienceId}</span>
						</div>
						<div>
							<span className="font-semibold text-gray-700 dark:text-gray-300">Access Level:</span>
							<span className="ml-2 text-gray-600 dark:text-gray-400">{access.access_level || "unknown"}</span>
						</div>
						<div>
							<span className="font-semibold text-gray-700 dark:text-gray-300">Can Create Checkout:</span>
							<span className={`ml-2 font-semibold ${canCreateCheckout ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
								{canCreateCheckout ? "Yes" : "No"}
							</span>
						</div>
					</div>
					<Link href="https://docs.whop.com/apps" target="_blank">
						<Button variant="classic" size="2">
							Developer Docs
						</Button>
					</Link>
				</div>
				<div className="flex-1 overflow-hidden pt-12">
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
}
