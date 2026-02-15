import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";

export const dynamic = "force-dynamic";
import { projects, uploads, materials, elements, elementMaterials } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Zod schema — runtime validation for client-supplied parseResult
// ---------------------------------------------------------------------------

const materialLayerSchema = z.object({
  name: z.string().min(1),
  volume: z.number(),
  fraction: z.number(),
  thickness: z.number().optional(),
});

const elementSchema = z.object({
  guid: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  loadBearing: z.boolean().optional().default(false),
  isExternal: z.boolean().optional().default(false),
  classification: z
    .object({
      system: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  materials: z.array(materialLayerSchema),
  totalVolume: z.number().optional().default(0),
});

const parseResultSchema = z.object({
  elements: z.array(elementSchema),
  materials: z.array(
    z.object({
      name: z.string().min(1),
      totalVolume: z.number(),
      elementCount: z.number().optional(),
      elementTypes: z.array(z.string()).optional(),
    })
  ),
  projectInfo: z
    .object({
      name: z.string().optional(),
      schema: z.string().optional(),
    })
    .optional(),
  storeys: z
    .array(
      z.object({
        guid: z.string(),
        name: z.string(),
        elevation: z.number(),
      })
    )
    .optional(),
  stats: z.object({
    parseTimeMs: z.number(),
    elementCount: z.number(),
    materialCount: z.number(),
    fileSizeBytes: z.number(),
  }),
});

type ValidatedParseResult = z.infer<typeof parseResultSchema>;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const filename = body.filename as string | undefined;
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : undefined;

  if (!filename || !body.parseResult) {
    return NextResponse.json(
      { error: "filename and parseResult are required" },
      { status: 400 }
    );
  }

  // Validate with Zod
  let parseResult: ValidatedParseResult;
  try {
    parseResult = parseResultSchema.parse(body.parseResult);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parseResult", details: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid parseResult JSON" },
      { status: 400 }
    );
  }

  // Create upload record
  const uploadId = nanoid();
  await db.insert(uploads).values({
    id: uploadId,
    projectId,
    userId,
    filename,
    fileSize: fileSize ?? parseResult.stats.fileSizeBytes,
    status: "processing",
    elementCount: parseResult.stats.elementCount,
    materialCount: parseResult.stats.materialCount,
  });

  try {
    // Run all inserts inside a transaction for atomicity
    await db.transaction(async (tx) => {
      const BATCH_SIZE = 100;

      // Batch upsert materials (uses unique index on projectId + name)
      for (let i = 0; i < parseResult.materials.length; i += BATCH_SIZE) {
        const batch = parseResult.materials.slice(i, i + BATCH_SIZE);
        const rows = batch.map((mat) => ({
          id: nanoid(),
          projectId,
          name: mat.name,
          totalVolume: mat.totalVolume,
        }));

        await tx
          .insert(materials)
          .values(rows)
          .onConflictDoUpdate({
            target: [materials.projectId, materials.name],
            set: {
              totalVolume: sql`excluded.total_volume`,
              updatedAt: new Date(),
            },
          });
      }

      // Re-fetch material IDs (ON CONFLICT may have kept existing IDs)
      const existingMats = await tx
        .select({ id: materials.id, name: materials.name })
        .from(materials)
        .where(eq(materials.projectId, projectId));

      const materialIdMap = new Map<string, string>();
      for (const m of existingMats) {
        materialIdMap.set(m.name, m.id);
      }

      // Batch upsert elements (uses unique index on projectId + guid)
      for (let i = 0; i < parseResult.elements.length; i += BATCH_SIZE) {
        const batch = parseResult.elements.slice(i, i + BATCH_SIZE);
        const rows = batch.map((el) => ({
          id: nanoid(),
          projectId,
          uploadId,
          guid: el.guid,
          name: el.name,
          type: el.type,
          isLoadBearing: el.loadBearing,
          isExternal: el.isExternal,
          classificationSystem: el.classification?.system,
          classificationCode: el.classification?.code,
          classificationName: el.classification?.name,
        }));

        await tx
          .insert(elements)
          .values(rows)
          .onConflictDoUpdate({
            target: [elements.projectId, elements.guid],
            set: {
              name: sql`excluded.name`,
              type: sql`excluded.type`,
              uploadId: sql`excluded.upload_id`,
              isLoadBearing: sql`excluded.is_load_bearing`,
              isExternal: sql`excluded.is_external`,
              classificationSystem: sql`excluded.classification_system`,
              classificationCode: sql`excluded.classification_code`,
              classificationName: sql`excluded.classification_name`,
            },
          });
      }

      // Re-fetch element IDs
      const existingEls = await tx
        .select({ id: elements.id, guid: elements.guid })
        .from(elements)
        .where(eq(elements.projectId, projectId));

      const elementIdMap = new Map<string, string>();
      for (const e of existingEls) {
        elementIdMap.set(e.guid, e.id);
      }

      // Batch insert element-material junctions
      const junctionRows: Array<{
        id: string;
        elementId: string;
        materialId: string;
        volume: number;
        fraction: number;
        thickness?: number;
      }> = [];

      for (const el of parseResult.elements) {
        const elementId = elementIdMap.get(el.guid);
        if (!elementId) continue;

        for (const mat of el.materials) {
          const materialId = materialIdMap.get(mat.name);
          if (!materialId) continue;

          junctionRows.push({
            id: nanoid(),
            elementId,
            materialId,
            volume: mat.volume,
            fraction: mat.fraction,
            thickness: mat.thickness,
          });
        }
      }

      for (let i = 0; i < junctionRows.length; i += BATCH_SIZE) {
        const batch = junctionRows.slice(i, i + BATCH_SIZE);
        await tx.insert(elementMaterials).values(batch);
      }
    });

    // Mark upload as complete
    await db
      .update(uploads)
      .set({ status: "completed" })
      .where(eq(uploads.id, uploadId));

    return NextResponse.json({
      uploadId,
      elementCount: parseResult.stats.elementCount,
      materialCount: parseResult.stats.materialCount,
    });
  } catch (err) {
    await db
      .update(uploads)
      .set({ status: "failed" })
      .where(eq(uploads.id, uploadId));

    return NextResponse.json(
      {
        error: "Upload processing failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
