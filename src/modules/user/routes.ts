import { Router } from "express";
import {
  assignManagerController,
  getEmployeesController,
  getUsersController,
  getReportsController,
  promoteController,
  removeManagerController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";

const router = Router();

router.get("/users", requireAuth, getUsersController);
router.get("/users/reports", requireAuth, requireRole("manager"), getReportsController);
router.get("/users/employees", requireAuth, requireRole("manager"), getEmployeesController);
router.post(
  "/users/:id/promote",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  promoteController,
);
router.patch(
  "/users/:id/manager",
  requireAuth,
  requireRole("manager"),
  assignManagerController,
);
router.delete(
  "/users/:id/manager",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  removeManagerController,
);

export default router;
