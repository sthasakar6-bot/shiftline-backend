import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

interface SqlError {
  sqlState?: string;
  constraint?: string;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  const sql = err as SqlError;
  if (sql.sqlState === "23503") {
    res.status(409).json({ error: "Cannot complete: related records still reference this row" });
    return;
  }
  if (sql.sqlState === "23505") {
    res.status(409).json({ error: "A record with this value already exists" });
    return;
  }

  const httpErr = err as { status?: number; statusCode?: number; message?: string };
  const status = httpErr.status ?? httpErr.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: httpErr.message || "Bad request" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
