import { Request, Response } from "express";
import {
  assignManager,
  getAllEmployees,
  getAllUsers,
  getDirectReports,
  promoteToManager,
  removeFromTeam,
} from "./service";

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
