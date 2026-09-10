import { findUserById } from "../identity/model";
import { findPayrollEligibleInCompany } from "../user/model";
import { findAttendanceByUser } from "../attendance/model";
import { AppError } from "../../errors/AppError";
import {
  listContracts,
  getContractPdf,
  addContract,
  uploadContractPdf,
  removeContract,
} from "../contract/service";
import { listPayslips, getPayslipPdf, addPayslip, uploadPayslipPdf, removePayslip } from "../payslip/service";

// A bookkeeper isn't anyone's manager -- they're scoped to "anyone in my
// company who needs payroll documents", the same company-wide scope
// createEmployee/assignManager use, rather than the manages-a-direct-report
// relationship most contract/payslip routes require. Managers need payslips
// and contracts too; only other bookkeepers are excluded.
async function assertEmployeeInCompany(targetId: number, companyId: number) {
  const target = await findUserById(targetId);
  if (!target || target.companyId !== companyId || target.role === "bookkeeper") {
    throw new AppError(404, "Employee not found");
  }
  return target;
}

// Actual clocked time, not scheduled shift time -- this is what a bookkeeper
// needs for payroll math, and matches the "hours worked" figure an employee
// already sees on their own profile.
function hoursWorkedThisMonth(attendance: { clockIn: string | null; clockOut: string | null }[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const ms = attendance.reduce((sum, a) => {
    if (!a.clockIn || !a.clockOut) return sum;
    const clockIn = new Date(a.clockIn);
    if (clockIn < monthStart || clockIn >= monthEnd) return sum;
    return sum + (new Date(a.clockOut).getTime() - clockIn.getTime());
  }, 0);
  return Math.round((ms / 3600000) * 100) / 100;
}

export async function listEmployeesWithDocuments(companyId: number) {
  const employees = await findPayrollEligibleInCompany(companyId);
  return Promise.all(
    employees.map(async (e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      hoursThisMonth: hoursWorkedThisMonth(await findAttendanceByUser(e.id)),
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

export async function deletePayslipForEmployee(
  companyId: number,
  targetId: number,
  payslipId: number,
) {
  await assertEmployeeInCompany(targetId, companyId);
  return removePayslip(payslipId, targetId);
}

export async function deleteContractForEmployee(
  companyId: number,
  targetId: number,
  contractId: number,
) {
  await assertEmployeeInCompany(targetId, companyId);
  return removeContract(contractId, targetId);
}
