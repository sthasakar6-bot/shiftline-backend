import app from "./app";
import { runNoShowCheck } from "./modules/shift/noShowService";

const PORT = process.env.PORT || 3000;
const NO_SHOW_CHECK_INTERVAL_MS = 30 * 1000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

setInterval(() => {
  runNoShowCheck().catch((err) => console.error("No-show check failed:", err));
}, NO_SHOW_CHECK_INTERVAL_MS);
