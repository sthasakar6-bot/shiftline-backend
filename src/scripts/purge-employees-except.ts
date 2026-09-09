import { db } from "../prisma/db";

// One-off cleanup: permanently delete every user except the given email,
// across the given companies -- including all of their dependent records
// (shifts, attendance, contracts, payslips, leave requests, etc.), not just
// the account itself.
const COMPANY_SLUGS = ["super-sushi", "zuiderzoet"];
const KEEP_EMAIL = "sthasakar6@gmail.com";

async function main() {
  const apply = process.argv.includes("--apply");

  const companies = [];
  for (const slug of COMPANY_SLUGS) {
    const company = await db.orm.public.Company.select("id", "name", "slug").first({ slug });
    if (company) companies.push(company);
  }
  if (companies.length === 0) {
    console.log(`No companies found matching: ${COMPANY_SLUGS.join(", ")}`);
    return;
  }

  let totalTargets = 0;
  const perCompanyTargets: { companyId: number; companyName: string; userIds: number[] }[] = [];

  for (const company of companies) {
    const users = await db.orm.public.User.select("id", "name", "email")
      .where({ companyId: company.id })
      .all();
    const targets = users.filter((u) => u.email.toLowerCase() !== KEEP_EMAIL.toLowerCase());
    perCompanyTargets.push({
      companyId: company.id,
      companyName: company.name,
      userIds: targets.map((u) => u.id),
    });
    totalTargets += targets.length;

    console.log(`\n${company.name} (${company.slug}): ${users.length} user(s) total`);
    for (const u of targets) {
      console.log(`  DELETE  #${u.id}  ${u.name}  <${u.email}>`);
    }
    const kept = users.filter((u) => u.email.toLowerCase() === KEEP_EMAIL.toLowerCase());
    for (const u of kept) {
      console.log(`  KEEP    #${u.id}  ${u.name}  <${u.email}>`);
    }
  }

  if (totalTargets === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  if (!apply) {
    console.log(`\nDry run only. ${totalTargets} user(s) would be deleted. Re-run with --apply to delete.`);
    return;
  }

  for (const { userIds } of perCompanyTargets) {
    if (userIds.length === 0) continue;

    // Clear self-referential manager links first so no FK blocks a delete
    // further down, in either direction.
    for (const id of userIds) {
      const reports = await db.orm.public.User.select("id").where({ managerId: id }).all();
      for (const r of reports) {
        await db.orm.public.User.where({ id: r.id }).update({ managerId: null });
      }
    }

    for (const id of userIds) {
      const attendance = await db.orm.public.Attendance.select("id").where({ userId: id }).all();
      for (const a of attendance) await db.orm.public.Attendance.where({ id: a.id }).delete();

      const shifts = await db.orm.public.Shift.select("id").where({ userId: id }).all();
      for (const s of shifts) await db.orm.public.Shift.where({ id: s.id }).delete();

      const contracts = await db.orm.public.Contract.select("id").where({ userId: id }).all();
      for (const c of contracts) await db.orm.public.Contract.where({ id: c.id }).delete();

      const payslips = await db.orm.public.Payslip.select("id").where({ userId: id }).all();
      for (const p of payslips) await db.orm.public.Payslip.where({ id: p.id }).delete();

      const notifications = await db.orm.public.Notification.select("id").where({ userId: id }).all();
      for (const n of notifications) await db.orm.public.Notification.where({ id: n.id }).delete();

      const invitesSent = await db.orm.public.Invite.select("id").where({ managerId: id }).all();
      for (const i of invitesSent) await db.orm.public.Invite.where({ id: i.id }).delete();

      const pushSubs = await db.orm.public.PushSubscription.select("id").where({ userId: id }).all();
      for (const p of pushSubs) await db.orm.public.PushSubscription.where({ id: p.id }).delete();

      const resetReqs = await db.orm.public.PasswordResetRequest.select("id")
        .where({ userId: id })
        .all();
      for (const r of resetReqs) await db.orm.public.PasswordResetRequest.where({ id: r.id }).delete();

      const backupToken = await db.orm.public.BackupToken.select("id").where({ userId: id }).first();
      if (backupToken) await db.orm.public.BackupToken.where({ id: backupToken.id }).delete();

      const backupSnapshots = await db.orm.public.BackupSnapshot.select("id")
        .where({ userId: id })
        .all();
      for (const b of backupSnapshots) await db.orm.public.BackupSnapshot.where({ id: b.id }).delete();

      const leaveRequests = await db.orm.public.LeaveRequest.select("id").where({ userId: id }).all();
      for (const l of leaveRequests) await db.orm.public.LeaveRequest.where({ id: l.id }).delete();

      await db.orm.public.User.where({ id }).delete();
    }
  }

  console.log(`\nDeleted ${totalTargets} user(s) and all their dependent records.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
