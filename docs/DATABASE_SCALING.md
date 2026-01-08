# Database Scaling: Multi-Tenant Strategies, Sharding, Replication, and Query Optimization

## Overview

Database scaling for multi-tenant platforms requires sophisticated strategies:

- **Sharding**: Horizontal partitioning across multiple databases
- **Read Replicas**: Distribute read load across replicas
- **Connection Pooling**: Manage database connections efficiently
- **Caching**: Reduce database load with caching layers
- **Query Optimization**: Efficient queries and indexing
- **Monitoring**: Track performance and bottlenecks

This guide covers complete database scaling strategies for platforms like Manus.

## 1. Multi-Tenant Database Architectures

### 1.1 Architecture Comparison

```typescript
/**
 * Three primary multi-tenant database architectures
 */

type MultiTenantArchitecture = 'shared-database' | 'database-per-tenant' | 'hybrid';

interface ArchitectureConfig {
  name: string;
  type: MultiTenantArchitecture;
  scalability: 'limited' | 'good' | 'excellent';
  isolation: 'low' | 'medium' | 'high';
  complexity: 'low' | 'medium' | 'high';
  costPerTenant: number;
  bestFor: string[];
  tradeoffs: string[];
}

const architectureComparison: Record<string, ArchitectureConfig> = {
  sharedDatabase: {
    name: 'Shared Database (Multi-Tenant)',
    type: 'shared-database',
    scalability: 'limited',
    isolation: 'low',
    complexity: 'low',
    costPerTenant: 0.01, // Very cheap per tenant
    bestFor: [
      'High number of small tenants (1000+)',
      'Cost-sensitive applications',
      'Simple data models',
      'Low data volumes per tenant'
    ],
    tradeoffs: [
      'Noisy neighbor problem',
      'Data isolation concerns',
      'Query complexity (tenant_id filtering)',
      'Difficult tenant migration',
      'Compliance/regulatory challenges'
    ]
  },

  databasePerTenant: {
    name: 'Database Per Tenant',
    type: 'database-per-tenant',
    scalability: 'excellent',
    isolation: 'high',
    complexity: 'high',
    costPerTenant: 0.5, // More expensive per tenant
    bestFor: [
      'Enterprise customers',
      'High data volumes per tenant',
      'Strict data isolation requirements',
      'Regulatory compliance (GDPR, HIPAA)',
      'Custom per-tenant configurations'
    ],
    tradeoffs: [
      'Operational complexity',
      'High infrastructure costs',
      'Difficult cross-tenant analytics',
      'Backup/restore complexity',
      'Schema migration challenges'
    ]
  },

  hybrid: {
    name: 'Hybrid (Sharded Multi-Tenant)',
    type: 'hybrid',
    scalability: 'excellent',
    isolation: 'medium',
    complexity: 'medium',
    costPerTenant: 0.1, // Balanced cost
    bestFor: [
      'Mixed tenant sizes',
      'Scalable multi-tenant platforms',
      'Good isolation with cost efficiency',
      'Flexible tenant placement',
      'Manus-like platforms'
    ],
    tradeoffs: [
      'Moderate operational complexity',
      'Shard rebalancing challenges',
      'Cross-shard queries difficult',
      'Requires careful shard key selection'
    ]
  }
};

class ArchitectureSelector {
  /**
   * Recommend best architecture
   */
  recommendArchitecture(requirements: DatabaseRequirements): ArchitectureConfig {
    // Shared database: many small tenants
    if (requirements.expectedTenants > 1000 && requirements.avgDataPerTenant < 100) {
      return architectureComparison.sharedDatabase;
    }

    // Database per tenant: enterprise, high isolation
    if (requirements.requiresHighIsolation || requirements.expectedTenants < 100) {
      return architectureComparison.databasePerTenant;
    }

    // Hybrid: balanced approach
    return architectureComparison.hybrid;
  }
}

interface DatabaseRequirements {
  expectedTenants: number;
  avgDataPerTenant: number; // MB
  requiresHighIsolation: boolean;
  requiresCompliance: boolean;
  expectedQPS: number; // Queries per second
}
```

## 2. Sharding Strategy (Recommended for Manus)

### 2.1 Sharding Implementation

