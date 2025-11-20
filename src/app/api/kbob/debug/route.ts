/**
 * Debug endpoint for KBOB API integration
 * GET /api/kbob/debug - Simple debug endpoint
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { KBOBMaterial } from "@/models/kbob";
import { KBOB_API_CONFIG } from "@/lib/config/kbob";

export const dynamic = "force-dynamic";

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: KBOB_API_CONFIG.baseUrl,
      hasApiKey: !!KBOB_API_CONFIG.apiKey,
      apiKeyLength: KBOB_API_CONFIG.apiKey?.length || 0,
    },
    tests: [],
  };

  try {
    // Test 1: Database connection
    try {
      await connectToDatabase();
      debug.tests.push({ name: "Database", status: "ok", message: "Connected" });
    } catch (error: any) {
      debug.tests.push({ name: "Database", status: "error", message: error.message });
      return NextResponse.json(debug, { status: 500 });
    }

    // Test 2: Count materials
    try {
      const count = await KBOBMaterial.countDocuments();
      const newFormatCount = await KBOBMaterial.countDocuments({
        gwpTotal: { $exists: true, $ne: null },
      });
      const legacyFormatCount = await KBOBMaterial.countDocuments({
        GWP: { $exists: true, $ne: null },
      });
      
      debug.tests.push({
        name: "Materials",
        status: "ok",
        message: `Total: ${count}, New format: ${newFormatCount}, Legacy: ${legacyFormatCount}`,
      });
    } catch (error: any) {
      debug.tests.push({ name: "Materials", status: "error", message: error.message });
    }

    // Test 3: Sample material
    try {
      const sample = await KBOBMaterial.findOne().lean();
      debug.tests.push({
        name: "Sample Material",
        status: "ok",
        data: sample ? {
          name: sample.Name || sample.nameDE,
          hasUUID: !!sample.uuid,
          hasNewFields: !!(sample.gwpTotal !== undefined),
          hasLegacyFields: !!(sample.GWP !== undefined),
        } : null,
      });
    } catch (error: any) {
      debug.tests.push({ name: "Sample Material", status: "error", message: error.message });
    }

    // Test 4: API fetch (simple test)
    try {
      const url = `${KBOB_API_CONFIG.baseUrl}/api/kbob/materials?pageSize=all`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${KBOB_API_CONFIG.apiKey}`,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout for test
      });

      if (response.ok) {
        const data = await response.json();
        debug.tests.push({
          name: "API Fetch",
          status: "ok",
          message: `Fetched ${data.materials?.length || 0} materials`,
          data: {
            version: data.version,
            totalMaterials: data.totalMaterials,
          },
        });
      } else {
        debug.tests.push({
          name: "API Fetch",
          status: "error",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error: any) {
      debug.tests.push({
        name: "API Fetch",
        status: "error",
        message: error.message,
      });
    }

    return NextResponse.json(debug, { status: 200 });
  } catch (error: any) {
    debug.error = error.message;
    debug.stack = error.stack;
    return NextResponse.json(debug, { status: 500 });
  }
}

