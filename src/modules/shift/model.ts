import { db } from "../../prisma/db";

export interface Shift {
  id: number;
  userId: number;
  startsAt: string;
  endsAt: string;
  breakMinutes: number | null;
  noShowCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftInput {
  userId: number;
  startsAt: string;
  endsAt: string;
  breakMinutes?: number;
}

export interface UpdateShiftInput {
  startsAt?: string;
  endsAt?: string;
  breakMinutes?: number;
}

export async function findShiftsByUser(userId: number): Promise<Shift[]> {
  return db.orm.public.Shift.where({ userId }).all();
}

export async function findShiftByIdForUser(id: number, userId: number): Promise<Shift | null> {
  return db.orm.public.Shift.where({ id, userId }).first();
}

export async function createShift(data: CreateShiftInput): Promise<Shift> {
  return db.orm.public.Shift.create(data);
}

export async function updateShiftForUser(
  id: number,
  userId: number,
  data: UpdateShiftInput,
): Promise<Shift | null> {
  return db.orm.public.Shift.where({ id, userId }).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteShiftForUser(id: number, userId: number): Promise<void> {
  await db.orm.public.Shift.where({ id, userId }).delete();
}

export async function findShiftsPendingNoShowCheck(): Promise<Shift[]> {
  return db.orm.public.Shift.where({ noShowCheckedAt: null }).all();
}

export async function markShiftNoShowChecked(id: number): Promise<void> {
  await db.orm.public.Shift.where({ id }).update({
    noShowCheckedAt: new Date().toISOString(),
  });
}
