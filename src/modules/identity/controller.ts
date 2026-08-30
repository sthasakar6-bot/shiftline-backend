import { Request, Response } from "express";
import { register, login, getCurrentUser, changePassword, updatePhone } from "./service";

export async function registerController(req: Request, res: Response) {
  const { name, email, password, token } = req.body;
  const user = await register(name, email, password, token);
  res.status(201).json(user);
}

export async function loginController(req: Request, res: Response) {
  const { email, password } = req.body;
  const result = await login(email, password);
  res.json(result);
}

export async function meController(req: Request, res: Response) {
  const user = await getCurrentUser(req.user!.sub);
  res.json(user);
}

export async function changePasswordController(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  await changePassword(req.user!.sub, currentPassword, newPassword);
  res.status(204).send();
}

export async function updatePhoneController(req: Request, res: Response) {
  const { phone } = req.body;
  await updatePhone(req.user!.sub, phone);
  res.status(204).send();
}
