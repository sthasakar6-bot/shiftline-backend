import { findUserById } from "../identity/model";
import { findAllEmployeesInCompany } from "../user/model";
import { AppError } from "../../errors/AppError";
import { listContracts, getContractPdf, addContract, uploadContractPdf } from "../contract/service";
import { listPayslips, getPayslipPdf, addPayslip, uploadPayslipPdf } from "../payslip/service";

// A bookkeeper isn't anyone's manager -- they're scoped to "any employee in
// my company", the same company-wide scope createEmployee/assignManager use,
// rather than the manages-a-direct-report relationship most contract/payslip
// routes require.
async function assertEmployeeInCompany(targetId: number, companyId: number) {
  const target = await findUserById(targetId);
  if (!target || target.companyId !== companyId || target.role !== "employee") {
    throw new AppError(404, "Employee not found");
  }
  return target;
}

export async function listEmployeesWithDocuments(companyId: number) {
  const employees = await findAllEmployeesInCompany(companyId);
  return Promise.all(
    employees.map(async (e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      contracts: await listContracts(e.id),
      payslips: await listPayslips(e.id),
    })),
  );
}

export async function createContractForEmployee(companyId: number, targetId: number, role: string) {
  await assertEmployeeInCompany(targetId, companyId);
  return addContract(targetId, { role });
}

export async function uploadContractPdfForEmployee(
  companyId: number,
  targetId: number,
  contractId: number,
  buffer: Buffer,
  filename: string,
) {
  await assertEmployeeInCompany(targetId, companyId);
  return uploadContractPdf(contractId, targetId, buffer, filename);
}

export async function getContractPdfForEmployee(
  companyId: number,
  targetId: number,
  contractId: number,
) {
  await assertEmployeeInCompany(targetId, companyId);
  return getContractPdf(contractId, targetId);
}

export async function createPayslipForEmployee(companyId: number, targetId: number, period: string) {
  await assertEmployeeInCompany(targetId, companyId);
  return addPayslip(targetId, { period });
}

export async function uploadPayslipPdfForEmployee(
  companyId: number,
  targetId: number,
  payslipId: number,
  buffer: Buffer,
  filename: string,
) {
  await assertEmployeeInCompany(targetId, companyId);
  return uploadPayslipPdf(payslipId, targetId, buffer, filename);
}

export async function getPayslipPdfForEmployee(
  companyId: number,
  targetId: number,
  payslipId: number,
) {
  await assertEmployeeInCompany(targetId, companyId);
  return getPayslipPdf(payslipId, targetId);
}
