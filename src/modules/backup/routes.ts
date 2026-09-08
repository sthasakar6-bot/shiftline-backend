import { Router } from "express";
import {
  getBackupTokenController,
  createBackupTokenController,
  deleteBackupTokenController,
  downloadBackupController,
  listBackupSnapshotsController,
  downloadBackupSnapshotController,
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

// Automatic server-side snapshots -- keep running on a schedule regardless
// of whether the manager's own computer/script is on.
router.get(
  "/backup-history",
  requireAuth,
  requireRole("manager"),
  listBackupSnapshotsController,
);
router.get(
  "/backup-history/:id",
  requireAuth,
  requireRole("manager"),
  downloadBackupSnapshotController,
);

export default router;
