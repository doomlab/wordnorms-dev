"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import updateUserRole from "../../mutations/updateUserRole"

export function RoleControl({ userId, currentRole }: { userId: number; currentRole: string }) {
  const [update, { isLoading }] = useMutation(updateUserRole)
  const router = useRouter()

  if (currentRole === "SUPER_ADMIN") return null

  const toggle = async () => {
    await update({ userId, role: currentRole === "ADMIN" ? "USER" : "ADMIN" })
    router.refresh()
  }

  return (
    <button className="btn btn-sm btn-primary" onClick={toggle} disabled={isLoading}>
      {currentRole === "ADMIN" ? "Make user" : "Make admin"}
    </button>
  )
}
