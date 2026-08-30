import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { touchLastSeen } from "../modules/identity/model";

export interface AuthPayload {
  sub: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or invalid Authorization header");
  }

  const token = header.slice(7);

  try {
    req.user = jwt.verify(token, env.jwtSecret) as unknown as AuthPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }

  await touchLastSeen(req.user.sub).catch(() => {});
  next();
}
