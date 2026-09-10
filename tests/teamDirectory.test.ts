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

describe("Team directory", () => {
  it("lets any authenticated employee see the read-only team list", async () => {
    const manager = await makeManager("teamdir-mgr");
    const employee = await registerUser({
      email: uniqueEmail("teamdir-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);

    const res = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    const names = res.body.map((m: { name: string }) => m.name);
    expect(names).toContain(manager.name);
    expect(names).toContain(employee.name);
  });

  it("does not include phone, address, or email", async () => {
    const manager = await makeManager("teamdir-fieldsmgr");
    const employeeToken = await loginUser(manager.email, manager.password, manager.companyId);
    const res = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${employeeToken}`);
    for (const member of res.body) {
      expect(member.phone).toBeUndefined();
      expect(member.address).toBeUndefined();
      expect(member.email).toBeUndefined();
    }
  });

  it("excludes deactivated employees and bookkeepers", async () => {
    const manager = await makeManager("teamdir-excludemgr");
    const employee = await registerUser({
      name: `Deact ${Date.now()}`,
      email: uniqueEmail("teamdir-deact"),
      managerId: manager.id,
    });
    await request(app)
      .post(`/api/users/${employee.id}/deactivate`)
      .set("Authorization", `Bearer ${manager.token}`);

    const bkName = `BkOnly ${Date.now()}`;
    const bkEmail = uniqueEmail("teamdir-bk");
    await request(app)
      .post("/api/users/bookkeepers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: bkName, lastName: "Keeper", email: bkEmail, password: "password123" });

    const res = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${manager.token}`);
    const ids = res.body.map((m: { id: number }) => m.id);
    expect(ids).not.toContain(employee.id);
    const names = res.body.map((m: { name: string }) => m.name);
    expect(names.some((n: string) => n.startsWith(bkName))).toBe(false);
  });

  it("only shows members of the caller's own company", async () => {
    const companyBId = await createCompany("Team Directory Co B");
    const managerA = await makeManager("teamdir-crossA");
    const managerB = await makeManager("teamdir-crossB", companyBId);

    const res = await request(app)
      .get("/api/users/team")
      .set("Authorization", `Bearer ${managerA.token}`);
    const ids = res.body.map((m: { id: number }) => m.id);
    expect(ids).not.toContain(managerB.id);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/users/team");
    expect(res.status).toBe(401);
  });
});

describe("Company roster", () => {
  it("lets any authenticated employee see shifts across the whole company", async () => {
    const manager = await makeManager("roster-mgr");
    const employeeA = await registerUser({
      email: uniqueEmail("roster-empA"),
      managerId: manager.id,
    });
    const employeeB = await registerUser({
      email: uniqueEmail("roster-empB"),
      managerId: manager.id,
    });
    const employeeAToken = await loginUser(
      employeeA.email,
      employeeA.password,
      employeeA.companyId,
    );

    const shiftA = await db.orm.public.Shift.create({
      userId: employeeA.id,
      startsAt: new Date("2026-09-15T09:00:00Z").toISOString(),
      endsAt: new Date("2026-09-15T17:00:00Z").toISOString(),
    });
    const shiftB = await db.orm.public.Shift.create({
      userId: employeeB.id,
      startsAt: new Date("2026-09-15T09:00:00Z").toISOString(),
      endsAt: new Date("2026-09-15T17:00:00Z").toISOString(),
    });

    const res = await request(app)
      .get("/api/shifts/roster")
      .set("Authorization", `Bearer ${employeeAToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: { id: number }) => s.id);
    expect(ids).toContain(shiftA.id);
    expect(ids).toContain(shiftB.id);
    const forB = res.body.find((s: { id: number }) => s.id === shiftB.id);
    expect(forB.userName).toBe(employeeB.name);
  });

  it("only includes shifts from the caller's own company", async () => {
    const companyBId = await createCompany("Roster Co B");
    const managerA = await makeManager("roster-crossA");
    const managerB = await makeManager("roster-crossB", companyBId);
    const employeeB = await registerUser({
      email: uniqueEmail("roster-crossemp"),
      managerId: managerB.id,
    });
    const shiftB = await db.orm.public.Shift.create({
      userId: employeeB.id,
      startsAt: new Date("2026-09-16T09:00:00Z").toISOString(),
      endsAt: new Date("2026-09-16T17:00:00Z").toISOString(),
    });

    const res = await request(app)
      .get("/api/shifts/roster")
      .set("Authorization", `Bearer ${managerA.token}`);
    const ids = res.body.map((s: { id: number }) => s.id);
    expect(ids).not.toContain(shiftB.id);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/shifts/roster");
    expect(res.status).toBe(401);
  });
});
