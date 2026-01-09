# Build Caching and Performance

This guide provides comprehensive coverage of build caching strategies, cache invalidation, shared caching between sessions, remote build cache, and performance optimization techniques for cloud development environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Caching Architecture](#caching-architecture)
3. [Local Build Cache](#local-build-cache)
4. [Remote Build Cache](#remote-build-cache)
5. [Cache Invalidation](#cache-invalidation)
6. [Build Performance](#build-performance)
7. [Incremental Builds](#incremental-builds)
8. [Parallel Builds](#parallel-builds)
9. [Monitoring and Metrics](#monitoring-and-metrics)
10. [Best Practices](#best-practices)

---

## Overview

Build caching is essential for maintaining fast development cycles in cloud environments. Effective caching can reduce build times by 50-90% by reusing previously computed results.

### Caching Layers

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BUILD CACHING LAYERS                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: IN-MEMORY CACHE                                                        │   │
│  │  • Module resolution cache                                                       │   │
│  │  • AST cache                                                                     │   │
│  │  • Transform cache                                                               │   │
│  │  Lifetime: Single build process                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: LOCAL FILESYSTEM CACHE                                                 │   │
│  │  • node_modules/.cache                                                          │   │
│  │  • .vite/                                                                        │   │
│  │  • .next/cache                                                                   │   │
│  │  Lifetime: Persists across builds, same machine                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: SHARED CACHE (SESSION)                                                 │   │
│  │  • Shared between sandbox sessions                                              │   │
│  │  • Persistent volume mounts                                                     │   │
│  │  Lifetime: Persists across hibernation                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: REMOTE CACHE                                                           │   │
│  │  • S3/GCS bucket                                                                │   │
│  │  • Shared across all users/projects                                             │   │
│  │  Lifetime: Configurable TTL (days/weeks)                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cache Hit Rates by Layer

| Layer | Typical Hit Rate | Latency | Storage |
|-------|------------------|---------|---------|
| **In-Memory** | 95%+ | <1ms | RAM |
| **Local FS** | 70-90% | 1-10ms | SSD |
| **Shared Session** | 50-80% | 10-50ms | Persistent Volume |
| **Remote** | 30-60% | 50-200ms | S3/GCS |

---

## Caching Architecture

### Cache Key Generation

```typescript
// src/cache/cacheKey.ts

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface CacheKeyInput {
  // File content
  content?: string;
  filePath?: string;
  
  // Build configuration
  config?: Record<string, any>;
  
  // Environment
  nodeVersion?: string;
  platform?: string;
  
  // Dependencies
  dependencies?: Record<string, string>;
}

class CacheKeyGenerator {
  /**
   * Generate a deterministic cache key
   */
  generate(input: CacheKeyInput): string {
    const components: string[] = [];
    
    // Content hash
    if (input.content) {
      components.push(this.hashContent(input.content));
    }
    
    // File path (for location-dependent transforms)
    if (input.filePath) {
      components.push(this.hashContent(input.filePath));
    }
    
    // Config hash
    if (input.config) {
      components.push(this.hashContent(JSON.stringify(input.config, null, 0)));
    }
    
    // Environment hash
    if (input.nodeVersion || input.platform) {
      components.push(this.hashContent(
        `${input.nodeVersion || ''}-${input.platform || ''}`
      ));
    }
    
    // Dependencies hash
    if (input.dependencies) {
      const sortedDeps = Object.entries(input.dependencies)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, version]) => `${name}@${version}`)
        .join(',');
      components.push(this.hashContent(sortedDeps));
    }
    
    // Combine all components
    return this.hashContent(components.join(':'));
  }

  /**
   * Generate cache key for a file
   */
  generateForFile(filePath: string, config: Record<string, any>): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    
    return this.generate({
      content,
      filePath: path.relative(process.cwd(), filePath),
      config,
      nodeVersion: process.version,
      platform: process.platform,
    });
  }

  /**
   * Generate cache key for entire project
   */
  generateForProject(projectPath: string): string {
    const lockFile = this.findLockFile(projectPath);
    const configFiles = this.findConfigFiles(projectPath);
    
    const hashes: string[] = [];
    
    // Lock file hash
    if (lockFile) {
      hashes.push(this.hashFile(lockFile));
    }
    
    // Config files hash
    for (const configFile of configFiles) {
      hashes.push(this.hashFile(configFile));
    }
    
    return this.hashContent(hashes.join(':'));
  }

  private hashContent(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 16);
  }

  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 16);
  }

  private findLockFile(projectPath: string): string | null {
    const lockFiles = [
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'bun.lockb',
    ];
    
    for (const file of lockFiles) {
      const filePath = path.join(projectPath, file);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    
    return null;
  }

  private findConfigFiles(projectPath: string): string[] {
    const configPatterns = [
      'vite.config.*',
      'webpack.config.*',
      'tsconfig.json',
      'babel.config.*',
      '.swcrc',
    ];
    
    const files: string[] = [];
    
    for (const pattern of configPatterns) {
      const matches = this.glob(projectPath, pattern);
      files.push(...matches);
    }
    
    return files;
  }

  private glob(dir: string, pattern: string): string[] {
    // Simplified glob implementation
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
    );
    
    return fs.readdirSync(dir)
      .filter(file => regex.test(file))
      .map(file => path.join(dir, file));
  }
}

export const cacheKeyGenerator = new CacheKeyGenerator();
```

### Multi-Tier Cache Manager

```typescript
// src/cache/cacheManager.ts

import * as fs from 'fs';
import * as path from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from 'redis';

interface CacheEntry {
  key: string;
  data: Buffer;
  metadata: {
    createdAt: number;
    size: number;
    contentType: string;
    hits: number;
  };
}

interface CacheConfig {
  localPath: string;
  remoteBucket?: string;
  redisUrl?: string;
  ttl: number; // seconds
  maxLocalSize: number; // bytes
  maxRemoteSize: number; // bytes
}

class MultiTierCacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private s3Client?: S3Client;
  private redisClient?: ReturnType<typeof createClient>;
  private stats = {
    memoryHits: 0,
    localHits: 0,
    remoteHits: 0,
    misses: 0,
  };

  constructor(config: CacheConfig) {
    this.config = config;
    
    if (config.remoteBucket) {
      this.s3Client = new S3Client({});
    }
    
    if (config.redisUrl) {
      this.redisClient = createClient({ url: config.redisUrl });
      this.redisClient.connect();
    }
    
    // Ensure local cache directory exists
    fs.mkdirSync(config.localPath, { recursive: true });
  }

  /**
   * Get from cache (checks all tiers)
   */
  async get(key: string): Promise<Buffer | null> {
    // Tier 1: Memory cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      memoryEntry.metadata.hits++;
      this.stats.memoryHits++;
      return memoryEntry.data;
    }

    // Tier 2: Local filesystem cache
    const localData = await this.getFromLocal(key);
    if (localData) {
      // Promote to memory cache
      this.setMemory(key, localData);
      this.stats.localHits++;
      return localData;
    }

    // Tier 3: Redis (shared session cache)
    if (this.redisClient) {
      const redisData = await this.getFromRedis(key);
      if (redisData) {
        // Promote to local and memory
        await this.setLocal(key, redisData);
        this.setMemory(key, redisData);
        this.stats.localHits++;
        return redisData;
      }
    }

    // Tier 4: Remote S3 cache
    if (this.s3Client) {
      const remoteData = await this.getFromRemote(key);
      if (remoteData) {
        // Promote to all lower tiers
        await this.setLocal(key, remoteData);
        this.setMemory(key, remoteData);
        if (this.redisClient) {
          await this.setRedis(key, remoteData);
        }
        this.stats.remoteHits++;
        return remoteData;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set in cache (writes to all tiers)
   */
  async set(key: string, data: Buffer): Promise<void> {
    // Write to all tiers in parallel
    const promises: Promise<void>[] = [];

    // Tier 1: Memory
    this.setMemory(key, data);

    // Tier 2: Local
    promises.push(this.setLocal(key, data));

    // Tier 3: Redis
    if (this.redisClient) {
      promises.push(this.setRedis(key, data));
    }

    // Tier 4: Remote (async, don't wait)
    if (this.s3Client) {
      this.setRemote(key, data).catch(err => {
        console.error('Remote cache write failed:', err);
      });
    }

    await Promise.all(promises);
  }

  /**
   * Memory cache operations
   */
  private setMemory(key: string, data: Buffer): void {
    // Evict if needed
    this.evictMemoryIfNeeded(data.length);

    this.memoryCache.set(key, {
      key,
      data,
      metadata: {
        createdAt: Date.now(),
        size: data.length,
        contentType: 'application/octet-stream',
        hits: 0,
      },
    });
  }

  private evictMemoryIfNeeded(newSize: number): void {
    const maxSize = 100 * 1024 * 1024; // 100MB memory cache
    let currentSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.metadata.size, 0);

    if (currentSize + newSize <= maxSize) return;

    // LRU eviction based on hits
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.metadata.hits - b.metadata.hits);

    for (const [key, entry] of entries) {
      if (currentSize + newSize <= maxSize) break;
      currentSize -= entry.metadata.size;
      this.memoryCache.delete(key);
    }
  }

  /**
   * Local filesystem cache operations
   */
  private async getFromLocal(key: string): Promise<Buffer | null> {
    const filePath = this.getLocalPath(key);
    
    try {
      const stat = await fs.promises.stat(filePath);
      
      // Check TTL
      if (Date.now() - stat.mtimeMs > this.config.ttl * 1000) {
        await fs.promises.unlink(filePath);
        return null;
      }
      
      return await fs.promises.readFile(filePath);
    } catch {
      return null;
    }
  }

  private async setLocal(key: string, data: Buffer): Promise<void> {
    const filePath = this.getLocalPath(key);
    const dir = path.dirname(filePath);
    
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, data);
  }

  private getLocalPath(key: string): string {
    // Use first 2 chars as subdirectory for better FS performance
    const subdir = key.slice(0, 2);
    return path.join(this.config.localPath, subdir, key);
  }

  /**
   * Redis cache operations
   */
  private async getFromRedis(key: string): Promise<Buffer | null> {
    if (!this.redisClient) return null;
    
    try {
      const data = await this.redisClient.get(
        Buffer.from(`build-cache:${key}`)
      );
      return data ? Buffer.from(data) : null;
    } catch {
      return null;
    }
  }

  private async setRedis(key: string, data: Buffer): Promise<void> {
    if (!this.redisClient) return;
    
    await this.redisClient.setEx(
      `build-cache:${key}`,
      this.config.ttl,
      data.toString('base64')
    );
  }

  /**
   * Remote S3 cache operations
   */
  private async getFromRemote(key: string): Promise<Buffer | null> {
    if (!this.s3Client || !this.config.remoteBucket) return null;
    
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.remoteBucket,
        Key: `build-cache/${key}`,
      }));
      
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  private async setRemote(key: string, data: Buffer): Promise<void> {
    if (!this.s3Client || !this.config.remoteBucket) return;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.remoteBucket,
      Key: `build-cache/${key}`,
      Body: data,
      ContentType: 'application/octet-stream',
      Metadata: {
        'created-at': Date.now().toString(),
        'size': data.length.toString(),
      },
    }));
  }

  /**
   * Get cache statistics
   */
  getStats(): typeof this.stats & { hitRate: number } {
    const total = this.stats.memoryHits + this.stats.localHits + 
                  this.stats.remoteHits + this.stats.misses;
    const hits = this.stats.memoryHits + this.stats.localHits + this.stats.remoteHits;
    
    return {
      ...this.stats,
      hitRate: total > 0 ? hits / total : 0,
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    // Clear local cache
    await fs.promises.rm(this.config.localPath, { recursive: true, force: true });
    await fs.promises.mkdir(this.config.localPath, { recursive: true });
    
    // Clear Redis cache
    if (this.redisClient) {
      const keys = await this.redisClient.keys('build-cache:*');
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    }
    
    // Note: Remote cache is not cleared automatically
  }
}

export { MultiTierCacheManager, CacheConfig };
```

---

## Local Build Cache

### Vite Cache Configuration

```typescript
// vite.config.ts

import { defineConfig } from 'vite';

export default defineConfig({
  // Cache directory for dependency pre-bundling
  cacheDir: 'node_modules/.vite',
  
  // Dependency optimization
  optimizeDeps: {
    // Force re-optimization
    force: false,
    
    // Entries to pre-bundle
    entries: ['./src/main.tsx'],
    
    // Dependencies to include
    include: ['react', 'react-dom', 'lodash-es'],
    
    // Dependencies to exclude
    exclude: ['@vite/client'],
    
    // esbuild options for optimization
    esbuildOptions: {
      target: 'es2020',
    },
  },
  
  build: {
    // Enable build cache
    commonjsOptions: {
      // Cache CommonJS transform results
      transformMixedEsModules: true,
    },
  },
});
```

### Webpack Cache Configuration

```javascript
// webpack.config.js

const path = require('path');

module.exports = {
  // Filesystem cache (Webpack 5+)
  cache: {
    type: 'filesystem',
    
    // Cache directory
    cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/webpack'),
    
    // Cache name (for multiple configurations)
    name: 'development-cache',
    
    // Build dependencies that invalidate cache
    buildDependencies: {
      config: [__filename],
      tsconfig: [path.resolve(__dirname, 'tsconfig.json')],
    },
    
    // Version string for cache invalidation
    version: `${process.env.NODE_ENV}-${process.env.BUILD_VERSION || '1.0.0'}`,
    
    // Store type
    store: 'pack',
    
    // Compression
    compression: 'gzip',
    
    // Max age
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    
    // Max memory generations
    maxMemoryGenerations: 1,
    
    // Allow collecting memory
    allowCollectingMemory: true,
    
    // Profile for debugging
    profile: false,
  },
  
  // Snapshot configuration
  snapshot: {
    // Module hashing
    module: {
      hash: true,
    },
    // Resolve hashing
    resolve: {
      hash: true,
    },
    // Build dependencies
    buildDependencies: {
      hash: true,
      timestamp: true,
    },
  },
};
```

### TypeScript Cache

```json
// tsconfig.json

{
  "compilerOptions": {
    // Enable incremental compilation
    "incremental": true,
    
    // Cache file location
    "tsBuildInfoFile": "./node_modules/.cache/typescript/.tsbuildinfo",
    
    // Composite projects for better caching
    "composite": true,
    
    // Declaration maps for faster rebuilds
    "declarationMap": true
  }
}
```

### Babel Cache

```javascript
// babel.config.js

module.exports = {
  presets: [
    ['@babel/preset-env', { targets: 'defaults' }],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  
  // Enable caching
  cacheDirectory: './node_modules/.cache/babel',
  
  // Cache compression
  cacheCompression: true,
  
  // Cache identifier (for invalidation)
  cacheIdentifier: JSON.stringify({
    babel: require('@babel/core/package.json').version,
    env: process.env.NODE_ENV,
  }),
};
```

---

## Remote Build Cache

### Turborepo Remote Cache

```json
// turbo.json

{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

```bash
# Enable remote caching
npx turbo login
npx turbo link

# Or self-hosted
export TURBO_API="https://cache.example.com"
export TURBO_TOKEN="your-token"
export TURBO_TEAM="your-team"
```

### Custom Remote Cache Server

```typescript
// src/cache/remoteCacheServer.ts

import express from 'express';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

const app = express();
const s3 = new S3Client({});
const BUCKET = process.env.CACHE_BUCKET!;

// Authentication middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !validateToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Check if artifact exists
app.head('/v8/artifacts/:hash', async (req, res) => {
  const { hash } = req.params;
  const teamId = req.query.teamId as string;
  
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: `${teamId}/${hash}`,
    }));
    res.status(200).end();
  } catch {
    res.status(404).end();
  }
});

// Get artifact
app.get('/v8/artifacts/:hash', async (req, res) => {
  const { hash } = req.params;
  const teamId = req.query.teamId as string;
  
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: `${teamId}/${hash}`,
    }));
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', response.ContentLength!.toString());
    
    // Stream response
    (response.Body as any).pipe(res);
  } catch {
    res.status(404).json({ error: 'Artifact not found' });
  }
});

// Put artifact
app.put('/v8/artifacts/:hash', express.raw({ limit: '500mb' }), async (req, res) => {
  const { hash } = req.params;
  const teamId = req.query.teamId as string;
  const body = req.body as Buffer;
  
  // Verify hash
  const computedHash = createHash('sha256').update(body).digest('hex');
  if (computedHash !== hash) {
    return res.status(400).json({ error: 'Hash mismatch' });
  }
  
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${teamId}/${hash}`,
      Body: body,
      ContentType: 'application/octet-stream',
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'size': body.length.toString(),
      },
    }));
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get usage stats
app.get('/v8/artifacts/status', async (req, res) => {
  const teamId = req.query.teamId as string;
  
  // Return usage statistics
  res.json({
    status: 'enabled',
    teamId,
    usage: {
      artifacts: 1234,
      totalSize: 5678901234,
    },
  });
});

function validateToken(token: string): boolean {
  // Implement token validation
  return token.length > 0;
}

app.listen(3001, () => {
  console.log('Remote cache server running on port 3001');
});
```

### Nx Cloud Cache

```json
// nx.json

{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "accessToken": "your-nx-cloud-token",
        "cacheableOperations": ["build", "test", "lint", "e2e"],
        "parallel": 3
      }
    }
  },
  "targetDefaults": {
    "build": {
      "cache": true,
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production"],
      "outputs": ["{projectRoot}/coverage"]
    }
  }
}
```

---

## Cache Invalidation

### Invalidation Strategies

```typescript
// src/cache/invalidation.ts

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface InvalidationRule {
  type: 'file' | 'pattern' | 'dependency' | 'time' | 'version';
  value: string | number;
}

class CacheInvalidator {
  private rules: InvalidationRule[] = [];
  private previousState: Map<string, string> = new Map();

  /**
   * Add invalidation rule
   */
  addRule(rule: InvalidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Check if cache should be invalidated
   */
  async shouldInvalidate(projectPath: string): Promise<{
    invalidate: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    for (const rule of this.rules) {
      switch (rule.type) {
        case 'file':
          if (await this.checkFileChanged(projectPath, rule.value as string)) {
            reasons.push(`File changed: ${rule.value}`);
          }
          break;

        case 'pattern':
          const changedFiles = await this.checkPatternChanged(projectPath, rule.value as string);
          if (changedFiles.length > 0) {
            reasons.push(`Files matching ${rule.value} changed: ${changedFiles.join(', ')}`);
          }
          break;

        case 'dependency':
          if (await this.checkDependencyChanged(projectPath, rule.value as string)) {
            reasons.push(`Dependency changed: ${rule.value}`);
          }
          break;

        case 'time':
          if (await this.checkTimeExpired(rule.value as number)) {
            reasons.push(`Cache expired after ${rule.value}ms`);
          }
          break;

        case 'version':
          if (await this.checkVersionChanged(rule.value as string)) {
            reasons.push(`Version changed: ${rule.value}`);
          }
          break;
      }
    }

    return {
      invalidate: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Check if specific file changed
   */
  private async checkFileChanged(projectPath: string, file: string): Promise<boolean> {
    const filePath = path.join(projectPath, file);
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const key = `file:${file}`;
      
      const previousHash = this.previousState.get(key);
      this.previousState.set(key, hash);
      
      return previousHash !== undefined && previousHash !== hash;
    } catch {
      return false;
    }
  }

  /**
   * Check if files matching pattern changed
   */
  private async checkPatternChanged(projectPath: string, pattern: string): Promise<string[]> {
    const changedFiles: string[] = [];
    const files = await this.glob(projectPath, pattern);
    
    for (const file of files) {
      if (await this.checkFileChanged(projectPath, file)) {
        changedFiles.push(file);
      }
    }
    
    return changedFiles;
  }

  /**
   * Check if dependency version changed
   */
  private async checkDependencyChanged(projectPath: string, dep: string): Promise<boolean> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      const version = packageJson.dependencies?.[dep] || 
                      packageJson.devDependencies?.[dep];
      
      const key = `dep:${dep}`;
      const previousVersion = this.previousState.get(key);
      this.previousState.set(key, version);
      
      return previousVersion !== undefined && previousVersion !== version;
    } catch {
      return false;
    }
  }

  /**
   * Check if time-based TTL expired
   */
  private async checkTimeExpired(ttlMs: number): Promise<boolean> {
    const key = 'lastBuild';
    const lastBuild = this.previousState.get(key);
    const now = Date.now().toString();
    
    this.previousState.set(key, now);
    
    if (!lastBuild) return false;
    
    return Date.now() - parseInt(lastBuild) > ttlMs;
  }

  /**
   * Check if build tool version changed
   */
  private async checkVersionChanged(versionKey: string): Promise<boolean> {
    const key = `version:${versionKey}`;
    const currentVersion = process.env[versionKey] || 'unknown';
    const previousVersion = this.previousState.get(key);
    
    this.previousState.set(key, currentVersion);
    
    return previousVersion !== undefined && previousVersion !== currentVersion;
  }

  /**
   * Simple glob implementation
   */
  private async glob(dir: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    const regex = new RegExp(
      '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
    );
    
    const walk = async (currentDir: string, relativePath: string = '') => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(fullPath, relPath);
        } else if (entry.isFile() && regex.test(relPath)) {
          results.push(relPath);
        }
      }
    };
    
    await walk(dir);
    return results;
  }

  /**
   * Save state for persistence
   */
  saveState(): Record<string, string> {
    return Object.fromEntries(this.previousState);
  }

  /**
   * Load state from persistence
   */
  loadState(state: Record<string, string>): void {
    this.previousState = new Map(Object.entries(state));
  }
}

// Default invalidation rules
const defaultInvalidator = new CacheInvalidator();

// Config files
defaultInvalidator.addRule({ type: 'file', value: 'package.json' });
defaultInvalidator.addRule({ type: 'file', value: 'tsconfig.json' });
defaultInvalidator.addRule({ type: 'file', value: 'vite.config.ts' });
defaultInvalidator.addRule({ type: 'file', value: 'webpack.config.js' });

// Lock files
defaultInvalidator.addRule({ type: 'pattern', value: '*-lock.*' });
defaultInvalidator.addRule({ type: 'pattern', value: '*.lock' });

// Time-based expiry (24 hours)
defaultInvalidator.addRule({ type: 'time', value: 24 * 60 * 60 * 1000 });

// Node version
defaultInvalidator.addRule({ type: 'version', value: 'NODE_VERSION' });

export { CacheInvalidator, InvalidationRule, defaultInvalidator };
```

---

## Build Performance

### Performance Metrics

```typescript
// src/build/performance.ts

import { performance, PerformanceObserver } from 'perf_hooks';

interface BuildMetrics {
  totalTime: number;
  phases: {
    name: string;
    duration: number;
    percentage: number;
  }[];
  files: {
    total: number;
    cached: number;
    transformed: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

class BuildPerformanceTracker {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();
  private fileStats = { total: 0, cached: 0, transformed: 0 };
  private cacheStats = { hits: 0, misses: 0 };

  /**
   * Start timing a phase
   */
  startPhase(name: string): void {
    this.marks.set(`${name}-start`, performance.now());
  }

  /**
   * End timing a phase
   */
  endPhase(name: string): number {
    const startMark = this.marks.get(`${name}-start`);
    if (!startMark) {
      throw new Error(`Phase ${name} was not started`);
    }
    
    const duration = performance.now() - startMark;
    this.measures.set(name, duration);
    return duration;
  }

  /**
   * Record file processing
   */
  recordFile(cached: boolean): void {
    this.fileStats.total++;
    if (cached) {
      this.fileStats.cached++;
    } else {
      this.fileStats.transformed++;
    }
  }

  /**
   * Record cache access
   */
  recordCacheAccess(hit: boolean): void {
    if (hit) {
      this.cacheStats.hits++;
    } else {
      this.cacheStats.misses++;
    }
  }

  /**
   * Get final metrics
   */
  getMetrics(): BuildMetrics {
    const totalTime = Array.from(this.measures.values())
      .reduce((sum, duration) => sum + duration, 0);
    
    const phases = Array.from(this.measures.entries())
      .map(([name, duration]) => ({
        name,
        duration,
        percentage: (duration / totalTime) * 100,
      }))
      .sort((a, b) => b.duration - a.duration);
    
    const memoryUsage = process.memoryUsage();
    
    return {
      totalTime,
      phases,
      files: this.fileStats,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      cache: {
        ...this.cacheStats,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
      },
    };
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const metrics = this.getMetrics();
    
    console.log('\n📊 Build Performance Report\n');
    console.log('═'.repeat(60));
    
    // Total time
    console.log(`\n⏱️  Total Build Time: ${(metrics.totalTime / 1000).toFixed(2)}s\n`);
    
    // Phase breakdown
    console.log('📋 Phase Breakdown:');
    for (const phase of metrics.phases) {
      const bar = '█'.repeat(Math.round(phase.percentage / 2));
      console.log(`   ${phase.name.padEnd(20)} ${(phase.duration / 1000).toFixed(2)}s ${bar} ${phase.percentage.toFixed(1)}%`);
    }
    
    // File stats
    console.log('\n📁 File Statistics:');
    console.log(`   Total Files:      ${metrics.files.total}`);
    console.log(`   Cached:           ${metrics.files.cached} (${((metrics.files.cached / metrics.files.total) * 100).toFixed(1)}%)`);
    console.log(`   Transformed:      ${metrics.files.transformed}`);
    
    // Cache stats
    console.log('\n💾 Cache Statistics:');
    console.log(`   Cache Hits:       ${metrics.cache.hits}`);
    console.log(`   Cache Misses:     ${metrics.cache.misses}`);
    console.log(`   Hit Rate:         ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
    
    // Memory stats
    console.log('\n🧠 Memory Usage:');
    console.log(`   Heap Used:        ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap Total:       ${(metrics.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   External:         ${(metrics.memory.external / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n' + '═'.repeat(60) + '\n');
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.marks.clear();
    this.measures.clear();
    this.fileStats = { total: 0, cached: 0, transformed: 0 };
    this.cacheStats = { hits: 0, misses: 0 };
  }
}

export { BuildPerformanceTracker, BuildMetrics };
```

### Cold vs Incremental Build Times

| Project Size | Cold Build | Incremental | With Remote Cache |
|--------------|------------|-------------|-------------------|
| **Small** (<100 files) | 2-5s | 0.5-1s | 0.3-0.5s |
| **Medium** (100-1000 files) | 10-30s | 1-5s | 0.5-2s |
| **Large** (1000-10000 files) | 30-120s | 5-15s | 2-10s |
| **Enterprise** (10000+ files) | 2-10min | 15-60s | 10-30s |

### Optimization Levels

```typescript
// src/build/optimization.ts

type OptimizationLevel = 'none' | 'minimal' | 'standard' | 'aggressive';

interface OptimizationConfig {
  level: OptimizationLevel;
  minify: boolean;
  treeshake: boolean;
  splitChunks: boolean;
  compress: boolean;
  sourcemaps: boolean | 'hidden';
  target: string;
}

const optimizationPresets: Record<OptimizationLevel, OptimizationConfig> = {
  none: {
    level: 'none',
    minify: false,
    treeshake: false,
    splitChunks: false,
    compress: false,
    sourcemaps: true,
    target: 'esnext',
  },
  
  minimal: {
    level: 'minimal',
    minify: false,
    treeshake: true,
    splitChunks: true,
    compress: false,
    sourcemaps: true,
    target: 'es2020',
  },
  
  standard: {
    level: 'standard',
    minify: true,
    treeshake: true,
    splitChunks: true,
    compress: true,
    sourcemaps: 'hidden',
    target: 'es2018',
  },
  
  aggressive: {
    level: 'aggressive',
    minify: true,
    treeshake: true,
    splitChunks: true,
    compress: true,
    sourcemaps: false,
    target: 'es2015',
  },
};

function getOptimizationConfig(
  level: OptimizationLevel,
  overrides?: Partial<OptimizationConfig>
): OptimizationConfig {
  return {
    ...optimizationPresets[level],
    ...overrides,
  };
}

export { OptimizationLevel, OptimizationConfig, optimizationPresets, getOptimizationConfig };
```

---

## Incremental Builds

### Incremental Build Strategy

```typescript
// src/build/incremental.ts

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface FileState {
  path: string;
  hash: string;
  mtime: number;
  dependencies: string[];
}

interface IncrementalBuildState {
  version: string;
  files: Map<string, FileState>;
  outputs: Map<string, string[]>;
}

class IncrementalBuilder {
  private state: IncrementalBuildState;
  private stateFile: string;

  constructor(projectPath: string) {
    this.stateFile = path.join(projectPath, 'node_modules/.cache/incremental-state.json');
    this.state = this.loadState();
  }

  /**
   * Get files that need rebuilding
   */
  async getChangedFiles(allFiles: string[]): Promise<{
    changed: string[];
    added: string[];
    removed: string[];
    unchanged: string[];
  }> {
    const changed: string[] = [];
    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];
    
    const currentFiles = new Set(allFiles);
    const previousFiles = new Set(this.state.files.keys());
    
    // Check for added and changed files
    for (const file of allFiles) {
      const previousState = this.state.files.get(file);
      
      if (!previousState) {
        added.push(file);
        continue;
      }
      
      const currentState = await this.getFileState(file);
      
      if (this.hasFileChanged(previousState, currentState)) {
        changed.push(file);
      } else {
        unchanged.push(file);
      }
    }
    
    // Check for removed files
    for (const file of previousFiles) {
      if (!currentFiles.has(file)) {
        removed.push(file);
      }
    }
    
    return { changed, added, removed, unchanged };
  }

  /**
   * Get files affected by changes (including dependents)
   */
  async getAffectedFiles(changedFiles: string[]): Promise<string[]> {
    const affected = new Set<string>(changedFiles);
    const queue = [...changedFiles];
    
    while (queue.length > 0) {
      const file = queue.shift()!;
      
      // Find files that depend on this file
      for (const [filePath, state] of this.state.files) {
        if (state.dependencies.includes(file) && !affected.has(filePath)) {
          affected.add(filePath);
          queue.push(filePath);
        }
      }
    }
    
    return Array.from(affected);
  }

  /**
   * Update state after build
   */
  async updateState(
    files: string[],
    getDependencies: (file: string) => string[]
  ): Promise<void> {
    for (const file of files) {
      const state = await this.getFileState(file);
      state.dependencies = getDependencies(file);
      this.state.files.set(file, state);
    }
    
    this.saveState();
  }

  /**
   * Remove file from state
   */
  removeFile(file: string): void {
    this.state.files.delete(file);
    this.state.outputs.delete(file);
  }

  /**
   * Get file state
   */
  private async getFileState(file: string): Promise<FileState> {
    const stat = await fs.promises.stat(file);
    const content = await fs.promises.readFile(file);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    return {
      path: file,
      hash,
      mtime: stat.mtimeMs,
      dependencies: [],
    };
  }

  /**
   * Check if file has changed
   */
  private hasFileChanged(previous: FileState, current: FileState): boolean {
    // Fast path: check mtime first
    if (previous.mtime === current.mtime) {
      return false;
    }
    
    // Slow path: compare hashes
    return previous.hash !== current.hash;
  }

  /**
   * Load state from disk
   */
  private loadState(): IncrementalBuildState {
    try {
      const content = fs.readFileSync(this.stateFile, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        version: data.version,
        files: new Map(Object.entries(data.files)),
        outputs: new Map(Object.entries(data.outputs)),
      };
    } catch {
      return {
        version: '1.0.0',
        files: new Map(),
        outputs: new Map(),
      };
    }
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    const dir = path.dirname(this.stateFile);
    fs.mkdirSync(dir, { recursive: true });
    
    const data = {
      version: this.state.version,
      files: Object.fromEntries(this.state.files),
      outputs: Object.fromEntries(this.state.outputs),
    };
    
    fs.writeFileSync(this.stateFile, JSON.stringify(data, null, 2));
  }

  /**
   * Clear state
   */
  clearState(): void {
    this.state = {
      version: '1.0.0',
      files: new Map(),
      outputs: new Map(),
    };
    
    try {
      fs.unlinkSync(this.stateFile);
    } catch {}
  }
}

export { IncrementalBuilder, FileState, IncrementalBuildState };
```

---

## Parallel Builds

### Parallel Build Configuration

```typescript
// src/build/parallel.ts

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';

interface ParallelBuildConfig {
  maxWorkers: number;
  chunkSize: number;
  timeout: number;
}

interface BuildTask {
  id: string;
  file: string;
  config: Record<string, any>;
}

interface BuildResult {
  id: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

class ParallelBuilder {
  private config: ParallelBuildConfig;
  private workers: Worker[] = [];
  private taskQueue: BuildTask[] = [];
  private results: Map<string, BuildResult> = new Map();
  private pendingTasks: Map<string, (result: BuildResult) => void> = new Map();

  constructor(config?: Partial<ParallelBuildConfig>) {
    this.config = {
      maxWorkers: config?.maxWorkers || Math.max(1, os.cpus().length - 1),
      chunkSize: config?.chunkSize || 10,
      timeout: config?.timeout || 30000,
    };
  }

  /**
   * Build files in parallel
   */
  async build(tasks: BuildTask[]): Promise<BuildResult[]> {
    // Initialize worker pool
    await this.initializeWorkers();
    
    // Queue all tasks
    this.taskQueue = [...tasks];
    
    // Process tasks
    const results = await Promise.all(
      tasks.map(task => this.processTask(task))
    );
    
    // Cleanup workers
    await this.terminateWorkers();
    
    return results;
  }

  /**
   * Initialize worker pool
   */
  private async initializeWorkers(): Promise<void> {
    const workerScript = path.join(__dirname, 'buildWorker.js');
    
    for (let i = 0; i < this.config.maxWorkers; i++) {
      const worker = new Worker(workerScript);
      
      worker.on('message', (result: BuildResult) => {
        const resolve = this.pendingTasks.get(result.id);
        if (resolve) {
          resolve(result);
          this.pendingTasks.delete(result.id);
        }
      });
      
      worker.on('error', (error) => {
        console.error('Worker error:', error);
      });
      
      this.workers.push(worker);
    }
  }

  /**
   * Process a single task
   */
  private processTask(task: BuildTask): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
      // Find available worker
      const worker = this.getAvailableWorker();
      
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`));
      }, this.config.timeout);
      
      // Register callback
      this.pendingTasks.set(task.id, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });
      
      // Send task to worker
      worker.postMessage(task);
    });
  }

  /**
   * Get available worker (round-robin)
   */
  private workerIndex = 0;
  private getAvailableWorker(): Worker {
    const worker = this.workers[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Terminate all workers
   */
  private async terminateWorkers(): Promise<void> {
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    this.workers = [];
  }
}

// Worker script (buildWorker.ts)
if (!isMainThread && parentPort) {
  parentPort.on('message', async (task: BuildTask) => {
    const startTime = performance.now();
    
    try {
      // Perform build (simplified)
      const output = await transformFile(task.file, task.config);
      
      parentPort!.postMessage({
        id: task.id,
        success: true,
        output,
        duration: performance.now() - startTime,
      });
    } catch (error: any) {
      parentPort!.postMessage({
        id: task.id,
        success: false,
        error: error.message,
        duration: performance.now() - startTime,
      });
    }
  });
}

async function transformFile(file: string, config: Record<string, any>): Promise<string> {
  // Implement file transformation
  return '';
}

export { ParallelBuilder, ParallelBuildConfig, BuildTask, BuildResult };
```

### Webpack Parallel Configuration

```javascript
// webpack.config.js

const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const os = require('os');

module.exports = {
  // Parallel module resolution
  parallelism: os.cpus().length,
  
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        use: [
          {
            loader: 'thread-loader',
            options: {
              workers: os.cpus().length - 1,
              workerParallelJobs: 50,
              poolTimeout: 2000,
            },
          },
          'babel-loader',
        ],
      },
    ],
  },
  
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
      new CssMinimizerPlugin({
        parallel: true,
      }),
    ],
  },
};
```

---

## Monitoring and Metrics

### Build Metrics Dashboard

```typescript
// src/monitoring/buildMetrics.ts

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

