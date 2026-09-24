import { Router } from "express";
import multer from "multer";
import { validate } from "../../middleware/validate";
import { requireIctAdmin } from "../../middleware/requireIctAdmin";
import {
  ictAdminLoginSchema,
  createTicketSchema,
  updateTicketStatusSchema,
  createCompanySchema,
  updateCompanyProfileSchema,
} from "./schemas";
import {
  ictAdminLoginController,
  listTicketsController,
  createTicketController,
  updateTicketStatusController,
  monitoringController,
  listCompaniesController,
  createCompanyController,
  deleteCompanyController,
  getCompanyProfileController,
  updateCompanyProfileController,
} from "./controller";
import { AppError } from "../../errors/AppError";

// Mirrors signup/routes.ts's own upload config.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError(400, "The company logo must be an image file"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// Public -- this IS the login. Everything else in this module requires the
// ICT-admin token it issues.
router.post("/ict-admin/login", validate(ictAdminLoginSchema), ictAdminLoginController);

router.get("/ict-admin/monitoring", requireIctAdmin, monitoringController);

router.get("/ict-admin/tickets", requireIctAdmin, listTicketsController);
router.post("/ict-admin/tickets", requireIctAdmin, validate(createTicketSchema), createTicketController);
router.patch(
  "/ict-admin/tickets/:id",
  requireIctAdmin,
  validate(updateTicketStatusSchema),
  updateTicketStatusController,
);

router.get("/ict-admin/companies", requireIctAdmin, listCompaniesController);
router.post(
  "/ict-admin/companies",
  requireIctAdmin,
  upload.single("logo"),
  validate(createCompanySchema),
  createCompanyController,
);
router.delete("/ict-admin/companies/:id", requireIctAdmin, deleteCompanyController);
router.get("/ict-admin/companies/:id", requireIctAdmin, getCompanyProfileController);
router.patch(
  "/ict-admin/companies/:id",
  requireIctAdmin,
  validate(updateCompanyProfileSchema),
  updateCompanyProfileController,
);

export default router;
