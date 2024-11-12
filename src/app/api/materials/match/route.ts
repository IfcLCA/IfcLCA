import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, KBOBMaterial } from "@/models";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { materialIds, kbobMaterialId } = await request.json();
    await connectToDatabase();

    // First fetch the KBOB material
    const kbobMaterial = await KBOBMaterial.findById(kbobMaterialId).lean();

    if (!kbobMaterial) {
      return NextResponse.json(
        { error: "KBOB material not found" },
        { status: 404 }
      );
    }

    // Calculate density from KBOB material data
    let density = null;
    if (kbobMaterial["kg/unit"]) {
      density = kbobMaterial["kg/unit"];
    } else if (kbobMaterial["min density"] && kbobMaterial["max density"]) {
      density = (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
    }

    console.log(
      "Calculated density:",
      density,
      "from KBOB material:",
      kbobMaterial
    ); // Debug log

    const objectIds = materialIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );

    // Create update object with all fields that need to be set
    const updateOperation = {
      $set: {
        kbobMatchId: new mongoose.Types.ObjectId(kbobMaterialId),
        density: density,
        updatedAt: new Date(),
      },
    };

    // Update materials with KBOB match and density
    const result = await Material.updateMany(
      { _id: { $in: objectIds } },
      updateOperation
    );

    console.log("Update operation:", updateOperation);
    console.log("Update result:", result);

    // Fetch updated materials with KBOB data
    const updatedMaterials = await Material.find({ _id: { $in: objectIds } })
      .select("name category volume density kbobMatchId")
      .populate("kbobMatchId")
      .lean();

    console.log("Updated materials:", updatedMaterials);

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