const registry = new Registry();

// Build duration histogram
const buildDuration = new Histogram({
  name: 'build_duration_seconds',
  help: 'Build duration in seconds',
  labelNames: ['project', 'type', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

// Cache hit rate gauge
const cacheHitRate = new Gauge({
  name: 'build_cache_hit_rate',
  help: 'Build cache hit rate',
  labelNames: ['project', 'cache_tier'],
  registers: [registry],
});

// Files processed counter
const filesProcessed = new Counter({
  name: 'build_files_processed_total',
  help: 'Total files processed',
  labelNames: ['project', 'type'],
  registers: [registry],
});

// Build errors counter
const buildErrors = new Counter({
  name: 'build_errors_total',
  help: 'Total build errors',
  labelNames: ['project', 'error_type'],
  registers: [registry],
});

// Memory usage gauge
const memoryUsage = new Gauge({
  name: 'build_memory_bytes',
  help: 'Build memory usage in bytes',
  labelNames: ['project', 'type'],
  registers: [registry],
});

class BuildMetricsCollector {
  private project: string;

  constructor(project: string) {
    this.project = project;
  }

  /**
   * Record build completion
   */
  recordBuild(type: 'cold' | 'incremental', status: 'success' | 'failure', durationMs: number): void {
    buildDuration.observe(
      { project: this.project, type, status },
      durationMs / 1000
    );
  }

  /**
   * Record cache hit rate
   */
  recordCacheHitRate(tier: string, rate: number): void {
    cacheHitRate.set(
      { project: this.project, cache_tier: tier },
      rate
    );
  }

  /**
   * Record files processed
   */
  recordFilesProcessed(type: 'transformed' | 'cached', count: number): void {
    filesProcessed.inc(
      { project: this.project, type },
      count
    );
  }

  /**
   * Record build error
   */
  recordError(errorType: string): void {
    buildErrors.inc({ project: this.project, error_type: errorType });
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    memoryUsage.set({ project: this.project, type: 'heap_used' }, usage.heapUsed);
    memoryUsage.set({ project: this.project, type: 'heap_total' }, usage.heapTotal);
    memoryUsage.set({ project: this.project, type: 'external' }, usage.external);
  }

  /**
   * Get metrics endpoint
   */
  async getMetrics(): Promise<string> {
    return registry.metrics();
  }
}

export { BuildMetricsCollector, registry };
```

---

## Best Practices

### Caching Best Practices

| Practice | Impact | Implementation |
|----------|--------|----------------|
| **Use filesystem cache** | 50-80% faster rebuilds | Enable in webpack/vite config |
| **Enable remote cache** | 30-60% faster CI builds | Turborepo/Nx Cloud |
| **Cache dependencies** | 90%+ faster installs | pnpm store, npm cache |
| **Incremental TypeScript** | 50-70% faster type checking | `incremental: true` |
| **Persistent workers** | 20-40% faster transforms | thread-loader, worker pools |

### Performance Best Practices

| Practice | Impact | Implementation |
|----------|--------|----------------|
| **Use esbuild/SWC** | 10-100x faster transforms | Replace Babel |
| **Parallel builds** | 2-4x faster on multi-core | thread-loader, parallel option |
| **Code splitting** | Smaller initial bundles | Dynamic imports |
| **Tree shaking** | 10-50% smaller bundles | ES modules, sideEffects |
| **Lazy compilation** | Faster dev startup | Vite, webpack lazy compilation |

### Cache Invalidation Guidelines

| Trigger | Action | Scope |
|---------|--------|-------|
| **Config change** | Full rebuild | Project |
| **Dependency update** | Rebuild affected | Partial |
| **Source change** | Incremental rebuild | File + dependents |
| **Node version change** | Full rebuild | Project |
| **Build tool update** | Clear cache | Project |

---

## Summary

### Quick Reference

```bash
# Clear caches
rm -rf node_modules/.cache
rm -rf .vite
rm -rf .next/cache

# Webpack cache
npx webpack --cache-type filesystem

# Vite force re-optimization
npx vite --force

# TypeScript incremental
tsc --incremental

# Turborepo remote cache
npx turbo run build --remote-only
```

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| **Cold build** | <30s | <60s |
| **Incremental build** | <5s | <15s |
| **HMR update** | <100ms | <500ms |
| **Cache hit rate** | >70% | >50% |
| **Memory usage** | <2GB | <4GB |