```typescript
/**
 * Complete sharding implementation for multi-tenant database
 * 
 * Strategy: Hash-based sharding on tenant_id
 * - Distributes tenants evenly across shards
 * - Allows dynamic shard addition
 * - Supports rebalancing
 */

interface ShardConfig {
  shardId: number;
  minHash: number;
  maxHash: number;
  primaryHost: string;
  primaryPort: number;
  replicaHosts: string[];
  status: 'active' | 'rebalancing' | 'inactive';
}

class ShardingManager {
  private shards: Map<number, ShardConfig> = new Map();
  private consistentHash: ConsistentHash;
  private shardMetadata: Map<string, ShardMetadata> = new Map();

  constructor(shardCount: number = 16) {
    this.consistentHash = new ConsistentHash(shardCount);
    this.initializeShards(shardCount);
  }

  /**
   * Get shard for tenant
   */
  getShardForTenant(tenantId: string): ShardConfig {
    const shardId = this.consistentHash.getNode(tenantId);
    const shard = this.shards.get(shardId);

    if (!shard) {
      throw new Error(`Shard ${shardId} not found for tenant ${tenantId}`);
    }

    return shard;
  }

  /**
   * Get connection pool for tenant
   */
  async getConnectionForTenant(
    tenantId: string,
    readOnly: boolean = false
  ): Promise<DatabaseConnection> {
    const shard = this.getShardForTenant(tenantId);

    if (readOnly && shard.replicaHosts.length > 0) {
      // Load balance across replicas
      const replicaHost = this.selectReplica(shard);
      return this.createConnection(replicaHost, shard.primaryPort);
    }

    // Use primary for writes
    return this.createConnection(shard.primaryHost, shard.primaryPort);
  }

  /**
   * Add new shard
   */
  async addShard(shardId: number, primaryHost: string, replicaHosts: string[]): Promise<void> {
    const shardConfig: ShardConfig = {
      shardId,
      minHash: 0,
      maxHash: 0,
      primaryHost,
      replicaHosts,
      status: 'inactive'
    };

    this.shards.set(shardId, shardConfig);

    // Trigger rebalancing
    await this.rebalanceShards();
  }

  /**
   * Rebalance shards after adding/removing
   */
  private async rebalanceShards(): Promise<void> {
    const shardCount = this.shards.size;
    const hashSpace = 2 ** 32; // 32-bit hash space
    const rangePerShard = Math.floor(hashSpace / shardCount);

    let minHash = 0;
    for (let i = 0; i < shardCount; i++) {
      const shard = this.shards.get(i);
      if (shard) {
        shard.minHash = minHash;
        shard.maxHash = minHash + rangePerShard - 1;
        minHash += rangePerShard;
      }
    }

    // Migrate data between shards
    await this.migrateDataBetweenShards();
  }

  /**
   * Migrate data between shards
   */
  private async migrateDataBetweenShards(): Promise<void> {
    // Implementation: Move tenants to new shards
    // 1. Identify tenants to migrate
    // 2. Create migration jobs
    // 3. Copy data to new shard
    // 4. Verify data integrity
    // 5. Update routing table
    // 6. Delete from old shard
  }

  /**
   * Get shard statistics
   */
  async getShardStats(): Promise<ShardStatistics[]> {
    const stats: ShardStatistics[] = [];

    for (const [shardId, shard] of this.shards) {
      const conn = await this.createConnection(shard.primaryHost, shard.primaryPort);

      const result = await conn.query(`
        SELECT 
          COUNT(DISTINCT tenant_id) as tenant_count,
          SUM(data_size_bytes) as total_size,
          COUNT(*) as row_count
        FROM tenant_data
      `);

      stats.push({
        shardId,
        tenantCount: result.rows[0].tenant_count,
        totalSize: result.rows[0].total_size,
        rowCount: result.rows[0].row_count,
        status: shard.status
      });
    }

    return stats;
  }

  private selectReplica(shard: ShardConfig): string {
    // Load balance across replicas
    const randomIndex = Math.floor(Math.random() * shard.replicaHosts.length);
    return shard.replicaHosts[randomIndex];
  }

  private createConnection(host: string, port: number): DatabaseConnection {
    // Implementation
    return {} as DatabaseConnection;
  }

  private initializeShards(shardCount: number): void {
    // Implementation
  }
}

/**
 * Consistent hashing for shard selection
 */
class ConsistentHash {
  private ring: Map<number, number> = new Map();
  private nodes: number[] = [];
  private virtualNodes: number = 150; // Virtual nodes per shard

  constructor(nodeCount: number) {
    for (let i = 0; i < nodeCount; i++) {
      this.addNode(i);
    }
  }

  /**
   * Get node for key
   */
  getNode(key: string): number {
    const hash = this.hash(key);
    const nodes = Array.from(this.ring.keys()).sort((a, b) => a - b);

    for (const node of nodes) {
      if (hash <= node) {
        return this.ring.get(node)!;
      }
    }

    // Wrap around
    return this.ring.get(nodes[0])!;
  }

  /**
   * Add node to ring
   */
  private addNode(nodeId: number): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`node-${nodeId}-${i}`);
      this.ring.set(hash, nodeId);
      this.nodes.push(nodeId);
    }
  }

  /**
   * Hash function
   */
  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

interface ShardMetadata {
  tenantId: string;
  shardId: number;
  createdAt: Date;
  dataSize: number;
}

interface ShardStatistics {
  shardId: number;
  tenantCount: number;
  totalSize: number;
  rowCount: number;
  status: string;
}

interface DatabaseConnection {
  query(sql: string): Promise<any>;
}
```

