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

async function subscribeToAssistant(companyId: number) {
  await db.orm.public.Company.where({ id: companyId }).update({
    aiAssistantStatus: "active",
    aiAssistantSubscriptionId: "sub_test",
  });
}

describe("AI assistant entitlement gate", () => {
  it("blocks /assistant/chat for a company that never subscribed to the add-on", async () => {
    const manager = await makeManager("assist-gate-chat");

    const res = await request(app)
      .post("/api/assistant/chat")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ history: [], message: "Schedule Anita Monday 9-5" });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe("AI_ASSISTANT_NOT_SUBSCRIBED");
  });

  it("blocks /assistant/confirm for a company that never subscribed to the add-on", async () => {
    const manager = await makeManager("assist-gate-confirm");

    const res = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        shifts: [
          { userId: manager.id, startsAt: "2026-10-05T09:00:00.000Z", endsAt: "2026-10-05T17:00:00.000Z" },
        ],
      });

    expect(res.status).toBe(402);
    expect(res.body.code).toBe("AI_ASSISTANT_NOT_SUBSCRIBED");
  });

  it("allows a past_due add-on subscription through (payment retry in progress, not revoked)", async () => {
    const manager = await makeManager("assist-gate-pastdue");
    await db.orm.public.Company.where({ id: manager.companyId }).update({
      aiAssistantStatus: "past_due",
    });
    const employee = await registerUser({ email: uniqueEmail("assist-pastdue-emp"), managerId: manager.id });

    const res = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        shifts: [
          { userId: employee.id, startsAt: "2026-10-06T09:00:00.000Z", endsAt: "2026-10-06T17:00:00.000Z" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("created");
  });
});

describe("POST /api/assistant/confirm", () => {
  it("creates a shift for an employee in the caller's team, reusing addShift", async () => {
    const manager = await makeManager("assist-confirm-mgr");
    await subscribeToAssistant(manager.companyId);
    const employee = await registerUser({ email: uniqueEmail("assist-confirm-emp"), managerId: manager.id });

    const res = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        shifts: [
          { userId: employee.id, startsAt: "2026-11-02T09:00:00.000Z", endsAt: "2026-11-02T17:00:00.000Z" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { userId: employee.id, startsAt: "2026-11-02T09:00:00.000Z", status: "created" },
    ]);

    const rows = await db.orm.public.Shift.where({ userId: employee.id }).all();
    expect(
      rows.some((s) => new Date(s.startsAt).getTime() === new Date("2026-11-02T09:00:00.000Z").getTime()),
    ).toBe(true);
  });

  it("never creates a shift for a user outside the caller's company, even if asked to", async () => {
    const manager = await makeManager("assist-confirm-scope-mgr");
    await subscribeToAssistant(manager.companyId);
    const otherCompanyId = await createCompany("Other Co (assistant scope test)");
    const stranger = await registerUser({
      email: uniqueEmail("assist-confirm-stranger"),
      companyId: otherCompanyId,
    });

    const res = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        shifts: [
          { userId: stranger.id, startsAt: "2026-11-03T09:00:00.000Z", endsAt: "2026-11-03T17:00:00.000Z" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("error");

    const rows = await db.orm.public.Shift.where({ userId: stranger.id }).all();
    expect(rows.length).toBe(0);
  });

  it("reports a per-shift error instead of failing the whole batch when one shift overlaps an existing one", async () => {
    const manager = await makeManager("assist-confirm-overlap-mgr");
    await subscribeToAssistant(manager.companyId);
    const employee = await registerUser({ email: uniqueEmail("assist-confirm-overlap-emp"), managerId: manager.id });

    await db.orm.public.Shift.create({
      userId: employee.id,
      startsAt: "2026-11-04T09:00:00.000Z",
      endsAt: "2026-11-04T17:00:00.000Z",
    });

    const res = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({
        shifts: [
          // Overlaps the existing shift above.
          { userId: employee.id, startsAt: "2026-11-04T12:00:00.000Z", endsAt: "2026-11-04T20:00:00.000Z" },
          // A separate, non-conflicting day should still go through.
          { userId: employee.id, startsAt: "2026-11-05T09:00:00.000Z", endsAt: "2026-11-05T17:00:00.000Z" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("error");
    expect(res.body.results[1].status).toBe("created");
  });
});
