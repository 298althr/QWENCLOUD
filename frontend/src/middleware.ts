// frontend/src/middleware.ts
// Next.js middleware — redirects unverified users to /verify page.
// Checks for human_token cookie. The token is set by the verify page
// after the proof-of-work challenge is solved.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/verify"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/manifest")
  ) {
    return NextResponse.next();
  }

  // Check for human_token cookie
  const token = request.cookies.get("althr_human_token")?.value;

  if (!token) {
    const verifyUrl = new URL("/verify", request.url);
    return NextResponse.redirect(verifyUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
