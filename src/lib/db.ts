import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_PRISMA_URL;
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
  maxRetries: 3,
});

const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter: new PrismaNeon(pool),
    log: ["query", "error", "warn"],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export type { PrismaClient } from "@prisma/client";
