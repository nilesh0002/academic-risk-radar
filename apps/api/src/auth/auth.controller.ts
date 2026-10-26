import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../db/schemas.js";
import {
  signToken,
  SafeUserClaims,
  SESSION_COOKIE_NAME,
} from "./jwt.service.js";

/**
 * POST /api/v1/auth/login
 * Validates user credentials against MongoDB and returns safe user metadata and signed JWT.
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({
      error: "Missing or invalid email and password",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const safeClaims: SafeUserClaims = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || undefined,
      sectionIds: user.sectionIds || [],
      identityId: user.identityId || user._id,
    };

    const token = signToken(safeClaims);

    // Set secure HTTP-only cookie
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    return res.status(200).json({
      status: "success",
      user: safeClaims,
    });
  } catch (err: any) {
    console.error("[Auth] Login error:", err);
    return res.status(500).json({
      error: "Internal server error during authentication",
      details: err.message,
    });
  }
}

/**
 * POST /api/v1/auth/logout
 * Clears the session cookie.
 */
export async function logout(_req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
}

/**
 * GET /api/v1/auth/me
 * Returns current authenticated user metadata.
 */
export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      error: "Unauthorized: No active session",
    });
  }

  return res.status(200).json({
    status: "success",
    user: req.user,
  });
}
