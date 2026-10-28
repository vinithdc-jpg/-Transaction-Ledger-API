import type { Request, Response } from "express";
import { createAccount, getAccountBalance } from "../services/accounts.service";

export async function createAccountHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const body: unknown = req.body;

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("name" in body) ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    res.status(400).json({
      success: false,
      message: "A non-empty account name is required",
    });
    return;
  }

  try {
    const account = await createAccount(body.name.trim());
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    console.error(
      "Account creation failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
}

export async function getAccountBalanceHandler(
  req: Request<{ accountId: string }>,
  res: Response,
): Promise<void> {
  const { accountId } = req.params;

  if (accountId.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: "A valid account ID is required",
    });
    return;
  }

  try {
    const balance = await getAccountBalance(accountId);

    if (!balance) {
      res.status(404).json({
        success: false,
        message: "Account not found",
      });
      return;
    }

    res.status(200).json({ success: true, data: balance });
  } catch (error) {
    console.error(
      "Balance retrieval failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(500).json({
      success: false,
      message: "Unable to retrieve account balance",
    });
  }
}
