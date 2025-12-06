"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
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
  // Safely extract experienceId with fallback
  const experienceId = (params?.experienceId as string) || null
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({})
  const [currentAnswer, setCurrentAnswer] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.innerWidth < 768 || 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    } catch {
      return false
    }
  })
  const [mounted, setMounted] = useState(false)
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set())
  const [videoViewingTimes, setVideoViewingTimes] = useState<Record<string, number>>({})
  const [membershipActive, setMembershipActive] = useState(false)
  const [flowLoadError, setFlowLoadError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const firstComponentRef = useRef<HTMLDivElement>(null)

  // Set mounted flag on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Detect mobile
  useEffect(() => {
    if (!mounted) return
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [mounted])

  // Load user ID and membership status
  useEffect(() => {
    if (!mounted || !experienceId) return
    async function loadUserData() {
      try {
        // Load user ID
        const userIdResponse = await fetch('/api/get-user-id')
        const userIdData = await userIdResponse.json()
        if (userIdData.userId) {
          setUserId(userIdData.userId)
          
          // Check membership status - use experienceId directly
          try {
            if (experienceId) {
              // Use experienceId directly, not companyId
              const membershipResponse = await fetch(`/api/check-membership?experienceId=${experienceId}`)
              if (membershipResponse.ok) {
                const { membershipActive: active } = await membershipResponse.json()
                setMembershipActive(active)
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
  }, [mounted, experienceId])

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
        // Use API route instead of direct import
        const response = await fetch(`/api/get-active-flow?experienceId=${experienceId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            console.error('No active flow found for experienceId:', experienceId)
            setFlowLoadError('No active flow found. Please contact support.')
          } else {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to load flow: ${response.statusText}`)
          }
          setIsLoading(false)
          return
        }
        
        const { flow: dbFlow } = await response.json()
        console.log('Active flow loaded:', dbFlow ? 'Found' : 'Not found', dbFlow)
        
        if (dbFlow) {
          // Validate flow structure
          if (!dbFlow.nodes || !Array.isArray(dbFlow.nodes)) {
            console.error('Flow has invalid nodes structure:', dbFlow)
            setFlowLoadError('Flow data is invalid. Please contact support.')
            setIsLoading(false)
            return
          }
          
          if (dbFlow.nodes.length === 0) {
            console.error('Flow has no nodes')
            setFlowLoadError('Flow has no pages. Please contact support.')
            setIsLoading(false)
            return
          }
          
          setFlow(dbFlow)
          
          // Find first node (no incoming connections)
          try {
            const firstNode = dbFlow.nodes.find((node: FlowNode) => {
              if (!node || !node.id) return false
              // Check if any node connects to this one
              const hasIncoming = dbFlow.nodes.some((n: FlowNode) => 
                n && n.connections && Array.isArray(n.connections) && n.connections.includes(node.id)
              )
              // Check if any logic block connects to this one
              const hasLogicIncoming = dbFlow.logicBlocks && Array.isArray(dbFlow.logicBlocks)
                ? dbFlow.logicBlocks.some((lb: LogicBlock) =>
                    lb && lb.connections && Array.isArray(lb.connections) && lb.connections.includes(node.id)
                  )
                : false
              return !hasIncoming && !hasLogicIncoming
            })
            
            if (firstNode && firstNode.id) {
              setCurrentNodeId(firstNode.id)
            } else if (dbFlow.nodes.length > 0 && dbFlow.nodes[0] && dbFlow.nodes[0].id) {
              // Fallback: use first node if no entry node found
              setCurrentNodeId(dbFlow.nodes[0].id)
            } else {
              console.error('No valid node found in flow')
              setFlowLoadError('Flow has no valid pages. Please contact support.')
            }
          } catch (error) {
            console.error('Error finding first node:', error)
            // Fallback to first node
            if (dbFlow.nodes[0] && dbFlow.nodes[0].id) {
              setCurrentNodeId(dbFlow.nodes[0].id)
            } else {
              setFlowLoadError('Error processing flow. Please contact support.')
            }
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
    } else {
      setIsLoading(false)
      setFlowLoadError('Experience ID not found')
    }
  }, [experienceId])

  const getCurrentNode = useCallback((): FlowNode | null => {
    try {
      if (!flow || !currentNodeId || !flow.nodes || !Array.isArray(flow.nodes)) return null
      const node = flow.nodes.find((n: FlowNode) => n && n.id === currentNodeId)
      if (!node) {
        console.warn('Current node not found:', currentNodeId, 'Available nodes:', flow.nodes.map(n => n?.id))
        // Fallback to first node if current node not found
        if (flow.nodes.length > 0 && flow.nodes[0]) {
          return flow.nodes[0]
        }
        return null
      }
      return node
    } catch (error) {
      console.error('Error getting current node:', error)
      return null
    }
  }, [flow, currentNodeId])

  // Helper function to normalize pageComponents to array format (handles both old and new formats)
  const normalizePageComponents = (pageComponents: any): PageComponent[] => {
    try {
      if (!pageComponents) return []
      // If it's already an array, return it sorted by order
      if (Array.isArray(pageComponents)) {
        return [...pageComponents]
          .filter(comp => comp && typeof comp === 'object')
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }
      // If it's the old object format, convert it to array
      if (typeof pageComponents === 'object' && pageComponents !== null) {
        const components: PageComponent[] = []
        if (pageComponents.textInstruction && typeof pageComponents.textInstruction === 'object') {
          components.push({ ...pageComponents.textInstruction, order: 0 })
        }
        if (pageComponents.displayUpload && typeof pageComponents.displayUpload === 'object') {
          components.push({ ...pageComponents.displayUpload, order: 1 })
        }
        if (pageComponents.question && typeof pageComponents.question === 'object') {
          components.push({ ...pageComponents.question, order: 2 })
        }
        return components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }
      return []
    } catch (error) {
      console.error('Error normalizing page components:', error)
      return []
    }
  }

  const getPreviousBlockOptionsForLogic = (logicBlockId: string): string[] => {
    try {
      if (!flow || !flow.nodes || !Array.isArray(flow.nodes) || !logicBlockId) return []
      const sourceNode = flow.nodes.find(node => node && node.connections && Array.isArray(node.connections) && node.connections.includes(logicBlockId))
      if (!sourceNode || !sourceNode.pageComponents) return []
      const components = normalizePageComponents(sourceNode.pageComponents)
      if (!Array.isArray(components)) return []
      const questionComponent = components.find(
        comp => comp && comp.type && ["multiple-choice", "checkbox-multi", "short-answer", "long-answer", "scale-slider"].includes(comp.type)
      )
      if (!questionComponent) return []
      if (["multiple-choice", "checkbox-multi"].includes(questionComponent.type)) {
        return Array.isArray(questionComponent.config?.options) ? questionComponent.config.options : []
      }
      return []
    } catch (error) {
      console.error('Error in getPreviousBlockOptionsForLogic:', error)
      return []
    }
  }

  const evaluateLogicBlock = useCallback((
    block: LogicBlock, 
    answer: any
  ): string | null => {
    try {
      if (!flow || !block || !block.type) return null
      if (!block.connections || !Array.isArray(block.connections)) return null
      if (!flow.nodes || !Array.isArray(flow.nodes)) return null
    
    if (block.type === "if-else") {
      // Use conditions array (slots) if available, otherwise fallback to condition string
      const conditionsList = block.config?.conditions || []
      const filledConditions = Array.isArray(conditionsList) ? conditionsList.filter((c: string) => c && c.trim().length > 0) : []
      const condition = block.config?.condition || filledConditions[0] || ""
      
      // If no conditions specified, default to false path
      if (filledConditions.length === 0 && !condition) {
        return block.connections && block.connections.length > 1 ? block.connections[1] : (block.connections && block.connections.length > 0 ? block.connections[0] : null)
      }
      
      // Check if answer matches ANY condition (OR logic for multiple-choice/checkbox, AND logic otherwise)
      // First, check if previous question is multiple-choice or checkbox-multi
      const sourceNode = flow.nodes.find(node => node && node.connections && Array.isArray(node.connections) && node.connections.includes(block.id))
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
        return block.connections && block.connections.length > 0 ? block.connections[0] : null
      } else {
        return block.connections && block.connections.length > 1 ? block.connections[1] : (block.connections && block.connections.length > 0 ? block.connections[0] : null)
      }
    }
    
    if (block.type === "multi-path") {
      const previousNode = flow.nodes.find(node => node && node.connections && Array.isArray(node.connections) && node.connections.includes(block.id))
      if (!previousNode || !previousNode.pageComponents) {
        return block.connections && block.connections.length > 0 ? block.connections[0] : null
      }
      
      const components = normalizePageComponents(previousNode.pageComponents)
      const questionComponent = components.find(
        (comp: PageComponent) => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
      )
      if (!questionComponent) {
        return block.connections && block.connections.length > 0 ? block.connections[0] : null
      }
      
      // Get paths from config (these contain the variable/answer values)
      const paths = Array.isArray(block.config?.paths) ? block.config.paths : []
      if (paths.length === 0) {
        // Fallback to matching by option index
        const questionOptions = Array.isArray(questionComponent.config?.options) ? questionComponent.config.options : []
        let answerToMatch = answer
        if (Array.isArray(answer) && answer.length > 0) {
          answerToMatch = answer[0]
        }
        const answerIndex = questionOptions.indexOf(answerToMatch)
        if (answerIndex >= 0 && block.connections && Array.isArray(block.connections) && answerIndex < block.connections.length) {
          return block.connections[answerIndex] || null
        }
        return block.connections && block.connections.length > 0 ? block.connections[0] : null
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
      if (matchingPathIndex >= 0 && block.connections && Array.isArray(block.connections) && matchingPathIndex < block.connections.length && block.connections[matchingPathIndex]) {
        return block.connections[matchingPathIndex]
      }
      
      // Fallback to first connection
      return block.connections && block.connections.length > 0 ? block.connections[0] : null
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
        return block.connections && block.connections.length > 0 ? block.connections[0] : null
      }
      return block.connections && block.connections.length > 1 ? block.connections[1] : (block.connections && block.connections.length > 0 ? block.connections[0] : null)
    }
    
    if (block.type === "a-b-test") {
      // Use sessionStorage to persist A/B test decisions per flow session
      // Key format: `ab-test-${flow.id}-${block.id}-${sessionId || 'preview'}`
      const sessionKey = sessionId || 'preview'
      const storageKey = `ab-test-${flow.id}-${block.id}-${sessionKey}`
      
      // Check if we already have a decision for this A/B test in this session
      let storedDecision: string | null = null
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          storedDecision = sessionStorage.getItem(storageKey)
        } catch (e) {
          console.error('Error accessing sessionStorage:', e)
        }
      }
      
      if (storedDecision !== null) {
        // Use stored decision (persists when going back/forward)
        const pathIndex = parseInt(storedDecision)
        if (!isNaN(pathIndex) && pathIndex >= 0 && block.connections && Array.isArray(block.connections) && pathIndex < block.connections.length) {
          return block.connections[pathIndex] || (block.connections.length > 0 ? block.connections[0] : null)
        }
      }
      
      // Generate new 50/50 random decision
      const randomValue = Math.random()
      const pathIndex = randomValue < 0.5 ? 0 : 1
      
      // Store decision in sessionStorage for this session
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          sessionStorage.setItem(storageKey, pathIndex.toString())
        } catch (e) {
          console.error('Error setting sessionStorage:', e)
        }
      }
      
      return block.connections && Array.isArray(block.connections) && block.connections.length > pathIndex ? block.connections[pathIndex] : (block.connections && block.connections.length > 0 ? block.connections[0] : null)
    }

    return null
    } catch (error) {
      console.error('Error evaluating logic block:', error)
      return null
    }
  }, [flow, sessionId])

  // Get next node based on current node and answer (same logic as preview flow)
  const getNextNodeFromCurrent = useCallback((node: FlowNode, answer?: any): FlowNode | null => {
    try {
      if (!flow || !node || !flow.nodes || !Array.isArray(flow.nodes)) return null
      if (!node.id) return null
    
      // Check if there's a logic block connected to this node
      const connectedLogicBlock = flow.logicBlocks && Array.isArray(flow.logicBlocks) 
        ? flow.logicBlocks.find((lb: LogicBlock) =>
            lb && lb.id && node.connections && Array.isArray(node.connections) && node.connections.includes(lb.id)
          )
        : null
      
      if (connectedLogicBlock) {
        // For A/B test, always evaluate even without answer
        if (connectedLogicBlock.type === "a-b-test") {
          const targetId = evaluateLogicBlock(connectedLogicBlock, answer)
          if (targetId) {
            const targetNode = flow.nodes.find(n => n && n.id === targetId)
            if (targetNode) {
              return targetNode
            }
          }
          return null
        }
        
        // Evaluate the logic block with the answer (even if null/undefined for A/B tests)
        const targetId = evaluateLogicBlock(connectedLogicBlock, answer)
        if (targetId) {
          const targetNode = flow.nodes.find(n => n && n.id === targetId)
          if (targetNode) {
            return targetNode
          }
        }
        // If evaluation failed, check if logic block has connections as fallback
        if (connectedLogicBlock.connections && Array.isArray(connectedLogicBlock.connections) && connectedLogicBlock.connections.length > 0) {
          const firstTargetId = connectedLogicBlock.connections[0]
          if (firstTargetId) {
            const firstTargetNode = flow.nodes.find(n => n && n.id === firstTargetId)
            if (firstTargetNode) {
              return firstTargetNode
            }
          }
        }
        return null
      }
      
      // Direct connection to next node (no logic block)
      if (node.connections && Array.isArray(node.connections) && node.connections.length > 0) {
        const nextId = node.connections[0]
        if (!nextId) return null
        // Check if it's a logic block
        const isLogicBlock = flow.logicBlocks && Array.isArray(flow.logicBlocks)
          ? flow.logicBlocks.some((lb: LogicBlock) => lb && lb.id === nextId)
          : false
        if (!isLogicBlock) {
          const nextNode = flow.nodes.find(n => n && n.id === nextId)
          if (nextNode) {
            return nextNode
          }
        } else {
          // If it's a logic block, we need to evaluate it with the answer
          const nextLogicBlock = flow.logicBlocks?.find(lb => lb && lb.id === nextId)
          if (nextLogicBlock) {
            // For A/B test, always evaluate even without answer
            // Evaluate the logic block with the answer (even if null/undefined for A/B tests)
            const targetId = evaluateLogicBlock(nextLogicBlock, answer)
            if (targetId) {
              const targetNode = flow.nodes.find(n => n && n.id === targetId)
              if (targetNode) {
                return targetNode
              }
            }
            // Fallback to first connection of logic block if evaluation failed
            if (nextLogicBlock.connections && Array.isArray(nextLogicBlock.connections) && nextLogicBlock.connections.length > 0) {
              const firstTargetId = nextLogicBlock.connections[0]
              if (firstTargetId) {
                const firstTargetNode = flow.nodes.find(n => n && n.id === firstTargetId)
                if (firstTargetNode) {
                  return firstTargetNode
                }
              }
            }
          }
        }
      }

    return null
    } catch (error) {
      console.error('Error in getNextNodeFromCurrent:', error)
      return null
    }
  }, [flow, evaluateLogicBlock])

  const getNextNode = useCallback((answer?: any): FlowNode | null => {
    try {
      const current = getCurrentNode()
      if (!current || !flow) return null

      // Save current answer (even if null/undefined, save it to track state)
      if (current && current.id) {
        setUserAnswers((prev) => ({ ...prev, [current.id]: answer }))
      }

      // Use the same logic as preview flow - always pass answer (even if null/undefined)
      // This ensures logic blocks can evaluate properly (e.g., A/B tests work without answers)
      return getNextNodeFromCurrent(current, answer)
    } catch (error) {
      console.error('Error in getNextNode:', error)
      return null
    }
  }, [getCurrentNode, getNextNodeFromCurrent, flow])

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
        if (typeof window !== 'undefined' && window.sessionStorage && flow) {
          try {
            const keysToRemove: string[] = []
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i)
              if (key && key.startsWith(`ab-test-${flow.id}-`)) {
                keysToRemove.push(key)
              }
            }
            keysToRemove.forEach(key => {
              try {
                sessionStorage.removeItem(key)
              } catch (e) {
                console.error('Error removing sessionStorage key:', e)
              }
            })
          } catch (e) {
            console.error('Error clearing sessionStorage:', e)
          }
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
        if (!flow.nodes || !Array.isArray(flow.nodes)) return
        const nodeIndex = flow.nodes.findIndex(n => n && n.id === currentNodeId)
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

  // Calculate derived values using useMemo to ensure consistent hook order
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const currentNode = useMemo(() => getCurrentNode(), [getCurrentNode])
  
  const allComponents = useMemo(() => {
    if (!currentNode) return []
    try {
      return normalizePageComponents(currentNode?.pageComponents || [])
    } catch (error) {
      console.error('Error normalizing page components:', error)
      return []
    }
  }, [currentNode])
  
  const questionComponent = useMemo(() => {
    return Array.isArray(allComponents) ? allComponents.find(
      comp => comp && comp.type && ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
    ) : null
  }, [allComponents])
  
  const needsAnswer = useMemo(() => {
    return questionComponent && [
      "multiple-choice",
      "checkbox-multi",
      "short-answer",
      "scale-slider"
    ].includes(questionComponent.type)
  }, [questionComponent])

  const getPrevNode = useCallback((): FlowNode | null => {
    try {
      if (!flow || !currentNodeId || !flow.nodes || !Array.isArray(flow.nodes)) return null
      // Find nodes that connect to current node
      const prevNode = flow.nodes.find((n: FlowNode) => {
        if (!n || !n.connections || !Array.isArray(n.connections)) return false
        if (n.connections.includes(currentNodeId)) return true
        // Check if any logic block connects to current node
        if (flow.logicBlocks && Array.isArray(flow.logicBlocks)) {
          return flow.logicBlocks.some((lb: LogicBlock) => 
            lb && lb.connections && Array.isArray(lb.connections) && 
            lb.connections.includes(currentNodeId) && 
            n.connections.includes(lb.id)
          )
        }
        return false
      })
      return prevNode || null
    } catch (error) {
      console.error('Error in getPrevNode:', error)
      return null
    }
  }, [flow, currentNodeId])

  const handlePrev = useCallback(() => {
    const prevNode = getPrevNode()
    if (prevNode) {
      setCurrentNodeId(prevNode.id)
      setCurrentAnswer(null)
    }
  }, [getPrevNode])

  const hasPrev = useMemo(() => getPrevNode() !== null, [getPrevNode])
  const hasNext = useMemo(() => getNextNode() !== null, [getNextNode])

  // Check if all required videos are watched
  const requiredVideos = useMemo(() => {
    return Array.isArray(allComponents) ? allComponents.filter(
      comp => comp && comp.type === "video-step" && comp.config?.requiredToWatch
    ) : []
  }, [allComponents])
  
  const allRequiredVideosWatched = useMemo(() => {
    return requiredVideos.length === 0 || requiredVideos.every(
      comp => comp && comp.id && watchedVideos.has(comp.id)
    )
  }, [requiredVideos, watchedVideos])

  const isLastPage = useMemo(() => !hasNext, [hasNext])
  const canProceed = useMemo(() => {
    return (!needsAnswer || currentAnswer !== null) && allRequiredVideosWatched
  }, [needsAnswer, currentAnswer, allRequiredVideosWatched])

  const handleNext = async () => {
    const currentNode = getCurrentNode()
    if (!currentNode) {
      console.error('No current node found')
      return
    }
    
    console.log('handleNext - Current node:', currentNode.id, currentNode.title)
    console.log('handleNext - Current answer:', currentAnswer)
    console.log('handleNext - Current node connections:', currentNode.connections)
    
    // Save the answer before moving to next node (only for premium users)
    if (sessionId && currentNodeId && currentAnswer !== null && currentAnswer !== undefined && membershipActive) {
      try {
        const allComponents = normalizePageComponents(currentNode.pageComponents)
        if (Array.isArray(allComponents)) {
          const questionComponent = allComponents.find(
            comp => comp && comp.type && ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider", "long-answer"].includes(comp.type)
          )
          if (questionComponent && questionComponent.type) {
            const { saveResponse } = await import('@/lib/db/responses')
            await saveResponse(sessionId, currentNodeId, questionComponent.type, currentAnswer)
          }
        }
      } catch (error) {
        console.error('Error saving response:', error)
      }
    }
    
    // Get next node - always pass answer (even if null/undefined) to allow logic block evaluation
    const nextNode = getNextNode(currentAnswer)
    console.log('handleNext - Next node found:', nextNode ? `${nextNode.id} - ${nextNode.title}` : 'null')
    
    if (nextNode) {
      console.log('handleNext - Moving to next node:', nextNode.id)
      setCurrentNodeId(nextNode.id)
      setCurrentAnswer(null)
      setWatchedVideos(new Set()) // Reset watched videos for new node
    } else {
      console.log('handleNext - No next node found, flow complete')
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
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload()
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  if (!currentNode) {
    return <FlowLoading message="Preparing flow..." />
  }

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

  // Scroll to show first component fully with padding above
  useEffect(() => {
    if (!mounted || !contentRef.current || !firstComponentRef.current) return
    if (typeof window === 'undefined') return
    
    const timeoutId = setTimeout(() => {
      const container = contentRef.current
      const firstComponent = firstComponentRef.current
      if (!container || !firstComponent || typeof window === 'undefined') return
      
      try {
        const componentTop = firstComponent.offsetTop
        const scrollPosition = Math.max(0, componentTop - 40) // 40px padding above
        
        window.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        })
      } catch (error) {
        console.error('Error scrolling:', error)
      }
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [mounted, currentNodeId])

  // Show success message when flow is complete
  if (showSuccess) {
    return <FlowSuccess />
  }

  return (
    <div className="min-h-screen bg-background relative" ref={contentRef}>
      {/* Left Arrow - Blue - Sticky in middle */}
      <button
        onClick={handlePrev}
        disabled={!hasPrev}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#3B82F6' }}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      
      {/* Right Arrow - Green or Checkmark - Sticky in middle */}
      {isLastPage ? (
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#10b981' }}
        >
          <Check className="w-5 h-5 text-white" />
        </button>
      ) : (
        <button
          onClick={handleNext}
          disabled={!hasNext || !canProceed}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#10b981' }}
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}
      
      <div 
        className="w-full flex flex-col items-center justify-center min-h-screen" 
        style={{ 
          paddingLeft: 'clamp(20px, 8vw, 100px)', 
          paddingRight: 'clamp(20px, 8vw, 100px)', 
          paddingTop: '40px', 
          paddingBottom: '40px' 
        }}
      >
        {/* Spacer to allow scrolling up 80px more */}
        <div style={{ height: '80px', width: '100%' }} />
        <div className="w-full flex flex-col" style={{ maxWidth: '840px', gap: '10px' }}>
          {/* Display ALL components in order */}
          {Array.isArray(allComponents) && allComponents.length > 0 ? allComponents.map((component, index) => {
            try {
              if (!component || !component.id || !component.type) {
                console.warn('Invalid component at index', index, component)
                return null
              }
              const isQuestion = ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(component.type)
              const isFirstComponent = index === 0
              
              if (isQuestion && needsAnswer) {
                return (
                  <div key={component.id} ref={isFirstComponent ? firstComponentRef : null} className="w-full">
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
                  <div key={component.id} ref={isFirstComponent ? firstComponentRef : null} className="w-full">
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
            } catch (error) {
              console.error('Error rendering component at index', index, error)
              return (
                <div key={component?.id || `error-${index}`} className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">Error rendering component</p>
                </div>
              )
            }
          }) : (
            <div className="w-full p-8 text-center">
              <p className="text-muted-foreground">No components to display</p>
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
  if (!component || !component.type) {
    return null
  }
  
  const config = component.config || {}

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


