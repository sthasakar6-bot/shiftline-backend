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
    expect(res.body.wallpaperUrl).toBeNull();
  });
});

describe("PATCH /api/auth/wallpaper", () => {
  it("sets and clears the caller's wallpaper", async () => {
    const user = await registerUser({ email: uniqueEmail("wallpaper") });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password, companyId: user.companyId });
    const auth = { Authorization: `Bearer ${login.body.token}` };

    const url = "https://images.unsplash.com/photo-1759851942096-cf73a51532ba";
    const set = await request(app).patch("/api/auth/wallpaper").set(auth).send({ wallpaperUrl: url });
    expect(set.status).toBe(204);

    const me = await request(app).get("/api/auth/me").set(auth);
    expect(me.body.wallpaperUrl).toBe(url);

    const clear = await request(app).patch("/api/auth/wallpaper").set(auth).send({ wallpaperUrl: null });
    expect(clear.status).toBe(204);
    const meAfter = await request(app).get("/api/auth/me").set(auth);
    expect(meAfter.body.wallpaperUrl).toBeNull();
  });

  it("rejects a URL that isn't in the curated list", async () => {
    const user = await registerUser({ email: uniqueEmail("wallpaper-bad") });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password, companyId: user.companyId });
    const res = await request(app)
      .patch("/api/auth/wallpaper")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ wallpaperUrl: "https://evil.example.com/tracker.png" });
    expect(res.status).toBe(400);
  });
});
