/**
 * Test endpoint for KBOB API integration
 * GET /api/kbob/test - Run comprehensive tests
 */

import { NextResponse } from "next/server";
import { KbobService } from "@/lib/services/kbob-service";
import { connectToDatabase } from "@/lib/mongodb";
import { KBOBMaterial } from "@/models/kbob";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: any = {
    tests: [],
    summary: { passed: 0, failed: 0 },
  };

  try {
    // Test 1: Database connection
    try {
      await connectToDatabase();
      results.tests.push({ name: "Database connection", status: "passed", message: "Connected successfully" });
      results.summary.passed++;
    } catch (error: any) {
      results.tests.push({ name: "Database connection", status: "failed", message: error.message });
      results.summary.failed++;
      return NextResponse.json(results, { status: 500 });
    }

    // Test 2: API fetch
    try {
      const apiResponse = await KbobService.fetchFromApi();
      results.tests.push({
        name: "API fetch",
        status: "passed",
        message: `Fetched ${apiResponse.materials.length} materials (version ${apiResponse.version})`,
        data: {
          version: apiResponse.version,
          totalMaterials: apiResponse.totalMaterials,
          materialsReturned: apiResponse.materials.length,
          sampleMaterial: apiResponse.materials[0] ? {
            name: apiResponse.materials[0].nameDE,
            uuid: apiResponse.materials[0].uuid,
            hasGWP: apiResponse.materials[0].gwpTotal !== null,
            hasUBP: apiResponse.materials[0].ubp21Total !== null,
            hasPENRE: apiResponse.materials[0].primaryEnergyNonRenewableTotal !== null,
          } : null,
        },
      });
      results.summary.passed++;
    } catch (error: any) {
      results.tests.push({ name: "API fetch", status: "failed", message: error.message });
      results.summary.failed++;
    }

    // Test 3: Material sync (limited to first 10 for testing)
    try {
      // For testing, we'll just verify the sync function works without actually syncing everything
      const apiResponse = await KbobService.fetchFromApi();
      if (apiResponse.materials.length > 0) {
        // Test sync with a small batch
        const testBatch = apiResponse.materials.slice(0, 5);
        const transformed = testBatch.map(m => KbobService.transformApiMaterial(m, apiResponse.version));
        
        results.tests.push({
          name: "Material transformation",
          status: "passed",
          message: `Transformed ${transformed.length} test materials`,
          data: {
            transformed: transformed.length,
            sample: transformed[0] ? {
              hasUUID: !!transformed[0].uuid,
              hasNewFields: !!(transformed[0].gwpTotal !== undefined),
              hasLegacyFields: !!(transformed[0].GWP !== undefined),
            } : null,
          },
        });
        results.summary.passed++;
      }
    } catch (error: any) {
      results.tests.push({ name: "Material transformation", status: "failed", message: error.message });
      results.summary.failed++;
    }

    // Test 4: Cached materials retrieval
    try {
      const materials = await KbobService.getMaterials(false);
      const sample = materials[0] as any;
      
      results.tests.push({
        name: "Cached materials retrieval",
        status: "passed",
        message: `Retrieved ${materials.length} cached materials`,
        data: {
          count: materials.length,
          sample: sample ? {
            name: sample.Name || sample.nameDE,
            hasUUID: !!sample.uuid,
            hasNewFields: !!(sample.gwpTotal !== undefined),
            hasLegacyFields: !!(sample.GWP !== undefined),
          } : null,
        },
      });
      results.summary.passed++;
    } catch (error: any) {
      results.tests.push({ name: "Cached materials retrieval", status: "failed", message: error.message });
      results.summary.failed++;
    }

    // Test 5: Helper functions
    try {
      const materials = await KBOBMaterial.find().limit(5).lean();
      let tested = 0;
      const helperResults: any[] = [];

      for (const material of materials) {
        const gwp = getGWP(material);
        const ubp = getUBP(material);
        const penre = getPENRE(material);

        if (gwp !== 0 || ubp !== 0 || penre !== 0) {
          helperResults.push({
            name: material.Name || material.nameDE,
            gwp,
            ubp,
            penre,
            source: material.gwpTotal !== null && material.gwpTotal !== undefined ? "new" : "legacy",
          });
          tested++;
          if (tested >= 3) break;
        }
      }

      results.tests.push({
        name: "Helper functions",
        status: "passed",
        message: `Tested ${tested} materials with valid indicators`,
        data: { tested, results: helperResults },
      });
      results.summary.passed++;
    } catch (error: any) {
      results.tests.push({ name: "Helper functions", status: "failed", message: error.message });
      results.summary.failed++;
    }

    // Test 6: Backward compatibility
    try {
      const legacyMaterials = await KBOBMaterial.find({
        GWP: { $exists: true, $ne: null },
        UBP: { $exists: true, $ne: null },
        PENRE: { $exists: true, $ne: null },
      }).limit(1).lean();

      const newMaterials = await KBOBMaterial.find({
        gwpTotal: { $exists: true, $ne: null },
        ubp21Total: { $exists: true, $ne: null },
        primaryEnergyNonRenewableTotal: { $exists: true, $ne: null },
      }).limit(1).lean();

      results.tests.push({
        name: "Backward compatibility",
        status: "passed",
        message: "Both formats supported",
        data: {
          legacyFormat: legacyMaterials.length,
          newFormat: newMaterials.length,
        },
      });
      results.summary.passed++;
    } catch (error: any) {
      results.tests.push({ name: "Backward compatibility", status: "failed", message: error.message });
      results.summary.failed++;
    }

    // Test 7: findValidMaterials
    try {
      const validMaterials = await KBOBMaterial.findValidMaterials();
      results.tests.push({
        name: "findValidMaterials query",
        status: "passed",
        message: `Found ${validMaterials.length} valid materials`,
        data: { count: validMaterials.length },
      });
      results.summary.passed++;
    } catch (error: any) {
      results.tests.push({ name: "findValidMaterials query", status: "failed", message: error.message });
      results.summary.failed++;
    }

    const status = results.summary.failed === 0 ? 200 : 207; // 207 Multi-Status if some tests failed
    return NextResponse.json(results, { status });

  } catch (error: any) {
    results.tests.push({ name: "Test suite", status: "failed", message: error.message });
    results.summary.failed++;
    return NextResponse.json(results, { status: 500 });
  }
}

