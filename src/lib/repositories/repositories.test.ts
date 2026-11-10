import { beforeEach, describe, expect, it } from "vitest";
import { CONCRETE, TIMBER, hasTestDb, kbobFixture, resetDb } from "@/test/db";
import { ForbiddenError, NotFoundError, UnavailableError } from "@/lib/errors";
import { normalizeLayers, type IngestElement } from "./uploads";

const ALICE = "user_alice";
const BOB = "user_bob";

describe("normalizeLayers", () => {
  const element = (over: Partial<IngestElement>): IngestElement => ({
    globalId: "g",
    type: "IfcWall",
    ...over,
  });

  it("prefers layer sets and shares the leftover volume across layers without one", () => {
    const layers = normalizeLayers(
      element({
        volume: 10,
        materials: [{ name: "ignored", volume: 10 }],
        materialLayers: {
          layers: [
            { materialName: "A", volume: 4 },
            { materialName: "B" },
            { materialName: "C" },
          ],
        },
      })
    );
    expect(layers.map((l) => [l.materialName, l.volume])).toEqual([
      ["A", 4],
      ["B", 3],
      ["C", 3],
    ]);
  });

  it("falls back to the plain material list", () => {
    expect(normalizeLayers(element({ materials: [{ name: "A", volume: 2 }] }))).toEqual([
      { materialName: "A", volume: 2, fraction: null },
    ]);
  });
});

