"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import toggleFavorite from "../(dashboard)/mutations/toggleFavorite"

export function FavoriteButton({
  paperId,
  initialFavorited,
  isLoggedIn = true,
}: {
  paperId: number
  initialFavorited: boolean
  isLoggedIn?: boolean
}) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [toggle] = useMutation(toggleFavorite)
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      const result = await toggle({ paperId })
      setFavorited(result.favorited)
      router.refresh()
    } catch {
      window.location.href = "/login"
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="tooltip tooltip-left" data-tip="You must have an account to use this feature">
        <button disabled className="btn btn-ghost btn-sm px-2 opacity-40 cursor-not-allowed">
          <span className="text-lg text-base-content/30">☆</span>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="btn btn-ghost btn-sm px-2"
      title={favorited ? "Remove from favorites" : "Save to favorites"}
    >
      <span className={`text-lg ${favorited ? "text-warning" : "text-base-content/30"}`}>
        {favorited ? "★" : "☆"}
      </span>
    </button>
  )
}
