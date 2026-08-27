import { db } from "../../prisma/db";

export interface Contract {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractInput {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status?: string;
  userId: number;
}

export interface UpdateContractInput {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export async function findContractsByUser(userId: number): Promise<Contract[]> {
  return db.orm.public.Contract.where({ userId }).all();
}

export async function findContractByIdForUser(
  id: number,
  userId: number,
): Promise<Contract | null> {
  return db.orm.public.Contract.where({ id, userId }).first();
}

export async function createContract(data: CreateContractInput): Promise<Contract> {
  return db.orm.public.Contract.create(data);
}

export async function updateContractForUser(
  id: number,
  userId: number,
  data: UpdateContractInput,
): Promise<Contract | null> {
  return db.orm.public.Contract.where({ id, userId }).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteContractForUser(id: number, userId: number): Promise<void> {
  await db.orm.public.Contract.where({ id, userId }).delete();
}
