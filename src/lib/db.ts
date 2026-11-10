import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Bound the wait for a pooled connection (pool exhausted, Neon waking up).
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10_000 });
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    // With a driver adapter even batch $transaction([...]) calls run under the
    // interactive timeout, whose 5 s default is short for a remote database.
    transactionOptions: { timeout: 30_000, maxWait: 10_000 },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// Lazy so that importing this module never needs DATABASE_URL (next build
// imports route modules without one).
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
