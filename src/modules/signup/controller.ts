import { Request, Response } from "express";
import { signup } from "./service";

export async function signupController(req: Request, res: Response) {
  const { companyName, firstName, lastName, email, password } = req.body;
  const result = await signup({ companyName, firstName, lastName, email, password });
  res.status(201).json(result);
}
