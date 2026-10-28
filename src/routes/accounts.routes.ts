import { Router } from "express";
import {
  createAccountHandler,
  getAccountBalanceHandler,
} from "../controllers/accounts.controller";

const router = Router();

router.post("/", createAccountHandler);
router.get("/:accountId/balance", getAccountBalanceHandler);

export default router;
