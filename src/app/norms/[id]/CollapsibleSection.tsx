"use client"

import { useState } from "react"

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className={`w-3 h-3 text-base-content/30 group-hover:text-base-content/60 transition-all ${open ? "" : "rotate-180"}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
)

export function CollapsibleSection({
  title,
  subtitle,
  headerRight,
  defaultOpen = true,
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  headerRight?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 group"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/40">
            {title}
          </h2>
          {subtitle && <span className="text-sm text-base-content/30">{subtitle}</span>}
          <Chevron open={open} />
        </button>
        {headerRight}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
