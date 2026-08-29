import { Router } from "express";
import {
  createInviteController,
  getInviteByTokenController,
  listInvitesController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { createInviteSchema } from "./schemas";

const router = Router();

router.post(
  "/invites",
  requireAuth,
  requireRole("manager"),
  validate(createInviteSchema),
  createInviteController,
);
router.get("/invites", requireAuth, requireRole("manager"), listInvitesController);
router.get("/invites/:token", getInviteByTokenController);

export default router;
