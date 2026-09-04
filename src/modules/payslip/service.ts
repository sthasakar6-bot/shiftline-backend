import {
  findPayslipsByUser,
  findPayslipByIdForUser,
  findPayslipPdfForUser,
  createPayslip,
  setPayslipPdf,
  deletePayslipForUser,
  CreatePayslipInput,
} from "./model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";

export async function listPayslips(userId: number) {
  return findPayslipsByUser(userId);
}

export async function getPayslip(id: number, userId: number) {
  const payslip = await findPayslipByIdForUser(id, userId);
  if (!payslip) {
    throw new AppError(404, "Payslip not found");
  }
  return payslip;
}

export async function getPayslipPdf(id: number, userId: number) {
  const pdf = await findPayslipPdfForUser(id, userId);
  if (!pdf || !pdf.pdfBase64 || !pdf.pdfFilename) {
    throw new AppError(404, "No PDF uploaded for this payslip");
  }
  return { pdfBase64: pdf.pdfBase64, pdfFilename: pdf.pdfFilename };
}

export async function addPayslip(userId: number, input: Omit<CreatePayslipInput, "userId">) {
  return createPayslip({ ...input, userId });
}

export async function uploadPayslipPdf(
  id: number,
  userId: number,
  buffer: Buffer,
  filename: string,
) {
  const existing = await findPayslipByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Payslip not found");
  }
  const updated = await setPayslipPdf(id, userId, buffer.toString("base64"), filename);
  await notify(
    userId,
    `Your payslip for ${existing.period} is ready to view.`,
    "Payslip Ready",
    "/profile",
  );
  return updated;
}

export async function removePayslip(id: number, userId: number) {
  const existing = await findPayslipByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Payslip not found");
  }
  await deletePayslipForUser(id, userId);
}
