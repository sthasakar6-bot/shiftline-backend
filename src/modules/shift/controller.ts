import { Request, Response } from "express";
import { listShifts, getShift, addShift, editShift, removeShift } from "./service";

export async function listShiftsController(req: Request, res: Response) {
  const shifts = await listShifts(req.user!.sub);
  res.json(shifts);
}

export async function getShiftController(req: Request, res: Response) {
  const shift = await getShift(Number(req.params.id), req.user!.sub);
  res.json(shift);
}

export async function createShiftController(req: Request, res: Response) {
  const { startsAt, endsAt } = req.body;
  const shift = await addShift(req.user!.sub, { startsAt, endsAt });
  res.status(201).json(shift);
}

export async function updateShiftController(req: Request, res: Response) {
  const { startsAt, endsAt } = req.body;
  const shift = await editShift(Number(req.params.id), req.user!.sub, { startsAt, endsAt });
  res.json(shift);
}

export async function listShiftsForReportController(req: Request, res: Response) {
  const shifts = await listShifts(Number(req.params.id));
  res.json(shifts);
}

export async function createShiftForReportController(req: Request, res: Response) {
  const { startsAt, endsAt } = req.body;
  const shift = await addShift(Number(req.params.id), { startsAt, endsAt });
  res.status(201).json(shift);
}

export async function deleteShiftController(req: Request, res: Response) {
  await removeShift(Number(req.params.id), req.user!.sub);
  res.status(204).send();
}
