import { db } from "../../prisma/db";

export interface OpenShift {
  id: number;
  companyId: number;
  departmentId: number | null;
  shiftTypeId: number | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number | null;
  requiredCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpenShiftInput {
  companyId: number;
  departmentId?: number;
  shiftTypeId?: number;
  startsAt: string;
  endsAt: string;
  breakMinutes?: number;
  requiredCount?: number;
  notes?: string;
}

export interface UpdateOpenShiftInput {
  departmentId?: number | null;
  shiftTypeId?: number | null;
  startsAt?: string;
  endsAt?: string;
  breakMinutes?: number;
  requiredCount?: number;
  notes?: string | null;
}

export async function findOpenShiftsByCompany(companyId: number): Promise<OpenShift[]> {
  return db.orm.public.OpenShift.where({ companyId }).all();
}

export async function findOpenShiftById(id: number): Promise<OpenShift | null> {
  return db.orm.public.OpenShift.where({ id }).first();
}

export async function createOpenShift(data: CreateOpenShiftInput): Promise<OpenShift> {
  return db.orm.public.OpenShift.create(data);
}

export async function updateOpenShift(
  id: number,
  data: UpdateOpenShiftInput,
): Promise<OpenShift | null> {
  return db.orm.public.OpenShift.where({ id }).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteOpenShift(id: number): Promise<void> {
  await db.orm.public.OpenShift.where({ id }).delete();
}

// .update() on a multi-row predicate only touches the first matching row,
// so fetch the ids first and update each -- same pattern as
// deleteAttendanceByShiftId in the attendance module. Detaching keeps the
// real assigned Shift rows intact; only their slot link is cleared.
export async function clearOpenShiftFromShifts(openShiftId: number): Promise<void> {
  const rows = await db.orm.public.Shift.select("id").where({ openShiftId }).all();
  await Promise.all(
    rows.map((r) => db.orm.public.Shift.where({ id: r.id }).update({ openShiftId: null })),
  );
}

export interface OpenShiftRequest {
  id: number;
  companyId: number;
  openShiftId: number;
  userId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpenShiftRequestInput {
  companyId: number;
  openShiftId: number;
  userId: number;
}

export async function findOpenShiftRequestsBySlot(openShiftId: number): Promise<OpenShiftRequest[]> {
  return db.orm.public.OpenShiftRequest.where({ openShiftId }).all();
}

export async function findPendingOpenShiftRequestForUser(
  openShiftId: number,
  userId: number,
): Promise<OpenShiftRequest | null> {
  return db.orm.public.OpenShiftRequest.where({ openShiftId, userId, status: "pending" }).first();
}

export async function findOpenShiftRequestById(id: number): Promise<OpenShiftRequest | null> {
  return db.orm.public.OpenShiftRequest.where({ id }).first();
}

export async function createOpenShiftRequest(
  data: CreateOpenShiftRequestInput,
): Promise<OpenShiftRequest> {
  return db.orm.public.OpenShiftRequest.create(data);
}

export async function updateOpenShiftRequestStatus(
  id: number,
  status: string,
): Promise<OpenShiftRequest | null> {
  return db.orm.public.OpenShiftRequest.where({ id }).update({
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteOpenShiftRequest(id: number): Promise<void> {
  await db.orm.public.OpenShiftRequest.where({ id }).delete();
}

// Requests are meaningless once their slot is gone -- unlike shifts (which
// detach and stay as real records), delete them outright when the slot is
// removed. Same multi-row-predicate caveat as clearOpenShiftFromShifts above.
export async function deleteOpenShiftRequestsBySlot(openShiftId: number): Promise<void> {
  const rows = await db.orm.public.OpenShiftRequest.select("id").where({ openShiftId }).all();
  await Promise.all(rows.map((r) => db.orm.public.OpenShiftRequest.where({ id: r.id }).delete()));
}
