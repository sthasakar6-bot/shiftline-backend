import { Request, Response } from "express";
import { exportUserData, deleteOwnAccount } from "./model";
import { AppError } from "../../errors/AppError";

export async function exportMyDataController(req: Request, res: Response) {
  const data = await exportUserData(req.user!.sub);
  if (!data) {
    throw new AppError(404, "User not found");
  }
  res.setHeader("Content-Disposition", "attachment; filename=shiftline-my-data.json");
  res.json(data);
}

export async function deleteMyAccountController(req: Request, res: Response) {
  const { sub, companyId, role } = req.user!;
  const result = await deleteOwnAccount(sub, companyId, role);
  res.json(result);
}
