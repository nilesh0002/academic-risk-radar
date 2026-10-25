import { Request, Response, NextFunction } from "express";
import { UserRole } from "@academic-risk-radar/shared-types";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  departmentId?: string;
  sectionIds?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to extract authenticated user from authorization header or dev fallback.
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const userHeader = req.headers["x-user-id"];
  const roleHeader = req.headers["x-user-role"] as UserRole | undefined;

  if (userHeader && roleHeader) {
    req.user = {
      id: String(userHeader),
      role: roleHeader,
      email: `${userHeader}@academic.edu`,
    };
    return next();
  }

  // Development default fallback if no header provided
  req.user = {
    id: "admin_user_1",
    role: "admin",
    email: "admin@academic.edu",
  };

  next();
}

/**
 * Require one of the specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: Missing user authentication" });
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
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Rule 1: Student can only view their own record
  if (user.role === "student") {
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
      if (sid && String(sid) !== String(user.id)) {
        return res.status(403).json({
          error: "Forbidden: Students are restricted to accessing their own data",
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
