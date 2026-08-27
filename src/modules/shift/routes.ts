import { Router } from "express";
import {
  listShiftsController,
  getShiftController,
  createShiftController,
  updateShiftController,
  deleteShiftController,
  listShiftsForReportController,
  createShiftForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createShiftSchema, updateShiftSchema } from "./schemas";

const router = Router();

router.get("/shifts", requireAuth, listShiftsController);
router.get("/shifts/:id", requireAuth, getShiftController);
router.post("/shifts", requireAuth, validate(createShiftSchema), createShiftController);
router.patch("/shifts/:id", requireAuth, validate(updateShiftSchema), updateShiftController);
router.delete("/shifts/:id", requireAuth, deleteShiftController);

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

export default router;
