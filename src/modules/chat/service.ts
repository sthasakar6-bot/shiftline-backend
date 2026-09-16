import { db } from "../../prisma/db";
import { AppError } from "../../errors/AppError";
import { createMessage, findRecentMessages, findMessageById, deleteMessageById } from "./model";
import { broadcastMessage, broadcastMessageDeleted } from "./ws";

const HISTORY_LIMIT = 100;
const REPLY_SNIPPET_MAX_LENGTH = 140;

export interface ChatMessageReplyTo {
  id: number;
  userName: string;
  bodySnippet: string;
}

export interface ChatMessage {
  id: number;
  userId: number;
  userName: string;
  hasAvatar: boolean;
  body: string;
  replyTo: ChatMessageReplyTo | null;
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

async function hydrate(
  rows: { id: number; userId: number; body: string; replyToId: number | null; createdAt: string }[],
  senders: Map<number, { name: string; hasAvatar: boolean }>,
): Promise<ChatMessage[]> {
  // Reply targets aren't necessarily inside the same batch being hydrated
  // (e.g. a reply to a message older than the history window), so they're
  // fetched separately -- one lookup per distinct target, not per message.
  const replyToIds = [...new Set(rows.map((r) => r.replyToId).filter((id): id is number => id !== null))];
  const replyTargets = new Map(
    (await Promise.all(replyToIds.map((id) => findMessageById(id))))
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .map((m) => [m.id, m]),
  );

  return rows.map((row) => {
    const sender = senders.get(row.userId);
    const target = row.replyToId !== null ? replyTargets.get(row.replyToId) : undefined;
    const replyTo: ChatMessageReplyTo | null = target
      ? {
          id: target.id,
          userName: senders.get(target.userId)?.name ?? "Former employee",
          bodySnippet:
            target.body.length > REPLY_SNIPPET_MAX_LENGTH
              ? `${target.body.slice(0, REPLY_SNIPPET_MAX_LENGTH)}…`
              : target.body,
        }
      : null;
    return {
      id: row.id,
      userId: row.userId,
      userName: sender?.name ?? "Former employee",
      hasAvatar: sender?.hasAvatar ?? false,
      body: row.body,
      replyTo,
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
  replyToId: number | null,
): Promise<ChatMessage> {
  if (replyToId !== null) {
    const target = await findMessageById(replyToId);
    if (!target || target.companyId !== companyId) {
      throw new AppError(400, "Cannot reply to a message that doesn't exist in this chat");
    }
  }
  const row = await createMessage(companyId, userId, body, replyToId);
  const senders = await senderMapForCompany(companyId);
  const [message] = await hydrate([row], senders);
  broadcastMessage(companyId, message);
  return message;
}

// Sender-only, and "for everyone" (the row is gone, not just hidden on the
// sender's own screen) -- matches how the shared-stream chat has no
// per-viewer state to hide messages behind in the first place.
export async function deleteMessage(
  companyId: number,
  userId: number,
  messageId: number,
): Promise<void> {
  const message = await findMessageById(messageId);
  if (!message || message.companyId !== companyId) {
    throw new AppError(404, "Message not found");
  }
  if (message.userId !== userId) {
    throw new AppError(403, "You can only delete your own messages");
  }
  await deleteMessageById(messageId);
  broadcastMessageDeleted(companyId, messageId);
}
