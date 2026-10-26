import { Request, Response, NextFunction } from "express";
import { UserRole } from "@academic-risk-radar/shared-types";
import { extractTokenFromRequest, verifyToken, SafeUserClaims } from "./jwt.service.js";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  departmentId?: string;
  sectionIds?: string[];
  identityId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to extract authenticated user from signed JWT cookie or Bearer header.
 * Strictly ignores caller-controlled x-user-* headers and removes default admin fallback.
 */
export function authenticateUser(req: Request, _res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);

  if (token) {
    const claims = verifyToken(token);
    if (claims) {
      req.user = {
        id: claims.id,
        role: claims.role,
        email: claims.email,
        departmentId: claims.departmentId,
        sectionIds: claims.sectionIds,
        identityId: claims.identityId || claims.id,
      };
    }
  }

  // Caller-controlled x-user-id, x-user-role, x-user-email are strictly ignored.
  // Missing or invalid token leaves req.user = undefined (Zero Trust).
  next();
}

/**
 * Require one of the specified roles.
 * Returns HTTP 401 if unauthenticated, HTTP 403 if authenticated with unauthorized role.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid authentication session" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
}

/**
 * Enforce field-level protection & access control rules:
 * - A student can NEVER read another student's data.
 * - An administrator can NEVER read raw assessment/attendance marks (only aggregated risk data).
 */
export function enforceStudentAccessControl(req: Request, res: Response, next: NextFunction) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid authentication session" });
  }

  // Rule 1: Student can only view their own record
  if (user.role === "student") {
    const currentStudentId = user.identityId || user.id;
    const studentIdsToCheck: (string | undefined)[] = [
      req.params.id,
      req.params.studentId,
      typeof req.query.studentId === "string" ? req.query.studentId : undefined,
      typeof req.body === "object" && req.body !== null ? req.body.studentId : undefined,
    ];

    const studentPathMatch = req.path.match(/\/students\/([^/]+)/);
    if (studentPathMatch && studentPathMatch[1]) {
      studentIdsToCheck.push(studentPathMatch[1]);
    }

    for (const sid of studentIdsToCheck) {
      if (sid && String(sid) !== String(currentStudentId)) {
        return res.status(403).json({
          error: "Forbidden: Students are restricted to accessing their own data",
          requestedId: sid,
          authenticatedId: currentStudentId,
        });
      }
    }
  }

  // Rule 2: Admin cannot access raw marks or raw records
  if (
    user.role === "admin" &&
    (req.path.includes("/raw") ||
      req.path.includes("/assessments") ||
      req.path.includes("/attendance") ||
      req.query.includeRaw === "true")
  ) {
    return res.status(403).json({
      error: "Forbidden: Administrators are strictly restricted from viewing raw assessment or attendance records",
    });
  }

  next();
}
