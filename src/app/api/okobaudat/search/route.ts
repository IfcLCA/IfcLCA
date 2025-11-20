import { NextResponse } from "next/server";
import { OkobaudatService } from "@/lib/services/okobaudat-service";
import { OkobaudatMatcher } from "@/lib/services/okobaudat-matcher";
import { logger } from "@/lib/logger";

// Fallback data for common materials when API is unavailable
const FALLBACK_MATERIALS = [
  {
    uuid: "fallback-concrete-c2530",
    name: "Beton C25/30",
    category: "Concrete",
    density: 2400,
    gwp: 0.105,
    penre: 0.834,
    declaredUnit: "kg",
    compliance: ["EN 15804+A2"],
  },
  {
    uuid: "fallback-steel-s355",
    name: "Baustahl S355",
    category: "Steel",
    density: 7850,
    gwp: 1.46,
    penre: 20.1,
    declaredUnit: "kg",
    compliance: ["EN 15804+A2"],
  },
  {
    uuid: "fallback-glass-float",
    name: "Floatglas",
    category: "Glass",
    density: 2500,
    gwp: 1.2,
    penre: 15.3,
    declaredUnit: "kg",
    compliance: ["EN 15804+A2"],
  },
  {
    uuid: "fallback-insulation-mw",
    name: "Mineralwolle Dämmung",
    category: "Insulation",
    density: 30,
    gwp: 1.35,
    penre: 16.8,
    declaredUnit: "kg",
    compliance: ["EN 15804+A2"],
  },
];

export async function POST(request: Request) {
  try {
    const { query, limit = 20, page = 1, compliance = 'A2', fuzzy = false } = await request.json();
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }
    
    logger.info(`[API] Searching Ökobaudat for: ${query}`);
    
    // Check if we're in development or if API is not configured
    const isApiConfigured = process.env.OKOBAUDAT_API_KEY || process.env.NODE_ENV === 'development';
    
    try {
      if (fuzzy) {
        // Use fuzzy matching for better results
        const matches = await OkobaudatMatcher.findBestMatches(query, {
          limit,
          compliance: compliance as 'A1' | 'A2',
          threshold: 0.3,
        });
        
        return NextResponse.json({
          materials: matches.map(m => m.material),
          scores: matches.map(m => m.score),
          totalCount: matches.length,
          page,
          pageSize: limit,
          fuzzy: true,
        });
      } else {
        // Direct API search
        const result = await OkobaudatService.searchMaterials(query, {
          limit,
          page,
          compliance: compliance as 'A1' | 'A2',
        });
        
        return NextResponse.json(result);
      }
    } catch (apiError) {
      // If API fails, use fallback data
      logger.warn("[API] Ökobaudat API failed, using fallback data:", apiError);
      
      const searchLower = query.toLowerCase();
      const filteredMaterials = FALLBACK_MATERIALS.filter(m => 
        m.name.toLowerCase().includes(searchLower) ||
        m.category.toLowerCase().includes(searchLower)
      );
      
      return NextResponse.json({
        materials: filteredMaterials.slice(0, limit),
        totalCount: filteredMaterials.length,
        page,
        pageSize: limit,
        fallback: true,
        message: "Using fallback data. Configure OKOBAUDAT_API_KEY in Vercel environment variables for live data.",
      });
    }
  } catch (error) {
    logger.error("[API] Ökobaudat search error:", error);
    
    // Return fallback data even on general errors
    return NextResponse.json({
      materials: FALLBACK_MATERIALS.slice(0, 10),
      totalCount: FALLBACK_MATERIALS.length,
      page: 1,
      pageSize: 10,
      fallback: true,
      error: "Search service temporarily unavailable. Using sample data.",
    });
  }
}