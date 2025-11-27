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
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set())
  const [videoViewingTimes, setVideoViewingTimes] = useState<Record<string, number>>({})
  const [membershipActive, setMembershipActive] = useState(false)
  const [flowLoadError, setFlowLoadError] = useState<string | null>(null)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load user ID and membership status
  useEffect(() => {
    async function loadUserData() {
      try {
        // Load user ID
        const userIdResponse = await fetch('/api/get-user-id')
        const userIdData = await userIdResponse.json()
        if (userIdData.userId) {
          setUserId(userIdData.userId)
          
          // Check membership status
          try {
            const pathParts = window.location.pathname.split('/')
            const expId = pathParts[pathParts.indexOf('experiences') + 1]
            if (expId) {
              const companyIdResponse = await fetch(`/api/get-company-id?experienceId=${expId}`)
              if (companyIdResponse.ok) {
                const { companyId } = await companyIdResponse.json()
                const membershipResponse = await fetch(`/api/check-membership?companyId=${companyId}`)
                if (membershipResponse.ok) {
                  const { membershipActive: active } = await membershipResponse.json()
                  setMembershipActive(active)
                }
              }
            }
          } catch (error) {
            console.error('Error loading membership:', error)
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }
    loadUserData()
  }, [])

  // Load flow data - load active flow (experienceId is not the flow ID)
  useEffect(() => {
    async function loadFlow() {
      setIsLoading(true)
      try {
        // Load the active flow (flows have their own IDs, not experienceId)
        if (!experienceId) {
          console.error('No experienceId provided')
          setIsLoading(false)
          return
        }
        
        console.log('Loading active flow for experienceId:', experienceId)
        const { getActiveFlow } = await import('@/lib/db/flows')
        // Use type assertion to bypass build cache type issues
        const dbFlow = await (getActiveFlow as any)(experienceId)
        
        console.log('Active flow loaded:', dbFlow ? 'Found' : 'Not found', dbFlow)
        
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
          } else if (dbFlow.nodes.length > 0) {
            // Fallback: use first node if no entry node found
            setCurrentNodeId(dbFlow.nodes[0].id)
          }
        } else {
          // No active flow found
          console.error('No active flow found for experienceId:', experienceId)
          setFlowLoadError('No active flow found. Please contact support.')
        }
      } catch (error) {
        console.error('Error loading flow:', error)
        if (error instanceof Error) {
          console.error('Error details:', error.message, error.stack)
          setFlowLoadError(`Error loading flow: ${error.message}`)
        } else {
          setFlowLoadError('Failed to load flow. Please try again later.')
        }
      } finally {
        setIsLoading(false)
      }
    }
    if (experienceId) {
      loadFlow()
    }
  }, [experienceId])

  const getCurrentNode = (): FlowNode | null => {
    if (!flow || !currentNodeId) return null
    return flow.nodes.find((n: FlowNode) => n.id === currentNodeId) || null
  }

  // Helper function to normalize pageComponents to array format (handles both old and new formats)
  const normalizePageComponents = (pageComponents: any): PageComponent[] => {
    if (!pageComponents) return []
    // If it's already an array, return it sorted by order
    if (Array.isArray(pageComponents)) {
      return [...pageComponents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    // If it's the old object format, convert it to array
    if (typeof pageComponents === 'object') {
      const components: PageComponent[] = []
      if (pageComponents.textInstruction) components.push({ ...pageComponents.textInstruction, order: 0 })
      if (pageComponents.displayUpload) components.push({ ...pageComponents.displayUpload, order: 1 })
      if (pageComponents.question) components.push({ ...pageComponents.question, order: 2 })
      return components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
    
    if (block.type === "a-b-test") {
      // Use sessionStorage to persist A/B test decisions per flow session
      // Key format: `ab-test-${flow.id}-${block.id}-${sessionId || 'preview'}`
      const sessionKey = sessionId || 'preview'
      const storageKey = `ab-test-${flow.id}-${block.id}-${sessionKey}`
      
      // Check if we already have a decision for this A/B test in this session
      const storedDecision = sessionStorage.getItem(storageKey)
      
      if (storedDecision !== null) {
        // Use stored decision (persists when going back/forward)
        const pathIndex = parseInt(storedDecision)
        return block.connections[pathIndex] || block.connections[0] || null
      }
      
      // Generate new 50/50 random decision
      const randomValue = Math.random()
      const pathIndex = randomValue < 0.5 ? 0 : 1
      
      // Store decision in sessionStorage for this session
      sessionStorage.setItem(storageKey, pathIndex.toString())
      
      return block.connections[pathIndex] || block.connections[0] || null
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
      // For A/B test, always evaluate even without answer
      if (connectedLogicBlock.type === "a-b-test") {
        const targetId = evaluateLogicBlock(connectedLogicBlock, answer)
        if (targetId) {
          const targetNode = flow.nodes.find(n => n.id === targetId)
          if (targetNode) {
            return targetNode
          }
        }
        return null
      }
      
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
          // For A/B test, always evaluate even without answer
          if (nextLogicBlock.type === "a-b-test") {
            const targetId = evaluateLogicBlock(nextLogicBlock, answer)
            if (targetId) {
              const targetNode = flow.nodes.find(n => n.id === targetId)
              if (targetNode) {
                return targetNode
              }
            }
            return null
          }
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

  // Start session when flow loads (only for premium users)
  useEffect(() => {
    async function initializeSession() {
      if (!flow || !userId || sessionId || !membershipActive) return
      
      try {
        // Clear any previous A/B test decisions for this flow when starting a new session
        // This ensures a fresh 50/50 chance on restart
        if (typeof window !== 'undefined' && flow) {
          const keysToRemove: string[] = []
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i)
            if (key && key.startsWith(`ab-test-${flow.id}-`)) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => sessionStorage.removeItem(key))
        }
        
        // Start session if flow is active and user has premium
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
    if (flow && userId && currentNodeId && !sessionId && membershipActive) {
      initializeSession()
    }
  }, [flow, userId, currentNodeId, sessionId, membershipActive])

  // Track path when moving to next node (but don't save responses here) - only for premium users
  useEffect(() => {
    async function trackNavigation() {
      if (!sessionId || !currentNodeId || !flow || !membershipActive) return
      
      try {
        // Find current node index in path
        const nodeIndex = flow.nodes.findIndex(n => n.id === currentNodeId)
        if (nodeIndex >= 0) {
          const { trackPathNode } = await import('@/lib/db/paths')
          const { updateSessionStep } = await import('@/lib/db/sessions')
          await trackPathNode(sessionId, currentNodeId, nodeIndex)
          await updateSessionStep(sessionId, nodeIndex)
        }
        
        // REMOVED: Don't save responses here - only save when user clicks Next
      } catch (error) {
        console.error('Error tracking navigation:', error)
      }
    }
    if (currentNodeId && sessionId && membershipActive) {
      trackNavigation()
    }
  }, [currentNodeId, sessionId, flow, membershipActive]) // Removed currentAnswer from dependencies

  const handleNext = async () => {
    // Save the answer before moving to next node (only for premium users)
    if (sessionId && currentNodeId && currentAnswer !== null && currentAnswer !== undefined && membershipActive) {
      try {
        const currentNode = getCurrentNode()
        if (currentNode) {
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
        console.error('Error saving response:', error)
      }
    }
    
    const nextNode = getNextNode(currentAnswer)
    if (nextNode) {
      setCurrentNodeId(nextNode.id)
      setCurrentAnswer(null)
      setWatchedVideos(new Set()) // Reset watched videos for new node
    } else {
      // Flow complete - show success message and complete session (only for premium users)
      if (sessionId && membershipActive) {
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
  if (isLoading) {
    return <FlowLoading message="Loading onboarding flow..." />
  }

  if (flowLoadError || !flow) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Flow Not Available</h1>
          <p className="text-muted-foreground mb-6">
            {flowLoadError || "No active onboarding flow found. Please contact support."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentNode = getCurrentNode()
  if (!currentNode) {
    return <FlowLoading message="Preparing flow..." />
  }

  // Components are already in order (top to bottom) in the array
  const allComponents = normalizePageComponents(currentNode.pageComponents)
  
  // Find question component if any (for logic purposes)
  const questionComponent = allComponents.find(
    comp => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
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

  // Check if all required videos are watched
  const requiredVideos = allComponents.filter(
    comp => comp.type === "video-step" && comp.config?.requiredToWatch
  )
  const allRequiredVideosWatched = requiredVideos.every(
    comp => watchedVideos.has(comp.id)
  )

  const isLastPage = !hasNext
  const canProceed = (!needsAnswer || currentAnswer !== null) && allRequiredVideosWatched

  const handleVideoWatched = (componentId: string, watched: boolean) => {
    if (watched) {
      setWatchedVideos(prev => new Set([...prev, componentId]))
    }
  }

  const handleVideoTimeUpdate = async (componentId: string, time: number) => {
    setVideoViewingTimes(prev => ({ ...prev, [componentId]: time }))
    
    // Save video viewing time to database (throttle to avoid too many DB calls)
    if (sessionId && currentNodeId && time > 0) {
      // Only save every 5 seconds to reduce DB load
      const lastSavedTime = videoViewingTimes[componentId] || 0
      if (Math.abs(time - lastSavedTime) >= 5) {
        try {
          // Store video viewing time in responses table
          const { saveResponse } = await import('@/lib/db/responses')
          await saveResponse(sessionId, currentNodeId, 'video-step', { 
            componentId, 
            viewingTime: time,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.error('Error saving video viewing time:', error)
        }
      }
    }
  }

  // Show success message when flow is complete
  if (showSuccess) {
    return <FlowSuccess />
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative py-4 sm:py-8 px-4 overflow-hidden">
      {/* Left Arrow - Blue */}
      <button
        onClick={handlePrev}
        disabled={!hasPrev}
        className={`fixed z-10 p-3 rounded-full shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isMobile 
            ? 'left-4 bottom-4' 
            : 'left-2 sm:left-4 top-1/2 -translate-y-1/2'
        }`}
        style={{ backgroundColor: '#3B82F6' }}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      
      {/* Right Arrow - Green or Checkmark */}
      {isLastPage ? (
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={`fixed z-10 p-3 rounded-full shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isMobile 
              ? 'right-4 bottom-4' 
              : 'right-2 sm:right-4 top-1/2 -translate-y-1/2'
          }`}
          style={{ backgroundColor: '#10b981' }}
        >
          <Check className="w-5 h-5 text-white" />
        </button>
      ) : (
        <button
          onClick={handleNext}
          disabled={!hasNext || !canProceed}
          className={`fixed z-10 p-3 rounded-full shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isMobile 
              ? 'right-4 bottom-4' 
              : 'right-2 sm:right-4 top-1/2 -translate-y-1/2'
          }`}
          style={{ backgroundColor: '#10b981' }}
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}
      
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center min-h-full">
        <div className="w-full flex flex-col" style={{ maxWidth: '840px', gap: '10px' }}>
          {/* Display ALL components in order */}
          {allComponents.map((component, index) => {
            const isQuestion = ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(component.type)
            
            if (isQuestion && needsAnswer) {
              return (
                <div key={component.id} className="w-full">
                  <div className="relative group rounded-xl p-4 sm:p-6 transition-all bg-card shadow-neumorphic-raised flex flex-col justify-center">
                    <InteractiveQuestionComponent
                      component={component}
                      value={currentAnswer}
                      onChange={handleAnswerChange}
                    />
                  </div>
                </div>
              )
            } else {
              return (
                <div key={component.id} className="w-full">
                  <PagePreview
                    components={[component]}
                    viewMode={isMobile ? "mobile" : "desktop"}
                    selectedComponent={null}
                    onSelectComponent={() => {}}
                    onDeleteComponent={() => {}}
                    previewMode={true}
                    isMobile={isMobile}
                    onVideoWatched={handleVideoWatched}
                    onVideoTimeUpdate={handleVideoTimeUpdate}
                  />
                </div>
              )
            }
          })}
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
          {config.title && config.title.trim().length > 0 && (
            <h3 className="text-sm font-medium mb-4">{config.title}</h3>
          )}
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
          {config.title && config.title.trim().length > 0 && (
            <h3 className="text-sm font-medium mb-4">{config.title}</h3>
          )}
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
        <div>
          {config.label && config.label.trim().length > 0 && (
            <label className="block text-xs font-medium mb-2">
              {config.label}
            </label>
          )}
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder || "Type your answer here..."}
            className="w-full bg-card border-none rounded-xl px-4 py-3 shadow-neumorphic-inset focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
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
        <div>
          {config.label && config.label.trim().length > 0 && (
            <label className="block text-sm font-medium mb-2">
              {config.label}
            </label>
          )}
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
              <span>{config.min || 1}</span>
              <span>{config.max || 10}</span>
            </div>
          </div>
        </div>
      )

    default:
      return null
  }
}


