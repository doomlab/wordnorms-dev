"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

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
  const [checked, setChecked] = useState<number[]>([])

  const toggle = (id: number) => {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    )
  }

  const canCompare = checked.length === 2

  return (
    <>
      {checked.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-base-content/60">
            {checked.length === 1 ? "1 paper selected — select one more" : "2 papers selected"}
          </span>
          {canCompare && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/admin/duplicates?a=${checked[0]}&b=${checked[1]}`)}
            >
              Compare &amp; Merge →
            </button>
          )}
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setChecked([])}
          >
            Clear
          </button>
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
              const disabled = !isChecked && checked.length === 2

              return (
                <tr
                  key={p.id}
                  className={[
                    p.canonicalPaperId ? "opacity-40" : "",
                    isChecked ? "bg-primary/10" : "",
                    disabled ? "opacity-30" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={isChecked}
                      disabled={disabled || !!p.canonicalPaperId}
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
                    <span className="badge badge-ghost badge-xs">{p.status}</span>
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
