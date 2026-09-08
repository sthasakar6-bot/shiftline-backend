import { Request, Response } from "express";
import {
  getBackupTokenInfo,
  generateBackupToken,
  revokeBackupToken,
  generateBackupCsv,
} from "./service";

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
  const filename = `shiftline-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
