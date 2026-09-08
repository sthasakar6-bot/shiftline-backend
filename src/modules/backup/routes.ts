import { Router } from "express";
import {
  getBackupTokenController,
  createBackupTokenController,
  deleteBackupTokenController,
  downloadBackupController,
} from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { requireBackupToken } from "../../middleware/requireBackupToken";

const router = Router();

router.get("/backup-token", requireAuth, requireRole("manager"), getBackupTokenController);
router.post("/backup-token", requireAuth, requireRole("manager"), createBackupTokenController);
router.delete("/backup-token", requireAuth, requireRole("manager"), deleteBackupTokenController);

// Unattended access for a scheduled script -- authenticated by the
// long-lived backup token itself, not a login session.
router.get("/backup", requireBackupToken, downloadBackupController);

export default router;
