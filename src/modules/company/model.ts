import { db } from "../../prisma/db";

export interface Company {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
}

export async function findAllCompanies(): Promise<Company[]> {
  return db.orm.public.Company.select("id", "name", "slug", "createdAt").all();
}

export async function findCompanyById(id: number): Promise<Company | null> {
  return db.orm.public.Company.first({ id });
}

export async function findCompanyBySlug(slug: string): Promise<Company | null> {
  return db.orm.public.Company.first({ slug });
}

export async function createCompany(name: string, slug: string): Promise<Company> {
  return db.orm.public.Company.create({ name, slug });
}
