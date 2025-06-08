import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    // Get user's projects
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
        $lookup: {
          from: "indicatorsKBOB",
          localField: "kbobMatchId",
          foreignField: "_id",
          as: "kbob",
        },
      },
      { $unwind: "$kbob" },
      {
        $project: {
          _id: 0,
          materialName: "$_id",
          density: 1,
          kbob: {
            id: "$kbob._id",
            Name: "$kbob.Name",
            GWP: "$kbob.GWP",
            UBP: "$kbob.UBP",
            PENRE: "$kbob.PENRE",
          },
        },
      },
      { $sort: { materialName: 1 } },
    ]);

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to fetch mappings:", error);
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { materialName, kbobMaterialId, density } = await request.json();
    if (!materialName || !kbobMaterialId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    await connectToDatabase();

    const kbobId = new mongoose.Types.ObjectId(kbobMaterialId);

    const projects = await Project.find({ userId }).select("_id").lean();
    const projectIds = projects.map((p) => p._id);

    await Material.updateMany(
      { name: materialName, projectId: { $in: projectIds } },
      { kbobMatchId: kbobId, ...(density ? { density } : {}) }
    );

    return NextResponse.json({ message: "Mapping updated" });
  } catch (error) {
    console.error("Failed to update mapping:", error);
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { materialName } = await request.json();
    if (!materialName) {
      return NextResponse.json({ error: "Missing materialName" }, { status: 400 });
    }

    await connectToDatabase();

    const projects = await Project.find({ userId }).select("_id").lean();
    const projectIds = projects.map((p) => p._id);

    await Material.updateMany(
      { name: materialName, projectId: { $in: projectIds } },
      { $unset: { kbobMatchId: "", density: "" } }
    );

    return NextResponse.json({ message: "Mapping removed" });
  } catch (error) {
    console.error("Failed to delete mapping:", error);
    return NextResponse.json({ error: "Failed to delete mapping" }, { status: 500 });
  }
}
