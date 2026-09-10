import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerUser, loginUser, uniqueEmail, createCompany } from "./helpers";

const MIN_PDF = Buffer.from("%PDF-1.4\n%%EOF");

async function makeManager(prefix: string, companyId?: number) {
  const manager = await registerUser({ email: uniqueEmail(prefix), companyId });
  await db.orm.public.User.where({ id: manager.id }).update({ role: "manager" });
  const token = await loginUser(manager.email, manager.password, manager.companyId);
  return { ...manager, token };
}

async function makeBookkeeper(managerToken: string, companyId: number, prefix: string) {
  const email = uniqueEmail(prefix);
  await request(app)
    .post("/api/users/bookkeepers")
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ firstName: "Book", lastName: "Keeper", email, password: "password123" });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123", companyId });
  return { email, companyId, token: login.body.token as string };
}

describe("Create bookkeeper", () => {
  it("lets a manager create a bookkeeper account", async () => {
    const manager = await makeManager("bk-create-mgr");
    const email = uniqueEmail("bk-new");
    const res = await request(app)
      .post("/api/users/bookkeepers")
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ firstName: "Book", lastName: "Keeper", email, password: "password123" });
    expect(res.status).toBe(201);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123", companyId: manager.companyId });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("bookkeeper");
    expect(login.body.user.needsOnboarding).toBe(true);
  });

  it("blocks a non-manager from creating a bookkeeper", async () => {
    const manager = await makeManager("bk-block-mgr");
    const employee = await registerUser({ email: uniqueEmail("bk-block-emp"), managerId: manager.id });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const res = await request(app)
      .post("/api/users/bookkeepers")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ firstName: "No", lastName: "Access", email: uniqueEmail("bk-blocked"), password: "password123" });
    expect(res.status).toBe(403);
  });
});

