import { ImportExtractionsForm } from "./ImportExtractionsForm"

export const metadata = { title: "Import Extractions – Admin" }

export default function ImportExtractionsPage() {
  return (
    <>
      <a
        href="/admin"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to admin
      </a>

      <h1 className="text-3xl font-bold mb-2">Import Extractions</h1>
      <p className="text-base-content/60 mb-8 text-sm">
        Paste the JSON produced by running a paper&apos;s PDF through an LLM (a single object or an
        array of them). Each entry is matched to an existing paper by <code>paperId</code> or{" "}
        <code>doi</code>, then upserted into that paper&apos;s extracted metadata.
      </p>

      <ImportExtractionsForm />
    </>
  )
}
