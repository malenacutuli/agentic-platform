# Cost Attribution: Multi-Provider Fallback Billing and Cost Tracking

## Overview

Cost attribution in multi-provider platforms is complex because:

- **Multiple providers**: Primary, secondary, tertiary fallbacks
- **Partial responses**: Some providers partially succeed
- **Retries**: Same request may hit multiple providers
- **Shared infrastructure**: Caching, preprocessing costs
- **Fair billing**: Users should only pay for successful work

This guide covers complete cost attribution strategies for accurate, fair billing.

## 1. Cost Attribution Models

### 1.1 Four Primary Models

```typescript
/**
 * Cost Attribution Models for Multi-Provider Fallback
 * 
 * Model 1: Winner-Takes-All (Simplest)
 * - Only charge for provider that succeeded
 * - Ignore failed attempts
 * 
 * Model 2: All-Attempts (Most Transparent)
 * - Charge for all attempts (even failed)
 * - Users see full cost of retries
 * 
 * Model 3: Shared-Cost (Most Fair)
 * - Split cost across all attempts
 * - Failed attempts cost less
 * 
 * Model 4: Tiered-Cost (Most Sophisticated)
 * - Charge based on outcome
 * - Successful: Full cost
 * - Partial: 50% cost
 * - Failed: 10% cost (infrastructure only)
 */

type CostAttributionModel = 'winner-takes-all' | 'all-attempts' | 'shared-cost' | 'tiered-cost';

interface CostAttributionStrategy {
  model: CostAttributionModel;
  chargeFailedAttempts: boolean;
  chargeCacheMisses: boolean;
  chargePreprocessing: boolean;
  discountPartialResponses: boolean;
}

class CostAttributionEngine {
  private model: CostAttributionModel;
  private pricingData: Map<string, ProviderPricing> = new Map();

  constructor(model: CostAttributionModel = 'winner-takes-all') {
    this.model = model;
  }

  /**
   * Calculate cost for multi-provider request
   */
  async calculateCost(
    request: MultiProviderRequest,
    attempts: ProviderAttempt[],
    finalResult: FinalResult
  ): Promise<CostBreakdown> {
    switch (this.model) {
      case 'winner-takes-all':
        return this.calculateWinnerTakesAll(attempts, finalResult);
      case 'all-attempts':
        return this.calculateAllAttempts(attempts, finalResult);
      case 'shared-cost':
        return this.calculateSharedCost(attempts, finalResult);
      case 'tiered-cost':
        return this.calculateTieredCost(attempts, finalResult);
      default:
        throw new Error(`Unknown attribution model: ${this.model}`);
    }
  }

  /**
   * Model 1: Winner-Takes-All
   * Only charge for the provider that succeeded
   */
  private calculateWinnerTakesAll(
    attempts: ProviderAttempt[],
    finalResult: FinalResult
  ): CostBreakdown {
    const breakdown: CostBreakdown = {
      model: 'winner-takes-all',
      totalCost: 0,
      chargedProvider: finalResult.successfulProvider,
      attempts: [],
      summary: {}
    };

    // Find successful attempt
    const successfulAttempt = attempts.find(a => a.status === 'success');

    if (!successfulAttempt) {
      // All failed - charge for infrastructure only
      breakdown.totalCost = 0.001; // Minimal charge
      breakdown.summary.infrastructure = 0.001;
      return breakdown;
    }

    // Calculate cost for successful provider
    const cost = this.calculateProviderCost(
      successfulAttempt.provider,
      successfulAttempt.inputTokens,
      successfulAttempt.outputTokens
    );

    breakdown.totalCost = cost;
    breakdown.attempts.push({
      provider: successfulAttempt.provider,
      status: 'charged',
      cost,
      inputTokens: successfulAttempt.inputTokens,
      outputTokens: successfulAttempt.outputTokens
    });

    // Record failed attempts (no charge)
    for (const attempt of attempts) {
      if (attempt.status !== 'success') {
        breakdown.attempts.push({
          provider: attempt.provider,
          status: 'not_charged',
          cost: 0,
          reason: 'failed_attempt'
        });
      }
    }

    breakdown.summary.successful = cost;
    breakdown.summary.failed = 0;

    return breakdown;
  }

  /**
   * Model 2: All-Attempts
   * Charge for all attempts, regardless of success
   */
  private calculateAllAttempts(
    attempts: ProviderAttempt[],
    finalResult: FinalResult
  ): CostBreakdown {
    const breakdown: CostBreakdown = {
      model: 'all-attempts',
      totalCost: 0,
      attempts: [],
      summary: {}
    };

    let totalCost = 0;
    let successfulCost = 0;
    let failedCost = 0;

    for (const attempt of attempts) {
      const cost = this.calculateProviderCost(
        attempt.provider,
        attempt.inputTokens,
        attempt.outputTokens
      );

      totalCost += cost;

      if (attempt.status === 'success') {
        successfulCost += cost;
        breakdown.attempts.push({
          provider: attempt.provider,
          status: 'charged',
          cost,
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens
        });
      } else {
        failedCost += cost;
        breakdown.attempts.push({
          provider: attempt.provider,
          status: 'charged',
          cost,
          reason: 'failed_attempt_charged',
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens
        });
      }
    }

    breakdown.totalCost = totalCost;
    breakdown.summary.successful = successfulCost;
    breakdown.summary.failed = failedCost;

    return breakdown;
  }

  /**
   * Model 3: Shared-Cost
   * Split cost across all attempts, with failed attempts costing less
   */
  private calculateSharedCost(
    attempts: ProviderAttempt[],
    finalResult: FinalResult
  ): CostBreakdown {
    const breakdown: CostBreakdown = {
      model: 'shared-cost',
      totalCost: 0,
      attempts: [],
      summary: {}
    };

    // Calculate base cost for successful attempt
    const successfulAttempt = attempts.find(a => a.status === 'success');
    if (!successfulAttempt) {
      breakdown.totalCost = 0.001;
      breakdown.summary.infrastructure = 0.001;
      return breakdown;
    }

    const baseCost = this.calculateProviderCost(
      successfulAttempt.provider,
      successfulAttempt.inputTokens,
      successfulAttempt.outputTokens
    );

    // Failed attempts cost 20% of base (infrastructure only)
    const failedAttemptCost = baseCost * 0.2;

    let totalCost = baseCost;

    // Add cost for failed attempts
    for (const attempt of attempts) {
      if (attempt.status !== 'success') {
        totalCost += failedAttemptCost;

        breakdown.attempts.push({
          provider: attempt.provider,
          status: 'charged',
          cost: failedAttemptCost,
          reason: 'failed_attempt_infrastructure',
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens
        });
      }
    }

    // Successful attempt
    breakdown.attempts.push({
      provider: successfulAttempt.provider,
      status: 'charged',
      cost: baseCost,
      inputTokens: successfulAttempt.inputTokens,
      outputTokens: successfulAttempt.outputTokens
    });

    breakdown.totalCost = totalCost;
    breakdown.summary.successful = baseCost;
    breakdown.summary.infrastructure = failedAttemptCost * (attempts.length - 1);

    return breakdown;
  }

  /**
   * Model 4: Tiered-Cost
   * Charge based on outcome (successful, partial, failed)
   */
  private calculateTieredCost(
    attempts: ProviderAttempt[],
    finalResult: FinalResult
  ): CostBreakdown {
    const breakdown: CostBreakdown = {
      model: 'tiered-cost',
      totalCost: 0,
      attempts: [],
      summary: {}
    };

    let totalCost = 0;
    let successfulCost = 0;
    let partialCost = 0;
    let failedCost = 0;

    for (const attempt of attempts) {
      let cost = this.calculateProviderCost(
        attempt.provider,
        attempt.inputTokens,
        attempt.outputTokens
      );

      let tier = 'unknown';

      if (attempt.status === 'success') {
        // Full cost for successful
        tier = 'successful';
        successfulCost += cost;
      } else if (attempt.status === 'partial') {
        // 50% cost for partial
        cost *= 0.5;
        tier = 'partial';
        partialCost += cost;
      } else {
        // 10% cost for failed (infrastructure only)
        cost *= 0.1;
        tier = 'failed';
        failedCost += cost;
      }

      totalCost += cost;

      breakdown.attempts.push({
        provider: attempt.provider,
        status: 'charged',
        tier,
        cost,
        originalCost: this.calculateProviderCost(
          attempt.provider,
          attempt.inputTokens,
          attempt.outputTokens
        ),
        inputTokens: attempt.inputTokens,
        outputTokens: attempt.outputTokens
      });
    }

    breakdown.totalCost = totalCost;
    breakdown.summary.successful = successfulCost;
    breakdown.summary.partial = partialCost;
    breakdown.summary.failed = failedCost;

    return breakdown;
  }

  private calculateProviderCost(
    provider: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = this.pricingData.get(provider);
    if (!pricing) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1kTokens;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1kTokens;

    return inputCost + outputCost;
  }
}

interface MultiProviderRequest {
  requestId: string;
  userId: string;
  messages: Message[];
  primaryProvider: string;
  fallbackProviders: string[];
}

interface ProviderAttempt {
  provider: string;
  status: 'success' | 'partial' | 'failed';
  inputTokens: number;
  outputTokens: number;
  startTime: Date;
  endTime: Date;
  error?: string;
}

interface FinalResult {
  successfulProvider: string;
  status: 'success' | 'partial' | 'failed';
  content: string;
  inputTokens: number;
  outputTokens: number;
}

interface CostBreakdown {
  model: CostAttributionModel;
  totalCost: number;
  chargedProvider?: string;
  attempts: AttemptCost[];
  summary: Record<string, number>;
}

interface AttemptCost {
  provider: string;
  status: string;
  cost: number;
  tier?: string;
  originalCost?: number;
  reason?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface ProviderPricing {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
}

interface Message {
  role: string;
  content: string;
}
```

