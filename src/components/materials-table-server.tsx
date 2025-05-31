import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";

export async function getMaterialsByProject(projectId?: string) {
  try {
    await connectToDatabase();

    const materials = await Material.aggregate([
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
        },
      },
      {
        $unwind: {
          path: "$project",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          id: "$_id",
          name: 1,
          category: 1,
          volume: 1,
          projectId: 1,
          projectName: "$project.name",
        },
      },
    ]);

    return materials;
  } catch (error) {
    console.error("Error fetching materials:", error);
    return [];
  }
}
