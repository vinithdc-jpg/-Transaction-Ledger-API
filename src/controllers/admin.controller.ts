import type { Request, Response } from "express";
import {
  createStaff,
  createStaffInvite,
  deleteStaff,
  listStaffInvites,
  listStaff,
  revokeStaffInvite,
  StaffInviteConflictError,
  updateStaff,
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function listStaffHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const staff = await listStaff();
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    console.error(
      "Staff list retrieval failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res
      .status(500)
      .json({ success: false, message: "Unable to retrieve staff" });
  }
}

export async function listStaffInvitesHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const invitations = await listStaffInvites();
    res.status(200).json({ success: true, data: invitations });
  } catch (error) {
    console.error(
      "Staff invitation list retrieval failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to retrieve staff invitations",
    });
  }
}

export async function createStaffInviteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const email = readStringField(req.body, "email");
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    res
      .status(400)
      .json({ success: false, message: "Enter a valid email address" });
    return;
  }

  try {
    const invitation = await createStaffInvite(email);
    res.status(201).json({ success: true, data: invitation });
  } catch (error) {
    if (error instanceof StaffInviteConflictError) {
      res.status(409).json({
        success: false,
        message: "A staff account already exists for that email address",
      });
      return;
    }
    if (isUniqueViolation(error)) {
      res.status(409).json({
        success: false,
        message: "An active invitation already exists for that email address",
      });
      return;
    }
    console.error(
      "Staff invitation creation failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to create staff invitation",
    });
  }
}

export async function revokeStaffInviteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (typeof id !== "string" || !isUuid(id)) {
    res.status(400).json({ success: false, message: "Invalid invitation ID" });
    return;
  }
  try {
    const revoked = await revokeStaffInvite(id);
    if (!revoked) {
      res.status(404).json({
        success: false,
        message: "Active invitation not found",
      });
      return;
    }
    res.status(200).json({ success: true, data: { id } });
  } catch (error) {
    console.error(
      "Staff invitation revocation failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to revoke staff invitation",
    });
  }
}

export async function createStaffHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const staffId = readStringField(req.body, "staff_id");
  const name = readStringField(req.body, "name");
  const email = readStringField(req.body, "email");
  const password = readStringField(req.body, "password", false);
  if (!staffId || !name || !email || !password?.trim()) {
    res.status(400).json({
      success: false,
      message: "Staff ID, name, email, and password are required",
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
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    res.status(400).json({
      success: false,
      message:
        "Password must be at least 12 characters and no more than 72 bytes",
    });
    return;
  }

  try {
    const staff = await createStaff({
      staffId,
      name,
      email,
      password,
    });
    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({
        success: false,
        message: "A staff account with that staff ID or email already exists",
      });
      return;
    }
    console.error(
      "Staff account creation failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res
      .status(500)
      .json({ success: false, message: "Unable to create staff account" });
  }
}

export async function updateStaffHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const staffId = readStringField(req.body, "staff_id");
  const name = readStringField(req.body, "name");
  const email = readStringField(req.body, "email");
  const password = readStringField(req.body, "password", false);
  const body =
    typeof req.body === "object" &&
    req.body !== null &&
    !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;
  const passwordProvided = body && Object.hasOwn(body, "password");

  if (typeof id !== "string" || !isUuid(id)) {
    res
      .status(400)
      .json({ success: false, message: "Invalid staff account ID" });
    return;
  }
  if (!staffId || !name || !email || (passwordProvided && password === null)) {
    res.status(400).json({
      success: false,
      message: "Staff ID, name, and email are required",
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
  if (
    password &&
    (password.length < 6 || Buffer.byteLength(password, "utf8") > 72)
  ) {
    res.status(400).json({
      success: false,
      message:
        "Password must be at least 12 characters and no more than 72 bytes",
    });
    return;
  }

  try {
    const staff = await updateStaff(id, {
      staffId,
      name,
      email,
      ...(password ? { password } : {}),
    });
    if (!staff) {
      res
        .status(404)
        .json({ success: false, message: "Staff account not found" });
      return;
    }
    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({
        success: false,
        message: "A staff account with that staff ID or email already exists",
      });
      return;
    }
    console.error(
      "Staff account update failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res
      .status(500)
      .json({ success: false, message: "Unable to update staff account" });
  }
}

export async function deleteStaffHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (typeof id !== "string" || !isUuid(id)) {
    res
      .status(400)
      .json({ success: false, message: "Invalid staff account ID" });
    return;
  }

  try {
    const deleted = await deleteStaff(id);
    if (!deleted) {
      res
        .status(404)
        .json({ success: false, message: "Staff account not found" });
      return;
    }
    res.status(200).json({ success: true, data: { id } });
  } catch (error) {
    console.error(
      "Staff account deletion failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res
      .status(500)
      .json({ success: false, message: "Unable to delete staff account" });
  }
}
