import argon2 from "argon2";
import { db } from "../prisma/db";

// Bootstraps a brand-new company plus its first manager account -- there's
// no self-serve signup, so the very first user in a company can't come
// through the normal invite-registration flow (there's no manager yet to
// send the invite). Run once per new company.
async function main() {
  const [companyName, slug, managerName, email, password] = process.argv.slice(2);
  if (!companyName || !slug || !managerName || !email || !password) {
    console.error(
      "Usage: npm run create-company -- <companyName> <slug> <managerName> <email> <password>",
    );
    process.exitCode = 1;
    return;
  }

  const existingCompany = await db.orm.public.Company.where({ slug }).first();
  if (existingCompany) {
    console.error(`A company with slug "${slug}" already exists (id ${existingCompany.id}).`);
    process.exitCode = 1;
    return;
  }

  const company = await db.orm.public.Company.create({ name: companyName, slug });

  const existingUser = await db.orm.public.User.where({ email, companyId: company.id }).first();
  if (existingUser) {
    console.error(`A user with that email already exists in ${companyName}.`);
    process.exitCode = 1;
    return;
  }

  const spaceIdx = managerName.indexOf(" ");
  const firstName = spaceIdx === -1 ? managerName : managerName.slice(0, spaceIdx);
  const lastName = spaceIdx === -1 ? "" : managerName.slice(spaceIdx + 1);
  const passwordHash = await argon2.hash(password);

  const manager = await db.orm.public.User.create({
    name: managerName,
    firstName,
    lastName,
    email,
    passwordHash,
    role: "manager",
    companyId: company.id,
  });

  console.log("Created company:", company);
  console.log("Created manager:", { id: manager.id, name: manager.name, email: manager.email });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
