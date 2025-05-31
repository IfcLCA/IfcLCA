import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, MaterialDeletion } from "@/models";
import { auth } from "@clerk/nextjs/server";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const materialId = params.id;

    // Find the material to get its name and project ID before deletion
    const material = await Material.findById(materialId).lean();
    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }

    // Delete the material
    await Material.findByIdAndDelete(materialId);

    // Create a material deletion record
    await MaterialDeletion.create({
      projectId: material.projectId,
      userId,
      materialName: material.name,
      reason: "Material deleted by user",
    });

    return NextResponse.json(
      { message: "Material deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete material:", error);
    return NextResponse.json(
      { error: "Failed to delete material" },
      { status: 500 }
    );
  }
}
