import { Suspense } from "react";
import { MaterialsLibrary } from "@/components/materials-library";
import { getMaterialsByProject } from "@/components/materials-table-server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MaterialsLibraryPage() {
  const materials = await getMaterialsByProject();
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <div className="container py-6">
      <MaterialsLibrary
        initialProjects={projects}
        initialMaterials={materials}
      />
    </div>
  );
}
