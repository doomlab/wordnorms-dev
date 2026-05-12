import { Navbar } from "../components/Navbar"

export const metadata = { title: "Datasets – WordNorms" }

export default function DatasetsPage() {
  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="max-w-4xl w-full mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Datasets</h1>
        <p className="text-base-content/60 text-lg">
          Downloadable word norm data files — coming soon.
        </p>
        <a href="/" className="link link-primary text-sm mt-6 inline-block">
          Browse word norms in the meantime
        </a>
      </div>
    </div>
  )
}
