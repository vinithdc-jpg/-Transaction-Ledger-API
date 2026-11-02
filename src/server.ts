import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authConfiguration } from "./config/auth";
import { pool } from "./config/database";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import accountRoutes from "./routes/accounts.routes";
import transactionRoutes from "./routes/transactions.routes";
import transferRoutes from "./routes/transfers.routes";
import {
  requireAuth,
  requireRequestHeader,
} from "./middleware/auth.middleware";
import type { ErrorRequestHandler } from "express";

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
}

app.use(express.json());
app.use(cookieParser());
app.use("/api", requireRequestHeader);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/accounts", requireAuth);
app.use("/api/accounts", accountRoutes);
app.use("/api/accounts", transactionRoutes);
app.use("/api/transfers", requireAuth);
app.use("/api/transfers", transferRoutes);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      success: true,
      message: "API and database are running",
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    res.status(503).json({
      success: false,
      message: "Database connection unavailable",
    });
  }
});

const handleRequestError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({ success: false, message: "Invalid JSON request body" });
    return;
  }
  console.error(
    "Unhandled API request error:",
    error instanceof Error ? error.message : "Unknown request error",
  );
  res.status(500).json({ success: false, message: "Unexpected API error" });
};

app.use(handleRequestError);

authConfiguration();

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
