import Link from "next/link"
import { invoke } from "./blitz-server"
import getCurrentUser from "./users/queries/getCurrentUser"
import { LogoutButton } from "./(auth)/components/LogoutButton"

export default async function Home() {
  const currentUser = await invoke(getCurrentUser, null)

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
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
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Word Norms</h1>
        <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {currentUser ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              {currentUser.role === "ADMIN" && <Link href="/admin">Admin</Link>}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link
                href="/signup"
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  padding: "0.4rem 1rem",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
            Lexical &amp; psycholinguistic word norms
          </h2>
          <p style={{ color: "#6b7280", fontSize: "1.1rem", marginBottom: "1.5rem" }}>
            Browse, search, and download standardized ratings for thousands of English words —
            including valence, arousal, concreteness, frequency, and more.
          </p>
          <form action="/search" method="GET" style={{ display: "flex", gap: "0.5rem" }}>
            <input
              name="q"
              type="search"
              placeholder="Search a word (e.g. &quot;cat&quot;)"
              style={{
                flex: 1,
                padding: "0.6rem 1rem",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: "1rem",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "0.6rem 1.25rem",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Search
            </button>
          </form>
        </section>

        <section>
          <h3 style={{ marginBottom: "1rem" }}>Available norm sets</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              { label: "Valence & Arousal", desc: "Affective ratings (ANEW / Warriner)" },
              { label: "Concreteness", desc: "Brysbaert et al. 2014" },
              { label: "Word Frequency", desc: "SUBTLEX-US / HAL" },
              { label: "Imageability", desc: "MRC Psycholinguistic Database" },
              { label: "Age of Acquisition", desc: "Kuperman et al. 2012" },
              { label: "Semantic Richness", desc: "Neighborhood density / features" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "1rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                }}
              >
                <strong>{item.label}</strong>
                <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer
        style={{
          marginTop: "3rem",
          borderTop: "1px solid #e5e7eb",
          paddingTop: "1rem",
          color: "#9ca3af",
          fontSize: "0.875rem",
        }}
      >
        Word Norms Database — open access for researchers
      </footer>
    </div>
  )
}
