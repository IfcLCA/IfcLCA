import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Element, Project } from "@/models";
import mongoose from "mongoose";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;
    const projectId = new mongoose.Types.ObjectId(id);

    // Calculate totals using MongoDB aggregation
    const [totals] = await Element.aggregate([
      { $match: { projectId } },
      { $unwind: "$materials" },
      {
        $group: {
          _id: "$projectId",
          gwp: { $sum: { $ifNull: ["$materials.indicators.gwp", 0] } },
          ubp: { $sum: { $ifNull: ["$materials.indicators.ubp", 0] } },
          penre: { $sum: { $ifNull: ["$materials.indicators.penre", 0] } },
        },
      },
    ]);

    // Update project with calculated totals
    await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          emissions: {
            gwp: totals?.gwp || 0,
            ubp: totals?.ubp || 0,
            penre: totals?.penre || 0,
            lastCalculated: new Date(),
          },
        },
      }
    );

    return NextResponse.json({
      success: true,
      totals: {
        totalGWP: totals?.gwp || 0,
        totalUBP: totals?.ubp || 0,
        totalPENRE: totals?.penre || 0,
      },
    });
  } catch (error) {
    console.error("Error updating project emission totals:", error);
    return NextResponse.json(
      { error: "Failed to update project emission totals" },
      { status: 500 }
    );
  }
}
