import argon2 from "argon2";
import crypto from "crypto";
import { db } from "../prisma/db";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  return Array.from(crypto.randomBytes(12), (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

async function main() {
  const [firstName, lastName, email, companySlug] = process.argv.slice(2);
  if (!firstName || !lastName || !email || !companySlug) {
    console.error("Usage: npm run create-manager -- <firstName> <lastName> <email> <companySlug>");
    process.exitCode = 1;
    return;
  }

  const company = await db.orm.public.Company.where({ slug: companySlug }).first();
  if (!company) {
    console.error(`No company found with slug: ${companySlug}`);
    process.exitCode = 1;
    return;
  }

  const existing = await db.orm.public.User.where({ email, companyId: company.id }).first();
  if (existing) {
    console.error(
      `A user with that email already exists in ${companySlug} (id ${existing.id}, role ${existing.role})`,
    );
    process.exitCode = 1;
    return;
  }

  const password = generatePassword();
  const passwordHash = await argon2.hash(password);
  const user = await db.orm.public.User.create({
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email,
    passwordHash,
    role: "manager",
    companyId: company.id,
    needsOnboarding: true,
  });

  console.log(`Created manager #${user.id} in ${company.name} (${company.slug})`);
  console.log(`Email: ${email}`);
  console.log(`Temporary password: ${password}`);
  console.log(`They'll be asked to set their own password and add a profile photo on first login.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
