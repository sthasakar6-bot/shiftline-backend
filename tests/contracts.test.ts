import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Contracts", () => {
  let employeeToken: string;
  let managerToken: string;
  let reportId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("contract-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user, token } = await registerAndLogin({
      email: uniqueEmail("contract-employee"),
      managerId: managerUser.id,
    });
    reportId = user.id;
    employeeToken = token;
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/contracts");
    expect(res.status).toBe(401);
  });

  it("starts with an empty list for a fresh employee", async () => {
    const res = await request(app)
      .get("/api/contracts")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("no longer exposes self-service contract creation", async () => {
    const res = await request(app)
      .post("/api/contracts")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ title: "Self Contract", startDate: "2026-09-01" });
    expect(res.status).toBe(404);
  });

  it("blocks a non-manager from creating a contract for anyone", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ title: "Should fail", startDate: "2026-09-01" });
    expect(res.status).toBe(403);
  });

  it("lets a manager create, view, update, and delete a report's contract", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Employment Contract", startDate: "2026-09-01", endDate: "2027-09-01" });
    expect(create.status).toBe(201);
    const contractId = create.body.id;
    expect(create.body.userId).toBe(reportId);

    const seenByEmployee = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(seenByEmployee.status).toBe(200);
    expect(seenByEmployee.body.endDate).toBeTruthy();

    const employeeTriesUpdate = await request(app)
      .patch(`/api/contracts/${contractId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ endDate: "2099-01-01" });
    expect(employeeTriesUpdate.status).toBe(404);

    const managerUpdate = await request(app)
      .patch(`/api/users/${reportId}/contracts/${contractId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ endDate: "2028-01-01" });
    expect(managerUpdate.status).toBe(200);
    expect(managerUpdate.body.endDate).toContain("2028-01-01");

    const managerDelete = await request(app)
      .delete(`/api/users/${reportId}/contracts/${contractId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(managerDelete.status).toBe(204);

    const getAfterDelete = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it("returns 404 for a nonexistent contract", async () => {
    const res = await request(app)
      .get("/api/contracts/999999999")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(404);
  });
});
