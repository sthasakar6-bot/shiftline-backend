import { Router } from "express";
import { getUsersController, getReportsController, promoteController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";

const router = Router();

router.get("/users", requireAuth, getUsersController);
router.get("/users/reports", requireAuth, requireRole("manager"), getReportsController);
router.post(
  "/users/:id/promote",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  promoteController,
);

export default router;
