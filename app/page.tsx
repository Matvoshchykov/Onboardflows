import FlowBuilder from "@/components/flow-builder"

// Root page - default to non-admin for security
// Non-owners will be redirected to active flow by FlowBuilder component
// Owners accessing via /experiences/[experienceId] will have proper admin check
export default function Home() {
  // Default to non-admin - this ensures non-owners are redirected
  // The FlowBuilder component will handle redirecting to active flow
  return <FlowBuilder isAdmin={false} />
}
