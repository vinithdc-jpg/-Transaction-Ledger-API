import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  adminLoginHandler,
  currentUserHandler,
  logoutHandler,
  staffRegistrationHandler,
  staffLoginHandler,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later." },
});

router.post("/staff/login", loginLimiter, staffLoginHandler);
router.post("/staff/register", loginLimiter, staffRegistrationHandler);
router.post("/admin/login", loginLimiter, adminLoginHandler);
router.get("/me", requireAuth, currentUserHandler);
router.post("/logout", requireAuth, logoutHandler);

export default router;
