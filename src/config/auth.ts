import type { CookieOptions } from "express";

export interface AuthConfiguration {
  jwtSecret: string;
  adminEmail: string;
  adminPasswordHash: string;
}

export function authConfiguration(): AuthConfiguration {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters");
  }
  if (!adminEmail || !/^\S+@\S+\.\S+$/.test(adminEmail)) {
    throw new Error("ADMIN_EMAIL must be set to a valid email address");
  }
  if (
    !adminPasswordHash ||
    !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminPasswordHash)
  ) {
    throw new Error("ADMIN_PASSWORD_HASH must be a valid bcrypt hash");
  }

  return { jwtSecret, adminEmail, adminPasswordHash };
}

export const authCookieName = "ledgerly_session";

export function authCookieOptions(): CookieOptions {
  return {
    ...authCookieClearOptions(),
    maxAge: 8 * 60 * 60 * 1000,
  };
}

export function authCookieClearOptions(): CookieOptions {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
  };
}
