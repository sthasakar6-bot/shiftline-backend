import app from "./app";
import { runNoShowCheck, runMissedClockOutCheck } from "./modules/shift/noShowService";
import { runScheduledBackups } from "./modules/backup/service";

const PORT = process.env.PORT || 3000;
const ATTENDANCE_CHECK_INTERVAL_MS = 30 * 1000;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

setInterval(() => {
  runNoShowCheck().catch((err) => console.error("No-show check failed:", err));
  runMissedClockOutCheck().catch((err) => console.error("Missed clock-out check failed:", err));
}, ATTENDANCE_CHECK_INTERVAL_MS);

// Runs server-side so backups keep happening even when no manager's own
// computer is on to run their scheduled script.
setInterval(() => {
  runScheduledBackups().catch((err) => console.error("Scheduled backup failed:", err));
}, BACKUP_INTERVAL_MS);
