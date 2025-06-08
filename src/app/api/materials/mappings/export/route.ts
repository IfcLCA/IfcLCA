import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const projects = await Project.find({ userId }).select("_id").lean();
    const projectIds = projects.map((p) => p._id);

    const mappings = await Material.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          kbobMatchId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$name",
          kbobMatchId: { $first: "$kbobMatchId" },
          density: { $first: "$density" },
        },
      },
      {
        $project: {
          _id: 0,
          materialName: "$_id",
          kbobMatchId: 1,
          density: 1,
        },
      },
    ]);

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to export mappings:", error);
    return NextResponse.json({ error: "Failed to export mappings" }, { status: 500 });
  }
}
