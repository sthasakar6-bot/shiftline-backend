import {
  findAllManagerIds,
  createBackupSnapshot,
  findBackupSnapshotsByUser,
  findBackupSnapshotByIdForUser,
  deleteBackupSnapshotsOlderThan,
} from "./model";
import { findUserById } from "../identity/model";
import { findDirectReports } from "../user/model";
import { findAttendanceByUser } from "../attendance/model";
import { findShiftsByUser } from "../shift/model";
import { findLeaveRequestsByUser } from "../leave/model";
import { AppError } from "../../errors/AppError";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(",");
}

export async function generateBackupCsv(managerId: number): Promise<string> {
  const manager = await findUserById(managerId);
  const reports = await findDirectReports(managerId);
  const people = [
    { id: managerId, name: manager?.name ?? `User ${managerId}` },
    ...reports.map((r) => ({ id: r.id, name: r.name })),
  ];

  const lines: string[] = [];
  lines.push("Shiftline Backup");
  lines.push(csvRow(["Generated at", new Date().toISOString()]));
  lines.push("");

  lines.push("Attendance");
  lines.push(csvRow(["Employee", "Date", "Clock In", "Clock Out", "Hours"]));
  for (const p of people) {
    const records = await findAttendanceByUser(p.id);
    for (const r of records) {
      const hours =
        r.clockIn && r.clockOut
          ? ((new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3600000).toFixed(2)
          : "";
      lines.push(
        csvRow([p.name, r.clockIn ? r.clockIn.slice(0, 10) : "", r.clockIn, r.clockOut, hours]),
      );
    }
  }
  lines.push("");

  lines.push("Shifts");
  lines.push(csvRow(["Employee", "Starts", "Ends", "Break (min)"]));
  for (const p of people) {
    const shifts = await findShiftsByUser(p.id);
    for (const s of shifts) {
      lines.push(csvRow([p.name, s.startsAt, s.endsAt, s.breakMinutes ?? 0]));
    }
  }
  lines.push("");

  lines.push("Leave Requests");
  lines.push(csvRow(["Employee", "Type", "Start Date", "End Date", "Status", "Reason"]));
  for (const p of people) {
    const requests = await findLeaveRequestsByUser(p.id);
    for (const l of requests) {
      lines.push(csvRow([p.name, l.type, l.startDate, l.endDate, l.status, l.reason]));
    }
  }

  return lines.join("\n");
}

export async function listBackupSnapshots(userId: number) {
  return findBackupSnapshotsByUser(userId);
}

export async function getBackupSnapshotCsv(id: number, userId: number): Promise<string> {
  const snapshot = await findBackupSnapshotByIdForUser(id, userId);
  if (!snapshot) {
    throw new AppError(404, "Backup snapshot not found");
  }
  return snapshot.csv;
}

// Snapshots run hourly (see server.ts), so 5 hours keeps roughly the last
// 5 snapshots per manager -- enough to recover from a same-day mistake
// without the list growing into hundreds of near-identical entries a
// manager has to scroll past to find anything.
const SNAPSHOT_RETENTION_HOURS = 5;

// Runs on a server-side interval (see server.ts) so backups keep happening
// even when no manager's own computer is on -- one snapshot per manager,
// each only seeing their own team's data, with old snapshots pruned so the
// table doesn't grow unbounded.
export async function runScheduledBackups(): Promise<void> {
  const managerIds = await findAllManagerIds();
  for (const managerId of managerIds) {
    const csv = await generateBackupCsv(managerId);
    await createBackupSnapshot(managerId, csv);
  }

  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  await deleteBackupSnapshotsOlderThan(cutoff);
}
