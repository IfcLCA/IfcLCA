import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";

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

    const transformedMaterials = materials.map((material: any) => {
      // When populated, kbobMatchId contains the KBOB material object
      const kbobMatch = material.kbobMatchId;

      return {
        id: material._id.toString(),
        name: material.name,
        category: material.category,
        volume: material.volume,
        density: material.density,
        projectId: material.projectId?.toString(),
        kbobMatchId: kbobMatch?._id.toString(),
        kbobMatch: kbobMatch
          ? {
            id: kbobMatch._id.toString(),
            Name: kbobMatch.Name,
            GWP: getGWP(kbobMatch),
            UBP: getUBP(kbobMatch),
            PENRE: getPENRE(kbobMatch),
          }
          : undefined,
      };
    });

    return NextResponse.json(transformedMaterials);
  } catch (error) {
    console.error("Error fetching materials:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch materials", details: errorMessage },
      { status: 500 }
    );
  }
}