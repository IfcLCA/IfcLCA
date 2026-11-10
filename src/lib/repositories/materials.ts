/**
 * Project materials and their KBOB matches. A material is one name inside
 * one project; matching sets its KBOB entry and density.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { getKbobMaterial, toKbobDto, usableKbobWhere } from "./kbob";
import { requireProject } from "./projects";

type Tx = Prisma.TransactionClient;

/** Materials library: every material across the user's projects. */
export async function listUserMaterials(userId: string) {
  const [materials, volumes] = await Promise.all([
    db.material.findMany({
      where: { project: { userId } },
      include: { kbob: true },
      orderBy: { name: "asc" },
    }),
    db.elementMaterial.groupBy({
      by: ["materialId"],
      where: { material: { project: { userId } } },
      _sum: { volume: true },
    }),
  ]);
  const volumeById = new Map(volumes.map((v) => [v.materialId, v._sum.volume ?? 0]));
  return materials.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    volume: volumeById.get(m.id) ?? 0,
    density: m.density,
    projectId: m.projectId,
    kbobMatchId: m.kbobId ?? undefined,
    // Same DTO as everywhere else: the library reads it with getGWP().
    kbobMatch: m.kbob ? toKbobDto(m.kbob) : undefined,
  }));
}

export async function listProjectsWithMaterialIds(userId: string) {
  const projects = await db.project.findMany({
    where: { userId },
    select: { id: true, name: true, materials: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
  return projects.map((p) => ({ id: p.id, name: p.name, materialIds: p.materials.map((m) => m.id) }));
}

async function requireOwnedMaterialIds(userId: string, materialIds: string[]) {
  const unique = [...new Set(materialIds)];
  const owned = await db.material.count({ where: { id: { in: unique }, project: { userId } } });
  if (owned !== unique.length) throw new NotFoundError("Material");
  return unique;
}

export const matchInput = z.object({
  materialIds: z.array(z.string().min(1)).min(1),
  kbobMaterialId: z.string().min(1),
  density: z.number().positive().nullish(),
});

/** Links materials to a KBOB entry. Density: the user's value, else KBOB's. */
export async function matchMaterials(userId: string, input: z.infer<typeof matchInput>) {
  const materialIds = await requireOwnedMaterialIds(userId, input.materialIds);
  const kbob = await getKbobMaterial(input.kbobMaterialId);
  const density = input.density ?? kbob.density;
  if (!density || density <= 0) {
    throw new BadRequestError(`KBOB material "${kbob.nameDE}" has no density; enter one to match it`);
  }
  const { count } = await db.material.updateMany({
    where: { id: { in: materialIds } },
    data: { kbobId: kbob.id, density },
  });
  return { message: "Materials matched", totalModified: count };
}

export const elementCountsInput = z.object({ materialIds: z.array(z.string()) });

export async function countElementsPerMaterial(userId: string, materialIds: string[]) {
  const unique = [...new Set(materialIds)];
  const rows = await db.elementMaterial.groupBy({
    by: ["materialId"],
    where: { materialId: { in: unique }, material: { project: { userId } } },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [r.materialId, r._count._all]));
  return Object.fromEntries(unique.map((id) => [id, counts.get(id) ?? 0]));
}

/** Removes the material and its layers, and logs it for the activity feed. */
export async function deleteMaterial(userId: string, materialId: string) {
  const material = await db.material.findFirst({ where: { id: materialId, project: { userId } } });
  if (!material) throw new NotFoundError("Material");
  await db.$transaction([
    db.material.delete({ where: { id: materialId } }),
    db.materialDeletion.create({
      data: {
        projectId: material.projectId,
        userId,
        materialName: material.name,
        reason: "Material deleted by user",
      },
    }),
  ]);
}

export const knownMatchesInput = z.object({
  projectId: z.string().min(1),
  materialNames: z.array(z.string()),
});

/**
 * Before an upload is stored: reuse matches the user already made for the
 * same material name (case ignored) in any of their projects. A material
 * this project has already matched keeps its match. Returns the names that
 * still need matching, so the UI can send the user to the materials library.
 */
export async function applyKnownMatches(userId: string, projectId: string, materialNames: string[]) {
  await requireProject(userId, projectId);
  // Keep the parser's exact names: ingestUpload stores materials under them.
  const names = [...new Set(materialNames.filter((n) => n.trim()))];
  if (names.length === 0) return { unmatchedMaterials: [], matchedMaterials: [], unmatchedCount: 0 };
  const nameSet = new Set(names);
  const key = (name: string) => name.toLowerCase();

  const alreadyMatched = (
    await db.material.findMany({
      where: { projectId, name: { in: names }, kbobId: { not: null } },
      select: { name: true },
    })
  ).map((m) => m.name);
  const matchedSet = new Set(alreadyMatched);
  const open = names.filter((n) => !matchedSet.has(n));

  const previous = open.length
    ? await db.material.findMany({
        where: {
          project: { userId },
          kbobId: { not: null },
          OR: open.map((n) => ({ name: { equals: n, mode: "insensitive" as const } })),
        },
        orderBy: { updatedAt: "desc" },
        select: { name: true, kbobId: true, density: true },
      })
    : [];
  // Prefer an exact-case match, then the most recent one (sort is stable).
  const exactFirst = [...previous].sort(
    (a, b) => Number(nameSet.has(b.name)) - Number(nameSet.has(a.name))
  );
  const known = new Map<string, { kbobId: string; density: number | null }>();
  for (const p of exactFirst) {
    if (!known.has(key(p.name))) known.set(key(p.name), { kbobId: p.kbobId!, density: p.density });
  }

  const toApply = open.filter((n) => known.has(key(n)));
  const unmatched = open.filter((n) => !known.has(key(n)));
  // A batch transaction: atomic and on one connection. Its timeout comes from
  // transactionOptions in src/lib/db.ts.
  if (toApply.length > 0) {
    await db.$transaction(
      toApply.map((name) => {
        const match = known.get(key(name))!;
        return db.material.upsert({
          where: { projectId_name: { projectId, name } },
          create: { projectId, name, ...match },
          update: match,
        });
      })
    );
  }
  return {
    unmatchedMaterials: unmatched,
    matchedMaterials: [...alreadyMatched, ...toApply],
    unmatchedCount: unmatched.length,
  };
}

/**
 * During an upload: match still-unmatched materials whose name equals a
 * usable KBOB name (case-insensitive, exact case preferred). Returns how
 * many were matched.
 */
export async function autoMatchByKbobName(tx: Tx, materials: Array<{ id: string; name: string }>) {
  if (materials.length === 0) return 0;
  const candidates = await tx.kbobMaterial.findMany({
    where: {
      ...usableKbobWhere,
      OR: materials.map((m) => ({ nameDE: { equals: m.name.trim(), mode: "insensitive" as const } })),
    },
  });
  let matched = 0;
  for (const material of materials) {
    const name = material.name.trim();
    const usable = candidates.filter((k) => k.nameDE.toLowerCase() === name.toLowerCase());
    const best = usable.find((k) => k.nameDE === name) ?? usable[0];
    if (!best) continue;
    await tx.material.update({
      where: { id: material.id },
      data: { kbobId: best.id, density: best.density },
    });
    matched++;
  }
  return matched;
}
