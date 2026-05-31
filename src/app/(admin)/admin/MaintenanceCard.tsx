"use client"

import { useState, useTransition } from "react"
import { toggleMaintenanceMode } from "./maintenance-actions"

export function MaintenanceCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !enabled
    startTransition(async () => {
      await toggleMaintenanceMode(next)
      setEnabled(next)
    })
  }

  return (
    <div className={`card card-bordered ${enabled ? "border-error" : "bg-base-200"}`}>
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title">Site Management</h2>
          <span className="badge badge-outline badge-sm">super admin</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Maintenance mode</p>
            <p className="text-xs text-base-content/50">
              {enabled
                ? "Site is paused — visitors see a maintenance page"
                : "Site is live — visitors can browse normally"}
            </p>
          </div>
          <button
            className={`btn btn-sm shrink-0 ${enabled ? "btn-error" : "btn-outline"}`}
            onClick={toggle}
            disabled={pending}
          >
            {pending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : enabled ? (
              "Disable"
            ) : (
              "Enable"
            )}
          </button>
        </div>

        <div className="divider my-0" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Download database</p>
            <p className="text-xs text-base-content/50">
              Full SQL dump — restore locally, run extractions, then push back
            </p>
          </div>
          <a href="/api/admin/db-dump" className="btn btn-outline btn-sm shrink-0">
            Download .sql
          </a>
        </div>
      </div>
    </div>
  )
}
