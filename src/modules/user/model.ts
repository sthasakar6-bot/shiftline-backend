import { db } from "../../prisma/db";

export interface User {
  id: number;
  name: string;
  email: string;
  location: string | null;
  departmentId: number | null;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
  managerId: number | null;
  companyId: number;
  hasAvatar: boolean;
  phone: string | null;
  address: string | null;
  location: string | null;
  departmentId: number | null;
  active: boolean;
  online: boolean;
}

const ONLINE_THRESHOLD_MS = 90 * 1000;

const SUMMARY_FIELDS = [
  "id",
  "name",
  "email",
  "role",
  "managerId",
  "companyId",
  "avatarBase64",
  "phone",
  "address",
  "location",
  "departmentId",
  "active",
  "lastSeenAt",
] as const;

function toUserSummary(row: {
  id: number;
  name: string;
  email: string;
  role: string;
  managerId: number | null;
  companyId: number;
  avatarBase64: string | null;
  phone: string | null;
  address: string | null;
  location: string | null;
  departmentId: number | null;
  active: boolean;
  lastSeenAt: string | null;
}): UserSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    managerId: row.managerId,
    companyId: row.companyId,
    hasAvatar: Boolean(row.avatarBase64),
    phone: row.phone,
    address: row.address,
    location: row.location,
    departmentId: row.departmentId,
    active: row.active,
    online: row.lastSeenAt !== null && Date.now() - new Date(row.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS,
  };
}

export async function findAllUsersInCompany(companyId: number): Promise<User[]> {
  return db.orm.public.User.select("id", "name", "email", "location", "departmentId")
    .where({ companyId })
    .all();
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  hasAvatar: boolean;
  location: string | null;
  departmentId: number | null;
}

// A lean, read-only "who's on the team" directory any employee can see --
// deliberately excludes phone/address/email (nobody's business but the
// person themself and their manager) and online status (manager-only,
// surfaced instead on the admin Team list).
export async function findTeamDirectory(companyId: number): Promise<TeamMember[]> {
  const rows = await db.orm.public.User.select(
    "id",
    "name",
    "role",
    "avatarBase64",
    "location",
    "departmentId",
  )
    .where({ companyId, active: true })
    .all();
  return rows
    .filter((r) => r.role !== "bookkeeper")
    .map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      hasAvatar: Boolean(r.avatarBase64),
      location: r.location,
      departmentId: r.departmentId,
    }));
}

export async function setUserLocation(
  id: number,
  location: string | null,
): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    .update({ location });
  return row ? toUserSummary(row) : null;
}

export async function setUserDepartment(
  id: number,
  departmentId: number | null,
): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    .update({ departmentId });
  return row ? toUserSummary(row) : null;
}

export async function findUserSummaryById(id: number): Promise<UserSummary | null> {
  const row = await db.orm.public.User.select(...SUMMARY_FIELDS).first({ id });
  return row ? toUserSummary(row) : null;
}

export async function findDirectReports(managerId: number): Promise<UserSummary[]> {
  const rows = await db.orm.public.User.select(...SUMMARY_FIELDS).where({ managerId }).all();
  return rows.map(toUserSummary);
}

export async function findManagerIdsInCompany(companyId: number): Promise<number[]> {
  const rows = await db.orm.public.User.select("id")
    .where({ role: "manager", companyId, active: true })
    .all();
  return rows.map((r) => r.id);
}

// "Team" here means everyone a manager administers -- plain employees and
// any co-managers alike, since a second manager has full access too and
// still needs to show up (be removable, promotable, etc.) somewhere. Only
// the caller's own row and bookkeepers are excluded: a manager doesn't
// manage themselves from this screen, and a bookkeeper has its own
// separate restricted UI entirely.
export async function findAllEmployeesInCompany(
  companyId: number,
  excludeUserId: number,
): Promise<UserSummary[]> {
  const rows = await db.orm.public.User.select(...SUMMARY_FIELDS)
    .where({ companyId, active: true })
    .all();
  return rows
    .filter((r) => r.role !== "bookkeeper" && r.id !== excludeUserId)
    .map(toUserSummary);
}

// Managers need payslips, contracts, and documents too -- only bookkeepers
// themselves are excluded, since there's no one to bill their own hours to.
export async function findPayrollEligibleInCompany(companyId: number): Promise<UserSummary[]> {
  const rows = await db.orm.public.User.select(...SUMMARY_FIELDS)
    .where({ companyId, active: true })
    .all();
  return rows.filter((r) => r.role !== "bookkeeper").map(toUserSummary);
}

export async function findFormerEmployeesInCompany(companyId: number): Promise<UserSummary[]> {
  const rows = await db.orm.public.User.select(...SUMMARY_FIELDS)
    .where({ role: "employee", companyId, active: false })
    .all();
  return rows.map(toUserSummary);
}

export async function setUserActive(
  id: number,
  active: boolean,
): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    // Deactivating also drops the manager link -- an ex-employee shouldn't
    // still show up as someone's direct report. Reactivating leaves it
    // unset; the manager adds them back to a team explicitly.
    .update(active ? { active } : { active, managerId: null });
  return row ? toUserSummary(row) : null;
}

export async function setUserManager(
  id: number,
  managerId: number | null,
): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    .update({ managerId });
  return row ? toUserSummary(row) : null;
}

export async function promoteUserToManager(id: number): Promise<UserSummary | null> {
  const row = await db.orm.public.User.where({ id })
    .select(...SUMMARY_FIELDS)
    .update({ role: "manager" });
  return row ? toUserSummary(row) : null;
}

export async function setUserAvatar(
  id: number,
  avatarBase64: string,
  avatarMimeType: string,
): Promise<void> {
  await db.orm.public.User.where({ id }).update({ avatarBase64, avatarMimeType });
}

export interface UserAvatar {
  avatarBase64: string;
  avatarMimeType: string;
}

export async function findUserAvatarById(id: number): Promise<UserAvatar | null> {
  const user = await db.orm.public.User.select("avatarBase64", "avatarMimeType").first({ id });
  if (!user?.avatarBase64 || !user.avatarMimeType) return null;
  return { avatarBase64: user.avatarBase64, avatarMimeType: user.avatarMimeType };
}
