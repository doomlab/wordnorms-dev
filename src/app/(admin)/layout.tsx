import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import Link from "next/link"
import { LogoutButton } from "../(auth)/components/LogoutButton"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")
  if (ctx.session.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-neutral text-neutral-content px-6 shadow-sm">
        <div className="flex-1 gap-4">
          <Link href="/" className="text-xl font-bold">
            Word Norms
          </Link>
          <div className="divider divider-horizontal mx-0" />
          <Link href="/admin" className="btn btn-ghost btn-sm">
            Admin
          </Link>
          <Link href="/admin/users" className="btn btn-ghost btn-sm">
            Users
          </Link>
        </div>
        <div className="flex-none gap-3">
          <span className="badge badge-outline badge-sm">admin</span>
          <LogoutButton />
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
