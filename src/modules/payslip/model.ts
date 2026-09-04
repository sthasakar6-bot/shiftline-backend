import { db } from "../../prisma/db";

export interface Payslip {
  id: number;
  period: string;
  pdfFilename: string | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayslipPdf {
  pdfBase64: string | null;
  pdfFilename: string | null;
}

export interface CreatePayslipInput {
  period: string;
  userId: number;
}

const LIST_FIELDS = ["id", "period", "pdfFilename", "userId", "createdAt", "updatedAt"] as const;

export async function findPayslipsByUser(userId: number): Promise<Payslip[]> {
  return db.orm.public.Payslip.select(...LIST_FIELDS).where({ userId }).all();
}

export async function findPayslipByIdForUser(id: number, userId: number): Promise<Payslip | null> {
  return db.orm.public.Payslip.select(...LIST_FIELDS).where({ id, userId }).first();
}

export async function findPayslipPdfForUser(
  id: number,
  userId: number,
): Promise<PayslipPdf | null> {
  return db.orm.public.Payslip.select("pdfBase64", "pdfFilename").where({ id, userId }).first();
}

export async function createPayslip(data: CreatePayslipInput): Promise<Payslip> {
  const created = await db.orm.public.Payslip.create(data);
  return {
    id: created.id,
    period: created.period,
    pdfFilename: created.pdfFilename,
    userId: created.userId,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

export async function setPayslipPdf(
  id: number,
  userId: number,
  pdfBase64: string,
  pdfFilename: string,
): Promise<Payslip | null> {
  return db.orm.public.Payslip.where({ id, userId })
    .select(...LIST_FIELDS)
    .update({ pdfBase64, pdfFilename, updatedAt: new Date().toISOString() });
}

export async function deletePayslipForUser(id: number, userId: number): Promise<void> {
  await db.orm.public.Payslip.where({ id, userId }).delete();
}
