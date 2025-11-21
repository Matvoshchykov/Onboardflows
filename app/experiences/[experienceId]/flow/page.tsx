"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import type { FlowNode, Flow } from "@/components/flow-builder"
import type { LogicBlock } from "@/components/flow-canvas"
import type { PageComponent } from "@/components/page-editor"
import { PagePreview } from "@/components/page-preview"
import { FlowLoading } from "@/components/flow-loading"
import { FlowSuccess } from "@/components/flow-success"
import { startFlowSession, updateSessionStep, completeFlowSession } from "@/lib/db/sessions"
import { saveResponse } from "@/lib/db/responses"
import { trackPathNode } from "@/lib/db/paths"

export default function OnboardingFlowView() {
  const params = useParams()
  const router = useRouter()
  const experienceId = params.experienceId as string
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({})
  const [currentAnswer, setCurrentAnswer] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessLevel, setAccessLevel] = useState<"owner" | "customer">("customer")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load user ID and access level
  useEffect(() => {
    async function loadUserData() {
      try {
        // Load user ID
        const userIdResponse = await fetch('/api/get-user-id')
        const userIdData = await userIdResponse.json()
        if (userIdData.userId) {
          setUserId(userIdData.userId)
        }
        
        // Load access level
        const accessResponse = await fetch(`/api/get-access-level?experienceId=${experienceId}`)
        const accessData = await accessResponse.json()
        if (accessData.accessLevel && (accessData.accessLevel === "owner" || accessData.accessLevel === "customer")) {
          setAccessLevel(accessData.accessLevel)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }
    loadUserData()
  }, [experienceId])

  // Load flow data - in a real app, this would fetch from your data source
  useEffect(() => {
    async function loadFlow() {
      setIsLoading(true)
      try {
        // Try to load from database first
        const { loadFlow } = await import('@/lib/db/flows')
        const dbFlow = await loadFlow(experienceId)
        
        if (dbFlow) {
          setFlow(dbFlow)
          
          // Find first node (no incoming connections)
          const firstNode = dbFlow.nodes.find((node: FlowNode) => {
            // Check if any node connects to this one
            const hasIncoming = dbFlow.nodes.some((n: FlowNode) => 
              n.connections.includes(node.id)
            )
            // Check if any logic block connects to this one
            const hasLogicIncoming = dbFlow.logicBlocks?.some((lb: LogicBlock) =>
              lb.connections.includes(node.id)
            )
            return !hasIncoming && !hasLogicIncoming
          })
          
          if (firstNode) {
            setCurrentNodeId(firstNode.id)
          }
        } else {
          // Fallback to localStorage
          const storedFlow = localStorage.getItem(`flow-${experienceId}`)
          if (storedFlow) {
            const parsedFlow: Flow = JSON.parse(storedFlow)
            setFlow(parsedFlow)
            
            // Find first node (no incoming connections)
            const firstNode = parsedFlow.nodes.find((node: FlowNode) => {
              // Check if any node connects to this one
              const hasIncoming = parsedFlow.nodes.some((n: FlowNode) => 
                n.connections.includes(node.id)
              )
              // Check if any logic block connects to this one
              const hasLogicIncoming = parsedFlow.logicBlocks?.some((lb: LogicBlock) =>
                lb.connections.includes(node.id)
              )
              return !hasIncoming && !hasLogicIncoming
            })
            
            if (firstNode) {
              setCurrentNodeId(firstNode.id)
            }
          }
        }
      } catch (error) {
        console.error('Error loading flow:', error)
        // Fallback to localStorage on error
        const storedFlow = localStorage.getItem(`flow-${experienceId}`)
        if (storedFlow) {
          const parsedFlow: Flow = JSON.parse(storedFlow)
          setFlow(parsedFlow)
          
          // Find first node (no incoming connections)
          const firstNode = parsedFlow.nodes.find((node: FlowNode) => {
            // Check if any node connects to this one
            const hasIncoming = parsedFlow.nodes.some((n: FlowNode) => 
              n.connections.includes(node.id)
            )
            // Check if any logic block connects to this one
            const hasLogicIncoming = parsedFlow.logicBlocks?.some((lb: LogicBlock) =>
              lb.connections.includes(node.id)
            )
            return !hasIncoming && !hasLogicIncoming
          })
          
          if (firstNode) {
            setCurrentNodeId(firstNode.id)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadFlow()
  }, [experienceId])

  const getCurrentNode = (): FlowNode | null => {
    if (!flow || !currentNodeId) return null
    return flow.nodes.find((n: FlowNode) => n.id === currentNodeId) || null
  }

  // Helper function to normalize pageComponents to array format (handles both old and new formats)
  const normalizePageComponents = (pageComponents: any): PageComponent[] => {
    if (!pageComponents) return []
    // If it's already an array, return it
    if (Array.isArray(pageComponents)) return pageComponents
    // If it's the old object format, convert it to array
    if (typeof pageComponents === 'object') {
      const components: PageComponent[] = []
      if (pageComponents.textInstruction) components.push(pageComponents.textInstruction)
      if (pageComponents.displayUpload) components.push(pageComponents.displayUpload)
      if (pageComponents.question) components.push(pageComponents.question)
      return components
    }
    return []
  }

  const getPreviousBlockOptionsForLogic = (logicBlockId: string): string[] => {
    if (!flow) return []
    const sourceNode = flow.nodes.find(node => node.connections.includes(logicBlockId))
    if (!sourceNode || !sourceNode.pageComponents) return []
    const components = normalizePageComponents(sourceNode.pageComponents)
    const questionComponent = components.find(
      comp => ["multiple-choice", "checkbox-multi", "short-answer", "long-answer", "scale-slider"].includes(comp.type)
    )
    if (!questionComponent) return []
    if (["multiple-choice", "checkbox-multi"].includes(questionComponent.type)) {
      return questionComponent.config?.options || []
    }
    return []
  }

  const evaluateLogicBlock = (
    block: LogicBlock, 
    answer: any
  ): string | null => {
    if (!flow) return null
    
    if (block.type === "if-else") {
      // Use conditions array (slots) if available, otherwise fallback to condition string
      const conditionsList = block.config?.conditions || []
      const filledConditions = conditionsList.filter((c: string) => c && c.trim().length > 0)
      const condition = block.config?.condition || filledConditions[0] || ""
      
      // If no conditions specified, default to false path
      if (filledConditions.length === 0 && !condition) {
        return block.connections[1] || block.connections[0] || null
      }
      
      // Check if answer matches ANY condition (OR logic for multiple-choice/checkbox, AND logic otherwise)
      // First, check if previous question is multiple-choice or checkbox-multi
      const sourceNode = flow.nodes.find(node => node.connections.includes(block.id))
      let isMultipleChoice = false
      if (sourceNode) {
        const components = normalizePageComponents(sourceNode.pageComponents)
        const questionComponent = components.find(
          comp => ["multiple-choice", "checkbox-multi"].includes(comp.type)
        )
        isMultipleChoice = questionComponent?.type === "multiple-choice" || questionComponent?.type === "checkbox-multi"
      }
      
      let matches = false
      
      // Use filledConditions if available, otherwise use condition
      const conditionsToCheck = filledConditions.length > 0 ? filledConditions : [condition]
      
      // Handle array answers (checkbox-multi or multiple-choice treated as array)
      if (Array.isArray(answer)) {
        if (isMultipleChoice) {
          // OR logic: match if ANY condition matches ANY answer
          matches = conditionsToCheck.some((cond: string) => {
            const condStr = cond.trim().toLowerCase()
            return answer.some((ans: any) => {
              const answerStr = ans.toString().trim().toLowerCase()
              return answerStr === condStr || answerStr.includes(condStr) || condStr.includes(answerStr)
            })
          })
        } else {
          // AND logic: ALL conditions must match
          matches = conditionsToCheck.every((cond: string) => {
            const condStr = cond.trim().toLowerCase()
            return answer.some((ans: any) => {
              const answerStr = ans.toString().trim().toLowerCase()
              return answerStr === condStr || answerStr.includes(condStr) || condStr.includes(answerStr)
            })
          })
        }
      } 
      // Handle string answers (multiple-choice - treat as array for OR logic)
      else if (typeof answer === 'string') {
        const answerStr = answer.trim().toLowerCase()
        if (isMultipleChoice) {
          // OR logic: match if ANY condition matches
          matches = conditionsToCheck.some((cond: string) => {
            const condStr = cond.trim().toLowerCase()
            return answerStr === condStr || answerStr.includes(condStr) || condStr.includes(answerStr)
          })
        } else {
          // AND logic: ALL conditions must match (convert string to array for comparison)
          matches = conditionsToCheck.every((cond: string) => {
            const condStr = cond.trim().toLowerCase()
            return answerStr === condStr || answerStr.includes(condStr) || condStr.includes(answerStr)
          })
        }
      }
      
      if (matches) {
        return block.connections[0] || null
      } else {
        return block.connections[1] || block.connections[0] || null
      }
    }
    
    if (block.type === "multi-path") {
      const previousNode = flow.nodes.find(node => node.connections.includes(block.id))
      if (!previousNode || !previousNode.pageComponents) {
        return block.connections[0] || null
      }
      
      const components = normalizePageComponents(previousNode.pageComponents)
      const questionComponent = components.find(
        (comp: PageComponent) => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
      )
      if (!questionComponent) {
        return block.connections[0] || null
      }
      
      // Get paths from config (these contain the variable/answer values)
      const paths = block.config?.paths || []
      if (paths.length === 0) {
        // Fallback to matching by option index
        const questionOptions = questionComponent.config?.options || []
        let answerToMatch = answer
        if (Array.isArray(answer) && answer.length > 0) {
          answerToMatch = answer[0]
        }
        const answerIndex = questionOptions.indexOf(answerToMatch)
        if (answerIndex >= 0 && answerIndex < block.connections.length) {
          return block.connections[answerIndex] || null
        }
        return block.connections[0] || null
      }
      
      // Handle array answers (checkbox-multi) - use first selected option
      let answerToMatch = answer
      if (Array.isArray(answer) && answer.length > 0) {
        answerToMatch = answer[0]
      }
      
      // Try to match answer to a path value
      const matchingPathIndex = paths.findIndex((path: string) => {
        if (!path) return false
        const pathStr = path.trim().toLowerCase()
        const answerStr = String(answerToMatch).trim().toLowerCase()
        return pathStr === answerStr || pathStr.includes(answerStr) || answerStr.includes(pathStr)
      })
      
      // If we found a matching path and it has a connection, use it
      if (matchingPathIndex >= 0 && matchingPathIndex < block.connections.length && block.connections[matchingPathIndex]) {
        return block.connections[matchingPathIndex]
      }
      
      // Fallback to first connection
      return block.connections[0] || null
    }
    
    if (block.type === "score-threshold") {
      const threshold = block.config?.threshold ?? 0
      let score = 0
      if (typeof answer === "number") {
        score = answer
      } else if (typeof answer === "string") {
        score = parseInt(answer) || 0
      }
      if (score >= threshold) {
        return block.connections[0] || null
      }
      return block.connections[1] || block.connections[0] || null
    }

    return null
  }

  // Get next node based on current node and answer (same logic as preview flow)
  const getNextNodeFromCurrent = (node: FlowNode, answer?: any): FlowNode | null => {
    if (!flow || !node) return null
    
    // Check if there's a logic block connected to this node
    const connectedLogicBlock = flow.logicBlocks?.find((lb: LogicBlock) =>
      node.connections.includes(lb.id)
    )
    
    if (connectedLogicBlock) {
      // If we have an answer, evaluate the logic block
      if (answer !== undefined && answer !== null) {
        const targetId = evaluateLogicBlock(connectedLogicBlock, answer)
        if (targetId) {
          const targetNode = flow.nodes.find(n => n.id === targetId)
          if (targetNode) {
            return targetNode
          }
        }
      }
      // If no answer yet, or evaluation failed, check if logic block has connections
      if (connectedLogicBlock.connections.length > 0) {
        const firstTargetId = connectedLogicBlock.connections[0]
        const firstTargetNode = flow.nodes.find(n => n.id === firstTargetId)
        if (firstTargetNode) {
          return firstTargetNode
        }
      }
      return null
    }
    
    // Direct connection to next node (no logic block)
    if (node.connections.length > 0) {
      const nextId = node.connections[0]
      // Check if it's a logic block
      const isLogicBlock = flow.logicBlocks?.some((lb: LogicBlock) => lb.id === nextId)
      if (!isLogicBlock) {
        const nextNode = flow.nodes.find(n => n.id === nextId)
        if (nextNode) {
          return nextNode
        }
      } else {
        // If it's a logic block, we need to evaluate it with the answer
        const nextLogicBlock = flow.logicBlocks?.find(lb => lb.id === nextId)
        if (nextLogicBlock) {
          if (answer !== undefined && answer !== null) {
            const targetId = evaluateLogicBlock(nextLogicBlock, answer)
            if (targetId) {
              const targetNode = flow.nodes.find(n => n.id === targetId)
              if (targetNode) {
                return targetNode
              }
            }
          }
          // Fallback to first connection of logic block
          if (nextLogicBlock.connections.length > 0) {
            const firstTargetId = nextLogicBlock.connections[0]
            const firstTargetNode = flow.nodes.find(n => n.id === firstTargetId)
            if (firstTargetNode) {
              return firstTargetNode
            }
          }
        }
      }
    }

    return null
  }

  const getNextNode = (answer?: any): FlowNode | null => {
    const current = getCurrentNode()
    if (!current || !flow) return null

    // Save current answer
    if (answer !== undefined && current) {
      setUserAnswers((prev) => ({ ...prev, [current.id]: answer }))
    }

    // Use the same logic as preview flow
    return getNextNodeFromCurrent(current, answer)
  }

  const handleAnswerChange = (value: any) => {
    setCurrentAnswer(value)
  }

  // Start session when flow loads
  useEffect(() => {
    async function initializeSession() {
      if (!flow || !userId || sessionId) return
      
      try {
        // Start session if flow is active
        const { startFlowSession } = await import('@/lib/db/sessions')
        const session = await startFlowSession(userId, flow.id)
        if (session) {
          setSessionId(session.id)
          // Track first node visit
          if (currentNodeId) {
            const { trackPathNode } = await import('@/lib/db/paths')
            await trackPathNode(session.id, currentNodeId, 0)
          }
        }
      } catch (error) {
        console.error('Error starting session:', error)
      }
    }
    if (flow && userId && currentNodeId && !sessionId) {
      initializeSession()
    }
  }, [flow, userId, currentNodeId, sessionId])

  // Track path and save answers when moving to next node
  useEffect(() => {
    async function trackNavigation() {
      if (!sessionId || !currentNodeId || !flow) return
      
      try {
        // Find current node index in path
        const nodeIndex = flow.nodes.findIndex(n => n.id === currentNodeId)
        if (nodeIndex >= 0) {
          const { trackPathNode } = await import('@/lib/db/paths')
          const { updateSessionStep } = await import('@/lib/db/sessions')
          await trackPathNode(sessionId, currentNodeId, nodeIndex)
          await updateSessionStep(sessionId, nodeIndex)
        }
        
        // Save current answer if exists
        const currentNode = getCurrentNode()
        if (currentNode && currentAnswer !== null && currentAnswer !== undefined) {
          const allComponents = normalizePageComponents(currentNode.pageComponents)
          const questionComponent = allComponents.find(
            comp => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider", "long-answer"].includes(comp.type)
          )
          if (questionComponent) {
            const { saveResponse } = await import('@/lib/db/responses')
            await saveResponse(sessionId, currentNodeId, questionComponent.type, currentAnswer)
          }
        }
      } catch (error) {
        console.error('Error tracking navigation:', error)
      }
    }
    if (currentNodeId && sessionId) {
      trackNavigation()
    }
  }, [currentNodeId, sessionId, currentAnswer, flow])

  const handleNext = async () => {
    const nextNode = getNextNode(currentAnswer)
    if (nextNode) {
      setCurrentNodeId(nextNode.id)
      setCurrentAnswer(null)
    } else {
      // Flow complete - show success message and complete session
      if (sessionId) {
        try {
          const { completeFlowSession } = await import('@/lib/db/sessions')
          await completeFlowSession(sessionId)
        } catch (error) {
          console.error('Error completing session:', error)
        }
      }
      setShowSuccess(true)
    }
  }

  // Show loading screen
  if (isLoading || !flow) {
    return <FlowLoading message="Loading onboarding flow..." />
  }

  const currentNode = getCurrentNode()
  if (!currentNode) {
    return <FlowLoading message="Preparing flow..." />
  }

  // Components are already in order (top to bottom) in the array
  const allComponents = normalizePageComponents(currentNode.pageComponents)
  
  // Find question component if any
  const questionComponent = allComponents.find(
    comp => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
  )
  
  // Non-question components (displayed in PagePreview)
  const components = allComponents.filter(
    comp => !["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
  )
  const needsAnswer = questionComponent && [
    "multiple-choice",
    "checkbox-multi",
    "short-answer",
    "scale-slider"
  ].includes(questionComponent.type)

  const getPrevNode = (): FlowNode | null => {
    if (!flow || !currentNodeId) return null
    // Find nodes that connect to current node
    const prevNode = flow.nodes.find((n: FlowNode) => 
      n.connections.includes(currentNodeId) ||
      (flow.logicBlocks?.some((lb: LogicBlock) => 
        lb.connections.includes(currentNodeId) && n.connections.includes(lb.id)
      ))
    )
    return prevNode || null
  }

  const handlePrev = () => {
    const prevNode = getPrevNode()
    if (prevNode) {
      setCurrentNodeId(prevNode.id)
      setCurrentAnswer(null)
    }
  }

  const hasPrev = getPrevNode() !== null
  const hasNext = getNextNode() !== null

  const isLastPage = !hasNext
  const canProceed = !needsAnswer || currentAnswer !== null

  // Show success message when flow is complete
  if (showSuccess) {
    return <FlowSuccess />
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative py-4 sm:py-8 px-4 overflow-hidden">
      {/* Access Level Display */}
      <div className="absolute top-4 right-4 z-20">
        <span className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-lg shadow-neumorphic-raised">
          {accessLevel === "owner" ? "Owner" : "Customer"}
        </span>
      </div>
      
      {/* Left Arrow - Blue */}
      <button
        onClick={handlePrev}
        disabled={!hasPrev}
        className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#3B82F6' }}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      
      {/* Right Arrow - Green or Checkmark */}
      {isLastPage ? (
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#10b981' }}
        >
          <Check className="w-5 h-5 text-white" />
        </button>
      ) : (
        <button
          onClick={handleNext}
          disabled={!hasNext || !canProceed}
          className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#10b981' }}
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}
      
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center min-h-full">
        <div className="w-full space-y-4 sm:space-y-6" style={{ maxWidth: '840px' }}>
          {/* Display non-question components */}
          {components.length > 0 && (
            <PagePreview
              components={components}
              viewMode={isMobile ? "mobile" : "desktop"}
              selectedComponent={null}
              onSelectComponent={() => {}}
              onDeleteComponent={() => {}}
              previewMode={true}
              isMobile={isMobile}
            />
          )}
          
          {/* Display question component */}
          {needsAnswer && (
            <div className="w-full">
              <div className="relative group rounded-xl p-4 sm:p-6 transition-all bg-card shadow-neumorphic-raised min-h-[150px] sm:min-h-[200px] flex flex-col justify-center">
                <InteractiveQuestionComponent
                  component={questionComponent}
                  value={currentAnswer}
                  onChange={handleAnswerChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InteractiveQuestionComponent({
  component,
  value,
  onChange
}: {
  component: PageComponent
  value: any
  onChange: (value: any) => void
}) {
  const config = component.config

  switch (component.type) {
    case "multiple-choice":
      return (
        <div>
          <h3 className="text-sm font-medium mb-4">{config.title || "Select your answer"}</h3>
          <div className="space-y-2">
            {(config.options || ["Option A", "Option B", "Option C"]).map((option: string, idx: number) => (
              <button
                key={idx}
                onClick={() => onChange(option)}
                className="w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-left"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  value === option 
                    ? 'border-[#22c55e] bg-[#22c55e]' 
                    : 'border-muted-foreground/30 bg-transparent'
                }`}>
                  {value === option && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm flex-1">{option}</span>
              </button>
            ))}
          </div>
        </div>
      )

    case "checkbox-multi":
      const selectedValues = Array.isArray(value) ? value : []
      return (
        <div>
          <h3 className="text-sm font-medium mb-4">{config.title || "Select all that apply"}</h3>
          <div className="space-y-2">
            {(config.options || ["Interest A", "Interest B", "Interest C"]).map((option: string, idx: number) => {
              const isSelected = selectedValues.includes(option)
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (isSelected) {
                      onChange(selectedValues.filter((v: string) => v !== option))
                    } else {
                      onChange([...selectedValues, option])
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg cursor-pointer bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-left"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected 
                      ? 'border-[#22c55e] bg-[#22c55e]' 
                      : 'border-muted-foreground/30 bg-transparent'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm flex-1">{option}</span>
                </button>
              )
            })}
          </div>
        </div>
      )

    case "short-answer":
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder || "Type your answer here..."}
          className="w-full bg-card border-none rounded-xl px-4 py-3 shadow-neumorphic-inset focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case "long-answer":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.placeholder || "Type your answer here..."}
          className="w-full bg-card border-none rounded-xl px-4 py-3 min-h-[120px] resize-none shadow-neumorphic-inset focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )

    case "scale-slider":
      return (
        <div className="px-2">
          <input
            type="range"
            min={config.min || 1}
            max={config.max || 10}
            value={value || config.default || 5}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{config.minLabel || "Beginner"}</span>
            <span className="font-medium">{value || config.default || 5}</span>
            <span>{config.maxLabel || "Expert"}</span>
          </div>
        </div>
      )

    default:
      return null
  }
}

