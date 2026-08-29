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

// Like requireManagesTarget, but also allows a manager to target themselves.
// Used where it makes sense for a manager to manage their own records (e.g.
// their own contract) -- not a blanket replacement, since letting a manager
// "manage" themselves would be wrong for things like approving their own
// leave requests.
export async function requireManagesTargetOrSelf(req: Request, res: Response, next: NextFunction) {
  const targetId = Number(req.params.id);
  if (targetId === req.user!.sub) {
    next();
    return;
  }
  const target = await findUserSummaryById(targetId);
  if (!target) {
    throw new AppError(404, "User not found");
  }
  if (target.managerId !== req.user!.sub) {
    throw new AppError(403, "Not your report");
  }
  next();
}