## 3. Read Replicas and Load Balancing

### 3.1 Read Replica Strategy

```typescript
/**
 * Read replica management and load balancing
 */

interface ReplicaConfig {
  replicaId: string;
  primaryHost: string;
  replicaHost: string;
  lagThreshold: number; // ms
  status: 'synced' | 'lagging' | 'failed';
}

class ReadReplicaManager {
  private replicas: Map<string, ReplicaConfig> = new Map();
  private replicaHealth: Map<string, ReplicaHealth> = new Map();
  private connectionPool: ConnectionPool;

  /**
   * Route read query to best replica
   */
  async routeReadQuery(
    tenantId: string,
    query: string,
    consistency: 'eventual' | 'strong' = 'eventual'
  ): Promise<QueryResult> {
    if (consistency === 'strong') {
      // Read from primary for strong consistency
      return await this.queryPrimary(tenantId, query);
    }

    // Route to healthy replica for eventual consistency
    const replica = await this.selectHealthyReplica(tenantId);

    if (!replica) {
      // Fall back to primary if no healthy replicas
      return await this.queryPrimary(tenantId, query);
    }

    return await this.queryReplica(replica, query);
  }

  /**
   * Select best replica based on health
   */
  private async selectHealthyReplica(tenantId: string): Promise<ReplicaConfig | null> {
    const replicas = Array.from(this.replicas.values());

    // Filter healthy replicas
    const healthyReplicas = replicas.filter(r => {
      const health = this.replicaHealth.get(r.replicaId);
      return health && health.status === 'healthy' && health.lag < r.lagThreshold;
    });

    if (healthyReplicas.length === 0) {
      return null;
    }

    // Select replica with lowest lag
    return healthyReplicas.reduce((best, current) => {
      const bestHealth = this.replicaHealth.get(best.replicaId)!;
      const currentHealth = this.replicaHealth.get(current.replicaId)!;

      return currentHealth.lag < bestHealth.lag ? current : best;
    });
  }

  /**
   * Monitor replica health
   */
  async monitorReplicaHealth(): Promise<void> {
    setInterval(async () => {
      for (const [replicaId, replica] of this.replicas) {
        try {
          // Check replica lag
          const lagResult = await this.queryReplica(replica, `
            SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as lag_seconds
          `);

          const lagSeconds = lagResult.rows[0].lag_seconds || 0;

          // Check replica connectivity
          const health: ReplicaHealth = {
            replicaId,
            status: lagSeconds < (replica.lagThreshold / 1000) ? 'healthy' : 'lagging',
            lag: lagSeconds * 1000,
            lastCheck: new Date(),
            errorCount: 0
          };

          this.replicaHealth.set(replicaId, health);
        } catch (error) {
          // Mark replica as failed
          const health = this.replicaHealth.get(replicaId) || {
            replicaId,
            status: 'failed',
            lag: Infinity,
            lastCheck: new Date(),
            errorCount: 0
          };

          health.status = 'failed';
          health.errorCount++;
          this.replicaHealth.set(replicaId, health);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  private async queryPrimary(tenantId: string, query: string): Promise<QueryResult> {
    // Implementation
    return { rows: [] };
  }

  private async queryReplica(replica: ReplicaConfig, query: string): Promise<QueryResult> {
    // Implementation
    return { rows: [] };
  }
}

interface ReplicaHealth {
  replicaId: string;
  status: 'healthy' | 'lagging' | 'failed';
  lag: number; // milliseconds
  lastCheck: Date;
  errorCount: number;
}

interface QueryResult {
  rows: any[];
}
```

