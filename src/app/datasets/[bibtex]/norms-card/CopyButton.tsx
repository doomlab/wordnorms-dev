"use client"

import { useState } from "react"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // clipboard unavailable (permissions/insecure context); leave label as-is
        }
      }}
    >
      {copied ? "Copied" : "Copy JSON"}
    </button>
  )
}
