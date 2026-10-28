import type { Request, Response } from "express";
import {
  createTransaction,
  getTransactionHistory,
  TransactionError,
  type TransactionType,
} from "../services/transactions.service";
import { parsePositiveAmount } from "../utils/validation";

interface TransactionRequestBody {
  type: TransactionType;
  amount: string;
  referenceId: string;
  description: string;
}

function parseTransactionBody(body: unknown): TransactionRequestBody | null {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("type" in body) ||
    !("amount" in body) ||
    !("reference_id" in body)
  ) {
    return null;
  }

  if (body.type !== "credit" && body.type !== "debit") {
    return null;
  }

  if (
    (typeof body.amount !== "string" && typeof body.amount !== "number") ||
    (typeof body.amount === "number" && !Number.isFinite(body.amount))
  ) {
    return null;
  }

  if (
    typeof body.reference_id !== "string" ||
    body.reference_id.trim().length === 0
  ) {
    return null;
  }

  if (
    "description" in body &&
    body.description !== undefined &&
    typeof body.description !== "string"
  ) {
    return null;
  }

  return {
    type: body.type,
    amount: String(body.amount),
    referenceId: body.reference_id.trim(),
    description:
      "description" in body && typeof body.description === "string"
        ? body.description.trim()
        : "",
  };
}

export async function createTransactionHandler(
  req: Request<{ accountId: string }>,
  res: Response,
): Promise<void> {
  const { accountId } = req.params;
  const body = parseTransactionBody(req.body);

  if (accountId.trim().length === 0 || !body) {
    res.status(400).json({
      success: false,
      message:
        "A valid account ID, transaction type, positive amount, and reference_id are required",
    });
    return;
  }

  const amount = parsePositiveAmount(body.amount);

  if (amount === null) {
    res.status(400).json({
      success: false,
      message: "Amount must be a positive decimal value",
    });
    return;
  }

  try {
    const transaction = await createTransaction({
      accountId,
      ...body,
      amount,
    });
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof TransactionError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error(
      "Transaction creation failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to create transaction",
    });
  }
}

function parsePositiveInteger(value: unknown, fallback: number): number | null {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function getTransactionHistoryHandler(
  req: Request<{ accountId: string }>,
  res: Response,
): Promise<void> {
  const { accountId } = req.params;
  const rawType = req.query.type;
  const type =
    rawType === undefined
      ? undefined
      : rawType === "credit" || rawType === "debit"
        ? rawType
        : null;
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = parsePositiveInteger(req.query.limit, 20);
  const offset = page === null || limit === null ? null : (page - 1) * limit;

  if (
    accountId.trim().length === 0 ||
    type === null ||
    page === null ||
    limit === null ||
    limit > 100 ||
    offset === null ||
    !Number.isSafeInteger(offset)
  ) {
    res.status(400).json({
      success: false,
      message:
        "Invalid account ID, transaction type, page, or limit (limit must be between 1 and 100)",
    });
    return;
  }

  try {
    const history = await getTransactionHistory(
      accountId,
      type,
      page,
      limit,
    );

    if (!history) {
      res.status(404).json({
        success: false,
        message: "Account not found",
      });
      return;
    }

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error(
      "Transaction history retrieval failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to retrieve transaction history",
    });
  }
}
