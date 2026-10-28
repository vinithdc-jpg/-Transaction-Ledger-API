import { Router } from "express";
import {
  createTransactionHandler,
  getTransactionHistoryHandler,
} from "../controllers/transactions.controller";

const router = Router();

router.post("/:accountId/transactions", createTransactionHandler);
router.get("/:accountId/transactions", getTransactionHistoryHandler);

export default router;
