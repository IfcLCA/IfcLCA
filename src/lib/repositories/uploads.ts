/**
 * IFC uploads. The browser parses the IFC file (IfcOpenShell in Pyodide) and
 * posts the elements; ingestUpload() stores them with their material layers.
 */
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { BadRequestError, HttpError, NotFoundError } from "@/lib/errors";
import { requireProject } from "./projects";
import { autoMatchByKbobName } from "./materials";

const CHUNK = 1000;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function createUpload(userId: string, projectId: string, filename: string) {
  await requireProject(userId, projectId);
  const upload = await db.upload.create({
    data: { projectId, userId, filename: filename || "Unnamed File" },
  });
  return { success: true, uploadId: upload.id, status: upload.status, filename: upload.filename };
}

// Bounded so emission sums (volume x density x indicator) stay finite in float8.
const finiteNumber = z.preprocess(
  (v) => (typeof v === "string" ? Number(v) : v),
  z.number().finite().min(-1e9).max(1e9)
);

// Postgres text rejects NUL, and a lone UTF-16 surrogate is stored as U+FFFD,
// which would no longer match the name the element layers refer to.
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.toWellFormed().replaceAll("\0", ""));
const NAME = 1000;

export const ingestInput = z.object({
  uploadId: z.string().min(1),
  elements: z.array(
    z.object({
      globalId: text(255).pipe(z.string().min(1)),
      type: text(NAME).default("Unknown"),
      name: text(NAME).nullish(),
      volume: finiteNumber.nullish(),
      properties: z
        .object({ loadBearing: z.boolean().nullish(), isExternal: z.boolean().nullish() })
        .nullish(),
      classification: z
        .object({ system: text(NAME), code: text(NAME).nullish(), name: text(NAME).nullish() })
        .nullish(),
      materials: z.array(z.object({ name: text(NAME), volume: finiteNumber.nullish() })).nullish(),
      materialLayers: z
        .object({
          layers: z.array(
            z.object({
              materialName: text(NAME),
              volume: finiteNumber.nullish(),
              fraction: finiteNumber.nullish(),
            })
          ),
        })
        .nullish(),
    })
  ),
});

export type IngestElement = z.infer<typeof ingestInput>["elements"][number];

interface NormalizedLayer {
  materialName: string;
  volume: number;
  fraction: number | null;
}

/**
 * Material layers of one element. Layer sets win over plain material lists
 * (the parser reports both for layered elements). A layer without its own
 * volume gets an equal share of what the specified layers leave over.
 */
export function normalizeLayers(element: IngestElement): NormalizedLayer[] {
  const layers = element.materialLayers?.layers ?? [];
  if (layers.length > 0) {
    const total = Math.max(element.volume ?? 0, 0);
    const specified = layers.reduce((sum, l) => sum + (l.volume ?? 0), 0);
    const unspecifiedCount = layers.filter((l) => l.volume == null).length;
    const share = unspecifiedCount > 0 ? Math.max(total - specified, 0) / unspecifiedCount : 0;
    return layers.map((l) => ({
      materialName: l.materialName,
      volume: Math.max(l.volume ?? share, 0),
      fraction: l.fraction ?? null,
    }));
  }
  return (element.materials ?? []).map((m) => ({
    materialName: m.name,
    volume: Math.max(m.volume ?? 0, 0),
    fraction: null,
  }));
}

/**
 * Stores parsed elements for an upload. Re-uploading a model replaces
 * elements with the same GUID. On failure the upload is marked Failed with
 * the reason, so the history shows it instead of "Processing" forever.
 */
