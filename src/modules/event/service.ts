import { findEventsByCompany, findEventById, createEvent, updateEvent, deleteEvent } from "./model";
import { AppError } from "../../errors/AppError";

export const listEvents = async (companyId: number) => {
  return findEventsByCompany(companyId);
};

export const addEvent = async (
  companyId: number,
  data: { title: string; startsAt: string; endsAt?: string | null },
) => {
  if (data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
    throw new AppError(400, "endsAt must be after startsAt");
  }
  return createEvent({ companyId, ...data });
};

export const editEvent = async (
  id: number,
  companyId: number,
  data: { title?: string; startsAt?: string; endsAt?: string | null },
) => {
  const existing = await findEventById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Event not found");
  }
  const startsAt = data.startsAt ?? existing.startsAt;
  const endsAt = data.endsAt === undefined ? existing.endsAt : data.endsAt;
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new AppError(400, "endsAt must be after startsAt");
  }
  const updated = await updateEvent(id, data);
  if (!updated) {
    throw new AppError(404, "Event not found");
  }
  return updated;
};

export const removeEvent = async (id: number, companyId: number) => {
  const existing = await findEventById(id);
  if (!existing || existing.companyId !== companyId) {
    throw new AppError(404, "Event not found");
  }
  await deleteEvent(id);
};
