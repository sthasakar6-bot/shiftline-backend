import { Router } from "express";
import {
  listShiftsController,
  listCompanyRosterController,
  getShiftController,
  listShiftsForReportController,
  createShiftForReportController,
  updateShiftForReportController,
  deleteShiftForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireSameCompanyOrSelf } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createShiftSchema, updateShiftSchema } from "./schemas";

const router = Router();

// Shifts (roster) are set by a manager, not self-service.
// Employees can only view their own.
router.get("/shifts", requireAuth, listShiftsController);
router.get("/shifts/roster", requireAuth, listCompanyRosterController);
router.get("/shifts/:id", requireAuth, getShiftController);

router.get(
  "/users/:id/shifts",
  requireAuth,
  requireRole("manager"),
  requireSameCompanyOrSelf,
  listShiftsForReportController,
);
router.post(
  "/users/:id/shifts",
  requireAuth,
  requireRole("manager"),
  requireSameCompanyOrSelf,
  validate(createShiftSchema),
  createShiftForReportController,
);
router.patch(
  "/users/:id/shifts/:shiftId",
  requireAuth,
  requireRole("manager"),
  requireSameCompanyOrSelf,
  validate(updateShiftSchema),
  updateShiftForReportController,
);
router.delete(
  "/users/:id/shifts/:shiftId",
  requireAuth,
  requireRole("manager"),
  requireSameCompanyOrSelf,
  deleteShiftForReportController,
);

export default router;
