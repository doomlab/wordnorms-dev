"use client"

import { usePathname } from "next/navigation"

// Routes that need more than the default max-w-5xl (e.g. wide tables).
const WIDE_PATHS = ["/admin/citations/missing"]

export function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isWide = WIDE_PATHS.some((p) => pathname?.startsWith(p))

  return (
    <main className={`${isWide ? "max-w-7xl" : "max-w-5xl"} mx-auto px-6 py-10`}>{children}</main>
  )
}
