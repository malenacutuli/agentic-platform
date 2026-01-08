# Cold Start Latency: Optimizing Sandbox Resume Performance

## Overview

Cold start latency is the time it takes to resume a hibernated sandbox from disk to a fully operational state. For a platform like SwissBrain serving thousands of users, this is critical:

- **Poor cold start** (10-30s): Users perceive lag, poor experience
- **Good cold start** (2-5s): Acceptable for most workloads
- **Excellent cold start** (<1s): Premium user experience

This guide covers the complete optimization pipeline from hibernation to full operational state.

## Cold Start Timeline Breakdown

```
Total Cold Start Time: ~2-3 seconds (optimized)

├─ Checkpoint Restore (200-400ms)
│  ├─ Load container image (50-100ms)
│  ├─ Restore memory state (100-200ms)
│  └─ Restore filesystem (50-100ms)
│
├─ Container Startup (400-600ms)
│  ├─ Initialize cgroups (50ms)
│  ├─ Setup networking (100-150ms)
│  ├─ Start init process (50-100ms)
│  └─ Load runtime (200-250ms)
│
├─ Application Startup (800-1200ms)
│  ├─ Load dependencies (300-400ms)
│  ├─ Initialize database connections (200-300ms)
│  ├─ Start dev server (200-300ms)
│  └─ Ready for requests (100-200ms)
│
└─ Network & DNS (100-200ms)
   ├─ DNS resolution (50ms)
   ├─ Network interface setup (50ms)
   └─ Route configuration (50ms)
```

## 1. Container Image Optimization

### 1.1 Layered Image Strategy

```typescript
/**
 * Optimize container images for fast startup
 * 
 * Strategy:
 * - Minimal base image
 * - Cached layers
 * - Pre-built dependencies
 * - Optimized layer ordering
 */

interface DockerImageLayer {
  id: string;
  size: number;
  createdAt: Date;
  digest: string;
  cached: boolean;
}

class ContainerImageOptimizer {
  /**
   * Create optimized multi-stage Dockerfile
   */
  generateOptimizedDockerfile(projectType: string): string {
    return `
# Stage 1: Dependencies (cached)
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Stage 2: Build (cached if source unchanged)
FROM dependencies AS builder
COPY . .
RUN pnpm build

# Stage 3: Runtime (minimal)
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy only production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000
CMD ["node", "dist/index.js"]
    `;
  }

  /**
   * Analyze image layers for optimization
   */
  async analyzeLayers(imageName: string): Promise<ImageAnalysis> {
    const { stdout } = await execAsync(`docker history ${imageName} --no-trunc --quiet`);

    const layers: DockerImageLayer[] = [];
    const layerIds = stdout.trim().split('\n');

    for (const id of layerIds) {
      const { stdout: inspect } = await execAsync(`docker inspect ${id}`);
      const layerInfo = JSON.parse(inspect)[0];

      layers.push({
        id: id.substring(0, 12),
        size: layerInfo.Size || 0,
        createdAt: new Date(layerInfo.Created),
        digest: layerInfo.Id,
        cached: false
      });
    }

    const analysis: ImageAnalysis = {
      imageName,
      totalSize: layers.reduce((sum, l) => sum + l.size, 0),
      layerCount: layers.length,
      layers,
      recommendations: this.generateRecommendations(layers)
    };

    return analysis;
  }

  /**
   * Compress image layers
   */
  async compressImage(imageName: string): Promise<number> {
    console.log(`Compressing image ${imageName}...`);

    // Export image
    await execAsync(`docker save ${imageName} | gzip > /tmp/${imageName}.tar.gz`);

    // Get compressed size
    const { stdout } = await execAsync(`du -h /tmp/${imageName}.tar.gz`);
    const sizeStr = stdout.split('\t')[0];

    console.log(`✓ Image compressed to ${sizeStr}`);

    return parseInt(sizeStr);
  }

  /**
   * Pre-warm image cache
   */
  async prewarmImageCache(imageName: string, nodeCount: number): Promise<void> {
    console.log(`Pre-warming image cache on ${nodeCount} nodes...`);

    for (let i = 0; i < nodeCount; i++) {
      await execAsync(`docker pull ${imageName}`);
    }

    console.log(`✓ Image cache pre-warmed`);
  }

  private generateRecommendations(layers: DockerImageLayer[]): string[] {
    const recommendations: string[] = [];

    // Check for large layers
    const largeLayer = layers.find(l => l.size > 100 * 1024 * 1024);
    if (largeLayer) {
      recommendations.push(`Layer ${largeLayer.id} is large (${largeLayer.size}MB). Consider splitting.`);
    }

    // Check layer count
    if (layers.length > 20) {
      recommendations.push(`Too many layers (${layers.length}). Consider consolidating.`);
    }

    return recommendations;
  }
}

interface ImageAnalysis {
  imageName: string;
  totalSize: number;
  layerCount: number;
  layers: DockerImageLayer[];
  recommendations: string[];
}
```

