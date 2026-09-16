import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { AuthPayload } from "../../middleware/requireAuth";
import type { ChatMessage } from "./service";

const CHAT_PATH = "/ws/chat";

// Sockets never send anything the server acts on -- sending happens over the
// normal authenticated REST endpoint (testable with supertest like every
// other write in this app), so this registry only exists to know who to
// push newly-posted messages to. Grouped by companyId since the chat is
// company-wide, not per-conversation.
const companySockets = new Map<number, Set<WebSocket>>();

function addSocket(companyId: number, socket: WebSocket) {
  let set = companySockets.get(companyId);
  if (!set) {
    set = new Set();
    companySockets.set(companyId, set);
  }
  set.add(socket);
}

function removeSocket(companyId: number, socket: WebSocket) {
  const set = companySockets.get(companyId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) companySockets.delete(companyId);
}

function broadcast(companyId: number, payload: unknown) {
  const set = companySockets.get(companyId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === WebSocket.OPEN) socket.send(data);
  }
}

export function broadcastMessage(companyId: number, message: ChatMessage) {
  broadcast(companyId, { type: "message", message });
}

export function broadcastMessageDeleted(companyId: number, messageId: number) {
  broadcast(companyId, { type: "message_deleted", id: messageId });
}

export function attachChatWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== CHAT_PATH) return; // let other upgrade handlers (if any) see it

    const token = url.searchParams.get("token");
    let auth: AuthPayload;
    try {
      auth = jwt.verify(token ?? "", env.jwtSecret) as unknown as AuthPayload;
    } catch {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      addSocket(auth.companyId, ws);
      ws.on("close", () => removeSocket(auth.companyId, ws));
      ws.on("error", () => removeSocket(auth.companyId, ws));
    });
  });
}