describe.skipIf(!hasTestDb)("repositories against Postgres", () => {
  beforeEach(async () => {
    await resetDb();
    const { db } = await import("@/lib/db");
    const { saveKbobResponse } = await import("@/lib/kbob/sync");
    await saveKbobResponse(db, kbobFixture());
  });

  async function repos() {
    return {
      projects: await import("./projects"),
      uploads: await import("./uploads"),
      materials: await import("./materials"),
      kbob: await import("./kbob"),
      dashboard: await import("./dashboard"),
      emissions: await import("./emissions"),
    };
  }

  /** Creates a project with one uploaded wall: 2 m³ concrete + 1 m³ "Unknown Stuff". */
  async function projectWithUpload(userId = ALICE) {
    const { projects, uploads } = await repos();
    const project = await projects.createProject(userId, { name: "House" });
    const { uploadId } = await uploads.createUpload(userId, project.id, "house.ifc");
    const result = await uploads.ingestUpload(userId, project.id, {
      uploadId,
      elements: [
        {
          globalId: "wall-1",
          type: "IfcWall",
          name: "Wall",
          volume: 3,
          classification: { system: "eBKP-H", code: "C2.1" },
          materialLayers: {
            layers: [
              { materialName: "Beton (ohne Bewehrung)", volume: 2 },
              { materialName: "Unknown Stuff", volume: 1 },
            ],
          },
        },
      ],
    });
    return { project, uploadId, result };
  }

  it("lists only usable KBOB entries, and says so when the cache is empty", async () => {
    const { kbob } = await repos();
    const list = await kbob.listUsableKbobMaterials();
    // The fixture has one entry without density and one with all-zero indicators.
    expect(list.map((k) => k._id)).not.toContain("00000000-0000-4000-8000-000000000007");
    expect(list.map((k) => k._id)).not.toContain("00000000-0000-4000-8000-000000000008");
    expect(list).toHaveLength(6);

    await resetDb();
    await expect(kbob.listUsableKbobMaterials()).rejects.toBeInstanceOf(UnavailableError);
  });

  it("enforces the project limit on the server", async () => {
    const { projects } = await repos();
    for (const name of ["A1", "B2", "C3"]) await projects.createProject(ALICE, { name });
    await expect(projects.createProject(ALICE, { name: "D4" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(projects.createProject(BOB, { name: "Bob's" })).resolves.toBeTruthy();
  });

  it("hides another user's project, upload and materials", async () => {
    const { projects, uploads, materials } = await repos();
    const { project, uploadId } = await projectWithUpload(ALICE);
    const materialId = (await materials.listUserMaterials(ALICE))[0].id;

    await expect(projects.getProjectDetail(BOB, project.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(projects.updateProject(BOB, project.id, { name: "pwned" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(projects.deleteProject(BOB, project.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(uploads.deleteUpload(BOB, uploadId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      materials.matchMaterials(BOB, { materialIds: [materialId], kbobMaterialId: TIMBER })
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(materials.deleteMaterial(BOB, materialId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await materials.listUserMaterials(BOB)).toEqual([]);
  });

  it("ingests an upload, auto-matches by KBOB name, and computes emissions", async () => {
    const { projects } = await repos();
    const { project, result } = await projectWithUpload();
    expect(result).toMatchObject({ elementCount: 1, materialCount: 2, autoMatched: 1 });

    const detail = await projects.getProjectDetail(ALICE, project.id);
    expect(detail.uploads[0]).toMatchObject({ status: "Completed", elementCount: 1 });
    const concrete = detail.materials.find((m) => m.name === "Beton (ohne Bewehrung)")!;
    expect(concrete).toMatchObject({ kbobMatchId: CONCRETE, density: 2300, volume: 2 });
    expect(detail.elements[0].classification).toEqual({ system: "eBKP-H", code: "C2.1", name: undefined });

    // 2 m³ * 2300 kg/m³ * 0.1 kg CO2-eq/kg; the unmatched layer adds nothing.
    expect(detail.emissions.gwp).toBeCloseTo(460);
    // Per-element and project totals agree on every indicator.
    expect(detail.elements[0].emissions.gwp).toBeCloseTo(460);
    expect(detail.elements[0].emissions.ubp).toBeCloseTo(detail.emissions.ubp);
    expect(detail.elements[0].emissions.penre).toBeCloseTo(2 * 2300 * 0.2);
    expect(detail.emissions.penre).toBeCloseTo(2 * 2300 * 0.2);
  });

  it("pages through elements from one upload without repeats or gaps", async () => {
    const { projects, uploads } = await repos();
    const project = await projects.createProject(ALICE, { name: "Big" });
    const { uploadId } = await uploads.createUpload(ALICE, project.id, "big.ifc");
    const guids = Array.from({ length: 7 }, (_, i) => `g${i}`);
    await uploads.ingestUpload(ALICE, project.id, {
      uploadId,
      elements: guids.map((g) => ({ globalId: g, type: "IfcWall", materials: [{ name: "Backstein", volume: 1 }] })),
    });
    const seen: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const result = await projects.listElementsPage(ALICE, project.id, page, 2);
      seen.push(...result.elements.map((e) => e.guid));
    }
    expect(seen.sort()).toEqual(guids);
  });

  it("an upload with no elements is marked Failed, not left Processing", async () => {
    const { projects, uploads } = await repos();
    const project = await projects.createProject(ALICE, { name: "Empty" });
    const { uploadId } = await uploads.createUpload(ALICE, project.id, "empty.ifc");
    await expect(uploads.ingestUpload(ALICE, project.id, { uploadId, elements: [] })).rejects.toThrow(/no elements/);
    const detail = await projects.getProjectDetail(ALICE, project.id);
    expect(detail.uploads[0].status).toBe("Failed");
  });

  it("re-uploading replaces elements with the same GUID", async () => {
    const { projects, uploads } = await repos();
    const { project } = await projectWithUpload();
    const { uploadId } = await uploads.createUpload(ALICE, project.id, "v2.ifc");
    await uploads.ingestUpload(ALICE, project.id, {
      uploadId,
      elements: [{ globalId: "wall-1", type: "IfcWall", materials: [{ name: "Brettschichtholz", volume: 1 }] }],
    });
    const detail = await projects.getProjectDetail(ALICE, project.id);
    expect(detail.elementCount).toBe(1);
    expect(detail.elements[0].materials.map((m) => m.material?.name)).toEqual(["Brettschichtholz"]);
  });

  it("matching a material changes the project totals without a recalculation step", async () => {
    const { projects, materials } = await repos();
    const { project } = await projectWithUpload();
    const unknown = (await materials.listUserMaterials(ALICE)).find((m) => m.name === "Unknown Stuff")!;

    await materials.matchMaterials(ALICE, { materialIds: [unknown.id], kbobMaterialId: TIMBER });
    const detail = await projects.getProjectDetail(ALICE, project.id);
    // + 1 m³ * 470 kg/m³ * 0.3
    expect(detail.emissions.gwp).toBeCloseTo(460 + 141);
    // The library reads indicators from kbobMatch with getGWP().
    const libraryRow = (await materials.listUserMaterials(ALICE)).find((m) => m.id === unknown.id)!;
    expect(libraryRow.kbobMatch).toMatchObject({ Name: "Brettschichtholz", gwpTotal: 0.3 });

    await materials.matchMaterials(ALICE, { materialIds: [unknown.id], kbobMaterialId: TIMBER, density: 500 });
    expect((await projects.getProjectDetail(ALICE, project.id)).emissions.gwp).toBeCloseTo(460 + 150);
  });

  it("refuses to match a KBOB entry without density unless the user gives one", async () => {
    const { materials } = await repos();
    await projectWithUpload();
    const unknown = (await materials.listUserMaterials(ALICE)).find((m) => m.name === "Unknown Stuff")!;
    const glass = "00000000-0000-4000-8000-000000000007";
    await expect(
      materials.matchMaterials(ALICE, { materialIds: [unknown.id], kbobMaterialId: glass })
    ).rejects.toThrow(/no density/);
    await expect(
      materials.matchMaterials(ALICE, { materialIds: [unknown.id], kbobMaterialId: glass, density: 2500 })
    ).resolves.toMatchObject({ totalModified: 1 });
  });

  it("reuses the user's earlier matches in a new project", async () => {
    const { projects, materials } = await repos();
    const { project } = await projectWithUpload();
    const unknown = (await materials.listUserMaterials(ALICE)).find((m) => m.name === "Unknown Stuff")!;
    await materials.matchMaterials(ALICE, { materialIds: [unknown.id], kbobMaterialId: TIMBER });

    const second = await projects.createProject(ALICE, { name: "Second" });
    const result = await materials.applyKnownMatches(ALICE, second.id, ["unknown stuff", "Brand new"]);
    expect(result).toMatchObject({ matchedMaterials: ["unknown stuff"], unmatchedMaterials: ["Brand new"] });
    expect(project.id).not.toBe(second.id);

    // The parser's exact name is kept, so the layers created later attach to it.
    const shouted = await materials.applyKnownMatches(ALICE, second.id, ["UNKNOWN STUFF"]);
    expect(shouted.matchedMaterials).toEqual(["UNKNOWN STUFF"]);
    expect((await materials.listUserMaterials(ALICE)).map((m) => m.name)).toContain("UNKNOWN STUFF");

    // A match this project already has is not overwritten by another project's.
    const concreteInFirst = (await materials.listUserMaterials(ALICE)).find(
      (m) => m.projectId === project.id && m.name === "Beton (ohne Bewehrung)"
    )!;
    await materials.matchMaterials(ALICE, { materialIds: [concreteInFirst.id], kbobMaterialId: TIMBER });
    const third = await projects.createProject(ALICE, { name: "Third" });
    const { db } = await import("@/lib/db");
    await db.material.create({
      data: { projectId: third.id, name: "Beton (ohne Bewehrung)", kbobId: CONCRETE, density: 2400 },
    });
    await materials.applyKnownMatches(ALICE, third.id, ["Beton (ohne Bewehrung)"]);
    const kept = await db.material.findFirstOrThrow({ where: { projectId: third.id } });
    expect(kept).toMatchObject({ kbobId: CONCRETE, density: 2400 });

    // Bob does not inherit Alice's matches.
    const bobs = await projects.createProject(BOB, { name: "Bob" });
    expect((await materials.applyKnownMatches(BOB, bobs.id, ["Unknown Stuff"])).unmatchedCount).toBe(1);
  });

  it("deleting an upload removes its elements and the materials only it used", async () => {
    const { projects, uploads } = await repos();
    const { project, uploadId } = await projectWithUpload();
    const impact = await uploads.getUploadImpact(ALICE, uploadId);
    expect(impact.impact).toMatchObject({ elementsToDelete: 1, materialsToDelete: 2 });

    await expect(uploads.deleteUpload(ALICE, uploadId)).resolves.toMatchObject({
      elementsDeleted: 1,
      materialsDeleted: 2,
    });
    const detail = await projects.getProjectDetail(ALICE, project.id);
    expect(detail).toMatchObject({ elementCount: 0, materialCount: 0, uploadCount: 0 });
  });

  it("marks the upload Failed when ingest fails", async () => {
    const { projects, uploads } = await repos();
    const project = await projects.createProject(ALICE, { name: "House" });
    const { uploadId } = await uploads.createUpload(ALICE, project.id, "bad.ifc");
    // Postgres rejects NUL bytes in text, which fails the insert inside the transaction.
    await expect(
      uploads.ingestUpload(ALICE, project.id, {
        uploadId,
        elements: [{ globalId: "x", type: "IfcWall", name: "bad\u0000name" }],
      })
    ).rejects.toThrow();

    const detail = await projects.getProjectDetail(ALICE, project.id);
    expect(detail.uploads[0].status).toBe("Failed");
    expect(detail.uploads[0].error).toBe("Saving the upload failed"); // no Postgres internals
    expect(detail.elementCount).toBe(0); // rolled back
  });

  it("sanitizes names and bounds volumes in the ingest payload", async () => {
    const { ingestInput } = await import("./uploads");
    const parsed = ingestInput.parse({
      uploadId: "u",
      elements: [
        { globalId: "g", name: "a\u0000b", materials: [{ name: "Beton \ud800", volume: 1 }] },
      ],
    });
    expect(parsed.elements[0].name).toBe("ab");
    expect(parsed.elements[0].materials![0].name).toBe("Beton �");
    expect(() =>
      ingestInput.parse({ uploadId: "u", elements: [{ globalId: "g", volume: 1e308 }] })
    ).toThrow();
    expect(() =>
      ingestInput.parse({ uploadId: "u", elements: [{ globalId: "g", name: "x".repeat(1001) }] })
    ).toThrow();
  });

  it("marks the upload Failed when the process route rejects the payload", async () => {
    const { projects, uploads } = await repos();
    const project = await projects.createProject(ALICE, { name: "House" });
    const { uploadId } = await uploads.createUpload(ALICE, project.id, "bad.ifc");
    // Bob cannot fail Alice's upload.
    await uploads.markUploadFailed(BOB, project.id, uploadId, new Error("x"));
    expect((await projects.getProjectDetail(ALICE, project.id)).uploads[0].status).toBe("Processing");

    const { ZodError } = await import("zod");
    await uploads.markUploadFailed(ALICE, project.id, uploadId, new ZodError([]));
    const upload = (await projects.getProjectDetail(ALICE, project.id)).uploads[0];
    expect(upload).toMatchObject({ status: "Failed", error: "The uploaded model data is invalid" });
  });

  it("builds the dashboard and activity feed from the same rows", async () => {
    const { dashboard, materials, emissions } = await repos();
    await projectWithUpload();
    const unknown = (await materials.listUserMaterials(ALICE)).find((m) => m.name === "Unknown Stuff")!;
    await materials.deleteMaterial(ALICE, unknown.id);

    const data = await dashboard.getDashboardData(ALICE);
    expect(data.stats).toMatchObject({ totalProjects: 1, totalElements: 1, totalMaterials: 1 });
    expect((await emissions.emissionsForUser(ALICE)).gwp).toBeCloseTo(460);
    expect((await emissions.emissionsForUser(BOB)).gwp).toBe(0);
    expect(data.recentActivities.map((a) => a.type).sort()).toEqual(
      ["file_uploaded", "material_deleted", "project_created"]
    );
    expect((await dashboard.getDashboardData(BOB)).stats.totalProjects).toBe(0);
  });
});
