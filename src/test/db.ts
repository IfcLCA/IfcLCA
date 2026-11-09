import { readFileSync } from "node:fs";
import path from "node:path";
import type { KbobApiResponse } from "@/types/kbob-api";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

// Must run before lib/db creates its client (it is lazy, so import order is enough).
if (hasTestDb) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export async function resetDb() {
  const { db } = await import("@/lib/db");
  await db.$executeRawUnsafe(
    `TRUNCATE element_materials, elements, materials, uploads, material_deletions, projects, kbob_materials CASCADE`
  );
}

export function kbobFixture(): KbobApiResponse {
  return JSON.parse(
    readFileSync(path.resolve(__dirname, "../../scripts/fixtures/kbob-sample.json"), "utf8")
  );
}

export const CONCRETE = "00000000-0000-4000-8000-000000000001";
export const TIMBER = "00000000-0000-4000-8000-000000000002";
