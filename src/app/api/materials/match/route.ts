import { connectToDatabase } from "@/lib/mongodb";
import { Element, KBOBMaterial, Material } from "@/models";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";
import { getLcaService, getMaterialById } from "@/lib/services/lca";
import { parseLcaMaterialId, type LcaDataSource } from "@/lib/types/lca";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      materialIds,
      // New multi-source parameters
      source,
      lcaMaterialId,
      // Legacy KBOB parameter (backward compatibility)
      kbobMaterialId,
      density: userDefinedDensity,
    } = body;

    await connectToDatabase();

    // Determine if we're using new multi-source or legacy KBOB
    const isLegacyRequest = kbobMaterialId && !lcaMaterialId;

    let density = userDefinedDensity;
    let indicators = { gwp: 0, ubp: 0, penre: 0 };
    let lcaMatch: any = null;
    let kbobObjectId: mongoose.Types.ObjectId | null = null;

    if (isLegacyRequest) {
      // Legacy KBOB flow
      const kbobMaterial = await KBOBMaterial.findById(kbobMaterialId).lean();

      if (!kbobMaterial) {
        return NextResponse.json(
          { error: "KBOB material not found" },
          { status: 404 }
        );
      }

      // Extract density from KBOB material
      if (!density) {
        if (
          kbobMaterial.density !== null &&
          kbobMaterial.density !== undefined
        ) {
          if (
            typeof kbobMaterial.density === "number" &&
            !isNaN(kbobMaterial.density)
          ) {
            density = kbobMaterial.density;
          } else if (
            typeof kbobMaterial.density === "string" &&
            kbobMaterial.density !== "" &&
            kbobMaterial.density !== "-"
          ) {
            const parsed = parseFloat(kbobMaterial.density);
            if (!isNaN(parsed)) {
              density = parsed;
            }
          }
        }

        // Fallback to old field names
        if (!density) {
          if (
            kbobMaterial["kg/unit"] &&
            typeof kbobMaterial["kg/unit"] === "number"
          ) {
            density = kbobMaterial["kg/unit"];
          } else if (
            kbobMaterial["min density"] &&
            kbobMaterial["max density"]
          ) {
            density =
              (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
          }
        }
      }

      if (!density || density === 0) {
        return NextResponse.json(
          { error: "Invalid density in KBOB material" },
          { status: 400 }
        );
      }

      indicators = {
        gwp: getGWP(kbobMaterial),
        ubp: getUBP(kbobMaterial),
        penre: getPENRE(kbobMaterial),
      };

      kbobObjectId = new mongoose.Types.ObjectId(kbobMaterialId);

      // Also create lcaMatch for forward compatibility
      lcaMatch = {
        source: "kbob" as LcaDataSource,
        materialId: `KBOB_${kbobMaterial.uuid}`,
        sourceId: kbobMaterial.uuid,
        name: kbobMaterial.Name || kbobMaterial.nameDE || "Unknown",
        matchedAt: new Date(),
        indicators: {
          gwp: indicators.gwp,
          ubp: indicators.ubp,
          penre: indicators.penre,
        },
      };
    } else {
      // New multi-source flow
      if (!lcaMaterialId) {
        return NextResponse.json(
          { error: "lcaMaterialId is required" },
          { status: 400 }
        );
      }

      // Parse the material ID to determine source
      const parsed = parseLcaMaterialId(lcaMaterialId);
      if (!parsed) {
        return NextResponse.json(
          { error: `Invalid LCA material ID format: ${lcaMaterialId}` },
          { status: 400 }
        );
      }

      const lcaSource = source || parsed.source;

      // Fetch material from appropriate service
      const lcaMaterial = await getMaterialById(lcaMaterialId);

      if (!lcaMaterial) {
        return NextResponse.json(
          { error: `LCA material not found: ${lcaMaterialId}` },
          { status: 404 }
        );
      }

      // Use user density or material density
      density = userDefinedDensity || lcaMaterial.density;

      if (!density || density === 0) {
        return NextResponse.json(
          { error: "Invalid density in LCA material" },
          { status: 400 }
        );
      }

      indicators = {
        gwp: lcaMaterial.gwp || 0,
        ubp: lcaMaterial.ubp || 0,
        penre: lcaMaterial.penre || 0,
      };

      lcaMatch = {
        source: lcaSource,
        materialId: lcaMaterialId,
        sourceId: parsed.sourceId,
        name: lcaMaterial.name,
        matchedAt: new Date(),
        indicators: {
          gwp: indicators.gwp,
          ubp: indicators.ubp || null,
          penre: indicators.penre || null,
        },
      };

      // For KBOB source, also set kbobMatchId for backward compatibility
      if (lcaSource === "kbob") {
        const kbobMaterial = await KBOBMaterial.findOne({
          uuid: parsed.sourceId,
        }).lean();
        if (kbobMaterial) {
          kbobObjectId = kbobMaterial._id as mongoose.Types.ObjectId;
        }
      }
    }

    const objectIds = materialIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );

    // Build update object
    const updateFields: any = {
      lcaMatch,
      density,
      updatedAt: new Date(),
    };

    // Include kbobMatchId for KBOB matches (backward compatibility)
    if (kbobObjectId) {
      updateFields.kbobMatchId = kbobObjectId;
    }

    // Update materials with LCA match and density
    await Material.updateMany({ _id: { $in: objectIds } }, { $set: updateFields });

    // Find elements that need updating
    const batchSize = 500;
    const allElements = await Element.find({
      "materials.material": { $in: objectIds },
    })
      .populate({
        path: "materials.material",
        select: "_id name kbobMatchId lcaMatch density",
      })
      .lean();

    // Process elements in batches
    const batches = [];
    for (let i = 0; i < allElements.length; i += batchSize) {
      batches.push(allElements.slice(i, i + batchSize));
    }

    let totalModified = 0;
    let totalMatched = 0;

    for (const elementBatch of batches) {
      const bulkOps = elementBatch.map((element) => ({
        updateOne: {
          filter: { _id: element._id },
          update: {
            $set: {
              materials: element.materials.map((mat: any) => {
                if (materialIds.includes(mat.material._id.toString())) {
                  return {
                    _id: mat._id,
                    material: mat.material._id,
                    volume: mat.volume,
                    fraction: mat.fraction,
                    indicators: {
                      gwp: mat.volume * density * indicators.gwp,
                      ubp: mat.volume * density * indicators.ubp,
                      penre: mat.volume * density * indicators.penre,
                    },
                  };
                }
                return mat;
              }),
              updatedAt: new Date(),
            },
          },
        },
      }));

      try {
        const result = await Element.bulkWrite(bulkOps, {
          ordered: false,
          writeConcern: { w: 1 },
        });

        totalModified += result.modifiedCount;
        totalMatched += result.matchedCount;
      } catch (error) {
        logger.error("Error in batch:", error);
      }
    }

    return NextResponse.json({
      message: "Successfully updated materials and elements",
      totalModified,
      totalMatched,
      totalElements: allElements.length,
      source: lcaMatch?.source || "kbob",
    });
  } catch (error) {
    logger.error("Error matching materials:", error);
    return NextResponse.json(
      { error: "Failed to match materials" },
      { status: 500 }
    );
  }
}
