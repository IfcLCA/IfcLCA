import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { materialIds, kbobMaterialId } = await request.json();
    await connectToDatabase();

    const objectIds = materialIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );
    const kbobObjectId = new mongoose.Types.ObjectId(kbobMaterialId);

    // Update materials with KBOB match
    const result = await Material.updateMany(
      { _id: { $in: objectIds } },
      { $set: { kbobMatchId: kbobObjectId } }
    );

    // Fetch updated materials with KBOB data
    const updatedMaterials = await Material.find({ _id: { $in: objectIds } })
      .populate("kbobMatchId")
      .lean();

    return NextResponse.json({
      success: true,
      matchedCount: result.modifiedCount,
      materials: updatedMaterials,
    });
  } catch (error) {
    console.error("Error matching materials:", error);
    return NextResponse.json(
      { error: "Failed to match materials" },
      { status: 500 }
    );
  }
}
