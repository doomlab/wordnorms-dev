export const metadata = { title: "Admin" }

export default function AdminPage() {
  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-base-content/60 mb-8">Manage users, datasets, and site settings.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: "/admin/users", label: "Users", desc: "View and manage user accounts" },
          { href: "/admin/datasets", label: "Datasets", desc: "Upload and manage norm sets" },
          { href: "/admin/settings", label: "Settings", desc: "Site-wide configuration" },
        ].map((item) => (
          <a key={item.href} href={item.href} className="card card-bordered bg-base-200 hover:bg-base-300 transition-colors">
            <div className="card-body">
              <h2 className="card-title">{item.label}</h2>
              <p className="text-base-content/60 text-sm">{item.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </>
  )
}
