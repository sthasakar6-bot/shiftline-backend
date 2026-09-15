import { Router } from "express";
import {
  listOpenShiftsController,
  createOpenShiftController,
  updateOpenShiftController,
  deleteOpenShiftController,
  assignOpenShiftController,
  requestOpenShiftController,
  cancelOpenShiftRequestController,
  approveOpenShiftRequestController,
  rejectOpenShiftRequestController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { createOpenShiftSchema, updateOpenShiftSchema, assignOpenShiftSchema } from "./schemas";

const router = Router();

// Open shifts are visible company-wide, same as the shift roster -- any
// employee can see what's open and request one, but only a manager can
// create/edit/delete a slot, assign it directly, or approve/reject a
// request. There is still no direct employee self-claim.
router.get("/open-shifts", requireAuth, listOpenShiftsController);
router.post(
  "/open-shifts",
  requireAuth,
  requireRole("manager"),
  validate(createOpenShiftSchema),
  createOpenShiftController,
);
router.patch(
  "/open-shifts/:id",
  requireAuth,
  requireRole("manager"),
  validate(updateOpenShiftSchema),
  updateOpenShiftController,
);
router.delete("/open-shifts/:id", requireAuth, requireRole("manager"), deleteOpenShiftController);
router.post(
  "/open-shifts/:id/assign",
  requireAuth,
  requireRole("manager"),
  validate(assignOpenShiftSchema),
  assignOpenShiftController,
);
router.post("/open-shifts/:id/requests", requireAuth, requestOpenShiftController);
router.delete(
  "/open-shift-requests/:requestId",
  requireAuth,
  cancelOpenShiftRequestController,
);
router.post(
  "/open-shift-requests/:requestId/approve",
  requireAuth,
  requireRole("manager"),
  approveOpenShiftRequestController,
);
router.post(
  "/open-shift-requests/:requestId/reject",
  requireAuth,
  requireRole("manager"),
  rejectOpenShiftRequestController,
);

export default router;
