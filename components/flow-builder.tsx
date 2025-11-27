"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Sidebar } from "./sidebar"
import { FlowCanvas } from "./flow-canvas"
import { ChatModal } from "./chat-modal"
import { FlowLoading } from "./flow-loading"
import { UpgradeModal } from "./upgrade-modal"
import { UpgradeLimitPopup } from "./upgrade-limit-popup"
import { loadAllFlows, createFlow, saveFlow, toggleFlowActive, getActiveFlow } from "@/lib/db/flows"
import { isSupabaseConfigured } from "@/lib/supabase"
import { toast } from "sonner"
import type { PageComponent } from "./page-editor"
import type { LogicBlock } from "./flow-canvas"

export type FlowNode = {
  id: string
  title: string
  components: number
  completion: number
  position: { x: number; y: number }
  connections: string[]
  pageComponents?: PageComponent[] | {
    displayUpload?: PageComponent
    question?: PageComponent
    textInstruction?: PageComponent
  } // Ordered array of components (top to bottom) or legacy object format
}

export type Flow = {
  id: string
  title: string
  dateCreated: string
  status: "Live" | "Draft" | "Archived"
  nodes: FlowNode[]
  logicBlocks?: LogicBlock[]
}

type FlowBuilderProps = {
  isAdmin?: boolean
  experienceId?: string
  userId?: string
  membershipActive?: boolean
}

