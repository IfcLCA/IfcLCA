import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        elements: {
          include: {
            materials: {
              select: {
                id: true,
                name: true,
                volume: true,
                fraction: true,
              },
            },
          },
        },
      },
    });

    // Get unique materials across all projects
    const materialsMap = new Map();
    projects.forEach((project) => {
      project.elements.forEach((element) => {
        element.materials.forEach((material) => {
          const existingMaterial = materialsMap.get(material.name);
          if (!existingMaterial) {
            materialsMap.set(material.name, {
              id: material.id,
              name: material.name,
              volume: material.volume,
              fraction: material.fraction,
            });
          } else {
            // Sum up volumes for same materials
            materialsMap.set(material.name, {
              ...existingMaterial,
              volume: existingMaterial.volume + material.volume,
            });
          }
        });
      });
    });

    const uniqueMaterials = Array.from(materialsMap.values());
    return NextResponse.json(uniqueMaterials);
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
