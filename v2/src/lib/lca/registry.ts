/**
 * Data source registry — singleton that manages all LCA data source adapters.
 *
 * Usage:
 *   import { registry } from "@/lib/lca/registry";
 *   const kbob = registry.get("kbob");
 *   const results = await kbob.search("concrete");
 */

import type {
  LCADataSourceAdapter,
  DataSourceInfo,
  NormalizedMaterial,
  SearchFilters,
} from "@/types/lca";
import { KBOBAdapter } from "./adapters/kbob";
import { OekobaudatAdapter } from "./adapters/oekobaudat";

class DataSourceRegistry {
  private adapters = new Map<string, LCADataSourceAdapter>();

  register(adapter: LCADataSourceAdapter): void {
    this.adapters.set(adapter.info.id, adapter);
  }

  get(id: string): LCADataSourceAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(
        `Unknown data source: "${id}". Available: ${this.listIds().join(", ")}`
      );
    }
    return adapter;
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }

  listIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  listInfo(): DataSourceInfo[] {
    return Array.from(this.adapters.values()).map((a) => a.info);
  }

  /**
   * Search across multiple (or all) data sources simultaneously.
   * Results are tagged with their source so the caller can distinguish.
   */
  async searchAll(
    query: string,
    filters?: SearchFilters & { sources?: string[] }
  ): Promise<NormalizedMaterial[]> {
    const sourceIds = filters?.sources ?? this.listIds();

    const searches = sourceIds.map(async (id) => {
      try {
        const adapter = this.get(id);
        return await adapter.search(query, filters);
      } catch {
        // If a source fails, return empty rather than failing everything
        return [];
      }
    });

    const results = await Promise.all(searches);
    return results.flat();
  }
}

// Singleton instance with built-in adapters registered
export const registry = new DataSourceRegistry();

registry.register(new KBOBAdapter());
registry.register(new OekobaudatAdapter());
