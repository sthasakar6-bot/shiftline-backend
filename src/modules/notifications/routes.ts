import { Router } from "express";
import { listNotificationsController, markReadController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";

const router = Router();

router.get("/notifications", requireAuth, listNotificationsController);
router.patch("/notifications/:id/read", requireAuth, markReadController);

export default router;
