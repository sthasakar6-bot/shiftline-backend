import {
  findContractsByUser,
  findContractByIdForUser,
  findContractPdfForUser,
  createContract,
  updateContractForUser,
  setContractPdf,
  deleteContractForUser,
  CreateContractInput,
  UpdateContractInput,
} from "./model";
import { AppError } from "../../errors/AppError";
import { notify } from "../notifications/service";

export async function listContracts(userId: number) {
  return findContractsByUser(userId);
}

export async function getContract(id: number, userId: number) {
  const contract = await findContractByIdForUser(id, userId);
  if (!contract) {
    throw new AppError(404, "Contract not found");
  }
  return contract;
}

export async function getContractPdf(id: number, userId: number) {
  const pdf = await findContractPdfForUser(id, userId);
  if (!pdf || !pdf.pdfBase64 || !pdf.pdfFilename) {
    throw new AppError(404, "No PDF uploaded for this contract");
  }
  return { pdfBase64: pdf.pdfBase64, pdfFilename: pdf.pdfFilename };
}

export async function addContract(userId: number, input: Omit<CreateContractInput, "userId">) {
  return createContract({ ...input, userId });
}

export async function editContract(id: number, userId: number, input: UpdateContractInput) {
  const updated = await updateContractForUser(id, userId, input);
  if (!updated) {
    throw new AppError(404, "Contract not found");
  }
  return updated;
}

export async function uploadContractPdf(
  id: number,
  userId: number,
  buffer: Buffer,
  filename: string,
) {
  const existing = await findContractByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Contract not found");
  }
  const updated = await setContractPdf(id, userId, buffer.toString("base64"), filename);
  await notify(userId, `Your ${existing.role} contract document is ready to view.`);
  return updated;
}

export async function removeContract(id: number, userId: number) {
  const existing = await findContractByIdForUser(id, userId);
  if (!existing) {
    throw new AppError(404, "Contract not found");
  }
  await deleteContractForUser(id, userId);
}
