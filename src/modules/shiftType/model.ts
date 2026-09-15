import { db } from "../../prisma/db";

export interface ShiftType {
  id: number;
  companyId: number;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftTypeInput {
  companyId: number;
  name: string;
  color: string;
  order?: number;
}

export interface UpdateShiftTypeInput {
  name?: string;
  color?: string;
  order?: number;
}

export async function findShiftTypesByCompany(companyId: number): Promise<ShiftType[]> {
  return db.orm.public.ShiftType.where({ companyId }).all();
}

export async function findShiftTypeById(id: number): Promise<ShiftType | null> {
  return db.orm.public.ShiftType.where({ id }).first();
}

export async function createShiftType(data: CreateShiftTypeInput): Promise<ShiftType> {
  return db.orm.public.ShiftType.create(data);
}

export async function updateShiftType(
  id: number,
  data: UpdateShiftTypeInput,
): Promise<ShiftType | null> {
  return db.orm.public.ShiftType.where({ id }).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteShiftType(id: number): Promise<void> {
  await db.orm.public.ShiftType.where({ id }).delete();
}

// .update() on a multi-row predicate only touches the first matching row,
// so fetch the ids first and update each -- same pattern as
// deleteAttendanceByShiftId in the attendance module.
export async function clearShiftTypeFromShifts(shiftTypeId: number): Promise<void> {
  const rows = await db.orm.public.Shift.select("id").where({ shiftTypeId }).all();
  await Promise.all(
    rows.map((r) => db.orm.public.Shift.where({ id: r.id }).update({ shiftTypeId: null })),
  );
}

export async function clearShiftTypeFromOpenShifts(shiftTypeId: number): Promise<void> {
  const rows = await db.orm.public.OpenShift.select("id").where({ shiftTypeId }).all();
  await Promise.all(
    rows.map((r) => db.orm.public.OpenShift.where({ id: r.id }).update({ shiftTypeId: null })),
  );
}
