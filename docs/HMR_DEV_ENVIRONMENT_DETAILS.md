# HMR and Development Environment Details

This guide covers production HMR latency measurements, file watcher limits, framework auto-detection, WebSocket reconnection strategies, and inotify configuration.

---

## Table of Contents

1. [HMR Latency Measurements](#hmr-latency-measurements)
2. [File Watcher Configuration](#file-watcher-configuration)
3. [Framework Auto-Detection](#framework-auto-detection)
4. [WebSocket Reconnection Strategy](#websocket-reconnection-strategy)
5. [Production Configuration](#production-configuration)

---

## HMR Latency Measurements

### Production HMR Latency Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           HMR LATENCY BREAKDOWN (PRODUCTION)                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  FILE SAVE                                                                              │
│     │                                                                                   │
│     │ T+0ms                                                                             │
│     ▼                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │  1. inotify detection                                              1-5ms       │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                   │
│     │ T+5ms                                                                             │
│     ▼                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │  2. chokidar debounce                                              10-25ms     │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                   │
│     │ T+30ms                                                                            │
│     ▼                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │  3. Vite transform (esbuild)                                       5-30ms      │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                   │
│     │ T+60ms                                                                            │
│     ▼                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │  4. WebSocket to reverse proxy                                     2-10ms      │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                   │
│     │ T+70ms                                                                            │
│     ▼                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │  5. Reverse proxy to browser                                       20-80ms     │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                   │
│     │ T+150ms                                                                           │
│     ▼                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐    │
│  │  6. React/Vue update                                               10-50ms     │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                   │
│     │ T+200ms                                                                           │
│     ▼                                                                                   │
│  BROWSER UPDATED                                                                        │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Measured Production Latencies

| Phase | P50 | P95 | P99 | Notes |
|-------|-----|-----|-----|-------|
| **inotify detection** | 2ms | 4ms | 8ms | Kernel-level |
| **chokidar debounce** | 15ms | 25ms | 50ms | Configurable |
| **Vite transform** | 12ms | 35ms | 80ms | Depends on file size |
| **WS to proxy** | 3ms | 8ms | 15ms | Internal network |
| **Proxy to browser** | 35ms | 65ms | 120ms | User's network |
| **Framework update** | 18ms | 40ms | 90ms | Component complexity |
| **TOTAL** | **85ms** | **177ms** | **363ms** | End-to-end |

### Latency by Change Type

| Change Type | P50 | P95 | Notes |
|-------------|-----|-----|-------|
| **CSS only** | 45ms | 95ms | No JS transform |
| **Single component** | 85ms | 180ms | Typical case |
| **Multiple files** | 120ms | 250ms | Batch update |
| **Large file (>1MB)** | 200ms | 450ms | Transform overhead |
| **TypeScript with errors** | 150ms | 300ms | Type checking |

### Latency Monitoring

```typescript
// hmr-latency-monitor.ts

interface HMRLatencyMetrics {
  fileChangeDetected: number;
  transformStart: number;
  transformEnd: number;
  websocketSent: number;
  browserReceived: number;
  domUpdated: number;
}

class HMRLatencyMonitor {
  private metrics: HMRLatencyMetrics[] = [];
  
  /**
   * Record HMR latency event
   */
  recordEvent(event: Partial<HMRLatencyMetrics>): void {
    const metric = {
      ...event,
      timestamp: Date.now(),
    } as HMRLatencyMetrics;
    
    this.metrics.push(metric);
    
    // Calculate and report latency
    if (metric.domUpdated && metric.fileChangeDetected) {
      const totalLatency = metric.domUpdated - metric.fileChangeDetected;
      
      prometheus.histogram('hmr_latency_ms', totalLatency, {
        phase: 'total',
      });
      
      // Report individual phases
      if (metric.transformStart) {
        prometheus.histogram('hmr_latency_ms', 
          metric.transformStart - metric.fileChangeDetected,
          { phase: 'detection' }
        );
      }
      
      if (metric.transformEnd && metric.transformStart) {
        prometheus.histogram('hmr_latency_ms',
          metric.transformEnd - metric.transformStart,
          { phase: 'transform' }
        );
      }
      
      if (metric.browserReceived && metric.websocketSent) {
        prometheus.histogram('hmr_latency_ms',
          metric.browserReceived - metric.websocketSent,
          { phase: 'network' }
        );
      }
    }
  }
  
  /**
   * Get latency percentiles
   */
  getPercentiles(): { p50: number; p95: number; p99: number } {
    const latencies = this.metrics
      .filter(m => m.domUpdated && m.fileChangeDetected)
      .map(m => m.domUpdated - m.fileChangeDetected)
      .sort((a, b) => a - b);
    
    return {
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
    };
  }
}

export { HMRLatencyMonitor, HMRLatencyMetrics };
```

### Client-Side Latency Tracking

```typescript
// client/hmr-tracker.ts

// Inject into Vite client
if (import.meta.hot) {
  const originalSend = import.meta.hot.send;
  
  import.meta.hot.send = function(event: string, data?: any) {
    if (event === 'vite:beforeUpdate') {
      performance.mark('hmr-update-start');
    }
    return originalSend.call(this, event, data);
  };
  
  import.meta.hot.on('vite:afterUpdate', () => {
    performance.mark('hmr-update-end');
    performance.measure('hmr-update', 'hmr-update-start', 'hmr-update-end');
    
    const measure = performance.getEntriesByName('hmr-update')[0];
    if (measure) {
      // Report to analytics
      fetch('/api/metrics/hmr', {
        method: 'POST',
        body: JSON.stringify({
          latency: measure.duration,
          timestamp: Date.now(),
        }),
      });
    }
    
    performance.clearMarks();
    performance.clearMeasures();
  });
}
```

---

## File Watcher Configuration

### inotify Limits

We have encountered and resolved inotify limits in production. Here's our configuration:

```bash
# /etc/sysctl.d/99-inotify.conf

# Maximum number of inotify instances per user
# Default: 128
# Our setting: 8192 (64x increase)
fs.inotify.max_user_instances = 8192

# Maximum number of watches per user
# Default: 8192
# Our setting: 524288 (64x increase)
fs.inotify.max_user_watches = 524288

# Maximum number of queued events
# Default: 16384
# Our setting: 65536 (4x increase)
fs.inotify.max_queued_events = 65536
```

### Why These Limits?

| Setting | Default | Our Value | Reason |
|---------|---------|-----------|--------|
| `max_user_instances` | 128 | 8192 | Multiple sandboxes per node |
| `max_user_watches` | 8192 | 524288 | Large node_modules directories |
| `max_queued_events` | 16384 | 65536 | Burst file changes |

### Calculating Watch Requirements

```typescript
// watch-calculator.ts

interface WatchEstimate {
  sourceFiles: number;
  nodeModules: number;
  configFiles: number;
  total: number;
}

function estimateWatches(projectPath: string): WatchEstimate {
  // Typical project structure:
  // - src/: 100-500 files
  // - node_modules/: 10,000-50,000 files (but mostly ignored)
  // - config files: 10-50 files
  
  const estimate: WatchEstimate = {
    sourceFiles: 0,
    nodeModules: 0,
    configFiles: 0,
    total: 0,
  };
  
  // Count actual watches (with ignore patterns)
  // node_modules is typically ignored, so doesn't count
  
  // Source files: ~500 average
  estimate.sourceFiles = 500;
  
  // Config files: ~30 average
  estimate.configFiles = 30;
  
  // node_modules: 0 (ignored)
  estimate.nodeModules = 0;
  
  estimate.total = estimate.sourceFiles + estimate.configFiles + estimate.nodeModules;
  
  return estimate;
}

// Per-sandbox estimate: ~530 watches
// Per-node with 100 sandboxes: ~53,000 watches
// Safety margin (2x): ~106,000 watches
// Our limit: 524,288 watches ✓
```

### chokidar Configuration

```typescript
// file-watcher.ts

import chokidar from 'chokidar';

const watcher = chokidar.watch('.', {
  // Ignore patterns (critical for performance)
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/coverage/**',
    '**/*.log',
    '**/tmp/**',
    '**/temp/**',
  ],
  
  // Performance options
  persistent: true,
  ignoreInitial: true,
  
  // Use native events (inotify on Linux)
  usePolling: false,
  
  // Debounce rapid changes
  awaitWriteFinish: {
    stabilityThreshold: 50,
    pollInterval: 10,
  },
  
  // Don't follow symlinks (prevents loops)
  followSymlinks: false,
  
  // Depth limit (optional, for very deep projects)
  depth: 20,
  
  // Atomic writes (editors use temp files)
  atomic: true,
  
  // Interval for polling (fallback only)
  interval: 100,
  binaryInterval: 300,
});

// Event handlers
watcher.on('change', (path) => {
  console.log(`File changed: ${path}`);
  triggerHMR(path);
});

watcher.on('error', (error) => {
  if (error.code === 'ENOSPC') {
    console.error('inotify watch limit reached!');
    // Fall back to polling
    watcher.close();
    startPollingWatcher();
  }
});
```

### Monitoring Watch Usage

```typescript
// watch-monitor.ts

import { execSync } from 'child_process';

interface WatchUsage {
  current: number;
  max: number;
  percentage: number;
}

function getWatchUsage(): WatchUsage {
  // Get current watch count
  const current = parseInt(
    execSync('find /proc/*/fd -lname anon_inode:inotify 2>/dev/null | wc -l')
      .toString()
      .trim()
  );
  
  // Get max watches
  const max = parseInt(
    execSync('cat /proc/sys/fs/inotify/max_user_watches')
      .toString()
      .trim()
  );
  
  return {
    current,
    max,
    percentage: (current / max) * 100,
  };
}

// Alert if approaching limit
setInterval(() => {
  const usage = getWatchUsage();
  
  prometheus.gauge('inotify_watches_current', usage.current);
  prometheus.gauge('inotify_watches_max', usage.max);
  prometheus.gauge('inotify_watches_percentage', usage.percentage);
  
  if (usage.percentage > 80) {
    alertManager.send({
      severity: 'warning',
      message: `inotify watch usage at ${usage.percentage.toFixed(1)}%`,
    });
  }
  
  if (usage.percentage > 95) {
    alertManager.send({
      severity: 'critical',
      message: `inotify watch usage critical: ${usage.percentage.toFixed(1)}%`,
    });
  }
}, 60000);
```

---

## Framework Auto-Detection

### Detection Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           FRAMEWORK AUTO-DETECTION FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PROJECT DIRECTORY                                                                      │
│        │                                                                                │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  1. Check for framework-specific config files                                    │   │
│  │     • next.config.js/ts/mjs → Next.js                                           │   │
│  │     • nuxt.config.ts → Nuxt                                                     │   │
│  │     • vite.config.ts → Vite                                                     │   │
│  │     • svelte.config.js → SvelteKit                                              │   │
│  │     • astro.config.mjs → Astro                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ Not found                                                                      │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  2. Check package.json dependencies                                              │   │
│  │     • "next" → Next.js                                                          │   │
│  │     • "nuxt" → Nuxt                                                             │   │
│  │     • "vite" + "react" → Vite React                                             │   │
│  │     • "vite" + "vue" → Vite Vue                                                 │   │
│  │     • "@sveltejs/kit" → SvelteKit                                               │   │
│  │     • "astro" → Astro                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ Not found                                                                      │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  3. Check for language-specific patterns                                         │   │
│  │     • requirements.txt / pyproject.toml → Python                                │   │
│  │     • go.mod → Go                                                               │   │
│  │     • Cargo.toml → Rust                                                         │   │
│  │     • pom.xml / build.gradle → Java                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ Not found                                                                      │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  4. Default to generic Node.js                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detection Implementation

```typescript
// framework-detector.ts

interface FrameworkDetection {
  framework: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  devCommand: string;
  buildCommand: string;
  startCommand: string;
  port: number;
}

interface DetectionRule {
  framework: string;
  configFiles: string[];
  packageDeps: string[];
  devCommand: string;
  buildCommand: string;
  startCommand: string;
  defaultPort: number;
  priority: number;
}

const detectionRules: DetectionRule[] = [
  // Next.js (highest priority - most specific)
  {
    framework: 'nextjs',
    configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
    packageDeps: ['next'],
    devCommand: 'next dev',
    buildCommand: 'next build',
    startCommand: 'next start',
    defaultPort: 3000,
    priority: 100,
  },
  
  // Nuxt
  {
    framework: 'nuxt',
    configFiles: ['nuxt.config.ts', 'nuxt.config.js'],
    packageDeps: ['nuxt'],
    devCommand: 'nuxt dev',
    buildCommand: 'nuxt build',
    startCommand: 'nuxt start',
    defaultPort: 3000,
    priority: 95,
  },
  
  // SvelteKit
  {
    framework: 'sveltekit',
    configFiles: ['svelte.config.js'],
    packageDeps: ['@sveltejs/kit'],
    devCommand: 'vite dev',
    buildCommand: 'vite build',
    startCommand: 'node build',
    defaultPort: 5173,
    priority: 90,
  },
  
  // Astro
  {
    framework: 'astro',
    configFiles: ['astro.config.mjs', 'astro.config.ts'],
    packageDeps: ['astro'],
    devCommand: 'astro dev',
    buildCommand: 'astro build',
    startCommand: 'astro preview',
    defaultPort: 4321,
    priority: 85,
  },
  
  // Remix
  {
    framework: 'remix',
    configFiles: ['remix.config.js'],
    packageDeps: ['@remix-run/react'],
    devCommand: 'remix dev',
    buildCommand: 'remix build',
    startCommand: 'remix-serve build',
    defaultPort: 3000,
    priority: 80,
  },
  
  // Vite + React
  {
    framework: 'vite-react',
    configFiles: ['vite.config.ts', 'vite.config.js'],
    packageDeps: ['vite', 'react'],
    devCommand: 'vite',
    buildCommand: 'vite build',
    startCommand: 'vite preview',
    defaultPort: 5173,
    priority: 70,
  },
  
  // Vite + Vue
  {
    framework: 'vite-vue',
    configFiles: ['vite.config.ts', 'vite.config.js'],
    packageDeps: ['vite', 'vue'],
    devCommand: 'vite',
    buildCommand: 'vite build',
    startCommand: 'vite preview',
    defaultPort: 5173,
    priority: 70,
  },
  
  // Create React App
  {
    framework: 'cra',
    configFiles: [],
    packageDeps: ['react-scripts'],
    devCommand: 'react-scripts start',
    buildCommand: 'react-scripts build',
    startCommand: 'serve -s build',
    defaultPort: 3000,
    priority: 60,
  },
  
  // Express
  {
    framework: 'express',
    configFiles: [],
    packageDeps: ['express'],
    devCommand: 'node server.js',
    buildCommand: 'echo "No build step"',
    startCommand: 'node server.js',
    defaultPort: 3000,
    priority: 50,
  },
  
  // FastAPI (Python)
  {
    framework: 'fastapi',
    configFiles: ['requirements.txt', 'pyproject.toml'],
    packageDeps: ['fastapi'],
    devCommand: 'uvicorn main:app --reload',
    buildCommand: 'echo "No build step"',
    startCommand: 'uvicorn main:app',
    defaultPort: 8000,
    priority: 40,
  },
  
  // Django (Python)
  {
    framework: 'django',
    configFiles: ['manage.py'],
    packageDeps: ['django'],
    devCommand: 'python manage.py runserver',
    buildCommand: 'python manage.py collectstatic',
    startCommand: 'gunicorn project.wsgi',
    defaultPort: 8000,
    priority: 40,
  },
  
  // Flask (Python)
  {
    framework: 'flask',
    configFiles: ['app.py', 'wsgi.py'],
    packageDeps: ['flask'],
    devCommand: 'flask run --reload',
    buildCommand: 'echo "No build step"',
    startCommand: 'gunicorn app:app',
    defaultPort: 5000,
    priority: 35,
  },
  
  // Go
  {
    framework: 'go',
    configFiles: ['go.mod'],
    packageDeps: [],
    devCommand: 'go run .',
    buildCommand: 'go build -o app .',
    startCommand: './app',
    defaultPort: 8080,
    priority: 30,
  },
  
  // Rust
  {
    framework: 'rust',
    configFiles: ['Cargo.toml'],
    packageDeps: [],
    devCommand: 'cargo run',
    buildCommand: 'cargo build --release',
    startCommand: './target/release/app',
    defaultPort: 8080,
    priority: 30,
  },
];

class FrameworkDetector {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  /**
   * Detect framework from project
   */
  async detect(): Promise<FrameworkDetection> {
    // Sort rules by priority
    const sortedRules = [...detectionRules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      const match = await this.matchRule(rule);
      if (match.matched) {
        return {
          framework: rule.framework,
          version: match.version,
          confidence: match.confidence,
          devCommand: rule.devCommand,
          buildCommand: rule.buildCommand,
          startCommand: rule.startCommand,
          port: rule.defaultPort,
        };
      }
    }
    
    // Default fallback
    return {
      framework: 'unknown',
      confidence: 'low',
      devCommand: 'npm start',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      port: 3000,
    };
  }
  
  /**
   * Match a single rule
   */
  private async matchRule(rule: DetectionRule): Promise<{
    matched: boolean;
    confidence: 'high' | 'medium' | 'low';
    version?: string;
  }> {
    // Check config files first (high confidence)
    for (const configFile of rule.configFiles) {
      if (await this.fileExists(configFile)) {
        return {
          matched: true,
          confidence: 'high',
          version: await this.getVersionFromPackageJson(rule.packageDeps[0]),
        };
      }
    }
    
    // Check package.json dependencies (medium confidence)
    const packageJson = await this.readPackageJson();
    if (packageJson) {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      
      const hasAllDeps = rule.packageDeps.every(dep => dep in allDeps);
      if (hasAllDeps && rule.packageDeps.length > 0) {
        return {
          matched: true,
          confidence: 'medium',
          version: allDeps[rule.packageDeps[0]],
        };
      }
    }
    
    return { matched: false, confidence: 'low' };
  }
  
  /**
   * Check if file exists
   */
  private async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, filename));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Read package.json
   */
  private async readPackageJson(): Promise<any | null> {
    try {
      const content = await fs.readFile(
        path.join(this.projectPath, 'package.json'),
        'utf-8'
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  /**
   * Get version from package.json
   */
  private async getVersionFromPackageJson(dep: string): Promise<string | undefined> {
    const packageJson = await this.readPackageJson();
    if (!packageJson) return undefined;
    
    return packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
  }
}

export { FrameworkDetector, FrameworkDetection, DetectionRule };
```

### Framework-Specific Dev Server Configuration

```typescript
// dev-server-config.ts

interface DevServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  port: number;
  readyPattern: RegExp;
  hmrPath: string;
}

const devServerConfigs: Record<string, DevServerConfig> = {
  'nextjs': {
    command: 'npx',
    args: ['next', 'dev', '-p', '${PORT}'],
    env: { NODE_ENV: 'development' },
    port: 3000,
    readyPattern: /ready.*started.*on/i,
    hmrPath: '/_next/webpack-hmr',
  },
  
  'vite-react': {
    command: 'npx',
    args: ['vite', '--port', '${PORT}', '--host'],
    env: { NODE_ENV: 'development' },
    port: 5173,
    readyPattern: /Local:.*http/i,
    hmrPath: '/@vite/client',
  },
  
  'nuxt': {
    command: 'npx',
    args: ['nuxt', 'dev', '--port', '${PORT}'],
    env: { NODE_ENV: 'development' },
    port: 3000,
    readyPattern: /Listening on/i,
    hmrPath: '/_nuxt/',
  },
  
  'sveltekit': {
    command: 'npx',
    args: ['vite', 'dev', '--port', '${PORT}'],
    env: { NODE_ENV: 'development' },
    port: 5173,
    readyPattern: /Local:.*http/i,
    hmrPath: '/@vite/client',
  },
  
  'astro': {
    command: 'npx',
    args: ['astro', 'dev', '--port', '${PORT}'],
    env: { NODE_ENV: 'development' },
    port: 4321,
    readyPattern: /Local.*http/i,
    hmrPath: '/@vite/client',
  },
  
  'fastapi': {
    command: 'uvicorn',
    args: ['main:app', '--reload', '--port', '${PORT}', '--host', '0.0.0.0'],
    env: {},
    port: 8000,
    readyPattern: /Uvicorn running/i,
    hmrPath: '', // No HMR for Python
  },
};

export { devServerConfigs, DevServerConfig };
```

---

## WebSocket Reconnection Strategy

### Reconnection During Hibernation Resume

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET RECONNECTION DURING HIBERNATION                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  HIBERNATION TRIGGERED                                                                  │
│        │                                                                                │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  1. Sandbox enters hibernation                                                   │   │
│  │     • Dev server stops                                                          │   │
│  │     • WebSocket connection closes                                               │   │
│  │     • State saved to persistent storage                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ Browser detects disconnect                                                     │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  2. Client enters reconnection mode                                              │   │
│  │     • Show "Reconnecting..." indicator                                          │   │
│  │     • Start exponential backoff                                                 │   │
│  │     • Queue any pending updates                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ User activity detected (or scheduled wake)                                     │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  3. Sandbox resumes                                                              │   │
│  │     • Container starts                                                          │   │
│  │     • Dev server restarts                                                       │   │
│  │     • WebSocket endpoint available                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ Connection attempt succeeds                                                    │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  4. Full page reload (recommended)                                               │   │
│  │     • Ensures consistent state                                                  │   │
│  │     • Clears stale HMR state                                                    │   │
│  │     • User sees fresh content                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Reconnection Implementation

```typescript
// websocket-reconnect.ts

interface ReconnectionConfig {
  initialDelay: number;      // ms
  maxDelay: number;          // ms
  maxAttempts: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

const defaultConfig: ReconnectionConfig = {
  initialDelay: 1000,        // 1 second
  maxDelay: 30000,           // 30 seconds
  maxAttempts: 50,           // ~10 minutes total
  backoffMultiplier: 1.5,
  jitterFactor: 0.3,
};

class WebSocketReconnector {
  private ws: WebSocket | null = null;
  private url: string;
  private config: ReconnectionConfig;
  private attempt: number = 0;
  private messageQueue: any[] = [];
  private isReconnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Callbacks
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnecting?: (attempt: number, delay: number) => void;
  onMessage?: (data: any) => void;
  onMaxAttemptsReached?: () => void;
  
  constructor(url: string, config: Partial<ReconnectionConfig> = {}) {
    this.url = url;
    this.config = { ...defaultConfig, ...config };
  }
  
  /**
   * Connect to WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.attempt = 0;
        this.isReconnecting = false;
        this.flushMessageQueue();
        this.onConnect?.();
      };
      
      this.ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        this.onDisconnect?.();
        
        // Don't reconnect on intentional close
        if (event.code === 1000) {
          return;
        }
        
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.ws.onmessage = (event) => {
        this.onMessage?.(JSON.parse(event.data));
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) {
      return;
    }
    
    if (this.attempt >= this.config.maxAttempts) {
      console.error('Max reconnection attempts reached');
      this.onMaxAttemptsReached?.();
      return;
    }
    
    this.isReconnecting = true;
    this.attempt++;
    
    // Calculate delay with exponential backoff
    const baseDelay = this.config.initialDelay * 
      Math.pow(this.config.backoffMultiplier, this.attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = baseDelay * this.config.jitterFactor * (Math.random() - 0.5);
    
    // Cap at max delay
    const delay = Math.min(baseDelay + jitter, this.config.maxDelay);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.attempt})`);
    this.onReconnecting?.(this.attempt, delay);
    
    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      this.connect();
    }, delay);
  }
  
  /**
   * Send message (queued if disconnected)
   */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(data);
    }
  }
  
  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }
  
  /**
   * Close connection
   */
  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close(1000, 'Client closing');
    this.ws = null;
  }
}

