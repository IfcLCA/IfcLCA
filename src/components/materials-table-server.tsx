import { prisma } from "@/lib/db";

export async function getMaterialsByProject(projectId?: string) {
  try {
    // First get all materials with their relationships
    const materials = await prisma.material.findMany({
      include: {
        elements: {
          where: projectId
            ? {
                projectId: projectId,
              }
            : undefined,
          select: {
            volume: true,
            projectId: true,
          },
        },
      },
    });

    // Process the materials to aggregate volumes by project
    const processedMaterials = materials
      .filter(
        (m) => !projectId || m.elements.some((e) => e.projectId === projectId)
      )
      .map((material) => ({
        id: material.id,
        name: material.name,
        category: material.category,
        volume: material.elements.reduce(
          (sum, elem) => sum + (elem.volume || 0),
          0
        ),
      }));

    return processedMaterials;
  } catch (error) {
    console.error("Error fetching materials:", error);
    return [];
  }
}
