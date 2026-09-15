import { Request, Response } from "express";
import { signup } from "./service";
import { AppError } from "../../errors/AppError";

export async function signupController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A company logo is required");
  }
  const { companyName, firstName, lastName, email, password } = req.body;
  const result = await signup({
    companyName,
    firstName,
    lastName,
    email,
    password,
    logoBuffer: req.file.buffer,
    logoMimeType: req.file.mimetype,
  });
  res.status(201).json(result);
}
