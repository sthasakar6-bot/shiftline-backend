import { db } from "../../prisma/db";

export interface LeaveRequest {
  id: number;
  userId: number;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveRequestInput {
  userId: number;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export async function findLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]> {
  return db.orm.public.LeaveRequest.where({ userId })
    .orderBy((l) => l.createdAt.desc())
    .all();
}

export async function findLeaveRequestByIdForUser(
  id: number,
  userId: number,
): Promise<LeaveRequest | null> {
  return db.orm.public.LeaveRequest.where({ id, userId }).first();
}

export async function createLeaveRequest(data: CreateLeaveRequestInput): Promise<LeaveRequest> {
  return db.orm.public.LeaveRequest.create(data);
}

export async function updateLeaveRequestStatus(
  id: number,
  userId: number,
  status: string,
): Promise<LeaveRequest | null> {
  return db.orm.public.LeaveRequest.where({ id, userId }).update({
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteLeaveRequestForUser(id: number, userId: number): Promise<void> {
  await db.orm.public.LeaveRequest.where({ id, userId }).delete();
}
