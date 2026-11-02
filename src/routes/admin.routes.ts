import { Router } from "express";
import {
  createStaffHandler,
  createStaffInviteHandler,
  deleteStaffHandler,
  listStaffInvitesHandler,
  listStaffHandler,
  revokeStaffInviteHandler,
  updateStaffHandler,
} from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/staff", listStaffHandler);
router.get("/invitations", listStaffInvitesHandler);
router.post("/invitations", createStaffInviteHandler);
router.delete("/invitations/:id", revokeStaffInviteHandler);
router.post("/staff", createStaffHandler);
router.put("/staff/:id", updateStaffHandler);
router.delete("/staff/:id", deleteStaffHandler);

export default router;
