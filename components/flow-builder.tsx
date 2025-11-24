"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
}

export default function FlowBuilder({ isAdmin = false }: FlowBuilderProps = {}) {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showLimitPopup, setShowLimitPopup] = useState(false)
  const [maxFlows, setMaxFlows] = useState(1)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [hasCheckedActiveFlow, setHasCheckedActiveFlow] = useState(false)

  // For non-admin users, redirect to active flow experience
  useEffect(() => {
    if (!isAdmin) {
      async function redirectToActiveFlow() {
        setIsLoading(true)
        try {
          const activeFlow = await getActiveFlow()
          if (activeFlow) {
            router.push(`/experiences/${activeFlow.id}/flow`)
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
  }, [isAdmin, router])

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
    if (!isAdmin) return

    async function loadFlows() {
      setIsLoading(true)
      try {
        const loadedFlows = await loadAllFlows()
        setFlows(loadedFlows)
        if (loadedFlows.length > 0) {
          const firstFlow = loadedFlows[0]
          // If flow doesn't have nodes (minimal data), load full flow
          if (!firstFlow.nodes || firstFlow.nodes.length === 0) {
            const { loadFlow } = await import('@/lib/db/flows')
            const fullFlow = await loadFlow(firstFlow.id)
            if (fullFlow) {
              setSelectedFlow(fullFlow)
              setFlows(loadedFlows.map(f => f.id === fullFlow.id ? fullFlow : f))
            } else {
              setSelectedFlow(firstFlow)
            }
          } else {
            setSelectedFlow(firstFlow)
          }
        } else {
          // No flows found - this is OK, user can create one
          toast.info('No flows found. Create your first flow to get started!')
        }
      } catch (error) {
        console.error('Error loading flows:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load flows from database'
        toast.error(errorMessage, { duration: 8000 })
        
        // Still allow the user to see the UI and try creating a flow
        setFlows([])
      } finally {
        setIsLoading(false)
      }
    }
    loadFlows()
  }, [isAdmin])

  return (
    <div className="flex h-full overflow-hidden bg-background relative">
      <Sidebar 
        flows={flows}
        selectedFlow={selectedFlow}
        onSelectFlow={async (flow) => {
          setSelectedFlow(flow)
          
          // If flow doesn't have nodes (minimal data), load full flow
          if (!flow.nodes || flow.nodes.length === 0) {
            const { loadFlow } = await import('@/lib/db/flows')
            const fullFlow = await loadFlow(flow.id)
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
        />
      </div>

      {showChatModal && (
        <ChatModal 
          onClose={() => setShowChatModal(false)}
          onCreateFlow={async (name: string) => {
            try {
              // Check flow limit before creating
              // Get experienceId from URL
              const pathParts = window.location.pathname.split('/')
              const expId = pathParts[pathParts.indexOf('experiences') + 1]
              
              if (expId) {
                // Get company ID and check membership
                const companyIdResponse = await fetch(`/api/get-company-id?experienceId=${expId}`)
                if (companyIdResponse.ok) {
                  const { companyId } = await companyIdResponse.json()
                  const membershipResponse = await fetch(`/api/check-membership?companyId=${companyId}`)
                  if (membershipResponse.ok) {
                    const { maxFlows: mFlows, membershipActive } = await membershipResponse.json()
                    setMaxFlows(mFlows)
                    // Check if user has reached flow limit
                    if (flows.length >= mFlows) {
                      if (membershipActive) {
                        toast.error("Plan limit reached")
                      } else {
                        toast.error(`You've reached the limit of ${mFlows} flow${mFlows > 1 ? 's' : ''}. Upgrade to Premium for 3 flows.`)
                        // Wait 1 second before showing popup
                        setTimeout(() => {
                          setShowLimitPopup(true)
                        }, 1000)
                      }
                      setShowChatModal(false)
                      return
                    }
                  }
                }
              }
              
              const newFlow = await createFlow(name)
              if (newFlow) {
                setFlows([...flows, newFlow])
                setSelectedFlow(newFlow)
                setShowChatModal(false)
                toast.success('Flow created successfully')
              } else {
                toast.error('Failed to create flow')
              }
            } catch (error) {
              console.error('Error creating flow:', error)
              toast.error(error instanceof Error ? error.message : 'Failed to create flow')
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