## 2. Cost Tracking and Recording

### 2.1 Comprehensive Cost Ledger

```typescript
/**
 * Complete cost tracking system
 */

class CostLedger {
  private db: any; // Database connection
  private redis: any; // Redis cache

  /**
   * Record cost for request
   */
  async recordCost(
    request: CostRecord
  ): Promise<void> {
    // Record in database
    await this.db.query(
      `INSERT INTO cost_ledger (
        request_id, user_id, provider, model,
        input_tokens, output_tokens, cost,
        attribution_model, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        request.requestId,
        request.userId,
        request.provider,
        request.model,
        request.inputTokens,
        request.outputTokens,
        request.cost,
        request.attributionModel,
        request.status
      ]
    );

    // Update user's cost cache
    await this.updateUserCostCache(request.userId, request.cost);

    // Emit event for real-time tracking
    await this.emitCostEvent(request);
  }

  /**
   * Record multi-provider attempt
   */
  async recordMultiProviderAttempt(
    requestId: string,
    userId: string,
    attempts: ProviderAttempt[],
    breakdown: CostBreakdown
  ): Promise<void> {
    // Record overall request
    await this.db.query(
      `INSERT INTO multi_provider_requests (
        request_id, user_id, attribution_model,
        total_cost, attempt_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        requestId,
        userId,
        breakdown.model,
        breakdown.totalCost,
        attempts.length
      ]
    );

    // Record each attempt
    for (const attempt of breakdown.attempts) {
      await this.db.query(
        `INSERT INTO provider_attempts (
          request_id, provider, status, cost,
          input_tokens, output_tokens, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          requestId,
          attempt.provider,
          attempt.status,
          attempt.cost,
          attempt.inputTokens,
          attempt.outputTokens
        ]
      );
    }

    // Update user cost
    await this.updateUserCostCache(userId, breakdown.totalCost);
  }

  /**
   * Get cost breakdown for request
   */
  async getCostBreakdown(requestId: string): Promise<CostBreakdownRecord> {
    const result = await this.db.query(
      `SELECT * FROM multi_provider_requests WHERE request_id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const request = result.rows[0];

    // Get all attempts
    const attemptsResult = await this.db.query(
      `SELECT * FROM provider_attempts WHERE request_id = $1 ORDER BY created_at`,
      [requestId]
    );

    return {
      requestId,
      attributionModel: request.attribution_model,
      totalCost: request.total_cost,
      attempts: attemptsResult.rows,
      createdAt: request.created_at
    };
  }

  /**
   * Get user's cost summary
   */
  async getUserCostSummary(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<UserCostSummary> {
    const periodDays = {
      day: 1,
      week: 7,
      month: 30,
      year: 365
    };

    const days = periodDays[period];

    const result = await this.db.query(
      `SELECT 
        COUNT(*) as request_count,
        SUM(cost) as total_cost,
        AVG(cost) as avg_cost,
        MAX(cost) as max_cost,
        MIN(cost) as min_cost,
        provider,
        attribution_model
      FROM cost_ledger
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY provider, attribution_model`,
      [userId]
    );

    const byProvider: Record<string, ProviderCostSummary> = {};
    let totalCost = 0;
    let totalRequests = 0;

    for (const row of result.rows) {
      totalCost += row.total_cost || 0;
      totalRequests += row.request_count || 0;

      if (!byProvider[row.provider]) {
        byProvider[row.provider] = {
          provider: row.provider,
          requestCount: 0,
          totalCost: 0,
          avgCost: 0
        };
      }

      byProvider[row.provider].requestCount += row.request_count;
      byProvider[row.provider].totalCost += row.total_cost || 0;
      byProvider[row.provider].avgCost = byProvider[row.provider].totalCost / byProvider[row.provider].requestCount;
    }

    return {
      userId,
      period,
      totalCost,
      totalRequests,
      avgCostPerRequest: totalCost / totalRequests,
      byProvider
    };
  }

  /**
   * Detect cost anomalies
   */
  async detectCostAnomalies(userId: string): Promise<CostAnomaly[]> {
    // Get user's average cost
    const avgResult = await this.db.query(
      `SELECT AVG(cost) as avg_cost, STDDEV(cost) as stddev FROM cost_ledger WHERE user_id = $1`,
      [userId]
    );

    const { avg_cost, stddev } = avgResult.rows[0];
    const threshold = avg_cost + (stddev * 2); // 2 standard deviations

    // Find anomalies
    const anomaliesResult = await this.db.query(
      `SELECT * FROM cost_ledger 
       WHERE user_id = $1 AND cost > $2 
       ORDER BY cost DESC LIMIT 10`,
      [userId, threshold]
    );

    return anomaliesResult.rows.map((row: any) => ({
      requestId: row.request_id,
      cost: row.cost,
      expectedCost: avg_cost,
      deviation: row.cost - avg_cost,
      deviationPercent: ((row.cost - avg_cost) / avg_cost) * 100,
      provider: row.provider,
      timestamp: row.created_at
    }));
  }

  private async updateUserCostCache(userId: string, cost: number): Promise<void> {
    // Update Redis cache for fast access
    const key = `user_cost:${userId}:month`;
    await this.redis.incrby(key, cost);
    await this.redis.expire(key, 30 * 24 * 60 * 60); // 30 days
  }

  private async emitCostEvent(request: CostRecord): Promise<void> {
    // Emit event for real-time tracking
    // Implementation: Send to event bus, webhooks, etc.
  }
}

interface CostRecord {
  requestId: string;
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  attributionModel: string;
  status: 'success' | 'partial' | 'failed';
}

interface CostBreakdownRecord {
  requestId: string;
  attributionModel: string;
  totalCost: number;
  attempts: any[];
  createdAt: Date;
}

interface UserCostSummary {
  userId: string;
  period: string;
  totalCost: number;
  totalRequests: number;
  avgCostPerRequest: number;
  byProvider: Record<string, ProviderCostSummary>;
}

interface ProviderCostSummary {
  provider: string;
  requestCount: number;
  totalCost: number;
  avgCost: number;
}

interface CostAnomaly {
  requestId: string;
  cost: number;
  expectedCost: number;
  deviation: number;
  deviationPercent: number;
  provider: string;
  timestamp: Date;
}
```

## 3. Cost Optimization Strategies

### 3.1 Intelligent Provider Selection

```typescript
/**
 * Select provider based on cost-effectiveness
 */

class CostOptimizedProviderSelector {
  /**
   * Select cheapest provider that can handle request
   */
  async selectCheapestProvider(
    messages: Message[],
    availableProviders: ProviderConfig[],
    model: string
  ): Promise<ProviderConfig> {
    // Estimate tokens
    const tokenEstimate = this.estimateTokens(messages);

    let cheapestProvider = availableProviders[0];
    let lowestCost = Infinity;

    for (const provider of availableProviders) {
      // Check if provider supports model
      if (!provider.models.includes(model)) {
        continue;
      }

      // Calculate estimated cost
      const pricing = this.getPricing(provider.name, model);
      const estimatedCost =
        (tokenEstimate.input / 1000) * pricing.inputCostPer1kTokens +
        (tokenEstimate.output / 1000) * pricing.outputCostPer1kTokens;

      // Consider provider reliability
      const reliability = this.getProviderReliability(provider.name);
      const adjustedCost = estimatedCost / reliability; // Adjust by reliability

      if (adjustedCost < lowestCost) {
        lowestCost = adjustedCost;
        cheapestProvider = provider;
      }
    }

    return cheapestProvider;
  }

  /**
   * Select provider based on cost vs. quality tradeoff
   */
  async selectOptimalProvider(
    messages: Message[],
    availableProviders: ProviderConfig[],
    model: string,
    qualityThreshold: number = 0.8 // 0-1 scale
  ): Promise<ProviderConfig> {
    const providers = availableProviders.filter(p => p.models.includes(model));

    // Score each provider
    const scores: Map<string, number> = new Map();

    for (const provider of providers) {
      // Cost score (lower is better)
      const pricing = this.getPricing(provider.name, model);
      const costScore = 1 / (pricing.inputCostPer1kTokens + pricing.outputCostPer1kTokens);

      // Quality score (higher is better)
      const qualityScore = this.getProviderQuality(provider.name);

      // Reliability score (higher is better)
      const reliabilityScore = this.getProviderReliability(provider.name);

      // Combined score
      const combinedScore =
        costScore * 0.4 + qualityScore * 0.4 + reliabilityScore * 0.2;

      scores.set(provider.name, combinedScore);
    }

    // Select provider with highest score
    let bestProvider = providers[0];
    let bestScore = -Infinity;

    for (const provider of providers) {
      const score = scores.get(provider.name) || 0;
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  /**
   * Batch requests to reduce per-request overhead
   */
  async batchRequests(
    requests: Message[][],
    provider: string,
    model: string
  ): Promise<BatchCostSavings> {
    // Calculate cost without batching
    let totalCostNoBatch = 0;
    for (const req of requests) {
      const tokens = this.estimateTokens(req);
      const pricing = this.getPricing(provider, model);
      totalCostNoBatch +=
        (tokens.input / 1000) * pricing.inputCostPer1kTokens +
        (tokens.output / 1000) * pricing.outputCostPer1kTokens;
    }

    // Calculate cost with batching
    const allMessages = requests.flat();
    const batchTokens = this.estimateTokens(allMessages);
    const pricing = this.getPricing(provider, model);
    const totalCostBatch =
      (batchTokens.input / 1000) * pricing.inputCostPer1kTokens +
      (batchTokens.output / 1000) * pricing.outputCostPer1kTokens;

    const savings = totalCostNoBatch - totalCostBatch;
    const savingsPercent = (savings / totalCostNoBatch) * 100;

    return {
      costWithoutBatching: totalCostNoBatch,
      costWithBatching: totalCostBatch,
      savings,
      savingsPercent
    };
  }

  private estimateTokens(messages: Message[]): TokenEstimate {
    // Rough estimate: 1 token ≈ 4 characters
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += msg.content.length;
    }

    return {
      input: Math.ceil(totalChars / 4),
      output: Math.ceil(totalChars / 4 * 0.5) // Assume 50% output
    };
  }

  private getPricing(provider: string, model: string): ModelPricing {
    // Implementation
    return {
      inputCostPer1kTokens: 0.001,
      outputCostPer1kTokens: 0.002
    };
  }

  private getProviderQuality(provider: string): number {
    // 0-1 scale
    return 0.9;
  }

  private getProviderReliability(provider: string): number {
    // 0-1 scale
    return 0.95;
  }
}

interface TokenEstimate {
  input: number;
  output: number;
}

interface ModelPricing {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
}

interface BatchCostSavings {
  costWithoutBatching: number;
  costWithBatching: number;
  savings: number;
  savingsPercent: number;
}
```

## 4. Cost Allocation for Shared Resources

### 4.1 Shared Infrastructure Costs

```typescript
/**
 * Allocate shared infrastructure costs to users
 * 
 * Shared costs:
 * - Database queries
 * - Caching layer
 * - Load balancers
 * - Monitoring
 * - Support
 */

class SharedCostAllocator {
  /**
   * Calculate user's share of infrastructure costs
   */
  async calculateInfrastructureCost(
    userId: string,
    period: 'day' | 'month' | 'year'
  ): Promise<InfrastructureCostAllocation> {
    // Get total infrastructure costs
    const totalInfraCosts = await this.getTotalInfrastructureCosts(period);

    // Get user's usage metrics
    const userMetrics = await this.getUserMetrics(userId, period);

    // Get total platform metrics
    const platformMetrics = await this.getPlatformMetrics(period);

    // Calculate allocation based on usage
    const allocation: InfrastructureCostAllocation = {
      userId,
      period,
      totalInfrastructureCosts,
      allocations: {}
    };

    // Database cost allocation (based on queries)
    const dbCostShare =
      (userMetrics.databaseQueries / platformMetrics.totalDatabaseQueries) *
      totalInfraCosts.database;
    allocation.allocations.database = dbCostShare;

    // Cache cost allocation (based on cache hits)
    const cacheCostShare =
      (userMetrics.cacheHits / platformMetrics.totalCacheHits) *
      totalInfraCosts.cache;
    allocation.allocations.cache = cacheCostShare;

    // Network cost allocation (based on bandwidth)
    const networkCostShare =
      (userMetrics.bandwidthUsed / platformMetrics.totalBandwidth) *
      totalInfraCosts.network;
    allocation.allocations.network = networkCostShare;

    // Compute cost allocation (based on CPU usage)
    const computeCostShare =
      (userMetrics.cpuUsagePercent / platformMetrics.totalCpuUsagePercent) *
      totalInfraCosts.compute;
    allocation.allocations.compute = computeCostShare;

    // Calculate total
    allocation.totalAllocated = Object.values(allocation.allocations).reduce(
      (a, b) => a + b,
      0
    );

    return allocation;
  }

  /**
   * Allocate support costs
   */
  async calculateSupportCost(
    userId: string,
    period: 'month' | 'year'
  ): Promise<number> {
    // Get user's support tickets
    const ticketsResult = await this.db.query(
      `SELECT COUNT(*) as count FROM support_tickets 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 ${period}'`,
      [userId]
    );

    const userTickets = ticketsResult.rows[0].count;

    // Get total support tickets
    const totalTicketsResult = await this.db.query(
      `SELECT COUNT(*) as count FROM support_tickets 
       WHERE created_at >= NOW() - INTERVAL '1 ${period}'`
    );

    const totalTickets = totalTicketsResult.rows[0].count;

    // Get total support costs
    const totalSupportCost = this.getTotalSupportCost(period);

    // Allocate based on ticket count
    return (userTickets / totalTickets) * totalSupportCost;
  }

  private async getTotalInfrastructureCosts(period: string): Promise<InfrastructureCosts> {
    // Implementation: Get from accounting system
    return {
      database: 1000,
      cache: 500,
      network: 2000,
      compute: 5000
    };
  }

  private async getUserMetrics(userId: string, period: string): Promise<UserMetrics> {
    // Implementation
    return {
      databaseQueries: 1000,
      cacheHits: 500,
      bandwidthUsed: 100,
      cpuUsagePercent: 5
    };
  }

  private async getPlatformMetrics(period: string): Promise<PlatformMetrics> {
    // Implementation
    return {
      totalDatabaseQueries: 1000000,
      totalCacheHits: 500000,
      totalBandwidth: 10000,
      totalCpuUsagePercent: 100
    };
  }

  private getTotalSupportCost(period: string): number {
    // Implementation
    return 5000;
  }
}