describe("Bookkeeper document access", () => {
  it("lists company employees with their existing contracts and payslips", async () => {
    const manager = await makeManager("bk-list-mgr");
    const employee = await registerUser({
      email: uniqueEmail("bk-list-emp"),
      managerId: manager.id,
    });
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-list-bk");

    const res = await request(app)
      .get("/api/bookkeeper/employees")
      .set("Authorization", `Bearer ${bookkeeper.token}`);
    expect(res.status).toBe(200);
    const listed = res.body.find((e: { id: number }) => e.id === employee.id);
    expect(listed).toBeTruthy();
    expect(listed.contracts).toEqual([]);
    expect(listed.payslips).toEqual([]);
  });

  it("reports hours worked this month, from actual clock in/out times", async () => {
    const manager = await makeManager("bk-hours-mgr");
    const employee = await registerUser({
      email: uniqueEmail("bk-hours-emp"),
      managerId: manager.id,
    });
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-hours-bk");

    const now = new Date();
    const shift = await db.orm.public.Shift.create({
      userId: employee.id,
      startsAt: new Date(now.getFullYear(), now.getMonth(), 5, 9, 0).toISOString(),
      endsAt: new Date(now.getFullYear(), now.getMonth(), 5, 17, 0).toISOString(),
    });
    // 4 completed hours this month...
    await db.orm.public.Attendance.create({
      userId: employee.id,
      shiftId: shift.id,
      clockIn: new Date(now.getFullYear(), now.getMonth(), 5, 9, 0).toISOString(),
      clockOut: new Date(now.getFullYear(), now.getMonth(), 5, 13, 0).toISOString(),
    });
    // ...plus an open (still clocked in) entry that shouldn't count...
    await db.orm.public.Attendance.create({
      userId: employee.id,
      shiftId: shift.id,
      clockIn: new Date(now.getFullYear(), now.getMonth(), 6, 9, 0).toISOString(),
      clockOut: null,
    });
    // ...and 3 completed hours from last month, which also shouldn't count.
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5);
    await db.orm.public.Attendance.create({
      userId: employee.id,
      shiftId: shift.id,
      clockIn: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 5, 9, 0).toISOString(),
      clockOut: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 5, 12, 0).toISOString(),
    });

    const res = await request(app)
      .get("/api/bookkeeper/employees")
      .set("Authorization", `Bearer ${bookkeeper.token}`);
    const listed = res.body.find((e: { id: number }) => e.id === employee.id);
    expect(listed.hoursThisMonth).toBe(4);
  });

  it("lets a bookkeeper create and upload a payslip for an employee", async () => {
    const manager = await makeManager("bk-payslip-mgr");
    const employee = await registerUser({
      email: uniqueEmail("bk-payslip-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-payslip-bk");

    const create = await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/payslips`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .send({ period: "August 2026" });
    expect(create.status).toBe(201);

    const upload = await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/payslips/${create.body.id}/pdf`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .attach("pdf", MIN_PDF, { filename: "payslip.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(200);

    // the employee sees it on their own existing payslips list
    const employeeView = await request(app)
      .get("/api/payslips")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(employeeView.body.some((p: { id: number }) => p.id === create.body.id)).toBe(true);
  });

  it("lets a bookkeeper create and upload a contract for an employee", async () => {
    const manager = await makeManager("bk-contract-mgr");
    const employee = await registerUser({
      email: uniqueEmail("bk-contract-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-contract-bk");

    const create = await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/contracts`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .send({ role: "Server" });
    expect(create.status).toBe(201);

    const upload = await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/contracts/${create.body.id}/pdf`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .attach("pdf", MIN_PDF, { filename: "contract.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(200);

    const employeeView = await request(app)
      .get("/api/contracts")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(employeeView.body.some((c: { id: number }) => c.id === create.body.id)).toBe(true);
  });

  it("lets a bookkeeper delete a payslip they uploaded by mistake", async () => {
    const manager = await makeManager("bk-delpayslip-mgr");
    const employee = await registerUser({
      email: uniqueEmail("bk-delpayslip-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-delpayslip-bk");

    const create = await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/payslips`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .send({ period: "wrong period" });
    await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/payslips/${create.body.id}/pdf`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .attach("pdf", MIN_PDF, { filename: "wrong.pdf", contentType: "application/pdf" });

    const del = await request(app)
      .delete(`/api/bookkeeper/employees/${employee.id}/payslips/${create.body.id}`)
      .set("Authorization", `Bearer ${bookkeeper.token}`);
    expect(del.status).toBe(204);

    const employeeView = await request(app)
      .get("/api/payslips")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(employeeView.body.some((p: { id: number }) => p.id === create.body.id)).toBe(false);
  });

  it("lets a bookkeeper delete a contract they uploaded by mistake", async () => {
    const manager = await makeManager("bk-delcontract-mgr");
    const employee = await registerUser({
      email: uniqueEmail("bk-delcontract-emp"),
      managerId: manager.id,
    });
    const employeeToken = await loginUser(employee.email, employee.password, employee.companyId);
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-delcontract-bk");

    const create = await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/contracts`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .send({ role: "Wrong Role" });
    await request(app)
      .post(`/api/bookkeeper/employees/${employee.id}/contracts/${create.body.id}/pdf`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .attach("pdf", MIN_PDF, { filename: "wrong.pdf", contentType: "application/pdf" });

    const del = await request(app)
      .delete(`/api/bookkeeper/employees/${employee.id}/contracts/${create.body.id}`)
      .set("Authorization", `Bearer ${bookkeeper.token}`);
    expect(del.status).toBe(204);

    const employeeView = await request(app)
      .get("/api/contracts")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(employeeView.body.some((c: { id: number }) => c.id === create.body.id)).toBe(false);
  });

  it("rejects uploading for an employee in a different company", async () => {
    const companyBId = await createCompany("Bookkeeper Co B");
    const managerA = await makeManager("bk-cross-mgrA");
    const managerB = await makeManager("bk-cross-mgrB", companyBId);
    const outsider = await registerUser({
      email: uniqueEmail("bk-cross-emp"),
      managerId: managerB.id,
    });
    const bookkeeperA = await makeBookkeeper(managerA.token, managerA.companyId, "bk-cross-bk");

    const res = await request(app)
      .post(`/api/bookkeeper/employees/${outsider.id}/payslips`)
      .set("Authorization", `Bearer ${bookkeeperA.token}`)
      .send({ period: "August 2026" });
    expect(res.status).toBe(404);
  });

  it("lists managers alongside employees, since they need payroll documents too", async () => {
    const manager = await makeManager("bk-mgrlist-mgr");
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-mgrlist-bk");

    const res = await request(app)
      .get("/api/bookkeeper/employees")
      .set("Authorization", `Bearer ${bookkeeper.token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((e: { id: number }) => e.id === manager.id)).toBe(true);
  });

  it("excludes other bookkeepers from the list", async () => {
    const manager = await makeManager("bk-exclude-mgr");
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-exclude-bk1");
    const otherBookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-exclude-bk2");

    const res = await request(app)
      .get("/api/bookkeeper/employees")
      .set("Authorization", `Bearer ${bookkeeper.token}`);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: otherBookkeeper.email, password: "password123", companyId: manager.companyId });
    expect(res.body.some((e: { id: number }) => e.id === login.body.user.id)).toBe(false);
  });

  it("lets a bookkeeper create and upload a payslip for a manager", async () => {
    const manager = await makeManager("bk-mgrpayslip-mgr");
    const bookkeeper = await makeBookkeeper(manager.token, manager.companyId, "bk-mgrpayslip-bk");

    const create = await request(app)
      .post(`/api/bookkeeper/employees/${manager.id}/payslips`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .send({ period: "August 2026" });
    expect(create.status).toBe(201);

    const upload = await request(app)
      .post(`/api/bookkeeper/employees/${manager.id}/payslips/${create.body.id}/pdf`)
      .set("Authorization", `Bearer ${bookkeeper.token}`)
      .attach("pdf", MIN_PDF, { filename: "payslip.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(200);

    const managerView = await request(app)
      .get("/api/payslips")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(managerView.body.some((p: { id: number }) => p.id === create.body.id)).toBe(true);
  });

  it("blocks a manager from using bookkeeper-only routes", async () => {
    const manager = await makeManager("bk-mgraccess-mgr");
    const res = await request(app)
      .get("/api/bookkeeper/employees")
      .set("Authorization", `Bearer ${manager.token}`);
    expect(res.status).toBe(403);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/bookkeeper/employees");
    expect(res.status).toBe(401);
  });
});
