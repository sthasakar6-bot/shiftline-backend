import { Request, Response } from "express";
import { listAttendance, clockIn, clockOut } from "./service";

export async function listAttendanceController(req: Request, res: Response) {
  const records = await listAttendance(req.user!.sub);
  res.json(records);
}

export async function clockInController(req: Request, res: Response) {
  const { shiftId, lat, lng, clockedAt } = req.body;
  const record = await clockIn(req.user!.sub, shiftId, lat, lng, clockedAt);
  res.status(201).json(record);
}

export async function clockOutController(req: Request, res: Response) {
  const { lat, lng, clockedAt } = req.body;
  const record = await clockOut(Number(req.params.id), req.user!.sub, lat, lng, clockedAt);
  res.json(record);
}

export async function listAttendanceForReportController(req: Request, res: Response) {
  const records = await listAttendance(Number(req.params.id));
  res.json(records);
}