export default function FlowBuilder({ 
  isAdmin = false, 
  experienceId: propExperienceId,
  userId: propUserId,
  membershipActive: propMembershipActive
}: FlowBuilderProps = {}) {
  const router = useRouter()
  const params = useParams()
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showLimitPopup, setShowLimitPopup] = useState(false)
  const [maxFlows, setMaxFlows] = useState(1)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [hasCheckedActiveFlow, setHasCheckedActiveFlow] = useState(false)
  const [currentExperienceId, setCurrentExperienceId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null)
  const [membershipActive, setMembershipActive] = useState<boolean>(propMembershipActive ?? false)
  
  // Get experienceId from prop or URL params
  useEffect(() => {
    const expId = propExperienceId || (params?.experienceId as string) || null
    setCurrentExperienceId(expId)
  }, [propExperienceId, params])

  // Fetch current user ID if not provided as prop, and sync membership status
  useEffect(() => {
    if (propUserId) {
      setCurrentUserId(propUserId)
      // Always use prop value if provided (from server-side check)
      if (propMembershipActive !== undefined) {
        setMembershipActive(propMembershipActive)
      }
      return
    }
    
    async function fetchUser() {
      try {
        const response = await fetch('/api/get-current-user')
        if (response.ok) {
          const userData = await response.json()
          setCurrentUserId(userData.userId)
          
          // Only fetch membership status if not provided as prop
          if (propMembershipActive === undefined && currentExperienceId) {
            const membershipResponse = await fetch(`/api/check-membership?experienceId=${currentExperienceId}`)
            if (membershipResponse.ok) {
              const membershipData = await membershipResponse.json()
              setMembershipActive(membershipData.membershipActive)
            }
          } else if (propMembershipActive !== undefined) {
            // Use prop value if provided
            setMembershipActive(propMembershipActive)
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }
    fetchUser()
  }, [propUserId, propMembershipActive, currentExperienceId])

  // Sync membership status when prop changes
  useEffect(() => {
    if (propMembershipActive !== undefined) {
      setMembershipActive(propMembershipActive)
    }
  }, [propMembershipActive])

  // For non-admin users, redirect to active flow experience
  useEffect(() => {
    if (!isAdmin && currentExperienceId) {
      async function redirectToActiveFlow() {
        setIsLoading(true)
        try {
          if (!currentExperienceId) return
          // Use type assertion to bypass build cache type issues
          const activeFlow = await (getActiveFlow as any)(currentExperienceId)
          if (activeFlow) {
            router.push(`/experiences/${currentExperienceId}/flow`)
          } else {
            setHasCheckedActiveFlow(true)
          }
        } catch (error) {
          console.error('Error getting active flow:', error)
          setHasCheckedActiveFlow(true)
        } finally {
          setIsLoading(false)
        }
      }
      redirectToActiveFlow()
    }
  }, [isAdmin, router, currentExperienceId])

  // Show message for non-admin users while redirecting or if no active flow
  if (!isAdmin) {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <FlowLoading message="Loading onboarding flow..." />
        </div>
      )
    }
    
    if (hasCheckedActiveFlow) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-2 text-foreground">No Active Flow</h1>
            <p className="text-muted-foreground">There is no active onboarding flow at this time.</p>
          </div>
        </div>
      )
    }
    
    return null
  }

  // Load flows from database on mount (only for admin users)
  useEffect(() => {
    if (!isAdmin || !currentExperienceId) return

    async function loadFlows() {
      setIsLoading(true)
      try {
        if (!currentExperienceId) return
        // Use type assertion to bypass build cache type issues
        const loadedFlows = await (loadAllFlows as any)(currentExperienceId)
        setFlows(loadedFlows)
        if (loadedFlows.length > 0) {
          const firstFlow = loadedFlows[0]
          // If flow doesn't have nodes (minimal data), load full flow
          if ((!firstFlow.nodes || firstFlow.nodes.length === 0) && currentExperienceId) {
            const { loadFlow } = await import('@/lib/db/flows')
            // Use type assertion to bypass build cache type issues
            const fullFlow = await (loadFlow as any)(firstFlow.id, currentExperienceId)
            if (fullFlow) {
              setSelectedFlow(fullFlow)
              setFlows(loadedFlows.map((f: Flow) => f.id === fullFlow.id ? fullFlow : f))
            } else {
              setSelectedFlow(firstFlow)
            }
          } else {
            setSelectedFlow(firstFlow)
          }
        } else {
          // No flows found - this is OK, user can create one
          console.log('No flows found. User can create their first flow.')
        }
      } catch (error) {
        // Only show error for critical issues (like table doesn't exist)
        if (error instanceof Error && error.message.includes('does not exist')) {
          console.error('Error loading flows:', error)
          toast.error(error.message, { duration: 8000 })
        } else {
          // For other errors, just log and continue (loadAllFlows returns empty array)
          console.warn('Could not load flows, but continuing:', error)
        }
        
        // Always allow the user to see the UI and try creating a flow
        setFlows([])
      } finally {
        setIsLoading(false)
      }
    }
    loadFlows()
  }, [isAdmin, currentExperienceId])

  return (
    <div className="flex h-full overflow-hidden bg-background relative">
      <div className="flex-1 flex overflow-hidden">
      <Sidebar 
        flows={flows}
        selectedFlow={selectedFlow}
        onSelectFlow={async (flow) => {
          setSelectedFlow(flow)
          
          // If flow doesn't have nodes (minimal data), load full flow
          if ((!flow.nodes || flow.nodes.length === 0) && currentExperienceId) {
            const { loadFlow } = await import('@/lib/db/flows')
            // Use type assertion to bypass build cache type issues
            const fullFlow = await (loadFlow as any)(flow.id, currentExperienceId)
            if (fullFlow) {
              setSelectedFlow(fullFlow)
              // Update in flows list too
              setFlows(flows.map(f => f.id === fullFlow.id ? fullFlow : f))
            }
          }
        }}
        onCreateFlow={() => setShowChatModal(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <FlowCanvas 
          flow={selectedFlow}
          flows={flows}
          onUpdateFlow={(updatedFlow) => {
            // Update local state only (no auto-save to database)
            setFlows(flows.map(f => f.id === updatedFlow.id ? updatedFlow : f))
            setSelectedFlow(updatedFlow)
          }}
          onSaveToDatabase={async (flowToSave) => {
            // INSTANT: Update UI immediately (optimistic update)
            setFlows(flows.map(f => f.id === flowToSave.id ? flowToSave : f))
            setSelectedFlow(flowToSave)
            toast.success('Flow saved')
            
            // Save to database in background (fire and forget)
            saveFlow(flowToSave).catch((error) => {
              console.error('Background save error:', error)
              toast.error('Failed to save flow to database')
            })
          }}
          experienceId={null} // Will be determined from URL in FlowCanvas
          membershipActive={membershipActive} // Pass membership status to FlowCanvas
        />
      </div>
      </div>

      {showChatModal && (
        <ChatModal 
          onClose={() => setShowChatModal(false)}
          onCreateFlow={async (name: string) => {
            try {
              // Get experienceId and companyId RIGHT BEFORE creating the flow
              const expId = currentExperienceId || propExperienceId || (params?.experienceId as string)
              
              if (!expId) {
                toast.error('Experience ID not found. Cannot create flow.')
                return
              }
              
              // Check flow limit before creating (per experience_id) - always fetch fresh to ensure accuracy
              const membershipResponse = await fetch(`/api/check-membership?experienceId=${expId}`)
              if (membershipResponse.ok) {
                const { maxFlows: mFlows, membershipActive: fetchedMembershipActive, currentFlowCount } = await membershipResponse.json()
                setMaxFlows(mFlows)
                // Sync membership status with fetched value to ensure consistency
                setMembershipActive(fetchedMembershipActive)
                // Check if user has reached flow limit for this experience
                if (currentFlowCount >= mFlows) {
                  if (fetchedMembershipActive) {
                    toast.error("Plan limit reached")
                  } else {
                    toast.error(`You've reached the limit of ${mFlows} flow${mFlows > 1 ? 's' : ''}. Upgrade to Premium for 5 flows.`)
                    setTimeout(() => {
                      setShowLimitPopup(true)
                    }, 1000)
                  }
                  setShowChatModal(false)
                  return
                }
              }
              
              console.log(`Creating flow "${name}" with experienceId: ${expId}`)
              const newFlow = await createFlow(name, expId)
              
              if (newFlow) {
                console.log(`Successfully created flow "${name}" with ID: ${newFlow.id}`)
                setFlows([...flows, newFlow])
                setSelectedFlow(newFlow)
                setShowChatModal(false)
                toast.success('Flow created successfully')
              } else {
                console.error('createFlow returned null')
                toast.error('Failed to create flow: No flow returned')
              }
            } catch (error) {
              console.error('Error creating flow:', error)
              
              // Extract error message
              let errorMessage = 'Failed to create flow'
              if (error instanceof Error) {
                errorMessage = error.message
              } else if (error && typeof error === 'object') {
                // Try to extract message from error object
                const err = error as any
                errorMessage = err.message || err.error || JSON.stringify(error)
              }
              
              console.error('Error details:', {
                error,
                message: errorMessage,
                type: typeof error,
                isError: error instanceof Error
              })
              
              toast.error(errorMessage, { duration: 5000 })
            }
          }}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentPlan="free"
        />
      )}

      {showLimitPopup && (
        <UpgradeLimitPopup
          limitType="flows"
          currentCount={flows.length}
          maxCount={maxFlows}
          onUpgrade={() => {
            setShowLimitPopup(false)
            setShowUpgradeModal(true)
          }}
          onClose={() => setShowLimitPopup(false)}
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 z-50">
          <FlowLoading message="Loading flows..." />
        </div>
      )}
    </div>
  )
}
