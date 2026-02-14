import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { projects, uploads, materials, elements, elementMaterials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { IFCParseResult } from "@/types/ifc";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const parseResultJson = formData.get("parseResult") as string | null;

  if (!file || !parseResultJson) {
    return NextResponse.json(
      { error: "File and parseResult are required" },
      { status: 400 }
    );
  }

  let parseResult: IFCParseResult;
  try {
    parseResult = JSON.parse(parseResultJson);
  } catch {
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
    filename: file.name,
    fileSize: file.size,
    status: "processing",
    elementCount: parseResult.stats.elementCount,
    materialCount: parseResult.stats.materialCount,
  });

  try {
    // Upsert materials (unique per project + name)
    const materialIdMap = new Map<string, string>();

    for (const mat of parseResult.materials) {
      const matId = nanoid();
      materialIdMap.set(mat.name, matId);

      // Check if material already exists for this project
      const [existing] = await db
        .select({ id: materials.id })
        .from(materials)
        .where(
          and(eq(materials.projectId, projectId), eq(materials.name, mat.name))
        )
        .limit(1);

      if (existing) {
        materialIdMap.set(mat.name, existing.id);
        await db
          .update(materials)
          .set({
            totalVolume: mat.totalVolume,
            updatedAt: new Date(),
          })
          .where(eq(materials.id, existing.id));
      } else {
        await db.insert(materials).values({
          id: matId,
          projectId,
          name: mat.name,
          totalVolume: mat.totalVolume,
        });
      }
    }

    // Insert elements + element-material junctions
    for (const el of parseResult.elements) {
      const elementId = nanoid();

      await db.insert(elements).values({
        id: elementId,
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
      });

      for (const mat of el.materials) {
        const materialId = materialIdMap.get(mat.name);
        if (!materialId) continue;

        await db.insert(elementMaterials).values({
          id: nanoid(),
          elementId,
          materialId,
          volume: mat.volume,
          fraction: mat.fraction,
          thickness: mat.thickness,
        });
      }
    }

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
