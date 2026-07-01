import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import { Navbar } from "../components/Navbar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")
  if (ctx.session.role !== "ADMIN" && ctx.session.role !== "SUPER_ADMIN") redirect("/dashboard")

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar
        rightExtra={
          <span className="badge badge-outline badge-sm">
            {ctx.session.role === "SUPER_ADMIN" ? "super admin" : "admin"}
          </span>
        }
      />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
