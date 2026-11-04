import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { env } from "../lib/env";

async function main() {
  const sql = await fs.readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined
  });
  try {
    await pool.query(sql);
    console.log("Database initialized.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
