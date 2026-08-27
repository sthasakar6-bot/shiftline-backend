import { Request, Response } from "express";
import { listAttendance, clockIn, clockOut } from "./service";

export async function listAttendanceController(req: Request, res: Response) {
  const records = await listAttendance(req.user!.sub);
  res.json(records);
}

export async function clockInController(req: Request, res: Response) {
  const { shiftId } = req.body;
  const record = await clockIn(req.user!.sub, shiftId);
  res.status(201).json(record);
}

export async function clockOutController(req: Request, res: Response) {
  const record = await clockOut(Number(req.params.id), req.user!.sub);
  res.json(record);
}
