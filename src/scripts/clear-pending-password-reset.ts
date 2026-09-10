import { db } from "../prisma/db";

async function main() {
  const email = process.argv[2];
  const companySlug = process.argv.find((a, i) => i >= 3 && a !== "--apply");
  const apply = process.argv.includes("--apply");
  if (!email) {
    console.error(
      "Usage: npm run clear-pending-password-reset -- <email> [companySlug] [--apply]",
    );
    process.exitCode = 1;
    return;
  }

  let user;
  if (companySlug) {
    const company = await db.orm.public.Company.where({ slug: companySlug }).first();
    if (!company) {
      console.error(`No company found with slug: ${companySlug}`);
      process.exitCode = 1;
      return;
    }
    user = await db.orm.public.User.where({ email, companyId: company.id }).first();
    if (!user) {
      console.error(`No user found with email ${email} in company ${companySlug}`);
      process.exitCode = 1;
      return;
    }
  } else {
    const matches = await db.orm.public.User.where({ email }).all();
    if (matches.length === 0) {
      console.error(`No user found with email ${email}`);
      process.exitCode = 1;
      return;
    }
    if (matches.length > 1) {
      const companies = await db.orm.public.Company.all();
      const slugById = new Map(companies.map((c) => [c.id, c.slug]));
      console.error(`Email ${email} exists in multiple companies -- pass a companySlug:`);
      for (const m of matches) {
        console.error(`  ${slugById.get(m.companyId) ?? m.companyId}`);
      }
      process.exitCode = 1;
      return;
    }
    user = matches[0];
    const company = await db.orm.public.Company.where({ id: user.companyId }).first();
    console.log(`Found in company: ${company?.name ?? user.companyId}`);
  }

  if (user.managerId) {
    const manager = await db.orm.public.User.where({ id: user.managerId }).first();
    console.log(`Manager on file: ${manager?.email ?? "unknown"} (id ${user.managerId})`);
  } else {
    console.log("No manager assigned to this account -- that's why no manager could see this request.");
  }

  const pending = await db.orm.public.PasswordResetRequest.where({
    userId: user.id,
    status: "pending",
  }).all();

  if (pending.length === 0) {
    console.log(`No pending reset request for ${email}.`);
    return;
  }

  console.log(`Found ${pending.length} pending reset request(s) for ${email}:`);
  for (const r of pending) {
    console.log(`  #${r.id} - created ${r.createdAt} - expires ${r.expiresAt}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete these.");
    return;
  }

  for (const r of pending) {
    await db.orm.public.PasswordResetRequest.where({ id: r.id }).delete();
  }
  console.log(`\nDeleted ${pending.length} pending reset request(s) for ${email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
