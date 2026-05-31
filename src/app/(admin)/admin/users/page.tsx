import db from "db"
import { getBlitzContext } from "../../../blitz-server"
import { RoleControl } from "./RoleControl"

export const metadata = { title: "Users – Admin" }

export default async function AdminUsersPage() {
  const ctx = await getBlitzContext()
  const isSuperAdmin = ctx.session.role === "SUPER_ADMIN"

  const PROMOTE_THRESHOLD = 20

  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true, points: true },
    orderBy: [{ points: "desc" }, { createdAt: "desc" }],
  })

  const badgeClass = (role: string) => {
    if (role === "SUPER_ADMIN") return "badge-warning"
    if (role === "ADMIN") return "badge-primary"
    return "badge-ghost"
  }

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
              <th>Points</th>
              <th>Joined</th>
              {isSuperAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isCandidate = u.role === "USER" && u.points >= PROMOTE_THRESHOLD
              return (
                <tr key={u.id} className={isCandidate ? "bg-success/10" : ""}>
                  <td className="text-base-content/50">{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.name ?? "—"}</td>
                  <td>
                    <span className={`badge badge-sm ${badgeClass(u.role)}`}>
                      {u.role === "SUPER_ADMIN" ? "super admin" : u.role.toLowerCase()}
                    </span>
                    {isCandidate && (
                      <span className="badge badge-success badge-sm ml-1">promote?</span>
                    )}
                  </td>
                  <td className={u.points > 0 ? "font-medium" : "text-base-content/40"}>
                    {u.points}
                  </td>
                  <td className="text-base-content/50">{u.createdAt.toLocaleDateString()}</td>
                  {isSuperAdmin && (
                    <td>
                      <RoleControl userId={u.id} currentRole={u.role} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
