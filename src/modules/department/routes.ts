import { Router } from "express";
import {
  listDepartmentsController,
  createDepartmentController,
  updateDepartmentController,
  deleteDepartmentController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { createDepartmentSchema, updateDepartmentSchema } from "./schemas";

const router = Router();

router.get("/departments", requireAuth, listDepartmentsController);
router.post(
  "/departments",
  requireAuth,
  requireRole("manager"),
  validate(createDepartmentSchema),
  createDepartmentController,
);
router.patch(
  "/departments/:id",
  requireAuth,
  requireRole("manager"),
  validate(updateDepartmentSchema),
  updateDepartmentController,
);
router.delete("/departments/:id", requireAuth, requireRole("manager"), deleteDepartmentController);

export default router;
