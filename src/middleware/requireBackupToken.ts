import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { resolveBackupUserId } from "../modules/backup/service";

declare global {
  namespace Express {
    interface Request {
      backupUserId?: number;
    }
  }
}

export async function requireBackupToken(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token = headerToken || (req.query.token as string | undefined);

  if (!token) {
    throw new AppError(401, "Missing backup token");
  }

  req.backupUserId = await resolveBackupUserId(token);
  next();
}