## 4. Connection Pooling

### 4.1 PgBouncer Configuration

```ini
; PgBouncer configuration for connection pooling
; Handles thousands of client connections efficiently

[databases]
; Shard 1
shard_1 = host=shard1.db.internal port=5432 dbname=tenant_db

; Shard 2
shard_2 = host=shard2.db.internal port=5432 dbname=tenant_db

; Shard 3
shard_3 = host=shard3.db.internal port=5432 dbname=tenant_db

; Shard 4
shard_4 = host=shard4.db.internal port=5432 dbname=tenant_db

[pgbouncer]
; Connection pooling parameters
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3

; Performance tuning
tcp_keepalives = 1
tcp_keepalives_idle = 600
tcp_keepalives_interval = 30
tcp_keepalives_count = 5

; Query timeout
query_timeout = 0
query_wait_timeout = 120
idle_in_transaction_session_timeout = 0

; Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60

; Authentication
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
```

### 4.2 Connection Pool Management

```typescript
/**
 * Advanced connection pool management
 */

class ConnectionPoolManager {
  private pools: Map<string, ConnectionPool> = new Map();
  private poolStats: Map<string, PoolStatistics> = new Map();

  /**
   * Get connection from pool
   */
  async getConnection(
    tenantId: string,
    readOnly: boolean = false
  ): Promise<PooledConnection> {
    const poolKey = `${tenantId}:${readOnly ? 'read' : 'write'}`;

    let pool = this.pools.get(poolKey);
    if (!pool) {
      pool = await this.createPool(tenantId, readOnly);
      this.pools.set(poolKey, pool);
    }

    return await pool.acquire();
  }

  /**
   * Return connection to pool
   */
  async releaseConnection(conn: PooledConnection): Promise<void> {
    await conn.pool.release(conn);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): PoolStatistics[] {
    return Array.from(this.poolStats.values());
  }

  /**
   * Monitor pool health
   */
  async monitorPoolHealth(): Promise<void> {
    setInterval(() => {
      for (const [poolKey, pool] of this.pools) {
        const stats = pool.getStats();

        this.poolStats.set(poolKey, {
          poolKey,
          activeConnections: stats.activeConnections,
          idleConnections: stats.idleConnections,
          waitingRequests: stats.waitingRequests,
          totalConnections: stats.totalConnections,
          utilizationPercent: (stats.activeConnections / stats.totalConnections) * 100,
          avgWaitTime: stats.avgWaitTime,
          maxWaitTime: stats.maxWaitTime
        });

        // Alert if utilization too high
        if (stats.activeConnections / stats.totalConnections > 0.9) {
          console.warn(`Pool ${poolKey} utilization at 90%`);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private async createPool(tenantId: string, readOnly: boolean): Promise<ConnectionPool> {
    // Implementation
    return {} as ConnectionPool;
  }
}

interface PooledConnection {
  pool: ConnectionPool;
  query(sql: string): Promise<any>;
  release(): Promise<void>;
}

interface ConnectionPool {
  acquire(): Promise<PooledConnection>;
  release(conn: PooledConnection): Promise<void>;
  getStats(): PoolStats;
}

interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  avgWaitTime: number;
  maxWaitTime: number;
}

interface PoolStatistics {
  poolKey: string;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  utilizationPercent: number;
  avgWaitTime: number;
  maxWaitTime: number;
}
```

## 5. Caching Strategy

### 5.1 Multi-Level Caching

