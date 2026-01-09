/**
 * Unified LCA Materials API
 * Supports multiple data sources: KBOB, ÖKOBAUDAT, OpenEPD
 *
 * GET /api/lca-materials?source=kbob|okobaudat|openepd&q=search&limit=50
 * GET /api/lca-materials/sources - Get available sources info
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  getLcaService,
  getAvailableSources,
  searchAllSources,
  getDefaultSource,
} from "@/lib/services/lca";
import type { LcaDataSource } from "@/lib/types/lca";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse source parameter
    const sourceParam = searchParams.get("source");
    const validSources: LcaDataSource[] = ["kbob", "okobaudat", "openepd"];
    const source: LcaDataSource | "all" =
      sourceParam === "all"
        ? "all"
        : validSources.includes(sourceParam as LcaDataSource)
          ? (sourceParam as LcaDataSource)
          : getDefaultSource();

    // Parse other parameters
    const query = searchParams.get("q") || "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200
    );
    const forceRefresh = searchParams.get("refresh") === "true";

    // Handle search across all sources
    if (source === "all") {
      if (query.length < 2) {
        return NextResponse.json({
          materials: [],
          source: "all",
          sources: getAvailableSources(),
          query,
          count: 0,
        });
      }

      const materials = await searchAllSources(query, limit);
      return NextResponse.json({
        materials,
        source: "all",
        sources: getAvailableSources(),
        query,
        count: materials.length,
      });
    }

    // Get service for specific source
    const service = getLcaService(source);

    // Handle search query
    if (query && query.length >= 2) {
      const materials = await service.search(query, limit);
      return NextResponse.json({
        materials,
        source,
        sourceInfo: {
          name: service.displayName,
          flag: service.countryFlag,
          indicators: service.getAvailableIndicators(),
        },
        query,
        count: materials.length,
      });
    }

    // Return all materials from cache
    // For KBOB, this triggers sync if needed
    const materials = await service.getAll();

    // If force refresh requested, trigger sync
    if (forceRefresh) {
      // Don't await - let it run in background
      service.sync().catch((error) => {
        logger.error(`[LCA API] Sync error for ${source}:`, error);
      });
    }

    return NextResponse.json({
      materials,
      source,
      sourceInfo: {
        name: service.displayName,
        flag: service.countryFlag,
        indicators: service.getAvailableIndicators(),
      },
      count: materials.length,
    });
  } catch (error) {
    logger.error("[LCA API] Error fetching LCA materials:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch LCA materials",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
