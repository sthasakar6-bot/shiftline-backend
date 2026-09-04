import { z } from "zod";

const lat = z.coerce.number().min(-90).max(90).optional();
const lng = z.coerce.number().min(-180).max(180).optional();
// Sent when a clock-in/out happened offline and is only being synced now --
// the actual bounds (not too far in the past/future) are checked in the
// service layer, where the error message can reference the allowed window.
const clockedAt = z.string().optional();

export const clockInSchema = z.object({
  shiftId: z.coerce.number().int().positive("shiftId must be a positive integer"),
  lat,
  lng,
  clockedAt,
});

export const clockOutSchema = z.object({
  lat,
  lng,
  clockedAt,
});
