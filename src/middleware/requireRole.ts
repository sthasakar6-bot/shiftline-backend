import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      throw new AppError(403, `Requires ${role} role`);
    }
    next();
  };
}
