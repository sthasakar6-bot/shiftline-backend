import { db } from "../../prisma/db";

export interface RosterEvent {
  id: number;
  companyId: number;
  title: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  companyId: number;
  title: string;
  startsAt: string;
  endsAt?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
}

export async function findEventsByCompany(companyId: number): Promise<RosterEvent[]> {
  return db.orm.public.Event.where({ companyId }).all();
}

export async function findEventById(id: number): Promise<RosterEvent | null> {
  return db.orm.public.Event.where({ id }).first();
}

export async function createEvent(data: CreateEventInput): Promise<RosterEvent> {
  return db.orm.public.Event.create(data);
}

export async function updateEvent(
  id: number,
  data: UpdateEventInput,
): Promise<RosterEvent | null> {
  return db.orm.public.Event.where({ id }).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteEvent(id: number): Promise<void> {
  await db.orm.public.Event.where({ id }).delete();
}
