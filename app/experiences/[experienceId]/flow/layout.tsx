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
	const headersList = await headers();
	
	try {
		// Verify user token and check access
		const { userId } = await whopsdk.verifyUserToken(headersList);
		const access = await whopsdk.users.checkAccess(experienceId, { id: userId });

		if (!access.has_access) {
			redirect(`/experiences/${experienceId}`);
		}

		// If user is owner/admin, redirect them to creation dashboard
		if (access.access_level === "admin") {
			redirect(`/experiences/${experienceId}`);
		}

		// If customer, allow access to flow
		return <>{children}</>;
	} catch (error) {
		console.error("Auth error in flow layout:", error);
		// On error, redirect to main experience page
		redirect(`/experiences/${experienceId}`);
	}
}

