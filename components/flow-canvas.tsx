"use client"

import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect, memo } from "react"
import { clearFlowCache } from "@/lib/db/flows"
import { Plus, Upload, X, Play, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, Eye, Check, Minus, AlertTriangle, Mail } from 'lucide-react'
import { toast } from "sonner"
import { toggleFlowActive } from "@/lib/db/flows"
import { useTheme } from "./theme-provider"
import type { Flow, FlowNode } from "./flow-builder"
import { LogicBlockLibrary } from "./logic-block-library"
import { PagePreview } from "./page-preview"
import { FlowAnalytics } from "./flow-analytics"

import type { PageComponent, ComponentType } from "./page-editor"
import { startFlowSession, updateSessionStep, completeFlowSession } from "@/lib/db/sessions"
import { saveResponse } from "@/lib/db/responses"
import { trackPathNode } from "@/lib/db/paths"
import { supabase } from "@/lib/supabase"
import { deleteComponentFiles } from "@/lib/utils"
import { deleteNodeResponses } from "@/lib/db/responses"
import { deleteNodePaths } from "@/lib/db/paths"
import { useRouter } from "next/navigation"
import { UploadFlowModal } from "./upload-flow-modal"
import { UpgradeModal } from "./upgrade-modal"
import { UpgradeLimitPopup } from "./upgrade-limit-popup"
import { TierInfo } from "./tier-info"
import { FlowNodeComponent } from "./flow-node"

type PortPoint = { x: number; y: number }

// Flow block colors - same as analytics for consistency


export type LogicBlock = {
  id: string
  type: "if-else" | "multi-path" | "score-threshold" | "a-b-test"
  position: { x: number; y: number }
  connections: string[]
  config?: {
    condition?: string
    conditions?: string[] // List of condition slots for if-else
    routes?: { answer: string; targetId: string }[]
    threshold?: number
    paths?: string[]
  }
}

type FlowCanvasProps = {
  flow: Flow | null
  onUpdateFlow: (flow: Flow) => void
  onSaveToDatabase?: (flow: Flow) => Promise<void>
  experienceId?: string | null
  flows?: Flow[]
  membershipActive?: boolean // Pass membership status from parent
}