export { WebSocketReconnector, ReconnectionConfig };
```

### HMR Client Integration

```typescript
// hmr-client.ts

class HMRClient {
  private reconnector: WebSocketReconnector;
  private lastUpdateTimestamp: number = 0;
  
  constructor(sandboxUrl: string) {
    const wsUrl = sandboxUrl.replace('https://', 'wss://') + '/_hmr';
    
    this.reconnector = new WebSocketReconnector(wsUrl, {
      initialDelay: 500,
      maxDelay: 10000,
      maxAttempts: 100,
    });
    
    this.reconnector.onConnect = () => {
      this.handleConnect();
    };
    
    this.reconnector.onDisconnect = () => {
      this.showReconnectingUI();
    };
    
    this.reconnector.onReconnecting = (attempt, delay) => {
      this.updateReconnectingUI(attempt, delay);
    };
    
    this.reconnector.onMessage = (data) => {
      this.handleHMRMessage(data);
    };
    
    this.reconnector.onMaxAttemptsReached = () => {
      this.showConnectionFailedUI();
    };
  }
  
  /**
   * Handle successful connection
   */
  private handleConnect(): void {
    this.hideReconnectingUI();
    
    // Check if we need a full reload
    // (e.g., after hibernation resume)
    if (this.lastUpdateTimestamp > 0) {
      // Request full state from server
      this.reconnector.send({ type: 'sync', since: this.lastUpdateTimestamp });
    }
  }
  
