import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { authenticateUser } from "./auth/rbac.middleware.js";

import authRouter from "./auth/auth.routes.js";
import ingestionRouter from "./modules/ingestion/index.js";
import profileRouter from "./modules/profile/index.js";
import scoringRouter from "./modules/scoring/index.js";
import trendsRouter from "./modules/trends/index.js";
import alertsRouter from "./modules/alerts/index.js";
import interventionsRouter from "./modules/interventions/index.js";
import analyticsRouter from "./modules/analytics/index.js";
import adminRouter from "./modules/admin/index.js";

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/academic_risk_radar";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(authenticateUser);

// Mount Authentication & Module API Routers
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", ingestionRouter);
app.use("/api/v1", profileRouter);
app.use("/api/v1", scoringRouter);
app.use("/api/v1", trendsRouter);
app.use("/api/v1", alertsRouter);
app.use("/api/v1", interventionsRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1/admin", adminRouter);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log(`Connected to MongoDB at ${MONGO_URI}`);
      app.listen(PORT, () => {
        console.log(`Academic Risk Radar API Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB Connection Error:", err);
    });
}

export default app;
