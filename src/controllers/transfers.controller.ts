import type { Request, Response } from "express";
import { transferFunds, TransferError } from "../services/transactions.service";
import { parsePositiveAmount } from "../utils/validation";

interface TransferRequestBody {
  sourceAccountId: string;
  destinationAccountId: string;
  referenceId: string;
  amount: string;
  description: string;
}

function parseTransferBody(body: unknown): TransferRequestBody | null {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("source_account_id" in body) ||
    !("destination_account_id" in body) ||
    !("amount" in body) ||
    !("reference_id" in body)
  ) {
    return null;
  }

  const amount = parsePositiveAmount(body.amount);
  if (
    typeof body.source_account_id !== "string" ||
    body.source_account_id.trim().length === 0 ||
    typeof body.destination_account_id !== "string" ||
    body.destination_account_id.trim().length === 0 ||
    body.source_account_id === body.destination_account_id ||
    amount === null ||
    typeof body.reference_id !== "string" ||
    body.reference_id.trim().length === 0 ||
    ("description" in body &&
      body.description !== undefined &&
      typeof body.description !== "string")
  ) {
    return null;
  }

  return {
    sourceAccountId: body.source_account_id,
    destinationAccountId: body.destination_account_id,
    amount,
    referenceId: body.reference_id.trim(),
    description:
      "description" in body && typeof body.description === "string"
        ? body.description.trim()
        : "",
  };
}

export async function transferFundsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body = parseTransferBody(req.body);

  if (!body) {
    res.status(400).json({
      success: false,
      message:
        "Valid source_account_id, destination_account_id, positive amount, and reference_id are required",
    });
    return;
  }

  try {
    const transfer = await transferFunds(body);
    res.status(201).json({ success: true, data: transfer });
  } catch (error) {
    if (error instanceof TransferError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error(
      "Transfer failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to transfer funds",
    });
  }
}
