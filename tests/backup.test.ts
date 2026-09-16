import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";
import { runScheduledBackups } from "../src/modules/backup/service";

describe("Scheduled backup snapshots", () => {
  let employeeToken: string;
  let managerToken: string;
  let managerId: number;
  let reportId: number;
  let outsiderManagerToken: string;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("snapshot-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user, token } = await registerAndLogin({
      email: uniqueEmail("snapshot-employee"),
      managerId: managerUser.id,
    });
    reportId = user.id;
    employeeToken = token;

    const outsiderManager = await registerUser({ email: uniqueEmail("snapshot-outsider-mgr") });
    await db.orm.public.User.where({ id: outsiderManager.id }).update({ role: "manager" });
    outsiderManagerToken = await loginUser(outsiderManager.email, outsiderManager.password);

    await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-12-01T09:00:00Z", endsAt: "2026-12-01T17:00:00Z" });
  });

  it("starts with no snapshots", async () => {
    const res = await request(app)
      .get("/api/backup-history")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates a snapshot per manager when the scheduled run fires", async () => {
    await runScheduledBackups();

    const list = await request(app)
      .get("/api/backup-history")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].userId).toBe(managerId);
    // Metadata listing should not include the full CSV content.
    expect(list.body[0].csv).toBeUndefined();

    const outsiderList = await request(app)
      .get("/api/backup-history")
      .set("Authorization", `Bearer ${outsiderManagerToken}`);
    expect(outsiderList.status).toBe(200);
    expect(outsiderList.body.length).toBe(1);
    expect(outsiderList.body[0].userId).not.toBe(managerId);
  });

  it("downloads a specific snapshot's CSV, scoped to its own manager", async () => {
    const list = await request(app)
      .get("/api/backup-history")
      .set("Authorization", `Bearer ${managerToken}`);
    const snapshotId = list.body[0].id;

    const download = await request(app)
      .get(`/api/backup-history/${snapshotId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("text/csv");
    expect(download.text).toContain("2026-12-01");

    const outsiderTries = await request(app)
      .get(`/api/backup-history/${snapshotId}`)
      .set("Authorization", `Bearer ${outsiderManagerToken}`);
    expect(outsiderTries.status).toBe(404);

    const employeeTries = await request(app)
      .get(`/api/backup-history/${snapshotId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(employeeTries.status).toBe(403);
  });

  it("accumulates another snapshot on a second scheduled run", async () => {
    await runScheduledBackups();

    const list = await request(app)
      .get("/api/backup-history")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(list.body.length).toBe(2);
  });
});