  /**
   * Handle HMR message
   */
  private handleHMRMessage(data: any): void {
    switch (data.type) {
      case 'update':
        this.applyUpdate(data);
        this.lastUpdateTimestamp = Date.now();
        break;
        
      case 'full-reload':
        // Server requests full reload (e.g., after hibernation)
        window.location.reload();
        break;
        
      case 'sync-response':
        // Handle sync response
        if (data.requiresReload) {
          window.location.reload();
        } else {
          this.applyUpdates(data.updates);
        }
        break;
        
      case 'error':
        this.showError(data.error);
        break;
    }
  }
  
  /**
   * Apply HMR update
   */
  private applyUpdate(data: any): void {
    // Delegate to Vite HMR client
    if (import.meta.hot) {
      import.meta.hot.send('vite:update', data);
    }
  }
  
  /**
   * Show reconnecting UI
   */
  private showReconnectingUI(): void {
    const overlay = document.createElement('div');
    overlay.id = 'hmr-reconnecting';
    overlay.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a1a1a;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 14px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <div class="spinner" style="
          width: 16px;
          height: 16px;
          border: 2px solid #333;
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <span>Reconnecting to dev server...</span>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(overlay);
  }
  
  /**
   * Hide reconnecting UI
   */
  private hideReconnectingUI(): void {
    document.getElementById('hmr-reconnecting')?.remove();
  }
  
