import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Notifications", () => {
  let token: string;
  let managerToken: string;
  let reportId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("notif-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const result = await registerAndLogin({
      email: uniqueEmail("notif-employee"),
      managerId: managerUser.id,
    });
    reportId = result.user.id;
    token = result.token;
  });

  it("creates a notification when a manager assigns a shift", async () => {
    const before = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    const beforeCount = before.body.length;

    await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-11-01T09:00:00Z", endsAt: "2026-11-01T17:00:00Z" });

    const after = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.length).toBe(beforeCount + 1);
    expect(after.body[0].read).toBe(false);
  });

  it("marks a notification as read", async () => {
    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    const id = list.body[0].id;

    const res = await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  it("returns 404 marking a nonexistent notification as read", async () => {
    const res = await request(app)
      .patch("/api/notifications/999999999/read")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
