import argon2 from "argon2";
import { db } from "../prisma/db";

async function main() {
  const email = process.argv[2];
  const companySlug = process.argv[3];
  const newPassword = process.argv[4];
  if (!email || !companySlug || !newPassword) {
    console.error("Usage: npm run reset-password -- <email> <companySlug> <newPassword>");
    process.exitCode = 1;
    return;
  }
  if (newPassword.length < 8) {
    console.error("newPassword must be at least 8 characters");
    process.exitCode = 1;
    return;
  }

  const company = await db.orm.public.Company.where({ slug: companySlug }).first();
  if (!company) {
    console.error(`No company found with slug: ${companySlug}`);
    process.exitCode = 1;
    return;
  }

  const user = await db.orm.public.User.where({ email, companyId: company.id }).first();
  if (!user) {
    console.error(`No user found with email ${email} in company ${companySlug}`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argon2.hash(newPassword);
  await db.orm.public.User.where({ id: user.id }).update({ passwordHash });

  console.log(`Password reset for ${email} in ${company.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
