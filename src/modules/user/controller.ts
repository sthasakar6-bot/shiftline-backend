import { Request, Response } from "express";
import {
  assignManager,
  getAllEmployees,
  getAllUsers,
  getAvatar,
  getDirectReports,
  promoteToManager,
  removeFromTeam,
  uploadAvatar,
} from "./service";
import { AppError } from "../../errors/AppError";

export const getUsersController = async (req: Request, res: Response) => {
  const users = await getAllUsers();
  res.json(users);
};

export const getReportsController = async (req: Request, res: Response) => {
  const reports = await getDirectReports(req.user!.sub);
  res.json(reports);
};

export const getEmployeesController = async (req: Request, res: Response) => {
  const employees = await getAllEmployees();
  res.json(employees);
};

export const promoteController = async (req: Request, res: Response) => {
  const user = await promoteToManager(Number(req.params.id));
  res.json(user);
};

export const assignManagerController = async (req: Request, res: Response) => {
  const user = await assignManager(Number(req.params.id), req.user!.sub);
  res.json(user);
};

export const removeManagerController = async (req: Request, res: Response) => {
  const user = await removeFromTeam(Number(req.params.id));
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
