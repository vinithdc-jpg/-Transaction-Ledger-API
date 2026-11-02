import type { Request, Response } from "express";
import { authCookieClearOptions, authCookieOptions } from "../config/auth";
import {
  createAuthToken,
  getAuthCookieName,
  registerStaff,
  verifyAdminCredentials,
  verifyStaffCredentials,
} from "../services/auth.service";

function readStringField(
  body: unknown,
  key: string,
  trim = true,
): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "string") return null;
  return trim ? value.trim() : value;
}

function signIn(
  res: Response,
  user: NonNullable<Awaited<ReturnType<typeof verifyStaffCredentials>>>,
): void {
  res.cookie(getAuthCookieName(), createAuthToken(user), authCookieOptions());
  res.status(200).json({
    success: true,
    data: {
      sub: user.sub,
      role: user.role,
      email: user.email,
      name: user.name,
      ...(user.staffId ? { staffId: user.staffId } : {}),
    },
  });
}

export async function staffLoginHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const staffId = readStringField(req.body, "staff_id");
  const email = readStringField(req.body, "email");
  const password = readStringField(req.body, "password", false);
  if (
    !staffId ||
    !email ||
    !password?.trim() ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    res.status(400).json({
      success: false,
      message: "Staff ID, email, and password are required",
    });
    return;
  }

  try {
    const user = await verifyStaffCredentials(staffId, email, password);
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid staff ID, email, or password",
      });
      return;
    }
    signIn(res, user);
  } catch (error) {
    console.error(
      "Staff login failed:",
      error instanceof Error ? error.message : "Unknown authentication error",
    );
    res.status(500).json({ success: false, message: "Unable to sign in" });
  }
}

export async function staffRegistrationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const staffId = readStringField(req.body, "staff_id");
  const name = readStringField(req.body, "name");
  const email = readStringField(req.body, "email");
  const password = readStringField(req.body, "password", false);
  const invitationKey = readStringField(req.body, "invitation_key");

  if (!staffId || !name || !email || !password?.trim() || !invitationKey) {
    res.status(400).json({
      success: false,
      message:
        "Staff ID, name, email, password, and invitation key are required",
    });
    return;
  }
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(staffId)) {
    res.status(400).json({
      success: false,
      message:
        "Staff ID must be 3–64 letters, numbers, underscores, or hyphens",
    });
    return;
  }
  if (
    name.length > 120 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254
  ) {
    res.status(400).json({
      success: false,
      message: "Enter a valid name and email address",
    });
    return;
  }
  if (password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
    res.status(400).json({
      success: false,
      message:
        "Password must be at least 12 characters and no more than 72 bytes",
    });
    return;
  }

  try {
    const staff = await registerStaff({
      staffId,
      name,
      email,
      password,
      invitationKey,
    });
    if (!staff) {
      res.status(401).json({
        success: false,
        message:
          "The invitation key is invalid, used, revoked, or assigned to another email",
      });
      return;
    }
    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        success: false,
        message: "A staff account with that staff ID or email already exists",
      });
      return;
    }
    console.error(
      "Staff registration failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res
      .status(500)
      .json({ success: false, message: "Unable to register staff account" });
  }
}

export async function adminLoginHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const email = readStringField(req.body, "email");
  const password = readStringField(req.body, "password", false);
  if (!email || !password?.trim() || Buffer.byteLength(password, "utf8") > 72) {
    res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
    return;
  }

  try {
    const user = await verifyAdminCredentials(email, password);
    if (!user) {
      res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
      return;
    }
    signIn(res, user);
  } catch (error) {
    console.error(
      "Admin login failed:",
      error instanceof Error ? error.message : "Unknown authentication error",
    );
    res.status(500).json({ success: false, message: "Unable to sign in" });
  }
}

export function currentUserHandler(req: Request, res: Response): void {
  res.status(200).json({ success: true, data: req.authUser });
}

export function logoutHandler(_req: Request, res: Response): void {
  res.clearCookie(getAuthCookieName(), authCookieClearOptions());
  res.status(200).json({ success: true, data: { loggedOut: true } });
}
