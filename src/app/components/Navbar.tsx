import Link from "next/link"
import { getBlitzContext } from "../blitz-server"
import { LogoutButton } from "../(auth)/components/LogoutButton"
import { ThemeToggle } from "./ThemeToggle"

interface NavbarProps {
  leftLinks?: React.ReactNode
  rightExtra?: React.ReactNode
  className?: string
}

export async function Navbar({ leftLinks, rightExtra, className }: NavbarProps) {
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId
  const role = ctx.session.role

  return (
    <div className={`navbar bg-base-200 px-6 shadow-sm sticky top-0 z-50 ${className ?? ""}`}>
      <div className="flex-1 gap-4">
        <Link href="/" className="text-xl font-bold">
          WordNorms.com
        </Link>
        {leftLinks}
      </div>
      <div className="flex-none gap-2">
        {rightExtra}
        <ThemeToggle />
        {userId ? (
          <>
            <Link href="/dashboard" className="btn btn-primary btn-sm m-2">
              Dashboard
            </Link>
            {role === "ADMIN" && (
              <Link href="/admin" className="btn btn-ghost btn-sm">
                Admin
              </Link>
            )}
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-primary btn-sm m-2">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-secondary btn-sm">
              Sign up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
