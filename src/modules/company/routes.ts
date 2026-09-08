import { Router } from "express";
import { listCompaniesController } from "./controller";

const router = Router();

// Public -- shown on the company-picker screen before anyone has logged in.
router.get("/companies", listCompaniesController);

export default router;
