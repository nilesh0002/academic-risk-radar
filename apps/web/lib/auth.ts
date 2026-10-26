import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@academic-risk-radar/shared-types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  sectionIds?: string[];
  identityId?: string;
}

export const SESSION_COOKIE_NAME = "session_token";

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  student: "/risk",
  mentor: "/inbox",
  instructor: "/sections",
  hod: "/hod-dashboard",
  dean: "/dean-dashboard",
  admin: "/model-versions",
};

/**
 * Decode JWT payload on server components without native crypto dependency.
 */
export function decodeJwtPayload(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    const decoded = JSON.parse(jsonStr);

    // Check expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    if (!decoded.id || !decoded.role) {
      return null;
    }

    return {
      id: decoded.id,
      name: decoded.name || decoded.email,
      email: decoded.email,
      role: decoded.role,
      departmentId: decoded.departmentId || undefined,
      sectionIds: decoded.sectionIds || [],
      identityId: decoded.identityId || decoded.id,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Retrieve the current active session on the server side from the signed session token cookie.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || cookieStore.get("arr_session")?.value;

  if (!token) {
    return null;
  }

  // First try parsing as signed JWT
  const user = decodeJwtPayload(token);
  if (user) {
    return user;
  }

  // Backward compatibility fallback for transitional JSON cookie
  try {
    const parsed = JSON.parse(decodeURIComponent(token));
    if (parsed && parsed.id && parsed.role) {
      return parsed as SessionUser;
    }
  } catch (_) {}

  return null;
}

/**
 * Enforce session presence on server components. Redirects to /login if unauthenticated.
 */
export async function getSessionOrRedirect(returnUrl?: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const target = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login";
    redirect(target);
  }
  return session;
}
