/**
 * Rate limiter for API requests
 * Implements exponential backoff and request queuing
 */

export class RateLimiter {
  private requests: number[] = [];
  private readonly limit: number;
  private readonly window: number = 60000; // 1 minute in milliseconds
  
  constructor(limit: number) {
    this.limit = limit;
  }
  
  /**
   * Wait if rate limit would be exceeded
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.window);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.window - (now - oldestRequest);
      
      if (waitTime > 0) {
        // Add exponential backoff for consecutive waits
        const backoffMultiplier = Math.min(this.requests.length / this.limit, 3);
        const totalWaitTime = waitTime * backoffMultiplier;
        
        await new Promise(resolve => setTimeout(resolve, totalWaitTime));
      }
    }
    
    this.requests.push(Date.now());
  }
  
  /**
   * Get current request count
   */
  getCurrentCount(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.window);
    return this.requests.length;
  }
  
  /**
   * Check if rate limit would be exceeded
   */
  wouldExceedLimit(): boolean {
    return this.getCurrentCount() >= this.limit;
  }
  
  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}

