import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { projects, materials, elements, elementMaterials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ProjectClient } from "@/components/project/project-client";

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

  const projectMaterials = await db
    .select()
    .from(materials)
    .where(eq(materials.projectId, id));

  return (
    <ProjectClient
      project={project}
      materials={projectMaterials}
    />
  );
}
