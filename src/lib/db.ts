import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

declare global {
  var prisma: PrismaClient | undefined;
}

const getPrisma = () => {
  if (globalThis.prisma) {
    return globalThis.prisma;
  }

  const connectionString = process.env.POSTGRES_PRISMA_URL!;
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    maxRetries: 3,
  });

  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prisma;
  }

  return prisma;
};

export { getPrisma };
