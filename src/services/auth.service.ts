import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { authConfiguration, authCookieName } from "../config/auth";
import type { AuthUser } from "../middleware/auth.middleware";

const BCRYPT_ROUNDS = 12;
const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);

export interface StaffRecord extends AuthUser {
  createdAt: string;
}

export interface CreateStaffInput {
  staffId: string;
  name: string;
  email: string;
  password: string;
}

export interface UpdateStaffInput {
  staffId: string;
  name: string;
  email: string;
  password?: string;
}

export interface StaffInvite {
  id: string;
  email: string;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedStaffInvite extends StaffInvite {
  invitationKey: string;
}

export interface RegisterStaffInput extends CreateStaffInput {
  invitationKey: string;
}

export class StaffInviteConflictError extends Error {
  constructor() {
    super("A staff account already exists for that email address");
    this.name = "StaffInviteConflictError";
  }
}

function hashInvitationKey(invitationKey: string): string {
  return createHash("sha256").update(invitationKey).digest("hex");
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error(
      "Staff registration rollback failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
  }
}

export async function verifyStaffCredentials(
  staffId: string,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const result = await pool.query<{
    id: string;
    staff_id: string;
    name: string;
    email: string;
    password_hash: string;
  }>(
    `SELECT id, staff_id, name, email, password_hash
     FROM staff
     WHERE staff_id = $1 AND lower(email) = lower($2)`,
    [staffId, email],
  );
  const staff = result.rows[0];
  const validPassword = await bcrypt.compare(
    password,
    staff?.password_hash ?? (await dummyPasswordHash),
  );

  if (!staff || !validPassword) return null;
  return {
    sub: staff.id,
    role: "staff",
    staffId: staff.staff_id,
    name: staff.name,
    email: staff.email,
  };
}

export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const { adminEmail, adminPasswordHash } = authConfiguration();
  const validPassword = await bcrypt.compare(password, adminPasswordHash);
  if (email.toLowerCase() !== adminEmail.toLowerCase() || !validPassword) {
    return null;
  }
  return {
    sub: "admin",
    role: "admin",
    email: adminEmail,
    name: "Administrator",
  };
}

export function createAuthToken(user: AuthUser): string {
  const { jwtSecret } = authConfiguration();
  return jwt.sign(user, jwtSecret, { expiresIn: "8h", algorithm: "HS256" });
}

export function getAuthCookieName(): string {
  return authCookieName;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffRecord> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const result = await pool.query<{
    id: string;
    staff_id: string;
    name: string;
    email: string;
    created_at: Date;
  }>(
    `INSERT INTO staff (staff_id, name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, staff_id, name, email, created_at`,
    [input.staffId, input.name, input.email, passwordHash],
  );
  const staff = result.rows[0];
  return {
    sub: staff.id,
    role: "staff",
    staffId: staff.staff_id,
    name: staff.name,
    email: staff.email,
    createdAt: staff.created_at.toISOString(),
  };
}

export async function createStaffInvite(
  email: string,
): Promise<CreatedStaffInvite> {
  const existingStaff = await pool.query(
    "SELECT 1 FROM staff WHERE lower(email) = lower($1)",
    [email],
  );
  if (existingStaff.rowCount) throw new StaffInviteConflictError();

  const invitationKey = randomBytes(32).toString("base64url");
  const result = await pool.query<{
    id: string;
    email: string;
    created_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
  }>(
    `INSERT INTO staff_invites (email, key_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at, used_at, revoked_at`,
    [email.toLowerCase(), hashInvitationKey(invitationKey)],
  );
  const invite = result.rows[0];
  return {
    id: invite.id,
    email: invite.email,
    createdAt: invite.created_at.toISOString(),
    usedAt: invite.used_at?.toISOString() ?? null,
    revokedAt: invite.revoked_at?.toISOString() ?? null,
    invitationKey,
  };
}

export async function listStaffInvites(): Promise<StaffInvite[]> {
  const result = await pool.query<{
    id: string;
    email: string;
    created_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT id, email, created_at, used_at, revoked_at
     FROM staff_invites
     ORDER BY created_at DESC, email`,
  );
  return result.rows.map((invite) => ({
    id: invite.id,
    email: invite.email,
    createdAt: invite.created_at.toISOString(),
    usedAt: invite.used_at?.toISOString() ?? null,
    revokedAt: invite.revoked_at?.toISOString() ?? null,
  }));
}

export async function revokeStaffInvite(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE staff_invites
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function registerStaff(
  input: RegisterStaffInput,
): Promise<StaffRecord | null> {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const inviteResult = await client.query<{ id: string }>(
      `SELECT id
       FROM staff_invites
       WHERE key_hash = $1
         AND lower(email) = lower($2)
         AND used_at IS NULL
         AND revoked_at IS NULL
       FOR UPDATE`,
      [hashInvitationKey(input.invitationKey), input.email],
    );
    const invite = inviteResult.rows[0];
    if (!invite) {
      await rollback(client);
      transactionStarted = false;
      return null;
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const staffResult = await client.query<{
      id: string;
      staff_id: string;
      name: string;
      email: string;
      created_at: Date;
    }>(
      `INSERT INTO staff (staff_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, staff_id, name, email, created_at`,
      [input.staffId, input.name, input.email, passwordHash],
    );
    const staff = staffResult.rows[0];
    await client.query(
      `UPDATE staff_invites
       SET used_at = CURRENT_TIMESTAMP, used_by = $2
       WHERE id = $1`,
      [invite.id, staff.id],
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return {
      sub: staff.id,
      role: "staff",
      staffId: staff.staff_id,
      name: staff.name,
      email: staff.email,
      createdAt: staff.created_at.toISOString(),
    };
  } catch (error) {
    if (transactionStarted) await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateStaff(
  id: string,
  input: UpdateStaffInput,
): Promise<StaffRecord | null> {
  const passwordHash = input.password
    ? await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    : null;
  const result = await pool.query<{
    id: string;
    staff_id: string;
    name: string;
    email: string;
    created_at: Date;
  }>(
    `UPDATE staff
     SET staff_id = $2, name = $3, email = $4,
         password_hash = COALESCE($5, password_hash)
     WHERE id = $1
     RETURNING id, staff_id, name, email, created_at`,
    [id, input.staffId, input.name, input.email, passwordHash],
  );
  const staff = result.rows[0];
  if (!staff) return null;
  return {
    sub: staff.id,
    role: "staff",
    staffId: staff.staff_id,
    name: staff.name,
    email: staff.email,
    createdAt: staff.created_at.toISOString(),
  };
}

export async function deleteStaff(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM staff WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function listStaff(): Promise<StaffRecord[]> {
  const result = await pool.query<{
    id: string;
    staff_id: string;
    name: string;
    email: string;
    created_at: Date;
  }>(
    "SELECT id, staff_id, name, email, created_at FROM staff ORDER BY created_at DESC, staff_id",
  );
  return result.rows.map((staff) => ({
    sub: staff.id,
    role: "staff",
    staffId: staff.staff_id,
    name: staff.name,
    email: staff.email,
    createdAt: staff.created_at.toISOString(),
  }));
}
