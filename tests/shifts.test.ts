import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerAndLogin } from "./helpers";

describe("Shifts", () => {
  let token: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin());
  });

  it("rejects endsAt before startsAt", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token}`)
      .send({ startsAt: "2026-09-01T17:00:00Z", endsAt: "2026-09-01T09:00:00Z" });
    expect(res.status).toBe(400);
  });

  it("rejects missing fields", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token}`)
      .send({ startsAt: "2026-09-01T09:00:00Z" });
    expect(res.status).toBe(400);
  });

  it("creates, lists, updates, and deletes a shift", async () => {
    const create = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token}`)
      .send({ startsAt: "2026-09-01T09:00:00Z", endsAt: "2026-09-01T17:00:00Z" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const list = await request(app).get("/api/shifts").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((s: { id: number }) => s.id === id)).toBe(true);

    const update = await request(app)
      .patch(`/api/shifts/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ endsAt: "2026-09-01T18:00:00Z" });
    expect(update.status).toBe(200);

    const del = await request(app)
      .delete(`/api/shifts/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it("returns 404 for a nonexistent shift", async () => {
    const res = await request(app)
      .get("/api/shifts/999999999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
