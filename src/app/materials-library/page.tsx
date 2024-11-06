import { prisma } from "@/lib/db";
import { MaterialsLibrary } from "@/components/materials-library";

export default async function MaterialsLibraryPage() {
  // Fetch initial data server-side
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  const materials = await prisma.material.findMany({
    select: {
      id: true,
      name: true,
      volume: true,
      fraction: true,
    },
  });

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Materials Library</h1>
      <MaterialsLibrary
        initialProjects={projects}
        initialMaterials={materials}
      />
    </div>
  );
}
