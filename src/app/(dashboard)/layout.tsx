import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import Link from "next/link"
import { LogoutButton } from "../(auth)/components/LogoutButton"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "1rem",
          marginBottom: "2rem",
        }}
      >
        <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href="/" style={{ fontWeight: 600 }}>
            Word Norms
          </Link>
          <Link href="/dashboard">Dashboard</Link>
          {ctx.session.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        </nav>
        <LogoutButton />
      </header>
      {children}
    </div>
  )
}
