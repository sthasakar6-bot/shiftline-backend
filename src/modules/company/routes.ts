import { Router } from "express";
import { listCompaniesController, getCompanyLogoController } from "./controller";

const router = Router();

// Public -- shown on the company-picker screen before anyone has logged in.
router.get("/companies", listCompaniesController);
router.get("/companies/:id/logo", getCompanyLogoController);

export default router;
