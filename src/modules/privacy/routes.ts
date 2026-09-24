import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { exportMyDataController, deleteMyAccountController } from "./controller";

const router = Router();

router.get("/me/export", requireAuth, exportMyDataController);
router.delete("/me", requireAuth, deleteMyAccountController);

export default router;
