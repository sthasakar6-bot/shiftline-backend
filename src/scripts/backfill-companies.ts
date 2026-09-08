import { db } from "../prisma/db";

// One-off migration step: creates the "Super Sushi" company (the business
// this app has always been for) and assigns every existing user/invite --
// created before the multi-company feature existed -- to it. Run once
// between adding companyId as nullable and tightening it to required.
async function main() {
  let company = await db.orm.public.Company.where({ slug: "super-sushi" }).first();
  if (!company) {
    company = await db.orm.public.Company.create({ name: "Super Sushi", slug: "super-sushi" });
    console.log("Created company:", company);
  } else {
    console.log("Company already exists:", company);
  }

  const orphanUsers = await db.orm.public.User.select("id").where((u) => u.companyId.isNull()).all();
  await Promise.all(
    orphanUsers.map((u) => db.orm.public.User.where({ id: u.id }).update({ companyId: company!.id })),
  );
  console.log(`Backfilled ${orphanUsers.length} user(s) to Super Sushi.`);

  const orphanInvites = await db.orm.public.Invite.select("id")
    .where((i) => i.companyId.isNull())
    .all();
  await Promise.all(
    orphanInvites.map((i) =>
      db.orm.public.Invite.where({ id: i.id }).update({ companyId: company!.id }),
    ),
  );
  console.log(`Backfilled ${orphanInvites.length} invite(s) to Super Sushi.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
