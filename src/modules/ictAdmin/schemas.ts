import { z } from "zod";

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
