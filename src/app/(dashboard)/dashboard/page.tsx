import { invoke } from "../../blitz-server"
import getCurrentUser from "../../users/queries/getCurrentUser"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const user = await invoke(getCurrentUser, null)

  return (
    <main>
      <h1 style={{ marginBottom: "0.5rem" }}>Dashboard</h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
        Welcome back{user?.name ? `, ${user.name}` : ""}! You are signed in as{" "}
        <strong>{user?.email}</strong>.
      </p>

      <section>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Quick actions</h2>
        <ul style={{ lineHeight: 2 }}>
          <li>Search word norms → <a href="/">browse the database</a></li>
          <li>Download a norm set → coming soon</li>
          <li>Save a query → coming soon</li>
        </ul>
      </section>
    </main>
  )
}
