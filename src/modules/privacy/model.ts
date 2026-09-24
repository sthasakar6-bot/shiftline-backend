import { db } from "../../prisma/db";
import { deleteCompanyCascade } from "../ictAdmin/model";

// GDPR data export -- a machine-readable snapshot of everything Shiftline
// holds for this one user. Deliberately excludes passwordHash (a secret,
// not personal data the user needs back) and other users' data.
export async function exportUserData(userId: number) {
  const user = await db.orm.public.User.first({ id: userId });
  if (!user) return null;

  const [attendance, leaveRequests, contracts, payslips, shifts, notifications, messages] =
    await Promise.all([
      db.orm.public.Attendance.where({ userId }).all(),
      db.orm.public.LeaveRequest.where({ userId }).all(),
      db.orm.public.Contract.where({ userId }).all(),
      db.orm.public.Payslip.where({ userId }).all(),
      db.orm.public.Shift.where({ userId }).all(),
      db.orm.public.Notification.where({ userId }).all(),
      db.orm.public.Message.where({ userId }).all(),
    ]);

  const { passwordHash: _passwordHash, ...profile } = user;

  return {
    exportedAt: new Date().toISOString(),
    profile,
    attendance,
    leaveRequests,
    contracts,
    payslips,
    shifts,
    notifications,
    messages,
  };
}

async function deleteAllBy<T extends { id: number }>(rows: T[], del: (id: number) => Promise<unknown>) {
  await Promise.all(rows.map((r) => del(r.id)));
}

// Removes exactly one user's own data -- the same per-user cascade
// ictAdmin's deleteCompanyCascade runs per-member, plus Message (which that
// cascade only needs at the whole-company level, since it deletes every
// user anyway) since Message.userId isn't nullable and a lone user's
// deletion can't leave dangling messages behind.
async function deleteUserOwnData(userId: number) {
  await db.transaction(async (tx) => {
    await deleteAllBy(await tx.orm.public.Attendance.where({ userId }).all(), (id) => tx.orm.public.Attendance.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.BackupSnapshot.where({ userId }).all(), (id) => tx.orm.public.BackupSnapshot.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.BackupToken.where({ userId }).all(), (id) => tx.orm.public.BackupToken.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.Contract.where({ userId }).all(), (id) => tx.orm.public.Contract.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.LeaveRequest.where({ userId }).all(), (id) => tx.orm.public.LeaveRequest.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.Notification.where({ userId }).all(), (id) => tx.orm.public.Notification.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.PasswordResetRequest.where({ userId }).all(), (id) => tx.orm.public.PasswordResetRequest.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.Payslip.where({ userId }).all(), (id) => tx.orm.public.Payslip.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.PushSubscription.where({ userId }).all(), (id) => tx.orm.public.PushSubscription.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.OpenShiftRequest.where({ userId }).all(), (id) => tx.orm.public.OpenShiftRequest.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.Shift.where({ userId }).all(), (id) => tx.orm.public.Shift.where({ id }).delete());
    await deleteAllBy(await tx.orm.public.Message.where({ userId }).all(), (id) => tx.orm.public.Message.where({ id }).delete());
    await tx.orm.public.User.where({ id: userId }).delete();
  });
}

// Self-service account deletion. A manager who's the last manager left in
// their company can't just delete themselves and leave the company
// ownerless -- that would strand every remaining employee's data with no
// one able to administer it -- so that case deletes the whole company
// instead (the same cascade ICT admin's tooling uses). Every other case
// (an employee, or a manager with co-managers) only removes this one
// user's own data.
export async function deleteOwnAccount(userId: number, companyId: number, role: string) {
  if (role === "manager") {
    const managers = await db.orm.public.User.where({ companyId, role: "manager" }).all();
    const otherManagers = managers.filter((m) => m.id !== userId);
    if (otherManagers.length === 0) {
      await deleteCompanyCascade(companyId);
      return { deletedCompany: true };
    }
  }
  await deleteUserOwnData(userId);
  return { deletedCompany: false };
}
