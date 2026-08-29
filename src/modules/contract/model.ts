import { db } from "../../prisma/db";

export interface Contract {
  id: number;
  role: string;
  pdfFilename: string | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractPdf {
  pdfBase64: string | null;
  pdfFilename: string | null;
}

export interface CreateContractInput {
  role: string;
  userId: number;
}

export interface UpdateContractInput {
  role?: string;
}

const LIST_FIELDS = ["id", "role", "pdfFilename", "userId", "createdAt", "updatedAt"] as const;

export async function findContractsByUser(userId: number): Promise<Contract[]> {
  return db.orm.public.Contract.select(...LIST_FIELDS).where({ userId }).all();
}

export async function findContractByIdForUser(
  id: number,
  userId: number,
): Promise<Contract | null> {
  return db.orm.public.Contract.select(...LIST_FIELDS).where({ id, userId }).first();
}

export async function findContractPdfForUser(
  id: number,
  userId: number,
): Promise<ContractPdf | null> {
  return db.orm.public.Contract.select("pdfBase64", "pdfFilename").where({ id, userId }).first();
}

export async function createContract(data: CreateContractInput): Promise<Contract> {
  const created = await db.orm.public.Contract.create(data);
  return {
    id: created.id,
    role: created.role,
    pdfFilename: created.pdfFilename,
    userId: created.userId,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

export async function updateContractForUser(
  id: number,
  userId: number,
  data: UpdateContractInput,
): Promise<Contract | null> {
  return db.orm.public.Contract.where({ id, userId })
    .select(...LIST_FIELDS)
    .update({ ...data, updatedAt: new Date().toISOString() });
}

export async function setContractPdf(
  id: number,
  userId: number,
  pdfBase64: string,
  pdfFilename: string,
): Promise<Contract | null> {
  return db.orm.public.Contract.where({ id, userId })
    .select(...LIST_FIELDS)
    .update({ pdfBase64, pdfFilename, updatedAt: new Date().toISOString() });
}

export async function deleteContractForUser(id: number, userId: number): Promise<void> {
  await db.orm.public.Contract.where({ id, userId }).delete();
}