### 1.2 Image Caching Strategy

```typescript
class ImageCacheManager {
  /**
   * Implement multi-level image cache
   */
  async setupImageCache(): Promise<void> {
    console.log('Setting up image cache...');

    // Level 1: Local Docker daemon cache
    await execAsync('docker system prune -af --volumes');

    // Level 2: Registry cache (pull through cache)
    const registryConfig = `
version: '3'
services:
  registry:
    image: registry:2
    ports:
      - "5000:5000"
    environment:
      REGISTRY_PROXY_REMOTEURL: https://registry-1.docker.io
    volumes:
      - /var/lib/registry:/var/lib/registry
    `;

    await this.writeFile('/tmp/registry-compose.yml', registryConfig);
    await execAsync('docker-compose -f /tmp/registry-compose.yml up -d');

    // Level 3: Node-local cache
    await execAsync('mkdir -p /var/cache/docker-images');

    console.log('✓ Image cache configured');
  }

  /**
   * Prefetch images to node
   */
  async prefetchImageToNode(imageName: string, nodeId: string): Promise<void> {
    console.log(`Prefetching ${imageName} to node ${nodeId}...`);

    // SSH to node and pull image
    await execAsync(`ssh node-${nodeId} docker pull ${imageName}`);

    console.log(`✓ Image prefetched to node ${nodeId}`);
  }

  /**
   * Monitor cache hit rates
   */
  async monitorCacheHitRate(): Promise<CacheStats> {
    const { stdout: pullStats } = await execAsync(
      'docker events --filter type=image --filter action=pull --since 1h'
    );

    const pulls = pullStats.split('\n').length;

    // Calculate hit rate from logs
    const { stdout: logs } = await execAsync(
      'journalctl -u docker -n 1000 | grep -c "Already exists"'
    );

    const hits = parseInt(logs.trim()) || 0;
    const hitRate = hits / (pulls || 1);

    return {
      totalPulls: pulls,
      cacheHits: hits,
      hitRate: hitRate * 100,
      timestamp: new Date()
    };
  }
}

interface CacheStats {
  totalPulls: number;
  cacheHits: number;
  hitRate: number;
  timestamp: Date;
}
```

## 2. Checkpoint/Restore Optimization (CRIU)

### 2.1 CRIU-based Fast Restore

```typescript
/**
 * CRIU (Checkpoint/Restore In Userspace)
 * 
 * Enables:
 * - Sub-second container restore
 * - Memory state preservation
 * - Process state preservation
 * - Network connection preservation
 */

class CRIUCheckpointManager {
  /**
   * Create checkpoint of running container
   */
  async createCheckpoint(
    containerId: string,
    checkpointName: string,
    options?: CheckpointOptions
  ): Promise<CheckpointMetadata> {
    console.log(`Creating checkpoint ${checkpointName} for ${containerId}...`);

    const startTime = Date.now();

    // Create checkpoint directory
    const checkpointDir = `/var/lib/docker/containers/${containerId}/checkpoints/${checkpointName}`;
    await execAsync(`mkdir -p ${checkpointDir}`);

    // Run CRIU to checkpoint
    const criuCmd = `
