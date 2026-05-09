import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import Link from "next/link"
import { LogoutButton } from "../(auth)/components/LogoutButton"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-200 px-6 shadow-sm">
        <div className="flex-1 gap-4">
          <Link href="/" className="text-xl font-bold">
            Word Norms
          </Link>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            Dashboard
          </Link>
          {ctx.session.role === "ADMIN" && (
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Admin
            </Link>
          )}
        </div>
        <div className="flex-none">
          <LogoutButton />
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