```typescript
/**
 * Multi-level caching to reduce database load
 * 
 * Levels:
 * 1. Application-level cache (in-memory)
 * 2. Redis cache (distributed)
 * 3. Database (source of truth)
 */

class CachingStrategy {
  private localCache: Map<string, CachedValue> = new Map();
  private redis: RedisClient;
  private cacheConfig = {
    localTTL: 5 * 60 * 1000, // 5 minutes
    redisTTL: 30 * 60, // 30 minutes
    maxLocalCacheSize: 10000
  };

  /**
   * Get value with caching
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.cacheConfig.redisTTL
  ): Promise<T> {
    // 1. Check local cache
    const localValue = this.localCache.get(key);
    if (localValue && !this.isExpired(localValue)) {
      return localValue.value as T;
    }

    // 2. Check Redis cache
    try {
      const redisValue = await this.redis.get(key);
      if (redisValue) {
        const value = JSON.parse(redisValue);
        this.setLocal(key, value);
        return value as T;
      }
    } catch (error) {
      console.warn(`Redis get failed for ${key}:`, error);
    }

    // 3. Fetch from database
    const value = await fetcher();

    // 4. Store in caches
    this.setLocal(key, value);
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.warn(`Redis set failed for ${key}:`, error);
    }

    return value;
  }

  /**
   * Invalidate cache
   */
  async invalidate(key: string): Promise<void> {
    // Remove from local cache
    this.localCache.delete(key);

    // Remove from Redis
    try {
      await this.redis.del(key);
    } catch (error) {
      console.warn(`Redis delete failed for ${key}:`, error);
    }
  }

  /**
   * Batch invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Remove from local cache
    for (const key of this.localCache.keys()) {
      if (this.matchesPattern(key, pattern)) {
        this.localCache.delete(key);
      }
    }

    // Remove from Redis
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.warn(`Redis pattern delete failed for ${pattern}:`, error);
    }
  }

  private setLocal<T>(key: string, value: T): void {
    // Evict oldest if cache full
    if (this.localCache.size >= this.cacheConfig.maxLocalCacheSize) {
      const oldestKey = Array.from(this.localCache.entries()).sort(
        (a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime()
      )[0][0];

      this.localCache.delete(oldestKey);
    }

    this.localCache.set(key, {
      value,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.cacheConfig.localTTL)
    });
  }

  private isExpired(cached: CachedValue): boolean {
    return cached.expiresAt.getTime() < Date.now();
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }
}

interface CachedValue {
  value: any;
  createdAt: Date;
  expiresAt: Date;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}
```

## 6. Query Optimization

### 6.1 Query Optimization Strategies

```typescript
/**
 * Query optimization for multi-tenant workloads
 */

class QueryOptimizer {
  /**
   * Optimize query with tenant isolation
   */
  optimizeQuery(
    baseQuery: string,
    tenantId: string,
    params: any[] = []
  ): OptimizedQuery {
    // 1. Add tenant_id filter
    let optimizedQuery = baseQuery;

    if (!optimizedQuery.includes('tenant_id')) {
      // Add tenant_id to WHERE clause
      if (optimizedQuery.includes('WHERE')) {
        optimizedQuery = optimizedQuery.replace(
          'WHERE',
          `WHERE tenant_id = $${params.length + 1} AND`
        );
      } else {
        optimizedQuery += ` WHERE tenant_id = $${params.length + 1}`;
      }
    }

    // 2. Add query hints
    optimizedQuery = this.addQueryHints(optimizedQuery);

    // 3. Analyze query plan
    const plan = this.analyzeQueryPlan(optimizedQuery);

    // 4. Suggest indexes
    const suggestedIndexes = this.suggestIndexes(plan);

    return {
      query: optimizedQuery,
      params: [...params, tenantId],
      plan,
      suggestedIndexes,
      estimatedCost: plan.totalCost
    };
  }

  /**
   * Add query hints for optimization
   */
  private addQueryHints(query: string): string {
    // Add hints based on query type
    if (query.includes('SELECT') && query.includes('JOIN')) {
      // Add join order hints
      query = `/*+ BKA(t1) */ ${query}`;
    }

    return query;
  }

  /**
   * Analyze query execution plan
   */
  private analyzeQueryPlan(query: string): QueryPlan {
    // Implementation: Execute EXPLAIN ANALYZE
    return {
      totalCost: 0,
      rowsReturned: 0,
      executionTime: 0,
      nodes: []
    };
  }

  /**
   * Suggest indexes for query
   */
  private suggestIndexes(plan: QueryPlan): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];

    // Look for sequential scans
    for (const node of plan.nodes) {
      if (node.type === 'Seq Scan' && node.rows > 1000) {
        suggestions.push({
          table: node.table,
          columns: node.filter?.split('=')[0].trim().split(',') || [],
          type: 'btree',
          estimatedImprovement: '50-80%'
        });
      }
    }

    return suggestions;
  }
}

interface OptimizedQuery {
  query: string;
  params: any[];
  plan: QueryPlan;
  suggestedIndexes: IndexSuggestion[];
  estimatedCost: number;
}

interface QueryPlan {
  totalCost: number;
  rowsReturned: number;
  executionTime: number;
  nodes: PlanNode[];
}

interface PlanNode {
  type: string;
  table?: string;
  rows: number;
  filter?: string;
}

interface IndexSuggestion {
  table: string;
  columns: string[];
  type: string;
  estimatedImprovement: string;
}
```

