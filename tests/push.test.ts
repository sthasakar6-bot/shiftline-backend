import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerAndLogin, uniqueEmail } from "./helpers";

describe("Push subscriptions", () => {
  it("rejects unauthenticated subscribe requests", async () => {
    const res = await request(app)
      .post("/api/push/subscribe")
      .send({ endpoint: "https://example.com/push/abc", keys: { p256dh: "x", auth: "y" } });
    expect(res.status).toBe(401);
  });

  it("lets an authenticated user subscribe and unsubscribe", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("push-user") });

    const subscribe = await request(app)
      .post("/api/push/subscribe")
      .set("Authorization", `Bearer ${token}`)
      .send({
        endpoint: `https://example.com/push/${uniqueEmail("endpoint")}`,
        keys: { p256dh: "test-p256dh", auth: "test-auth" },
      });
    expect(subscribe.status).toBe(201);
    expect(subscribe.body.endpoint).toBeTruthy();

    const unsubscribe = await request(app)
      .post("/api/push/unsubscribe")
      .set("Authorization", `Bearer ${token}`)
      .send({ endpoint: subscribe.body.endpoint });
    expect(unsubscribe.status).toBe(204);
  });

  it("rejects a subscribe body missing keys", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("push-bad") });
    const res = await request(app)
      .post("/api/push/subscribe")
      .set("Authorization", `Bearer ${token}`)
      .send({ endpoint: "https://example.com/push/bad" });
    expect(res.status).toBe(400);
  });
});
