import { connectToDatabase } from "@/lib/mongodb";
import { Element, KBOBMaterial, Material } from "@/models";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { OkobaudatService } from "@/lib/services/okobaudat-service";
import { DensityService } from "@/lib/services/density-service";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const {
      materialIds,
      matchId,
      dataSource = 'kbob',
      kbobMaterialId, // For backward compatibility
      okobaudatId,
      density: userDefinedDensity,
    } = await request.json();
    
    await connectToDatabase();
    
    // Handle backward compatibility
    const actualMatchId = matchId || kbobMaterialId || okobaudatId;
    const actualDataSource = dataSource || (okobaudatId ? 'okobaudat' : 'kbob');
    
    if (!actualMatchId) {
      return NextResponse.json(
        { error: "Match ID is required" },
        { status: 400 }
      );
    }
    
    logger.info(`[Match] Matching materials with ${actualDataSource}: ${actualMatchId}`);
    
    let density = userDefinedDensity;
    let indicators: { gwp: number; ubp?: number; penre: number } | null = null;
    let matchName = '';
    let matchCategory = '';
    
    if (actualDataSource === 'okobaudat') {
      // Fetch Ökobaudat material
      const okobaudatMaterial = await OkobaudatService.getMaterialDetails(actualMatchId);
      
      if (!okobaudatMaterial) {
        return NextResponse.json(
          { error: "Ökobaudat material not found" },
          { status: 404 }
        );
      }
      
      matchName = okobaudatMaterial.name;
      matchCategory = okobaudatMaterial.category;
      
      // Use provided density or Ökobaudat density
      if (!density) {
        density = okobaudatMaterial.density;
        
        // If still no density, try to get fallback
        if (!density) {
          const materials = await Material.find({ 
            _id: { $in: materialIds } 
          }).select('name category').lean();
          
          if (materials.length > 0) {
            const fallbackDensity = await DensityService.getDensityFallback(
              materials[0].name,
              materials[0].category || okobaudatMaterial.category
            );
            
            if (fallbackDensity) {
              density = fallbackDensity.typical;
              logger.info(`[Match] Using fallback density: ${density} kg/m³`);
            }
          }
        }
      }
      
      if (!density) {
        return NextResponse.json(
          { 
            error: "Density not available. Please provide a density value.",
            requiresDensity: true,
            materialName: matchName,
            category: matchCategory
          },
          { status: 400 }
        );
      }
      
      indicators = {
        gwp: okobaudatMaterial.gwp,
        penre: okobaudatMaterial.penre,
        ubp: okobaudatMaterial.ubp,
      };
      
      // Update materials with Ökobaudat match
      await Material.updateMany(
        { _id: { $in: materialIds } },
        {
          $set: {
            dataSource: 'okobaudat',
            okobaudatMatchId: actualMatchId,
            okobaudatData: {
              uuid: okobaudatMaterial.uuid,
              name: okobaudatMaterial.name,
              category: okobaudatMaterial.category,
              declaredUnit: okobaudatMaterial.declaredUnit,
              referenceFlowAmount: okobaudatMaterial.referenceFlowAmount,
              lastFetched: new Date(),
            },
            density: density,
            cachedIndicators: {
              gwp: indicators.gwp,
              penre: indicators.penre,
              ubp: indicators.ubp,
              source: 'okobaudat',
              lastUpdated: new Date(),
            },
            updatedAt: new Date(),
          },
          $unset: {
            kbobMatchId: "", // Remove KBOB match if switching sources
          },
        }
      );
      
    } else {
      // Original KBOB logic
      const kbobMaterial = await KBOBMaterial.findById(actualMatchId).lean();
      
      if (!kbobMaterial) {
        return NextResponse.json(
          { error: "KBOB material not found" },
          { status: 404 }
        );
      }
      
      matchName = kbobMaterial.Name;
      
      // Use user-defined density if provided, otherwise calculate from KBOB material data
      if (!density) {
        if (
          kbobMaterial["kg/unit"] &&
          typeof kbobMaterial["kg/unit"] === "number"
        ) {
          density = kbobMaterial["kg/unit"];
        } else if (kbobMaterial["min density"] && kbobMaterial["max density"]) {
          density =
            (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
        }
      }
      
      if (!density) {
        return NextResponse.json(
          { error: "Invalid density in KBOB material" },
          { status: 400 }
        );
      }
      
      indicators = {
        gwp: kbobMaterial.GWP,
        ubp: kbobMaterial.UBP,
        penre: kbobMaterial.PENRE,
      };
      
      // Update materials with KBOB match
      await Material.updateMany(
        { _id: { $in: materialIds } },
        {
          $set: {
            dataSource: 'kbob',
            kbobMatchId: new mongoose.Types.ObjectId(actualMatchId),
            density: density,
            cachedIndicators: {
              gwp: indicators.gwp,
              ubp: indicators.ubp,
              penre: indicators.penre,
              source: 'kbob',
              lastUpdated: new Date(),
            },
            updatedAt: new Date(),
          },
          $unset: {
            okobaudatMatchId: "", // Remove Ökobaudat match if switching sources
            okobaudatData: "",
          },
        }
      );
    }
    
    // Update elements with calculated indicators
    const allElements = await Element.find({
      "materials.material": { $in: materialIds },
    })
      .populate({
        path: "materials.material",
        select: "_id name density cachedIndicators",
      })
      .lean();
    
    const bulkOps = [];
    let totalModified = 0;
    let totalMatched = 0;
    
    // Process elements in batches
    const batchSize = 100;
    for (let i = 0; i < allElements.length; i += batchSize) {
      const batch = allElements.slice(i, i + batchSize);
      const bulkOps = [];
      
      for (const element of batch) {
        const updatedMaterials = element.materials.map((mat: any) => {
          if (
            mat.material &&
            materialIds.includes(mat.material._id.toString())
          ) {
            return {
              ...mat,
              indicators: {
                gwp: mat.volume * density * indicators.gwp,
                ubp: mat.volume * density * (indicators.ubp || 0),
                penre: mat.volume * density * indicators.penre,
              },
            };
          }
          return mat;
        });
        
        bulkOps.push({
          updateOne: {
            filter: { _id: element._id },
            update: { $set: { materials: updatedMaterials } },
          },
        });
      }
      
      try {
        const result = await Element.bulkWrite(bulkOps, {
          ordered: false,
          writeConcern: { w: 1 },
        });
        
        totalModified += result.modifiedCount;
        totalMatched += result.matchedCount;
      } catch (error) {
        logger.error("Error in batch:", error);
        // Continue processing other batches
      }
    }
    
    logger.info(`[Match] Successfully matched ${materialIds.length} materials with ${matchName}`);
    
    return NextResponse.json({
      message: "Successfully updated materials and elements",
      totalModified,
      totalMatched,
      totalElements: allElements.length,
      dataSource: actualDataSource,
      matchedMaterial: matchName,
      density,
    });
  } catch (error) {
    logger.error("Error matching materials:", error);
    return NextResponse.json(
      { error: "Failed to match materials" },
      { status: 500 }
    );
  }
}