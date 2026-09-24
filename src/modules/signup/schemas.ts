import { z } from "zod";

// Shared by both signupSchema (free trial) and completeSignupSchema (paid) --
// the "fill in your company details" form is identical either way, the only
// difference is whether payment happens before or after. Multer runs before
// validate() on both routes, so every field arrives as a string even for
// the checkbox/number ones -- coerced accordingly.
const companyDetailsSchema = z.object({
  kvkNumber: z.string().min(1, "KVK number is required").max(50),
  vatNumber: z.string().min(1, "VAT number is required").max(50),
  businessType: z.string().min(1, "Business type is required").max(50),
  industry: z.string().min(1, "Industry is required").max(100),
  estimatedEmployeeCount: z.coerce
    .number({ error: "Number of employees is required" })
    .int()
    .min(1)
    .max(100000),
  companyEmail: z.string().email("invalid company email"),
  companyPhone: z.string().min(1, "Company phone number is required").max(50),
  // The signing-up admin/owner's own phone -- distinct from companyPhone
  // (the company's general line). Reuses the existing User.phone field, no
  // migration needed.
  phone: z.string().min(1, "Your phone number is required").max(50),
  addressStreet: z.string().min(1, "Street is required").max(150),
  addressNumber: z.string().min(1, "House/building number is required").max(20),
  addressPostcode: z.string().min(1, "Postcode is required").max(20),
  addressCity: z.string().min(1, "City is required").max(100),
  countryOfRegistration: z.string().min(1, "Country is required").max(100),
  // Free text -- the frontend sends the composed business address string
  // when "same as business address" is checked, or a custom value when not.
  billingAddress: z.string().min(1, "Billing address is required").max(300),
  contactPersonRole: z.string().min(1, "Your role in the company is required").max(100),
  termsAccepted: z.preprocess(
    (v) => v === "true" || v === true || v === "on" || v === "1",
    z.literal(true, { error: "You must accept the terms to continue" }),
  ),
});

export const signupSchema = z
  .object({
    companyName: z.string().min(2, "companyName must be at least 2 characters").max(100),
    firstName: z.string().min(1, "firstName is required").max(60),
    lastName: z.string().min(1, "lastName is required").max(60),
    email: z.string().email("invalid email"),
    password: z.string().min(8, "password must be at least 8 characters"),
  })
  .merge(companyDetailsSchema);

export const purchaseCheckoutSchema = z.object({
  email: z.string().email("invalid email"),
  plan: z.enum(["starter", "unlimited"]),
  interval: z.enum(["monthly", "yearly"]),
});

export const completeSignupSchema = z
  .object({
    email: z.string().email("invalid email"),
    companyName: z.string().min(2, "companyName must be at least 2 characters").max(100),
    firstName: z.string().min(1, "firstName is required").max(60),
    lastName: z.string().min(1, "lastName is required").max(60),
    password: z.string().min(8, "password must be at least 8 characters"),
  })
  .merge(companyDetailsSchema);