interface InfrastructureCostAllocation {
  userId: string;
  period: string;
  totalInfrastructureCosts: number;
  allocations: Record<string, number>;
  totalAllocated: number;
}

interface InfrastructureCosts {
  database: number;
  cache: number;
  network: number;
  compute: number;
}

interface UserMetrics {
  databaseQueries: number;
  cacheHits: number;
  bandwidthUsed: number;
  cpuUsagePercent: number;
}

interface PlatformMetrics {
  totalDatabaseQueries: number;
  totalCacheHits: number;
  totalBandwidth: number;
  totalCpuUsagePercent: number;
}
```

## 5. Billing and Invoicing

### 5.1 Comprehensive Billing System

```typescript
/**
 * Complete billing system with cost attribution
 */

class BillingSystem {
  /**
   * Generate invoice for user
   */
  async generateInvoice(
    userId: string,
    period: 'month' | 'year'
  ): Promise<Invoice> {
    // Get cost summary
    const costSummary = await this.costLedger.getUserCostSummary(userId, period);

    // Get infrastructure allocation
    const infraCost = await this.sharedCostAllocator.calculateInfrastructureCost(
      userId,
      period
    );

    // Get support cost
    const supportCost = await this.sharedCostAllocator.calculateSupportCost(
      userId,
      period
    );

    // Calculate subtotal
    const subtotal = costSummary.totalCost + infraCost.totalAllocated + supportCost;

    // Apply discounts
    const discounts = await this.calculateDiscounts(userId, subtotal);
    const discountAmount = Object.values(discounts).reduce((a, b) => a + b, 0);

    // Calculate tax
    const taxRate = 0.1; // 10%
    const taxableAmount = subtotal - discountAmount;
    const tax = taxableAmount * taxRate;

    // Calculate total
    const total = taxableAmount + tax;

    const invoice: Invoice = {
      invoiceId: this.generateInvoiceId(),
      userId,
      period,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lineItems: [
        {
          description: 'LLM API Usage',
          amount: costSummary.totalCost
        },
        {
          description: 'Infrastructure',
          amount: infraCost.totalAllocated
        },
        {
          description: 'Support',
          amount: supportCost
        }
      ],
      subtotal,
      discounts,
      discountAmount,
      tax,
      total
    };

    // Save invoice
    await this.saveInvoice(invoice);

    return invoice;
  }

