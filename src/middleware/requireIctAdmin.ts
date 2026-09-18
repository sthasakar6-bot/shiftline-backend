import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

export interface IctAdminPayload {
  ictAdmin: true;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      ictAdmin?: IctAdminPayload;
    }
  }
}

// Deliberately separate from requireAuth: a company-user token (whatever
// its role) never carries the `ictAdmin` claim, so it's rejected here even
// if somehow presented, and an ICT-admin token is never accepted by any
// company-scoped route either -- the two token types aren't interchangeable.
export function requireIctAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "Missing or invalid Authorization header");
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret) as unknown as IctAdminPayload;
    if (payload.ictAdmin !== true) {
      throw new AppError(401, "Invalid or expired token");
    }
    req.ictAdmin = payload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }

  next();
}
