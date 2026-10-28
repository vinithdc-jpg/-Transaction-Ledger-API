import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
  }

  if (!url.hostname || !url.username || !url.password || !url.pathname.slice(1)) {
    throw new Error("DATABASE_URL must include a host, credentials, and database name");
  }

  return value;
}

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});
