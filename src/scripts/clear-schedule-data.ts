import { db } from "../prisma/db";

// Wipes every shift (roster), its attendance/clock-in-out history, and every
// leave request (vacation/sick) for every employee, across every company.
// Dry run by default -- pass --apply to actually delete.
async function main() {
  const apply = process.argv.includes("--apply");

  const attendance = await db.orm.public.Attendance.select("id").all();
  const shifts = await db.orm.public.Shift.select("id").all();
  const leaveRequests = await db.orm.public.LeaveRequest.select("id").all();

  console.log(`Attendance records: ${attendance.length}`);
  console.log(`Shifts: ${shifts.length}`);
  console.log(`Leave requests: ${leaveRequests.length}`);

  if (attendance.length === 0 && shifts.length === 0 && leaveRequests.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete all of the above.");
    return;
  }

  for (const a of attendance) {
    await db.orm.public.Attendance.where({ id: a.id }).delete();
  }
  console.log(`Deleted ${attendance.length} attendance record(s).`);

  for (const s of shifts) {
    await db.orm.public.Shift.where({ id: s.id }).delete();
  }
  console.log(`Deleted ${shifts.length} shift(s).`);

  for (const l of leaveRequests) {
    await db.orm.public.LeaveRequest.where({ id: l.id }).delete();
  }
  console.log(`Deleted ${leaveRequests.length} leave request(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
