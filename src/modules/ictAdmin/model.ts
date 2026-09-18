import { db } from "../../prisma/db";

export function listTickets() {
  return db.orm.public.IctAdminTicket.orderBy((t) => t.createdAt.desc()).all();
}

export function findTicketById(id: number) {
  return db.orm.public.IctAdminTicket.first({ id });
}

export function createTicket(data: { title: string; description: string; priority: string }) {
  return db.orm.public.IctAdminTicket.create(data);
}

export function updateTicketStatus(id: number, status: string) {
  return db.orm.public.IctAdminTicket.where({ id }).update({ status, updatedAt: new Date().toISOString() });
}
