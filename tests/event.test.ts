import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail, createCompany } from "./helpers";

async function makeManager(prefix: string, companyId?: number) {
  const manager = await registerUser({ email: uniqueEmail(prefix), companyId });
  await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
  const token = await loginUser(manager.email, manager.password, manager.companyId);
  return { ...manager, token };
}

describe("Roster events", () => {
  it("lets a manager create, list, and update an event", async () => {
    const manager = await makeManager("event-mgr");

    const createRes = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        title: "Live muziek",
        startsAt: new Date("2026-11-05T20:00:00Z").toISOString(),
        endsAt: new Date("2026-11-05T23:00:00Z").toISOString(),
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe("Live muziek");

    const listRes = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(listRes.body.some((e: { id: number }) => e.id === createRes.body.id)).toBe(true);

    const updateRes = await request(app)
      .patch(`/api/events/${createRes.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ title: "Live band" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe("Live band");
  });

  it("allows a null endsAt for a single-moment marker event", async () => {
    const manager = await makeManager("event-markermgr");
    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ title: "Inventory day", startsAt: new Date("2026-11-06T00:00:00Z").toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.endsAt).toBeNull();
  });

  it("rejects an endsAt before startsAt", async () => {
    const manager = await makeManager("event-badrangemgr");
    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        title: "Bad range",
        startsAt: new Date("2026-11-05T23:00:00Z").toISOString(),
        endsAt: new Date("2026-11-05T20:00:00Z").toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it("blocks a non-manager from creating an event", async () => {
    const manager = await makeManager("event-blockmgr");
    const employee = await registerUser({
      email: uniqueEmail("event-blockemp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ title: "Live muziek", startsAt: new Date().toISOString() });
    expect(res.status).toBe(403);
  });

  it("rejects updating an event in a different company", async () => {
    const companyBId = await createCompany("Event Co B");
    const managerA = await makeManager("event-crossA");
    const managerB = await makeManager("event-crossB", companyBId);
    const event = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${managerB.token}`)
      .send({ title: "Their event", startsAt: new Date().toISOString() });

    const res = await request(app)
      .patch(`/api/events/${event.body.id}`)
      .set("Authorization", `Bearer ${managerA.token}`)
      .send({ title: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("lets a manager delete an event", async () => {
    const manager = await makeManager("event-delmgr");
    const event = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ title: "To delete", startsAt: new Date().toISOString() });

    const deleteRes = await request(app)
      .delete(`/api/events/${event.body.id}`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(listRes.body.some((e: { id: number }) => e.id === event.body.id)).toBe(false);
  });
});
