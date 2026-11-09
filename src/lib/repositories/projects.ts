/**
 * Projects and their read models. Every function takes the Clerk userId and
 * scopes by it; a project that belongs to someone else is NotFound.
 *
 * Responses keep the JSON shape the UI was written against (`_id`, nested
 * `kbobMatch`), so the Mongo-to-Postgres move needed no UI rewrite.
 */
import { z } from "zod";
import type { Element, ElementMaterial, KbobMaterial, Material, Project, Upload } from "@prisma/client";
import { MAX_PROJECTS_PER_USER } from "@/lib/constants/projects";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { addIndicators, layerEmissions, ZERO_INDICATORS } from "@/lib/utils/kbob-indicators";
import { emissionsByProject } from "./emissions";
import { toKbobDto } from "./kbob";


/** Above this, the detail view loads elements page by page. */
const ELEMENT_PAGE_THRESHOLD = 1000;

// ---------------------------------------------------------------- ownership

export async function requireProject(userId: string, projectId: string): Promise<Project> {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new NotFoundError("Project");
  return project;
}

// ---------------------------------------------------------------- DTOs

type MaterialWithKbob = Material & { kbob: KbobMaterial | null };

function toMaterialDto(material: MaterialWithKbob, volume = 0) {
  return {
    _id: material.id,
    id: material.id,
    name: material.name,
    category: material.category,
    density: material.density,
    projectId: material.projectId,
    kbobMatchId: material.kbobId ?? undefined,
    kbobMatch: material.kbob ? toKbobDto(material.kbob) : undefined,
    volume,
  };
}

function toElementDto(
  element: Element & { layers: ElementMaterial[] },
  materialsById: Map<string, MaterialWithKbob>
) {
  let emissions = { ...ZERO_INDICATORS };
  const materials = element.layers.map((layer) => {
    const material = materialsById.get(layer.materialId);
    emissions = addIndicators(emissions, layerEmissions(layer.volume, material?.density, material?.kbob));
    return {
      _id: layer.id,
      volume: layer.volume,
      fraction: layer.fraction,
      material: material ? toMaterialDto(material) : undefined,
    };
  });
  return {
    _id: element.id,
    id: element.id,
    guid: element.guid,
    name: element.name,
    type: element.type,
    volume: element.volume,
    loadBearing: element.loadBearing,
    isExternal: element.isExternal,
    classification: element.classificationSystem
      ? {
          system: element.classificationSystem,
          code: element.classificationCode ?? "",
          name: element.classificationName ?? undefined,
        }
      : undefined,
    materials,
    totalVolume: element.layers.reduce((sum, l) => sum + l.volume, 0),
    emissions,
    uploadId: element.uploadId,
    createdAt: element.createdAt,
  };
}

function toUploadDto(upload: Upload) {
  return {
    _id: upload.id,
    id: upload.id,
    filename: upload.filename,
    status: upload.status,
    elementCount: upload.elementCount,
    materialCount: upload.materialCount,
    error: upload.error,
    createdAt: upload.createdAt,
  };
}

function calculationArea(project: Project) {
  if (project.calculationAreaValue === null) return undefined;
  return {
    type: project.calculationAreaType ?? "EBF",
    value: project.calculationAreaValue,
    unit: project.calculationAreaUnit ?? "m²",
  };
}

