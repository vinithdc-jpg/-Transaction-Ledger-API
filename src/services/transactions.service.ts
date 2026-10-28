import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../config/database";

export type TransactionType = "credit" | "debit";

export interface CreateTransactionInput {
  accountId: string;
  type: TransactionType;
  amount: string;
  referenceId: string;
  description: string;
}

interface TransactionRow {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: string;
  description: string;
  reference_id: string;
  created_at: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: string;
  description: string;
  referenceId: string;
  createdAt: string;
  balanceAfter: string;
}

export interface TransactionHistoryItem {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: string;
  description: string;
  referenceId: string;
  createdAt: string;
}

export interface TransactionHistory {
  transactions: TransactionHistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  referenceId: string;
  description: string;
}

export interface TransferResult {
  referenceId: string;
  amount: string;
  source: {
    accountId: string;
    transactionId: string;
    balanceAfter: string;
  };
  destination: {
    accountId: string;
    transactionId: string;
    balanceAfter: string;
  };
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

export class TransferError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TransferError";
  }
}

function isUniqueAccountReferenceViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "unique_account_reference"
  );
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error(
      "Transaction rollback failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
  }
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const accountResult = await client.query(
      "SELECT id FROM accounts WHERE id = $1 FOR UPDATE",
      [input.accountId],
    );

    if (accountResult.rowCount === 0) {
      throw new TransactionError("Account not found", 404);
    }

    const balanceResult =
      input.type === "credit"
        ? await client.query(
            `UPDATE accounts
             SET balance = balance + $2::numeric
             WHERE id = $1
             RETURNING balance`,
            [input.accountId, input.amount],
          )
        : await client.query(
            `UPDATE accounts
             SET balance = balance - $2::numeric
             WHERE id = $1 AND balance >= $2::numeric
             RETURNING balance`,
            [input.accountId, input.amount],
          );

    if (balanceResult.rowCount === 0) {
      throw new TransactionError("Insufficient account balance", 422);
    }

    const transactionResult = await client.query(
      `INSERT INTO transactions
         (id, account_id, type, amount, description, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, account_id, type, amount, description, reference_id, created_at`,
      [
        randomUUID(),
        input.accountId,
        input.type,
        input.amount,
        input.description,
        input.referenceId,
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    const transaction = transactionResult.rows[0];
    return {
      id: transaction.id,
      accountId: transaction.account_id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      referenceId: transaction.reference_id,
      createdAt: transaction.created_at.toISOString(),
      balanceAfter: balanceResult.rows[0].balance,
    };
  } catch (error) {
    if (transactionStarted) {
      await rollback(client);
    }

    if (isUniqueAccountReferenceViolation(error)) {
      throw new TransactionError(
        "A transaction with this reference ID already exists for the account",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function getTransactionHistory(
  accountId: string,
  type: TransactionType | undefined,
  page: number,
  limit: number,
): Promise<TransactionHistory | null> {
  const accountResult = await pool.query(
    "SELECT 1 FROM accounts WHERE id = $1",
    [accountId],
  );

  if (accountResult.rowCount === 0) {
    return null;
  }

  const offset = (page - 1) * limit;
  const countResult =
    type === undefined
      ? await pool.query(
          "SELECT COUNT(*) AS total FROM transactions WHERE account_id = $1",
          [accountId],
        )
      : await pool.query(
          "SELECT COUNT(*) AS total FROM transactions WHERE account_id = $1 AND type = $2",
          [accountId, type],
        );

  const transactionsResult =
    type === undefined
      ? await pool.query(
          `SELECT id, account_id, type, amount, description, reference_id, created_at
           FROM transactions
           WHERE account_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2 OFFSET $3`,
          [accountId, limit, offset],
        )
      : await pool.query(
          `SELECT id, account_id, type, amount, description, reference_id, created_at
           FROM transactions
           WHERE account_id = $1 AND type = $2
           ORDER BY created_at DESC, id DESC
           LIMIT $3 OFFSET $4`,
          [accountId, type, limit, offset],
        );

  const total = Number(countResult.rows[0].total);

  if (!Number.isSafeInteger(total)) {
    throw new Error("Transaction history count exceeds the supported range");
  }

  return {
    transactions: transactionsResult.rows.map((transaction: { id: any; account_id: any; type: any; amount: any; description: any; reference_id: any; created_at: { toISOString: () => any; }; }) => ({
      id: transaction.id,
      accountId: transaction.account_id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      referenceId: transaction.reference_id,
      createdAt: transaction.created_at.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function transferFunds(
  input: TransferInput,
): Promise<TransferResult> {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const accountsResult = (await client.query(
      `SELECT id
       FROM accounts
       WHERE id IN ($1, $2)
       ORDER BY id
       FOR UPDATE`,
      [input.sourceAccountId, input.destinationAccountId],
    )) as { rows: Array<{ id: string }> };

    const accountIds = new Set(accountsResult.rows.map((account) => account.id));
    if (
      !accountIds.has(input.sourceAccountId) ||
      !accountIds.has(input.destinationAccountId)
    ) {
      throw new TransferError("Source or destination account not found", 404);
    }

    const sourceBalanceResult = (await client.query(
      `UPDATE accounts
       SET balance = balance - $2::numeric
       WHERE id = $1 AND balance >= $2::numeric
       RETURNING balance`,
      [input.sourceAccountId, input.amount],
    )) as { rowCount: number; rows: Array<{ balance: string }> };

    if (sourceBalanceResult.rowCount === 0) {
      throw new TransferError("Insufficient source account balance", 422);
    }

    const destinationBalanceResult = (await client.query(
      `UPDATE accounts
       SET balance = balance + $2::numeric
       WHERE id = $1
       RETURNING balance`,
      [input.destinationAccountId, input.amount],
    )) as { rowCount: number; rows: Array<{ balance: string }> };

    if (destinationBalanceResult.rowCount === 0) {
      throw new TransferError("Destination account not found", 404);
    }

    const transactionIds = [randomUUID(), randomUUID()];
    await client.query(
      `INSERT INTO transactions
         (id, account_id, type, amount, description, reference_id)
       VALUES
         ($1, $2, 'debit', $3, $4, $5),
         ($6, $7, 'credit', $3, $4, $5)`,
      [
        transactionIds[0],
        input.sourceAccountId,
        input.amount,
        input.description,
        input.referenceId,
        transactionIds[1],
        input.destinationAccountId,
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      referenceId: input.referenceId,
      amount: input.amount,
      source: {
        accountId: input.sourceAccountId,
        transactionId: transactionIds[0],
        balanceAfter: sourceBalanceResult.rows[0].balance,
      },
      destination: {
        accountId: input.destinationAccountId,
        transactionId: transactionIds[1],
        balanceAfter: destinationBalanceResult.rows[0].balance,
      },
    };
  } catch (error) {
    if (transactionStarted) {
      await rollback(client);
    }

    if (isUniqueAccountReferenceViolation(error)) {
      throw new TransferError(
        "A transaction with this reference ID already exists for an account",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
