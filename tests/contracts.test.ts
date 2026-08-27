import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerAndLogin } from "./helpers";

describe("Contracts", () => {
  let token: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin());
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/contracts");
    expect(res.status).toBe(401);
  });

  it("starts with an empty list", async () => {
    const res = await request(app).get("/api/contracts").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("rejects creating a contract with missing fields", async () => {
    const res = await request(app)
      .post("/api/contracts")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("creates, reads, updates, and deletes a contract", async () => {
    const create = await request(app)
      .post("/api/contracts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test Contract", startDate: "2026-09-01" });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const get = await request(app)
      .get(`/api/contracts/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe("Test Contract");

    const update = await request(app)
      .patch(`/api/contracts/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "terminated" });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe("terminated");

    const del = await request(app)
      .delete(`/api/contracts/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const getAfterDelete = await request(app)
      .get(`/api/contracts/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it("returns 404 for a nonexistent contract", async () => {
    const res = await request(app)
      .get("/api/contracts/999999999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
