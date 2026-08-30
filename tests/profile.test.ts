import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

describe("Phone number", () => {
  it("lets a user set their own phone number", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("phone-set") });

    const res = await request(app)
      .patch("/api/auth/phone")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+1 555 123 4567" });
    expect(res.status).toBe(204);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.phone).toBe("+1 555 123 4567");
  });

  it("clears the phone number when sent an empty string", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("phone-clear") });

    await request(app)
      .patch("/api/auth/phone")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+1 555 123 4567" });
    const res = await request(app)
      .patch("/api/auth/phone")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "" });
    expect(res.status).toBe(204);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.phone).toBeNull();
  });

  it("requires authentication", async () => {
    const res = await request(app).patch("/api/auth/phone").send({ phone: "+1 555 123 4567" });
    expect(res.status).toBe(401);
  });
});

describe("Online status", () => {
  it("reports a user as online after they make an authenticated request, and offline once stale", async () => {
    const managerUser = await registerUser({ email: uniqueEmail("online-mgr") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    const managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user: employee, token: employeeToken } = await registerAndLogin({
      email: uniqueEmail("online-employee"),
      managerId: managerUser.id,
    });

    // registerAndLogin's own /auth/login call isn't behind requireAuth, so
    // make one authenticated request to actually touch lastSeenAt.
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${employeeToken}`);

    const reports = await request(app)
      .get("/api/users/reports")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(reports.status).toBe(200);
    const found = reports.body.find((r: { id: number }) => r.id === employee.id);
    expect(found.online).toBe(true);

    await db.orm.public.User.where({ id: employee.id }).update({
      lastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });

    const staleReports = await request(app)
      .get("/api/users/reports")
      .set("Authorization", `Bearer ${managerToken}`);
    const staleFound = staleReports.body.find((r: { id: number }) => r.id === employee.id);
    expect(staleFound.online).toBe(false);
  });
});
