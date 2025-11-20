/**
 * Ökobaudat API Service
 * Handles integration with the German environmental database (Ökobaudat)
 * Supports ILCD+EPD format as per Ökobaudat standards
 */

import { logger } from '@/lib/logger';
import { OkobaudatCache } from './okobaudat-cache';
import { RateLimiter } from './rate-limiter';
import { 
  OkobaudatMaterial, 
  OkobaudatSearchResult, 
  OKOBAUDAT_CONFIG 
} from '@/lib/types/okobaudat';

const rateLimiter = new RateLimiter(OKOBAUDAT_CONFIG.rateLimit);

export class OkobaudatService {
  /**
   * Make authenticated API request with rate limiting and caching
   */
  private static async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    await rateLimiter.waitIfNeeded();
    
    const url = new URL(`${OKOBAUDAT_CONFIG.baseUrl}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    
    const cacheKey = url.toString();
    const cachedData = OkobaudatCache.get(cacheKey);
    if (cachedData) {
      logger.info(`[Ökobaudat] Cache hit for ${endpoint}`);
      return cachedData;
    }
    
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'IfcLCA/1.0 (https://ifclca.com)',
      };
      
      if (OKOBAUDAT_CONFIG.apiKey) {
        headers['Authorization'] = `Bearer ${OKOBAUDAT_CONFIG.apiKey}`;
      }
      
      logger.info(`[Ökobaudat] Making request to: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[Ökobaudat] API error response: ${errorText}`);
        throw new Error(`Ökobaudat API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      OkobaudatCache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      logger.error('[Ökobaudat] API request failed:', error);
      // Return empty result instead of throwing to prevent 500 errors
      if (error instanceof Error && error.message.includes('timeout')) {
        logger.error('[Ökobaudat] Request timeout - API might be slow or unavailable');
      }
      throw error;
    }
  }
  
  /**
   * Transform ILCD+EPD format to internal format
   */
  private static transformILCDToInternal(epdData: any): OkobaudatMaterial | null {
    try {
      const uuid = epdData.uuid || '';
      const name = epdData.name || 'Unknown Material';
      const category = epdData.category || 'Uncategorized';
      
      let declaredUnit = 'kg';
      let referenceFlowAmount = 1.0;
      let density: number | undefined;
      
      // Parse exchanges for reference flow (ILCD+EPD format)
      const exchanges = epdData.exchanges?.exchange || [];
      const referenceExchange = exchanges.find((e: any) => e.referenceFlow === true);
      
      if (referenceExchange) {
        const flowProperties = referenceExchange.flowProperties || [];
        const refProperty = flowProperties.find((p: any) => p.referenceFlowProperty) || flowProperties[0];
        
        if (refProperty) {
          declaredUnit = refProperty.referenceUnit || 'kg';
          referenceFlowAmount = refProperty.meanValue || 1.0;
        }
        
        // Extract material properties including density
        const materialProps = referenceExchange.materialProperties || [];
        for (const prop of materialProps) {
          const propName = prop.name?.toLowerCase() || '';
          const propValue = parseFloat(prop.value);
          
          if ((propName.includes('density') || propName.includes('rohdichte')) && !isNaN(propValue)) {
            density = propValue;
          }
        }
      }
      
      // Extract environmental indicators from LCIA Results
      let gwp = 0;
      let penre = 0;
      let ubp: number | undefined;
      
      const lciaResults = epdData.LCIAResults?.LCIAResult || [];
      for (const result of lciaResults) {
        const methodRef = result.referenceToLCIAMethodDataSet || {};
        const shortDesc = methodRef.shortDescription || '';
        const value = parseFloat(result.amount || 0);
        
        if (shortDesc.toLowerCase().includes('gwp') || shortDesc.includes('climate change')) {
          gwp = value;
        } else if (shortDesc.toLowerCase().includes('penre') || shortDesc.includes('non-renewable energy')) {
          penre = value;
        } else if (shortDesc.toLowerCase().includes('ubp')) {
          ubp = value;
        }
      }
      
      // Normalize to per-kg values if needed
      if (declaredUnit.toLowerCase() !== 'kg' && referenceFlowAmount > 0) {
        const conversionFactor = 1 / referenceFlowAmount;
        gwp *= conversionFactor;
        penre *= conversionFactor;
        if (ubp) ubp *= conversionFactor;
      }
      
      return {
        uuid,
        name,
        category,
        density,
        gwp,
        penre,
        ubp,
        declaredUnit,
        referenceFlowAmount,
        compliance: epdData.compliance || ['EN 15804+A2'],
        lastFetched: new Date(),
      };
    } catch (error) {
      logger.error('[Ökobaudat] Failed to transform ILCD+EPD data:', error);
      return null;
    }
  }
  
  /**
   * Search materials with compliance filtering
   */
  static async searchMaterials(
    query: string,
    options: {
      limit?: number;
      page?: number;
      compliance?: 'A1' | 'A2';
    } = {}
  ): Promise<OkobaudatSearchResult> {
    const { limit = 20, page = 1, compliance = 'A2' } = options;
    
    logger.info(`[Ökobaudat] Searching for: ${query}, compliance: EN 15804+${compliance}`);
    
    try {
      const complianceUuid = compliance === 'A1' 
        ? OKOBAUDAT_CONFIG.complianceA1 
        : OKOBAUDAT_CONFIG.complianceA2;
      
      const endpoint = `datastocks/${OKOBAUDAT_CONFIG.datastockId}/processes`;
      const params = {
        search: 'true',
        name: query,
        compliance: complianceUuid,
        limit: limit.toString(),
        page: page.toString(),
        format: 'json',
      };
      
      const response = await this.makeRequest(endpoint, params);
      
      const materials: OkobaudatMaterial[] = [];
      const processes = response.processes || [];
      
      for (const process of processes) {
        const material = this.transformILCDToInternal(process);
        if (material) {
          materials.push(material);
        }
      }
      
      return {
        materials,
        totalCount: response.totalCount || materials.length,
        page,
        pageSize: limit,
      };
    } catch (error) {
      logger.error('[Ökobaudat] Search failed:', error);
      return {
        materials: [],
        totalCount: 0,
        page,
        pageSize: limit,
      };
    }
  }
  
  /**
   * Get detailed material data by UUID
   */
  static async getMaterialDetails(uuid: string): Promise<OkobaudatMaterial | null> {
    logger.info(`[Ökobaudat] Fetching details for UUID: ${uuid}`);
    
    const cacheKey = `material_${uuid}`;
    const cached = OkobaudatCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const endpoint = `datastocks/${OKOBAUDAT_CONFIG.datastockId}/processes/${uuid}`;
      const params = {
        format: 'json',
        view: 'extended',
      };
      
      const epdData = await this.makeRequest(endpoint, params);
      const material = this.transformILCDToInternal(epdData);
      
      if (material) {
        OkobaudatCache.set(cacheKey, material);
      }
      
      return material;
    } catch (error) {
      logger.error(`[Ökobaudat] Failed to fetch material ${uuid}:`, error);
      return null;
    }
  }
  
  /**
   * Validate EPD data compliance
   */
  static async validateCompliance(uuid: string, standard: 'A1' | 'A2' = 'A2'): Promise<boolean> {
    try {
      const material = await this.getMaterialDetails(uuid);
      if (!material) return false;
      
      const requiredCompliance = `EN 15804+${standard}`;
      return material.compliance.some(c => c.includes(requiredCompliance));
    } catch (error) {
      logger.error(`[Ökobaudat] Compliance validation failed for ${uuid}:`, error);
      return false;
    }
  }
  
  /**
   * Clear cache
   */
  static clearCache(): void {
    OkobaudatCache.clear();
    logger.info('[Ökobaudat] Cache cleared');
  }
}
