"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import importFromModelCard from "src/app/(admin)/mutations/importFromModelCard"

type Props = {
  bibtex: string
  doi: string | null
  title: string
  authors: string
  year: number | null
  journal: string | null
}

export function ImportCardButton({ bibtex, doi, title, authors, year, journal }: Props) {
  const [run] = useMutation(importFromModelCard)
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [label, setLabel] = useState("")

  const handleClick = async () => {
    setState("loading")
    try {
      const result = await run({ bibtex, doi, title, authors, year, journal })
      setLabel(result.type === "created" ? "Imported" : "Linked")
      setState("done")
      router.refresh()
    } catch {
      setState("error")
    }
  }

  if (state === "done") return <span className="text-sm text-success">{label} ✓</span>
  if (state === "error") return <span className="text-sm text-error">Failed</span>

  return (
    <button
      className="btn btn-warning btn-xs"
      onClick={handleClick}
      disabled={state === "loading"}
    >
      {state === "loading" ? <span className="loading loading-spinner loading-xs" /> : "Import"}
    </button>
  )
}
