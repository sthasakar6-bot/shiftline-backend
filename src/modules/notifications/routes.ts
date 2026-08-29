import { Router } from "express";
import {
  listNotificationsController,
  markReadController,
  markAllReadController,
  deleteNotificationController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";

const router = Router();

router.get("/notifications", requireAuth, listNotificationsController);
router.patch("/notifications/read-all", requireAuth, markAllReadController);
router.patch("/notifications/:id/read", requireAuth, markReadController);
router.delete("/notifications/:id", requireAuth, deleteNotificationController);

export default router;
