/**
 * LCA Data Sources API
 * Returns information about available LCA data sources
 *
 * GET /api/lca-materials/sources
 */

import { NextResponse } from "next/server";
import { getAvailableSources, getDefaultSource } from "@/lib/services/lca";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = getAvailableSources();
  const defaultSource = getDefaultSource();

  return NextResponse.json({
    sources,
    defaultSource,
  });
}
