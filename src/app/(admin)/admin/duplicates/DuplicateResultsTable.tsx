"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import mergeGroup from "src/app/(admin)/mutations/mergeGroup"
import { StatusBadge } from "src/app/components/StatusBadge"

type ResultPaper = {
  id: number
  title: string
  year: number | null
  doi: string | null
  status: string
  canonicalPaperId: number | null
  canonical: { id: number; title: string } | null
  duplicates: { id: number }[]
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function DuplicateResultsTable({ papers }: { papers: ResultPaper[] }) {
  const router = useRouter()
  const [run] = useMutation(mergeGroup)
  const [checked, setChecked] = useState<number[]>([])
  const [canonicalId, setCanonicalId] = useState<number | null>(null)
  const [mergeState, setMergeState] = useState<"idle" | "loading" | "error">("idle")

  const toggle = (id: number) => {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setCanonicalId(null)
    setMergeState("idle")
  }

  const canCompare = checked.length === 2
  const canMergeGroup = checked.length > 2

  const checkedPapers = useMemo(
    () => papers.filter((p) => checked.includes(p.id)),
    [papers, checked]
  )

  const handleMergeGroup = async () => {
    if (!canonicalId) return
    const duplicateIds = checked.filter((id) => id !== canonicalId)
    if (!confirm(`Merge ${duplicateIds.length} other paper(s) into #${canonicalId}?`)) return
    setMergeState("loading")
    try {
      await run({ canonicalId, duplicateIds })
      setChecked([])
      setCanonicalId(null)
      setMergeState("idle")
      router.refresh()
    } catch (e: any) {
      alert(e.message)
      setMergeState("error")
    }
  }

  return (
    <>
      {checked.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-base-content/60">
              {checked.length === 1
                ? "1 paper selected — select at least one more"
                : `${checked.length} papers selected`}
            </span>
            {canCompare && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => router.push(`/admin/duplicates?a=${checked[0]}&b=${checked[1]}`)}
              >
                Compare &amp; Merge →
              </button>
            )}
            <button className="btn btn-ghost btn-xs" onClick={() => setChecked([])}>
              Clear
            </button>
          </div>

          {canMergeGroup && (
            <div className="rounded-lg border border-base-300 p-3">
              <p className="text-xs text-base-content/60 mb-2">
                Pick which paper is canonical — the rest will be merged into it.
              </p>
              <div className="space-y-1 mb-3">
                {checkedPapers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="canonical"
                      className="radio radio-sm"
                      checked={canonicalId === p.id}
                      onChange={() => setCanonicalId(p.id)}
                    />
                    <span className="font-mono text-xs text-base-content/40">#{p.id}</span>
                    <span className="truncate">{cap(p.title)}</span>
                  </label>
                ))}
              </div>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleMergeGroup}
                disabled={!canonicalId || mergeState === "loading"}
              >
                {mergeState === "loading" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  `Merge ${checked.length - 1} into canonical`
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-zebra text-sm">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Title</th>
              <th>Year</th>
              <th>DOI</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => {
              const isChecked = checked.includes(p.id)

              return (
                <tr
                  key={p.id}
                  className={[
                    p.canonicalPaperId ? "opacity-40" : "",
                    isChecked ? "bg-primary/10" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={isChecked}
                      disabled={!!p.canonicalPaperId}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                  <td className="font-mono text-xs">{p.id}</td>
                  <td className="max-w-xs">
                    <p className="line-clamp-2">{cap(p.title)}</p>
                    {p.canonicalPaperId && (
                      <span className="text-xs text-warning">
                        duplicate of{" "}
                        <a href={`/admin/duplicates?a=${p.canonicalPaperId}&b=`} className="link">
                          #{p.canonical?.id}
                        </a>
                      </span>
                    )}
                    {p.duplicates.length > 0 && (
                      <span className="text-xs text-base-content/40">
                        {p.duplicates.length} duplicate{p.duplicates.length !== 1 ? "s" : ""}{" "}
                        merged
                      </span>
                    )}
                  </td>
                  <td>{p.year ?? "—"}</td>
                  <td className="font-mono text-xs">{p.doi ?? "—"}</td>
                  <td>
                    <StatusBadge status={p.status} size="xs" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
