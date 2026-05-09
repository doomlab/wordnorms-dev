import { invoke } from "../../blitz-server"
import getCurrentUser from "../../users/queries/getCurrentUser"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const user = await invoke(getCurrentUser, null)

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-base-content/60 mb-8">
        Welcome back{user?.name ? `, ${user.name}` : ""}! Signed in as{" "}
        <span className="font-medium text-base-content">{user?.email}</span>.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-bordered bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">Search word norms</h2>
            <p className="text-sm text-base-content/60">Browse the public database</p>
            <div className="card-actions mt-2">
              <a href="/" className="btn btn-primary btn-sm">Browse</a>
            </div>
          </div>
        </div>
        <div className="card card-bordered bg-base-200 opacity-50">
          <div className="card-body">
            <h2 className="card-title text-base">Download a norm set</h2>
            <p className="text-sm text-base-content/60">Coming soon</p>
          </div>
        </div>
        <div className="card card-bordered bg-base-200 opacity-50">
          <div className="card-body">
            <h2 className="card-title text-base">Saved queries</h2>
            <p className="text-sm text-base-content/60">Coming soon</p>
          </div>
        </div>
      </div>
    </>
  )
}
