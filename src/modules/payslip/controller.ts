import { Request, Response } from "express";
import {
  listPayslips,
  getPayslip,
  getPayslipPdf,
  addPayslip,
  uploadPayslipPdf,
  removePayslip,
} from "./service";
import { AppError } from "../../errors/AppError";

function sendPdf(res: Response, pdfBase64: string, pdfFilename: string) {
  const buffer = Buffer.from(pdfBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${pdfFilename}"`);
  res.send(buffer);
}

export async function listPayslipsController(req: Request, res: Response) {
  const payslips = await listPayslips(req.user!.sub);
  res.json(payslips);
}

export async function getPayslipController(req: Request, res: Response) {
  const payslip = await getPayslip(Number(req.params.id), req.user!.sub);
  res.json(payslip);
}

export async function getPayslipPdfController(req: Request, res: Response) {
  const pdf = await getPayslipPdf(Number(req.params.id), req.user!.sub);
  sendPdf(res, pdf.pdfBase64, pdf.pdfFilename);
}

export async function listPayslipsForReportController(req: Request, res: Response) {
  const payslips = await listPayslips(Number(req.params.id));
  res.json(payslips);
}

export async function getPayslipPdfForReportController(req: Request, res: Response) {
  const pdf = await getPayslipPdf(Number(req.params.payslipId), Number(req.params.id));
  sendPdf(res, pdf.pdfBase64, pdf.pdfFilename);
}

export async function createPayslipForReportController(req: Request, res: Response) {
  const { period } = req.body;
  const payslip = await addPayslip(Number(req.params.id), { period });
  res.status(201).json(payslip);
}

export async function uploadPayslipPdfForReportController(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "A PDF file is required");
  }
  const payslip = await uploadPayslipPdf(
    Number(req.params.payslipId),
    Number(req.params.id),
    req.file.buffer,
    req.file.originalname,
  );
  res.json(payslip);
}

export async function deletePayslipForReportController(req: Request, res: Response) {
  await removePayslip(Number(req.params.payslipId), Number(req.params.id));
  res.status(204).send();
}
