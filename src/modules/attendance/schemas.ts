import { z } from "zod";

export const clockInSchema = z.object({
  shiftId: z.coerce.number().int().positive("shiftId must be a positive integer"),
});
