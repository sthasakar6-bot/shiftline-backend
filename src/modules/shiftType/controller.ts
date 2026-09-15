import { Request, Response } from "express";
import { listShiftTypes, addShiftType, editShiftType, removeShiftType } from "./service";

export async function listShiftTypesController(req: Request, res: Response) {
  const shiftTypes = await listShiftTypes(req.user!.companyId);
  res.json(shiftTypes);
}

export async function createShiftTypeController(req: Request, res: Response) {
  const { name, color, order } = req.body;
  const shiftType = await addShiftType(req.user!.companyId, { name, color, order });
  res.status(201).json(shiftType);
}

export async function updateShiftTypeController(req: Request, res: Response) {
  const { name, color, order } = req.body;
  const shiftType = await editShiftType(Number(req.params.id), req.user!.companyId, {
    name,
    color,
    order,
  });
  res.json(shiftType);
}

export async function deleteShiftTypeController(req: Request, res: Response) {
  await removeShiftType(Number(req.params.id), req.user!.companyId);
  res.status(204).send();
}
