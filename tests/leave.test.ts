import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Leave requests", () => {
  let employeeToken: string;
  let managerToken: string;
  let reportId: number;
  let outsiderToken: string;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("leave-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user, token } = await registerAndLogin({
      email: uniqueEmail("leave-employee"),
      managerId: managerUser.id,
    });
    reportId = user.id;
    employeeToken = token;

    const { token: outsider } = await registerAndLogin({ email: uniqueEmail("leave-outsider") });
    outsiderToken = outsider;
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/leave-requests");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid leave type", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "nonsense", startDate: "2026-09-01", endDate: "2026-09-05" });
    expect(res.status).toBe(400);
  });

  it("rejects endDate before startDate", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "vacation", startDate: "2026-09-05", endDate: "2026-09-01" });
    expect(res.status).toBe(400);
  });

  it("creates a pending leave request", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "vacation", startDate: "2026-09-01", endDate: "2026-09-05", reason: "Trip" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
  });

  it("shows up in the employee's own list", async () => {
    const res = await request(app)
      .get("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("blocks a non-manager from viewing a report's leave requests", async () => {
    const res = await request(app)
      .get(`/api/users/${reportId}/leave-requests`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it("lets the manager see and approve the request", async () => {
    const list = await request(app)
      .get(`/api/users/${reportId}/leave-requests`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);
    const requestId = list.body[0].id;

    const approve = await request(app)
      .patch(`/api/users/${reportId}/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "approved" });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe("approved");

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(notifications.body.some((n: { message: string }) => n.message.includes("approved"))).toBe(
      true,
    );

    const decideAgain = await request(app)
      .patch(`/api/users/${reportId}/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "rejected" });
    expect(decideAgain.status).toBe(409);
  });

  it("lets an employee cancel their own pending request", async () => {
    const create = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "sick", startDate: "2026-10-01", endDate: "2026-10-02" });
    const requestId = create.body.id;

    const cancel = await request(app)
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(cancel.status).toBe(204);
  });

  it("blocks cancelling a request that's already been decided", async () => {
    const create = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ type: "sick", startDate: "2026-11-01", endDate: "2026-11-02" });
    const requestId = create.body.id;

    await request(app)
      .patch(`/api/users/${reportId}/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "rejected" });

    const cancel = await request(app)
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(cancel.status).toBe(409);
  });
});
