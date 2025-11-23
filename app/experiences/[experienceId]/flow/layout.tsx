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
				{/* Subtle user info in bottom-right corner */}
				<div className="fixed bottom-2 right-2 z-50 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 text-[10px] text-muted-foreground font-mono opacity-60 hover:opacity-100 transition-opacity pointer-events-none">
					<div className="flex items-center gap-2">
						<span>{userId.slice(0, 8)}...</span>
						<span className="text-[8px]">•</span>
						<span className="capitalize">{access.access_level}</span>
					</div>
				</div>
				{children}
			</>
		);
	}

	// Fallback - redirect if access level is unexpected
	redirect(`/experiences/${experienceId}`);
}

