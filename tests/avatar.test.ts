import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { registerAndLogin, uniqueEmail } from "./helpers";

const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("Avatar", () => {
  it("404s fetching an avatar before one is uploaded", async () => {
    const { user, token } = await registerAndLogin({ email: uniqueEmail("avatar-empty") });
    const res = await request(app)
      .get(`/api/users/${user.id}/avatar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("rejects a non-image file", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("avatar-bad") });
    const res = await request(app)
      .post("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", Buffer.from("not an image"), {
        filename: "file.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
  });

  it("lets a user upload and fetch their own avatar", async () => {
    const { user, token } = await registerAndLogin({ email: uniqueEmail("avatar-ok") });

    const upload = await request(app)
      .post("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", MIN_PNG, { filename: "avatar.png", contentType: "image/png" });
    expect(upload.status).toBe(204);

    const res = await request(app)
      .get(`/api/users/${user.id}/avatar`)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(res.body as Buffer, MIN_PNG)).toBe(0);
  });

  it("reflects hasAvatar on /auth/me after uploading", async () => {
    const { token } = await registerAndLogin({ email: uniqueEmail("avatar-me") });

    const before = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(before.body.hasAvatar).toBe(false);

    await request(app)
      .post("/api/users/me/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", MIN_PNG, { filename: "avatar.png", contentType: "image/png" });

    const after = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.hasAvatar).toBe(true);
  });
});
