import { db } from "../prisma/db";

// One-off migration step: the plan/trialEndsAt columns just added to Company
// default every existing row to plan="trial" (the column default) with
// trialEndsAt still null. Real, already-onboarded companies must never be
// soft-locked by the trial-expiry check, so this explicitly flips every
// company that existed before self-service signup shipped to a non-trial
// plan. Run exactly once, immediately after the migration that adds these
// columns and before the signup endpoint goes live -- at that point every
// row in Company IS a pre-existing, manually provisioned company, so
// selecting all of them is safe and correct.
async function main() {
  const companies = await db.orm.public.Company.select("id", "name", "plan").all();
  const toFix = companies.filter((c) => c.plan === "trial");

  for (const c of toFix) {
    await db.orm.public.Company.where({ id: c.id }).update({
      plan: "legacy",
      trialEndsAt: null,
    });
  }

  console.log(`Backfilled ${toFix.length} of ${companies.length} companies to plan="legacy".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
