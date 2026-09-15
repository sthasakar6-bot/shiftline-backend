import { Router } from "express";
import {
  listShiftTypesController,
  createShiftTypeController,
  updateShiftTypeController,
  deleteShiftTypeController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { createShiftTypeSchema, updateShiftTypeSchema } from "./schemas";

const router = Router();

router.get("/shift-types", requireAuth, listShiftTypesController);
router.post(
  "/shift-types",
  requireAuth,
  requireRole("manager"),
  validate(createShiftTypeSchema),
  createShiftTypeController,
);
router.patch(
  "/shift-types/:id",
  requireAuth,
  requireRole("manager"),
  validate(updateShiftTypeSchema),
  updateShiftTypeController,
);
router.delete("/shift-types/:id", requireAuth, requireRole("manager"), deleteShiftTypeController);

export default router;
