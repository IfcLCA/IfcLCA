import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONCRETE, hasTestDb, kbobFixture, resetDb } from "@/test/db";
import { fetchKbobFromApi, saveKbobResponse, toKbobRow } from "./sync";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
  ) as unknown as typeof fetch;
}

describe("fetchKbobFromApi", () => {
  it("refuses to call the API without a key", async () => {
    const fetchImpl = fakeFetch(200, kbobFixture());
    await expect(fetchKbobFromApi({ apiKey: "  ", fetchImpl })).rejects.toThrow("KBOB_API_KEY is not set");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the key as a bearer token", async () => {
    const fetchImpl = fakeFetch(200, kbobFixture());
    const data = await fetchKbobFromApi({ apiKey: "k", baseUrl: "https://example.test", fetchImpl });
    expect(data.materials).toHaveLength(8);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://example.test/api/kbob/materials?pageSize=all");
    expect(init.headers.Authorization).toBe("Bearer k");
  });

  it("surfaces the HTTP status and body instead of returning nothing", async () => {
    const fetchImpl = fakeFetch(403, '{"error":"Invalid API key"}');
    await expect(fetchKbobFromApi({ apiKey: "bad", fetchImpl })).rejects.toThrow(
      /403.*Invalid API key/
    );
  });

  it("rejects a response without materials", async () => {
    const fetchImpl = fakeFetch(200, { success: true });
    await expect(fetchKbobFromApi({ apiKey: "k", fetchImpl })).rejects.toThrow(/no materials/);
  });
});

describe("toKbobRow", () => {
  it("parses string densities and drops '-'", () => {
    const [concrete, , , , , , glass] = kbobFixture().materials;
    const now = new Date("2026-01-01");
    expect(toKbobRow(concrete, "v1", now)).toMatchObject({
      id: CONCRETE,
      nameDE: "Beton (ohne Bewehrung)",
      density: 2300,
      penreTotal: 0.2,
      version: "v1",
      syncedAt: now,
    });
    expect(toKbobRow(glass, "v1", now).density).toBeNull();
  });
});

describe.skipIf(!hasTestDb)("saveKbobResponse", () => {
  beforeEach(resetDb);

  it("inserts, then updates in place on the next sync", async () => {
    const { db } = await import("@/lib/db");
    const first = await saveKbobResponse(db, kbobFixture());
    expect(first).toEqual({ synced: 8, skipped: 0, version: "dev-sample" });

    const next = kbobFixture();
    next.version = "v2";
    next.materials[0].gwpTotal = 0.2;
    await saveKbobResponse(db, next);

    expect(await db.kbobMaterial.count()).toBe(8);
    const concrete = await db.kbobMaterial.findUniqueOrThrow({ where: { id: CONCRETE } });
    expect(concrete).toMatchObject({ gwpTotal: 0.2, version: "v2" });
  });

  it("skips entries without uuid or name", async () => {
    const { db } = await import("@/lib/db");
    const response = kbobFixture();
    response.materials.push({ ...response.materials[0], uuid: "" });
    const result = await saveKbobResponse(db, response);
    expect(result.skipped).toBe(1);
  });

  it("keeps the last entry when a uuid repeats, and stores syncedAt exactly", async () => {
    const { db } = await import("@/lib/db");
    const now = new Date("2026-11-10T05:30:00.123Z");
    const response = kbobFixture();
    response.materials.push({ ...response.materials[0], gwpTotal: 0.3 });
    const result = await saveKbobResponse(db, response, now);

    expect(result).toMatchObject({ synced: 8, skipped: 0 });
    const concrete = await db.kbobMaterial.findUniqueOrThrow({ where: { id: CONCRETE } });
    expect(concrete.gwpTotal).toBe(0.3);
    expect(concrete.syncedAt.toISOString()).toBe(now.toISOString());
  });
});
