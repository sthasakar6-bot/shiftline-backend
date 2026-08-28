import { Router } from "express";
import {
  listContractsController,
  getContractController,
  listContractsForReportController,
  createContractForReportController,
  updateContractForReportController,
  deleteContractForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createContractSchema, updateContractSchema } from "./schemas";

const router = Router();

// Contracts are issued and managed by a manager, not self-service.
// Employees can only view their own.
router.get("/contracts", requireAuth, listContractsController);
router.get("/contracts/:id", requireAuth, getContractController);

router.get(
  "/users/:id/contracts",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  listContractsForReportController,
);
router.post(
  "/users/:id/contracts",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  validate(createContractSchema),
  createContractForReportController,
);
router.patch(
  "/users/:id/contracts/:contractId",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  validate(updateContractSchema),
  updateContractForReportController,
);
router.delete(
  "/users/:id/contracts/:contractId",
  requireAuth,
  requireRole("manager"),
  requireManagesTarget,
  deleteContractForReportController,
);

export default router;