criu dump \\
  --images-dir ${checkpointDir} \\
  --pid $(docker inspect -f '{{.State.Pid}}' ${containerId}) \\
  --log-file ${checkpointDir}/dump.log \\
  --leave-running \\
  ${options?.exitAfterDump ? '--shell-job' : ''} \\
  ${options?.tcpEstablished ? '--tcp-established' : ''}
    `;

    await execAsync(criuCmd);

    // Get checkpoint size
    const { stdout: sizeStr } = await execAsync(`du -sh ${checkpointDir}`);
    const size = parseInt(sizeStr.split('\t')[0]);

    const duration = Date.now() - startTime;

    const metadata: CheckpointMetadata = {
      checkpointName,
      containerId,
      createdAt: new Date(),
      size,
      duration,
      path: checkpointDir,
      status: 'completed'
    };

    // Save metadata
    await this.saveCheckpointMetadata(metadata);

    console.log(`✓ Checkpoint created: ${checkpointName} (${size}MB, ${duration}ms)`);

    return metadata;
  }

  /**
   * Restore container from checkpoint
   */
  async restoreFromCheckpoint(
    checkpointName: string,
    containerId: string
  ): Promise<RestoreMetrics> {
    console.log(`Restoring from checkpoint ${checkpointName}...`);

    const startTime = Date.now();
    const checkpointDir = `/var/lib/docker/containers/${containerId}/checkpoints/${checkpointName}`;

    // Run CRIU to restore
    const criuCmd = `
criu restore \\
  --images-dir ${checkpointDir} \\
  --log-file ${checkpointDir}/restore.log \\
  --shell-job
    `;

    await execAsync(criuCmd);

    const restoreTime = Date.now() - startTime;

    // Verify container is running
    const { stdout: status } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${containerId}`
    );

    const metrics: RestoreMetrics = {
      checkpointName,
      containerId,
      restoreTime,
      success: status.trim() === 'true',
      timestamp: new Date()
    };

    console.log(`✓ Restored in ${restoreTime}ms`);

    return metrics;
  }

  /**
   * Incremental checkpoint (delta)
   */
  async createIncrementalCheckpoint(
    containerId: string,
    baseCheckpoint: string,
    deltaName: string
  ): Promise<CheckpointMetadata> {
    console.log(`Creating incremental checkpoint ${deltaName}...`);

    const startTime = Date.now();
    const baseDir = `/var/lib/docker/containers/${containerId}/checkpoints/${baseCheckpoint}`;
    const deltaDir = `/var/lib/docker/containers/${containerId}/checkpoints/${deltaName}`;

    await execAsync(`mkdir -p ${deltaDir}`);

    // Create delta checkpoint
    const criuCmd = `
criu dump \\
  --images-dir ${deltaDir} \\
  --parent-images ${baseDir} \\
  --pid $(docker inspect -f '{{.State.Pid}}' ${containerId}) \\
  --log-file ${deltaDir}/dump.log \\
  --leave-running
    `;

    await execAsync(criuCmd);

    const { stdout: sizeStr } = await execAsync(`du -sh ${deltaDir}`);
    const size = parseInt(sizeStr.split('\t')[0]);

    const duration = Date.now() - startTime;

    return {
      checkpointName: deltaName,
      containerId,
      createdAt: new Date(),
      size,
      duration,
      path: deltaDir,
      status: 'completed',
      isIncremental: true,
      baseCheckpoint
    };
  }

  /**
   * Optimize checkpoint size
   */
  async optimizeCheckpoint(checkpointDir: string): Promise<OptimizationResult> {
    console.log(`Optimizing checkpoint ${checkpointDir}...`);

    const startSize = await this.getDirectorySize(checkpointDir);

    // Compress checkpoint images
    await execAsync(`cd ${checkpointDir} && tar -czf images.tar.gz *.img && rm *.img`);

    const endSize = await this.getDirectorySize(checkpointDir);
    const compressionRatio = ((startSize - endSize) / startSize) * 100;

    return {
      originalSize: startSize,
      optimizedSize: endSize,
      compressionRatio,
      savedBytes: startSize - endSize
    };
  }

  private async saveCheckpointMetadata(metadata: CheckpointMetadata): Promise<void> {
    const metadataPath = `${metadata.path}/metadata.json`;
    await execAsync(`echo '${JSON.stringify(metadata)}' > ${metadataPath}`);
  }

  private async getDirectorySize(dir: string): Promise<number> {
    const { stdout } = await execAsync(`du -sb ${dir}`);
    return parseInt(stdout.split('\t')[0]);
  }
}

interface CheckpointOptions {
  exitAfterDump?: boolean;
  tcpEstablished?: boolean;
  freezeTime?: boolean;
}

interface CheckpointMetadata {
  checkpointName: string;
  containerId: string;
  createdAt: Date;
  size: number;
  duration: number;
  path: string;
  status: string;
  isIncremental?: boolean;
  baseCheckpoint?: string;
}

