import { Request, Response } from "express";
import {
  getBackupTokenInfo,
  generateBackupToken,
  revokeBackupToken,
  generateBackupCsv,
  listBackupSnapshots,
  getBackupSnapshotCsv,
} from "./service";

function sendCsv(res: Response, csv: string) {
  const filename = `shiftline-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function getBackupTokenController(req: Request, res: Response) {
  const info = await getBackupTokenInfo(req.user!.sub);
  res.json(info);
}

export async function createBackupTokenController(req: Request, res: Response) {
  const info = await generateBackupToken(req.user!.sub);
  res.status(201).json(info);
}

export async function deleteBackupTokenController(req: Request, res: Response) {
  await revokeBackupToken(req.user!.sub);
  res.status(204).send();
}

export async function downloadBackupController(req: Request, res: Response) {
  const csv = await generateBackupCsv(req.backupUserId!);
  sendCsv(res, csv);
}

export async function listBackupSnapshotsController(req: Request, res: Response) {
  const snapshots = await listBackupSnapshots(req.user!.sub);
  res.json(snapshots);
}

export async function downloadBackupSnapshotController(req: Request, res: Response) {
  const csv = await getBackupSnapshotCsv(Number(req.params.id), req.user!.sub);
  sendCsv(res, csv);
}
