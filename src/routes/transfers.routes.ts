import { Router } from "express";
import { transferFundsHandler } from "../controllers/transfers.controller";

const router = Router();

router.post("/", transferFundsHandler);
router.all("/", (_req, res) => {
  res.set("Allow", "POST").status(405).json({
    success: false,
    message: "Method not allowed. Use POST /api/transfers to create a transfer.",
  });
});

export default router;
