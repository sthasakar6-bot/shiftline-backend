import { findAllCompanies } from "./model";

export async function listCompanies() {
  return findAllCompanies();
}
