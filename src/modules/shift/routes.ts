import { Router } from "express";
import {
  listShiftsController,
  getShiftController,
  listShiftsForReportController,
  createShiftForReportController,
  updateShiftForReportController,
  deleteShiftForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createShiftSchema, updateShiftSchema } from "./schemas";

const router = Router();

// Shifts (roster) are set by a manager, not self-service.
// Employees can only view their own.
router.get("/shifts", requireAuth, listShiftsController);
router.get("/shifts/:id", requireAuth, getShiftController);

router.get(
  "/users/:id/shifts",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  listShiftsForReportController,
);
router.post(
  "/users/:id/shifts",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  validate(createShiftSchema),
  createShiftForReportController,
);
router.patch(
  "/users/:id/shifts/:shiftId",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  validate(updateShiftSchema),
  updateShiftForReportController,
);
router.delete(
  "/users/:id/shifts/:shiftId",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  deleteShiftForReportController,
);

export default router;