  /**
   * Calculate applicable discounts
   */
  private async calculateDiscounts(userId: string, amount: number): Promise<Record<string, number>> {
    const discounts: Record<string, number> = {};

    // Volume discount
    const volumeDiscount = this.calculateVolumeDiscount(amount);
    if (volumeDiscount > 0) {
      discounts.volume = volumeDiscount;
    }

    // Loyalty discount
    const loyaltyDiscount = await this.calculateLoyaltyDiscount(userId);
    if (loyaltyDiscount > 0) {
      discounts.loyalty = loyaltyDiscount;
    }

    // Promotional discount
    const promoDiscount = await this.calculatePromoDiscount(userId);
    if (promoDiscount > 0) {
      discounts.promo = promoDiscount;
    }

    return discounts;
  }

  private calculateVolumeDiscount(amount: number): number {
    if (amount > 10000) return amount * 0.1; // 10% off
    if (amount > 5000) return amount * 0.05; // 5% off
    return 0;
  }

  private async calculateLoyaltyDiscount(userId: string): Promise<number> {
    // Implementation
    return 0;
  }

  private async calculatePromoDiscount(userId: string): Promise<number> {
    // Implementation
    return 0;
  }

  private generateInvoiceId(): string {
    return `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveInvoice(invoice: Invoice): Promise<void> {
    // Implementation
  }
}

interface Invoice {
  invoiceId: string;
  userId: string;
  period: string;
  issuedAt: Date;
  dueAt: Date;
  lineItems: LineItem[];
  subtotal: number;
  discounts: Record<string, number>;
  discountAmount: number;
  tax: number;
  total: number;
}

interface LineItem {
  description: string;
  amount: number;
}
```

## 6. Cost Attribution Comparison

| Model | Complexity | Fairness | Transparency | Best For |
|-------|-----------|----------|--------------|----------|
| **Winner-Takes-All** | Low | Low | Low | Simple platforms |
| **All-Attempts** | Low | High | High | Transparent billing |
| **Shared-Cost** | Medium | Medium | Medium | Balanced approach |
| **Tiered-Cost** | High | High | High | Enterprise platforms |

## 7. Implementation Checklist

- [ ] Choose cost attribution model
- [ ] Implement cost tracking system
- [ ] Set up cost ledger database
- [ ] Create billing system
- [ ] Implement invoice generation
- [ ] Add cost optimization strategies
- [ ] Set up anomaly detection
- [ ] Create cost reporting dashboard
- [ ] Implement discount system
- [ ] Add audit logging

## 8. Recommendations for Manus-like Platform

**Recommended Model: Tiered-Cost**
- Successful attempts: 100% cost
- Partial responses: 50% cost
- Failed attempts: 10% cost (infrastructure only)

**Cost Attribution Strategy:**
1. Track all provider attempts
2. Classify outcome (success, partial, failed)
3. Apply tiered pricing
4. Record in ledger
5. Generate invoice
6. Detect anomalies

**Transparency:**
- Show users cost breakdown
- Explain why costs vary
- Provide cost optimization tips
- Alert on cost anomalies

This ensures fair, transparent billing while incentivizing platform reliability!
