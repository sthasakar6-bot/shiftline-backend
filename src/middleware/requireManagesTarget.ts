import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { findUserSummaryById } from "../modules/user/model";

export async function requireManagesTarget(req: Request, res: Response, next: NextFunction) {
  const targetId = Number(req.params.id);
  const target = await findUserSummaryById(targetId);
  if (!target) {
    throw new AppError(404, "User not found");
  }
  if (target.managerId !== req.user!.sub) {
    throw new AppError(403, "Not your report");
  }
  next();
}
