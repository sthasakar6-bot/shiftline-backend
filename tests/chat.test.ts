import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { createCompany, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Chat notifications", () => {
  let companyId: number;
  let senderToken: string;
  let recipientToken: string;
  let recipientId: number;

  beforeAll(async () => {
    companyId = await createCompany("Chat Notify Co");

    const sender = await registerUser({ email: uniqueEmail("chat-sender"), companyId });
    senderToken = await loginUser(sender.email, sender.password, companyId);

    const recipient = await registerUser({ email: uniqueEmail("chat-recipient"), companyId });
    recipientId = recipient.id;
    await db.orm.public.User.where({ id: recipientId }).update({ role: "manager" });
    recipientToken = await loginUser(recipient.email, recipient.password, companyId);
  });

  it("notifies other company members when a message is posted, but not the sender", async () => {
    const recipientBefore = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${recipientToken}`);
    const recipientBeforeCount = recipientBefore.body.length;

    const senderBefore = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${senderToken}`);
    const senderBeforeCount = senderBefore.body.length;

    const post = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ body: "Hey team, who's covering tomorrow?" });
    expect(post.status).toBe(201);

    const recipientAfter = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${recipientToken}`);
    expect(recipientAfter.body.length).toBe(recipientBeforeCount + 1);
    expect(recipientAfter.body[0].message).toContain("who's covering tomorrow?");
    expect(recipientAfter.body[0].url).toBe("/admin?tab=chat");

    const senderAfter = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${senderToken}`);
    expect(senderAfter.body.length).toBe(senderBeforeCount);
  });
});
