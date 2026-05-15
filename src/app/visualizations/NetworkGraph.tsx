"use client"

import dynamic from "next/dynamic"
import { useState, useCallback, useRef } from "react"

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

export function NetworkGraph({ graphData }: Props) {
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const nodes = showUnmatched
    ? [...graphData.dbNodes, ...graphData.unmatchedNodes]
    : graphData.dbNodes

  const links = showUnmatched ? graphData.allLinks : graphData.dbOnlyLinks

  const data = { nodes, links }

  const handleNodeClick = useCallback((node: DbNode | UnmatchedNode) => {
    if (node.inDb) window.open(`/norms/${(node as DbNode).paperId}`, "_blank")
  }, [])

  const handleNodeHover = useCallback(
    (node: (DbNode | UnmatchedNode) | null, _prev: unknown, evt: MouseEvent | undefined) => {
      if (node && evt) {
        const rect = containerRef.current?.getBoundingClientRect()
        setTooltip({
          x: evt.clientX - (rect?.left ?? 0),
          y: evt.clientY - (rect?.top ?? 0),
          title: node.title + (node.year ? ` (${node.year})` : ""),
        })
      } else {
        setTooltip(null)
      }
    },
    []
  )

  const paintNode = useCallback(
    (node: DbNode | UnmatchedNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = Math.max(3, 5 / Math.sqrt(globalScale))
      ctx.beginPath()
      ctx.arc((node as any).x, (node as any).y, r, 0, 2 * Math.PI)
      ctx.fillStyle = node.inDb ? "oklch(55% 0.2 250)" : "oklch(70% 0 0)"
      ctx.fill()
    },
    []
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
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
                In database
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

        <div ref={containerRef} className="relative rounded-lg overflow-hidden bg-base-100" style={{ height: 620 }}>
          <ForceGraph2D
            graphData={data}
            width={containerRef.current?.clientWidth ?? 1000}
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
          {tooltip && (
            <div
              className="pointer-events-none absolute z-10 max-w-xs rounded bg-base-300 px-2 py-1 text-xs shadow"
              style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
            >
              {tooltip.title}
            </div>
          )}
        </div>
        <p className="text-xs text-base-content/40">
          Click a node to open its paper page. Scroll to zoom, drag to pan.
        </p>
      </div>
    </div>
  )
}
