import { Router } from "express";
import {
  createAccountHandler,
  deleteAccountHandler,
  getAccountBalanceHandler,
  updateAccountHandler,
} from "../controllers/accounts.controller";

const router = Router();

router.post("/", createAccountHandler);
router.put("/:accountId", updateAccountHandler);
router.delete("/:accountId", deleteAccountHandler);
router.get("/:accountId/balance", getAccountBalanceHandler);

export default router;
