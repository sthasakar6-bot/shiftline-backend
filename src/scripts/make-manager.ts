import { db } from "../prisma/db";

async function main() {
  const email = process.argv[2];
  const companySlug = process.argv[3];
  if (!email || !companySlug) {
    console.error("Usage: npm run make-manager -- <email> <companySlug>");
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

  const updated = await db.orm.public.User.where({ id: user.id })
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