interface RestoreMetrics {
  checkpointName: string;
  containerId: string;
  restoreTime: number;
  success: boolean;
  timestamp: Date;
}

interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  savedBytes: number;
}
```

## 3. Filesystem Optimization

### 3.1 Lazy Loading and Copy-on-Write

```typescript
/**
 * Optimize filesystem restore with lazy loading
 * 
 * Strategy:
 * - Don't restore all files upfront
 * - Load files on-demand
 * - Use copy-on-write for efficiency
 */

class FilesystemOptimizer {
  /**
   * Setup overlay filesystem for fast restore
   */
  async setupOverlayFilesystem(
    sandboxId: string,
    baseLayer: string,
    checkpointLayer: string
  ): Promise<void> {
    console.log(`Setting up overlay filesystem for ${sandboxId}...`);

    const workDir = `/var/lib/sandbox/${sandboxId}/work`;
    const mergedDir = `/var/lib/sandbox/${sandboxId}/merged`;

    // Create directories
    await execAsync(`mkdir -p ${workDir} ${mergedDir}`);

    // Mount overlay
    const mountCmd = `
mount -t overlay overlay \\
  -o lowerdir=${baseLayer}:${checkpointLayer},upperdir=${workDir},workdir=${workDir}/work \\
  ${mergedDir}
    `;

    await execAsync(mountCmd);

    console.log(`✓ Overlay filesystem mounted for ${sandboxId}`);
  }

  /**
   * Implement lazy file loading with FUSE
   */
  async setupLazyFileLoading(sandboxId: string, checkpointPath: string): Promise<void> {
    console.log(`Setting up lazy file loading for ${sandboxId}...`);

    // Create FUSE mount for lazy loading
    const fuseScript = `
#!/usr/bin/env python3
import os
import sys
from fuse import FUSE, FuseOSError, Operations

class LazyLoadingFS(Operations):
    def __init__(self, checkpoint_path):
        self.checkpoint_path = checkpoint_path
        self.loaded_files = set()

    def getattr(self, path, fh=None):
        # Return file metadata without loading content
        full_path = os.path.join(self.checkpoint_path, path.lstrip('/'))
        return os.stat(full_path)

    def read(self, path, size, offset, fh):
        # Load file content on first read
        full_path = os.path.join(self.checkpoint_path, path.lstrip('/'))
        
        if path not in self.loaded_files:
            print(f"Loading {path} on demand...")
            self.loaded_files.add(path)
        
        with open(full_path, 'rb') as f:
            f.seek(offset)
            return f.read(size)

    def readdir(self, path, fh):
        full_path = os.path.join(self.checkpoint_path, path.lstrip('/'))
        return ['.', '..'] + os.listdir(full_path)

if __name__ == '__main__':
    checkpoint_path = sys.argv[1]
    mount_point = sys.argv[2]
    FUSE(LazyLoadingFS(checkpoint_path), mount_point, nothreads=True, foreground=True)
    `;

    await this.writeFile(`/tmp/lazy_fs_${sandboxId}.py`, fuseScript);
    await execAsync(`chmod +x /tmp/lazy_fs_${sandboxId}.py`);

    // Mount lazy filesystem
    const mountPoint = `/mnt/lazy_${sandboxId}`;
    await execAsync(`mkdir -p ${mountPoint}`);
    await execAsync(
      `python3 /tmp/lazy_fs_${sandboxId}.py ${checkpointPath} ${mountPoint} &`
    );

    console.log(`✓ Lazy file loading enabled for ${sandboxId}`);
  }

  /**
   * Prefetch frequently accessed files
   */
  async prefetchFiles(sandboxId: string, fileList: string[]): Promise<void> {
    console.log(`Prefetching ${fileList.length} files for ${sandboxId}...`);

    const startTime = Date.now();

    for (const file of fileList) {
      // Read file to load into page cache
      await execAsync(`cat ${file} > /dev/null`);
    }

    const duration = Date.now() - startTime;
    console.log(`✓ Prefetched ${fileList.length} files in ${duration}ms`);
  }