function toProjectDto(project: Project) {
  return {
    _id: project.id,
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    imageUrl: project.imageUrl ?? undefined,
    classificationSystem: project.classificationSystem,
    calculationArea: calculationArea(project),
    userId: project.userId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

// ---------------------------------------------------------------- reads

const countSelect = { select: { elements: true, uploads: true, materials: true } } as const;

/** Projects list and dashboard cards, most recently active first. */
export async function listProjectSummaries(userId: string) {
  const projects = await db.project.findMany({
    where: { userId },
    include: {
      _count: countSelect,
      uploads: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const summaries = projects.map((p) => {
    const lastUpload = p.uploads[0]?.createdAt;
    const lastActivity = lastUpload && lastUpload > p.updatedAt ? lastUpload : p.updatedAt;
    return {
      id: p.id,
      _id: p.id,
      name: p.name,
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? undefined,
      updatedAt: lastActivity.toISOString(),
      _count: p._count,
    };
  });
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Everything the project page needs in one response. Large projects get
 * `usePagination: true` and an empty `elements` array; the page then calls
 * listElementsPage().
 */
export async function getProjectDetail(
  userId: string,
  projectId: string,
  options: { includeAllElements?: boolean } = {}
) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    include: { uploads: { orderBy: { createdAt: "desc" } }, _count: countSelect },
  });
  if (!project) throw new NotFoundError("Project");

  const [materials, volumes, emissionsMap] = await Promise.all([
    db.material.findMany({ where: { projectId }, include: { kbob: true }, orderBy: { name: "asc" } }),
    db.elementMaterial.groupBy({
      by: ["materialId"],
      where: { material: { projectId } },
      _sum: { volume: true },
    }),
    emissionsByProject([projectId]),
  ]);
  const materialsById = new Map(materials.map((m) => [m.id, m]));
  const volumeById = new Map(volumes.map((v) => [v.materialId, v._sum.volume ?? 0]));

  const usePagination =
    project._count.elements > ELEMENT_PAGE_THRESHOLD && !options.includeAllElements;
  const elements = usePagination
    ? []
    : await db.element.findMany({
        where: { projectId },
        include: { layers: true },
        orderBy: { createdAt: "desc" },
      });

  const emissions = emissionsMap.get(projectId) ?? ZERO_INDICATORS;
  return {
    ...toProjectDto(project),
    emissions,
    totalEmissions: emissions,
    uploads: project.uploads.map(toUploadDto),
    materials: materials.map((m) => toMaterialDto(m, volumeById.get(m.id) ?? 0)),
    elements: elements.map((e) => toElementDto(e, materialsById)),
    usePagination,
    elementCount: project._count.elements,
    uploadCount: project._count.uploads,
    materialCount: project._count.materials,
    _count: project._count,
  };
}

export async function listElementsPage(
  userId: string,
  projectId: string,
  page: number,
  limit: number
) {
  await requireProject(userId, projectId);
  const [elements, total, materials] = await Promise.all([
    db.element.findMany({
      where: { projectId },
      include: { layers: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.element.count({ where: { projectId } }),
    db.material.findMany({ where: { projectId }, include: { kbob: true } }),
  ]);
  const materialsById = new Map(materials.map((m) => [m.id, m]));
  return {
    elements: elements.map((e) => toElementDto(e, materialsById)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function searchProjects(userId: string, query: string, all: boolean) {
  const projects = await db.project.findMany({
    where: {
      userId,
      ...(all ? {} : { name: { contains: query, mode: "insensitive" as const } }),
    },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
    take: all ? 10 : 5,
  });
  return projects.map((p) => ({ _id: p.id, id: p.id, name: p.name, description: p.description }));
}

// ---------------------------------------------------------------- writes

export const createProjectInput = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(200),
  description: z.string().max(5000).optional(),
});

export async function createProject(userId: string, input: z.infer<typeof createProjectInput>) {
  const count = await db.project.count({ where: { userId } });
  if (count >= MAX_PROJECTS_PER_USER) {
    throw new ForbiddenError(
      `You can have up to ${MAX_PROJECTS_PER_USER} projects. Delete one to create a new project.`
    );
  }
  const project = await db.project.create({
    data: { userId, name: input.name, description: input.description || null },
  });
  return toProjectDto(project);
}

export const updateProjectInput = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  classificationSystem: z.string().max(50).optional(),
  calculationArea: z
    .object({
      type: z.string().max(50).default("EBF"),
      value: z.number().nonnegative(),
      unit: z.string().max(20).default("m²"),
    })
    .nullable()
    .optional(),
});

export async function updateProject(
  userId: string,
  projectId: string,
  input: z.infer<typeof updateProjectInput>
) {
  await requireProject(userId, projectId);
  const { calculationArea, ...rest } = input;
  const project = await db.project.update({
    where: { id: projectId },
    data: {
      ...rest,
      ...(calculationArea === null
        ? { calculationAreaType: null, calculationAreaValue: null, calculationAreaUnit: null }
        : calculationArea
          ? {
              calculationAreaType: calculationArea.type,
              calculationAreaValue: calculationArea.value,
              calculationAreaUnit: calculationArea.unit,
            }
          : {}),
    },
  });
  return toProjectDto(project);
}

/** Uploads, elements, layers, materials and deletion logs go with it (FK cascade). */
export async function deleteProject(userId: string, projectId: string) {
  const { count } = await db.project.deleteMany({ where: { id: projectId, userId } });
  if (count === 0) throw new NotFoundError("Project");
}
