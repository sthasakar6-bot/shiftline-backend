import { Request, Response } from "express";
import {
  assignManager,
  createBookkeeperAccount,
  createEmployee,
  createManagerAccount,
  deactivateEmployee,
  getAllEmployees,
  getAllUsers,
  getAvatar,
  getDirectReports,
  getFormerEmployees,
  promoteToManager,
  reactivateEmployee,
  removeFromTeam,
  uploadAvatar,
} from "./service";
import { AppError } from "../../errors/AppError";

export const getUsersController = async (req: Request, res: Response) => {
  const users = await getAllUsers(req.user!.companyId);
  res.json(users);
};

export const createEmployeeController = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await createEmployee(req.user!.sub, firstName, lastName, email, password);
  res.status(201).json(user);
};

export const createManagerController = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await createManagerAccount(req.user!.sub, firstName, lastName, email, password);
  res.status(201).json(user);
};

export const createBookkeeperController = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await createBookkeeperAccount(req.user!.sub, firstName, lastName, email, password);
  res.status(201).json(user);
};

export const getReportsController = async (req: Request, res: Response) => {
  const reports = await getDirectReports(req.user!.sub);
  res.json(reports);
};

export const getEmployeesController = async (req: Request, res: Response) => {
  const employees = await getAllEmployees(req.user!.companyId);
  res.json(employees);
};

export const promoteController = async (req: Request, res: Response) => {
  const user = await promoteToManager(Number(req.params.id));
  res.json(user);
};

export const assignManagerController = async (req: Request, res: Response) => {
  const user = await assignManager(Number(req.params.id), req.user!.sub, req.user!.companyId);
  res.json(user);
};

export const removeManagerController = async (req: Request, res: Response) => {
  const user = await removeFromTeam(Number(req.params.id));
  res.json(user);
};

export const getFormerEmployeesController = async (req: Request, res: Response) => {
  const employees = await getFormerEmployees(req.user!.companyId);
  res.json(employees);
};

export const deactivateEmployeeController = async (req: Request, res: Response) => {
  const user = await deactivateEmployee(Number(req.params.id), req.user!.companyId);
  res.json(user);
};

export const reactivateEmployeeController = async (req: Request, res: Response) => {
  const user = await reactivateEmployee(Number(req.params.id), req.user!.companyId);
  res.json(user);
};

export const uploadAvatarController = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(400, "An image file is required");
  }
  await uploadAvatar(req.user!.sub, req.file.buffer, req.file.mimetype);
  res.status(204).send();
};

export const getAvatarController = async (req: Request, res: Response) => {
  const avatar = await getAvatar(Number(req.params.id));
  res.setHeader("Content-Type", avatar.avatarMimeType);
  res.send(Buffer.from(avatar.avatarBase64, "base64"));
};
