"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import type { FlowNode, Flow } from "@/components/flow-builder"
import type { LogicBlock } from "@/components/flow-canvas"
import type { PageComponent } from "@/components/page-editor"
import { PagePreview } from "@/components/page-preview"
import { FlowLoading } from "@/components/flow-loading"

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

  // Load access level
  useEffect(() => {
    async function loadAccessLevel() {
      try {
        const response = await fetch(`/api/get-access-level?experienceId=${experienceId}`)
        const data = await response.json()
        if (data.accessLevel && (data.accessLevel === "owner" || data.accessLevel === "customer")) {
          setAccessLevel(data.accessLevel)
        }
      } catch (error) {
        console.error('Error loading access level:', error)
      }
    }
    loadAccessLevel()
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
    answer: any, 
    allAnswers: Record<string, any>
  ): string | null => {
    if (!flow) return null
    
    if (block.type === "if-else") {
      // For if-else, check if answer matches condition
      const condition = block.config?.condition || ""
      const matches = answer === condition || allAnswers[currentNodeId ?? ''] === condition
      // Return path[0] if true, path[1] if false
      const paths = block.config?.paths || []
      return matches ? (paths[0] || null) : (paths[1] || null)
    }
    
    if (block.type === "multi-path") {
      // For multi-path, match answer (option) index to connection index
      // Get options from previous block
      const previousNode = flow.nodes.find(node => node.connections.includes(block.id))
      if (!previousNode || !previousNode.pageComponents) {
        return block.connections[0] || null
      }
      
      const components = normalizePageComponents(previousNode.pageComponents)
      const questionComponent = components.find(
        comp => ["multiple-choice", "checkbox-multi", "short-answer", "long-answer", "scale-slider"].includes(comp.type)
      )
      if (!questionComponent) {
        return block.connections[0] || null
      }
      const questionOptions = questionComponent.config?.options || []
      
      // Find the index of the selected answer in the options
      const answerIndex = questionOptions.indexOf(answer)
      
      // Route to connection at the same index as the option
      if (answerIndex >= 0 && answerIndex < block.connections.length) {
        return block.connections[answerIndex] || null
      }
      
      // Default to first connection if no match
      return block.connections[0] || null
    }
    
    if (block.type === "score-threshold") {
      // Compare score to threshold
      const score = parseInt(answer) || 0
      const threshold = block.config?.threshold || 0
      // Return path[0] if score >= threshold, path[1] if score < threshold
      const paths = block.config?.paths || []
      return score >= threshold 
        ? (paths[0] || null)
        : (paths[1] || null)
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

    // Check if there's a logic block connected to this node
    const connectedLogicBlock = flow.logicBlocks?.find((lb: LogicBlock) =>
      current.connections.includes(lb.id)
    )

    if (connectedLogicBlock) {
      // Evaluate logic block and route based on result
      if (answer === undefined) {
        // Need answer to proceed through logic block
        return null
      }
      const targetId = evaluateLogicBlock(connectedLogicBlock, answer, { ...userAnswers, [current.id]: answer })
      if (targetId) {
        return flow.nodes.find((n: FlowNode) => n.id === targetId) || null
      }
    }

    // Direct connection to next node (no logic block)
    if (current.connections.length > 0) {
      const nextId = current.connections[0]
      const nextNode = flow.nodes.find((n: FlowNode) => n.id === nextId)
      // Check if it's a logic block
      const isLogicBlock = flow.logicBlocks?.some((lb: LogicBlock) => lb.id === nextId)
      if (!isLogicBlock && nextNode) {
        return nextNode
      }
      // If it's a logic block, we need to evaluate it with the answer
      if (isLogicBlock && answer !== undefined) {
        const logicBlock = flow.logicBlocks?.find((lb: LogicBlock) => lb.id === nextId)
        if (logicBlock) {
          const targetId = evaluateLogicBlock(logicBlock, answer, { ...userAnswers, [current.id]: answer })
          if (targetId) {
            return flow.nodes.find((n: FlowNode) => n.id === targetId) || null
          }
        }
      }
    }

    return null
  }

  const handleAnswerChange = (value: any) => {
    setCurrentAnswer(value)
  }

  const handleNext = () => {
    const nextNode = getNextNode(currentAnswer)
    if (nextNode) {
      setCurrentNodeId(nextNode.id)
      setCurrentAnswer(null)
    } else {
      // Flow complete
      router.push(`/experiences/${experienceId}/complete`)
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
              viewMode="desktop"
              selectedComponent={null}
              onSelectComponent={() => {}}
              onDeleteComponent={() => {}}
              previewMode={true}
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

