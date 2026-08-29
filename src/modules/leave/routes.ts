import { Router } from "express";
import {
  listLeaveRequestsController,
  createLeaveRequestController,
  cancelLeaveRequestController,
  listLeaveRequestsForReportController,
  decideLeaveRequestController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTargetOrSelf } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createLeaveRequestSchema, decideLeaveRequestSchema } from "./schemas";

const router = Router();

router.get("/leave-requests", requireAuth, listLeaveRequestsController);
router.post(
  "/leave-requests",
  requireAuth,
  validate(createLeaveRequestSchema),
  createLeaveRequestController,
);
router.delete("/leave-requests/:id", requireAuth, cancelLeaveRequestController);

router.get(
  "/users/:id/leave-requests",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  listLeaveRequestsForReportController,
);
router.patch(
  "/users/:id/leave-requests/:requestId",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  validate(decideLeaveRequestSchema),
  decideLeaveRequestController,
);

export default router;