  /**
   * Analyze file access patterns
   */
  async analyzeFileAccessPatterns(sandboxId: string): Promise<FileAccessAnalysis> {
    console.log(`Analyzing file access patterns for ${sandboxId}...`);

    // Use strace to capture file access
    const { stdout } = await execAsync(
      `strace -e openat -f -p $(docker inspect -f '{{.State.Pid}}' ${sandboxId}) 2>&1 | head -100`
    );

    const files = new Set<string>();
    const lines = stdout.split('\n');

    for (const line of lines) {
      const match = line.match(/openat\(.*?"([^"]+)"/);
      if (match) {
        files.add(match[1]);
      }
    }

    return {
      sandboxId,
      totalFilesAccessed: files.size,
      frequentlyAccessedFiles: Array.from(files).slice(0, 20),
      timestamp: new Date()
    };
  }

  private async writeFile(path: string, content: string): Promise<void> {
    await execAsync(`cat > ${path} << 'EOF'\n${content}\nEOF`);
  }
}

interface FileAccessAnalysis {
  sandboxId: string;
  totalFilesAccessed: number;
  frequentlyAccessedFiles: string[];
  timestamp: Date;
}
```

## 4. Memory Optimization

### 4.1 Memory Deduplication

```typescript
/**
 * Reduce memory footprint with deduplication
 * 
 * Techniques:
 * - KSM (Kernel Samepage Merging)
 * - Transparent Huge Pages
 * - Memory compression
 */

class MemoryOptimizer {
  /**
   * Enable KSM for memory deduplication
   */
  async enableKSM(): Promise<void> {
    console.log('Enabling KSM (Kernel Samepage Merging)...');

    // Enable KSM
    await execAsync('echo 1 > /sys/kernel/mm/ksm/run');

    // Set scan interval
    await execAsync('echo 100 > /sys/kernel/mm/ksm/sleep_millisecs');

    // Set pages to scan
    await execAsync('echo 1000 > /sys/kernel/mm/ksm/pages_to_scan');

    console.log('✓ KSM enabled');
  }

  /**
   * Enable Transparent Huge Pages
   */
  async enableTransparentHugePages(): Promise<void> {
    console.log('Enabling Transparent Huge Pages...');

    await execAsync('echo madvise > /sys/kernel/mm/transparent_hugepage/enabled');
    await execAsync('echo defer+madvise > /sys/kernel/mm/transparent_hugepage/defrag');

    console.log('✓ Transparent Huge Pages enabled');
  }

  /**
   * Monitor memory deduplication savings
   */
  async monitorDeduplication(): Promise<DeduplicationStats> {
    const { stdout: ksmStats } = await execAsync('cat /sys/kernel/mm/ksm/stat');

    const lines = ksmStats.split('\n');
    const stats: DeduplicationStats = {
      timestamp: new Date(),
      pagesShared: 0,
      pagesSharingKB: 0,
      pagesUnshare: 0,
      pagesVolatile: 0,
      fullScans: 0,
      savingsKB: 0
    };

    for (const line of lines) {
      const [key, value] = line.split(/\s+/);
      if (key === 'pages_shared') stats.pagesShared = parseInt(value);
      if (key === 'pages_sharing') stats.pagesSharingKB = parseInt(value) * 4; // 4KB pages
      if (key === 'pages_unshare') stats.pagesUnshare = parseInt(value);
      if (key === 'pages_volatile') stats.pagesVolatile = parseInt(value);
      if (key === 'full_scans') stats.fullScans = parseInt(value);
    }

    // Calculate savings
    stats.savingsKB = stats.pagesShared * 4 * stats.pagesSharingKB;

    return stats;
  }
}

interface DeduplicationStats {
  timestamp: Date;
  pagesShared: number;
  pagesSharingKB: number;
  pagesUnshare: number;
  pagesVolatile: number;
  fullScans: number;
  savingsKB: number;
}
```

## 5. Network Optimization

### 5.1 Pre-warmed Network Connections

```typescript
/**
 * Optimize network startup
 * 
 * Strategies:
 * - Pre-warm DNS cache
 * - Pre-establish connections
 * - Connection pooling
 */

class NetworkOptimizer {
  /**
   * Pre-warm DNS cache
   */
  async prewarmDNSCache(domains: string[]): Promise<void> {
    console.log(`Pre-warming DNS cache for ${domains.length} domains...`);

    for (const domain of domains) {
      await execAsync(`nslookup ${domain} > /dev/null`);
    }

    console.log('✓ DNS cache pre-warmed');
  }

