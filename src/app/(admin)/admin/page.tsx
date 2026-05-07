export const metadata = { title: "Admin" }

export default function AdminPage() {
  return (
    <main>
      <h1 style={{ marginBottom: "0.5rem" }}>Admin Dashboard</h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
        Manage users, datasets, and site settings.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {[
          { href: "/admin/users", label: "Users", desc: "View and manage user accounts" },
          { href: "/admin/datasets", label: "Datasets", desc: "Upload and manage norm sets" },
          { href: "/admin/settings", label: "Settings", desc: "Site-wide configuration" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={{
              display: "block",
              padding: "1.25rem",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
              background: "#f9fafb",
            }}
          >
            <strong style={{ color: "#1d4ed8" }}>{item.label}</strong>
            <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
              {item.desc}
            </p>
          </a>
        ))}
      </div>
    </main>
  )
}
