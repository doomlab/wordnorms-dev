import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import Link from "next/link"
import { LogoutButton } from "../(auth)/components/LogoutButton"
import { ThemeToggle } from "../components/ThemeToggle"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-200 px-6 shadow-sm sticky top-0 z-50">
        <div className="flex-1">
          <Link href="/" className="text-xl font-bold">
            WordNorms.com
          </Link>
        </div>
        <div className="flex-none gap-2">
          <ThemeToggle />
          <Link href="/dashboard" className="btn btn-primary btn-sm m-2">
            Dashboard
          </Link>
          {ctx.session.role === "ADMIN" && (
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
