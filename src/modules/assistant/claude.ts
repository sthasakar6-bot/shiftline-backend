import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";

// Lazy + memoized -- same reasoning as the Mollie client in the billing
// adapter: this module is imported at server startup regardless of
// whether ANTHROPIC_API_KEY is configured yet.
let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

// Sonnet 5, not the more capable (and 2.5x pricier) Opus 5 -- this is a
// narrow, well-specified extraction/tool-call task (turn a scheduling
// sentence into structured shift proposals), not open-ended reasoning, and
// Sonnet 5 pricing is what the per-command cost estimate given to the
// manager was based on.
export const ASSISTANT_MODEL = "claude-sonnet-5";

// A single non-mutating "proposal" tool -- the model never writes to the
// schedule itself. It either calls this to describe what it understood, or
// replies in plain text (a clarifying question, or "that's not something I
// can schedule"). A separate, explicit confirm step (assistant/service.ts
// confirmShifts) does the actual writes, reusing shift/service.ts's
// existing addShift validation.
export const PROPOSE_SHIFTS_TOOL: Anthropic.Tool = {
  name: "propose_shifts",
  description:
    "Propose one or more shifts for the manager to review. This does not create anything -- " +
    "the manager must confirm separately before any shift is actually scheduled.",
  input_schema: {
    type: "object",
    properties: {
      shifts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            userId: { type: "integer", description: "Must be one of the employee ids given in context." },
            userName: { type: "string", description: "The employee's name, for display only." },
            date: { type: "string", description: "YYYY-MM-DD" },
            startTime: { type: "string", description: "HH:MM, 24-hour" },
            endTime: { type: "string", description: "HH:MM, 24-hour" },
            breakMinutes: { type: "integer", enum: [15, 30, 45, 60] },
          },
          required: ["userId", "userName", "date", "startTime", "endTime"],
        },
      },
    },
    required: ["shifts"],
  },
};
