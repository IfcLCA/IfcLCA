import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    let matchStage = {};
    if (projectId) {
      const project = await Project.findOne({
        _id: projectId,
        userId,
      });

      if (!project) {
        return new Response("Project not found", { status: 404 });
      }

      matchStage = { projectId: new mongoose.Types.ObjectId(projectId) };
    }

    // Use aggregation to get unique materials with their total volumes
    const materials = await Material.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$name",
          id: { $first: "$_id" },
          name: { $first: "$name" },
          category: { $first: "$category" },
          volume: { $sum: "$volume" },
          kbobMatchId: { $first: "$kbobMatchId" },
        },
      },
      { $sort: { name: 1 } },
      {
        $lookup: {
          from: "indicatorsKBOB",
          localField: "kbobMatchId",
          foreignField: "_id",
          as: "kbobMatch",
        },
      },
      { $unwind: { path: "$kbobMatch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: { $toString: "$id" },
          name: 1,
          category: 1,
          volume: 1,
          kbobMatch: {
            $cond: {
              if: "$kbobMatch",
              then: {
                id: { $toString: "$kbobMatch._id" },
                name: "$kbobMatch.Name",
                indicators: {
                  gwp: "$kbobMatch.GWP",
                  ubp: "$kbobMatch.UBP",
                  penre: "$kbobMatch.PENRE",
                },
              },
              else: null,
            },
          },
        },
      },
    ]);

    console.log("Materials fetched:", materials.length); // Debug log
    return NextResponse.json(materials);
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
