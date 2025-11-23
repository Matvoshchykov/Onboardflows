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
		return <>{children}</>;
	}

	// Fallback - redirect if access level is unexpected
	redirect(`/experiences/${experienceId}`);
}

