import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerAndLogin } from "./helpers";

describe("Notifications", () => {
  let token: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin());
  });

  it("creates a notification when a shift is created", async () => {
    const before = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    const beforeCount = before.body.length;

    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token}`)
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