// Helper function to normalize pageComponents to array format (handles both old and new formats)
function normalizePageComponents(pageComponents: any): PageComponent[] {
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

export function FlowCanvas({ flow, onUpdateFlow, onSaveToDatabase, experienceId, flows = [], membershipActive: propMembershipActive }: FlowCanvasProps) {
  const [viewMode, setViewMode] = useState<"create" | "analytics">("create")
  const router = useRouter()
  const { theme } = useTheme()
  const [flowTitle, setFlowTitle] = useState(flow?.title || "Untitled Flow")
  const [lastSavedFlow, setLastSavedFlow] = useState<Flow | null>(flow || null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showLimitPopup, setShowLimitPopup] = useState(false)
  const [limitPopupType, setLimitPopupType] = useState<"blocks" | "flows">("blocks")
  const [limitPopupCount, setLimitPopupCount] = useState({ current: 0, max: 0 })
  const [currentPlan, setCurrentPlan] = useState<"free" | "premium-monthly" | "premium-yearly">("free")
  const [membershipActive, setMembershipActive] = useState(false)
  const [maxFlows, setMaxFlows] = useState(1)
  const [maxBlocksPerFlow, setMaxBlocksPerFlow] = useState(5)
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [suggestionText, setSuggestionText] = useState("")
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const addBlockButtonRef = useRef<HTMLButtonElement>(null)
  
  // Load membership status - use prop if provided, otherwise fetch
  useEffect(() => {
    // If membership status is provided as prop, use it
    if (propMembershipActive !== undefined) {
      setMembershipActive(propMembershipActive)
      // Still need to fetch limits
      async function fetchLimits() {
        try {
          let expId = experienceId
          if (!expId) {
            const pathParts = window.location.pathname.split('/')
            expId = pathParts[pathParts.indexOf('experiences') + 1]
          }
          if (!expId) return
          
          const membershipResponse = await fetch(`/api/check-membership?experienceId=${expId}`)
          if (membershipResponse.ok) {
            const { maxFlows: mFlows, maxBlocksPerFlow: mBlocks } = await membershipResponse.json()
            setMaxFlows(mFlows)
            setMaxBlocksPerFlow(mBlocks)
            setCurrentPlan(propMembershipActive ? "premium-monthly" : "free")
          }
        } catch (error) {
          console.error("Error loading membership limits:", error)
        }
      }
      fetchLimits()
      return
    }
    
    // Otherwise fetch membership status
    async function loadMembership() {
      try {
        // Get experienceId from URL or prop
        let expId = experienceId
        if (!expId) {
          const pathParts = window.location.pathname.split('/')
          expId = pathParts[pathParts.indexOf('experiences') + 1]
        }
        if (!expId) return
        
        // Check membership (per experience_id)
        const membershipResponse = await fetch(`/api/check-membership?experienceId=${expId}`)
        if (membershipResponse.ok) {
          const { membershipActive: active, maxFlows: mFlows, maxBlocksPerFlow: mBlocks } = await membershipResponse.json()
          setMembershipActive(active)
          setMaxFlows(mFlows)
          setMaxBlocksPerFlow(mBlocks)
          // Update currentPlan based on membership
          setCurrentPlan(active ? "premium-monthly" : "free")
        }
      } catch (error) {
        console.error("Error loading membership:", error)
      }
    }
    loadMembership()
  }, [experienceId, propMembershipActive])
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartNodePosRef = useRef<{ x: number; y: number } | null>(null)
  const dragCanvasStateRef = useRef<{ offset: { x: number; y: number }, zoom: number, rect: DOMRect | null } | null>(null)
  const pendingDragNodeIdRef = useRef<string | null>(null)
  const pendingDragLogicIdRef = useRef<string | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const autoConnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hoveredPortRef = useRef<{ nodeId: string; portType?: string; portIndex?: number } | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [connectionLineEnd, setConnectionLineEnd] = useState<{ x: number; y: number } | null>(null)
  const [logicBlocks, setLogicBlocks] = useState<LogicBlock[]>(flow?.logicBlocks || [])
  const [isLogicLibraryExpanded, setIsLogicLibraryExpanded] = useState(false)
  const [draggingLogicId, setDraggingLogicId] = useState<string | null>(null)
  const [draggingLogicType, setDraggingLogicType] = useState<LogicBlock['type'] | null>(null)
  const [dragCursorPosition, setDragCursorPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedLogicId, setSelectedLogicId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const hasCenteredFlowRef = useRef<string | null>(null)
  const [plusClickTimer, setPlusClickTimer] = useState<number | null>(null)
  const [connectingPortIndex, setConnectingPortIndex] = useState<number | undefined>(undefined)
  const [connectionLineStart, setConnectionLineStart] = useState<{ x: number; y: number } | null>(null)
  const [showConditionOptions, setShowConditionOptions] = useState<Record<string, boolean>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [previewNodeIndex, setPreviewNodeIndex] = useState(0)
  const [previewClickedNodeId, setPreviewClickedNodeId] = useState<string | null>(null)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>(() => {
    // Initialize from localStorage (temporary database)
    if (typeof window !== 'undefined' && flow) {
      const stored = localStorage.getItem(`preview-answers-${flow.id}`)
      return stored ? JSON.parse(stored) : {}
    }
    return {}
  })
  const [draggingVariable, setDraggingVariable] = useState<{ value: string; blockId: string } | null>(null)
  const [dragVariablePosition, setDragVariablePosition] = useState({ x: 0, y: 0 })
  const [showVariableDropdown, setShowVariableDropdown] = useState<Record<string, boolean>>({})
  const [logicBlockSizes, setLogicBlockSizes] = useState<Record<string, number>>({})
  const [logicBlockPortPositions, setLogicBlockPortPositions] = useState<Record<string, { input?: PortPoint; outputs: Array<PortPoint | undefined> }>>({})
  const [flowNodePortPositions, setFlowNodePortPositions] = useState<Record<string, { input: PortPoint; output: PortPoint }>>({})
  const [flowNodeSizes, setFlowNodeSizes] = useState<Record<string, number>>({})
  const [lastCreatedBlockId, setLastCreatedBlockId] = useState<string | null>(null)
  const [showLogicLibrary, setShowLogicLibrary] = useState(true)
  const [showComponentLibraryForNode, setShowComponentLibraryForNode] = useState<string | null>(null)
  const [collapsedComponents, setCollapsedComponents] = useState<Record<string, boolean>>({})
  const [isLive, setIsLive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingNodeTitle, setEditingNodeTitle] = useState<string | null>(null)
  const [editingNodeTitleValue, setEditingNodeTitleValue] = useState<string>("")
  const [deleteHistory, setDeleteHistory] = useState<Array<{ nodeId: string; component: PageComponent; index: number }>>([])
  const deleteHistoryRef = useRef<Array<{ nodeId: string; component: PageComponent; index: number }>>([])
  const flowRef = useRef<Flow | null>(flow)
  const onUpdateFlowRef = useRef(onUpdateFlow)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ nodeId: string; nodeTitle: string } | null>(null)
  const dragAnimationFrameRef = useRef<number | null>(null)
  
  // Mobile touch gesture state
  const [isMobile, setIsMobile] = useState(false)
  const touchStateRef = useRef<{
    touches: Map<number, { x: number; y: number }>
    lastDistance: number | null
    lastCenter: { x: number; y: number } | null
    isPanning: boolean
  }>({
    touches: new Map(),
    lastDistance: null,
    lastCenter: null,
    isPanning: false
  })
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  

  // Sync logicBlocks with flow when it changes
  useEffect(() => {
    if (flow?.logicBlocks) {
      setLogicBlocks(flow.logicBlocks)
    } else if (flow && !flow.logicBlocks) {
      setLogicBlocks([])
    }
    // Reset centering flag when flow changes
    if (flow?.id !== hasCenteredFlowRef.current) {
      hasCenteredFlowRef.current = null
    }
  }, [flow?.logicBlocks, flow?.id])

  // Keep refs in sync with state for undo handler
  useEffect(() => {
    deleteHistoryRef.current = deleteHistory
  }, [deleteHistory])

  useEffect(() => {
    flowRef.current = flow
  }, [flow])

  useEffect(() => {
    onUpdateFlowRef.current = onUpdateFlow
  }, [onUpdateFlow])

  // Initialize lastSavedFlow when flow loads
  useEffect(() => {
    if (flow && !lastSavedFlow) {
      const flowWithCollapsed = {
        ...flow,
        collapsedComponents: (flow as any).collapsedComponents || collapsedComponents
      }
      setLastSavedFlow(JSON.parse(JSON.stringify(flowWithCollapsed))) // Deep copy
    }
  }, [flow, lastSavedFlow, collapsedComponents])

  // Initialize collapsedComponents from flow when it loads
  useEffect(() => {
    if (flow && (flow as any).collapsedComponents) {
      setCollapsedComponents((flow as any).collapsedComponents)
    }
  }, [flow?.id])

  // Center flow when it first loads and zoom out to fit
  useEffect(() => {
    if (!flow || !canvasRef.current) return
    
    // Only center once per flow
    if (hasCenteredFlowRef.current === flow.id) return
    
    const nodes = flow.nodes || []
    const blocks = logicBlocks || []
    
    if (nodes.length === 0 && blocks.length === 0) return
    
    // Wait a bit for DOM to measure node/block sizes
    const timeoutId = setTimeout(() => {
      if (!canvasRef.current) return
      
      // Calculate bounds of all nodes and logic blocks
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      
      // Node dimensions: 300px width, height varies but we'll use a default
      const nodeWidth = 300
      const nodeHeight = 150 // Default height estimate
      
      nodes.forEach(node => {
        const nodeMinX = node.position.x
        const nodeMinY = node.position.y
        const nodeMaxX = node.position.x + nodeWidth
        const nodeMaxY = node.position.y + (flowNodeSizes[node.id] || nodeHeight)
        
        minX = Math.min(minX, nodeMinX)
        minY = Math.min(minY, nodeMinY)
        maxX = Math.max(maxX, nodeMaxX)
        maxY = Math.max(maxY, nodeMaxY)
      })
      
      // Logic block dimensions: estimated 160px width, height varies
      const blockWidth = 160
      const blockHeight = 100 // Default height estimate
      
      blocks.forEach(block => {
        const blockMinX = block.position.x
        const blockMinY = block.position.y
        const blockMaxX = block.position.x + blockWidth
        const blockMaxY = block.position.y + (logicBlockSizes[block.id] || blockHeight)
        
        minX = Math.min(minX, blockMinX)
        minY = Math.min(minY, blockMinY)
        maxX = Math.max(maxX, blockMaxX)
        maxY = Math.max(maxY, blockMaxY)
      })
      
      // Add padding
      const padding = 100
      minX -= padding
      minY -= padding
      maxX += padding
      maxY += padding
      
      // Calculate bounds dimensions
      const boundsWidth = maxX - minX
      const boundsHeight = maxY - minY
      
      // Calculate center of bounds
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      
      // Get canvas dimensions
      const rect = canvasRef.current.getBoundingClientRect()
      const canvasWidth = rect.width
      const canvasHeight = rect.height
      
      // Calculate zoom to fit the flow with padding
      const zoomX = (canvasWidth * 0.8) / boundsWidth
      const zoomY = (canvasHeight * 0.8) / boundsHeight
      const fitZoom = Math.min(zoomX, zoomY, 1) // Don't zoom in, only out
      
      // Set zoom first
      setZoom(fitZoom)
      
      // Center the flow on the canvas with the new zoom
      const newOffsetX = canvasWidth / 2 - centerX * fitZoom
      const newOffsetY = canvasHeight / 2 - centerY * fitZoom
      
      setCanvasOffset({ x: newOffsetX, y: newOffsetY })
      hasCenteredFlowRef.current = flow.id
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [flow?.id, flow?.nodes.length, logicBlocks.length, flowNodeSizes, logicBlockSizes])

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!flow || !lastSavedFlow) return false
    
    // Compare flow objects
    const flowChanged = JSON.stringify(flow) !== JSON.stringify(lastSavedFlow)
    
    // Compare collapsedComponents state
    const lastSavedCollapsed = (lastSavedFlow as any).collapsedComponents || {}
    const collapsedChanged = JSON.stringify(collapsedComponents) !== JSON.stringify(lastSavedCollapsed)
    
    return flowChanged || collapsedChanged
  }, [flow, lastSavedFlow, collapsedComponents])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-variable-dropdown]')) {
        setShowVariableDropdown({})
      }
      if (!target.closest('[data-component-library-dropdown]')) {
        setShowComponentLibraryForNode(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Logic library always visible - no longer hide based on scroll

  // Update flow when logicBlocks change
  const handleLogicBlocksUpdate = (updatedLogicBlocks: LogicBlock[]) => {
    setLogicBlocks(updatedLogicBlocks)
    if (flow) {
      onUpdateFlow({ ...flow, logicBlocks: updatedLogicBlocks })
    }
  }

  // Sync flowTitle when flow changes
  useEffect(() => {
    if (flow?.title && flow.title !== flowTitle) {
      setFlowTitle(flow.title)
    }
  }, [flow?.title, flowTitle])

  // Auto-fill multi-path blocks with 6 paths from the start
  useEffect(() => {
    if (!flow || logicBlocks.length === 0) return

    const updatedBlocks = logicBlocks.map((block) => {
      if (block.type === "multi-path") {
        const paths = block.config?.paths || []
        // Initialize with 6 paths if not set or less than 6
        if (paths.length === 0) {
          return { ...block, config: { ...block.config, paths: Array(6).fill('') } }
        } else if (paths.length < 6) {
          return { ...block, config: { ...block.config, paths: [...paths, ...Array(6 - paths.length).fill('')] } }
        }
      }
      return block
    })
    
    // Only update if something changed
    const hasChanges = updatedBlocks.some((block, idx) => {
      const original = logicBlocks[idx]
      if (!original) return false
      return JSON.stringify(block.config?.paths) !== JSON.stringify(original.config?.paths)
    })
    
    if (hasChanges) {
      handleLogicBlocksUpdate(updatedBlocks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.id, logicBlocks.length]) // Only run when flow changes or blocks are added/removed
  
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: (screenX - rect.left - canvasOffset.x) / zoom,
      y: (screenY - rect.top - canvasOffset.y) / zoom
    }
  }, [canvasOffset, zoom])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    // Only start dragging on left mouse button
    if (e.button !== 0) return
    
    e.stopPropagation()
    e.preventDefault()
    
    if (!flow) return
    const node = flow.nodes.find(n => n.id === nodeId)
    if (!node) return
    
    setSelectedNodeId(nodeId)
    setSelectedLogicId(null) // Deselect logic block if flow node is selected
    
    // Capture canvas offset at drag start - CRITICAL to prevent jolting
    // But we'll use CURRENT zoom during drag so block stays under mouse at any zoom level
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    dragCanvasStateRef.current = {
      offset: { x: canvasOffset.x, y: canvasOffset.y },
      zoom: zoom, // Store for reference, but we'll use current zoom during drag
      rect: rect
    }
    
    // Calculate offset in world coordinates (zoom-independent)
    const screenX = e.clientX
    const screenY = e.clientY
    const worldX = (screenX - rect.left - canvasOffset.x) / zoom
    const worldY = (screenY - rect.top - canvasOffset.y) / zoom
    
    dragOffsetRef.current = {
      x: worldX - node.position.x,
      y: worldY - node.position.y
    }
    dragStartNodePosRef.current = { x: node.position.x, y: node.position.y }
    dragStartPosRef.current = { x: screenX, y: screenY }
    
    // Initialize last mouse position to current position
    lastMousePosRef.current = { x: screenX, y: screenY }
    
    // Start dragging immediately - block should stick to mouse
    pendingDragNodeIdRef.current = nodeId
    setDraggingNodeId(nodeId)
  }, [flow, canvasOffset, zoom])

  // Global mouse move handler for dragging logic blocks from library
  useEffect(() => {
    if (!draggingLogicType) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setDragCursorPosition({ x: e.clientX, y: e.clientY })
    }

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (draggingLogicType && canvasRef.current) {
        // Check block limit - enforce strictly
        if (flow) {
          const totalBlocks = flow.nodes.length + (flow.logicBlocks?.length || 0)
          if (totalBlocks >= maxBlocksPerFlow) {
            if (membershipActive) {
              toast.error("Plan limit reached")
            } else {
              toast.error(`You've reached the limit of ${maxBlocksPerFlow} blocks per flow. Upgrade to Premium for 30 blocks per flow.`)
              // Wait 1 second before showing popup
              setTimeout(() => {
                setLimitPopupType("blocks")
                setLimitPopupCount({ current: totalBlocks, max: maxBlocksPerFlow })
                setShowLimitPopup(true)
              }, 1000)
            }
            setDraggingLogicType(null)
            return
          }
        }
        
        const rect = canvasRef.current.getBoundingClientRect()
        const worldPos = {
          x: (e.clientX - rect.left - canvasOffset.x) / zoom,
          y: (e.clientY - rect.top - canvasOffset.y) / zoom
        }
        const newLogicBlock: LogicBlock = {
          id: `logic-${Date.now()}`,
          type: draggingLogicType,
          position: worldPos,
          connections: [],
          config: draggingLogicType === "multi-path" ? { paths: Array(6).fill('') } : {}
        }
        setLastCreatedBlockId(newLogicBlock.id)
        handleLogicBlocksUpdate([...logicBlocks, newLogicBlock])
        setDraggingLogicType(null)
        setSelectedNodeId(null) // Deselect after drop
      }
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggingLogicType, logicBlocks, handleLogicBlocksUpdate, canvasOffset, zoom, flow, maxBlocksPerFlow, membershipActive])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is editing text in a component
      const activeElement = document.activeElement
      const isEditing = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
      
      if (e.key === 'Backspace' && !isEditing) {
        if (selectedNodeId && flow) {
          const nodeToDelete = flow.nodes.find(n => n.id === selectedNodeId)
          if (nodeToDelete) {
            // Show confirmation popup
            setShowDeleteConfirm({ nodeId: selectedNodeId, nodeTitle: nodeToDelete.title })
          }
        }
        if (selectedLogicId && flow) {
          const blockToDelete = logicBlocks.find(b => b.id === selectedLogicId)
          if (blockToDelete) {
            // Remove all connections TO this block from flow nodes
            const updatedNodes = flow.nodes.map(n => ({
              ...n,
              connections: n.connections.filter(id => id !== selectedLogicId)
            }))
            // Remove all connections TO this block from other logic blocks
            const updatedLogicBlocks = logicBlocks
              .filter(b => b.id !== selectedLogicId)
              .map(b => ({
                ...b,
                connections: b.connections.filter(id => id !== selectedLogicId)
              }))
            handleLogicBlocksUpdate(updatedLogicBlocks)
            onUpdateFlow({ ...flow, nodes: updatedNodes })
            // Update lastCreatedBlockId if deleted block was the last created
            if (lastCreatedBlockId === selectedLogicId) {
              setLastCreatedBlockId(null)
            }
            setSelectedLogicId(null)
          }
        }
      }
      if (e.key === 'Escape' && connectingFrom) {
        setConnectingFrom(null)
        setConnectionLineEnd(null)
        setConnectingPortIndex(undefined)
        setConnectionLineStart(null)
        clearConnectionState()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeId, selectedLogicId, connectingFrom, flow, onUpdateFlow, logicBlocks, lastCreatedBlockId, handleLogicBlocksUpdate])

  // Measure port positions for logic blocks so connections originate from each port center
  useLayoutEffect(() => {
    if (logicBlocks.length === 0) {
      setLogicBlockPortPositions({})
      return
    }
    
    const updates: Record<string, { input?: PortPoint; outputs: Array<PortPoint | undefined> }> = {}

    logicBlocks.forEach((block) => {
      const blockElement = document.querySelector(`.logic-block[data-logic-block-id="${block.id}"]`) as HTMLElement | null
      if (!blockElement || !blockElement.classList.contains('logic-block')) return

      const outputs: Array<PortPoint | undefined> = []
      let inputPoint: PortPoint | undefined

      const inputElement = blockElement.querySelector(`.connection-port[data-block-id="${block.id}"][data-port-index="input"]`) as HTMLElement | null
      if (inputElement) {
        const rect = inputElement.getBoundingClientRect()
        inputPoint = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
                } else {
        const logicHeight = logicBlockSizes[block.id] ?? 160
        inputPoint = {
          x: block.position.x,
          y: block.position.y + logicHeight / 2
        }
      }

      const portElements = blockElement.querySelectorAll<HTMLElement>(`.connection-port[data-block-id="${block.id}"][data-port-index]`)
      portElements.forEach((portEl) => {
        const portIdxAttr = portEl.dataset.portIndex
        if (!portIdxAttr || portIdxAttr === "input") return
        const idx = parseInt(portIdxAttr, 10)
        const portRect = portEl.getBoundingClientRect()
        outputs[idx] = screenToWorld(portRect.left + portRect.width / 2, portRect.top + portRect.height / 2)
      })

      updates[block.id] = { input: inputPoint, outputs }
    })

    setLogicBlockPortPositions((prev) => {
      const next: typeof prev = {}
      logicBlocks.forEach((block) => {
        next[block.id] = updates[block.id] ?? prev[block.id] ?? { outputs: [] }
      })
      return next
    })
  }, [logicBlocks, logicBlockSizes, canvasOffset.x, canvasOffset.y, zoom, screenToWorld])

  // Measure port positions for flow nodes
  useLayoutEffect(() => {
    if (!flow?.nodes) return

    const updates: Record<string, { input: PortPoint; output: PortPoint }> = {}
    
    flow.nodes.forEach(node => {
      const inputEl = document.querySelector(`.connection-port[data-port-type="input"][data-node-id="${node.id}"]`)
      const outputEl = document.querySelector(`.connection-port[data-port-type="output"][data-node-id="${node.id}"]`)
      
      let inputPos: PortPoint
      let outputPos: PortPoint
      
      if (inputEl) {
        const rect = inputEl.getBoundingClientRect()
        inputPos = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
      } else {
        // Fallback
        const height = flowNodeSizes[node.id] ?? 150
        inputPos = { x: node.position.x, y: node.position.y + height / 2 }
      }
      
      if (outputEl) {
        const rect = outputEl.getBoundingClientRect()
        outputPos = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
      } else {
        // Fallback
        const height = flowNodeSizes[node.id] ?? 150
        outputPos = { x: node.position.x + 300, y: node.position.y + height / 2 }
      }
      
      updates[node.id] = { input: inputPos, output: outputPos }
    })
    
    setFlowNodePortPositions(updates)
  }, [flow?.nodes, flowNodeSizes, canvasOffset.x, canvasOffset.y, zoom, screenToWorld])

  // Handle Ctrl+Z for undo - using refs to avoid closure issues
  // This MUST be before any early returns to maintain hook order
  useEffect(() => {
    const handleUndoKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Get latest values from refs to avoid closure issues
        const currentHistory = deleteHistoryRef.current
        const currentFlow = flowRef.current
        
        // Simple check: only skip if in a content textarea (not title inputs)
        const activeElement = document.activeElement
        const isInContentTextarea = activeElement && 
          activeElement.tagName === 'TEXTAREA' &&
          !(activeElement as HTMLElement).classList.contains('font-semibold') &&
          !(activeElement as HTMLElement).classList.contains('text-lg')
        
        if (currentHistory.length > 0 && currentFlow && !isInContentTextarea) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          
          const lastDelete = currentHistory[currentHistory.length - 1]
          const node = currentFlow.nodes.find(n => n.id === lastDelete.nodeId)
          
          if (node) {
            const components = normalizePageComponents(node.pageComponents)
            const componentExists = components.some(comp => comp.id === lastDelete.component.id)
            
            if (!componentExists) {
              const updatedComponents = [
                ...components.slice(0, lastDelete.index),
                lastDelete.component,
                ...components.slice(lastDelete.index)
              ]
              
              const updatedNode: FlowNode = {
                ...node,
                pageComponents: updatedComponents,
                components: updatedComponents.length
              }

              const updatedFlow: Flow = {
                ...currentFlow,
                nodes: currentFlow.nodes.map(n => n.id === lastDelete.nodeId ? updatedNode : n)
              }

              onUpdateFlowRef.current(updatedFlow)
              setDeleteHistory(prev => prev.slice(0, -1))
            } else {
              setDeleteHistory(prev => prev.slice(0, -1))
            }
          } else {
            setDeleteHistory(prev => prev.slice(0, -1))
          }
        }
      }
    }

    document.addEventListener('keydown', handleUndoKeyDown, true)
    return () => document.removeEventListener('keydown', handleUndoKeyDown, true)
  }, []) // Empty array - all values come from refs which are always current

  // Cleanup animation frame on unmount - MUST be before any early returns
  useEffect(() => {
    return () => {
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current)
      }
    }
  }, [])

  if (!flow) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <Layers className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Select a flow or create a new one</p>
        </div>
      </div>
    )
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Disable panning when component library dropdown is open
    if (showComponentLibraryForNode !== null) {
      return
    }
    
    // Only handle left mouse button
    if (e.button !== 0) return
    
    // If we're currently drawing a connection, a simple click cancels it
    if (connectingFrom) {
      setConnectingFrom(null)
      setConnectionLineEnd(null)
      setConnectingPortIndex(undefined)
      setConnectionLineStart(null)
      clearConnectionState()
      return
    }

    // If clicking on a block or port, don't deselect or start panning
    if ((e.target as HTMLElement).closest('.node-card, .logic-block, .connection-port')) return
    
    // Deselect blocks when clicking elsewhere on canvas
    setSelectedNodeId(null)
    setSelectedLogicId(null)
    
    // Only start panning if left button is pressed
    if (e.buttons === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y })
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Cancel previous frame if exists
    if (dragAnimationFrameRef.current) {
      cancelAnimationFrame(dragAnimationFrameRef.current)
    }
    
    // Schedule update for next frame to prevent excessive CPU load
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      if (draggingVariable) {
        setDragVariablePosition({ x: e.clientX, y: e.clientY })
      }
      if (draggingLogicType) {
        setDragCursorPosition({ x: e.clientX, y: e.clientY })
      }
      
      // Only pan if left button is held and not dragging anything
      if (isPanning && !draggingNodeId && !draggingLogicId && !connectingFrom && e.buttons === 1) {
        setCanvasOffset({ 
          x: e.clientX - panStart.x, 
          y: e.clientY - panStart.y 
        })
        return
      }
      
      if (connectingFrom) {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        setConnectionLineEnd(worldPos)
        return
      }
      
      // Drag flow block - block should stick to mouse cursor
      if (draggingNodeId && e.buttons === 1 && dragCanvasStateRef.current) {
        // Only move if mouse has actually moved
        const currentMousePos = { x: e.clientX, y: e.clientY }
        const lastPos = lastMousePosRef.current
        
        if (lastPos && lastPos.x === currentMousePos.x && lastPos.y === currentMousePos.y) {
          // Mouse hasn't moved, don't update position
          return
        }
        
        if (!canvasRef.current) return
        const currentRect = canvasRef.current.getBoundingClientRect()
        
        // Calculate delta in screen coordinates
        const deltaX = lastPos ? currentMousePos.x - lastPos.x : 0
        const deltaY = lastPos ? currentMousePos.y - lastPos.y : 0
        
        // Convert screen delta to world delta (divide by zoom)
        const worldDeltaX = deltaX / zoom
        const worldDeltaY = deltaY / zoom
        
        // Find the current node position
        const currentNode = flow.nodes.find(n => n.id === draggingNodeId)
        if (!currentNode) return
        
        // Update position by adding the delta (smooth incremental movement)
        const newPosition = {
          x: currentNode.position.x + worldDeltaX,
          y: currentNode.position.y + worldDeltaY
        }
        
        // Update last mouse position
        lastMousePosRef.current = currentMousePos
        
        const updatedNodes = flow.nodes.map(n => {
          if (n.id === draggingNodeId) {
            return {
              ...n,
              position: newPosition
            }
          }
          return n
        })
        onUpdateFlow({ ...flow, nodes: updatedNodes })
      } else if (draggingNodeId && e.buttons !== 1) {
        // Stop dragging if button is released
        setDraggingNodeId(null)
        pendingDragNodeIdRef.current = null
        dragStartPosRef.current = null
        dragStartNodePosRef.current = null
        dragCanvasStateRef.current = null
        lastMousePosRef.current = null
      }
      
      // Drag logic block - block should stick to mouse cursor
      if (draggingLogicId && e.buttons === 1 && dragCanvasStateRef.current) {
        // Only move if mouse has actually moved
        const currentMousePos = { x: e.clientX, y: e.clientY }
        const lastPos = lastMousePosRef.current
        
        if (lastPos && lastPos.x === currentMousePos.x && lastPos.y === currentMousePos.y) {
          // Mouse hasn't moved, don't update position
          return
        }
        
        if (!canvasRef.current) return
        const currentRect = canvasRef.current.getBoundingClientRect()
        
        // Calculate delta in screen coordinates
        const deltaX = lastPos ? currentMousePos.x - lastPos.x : 0
        const deltaY = lastPos ? currentMousePos.y - lastPos.y : 0
        
        // Convert screen delta to world delta (divide by zoom)
        const worldDeltaX = deltaX / zoom
        const worldDeltaY = deltaY / zoom
        
        // Find the current block position
        const currentBlock = logicBlocks.find(b => b.id === draggingLogicId)
        if (!currentBlock) return
        
        // Update position by adding the delta (smooth incremental movement)
        const newPosition = {
          x: currentBlock.position.x + worldDeltaX,
          y: currentBlock.position.y + worldDeltaY
        }
        
        // Update last mouse position
        lastMousePosRef.current = currentMousePos
        
        const updatedLogicBlocks = logicBlocks.map(b => {
          if (b.id === draggingLogicId) {
            return {
              ...b,
              position: newPosition
            }
          }
          return b
        })
        handleLogicBlocksUpdate(updatedLogicBlocks)
      } else if (draggingLogicId && e.buttons !== 1) {
        // Stop dragging if button is released
        setDraggingLogicId(null)
        pendingDragLogicIdRef.current = null
        dragStartPosRef.current = null
        dragStartNodePosRef.current = null
        dragCanvasStateRef.current = null
        lastMousePosRef.current = null
      }
    })
  }
  
  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return
    
    if (draggingVariable) {
      // Check if dropped on a drop target (condition/path input)
      const dropTarget = (e.target as HTMLElement).closest('[data-drop-target]') as HTMLElement | null
      if (dropTarget) {
        const blockId = dropTarget.dataset.blockId
        const fieldType = dropTarget.dataset.fieldType
        const fieldIndex = dropTarget.dataset.fieldIndex ? parseInt(dropTarget.dataset.fieldIndex) : undefined
        const slotIndex = dropTarget.dataset.slotIndex ? parseInt(dropTarget.dataset.slotIndex) : undefined
        
        if (blockId) {
          const updatedBlocks = logicBlocks.map(b => {
            if (b.id === blockId) {
              const config = { ...b.config }
              if (fieldType === 'condition') {
                // Use the conditions array for if-else blocks
                const currentConditions = config.conditions || ['']
                const idx = typeof slotIndex === "number" ? slotIndex : 0
                const nextConditions = [...currentConditions]
                nextConditions[idx] = draggingVariable.value
                config.conditions = nextConditions
              } else if (fieldType === 'path' && fieldIndex !== undefined) {
                const paths = [...(config.paths || [])]
                paths[fieldIndex] = draggingVariable.value
                config.paths = paths
              }
              return { ...b, config }
            }
            return b
          })
          handleLogicBlocksUpdate(updatedBlocks)
        }
      }
      setDraggingVariable(null)
    }
    
    // Logic block drop is now handled by global mouseup handler
    
    setIsPanning(false)
    setDraggingNodeId(null)
    setDraggingLogicId(null)
    pendingDragNodeIdRef.current = null
    pendingDragLogicIdRef.current = null
    dragStartPosRef.current = null
    dragStartNodePosRef.current = null
    dragCanvasStateRef.current = null
    lastMousePosRef.current = null
    
    if (plusClickTimer) {
      clearTimeout(plusClickTimer)
      setPlusClickTimer(null)
    }
  }

  const handleLogicBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    // Only start dragging on left mouse button
    if (e.button !== 0) return
    
    e.stopPropagation()
    e.preventDefault()
    
    const block = logicBlocks.find(b => b.id === blockId)
    if (!block) return
    
    setSelectedLogicId(blockId)
    setSelectedNodeId(null) // Deselect node if logic block is selected
    
    // Capture canvas offset at drag start - CRITICAL to prevent jolting
    // But we'll use CURRENT zoom during drag so block stays under mouse at any zoom level
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    dragCanvasStateRef.current = {
      offset: { x: canvasOffset.x, y: canvasOffset.y },
      zoom: zoom, // Store for reference, but we'll use current zoom during drag
      rect: rect
    }
    
    // Calculate offset in world coordinates (zoom-independent)
    const screenX = e.clientX
    const screenY = e.clientY
    const worldX = (screenX - rect.left - canvasOffset.x) / zoom
    const worldY = (screenY - rect.top - canvasOffset.y) / zoom
    
    dragOffsetRef.current = {
      x: worldX - block.position.x,
      y: worldY - block.position.y
    }
    dragStartNodePosRef.current = { x: block.position.x, y: block.position.y }
    dragStartPosRef.current = { x: screenX, y: screenY }
    
    // Initialize last mouse position to current position
    lastMousePosRef.current = { x: screenX, y: screenY }
    
    // Start dragging immediately - block should stick to mouse
    pendingDragLogicIdRef.current = blockId
    setDraggingLogicId(blockId)
  }

  const handlePlusMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    
    const timer = window.setTimeout(() => {
      handleStartConnection(e, nodeId)
      setPlusClickTimer(null)
    }, 200)
    
    setPlusClickTimer(timer)
  }
  
  const handlePlusMouseUp = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    
    if (plusClickTimer) {
      clearTimeout(plusClickTimer)
      setPlusClickTimer(null)
      
      if (!flow) return
      
      // Check block limit - enforce strictly
      const totalBlocks = flow.nodes.length + (flow.logicBlocks?.length || 0)
      if (totalBlocks >= maxBlocksPerFlow) {
        if (membershipActive) {
          toast.error("Plan limit reached")
        } else {
          toast.error(`You've reached the limit of ${maxBlocksPerFlow} blocks per flow. Upgrade to Premium for 30 blocks per flow.`)
          // Wait 1 second before showing popup
          setTimeout(() => {
            setLimitPopupType("blocks")
            setLimitPopupCount({ current: totalBlocks, max: maxBlocksPerFlow })
            setShowLimitPopup(true)
          }, 1000)
        }
        return
      }
      
      const sourceNode = flow.nodes.find(n => n.id === nodeId)
      if (!sourceNode) return
      
      const newNode: FlowNode = {
        id: `node-${Date.now()}`,
        title: "New Step",
        components: 0,
        completion: 0,
        position: { 
          x: sourceNode.position.x + 350, 
          y: sourceNode.position.y 
        },
        connections: []
      }
      // Update source node so it's connected to the new node
      const updatedNodes = flow.nodes.map(n =>
        n.id === nodeId
          ? { ...n, connections: [...(n.connections || []), newNode.id] }
          : n
      )
      setLastCreatedBlockId(newNode.id)
      onUpdateFlow({ ...flow, nodes: [...updatedNodes, newNode] })
    }
  }

  const handleLogicPlusMouseDown = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation()
    e.preventDefault()
    
    const timer = window.setTimeout(() => {
      handleStartConnection(e, blockId)
      setPlusClickTimer(null)
    }, 200)
    
    setPlusClickTimer(timer)
  }

  const handleLogicPlusMouseUp = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation()
    
    if (plusClickTimer) {
      clearTimeout(plusClickTimer)
      setPlusClickTimer(null)
      
      if (!flow) return
      
      // Check block limit
      const totalBlocks = flow.nodes.length + (flow.logicBlocks?.length || 0)
      if (totalBlocks >= maxBlocksPerFlow) {
        if (membershipActive) {
          toast.error("Plan limit reached")
        } else {
          toast.error(`You've reached the limit of ${maxBlocksPerFlow} blocks per flow. Upgrade to Premium for 30 blocks per flow.`)
          // Wait 1 second before showing popup
          setTimeout(() => {
            setLimitPopupType("blocks")
            setLimitPopupCount({ current: totalBlocks, max: maxBlocksPerFlow })
            setShowLimitPopup(true)
          }, 1000)
        }
        return
      }
      
      const sourceBlock = logicBlocks.find(b => b.id === blockId)
      if (!sourceBlock) return
      
      const newNode: FlowNode = {
        id: `node-${Date.now()}`,
        title: "New Step",
        components: 0,
        completion: 0,
        position: { 
          x: sourceBlock.position.x + 350, 
          y: sourceBlock.position.y 
        },
        connections: []
      }
      // Connect the first output port of the logic block to the new node
      const updatedBlocks = logicBlocks.map(b => {
        if (b.id === blockId) {
          const newConnections = [...b.connections]
          if (newConnections.length === 0) {
            newConnections[0] = newNode.id
          } else {
            newConnections[0] = newNode.id // Overwrite first connection
          }
          return { ...b, connections: newConnections }
        }
        return b
      })
      setLastCreatedBlockId(newNode.id)
      handleLogicBlocksUpdate(updatedBlocks)
      onUpdateFlow({ ...flow, nodes: [...flow.nodes, newNode] })
    }
  }

  const handleStartConnection = (e: React.MouseEvent, nodeId: string, portIndex?: number) => {
    e.stopPropagation()
    e.preventDefault()
    setConnectingFrom(nodeId)
    setConnectingPortIndex(portIndex)
    
    // For logic blocks with port index, get EXACT port center by querying the DOM element
    if (portIndex !== undefined) {
      const logicBlock = logicBlocks.find(b => b.id === nodeId)
      if (logicBlock) {
        // For dragging, query the actual port element to get exact position at drag start
        // This ensures we start from the exact port center
        const blockElement = document.querySelector(`.logic-block[data-logic-block-id="${logicBlock.id}"]`) as HTMLElement
        const portElement = blockElement?.querySelector(`.connection-port[data-block-id="${logicBlock.id}"][data-port-index="${portIndex}"]`) as HTMLElement
        
        let portX: number
        let portY: number
        
        if (portElement && canvasRef.current) {
          // Get port center in world coordinates at drag start
          const portRect = portElement.getBoundingClientRect()
          const portCenterScreenX = portRect.left + portRect.width / 2
          const portCenterScreenY = portRect.top + portRect.height / 2
          const worldPos = screenToWorld(portCenterScreenX, portCenterScreenY)
          portX = worldPos.x
          portY = worldPos.y
        } else {
          // Fallback: use measured positions or calculate
          const measuredPort = logicBlockPortPositions[logicBlock.id]?.outputs[portIndex]
          const blockWidth = logicBlock.type === "score-threshold" ? 308 : 280
          const logicHeight = logicBlockSizes[logicBlock.id] ?? 160
          let pathCount: number
          if (logicBlock.type === "multi-path") {
            // Always use 6 paths for multi-path blocks
            pathCount = 6
          } else {
            pathCount = logicBlock.type === "if-else" || logicBlock.type === "a-b-test" || logicBlock.type === "score-threshold" ? 2 : 2
          }
          
          if (measuredPort) {
            portX = measuredPort.x
            portY = measuredPort.y
          } else {
            portX = logicBlock.position.x + blockWidth + 1.5
            if (pathCount === 1) {
              portY = logicBlock.position.y + logicHeight / 2
            } else {
              const spacing = logicHeight / (pathCount + 1)
              portY = logicBlock.position.y + spacing * (portIndex + 1)
            }
          }
        }
        
        // Set the connection start to the EXACT port center
        const portCenter = { x: portX, y: portY }
        setConnectionLineStart(portCenter)
        setConnectionLineEnd(portCenter) // Start at port, will follow mouse
        return
      }
    }
    
    // For flow nodes, use the exact port center
    // Priority: 1. Measured positions (fastest/most consistent) 2. DOM query (most accurate if fresh) 3. Calculation (fallback)
    const measuredPorts = flowNodePortPositions[nodeId]
    
    if (measuredPorts) {
      setConnectionLineStart(measuredPorts.output)
      setConnectionLineEnd(measuredPorts.output)
      return
    }
    
    const portElement = document.querySelector(`.connection-port[data-port-type="output"][data-node-id="${nodeId}"]`) as HTMLElement
    
    if (portElement && canvasRef.current) {
      const portRect = portElement.getBoundingClientRect()
      const portCenterScreenX = portRect.left + portRect.width / 2
      const portCenterScreenY = portRect.top + portRect.height / 2
      const worldPos = screenToWorld(portCenterScreenX, portCenterScreenY)
      setConnectionLineStart(worldPos)
      setConnectionLineEnd(worldPos)
    } else {
      // Fallback to calculated position
      const node = flow?.nodes.find(n => n.id === nodeId)
      if (node) {
        const nodeHeight = flowNodeSizes[nodeId] ?? 150
        const startX = node.position.x + 300 // Width of card
        const startY = node.position.y + nodeHeight / 2
        const worldPos = { x: startX, y: startY }
        setConnectionLineStart(worldPos)
        setConnectionLineEnd(worldPos)
      } else {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        setConnectionLineStart(worldPos)
        setConnectionLineEnd(worldPos)
      }
    }
  }

  // Get options from the previous flow block connected to a logic block
  const getPreviousBlockOptions = (logicBlockId: string): string[] => {
    if (!flow) return []
    
    // Find the flow block that connects to this logic block
    const sourceNode = flow.nodes.find(node => node.connections.includes(logicBlockId))
    if (!sourceNode || !sourceNode.pageComponents) return []
    
    // Normalize pageComponents to array format
    const components = normalizePageComponents(sourceNode.pageComponents)
    
    // Find question component in the array
    const questionComponent = components.find(
      comp => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
    )
    if (!questionComponent) return []

    const questionType = questionComponent.type

    // Get options based on question type (only multiple-choice and checkbox-multi have options)
    if (questionType === "multiple-choice" || questionType === "checkbox-multi") {
      let options = questionComponent.config?.options || []
      // If no options set, use defaults from preview (should match what's shown)
      if (options.length === 0) {
        options = questionType === "multiple-choice" 
          ? ["Option A", "Option B", "Option C"]
          : ["Interest A", "Interest B", "Interest C"]
      }
      return options
    }

    return []
  }

  // Validate if a flow node can attach to a logic block
  const canAttachToLogicBlock = (nodeId: string, logicType: "if-else" | "multi-path" | "score-threshold" | "a-b-test"): boolean => {
    const node = flow.nodes.find(n => n.id === nodeId)
    
    // A/B test can work with any type of component (or no component)
    if (logicType === "a-b-test") {
      return true
    }
    
    if (!node || !node.pageComponents) return false

    // Normalize pageComponents to array format
    const components = normalizePageComponents(node.pageComponents)

    // Find question component in the array
    const questionComponent = components.find(
      comp => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
    )
    if (!questionComponent) return false

    const questionType = questionComponent.type

    if (logicType === "if-else") {
      // If-else requires multiple-choice or checkbox-multi
      return questionType === "multiple-choice" || questionType === "checkbox-multi"
    }

    if (logicType === "multi-path") {
      // Multi-path can work with any component that has options or any block
      // If it has a question component with options, use those
      // Otherwise, allow connection anyway (will route to first connection by default)
      return true
    }

    if (logicType === "score-threshold") {
      // Score threshold requires scale-slider
      return questionType === "scale-slider"
    }

    return false
  }

  const handleEndConnection = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation()
    if (connectingFrom && connectingFrom !== targetNodeId) {
      const sourceNode = flow.nodes.find(n => n.id === connectingFrom)
      const sourceLogic = logicBlocks.find(b => b.id === connectingFrom)
      
      const targetNode = flow.nodes.find(n => n.id === targetNodeId)
      const targetLogic = logicBlocks.find(b => b.id === targetNodeId)
      
      // Don't allow logic-to-logic connections
      if (sourceLogic && targetLogic) {
        setConnectingFrom(null)
        setConnectionLineEnd(null)
        setConnectingPortIndex(undefined)
        setConnectionLineStart(null)
        return
      }
      
      // Logic block to flow block connection
      if (sourceLogic && targetNode) {
        const portIdx = connectingPortIndex ?? 0
        // Prevent multiple connections to same port
        const existingConnection = sourceLogic.connections[portIdx]
        if (existingConnection === targetNodeId) {
          // Already connected, do nothing
          setConnectingFrom(null)
          setConnectionLineEnd(null)
          setConnectingPortIndex(undefined)
          setConnectionLineStart(null)
          return
        }
        const updatedBlocks = logicBlocks.map(b => {
          if (b.id === connectingFrom) {
            const newConnections = [...b.connections]
            newConnections[portIdx] = targetNodeId
            return { ...b, connections: newConnections }
          }
          return b
        })
        handleLogicBlocksUpdate(updatedBlocks)
        setSelectedNodeId(null) // Deselect after drop
      } 
      // Flow block to logic block connection - validate component types
      else if (sourceNode && targetLogic) {
        // Prevent multiple flow blocks from attaching to one logic block
        const hasOtherFlowBlockConnected = flow.nodes.some(node => 
          node.id !== connectingFrom && node.connections.includes(targetNodeId)
        )
        if (hasOtherFlowBlockConnected) {
          toast.error("Cannot connect", {
            description: "A logic block can only be connected to one flow block.",
          })
          setConnectingFrom(null)
          setConnectionLineEnd(null)
          setConnectingPortIndex(undefined)
          setConnectionLineStart(null)
          return
        }
        
        const canAttach = canAttachToLogicBlock(connectingFrom, targetLogic.type)
        if (!canAttach) {
          let requiredType = ""
          if (targetLogic.type === "if-else") {
            requiredType = "multiple-choice or checkbox-multi"
          } else if (targetLogic.type === "multi-path") {
            requiredType = "multiple-choice or checkbox-multi"
          } else if (targetLogic.type === "score-threshold") {
            requiredType = "scale-slider"
          }

          toast.error("Cannot connect logic block", {
            description: `${targetLogic.type} block requires a ${requiredType} question in the previous step.`,
          })

          setConnectingFrom(null)
          setConnectionLineEnd(null)
          setConnectingPortIndex(undefined)
          setConnectionLineStart(null)
          return
        }
        // For if-else blocks, ensure both true and false paths are connected
        if (targetLogic.type === "if-else" && connectingPortIndex === undefined) {
          // This is a new connection from flow block to if-else block, which is allowed
          // But we should warn if false path is not connected
        }
        // Prevent multiple connections to same target
        if (sourceNode.connections.includes(targetNodeId)) {
          setConnectingFrom(null)
          setConnectionLineEnd(null)
          setConnectingPortIndex(undefined)
          setConnectionLineStart(null)
          return
        }
        const updatedNodes = flow.nodes.map(node => {
          if (node.id === connectingFrom) {
            return { ...node, connections: [...node.connections, targetNodeId] }
          }
          return node
        })
        onUpdateFlow({ ...flow, nodes: updatedNodes })
        setSelectedNodeId(null) // Deselect after drop
      }
      // Flow block to flow block connection
      else if (sourceNode && targetNode) {
        // Ensure connections array exists
        const currentConnections = sourceNode.connections || []
        
        // Prevent a flow block from having multiple outgoing connections
        if (currentConnections.length > 0) {
          toast.error("Cannot connect", {
            description: "A flow block can only have one outgoing connection.",
          })
          setConnectingFrom(null)
          setConnectionLineEnd(null)
          setConnectingPortIndex(undefined)
          setConnectionLineStart(null)
          return
        }
        // Prevent multiple connections to same target
        if (currentConnections.includes(targetNodeId)) {
          setConnectingFrom(null)
          setConnectionLineEnd(null)
          setConnectingPortIndex(undefined)
          setConnectionLineStart(null)
          return
        }
        const updatedNodes = flow.nodes.map(node => {
          if (node.id === connectingFrom) {
            const newConnections = [...currentConnections, targetNodeId]
            console.log('[FLOW-TO-FLOW] Creating connection:', {
              from: connectingFrom,
              to: targetNodeId,
              oldConnections: currentConnections,
              newConnections: newConnections,
              nodeBefore: node,
              nodeAfter: { ...node, connections: newConnections }
            })
            return { ...node, connections: newConnections }
          }
          return node
        })
        console.log('[FLOW-TO-FLOW] Updating flow with nodes:', updatedNodes.map(n => ({ id: n.id, connections: n.connections })))
        onUpdateFlow({ ...flow, nodes: updatedNodes })
        setSelectedNodeId(null) // Deselect after drop
      }
    }
    setConnectingFrom(null)
    setConnectionLineEnd(null)
    setConnectingPortIndex(undefined)
    setConnectionLineStart(null)
    clearConnectionState()
  }

  const clearConnectionState = () => {
    // Clear auto-connect timer
    if (autoConnectTimerRef.current) {
      clearTimeout(autoConnectTimerRef.current)
      autoConnectTimerRef.current = null
    }
    hoveredPortRef.current = null
  }

  const handlePortMouseEnter = (nodeId: string, portType?: string, portIndex?: number) => {
    // Only auto-connect if we're currently connecting from somewhere
    if (!connectingFrom || connectingFrom === nodeId) return
    
    // Store the hovered port
    hoveredPortRef.current = { nodeId, portType, portIndex }
    
    // Clear any existing timer
    if (autoConnectTimerRef.current) {
      clearTimeout(autoConnectTimerRef.current)
    }
    
    // Start auto-connect timer (200ms = 0.2 seconds)
    autoConnectTimerRef.current = setTimeout(() => {
      // Create a synthetic mouse event for handleEndConnection
      const syntheticEvent = {
        stopPropagation: () => {},
        preventDefault: () => {},
      } as React.MouseEvent
      
      handleEndConnection(syntheticEvent, nodeId)
      autoConnectTimerRef.current = null
      hoveredPortRef.current = null
    }, 200)
  }

  const handlePortMouseLeave = () => {
    // Clear the timer when mouse leaves the port
    if (autoConnectTimerRef.current) {
      clearTimeout(autoConnectTimerRef.current)
      autoConnectTimerRef.current = null
    }
    hoveredPortRef.current = null
  }

  const handleLogicDragStart = (type: LogicBlock['type'], e: React.MouseEvent) => {
    setDraggingLogicType(type)
    setDragCursorPosition({ x: e.clientX, y: e.clientY })
  }

  const handleAddComponent = (nodeId: string, componentType: ComponentType) => {
    if (!flow) return
    
    const node = flow.nodes.find(n => n.id === nodeId)
    if (!node) return

    const currentComponents = normalizePageComponents(node.pageComponents)
    
    // Note: Components don't count toward block limit - only flow nodes and logic blocks do
    // Block limit is checked when adding nodes/logic blocks, not components
    
    // Validation logic
    const videoCount = currentComponents.filter(c => c.type === "video-step").length
    const imageCount = currentComponents.filter(c => c.type === "image").length
    const fileCount = currentComponents.filter(c => c.type === "file-upload").length
    const questionCount = currentComponents.filter(c => 
      ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(c.type)
    ).length
    const textHeaderCount = currentComponents.filter(c => 
      ["text-instruction", "header"].includes(c.type)
    ).length

    if (componentType === "video-step" && videoCount >= 1) {
      toast.error("Maximum 1 video per page")
      return
    }
    if (componentType === "image" && imageCount >= 1) {
      toast.error("Maximum 1 image per page")
      return
    }
    if (componentType === "file-upload" && fileCount >= 1) {
      toast.error("Maximum 1 file upload per page")
      return
    }
    if (["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(componentType) && questionCount >= 1) {
      toast.error("Maximum 1 question per page")
      return
    }
    if (["text-instruction", "header"].includes(componentType) && textHeaderCount >= 3) {
      toast.error("Maximum 3 text/header components per page")
      return
    }

    // Initialize default config based on component type
    let config: Record<string, any> = {}
    if (componentType === "multiple-choice") {
      config = { options: ["Option A", "Option B", "Option C"], title: "Select your answer" }
    } else if (componentType === "checkbox-multi") {
      config = { options: ["Interest A", "Interest B", "Interest C"], title: "Select all that apply" }
    } else if (componentType === "scale-slider") {
      config = { min: 1, max: 100, default: 50, minLabel: "1", maxLabel: "100", label: "Rate your experience level" }
    } else if (componentType === "text-instruction") {
      config = { title: "Welcome to our onboarding", text: "This is a text instruction block." }
    } else if (componentType === "header") {
      config = { title: "Header Title" }
    } else if (componentType === "video-step") {
      config = { title: "Watch this instructional video", description: "This video is required to continue" }
    } else if (componentType === "short-answer") {
      config = { label: "What is your name?", placeholder: "Type your answer here..." }
    } else if (componentType === "file-upload") {
      config = { label: "Upload your documents", acceptedTypes: "PDF, DOC, DOCX (max 10MB)" }
    } else if (componentType === "link-button") {
      config = { label: "Click here", url: "https://example.com" }
    } else if (componentType === "image") {
      config = { title: "Image Title", alt: "Image" }
    }

    const newComponent: PageComponent = {
      id: `component-${Date.now()}-${Math.random()}`,
      type: componentType,
      config
    }

    const updatedComponents = [...currentComponents, newComponent]
    
    const updatedNode: FlowNode = {
      ...node,
      pageComponents: updatedComponents,
      components: updatedComponents.length
    }

    const updatedFlow: Flow = {
      ...flow,
      nodes: flow.nodes.map(n => n.id === nodeId ? updatedNode : n)
    }

    onUpdateFlow(updatedFlow)
    setShowComponentLibraryForNode(null)
  }

  const handleUpdateComponent = (nodeId: string, componentId: string, config: Record<string, any>) => {
    if (!flow) return
    
    const node = flow.nodes.find(n => n.id === nodeId)
    if (!node) return

    const components = normalizePageComponents(node.pageComponents)
    const updatedComponents = components.map(comp => 
      comp.id === componentId ? { ...comp, config } : comp
    )
    
    const updatedNode: FlowNode = {
      ...node,
      pageComponents: updatedComponents
    }

    const updatedFlow: Flow = {
      ...flow,
      nodes: flow.nodes.map(n => n.id === nodeId ? updatedNode : n)
    }

    onUpdateFlow(updatedFlow)
  }

  const handleDeleteComponent = async (nodeId: string, componentId: string) => {
    if (!flow) return
    
    const node = flow.nodes.find(n => n.id === nodeId)
    if (!node) return

    const components = normalizePageComponents(node.pageComponents)
    const componentToDelete = components.find(comp => comp.id === componentId)
    const componentIndex = components.findIndex(comp => comp.id === componentId)
    
    if (!componentToDelete) return
    
    // Store in history for undo (don't delete files yet - only delete on undo if not restored)
    setDeleteHistory(prev => [...prev, { nodeId, component: componentToDelete, index: componentIndex }])
    
    // Delete associated files from Supabase Storage before removing component
      try {
        await deleteComponentFiles(componentToDelete)
      } catch (error) {
        console.error('Error deleting component files:', error)
        // Continue with component deletion even if file deletion fails
    }
    
    const updatedComponents = components.filter(comp => comp.id !== componentId)
    
    const updatedNode: FlowNode = {
      ...node,
      pageComponents: updatedComponents,
      components: updatedComponents.length
    }

    const updatedFlow: Flow = {
      ...flow,
      nodes: flow.nodes.map(n => n.id === nodeId ? updatedNode : n)
    }

    onUpdateFlow(updatedFlow)
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Disable zoom when component library dropdown is open
    if (showComponentLibraryForNode !== null) {
      return
    }
    
    e.preventDefault()
    
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const worldPosBefore = screenToWorld(e.clientX, e.clientY)
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.min(Math.max(zoom + delta, 0.25), 2)
    
    setZoom(newZoom)
    
    const newOffsetX = mouseX - worldPosBefore.x * newZoom
    const newOffsetY = mouseY - worldPosBefore.y * newZoom
    
    setCanvasOffset({ x: newOffsetX, y: newOffsetY })
  }

  // Calculate distance between two touch points
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Calculate center point between two touches
  const getTouchCenter = (touch1: React.Touch, touch2: React.Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canvasRef.current) return

    const touchArray = Array.from(e.touches)
    touchStateRef.current.touches.clear()
    
    touchArray.forEach(touch => {
      touchStateRef.current.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
    })

    // Handle single touch (pan) or two touches (pinch zoom)
    if (touchArray.length === 1) {
      const touch = touchArray[0]
      // Only pan if not touching a block or port
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (target && target.closest('.node-card, .logic-block, .connection-port')) {
        touchStateRef.current.isPanning = false
        return
      }
      touchStateRef.current.isPanning = true
      setPanStart({ x: touch.clientX - canvasOffset.x, y: touch.clientY - canvasOffset.y })
    } else if (touchArray.length === 2) {
      touchStateRef.current.isPanning = false
      const distance = getTouchDistance(touchArray[0], touchArray[1])
      const center = getTouchCenter(touchArray[0], touchArray[1])
      touchStateRef.current.lastDistance = distance
      touchStateRef.current.lastCenter = center
      
      // Convert center to world coordinates
      const worldPosBefore = screenToWorld(center.x, center.y)
      
      // Store for zoom calculation
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        touchStateRef.current.lastCenter = {
          x: center.x - rect.left,
          y: center.y - rect.top
        }
      }
    }
  }

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (!canvasRef.current || !flow) return

    const touchArray = Array.from(e.touches)
    
    // Update touch positions
    touchStateRef.current.touches.clear()
    touchArray.forEach(touch => {
      touchStateRef.current.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
    })

    // Single touch - pan
    if (touchArray.length === 1 && touchStateRef.current.isPanning && !draggingNodeId && !draggingLogicId && !connectingFrom) {
      const touch = touchArray[0]
      setCanvasOffset({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y
      })
    }
    // Two touches - pinch zoom
    else if (touchArray.length === 2) {
      const distance = getTouchDistance(touchArray[0], touchArray[1])
      const center = getTouchCenter(touchArray[0], touchArray[1])
      
      if (touchStateRef.current.lastDistance && touchStateRef.current.lastCenter) {
        const scale = distance / touchStateRef.current.lastDistance
        const newZoom = Math.min(Math.max(zoom * scale, 0.25), 2)
        
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect()
          const centerX = center.x - rect.left
          const centerY = center.y - rect.top
          
          const worldPosBefore = screenToWorld(center.x, center.y)
          
          setZoom(newZoom)
          
          const newOffsetX = centerX - worldPosBefore.x * newZoom
          const newOffsetY = centerY - worldPosBefore.y * newZoom
          
          setCanvasOffset({ x: newOffsetX, y: newOffsetY })
        }
        
        touchStateRef.current.lastDistance = distance
      }
    }
  }

  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    const remainingTouches = Array.from(e.touches)
    touchStateRef.current.touches.clear()
    remainingTouches.forEach(touch => {
      touchStateRef.current.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
    })
    
    if (remainingTouches.length === 0) {
      touchStateRef.current.isPanning = false
      touchStateRef.current.lastDistance = null
      touchStateRef.current.lastCenter = null
    } else if (remainingTouches.length === 1) {
      // Switched from pinch to single touch - reset pan start
      const touch = remainingTouches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (target && !target.closest('.node-card, .logic-block, .connection-port')) {
        touchStateRef.current.isPanning = true
        setPanStart({ x: touch.clientX - canvasOffset.x, y: touch.clientY - canvasOffset.y })
      }
    }
    
    setIsPanning(false)
  }

  // Zoom control functions
  const handleZoomIn = () => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const worldPosBefore = screenToWorld(rect.left + centerX, rect.top + centerY)
    const newZoom = Math.min(zoom * 1.2, 2)
    
    setZoom(newZoom)
    
    const newOffsetX = centerX - worldPosBefore.x * newZoom
    const newOffsetY = centerY - worldPosBefore.y * newZoom
    
    setCanvasOffset({ x: newOffsetX, y: newOffsetY })
  }

  const handleZoomOut = () => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const worldPosBefore = screenToWorld(rect.left + centerX, rect.top + centerY)
    const newZoom = Math.max(zoom / 1.2, 0.25)
    
    setZoom(newZoom)
    
    const newOffsetX = centerX - worldPosBefore.x * newZoom
    const newOffsetY = centerY - worldPosBefore.y * newZoom
    
    setCanvasOffset({ x: newOffsetX, y: newOffsetY })
  }

  const handleResetView = () => {
    setZoom(1)
    setCanvasOffset({ x: 0, y: 0 })
    hasCenteredFlowRef.current = null
    // Trigger re-center
    if (flow) {
      const flowId = flow.id
      hasCenteredFlowRef.current = null
      setTimeout(() => {
        if (flow.id === flowId) {
          hasCenteredFlowRef.current = null
        }
      }, 100)
    }
  }

  const handleFitToScreen = () => {
    if (!flow || !canvasRef.current) return
    hasCenteredFlowRef.current = null
    // Trigger re-center effect
    setTimeout(() => {
      if (flow && canvasRef.current) {
        hasCenteredFlowRef.current = null
      }
    }, 100)
  }

  const handleDeleteConnection = (e: React.MouseEvent, sourceId: string, targetId: string) => {
    e.stopPropagation()
    e.preventDefault()
    console.log('[DELETE] Removing connection:', sourceId, '→', targetId)
    
    if (!flow) {
      console.error('[DELETE] No flow available')
      return
    }
    
    // Check if source is a flow node
    const sourceNode = flow.nodes.find(n => n.id === sourceId)
    if (sourceNode) {
      const newConnections = sourceNode.connections.filter(id => id !== targetId)
      console.log('[DELETE] Flow node', sourceId, 'connections:', sourceNode.connections, '→', newConnections)
      
    const updatedNodes = flow.nodes.map(node => {
      if (node.id === sourceId) {
          return { ...node, connections: newConnections }
      }
      return node
    })
      
      const updatedFlow = { ...flow, nodes: updatedNodes }
      console.log('[DELETE] Updating flow with', updatedNodes.length, 'nodes')
      onUpdateFlow(updatedFlow)
      return
    }
    
    // Check if source is a logic block
    const sourceLogic = logicBlocks.find(b => b.id === sourceId)
    if (sourceLogic) {
      const index = sourceLogic.connections.findIndex(id => id === targetId)
      if (index === -1) {
        console.warn('[DELETE] Connection not found in logic block')
        return
      }

      const newConnections = [...sourceLogic.connections]
      newConnections[index] = ""
      console.log('[DELETE] Logic block', sourceId, 'connections:', sourceLogic.connections, '→', newConnections)
    
    const updatedLogicBlocks = logicBlocks.map(block => {
      if (block.id === sourceId) {
          return { ...block, connections: newConnections }
      }
      return block
    })
    handleLogicBlocksUpdate(updatedLogicBlocks)
      return
    }
    
    console.error('[DELETE] Source not found:', sourceId)
  }

  const addMultiPathRoute = (blockId: string) => {
    const updatedBlocks = logicBlocks.map(b => {
      if (b.id === blockId && b.type === "multi-path") {
        const currentPaths = b.config?.paths || []
        if (currentPaths.length < 6) {
          return { ...b, config: { ...b.config, paths: [...currentPaths, ''] } }
        }
      }
      return b
    })
    handleLogicBlocksUpdate(updatedBlocks)
  }

  const removeMultiPathRoute = (blockId: string, index: number) => {
    const updatedBlocks = logicBlocks.map(b => {
      if (b.id === blockId && b.type === "multi-path") {
        const currentPaths = b.config?.paths || []
        if (currentPaths.length > 2) {
          const newPaths = currentPaths.filter((_, idx) => idx !== index)
          return { ...b, config: { ...b.config, paths: newPaths } }
        }
      }
      return b
    })
    handleLogicBlocksUpdate(updatedBlocks)
  }

  const getLogicBlockOutputColors = (type: LogicBlock['type'], pathCount: number = 4) => {
    if (type === "if-else") {
      return ["#10b981", "#ef4444"] // Green for true, Red for false
    } else if (type === "multi-path") {
      const allColors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"]
      return allColors.slice(0, pathCount)
    } else if (type === "a-b-test") {
      return ["#8b5cf6", "#f59e0b"] // Purple for A, Orange for B
    } else { // score-threshold
      return ["#10b981", "#84cc16", "#f59e0b", "#ef4444"] // Green to Red gradient
    }
  }

  // Get the color of the incoming connection (if any) for a given flow node
  const getIncomingColorForNode = (nodeId: string): string | null => {
    // From another flow node → always green
    const hasFlowIncoming = flow.nodes.some(n => n.connections.includes(nodeId))
    if (hasFlowIncoming) return "#10b981"

    // From a logic block → use that logic block's output color
    for (const block of logicBlocks) {
      let pathCount: number
      if (block.type === "multi-path") {
        // Always use 6 paths for multi-path blocks
        pathCount = 6
      } else {
        pathCount = block.type === "if-else" || block.type === "a-b-test" || block.type === "score-threshold" ? 2 : 2
      }
      const outputColors = getLogicBlockOutputColors(block.type, pathCount)
      const idx = block.connections.findIndex(id => id === nodeId)
      if (idx !== -1) {
        return outputColors[idx] || "#10b981"
      }
    }
    return null
  }

  // Show analytics view if in analytics mode
  if (viewMode === "analytics" && flow) {
  return (
    <>
        <header className="bg-card px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2 shadow-neumorphic-subtle relative border-b border-gray-400 dark:border-gray-500" style={{ borderBottomWidth: '1px' }}>
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={flowTitle}
                onChange={(e) => {
                  setFlowTitle(e.target.value)
                  if (flow) {
                    onUpdateFlow({ ...flow, title: e.target.value })
                  }
                }}
                className="text-lg font-bold bg-card shadow-neumorphic-inset rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300 text-foreground placeholder:text-muted-foreground"
              />
              {flow && (
                <button
                  onClick={async () => {
                    console.log('[Disable Button 2] Clicked - flow.status:', flow.status, 'experienceId:', experienceId)
                    
                    if (flow.status === "Live") {
                      // Get experienceId from URL if not provided as prop
                      let expId = experienceId
                      if (!expId) {
                        const pathParts = window.location.pathname.split('/')
                        expId = pathParts[pathParts.indexOf('experiences') + 1]
                      }
                      
                      console.log('[Disable Button 2] Using experienceId:', expId)
                      
                      if (expId) {
                        try {
                          // Use type assertion to bypass build cache type issues
                          const success = await (toggleFlowActive as any)(flow.id, false, expId)
                          console.log('[Disable Button 2] toggleFlowActive result:', success)
                          
                          if (success && onUpdateFlow) {
                            onUpdateFlow({ ...flow, status: "Draft" as const })
                            toast.success("Flow disabled successfully")
                          } else {
                            toast.error("Failed to disable flow")
                          }
                        } catch (error: any) {
                          console.error("[Disable Button 2] Error disabling flow:", error)
                          toast.error("Failed to disable flow")
                        }
                      } else {
                        console.error("[Disable Button 2] No experienceId found")
                        toast.error("Cannot disable flow: Experience ID not found")
                      }
                    } else {
                      setShowUploadModal(true)
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-neumorphic-raised hover:shadow-neumorphic-pressed z-10"
                  style={{
                    backgroundColor: flow.status === "Live" ? '#ef4444' : '#10b981',
                  }}
                  title={flow.status === "Live" ? "Disable Flow" : "Enable Flow"}
                >
                  {flow.status === "Live" ? (
                    <X className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
          {/* Mode Toggle Buttons - Centered */}
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("create")}
                className="text-[12px] px-4 py-2 rounded-lg transition-all duration-300 text-muted-foreground hover:text-foreground"
                style={{ minWidth: '105px' }}
              >
                Flow Creation
              </button>
              <button
                onClick={() => setViewMode("analytics")}
                className="text-[12px] px-4 py-2 rounded-lg transition-all duration-300 bg-card shadow-neumorphic-inset text-foreground"
                style={{ minWidth: '105px' }}
              >
                Data Analytics
              </button>
            </div>
          </div>
          {/* Right side - Save Changes button placeholder */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            {onSaveToDatabase && flow && (
              <div style={{ minWidth: '140px', minHeight: '32px' }} />
            )}
          </div>
        </header>
        <FlowAnalytics flow={flow} membershipActive={membershipActive} />
      </>
    )
  }

  return (
    <>
        <header className="bg-card px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2 shadow-neumorphic-subtle relative border-b border-gray-400 dark:border-gray-500" style={{ borderBottomWidth: '1px' }}>
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={flowTitle}
              onChange={(e) => {
                setFlowTitle(e.target.value)
                if (flow) {
                  onUpdateFlow({ ...flow, title: e.target.value })
                }
              }}
              className="text-lg font-bold bg-card shadow-neumorphic-inset rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300 text-foreground placeholder:text-muted-foreground"
            />
            {/* Enable/Disable button - absolute right in title input */}
            {flow && (
              <button
                onClick={async () => {
                  console.log('[Disable Button] Clicked - flow.status:', flow.status, 'experienceId:', experienceId)
                  
                  if (flow.status === "Live") {
                    // Get experienceId from URL if not provided as prop
                    let expId = experienceId
                    if (!expId) {
                      const pathParts = window.location.pathname.split('/')
                      expId = pathParts[pathParts.indexOf('experiences') + 1]
                    }
                    
                    console.log('[Disable Button] Using experienceId:', expId)
                    
                    if (expId) {
                      try {
                        // Use type assertion to bypass build cache type issues
                        const success = await (toggleFlowActive as any)(flow.id, false, expId)
                        console.log('[Disable Button] toggleFlowActive result:', success)
                        
                        if (success && onUpdateFlow) {
                          onUpdateFlow({ ...flow, status: "Draft" as const })
                          toast.success("Flow disabled successfully")
                        } else {
                          toast.error("Failed to disable flow")
                        }
                      } catch (error: any) {
                        console.error("[Disable Button] Error disabling flow:", error)
                        toast.error("Failed to disable flow")
                      }
                    } else {
                      console.error("[Disable Button] No experienceId found")
                      toast.error("Cannot disable flow: Experience ID not found")
                    }
                  } else {
                    setShowUploadModal(true)
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-neumorphic-raised hover:shadow-neumorphic-pressed z-10"
                style={{
                  backgroundColor: flow.status === "Live" ? '#ef4444' : '#10b981',
                }}
                title={flow.status === "Live" ? "Disable Flow" : "Enable Flow"}
              >
                {flow.status === "Live" ? (
                  <X className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            )}
          </div>
          {/* Suggestion button - outside title area */}
          <button
            onClick={() => setShowSuggestionModal(true)}
            className="p-1.5 rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-muted-foreground hover:text-foreground"
            title="Send suggestion"
          >
            <Mail className="w-4 h-4" />
          </button>
        </div>
        
        {/* Mode Toggle Buttons - Centered */}
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("create")}
              className={`text-[12px] px-4 py-2 rounded-lg transition-all duration-300 ${
                viewMode === "create"
                  ? "bg-card shadow-neumorphic-inset text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ minWidth: '105px' }}
            >
              Flow Creation
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`text-[12px] px-4 py-2 rounded-lg transition-all duration-300 ${
                viewMode === "analytics"
                  ? "bg-card shadow-neumorphic-inset text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ minWidth: '105px' }}
            >
              Data Analytics
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-1 justify-end">
          {/* Save Changes Button */}
          {onSaveToDatabase && flow && (
            <button
              ref={saveButtonRef}
              onClick={async () => {
                if (flow && hasUnsavedChanges && !isSaving) {
                  setIsSaving(true)
                  // Save collapsedComponents state with flow
                  const flowToSave = {
                    ...flow,
                    collapsedComponents: collapsedComponents
                  } as Flow & { collapsedComponents?: Record<string, boolean> }
                  setLastSavedFlow(JSON.parse(JSON.stringify(flowToSave)))
                  onSaveToDatabase(flowToSave as Flow).catch((error) => {
                    console.error('Error saving flow:', error)
                    setLastSavedFlow((prev) => prev ? JSON.parse(JSON.stringify(prev)) : null)
                  })
                  setTimeout(() => {
                    setIsSaving(false)
                  }, 300)
                }
              }}
              disabled={!hasUnsavedChanges || isSaving}
              className={`font-medium transition-all duration-300 flex items-center justify-center shadow-neumorphic-raised hover:shadow-neumorphic-pressed active:shadow-neumorphic-pressed touch-manipulation ${
                hasUnsavedChanges && !isSaving
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-50'
              }`}
              style={{
                backgroundColor: hasUnsavedChanges ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                color: hasUnsavedChanges ? '#f59e0b' : '#3b82f6',
                border: hasUnsavedChanges ? 'none' : '1px solid rgba(59, 130, 246, 0.3)',
                minWidth: isMobile ? '80px' : '190px',
                minHeight: isMobile ? '44px' : '32px',
                padding: isMobile ? '0 16px' : '0 12px',
                fontSize: isMobile ? '0.75rem' : '0.827rem',
                borderRadius: '10px'
              }}
              title={hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            >
              {isSaving ? (
                <>
                  <div 
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" 
                    style={{
                      borderColor: theme === 'dark' ? 'hsl(220, 9%, 10%)' : 'hsl(220, 14%, 96%)',
                      borderTopColor: 'transparent'
                    }}
                  />
                  <span>Saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <span>Unsaved changes</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  <span>All saved</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div
          ref={canvasRef}
            className={`flex-1 bg-background relative overflow-hidden touch-none ${
            isPanning ? 'cursor-grabbing' : draggingNodeId ? 'cursor-crosshair' : draggingLogicId ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            backgroundImage: `radial-gradient(circle, rgba(100, 100, 100, 0.3) 1px, transparent 1px)`,
            backgroundSize: `24px 24px`,
            backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
          <div className="absolute bottom-4 left-4 z-50 flex items-center gap-3">
          <TierInfo 
            flows={flows} 
            selectedFlow={flow}
            membershipActive={membershipActive}
            maxFlows={maxFlows}
            maxBlocksPerFlow={maxBlocksPerFlow}
          />
            <LogicBlockLibrary 
              onAddLogicBlock={(type) => {
                if (!flow) return
                
                // Find the latest created block (flow or logic)
                let latestBlock: { position: { x: number; y: number } } | null = null
                
                if (lastCreatedBlockId) {
                  const latestFlow = flow.nodes.find(n => n.id === lastCreatedBlockId)
                  const latestLogic = logicBlocks.find(b => b.id === lastCreatedBlockId)
                  latestBlock = latestFlow || latestLogic || null
                }
                
                // If no latest block, use the rightmost block
                if (!latestBlock && flow.nodes.length > 0) {
                  latestBlock = flow.nodes.reduce((rightMost, current) =>
                    current.position.x > rightMost.position.x ? current : rightMost
                  , flow.nodes[0])
                }
                
                // Default position if no blocks exist
                const newPosition = latestBlock
                  ? { x: latestBlock.position.x + 350, y: latestBlock.position.y }
                  : { x: 100, y: 100 }
                
                // Check block limit
                const totalBlocks = flow.nodes.length + (flow.logicBlocks?.length || 0)
                if (totalBlocks >= maxBlocksPerFlow) {
                  if (membershipActive) {
                    toast.error("Plan limit reached")
                  } else {
                    toast.error(`You've reached the limit of ${maxBlocksPerFlow} blocks per flow. Upgrade to Premium for 30 blocks per flow.`)
                    setTimeout(() => {
                      setLimitPopupType("blocks")
                      setLimitPopupCount({ current: totalBlocks, max: maxBlocksPerFlow })
                      setShowLimitPopup(true)
                    }, 1000)
                  }
                  return
                }
                
                const newLogicBlock: LogicBlock = {
                  id: `logic-${Date.now()}`,
                  type: type,
                  position: newPosition,
                  connections: [],
                  config: type === "multi-path" ? { paths: Array(6).fill('') } : {}
                }
                setLastCreatedBlockId(newLogicBlock.id)
                handleLogicBlocksUpdate([...logicBlocks, newLogicBlock])
              }}
              addBlockButtonRef={addBlockButtonRef}
            />
          </div>
          {/* Mobile Controls - Floating buttons */}
          {isMobile && (
            <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
              <button
                onClick={handleZoomIn}
                className="w-12 h-12 rounded-full bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-center touch-manipulation"
                aria-label="Zoom in"
              >
                <Plus className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-12 h-12 rounded-full bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-center touch-manipulation"
                aria-label="Zoom out"
              >
                <Minus className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={handleFitToScreen}
                className="w-12 h-12 rounded-full bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-center touch-manipulation"
                aria-label="Fit to screen"
              >
                <Eye className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={handleResetView}
                className="w-12 h-12 rounded-full bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-center touch-manipulation"
                aria-label="Reset view"
              >
                <ArrowUpDown className="w-5 h-5 text-foreground" />
              </button>
            </div>
          )}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              width: '100%',
              height: '100%',
              overflow: 'visible',
            }}
          >
            <g transform={`translate(${canvasOffset.x}, ${canvasOffset.y}) scale(${zoom})`}>
              {/* Flow block to flow block connections */}
              {(() => {
                const connections = flow.nodes.flatMap((node) => {
                  const nodeConnections = node.connections || []
                  if (!Array.isArray(nodeConnections) || nodeConnections.length === 0) return []
                  
                  return nodeConnections.map((targetId) => {
                    const targetNode = flow.nodes.find((n) => n.id === targetId)
                    if (!targetNode) {
                      console.warn('[RENDER] Flow-to-flow: Target node not found', { nodeId: node.id, targetId })
                      return null
                    }
                    
                    const nodeHeight = flowNodeSizes[node.id] ?? 150
                    const startX = node.position.x + 300
                    const startY = node.position.y + nodeHeight / 2

                    const targetHeight = flowNodeSizes[targetNode.id] ?? 150
                    const endX = targetNode.position.x
                    const endY = targetNode.position.y + targetHeight / 2
                    
                    const controlX1 = startX + (endX - startX) / 3
                    const controlX2 = startX + (2 * (endX - startX)) / 3

                    const d = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`
                    
                    // Calculate midpoint of the curve for delete button
                    const midX = startX + (endX - startX) / 2
                    const midY = (startY + endY) / 2
                    
                    return (
                      <g key={`flow-flow-${node.id}-${targetId}`}>
                        {/* Visible line */}
                        <path
                          d={d}
                          stroke="#10b981"
                          strokeWidth="3"
                          fill="none"
                          vectorEffect="non-scaling-stroke"
                        />
                        {/* Delete button at midpoint */}
                        <g transform={`translate(${midX}, ${midY})`} pointerEvents="all">
                          {/* Large invisible hit area */}
                          <circle cx="0" cy="0" r="15" fill="transparent" stroke="none" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteConnection(e, node.id, targetId); }} />
                          {/* Visible button */}
                          <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteConnection(e, node.id, targetId); }}>
                            <circle cx="0" cy="0" r="10" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="2" />
                            <line x1="-4" y1="-4" x2="4" y2="4" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />
                            <line x1="4" y1="-4" x2="-4" y2="4" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />
                          </g>
                        </g>
                      </g>
                    )
                  }).filter(Boolean)
                })
                
                if (connections.length > 0) {
                  console.log('[RENDER] Flow-to-flow connections found:', connections.length, flow.nodes.map(n => ({ id: n.id, connections: n.connections })))
                }
                
                return connections
              })()}

              {/* Flow block to logic block connections */}
              {flow.nodes.map((node) =>
                node.connections.map((targetId) => {
                  const targetLogic = logicBlocks.find((b) => b.id === targetId)
                  if (!targetLogic) return null

                  const nodeHeight = flowNodeSizes[node.id] ?? 150
                  const startX = node.position.x + 300
                  const startY = node.position.y + nodeHeight / 2

                  const measuredInput = logicBlockPortPositions[targetLogic.id]?.input
                  let endX: number
                  let endY: number
                  if (measuredInput) {
                    endX = measuredInput.x
                    endY = measuredInput.y
                  } else {
                    endX = targetLogic.position.x
                    endY = targetLogic.position.y + (logicBlockSizes[targetLogic.id] ?? 160) / 2
                  }
                  
                  const controlX1 = startX + (endX - startX) / 3
                  const controlX2 = startX + (2 * (endX - startX)) / 3

                  const d = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`
                  
                  // Calculate midpoint of the curve for delete button
                  const midX = startX + (endX - startX) / 2
                  const midY = (startY + endY) / 2
                  
                  return (
                    <g key={`${node.id}-${targetLogic.id}`}>
                      {/* Visible line */}
                      <path
                        d={d}
                        stroke="#10b981"
                        strokeWidth="3"
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Delete button at midpoint */}
                      <g transform={`translate(${midX}, ${midY})`} pointerEvents="all">
                        {/* Large invisible hit area */}
                        <circle cx="0" cy="0" r="15" fill="transparent" stroke="none" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteConnection(e, node.id, targetLogic.id); }} />
                        {/* Visible button */}
                        <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteConnection(e, node.id, targetLogic.id); }}>
                          <circle cx="0" cy="0" r="10" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="2" />
                          <line x1="-4" y1="-4" x2="4" y2="4" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />
                          <line x1="4" y1="-4" x2="-4" y2="4" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />
                        </g>
                      </g>
                    </g>
                  )
                })
              )}
              
              {/* Logic block connections */}
              {logicBlocks.map((block) => {
                let pathCount: number
                if (block.type === "multi-path") {
                  // Always use 6 paths for multi-path blocks
                  pathCount = 6
                } else {
                  pathCount = block.config?.paths?.length || (block.type === "if-else" ? 2 : (block.type === "score-threshold" ? 2 : 2))
                }
                const outputColors = getLogicBlockOutputColors(block.type, pathCount)
                
                return Array.from({ length: pathCount }).map((_, idx) => {
                  const targetId = block.connections[idx]
                  if (!targetId) return null
                  
                  const targetNode = flow.nodes.find((n) => n.id === targetId)
                  if (!targetNode) return null
                  
                  const measuredPort = logicBlockPortPositions[block.id]?.outputs[idx]
                  const blockWidth = block.type === "score-threshold" ? 308 : 280
                  const logicHeight = logicBlockSizes[block.id] ?? 160
                  
                  let startX: number
                  let startY: number
                  
                  if (measuredPort) {
                    startX = measuredPort.x
                    startY = measuredPort.y
                  } else {
                    startX = block.position.x + blockWidth + 1.5
                    if (pathCount === 1) {
                      startY = block.position.y + logicHeight / 2
                    } else {
                      const spacing = logicHeight / (pathCount + 1)
                      startY = block.position.y + spacing * (idx + 1)
                    }
                  }
                  
                  const targetHeight = flowNodeSizes[targetNode.id] ?? 150
                  const endX = targetNode.position.x
                  const endY = targetNode.position.y + targetHeight / 2
                  
                  const controlX1 = startX + (endX - startX) / 3
                  const controlX2 = startX + (2 * (endX - startX)) / 3

                  const d = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`
                  
                  // Calculate midpoint of the curve for delete button
                  const midX = startX + (endX - startX) / 2
                  const midY = (startY + endY) / 2
                  
                  return (
                    <g key={`${block.id}-${targetId}-${idx}`}>
                      {/* Visible colored line */}
                      <path
                        d={d}
                        stroke={outputColors[idx] || "#10b981"}
                        strokeWidth="3"
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Delete button at midpoint */}
                      <g transform={`translate(${midX}, ${midY})`} pointerEvents="all">
                        {/* Large invisible hit area */}
                        <circle cx="0" cy="0" r="15" fill="transparent" stroke="none" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteConnection(e, block.id, targetId); }} />
                        {/* Visible button */}
                        <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteConnection(e, block.id, targetId); }}>
                          <circle cx="0" cy="0" r="10" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="2" />
                          <line x1="-4" y1="-4" x2="4" y2="4" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />
                          <line x1="4" y1="-4" x2="-4" y2="4" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />
                        </g>
                      </g>
                    </g>
                  )
                })
              })}
              
              {/* Connection line being drawn */}
              {connectingFrom && connectionLineStart && connectionLineEnd && (() => {
                const sourceLogic = logicBlocks.find(b => b.id === connectingFrom)
                let strokeColor = "#10b981"
                
                if (sourceLogic && connectingPortIndex !== undefined) {
                  let pathCount: number
                  if (sourceLogic.type === "multi-path") {
                    // Always use 6 paths for multi-path blocks
                    pathCount = 6
                  } else {
                    pathCount = sourceLogic.type === "if-else" || sourceLogic.type === "a-b-test" || sourceLogic.type === "score-threshold" ? 2 : 2
                  }
                  const outputColors = getLogicBlockOutputColors(sourceLogic.type, pathCount)
                  strokeColor = outputColors[connectingPortIndex] || "#10b981"
                }
                
                const startX = connectionLineStart.x
                const startY = connectionLineStart.y
                const controlX1 = startX + (connectionLineEnd.x - startX) / 3
                const controlX2 = startX + (2 * (connectionLineEnd.x - startX)) / 3
                
                return (
                  <path
                    d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${connectionLineEnd.y}, ${connectionLineEnd.x} ${connectionLineEnd.y}`}
                    stroke={strokeColor}
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="8,8"
                    vectorEffect="non-scaling-stroke"
                    className="opacity-60"
                  />
                )
              })()}
            </g>
          </svg>

          <div 
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              inset: 0
            }}
          >
            {/* Flow blocks */}
            {flow.nodes.map((node, nodeIndex) => {
              // Pre-calculate expensive operations once per render cycle
              const isConnectedAsTarget = flow.nodes.some(n => n.connections.includes(node.id)) || logicBlocks.some(b => b.connections.includes(node.id))
              const incomingColor = getIncomingColorForNode(node.id)
              
              return (
                <FlowNodeComponent
                  key={node.id}
                  node={node}
                  index={nodeIndex}
                  selected={selectedNodeId === node.id}
                  dragging={draggingNodeId === node.id}
                  isConnectedAsTarget={isConnectedAsTarget}
                  incomingColor={incomingColor}
                  isMobile={isMobile}
                  theme={theme}
                  collapsed={!!collapsedComponents[node.id]}
                  showComponentLibrary={showComponentLibraryForNode === node.id}
                  onMouseDown={handleNodeMouseDown}
                  onStartConnection={handleStartConnection}
                  onEndConnection={handleEndConnection}
                  onPortMouseEnter={handlePortMouseEnter}
                  onPortMouseLeave={handlePortMouseLeave}
                  onPreview={(e) => {
                    e.stopPropagation()
                    // Clear A/B test decisions when starting a new preview session
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
                    // Find the node in flow.nodes and set preview to show that node
                    const nodeIndex = flow.nodes.findIndex(n => n.id === node.id)
                    if (nodeIndex !== -1) {
                      setPreviewClickedNodeId(node.id) // Track the clicked node
                      setPreviewNodeIndex(nodeIndex) // Start at the clicked node
                      setShowPreview(true)
                    }
                  }}
                  onUpdateTitle={(nodeId, title) => {
                    if (flow) {
                      const updatedNodes = flow.nodes.map(n =>
                        n.id === nodeId ? { ...n, title } : n
                      )
                      onUpdateFlow({ ...flow, nodes: updatedNodes })
                    }
                  }}
                  membershipActive={membershipActive}
                  onUpgrade={() => setShowUpgradeModal(true)}
                  onResize={(nodeId, height) => {
                    setFlowNodeSizes((prev) =>
                      prev[nodeId] === height ? prev : { ...prev, [nodeId]: height }
                    )
                  }}
                  onToggleCollapse={() => {
                    setCollapsedComponents(prev => ({
                      ...prev,
                      [node.id]: !prev[node.id]
                    }))
                  }}
                  onToggleComponentLibrary={() => {
                    setShowComponentLibraryForNode(prev => prev === node.id ? null : node.id)
                  }}
                  onAddComponent={(type) => handleAddComponent(node.id, type)}
                  onUpdateComponent={(id, config) => handleUpdateComponent(node.id, id, config)}
                  onDeleteComponent={(id) => handleDeleteComponent(node.id, id)}
                />
              )
            })}

            {/* Logic blocks */}
            {logicBlocks.map((block) => {
              let pathCount: number
              if (block.type === "multi-path") {
                const paths = block.config?.paths || []
                // Always show 6 ports for multi-path blocks
                pathCount = 6
              } else {
                pathCount = block.type === "if-else" || block.type === "a-b-test" || block.type === "score-threshold" ? 2 : 2
              }
              const outputColors = getLogicBlockOutputColors(block.type, pathCount)
              const isConnectedAsTarget = flow.nodes.some(n => n.connections.includes(block.id))
              
              return (
                <div
                  key={block.id}
                  data-logic-block-id={block.id}
                  className={`logic-block absolute ${selectedLogicId === block.id ? 'ring-2 ring-primary/50 rounded-xl' : ''}`}
                  style={{
                    left: block.position.x,
                    top: block.position.y,
                    zIndex: draggingLogicId === block.id ? 20 : 10,
                    cursor: draggingLogicId === block.id ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={(e) => handleLogicBlockMouseDown(e, block.id)}
                  ref={(el) => {
                    if (el) {
                      const height = el.offsetHeight
                      setLogicBlockSizes((prev) =>
                        prev[block.id] === height ? prev : { ...prev, [block.id]: height }
                      )
                    }
                  }}
                >
                  {/* Logic input port: centered on card */}
                  <div
                    data-block-id={block.id}
                    data-port-index="input"
                    className="connection-port absolute left-0 -translate-x-1/2 w-3 h-3 rounded-full z-40 -translate-y-1/2 hover:scale-150 transition-transform cursor-crosshair"
                    style={{
                      top: `${(logicBlockSizes[block.id] ?? 160) / 2}px`,
                      backgroundColor: isConnectedAsTarget ? "#10b981" : "var(--muted-foreground)",
                      borderColor: isConnectedAsTarget ? "#10b981" : "var(--muted-foreground)",
                      borderWidth: "2px",
                    }}
                    title="Input port"
                    onMouseUp={(e) => handleEndConnection(e, block.id)}
                    onMouseEnter={() => handlePortMouseEnter(block.id, "input")}
                    onMouseLeave={() => handlePortMouseLeave()}
                  />
                  
                  {/* Output ports - only show for paths that have content */}
                  {(() => {
                    // Calculate port positions - equally spaced
                    const logicHeight = logicBlockSizes[block.id] ?? 160
                      const spacing = logicHeight / (pathCount + 1)
                    
                    return Array.from({ length: pathCount }).map((_, idx) => {
                      const topPosition = spacing * (idx + 1)
                    
                    return (
                      <div 
                        key={idx}
                        data-port-index={idx}
                        data-block-id={block.id}
                        className={`connection-port absolute right-0 w-3 h-3 rounded-full z-40 translate-x-1/2 -translate-y-1/2 transition-all cursor-crosshair hover:scale-150`}
                        style={{ 
                          top: `${topPosition}px`,
                          backgroundColor: outputColors[idx] || "#10b981",
                          borderColor: outputColors[idx] || "#10b981",
                          borderWidth: '2px'
                        }}
                        title={`Output ${idx + 1}`}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleStartConnection(e, block.id, idx)
                        }}
                        onMouseEnter={() => handlePortMouseEnter(block.id, "output", idx)}
                        onMouseLeave={() => handlePortMouseLeave()}
                      />
                    )
                    })
                  })()}

                  <div 
                    className={`bg-card rounded-xl p-4 ${block.type === "score-threshold" ? 'w-[308px]' : 'w-[280px]'} shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all cursor-move ${
                      (showVariableDropdown[block.id] && getPreviousBlockOptions(block.id).length > 0) 
                        ? 'min-h-[500px]' 
                        : ''
                    }`}
                  >
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      {block.type === "if-else" && "IF / ELSE Logic"}
                      {block.type === "multi-path" && "Multi-Path Switch"}
                      {block.type === "score-threshold" && "Score Threshold"}
                      {block.type === "a-b-test" && "A/B Test"}
                    </div>
                    
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      {block.type === "if-else" && (() => {
                        const options = getPreviousBlockOptions(block.id)
                        const showDropdown = showVariableDropdown[block.id] || false
                        
                        // Check if previous question is multiple-choice
                        const sourceNode = flow.nodes.find(node => node.connections.includes(block.id))
                        let isMultipleChoice = false
                        if (sourceNode) {
                          const components = normalizePageComponents(sourceNode.pageComponents)
                          const questionComponent = components.find(
                            comp => ["multiple-choice", "checkbox-multi"].includes(comp.type)
                          )
                          isMultipleChoice = questionComponent?.type === "multiple-choice" || questionComponent?.type === "checkbox-multi"
                        }
                        
                        const conditions = block.config?.conditions || ['']
                        const filledConditions = conditions.filter(c => c && c.trim().length > 0)
                        
                        return (
                          <>
                            {options.length > 0 && (
                              <div className="mb-2" data-variable-dropdown>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowVariableDropdown(prev => ({ ...prev, [block.id]: !prev[block.id] }))
                                  }}
                                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-between border border-border"
                                >
                                  <span>Variables</span>
                                  <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showDropdown && (
                                  <div className="mt-1 bg-card rounded-lg shadow-neumorphic-raised border border-border z-50">
                                    {options.map((option, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.stopPropagation()
                                          setDraggingVariable({ value: option, blockId: block.id })
                                          setDragVariablePosition({ x: e.clientX, y: e.clientY })
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors cursor-grab active:cursor-grabbing ${
                                          idx === options.length - 1 ? '' : 'border-b border-border/30'
                                        }`}
                                      >
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Display conditions as green text list */}
                            {filledConditions.length > 0 && (
                              <div className="mb-2 text-[#10b981] text-xs font-medium">
                                {filledConditions.map((condition, idx) => (
                                  <span key={idx}>
                                    {condition}
                                    {idx < filledConditions.length - 1 && (
                                      <span className="mx-1">{isMultipleChoice ? 'OR' : 'AND'}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Condition input slots */}
                            <div className="space-y-2">
                              {conditions.map((condition, slotIdx) => (
                                <div key={slotIdx} className="flex items-center gap-2">
                                  <div className="flex-1 relative">
                                    <input
                                      type="text"
                                      placeholder="Drop variable or type condition"
                                      value={condition}
                                      onChange={(e) => {
                                        const updatedConditions = [...conditions]
                                        updatedConditions[slotIdx] = e.target.value
                                        const updatedBlocks = logicBlocks.map(b => 
                                          b.id === block.id 
                                            ? { ...b, config: { ...b.config, conditions: updatedConditions } }
                                            : b
                                        )
                                        handleLogicBlocksUpdate(updatedBlocks)
                                      }}
                                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-card shadow-neumorphic-inset border-2 border-transparent text-[#10b981] placeholder:text-muted-foreground focus:outline-none focus:border-[#10b981]/50"
                                      onDragOver={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        e.currentTarget.classList.add('ring-2', 'ring-[#10b981]/50')
                                      }}
                                      onDragLeave={(e) => {
                                        e.currentTarget.classList.remove('ring-2', 'ring-[#10b981]/50')
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        e.currentTarget.classList.remove('ring-2', 'ring-[#10b981]/50')
                                        if (draggingVariable && draggingVariable.blockId === block.id) {
                                          const updatedConditions = [...conditions]
                                          updatedConditions[slotIdx] = draggingVariable.value
                                          const updatedBlocks = logicBlocks.map(b => 
                                            b.id === block.id 
                                              ? { ...b, config: { ...b.config, conditions: updatedConditions } }
                                              : b
                                          )
                                          handleLogicBlocksUpdate(updatedBlocks)
                                          setDraggingVariable(null)
                                        }
                                      }}
                                      data-drop-target
                                      data-block-id={block.id}
                                      data-field-type="condition"
                                      data-slot-index={slotIdx}
                                    />
                                  </div>
                                  {conditions.length > 1 && (
                                    <button
                                      onClick={() => {
                                        const updatedConditions = conditions.filter((_, idx) => idx !== slotIdx)
                                        const updatedBlocks = logicBlocks.map(b => 
                                          b.id === block.id 
                                            ? { ...b, config: { ...b.config, conditions: updatedConditions.length > 0 ? updatedConditions : [''] } }
                                            : b
                                        )
                                        handleLogicBlocksUpdate(updatedBlocks)
                                      }}
                                      className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const currentConditions = block.config?.conditions || ['']
                                  const updatedBlocks = logicBlocks.map(b => 
                                    b.id === block.id 
                                      ? { ...b, config: { ...b.config, conditions: [...currentConditions, ''] } }
                                      : b
                                  )
                                  handleLogicBlocksUpdate(updatedBlocks)
                                }}
                                className="w-full px-3 py-1.5 text-xs rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all text-muted-foreground"
                              >
                                + Add Condition Slot
                              </button>
                            </div>
                            {/* Routing explanation */}
                            <div className="space-y-1.5 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <div 
                                  data-block-id={block.id}
                                  data-port-index="0"
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: outputColors[0] }}
                                ></div>
                                <span>If true → connects to page A</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div 
                                  data-block-id={block.id}
                                  data-port-index="1"
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: outputColors[1] }}
                                ></div>
                                <span>If false → connects to page B</span>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                      
                      {block.type === "multi-path" && (() => {
                        const options = getPreviousBlockOptions(block.id)
                        // Initialize with 6 paths if not set
                        let paths = block.config?.paths || []
                        if (paths.length === 0) {
                          paths = Array(6).fill('')
                        } else if (paths.length < 6) {
                          // Extend to 6 if less than 6
                          paths = [...paths, ...Array(6 - paths.length).fill('')]
                        }
                        const showDropdown = showVariableDropdown[block.id] || false
                        // Get colors for all 6 paths
                        const multiPathColors = getLogicBlockOutputColors(block.type, 6)
                        
                        return (
                          <div className="space-y-1.5">
                            {options.length > 0 && (
                              <div className="mb-2" data-variable-dropdown>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowVariableDropdown(prev => ({ ...prev, [block.id]: !prev[block.id] }))
                                  }}
                                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-card shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all flex items-center justify-between border border-border"
                                >
                                  <span>Variables</span>
                                  <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showDropdown && (
                                  <div className="mt-1 bg-card rounded-lg shadow-neumorphic-raised border border-border z-50">
                                    {options.map((option, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.stopPropagation()
                                          setDraggingVariable({ value: option, blockId: block.id })
                                          setDragVariablePosition({ x: e.clientX, y: e.clientY })
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors cursor-grab active:cursor-grabbing ${
                                          idx === options.length - 1 ? '' : 'border-b border-border/30'
                                        }`}
                                      >
                                        {option}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {paths.map((path, idx) => (
                              <div key={idx} className="relative flex items-center gap-1">
                                <div 
                                  data-block-id={block.id}
                                  data-path-index={idx}
                                  className="flex-1 relative"
                                >
                                  <input
                                    type="text"
                                    placeholder={`Answer ${idx + 1} → Page ID`}
                                    value={path}
                                    onChange={(e) => {
                                      const newPaths = [...paths]
                                      newPaths[idx] = e.target.value
                                      const updatedBlocks = logicBlocks.map(b => 
                                        b.id === block.id 
                                          ? { ...b, config: { ...b.config, paths: newPaths } }
                                          : b
                                      )
                                      handleLogicBlocksUpdate(updatedBlocks)
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.currentTarget.style.borderColor = 'hsl(var(--primary))'
                                    }}
                                    onDragLeave={(e) => {
                                      e.currentTarget.style.borderColor = ''
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.currentTarget.style.borderColor = ''
                                      if (draggingVariable && draggingVariable.blockId === block.id) {
                                        const newPaths = [...paths]
                                        const currentPath = newPaths[idx] || ''
                                        newPaths[idx] = currentPath 
                                          ? `${currentPath} ${draggingVariable.value}`
                                          : draggingVariable.value
                                        const updatedBlocks = logicBlocks.map(b => 
                                          b.id === block.id 
                                            ? { ...b, config: { ...b.config, paths: newPaths } }
                                            : b
                                        )
                                        handleLogicBlocksUpdate(updatedBlocks)
                                        setDraggingVariable(null)
                                      }
                                    }}
                                    data-drop-target
                                    data-block-id={block.id}
                                    data-field-type="path"
                                    data-field-index={idx.toString()}
                                    data-path-index={idx}
                                    className="w-full px-3 py-1.5 pr-8 text-xs rounded-lg bg-card shadow-neumorphic-inset focus:outline-none border-2 border-transparent transition-colors"
                                    style={{
                                      color: multiPathColors[idx] || "#10b981"
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                      
                      {block.type === "score-threshold" && (
                        <div className="space-y-2 text-[10px] text-muted-foreground pb-[15px]">
                          <input
                            data-block-id={block.id}
                            data-input-field="true"
                            type="number"
                            placeholder="Threshold (1–100)"
                            value={block.config?.threshold ?? ''}
                            onChange={(e) => {
                              const next = Number.isNaN(parseInt(e.target.value))
                                ? undefined
                                : parseInt(e.target.value)
                              const updatedBlocks = logicBlocks.map(b => 
                                b.id === block.id 
                                  ? { ...b, config: { ...b.config, threshold: next } }
                                  : b
                              )
                              handleLogicBlocksUpdate(updatedBlocks)
                            }}
                            className="w-full px-3 py-1.5 text-[10px] rounded-lg bg-card shadow-neumorphic-inset focus:outline-none"
                          />
                          <p className="flex items-center gap-2">
                            <span
                              data-block-id={block.id}
                              data-port-index="0"
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: outputColors[0] }}
                            />
                            Score ≥ threshold → connect this port to the "high score" page
                          </p>
                          <p className="flex items-center gap-2">
                            <span
                              data-block-id={block.id}
                              data-port-index="1"
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: outputColors[1] }}
                            />
                            Score &lt; threshold → connect this port to the "low score" page
                          </p>
                        </div>
                      )}
                      
                      {block.type === "a-b-test" && (
                        <div className="space-y-1.5">
                          <p 
                            data-block-id={block.id}
                            data-input-field="true"
                            className="text-xs text-muted-foreground"
                          >
                            Randomly routes 50% of users to each connected page
                          </p>
                          <div className="space-y-1.5 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <div 
                                data-block-id={block.id}
                                data-port-index="0"
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: outputColors[0] }}
                              ></div>
                              <span>50% → connects to page A</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div 
                                data-block-id={block.id}
                                data-port-index="1"
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: outputColors[1] }}
                              ></div>
                              <span>50% → connects to page B</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>


        {/* Add button - above zoom */}
        <div className="fixed bottom-[80px] right-6 z-[100] pointer-events-auto">
          <button
            ref={addBlockButtonRef}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!flow) {
                console.error('Flow is null')
                return
              }
              
              // Find the latest created block (flow or logic)
              let latestBlock: { position: { x: number; y: number } } | null = null
              
              if (lastCreatedBlockId) {
                const latestFlow = flow.nodes.find(n => n.id === lastCreatedBlockId)
                const latestLogic = logicBlocks.find(b => b.id === lastCreatedBlockId)
                latestBlock = latestFlow || latestLogic || null
              }
              
              // If no latest block, use the rightmost block
              if (!latestBlock && flow.nodes.length > 0) {
                latestBlock = flow.nodes.reduce((rightMost, current) =>
                  current.position.x > rightMost.position.x ? current : rightMost
                , flow.nodes[0])
              }
              
              // Default position if no blocks exist
              const newPosition = latestBlock
                ? { x: latestBlock.position.x + 350, y: latestBlock.position.y }
                : { x: 100, y: 100 }
              
              // Check block limit - enforce strictly
              const totalBlocks = flow.nodes.length + (flow.logicBlocks?.length || 0)
              if (totalBlocks >= maxBlocksPerFlow) {
                if (membershipActive) {
                  toast.error("Plan limit reached")
                } else {
                  toast.error(`You've reached the limit of ${maxBlocksPerFlow} blocks per flow. Upgrade to Premium for 30 blocks per flow.`)
                  // Wait 1 second before showing popup
                  setTimeout(() => {
                    setLimitPopupType("blocks")
                    setLimitPopupCount({ current: totalBlocks, max: maxBlocksPerFlow })
                    setShowLimitPopup(true)
                  }, 1000)
                }
                return
              }
              
              const newNode: FlowNode = {
                id: `node-${Date.now()}`,
                title: "New Step",
                components: 0,
                completion: 0,
                position: newPosition,
                connections: [],
                pageComponents: []
              }
              
              const updatedFlow: Flow = {
                ...flow,
                nodes: [...flow.nodes, newNode]
              }
              
              setLastCreatedBlockId(newNode.id)
              onUpdateFlow(updatedFlow)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
            className="w-16 h-9 bg-primary text-primary-foreground shadow-neumorphic-raised rounded-lg flex items-center justify-center hover:shadow-neumorphic-pressed transition-all duration-300 cursor-pointer pointer-events-auto"
            title="Add new flow block"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-6 right-6 z-30">
          <div className="text-center text-xs font-medium text-muted-foreground bg-card/80 backdrop-blur-sm rounded-lg py-1.5 px-3 shadow-neumorphic-subtle">
            {Math.round(zoom * 100)}%
          </div>
        </div>

      </div>

      {/* Dragging logic block cursor follower */}
      {draggingLogicType && (
        <div
          className="fixed pointer-events-none z-[100] bg-card/95 backdrop-blur-sm shadow-neumorphic-raised rounded-lg px-3 py-2 border border-muted/30"
          style={{
            left: dragCursorPosition.x,
            top: dragCursorPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide">
            {draggingLogicType === "if-else" && "IF / ELSE"}
            {draggingLogicType === "multi-path" && "MULTI-PATH"}
            {draggingLogicType === "score-threshold" && "SCORE CHECK"}
          </p>
        </div>
      )}

      {/* Dragging variable cursor follower */}
      {draggingVariable && (
        <div
          className="fixed pointer-events-none z-[100] bg-primary/95 backdrop-blur-sm shadow-neumorphic-raised rounded-lg px-3 py-2 border border-primary/30"
          style={{
            left: dragVariablePosition.x,
            top: dragVariablePosition.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <p className="text-xs font-medium text-primary-foreground">{draggingVariable.value}</p>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && flow && (
        <PreviewModal
          flow={flow}
          logicBlocks={logicBlocks}
          previewNodeIndex={previewNodeIndex}
          setPreviewNodeIndex={setPreviewNodeIndex}
          previewAnswers={previewAnswers}
          setPreviewAnswers={setPreviewAnswers}
          setShowPreview={setShowPreview}
          previewClickedNodeId={previewClickedNodeId}
          setPreviewClickedNodeId={setPreviewClickedNodeId}
        />
      )}


      {/* Upload Flow Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentPlan="free"
        />
      )}

      {showLimitPopup && (
        <UpgradeLimitPopup
          limitType={limitPopupType}
          currentCount={limitPopupCount.current}
          maxCount={limitPopupCount.max}
          onUpgrade={() => {
            setShowLimitPopup(false)
            setShowUpgradeModal(true)
          }}
          onClose={() => setShowLimitPopup(false)}
        />
      )}
      {showUploadModal && flow && (
        <UploadFlowModal
          onClose={() => setShowUploadModal(false)}
          flowId={flow.id}
          flowTitle={flow.title}
          experienceId={experienceId || ""}
          onSuccess={() => {
            // Refresh the flow status after upload
            if (onUpdateFlow) {
              onUpdateFlow({ ...flow, status: "Live" as const })
            }
          }}
        />
      )}

      {/* Delete Node Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div 
            className="bg-card rounded-xl p-6 max-w-md w-full mx-4 shadow-neumorphic-raised border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Flow Block</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. The block "<strong>{showDeleteConfirm.nodeTitle}</strong>" and all components and data tied to it will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!flow || !showDeleteConfirm) return
                  
                  const nodeId = showDeleteConfirm.nodeId
                  
                  // Delete associated data
                  await Promise.all([
                    deleteNodeResponses(nodeId),
                    deleteNodePaths(nodeId)
                  ])
                  
                  // Remove all connections TO this node from other flow nodes
                  const updatedNodes = flow.nodes
                    .filter(n => n.id !== nodeId)
                    .map(n => ({
                      ...n,
                      connections: n.connections.filter(id => id !== nodeId)
                    }))
                  // Remove all connections TO this node from logic blocks
                  const updatedLogicBlocks = logicBlocks.map(b => ({
                    ...b,
                    connections: b.connections.filter(id => id !== nodeId)
                  }))
                  handleLogicBlocksUpdate(updatedLogicBlocks)
                  onUpdateFlow({ ...flow, nodes: updatedNodes })
                  // Update lastCreatedBlockId if deleted block was the last created
                  if (lastCreatedBlockId === nodeId) {
                    setLastCreatedBlockId(null)
                  }
                  setSelectedNodeId(null)
                  setShowDeleteConfirm(null)
                  toast.success("Flow block deleted")
                }}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Suggestion Modal */}
      {showSuggestionModal && (
        <div className="fixed inset-0 z-[300] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 shadow-neumorphic-raised border border-border max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Send Suggestion</h3>
              <button
                onClick={() => {
                  setShowSuggestionModal(false)
                  setSuggestionText("")
                }}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Share your feedback or suggestions to help us improve..."
              className="w-full bg-background border border-border rounded-lg px-4 py-3 mb-4 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSuggestionModal(false)
                  setSuggestionText("")
                }}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!suggestionText.trim()) return
                  try {
                    const response = await fetch('/api/suggestions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: suggestionText, experienceId })
                    })
                    if (response.ok) {
                      toast.success('Thank you for your suggestion!')
                      setShowSuggestionModal(false)
                      setSuggestionText("")
                    } else {
                      toast.error('Failed to send suggestion')
                    }
                  } catch (error) {
                    toast.error('Failed to send suggestion')
                  }
                }}
                disabled={!suggestionText.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Preview Modal Component - extracted to ensure proper React re-renders
function PreviewModal({
  flow,
  logicBlocks,
  previewNodeIndex,
  setPreviewNodeIndex,
  previewAnswers,
  setPreviewAnswers,
  setShowPreview,
  previewClickedNodeId,
  setPreviewClickedNodeId
}: {
  flow: Flow
  logicBlocks: LogicBlock[]
  previewNodeIndex: number
  setPreviewNodeIndex: React.Dispatch<React.SetStateAction<number>>
  previewAnswers: Record<string, any>
  setPreviewAnswers: React.Dispatch<React.SetStateAction<Record<string, any>>>
  setShowPreview: React.Dispatch<React.SetStateAction<boolean>>
  previewClickedNodeId: string | null
  setPreviewClickedNodeId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  // Don't track sessions in preview mode - preview is for creator testing only
  // Session tracking removed to prevent preview from counting as real flow sessions
  const sessionId = null // Always null in preview mode

  // Helper function to evaluate logic block (must be defined before getNextNodeFromCurrent)
  const evaluateLogicBlock = (block: LogicBlock, answer: any): string | null => {
    if (block.type === "if-else") {
      // Use conditions array (slots) if available, otherwise fallback to condition string
      const conditionsList = block.config?.conditions || []
      const filledConditions = conditionsList.filter(c => c && c.trim().length > 0)
      
      // If no conditions specified, default to false path
      if (filledConditions.length === 0) {
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
      
      // Handle array answers (checkbox-multi or multiple-choice treated as array)
      if (Array.isArray(answer)) {
        if (isMultipleChoice) {
          // OR logic: match if ANY condition matches ANY answer
        matches = filledConditions.some(cond => {
          const condStr = cond.trim().toLowerCase()
          return answer.some(ans => {
            const answerStr = ans.toString().trim().toLowerCase()
            return answerStr === condStr || answerStr.includes(condStr) || condStr.includes(answerStr)
          })
        })
        } else {
          // AND logic: ALL conditions must match
          matches = filledConditions.every(cond => {
          const condStr = cond.trim().toLowerCase()
          return answer.some(ans => {
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
        matches = filledConditions.some(cond => {
          const condStr = cond.trim().toLowerCase()
          return answerStr === condStr || answerStr.includes(condStr) || condStr.includes(answerStr)
        })
        } else {
          // AND logic: ALL conditions must match (convert string to array for comparison)
          matches = filledConditions.every(cond => {
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
        return block.connections[0] || null
      }
      
      // Get the answer value to match
      let answerValue: string | null = null
      if (Array.isArray(answer) && answer.length > 0) {
        answerValue = answer[0]?.toString().trim() || null
      } else if (typeof answer === 'string') {
        answerValue = answer.trim()
      }
      
      if (!answerValue) {
        return block.connections[0] || null
      }
      
      // Find which path matches the answer
      // Paths contain variables like "Option A" or "Answer 1 → Page ID"
      // We need to match the answer to the path content
      let matchingPathIndex = -1
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i]
        if (!path || path.trim().length === 0) continue
        
        // Extract the variable/answer part from the path (before "→" if present)
        const pathValue = path.split('→')[0].trim()
        
        // Match answer to path value
        if (pathValue.toLowerCase() === answerValue.toLowerCase() ||
            pathValue.toLowerCase().includes(answerValue.toLowerCase()) ||
            answerValue.toLowerCase().includes(pathValue.toLowerCase())) {
          matchingPathIndex = i
          break
        }
      }
      
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
      // Key format: `ab-test-${flow.id}-${block.id}`
      const storageKey = `ab-test-${flow.id}-${block.id}`
      
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

  // Get next node based on current node and answer (must be defined before buildPathFromAnswers)
  const getNextNodeFromCurrent = (node: FlowNode, answer?: any): FlowNode | null => {
    const connectedLogicBlock = logicBlocks.find(lb => node.connections.includes(lb.id))
    
    if (connectedLogicBlock) {
      // Always evaluate the logic block with the answer (even if null/undefined for A/B tests)
      const targetId = evaluateLogicBlock(connectedLogicBlock, answer)
      if (targetId) {
        const targetNode = flow.nodes.find(n => n.id === targetId)
        if (targetNode) {
          return targetNode
        }
      }
      // If evaluation failed, check if logic block has connections as fallback
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
      const isLogicBlock = logicBlocks.some(lb => lb.id === nextId)
      if (!isLogicBlock) {
        const nextNode = flow.nodes.find(n => n.id === nextId)
        if (nextNode) {
          return nextNode
        }
      } else {
        // If it's a logic block, we need to evaluate it with the answer
        const nextLogicBlock = logicBlocks.find(lb => lb.id === nextId)
        if (nextLogicBlock) {
          // Always evaluate the logic block with the answer (even if null/undefined for A/B tests)
          const targetId = evaluateLogicBlock(nextLogicBlock, answer)
          if (targetId) {
            const targetNode = flow.nodes.find(n => n.id === targetId)
            if (targetNode) {
              return targetNode
            }
          }
          // Fallback to first connection of logic block if evaluation failed
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

  // Build path dynamically - recalculate each render to ensure A/B test randomizes
  const buildPathFromAnswers = (): FlowNode[] => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) return []
    
    const path: FlowNode[] = []
    const visited = new Set<string>()
    
    // Find first node
    let currentNode: FlowNode | undefined = flow.nodes.find(node => {
      const hasIncoming = flow.nodes.some(n => n.connections.includes(node.id))
      const hasLogicIncoming = logicBlocks.some(lb => lb.connections.includes(node.id))
      return !hasIncoming && !hasLogicIncoming
    })
    
    // If no first node found (all nodes have incoming), use the first node
    if (!currentNode && flow.nodes.length > 0) {
      currentNode = flow.nodes[0]
    }
    
    // Traverse following connections and logic
    while (currentNode && !visited.has(currentNode.id)) {
      visited.add(currentNode.id)
      path.push(currentNode)
      
      const answer = previewAnswers[currentNode.id]
      const nextNode = getNextNodeFromCurrent(currentNode, answer)
      currentNode = nextNode || undefined
    }
    
    return path
  }

  // Store the actual path taken (so A/B test randomizes once per navigation, not on every render)
  const [actualPathTaken, setActualPathTaken] = useState<FlowNode[]>(() => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) return []
    return buildPathFromAnswers()
  })
  
  // Clear A/B test decisions when preview resets (starts from beginning)
  useEffect(() => {
    if (!flow) return
    
    // When preview is at index 0, clear previous A/B test decisions for this flow
    // This ensures a fresh 50/50 chance on each new preview session
    if (previewNodeIndex === 0 && typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith(`ab-test-${flow.id}-`)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key))
    }
  }, [previewNodeIndex, flow?.id])
  
  // Rebuild path when answers change or when preview opens (but preserve visited nodes up to current index)
  useEffect(() => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) return
    
    if (previewNodeIndex === 0 || actualPathTaken.length === 0) {
      // If we're at the start or path is empty, rebuild the entire path
      const newPath = buildPathFromAnswers()
      if (newPath.length > 0) {
        setActualPathTaken(newPath)
      }
    } else {
      // If we're in the middle, rebuild from current position forward
      if (actualPathTaken.length <= previewNodeIndex) return
      
      const visitedNodes = actualPathTaken.slice(0, previewNodeIndex + 1)
      const visitedIds = new Set(visitedNodes.map(n => n.id))
      
      // Build path from current node forward
      let currentNode: FlowNode | undefined = actualPathTaken[previewNodeIndex]
      const newPath: FlowNode[] = [...visitedNodes]
      
      while (currentNode && !visitedIds.has(currentNode.id)) {
        visitedIds.add(currentNode.id)
        const answer = previewAnswers[currentNode.id]
        const nextNode = getNextNodeFromCurrent(currentNode, answer)
        if (nextNode && !visitedIds.has(nextNode.id)) {
          newPath.push(nextNode)
          currentNode = nextNode
        } else {
          break
        }
      }
      
      // Only update if path actually changed
      if (JSON.stringify(newPath.map(n => n.id)) !== JSON.stringify(actualPathTaken.map(n => n.id))) {
        setActualPathTaken(newPath)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewAnswers, previewNodeIndex, flow?.id, flow?.nodes])
  
  // Use actual path taken - ensure we have nodes
  const pathNodes = actualPathTaken.length > 0 ? actualPathTaken : (flow?.nodes || [])
  // Ensure previewNodeIndex is within bounds
  const safePreviewNodeIndex = Math.min(previewNodeIndex, Math.max(0, pathNodes.length - 1))
  // If a specific node was clicked, show that node's components directly
  const currentPreviewNode = previewClickedNodeId 
    ? flow.nodes.find(n => n.id === previewClickedNodeId) || pathNodes[safePreviewNodeIndex] || pathNodes[0]
    : (pathNodes[safePreviewNodeIndex] || pathNodes[0])
  
  // Rebuild path when preview opens or flow changes (but not when a specific node was clicked)
  useEffect(() => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) {
      setActualPathTaken([])
      return
    }
    
    // If a specific node was clicked, don't rebuild the path - just show that node
    if (previewClickedNodeId) {
      // Set the path to just the clicked node
      const clickedNode = flow.nodes.find(n => n.id === previewClickedNodeId)
      if (clickedNode) {
        setActualPathTaken([clickedNode])
        const nodeIndex = flow.nodes.findIndex(n => n.id === previewClickedNodeId)
        if (nodeIndex !== -1) {
          setPreviewNodeIndex(0) // Use index 0 since we only have one node in the path
        }
      }
      return
    }
    
    // Always rebuild path to ensure we have the latest data
    const newPath = buildPathFromAnswers()
    // If path only has 1 node but there are multiple nodes, use all nodes instead
    // This ensures we can preview all pages even if they're not connected
    if (newPath.length === 1 && flow.nodes.length > 1) {
      setActualPathTaken(flow.nodes)
      setPreviewNodeIndex(0)
    } else if (newPath.length > 0) {
      setActualPathTaken(newPath)
      // Reset preview index to 0 if current index is out of bounds
      if (previewNodeIndex >= newPath.length || previewNodeIndex < 0) {
        setPreviewNodeIndex(0)
      }
    } else {
      // If path is empty (no connections), use all flow.nodes as fallback
      setActualPathTaken(flow.nodes)
      setPreviewNodeIndex(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.id, previewClickedNodeId]) // Rebuild when flow changes or clicked node changes
  
  // Don't initialize session in preview mode - preview is for creator testing only
  // Sessions should only be created in the real onboarding flow (app/experiences/[experienceId]/flow/page.tsx)
  
  // Don't track path visits in preview mode - preview is for creator testing only

  // Get current answer - this will trigger re-render when previewAnswers changes
  const currentAnswer = currentPreviewNode ? previewAnswers[currentPreviewNode.id] : undefined
  
  // Calculate hasAnswer - this will recalculate on every render when previewAnswers changes
  const hasAnswer = currentPreviewNode ? (() => {
    const answer = previewAnswers[currentPreviewNode.id]
    if (answer === undefined || answer === null) return false
    if (typeof answer === 'string') return answer.trim() !== ""
    if (Array.isArray(answer)) return answer.length > 0
    if (typeof answer === 'number') return !isNaN(answer)
    return true
  })() : false
  
  // Get next node to determine if there are more pages
  const getNextNodeId = (): string | null => {
    if (!currentPreviewNode) return null
    const answerToUse = previewAnswers[currentPreviewNode.id]
    const nextNode = getNextNodeFromCurrent(currentPreviewNode, answerToUse)
    return nextNode?.id || null
  }
  const nextNodeId = getNextNodeId()
  const hasMorePages = nextNodeId !== null
  
  const hasPrev = previewNodeIndex > 0

  const handleNext = async () => {
    if (!currentPreviewNode) return
    
    // Clear previewClickedNodeId when navigating - we want to follow the normal flow path now
    if (previewClickedNodeId) {
      setPreviewClickedNodeId(null)
      // Rebuild path from the current node to follow normal flow
      const newPath = buildPathFromAnswers()
      if (newPath.length > 0) {
        // Find current node in the new path
        const currentIndex = newPath.findIndex(n => n.id === currentPreviewNode.id)
        if (currentIndex !== -1) {
          setActualPathTaken(newPath)
          setPreviewNodeIndex(currentIndex)
        } else {
          // Current node not in path, rebuild from scratch
          setActualPathTaken(newPath)
          setPreviewNodeIndex(0)
        }
      }
      // Wait a tick for state to update, then continue
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    
    // Get the current node again (might have changed after clearing previewClickedNodeId)
    const currentNode = previewClickedNodeId 
      ? flow.nodes.find(n => n.id === previewClickedNodeId) || currentPreviewNode
      : (actualPathTaken[previewNodeIndex] || currentPreviewNode)
    
    if (!currentNode) return
    
    // Get fresh answer from state - always proceed even without answer
    const freshAnswer = previewAnswers[currentNode.id]
    
    // Save answer to temporary database (localStorage) if we have one
    if (freshAnswer !== undefined) {
      setPreviewAnswers(prev => {
        const updated = { ...prev, [currentNode.id]: freshAnswer }
        // Save to localStorage (temporary database)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`preview-answers-${flow.id}`, JSON.stringify(updated))
        }
        return updated
      })
    }
    
    // Get next node based on answer - use saved answer or undefined
    const answerToUse = freshAnswer
    const nextNode = getNextNodeFromCurrent(currentNode, answerToUse)
    
    console.log('Preview handleNext - Current node:', currentNode.id, 'Next node:', nextNode?.id)
    
    if (nextNode) {
      // Check if next node is already in the path
      const nextNodeIndex = actualPathTaken.findIndex(n => n.id === nextNode.id)
      
      if (nextNodeIndex !== -1) {
        // Node already exists in path, just move to that index
        setPreviewNodeIndex(nextNodeIndex)
      } else {
        // Node not in path yet, add it and move to it
        const newPath = [...actualPathTaken, nextNode]
        setActualPathTaken(newPath)
        // Move to the new node's index (which is the last index in the new path)
        setPreviewNodeIndex(newPath.length - 1)
      }
    } else {
      // Flow complete - close preview
      setShowPreview(false)
      setPreviewClickedNodeId(null) // Reset clicked node when closing
    }
  }

  const handlePrev = () => {
    if (hasPrev) {
      setPreviewNodeIndex(prev => prev - 1)
    }
  }

  if (!currentPreviewNode || !flow || !flow.nodes || flow.nodes.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] backdrop-blur-sm">
        <div className="bg-card rounded-2xl p-8 w-full max-w-md shadow-neumorphic-raised">
          <h2 className="text-xl font-bold mb-4">
            {!flow || !flow.nodes || flow.nodes.length === 0 
              ? "No Flow Data" 
              : "Preview Complete"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {!flow || !flow.nodes || flow.nodes.length === 0
              ? "There are no pages in this flow to preview."
              : "You've reached the end of the flow."}
          </p>
          <button
            onClick={() => {
              setShowPreview(false)
              setPreviewClickedNodeId(null) // Reset clicked node when closing
            }}
            className="w-full px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-neumorphic-raised hover:shadow-neumorphic-pressed transition-all font-medium"
          >
            Close Preview
          </button>
        </div>
      </div>
    )
  }

  // Components are already in order (top to bottom) in the array
  // For preview, we show all components in order
  const allComponents = normalizePageComponents(currentPreviewNode?.pageComponents || [])
  
  // Find question component if any (for logic purposes)
  const previewQuestionComponent = allComponents.find(
    (comp: PageComponent) => ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(comp.type)
  )
  
  const needsAnswer = previewQuestionComponent && [
    "multiple-choice",
    "checkbox-multi",
    "short-answer",
    "scale-slider"
  ].includes(previewQuestionComponent.type)

  const previewContentRef = useRef<HTMLDivElement>(null)
  const questionComponentRef = useRef<HTMLDivElement>(null)
  
  // Scroll to show first component fully with padding above on mount
  useEffect(() => {
    if (previewContentRef.current) {
      setTimeout(() => {
        const container = previewContentRef.current
        if (!container) return
        
        const firstComponent = container.querySelector('[data-preview-component="first"]')
        if (firstComponent) {
          // Scroll to show first component with padding above (40px)
          const componentTop = (firstComponent as HTMLElement).offsetTop
          container.scrollTo({
            top: Math.max(0, componentTop - 40),
            behavior: 'smooth'
          })
        } else {
          // If no first component marker, scroll to top with padding (allow scrolling up 80px more)
          container.scrollTo({
            top: 0,
            behavior: 'smooth'
          })
        }
      }, 200)
    }
  }, [currentPreviewNode?.id, allComponents.length])
  
  // Scroll to bottom when answer is selected
  useEffect(() => {
    if (previewAnswers[currentPreviewNode?.id || ''] && previewContentRef.current) {
      setTimeout(() => {
        if (previewContentRef.current) {
          previewContentRef.current.scrollTo({
            top: previewContentRef.current.scrollHeight,
            behavior: 'smooth'
          })
        }
      }, 300)
    }
  }, [previewAnswers, currentPreviewNode?.id])

  return (
    <div className="fixed inset-0 bg-background z-[200] flex flex-col">
      {/* Content - Full width customer view */}
      <div ref={previewContentRef} className="flex-1 overflow-y-auto bg-background scrollbar-hide relative">
        {/* Close button - top right */}
        <button
          onClick={() => {
            setShowPreview(false)
            setPreviewClickedNodeId(null) // Reset clicked node when closing
          }}
          className="fixed top-4 right-4 z-20 p-2 rounded-lg bg-card/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all border border-border/30"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Left Arrow - Sticky in middle */}
        <button
          onClick={handlePrev}
          disabled={!hasPrev}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#3B82F6' }}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        
        {/* Right Arrow/Complete Button - Sticky in middle */}
        {hasMorePages || hasAnswer ? (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleNext()
            }}
            disabled={!hasMorePages && !hasAnswer}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#10b981' }}
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleNext()
            }}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full transition-all"
            style={{ backgroundColor: '#10b981' }}
          >
            <Check className="w-5 h-5 text-white" />
          </button>
        )}
        
          <div 
            className="w-full flex flex-col items-center justify-center min-h-full" 
            style={{ 
              paddingLeft: 'clamp(20px, 8vw, 100px)', 
              paddingRight: 'clamp(20px, 8vw, 100px)', 
              paddingTop: '40px', 
              paddingBottom: '40px' 
            }}
          >
          {/* Spacer to allow scrolling up 80px more */}
          <div style={{ height: '80px', width: '100%' }} />
          <div className="w-full flex flex-col" style={{ transform: 'scale(1.25)', maxWidth: '840px', gap: '10px' }}>
            {/* Display ALL components in order */}
            {allComponents.map((component, index) => {
              const isQuestion = ["multiple-choice", "checkbox-multi", "short-answer", "scale-slider"].includes(component.type)
              
              if (isQuestion && needsAnswer) {
                return (
                  <div 
                    key={component.id} 
                    ref={index === 0 ? questionComponentRef : null}
                    className="w-full mx-auto" 
                    style={{ maxWidth: '840px' }}
                  >
                    <div className="relative group rounded-xl p-4 sm:p-6 transition-all bg-card shadow-neumorphic-raised flex flex-col">
                      <InteractiveQuestionComponent
                        key={currentPreviewNode.id}
                        component={component}
                        value={previewAnswers[currentPreviewNode.id]}
                        onChange={async (value) => {
                          if (currentPreviewNode) {
                            setPreviewAnswers(prev => {
                              const updated = { ...prev, [currentPreviewNode.id]: value }
                              if (typeof window !== 'undefined') {
                                localStorage.setItem(`preview-answers-${flow.id}`, JSON.stringify(updated))
                              }
                              return updated
                            })
                          }
                        }}
                      />
                    </div>
                  </div>
                )
              } else {
                return (
                  <div 
                    key={component.id} 
                    data-preview-component={index === 0 ? 'first' : undefined}
                    className="w-full mx-auto" 
                    style={{ maxWidth: '840px' }}
                  >
                    <PagePreview
                      components={[component]}
                      viewMode="desktop"
                      selectedComponent={null}
                      onSelectComponent={() => {}}
                      onDeleteComponent={() => {}}
                      onUpdateComponent={undefined}
                      previewMode={true}
                    />
                  </div>
                )
              }
            })}
          </div>
        </div>
        </div>

    </div>
  )
}

// Interactive question component for preview
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
        <div>
          <label className="block text-xs font-medium mb-2">
            {config.label || "What is your name?"}
          </label>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder || "Type your answer here..."}
            className="w-full bg-card border-none rounded-xl px-4 py-3 shadow-neumorphic-inset focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )


    case "scale-slider":
      return (
        <div>
          {config.label && config.label.trim().length > 0 && (
            <label className="block text-xs font-medium mb-2">
              {config.label}
            </label>
          )}
          <div className="px-2">
            <input
              type="range"
              min={config.min ?? 1}
              max={config.max ?? 100}
              value={
                value ??
                config.default ??
                Math.round(((config.min ?? 1) + (config.max ?? 100)) / 2)
              }
              onChange={(e) => onChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
              <span>{config.min ?? 1}</span>
              <span>{config.max ?? 100}</span>
            </div>
          </div>
        </div>
      )

    default:
      return null
  }
}

function Layers({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
    </svg>
  )
}
