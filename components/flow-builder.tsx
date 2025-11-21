"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { FlowCanvas } from "./flow-canvas"
import { ChatModal } from "./chat-modal"
import { FlowLoading } from "./flow-loading"
import { loadAllFlows, createFlow, saveFlow } from "@/lib/db/flows"
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

export default function FlowBuilder() {
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  // Load flows from database on mount
  useEffect(() => {
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
  }, [])

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
        onGoLive={() => {
          // TODO: Implement go live functionality
          toast.success('Flow is now live!')
        }}
        isLive={false}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <FlowCanvas 
          flow={selectedFlow}
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
          onCreateFlow={async (goal: string) => {
            try {
              const newFlow = await createFlow(goal)
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
