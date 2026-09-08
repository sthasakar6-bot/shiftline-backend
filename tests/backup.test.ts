import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";
import { runScheduledBackups } from "../src/modules/backup/service";

describe("Backup", () => {
  let employeeToken: string;
  let managerToken: string;
  let managerId: number;
  let reportId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("backup-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user, token } = await registerAndLogin({
      email: uniqueEmail("backup-employee"),
      managerId: managerUser.id,
    });
    reportId = user.id;
    employeeToken = token;
  });

  it("blocks a non-manager from generating a backup token", async () => {
    const res = await request(app)
      .post("/api/backup-token")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("starts with no backup token", async () => {
    const res = await request(app)
      .get("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("rejects the backup endpoint with no token", async () => {
    const res = await request(app).get("/api/backup");
    expect(res.status).toBe(401);
  });

  it("rejects the backup endpoint with an invalid token", async () => {
    const res = await request(app).get("/api/backup?token=not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("generates a token, downloads a backup, and includes the report's data", async () => {
    const create = await request(app)
      .post("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(create.status).toBe(201);
    const token = create.body.token;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    await request(app)
      .post(`/api/users/${reportId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ startsAt: "2026-11-10T09:00:00Z", endsAt: "2026-11-10T17:00:00Z" });

    await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "vacation", startDate: "2026-11-15", endDate: "2026-11-16" });

    const download = await request(app).get(`/api/backup?token=${token}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("text/csv");
    expect(download.text).toContain("Shiftline Backup");
    expect(download.text).toContain("Attendance");
    expect(download.text).toContain("Shifts");
    expect(download.text).toContain("Leave Requests");
    expect(download.text).toContain("2026-11-10");

    const info = await request(app)
      .get("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(info.body.lastUsedAt).toBeTruthy();
  });

  it("also accepts the token via the Authorization header", async () => {
    const info = await request(app)
      .get("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    const token = info.body.token;

    const download = await request(app)
      .get("/api/backup")
      .set("Authorization", `Bearer ${token}`);
    expect(download.status).toBe(200);
  });

  it("generating a new token invalidates the old one", async () => {
    const first = await request(app)
      .get("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    const oldToken = first.body.token;

    const regenerate = await request(app)
      .post("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(regenerate.status).toBe(201);
    expect(regenerate.body.token).not.toBe(oldToken);

    const oldDownload = await request(app).get(`/api/backup?token=${oldToken}`);
    expect(oldDownload.status).toBe(401);

    const newDownload = await request(app).get(`/api/backup?token=${regenerate.body.token}`);
    expect(newDownload.status).toBe(200);
  });

  it("lets a manager revoke their backup token", async () => {
    const revoke = await request(app)
      .delete("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(revoke.status).toBe(204);

    const info = await request(app)
      .get("/api/backup-token")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(info.body).toBeNull();
  });
});

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
