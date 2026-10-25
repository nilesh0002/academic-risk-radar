"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserRole } from "@academic-risk-radar/shared-types";
import {
  DEFAULT_USERS_BY_ROLE,
  ROLE_HOME_ROUTES,
  SESSION_COOKIE_NAME,
  SessionUser,
} from "../lib/auth";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid academic email address"),
  password: z.string().min(1, "Password is required"),
  returnUrl: z.string().optional(),
});

export interface LoginResult {
  error?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

export type LoginState = LoginResult | null;

/**
 * Server action to authenticate credentials and establish a secure session cookie.
 */
export async function loginAction(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    returnUrl: formData.get("returnUrl") || undefined,
  };

  const validation = LoginSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, password, returnUrl } = validation.data;

  // Search for matching user in seeded profiles
  let matchedUser: SessionUser | null = null;
  for (const user of Object.values(DEFAULT_USERS_BY_ROLE)) {
    if (user.email.toLowerCase() === email.toLowerCase()) {
      matchedUser = user;
      break;
    }
  }

  // Simulated authentication check (default password 'password123' or matching email prefix)
  const isValidPassword = password === "password123" || password === "radar2026" || password === "password";

  if (!matchedUser || !isValidPassword) {
    return {
      error: "That email and password don't match. Check both and try again.",
    };
  }

  // Set httpOnly session cookie
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeURIComponent(JSON.stringify(matchedUser)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  const destination = returnUrl && returnUrl.startsWith("/") && !returnUrl.includes("/login")
    ? returnUrl
    : ROLE_HOME_ROUTES[matchedUser.role] || "/";

  redirect(destination);
}

/**
 * Rapid role switcher for Viva demos and testing different access levels.
 */
export async function switchRoleAction(role: UserRole, returnUrl?: string) {
  const user = DEFAULT_USERS_BY_ROLE[role];
  if (!user) return;

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeURIComponent(JSON.stringify(user)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  const destination = returnUrl && returnUrl.startsWith("/") && !returnUrl.includes("/login")
    ? returnUrl
    : ROLE_HOME_ROUTES[role] || "/";

  redirect(destination);
}

/**
 * Server action to clear session and return to login screen.
 */
export async function logoutAction() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
