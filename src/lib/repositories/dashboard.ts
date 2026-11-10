import { db } from "@/lib/db";
import { ZERO_INDICATORS } from "@/lib/utils/kbob-indicators";
import { listProjectSummaries } from "./projects";

export interface Activity {
  id: string;
  type: "project_created" | "file_uploaded" | "material_deleted";
  user: { name: string; imageUrl?: string };
  action: string;
  project: string;
  projectId: string;
  timestamp: string;
  details: {
    description?: string;
    fileName?: string;
    elementCount?: number;
    materialName?: string;
    reason?: string;
  };
}

/** Newest-first feed of project creations, uploads and material deletions. */
export async function listActivities(userId: string, page: number, limit: number) {
  const take = page * limit; // enough from each source to fill this page
  const [projects, uploads, deletions, projectCount, uploadCount, deletionCount] = await Promise.all([
    db.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take }),
    db.upload.findMany({
      where: { project: { userId } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.materialDeletion.findMany({
      where: { project: { userId } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.project.count({ where: { userId } }),
    db.upload.count({ where: { project: { userId } } }),
    db.materialDeletion.count({ where: { project: { userId } } }),
  ]);

  const you = { name: "You" };
  const all: Activity[] = [
    ...projects.map((p) => ({
      id: `project_created_${p.id}`,
      type: "project_created" as const,
      user: you,
      action: "created a new project",
      project: p.name,
      projectId: p.id,
      timestamp: p.createdAt.toISOString(),
      details: { description: p.description || "No description provided" },
    })),
    ...uploads.map((u) => ({
      id: `file_uploaded_${u.id}`,
      type: "file_uploaded" as const,
      user: you,
      action: "uploaded a file to",
      project: u.project.name,
      projectId: u.projectId,
      timestamp: u.createdAt.toISOString(),
      details: { fileName: u.filename, elementCount: u.elementCount },
    })),
    ...deletions.map((d) => ({
      id: `material_deleted_${d.id}`,
      type: "material_deleted" as const,
      user: you,
      action: "deleted a material from",
      project: d.project.name,
      projectId: d.projectId,
      timestamp: d.createdAt.toISOString(),
      details: { materialName: d.materialName, reason: d.reason || "No reason provided" },
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const skip = (page - 1) * limit;
  const activities = all.slice(skip, skip + limit);
  const total = projectCount + uploadCount + deletionCount;
  return { activities, hasMore: skip + activities.length < total, total };
}

/**
 * Dashboard stats, recent projects and feed. Emissions are left at zero:
 * the dashboard loads them separately from /api/emissions.
 */
export async function getDashboardData(userId: string) {
  const [projects, feed] = await Promise.all([
    listProjectSummaries(userId),
    listActivities(userId, 1, 6),
  ]);
  const sum = (key: "elements" | "materials") => projects.reduce((n, p) => n + p._count[key], 0);
  return {
    stats: {
      totalProjects: projects.length,
      totalElements: sum("elements"),
      totalMaterials: sum("materials"),
      totalEmissions: { ...ZERO_INDICATORS },
    },
    recentProjects: projects.slice(0, 3),
    recentActivities: feed.activities,
  };
}
