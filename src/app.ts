import express from "express";
import cors from "cors";
import userRoutes from "./modules/user/routes";
import identityRoutes from "./modules/identity/routes";
import contractRoutes from "./modules/contract/routes";
import shiftRoutes from "./modules/shift/routes";
import attendanceRoutes from "./modules/attendance/routes";
import notificationRoutes from "./modules/notifications/routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { env } from "./config/env";

const app = express();

// CORS_ORIGIN unset -> reflect any request origin (fine for local dev).
// Set CORS_ORIGIN (comma-separated) once a real frontend exists, to restrict it.
const allowedOrigins = env.corsOrigin ? env.corsOrigin.split(",").map((o) => o.trim()) : true;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use("/api", userRoutes);
app.use("/api", identityRoutes);
app.use("/api", contractRoutes);
app.use("/api", shiftRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
