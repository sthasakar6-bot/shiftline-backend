import app from "./app";
import { runNoShowCheck, runMissedClockOutCheck } from "./modules/shift/noShowService";

const PORT = process.env.PORT || 3000;
const ATTENDANCE_CHECK_INTERVAL_MS = 30 * 1000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

setInterval(() => {
  runNoShowCheck().catch((err) => console.error("No-show check failed:", err));
  runMissedClockOutCheck().catch((err) => console.error("Missed clock-out check failed:", err));
}, ATTENDANCE_CHECK_INTERVAL_MS);
