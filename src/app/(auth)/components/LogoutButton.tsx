"use client"
import logout from "../mutations/logout"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"

export function LogoutButton() {
  const router = useRouter()
  const [logoutMutation] = useMutation(logout)
  return (
    <button
      className="btn btn-warning btn-sm"
      onClick={async () => {
        await logoutMutation()
        router.refresh()
      }}
    >
      Log out
    </button>
  )
}
