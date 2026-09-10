import { Request, Response } from "express";
import {
  listEmployeesWithDocuments,
  createContractForEmployee,
  uploadContractPdfForEmployee,
  getContractPdfForEmployee,
  createPayslipForEmployee,
  uploadPayslipPdfForEmployee,
  getPayslipPdfForEmployee,
} from "./service";
import { AppError } from "../../errors/AppError";

function sendPdf(res: Response, pdfBase64: string, pdfFilename: string) {
  const buffer = Buffer.from(pdfBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${pdfFilename}"`);
  res.send(buffer);
}

export async function listEmployeesController(req: Request, res: Response) {
  const employees = await listEmployeesWithDocuments(req.user!.companyId);
  res.json(employees);
}

export async function createContractController(req: Request, res: Response) {
  const { role } = req.body;
  const contract = await createContractForEmployee(req.user!.companyId, Number(req.params.id), role);
  res.status(201).json(contract);
}

export async function uploadContractPdfController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A PDF file is required");
  }
  const contract = await uploadContractPdfForEmployee(
    req.user!.companyId,
    Number(req.params.id),
    Number(req.params.contractId),
    req.file.buffer,
    req.file.originalname,
  );
  res.json(contract);
}

export async function getContractPdfController(req: Request, res: Response) {
  const pdf = await getContractPdfForEmployee(
    req.user!.companyId,
    Number(req.params.id),
    Number(req.params.contractId),
  );
  sendPdf(res, pdf.pdfBase64, pdf.pdfFilename);
}

export async function createPayslipController(req: Request, res: Response) {
  const { period } = req.body;
  const payslip = await createPayslipForEmployee(req.user!.companyId, Number(req.params.id), period);
  res.status(201).json(payslip);
}

export async function uploadPayslipPdfController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A PDF file is required");
  }
  const payslip = await uploadPayslipPdfForEmployee(
    req.user!.companyId,
    Number(req.params.id),
    Number(req.params.payslipId),
    req.file.buffer,
    req.file.originalname,
  );
  res.json(payslip);
}

export async function getPayslipPdfController(req: Request, res: Response) {
  const pdf = await getPayslipPdfForEmployee(
    req.user!.companyId,
    Number(req.params.id),
    Number(req.params.payslipId),
  );
  sendPdf(res, pdf.pdfBase64, pdf.pdfFilename);
}
