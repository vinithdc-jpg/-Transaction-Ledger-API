import type { Request, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { authConfiguration, authCookieName } from "../config/auth";
import { pool } from "../config/database";

export type AuthRole = "admin" | "staff";

export interface AuthUser {
  sub: string;
  role: AuthRole;
  email: string;
  name: string;
  staffId?: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

function isAuthUser(payload: string | JwtPayload): payload is JwtPayload & AuthUser {
  return (
    typeof payload === "object" &&
    typeof payload.sub === "string" &&
    (payload.role === "admin" || payload.role === "staff") &&
    typeof payload.email === "string" &&
    typeof payload.name === "string" &&
    (payload.staffId === undefined || typeof payload.staffId === "string")
  );
}

function readAuthUser(req: Request): AuthUser | null {
  const token: unknown = req.cookies?.[authCookieName];
  if (typeof token !== "string") return null;

  try {
    const payload = jwt.verify(token, authConfiguration().jwtSecret, {
      algorithms: ["HS256"],
    });
    if (!isAuthUser(payload)) return null;
    return {
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      name: payload.name,
      ...(payload.staffId ? { staffId: payload.staffId } : {}),
    };
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const user = readAuthUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }
  if (user.role === "staff") {
    try {
      const result = await pool.query("SELECT 1 FROM staff WHERE id = $1", [
        user.sub,
      ]);
      if (!result.rowCount) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }
    } catch (error) {
      console.error(
        "Staff session validation failed:",
        error instanceof Error ? error.message : "Unknown database error",
      );
      res.status(500).json({ success: false, message: "Unable to validate session" });
      return;
    }
  }
  req.authUser = user;
  next();
};

export function requireRole(...roles: AuthRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({ success: false, message: "Access forbidden" });
      return;
    }
    next();
  };
}

export const requireRequestHeader: RequestHandler = (req, res, next) => {
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.get("X-Ledger-Request") !== "1"
  ) {
    res.status(403).json({ success: false, message: "Invalid request source" });
    return;
  }
  next();
};