  /**
   * Pre-establish database connections
   */
  async preestablishDatabaseConnections(
    connectionString: string,
    poolSize: number = 5
  ): Promise<void> {
    console.log(`Pre-establishing ${poolSize} database connections...`);

    const connections = [];
    for (let i = 0; i < poolSize; i++) {
      try {
        const conn = await this.createDatabaseConnection(connectionString);
        connections.push(conn);
      } catch (error) {
        console.error(`Failed to create connection ${i + 1}: ${error}`);
      }
    }

    console.log(`✓ ${connections.length} connections established`);
  }

  /**
   * Setup connection pooling
   */
  async setupConnectionPooling(config: PoolConfig): Promise<void> {
    console.log('Setting up connection pooling...');

    const poolScript = `
const Pool = require('pg').Pool;

const pool = new Pool({
  connectionString: '${config.connectionString}',
  max: ${config.maxConnections},
  min: ${config.minConnections},
  idleTimeoutMillis: ${config.idleTimeout},
  connectionTimeoutMillis: ${config.connectionTimeout}
});

// Pre-warm pool
for (let i = 0; i < ${config.minConnections}; i++) {
  pool.connect((err, client, release) => {
    if (err) console.error('Pool error:', err);
    else release();
  });
}

module.exports = pool;
    `;

    await this.writeFile('/app/pool.js', poolScript);
    console.log('✓ Connection pooling configured');
  }

  private async createDatabaseConnection(connectionString: string): Promise<any> {
    // Implementation
    return {};
  }

  private async writeFile(path: string, content: string): Promise<void> {
    await execAsync(`cat > ${path} << 'EOF'\n${content}\nEOF`);
  }
}

interface PoolConfig {
  connectionString: string;
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}
```

## 6. Cold Start Metrics and Monitoring

### 6.1 Comprehensive Monitoring

```typescript
class ColdStartMonitoring {
  /**
   * Measure complete cold start time
   */
  async measureColdStart(sandboxId: string): Promise<ColdStartMetrics> {
    const metrics: ColdStartMetrics = {
      sandboxId,
      timestamp: new Date(),
      stages: {}
    };

    // Stage 1: Checkpoint restore
    const restoreStart = Date.now();
    await this.restoreCheckpoint(sandboxId);
    metrics.stages.checkpointRestore = Date.now() - restoreStart;

    // Stage 2: Container startup
    const containerStart = Date.now();
    await this.waitForContainer(sandboxId);
    metrics.stages.containerStartup = Date.now() - containerStart;

    // Stage 3: Application startup
    const appStart = Date.now();
    await this.waitForApplication(sandboxId);
    metrics.stages.applicationStartup = Date.now() - appStart;

    // Stage 4: Network ready
    const networkStart = Date.now();
    await this.waitForNetwork(sandboxId);
    metrics.stages.networkReady = Date.now() - networkStart;

    // Total time
    metrics.totalTime = Object.values(metrics.stages).reduce((a, b) => a + b, 0);

    // Calculate percentages
    metrics.percentages = {
      checkpointRestore: (metrics.stages.checkpointRestore / metrics.totalTime) * 100,
      containerStartup: (metrics.stages.containerStartup / metrics.totalTime) * 100,
      applicationStartup: (metrics.stages.applicationStartup / metrics.totalTime) * 100,
      networkReady: (metrics.stages.networkReady / metrics.totalTime) * 100
    };

    return metrics;
  }

  /**
   * Benchmark cold start across multiple sandboxes
   */
  async benchmarkColdStart(count: number = 10): Promise<ColdStartBenchmark> {
    console.log(`Benchmarking cold start with ${count} sandboxes...`);

    const results: ColdStartMetrics[] = [];

    for (let i = 0; i < count; i++) {
      const sandboxId = `benchmark-${i}`;
      const metrics = await this.measureColdStart(sandboxId);
      results.push(metrics);
    }

    const totalTimes = results.map(r => r.totalTime);
    const avgTime = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
    const minTime = Math.min(...totalTimes);
    const maxTime = Math.max(...totalTimes);
    const p95Time = this.calculatePercentile(totalTimes, 0.95);
    const p99Time = this.calculatePercentile(totalTimes, 0.99);

    return {
      sampleSize: count,
      avgTime,
      minTime,
      maxTime,
      p95Time,
      p99Time,
      results,
      timestamp: new Date()
    };
  }

