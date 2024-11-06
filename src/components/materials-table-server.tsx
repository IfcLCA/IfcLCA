import { prisma } from "@/lib/db";

export async function getMaterialsByProject(projectId?: string) {
  const query = {
    where: projectId && projectId !== "all" ? { id: projectId } : undefined,
    include: {
      elements: {
        include: {
          materials: {
            select: {
              id: true,
              name: true,
              category: true,
              volume: true,
              fraction: true,
            },
          },
        },
      },
    },
  };

  const projects = await prisma.project.findMany(query);

  // Get unique materials using a Map
  const materialsMap = new Map();
  projects.forEach((project) => {
    project.elements.forEach((element) => {
      element.materials.forEach((material) => {
        const volume = material.volume || 0;
        if (!materialsMap.has(material.name)) {
          materialsMap.set(material.name, {
            id: material.id,
            name: material.name,
            volume: volume,
            category: material.category,
          });
        } else {
          const existingMaterial = materialsMap.get(material.name);
          materialsMap.set(material.name, {
            ...existingMaterial,
            volume: existingMaterial.volume + volume,
          });
        }
      });
    });
  });

  return Array.from(materialsMap.values());
}
