import { db } from "../prisma/db";

interface ShiftRow {
  id: number;
  userId: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");

  const shifts = await db.orm.public.Shift.select(
    "id",
    "userId",
    "startsAt",
    "endsAt",
    "createdAt",
  ).all();
  const leaveRequests = await db.orm.public.LeaveRequest.where({ status: "approved" }).all();
  const users = await db.orm.public.User.select("id", "name").all();
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const toDelete = new Map<number, string>();

  const byUser = new Map<number, ShiftRow[]>();
  for (const s of shifts) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  for (const [userId, userShifts] of byUser) {
    const sorted = [...userShifts].sort((a, b) => {
      const diff = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      if (diff !== 0) return diff;
      return a.id - b.id;
    });

    const kept: ShiftRow[] = [];
    for (const s of sorted) {
      const sStart = new Date(s.startsAt).getTime();
      const sEnd = new Date(s.endsAt).getTime();
      const conflictsWithKept = kept.find((k) =>
        overlaps(sStart, sEnd, new Date(k.startsAt).getTime(), new Date(k.endsAt).getTime()),
      );
      if (conflictsWithKept) {
        toDelete.set(
          s.id,
          `overlaps shift #${conflictsWithKept.id} (${conflictsWithKept.startsAt} - ${conflictsWithKept.endsAt})`,
        );
      } else {
        kept.push(s);
      }
    }

    const userLeave = leaveRequests.filter((l) => l.userId === userId);
    for (const s of userShifts) {
      if (toDelete.has(s.id)) continue;
      const sStart = new Date(s.startsAt).getTime();
      const sEnd = new Date(s.endsAt).getTime();
      for (const l of userLeave) {
        const leaveStart = new Date(l.startDate).getTime();
        const leaveEnd = new Date(l.endDate).getTime() + 24 * 60 * 60 * 1000;
        if (overlaps(sStart, sEnd, leaveStart, leaveEnd)) {
          toDelete.set(s.id, `overlaps approved ${l.type} leave (${l.startDate} to ${l.endDate})`);
          break;
        }
      }
    }
  }

  if (toDelete.size === 0) {
    console.log("No overlapping shifts or leave conflicts found.");
    return;
  }

  const attendanceByShiftId = new Set(
    (await db.orm.public.Attendance.select("shiftId").all()).map((a) => a.shiftId),
  );

  const safeToDelete = new Map<number, string>();
  const needsReview = new Map<number, string>();
  for (const [shiftId, reason] of toDelete) {
    if (attendanceByShiftId.has(shiftId)) {
      needsReview.set(shiftId, reason);
    } else {
      safeToDelete.set(shiftId, reason);
    }
  }

  function describe(shiftId: number, reason: string): string {
    const shift = shifts.find((s) => s.id === shiftId)!;
    const name = nameById.get(shift.userId) ?? `user #${shift.userId}`;
    return `  #${shiftId} - ${name} - ${shift.startsAt} to ${shift.endsAt} - ${reason}`;
  }

  if (safeToDelete.size > 0) {
    console.log(`${safeToDelete.size} conflicting shift(s) with no clock-in/out data:\n`);
    for (const [shiftId, reason] of safeToDelete) console.log(describe(shiftId, reason));
  }

  if (needsReview.size > 0) {
    const verb = force ? "will be force-deleted along with their attendance records" : "SKIPPED";
    console.log(
      `\n${needsReview.size} conflicting shift(s) have attendance (clock-in/out) records attached and ${verb}:\n`,
    );
    for (const [shiftId, reason] of needsReview) console.log(describe(shiftId, reason));
  }

  if (!apply) {
    console.log(
      "\nDry run only. Re-run with --apply to delete the shifts with no attendance data (add --force to also delete the ones with attendance records).",
    );
    return;
  }

  for (const shiftId of safeToDelete.keys()) {
    await db.orm.public.Shift.where({ id: shiftId }).delete();
  }
  console.log(`\nDeleted ${safeToDelete.size} shift(s) with no attendance data.`);

  if (needsReview.size > 0) {
    if (force) {
      for (const shiftId of needsReview.keys()) {
        await db.orm.public.Attendance.where({ shiftId }).delete();
        await db.orm.public.Shift.where({ id: shiftId }).delete();
      }
      console.log(`Deleted ${needsReview.size} more shift(s) along with their attendance records.`);
    } else {
      console.log(`${needsReview.size} shift(s) left in place for manual review (see above).`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
