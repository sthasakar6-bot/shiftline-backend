import { Router } from "express";
import multer from "multer";
import {
  listEmployeesController,
  createContractController,
  uploadContractPdfController,
  getContractPdfController,
  createPayslipController,
  uploadPayslipPdfController,
  getPayslipPdfController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validate } from "../../middleware/validate";
import { AppError } from "../../errors/AppError";
import { createContractSchema, createPayslipSchema } from "./schemas";

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

router.get(
  "/bookkeeper/employees",
  requireAuth,
  requireRole("bookkeeper"),
  listEmployeesController,
);
router.post(
  "/bookkeeper/employees/:id/contracts",
  requireAuth,
  requireRole("bookkeeper"),
  validate(createContractSchema),
  createContractController,
);
router.post(
  "/bookkeeper/employees/:id/contracts/:contractId/pdf",
  requireAuth,
  requireRole("bookkeeper"),
  upload.single("pdf"),
  uploadContractPdfController,
);
router.get(
  "/bookkeeper/employees/:id/contracts/:contractId/pdf",
  requireAuth,
  requireRole("bookkeeper"),
  getContractPdfController,
);
router.post(
  "/bookkeeper/employees/:id/payslips",
  requireAuth,
  requireRole("bookkeeper"),
  validate(createPayslipSchema),
  createPayslipController,
);
router.post(
  "/bookkeeper/employees/:id/payslips/:payslipId/pdf",
  requireAuth,
  requireRole("bookkeeper"),
  upload.single("pdf"),
  uploadPayslipPdfController,
);
router.get(
  "/bookkeeper/employees/:id/payslips/:payslipId/pdf",
  requireAuth,
  requireRole("bookkeeper"),
  getPayslipPdfController,
);

export default router;
