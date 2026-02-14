/**
 * Turso database client singleton.
 *
 * Uses @libsql/client for Turso connection and drizzle-orm for queries.
 * Connection is reused across requests in serverless environments.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
