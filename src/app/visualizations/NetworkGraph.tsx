"use client"

import dynamic from "next/dynamic"
import { useState, useCallback, useMemo, useRef } from "react"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

type DbNode = { id: string; title: string; year?: number; inDb: true; paperId: number }
type UnmatchedNode = { id: string; title: string; year?: number; inDb: false }
type Link = { source: string; target: string }

type Props = {
  graphData: {
    dbNodes: DbNode[]
    unmatchedNodes: UnmatchedNode[]
    allLinks: Link[]
    dbOnlyLinks: Link[]
  }
}

const HUB_COUNT = 20

export function NetworkGraph({ graphData }: Props) {
  const [showUnmatched, setShowUnmatched] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const links = showUnmatched ? graphData.allLinks : graphData.dbOnlyLinks

  // Degree map: count edges touching each node — also used to exclude isolated nodes
  const { degreeMap, maxDegree, hubIds } = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of links) {
      const src = typeof link.source === "object" ? (link.source as any).id : link.source
      const tgt = typeof link.target === "object" ? (link.target as any).id : link.target
      map.set(src, (map.get(src) ?? 0) + 1)
      map.set(tgt, (map.get(tgt) ?? 0) + 1)
    }
    const max = Math.max(1, ...map.values())
    const hubs = new Set(
      Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, HUB_COUNT).map(([id]) => id)
    )
    return { degreeMap: map, maxDegree: max, hubIds: hubs }
  }, [links])

  const allNodes = showUnmatched
    ? [...graphData.dbNodes, ...graphData.unmatchedNodes]
    : graphData.dbNodes
  const nodes = allNodes.filter((n) => degreeMap.has(n.id))

  const data = { nodes, links }

  const handleNodeClick = useCallback((node: DbNode | UnmatchedNode) => {
    if (node.inDb) window.open(`/norms/${(node as DbNode).paperId}`, "_blank")
  }, [])

  const handleNodeHover = useCallback((node: (DbNode | UnmatchedNode) | null) => {
    const el = tooltipRef.current
    if (!el) return
    if (node) {
      const degree = degreeMap.get(node.id) ?? 0
      el.textContent =
        node.title + (node.year ? ` (${node.year})` : "") + (degree > 0 ? ` · ${degree} link${degree !== 1 ? "s" : ""}` : "")
      el.style.opacity = "1"
    } else {
      el.style.opacity = "0"
    }
  }, [degreeMap])

  const paintNode = useCallback(
    (node: DbNode | UnmatchedNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = (node as any).x as number
      const y = (node as any).y as number
      const degree = degreeMap.get(node.id) ?? 0
      const normalized = Math.log1p(degree) / Math.log1p(maxDegree)
      const isHub = hubIds.has(node.id)

      // Larger base for DB nodes; hubs get extra size
      const worldR = node.inDb ? 4 + normalized * 10 : 2 + normalized * 4
      const r = Math.max(1.5, worldR / Math.sqrt(globalScale))

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle =
        isHub && node.inDb
          ? "oklch(72% 0.18 55)"   // amber for top hubs
          : node.inDb
          ? "oklch(55% 0.2 250)"   // blue for regular DB nodes
          : "oklch(70% 0 0)"       // grey for unmatched
      ctx.fill()

      if (isHub && node.inDb) {
        ctx.strokeStyle = "oklch(55% 0.18 55)"
        ctx.lineWidth = Math.max(0.5, 1.5 / globalScale)
        ctx.stroke()
      }
    },
    [degreeMap, maxDegree, hubIds]
  )

  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-4 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-base-content/60">
            {nodes.length.toLocaleString()} nodes · {links.length.toLocaleString()} edges
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-base-content/50">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "oklch(55% 0.2 250)" }} />
                In database
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "oklch(72% 0.18 55)" }} />
                Top {HUB_COUNT} hubs
              </span>
              {showUnmatched && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-base-content/30" />
                  Cited, not included
                </span>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={showUnmatched}
                onChange={(e) => setShowUnmatched(e.target.checked)}
              />
              Show unmatched citations
            </label>
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-base-100" style={{ height: 620 }}>
          <ForceGraph2D
            graphData={data}
            width={1000}
            height={620}
            nodeCanvasObject={paintNode as any}
            nodeCanvasObjectMode={() => "replace"}
            onNodeClick={handleNodeClick as any}
            onNodeHover={handleNodeHover as any}
            linkColor={() => "oklch(70% 0 0 / 0.2)"}
            linkWidth={1}
            cooldownTicks={120}
            nodeRelSize={4}
          />
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute bottom-3 left-3 rounded bg-base-300/90 px-2.5 py-1 text-xs shadow max-w-md truncate transition-opacity duration-100"
            style={{ opacity: 0 }}
          />
        </div>
        <p className="text-xs text-base-content/40">
          Click a node to open its paper page. Scroll to zoom, drag to pan. Node size and amber color reflect citation count.
        </p>
      </div>
    </div>
  )
}
