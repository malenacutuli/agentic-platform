# Cold Start Optimization and Warm Pools

This guide provides comprehensive coverage of sandbox cold start times, warm pool strategies, and container startup optimization techniques for achieving sub-second sandbox availability.

---

## Table of Contents

1. [Cold Start Overview](#cold-start-overview)
2. [Cold Start Time Breakdown](#cold-start-time-breakdown)
3. [Warm Pool Architecture](#warm-pool-architecture)
4. [Container Startup Optimization](#container-startup-optimization)
5. [Image Layering Strategy](#image-layering-strategy)
6. [Lazy Loading and Prefetching](#lazy-loading-and-prefetching)
7. [Monitoring and Metrics](#monitoring-and-metrics)

---

## Cold Start Overview

### Cold Start Timeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           COLD START TIMELINE                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  REQUEST                                                                                │
│     │                                                                                   │
│     ▼                                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Schedule│  │  Pull   │  │ Create  │  │  Start  │  │  Init   │  │  Ready  │         │
│  │   Pod   │  │  Image  │  │Container│  │ Process │  │  App    │  │         │         │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│       │            │            │            │            │            │               │
│  T+0ms│      T+50ms│     T+200ms│     T+500ms│    T+1000ms│    T+2000ms│               │
│       │            │            │            │            │            │               │
│       ▼            ▼            ▼            ▼            ▼            ▼               │
│  ════════════════════════════════════════════════════════════════════════             │
│  │◄──────────────────── COLD START: 2-5 seconds ────────────────────►│               │
│  ════════════════════════════════════════════════════════════════════════             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cold Start Times by Scenario

| Scenario | Time | Notes |
|----------|------|-------|
| **Empty sandbox** | 2-3s | Base container only |
| **With Node.js deps** | 3-5s | node_modules cached |
| **With Python deps** | 3-6s | venv cached |
| **With build cache** | 2-4s | Incremental builds |
| **From warm pool** | 100-300ms | Pre-initialized |
| **From hibernation** | 500ms-2s | State restore |

---

## Cold Start Time Breakdown

### Phase-by-Phase Analysis

```typescript
// server/sandbox/coldStartAnalyzer.ts

interface ColdStartMetrics {
  scheduling: number;      // Pod scheduling
  imagePull: number;       // Container image pull
  containerCreate: number; // Container creation
  processStart: number;    // Process initialization
  appInit: number;         // Application startup
  total: number;           // Total cold start time
}

const typicalColdStart: ColdStartMetrics = {
  scheduling: 50,        // 50ms - K8s scheduler
  imagePull: 0,          // 0ms if cached, 2-10s if not
  containerCreate: 150,  // 150ms - container runtime
  processStart: 300,     // 300ms - process spawn
  appInit: 1500,         // 1500ms - app initialization
  total: 2000,           // ~2s total (cached image)
};

const worstCaseColdStart: ColdStartMetrics = {
  scheduling: 500,       // 500ms - busy cluster
  imagePull: 10000,      // 10s - large image, slow registry
  containerCreate: 500,  // 500ms - resource contention
  processStart: 1000,    // 1s - slow disk
  appInit: 5000,         // 5s - heavy dependencies
  total: 17000,          // ~17s worst case
};
```

### Cold Start by Template Type

| Template | Base Image | Dependencies | Typical Cold Start |
|----------|------------|--------------|-------------------|
| **Static HTML** | nginx:alpine | None | 1.5s |
| **React (Vite)** | node:20-slim | ~200MB | 2.5s |
| **Next.js** | node:20-slim | ~400MB | 3.5s |
| **Python Flask** | python:3.11-slim | ~150MB | 2.8s |
| **FastAPI** | python:3.11-slim | ~200MB | 3.0s |
| **Go** | golang:1.21-alpine | ~50MB | 2.0s |
| **Full Stack** | node:20 | ~600MB | 4.5s |

---

## Warm Pool Architecture

### Warm Pool Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           WARM POOL ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              WARM POOL MANAGER                                   │   │
│  │  ├── Pool sizing algorithm                                                      │   │
│  │  ├── Template affinity                                                          │   │
│  │  ├── Health monitoring                                                          │   │
│  │  └── Auto-scaling                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                               │
│           ┌────────────────────────────┼────────────────────────────┐                 │
│           ▼                            ▼                            ▼                 │
│  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐           │
│  │  Generic Pool   │        │  React Pool     │        │  Python Pool    │           │
│  │  ┌───┐ ┌───┐   │        │  ┌───┐ ┌───┐   │        │  ┌───┐ ┌───┐   │           │
│  │  │ S │ │ S │   │        │  │ S │ │ S │   │        │  │ S │ │ S │   │           │
│  │  └───┘ └───┘   │        │  └───┘ └───┘   │        │  └───┘ └───┘   │           │
│  │  ┌───┐ ┌───┐   │        │  ┌───┐ ┌───┐   │        │  ┌───┐         │           │
│  │  │ S │ │ S │   │        │  │ S │ │ S │   │        │  │ S │         │           │
│  │  └───┘ └───┘   │        │  └───┘ └───┘   │        │  └───┘         │           │
│  │  Size: 10      │        │  Size: 8       │        │  Size: 5       │           │
│  └─────────────────┘        └─────────────────┘        └─────────────────┘           │
│                                                                                         │
│  S = Pre-warmed Sandbox (ready to assign)                                              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Warm Pool Manager

```typescript
// server/sandbox/warmPoolManager.ts

interface WarmPool {
  id: string;
  template: string;
  targetSize: number;
  currentSize: number;
  available: string[];  // Ready sandbox IDs
  creating: string[];   // Being created
  lastScaleTime: Date;
}

interface PoolConfig {
  template: string;
  minSize: number;
  maxSize: number;
  targetUtilization: number;  // 0.7 = 70%
  scaleUpThreshold: number;   // Available < threshold triggers scale up
  scaleDownDelay: number;     // Seconds before scale down
  ttl: number;                // Max age of warm sandbox
}

class WarmPoolManager {
  private pools: Map<string, WarmPool> = new Map();
  private configs: Map<string, PoolConfig> = new Map();

  constructor() {
    this.initializeDefaultPools();
    this.startMaintenanceLoop();
  }

  /**
   * Initialize default warm pools
   */
  private initializeDefaultPools(): void {
    const defaultConfigs: PoolConfig[] = [
      {
        template: 'generic',
        minSize: 5,
        maxSize: 50,
        targetUtilization: 0.7,
        scaleUpThreshold: 2,
        scaleDownDelay: 300,
        ttl: 3600,
      },
      {
        template: 'react-vite',
        minSize: 3,
        maxSize: 30,
        targetUtilization: 0.7,
        scaleUpThreshold: 2,
        scaleDownDelay: 300,
        ttl: 3600,
      },
      {
        template: 'nextjs',
        minSize: 2,
        maxSize: 20,
        targetUtilization: 0.7,
        scaleUpThreshold: 1,
        scaleDownDelay: 300,
        ttl: 3600,
      },
      {
        template: 'python-fastapi',
        minSize: 2,
        maxSize: 15,
        targetUtilization: 0.7,
        scaleUpThreshold: 1,
        scaleDownDelay: 300,
        ttl: 3600,
      },
    ];

    for (const config of defaultConfigs) {
      this.configs.set(config.template, config);
      this.createPool(config.template);
    }
  }

  /**
   * Acquire a warm sandbox
   */
  async acquire(template: string): Promise<{
    sandboxId: string;
    fromWarmPool: boolean;
    acquisitionTime: number;
  }> {
    const startTime = Date.now();
    const pool = this.pools.get(template) || this.pools.get('generic');

    if (pool && pool.available.length > 0) {
      // Get from warm pool
      const sandboxId = pool.available.shift()!;
      pool.currentSize--;
      
      // Trigger background replenishment
      this.replenishPool(pool.id);

      return {
        sandboxId,
        fromWarmPool: true,
        acquisitionTime: Date.now() - startTime,
      };
    }

    // Cold start - create new sandbox
    const sandboxId = await this.createSandbox(template);
    
    return {
      sandboxId,
      fromWarmPool: false,
      acquisitionTime: Date.now() - startTime,
    };
  }

  /**
   * Release sandbox back to pool or terminate
   */
  async release(sandboxId: string, template: string): Promise<void> {
    const pool = this.pools.get(template);
    const config = this.configs.get(template);

    if (pool && config && pool.currentSize < config.maxSize) {
      // Reset sandbox state and return to pool
      await this.resetSandbox(sandboxId);
      pool.available.push(sandboxId);
      pool.currentSize++;
    } else {
      // Terminate sandbox
      await this.terminateSandbox(sandboxId);
    }
  }

  /**
   * Dynamic pool sizing based on demand
   */
  private async adjustPoolSize(poolId: string): Promise<void> {
    const pool = this.pools.get(poolId);
    const config = this.configs.get(pool?.template || '');
    
    if (!pool || !config) return;

    const utilizationRate = 1 - (pool.available.length / pool.currentSize);
    
    // Scale up if utilization is high
    if (pool.available.length < config.scaleUpThreshold && 
        pool.currentSize < config.maxSize) {
      const scaleUpCount = Math.min(
        config.maxSize - pool.currentSize,
        Math.ceil(pool.currentSize * 0.5)  // Scale up by 50%
      );
      
      for (let i = 0; i < scaleUpCount; i++) {
        this.createWarmSandbox(pool);
      }
    }
    
    // Scale down if utilization is low
    if (utilizationRate < config.targetUtilization * 0.5 &&
        pool.currentSize > config.minSize) {
      const now = Date.now();
      if (now - pool.lastScaleTime.getTime() > config.scaleDownDelay * 1000) {
        const scaleDownCount = Math.min(
          pool.available.length - config.scaleUpThreshold,
          Math.ceil(pool.currentSize * 0.2)  // Scale down by 20%
        );
        
        for (let i = 0; i < scaleDownCount; i++) {
          const sandboxId = pool.available.pop();
          if (sandboxId) {
            await this.terminateSandbox(sandboxId);
            pool.currentSize--;
          }
        }
        pool.lastScaleTime = new Date();
      }
    }
  }

  /**
   * Create warm sandbox in background
   */
  private async createWarmSandbox(pool: WarmPool): Promise<void> {
    const sandboxId = `warm-${pool.template}-${Date.now()}`;
    pool.creating.push(sandboxId);

    try {
      await this.createSandbox(pool.template);
      await this.initializeSandbox(sandboxId, pool.template);
      
      pool.creating = pool.creating.filter(id => id !== sandboxId);
      pool.available.push(sandboxId);
      pool.currentSize++;
    } catch (error) {
      pool.creating = pool.creating.filter(id => id !== sandboxId);
      console.error(`Failed to create warm sandbox: ${error}`);
    }
  }

  /**
   * Maintenance loop
   */
  private startMaintenanceLoop(): void {
    setInterval(async () => {
      for (const [poolId] of this.pools) {
        await this.adjustPoolSize(poolId);
        await this.cleanupExpiredSandboxes(poolId);
      }
    }, 10000);  // Every 10 seconds
  }
}
```

### Predictive Pool Sizing

```typescript
// server/sandbox/predictivePooling.ts

interface DemandPrediction {
  timestamp: Date;
  template: string;
  predictedDemand: number;
  confidence: number;
}

class PredictivePoolSizer {
  private historicalData: Map<string, number[]> = new Map();

  /**
   * Predict demand for next hour
   */
  predictDemand(template: string): DemandPrediction {
    const history = this.historicalData.get(template) || [];
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Simple time-based prediction
    const hourlyPattern = this.getHourlyPattern(template);
    const dayPattern = this.getDayPattern(template);
    
    const baseDemand = this.getAverageDemand(template);
    const hourMultiplier = hourlyPattern[hour] || 1;
    const dayMultiplier = dayPattern[dayOfWeek] || 1;

    const predictedDemand = Math.ceil(
      baseDemand * hourMultiplier * dayMultiplier
    );

    return {
      timestamp: new Date(),
      template,
      predictedDemand,
      confidence: history.length > 100 ? 0.8 : 0.5,
    };
  }

  /**
   * Get hourly demand pattern
   */
  private getHourlyPattern(template: string): number[] {
    // Typical pattern: low at night, peak during work hours
    return [
      0.3, 0.2, 0.2, 0.2, 0.3, 0.4,  // 00:00-05:00
      0.6, 0.8, 1.0, 1.2, 1.3, 1.2,  // 06:00-11:00
      1.0, 1.1, 1.3, 1.4, 1.3, 1.2,  // 12:00-17:00
      1.0, 0.9, 0.8, 0.7, 0.5, 0.4,  // 18:00-23:00
    ];
  }

  /**
   * Adjust pool based on prediction
   */
  async adjustPoolForPrediction(
    poolManager: WarmPoolManager,
    template: string
  ): Promise<void> {
    const prediction = this.predictDemand(template);
    const currentSize = poolManager.getPoolSize(template);
    
    // Pre-warm if predicted demand is higher
    if (prediction.predictedDemand > currentSize * 0.8) {
      const targetSize = Math.ceil(prediction.predictedDemand * 1.2);
      await poolManager.setTargetSize(template, targetSize);
    }
  }
}
```

---

## Container Startup Optimization

### Optimized Dockerfile

```dockerfile
# Dockerfile.optimized

# Stage 1: Base with system dependencies (rarely changes)
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Dependencies (changes with package.json)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Stage 3: Runtime (minimal)
FROM base AS runtime
WORKDIR /app

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Pre-compile TypeScript
RUN npm run build

# Optimize for startup
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "dist/server.js"]
```

### Startup Optimization Techniques

```typescript
// server/sandbox/startupOptimizer.ts

interface StartupOptimization {
  name: string;
  impact: string;
  implementation: string;
}

const optimizations: StartupOptimization[] = [
  {
    name: 'Image Pre-pulling',
    impact: '-2-10s (eliminates pull time)',
    implementation: `
      // Pre-pull images to all nodes
      kubectl create daemonset image-prepuller --image=registry/sandbox:latest
    `,
  },
  {
    name: 'Layer Caching',
    impact: '-50-80% image pull time',
    implementation: `
      // Order Dockerfile commands by change frequency
      // Least changing → Most changing
      COPY package.json .
      RUN npm install
      COPY src/ .
    `,
  },
  {
    name: 'Slim Base Images',
    impact: '-30-50% image size',
    implementation: `
      // Use slim/alpine variants
      FROM node:20-slim     # 200MB vs 1GB
      FROM python:3.11-slim # 150MB vs 900MB
    `,
  },
  {
    name: 'Multi-stage Builds',
    impact: '-40-70% final image size',
    implementation: `
      // Build in one stage, copy artifacts to minimal runtime
      FROM node:20 AS builder
      RUN npm run build
      
      FROM node:20-slim AS runtime
      COPY --from=builder /app/dist ./dist
    `,
  },
  {
    name: 'Lazy Module Loading',
    impact: '-20-40% startup time',
    implementation: `
      // Defer non-critical imports
      const heavyModule = await import('./heavy-module');
    `,
  },
  {
    name: 'Connection Pooling',
    impact: '-100-500ms per connection',
    implementation: `
      // Pre-establish database connections
      const pool = new Pool({ min: 2, max: 10 });
      await pool.connect(); // Warm up
    `,
  },
];
```

### Container Runtime Optimization

```yaml
# kubernetes/sandbox-pod-optimized.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-optimized
spec:
  # Use node-local image cache
  imagePullPolicy: IfNotPresent
  
  # Fast scheduling
  priorityClassName: high-priority
  
  # Resource requests for fast scheduling
  containers:
  - name: sandbox
    image: registry/sandbox:latest
    resources:
      requests:
        cpu: "100m"      # Low request = fast scheduling
        memory: "256Mi"
      limits:
        cpu: "2000m"     # High limit = burst capacity
        memory: "2Gi"
    
    # Startup probe for readiness
    startupProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 1
      periodSeconds: 1
      failureThreshold: 30  # 30s max startup
    
    # Lifecycle hooks
    lifecycle:
      postStart:
        exec:
          command: ["/bin/sh", "-c", "warm-cache.sh"]
```

---

## Image Layering Strategy

### Layer Organization

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           IMAGE LAYER STRATEGY                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Layer 7: Application Code (changes frequently)                    ~10MB        │   │
│  │  └── src/, config files, assets                                                 │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Layer 6: Build Artifacts (changes with code)                      ~50MB        │   │
│  │  └── dist/, .next/, __pycache__                                                 │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Layer 5: Project Dependencies (changes with package.json)         ~200MB       │   │
│  │  └── node_modules/, venv/, vendor/                                              │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Layer 4: Global Tools (changes rarely)                            ~100MB       │   │
│  │  └── pnpm, pip, cargo, go                                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Layer 3: System Packages (changes rarely)                         ~50MB        │   │
│  │  └── git, curl, build-essential                                                 │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Layer 2: Runtime (changes with version updates)                   ~100MB       │   │
│  │  └── node, python, go binary                                                    │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Layer 1: Base OS (changes rarely)                                 ~30MB        │   │
│  │  └── debian-slim, alpine                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  TOTAL: ~540MB (optimized from ~1.5GB)                                                 │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Shared Base Images

```typescript
// server/images/baseImageManager.ts

interface BaseImage {
  name: string;
  tag: string;
  size: string;
  layers: string[];
  templates: string[];
}

const baseImages: BaseImage[] = [
  {
    name: 'sandbox-base',
    tag: 'v1.0',
    size: '180MB',
    layers: ['debian-slim', 'system-packages', 'global-tools'],
    templates: ['all'],
  },
  {
    name: 'sandbox-node',
    tag: 'v1.0',
    size: '280MB',
    layers: ['sandbox-base', 'node-20', 'pnpm'],
    templates: ['react', 'nextjs', 'express', 'vite'],
  },
  {
    name: 'sandbox-python',
    tag: 'v1.0',
    size: '250MB',
    layers: ['sandbox-base', 'python-3.11', 'pip', 'poetry'],
    templates: ['flask', 'fastapi', 'django'],
  },
  {
    name: 'sandbox-go',
    tag: 'v1.0',
    size: '220MB',
    layers: ['sandbox-base', 'go-1.21'],
    templates: ['go-api', 'go-cli'],
  },
];
```

---

## Lazy Loading and Prefetching

### Lazy Loading Strategy

```typescript
// server/sandbox/lazyLoader.ts

interface LazyLoadConfig {
  critical: string[];      // Load immediately
  deferred: string[];      // Load after startup
  onDemand: string[];      // Load when needed
}

const lazyLoadConfigs: Record<string, LazyLoadConfig> = {
  'react-vite': {
    critical: ['vite', 'react', 'react-dom'],
    deferred: ['typescript', 'eslint', '@types/*'],
    onDemand: ['vitest', 'playwright', 'storybook'],
  },
  'nextjs': {
    critical: ['next', 'react', 'react-dom'],
    deferred: ['typescript', 'tailwindcss', 'postcss'],
    onDemand: ['jest', 'cypress', '@next/bundle-analyzer'],
  },
  'python-fastapi': {
    critical: ['fastapi', 'uvicorn', 'pydantic'],
    deferred: ['sqlalchemy', 'alembic', 'python-jose'],
    onDemand: ['pytest', 'black', 'mypy'],
  },
};

class LazyLoader {
  /**
   * Initialize with critical dependencies only
   */
  async initializeCritical(template: string): Promise<void> {
    const config = lazyLoadConfigs[template];
    if (!config) return;

    // Only install critical packages
    await this.installPackages(config.critical);
  }

  /**
   * Load deferred dependencies in background
   */
  async loadDeferred(template: string): Promise<void> {
    const config = lazyLoadConfigs[template];
    if (!config) return;

    // Install deferred packages without blocking
    setImmediate(async () => {
      await this.installPackages(config.deferred);
    });
  }

  /**
   * Load on-demand when requested
   */
  async loadOnDemand(template: string, packages: string[]): Promise<void> {
    const config = lazyLoadConfigs[template];
    if (!config) return;

    const toInstall = packages.filter(p => 
      config.onDemand.some(od => p.match(od))
    );

    if (toInstall.length > 0) {
      await this.installPackages(toInstall);
    }
  }
}
```

### Prefetching Strategy

```typescript
// server/sandbox/prefetcher.ts

interface PrefetchRule {
  trigger: string;           // What triggers prefetch
  resources: string[];       // What to prefetch
  priority: 'high' | 'medium' | 'low';
}

const prefetchRules: PrefetchRule[] = [
  {
    trigger: 'user_login',
    resources: ['user_preferences', 'recent_projects', 'warm_sandbox'],
    priority: 'high',
  },
  {
    trigger: 'project_open',
    resources: ['project_files', 'dependencies', 'git_history'],
    priority: 'high',
  },
  {
    trigger: 'file_edit',
    resources: ['lsp_server', 'type_definitions', 'related_files'],
    priority: 'medium',
  },
  {
    trigger: 'build_start',
    resources: ['build_cache', 'source_maps', 'test_fixtures'],
    priority: 'medium',
  },
];

class Prefetcher {
  private cache: Map<string, any> = new Map();

  /**
   * Prefetch based on user action
   */
  async onAction(action: string, context: any): Promise<void> {
    const rules = prefetchRules.filter(r => r.trigger === action);
    
    // Sort by priority
    rules.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Prefetch in background
    for (const rule of rules) {
      setImmediate(async () => {
        for (const resource of rule.resources) {
          await this.prefetchResource(resource, context);
        }
      });
    }
  }

  /**
   * Prefetch specific resource
   */
  private async prefetchResource(resource: string, context: any): Promise<void> {
    const cacheKey = `${resource}:${JSON.stringify(context)}`;
    
    if (this.cache.has(cacheKey)) {
      return; // Already cached
    }

    switch (resource) {
      case 'warm_sandbox':
        await this.prefetchWarmSandbox(context);
        break;
      case 'dependencies':
        await this.prefetchDependencies(context);
        break;
      case 'lsp_server':
        await this.prefetchLspServer(context);
        break;
    }
  }
}
```

---

## Monitoring and Metrics

### Cold Start Metrics

```typescript
// server/metrics/coldStartMetrics.ts

interface ColdStartMetric {
  sandboxId: string;
  template: string;
  fromWarmPool: boolean;
  phases: {
    scheduling: number;
    imagePull: number;
    containerCreate: number;
    processStart: number;
    appInit: number;
  };
  total: number;
  timestamp: Date;
}

class ColdStartMonitor {
  private metrics: ColdStartMetric[] = [];

  /**
   * Record cold start metric
   */
  record(metric: ColdStartMetric): void {
    this.metrics.push(metric);
    
    // Send to monitoring system
    this.sendToPrometheus(metric);
    
    // Alert if too slow
    if (metric.total > 5000) {
      this.alertSlowColdStart(metric);
    }
  }

  /**
   * Get percentile statistics
   */
  getPercentiles(): {
    p50: number;
    p90: number;
    p99: number;
    warmPoolHitRate: number;
  } {
    const sorted = [...this.metrics].sort((a, b) => a.total - b.total);
    const warmPoolHits = this.metrics.filter(m => m.fromWarmPool).length;

    return {
      p50: sorted[Math.floor(sorted.length * 0.5)]?.total || 0,
      p90: sorted[Math.floor(sorted.length * 0.9)]?.total || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)]?.total || 0,
      warmPoolHitRate: warmPoolHits / this.metrics.length,
    };
  }
}
```

### Performance Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        COLD START PERFORMANCE DASHBOARD                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  COLD START LATENCY (Last 24h)                                                         │
│  ├── P50: 280ms (warm pool)                                                            │
│  ├── P90: 2.1s (cold start)                                                            │
│  ├── P99: 4.5s (cold start, no cache)                                                  │
│  └── Max: 12.3s (image pull required)                                                  │
│                                                                                         │
│  WARM POOL STATUS                                                                       │
│  ├── Generic: 8/10 available (80%)                                                     │
│  ├── React: 5/8 available (62%)                                                        │
│  ├── Next.js: 3/5 available (60%)                                                      │
│  └── Python: 4/5 available (80%)                                                       │
│                                                                                         │
│  WARM POOL HIT RATE                                                                     │
│  ├── Overall: 78%                                                                       │
│  ├── Peak hours: 65%                                                                    │
│  └── Off-peak: 92%                                                                      │
│                                                                                         │
│  OPTIMIZATION IMPACT                                                                    │
│  ├── Image caching: -3.2s avg                                                          │
│  ├── Warm pools: -1.8s avg                                                             │
│  ├── Lazy loading: -0.5s avg                                                           │
│  └── Total improvement: 73%                                                            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Cold Start Optimization Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **P50 (warm pool)** | <500ms | 280ms | ✅ |
| **P90 (cold start)** | <3s | 2.1s | ✅ |
| **P99** | <5s | 4.5s | ✅ |
| **Warm pool hit rate** | >75% | 78% | ✅ |
| **Image pull time** | <2s | 1.8s | ✅ |

### Optimization Techniques Summary

| Technique | Impact | Complexity |
|-----------|--------|------------|
| **Warm pools** | -70% cold start | Medium |
| **Image caching** | -50% pull time | Low |
| **Slim images** | -40% image size | Low |
| **Layer optimization** | -30% pull time | Medium |
| **Lazy loading** | -20% startup | Medium |
| **Prefetching** | -15% perceived latency | High |
| **Predictive scaling** | -10% cold starts | High |
