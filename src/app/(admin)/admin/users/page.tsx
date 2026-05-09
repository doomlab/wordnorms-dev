import db from "db"

export const metadata = { title: "Users – Admin" }

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Users</h1>
      <p className="text-base-content/60 mb-6">{users.length} registered accounts</p>

      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="text-base-content/50">{u.id}</td>
                <td>{u.email}</td>
                <td>{u.name ?? "—"}</td>
                <td>
                  <span className={`badge badge-sm ${u.role === "ADMIN" ? "badge-primary" : "badge-ghost"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="text-base-content/50">{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
