/**
 * Cache implementation for Ökobaudat API responses
 */

import { OKOBAUDAT_CONFIG } from '@/lib/types/okobaudat';

interface CacheItem {
  data: any;
  expires: number;
}

export class OkobaudatCache {
  private static cache = new Map<string, CacheItem>();
  
  /**
   * Store data in cache with TTL
   */
  static set(key: string, data: any, ttl: number = OKOBAUDAT_CONFIG.cacheTTL): void {
    const expires = Date.now() + ttl * 1000;
    this.cache.set(key, { data, expires });
  }
  
  /**
   * Retrieve data from cache if not expired
   */
  static get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * Check if key exists and is not expired
   */
  static has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Remove specific key from cache
   */
  static delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear entire cache
   */
  static clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  static size(): number {
    return this.cache.size;
  }
  
  /**
   * Clean expired entries
   */
  static cleanExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

