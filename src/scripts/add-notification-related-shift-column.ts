import "dotenv/config";
import { Client } from "pg";

// One-time schema fix: adds Notification.relatedShiftId so missed
// clock-in/out notifications can be cleared automatically once the
// employee actually clocks in/out. Safe to run more than once.
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "relatedShiftId" int4`,
    );
    console.log('Added "relatedShiftId" column to "notification" (or it already existed).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
