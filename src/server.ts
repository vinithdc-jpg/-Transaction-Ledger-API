import express from "express";
import { pool } from "./config/database";
import accountRoutes from "./routes/accounts.routes";
import transactionRoutes from "./routes/transactions.routes";
import transferRoutes from "./routes/transfers.routes";

const app = express();

app.use(express.json());
app.use("/api/accounts", accountRoutes);
app.use("/api/accounts", transactionRoutes);
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

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
