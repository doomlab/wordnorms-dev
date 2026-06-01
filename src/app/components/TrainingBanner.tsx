import Link from "next/link"

export function TrainingBanner() {
  return (
    <div className="w-full bg-primary text-primary-content py-2.5 px-6 flex items-center justify-center gap-4 text-sm">
      <span className="font-medium">
        We&apos;re building a training dataset for word norms prediction — help us by verifying paper extractions.
      </span>
      <Link href="/progress" className="btn btn-outline btn-xs border-primary-content/60 text-primary-content hover:bg-primary-content hover:text-primary shrink-0">
        View progress
      </Link>
    </div>
  )
}
