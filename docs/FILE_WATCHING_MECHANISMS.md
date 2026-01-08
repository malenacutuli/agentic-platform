# File Watching Mechanisms

This guide provides a comprehensive overview of file watching mechanisms used in development environments, covering inotify, chokidar, performance optimization at scale, and debouncing strategies.

---

## Table of Contents

1. [Overview](#overview)
2. [File Watching Stack](#file-watching-stack)
3. [Native File System APIs](#native-file-system-apis)
4. [chokidar Deep Dive](#chokidar-deep-dive)
5. [Performance at Scale](#performance-at-scale)
6. [Debouncing Strategies](#debouncing-strategies)
7. [Platform-Specific Configurations](#platform-specific-configurations)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Overview

File watching is the foundation of hot module replacement (HMR) and live reload functionality. The platform uses **chokidar** as the primary abstraction layer, which wraps native file system APIs for cross-platform compatibility.

### File Watching Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FILE WATCHING STACK                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Application Layer                                 │   │
│  │                  (Vite, tsx, nodemon, webpack)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        chokidar                                      │   │
│  │              (cross-platform abstraction)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│          ┌───────────────────────┼───────────────────────┐                 │
│          ▼                       ▼                       ▼                 │
│  ┌───────────────┐      ┌───────────────┐      ┌───────────────┐          │
│  │    Linux      │      │    macOS      │      │   Windows     │          │
│  │   inotify     │      │   FSEvents    │      │ ReadDirectory │          │
│  │               │      │               │      │  ChangesW     │          │
│  └───────────────┘      └───────────────┘      └───────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Watching Stack

### Why chokidar Over Raw fs.watch?

| Issue with fs.watch | chokidar Solution |
|---------------------|-------------------|
| Doesn't report filenames on macOS | Normalizes events across platforms |
| Emits duplicate events | Deduplicates and debounces |
| No recursive watching on Linux | Implements recursive watching |
| Inconsistent event types | Consistent add/change/unlink events |
| No glob pattern support | Built-in glob matching |
| Memory leaks on some platforms | Proper cleanup and resource management |

### Event Flow

```
File Save → OS Kernel → Native API → chokidar → Application
              │
              ├── Linux: inotify_add_watch() → IN_MODIFY event
              ├── macOS: FSEventStreamCreate() → kFSEventStreamEventFlagItemModified
              └── Windows: ReadDirectoryChangesW() → FILE_NOTIFY_CHANGE_LAST_WRITE
```

---

## Native File System APIs

### Linux: inotify

inotify is the Linux kernel subsystem for file system event monitoring.

```typescript
// How inotify works (conceptually)
// 1. Create inotify instance
const fd = inotify_init();

// 2. Add watch for directory
const wd = inotify_add_watch(fd, "/path/to/dir", IN_MODIFY | IN_CREATE | IN_DELETE);

// 3. Read events (blocking)
const events = read(fd, buffer, bufferSize);

// 4. Process events
for (const event of events) {
  if (event.mask & IN_MODIFY) {
    console.log(`File modified: ${event.name}`);
  }
}
```

#### inotify Limits

```bash
# View current limits
cat /proc/sys/fs/inotify/max_user_watches    # Default: 8192
cat /proc/sys/fs/inotify/max_user_instances  # Default: 128
cat /proc/sys/fs/inotify/max_queued_events   # Default: 16384

# Increase limits for large projects
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
echo "fs.inotify.max_user_instances=1024" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### inotify Event Types

| Event | Description |
|-------|-------------|
| IN_ACCESS | File was accessed |
| IN_MODIFY | File was modified |
| IN_ATTRIB | Metadata changed |
| IN_CLOSE_WRITE | File opened for writing was closed |
| IN_CLOSE_NOWRITE | File not opened for writing was closed |
| IN_OPEN | File was opened |
| IN_MOVED_FROM | File moved out of watched directory |
| IN_MOVED_TO | File moved into watched directory |
| IN_CREATE | File/directory created |
| IN_DELETE | File/directory deleted |
| IN_DELETE_SELF | Watched file/directory deleted |
| IN_MOVE_SELF | Watched file/directory moved |

### macOS: FSEvents

FSEvents is macOS's file system event notification system.

```typescript
// FSEvents characteristics
const fsEventsConfig = {
  // Coalesces events automatically
  latency: 0.5, // seconds
  
  // Recursive by default
  recursive: true,
  
  // Event flags
  flags: {
    kFSEventStreamEventFlagItemCreated: 0x00000100,
    kFSEventStreamEventFlagItemRemoved: 0x00000200,
    kFSEventStreamEventFlagItemModified: 0x00001000,
    kFSEventStreamEventFlagItemRenamed: 0x00000800,
  }
};
```

### Windows: ReadDirectoryChangesW

```typescript
// Windows file watching
const windowsConfig = {
  // Supports recursive watching
  recursive: true,
  
  // Filter flags
  filters: {
    FILE_NOTIFY_CHANGE_FILE_NAME: 0x00000001,
    FILE_NOTIFY_CHANGE_DIR_NAME: 0x00000002,
    FILE_NOTIFY_CHANGE_LAST_WRITE: 0x00000010,
    FILE_NOTIFY_CHANGE_CREATION: 0x00000040,
  }
};
```

---

## chokidar Deep Dive

### Basic Usage

```typescript
import chokidar from 'chokidar';

// Initialize watcher
const watcher = chokidar.watch('src/**/*.ts', {
  ignored: /(^|[\/\\])\../, // Ignore dotfiles
  persistent: true,
  ignoreInitial: true,
});

// Add event listeners
watcher
  .on('add', (path) => console.log(`File ${path} has been added`))
  .on('change', (path) => console.log(`File ${path} has been changed`))
  .on('unlink', (path) => console.log(`File ${path} has been removed`))
  .on('addDir', (path) => console.log(`Directory ${path} has been added`))
  .on('unlinkDir', (path) => console.log(`Directory ${path} has been removed`))
  .on('error', (error) => console.error(`Watcher error: ${error}`))
  .on('ready', () => console.log('Initial scan complete. Ready for changes'));

// Close watcher when done
await watcher.close();
```

### Advanced Configuration

```typescript
const watcher = chokidar.watch('.', {
  // Ignore patterns
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.log',
    /\.swp$/,
  ],
  
  // Performance options
  persistent: true,
  ignoreInitial: true,
  followSymlinks: false,
  
  // Polling options (for network fs, Docker)
  usePolling: false,
  interval: 100,
  binaryInterval: 300,
  
  // Stability options
  awaitWriteFinish: {
    stabilityThreshold: 50,
    pollInterval: 10,
  },
  
  // Atomic write detection
  atomic: true,
  
  // Depth limit
  depth: 99,
  
  // Always emit stats
  alwaysStat: false,
});
```

### chokidar Internals

```typescript
// Simplified chokidar architecture
class ChokidarWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private watched: Set<string> = new Set();
  
  watch(paths: string[], options: WatchOptions): void {
    for (const path of paths) {
      if (this.shouldUsePolling(options)) {
        this.setupPollingWatch(path, options);
      } else {
        this.setupNativeWatch(path, options);
      }
    }
  }
  
  private shouldUsePolling(options: WatchOptions): boolean {
    // Force polling in certain environments
    if (options.usePolling) return true;
    if (process.env.CHOKIDAR_USEPOLLING === 'true') return true;
    
    // Detect Docker/WSL
    if (this.isDockerEnvironment()) return true;
    if (this.isNetworkFileSystem()) return true;
    
    return false;
  }
  
  private setupNativeWatch(path: string, options: WatchOptions): void {
    const watcher = fs.watch(path, { recursive: true }, (eventType, filename) => {
      this.handleEvent(eventType, path, filename);
    });
    
    this.watchers.set(path, watcher);
  }
  
  private setupPollingWatch(path: string, options: WatchOptions): void {
    // Stat-based polling for environments without native support
    setInterval(() => {
      this.pollDirectory(path, options);
    }, options.interval || 100);
  }
}
```

---

## Performance at Scale

### Handling 10,000+ Files

#### Strategy 1: Increase inotify Limits

```bash
# For large projects, increase system limits
sudo sysctl -w fs.inotify.max_user_watches=524288
sudo sysctl -w fs.inotify.max_user_instances=1024
```

#### Strategy 2: Aggressive Ignoring

```typescript
const largeProjectConfig = {
  ignored: [
    '**/node_modules/**',      // ~80% of files
    '**/.git/**',              // Git internals
    '**/dist/**',              // Build output
    '**/build/**',             // Build output
    '**/.cache/**',            // Cache directories
    '**/coverage/**',          // Test coverage
    '**/*.log',                // Log files
    '**/*.map',                // Source maps
    '**/vendor/**',            // Vendor dependencies
    '**/__pycache__/**',       // Python cache
    '**/.pytest_cache/**',     // Pytest cache
    '**/target/**',            // Rust/Java build
  ],
};
```

#### Strategy 3: Watch Only Source Directories

```typescript
// Instead of watching everything
// chokidar.watch('.')

// Watch only what matters
chokidar.watch([
  'src/**/*.{ts,tsx,js,jsx}',
  'server/**/*.ts',
  'shared/**/*.ts',
  'public/**/*',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
]);
```

#### Strategy 4: Lazy Directory Watching

```typescript
class LazyWatcher {
  private watchedDirs: Set<string> = new Set();
  private watcher: chokidar.FSWatcher;
  
  constructor() {
    this.watcher = chokidar.watch([], {
      ignoreInitial: true,
      persistent: true,
    });
  }
  
  // Only watch directories that are actually accessed
  watchDirectory(dir: string): void {
    if (!this.watchedDirs.has(dir)) {
      this.watcher.add(dir);
      this.watchedDirs.add(dir);
    }
  }
  
  // Unwatch directories that haven't been accessed recently
  pruneUnusedWatches(accessLog: Map<string, Date>): void {
    const threshold = Date.now() - 5 * 60 * 1000; // 5 minutes
    
    for (const dir of this.watchedDirs) {
      const lastAccess = accessLog.get(dir);
      if (!lastAccess || lastAccess.getTime() < threshold) {
        this.watcher.unwatch(dir);
        this.watchedDirs.delete(dir);
      }
    }
  }
}
```

### Memory Usage Optimization

```typescript
// Memory-efficient file watching
const memoryEfficientConfig = {
  // Don't store file stats
  alwaysStat: false,
  
  // Limit depth
  depth: 10,
  
  // Don't follow symlinks
  followSymlinks: false,
  
  // Use native events when possible
  usePolling: false,
};

// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Watcher memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 30000);
```

### Benchmarks

| Files Watched | inotify Watches | Memory Usage | Event Latency |
|---------------|-----------------|--------------|---------------|
| 1,000 | 50 | ~10MB | <5ms |
| 10,000 | 500 | ~50MB | <10ms |
| 50,000 | 2,500 | ~150MB | <20ms |
| 100,000 | 5,000 | ~300MB | <50ms |
| 500,000 | 25,000 | ~1GB | <100ms |

---

## Debouncing Strategies

### Why Debounce?

File operations often trigger multiple events:
- Editor saves create temp file, writes, renames
- Git operations touch many files rapidly
- Build processes generate many files

### Per-File Debouncing

```typescript
class FileDebouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private pending: Map<string, { event: string; timestamp: number }> = new Map();
  
  constructor(
    private delay: number = 50,
    private callback: (path: string, event: string) => void
  ) {}
  
  debounce(path: string, event: string): void {
    // Clear existing timer for this file
    const existingTimer = this.timers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Store pending event
    this.pending.set(path, { event, timestamp: Date.now() });
    
    // Set new timer
    const timer = setTimeout(() => {
      const pendingEvent = this.pending.get(path);
      if (pendingEvent) {
        this.callback(path, pendingEvent.event);
        this.pending.delete(path);
      }
      this.timers.delete(path);
    }, this.delay);
    
    this.timers.set(path, timer);
  }
}

// Usage
const debouncer = new FileDebouncer(50, (path, event) => {
  console.log(`Processing ${event} for ${path}`);
});

watcher.on('all', (event, path) => {
  debouncer.debounce(path, event);
});
```

### Batch Debouncing

```typescript
class BatchDebouncer {
  private timer: NodeJS.Timeout | null = null;
  private batch: Map<string, string> = new Map();
  
  constructor(
    private delay: number = 100,
    private callback: (changes: Map<string, string>) => void
  ) {}
  
  add(path: string, event: string): void {
    // Add to batch (latest event wins)
    this.batch.set(path, event);
    
    // Reset timer
    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    this.timer = setTimeout(() => {
      if (this.batch.size > 0) {
        this.callback(new Map(this.batch));
        this.batch.clear();
      }
      this.timer = null;
    }, this.delay);
  }
}

// Usage
const batchDebouncer = new BatchDebouncer(100, (changes) => {
  console.log(`Processing ${changes.size} file changes`);
  for (const [path, event] of changes) {
    // Process each change
  }
});
```

### Adaptive Debouncing

```typescript
class AdaptiveDebouncer {
  private baseDelay: number;
  private currentDelay: number;
  private eventCount: number = 0;
  private lastEventTime: number = 0;
  
  constructor(baseDelay: number = 50) {
    this.baseDelay = baseDelay;
    this.currentDelay = baseDelay;
  }
  
  getDelay(): number {
    const now = Date.now();
    const timeSinceLastEvent = now - this.lastEventTime;
    
    if (timeSinceLastEvent < 100) {
      // Rapid events - increase delay
      this.eventCount++;
      this.currentDelay = Math.min(
        this.baseDelay * Math.log2(this.eventCount + 1),
        500 // Max 500ms
      );
    } else if (timeSinceLastEvent > 1000) {
      // Quiet period - reset
      this.eventCount = 0;
      this.currentDelay = this.baseDelay;
    }
    
    this.lastEventTime = now;
    return this.currentDelay;
  }
}
```

### Debounce Timing Recommendations

| Scenario | Debounce Delay | Reason |
|----------|----------------|--------|
| CSS changes | 25ms | Fast feedback needed |
| JS/TS changes | 50ms | Balance speed and stability |
| Full rebuild | 100ms | Avoid multiple rebuilds |
| Git operations | 500ms | Many files change at once |
| npm install | 2000ms | Thousands of files |

---

## Platform-Specific Configurations

### Linux (inotify)

```typescript
const linuxConfig: chokidar.WatchOptions = {
  usePolling: false,
  
  // inotify is efficient, can watch many files
  depth: 99,
  
  // Atomic writes detection
  atomic: true,
  
  // Wait for write to finish
  awaitWriteFinish: {
    stabilityThreshold: 50,
    pollInterval: 10,
  },
  
  // Standard ignores
  ignored: /(^|[\/\\])\../,
  
  // Don't follow symlinks (prevents loops)
  followSymlinks: false,
};
```

### macOS (FSEvents)

```typescript
const macOSConfig: chokidar.WatchOptions = {
  usePolling: false,
  
  // FSEvents handles recursion natively
  // and coalesces events automatically
  
  // awaitWriteFinish not needed - FSEvents coalesces
  awaitWriteFinish: false,
  
  // Standard ignores
  ignored: /(^|[\/\\])\../,
};
```

### Docker/WSL (Polling Required)

```typescript
const dockerConfig: chokidar.WatchOptions = {
  // inotify doesn't cross filesystem boundaries
  usePolling: true,
  interval: 300,
  binaryInterval: 1000,
  
  // Reduce watched files aggressively
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
  ],
  
  // Limit depth to reduce polling overhead
  depth: 10,
};
```

### Auto-Detection

```typescript
function getWatchConfig(): chokidar.WatchOptions {
  const isDocker = fs.existsSync('/.dockerenv');
  const isWSL = process.platform === 'linux' && 
    fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  const isNetworkFS = checkNetworkFilesystem();
  
  if (isDocker || isWSL || isNetworkFS) {
    return dockerConfig;
  }
  
  if (process.platform === 'darwin') {
    return macOSConfig;
  }
  
  return linuxConfig;
}

function checkNetworkFilesystem(): boolean {
  try {
    const stats = fs.statfsSync(process.cwd());
    // NFS, CIFS, etc. have specific magic numbers
    const networkFsTypes = [0x6969, 0xff534d42, 0x517b];
    return networkFsTypes.includes(stats.type);
  } catch {
    return false;
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. ENOSPC: System limit for file watchers reached

```bash
# Check current limit
cat /proc/sys/fs/inotify/max_user_watches

# Increase limit
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### 2. Changes not detected in Docker

```typescript
// Force polling in Docker
const watcher = chokidar.watch('.', {
  usePolling: true,
  interval: 300,
});
```

#### 3. Duplicate events

```typescript
// Use awaitWriteFinish
const watcher = chokidar.watch('.', {
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 20,
  },
});
```

#### 4. High CPU usage

```typescript
// Reduce polling frequency or switch to native
const watcher = chokidar.watch('.', {
  usePolling: false, // Try native first
  // If polling required:
  interval: 500, // Increase interval
  ignored: ['**/node_modules/**'], // Ignore more
});
```

### Debugging

```typescript
// Enable debug logging
process.env.DEBUG = 'chokidar:*';

// Or manually log events
const watcher = chokidar.watch('.', { ignoreInitial: false });

watcher
  .on('add', (path) => console.log(`[add] ${path}`))
  .on('change', (path) => console.log(`[change] ${path}`))
  .on('unlink', (path) => console.log(`[unlink] ${path}`))
  .on('addDir', (path) => console.log(`[addDir] ${path}`))
  .on('unlinkDir', (path) => console.log(`[unlinkDir] ${path}`))
  .on('error', (error) => console.error(`[error] ${error}`))
  .on('ready', () => console.log('[ready] Initial scan complete'))
  .on('raw', (event, path, details) => {
    console.log(`[raw] ${event} ${path}`, details);
  });
```

---

## Best Practices

### 1. Always Ignore node_modules

```typescript
ignored: ['**/node_modules/**']
```

This alone can reduce watched files by 80%+.

### 2. Use Native Events When Possible

```typescript
usePolling: false // Default, but be explicit
```

### 3. Implement Proper Debouncing

```typescript
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
```

### 4. Clean Up Watchers

```typescript
process.on('SIGTERM', async () => {
  await watcher.close();
  process.exit(0);
});
```

### 5. Monitor Resource Usage

```typescript
setInterval(() => {
  const watched = watcher.getWatched();
  const count = Object.values(watched).flat().length;
  console.log(`Watching ${count} files`);
}, 60000);
```

---

## Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Abstraction** | chokidar | Cross-platform file watching |
| **Linux** | inotify | Kernel-level file events |
| **macOS** | FSEvents | Native file system events |
| **Windows** | ReadDirectoryChangesW | Win32 API |
| **Fallback** | Polling | Docker, network FS |
| **Debouncing** | Custom/lodash | Prevent duplicate processing |

### Key Metrics

| Metric | Target | Acceptable |
|--------|--------|------------|
| Event detection | <5ms | <20ms |
| Debounce delay | 50ms | 100ms |
| Memory per 1K files | <10MB | <50MB |
| CPU idle | <1% | <5% |