## 7. Recommended Database Architecture for Manus

### 7.1 Production Setup

```typescript
/**
 * Recommended database architecture for Manus-like platform
 */

const recommendedDatabaseArchitecture = {
  strategy: 'Hybrid Sharding',
  
  sharding: {
    shardCount: 16,
    shardKey: 'tenant_id',
    hashFunction: 'consistent-hash',
    rebalancingStrategy: 'gradual'
  },

  replicas: {
    replicasPerShard: 2,
    replicationMode: 'asynchronous',
    lagThreshold: 1000, // 1 second
    readLoadBalancing: 'round-robin'
  },

  connectionPooling: {
    tool: 'PgBouncer',
    poolMode: 'transaction',
    maxClientConnections: 10000,
    defaultPoolSize: 25,
    minPoolSize: 10,
    reservePoolSize: 5
  },

  caching: {
    localCache: {
      enabled: true,
      ttl: 300, // 5 minutes
      maxSize: 10000
    },
    distributedCache: {
      tool: 'Redis',
      ttl: 1800, // 30 minutes
      replicas: 3,
      persistence: true
    }
  },

  monitoring: {
    queryLogging: true,
    slowQueryThreshold: 1000, // 1 second
    replicationLagMonitoring: true,
    connectionPoolMonitoring: true
  },

  estimatedCapacity: {
    tenantsPerShard: 1000,
    totalTenants: 16000,
    queriesPerSecond: 100000,
    dataPerTenant: 500, // MB
    totalDataSize: 8, // TB
    monthlyGrowth: 0.1 // 10%
  },

  estimatedCosts: {
    databaseInstances: 48, // 16 shards * 3 (primary + 2 replicas)
    costPerInstance: 500, // $500/month
    monthlyDatabaseCost: 24000,
    redisCluster: 5000,
    pgbouncer: 1000,
    monitoring: 2000,
    totalMonthly: 32000
  }
};
```

## 8. Implementation Checklist

- [ ] Choose sharding strategy (recommend: hash-based)
- [ ] Set up shard infrastructure
- [ ] Configure read replicas
- [ ] Implement connection pooling (PgBouncer)
- [ ] Set up caching layer (Redis)
- [ ] Implement query optimization
- [ ] Configure monitoring
- [ ] Set up backup/disaster recovery
- [ ] Test failover scenarios
- [ ] Load test at scale

## 9. Recommendations for Manus-like Platform

**Database Architecture:**
- **Strategy**: Hybrid sharding (16 shards)
- **Replicas**: 2 per shard (3 total per shard)
- **Connection Pooling**: PgBouncer (transaction mode)
- **Caching**: Multi-level (local + Redis)
- **Total Instances**: 48 PostgreSQL instances

**Scaling Path:**
1. **Phase 1** (0-1000 tenants): Single database with read replicas
2. **Phase 2** (1000-10000 tenants): 4 shards with replicas
3. **Phase 3** (10000-100000 tenants): 16 shards with replicas
4. **Phase 4** (100000+ tenants): 64+ shards with advanced sharding

**Performance Targets:**
- **Query latency**: <50ms (p99)
- **Connection pool utilization**: <70%
- **Replica lag**: <1 second
- **Cache hit rate**: >80%
- **Database CPU**: <70%

This comprehensive approach ensures database scalability for multi-tenant platforms serving thousands of tenants!
