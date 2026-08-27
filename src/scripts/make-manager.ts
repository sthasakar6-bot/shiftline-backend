import { db } from "../prisma/db";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run make-manager -- <email>");
    process.exitCode = 1;
    return;
  }

  const user = await db.orm.public.User.where({ email }).first();
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
    return;
  }

  const updated = await db.orm.public.User.where({ email })
    .select("id", "name", "email", "role")
    .update({ role: "manager" });

  console.log("Promoted to manager:", updated);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