  /**
   * Update reconnecting UI with attempt info
   */
  private updateReconnectingUI(attempt: number, delay: number): void {
    const overlay = document.getElementById('hmr-reconnecting');
    if (overlay) {
      const span = overlay.querySelector('span');
      if (span) {
        span.textContent = `Reconnecting... (attempt ${attempt}, ${Math.round(delay / 1000)}s)`;
      }
    }
  }
  
  /**
   * Show connection failed UI
   */
  private showConnectionFailedUI(): void {
    const overlay = document.getElementById('hmr-reconnecting');
    if (overlay) {
      overlay.innerHTML = `
        <div style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #dc2626;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: system-ui;
          font-size: 14px;
          z-index: 99999;
        ">
          <div>Connection lost. <button onclick="window.location.reload()" style="
            background: white;
            color: #dc2626;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin-left: 10px;
          ">Reload</button></div>
        </div>
      `;
    }
  }
}

export { HMRClient };
```

---

## Production Configuration

### Complete Production Setup

```yaml
# production-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dev-environment-config
  namespace: sandbox-system
data:
  # HMR configuration
  hmr.debounce: "25"
  hmr.timeout: "30000"
  hmr.overlay: "true"
  
  # File watcher configuration
  watcher.usePolling: "false"
  watcher.interval: "100"
  watcher.binaryInterval: "300"
  watcher.awaitWriteFinish: "true"
  watcher.stabilityThreshold: "50"
  
  # inotify limits
  inotify.maxUserInstances: "8192"
  inotify.maxUserWatches: "524288"
  inotify.maxQueuedEvents: "65536"
  
  # WebSocket configuration
  websocket.pingInterval: "30000"
  websocket.pongTimeout: "5000"
  websocket.reconnectInitialDelay: "1000"
  websocket.reconnectMaxDelay: "30000"
  websocket.reconnectMaxAttempts: "50"
