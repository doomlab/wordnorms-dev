import Link from "next/link"
import { invoke } from "./blitz-server"
import getCurrentUser from "./users/queries/getCurrentUser"
import { LogoutButton } from "./(auth)/components/LogoutButton"

export default async function Home() {
  const currentUser = await invoke(getCurrentUser, null)

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-200 px-6 shadow-sm">
        <div className="flex-1">
          <span className="text-xl font-bold">Word Norms</span>
        </div>
        <div className="flex-none gap-2">
          {currentUser ? (
            <>
              <Link href="/dashboard" className="btn btn-ghost btn-sm">
                Dashboard
              </Link>
              {currentUser.role === "ADMIN" && (
                <Link href="/admin" className="btn btn-ghost btn-sm">
                  Admin
                </Link>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <section className="mb-10">
          <h1 className="text-4xl font-bold mb-3">
            Lexical &amp; psycholinguistic word norms
          </h1>
          <p className="text-base-content/60 text-lg mb-6">
            Browse, search, and download standardized ratings for thousands of English words —
            including valence, arousal, concreteness, frequency, and more.
          </p>
          <form action="/search" method="GET" className="flex gap-2">
            <input
              name="q"
              type="search"
              placeholder='Search a word (e.g. "cat")'
              className="input input-bordered flex-1"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Available norm sets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Valence & Arousal", desc: "Affective ratings (ANEW / Warriner)" },
              { label: "Concreteness", desc: "Brysbaert et al. 2014" },
              { label: "Word Frequency", desc: "SUBTLEX-US / HAL" },
              { label: "Imageability", desc: "MRC Psycholinguistic Database" },
              { label: "Age of Acquisition", desc: "Kuperman et al. 2012" },
              { label: "Semantic Richness", desc: "Neighborhood density / features" },
            ].map((item) => (
              <div key={item.label} className="card card-bordered bg-base-200 card-compact">
                <div className="card-body">
                  <h3 className="card-title text-base">{item.label}</h3>
                  <p className="text-base-content/60 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer footer-center p-4 text-base-content/40 text-sm border-t border-base-200">
        <p>Word Norms Database — open access for researchers</p>
      </footer>
    </div>
  )
}
