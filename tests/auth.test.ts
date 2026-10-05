import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerUser, uniqueEmail } from "./helpers";

describe("Auth", () => {
  it("logs in with correct credentials", async () => {
    const user = await registerUser({ email: uniqueEmail("login") });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password, companyId: user.companyId });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const user = await registerUser({ email: uniqueEmail("wrong") });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrongpass", companyId: user.companyId });
    expect(res.status).toBe(401);
  });

  it("requires auth for /me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for /me with a valid token", async () => {
    const user = await registerUser({ email: uniqueEmail("me") });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password, companyId: user.companyId });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });
});
