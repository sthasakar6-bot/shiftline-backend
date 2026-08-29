import { z } from "zod";

const lat = z.coerce.number().min(-90).max(90).optional();
const lng = z.coerce.number().min(-180).max(180).optional();

export const clockInSchema = z.object({
  shiftId: z.coerce.number().int().positive("shiftId must be a positive integer"),
  lat,
  lng,
});

export const clockOutSchema = z.object({
  lat,
  lng,
});
