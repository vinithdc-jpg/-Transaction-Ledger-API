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
  creditTotal: string;
  debitTotal: string;
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

export async function updateAccount(
  accountId: string,
  name: string,
): Promise<Account | null> {
  const result = await pool.query(
    `UPDATE accounts
     SET name = $2
     WHERE id = $1
     RETURNING id, name, balance, created_at`,
    [accountId, name],
  );
  const account = result.rows[0] as AccountRow | undefined;

  if (!account) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    balance: account.balance,
    createdAt: account.created_at.toISOString(),
  };
}

export async function deleteAccount(accountId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM accounts WHERE id = $1 RETURNING id",
    [accountId],
  );
  return result.rowCount === 1;
}

export async function getAccountBalance(
  accountId: string,
): Promise<AccountBalance | null> {
  const result = await pool.query<{
    id: string;
    balance: string;
    credit_total: string;
    debit_total: string;
  }>(
    `SELECT
       accounts.id,
       accounts.balance,
       COALESCE(SUM(transactions.amount) FILTER (WHERE transactions.type = 'credit'), 0)::text AS credit_total,
       COALESCE(SUM(transactions.amount) FILTER (WHERE transactions.type = 'debit'), 0)::text AS debit_total
     FROM accounts
     LEFT JOIN transactions ON transactions.account_id = accounts.id
     WHERE accounts.id = $1
     GROUP BY accounts.id`,
    [accountId],
  );
  const account = result.rows[0];

  if (!account) {
    return null;
  }

  return {
    accountId: account.id,
    balance: account.balance,
    creditTotal: account.credit_total,
    debitTotal: account.debit_total,
  };
}
