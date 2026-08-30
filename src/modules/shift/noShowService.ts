import { findShiftsPendingNoShowCheck, markShiftNoShowChecked } from "./model";
import { findOpenAttendanceForShift } from "../attendance/model";
import { findUserById } from "../identity/model";
import { notify } from "../notifications/service";

const GRACE_PERIOD_MS = 60 * 1000;

export async function runNoShowCheck(): Promise<void> {
  const pending = await findShiftsPendingNoShowCheck();
  const now = Date.now();

  for (const shift of pending) {
    const dueAt = new Date(shift.startsAt).getTime() + GRACE_PERIOD_MS;
    if (now < dueAt) continue;

    const attendance = await findOpenAttendanceForShift(shift.id, shift.userId);
    if (!attendance) {
      const user = await findUserById(shift.userId);
      if (user) {
        await notify(
          user.id,
          "You haven't clocked in for your scheduled shift yet. Tap to clock in.",
          "Missed Clock-In",
          "/?tab=attendance",
        );
        if (user.managerId) {
          await notify(
            user.managerId,
            `${user.name} hasn't clocked in for their scheduled shift.`,
            "Missed Clock-In",
            "/admin?tab=attendance",
          );
        }
      }
    }

    await markShiftNoShowChecked(shift.id);
  }
}
