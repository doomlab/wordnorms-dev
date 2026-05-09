import { useAuthenticatedBlitzContext } from "../blitz-server"
import Link from "next/link"
import { ThemeToggle } from "../components/ThemeToggle"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  await useAuthenticatedBlitzContext({
    redirectAuthenticatedTo: "/",
  })

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <div className="navbar bg-base-200 px-6 shadow-sm shrink-0">
        <div className="flex-1">
          <Link href="/" className="text-xl font-bold">
            WordNorms.com
          </Link>
        </div>
        <div className="flex-none gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn btn-primary btn-sm m-2">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-secondary btn-sm">
            Sign up
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
