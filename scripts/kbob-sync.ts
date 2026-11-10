/**
 * Refresh the KBOB cache.
 *
 *   npm run kbob:sync                      # from lcadata.ch (needs KBOB_API_KEY)
 *   npm run kbob:sync -- --file data.json  # from a saved API response
 *
 * Uses DATABASE_URL from .env.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { saveKbobResponse, syncKbob } from "../src/lib/kbob/sync";
import type { KbobApiResponse } from "../src/types/kbob-api";

async function main() {
  const fileFlag = process.argv.indexOf("--file");
  const result =
    fileFlag === -1
      ? await syncKbob(db)
      : await saveKbobResponse(
          db,
          JSON.parse(await readFile(process.argv[fileFlag + 1], "utf8")) as KbobApiResponse
        );
  console.log(`KBOB sync: ${result.synced} materials (version ${result.version}), ${result.skipped} skipped`);
}

main()
  .catch((error) => {
    console.error("KBOB sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
