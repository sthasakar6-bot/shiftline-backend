import { Router } from "express";
import {
  listOpenShiftsController,
  createOpenShiftController,
  updateOpenShiftController,
  deleteOpenShiftController,
  assignOpenShiftController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { createOpenShiftSchema, updateOpenShiftSchema, assignOpenShiftSchema } from "./schemas";

const router = Router();

// Open shifts (unfilled/required staffing slots) are manager-only, same as
// the rest of the roster -- there is no employee self-claim endpoint.
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

export default router;
