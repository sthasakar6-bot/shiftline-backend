import { Router } from "express";
import { listBackupSnapshotsController, downloadBackupSnapshotController } from "./controller";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";

const router = Router();

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
