import { randomUUID } from "node:crypto";
import { pool } from "../config/database";

interface AccountRow {
  id: string;
  name: string;
  balance: string;
  created_at: Date;
}

export interface Account {
  id: string;
  name: string;
  balance: string;
  createdAt: string;
}

export interface AccountBalance {
  accountId: string;
  balance: string;
}

export async function createAccount(name: string): Promise<Account> {
  const id = randomUUID();
  const result = await pool.query(
    `INSERT INTO accounts (id, name)
     VALUES ($1, $2)
     RETURNING id, name, balance, created_at`,
    [id, name],
  );
  const account = result.rows[0] as AccountRow;

  return {
    id: account.id,
    name: account.name,
    balance: account.balance,
    createdAt: account.created_at.toISOString(),
  };
}

export async function getAccountBalance(
  accountId: string,
): Promise<AccountBalance | null> {
  const result = await pool.query(
    "SELECT id, balance FROM accounts WHERE id = $1",
    [accountId],
  );
  const account = result.rows[0] as { id: string; balance: string } | undefined;

  if (!account) {
    return null;
  }

  return {
    accountId: account.id,
    balance: account.balance,
  };
}