export async function ingestUpload(
  userId: string,
  projectId: string,
  input: z.infer<typeof ingestInput>
) {
  await requireProject(userId, projectId);
  const upload = await db.upload.findFirst({ where: { id: input.uploadId, projectId } });
  if (!upload) throw new NotFoundError("Upload");
  // Last occurrence wins if the parser reports a GUID twice.
  const byGuid = new Map(input.elements.map((e) => [e.globalId, e]));
  const elements = [...byGuid.values()].map((e) => ({ element: e, layers: normalizeLayers(e) }));
  const materialNames = [...new Set(elements.flatMap((e) => e.layers.map((l) => l.materialName)))];

  try {
    if (elements.length === 0) throw new BadRequestError("The upload contains no elements");
    const result = await db.$transaction(
      async (tx) => {
        await tx.material.createMany({
          data: materialNames.map((name) => ({ projectId, name })),
          skipDuplicates: true,
        });
        const materials = await tx.material.findMany({
          where: { projectId, name: { in: materialNames } },
          select: { id: true, name: true, kbobId: true },
        });
        const materialIdByName = new Map(materials.map((m) => [m.name, m.id]));
        const matched = await autoMatchByKbobName(
          tx,
          materials.filter((m) => !m.kbobId)
        );

        await tx.element.deleteMany({ where: { projectId, guid: { in: [...byGuid.keys()] } } });

        const elementRows = elements.map(({ element }) => ({
          id: randomUUID(),
          projectId,
          uploadId: upload.id,
          guid: element.globalId,
          name: element.name || element.type,
          type: element.type,
          volume: Math.max(element.volume ?? 0, 0),
          loadBearing: element.properties?.loadBearing ?? false,
          isExternal: element.properties?.isExternal ?? false,
          classificationSystem: element.classification?.system ?? null,
          classificationCode: element.classification?.code ?? null,
          classificationName: element.classification?.name ?? null,
        }));
        const layerRows = elements.flatMap(({ layers }, i) =>
          layers.map((layer) => ({
            elementId: elementRows[i].id,
            materialId: materialIdByName.get(layer.materialName)!,
            volume: layer.volume,
            fraction: layer.fraction,
          }))
        );
        for (const part of chunks(elementRows)) await tx.element.createMany({ data: part });
        for (const part of chunks(layerRows)) await tx.elementMaterial.createMany({ data: part });

        await tx.upload.update({
          where: { id: upload.id },
          data: {
            status: "Completed",
            elementCount: elementRows.length,
            materialCount: materialNames.length,
            error: null,
          },
        });
        return { elementCount: elementRows.length, materialCount: materialNames.length, autoMatched: matched };
      },
      { timeout: 120_000, maxWait: 10_000 }
    );
    return { success: true, shouldRedirectToLibrary: true, ...result };
  } catch (error) {
    await markUploadFailed(userId, projectId, upload.id, error);
    throw error;
  }
}

/**
 * Marks a still-processing upload as failed. Only client errors keep their
 * message; anything else (Prisma, Postgres) would leak internals to the UI.
 */
export async function markUploadFailed(
  userId: string,
  projectId: string,
  uploadId: unknown,
  error: unknown
) {
  if (typeof uploadId !== "string" || !uploadId) return;
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof ZodError
        ? "The uploaded model data is invalid"
        : "Saving the upload failed";
  await db.upload
    .updateMany({
      where: { id: uploadId, projectId, project: { userId }, status: "Processing" },
      data: { status: "Failed", error: message },
    })
    .catch(() => {});
}

async function requireUpload(userId: string, uploadId: string) {
  const upload = await db.upload.findFirst({ where: { id: uploadId, project: { userId } } });
  if (!upload) throw new NotFoundError("Upload");
  return upload;
}

/** Materials used by this upload and by no element from anywhere else. */
function orphanedByUploadWhere(projectId: string, uploadId: string) {
  return {
    projectId,
    layers: {
      some: { element: { uploadId } },
      none: { element: { OR: [{ uploadId: null }, { uploadId: { not: uploadId } }] } },
    },
  };
}

export async function getUploadImpact(userId: string, uploadId: string) {
  const upload = await requireUpload(userId, uploadId);
  const [elementsToDelete, materials] = await Promise.all([
    db.element.count({ where: { uploadId } }),
    db.material.findMany({
      where: orphanedByUploadWhere(upload.projectId, uploadId),
      select: { name: true },
    }),
  ]);
  return {
    upload: {
      id: upload.id,
      filename: upload.filename,
      createdAt: upload.createdAt,
      elementCount: upload.elementCount,
    },
    impact: {
      elementsToDelete,
      materialsToDelete: materials.length,
      materialNames: materials.map((m) => m.name),
    },
  };
}

export async function deleteUpload(userId: string, uploadId: string) {
  const upload = await requireUpload(userId, uploadId);
  return db.$transaction(async (tx) => {
    const orphanIds = (
      await tx.material.findMany({
        where: orphanedByUploadWhere(upload.projectId, uploadId),
        select: { id: true },
      })
    ).map((m) => m.id);
    const elementsDeleted = await tx.element.count({ where: { uploadId } });
    // Elements and their layers go with the upload (FK cascade).
    await tx.upload.delete({ where: { id: uploadId } });
    const { count: materialsDeleted } = await tx.material.deleteMany({
      where: { id: { in: orphanIds } },
    });
    return { success: true, elementsDeleted, materialsDeleted };
  });
}
