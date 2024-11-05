import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaNeon(pool);
export const prisma = new PrismaClient({ adapter });

export type { PrismaClient } from "@prisma/client";
