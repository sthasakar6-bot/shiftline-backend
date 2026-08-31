import { db } from "../prisma/db";

async function main() {
  const apply = process.argv.includes("--apply");

  const requests = await db.orm.public.LeaveRequest.select(
    "id",
    "userId",
    "type",
    "status",
    "startDate",
    "endDate",
  ).all();
  const users = await db.orm.public.User.select("id", "name").all();
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  if (requests.length === 0) {
    console.log("No leave requests found.");
    return;
  }

  console.log(`Found ${requests.length} leave request(s):\n`);
  for (const r of requests) {
    const name = nameById.get(r.userId) ?? `user #${r.userId}`;
    console.log(
      `  #${r.id} - ${name} - ${r.type} - ${r.status} - ${r.startDate.slice(0, 10)} to ${r.endDate.slice(0, 10)}`,
    );
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete all of these.");
    return;
  }

  for (const r of requests) {
    await db.orm.public.LeaveRequest.where({ id: r.id }).delete();
  }
  console.log(`\nDeleted ${requests.length} leave request(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
