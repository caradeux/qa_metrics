import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { logger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import cyclesRoutes from "./routes/cycles.routes.js";
import testersRoutes from "./routes/testers.routes.js";
import usersRoutes from "./routes/users.routes.js";
import rolesRoutes from "./routes/roles.routes.js";
import assignmentsRoutes from "./routes/assignments.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import holidaysRoutes from "./routes/holidays.routes.js";
import dailyRecordsRoutes from "./routes/daily-records.routes.js";
import recordsRoutes from "./routes/records.routes.js";
import clientReportsRoutes from "./routes/client-reports.routes.js";
import storiesRoutes from "./routes/stories.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import internalRoutes from "./routes/internal.routes.js";
import activityCategoriesRoutes from "./routes/activity-categories.routes.js";
import activitiesRoutes from "./routes/activities.routes.js";

const app = express();

// CORS must be BEFORE helmet to handle preflight correctly
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Helmet with cross-origin policies relaxed for API
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Rate limiting
const isDevOrTest = env.NODE_ENV !== "production";
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: isDevOrTest ? 5000 : 200 }));
app.use(
  "/api/auth/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: isDevOrTest ? 500 : 10 })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/cycles", cyclesRoutes);
app.use("/api/testers", testersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/reports", clientReportsRoutes);
app.use("/api/holidays", holidaysRoutes);
app.use("/api/daily-records", dailyRecordsRoutes);
app.use("/api/records", recordsRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api", storiesRoutes);
app.use("/api/date-change-logs", auditRoutes);
app.use("/api/activity-categories", activityCategoriesRoutes);
app.use("/api/activities", activitiesRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`API running on port ${env.PORT}`);
});

export default app;













