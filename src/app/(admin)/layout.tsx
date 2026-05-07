import { redirect } from "next/navigation"
import { getBlitzContext } from "../blitz-server"
import Link from "next/link"
import { LogoutButton } from "../(auth)/components/LogoutButton"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")
  if (ctx.session.role !== "ADMIN") redirect("/dashboard")

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #1d4ed8",
          paddingBottom: "1rem",
          marginBottom: "2rem",
        }}
      >
        <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <Link href="/" style={{ fontWeight: 700, color: "#1d4ed8" }}>
            Word Norms
          </Link>
          <Link href="/admin">Admin Home</Link>
          <Link href="/admin/users">Users</Link>
        </nav>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>Admin</span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  )
}
