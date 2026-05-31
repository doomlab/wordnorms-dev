export const metadata = { title: "Under Maintenance" }

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="text-center max-w-md px-6">
        <h1 className="text-3xl font-bold mb-3">Down for maintenance</h1>
        <p className="text-base-content/60 mb-6">
          WordNorms is temporarily offline while we update the database. We&apos;ll be back shortly.
        </p>
        <p className="text-sm text-base-content/40">
          Questions? Email{" "}
          <a href="mailto:buchananlab@gmail.com" className="underline underline-offset-2">
            buchananlab@gmail.com
          </a>
        </p>
      </div>
    </div>
  )
}
