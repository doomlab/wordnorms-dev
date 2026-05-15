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
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-primary btn-sm mr-2">
                Database ▾
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-md border border-base-300 mt-1"
              >
                <li>
                  <Link href="/">Search</Link>
                </li>
                <li>
                  <Link href="/excluded">Excluded</Link>
                </li>
                <li>
                  <Link href="/datasets">Datasets</Link>
                </li>
                <li>
                  <Link href="/favorites">★ My Favorites</Link>
                </li>
              </ul>
            </div>
            <Link href="/dashboard/profile" className="btn btn-info btn-sm mr-2">
              Profile
            </Link>
            {(role === "ADMIN" || role === "SUPER_ADMIN") && (
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-secondary btn-sm mr-2">
                  Admin ▾
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-md border border-base-300 mt-1"
                >
                  <li>
                    <Link href="/admin">Home</Link>
                  </li>
                  <li>
                    <Link href="/admin/review">Review</Link>
                  </li>
                  <li>
                    <Link href="/admin/extract">Extraction</Link>
                  </li>
                  <li>
                    <Link href="/admin/metadata">Metadata Review</Link>
                  </li>
                  <li>
                    <Link href="/admin/reports">Reports</Link>
                  </li>
                  <li>
                    <Link href="/admin/duplicates">Duplicates</Link>
                  </li>
                  <li>
                    <Link href="/admin/papers">Papers</Link>
                  </li>
                  <li>
                    <Link href="/admin/stats">Stats</Link>
                  </li>
                  <li>
                    <Link href="/admin/users">Users</Link>
                  </li>
                </ul>
              </div>
            )}
            <LogoutButton />
          </>
        ) : (
          <>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-primary btn-sm ">
                Database ▾
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-md border border-base-300 mt-1"
              >
                <li>
                  <Link href="/">Search</Link>
                </li>
                <li>
                  <Link href="/excluded">Excluded</Link>
                </li>
                <li>
                  <Link href="/datasets">Datasets</Link>
                </li>
              </ul>
            </div>
            <Link href="/login" className="btn btn-accent btn-sm m-2">
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
