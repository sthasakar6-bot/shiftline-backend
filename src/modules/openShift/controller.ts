import { Request, Response } from "express";
import {
  listOpenShifts,
  addOpenShift,
  editOpenShift,
  removeOpenShift,
  assignOpenShift,
  requestOpenShift,
  cancelOpenShiftRequest,
  approveOpenShiftRequest,
  rejectOpenShiftRequest,
} from "./service";

export async function listOpenShiftsController(req: Request, res: Response) {
  const openShifts = await listOpenShifts(req.user!.companyId, req.user!.sub);
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

export async function requestOpenShiftController(req: Request, res: Response) {
  const request = await requestOpenShift(Number(req.params.id), req.user!.sub, req.user!.companyId);
  res.status(201).json(request);
}

export async function cancelOpenShiftRequestController(req: Request, res: Response) {
  await cancelOpenShiftRequest(Number(req.params.requestId), req.user!.sub);
  res.status(204).send();
}

export async function approveOpenShiftRequestController(req: Request, res: Response) {
  const openShift = await approveOpenShiftRequest(Number(req.params.requestId), req.user!.companyId);
  res.json(openShift);
}

export async function rejectOpenShiftRequestController(req: Request, res: Response) {
  const request = await rejectOpenShiftRequest(Number(req.params.requestId), req.user!.companyId);
  res.json(request);
}
