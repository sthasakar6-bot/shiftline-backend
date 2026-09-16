import { db } from "../../prisma/db";

export interface Company {
  id: number;
  name: string;
  slug: string;
  plan: string;
  trialEndsAt: string | null;
  logoBase64: string | null;
  logoMimeType: string | null;
  billingProvider: string | null;
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  billingInterval: string | null;
  subscriptionStatus: string | null;
  pendingPlan: string | null;
  pendingInterval: string | null;
  aiAssistantSubscriptionId: string | null;
  aiAssistantStatus: string | null;
  createdAt: string;
}

export interface CompanyListItem {
  id: number;
  name: string;
  slug: string;
  hasLogo: boolean;
  createdAt: string;
}

// Deliberately narrower than Company: this backs the public pre-login
// company picker, which has no reason to expose trial/plan status or the
// logo bytes themselves (that's a separate GET .../logo request).
export async function findAllCompanies(): Promise<CompanyListItem[]> {
  const rows = await db.orm.public.Company.select(
    "id",
    "name",
    "slug",
    "logoBase64",
    "createdAt",
  ).all();
  return rows.map(({ logoBase64, ...rest }) => ({ ...rest, hasLogo: Boolean(logoBase64) }));
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
