import { findAllCompanies, findCompanyById } from "./model";
import { AppError } from "../../errors/AppError";

export async function listCompanies() {
  return findAllCompanies();
}

export async function getCompanyLogo(id: number) {
  const company = await findCompanyById(id);
  if (!company?.logoBase64 || !company.logoMimeType) {
    throw new AppError(404, "No logo set for this company");
  }
  return { logoBase64: company.logoBase64, logoMimeType: company.logoMimeType };
}
