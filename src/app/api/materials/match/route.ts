import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material, KBOBMaterial } from "@/models";
import mongoose from "mongoose";
import { Element } from "@/models";

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
    if (
      kbobMaterial["kg/unit"] &&
      typeof kbobMaterial["kg/unit"] === "number"
    ) {
      density = kbobMaterial["kg/unit"];
    } else if (kbobMaterial["min density"] && kbobMaterial["max density"]) {
      density = (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
    }

    if (!density) {
      return NextResponse.json(
        { error: "Invalid density in KBOB material" },
        { status: 400 }
      );
    }

    const objectIds = materialIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );

    // Update materials with KBOB match and density
    await Material.updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          kbobMatchId: new mongoose.Types.ObjectId(kbobMaterialId),
          density: density,
          updatedAt: new Date(),
        },
      }
    );

    // Find elements that need updating
    const elements = await Element.find({
      "materials.material": { $in: objectIds },
    })
      .populate({
        path: "materials.material",
        select: "_id kbobMatchId density",
      })
      .lean();

    console.log("Found elements to update:", elements.length);

    // Prepare bulk operations for updating elements
    const bulkOps = elements.map((element) => {
      console.log("Processing element:", element._id);

      return {
        updateOne: {
          filter: { _id: element._id },
          update: [
            {
              $set: {
                materials: {
                  $map: {
                    input: "$materials",
                    as: "mat",
                    in: {
                      $cond: {
                        if: { $in: ["$$mat.material", objectIds] },
                        then: {
                          material: "$$mat.material",
                          volume: "$$mat.volume",
                          fraction: "$$mat.fraction",
                          indicators: {
                            gwp: {
                              $multiply: [
                                "$$mat.volume",
                                density,
                                kbobMaterial.GWP,
                              ],
                            },
                            ubp: {
                              $multiply: [
                                "$$mat.volume",
                                density,
                                kbobMaterial.UBP,
                              ],
                            },
                            penre: {
                              $multiply: [
                                "$$mat.volume",
                                density,
                                kbobMaterial.PENRE,
                              ],
                            },
                          },
                        },
                        else: "$$mat",
                      },
                    },
                  },
                },
                updatedAt: new Date(),
              },
            },
          ],
        },
      };
    });

    // Execute bulk operations if any
    if (bulkOps.length > 0) {
      console.log("Executing bulk operations:", bulkOps.length);
      const result = await Element.bulkWrite(bulkOps);
      console.log("Bulk write result:", result);

      // Verify the update
      const verifyElement = await Element.findById(elements[0]._id)
        .populate({
          path: "materials.material",
          select: "_id kbobMatchId density",
        })
        .lean();
      console.log("Verified element materials:", verifyElement?.materials);
    }

    // Fetch and return updated materials
    const updatedMaterials = await Material.find({ _id: { $in: objectIds } })
      .select("name category volume density kbobMatchId")
      .populate("kbobMatchId")
      .lean();

    return NextResponse.json({
      success: true,
      matchedCount: updatedMaterials.length,
      materials: updatedMaterials,
      updatedElements: bulkOps.length,
    });
  } catch (error) {
    console.error("Error matching materials:", error);
    return NextResponse.json(
      { error: "Failed to match materials" },
      { status: 500 }
    );
  }
}