  /**
   * Profile cold start bottlenecks
   */
  async profileColdStart(sandboxId: string): Promise<ColdStartProfile> {
    console.log(`Profiling cold start for ${sandboxId}...`);

    // Use perf to profile
    const { stdout: perfOutput } = await execAsync(
      `perf stat -e cycles,instructions,cache-references,cache-misses,page-faults \\
       docker run --rm ${sandboxId} /bin/true 2>&1`
    );

    const profile: ColdStartProfile = {
      sandboxId,
      timestamp: new Date(),
      metrics: this.parsePerf(perfOutput),
      recommendations: []
    };

    // Generate recommendations
    if (profile.metrics.cacheMissRate > 0.1) {
      profile.recommendations.push('High cache miss rate. Consider prefetching.');
    }

    if (profile.metrics.pageFaults > 10000) {
      profile.recommendations.push('High page faults. Consider memory optimization.');
    }

    return profile;
  }

  private async restoreCheckpoint(sandboxId: string): Promise<void> {
    // Implementation
  }

  private async waitForContainer(sandboxId: string): Promise<void> {
    // Implementation
  }

  private async waitForApplication(sandboxId: string): Promise<void> {
    // Implementation
  }

  private async waitForNetwork(sandboxId: string): Promise<void> {
    // Implementation
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index];
  }

  private parsePerf(output: string): PerfMetrics {
    // Parse perf output
    return {
      cycles: 0,
      instructions: 0,
      cacheReferences: 0,
      cacheMisses: 0,
      pageFaults: 0,
      cacheMissRate: 0,
      ipc: 0
    };
  }
}

interface ColdStartMetrics {
  sandboxId: string;
  timestamp: Date;
  stages: {
    checkpointRestore: number;
    containerStartup: number;
    applicationStartup: number;
    networkReady: number;
  };
  totalTime: number;
  percentages?: {
    checkpointRestore: number;
    containerStartup: number;
    applicationStartup: number;
    networkReady: number;
  };
}

interface ColdStartBenchmark {
  sampleSize: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  results: ColdStartMetrics[];
  timestamp: Date;
}

interface ColdStartProfile {
  sandboxId: string;
  timestamp: Date;
  metrics: PerfMetrics;
  recommendations: string[];
}

interface PerfMetrics {
  cycles: number;
  instructions: number;
  cacheReferences: number;
  cacheMisses: number;
  pageFaults: number;
  cacheMissRate: number;
  ipc: number;
}
```

## 7. Optimization Strategies Comparison

| Strategy | Time Saved | Complexity | Cost |
|----------|-----------|-----------|------|
| **Image Caching** | 30-40% | Low | Low |
| **CRIU Checkpointing** | 40-60% | Medium | Medium |
| **Lazy File Loading** | 20-30% | High | Medium |
| **Memory Deduplication** | 10-20% | Medium | Low |
| **Network Pre-warming** | 5-10% | Low | Low |
| **All Combined** | 70-85% | High | Medium |

## 8. Typical Cold Start Timeline (Optimized)

```
Total: ~2-3 seconds

Checkpoint Restore:    300ms (15%)
Container Startup:     500ms (25%)
Application Startup:   900ms (45%)
Network Ready:         300ms (15%)
```

## 9. Implementation Checklist

- [ ] Optimize Docker images
- [ ] Set up image caching
- [ ] Implement CRIU checkpointing
- [ ] Setup overlay filesystem
- [ ] Enable lazy file loading
- [ ] Configure KSM
- [ ] Pre-warm DNS cache
- [ ] Setup connection pooling
- [ ] Implement monitoring
- [ ] Benchmark and profile
- [ ] Optimize based on profiling

## 10. Recommendations for Manus-like Platform

**Primary Optimizations:**
1. **CRIU Checkpointing** - 40-60% time savings
2. **Image Caching** - 30-40% time savings
3. **Lazy File Loading** - 20-30% time savings

**Secondary Optimizations:**
1. Memory deduplication (KSM)
2. Network pre-warming
3. Connection pooling

**Target Metrics:**
- Average cold start: <2 seconds
- P95 cold start: <3 seconds
- P99 cold start: <4 seconds

This comprehensive approach enables sub-second cold starts for most sandboxes!
