import { db } from "../../prisma/db";

export interface Department {
  id: number;
  companyId: number;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  companyId: number;
  name: string;
  color: string;
  order?: number;
}

export interface UpdateDepartmentInput {
  name?: string;
  color?: string;
  order?: number;
}

export async function findDepartmentsByCompany(companyId: number): Promise<Department[]> {
  return db.orm.public.Department.where({ companyId }).all();
}

export async function findDepartmentById(id: number): Promise<Department | null> {
  return db.orm.public.Department.where({ id }).first();
}

export async function createDepartment(data: CreateDepartmentInput): Promise<Department> {
  return db.orm.public.Department.create(data);
}

export async function updateDepartment(
  id: number,
  data: UpdateDepartmentInput,
): Promise<Department | null> {
  return db.orm.public.Department.where({ id }).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDepartment(id: number): Promise<void> {
  await db.orm.public.Department.where({ id }).delete();
}

// .update() on a multi-row predicate only touches the first matching row,
// so fetch the ids first and update each -- same pattern as
// deleteAttendanceByShiftId in the attendance module.
export async function clearDepartmentFromUsers(departmentId: number): Promise<void> {
  const rows = await db.orm.public.User.select("id").where({ departmentId }).all();
  await Promise.all(
    rows.map((r) => db.orm.public.User.where({ id: r.id }).update({ departmentId: null })),
  );
}

export async function clearDepartmentFromOpenShifts(departmentId: number): Promise<void> {
  const rows = await db.orm.public.OpenShift.select("id").where({ departmentId }).all();
  await Promise.all(
    rows.map((r) => db.orm.public.OpenShift.where({ id: r.id }).update({ departmentId: null })),
  );
}
