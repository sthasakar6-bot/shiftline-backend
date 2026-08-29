import { z } from "zod";

export const createInviteSchema = z.object({
  email: z.string().email("invalid email"),
});
