import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { UserRole } from "@academic-risk-radar/shared-types";
import { ROLE_HOME_ROUTES, SESSION_COOKIE_NAME, decodeJwtPayload, SessionUser } from "./lib/auth";

/**
 * Route protection rules mapping URL path prefixes to allowed roles.
 */
const ROUTE_PERMISSIONS: Array<{ prefix: string; allowed: UserRole[] }> = [
  { prefix: "/model-versions", allowed: ["admin"] },
  { prefix: "/audit", allowed: ["admin"] },
  { prefix: "/dean-dashboard", allowed: ["dean", "admin"] },
  { prefix: "/hod-dashboard", allowed: ["hod", "dean", "admin"] },
  { prefix: "/sections", allowed: ["instructor", "admin"] },
  { prefix: "/inbox", allowed: ["mentor", "admin"] },
  { prefix: "/interventions", allowed: ["mentor", "admin"] },
  { prefix: "/risk", allowed: ["student", "mentor", "admin"] },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass static assets, internal Next.js routes, and API proxy
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  // 2. Extract session from signed JWT cookie (or legacy session cookie)
  const tokenCookie = request.cookies.get(SESSION_COOKIE_NAME) || request.cookies.get("arr_session");
  let session: SessionUser | null = null;

  if (tokenCookie?.value) {
    session = decodeJwtPayload(tokenCookie.value);

    // Fallback parser if legacy JSON cookie format
    if (!session) {
      try {
        const parsed = JSON.parse(decodeURIComponent(tokenCookie.value));
        if (parsed && parsed.id && parsed.role) {
          session = parsed as SessionUser;
        }
      } catch {
        session = null;
      }
    }
  }

  // 3. Handle login page
  if (pathname === "/login") {
    if (session && session.role) {
      const homeRoute = ROLE_HOME_ROUTES[session.role] || "/risk";
      return NextResponse.redirect(new URL(homeRoute, request.url));
    }
    return NextResponse.next();
  }

  // 4. Handle forbidden page
  if (pathname === "/forbidden") {
    return NextResponse.next();
  }

  // 5. Require authentication for root / landing or protected routes
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 6. Root path redirect to user's role home
  if (pathname === "/") {
    const homeRoute = ROLE_HOME_ROUTES[session.role] || "/risk";
    return NextResponse.redirect(new URL(homeRoute, request.url));
  }

  // 7. Verify role-based route permissions
  for (const rule of ROUTE_PERMISSIONS) {
    if (pathname.startsWith(rule.prefix)) {
      if (!rule.allowed.includes(session.role)) {
        console.warn(
          `[Middleware] Forbidden access: Role '${session.role}' tried to access '${pathname}'. Allowed: ${rule.allowed.join(", ")}`
        );
        return NextResponse.redirect(new URL("/forbidden", request.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
