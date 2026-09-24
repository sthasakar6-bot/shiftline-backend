import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "../src/prisma/db";
import { uniqueEmail } from "./helpers";

const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const COMPANY_DETAILS_FIELDS: Record<string, string> = {
  kvkNumber: "12345678",
  vatNumber: "NL123456789B01",
  businessType: "BV",
  industry: "Retail",
  estimatedEmployeeCount: "5",
  companyEmail: "info@test-co.example",
  companyPhone: "+31612345678",
  phone: "+31687654321",
  addressStreet: "Teststraat",
  addressNumber: "1",
  addressPostcode: "1234AB",
  addressCity: "Amsterdam",
  countryOfRegistration: "Netherlands",
  billingAddress: "Teststraat 1, 1234AB Amsterdam",
  contactPersonRole: "Owner",
  termsAccepted: "true",
};

function withCompanyDetails<T extends { field: (name: string, value: string) => T }>(req: T): T {
  for (const [key, value] of Object.entries(COMPANY_DETAILS_FIELDS)) {
    req = req.field(key, value);
  }
  return req;
}

function signupRequest() {
  return withCompanyDetails(
    request(app)
      .post("/api/signup")
      .field("companyName", `Test Co ${Date.now()}`)
      .field("firstName", "Ada")
      .field("lastName", "Lovelace")
      .field("password", "password123"),
  ).attach("logo", MIN_PNG, { filename: "logo.png", contentType: "image/png" });
}

function completeSignupRequest(email: string) {
  return withCompanyDetails(
    request(app)
      .post("/api/signup/complete")
      .field("email", email)
      .field("companyName", `Paid Co ${Date.now()}`)
      .field("firstName", "Grace")
      .field("lastName", "Hopper")
      .field("password", "password123"),
  ).attach("logo", MIN_PNG, { filename: "logo.png", contentType: "image/png" });
}

describe("POST /api/signup (free trial, unaffected regression check)", () => {
  it("still creates a trial company with no billing fields set", async () => {
    const email = uniqueEmail("signup-trial");
    const res = await signupRequest().field("email", email);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();

    const company = await db.orm.public.Company.first({ id: res.body.user.companyId });
    expect(company?.plan).toBe("trial");
    expect(company?.trialEndsAt).not.toBeNull();
    expect(company?.billingProvider).toBeNull();
  });
});

describe("POST /api/signup/complete", () => {
  it("refuses to create a company when no pending signup exists for the email", async () => {
    const email = uniqueEmail("complete-missing");
    const res = await completeSignupRequest(email);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe("PAYMENT_NOT_CONFIRMED");
  });

  it("refuses when a pending signup exists but hasn't been marked paid", async () => {
    const email = uniqueEmail("complete-unpaid");
    await db.orm.public.PendingSignup.create({
      email,
      plan: "starter",
      interval: "monthly",
      billingCustomerId: "cst_test_unpaid",
      paid: false,
    });

    const res = await completeSignupRequest(email);

    expect(res.status).toBe(402);
    expect(res.body.code).toBe("PAYMENT_NOT_CONFIRMED");
  });

  it("creates a paid company (not trial) once the pending signup is marked paid, and consumes it", async () => {
    const email = uniqueEmail("complete-paid");
    await db.orm.public.PendingSignup.create({
      email,
      plan: "unlimited",
      interval: "yearly",
      billingCustomerId: "cst_test_paid",
      billingSubscriptionId: "sub_test_paid",
      paid: true,
    });

    const res = await completeSignupRequest(email);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);

    const company = await db.orm.public.Company.first({ id: res.body.user.companyId });
    expect(company?.plan).toBe("unlimited");
    expect(company?.trialEndsAt).toBeNull();
    expect(company?.billingProvider).toBe("mollie");
    expect(company?.billingCustomerId).toBe("cst_test_paid");
    expect(company?.billingSubscriptionId).toBe("sub_test_paid");
    expect(company?.billingInterval).toBe("yearly");
    expect(company?.subscriptionStatus).toBe("active");

    const stillPending = await db.orm.public.PendingSignup.where({ email }).first();
    expect(stillPending).toBeNull();
  });

  it("rejects completing signup for an email that already has an account", async () => {
    const email = uniqueEmail("complete-existing");
    await signupRequest().field("email", email);
    await db.orm.public.PendingSignup.create({
      email,
      plan: "starter",
      interval: "monthly",
      billingCustomerId: "cst_test_existing",
      paid: true,
    });

    const res = await completeSignupRequest(email);

    expect(res.status).toBe(400);
  });
});
