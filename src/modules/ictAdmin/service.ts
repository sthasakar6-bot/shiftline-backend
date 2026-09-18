import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { listTickets, createTicket, updateTicketStatus, findTicketById } from "./model";
import { db } from "../../prisma/db";

// In-memory brute-force guard for the single ICT-admin login endpoint --
// this is one operator account behind a rarely-shared URL, not a
// multi-tenant login, so a per-process counter (reset on deploy/restart)
// is an intentional trade-off against the complexity of a shared store,
// not an oversight. Locks out an IP for 15 minutes after 5 failed
// attempts within a 15 minute window.
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const attempts = new Map<string, { count: number; firstAt: number }>();

function isLockedOut(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > FAILURE_WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.firstAt > FAILURE_WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

function clearFailures(ip: string): void {
  attempts.delete(ip);
}

export async function ictAdminLogin(email: string, password: string, ip: string) {
  if (isLockedOut(ip)) {
    throw new AppError(429, "Too many failed attempts. Try again in 15 minutes.");
  }

  const normalized = email.trim().toLowerCase();
  const configuredEmail = env.ictAdminEmail.trim().toLowerCase();

  if (!configuredEmail || !env.ictAdminPasswordHash) {
    throw new AppError(500, "ICT admin login is not configured");
  }

  if (normalized !== configuredEmail) {
    recordFailure(ip);
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await argon2.verify(env.ictAdminPasswordHash, password);
  if (!valid) {
    recordFailure(ip);
    throw new AppError(401, "Invalid email or password");
  }

  clearFailures(ip);

  const token = jwt.sign({ ictAdmin: true, email: configuredEmail }, env.jwtSecret, {
    expiresIn: "12h",
  });

  return { token };
}

export function getTickets() {
  return listTickets();
}

export async function addTicket(title: string, description: string, priority: string) {
  return createTicket({ title, description, priority });
}

export async function setTicketStatus(id: number, status: string) {
  const existing = await findTicketById(id);
  if (!existing) {
    throw new AppError(404, "Ticket not found");
  }
  await updateTicketStatus(id, status);
  return findTicketById(id);
}

export async function getSystemMonitoring() {
  const dbStart = Date.now();
  let dbOk = true;
  let dbLatencyMs: number | null = null;
  try {
    await db.orm.public.Company.first({});
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbOk = false;
    console.error("ICT admin DB ping failed:", err);
  }

  const mem = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    database: {
      ok: dbOk,
      latencyMs: dbLatencyMs,
    },
  };
}
