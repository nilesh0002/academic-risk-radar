import jwt from "jsonwebtoken";
import { Request } from "express";
import { UserRole } from "@academic-risk-radar/shared-types";

export const SESSION_COOKIE_NAME = "session_token";

export interface SafeUserClaims {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  sectionIds?: string[];
  identityId?: string;
}

const JWT_SECRET =
  process.env.JWT_SECRET || "academic-risk-radar-dev-jwt-secret-change-in-production";

const TOKEN_EXPIRY = "12h";

/**
 * Sign a JWT containing validated user metadata.
 */
export function signToken(claims: SafeUserClaims): string {
  return jwt.sign(
    {
      id: claims.id,
      role: claims.role,
      departmentId: claims.departmentId || null,
      sectionIds: claims.sectionIds || [],
      identityId: claims.identityId || null,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode an incoming JWT token string.
 * Returns decoded safe claims or null if invalid or expired.
 */
export function verifyToken(token: string): SafeUserClaims | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SafeUserClaims & { iat?: number; exp?: number };
    if (!decoded || !decoded.id || !decoded.role) {
      return null;
    }
    return {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      departmentId: decoded.departmentId,
      sectionIds: decoded.sectionIds,
      identityId: decoded.identityId,
    };
  } catch (err) {
    return null;
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  // 1. Primary: Check Authorization header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 2. Fallback: Parse raw Cookie header string if present
  const rawCookieHeader = req.headers.cookie;
  if (rawCookieHeader) {
    const cookies = rawCookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
        const value = cookie.substring(`${SESSION_COOKIE_NAME}=`.length);
        if (value) return decodeURIComponent(value);
      }
    }
  }

  return null;
}
