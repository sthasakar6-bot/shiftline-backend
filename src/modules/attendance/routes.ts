import { Router } from "express";
import {
  listAttendanceController,
  clockInController,
  clockOutController,
  listAttendanceForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTargetOrSelf } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { clockInSchema, clockOutSchema } from "./schemas";

const router = Router();

router.get("/attendance", requireAuth, listAttendanceController);
router.post("/attendance/clock-in", requireAuth, validate(clockInSchema), clockInController);
router.post(
  "/attendance/:id/clock-out",
  requireAuth,
  validate(clockOutSchema),
  clockOutController,
);

router.get(
  "/users/:id/attendance",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  listAttendanceForReportController,
);

export default router;
