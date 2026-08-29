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

export async function listShiftsForReportController(req: Request, res: Response) {
  const shifts = await listShifts(Number(req.params.id));
  res.json(shifts);
}

export async function createShiftForReportController(req: Request, res: Response) {
  const { startsAt, endsAt, breakStart, breakEnd } = req.body;
  const shift = await addShift(Number(req.params.id), { startsAt, endsAt, breakStart, breakEnd });
  res.status(201).json(shift);
}

export async function updateShiftForReportController(req: Request, res: Response) {
  const { startsAt, endsAt, breakStart, breakEnd } = req.body;
  const shift = await editShift(Number(req.params.shiftId), Number(req.params.id), {
    startsAt,
    endsAt,
    breakStart,
    breakEnd,
  });
  res.json(shift);
}

export async function deleteShiftForReportController(req: Request, res: Response) {
  await removeShift(Number(req.params.shiftId), Number(req.params.id));
  res.status(204).send();
}
