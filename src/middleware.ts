import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BYPASS_PREFIXES = ["/admin", "/api/", "/login", "/signup", "/maintenance", "/_next/"]

export function middleware(request: NextRequest) {
  const maintenance = request.cookies.get("site_maintenance")?.value === "1"
  if (!maintenance) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  return NextResponse.redirect(new URL("/maintenance", request.url))
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
