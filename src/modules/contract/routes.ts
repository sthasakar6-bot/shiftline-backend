import { Router } from "express";
import {
  listContractsController,
  getContractController,
  createContractController,
  updateContractController,
  deleteContractController,
  listContractsForReportController,
  createContractForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTarget } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { createContractSchema, updateContractSchema } from "./schemas";

const router = Router();

router.get("/contracts", requireAuth, listContractsController);
router.get("/contracts/:id", requireAuth, getContractController);
router.post("/contracts", requireAuth, validate(createContractSchema), createContractController);
router.patch(
  "/contracts/:id",
  requireAuth,
  validate(updateContractSchema),
  updateContractController,
);
router.delete("/contracts/:id", requireAuth, deleteContractController);

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

export default router;
