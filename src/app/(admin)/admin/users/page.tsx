import db from "db"

export const metadata = { title: "Users – Admin" }

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <main>
      <h1 style={{ marginBottom: "0.5rem" }}>Users</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>{users.length} registered accounts</p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.5rem 1rem" }}>ID</th>
            <th style={{ padding: "0.5rem 1rem" }}>Email</th>
            <th style={{ padding: "0.5rem 1rem" }}>Name</th>
            <th style={{ padding: "0.5rem 1rem" }}>Role</th>
            <th style={{ padding: "0.5rem 1rem" }}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "0.5rem 1rem", color: "#6b7280" }}>{u.id}</td>
              <td style={{ padding: "0.5rem 1rem" }}>{u.email}</td>
              <td style={{ padding: "0.5rem 1rem" }}>{u.name ?? "—"}</td>
              <td style={{ padding: "0.5rem 1rem" }}>
                <span
                  style={{
                    padding: "0.15rem 0.5rem",
                    borderRadius: 4,
                    fontSize: "0.8rem",
                    background: u.role === "ADMIN" ? "#dbeafe" : "#f3f4f6",
                    color: u.role === "ADMIN" ? "#1d4ed8" : "#374151",
                    fontWeight: 500,
                  }}
                >
                  {u.role}
                </span>
              </td>
              <td style={{ padding: "0.5rem 1rem", color: "#6b7280" }}>
                {u.createdAt.toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
