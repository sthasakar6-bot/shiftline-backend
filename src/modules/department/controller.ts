import { Request, Response } from "express";
import { listDepartments, addDepartment, editDepartment, removeDepartment } from "./service";

export async function listDepartmentsController(req: Request, res: Response) {
  const departments = await listDepartments(req.user!.companyId);
  res.json(departments);
}

export async function createDepartmentController(req: Request, res: Response) {
  const { name, color, order } = req.body;
  const department = await addDepartment(req.user!.companyId, { name, color, order });
  res.status(201).json(department);
}

export async function updateDepartmentController(req: Request, res: Response) {
  const { name, color, order } = req.body;
  const department = await editDepartment(Number(req.params.id), req.user!.companyId, {
    name,
    color,
    order,
  });
  res.json(department);
}

export async function deleteDepartmentController(req: Request, res: Response) {
  await removeDepartment(Number(req.params.id), req.user!.companyId);
  res.status(204).send();
}
