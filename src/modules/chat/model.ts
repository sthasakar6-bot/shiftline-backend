import { db } from "../../prisma/db";

export interface ChatMessageRow {
  id: number;
  companyId: number;
  userId: number;
  body: string;
  replyToId: number | null;
  createdAt: string;
}

export async function createMessage(
  companyId: number,
  userId: number,
  body: string,
  replyToId: number | null,
): Promise<ChatMessageRow> {
  return db.orm.public.Message.create({ companyId, userId, body, replyToId });
}

// Fetched newest-first so LIMIT bounds the *recent* end of the table, then
// reversed by the caller for chronological (oldest-first) display.
export async function findRecentMessages(
  companyId: number,
  limit: number,
): Promise<ChatMessageRow[]> {
  return db.orm.public.Message.where({ companyId })
    .orderBy((m) => m.createdAt.desc())
    .limit(limit)
    .all();
}

export async function findMessageById(id: number): Promise<ChatMessageRow | null> {
  return db.orm.public.Message.where({ id }).first();
}

export async function deleteMessageById(id: number): Promise<void> {
  await db.orm.public.Message.where({ id }).delete();
}
