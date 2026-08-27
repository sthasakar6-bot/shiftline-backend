import { Router } from "express";
import { listAttendanceController, clockInController, clockOutController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { clockInSchema } from "./schemas";

const router = Router();

router.get("/attendance", requireAuth, listAttendanceController);
router.post("/attendance/clock-in", requireAuth, validate(clockInSchema), clockInController);
router.post("/attendance/:id/clock-out", requireAuth, clockOutController);

export default router;
