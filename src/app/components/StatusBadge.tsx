const COLOR: Record<string, string> = {
  ACCEPTED: "badge-success",
  PENDING_REVIEW: "badge-warning",
  EXCLUDED: "badge-error",
  PENDING_PDF: "badge-info",
  ADDED_TO_TRAINING: "badge-primary",
}

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  return (
    <span className={`badge ${COLOR[status] ?? "badge-ghost"} badge-${size}`}>{status}</span>
  )
}
