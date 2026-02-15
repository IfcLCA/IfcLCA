/**
 * Turso database client singleton.
 *
 * Uses @libsql/client for Turso connection and drizzle-orm for queries.
 * Connection is lazily created on first use so the build doesn't crash
 * when TURSO_DATABASE_URL isn't set (e.g. during Next.js static analysis).
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | null = null;
let database: LibSQLDatabase<typeof schema> | null = null;

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!database) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    database = drizzle(client, { schema });
  }
  return database;
}

/** Convenience alias — lazily initialized */
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Database = LibSQLDatabase<typeof schema>;
