import { Request, Response } from "express";
import { getAllUsers, getDirectReports, promoteToManager } from "./service";

export const getUsersController = async (req: Request, res: Response) => {
  const users = await getAllUsers();
  res.json(users);
};

export const getReportsController = async (req: Request, res: Response) => {
  const reports = await getDirectReports(req.user!.sub);
  res.json(reports);
};

export const promoteController = async (req: Request, res: Response) => {
  const user = await promoteToManager(Number(req.params.id));
  res.json(user);
};
