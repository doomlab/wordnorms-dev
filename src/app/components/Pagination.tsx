type Props = {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-6">
      <span className="text-sm text-base-content/50">
        Page {page} of {totalPages}
      </span>
      <div className="join">
        {page > 1 && (
          <a href={buildHref(1)} className="join-item btn btn-sm">«</a>
        )}
        {page > 1 && (
          <a href={buildHref(page - 1)} className="join-item btn btn-sm">‹</a>
        )}
        <button className="join-item btn btn-sm btn-active pointer-events-none">{page}</button>
        {page < totalPages && (
          <a href={buildHref(page + 1)} className="join-item btn btn-sm">›</a>
        )}
        {page < totalPages && (
          <a href={buildHref(totalPages)} className="join-item btn btn-sm">»</a>
        )}
      </div>
    </div>
  )
}
