import { Request, Response } from "express";
import {
  listContracts,
  getContract,
  getContractPdf,
  addContract,
  editContract,
  uploadContractPdf,
  removeContract,
} from "./service";
import { AppError } from "../../errors/AppError";

function sendPdf(res: Response, pdfBase64: string, pdfFilename: string) {
  const buffer = Buffer.from(pdfBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${pdfFilename}"`);
  res.send(buffer);
}

export async function listContractsController(req: Request, res: Response) {
  const contracts = await listContracts(req.user!.sub);
  res.json(contracts);
}

export async function getContractController(req: Request, res: Response) {
  const contract = await getContract(Number(req.params.id), req.user!.sub);
  res.json(contract);
}

export async function getContractPdfController(req: Request, res: Response) {
  const pdf = await getContractPdf(Number(req.params.id), req.user!.sub);
  sendPdf(res, pdf.pdfBase64, pdf.pdfFilename);
}

export async function listContractsForReportController(req: Request, res: Response) {
  const contracts = await listContracts(Number(req.params.id));
  res.json(contracts);
}

export async function getContractPdfForReportController(req: Request, res: Response) {
  const pdf = await getContractPdf(Number(req.params.contractId), Number(req.params.id));
  sendPdf(res, pdf.pdfBase64, pdf.pdfFilename);
}

export async function createContractForReportController(req: Request, res: Response) {
  const { role } = req.body;
  const contract = await addContract(Number(req.params.id), { role });
  res.status(201).json(contract);
}

export async function updateContractForReportController(req: Request, res: Response) {
  const { role } = req.body;
  const contract = await editContract(Number(req.params.contractId), Number(req.params.id), {
    role,
  });
  res.json(contract);
}

export async function uploadContractPdfForReportController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A PDF file is required");
  }
  const contract = await uploadContractPdf(
    Number(req.params.contractId),
    Number(req.params.id),
    req.file.buffer,
    req.file.originalname,
  );
  res.json(contract);
}

export async function deleteContractForReportController(req: Request, res: Response) {
  await removeContract(Number(req.params.contractId), Number(req.params.id));
  res.status(204).send();
}
