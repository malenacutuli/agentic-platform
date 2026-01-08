# HMR Latency Optimization

This guide provides a comprehensive analysis of Hot Module Replacement (HMR) latency, covering the complete data flow from file save to browser update, optimization strategies, and performance benchmarking.

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Latency Timeline](#complete-latency-timeline)
3. [Component-by-Component Analysis](#component-by-component-analysis)
4. [Container Filesystem Latency](#container-filesystem-latency)
5. [S3 Sync Latency](#s3-sync-latency)
6. [Browser HMR Update Latency](#browser-hmr-update-latency)
7. [Optimization Strategies](#optimization-strategies)
8. [Benchmarking Tools](#benchmarking-tools)
9. [Performance Targets](#performance-targets)

---

## Overview

HMR latency is the time from when a developer saves a file to when they see the change reflected in their browser. This latency directly impacts developer productivity and experience.

### Latency Budget

| Phase | Target | Acceptable | Poor |
|-------|--------|------------|------|
| File detection | <5ms | <20ms | >50ms |
| Transform/compile | <30ms | <100ms | >200ms |
| WebSocket delivery | <20ms | <50ms | >100ms |
| Browser update | <30ms | <100ms | >200ms |
| **Total** | **<100ms** | **<300ms** | **>500ms** |

---

## Complete Latency Timeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        FILE SAVE TO BROWSER UPDATE TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  T+0ms      T+5ms     T+25ms    T+50ms    T+75ms    T+100ms   T+125ms   T+150ms        │
│    │          │         │         │         │          │         │         │           │
│    ▼          ▼         ▼         ▼         ▼          ▼         ▼         ▼           │
│  ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐        │
│  │Save│    │Detc│    │Tran│    │Bund│    │WS  │    │Prxy│    │WS  │    │Updt│        │
│  │File│───►│ect │───►│form│───►│le  │───►│Send│───►│Fwd │───►│Recv│───►│DOM │        │
│  └────┘    └────┘    └────┘    └────┘    └────┘    └────┘    └────┘    └────┘        │
│                                                                                         │
│  Phases:                                                                                │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│  │ Filesystem │  Transform  │  Network  │  Browser  │                                  │
│  │   ~5ms     │   ~45ms     │   ~50ms   │   ~50ms   │                                  │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Timeline Breakdown

| Time | Event | Component | Notes |
|------|-------|-----------|-------|
| T+0ms | File saved | Editor | User action |
| T+1-2ms | Kernel notified | OS | inotify/FSEvents |
| T+2-5ms | Event received | chokidar | File watcher |
| T+5-10ms | Debounce complete | Vite | Wait for stability |
| T+10-30ms | Transform | esbuild/SWC | Compile TypeScript/JSX |
| T+30-50ms | Bundle update | Vite | Incremental bundling |
| T+50-60ms | WS message sent | Dev server | To reverse proxy |
| T+60-80ms | Proxy forward | Envoy | To browser |
| T+80-100ms | WS received | Browser | HMR client |
| T+100-150ms | DOM update | React | Virtual DOM diff + patch |

---

## Component-by-Component Analysis

### 1. File System Detection (1-10ms)

```typescript
// Measuring file detection latency
const measureDetectionLatency = () => {
  const watcher = chokidar.watch('src/**/*.ts');
  
  watcher.on('change', (path) => {
    const detectionTime = Date.now();
    console.log(`Detection latency: ${detectionTime - fileModTime}ms`);
  });
};

// Factors affecting detection latency:
const detectionFactors = {
  inotify: '1-2ms',      // Native Linux
  fsevents: '1-5ms',     // Native macOS
  polling: '100-1000ms', // Fallback
  debounce: '0-50ms',    // Configurable
};
```

### 2. Transform/Compile (10-100ms)

```typescript
// esbuild is extremely fast
const esbuildLatency = {
  typescript: '5-20ms',
  jsx: '5-15ms',
  css: '1-5ms',
  withSourceMaps: '+5-10ms',
};

// SWC is also very fast
const swcLatency = {
  typescript: '10-30ms',
  jsx: '10-25ms',
};

// Babel is slower
const babelLatency = {
  typescript: '50-200ms',
  jsx: '30-100ms',
};
```

### 3. Bundle Update (10-50ms)

```typescript
// Vite's incremental bundling
const bundleLatency = {
  singleModule: '10-20ms',
  withDependencies: '20-50ms',
  fullRebuild: '500-2000ms', // Avoided by HMR
};
```

### 4. Network Transport (20-100ms)

```typescript
// WebSocket latency components
const networkLatency = {
  localWebSocket: '1-5ms',
  toReverseProxy: '5-20ms',
  proxyProcessing: '2-10ms',
  toClient: '20-100ms', // Depends on user's network
};
```

### 5. Browser Update (20-100ms)

```typescript
// React Fast Refresh latency
const browserLatency = {
  receiveMessage: '1-5ms',
  parseUpdate: '5-10ms',
  virtualDomDiff: '10-30ms',
  domPatch: '10-50ms',
  cssUpdate: '1-5ms', // CSS is faster
};
```

---

## Container Filesystem Latency

### Local SSD Performance

```typescript
const localSsdLatency = {
  write: '0.5-2ms',
  fsync: '1-5ms',
  inotifyEvent: '1-2ms',
  total: '2-6ms',
};
```

### Network Filesystem Performance

```typescript
const networkFsLatency = {
  nfs: {
    write: '10-50ms',
    sync: '20-100ms',
    event: '50-200ms', // Polling required
    total: '80-350ms',
  },
  efs: {
    write: '5-20ms',
    sync: '10-50ms',
    event: '20-100ms',
    total: '35-170ms',
  },
};
```

### Optimization: Use Local Storage

```typescript
// Mount strategy for performance
const mountStrategy = {
  // Fast: Local SSD for source code
  sourceCode: {
    type: 'emptyDir',
    medium: 'default', // SSD
  },
  
  // Sync to persistent storage async
  persistentStorage: {
    type: 's3',
    syncInterval: '5s',
    syncOnSave: false, // Don't block HMR
  },
};
```

---

## S3 Sync Latency

### S3 is Decoupled from HMR

The key insight is that **S3 sync should not be in the HMR critical path**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    S3 SYNC IS ASYNC, NOT IN HMR PATH                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  File Save ──► inotify ──► Vite ──► WebSocket ──► Browser                  │
│      │                                                                      │
│      │ (async, non-blocking)                                               │
│      ▼                                                                      │
│  S3 Sync Queue ──► Batch ──► Upload ──► Confirm                            │
│                                                                             │
│  HMR Path: ~100ms (critical)                                               │
│  S3 Path: ~2-5s (background)                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### S3 Sync Latency Breakdown

| Operation | Latency | Notes |
|-----------|---------|-------|
| Single file upload | 100-300ms | Small files |
| Batch upload (10 files) | 200-500ms | Parallel |
| Large file (>1MB) | 500ms-2s | Multipart |
| Sync delay (batching) | 2-5s | Intentional |

### S3 Sync Implementation

```typescript
class S3SyncManager {
  private pendingFiles: Map<string, Buffer> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 2000; // 2 seconds
  
  queueSync(path: string, content: Buffer): void {
    this.pendingFiles.set(path, content);
    
    // Reset batch timer
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    
    this.syncTimer = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY);
  }
  
  private async flushBatch(): Promise<void> {
    const files = new Map(this.pendingFiles);
    this.pendingFiles.clear();
    
    // Upload in parallel
    const uploads = Array.from(files.entries()).map(([path, content]) =>
      this.uploadToS3(path, content)
    );
    
    await Promise.all(uploads);
    console.log(`Synced ${files.size} files to S3`);
  }
  
  private async uploadToS3(path: string, content: Buffer): Promise<void> {
    const start = Date.now();
    
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: path,
      Body: content,
    }));
    
    console.log(`S3 upload ${path}: ${Date.now() - start}ms`);
  }
}
```

---

## Browser HMR Update Latency

### CSS Updates (Fastest)

```typescript
// CSS updates are instant - no JavaScript execution
const cssUpdateLatency = {
  parseUpdate: '1-2ms',
  applyStyles: '1-5ms',
  repaint: '5-15ms',
  total: '7-22ms',
};
```

### React Component Updates

```typescript
// React Fast Refresh process
const reactUpdateLatency = {
  receiveUpdate: '1-5ms',
  findAffectedModules: '5-10ms',
  executeNewCode: '10-30ms',
  reconciliation: '10-50ms',
  commitPhase: '5-20ms',
  total: '31-115ms',
};
```

### Full Page Reload (Slowest)

```typescript
// When HMR fails, full reload is needed
const fullReloadLatency = {
  navigationStart: '0ms',
  fetchHtml: '50-200ms',
  parseHtml: '10-50ms',
  fetchAssets: '100-500ms',
  executeJs: '100-500ms',
  render: '50-200ms',
  total: '310-1450ms',
};
```

---

## Optimization Strategies

### 1. Use esbuild/SWC Instead of Babel

```typescript
// vite.config.ts
export default defineConfig({
  esbuild: {
    // esbuild is 10-100x faster than Babel
    target: 'esnext',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
});
```

**Impact**: -50-150ms per update

### 2. Reduce Debounce Time

```typescript
// For fast typists, reduce debounce
const watcher = chokidar.watch('src/**/*.ts', {
  awaitWriteFinish: {
    stabilityThreshold: 25, // Down from 50ms
    pollInterval: 10,
  },
});
```

**Impact**: -25ms per update

### 3. Pre-bundle Dependencies

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      // Add all heavy dependencies
    ],
  },
});
```

**Impact**: -50-100ms on first load, faster subsequent updates

### 4. Disable TypeScript Checking in HMR

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react({
      // Skip type checking during HMR
      // Run tsc separately
      babel: false,
    }),
  ],
});
```

**Impact**: -20-50ms per update

### 5. Colocate Proxy with Sandbox

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Before: Proxy in different region                                          │
│  Sandbox (us-east-1) ──► Proxy (us-west-2) ──► Browser                     │
│  Latency: +30-50ms                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  After: Proxy colocated                                                     │
│  Sandbox (us-east-1) ──► Proxy (us-east-1) ──► Browser                     │
│  Latency: +5-10ms                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Impact**: -10-30ms network latency

### 6. Use Native File Watching

```typescript
// Avoid polling when possible
const watcher = chokidar.watch('src', {
  usePolling: false, // Use inotify/FSEvents
});
```

**Impact**: -100-900ms (vs polling)

### 7. Optimize React Components

```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  // Only re-renders when data changes
  return <div>{/* ... */}</div>;
});

// Use useMemo for expensive calculations
const processedData = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);
```

**Impact**: -10-100ms browser update time

---

## Benchmarking Tools

### HMR Latency Measurement

```typescript
// Client-side HMR latency tracking
if (import.meta.hot) {
  let updateStart: number;
  
  import.meta.hot.on('vite:beforeUpdate', () => {
    updateStart = performance.now();
  });
  
  import.meta.hot.on('vite:afterUpdate', () => {
    const latency = performance.now() - updateStart;
    console.log(`HMR update: ${latency.toFixed(2)}ms`);
    
    // Send to analytics
    sendMetric('hmr_latency', latency);
  });
}
```

### Server-Side Measurement

```typescript
// Vite plugin for measuring transform time
function measureTransformPlugin(): Plugin {
  return {
    name: 'measure-transform',
    transform(code, id) {
      const start = performance.now();
      
      // Let other plugins transform
      return null;
    },
    transformPost(code, id) {
      const duration = performance.now() - transformStart.get(id);
      console.log(`Transform ${id}: ${duration.toFixed(2)}ms`);
    },
  };
}
```

### End-to-End Measurement

```typescript
// Measure complete round-trip
async function measureE2ELatency(): Promise<number> {
  const marker = `__HMR_TEST_${Date.now()}__`;
  const start = performance.now();
  
  // Write marker to file
  await fs.writeFile('src/test.ts', `export const marker = "${marker}";`);
  
  // Wait for marker to appear in browser
  await page.waitForFunction(
    (m) => window.__HMR_MARKER__ === m,
    marker,
    { timeout: 5000 }
  );
  
  return performance.now() - start;
}
```

---

## Performance Targets

### By Project Size

| Project Size | Files | Target Latency | Acceptable |
|--------------|-------|----------------|------------|
| Small | <100 | <75ms | <150ms |
| Medium | 100-1000 | <100ms | <200ms |
| Large | 1000-10000 | <150ms | <300ms |
| Monorepo | 10000+ | <200ms | <500ms |

### By Change Type

| Change Type | Target | Acceptable |
|-------------|--------|------------|
| CSS only | <50ms | <100ms |
| Single component | <100ms | <200ms |
| Multiple components | <150ms | <300ms |
| Shared module | <200ms | <400ms |
| Config file | <500ms | <1000ms |

### Monitoring Dashboard Metrics

```typescript
const hmrMetrics = {
  // Latency percentiles
  p50_latency: 'Target: <100ms',
  p95_latency: 'Target: <200ms',
  p99_latency: 'Target: <500ms',
  
  // Success rate
  hmr_success_rate: 'Target: >99%',
  full_reload_rate: 'Target: <1%',
  
  // Component metrics
  file_detection_p50: 'Target: <5ms',
  transform_p50: 'Target: <30ms',
  network_p50: 'Target: <50ms',
  browser_update_p50: 'Target: <50ms',
};
```

---

## Summary

### Latency Breakdown (Typical)

| Component | Time | Cumulative |
|-----------|------|------------|
| File detection (inotify) | 2ms | 2ms |
| Debounce | 25ms | 27ms |
| Transform (esbuild) | 20ms | 47ms |
| Bundle update | 15ms | 62ms |
| WS to proxy | 10ms | 72ms |
| Proxy forward | 5ms | 77ms |
| WS to browser | 30ms | 107ms |
| React update | 25ms | 132ms |
| **Total** | | **~132ms** |

### Key Optimization Levers

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Use esbuild/SWC | -50-150ms | Low |
| Native file watching | -100-900ms | Low |
| Reduce debounce | -25ms | Low |
| Pre-bundle deps | -50-100ms | Low |
| Colocate proxy | -10-30ms | Medium |
| Optimize React | -10-100ms | Medium |
| Local SSD storage | -50-300ms | High |

The goal is to keep total HMR latency under 150ms for the best developer experience, with 300ms as the acceptable upper bound.
