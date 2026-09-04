import { Router } from "express";
import multer from "multer";
import {
  listPayslipsController,
  getPayslipController,
  getPayslipPdfController,
  listPayslipsForReportController,
  getPayslipPdfForReportController,
  createPayslipForReportController,
  uploadPayslipPdfForReportController,
  deletePayslipForReportController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireManagesTargetOrSelf } from "../../middleware/requireManagesTarget";
import { validate } from "../../middleware/validate";
import { AppError } from "../../errors/AppError";
import { createPayslipSchema } from "./schemas";

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

// Payslips are issued and managed by a manager, not self-service.
// Employees can only view their own.
router.get("/payslips", requireAuth, listPayslipsController);
router.get("/payslips/:id", requireAuth, getPayslipController);
router.get("/payslips/:id/pdf", requireAuth, getPayslipPdfController);

router.get(
  "/users/:id/payslips",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  listPayslipsForReportController,
);
router.get(
  "/users/:id/payslips/:payslipId/pdf",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  getPayslipPdfForReportController,
);
router.post(
  "/users/:id/payslips",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  validate(createPayslipSchema),
  createPayslipForReportController,
);
router.post(
  "/users/:id/payslips/:payslipId/pdf",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  upload.single("pdf"),
  uploadPayslipPdfForReportController,
);
router.delete(
  "/users/:id/payslips/:payslipId",
  requireAuth,
  requireRole("manager"),
  requireManagesTargetOrSelf,
  deletePayslipForReportController,
);

export default router;
