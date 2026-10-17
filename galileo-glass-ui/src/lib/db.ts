import { Pool } from "pg";
const globalDb = globalThis as unknown as { pool?: Pool };
export const db =
  globalDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 4000,
    statement_timeout: 5000,
  });
if (process.env.NODE_ENV !== "production") globalDb.pool = db;
