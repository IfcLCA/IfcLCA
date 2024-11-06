import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: {
        id: params.id,
      },
      include: {
        uploads: true,
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
        _count: {
          select: {
            uploads: true,
            elements: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get unique materials using a Map to keep only unique names
    const materialsMap = new Map();
    project.elements.forEach((element) => {
      element.materials.forEach((material) => {
        if (!materialsMap.has(material.name)) {
          materialsMap.set(material.name, {
            id: material.id,
            name: material.name,
            volume: material.volume,
            fraction: material.fraction,
          });
        }
      });
    });

    const uniqueMaterials = Array.from(materialsMap.values());

    return NextResponse.json({
      ...project,
      materials: uniqueMaterials,
      _count: {
        ...project._count,
        materials: uniqueMaterials.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { name, description } = await request.json();

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);

    if (
      error instanceof Error &&
      typeof (error as any).code === "string" &&
      (error as any).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Delete all related records first
    await prisma.$transaction([
      // Delete all elements associated with uploads in this project
      prisma.element.deleteMany({
        where: {
          upload: {
            projectId: params.id,
          },
        },
      }),
      // Delete all uploads associated with this project
      prisma.upload.deleteMany({
        where: {
          projectId: params.id,
        },
      }),
      // Finally delete the project
      prisma.project.delete({
        where: {
          id: params.id,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
