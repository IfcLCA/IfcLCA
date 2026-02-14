import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { projects, materials, lcaMaterials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ProjectClient } from "@/components/project/project-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);

  if (!project) notFound();

  // Fetch materials with their LCA match data (left join)
  const projectMaterials = await db
    .select({
      material: materials,
      lcaMaterial: lcaMaterials,
    })
    .from(materials)
    .leftJoin(lcaMaterials, eq(materials.lcaMaterialId, lcaMaterials.id))
    .where(eq(materials.projectId, id));

  return (
    <ProjectClient
      project={project}
      materials={projectMaterials.map((row) => row.material)}
      lcaMaterials={projectMaterials
        .filter((row) => row.lcaMaterial !== null)
        .map((row) => row.lcaMaterial!)}
    />
  );
}
