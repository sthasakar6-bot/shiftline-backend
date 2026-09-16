import { db } from "../../prisma/db";
import { createMessage, findRecentMessages } from "./model";
import { broadcastMessage } from "./ws";

const HISTORY_LIMIT = 100;

export interface ChatMessage {
  id: number;
  userId: number;
  userName: string;
  hasAvatar: boolean;
  body: string;
  createdAt: string;
}

// Company-wide chat has no membership list of its own -- every active user
// in the company can read and post, same population requireAuth already
// scopes every other endpoint to. Fetched once per call rather than
// per-message since a team is small enough that this is cheap, and it
// keeps names/avatars current even for old messages (no denormalized copy
// to go stale if someone changes their name).
async function senderMapForCompany(companyId: number): Promise<Map<number, { name: string; hasAvatar: boolean }>> {
  const users = await db.orm.public.User.select("id", "name", "avatarBase64")
    .where({ companyId })
    .all();
  return new Map(users.map((u) => [u.id, { name: u.name, hasAvatar: Boolean(u.avatarBase64) }]));
}

function hydrate(
  rows: { id: number; userId: number; body: string; createdAt: string }[],
  senders: Map<number, { name: string; hasAvatar: boolean }>,
): ChatMessage[] {
  return rows.map((row) => {
    const sender = senders.get(row.userId);
    return {
      id: row.id,
      userId: row.userId,
      userName: sender?.name ?? "Former employee",
      hasAvatar: sender?.hasAvatar ?? false,
      body: row.body,
      createdAt: row.createdAt,
    };
  });
}

export async function getHistory(companyId: number): Promise<ChatMessage[]> {
  const [rows, senders] = await Promise.all([
    findRecentMessages(companyId, HISTORY_LIMIT),
    senderMapForCompany(companyId),
  ]);
  // findRecentMessages orders newest-first to bound the LIMIT correctly --
  // flip back to chronological order for display.
  return hydrate(rows.reverse(), senders);
}

export async function postMessage(
  companyId: number,
  userId: number,
  body: string,
): Promise<ChatMessage> {
  const row = await createMessage(companyId, userId, body);
  const senders = await senderMapForCompany(companyId);
  const [message] = hydrate([row], senders);
  broadcastMessage(companyId, message);
  return message;
}
