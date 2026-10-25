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
}

export const SESSION_COOKIE_NAME = "arr_session";

export const DEFAULT_USERS_BY_ROLE: Record<UserRole, SessionUser> = {
  student: {
    id: "STU_ALICE",
    name: "Rahul Sharma",
    email: "student@academic.edu",
    role: "student",
    sectionIds: ["P134"],
  },
  mentor: {
    id: "MENTOR_01",
    name: "Dr. Vikram Joshi",
    email: "mentor@academic.edu",
    role: "mentor",
  },
  instructor: {
    id: "INST_01",
    name: "Prof. Ananya Sen",
    email: "instructor@academic.edu",
    role: "instructor",
    sectionIds: ["SEC_A"],
  },
  hod: {
    id: "HOD_01",
    name: "Dr. Rajesh Kulkarni",
    email: "hod@academic.edu",
    role: "hod",
    departmentId: "CSE",
  },
  dean: {
    id: "DEAN_01",
    name: "Dean Meenakshi Sundaram",
    email: "dean@academic.edu",
    role: "dean",
  },
  admin: {
    id: "admin_user_1",
    name: "System Administrator",
    email: "admin@academic.edu",
    role: "admin",
  },
};

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  student: "/risk",
  mentor: "/interventions",
  instructor: "/sections",
  hod: "/hod-dashboard",
  dean: "/dean-dashboard",
  admin: "/model-versions",
};

/**
 * Retrieve the current active session on the server side.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(sessionCookie.value)) as SessionUser;
    if (parsed && parsed.id && parsed.role) {
      return parsed;
    }
  } catch (err) {
    console.warn("[Auth] Failed to parse session cookie:", err);
  }

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
