"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "./sidebar"
import { FlowCanvas } from "./flow-canvas"
import { ChatModal } from "./chat-modal"
import { FlowLoading } from "./flow-loading"
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
  iconUrl?: string
}

type FlowBuilderProps = {
  isAdmin?: boolean
}

export default function FlowBuilder({ isAdmin = false }: FlowBuilderProps = {}) {
  const router = useRouter()
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
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
        }
      } catch (error) {
        console.error('Error loading flows:', error)
        toast.error('Failed to load flows from database')
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
        onGoLive={async () => {
          if (!selectedFlow) {
            toast.error('Please select a flow first')
            return
          }

          try {
            const newActiveStatus = selectedFlow.status !== 'Live'
            console.log(`Toggling flow ${selectedFlow.id} to active: ${newActiveStatus}`)
            
            const success = await toggleFlowActive(selectedFlow.id, newActiveStatus)
            
            if (success) {
              // Update local state - set selected flow to new status, all others to Draft
              const updatedFlow: Flow = { 
                ...selectedFlow, 
                status: (newActiveStatus ? 'Live' : 'Draft') as "Live" | "Draft" | "Archived"
              }
              setSelectedFlow(updatedFlow)
              setFlows(flows.map(f => {
                if (f.id === updatedFlow.id) {
                  return updatedFlow
                }
                // If setting a flow to active, deactivate all others
                if (newActiveStatus && f.status === 'Live') {
                  return { ...f, status: 'Draft' as const }
                }
                return f
              }))
              
              // Verify the update by reloading the flow
              setTimeout(async () => {
                const { loadFlow } = await import('@/lib/db/flows')
                const reloadedFlow = await loadFlow(selectedFlow.id)
                if (reloadedFlow) {
                  console.log('Reloaded flow status:', reloadedFlow.status, 'Expected:', newActiveStatus ? 'Live' : 'Draft')
                  if (reloadedFlow.status !== (newActiveStatus ? 'Live' : 'Draft')) {
                    console.warn('Flow status mismatch! Database may not have updated correctly.')
                  }
                }
              }, 500)
              
              if (newActiveStatus) {
                toast.success('Flow is now live!')
              } else {
                toast.success('Flow is now offline')
              }
            } else {
              console.error('toggleFlowActive returned false')
              toast.error('Failed to update flow status. Check console for details.')
            }
          } catch (error) {
            console.error('Error toggling flow active:', error)
            if (error instanceof Error) {
              console.error('Error message:', error.message)
            }
            toast.error('Failed to update flow status')
          }
        }}
        isLive={selectedFlow?.status === 'Live'}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <FlowCanvas 
          flow={selectedFlow}
          accessLevel={isAdmin ? "owner" : "customer"}
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
        />
      </div>

      {showChatModal && (
        <ChatModal 
          onClose={() => setShowChatModal(false)}
          onCreateFlow={async (name: string) => {
            try {
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

      {isLoading && (
        <div className="absolute inset-0 z-50">
          <FlowLoading message="Loading flows..." />
        </div>
      )}
    </div>
  )
}
