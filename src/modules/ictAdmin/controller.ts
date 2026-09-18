import { Request, Response } from "express";
import { ictAdminLogin, getTickets, addTicket, setTicketStatus, getSystemMonitoring } from "./service";

export async function ictAdminLoginController(req: Request, res: Response) {
  const { email, password } = req.body;
  // req.ip respects Express's trust proxy setting; falls back to the raw
  // socket address if that isn't configured -- either way, best-effort for
  // a rate-limit key, not a security boundary on its own.
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const result = await ictAdminLogin(email, password, ip);
  res.json(result);
}

export async function listTicketsController(_req: Request, res: Response) {
  const tickets = await getTickets();
  res.json(tickets);
}

export async function createTicketController(req: Request, res: Response) {
  const { title, description, priority } = req.body;
  const ticket = await addTicket(title, description, priority);
  res.status(201).json(ticket);
}

export async function updateTicketStatusController(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { status } = req.body;
  const ticket = await setTicketStatus(id, status);
  res.json(ticket);
}

export async function monitoringController(_req: Request, res: Response) {
  const data = await getSystemMonitoring();
  res.json(data);
}
