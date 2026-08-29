import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

const MIN_PDF = Buffer.from("%PDF-1.4\n%%EOF");

describe("Contracts", () => {
  let employeeToken: string;
  let managerToken: string;
  let managerId: number;
  let reportId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("contract-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;
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
      .send({ role: "Cashier" });
    expect(res.status).toBe(404);
  });

  it("blocks a non-manager from creating a contract for anyone", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ role: "Should fail" });
    expect(res.status).toBe(403);
  });

  it("lets a manager create, view, update, and delete a report's contract", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Cashier" });
    expect(create.status).toBe(201);
    const contractId = create.body.id;
    expect(create.body.userId).toBe(reportId);
    expect(create.body.role).toBe("Cashier");

    const seenByEmployee = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(seenByEmployee.status).toBe(200);
    expect(seenByEmployee.body.role).toBe("Cashier");

    const employeeTriesUpdate = await request(app)
      .patch(`/api/contracts/${contractId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ role: "Manager" });
    expect(employeeTriesUpdate.status).toBe(404);

    const managerUpdate = await request(app)
      .patch(`/api/users/${reportId}/contracts/${contractId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Senior Cashier" });
    expect(managerUpdate.status).toBe(200);
    expect(managerUpdate.body.role).toBe("Senior Cashier");

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

  it("404s fetching the PDF before one is uploaded", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Pending PDF" });
    const contractId = create.body.id;

    const res = await request(app)
      .get(`/api/contracts/${contractId}/pdf`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(404);
  });

  it("blocks a non-manager from uploading a contract PDF", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "PDF Upload Target" });
    const contractId = create.body.id;

    const res = await request(app)
      .post(`/api/users/${reportId}/contracts/${contractId}/pdf`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .attach("pdf", MIN_PDF, { filename: "contract.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });

  it("rejects a non-PDF file upload", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Bad Upload Target" });
    const contractId = create.body.id;

    const res = await request(app)
      .post(`/api/users/${reportId}/contracts/${contractId}/pdf`)
      .set("Authorization", `Bearer ${managerToken}`)
      .attach("pdf", Buffer.from("not a pdf"), {
        filename: "contract.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
  });

  it("lets a manager upload a contract PDF and the employee view it", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "PDF Contract" });
    const contractId = create.body.id;

    const upload = await request(app)
      .post(`/api/users/${reportId}/contracts/${contractId}/pdf`)
      .set("Authorization", `Bearer ${managerToken}`)
      .attach("pdf", MIN_PDF, { filename: "contract.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(200);
    expect(upload.body.pdfFilename).toBe("contract.pdf");

    const res = await request(app)
      .get(`/api/contracts/${contractId}/pdf`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.compare(res.body as Buffer, MIN_PDF)).toBe(0);
  });

  it("lets a manager create and view a contract for themselves", async () => {
    const create = await request(app)
      .post(`/api/users/${managerId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Owner" });
    expect(create.status).toBe(201);
    expect(create.body.userId).toBe(managerId);

    const seen = await request(app)
      .get(`/api/users/${managerId}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(seen.status).toBe(200);
    expect(seen.body.some((c: { id: number }) => c.id === create.body.id)).toBe(true);
  });

  it("blocks a manager from creating a contract for an unrelated manager", async () => {
    const outsiderManager = await registerUser({ email: uniqueEmail("contract-outsider-mgr") });
    await db.orm.public.User.where({ id: outsiderManager.id }).update({ role: "manager" });

    const res = await request(app)
      .post(`/api/users/${outsiderManager.id}/contracts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Should fail" });
    expect(res.status).toBe(403);
  });
});
