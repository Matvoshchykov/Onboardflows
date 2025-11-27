"use client"

import type { Flow } from "./flow-builder"

type TierInfoProps = {
  flows: Flow[]
  selectedFlow: Flow | null
  membershipActive: boolean
  maxFlows: number
  maxBlocksPerFlow: number
}

export function TierInfo({ flows, selectedFlow, membershipActive, maxFlows, maxBlocksPerFlow }: TierInfoProps) {
  const tier = membershipActive ? "premium" : "free"

  // Calculate current counts
  const currentFlows = flows.length
  const currentBlocks = selectedFlow 
    ? (selectedFlow.nodes.length + (selectedFlow.logicBlocks?.length || 0))
    : 0

  return (
    <div className="absolute bottom-4 left-4 z-50">
      <div className="flex items-center gap-4 text-[0.65rem] font-bold italic text-foreground opacity-70 bg-card/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-neumorphic-subtle">
        <span>Tier: <strong className="font-bold">{tier === "premium" ? "Premium" : "Free"}</strong></span>
        <span>Flow: {currentFlows}/{maxFlows}</span>
        <span>Block: {currentBlocks}/{maxBlocksPerFlow}</span>
      </div>
    </div>
  )
}

