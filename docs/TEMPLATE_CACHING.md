# Template Caching

This guide covers the template caching strategy, including whether templates are cached in sandboxes or fetched fresh, cache invalidation, CDN distribution, and performance optimization.

---

## Table of Contents

1. [Caching Overview](#caching-overview)
2. [Cache Architecture](#cache-architecture)
3. [Template Registry Cache](#template-registry-cache)
4. [Template Content Cache](#template-content-cache)
5. [Sandbox-Level Caching](#sandbox-level-caching)
6. [CDN Distribution](#cdn-distribution)
7. [Cache Invalidation](#cache-invalidation)
8. [Performance Optimization](#performance-optimization)

---

## Caching Overview

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE CACHING ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER REQUEST                                                                           │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L1: CDN EDGE CACHE                                                              │   │
│  │  • Template metadata                                                             │   │
│  │  • Template archives (.tar.gz)                                                   │   │
│  │  • TTL: 1 hour (metadata), 24 hours (archives)                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │ MISS                                                                            │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L2: REGIONAL CACHE (Redis Cluster)                                              │   │
│  │  • Template registry                                                             │   │
│  │  • Popular templates                                                             │   │
│  │  • TTL: 5 minutes (registry), 1 hour (templates)                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │ MISS                                                                            │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  L3: ORIGIN (S3 + Database)                                                      │   │
│  │  • Template archives                                                             │   │
│  │  • Template metadata                                                             │   │
│  │  • Version history                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cache Layers Summary

| Layer | Storage | TTL | Content |
|-------|---------|-----|---------|
| **L1: CDN Edge** | CloudFront/Cloudflare | 1-24h | Archives, metadata |
| **L2: Regional** | Redis Cluster | 5m-1h | Registry, hot templates |
| **L3: Origin** | S3 + PostgreSQL | Permanent | All templates |
| **L4: Sandbox** | Local disk | Session | Extracted templates |

---

## Cache Architecture

### Multi-Tier Cache Implementation

```typescript
// cache/template-cache.ts

interface CacheConfig {
  cdnUrl: string;
  redisUrl: string;
  s3Bucket: string;
  ttl: {
    metadata: number;    // seconds
    archive: number;     // seconds
    registry: number;    // seconds
  };
}

interface CachedTemplate {
  id: string;
  version: string;
  metadata: TemplateMetadata;
  archiveUrl: string;
  checksum: string;
  cachedAt: Date;
  expiresAt: Date;
}

class TemplateCacheManager {
  private cdnCache: CDNCache;
  private redisCache: RedisCache;
  private s3Origin: S3Origin;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cdnCache = new CDNCache(config.cdnUrl);
    this.redisCache = new RedisCache(config.redisUrl);
    this.s3Origin = new S3Origin(config.s3Bucket);
  }

  /**
   * Get template with multi-tier caching
   */
  async getTemplate(
    templateId: string,
    version?: string
  ): Promise<CachedTemplate> {
    const cacheKey = this.buildCacheKey(templateId, version);

    // L1: Try CDN edge cache (via HTTP)
    const cdnResult = await this.cdnCache.get(cacheKey);
    if (cdnResult) {
      this.recordCacheHit('cdn', templateId);
      return cdnResult;
    }

    // L2: Try regional Redis cache
    const redisResult = await this.redisCache.get<CachedTemplate>(cacheKey);
    if (redisResult) {
      this.recordCacheHit('redis', templateId);
      // Warm CDN cache asynchronously
      this.warmCDNCache(cacheKey, redisResult);
      return redisResult;
    }

    // L3: Fetch from origin
    const template = await this.fetchFromOrigin(templateId, version);
    
    // Populate caches
    await this.populateCaches(cacheKey, template);
    
    this.recordCacheHit('origin', templateId);
    return template;
  }

  /**
   * Fetch template from origin (S3 + Database)
   */
  private async fetchFromOrigin(
    templateId: string,
    version?: string
  ): Promise<CachedTemplate> {
    // Get metadata from database
    const metadata = await this.getTemplateMetadata(templateId, version);
    
    // Get archive URL from S3
    const archiveKey = `templates/${templateId}/${metadata.version}/template.tar.gz`;
    const archiveUrl = await this.s3Origin.getSignedUrl(archiveKey);
    
    // Get checksum
    const checksumKey = `templates/${templateId}/${metadata.version}/checksum.sha256`;
    const checksum = await this.s3Origin.getObject(checksumKey);

    return {
      id: templateId,
      version: metadata.version,
      metadata,
      archiveUrl,
      checksum,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.ttl.archive * 1000),
    };
  }

  /**
   * Populate all cache layers
   */
  private async populateCaches(
    cacheKey: string,
    template: CachedTemplate
  ): Promise<void> {
    // Populate Redis (L2)
    await this.redisCache.set(
      cacheKey,
      template,
      this.config.ttl.archive
    );

    // CDN (L1) is populated via HTTP responses with cache headers
  }

  /**
   * Warm CDN cache
   */
  private async warmCDNCache(
    cacheKey: string,
    template: CachedTemplate
  ): Promise<void> {
    // Trigger a request to populate CDN edge cache
    // This is done asynchronously
    fetch(`${this.config.cdnUrl}/templates/${cacheKey}`, {
      method: 'HEAD',
    }).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Build cache key
   */
  private buildCacheKey(templateId: string, version?: string): string {
    if (version) {
      return `template:${templateId}:${version}`;
    }
    return `template:${templateId}:latest`;
  }

  /**
   * Record cache hit metrics
   */
  private recordCacheHit(layer: string, templateId: string): void {
    metrics.increment('template_cache_hit', {
      layer,
      template: templateId,
    });
  }

  /**
   * Get template metadata from database
   */
  private async getTemplateMetadata(
    templateId: string,
    version?: string
  ): Promise<TemplateMetadata> {
    // Implementation depends on your database
    const query = version
      ? `SELECT * FROM templates WHERE id = $1 AND version = $2`
      : `SELECT * FROM templates WHERE id = $1 ORDER BY created_at DESC LIMIT 1`;
    
    const result = await db.query(query, version ? [templateId, version] : [templateId]);
    
    if (!result.rows[0]) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return result.rows[0];
  }
}

export { TemplateCacheManager, CachedTemplate, CacheConfig };
```

---

## Template Registry Cache

### Registry Caching

```typescript
// cache/registry-cache.ts

interface TemplateRegistryEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  latestVersion: string;
  downloads: number;
  rating: number;
  updatedAt: Date;
}

interface RegistryCache {
  entries: TemplateRegistryEntry[];
  categories: CategoryIndex;
  tags: TagIndex;
  cachedAt: Date;
  expiresAt: Date;
}

class TemplateRegistryCache {
  private redis: Redis;
  private db: Database;
  private ttl: number = 300; // 5 minutes

  constructor(redis: Redis, db: Database) {
    this.redis = redis;
    this.db = db;
  }

  /**
   * Get full registry (cached)
   */
  async getRegistry(): Promise<RegistryCache> {
    const cacheKey = 'template:registry:full';
    
    // Try cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build from database
    const registry = await this.buildRegistry();
    
    // Cache
    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(registry));
    
    return registry;
  }

  /**
   * Get templates by category (cached)
   */
  async getByCategory(category: string): Promise<TemplateRegistryEntry[]> {
    const cacheKey = `template:registry:category:${category}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const templates = await this.db.query(
      `SELECT * FROM templates 
       WHERE category = $1 AND published = true 
       ORDER BY downloads DESC`,
      [category]
    );

    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(templates.rows));
    
    return templates.rows;
  }

  /**
   * Get templates by tag (cached)
   */
  async getByTag(tag: string): Promise<TemplateRegistryEntry[]> {
    const cacheKey = `template:registry:tag:${tag}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const templates = await this.db.query(
      `SELECT * FROM templates 
       WHERE $1 = ANY(tags) AND published = true 
       ORDER BY downloads DESC`,
      [tag]
    );

    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(templates.rows));
    
    return templates.rows;
  }

  /**
   * Search templates (cached with query hash)
   */
  async search(query: string): Promise<TemplateRegistryEntry[]> {
    const queryHash = this.hashQuery(query);
    const cacheKey = `template:registry:search:${queryHash}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Full-text search
    const templates = await this.db.query(
      `SELECT *, 
        ts_rank(search_vector, plainto_tsquery($1)) as rank
       FROM templates 
       WHERE search_vector @@ plainto_tsquery($1) 
         AND published = true 
       ORDER BY rank DESC, downloads DESC
       LIMIT 50`,
      [query]
    );

    // Cache search results for shorter time (1 minute)
    await this.redis.setex(cacheKey, 60, JSON.stringify(templates.rows));
    
    return templates.rows;
  }

  /**
   * Get popular templates (cached)
   */
  async getPopular(limit: number = 20): Promise<TemplateRegistryEntry[]> {
    const cacheKey = `template:registry:popular:${limit}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const templates = await this.db.query(
      `SELECT * FROM templates 
       WHERE published = true 
       ORDER BY downloads DESC 
       LIMIT $1`,
      [limit]
    );

    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(templates.rows));
    
    return templates.rows;
  }

  /**
   * Get recently updated templates (cached)
   */
  async getRecent(limit: number = 20): Promise<TemplateRegistryEntry[]> {
    const cacheKey = `template:registry:recent:${limit}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const templates = await this.db.query(
      `SELECT * FROM templates 
       WHERE published = true 
       ORDER BY updated_at DESC 
       LIMIT $1`,
      [limit]
    );

    await this.redis.setex(cacheKey, this.ttl, JSON.stringify(templates.rows));
    
    return templates.rows;
  }

  /**
   * Build full registry from database
   */
  private async buildRegistry(): Promise<RegistryCache> {
    const templates = await this.db.query(
      `SELECT * FROM templates WHERE published = true ORDER BY downloads DESC`
    );

    const categories: CategoryIndex = {};
    const tags: TagIndex = {};

    for (const template of templates.rows) {
      // Index by category
      if (!categories[template.category]) {
        categories[template.category] = [];
      }
      categories[template.category].push(template.id);

      // Index by tags
      for (const tag of template.tags || []) {
        if (!tags[tag]) {
          tags[tag] = [];
        }
        tags[tag].push(template.id);
      }
    }

    return {
      entries: templates.rows,
      categories,
      tags,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.ttl * 1000),
    };
  }

  /**
   * Invalidate registry cache
   */
  async invalidate(): Promise<void> {
    const keys = await this.redis.keys('template:registry:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Hash search query for cache key
   */
  private hashQuery(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }
}

export { TemplateRegistryCache, TemplateRegistryEntry, RegistryCache };
```

---

## Template Content Cache

### Archive Caching

```typescript
// cache/archive-cache.ts

interface ArchiveCacheEntry {
  templateId: string;
  version: string;
  archivePath: string;
  checksum: string;
  size: number;
  cachedAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

class TemplateArchiveCache {
  private cacheDir: string;
  private maxSize: number; // bytes
  private redis: Redis;

  constructor(cacheDir: string, maxSize: number, redis: Redis) {
    this.cacheDir = cacheDir;
    this.maxSize = maxSize;
    this.redis = redis;
  }

  /**
   * Get template archive (cached locally)
   */
  async getArchive(
    templateId: string,
    version: string,
    sourceUrl: string,
    expectedChecksum: string
  ): Promise<string> {
    const cacheKey = `${templateId}:${version}`;
    const localPath = path.join(this.cacheDir, `${cacheKey}.tar.gz`);

    // Check local cache
    if (await this.isValidCache(localPath, expectedChecksum)) {
      await this.recordAccess(cacheKey);
      return localPath;
    }

    // Download from source
    await this.downloadArchive(sourceUrl, localPath);

    // Verify checksum
    const actualChecksum = await this.calculateChecksum(localPath);
    if (actualChecksum !== expectedChecksum) {
      await fs.unlink(localPath);
      throw new Error(`Checksum mismatch for ${templateId}@${version}`);
    }

    // Record in cache index
    await this.recordCache(cacheKey, localPath, expectedChecksum);

    // Evict old entries if needed
    await this.evictIfNeeded();

    return localPath;
  }

  /**
   * Check if cached file is valid
   */
  private async isValidCache(
    localPath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      await fs.access(localPath);
      const actualChecksum = await this.calculateChecksum(localPath);
      return actualChecksum === expectedChecksum;
    } catch {
      return false;
    }
  }

  /**
   * Download archive from source
   */
  private async downloadArchive(
    sourceUrl: string,
    localPath: string
  ): Promise<void> {
    const response = await fetch(sourceUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(buffer));
  }

  /**
   * Calculate SHA256 checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Record cache entry
   */
  private async recordCache(
    cacheKey: string,
    localPath: string,
    checksum: string
  ): Promise<void> {
    const stat = await fs.stat(localPath);
    
    const entry: ArchiveCacheEntry = {
      templateId: cacheKey.split(':')[0],
      version: cacheKey.split(':')[1],
      archivePath: localPath,
      checksum,
      size: stat.size,
      cachedAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
    };

    await this.redis.hset('template:archive:cache', cacheKey, JSON.stringify(entry));
  }

  /**
   * Record cache access
   */
  private async recordAccess(cacheKey: string): Promise<void> {
    const entryJson = await this.redis.hget('template:archive:cache', cacheKey);
    if (entryJson) {
      const entry: ArchiveCacheEntry = JSON.parse(entryJson);
      entry.lastAccessed = new Date();
      entry.accessCount++;
      await this.redis.hset('template:archive:cache', cacheKey, JSON.stringify(entry));
    }
  }

  /**
   * Evict old entries if cache is full
   */
  private async evictIfNeeded(): Promise<void> {
    const entries = await this.getAllEntries();
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    if (totalSize <= this.maxSize) {
      return;
    }

    // Sort by LRU (least recently used)
    entries.sort((a, b) => 
      new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    );

    let currentSize = totalSize;
    const targetSize = this.maxSize * 0.8; // Evict to 80% capacity

    for (const entry of entries) {
      if (currentSize <= targetSize) {
        break;
      }

      // Delete file
      try {
        await fs.unlink(entry.archivePath);
      } catch {
        // Ignore
      }

      // Remove from index
      const cacheKey = `${entry.templateId}:${entry.version}`;
      await this.redis.hdel('template:archive:cache', cacheKey);

      currentSize -= entry.size;
    }
  }

  /**
   * Get all cache entries
   */
  private async getAllEntries(): Promise<ArchiveCacheEntry[]> {
    const all = await this.redis.hgetall('template:archive:cache');
    return Object.values(all).map(json => JSON.parse(json));
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    const entries = await this.getAllEntries();
    
    for (const entry of entries) {
      try {
        await fs.unlink(entry.archivePath);
      } catch {
        // Ignore
      }
    }

    await this.redis.del('template:archive:cache');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const entries = await this.getAllEntries();
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);

    return {
      entryCount: entries.length,
      totalSize,
      maxSize: this.maxSize,
      utilizationPercent: (totalSize / this.maxSize) * 100,
      totalAccess,
      hitRate: await this.calculateHitRate(),
    };
  }

  /**
   * Calculate cache hit rate
   */
  private async calculateHitRate(): Promise<number> {
    const hits = parseInt(await this.redis.get('template:archive:cache:hits') || '0');
    const misses = parseInt(await this.redis.get('template:archive:cache:misses') || '0');
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }
}

export { TemplateArchiveCache, ArchiveCacheEntry };
```

---

## Sandbox-Level Caching

### Sandbox Template Cache

```typescript
// cache/sandbox-cache.ts

interface SandboxCacheConfig {
  cacheDir: string;
  maxTemplates: number;
  maxAge: number; // seconds
}

interface SandboxCacheEntry {
  templateId: string;
  version: string;
  extractedPath: string;
  cachedAt: Date;
  size: number;
}

class SandboxTemplateCache {
  private config: SandboxCacheConfig;
  private cacheIndex: Map<string, SandboxCacheEntry> = new Map();

  constructor(config: SandboxCacheConfig) {
    this.config = config;
    this.loadIndex();
  }

  /**
   * Get or extract template in sandbox
   */
  async getTemplate(
    templateId: string,
    version: string,
    archivePath: string
  ): Promise<string> {
    const cacheKey = `${templateId}:${version}`;
    
    // Check if already extracted
    const cached = this.cacheIndex.get(cacheKey);
    if (cached && await this.isValid(cached)) {
      return cached.extractedPath;
    }

    // Extract template
    const extractedPath = await this.extractTemplate(
      templateId,
      version,
      archivePath
    );

    // Record in index
    const entry: SandboxCacheEntry = {
      templateId,
      version,
      extractedPath,
      cachedAt: new Date(),
      size: await this.getDirectorySize(extractedPath),
    };
    
    this.cacheIndex.set(cacheKey, entry);
    await this.saveIndex();

    // Evict old entries
    await this.evictOldEntries();

    return extractedPath;
  }

  /**
   * Check if cached entry is valid
   */
  private async isValid(entry: SandboxCacheEntry): Promise<boolean> {
    // Check if directory exists
    try {
      await fs.access(entry.extractedPath);
    } catch {
      return false;
    }

    // Check age
    const age = (Date.now() - entry.cachedAt.getTime()) / 1000;
    if (age > this.config.maxAge) {
      return false;
    }

    return true;
  }

  /**
   * Extract template archive
   */
  private async extractTemplate(
    templateId: string,
    version: string,
    archivePath: string
  ): Promise<string> {
    const extractDir = path.join(
      this.config.cacheDir,
      'extracted',
      templateId,
      version
    );

    // Create directory
    await fs.mkdir(extractDir, { recursive: true });

    // Extract archive
    const tar = require('tar');
    await tar.extract({
      file: archivePath,
      cwd: extractDir,
    });

    return extractDir;
  }

  /**
   * Evict old entries
   */
  private async evictOldEntries(): Promise<void> {
    const entries = Array.from(this.cacheIndex.entries());
    
    // Sort by age (oldest first)
    entries.sort((a, b) => 
      a[1].cachedAt.getTime() - b[1].cachedAt.getTime()
    );

    // Evict if over limit
    while (this.cacheIndex.size > this.config.maxTemplates) {
      const [key, entry] = entries.shift()!;
      
      // Delete directory
      try {
        await fs.rm(entry.extractedPath, { recursive: true, force: true });
      } catch {
        // Ignore
      }

      this.cacheIndex.delete(key);
    }

    await this.saveIndex();
  }

  /**
   * Clear sandbox cache
   */
  async clear(): Promise<void> {
    for (const entry of this.cacheIndex.values()) {
      try {
        await fs.rm(entry.extractedPath, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }

    this.cacheIndex.clear();
    await this.saveIndex();
  }

  /**
   * Load cache index from disk
   */
  private async loadIndex(): Promise<void> {
    const indexPath = path.join(this.config.cacheDir, 'index.json');
    
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const entries = JSON.parse(content);
      
      for (const [key, entry] of Object.entries(entries)) {
        this.cacheIndex.set(key, {
          ...entry as SandboxCacheEntry,
          cachedAt: new Date((entry as SandboxCacheEntry).cachedAt),
        });
      }
    } catch {
      // No index file, start fresh
    }
  }

  /**
   * Save cache index to disk
   */
  private async saveIndex(): Promise<void> {
    const indexPath = path.join(this.config.cacheDir, 'index.json');
    const entries = Object.fromEntries(this.cacheIndex);
    await fs.writeFile(indexPath, JSON.stringify(entries, null, 2));
  }

  /**
   * Get directory size
   */
  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      }
    }
    
    return size;
  }
}

export { SandboxTemplateCache, SandboxCacheConfig, SandboxCacheEntry };
```

### Fresh vs Cached Decision

```typescript
// cache/cache-strategy.ts

interface CacheDecision {
  useCached: boolean;
  reason: string;
  cacheSource?: 'sandbox' | 'regional' | 'cdn' | 'origin';
}

class TemplateCacheStrategy {
  /**
   * Decide whether to use cached template or fetch fresh
   */
  async decide(
    templateId: string,
    version: string,
    options: {
      forceRefresh?: boolean;
      checkForUpdates?: boolean;
    } = {}
  ): Promise<CacheDecision> {
    // Force refresh requested
    if (options.forceRefresh) {
      return {
        useCached: false,
        reason: 'Force refresh requested',
      };
    }

    // Specific version requested - can always cache
    if (version && version !== 'latest') {
      return {
        useCached: true,
        reason: 'Specific version requested (immutable)',
        cacheSource: 'sandbox',
      };
    }

    // Latest version - check if update available
    if (options.checkForUpdates) {
      const latestVersion = await this.getLatestVersion(templateId);
      const cachedVersion = await this.getCachedVersion(templateId);
      
      if (cachedVersion && cachedVersion === latestVersion) {
        return {
          useCached: true,
          reason: 'Cached version is latest',
          cacheSource: 'sandbox',
        };
      }
      
      return {
        useCached: false,
        reason: `New version available: ${latestVersion}`,
      };
    }

    // Default: use cache if available
    const hasCached = await this.hasCachedVersion(templateId);
    if (hasCached) {
      return {
        useCached: true,
        reason: 'Using cached version',
        cacheSource: 'sandbox',
      };
    }

    return {
      useCached: false,
      reason: 'No cached version available',
    };
  }

  /**
   * Get latest version from registry
   */
  private async getLatestVersion(templateId: string): Promise<string> {
    // Check registry cache
    const registry = await registryCache.getRegistry();
    const template = registry.entries.find(t => t.id === templateId);
    return template?.latestVersion || '0.0.0';
  }

  /**
   * Get cached version
   */
  private async getCachedVersion(templateId: string): Promise<string | null> {
    // Check sandbox cache
    for (const [key, entry] of sandboxCache.cacheIndex.entries()) {
      if (entry.templateId === templateId) {
        return entry.version;
      }
    }
    return null;
  }

  /**
   * Check if template is cached
   */
  private async hasCachedVersion(templateId: string): Promise<boolean> {
    return await this.getCachedVersion(templateId) !== null;
  }
}

export { TemplateCacheStrategy, CacheDecision };
```

---

## CDN Distribution

### CDN Configuration

```typescript
// cdn/template-cdn.ts

interface CDNConfig {
  provider: 'cloudfront' | 'cloudflare' | 'fastly';
  distributionId: string;
  originBucket: string;
  cacheBehaviors: CacheBehavior[];
}

interface CacheBehavior {
  pathPattern: string;
  ttl: number;
  compress: boolean;
  headers: string[];
}

const cdnConfig: CDNConfig = {
  provider: 'cloudfront',
  distributionId: 'E1234567890',
  originBucket: 'templates-origin',
  cacheBehaviors: [
    {
      // Template archives - long cache
      pathPattern: '/templates/*/archive.tar.gz',
      ttl: 86400, // 24 hours
      compress: false, // Already compressed
      headers: ['Accept-Encoding'],
    },
    {
      // Template metadata - short cache
      pathPattern: '/templates/*/metadata.json',
      ttl: 3600, // 1 hour
      compress: true,
      headers: ['Accept-Encoding'],
    },
    {
      // Registry - very short cache
      pathPattern: '/registry/*',
      ttl: 300, // 5 minutes
      compress: true,
      headers: ['Accept-Encoding'],
    },
    {
      // Checksums - long cache (immutable)
      pathPattern: '/templates/*/checksum.sha256',
      ttl: 31536000, // 1 year
      compress: false,
      headers: [],
    },
  ],
};
```

### CloudFront Configuration (Terraform)

```hcl
# cdn/cloudfront.tf

resource "aws_cloudfront_distribution" "templates" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Template CDN Distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"

  origin {
    domain_name = aws_s3_bucket.templates.bucket_regional_domain_name
    origin_id   = "S3-templates"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.templates.cloudfront_access_identity_path
    }
  }

  # Default behavior - template archives
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-templates"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 24 hours
    max_ttl                = 604800   # 7 days
    compress               = true
  }

  # Metadata behavior - shorter cache
  ordered_cache_behavior {
    path_pattern     = "/templates/*/metadata.json"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-templates"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600     # 1 hour
    max_ttl                = 86400    # 24 hours
    compress               = true
  }

  # Registry behavior - very short cache
  ordered_cache_behavior {
    path_pattern     = "/registry/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-templates"

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 300      # 5 minutes
    max_ttl                = 3600     # 1 hour
    compress               = true
  }

  # Checksum behavior - immutable, long cache
  ordered_cache_behavior {
    path_pattern     = "/templates/*/checksum.sha256"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-templates"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 31536000  # 1 year
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = false
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.templates.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "templates-cdn"
    Environment = var.environment
  }
}

# Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "templates" {
  comment = "OAI for templates bucket"
}

# S3 bucket policy for CloudFront
resource "aws_s3_bucket_policy" "templates" {
  bucket = aws_s3_bucket.templates.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.templates.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.templates.arn}/*"
      }
    ]
  })
}
```

---

## Cache Invalidation

### Invalidation Strategy

```typescript
// cache/invalidation.ts

interface InvalidationRequest {
  templateId: string;
  version?: string;
  reason: string;
  scope: 'all' | 'metadata' | 'archive' | 'registry';
}

interface InvalidationResult {
  success: boolean;
  invalidatedPaths: string[];
  errors: string[];
}

class CacheInvalidator {
  private cdn: CDNClient;
  private redis: Redis;

  constructor(cdn: CDNClient, redis: Redis) {
    this.cdn = cdn;
    this.redis = redis;
  }

  /**
   * Invalidate template cache
   */
  async invalidate(request: InvalidationRequest): Promise<InvalidationResult> {
    const paths: string[] = [];
    const errors: string[] = [];

    try {
      // Determine paths to invalidate
      if (request.scope === 'all' || request.scope === 'metadata') {
        paths.push(`/templates/${request.templateId}/*/metadata.json`);
      }
      
      if (request.scope === 'all' || request.scope === 'archive') {
        if (request.version) {
          paths.push(`/templates/${request.templateId}/${request.version}/*`);
        } else {
          paths.push(`/templates/${request.templateId}/*/*`);
        }
      }
      
      if (request.scope === 'all' || request.scope === 'registry') {
        paths.push('/registry/*');
      }

      // Invalidate CDN
      await this.invalidateCDN(paths);

      // Invalidate Redis
      await this.invalidateRedis(request);

      // Log invalidation
      await this.logInvalidation(request, paths);

      return {
        success: true,
        invalidatedPaths: paths,
        errors: [],
      };
    } catch (error) {
      errors.push((error as Error).message);
      return {
        success: false,
        invalidatedPaths: paths,
        errors,
      };
    }
  }

  /**
   * Invalidate CDN cache
   */
  private async invalidateCDN(paths: string[]): Promise<void> {
    await this.cdn.createInvalidation({
      DistributionId: process.env.CDN_DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `invalidation-${Date.now()}`,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    });
  }

  /**
   * Invalidate Redis cache
   */
  private async invalidateRedis(request: InvalidationRequest): Promise<void> {
    const patterns: string[] = [];

    if (request.scope === 'all' || request.scope === 'metadata') {
      patterns.push(`template:${request.templateId}:*`);
    }

    if (request.scope === 'all' || request.scope === 'registry') {
      patterns.push('template:registry:*');
    }

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  /**
   * Log invalidation for audit
   */
  private async logInvalidation(
    request: InvalidationRequest,
    paths: string[]
  ): Promise<void> {
    await this.redis.lpush('template:invalidation:log', JSON.stringify({
      ...request,
      paths,
      timestamp: new Date().toISOString(),
    }));

    // Keep only last 1000 entries
    await this.redis.ltrim('template:invalidation:log', 0, 999);
  }

  /**
   * Invalidate on template publish
   */
  async onTemplatePublish(templateId: string, version: string): Promise<void> {
    await this.invalidate({
      templateId,
      version,
      reason: 'New version published',
      scope: 'all',
    });
  }

  /**
   * Invalidate on template update
   */
  async onTemplateUpdate(templateId: string): Promise<void> {
    await this.invalidate({
      templateId,
      reason: 'Template metadata updated',
      scope: 'metadata',
    });
  }

  /**
   * Invalidate on template unpublish
   */
  async onTemplateUnpublish(templateId: string): Promise<void> {
    await this.invalidate({
      templateId,
      reason: 'Template unpublished',
      scope: 'all',
    });
  }
}

