import { Request, Response } from "express";
import { listCompanies } from "./service";

export async function listCompaniesController(req: Request, res: Response) {
  const companies = await listCompanies();
  res.json(companies);
}
