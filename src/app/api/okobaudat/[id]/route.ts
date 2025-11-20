import { NextResponse } from "next/server";
import { OkobaudatService } from "@/lib/services/okobaudat-service";
import { logger } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const uuid = params.id;
    
    if (!uuid) {
      return NextResponse.json(
        { error: "Material UUID is required" },
        { status: 400 }
      );
    }
    
    logger.info(`[API] Fetching Ökobaudat material: ${uuid}`);
    
    const material = await OkobaudatService.getMaterialDetails(uuid);
    
    if (!material) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 }
      );
    }
    
    // Validate compliance if requested
    const url = new URL(request.url);
    const validateCompliance = url.searchParams.get('validateCompliance');
    
    if (validateCompliance) {
      const standard = (url.searchParams.get('standard') || 'A2') as 'A1' | 'A2';
      const isCompliant = await OkobaudatService.validateCompliance(uuid, standard);
      
      return NextResponse.json({
        ...material,
        complianceValidated: true,
        isCompliant,
        standard: `EN 15804+${standard}`,
      });
    }
    
    return NextResponse.json(material);
  } catch (error) {
    logger.error(`[API] Failed to fetch Ökobaudat material:`, error);
    return NextResponse.json(
      { error: "Failed to fetch material details" },
      { status: 500 }
    );
  }
}







