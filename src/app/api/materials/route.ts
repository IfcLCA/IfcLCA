import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get projects for the current user
    const userProjects = await Project.find({ userId })
      .select("_id")
      .lean();

    const projectIds = userProjects.map(p => p._id);

    const materials = await Material.find({
      projectId: { $in: projectIds }
    })
      .select("name category volume density kbobMatchId projectId")
      .populate("kbobMatchId")
      .lean();

    const transformedMaterials = materials.map((material) => ({
      id: material._id.toString(),
      name: material.name,
      category: material.category,
      volume: material.volume,
      density: material.density,
      projectId: material.projectId?.toString(),
      kbobMatchId: material.kbobMatchId?._id.toString(),
      kbobMatch: material.kbobMatchId
        ? {
          id: material.kbobMatchId._id.toString(),
          Name: material.kbobMatchId.Name,
          GWP: material.kbobMatchId.GWP,
          UBP: material.kbobMatchId.UBP,
          PENRE: material.kbobMatchId.PENRE,
        }
        : undefined,
    }));

    return NextResponse.json(transformedMaterials);
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}