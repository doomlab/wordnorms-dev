import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BYPASS_PREFIXES = ["/admin", "/api/", "/login", "/signup", "/maintenance", "/_next/"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  try {
    const res = await fetch(new URL("/api/maintenance-check", request.url))
    if (res.ok) {
      const { maintenance } = await res.json()
      if (maintenance) {
        return NextResponse.redirect(new URL("/maintenance", request.url))
      }
    }
  } catch {
    // fail open — don't block requests if the check fails
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
