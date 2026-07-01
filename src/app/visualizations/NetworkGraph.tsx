"use client"

import dynamic from "next/dynamic"
import { useState, useCallback, useMemo, useRef } from "react"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

type DbNode = { id: string; title: string; year?: number; inDb: true; paperId: number; norms: string[] }
type UnmatchedNode = { id: string; title: string; year?: number; inDb: false }
type Link = { source: string; target: string }

type Props = {
  graphData: {
    dbNodes: DbNode[]
    unmatchedNodes: UnmatchedNode[]
    allLinks: Link[]
    dbOnlyLinks: Link[]
  }
  allNormTags: string[]
}

const HUB_COUNT = 20

const linkEndId = (end: Link["source"]): string => (typeof end === "object" ? (end as any).id : end)

export function NetworkGraph({ graphData, allNormTags }: Props) {
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [selectedTag, setSelectedTag] = useState("")
  const [focusQuery, setFocusQuery] = useState("")
  const [focusId, setFocusId] = useState<string | null>(null)
  const [minDegree, setMinDegree] = useState(0)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const baseLinks = showUnmatched ? graphData.allLinks : graphData.dbOnlyLinks

  // Tag filter — restrict to DB papers tagged with the selected norm, and only
  // links where both ends are tagged (unmatched nodes carry no norm data).
  const tagNodeIds = useMemo(() => {
    if (!selectedTag) return null
    return new Set(graphData.dbNodes.filter((n) => n.norms.includes(selectedTag)).map((n) => n.id))
  }, [graphData.dbNodes, selectedTag])

  const tagLinks = useMemo(() => {
    if (!tagNodeIds) return baseLinks
    return baseLinks.filter((l) => tagNodeIds.has(linkEndId(l.source)) && tagNodeIds.has(linkEndId(l.target)))
  }, [baseLinks, tagNodeIds])

  // Focus filter — restrict to a single paper and its direct citation neighbors.
  const focusLinks = useMemo(() => {
    if (!focusId) return tagLinks
    const neighborIds = new Set([focusId])
    for (const l of tagLinks) {
      const src = linkEndId(l.source)
      const tgt = linkEndId(l.target)
      if (src === focusId) neighborIds.add(tgt)
      if (tgt === focusId) neighborIds.add(src)
    }
    return tagLinks.filter((l) => neighborIds.has(linkEndId(l.source)) && neighborIds.has(linkEndId(l.target)))
  }, [tagLinks, focusId])

  // Degree map: count edges touching each node — also used to exclude isolated nodes
  const { degreeMap, maxDegree, hubIds } = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of focusLinks) {
      const src = linkEndId(link.source)
      const tgt = linkEndId(link.target)
      map.set(src, (map.get(src) ?? 0) + 1)
      map.set(tgt, (map.get(tgt) ?? 0) + 1)
    }
    const max = Math.max(1, ...map.values())
    const hubs = new Set(
      Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, HUB_COUNT).map(([id]) => id)
    )
    return { degreeMap: map, maxDegree: max, hubIds: hubs }
  }, [focusLinks])

  const allNodes = useMemo(
    () => (showUnmatched ? [...graphData.dbNodes, ...graphData.unmatchedNodes] : graphData.dbNodes),
    [showUnmatched, graphData.dbNodes, graphData.unmatchedNodes]
  )

  const nodes = useMemo(() => {
    let ns = allNodes.filter((n) => degreeMap.has(n.id) || n.id === focusId)
    if (tagNodeIds) ns = ns.filter((n) => tagNodeIds.has(n.id) || n.id === focusId)
    if (minDegree > 0 && !focusId) ns = ns.filter((n) => (degreeMap.get(n.id) ?? 0) >= minDegree)
    return ns
  }, [allNodes, degreeMap, tagNodeIds, minDegree, focusId])

  const links = useMemo(() => {
    const nodeIds = new Set(nodes.map((n) => n.id))
    return focusLinks.filter((l) => nodeIds.has(linkEndId(l.source)) && nodeIds.has(linkEndId(l.target)))
  }, [focusLinks, nodes])

  const data = { nodes, links }

  const paperOptions = useMemo(
    () =>
      graphData.dbNodes.map((n) => ({
        id: n.id,
        label: `${n.title}${n.year ? ` (${n.year})` : ""}`,
      })),
    [graphData.dbNodes]
  )
  const labelToId = useMemo(() => new Map(paperOptions.map((o) => [o.label, o.id])), [paperOptions])

  const handleFocusQueryChange = (value: string) => {
    setFocusQuery(value)
    setFocusId(labelToId.get(value) ?? null)
  }

  const clearFocus = () => {
    setFocusQuery("")
    setFocusId(null)
  }

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
      const isFocus = node.id === focusId

      // Larger base for DB nodes; hubs and the focused paper get extra size
      const worldR = node.inDb ? 4 + normalized * 10 : 2 + normalized * 4
      const r = Math.max(1.5, (isFocus ? worldR + 4 : worldR) / Math.sqrt(globalScale))

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = isFocus
        ? "oklch(75% 0.2 145)"   // green for the focused paper
        : isHub && node.inDb
        ? "oklch(72% 0.18 55)"   // amber for top hubs
        : node.inDb
        ? "oklch(55% 0.2 250)"   // blue for regular DB nodes
        : "oklch(70% 0 0)"       // grey for unmatched
      ctx.fill()

      if ((isFocus || (isHub && node.inDb))) {
        ctx.strokeStyle = isFocus ? "oklch(55% 0.2 145)" : "oklch(55% 0.18 55)"
        ctx.lineWidth = Math.max(0.5, 1.5 / globalScale)
        ctx.stroke()
      }
    },
    [degreeMap, maxDegree, hubIds, focusId]
  )

  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-4 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-base-content/60">
            {nodes.length.toLocaleString()} nodes · {links.length.toLocaleString()} edges
          </span>
          <div className="flex items-center gap-3 text-xs text-base-content/50">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "oklch(55% 0.2 250)" }} />
              In database
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "oklch(72% 0.18 55)" }} />
              Top {HUB_COUNT} hubs
            </span>
            {focusId && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "oklch(75% 0.2 145)" }} />
                Focused paper
              </span>
            )}
            {showUnmatched && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-base-content/30" />
                Cited, not included
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-base-300 pt-3">
          <label className="flex items-center gap-2 text-xs text-base-content/60">
            Tag
            <select
              className="select select-bordered select-xs w-40"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">All tags</option>
              {allNormTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-base-content/60">
            Focus paper
            <input
              list="network-paper-options"
              value={focusQuery}
              onChange={(e) => handleFocusQueryChange(e.target.value)}
              placeholder="Search by title…"
              className="input input-bordered input-xs w-64"
            />
            <datalist id="network-paper-options">
              {paperOptions.map((o) => (
                <option key={o.id} value={o.label} />
              ))}
            </datalist>
          </label>
          {focusId && (
            <button className="btn btn-outline btn-xs" onClick={clearFocus}>
              ✕ clear focus
            </button>
          )}

          <label className="flex items-center gap-2 text-xs text-base-content/60">
            Min connections
            <input
              type="number"
              min={0}
              max={maxDegree}
              value={minDegree}
              onChange={(e) => setMinDegree(Math.max(0, parseInt(e.target.value, 10) || 0))}
              disabled={!!focusId}
              className="input input-bordered input-xs w-16"
            />
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showUnmatched}
              onChange={(e) => setShowUnmatched(e.target.checked)}
            />
            Show unmatched citations
          </label>
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
          Click a node to open its paper page. Scroll to zoom, drag to pan. Node size and amber color reflect citation count. Use Tag or Focus paper to cut through a busy graph.
        </p>
      </div>
    </div>
  )
}
