import { prisma } from "@/lib/db";

export async function getMaterialsByProject(projectId?: string) {
  const query =
    projectId && projectId !== "all"
      ? {
          where: { id: projectId },
          include: {
            elements: {
              include: {
                materials: true,
              },
            },
          },
        }
      : {
          include: {
            elements: {
              include: {
                materials: true,
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
        if (!materialsMap.has(material.name)) {
          materialsMap.set(material.name, {
            id: material.id,
            name: material.name,
            volume: element.volume || 0,
            category: material.category,
          });
        } else {
          const existingMaterial = materialsMap.get(material.name);
          materialsMap.set(material.name, {
            ...existingMaterial,
            volume: existingMaterial.volume + (element.volume || 0),
          });
        }
      });
    });
  });

  return Array.from(materialsMap.values());
}
