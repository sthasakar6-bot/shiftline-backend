import { AppError } from "../../errors/AppError";
import { findCompanyById } from "../company/model";
import { findAllEmployeesInCompany } from "../user/model";
import { findShiftTypesByCompany } from "../shiftType/model";
import { addShift } from "../shift/service";
import { claude, ASSISTANT_MODEL, PROPOSE_SHIFTS_TOOL } from "./claude";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ProposedShift {
  userId: number;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}

export interface ConfirmShiftInput {
  userId: number;
  startsAt: string;
  endsAt: string;
  breakMinutes?: number;
}

export interface ConfirmShiftResult {
  userId: number;
  startsAt: string;
  status: "created" | "error";
  message?: string;
}

// past_due (a payment retry in progress) does not revoke access -- same
// semantics as the base plan's login soft-lock. Only a canceled add-on
// subscription puts the assistant back behind the paywall.
async function assertEntitled(companyId: number): Promise<{ id: number; name: string }> {
  const company = await findCompanyById(companyId);
  if (!company) {
    throw new AppError(404, "Company not found");
  }
  if (company.aiAssistantStatus !== "active" && company.aiAssistantStatus !== "past_due") {
    throw new AppError(
      402,
      "The AI scheduling assistant isn't part of your plan yet.",
      "AI_ASSISTANT_NOT_SUBSCRIBED",
    );
  }
  return { id: company.id, name: company.name };
}

function buildSystemPrompt(
  companyName: string,
  roster: { id: number; name: string }[],
  shiftTypes: { id: number; name: string }[],
): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" });

  const rosterLines = roster.map((r) => `- id ${r.id}: ${r.name}`).join("\n");
  const shiftTypeLines =
    shiftTypes.length > 0
      ? `\n\nShift types available (optional -- only attach one if the manager names it):\n${shiftTypes
          .map((s) => `- id ${s.id}: ${s.name}`)
          .join("\n")}`
      : "";

  return `You are the scheduling assistant inside Shiftline, a workforce-scheduling app, for the company "${companyName}".
Today's date is ${todayStr} (${weekday}).

You help the manager create shifts by understanding natural-language requests and proposing them with the propose_shifts tool. You never write anything directly to the schedule -- the manager reviews and confirms every proposal separately, outside this conversation.

Employees you can schedule (use these exact ids -- never invent or guess one):
${rosterLines || "(no active employees yet)"}${shiftTypeLines}

Rules:
- Only call propose_shifts with userIds from the list above.
- If a name is ambiguous (more than one employee could match) or a date/time is unclear, ask a short clarifying question in plain text instead of calling the tool.
- There is no recurring/range shift primitive -- each calendar day is its own shift entry, so "Monday to Friday" becomes 5 separate entries in one tool call.
- Times are 24-hour HH:MM. Dates are YYYY-MM-DD.
- If the request has nothing to do with scheduling shifts, say so briefly in plain text instead of calling the tool.`;
}

export async function chat(
  companyId: number,
  managerId: number,
  history: ChatTurn[],
  message: string,
): Promise<{ reply: string; proposedShifts: ProposedShift[] }> {
  const company = await assertEntitled(companyId);

  const [roster, shiftTypes] = await Promise.all([
    findAllEmployeesInCompany(companyId, managerId),
    findShiftTypesByCompany(companyId),
  ]);

  const system = buildSystemPrompt(company.name, roster, shiftTypes);

  const response = await claude().messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: 1024,
    system,
    messages: [
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
      { role: "user" as const, content: message },
    ],
    tools: [PROPOSE_SHIFTS_TOOL],
  });

  // Never trust the model's userIds blindly -- only ids actually in this
  // company's active roster are allowed through to the frontend, let alone
  // to confirmShifts later.
  const rosterIds = new Set(roster.map((r) => r.id));

  let reply = "";
  let proposedShifts: ProposedShift[] = [];
  for (const block of response.content) {
    if (block.type === "text") {
      reply += block.text;
    } else if (block.type === "tool_use" && block.name === "propose_shifts") {
      const input = block.input as { shifts?: ProposedShift[] };
      proposedShifts = (input.shifts ?? []).filter((s) => rosterIds.has(s.userId));
    }
  }

  return { reply, proposedShifts };
}

export async function confirmShifts(
  companyId: number,
  managerId: number,
  shifts: ConfirmShiftInput[],
): Promise<ConfirmShiftResult[]> {
  await assertEntitled(companyId);

  const roster = await findAllEmployeesInCompany(companyId, managerId);
  const rosterIds = new Set(roster.map((r) => r.id));

  const results: ConfirmShiftResult[] = [];
  for (const shift of shifts) {
    if (!rosterIds.has(shift.userId)) {
      results.push({
        userId: shift.userId,
        startsAt: shift.startsAt,
        status: "error",
        message: "This employee isn't part of your team",
      });
      continue;
    }
    try {
      // Reuses addShift's existing overlap/leave-conflict/break-length
      // validation and its existing notify-the-employee side effect
      // verbatim -- no duplicated logic here.
      await addShift(shift.userId, companyId, {
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        breakMinutes: shift.breakMinutes,
      });
      results.push({ userId: shift.userId, startsAt: shift.startsAt, status: "created" });
    } catch (err) {
      results.push({
        userId: shift.userId,
        startsAt: shift.startsAt,
        status: "error",
        message: err instanceof AppError ? err.message : "Could not create this shift",
      });
    }
  }
  return results;
}
