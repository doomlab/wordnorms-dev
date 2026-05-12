"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import toggleFavorite from "../(dashboard)/mutations/toggleFavorite"

export function FavoriteButton({
  paperId,
  initialFavorited,
}: {
  paperId: number
  initialFavorited: boolean
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
      // resolver.authorize() throws if not logged in — redirect to login
      window.location.href = "/login"
    }
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
