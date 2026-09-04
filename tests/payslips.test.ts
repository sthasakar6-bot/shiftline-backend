import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { registerAndLogin, registerUser, loginUser, uniqueEmail } from "./helpers";

const MIN_PDF = Buffer.from("%PDF-1.4\n%%EOF");

describe("Payslips", () => {
  let employeeToken: string;
  let managerToken: string;
  let managerId: number;
  let reportId: number;

  beforeAll(async () => {
    const managerUser = await registerUser({ email: uniqueEmail("payslip-manager") });
    await db.orm.public.User.where({ id: managerUser.id }).update({ role: "manager" });
    managerId = managerUser.id;
    managerToken = await loginUser(managerUser.email, managerUser.password);

    const { user, token } = await registerAndLogin({
      email: uniqueEmail("payslip-employee"),
      managerId: managerUser.id,
    });
    reportId = user.id;
    employeeToken = token;
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/payslips");
    expect(res.status).toBe(401);
  });

  it("starts with an empty list for a fresh employee", async () => {
    const res = await request(app)
      .get("/api/payslips")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("no longer exposes self-service payslip creation", async () => {
    const res = await request(app)
      .post("/api/payslips")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ period: "August 2026" });
    expect(res.status).toBe(404);
  });

  it("blocks a non-manager from creating a payslip for anyone", async () => {
    const res = await request(app)
      .post(`/api/users/${reportId}/payslips`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ period: "Should fail" });
    expect(res.status).toBe(403);
  });

  it("lets a manager create, view, and delete a report's payslip", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "August 2026" });
    expect(create.status).toBe(201);
    const payslipId = create.body.id;
    expect(create.body.userId).toBe(reportId);
    expect(create.body.period).toBe("August 2026");

    const seenByEmployee = await request(app)
      .get(`/api/payslips/${payslipId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(seenByEmployee.status).toBe(200);
    expect(seenByEmployee.body.period).toBe("August 2026");

    const managerDelete = await request(app)
      .delete(`/api/users/${reportId}/payslips/${payslipId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(managerDelete.status).toBe(204);

    const getAfterDelete = await request(app)
      .get(`/api/payslips/${payslipId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it("returns 404 for a nonexistent payslip", async () => {
    const res = await request(app)
      .get("/api/payslips/999999999")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(404);
  });

  it("404s fetching the PDF before one is uploaded", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "Pending PDF" });
    const payslipId = create.body.id;

    const res = await request(app)
      .get(`/api/payslips/${payslipId}/pdf`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(404);
  });

  it("blocks a non-manager from uploading a payslip PDF", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "PDF Upload Target" });
    const payslipId = create.body.id;

    const res = await request(app)
      .post(`/api/users/${reportId}/payslips/${payslipId}/pdf`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .attach("pdf", MIN_PDF, { filename: "payslip.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
  });

  it("rejects a non-PDF file upload", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "Bad Upload Target" });
    const payslipId = create.body.id;

    const res = await request(app)
      .post(`/api/users/${reportId}/payslips/${payslipId}/pdf`)
      .set("Authorization", `Bearer ${managerToken}`)
      .attach("pdf", Buffer.from("not a pdf"), {
        filename: "payslip.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
  });

  it("lets a manager upload a payslip PDF and the employee view it", async () => {
    const create = await request(app)
      .post(`/api/users/${reportId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "PDF Payslip" });
    const payslipId = create.body.id;

    const upload = await request(app)
      .post(`/api/users/${reportId}/payslips/${payslipId}/pdf`)
      .set("Authorization", `Bearer ${managerToken}`)
      .attach("pdf", MIN_PDF, { filename: "payslip.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(200);
    expect(upload.body.pdfFilename).toBe("payslip.pdf");

    const res = await request(app)
      .get(`/api/payslips/${payslipId}/pdf`)
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

  it("lets a manager create and view a payslip for themselves", async () => {
    const create = await request(app)
      .post(`/api/users/${managerId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "Owner Pay" });
    expect(create.status).toBe(201);
    expect(create.body.userId).toBe(managerId);

    const seen = await request(app)
      .get(`/api/users/${managerId}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(seen.status).toBe(200);
    expect(seen.body.some((p: { id: number }) => p.id === create.body.id)).toBe(true);
  });

  it("blocks a manager from creating a payslip for an unrelated manager", async () => {
    const outsiderManager = await registerUser({ email: uniqueEmail("payslip-outsider-mgr") });
    await db.orm.public.User.where({ id: outsiderManager.id }).update({ role: "manager" });

    const res = await request(app)
      .post(`/api/users/${outsiderManager.id}/payslips`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ period: "Should fail" });
    expect(res.status).toBe(403);
  });
});
