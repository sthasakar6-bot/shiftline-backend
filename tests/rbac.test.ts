import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail } from "./helpers";

describe("RBAC", () => {
  let managerToken: string;
  let reportId: number;
  let reportToken: string;
  let outsiderId: number;
  let outsiderToken: string;

  beforeAll(async () => {
    // Bootstraps a manager the same way `npm run make-manager` does (direct DB update) --
    // registration itself can no longer self-declare a manager role.
    const managerUser = await registerUser({ email: uniqueEmail("rbac-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const reportUser = await registerUser({
      email: uniqueEmail("rbac-report"),
      managerId: managerUser.id,
    });
    reportId = reportUser.id;
    reportToken = await loginUser(reportUser.email, reportUser.password);

    const outsiderUser = await registerUser({ email: uniqueEmail("rbac-outsider") });
    outsiderId = outsiderUser.id;
    outsiderToken = await loginUser(outsiderUser.email, outsiderUser.password);
  });

  it("lets a manager list their direct reports", async () => {
    const res = await request(app)
      .get("/api/users/reports")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((u: { id: number }) => u.id === reportId)).toBe(true);
  });

  it("blocks a non-manager from listing reports", async () => {
    const res = await request(app)
      .get("/api/users/reports")
      .set("Authorization", `Bearer ${reportToken}`);
    expect(res.status).toBe(403);
  });

  it("lets a manager assign a shift to their report", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-12-01T09:00:00Z", endsAt: "2026-12-01T17:00:00Z" });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(reportId);
  });

  it("blocks a manager from assigning a shift to a non-report", async () => {
    const res = await request(app)
      .post(`/api/users/${outsiderId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-12-02T09:00:00Z", endsAt: "2026-12-02T17:00:00Z" });
    expect(res.status).toBe(403);
  });

  it("blocks a non-manager from assigning shifts to anyone", async () => {
    const res = await request(app)
      .post(`/api/users/${outsiderId}/shifts`)
      .set("Authorization", `Bearer ${reportToken}`)
      .send({ startsAt: "2026-12-03T09:00:00Z", endsAt: "2026-12-03T17:00:00Z" });
    expect(res.status).toBe(403);
  });

  it("lets a manager promote their report to manager", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/promote`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("manager");
  });

  it("blocks a non-manager from promoting anyone", async () => {
    const res = await request(app)
      .post(`/api/users/${outsiderId}/promote`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });
});
