import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    // Aggregate emissions across all active projects for the user
    const projects = await Project.aggregate([
      { 
        $match: { 
          userId,
          isArchived: { $ne: true } // Only include non-archived projects
        } 
      },
      {
        $lookup: {
          from: "elements",
          localField: "_id",
          foreignField: "projectId",
          as: "elements",
        },
      },
      {
        $unwind: {
          path: "$elements",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "materials",
          localField: "elements.materials.materialId",
          foreignField: "_id",
          as: "element.material",
        },
      },
      {
        $unwind: {
          path: "$elements.materials",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          gwp: {
            $sum: {
              $multiply: [
                { $ifNull: ["$elements.materials.indicators.gwp", 0] },
                { $ifNull: ["$elements.materials.volume", 0] },
                { $ifNull: ["$elements.materials.density", 1] }, // Include density in calculation
              ],
            },
          },
          ubp: {
            $sum: {
              $multiply: [
                { $ifNull: ["$elements.materials.indicators.ubp", 0] },
                { $ifNull: ["$elements.materials.volume", 0] },
                { $ifNull: ["$elements.materials.density", 1] }, // Include density in calculation
              ],
            },
          },
          penre: {
            $sum: {
              $multiply: [
                { $ifNull: ["$elements.materials.indicators.penre", 0] },
                { $ifNull: ["$elements.materials.volume", 0] },
                { $ifNull: ["$elements.materials.density", 1] }, // Include density in calculation
              ],
            },
          },
        },
      },
    ]);

    console.log('Aggregation result:', projects);

    // If no projects or materials found, return zeros
    const totalEmissions = projects[0] || {
      gwp: 0,
      ubp: 0,
      penre: 0,
    };

    // Remove the _id field from the response
    delete totalEmissions._id;

    console.log('Final emissions:', totalEmissions);

    return NextResponse.json(totalEmissions);
  } catch (error) {
    console.error("Failed to fetch total emissions:", error);
    return new Response("Failed to fetch total emissions", { status: 500 });
  }
}