export { CacheInvalidator, InvalidationRequest, InvalidationResult };
```

### Automatic Invalidation Triggers

```typescript
// cache/invalidation-triggers.ts

class InvalidationTriggers {
  private invalidator: CacheInvalidator;

  constructor(invalidator: CacheInvalidator) {
    this.invalidator = invalidator;
    this.setupTriggers();
  }

  /**
   * Setup automatic invalidation triggers
   */
  private setupTriggers(): void {
    // Listen for template events
    eventBus.on('template:published', async (event) => {
      await this.invalidator.onTemplatePublish(
        event.templateId,
        event.version
      );
    });

    eventBus.on('template:updated', async (event) => {
      await this.invalidator.onTemplateUpdate(event.templateId);
    });

    eventBus.on('template:unpublished', async (event) => {
      await this.invalidator.onTemplateUnpublish(event.templateId);
    });

    eventBus.on('template:deleted', async (event) => {
      await this.invalidator.invalidate({
        templateId: event.templateId,
        reason: 'Template deleted',
        scope: 'all',
      });
    });

    // Scheduled registry refresh
    setInterval(async () => {
      await this.invalidator.invalidate({
        templateId: '*',
        reason: 'Scheduled registry refresh',
        scope: 'registry',
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

export { InvalidationTriggers };
```

---

## Performance Optimization

### Cache Warming

```typescript
// cache/cache-warmer.ts

interface WarmingConfig {
  popularTemplateCount: number;
  warmingInterval: number; // ms
  concurrency: number;
}

class CacheWarmer {
  private config: WarmingConfig;
  private cacheManager: TemplateCacheManager;

  constructor(config: WarmingConfig, cacheManager: TemplateCacheManager) {
    this.config = config;
    this.cacheManager = cacheManager;
  }

  /**
   * Warm cache with popular templates
   */
  async warmPopularTemplates(): Promise<void> {
    const popular = await this.getPopularTemplates();
    
    // Warm in batches
    const batches = this.chunk(popular, this.config.concurrency);
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(template => 
          this.warmTemplate(template.id, template.latestVersion)
        )
      );
    }
  }

  /**
   * Warm single template
   */
  private async warmTemplate(
    templateId: string,
    version: string
  ): Promise<void> {
    try {
      await this.cacheManager.getTemplate(templateId, version);
      console.log(`Warmed cache for ${templateId}@${version}`);
    } catch (error) {
      console.error(`Failed to warm ${templateId}@${version}:`, error);
    }
  }

  /**
   * Get popular templates
   */
  private async getPopularTemplates(): Promise<TemplateRegistryEntry[]> {
    return await registryCache.getPopular(this.config.popularTemplateCount);
  }

  /**
   * Start scheduled warming
   */
  startScheduledWarming(): void {
    // Initial warming
    this.warmPopularTemplates();

    // Scheduled warming
    setInterval(() => {
      this.warmPopularTemplates();
    }, this.config.warmingInterval);
  }

  /**
   * Chunk array into batches
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export { CacheWarmer, WarmingConfig };
```

### Cache Metrics

```typescript
// cache/cache-metrics.ts

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  avgLatency: number;
  byLayer: {
    cdn: LayerMetrics;
    redis: LayerMetrics;
    origin: LayerMetrics;
  };
  byTemplate: Map<string, TemplateMetrics>;
}

interface LayerMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgLatency: number;
}

interface TemplateMetrics {
  templateId: string;
  accessCount: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatency: number;
}

class CacheMetricsCollector {
  private redis: Redis;
  private metricsPrefix = 'template:cache:metrics';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Record cache access
   */
  async recordAccess(
    templateId: string,
    layer: 'cdn' | 'redis' | 'origin',
    latency: number
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 60000); // Per-minute bucket
    
    // Increment counters
    await this.redis.hincrby(`${this.metricsPrefix}:${timestamp}`, `${layer}:hits`, 1);
    await this.redis.hincrby(`${this.metricsPrefix}:${timestamp}`, `${layer}:latency`, latency);
    await this.redis.hincrby(`${this.metricsPrefix}:template:${templateId}`, 'access', 1);
    await this.redis.hincrby(`${this.metricsPrefix}:template:${templateId}`, `${layer}:hits`, 1);

    // Set expiry (keep 24 hours of metrics)
    await this.redis.expire(`${this.metricsPrefix}:${timestamp}`, 86400);
  }

  /**
   * Record cache miss
   */
  async recordMiss(
    templateId: string,
    layer: 'cdn' | 'redis'
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 60000);
    
    await this.redis.hincrby(`${this.metricsPrefix}:${timestamp}`, `${layer}:misses`, 1);
    await this.redis.hincrby(`${this.metricsPrefix}:template:${templateId}`, `${layer}:misses`, 1);
  }

  /**
   * Get aggregated metrics
   */
  async getMetrics(timeRange: number = 3600): Promise<CacheMetrics> {
    const now = Math.floor(Date.now() / 60000);
    const buckets = Math.ceil(timeRange / 60);
    
    let cdnHits = 0, cdnMisses = 0, cdnLatency = 0;
    let redisHits = 0, redisMisses = 0, redisLatency = 0;
    let originHits = 0, originLatency = 0;

    for (let i = 0; i < buckets; i++) {
      const bucket = now - i;
      const data = await this.redis.hgetall(`${this.metricsPrefix}:${bucket}`);
      
      cdnHits += parseInt(data['cdn:hits'] || '0');
      cdnMisses += parseInt(data['cdn:misses'] || '0');
      cdnLatency += parseInt(data['cdn:latency'] || '0');
      
      redisHits += parseInt(data['redis:hits'] || '0');
      redisMisses += parseInt(data['redis:misses'] || '0');
      redisLatency += parseInt(data['redis:latency'] || '0');
      
      originHits += parseInt(data['origin:hits'] || '0');
      originLatency += parseInt(data['origin:latency'] || '0');
    }

    const totalHits = cdnHits + redisHits + originHits;
    const totalMisses = cdnMisses + redisMisses;
    const totalRequests = totalHits + totalMisses;

    return {
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (totalMisses / totalRequests) * 100 : 0,
      avgLatency: totalHits > 0 ? (cdnLatency + redisLatency + originLatency) / totalHits : 0,
      byLayer: {
        cdn: {
          hits: cdnHits,
          misses: cdnMisses,
          hitRate: (cdnHits + cdnMisses) > 0 ? (cdnHits / (cdnHits + cdnMisses)) * 100 : 0,
          avgLatency: cdnHits > 0 ? cdnLatency / cdnHits : 0,
        },
        redis: {
          hits: redisHits,
          misses: redisMisses,
          hitRate: (redisHits + redisMisses) > 0 ? (redisHits / (redisHits + redisMisses)) * 100 : 0,
          avgLatency: redisHits > 0 ? redisLatency / redisHits : 0,
        },
        origin: {
          hits: originHits,
          misses: 0,
          hitRate: 100,
          avgLatency: originHits > 0 ? originLatency / originHits : 0,
        },
      },
      byTemplate: new Map(), // Populated separately
    };
  }
}

export { CacheMetricsCollector, CacheMetrics, LayerMetrics };
```

---

## Summary

### Caching Strategy

| Layer | Storage | TTL | Use Case |
|-------|---------|-----|----------|
| **CDN Edge** | CloudFront | 1-24h | Global distribution |
| **Regional** | Redis | 5m-1h | Hot data, registry |
| **Origin** | S3 + DB | Permanent | Source of truth |
| **Sandbox** | Local disk | Session | Extracted templates |

### Cache Decision Matrix

| Scenario | Strategy | Reason |
|----------|----------|--------|
| Specific version | Always cache | Immutable |
| Latest version | Check for updates | May change |
| Force refresh | Bypass cache | User request |
| Popular template | Pre-warm | Performance |
| New template | Fetch fresh | Not cached |

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| CDN hit rate | >90% | >80% |
| Redis hit rate | >95% | >90% |
| Overall hit rate | >98% | >95% |
| CDN latency | <50ms | <100ms |
| Redis latency | <10ms | <50ms |
| Origin latency | <500ms | <1s |

### Best Practices

1. **Cache immutable content aggressively** (specific versions)
2. **Use short TTL for mutable content** (registry, metadata)
3. **Pre-warm popular templates** for better performance
4. **Invalidate on publish** to ensure freshness
5. **Monitor cache metrics** and adjust TTLs
6. **Use CDN for global distribution** of archives
