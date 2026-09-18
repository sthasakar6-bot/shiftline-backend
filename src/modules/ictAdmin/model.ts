import { db } from "../../prisma/db";

export async function listCompaniesWithUserCounts() {
  const [companies, users] = await Promise.all([
    db.orm.public.Company.orderBy((c) => c.createdAt.desc()).all(),
    db.orm.public.User.all(),
  ]);
  const countByCompany = new Map<number, number>();
  for (const u of users) {
    countByCompany.set(u.companyId, (countByCompany.get(u.companyId) ?? 0) + 1);
  }
  return companies.map((c) => ({ ...c, userCount: countByCompany.get(c.id) ?? 0 }));
}

// Deletes everything referencing this company, in dependency order --
// mirrors the manual cascade this session ran by hand (via a Railway TCP
// proxy + a one-off script) several times over: userId-scoped tables
// first, then companyId-scoped tables, then the users, then the company
// itself. All inside one transaction: either the whole company and its
// data disappear, or nothing does.
export async function deleteCompanyCascade(companyId: number) {
  await db.transaction(async (tx) => {
    const users = await tx.orm.public.User.where({ companyId }).all();
    const userIds = users.map((u) => u.id);

    async function deleteAllBy<T extends { id: number }>(
      rows: T[],
      del: (id: number) => Promise<unknown>,
    ) {
      await Promise.all(rows.map((r) => del(r.id)));
    }

    if (userIds.length > 0) {
      for (const userId of userIds) {
        await deleteAllBy(
          await tx.orm.public.Attendance.where({ userId }).all(),
          (id) => tx.orm.public.Attendance.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.BackupSnapshot.where({ userId }).all(),
          (id) => tx.orm.public.BackupSnapshot.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.BackupToken.where({ userId }).all(),
          (id) => tx.orm.public.BackupToken.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.Contract.where({ userId }).all(),
          (id) => tx.orm.public.Contract.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.LeaveRequest.where({ userId }).all(),
          (id) => tx.orm.public.LeaveRequest.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.Notification.where({ userId }).all(),
          (id) => tx.orm.public.Notification.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.PasswordResetRequest.where({ userId }).all(),
          (id) => tx.orm.public.PasswordResetRequest.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.Payslip.where({ userId }).all(),
          (id) => tx.orm.public.Payslip.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.PushSubscription.where({ userId }).all(),
          (id) => tx.orm.public.PushSubscription.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.OpenShiftRequest.where({ userId }).all(),
          (id) => tx.orm.public.OpenShiftRequest.where({ id }).delete(),
        );
        await deleteAllBy(
          await tx.orm.public.Shift.where({ userId }).all(),
          (id) => tx.orm.public.Shift.where({ id }).delete(),
        );
      }
    }

    await deleteAllBy(
      await tx.orm.public.OpenShiftRequest.where({ companyId }).all(),
      (id) => tx.orm.public.OpenShiftRequest.where({ id }).delete(),
    );
    await deleteAllBy(
      await tx.orm.public.OpenShift.where({ companyId }).all(),
      (id) => tx.orm.public.OpenShift.where({ id }).delete(),
    );
    await deleteAllBy(
      await tx.orm.public.Message.where({ companyId }).all(),
      (id) => tx.orm.public.Message.where({ id }).delete(),
    );
    await deleteAllBy(
      await tx.orm.public.Invite.where({ companyId }).all(),
      (id) => tx.orm.public.Invite.where({ id }).delete(),
    );
    await deleteAllBy(
      await tx.orm.public.Event.where({ companyId }).all(),
      (id) => tx.orm.public.Event.where({ id }).delete(),
    );
    await deleteAllBy(
      await tx.orm.public.ShiftType.where({ companyId }).all(),
      (id) => tx.orm.public.ShiftType.where({ id }).delete(),
    );
    await deleteAllBy(
      await tx.orm.public.Department.where({ companyId }).all(),
      (id) => tx.orm.public.Department.where({ id }).delete(),
    );

    await deleteAllBy(users, (id) => tx.orm.public.User.where({ id }).delete());

    await tx.orm.public.Company.where({ id: companyId }).delete();
  });
}

export function listTickets() {
  return db.orm.public.IctAdminTicket.orderBy((t) => t.createdAt.desc()).all();
}

export function findTicketById(id: number) {
  return db.orm.public.IctAdminTicket.first({ id });
}

export function createTicket(data: { title: string; description: string; priority: string }) {
  return db.orm.public.IctAdminTicket.create(data);
}

export function updateTicketStatus(id: number, status: string) {
  return db.orm.public.IctAdminTicket.where({ id }).update({ status, updatedAt: new Date().toISOString() });
}
