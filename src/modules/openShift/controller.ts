import { Request, Response } from "express";
import {
  listOpenShifts,
  addOpenShift,
  editOpenShift,
  removeOpenShift,
  assignOpenShift,
} from "./service";

export async function listOpenShiftsController(req: Request, res: Response) {
  const openShifts = await listOpenShifts(req.user!.companyId);
  res.json(openShifts);
}

export async function createOpenShiftController(req: Request, res: Response) {
  const { departmentId, shiftTypeId, startsAt, endsAt, breakMinutes, requiredCount, notes } =
    req.body;
  const openShift = await addOpenShift(req.user!.companyId, {
    departmentId,
    shiftTypeId,
    startsAt,
    endsAt,
    breakMinutes,
    requiredCount,
    notes,
  });
  res.status(201).json(openShift);
}

export async function updateOpenShiftController(req: Request, res: Response) {
  const { departmentId, shiftTypeId, startsAt, endsAt, breakMinutes, requiredCount, notes } =
    req.body;
  const openShift = await editOpenShift(Number(req.params.id), req.user!.companyId, {
    departmentId,
    shiftTypeId,
    startsAt,
    endsAt,
    breakMinutes,
    requiredCount,
    notes,
  });
  res.json(openShift);
}

export async function deleteOpenShiftController(req: Request, res: Response) {
  await removeOpenShift(Number(req.params.id), req.user!.companyId);
  res.status(204).send();
}

export async function assignOpenShiftController(req: Request, res: Response) {
  const { userId, startsAt, endsAt, breakMinutes } = req.body;
  const openShift = await assignOpenShift(Number(req.params.id), req.user!.companyId, {
    userId,
    startsAt,
    endsAt,
    breakMinutes,
  });
  res.json(openShift);
}
