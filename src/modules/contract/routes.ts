import { Router } from "express";
import multer from "multer";
import {
  listContractsController,
  getContractController,
  getContractPdfController,
  listContractsForReportController,
  getContractPdfForReportController,
  createContractForReportController,
  updateContractForReportController,
  uploadContractPdfForReportController,
  deleteContractForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTargetOrSelf } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { AppError } from "../../errors/AppError";
import { createContractSchema, updateContractSchema } from "./schemas";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new AppError(400, "Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// Contracts are issued and managed by a manager, not self-service.
// Employees can only view their own.
router.get("/contracts", requireAuth, listContractsController);
router.get("/contracts/:id", requireAuth, getContractController);
router.get("/contracts/:id/pdf", requireAuth, getContractPdfController);

router.get(
  "/users/:id/contracts",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  listContractsForReportController,
);
router.get(
  "/users/:id/contracts/:contractId/pdf",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  getContractPdfForReportController,
);
router.post(
  "/users/:id/contracts",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  validate(createContractSchema),
  createContractForReportController,
);
router.patch(
  "/users/:id/contracts/:contractId",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  validate(updateContractSchema),
  updateContractForReportController,
);
router.post(
  "/users/:id/contracts/:contractId/pdf",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  upload.single("pdf"),
  uploadContractPdfForReportController,
);
router.delete(
  "/users/:id/contracts/:contractId",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  deleteContractForReportController,
);

export default router;