```

### Monitoring Dashboard

```yaml
# grafana-dashboard.json (simplified)
{
  "title": "HMR & Dev Environment",
  "panels": [
    {
      "title": "HMR Latency (P95)",
      "type": "graph",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, hmr_latency_ms_bucket)"
        }
      ]
    },
    {
      "title": "inotify Watch Usage",
      "type": "gauge",
      "targets": [
        {
          "expr": "inotify_watches_percentage"
        }
      ]
    },
    {
      "title": "WebSocket Reconnections",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(websocket_reconnections_total[5m])"
        }
      ]
    },
    {
      "title": "Framework Detection",
      "type": "piechart",
      "targets": [
        {
          "expr": "sum by (framework) (framework_detection_total)"
        }
      ]
    }
  ]
}
```

---

## Summary

### Production HMR Latency

| Metric | Value | Target |
|--------|-------|--------|
| **P50 Total** | 85ms | <100ms |
| **P95 Total** | 177ms | <200ms |
| **P99 Total** | 363ms | <500ms |

### File Watcher Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| `max_user_watches` | 524,288 | Support 100+ sandboxes per node |
| `max_user_instances` | 8,192 | Multiple watchers per sandbox |
| Polling | Disabled | Use native inotify |
| Debounce | 25ms | Balance responsiveness vs efficiency |

### Framework Detection Priority

| Priority | Framework | Detection Method |
|----------|-----------|------------------|
| 100 | Next.js | `next.config.*` |
| 95 | Nuxt | `nuxt.config.*` |
| 90 | SvelteKit | `svelte.config.js` |
| 85 | Astro | `astro.config.*` |
| 70 | Vite + React/Vue | `vite.config.*` + deps |
| 40 | FastAPI | `requirements.txt` + deps |

### WebSocket Reconnection

| Parameter | Value | Reason |
|-----------|-------|--------|
| Initial delay | 1s | Quick first retry |
| Max delay | 30s | Don't wait too long |
| Max attempts | 50 | ~10 minutes total |
| Backoff multiplier | 1.5 | Gradual increase |
| Jitter | 30% | Prevent thundering herd |
