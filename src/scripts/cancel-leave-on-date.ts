import { db } from "../prisma/db";

async function main() {
  const email = process.argv[2];
  const date = process.argv[3];
  const apply = process.argv.includes("--apply");
  if (!email || !date) {
    console.error("Usage: cancel-leave-on-date <email> <YYYY-MM-DD> [--apply]");
    process.exitCode = 1;
    return;
  }

  const user = await db.orm.public.User.first({ email });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
    return;
  }

  const requests = await db.orm.public.LeaveRequest.where({ userId: user.id }).all();
  const target = new Date(date).getTime();
  const matches = requests.filter((r) => {
    if (r.status !== "approved") return false;
    const start = new Date(r.startDate).getTime();
    const end = new Date(r.endDate).getTime();
    return target >= start && target <= end;
  });

  if (matches.length === 0) {
    console.log("No approved leave request covers that date.");
    return;
  }

  for (const m of matches) {
    console.log(
      `#${m.id} - ${m.type} - ${m.startDate.slice(0, 10)} to ${m.endDate.slice(0, 10)} - ${m.status}`,
    );
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to cancel these.");
    return;
  }

  for (const m of matches) {
    await db.orm.public.LeaveRequest.where({ id: m.id }).update({
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    });
  }
  console.log(`\nCancelled ${matches.length} leave request(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
