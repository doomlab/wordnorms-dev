import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import Link from "next/link"
import { Navbar } from "../components/Navbar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")
  if (ctx.session.role !== "ADMIN") redirect("/dashboard")

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar
        className="bg-neutral text-neutral-content"
        leftLinks={
          <>
            <div className="divider divider-horizontal mx-0" />
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Admin
            </Link>
            <Link href="/admin/users" className="btn btn-ghost btn-sm">
              Users
            </Link>
          </>
        }
        rightExtra={<span className="badge badge-outline badge-sm">admin</span>}
      />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
