import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

const EMAIL = "sthasakar6@gmail.com";
const PASSWORD = "@Sitagrestha00";

describe("POST /api/ict-admin/login", () => {
  it("rejects the wrong password", async () => {
    const res = await request(app)
      .post("/api/ict-admin/login")
      .send({ email: EMAIL, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects an unrelated email", async () => {
    const res = await request(app)
      .post("/api/ict-admin/login")
      .send({ email: "someone-else@example.com", password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("logs in with the correct email and password and returns a token", async () => {
    const res = await request(app).post("/api/ict-admin/login").send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe("ICT-admin protected routes", () => {
  async function getToken() {
    const res = await request(app).post("/api/ict-admin/login").send({ email: EMAIL, password: PASSWORD });
    return res.body.token as string;
  }

  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/ict-admin/monitoring");
    expect(res.status).toBe(401);
  });

  it("rejects a normal company-user token (wrong claim shape)", async () => {
    // A real company signup/login token has {sub, email, role, companyId},
    // never {ictAdmin: true} -- confirms the two token types aren't
    // interchangeable even though they're signed with the same secret.
    const signupRes = await request(app)
      .post("/api/signup")
      .field("companyName", `ICT Test Co ${Date.now()}`)
      .field("firstName", "Test")
      .field("lastName", "User")
      .field("email", `ict-admin-test-${Date.now()}@example.com`)
      .field("password", "password123")
      .attach(
        "logo",
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        { filename: "logo.png", contentType: "image/png" },
      );
    expect(signupRes.status).toBe(201);

    const res = await request(app)
      .get("/api/ict-admin/monitoring")
      .set("Authorization", `Bearer ${signupRes.body.token}`);
    expect(res.status).toBe(401);
  });

  it("returns system monitoring data with a valid ICT-admin token", async () => {
    const token = await getToken();
    const res = await request(app)
      .get("/api/ict-admin/monitoring")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.database.ok).toBe(true);
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("creates a company, lists it, then deletes it and its data", async () => {
    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };
    const email = `ict-admin-company-test-${Date.now()}@example.com`;

    const create = await request(app)
      .post("/api/ict-admin/companies")
      .set(auth)
      .field("companyName", `ICT Admin Test Co ${Date.now()}`)
      .field("firstName", "Op")
      .field("lastName", "Erator")
      .field("email", email)
      .field("password", "password123")
      .attach(
        "logo",
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        { filename: "logo.png", contentType: "image/png" },
      );
    expect(create.status).toBe(201);
    const companyId = create.body.companyId;

    const list = await request(app).get("/api/ict-admin/companies").set(auth);
    expect(list.status).toBe(200);
    expect(list.body.some((c: { id: number }) => c.id === companyId)).toBe(true);

    const del = await request(app).delete(`/api/ict-admin/companies/${companyId}`).set(auth);
    expect(del.status).toBe(204);

    const listAfter = await request(app).get("/api/ict-admin/companies").set(auth);
    expect(listAfter.body.some((c: { id: number }) => c.id === companyId)).toBe(false);

    // The manager account that came with it should be gone too -- signing
    // up again with the same email must succeed, which it couldn't if the
    // user row were still there (email-already-exists would block it).
    const resignup = await request(app)
      .post("/api/signup")
      .field("companyName", `Resignup Co ${Date.now()}`)
      .field("firstName", "New")
      .field("lastName", "Owner")
      .field("email", email)
      .field("password", "password123")
      .attach(
        "logo",
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        { filename: "logo.png", contentType: "image/png" },
      );
    expect(resignup.status).toBe(201);
  });

  it("creates, lists, and updates a ticket", async () => {
    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };

    const create = await request(app)
      .post("/api/ict-admin/tickets")
      .set(auth)
      .send({ title: "Test ticket", description: "Something broke", priority: "high" });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("open");

    const list = await request(app).get("/api/ict-admin/tickets").set(auth);
    expect(list.status).toBe(200);
    expect(list.body.some((t: { id: number }) => t.id === create.body.id)).toBe(true);

    const update = await request(app)
      .patch(`/api/ict-admin/tickets/${create.body.id}`)
      .set(auth)
      .send({ status: "resolved" });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe("resolved");
  });
});
