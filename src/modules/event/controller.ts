import { Request, Response } from "express";
import { listEvents, addEvent, editEvent, removeEvent } from "./service";

export async function listEventsController(req: Request, res: Response) {
  const events = await listEvents(req.user!.companyId);
  res.json(events);
}

export async function createEventController(req: Request, res: Response) {
  const { title, startsAt, endsAt } = req.body;
  const event = await addEvent(req.user!.companyId, { title, startsAt, endsAt });
  res.status(201).json(event);
}

export async function updateEventController(req: Request, res: Response) {
  const { title, startsAt, endsAt } = req.body;
  const event = await editEvent(Number(req.params.id), req.user!.companyId, {
    title,
    startsAt,
    endsAt,
  });
  res.json(event);
}

export async function deleteEventController(req: Request, res: Response) {
  await removeEvent(Number(req.params.id), req.user!.companyId);
  res.status(204).send();
}
