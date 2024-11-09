import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";

export async function getMaterialsByProject(projectId?: string) {
  try {
    await connectToDatabase();

    const query = projectId ? { "elements.projectId": projectId } : {};

    const materials = await Material.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "elements",
          localField: "_id",
          foreignField: "materials",
          as: "elements",
        },
      },
      {
        $project: {
          id: "$_id",
          name: 1,
          category: 1,
          volume: {
            $sum: "$elements.volume",
          },
        },
      },
    ]);

    return materials;
  } catch (error) {
    console.error("Error fetching materials:", error);
    return [];
  }
}
