"use client"

import { useState, useEffect } from "react"
import type { Flow } from "./flow-builder"

type TierInfoProps = {
  flows: Flow[]
  selectedFlow: Flow | null
}

export function TierInfo({ flows, selectedFlow }: TierInfoProps) {
  const [tier, setTier] = useState<"free" | "premium">("free")
  const [maxFlows, setMaxFlows] = useState(1)
  const [maxBlocksPerFlow, setMaxBlocksPerFlow] = useState(5)

  useEffect(() => {
    async function loadMembership() {
      try {
        // Get experienceId from URL
        const pathParts = window.location.pathname.split('/')
        const expId = pathParts[pathParts.indexOf('experiences') + 1]
        if (!expId) return
        
        // Get company ID
        const companyIdResponse = await fetch(`/api/get-company-id?experienceId=${expId}`)
        if (!companyIdResponse.ok) return
        const { companyId } = await companyIdResponse.json()
        
        // Check membership
        const membershipResponse = await fetch(`/api/check-membership?companyId=${companyId}`)
        if (membershipResponse.ok) {
          const { membershipActive, maxFlows: mFlows, maxBlocksPerFlow: mBlocks } = await membershipResponse.json()
          setTier(membershipActive ? "premium" : "free")
          setMaxFlows(mFlows)
          setMaxBlocksPerFlow(mBlocks)
        }
      } catch (error) {
        console.error("Error loading membership:", error)
      }
    }
    loadMembership()
  }, [])

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

