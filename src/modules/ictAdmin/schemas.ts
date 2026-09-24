import { z } from "zod";
import { COMPANY_PROFILE_FIELDS } from "./model";

export const ictAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export const createCompanySchema = z.object({
  companyName: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

// Every field optional -- this is a partial-update form (ICT admin fills in
// whatever's known, whenever it's known), and every field is a free-text
// String on the Company model, so there's nothing stronger to validate than
// "reasonable length" here. An empty string clears a field back to unset.
const profileFieldSchema = z.string().max(500).optional().nullable();
export const updateCompanyProfileSchema = z.object({
  ...Object.fromEntries(COMPANY_PROFILE_FIELDS.map((f) => [f, profileFieldSchema])),
  // Int column, not a free-text field -- validated/coerced separately.
  estimatedEmployeeCount: z.coerce.number().int().min(0).max(100000).optional().nullable(),
});
