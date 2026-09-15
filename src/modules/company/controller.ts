import { Request, Response } from "express";
import { listCompanies, getCompanyLogo } from "./service";

export async function listCompaniesController(req: Request, res: Response) {
  const companies = await listCompanies();
  res.json(companies);
}

export async function getCompanyLogoController(req: Request, res: Response) {
  const logo = await getCompanyLogo(Number(req.params.id));
  res.setHeader("Content-Type", logo.logoMimeType);
  res.send(Buffer.from(logo.logoBase64, "base64"));
}
