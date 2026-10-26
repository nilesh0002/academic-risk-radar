"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
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

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Server action to authenticate credentials against Express /api/v1/auth/login
 * and establish a signed JWT session cookie.
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

  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      return {
        error: data.error || "Invalid institutional email or password.",
      };
    }

    const token: string = data.token;
    const user: SessionUser = data.user;

    // Set signed JWT session cookie
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60, // 12 hours
    });

    const destination =
      returnUrl && returnUrl.startsWith("/") && !returnUrl.includes("/login")
        ? returnUrl
        : ROLE_HOME_ROUTES[user.role] || "/";

    redirect(destination);
  } catch (err: any) {
    // If redirect() throws NEXT_REDIRECT, let it pass through
    if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }

    console.error("[Auth Action] Error contacting auth service:", err);
    return {
      error: "Unable to connect to authentication service. Please ensure the backend is running.",
    };
  }
}

/**
 * Server action to clear session and return to login screen.
 */
export async function logoutAction() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete("arr_session");
  redirect("/login");
}
