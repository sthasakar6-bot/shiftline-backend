import argon2 from "argon2";
import { db } from "../prisma/db";

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  if (!email || !newPassword) {
    console.error("Usage: npm run reset-password -- <email> <newPassword>");
    process.exitCode = 1;
    return;
  }
  if (newPassword.length < 8) {
    console.error("newPassword must be at least 8 characters");
    process.exitCode = 1;
    return;
  }

  const user = await db.orm.public.User.where({ email }).first();
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argon2.hash(newPassword);
  await db.orm.public.User.where({ email }).update({ passwordHash });

  console.log(`Password reset for ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
