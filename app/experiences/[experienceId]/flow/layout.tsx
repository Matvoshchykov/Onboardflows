import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import { redirect } from "next/navigation";

export default async function FlowLayout({
	params,
	children,
}: {
	params: Promise<{ experienceId: string }>;
	children: React.ReactNode;
}) {
	const { experienceId } = await params;
	const { userId } = await whopsdk.verifyUserToken(await headers());
	const access = await whopsdk.users.checkAccess(experienceId, { id: userId });

	if (!access.has_access) {
		redirect(`/experiences/${experienceId}`);
	}

	// If user is admin (team member), redirect them to creation dashboard
	if (access.access_level === "admin") {
		redirect(`/experiences/${experienceId}`);
	}

	// If customer, allow access to flow
	if (access.access_level === "customer") {
		return (
			<>
				<div className="bg-muted/50 border-b border-border px-4 py-2 text-sm">
					<div className="flex items-center gap-4">
						<span className="text-muted-foreground">User ID:</span>
						<span className="font-mono">{userId}</span>
						<span className="text-muted-foreground">Access Level:</span>
						<span className="font-semibold capitalize">{access.access_level}</span>
					</div>
				</div>
				{children}
			</>
		);
	}

	// Fallback - redirect if access level is unexpected
	redirect(`/experiences/${experienceId}`);
}

