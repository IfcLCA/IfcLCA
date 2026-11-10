import { execSync } from "node:child_process";

/**
 * Repository tests run against a real Postgres named by TEST_DATABASE_URL
 * (never DATABASE_URL, so they cannot wipe a real database). Without it they
 * are skipped; the pure tests still run.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL not set: skipping repository tests");
    return;
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
