import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import { Navbar } from "../components/Navbar"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
