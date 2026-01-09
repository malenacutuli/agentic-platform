# Caching Layers and Cache Sharing

This guide covers the multi-tier caching architecture including npm/pnpm cache, build cache, CDN cache for static assets, and strategies for sharing cache between users while maintaining privacy.

---

## Table of Contents

1. [Caching Architecture Overview](#caching-architecture-overview)
2. [Package Manager Cache](#package-manager-cache)
3. [Build Cache](#build-cache)
4. [CDN Cache for Static Assets](#cdn-cache-for-static-assets)
5. [Cache Sharing Between Users](#cache-sharing-between-users)
6. [Privacy Considerations](#privacy-considerations)
7. [Cache Invalidation](#cache-invalidation)

---

## Caching Architecture Overview

### Multi-Tier Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MULTI-TIER CACHING ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  REQUEST FLOW                                                                           │
│     │                                                                                   │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L1: IN-MEMORY CACHE (per sandbox)                                              │   │
│  │  ├── Hot data: <1ms access                                                      │   │
│  │  ├── Size: 256MB per sandbox                                                    │   │
│  │  └── TTL: Session lifetime                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│     │ MISS                                                                             │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L2: LOCAL DISK CACHE (per node)                                                │   │
│  │  ├── Package cache: 5-50ms access                                               │   │
│  │  ├── Size: 50GB per node                                                        │   │
│  │  └── TTL: 7 days (LRU eviction)                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│     │ MISS                                                                             │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L3: SHARED CACHE (Redis/S3)                                                    │   │
│  │  ├── Build artifacts: 50-200ms access                                           │   │
│  │  ├── Size: Unlimited (S3)                                                       │   │
│  │  └── TTL: 30 days                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│     │ MISS                                                                             │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L4: CDN EDGE CACHE (global)                                                    │   │
│  │  ├── Static assets: 10-50ms access                                              │   │
│  │  ├── Size: Distributed                                                          │   │
│  │  └── TTL: 1 year (immutable)                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│     │ MISS                                                                             │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  ORIGIN (npm registry, GitHub, etc.)                                            │   │
│  │  └── 100-500ms access                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cache Hit Rates by Layer

| Layer | Typical Hit Rate | Latency | Size |
|-------|------------------|---------|------|
| **L1 Memory** | 60-80% | <1ms | 256MB |
| **L2 Local Disk** | 70-85% | 5-50ms | 50GB |
| **L3 Shared** | 80-95% | 50-200ms | Unlimited |
| **L4 CDN** | 90-99% | 10-50ms | Distributed |

---

## Package Manager Cache

### npm/pnpm Cache Architecture

```typescript
// server/cache/packageCache.ts

interface PackageCacheConfig {
  localCachePath: string;
  sharedCachePath: string;
  maxLocalSize: number;      // bytes
  maxSharedSize: number;     // bytes
  ttl: number;               // seconds
}

const defaultConfig: PackageCacheConfig = {
  localCachePath: '/var/cache/pnpm',
  sharedCachePath: 's3://cache-bucket/pnpm',
  maxLocalSize: 50 * 1024 * 1024 * 1024,  // 50GB
  maxSharedSize: 500 * 1024 * 1024 * 1024, // 500GB
  ttl: 30 * 24 * 60 * 60,  // 30 days
};

class PackageCacheManager {
  private config: PackageCacheConfig;
  private localCache: Map<string, CacheEntry> = new Map();

  /**
   * Get package from cache hierarchy
   */
  async getPackage(name: string, version: string): Promise<Buffer | null> {
    const cacheKey = this.getCacheKey(name, version);

    // L1: Check memory cache
    const memoryHit = this.localCache.get(cacheKey);
    if (memoryHit && !this.isExpired(memoryHit)) {
      metrics.cacheHit('memory', 'package');
      return memoryHit.data;
    }

    // L2: Check local disk cache
    const localPath = path.join(this.config.localCachePath, cacheKey);
    if (await this.fileExists(localPath)) {
      const data = await fs.readFile(localPath);
      this.localCache.set(cacheKey, { data, timestamp: Date.now() });
      metrics.cacheHit('local', 'package');
      return data;
    }

    // L3: Check shared cache (S3)
    const sharedPath = `${this.config.sharedCachePath}/${cacheKey}`;
    try {
      const data = await this.downloadFromS3(sharedPath);
      await fs.writeFile(localPath, data);
      this.localCache.set(cacheKey, { data, timestamp: Date.now() });
      metrics.cacheHit('shared', 'package');
      return data;
    } catch (error) {
      // Not in shared cache
    }

    // Cache miss - fetch from registry
    metrics.cacheMiss('package');
    return null;
  }

  /**
   * Store package in cache hierarchy
   */
  async storePackage(name: string, version: string, data: Buffer): Promise<void> {
    const cacheKey = this.getCacheKey(name, version);

    // Store in all cache layers
    this.localCache.set(cacheKey, { data, timestamp: Date.now() });

    const localPath = path.join(this.config.localCachePath, cacheKey);
    await fs.writeFile(localPath, data);

    const sharedPath = `${this.config.sharedCachePath}/${cacheKey}`;
    await this.uploadToS3(sharedPath, data);
  }

  /**
   * Generate content-addressable cache key
   */
  private getCacheKey(name: string, version: string): string {
    // Use content hash for immutable caching
    return `${name}/${version}/${this.hashVersion(name, version)}`;
  }
}
```

### pnpm Store Configuration

```yaml
# .npmrc (pnpm configuration)
store-dir=/var/cache/pnpm/store
cache-dir=/var/cache/pnpm/cache
state-dir=/var/cache/pnpm/state

# Enable content-addressable storage
content-addressable-store=true

# Shared store across projects
shared-workspace-lockfile=true

# Network settings
fetch-retries=3
fetch-retry-factor=2
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000

# Disk space optimization
package-import-method=hardlink
symlink=true
```

### Global npm Cache

```typescript
// server/cache/globalNpmCache.ts

interface GlobalCacheStats {
  totalPackages: number;
  totalSize: number;
  hitRate: number;
  topPackages: { name: string; hits: number }[];
}

class GlobalNpmCache {
  private redis: Redis;
  private s3: S3Client;

  /**
   * Pre-warm cache with popular packages
   */
  async prewarmPopularPackages(): Promise<void> {
    const popularPackages = [
      // React ecosystem
      'react', 'react-dom', 'next', '@types/react',
      // Build tools
      'vite', 'esbuild', 'typescript', 'tslib',
      // Utilities
      'lodash', 'axios', 'date-fns', 'zod',
      // Styling
      'tailwindcss', 'postcss', 'autoprefixer',
      // Testing
      'vitest', 'jest', '@testing-library/react',
    ];

    for (const pkg of popularPackages) {
      await this.ensureCached(pkg, 'latest');
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<GlobalCacheStats> {
    const stats = await this.redis.hgetall('cache:stats');
    const topPackages = await this.redis.zrevrange('cache:hits', 0, 9, 'WITHSCORES');

    return {
      totalPackages: parseInt(stats.totalPackages || '0'),
      totalSize: parseInt(stats.totalSize || '0'),
      hitRate: parseFloat(stats.hitRate || '0'),
      topPackages: this.parseTopPackages(topPackages),
    };
  }
}
```

---

## Build Cache

### Build Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           BUILD CACHE ARCHITECTURE                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SOURCE FILES                                                                           │
│     │                                                                                   │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  HASH CALCULATOR                                                                │   │
│  │  ├── Source files hash                                                          │   │
│  │  ├── Dependencies hash                                                          │   │
│  │  ├── Config files hash                                                          │   │
│  │  └── Environment hash                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│     │                                                                                   │
│     ▼                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  CACHE LOOKUP                                                                   │   │
│  │  ├── Local: ~/.cache/build/{hash}                                               │   │
│  │  ├── Remote: s3://build-cache/{hash}                                            │   │
│  │  └── Turborepo: turbo-cache.vercel.com                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│     │                                                                                   │
│     ▼                                                                                   │
│  HIT ────► Restore artifacts ────► Skip build                                          │
│  MISS ───► Run build ────► Store artifacts                                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Build Cache Implementation

```typescript
// server/cache/buildCache.ts

interface BuildCacheEntry {
  hash: string;
  outputs: string[];
  size: number;
  createdAt: Date;
  hits: number;
  buildTime: number;  // Original build time in ms
}

interface CacheKeyInputs {
  sourceFiles: string[];
  dependencies: Record<string, string>;
  configFiles: string[];
  environment: Record<string, string>;
}

class BuildCacheManager {
  /**
   * Calculate deterministic cache key
   */
  calculateCacheKey(inputs: CacheKeyInputs): string {
    const hasher = crypto.createHash('sha256');

    // Hash source files (content-based)
    for (const file of inputs.sourceFiles.sort()) {
      const content = fs.readFileSync(file);
      hasher.update(file);
      hasher.update(content);
    }

    // Hash dependencies (lockfile-based)
    hasher.update(JSON.stringify(inputs.dependencies));

    // Hash config files
    for (const config of inputs.configFiles.sort()) {
      if (fs.existsSync(config)) {
        hasher.update(fs.readFileSync(config));
      }
    }

    // Hash relevant environment variables
    const relevantEnv = Object.entries(inputs.environment)
      .filter(([key]) => key.startsWith('NODE_') || key.startsWith('VITE_'))
      .sort(([a], [b]) => a.localeCompare(b));
    hasher.update(JSON.stringify(relevantEnv));

    return hasher.digest('hex');
  }

  /**
   * Restore build from cache
   */
  async restore(cacheKey: string, outputDir: string): Promise<boolean> {
    // Try local cache first
    const localPath = path.join(this.localCachePath, cacheKey);
    if (await this.fileExists(localPath)) {
      await this.extractTar(localPath, outputDir);
      metrics.buildCacheHit('local');
      return true;
    }

    // Try remote cache
    try {
      const remotePath = `${this.remoteCachePath}/${cacheKey}.tar.gz`;
      const data = await this.downloadFromS3(remotePath);
      
      // Store locally for future use
      await fs.writeFile(localPath, data);
      await this.extractTar(localPath, outputDir);
      
      metrics.buildCacheHit('remote');
      return true;
    } catch (error) {
      metrics.buildCacheMiss();
      return false;
    }
  }

  /**
   * Store build artifacts in cache
   */
  async store(cacheKey: string, outputDir: string, outputs: string[]): Promise<void> {
    // Create tar archive of outputs
    const tarPath = path.join(this.localCachePath, `${cacheKey}.tar.gz`);
    await this.createTar(outputDir, outputs, tarPath);

    // Upload to remote cache
    await this.uploadToS3(`${this.remoteCachePath}/${cacheKey}.tar.gz`, tarPath);

    // Record metadata
    await this.recordCacheEntry({
      hash: cacheKey,
      outputs,
      size: (await fs.stat(tarPath)).size,
      createdAt: new Date(),
      hits: 0,
      buildTime: 0,
    });
  }
}
```

### Turborepo Integration

```typescript
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    "tsconfig.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

```typescript
// server/cache/turboCache.ts

class TurboCacheIntegration {
  /**
   * Configure Turborepo remote cache
   */
  async configureTurboCache(projectPath: string): Promise<void> {
    const turboConfig = {
      teamId: process.env.TURBO_TEAM,
      apiUrl: process.env.TURBO_API_URL || 'https://turbo-cache.internal',
      token: await this.generateProjectToken(projectPath),
    };

    // Write .turbo/config.json
    const configPath = path.join(projectPath, '.turbo', 'config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(turboConfig, null, 2));
  }

  /**
   * Self-hosted Turborepo cache server
   */
  createCacheServer(): Express {
    const app = express();

    // GET /v8/artifacts/:hash
    app.get('/v8/artifacts/:hash', async (req, res) => {
      const { hash } = req.params;
      const teamId = req.headers['x-turbo-team-id'];
      
      const cacheKey = `turbo/${teamId}/${hash}`;
      const data = await this.s3.getObject(cacheKey);
      
      if (data) {
        res.set('Content-Type', 'application/octet-stream');
        res.send(data);
      } else {
        res.status(404).send('Not found');
      }
    });

    // PUT /v8/artifacts/:hash
    app.put('/v8/artifacts/:hash', async (req, res) => {
      const { hash } = req.params;
      const teamId = req.headers['x-turbo-team-id'];
      
      const cacheKey = `turbo/${teamId}/${hash}`;
      await this.s3.putObject(cacheKey, req.body);
      
      res.status(200).send('OK');
    });

    return app;
  }
}
```

---

## CDN Cache for Static Assets

### CDN Configuration

```typescript
// server/cdn/cdnConfig.ts

interface CDNConfig {
  provider: 'cloudflare' | 'fastly' | 'cloudfront';
  zones: CDNZone[];
  cacheRules: CacheRule[];
  purgeWebhook: string;
}

interface CDNZone {
  id: string;
  domain: string;
  origin: string;
  ssl: boolean;
}

interface CacheRule {
  pattern: string;
  ttl: number;
  browserTtl: number;
  cacheLevel: 'bypass' | 'basic' | 'simplified' | 'aggressive';
}

const cdnConfig: CDNConfig = {
  provider: 'cloudflare',
  zones: [
    {
      id: 'zone-1',
      domain: 'assets.manus.computer',
      origin: 'origin.manus.internal',
      ssl: true,
    },
  ],
  cacheRules: [
    // Immutable assets (hashed filenames)
    {
      pattern: '*.{hash}.{js,css,woff2}',
      ttl: 31536000,        // 1 year
      browserTtl: 31536000,
      cacheLevel: 'aggressive',
    },
    // Images
    {
      pattern: '*.{png,jpg,jpeg,gif,webp,svg}',
      ttl: 604800,          // 1 week
      browserTtl: 86400,    // 1 day
      cacheLevel: 'aggressive',
    },
    // HTML (short cache)
    {
      pattern: '*.html',
      ttl: 300,             // 5 minutes
      browserTtl: 0,
      cacheLevel: 'basic',
    },
    // API responses (no cache)
    {
      pattern: '/api/*',
      ttl: 0,
      browserTtl: 0,
      cacheLevel: 'bypass',
    },
  ],
  purgeWebhook: 'https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache',
};
```

### Cache Headers

```typescript
// server/cdn/cacheHeaders.ts

interface CacheHeaderConfig {
  maxAge: number;
  sMaxAge: number;
  staleWhileRevalidate: number;
  staleIfError: number;
  immutable: boolean;
  private: boolean;
}

class CacheHeaderManager {
  /**
   * Generate cache headers for asset type
   */
  getHeaders(assetType: string, hash?: string): Record<string, string> {
    const configs: Record<string, CacheHeaderConfig> = {
      // Hashed assets - immutable
      'js-hashed': {
        maxAge: 31536000,
        sMaxAge: 31536000,
        staleWhileRevalidate: 0,
        staleIfError: 86400,
        immutable: true,
        private: false,
      },
      // Non-hashed JS - short cache
      'js': {
        maxAge: 3600,
        sMaxAge: 86400,
        staleWhileRevalidate: 86400,
        staleIfError: 86400,
        immutable: false,
        private: false,
      },
      // HTML - no cache
      'html': {
        maxAge: 0,
        sMaxAge: 300,
        staleWhileRevalidate: 60,
        staleIfError: 3600,
        immutable: false,
        private: false,
      },
      // User-specific - private
      'user-data': {
        maxAge: 0,
        sMaxAge: 0,
        staleWhileRevalidate: 0,
        staleIfError: 0,
        immutable: false,
        private: true,
      },
    };

    const config = hash ? configs['js-hashed'] : configs[assetType] || configs['js'];
    return this.buildHeaders(config);
  }

  private buildHeaders(config: CacheHeaderConfig): Record<string, string> {
    const directives: string[] = [];

    if (config.private) {
      directives.push('private');
    } else {
      directives.push('public');
    }

    directives.push(`max-age=${config.maxAge}`);
    directives.push(`s-maxage=${config.sMaxAge}`);

    if (config.staleWhileRevalidate > 0) {
      directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }

    if (config.staleIfError > 0) {
      directives.push(`stale-if-error=${config.staleIfError}`);
    }

    if (config.immutable) {
      directives.push('immutable');
    }

    return {
      'Cache-Control': directives.join(', '),
      'Vary': 'Accept-Encoding',
    };
  }
}
```

---

## Cache Sharing Between Users

### Shared Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CACHE SHARING ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           GLOBAL SHARED CACHE                                   │   │
│  │  ├── Public npm packages (react, lodash, etc.)                                  │   │
│  │  ├── Public Docker images                                                       │   │
│  │  └── Template base files                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                               │
│           ┌────────────────────────────┼────────────────────────────────┐             │
│           ▼                            ▼                            ▼                 │
│  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐           │
│  │  Template Cache │        │  Template Cache │        │  Template Cache │           │
│  │  (React)        │        │  (Next.js)      │        │  (Python)       │           │
│  │  ├── Shared deps│        │  ├── Shared deps│        │  ├── Shared deps│           │
│  │  └── Build cache│        │  └── Build cache│        │  └── Build cache│           │
│  └─────────────────┘        └─────────────────┘        └─────────────────┘           │
│           │                            │                            │                 │
│           ▼                            ▼                            ▼                 │
│  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐           │
│  │  User A Cache   │        │  User B Cache   │        │  User C Cache   │           │
│  │  (Private)      │        │  (Private)      │        │  (Private)      │           │
│  │  ├── User code  │        │  ├── User code  │        │  ├── User code  │           │
│  │  ├── Env vars   │        │  ├── Env vars   │        │  ├── Env vars   │           │
│  │  └── Secrets    │        │  └── Secrets    │        │  └── Secrets    │           │
│  └─────────────────┘        └─────────────────┘        └─────────────────┘           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cache Sharing Implementation

```typescript
// server/cache/sharedCache.ts

interface CacheScope {
  global: boolean;      // Shared across all users
  template: boolean;    // Shared within template
  user: boolean;        // User-specific only
}

interface CacheEntry {
  key: string;
  scope: CacheScope;
  data: Buffer;
  metadata: {
    contentHash: string;
    createdAt: Date;
    accessCount: number;
    sourceType: 'npm' | 'build' | 'asset' | 'user';
  };
}

class SharedCacheManager {
  /**
   * Determine cache scope for content
   */
  determineCacheScope(content: CacheContent): CacheScope {
    // Public npm packages - global
    if (content.type === 'npm' && !content.isPrivate) {
      return { global: true, template: true, user: true };
    }

    // Template-specific dependencies
    if (content.type === 'template-dep') {
      return { global: false, template: true, user: true };
    }

    // User code and secrets - user only
    if (content.type === 'user-code' || content.type === 'secret') {
      return { global: false, template: false, user: true };
    }

    // Build artifacts - depends on inputs
    if (content.type === 'build') {
      const hasUserCode = this.containsUserCode(content);
      return {
        global: !hasUserCode,
        template: true,
        user: true,
      };
    }

    return { global: false, template: false, user: true };
  }

  /**
   * Get cache key with appropriate scope prefix
   */
  getCacheKey(content: CacheContent, userId: string, template: string): string {
    const scope = this.determineCacheScope(content);
    const contentHash = this.hashContent(content);

    if (scope.global) {
      return `global/${content.type}/${contentHash}`;
    }

    if (scope.template) {
      return `template/${template}/${content.type}/${contentHash}`;
    }

    return `user/${userId}/${content.type}/${contentHash}`;
  }

  /**
   * Check if content contains user-specific code
   */
  private containsUserCode(content: CacheContent): boolean {
    // Check for user-specific patterns
    const userPatterns = [
      /\.env/,
      /secrets?\./,
      /api[_-]?key/i,
      /password/i,
      /token/i,
    ];

    return userPatterns.some(pattern => 
      pattern.test(content.path) || pattern.test(content.data.toString())
    );
  }
}
```

### Template-Specific Cache

```typescript
// server/cache/templateCache.ts

interface TemplateCacheConfig {
  template: string;
  sharedDependencies: string[];
  sharedBuildOutputs: string[];
  cacheWarmupScript?: string;
}

const templateCacheConfigs: TemplateCacheConfig[] = [
  {
    template: 'react-vite',
    sharedDependencies: [
      'react', 'react-dom', 'vite', '@vitejs/plugin-react',
      'typescript', 'tailwindcss', 'postcss', 'autoprefixer',
    ],
    sharedBuildOutputs: [
      'node_modules/.vite',
      '.vite/deps',
    ],
    cacheWarmupScript: 'pnpm install && pnpm vite optimize',
  },
  {
    template: 'nextjs',
    sharedDependencies: [
      'next', 'react', 'react-dom', 'typescript',
      '@types/react', '@types/node',
    ],
    sharedBuildOutputs: [
      '.next/cache',
      'node_modules/.cache',
    ],
    cacheWarmupScript: 'pnpm install && pnpm next build --no-lint',
  },
];

class TemplateCacheManager {
  /**
   * Pre-warm template cache
   */
  async warmTemplateCache(template: string): Promise<void> {
    const config = templateCacheConfigs.find(c => c.template === template);
    if (!config) return;

    // Install shared dependencies
    for (const dep of config.sharedDependencies) {
      await this.ensurePackageCached(dep);
    }

    // Run warmup script if defined
    if (config.cacheWarmupScript) {
      await this.runWarmupScript(config);
    }
  }

  /**
   * Restore template cache to sandbox
   */
  async restoreToSandbox(template: string, sandboxPath: string): Promise<void> {
    const config = templateCacheConfigs.find(c => c.template === template);
    if (!config) return;

    // Restore shared build outputs
    for (const output of config.sharedBuildOutputs) {
      const cachePath = `template/${template}/${output}`;
      const targetPath = path.join(sandboxPath, output);
      
      if (await this.cacheExists(cachePath)) {
        await this.restoreFromCache(cachePath, targetPath);
      }
    }
  }
}
```

---

## Privacy Considerations

### Privacy-Safe Caching

```typescript
// server/cache/privacyCache.ts

interface PrivacyConfig {
  sensitivePatterns: RegExp[];
  hashSensitiveValues: boolean;
  auditAccess: boolean;
}

const privacyConfig: PrivacyConfig = {
  sensitivePatterns: [
    /password/i,
    /secret/i,
    /api[_-]?key/i,
    /token/i,
    /credential/i,
    /private[_-]?key/i,
    /\.env/,
    /\.pem$/,
    /\.key$/,
  ],
  hashSensitiveValues: true,
  auditAccess: true,
};

class PrivacySafeCacheManager {
  /**
   * Check if content is sensitive
   */
  isSensitive(content: CacheContent): boolean {
    // Check filename
    for (const pattern of privacyConfig.sensitivePatterns) {
      if (pattern.test(content.path)) {
        return true;
      }
    }

    // Check content for sensitive patterns
    const contentStr = content.data.toString();
    for (const pattern of privacyConfig.sensitivePatterns) {
      if (pattern.test(contentStr)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize content before caching
   */
  sanitizeForSharedCache(content: CacheContent): CacheContent {
    if (!this.isSensitive(content)) {
      return content;
    }

    // Don't cache sensitive content in shared cache
    throw new Error('Cannot cache sensitive content in shared cache');
  }

  /**
   * Generate privacy-safe cache key
   */
  generateSafeCacheKey(content: CacheContent, userId: string): string {
    if (this.isSensitive(content)) {
      // Include user ID in key for sensitive content
      return `user/${userId}/${this.hashContent(content)}`;
    }

    // Content-addressable key for non-sensitive content
    return `shared/${this.hashContent(content)}`;
  }

  /**
   * Audit cache access
   */
  async auditAccess(userId: string, cacheKey: string, action: 'read' | 'write'): Promise<void> {
    if (!privacyConfig.auditAccess) return;

    await this.auditLog.log({
      timestamp: new Date(),
      userId,
      cacheKey,
      action,
      keyScope: this.extractScope(cacheKey),
    });
  }
}
```

### Data Isolation in Cache

```typescript
// server/cache/cacheIsolation.ts

class CacheIsolationManager {
  /**
   * Validate cache access
   */
  async validateAccess(userId: string, cacheKey: string): Promise<boolean> {
    const scope = this.extractScope(cacheKey);

    switch (scope) {
      case 'global':
        // Anyone can access global cache
        return true;

      case 'template':
        // Anyone can access template cache
        return true;

      case 'user':
        // Only owner can access user cache
        const keyUserId = this.extractUserId(cacheKey);
        return keyUserId === userId;

      default:
        return false;
    }
  }

  /**
   * Ensure no cross-user data leakage
   */
  async scanForLeakage(cacheKey: string, data: Buffer): Promise<{
    safe: boolean;
    risks: string[];
  }> {
    const risks: string[] = [];

    // Check for user IDs in content
    const userIdPattern = /user[_-]?id[:\s=]["']?([a-f0-9-]+)/gi;
    const matches = data.toString().matchAll(userIdPattern);
    
    for (const match of matches) {
      risks.push(`Found user ID reference: ${match[1]}`);
    }

    // Check for email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = data.toString().match(emailPattern);
    
    if (emails && emails.length > 0) {
      risks.push(`Found ${emails.length} email addresses`);
    }

    return {
      safe: risks.length === 0,
      risks,
    };
  }
}
```

---

## Cache Invalidation

### Invalidation Strategies

```typescript
// server/cache/invalidation.ts

interface InvalidationStrategy {
  type: 'ttl' | 'event' | 'version' | 'manual';
  config: any;
}

class CacheInvalidationManager {
  /**
   * Invalidate by TTL
   */
  async invalidateExpired(): Promise<number> {
    const now = Date.now();
    let invalidated = 0;

    // Scan for expired entries
    const entries = await this.scanCache('*');
    
    for (const entry of entries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        await this.deleteEntry(entry.key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate by event
   */
  async invalidateOnEvent(event: CacheEvent): Promise<void> {
    switch (event.type) {
      case 'package-update':
        // Invalidate package cache
        await this.invalidatePattern(`npm/${event.package}/*`);
        break;

      case 'template-update':
        // Invalidate template cache
        await this.invalidatePattern(`template/${event.template}/*`);
        break;

      case 'deploy':
        // Invalidate CDN cache
        await this.purgeCDN(event.paths);
        break;
    }
  }

  /**
   * Invalidate by version
   */
  async invalidateOldVersions(currentVersion: string): Promise<void> {
    const entries = await this.scanCache('*');
    
    for (const entry of entries) {
      if (entry.version && entry.version !== currentVersion) {
        await this.deleteEntry(entry.key);
      }
    }
  }

  /**
   * CDN purge
   */
  async purgeCDN(paths: string[]): Promise<void> {
    await fetch(this.cdnPurgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.cdnToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: paths,
      }),
    });
  }
}
```

---

## Summary

### Cache Layer Summary

| Layer | Scope | TTL | Size | Hit Rate |
|-------|-------|-----|------|----------|
| **L1 Memory** | Per sandbox | Session | 256MB | 60-80% |
| **L2 Local Disk** | Per node | 7 days | 50GB | 70-85% |
| **L3 Shared (S3)** | Global/Template | 30 days | Unlimited | 80-95% |
| **L4 CDN** | Global | 1 year | Distributed | 90-99% |

### Cache Sharing Rules

| Content Type | Global | Template | User |
|--------------|--------|----------|------|
| Public npm packages | ✅ | ✅ | ✅ |
| Template dependencies | ❌ | ✅ | ✅ |
| Build artifacts (no user code) | ✅ | ✅ | ✅ |
| Build artifacts (with user code) | ❌ | ❌ | ✅ |
| User code | ❌ | ❌ | ✅ |
| Secrets/env vars | ❌ | ❌ | ✅ |

### Privacy Checklist

- [ ] Sensitive content detection enabled
- [ ] User-specific cache isolation
- [ ] No cross-user data in shared cache
- [ ] Audit logging for cache access
- [ ] Regular leakage scanning
- [ ] TTL-based automatic cleanup
