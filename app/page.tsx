import FlowBuilder from "@/components/flow-builder"

// Root page - default to non-admin for security
// Access level should be checked per experience/company, not globally
// Users accessing via /experiences/[experienceId] will have proper admin check
export default function Home() {
  // Default to non-admin - this ensures non-owners are redirected to active flow
  // The FlowBuilder component will handle redirecting to active flow
  // For proper admin access, users should access via /experiences/[experienceId]
  return <FlowBuilder isAdmin={false} />
}
