# Ignore Patterns for File Watching

This guide provides comprehensive coverage of ignore patterns for file watching systems, including node_modules exclusion, .git exclusion, custom patterns, and performance optimization strategies.

---

## Table of Contents

1. [Overview](#overview)
2. [Why Ignore Patterns Matter](#why-ignore-patterns-matter)
3. [Pattern Hierarchy](#pattern-hierarchy)
4. [Built-in Ignore Patterns](#built-in-ignore-patterns)
5. [Framework-Specific Patterns](#framework-specific-patterns)
6. [Custom Ignore Patterns](#custom-ignore-patterns)
7. [Pattern Syntax](#pattern-syntax)
8. [Performance Impact](#performance-impact)
9. [Dynamic Pattern Management](#dynamic-pattern-management)
10. [Best Practices](#best-practices)

---

## Overview

Ignore patterns are critical for file watching performance. Without proper ignore patterns, a typical Node.js project would watch 100,000+ files in node_modules alone, consuming excessive memory and CPU.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      IGNORE PATTERN HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Level 1: KERNEL (inotify)     - Cannot ignore, watches everything added   │
│                                                                             │
│  Level 2: CHOKIDAR (filter)    - Filters before emitting events            │
│           ├── ignored: ['**/node_modules/**', '**/.git/**']                │
│           └── Regex/function supported                                      │
│                                                                             │
│  Level 3: VITE (application)   - Additional filtering for HMR              │
│           ├── server.watch.ignored                                          │
│           └── Filters what triggers rebuild                                 │
│                                                                             │
│  Level 4: PROJECT (.gitignore) - User-defined patterns                     │
│           └── Synced with file watcher                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Ignore Patterns Matter

### File Count Impact

| Directory | Typical File Count | % of Project |
|-----------|-------------------|--------------|
| node_modules | 50,000-200,000 | 80-95% |
| .git | 1,000-10,000 | 2-5% |
| dist/build | 100-10,000 | 1-5% |
| Source code | 100-5,000 | 1-10% |

### Resource Usage Without Ignores

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WITHOUT IGNORE PATTERNS                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Files watched: 150,000                                                     │
│  inotify watches: 15,000                                                    │
│  Memory usage: 500MB+                                                       │
│  CPU (idle): 5-10%                                                          │
│  Event processing: Slow (many false positives)                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  WITH PROPER IGNORE PATTERNS                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Files watched: 2,000                                                       │
│  inotify watches: 200                                                       │
│  Memory usage: 20MB                                                         │
│  CPU (idle): <1%                                                            │
│  Event processing: Fast (relevant events only)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pattern Hierarchy

### Level 1: Kernel Level (inotify)

The kernel cannot ignore files - it watches everything that's added. Filtering happens in userspace.

```c
// inotify watches everything added
int wd = inotify_add_watch(fd, "/path/to/dir", IN_ALL_EVENTS);
// Cannot specify ignore patterns at this level
```

### Level 2: chokidar Level

chokidar filters events before emitting them to the application.

```typescript
const watcher = chokidar.watch('.', {
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
  ],
});
```

### Level 3: Application Level (Vite/Webpack)

Frameworks add their own filtering layer.

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/coverage/**'],
    },
  },
});
```

### Level 4: Project Level (.gitignore)

User-defined patterns that can be synced with file watchers.

```gitignore
# .gitignore
node_modules/
dist/
.env.local
*.log
```

---

## Built-in Ignore Patterns

### Essential Patterns (Always Include)

```typescript
const essentialIgnores = [
  // Package managers
  '**/node_modules/**',
  '**/bower_components/**',
  '**/.pnpm/**',
  
  // Version control
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  
  // Build outputs
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.nuxt/**',
  
  // Cache directories
  '**/.cache/**',
  '**/.parcel-cache/**',
  '**/.vite/**',
  '**/node_modules/.cache/**',
  
  // IDE/Editor
  '**/.idea/**',
  '**/.vscode/**',
  '**/*.swp',
  '**/*.swo',
  '**/*~',
  
  // OS files
  '**/.DS_Store',
  '**/Thumbs.db',
  
  // Logs
  '**/*.log',
  '**/logs/**',
  
  // Test coverage
  '**/coverage/**',
  '**/.nyc_output/**',
];
```

### Language-Specific Patterns

```typescript
const languageIgnores = {
  // Python
  python: [
    '**/__pycache__/**',
    '**/*.pyc',
    '**/*.pyo',
    '**/.pytest_cache/**',
    '**/.mypy_cache/**',
    '**/venv/**',
    '**/.venv/**',
    '**/env/**',
    '**/.tox/**',
    '**/*.egg-info/**',
  ],
  
  // Java/Kotlin
  java: [
    '**/target/**',
    '**/*.class',
    '**/.gradle/**',
    '**/build/**',
  ],
  
  // Go
  go: [
    '**/vendor/**',
    '**/*.exe',
    '**/*.test',
  ],
  
  // Rust
  rust: [
    '**/target/**',
    '**/*.rlib',
    '**/Cargo.lock', // Optional
  ],
  
  // Ruby
  ruby: [
    '**/vendor/bundle/**',
    '**/.bundle/**',
    '**/tmp/**',
  ],
};
```

---

## Framework-Specific Patterns

### Vite

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    watch: {
      // Add to default ignores
      ignored: [
        '**/test-results/**',
        '**/playwright-report/**',
      ],
    },
  },
});
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  watchOptions: {
    ignored: /node_modules/,
    // Or array
    ignored: ['**/node_modules/**', '**/dist/**'],
  },
};
```

### Next.js

```javascript
// next.config.js
module.exports = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**'],
      };
    }
    return config;
  },
};
```

### nodemon

```json
// nodemon.json
{
  "ignore": [
    "node_modules",
    ".git",
    "dist",
    "*.test.ts",
    "*.spec.ts"
  ],
  "ignoreRoot": [".git"]
}
```

### tsx watch

```json
// package.json
{
  "scripts": {
    "dev": "tsx watch --ignore node_modules --ignore dist server/index.ts"
  }
}
```

---

## Custom Ignore Patterns

### Pattern Types

```typescript
// 1. Glob patterns (most common)
const globPatterns = [
  '**/node_modules/**',  // Any node_modules at any depth
  '*.log',               // Any .log file in root
  '**/*.log',            // Any .log file anywhere
  'dist/**',             // Everything in dist/
  '!dist/keep.js',       // Negation - don't ignore this
];

// 2. Regular expressions
const regexPatterns = [
  /node_modules/,
  /\.log$/,
  /\.(swp|swo)$/,
  /^\..*/, // Dotfiles
];

// 3. Functions (most flexible)
const functionPatterns = [
  (path: string) => path.includes('node_modules'),
  (path: string) => path.endsWith('.log'),
  (path: string, stats?: fs.Stats) => stats?.isDirectory() && path.includes('cache'),
];
```

### Combining Patterns

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch('.', {
  ignored: [
    // Glob patterns
    '**/node_modules/**',
    '**/.git/**',
    
    // Regex patterns
    /\.log$/,
    /\.(swp|swo|swn)$/,
    
    // Function patterns
    (path: string) => {
      // Ignore files larger than 10MB
      try {
        const stats = fs.statSync(path);
        return stats.size > 10 * 1024 * 1024;
      } catch {
        return false;
      }
    },
  ],
});
```

### Negation Patterns

```typescript
// Include specific files in ignored directories
const patterns = [
  '**/node_modules/**',      // Ignore all node_modules
  '!**/node_modules/.bin/**', // But watch .bin scripts
  
  '**/dist/**',              // Ignore dist
  '!**/dist/index.html',     // But watch index.html
];

// Note: Negation order matters!
// Negations must come after the pattern they negate
```

---

## Pattern Syntax

### Glob Syntax Reference

| Pattern | Matches | Example |
|---------|---------|---------|
| `*` | Any characters except `/` | `*.js` matches `app.js` |
| `**` | Any characters including `/` | `**/*.js` matches `src/app.js` |
| `?` | Single character | `?.js` matches `a.js` |
| `[abc]` | Character class | `[abc].js` matches `a.js` |
| `[a-z]` | Character range | `[a-z].js` matches `x.js` |
| `[!abc]` | Negated class | `[!abc].js` matches `d.js` |
| `{a,b}` | Alternatives | `*.{js,ts}` matches both |
| `!pattern` | Negation | `!*.min.js` excludes minified |

### Regex Syntax Reference

```typescript
const regexExamples = {
  // Match dotfiles
  dotfiles: /^\./,
  
  // Match specific extensions
  logs: /\.log$/,
  
  // Match multiple extensions
  media: /\.(jpg|jpeg|png|gif|mp4|webm)$/i,
  
  // Match paths containing string
  nodeModules: /node_modules/,
  
  // Match exact directory
  exactDir: /^dist$/,
  
  // Case insensitive
  caseInsensitive: /readme/i,
};
```

### Function Pattern Examples

```typescript
// Ignore by file size
const ignoreLargeFiles = (path: string): boolean => {
  try {
    const stats = fs.statSync(path);
    return stats.size > 1024 * 1024; // > 1MB
  } catch {
    return false;
  }
};

// Ignore by modification time
const ignoreOldFiles = (path: string): boolean => {
  try {
    const stats = fs.statSync(path);
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return stats.mtimeMs < oneWeekAgo;
  } catch {
    return false;
  }
};

// Ignore by content (expensive, use sparingly)
const ignoreGeneratedFiles = (path: string): boolean => {
  try {
    const content = fs.readFileSync(path, 'utf-8');
    return content.includes('// AUTO-GENERATED');
  } catch {
    return false;
  }
};
```

---

## Performance Impact

### Pattern Matching Performance

| Pattern Type | Speed | Memory | Flexibility |
|--------------|-------|--------|-------------|
| String glob | Fast | Low | Medium |
| Compiled regex | Very fast | Low | High |
| Function | Slow | Variable | Highest |

### Optimization: Compile Patterns

```typescript
class OptimizedIgnoreMatcher {
  private compiledPatterns: RegExp[];
  
  constructor(patterns: (string | RegExp)[]) {
    this.compiledPatterns = patterns.map(p => {
      if (p instanceof RegExp) return p;
      return this.globToRegex(p);
    });
  }
  
  private globToRegex(glob: string): RegExp {
    const regex = glob
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regex}$`);
  }
  
  matches(path: string): boolean {
    return this.compiledPatterns.some(pattern => pattern.test(path));
  }
}
```

### Benchmarks

```typescript
// Benchmark results (10,000 paths)
const benchmarks = {
  stringGlob: '15ms',      // Using minimatch
  compiledRegex: '2ms',    // Pre-compiled
  functionMatcher: '50ms', // With fs.stat calls
};
```

---

## Dynamic Pattern Management

### Syncing with .gitignore

```typescript
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

class GitignoreSyncedWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private gitignorePatterns: string[] = [];
  
  async start(watchPath: string): Promise<void> {
    // Load initial .gitignore
    await this.loadGitignore(watchPath);
    
    // Watch for .gitignore changes
    this.watchGitignore(watchPath);
    
    // Start main watcher
    this.startWatcher(watchPath);
  }
  
  private async loadGitignore(basePath: string): Promise<void> {
    const gitignorePath = path.join(basePath, '.gitignore');
    
    try {
      const content = await fs.promises.readFile(gitignorePath, 'utf-8');
      this.gitignorePatterns = content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(pattern => {
          // Convert gitignore pattern to glob
          if (pattern.startsWith('/')) {
            return pattern.slice(1);
          }
          return `**/${pattern}`;
        });
    } catch {
      this.gitignorePatterns = [];
    }
  }
  
  private watchGitignore(basePath: string): void {
    const gitignoreWatcher = chokidar.watch(
      path.join(basePath, '.gitignore'),
      { ignoreInitial: true }
    );
    
    gitignoreWatcher.on('change', async () => {
      console.log('.gitignore changed, reloading patterns...');
      await this.loadGitignore(basePath);
      await this.restartWatcher(basePath);
    });
  }
  
  private startWatcher(watchPath: string): void {
    const allPatterns = [
      // Built-in essentials
      '**/node_modules/**',
      '**/.git/**',
      // User patterns from .gitignore
      ...this.gitignorePatterns,
    ];
    
    this.watcher = chokidar.watch(watchPath, {
      ignored: allPatterns,
      persistent: true,
      ignoreInitial: true,
    });
    
    this.watcher.on('all', (event, path) => {
      console.log(`${event}: ${path}`);
    });
  }
  
  private async restartWatcher(watchPath: string): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }
    this.startWatcher(watchPath);
  }
}
```

### Runtime Pattern Updates

```typescript
class DynamicIgnoreManager {
  private patterns: Set<string> = new Set();
  private watcher: chokidar.FSWatcher;
  
  constructor() {
    // Start with minimal patterns
    this.patterns.add('**/node_modules/**');
    this.patterns.add('**/.git/**');
    
    this.watcher = chokidar.watch('.', {
      ignored: (path) => this.shouldIgnore(path),
      persistent: true,
    });
  }
  
  addPattern(pattern: string): void {
    this.patterns.add(pattern);
    console.log(`Added ignore pattern: ${pattern}`);
  }
  
  removePattern(pattern: string): void {
    this.patterns.delete(pattern);
    console.log(`Removed ignore pattern: ${pattern}`);
  }
  
  private shouldIgnore(filePath: string): boolean {
    for (const pattern of this.patterns) {
      if (minimatch(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }
}
```

---

## Best Practices

### 1. Always Ignore node_modules

```typescript
// This single pattern eliminates 80%+ of files
ignored: ['**/node_modules/**']
```

### 2. Use Specific Patterns Over Broad Ones

```typescript
// Bad: Too broad, might miss important files
ignored: ['**/*']

// Good: Specific directories
ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
```

### 3. Order Patterns by Frequency

```typescript
// Put most common matches first for faster short-circuit
ignored: [
  '**/node_modules/**',  // Most files
  '**/.git/**',          // Second most
  '**/dist/**',          // Third
  '**/*.log',            // Less common
]
```

### 4. Use Compiled Patterns for Performance

```typescript
// Compile once, use many times
const ignoreMatcher = new RegExp(
  patterns.map(p => globToRegex(p)).join('|')
);

// Fast matching
const shouldIgnore = (path: string) => ignoreMatcher.test(path);
```

### 5. Document Custom Patterns

```typescript
const ignored = [
  // Package managers
  '**/node_modules/**',
  
  // Build outputs
  '**/dist/**',
  '**/build/**',
  
  // Project-specific: Generated API clients
  '**/src/generated/**',
  
  // Project-specific: Large binary assets
  '**/assets/videos/**',
];
```

### 6. Test Patterns Before Deploying

```typescript
// Utility to test if a path would be ignored
function testIgnorePatterns(
  patterns: string[],
  testPaths: string[]
): void {
  for (const path of testPaths) {
    const ignored = patterns.some(p => minimatch(path, p));
    console.log(`${path}: ${ignored ? 'IGNORED' : 'WATCHED'}`);
  }
}

testIgnorePatterns(
  ['**/node_modules/**', '**/dist/**'],
  [
    'src/index.ts',           // Should be WATCHED
    'node_modules/react/index.js', // Should be IGNORED
    'dist/bundle.js',         // Should be IGNORED
  ]
);
```

### 7. Monitor Ignored vs Watched Ratio

```typescript
// Ensure you're not watching too much
const watcher = chokidar.watch('.');

watcher.on('ready', () => {
  const watched = watcher.getWatched();
  const totalFiles = Object.values(watched).flat().length;
  
  console.log(`Watching ${totalFiles} files`);
  
  if (totalFiles > 10000) {
    console.warn('Warning: Watching many files. Consider adding more ignore patterns.');
  }
});
```

---

## Summary

### Essential Ignore Patterns

| Pattern | Purpose | Impact |
|---------|---------|--------|
| `**/node_modules/**` | Package dependencies | -80% files |
| `**/.git/**` | Version control | -5% files |
| `**/dist/**` | Build output | -2% files |
| `**/.cache/**` | Cache directories | -1% files |
| `**/*.log` | Log files | Prevents noise |

### Pattern Type Selection

| Use Case | Pattern Type | Example |
|----------|--------------|---------|
| Directory exclusion | Glob | `**/node_modules/**` |
| Extension filtering | Regex | `/\.(log|tmp)$/` |
| Complex logic | Function | `(path) => path.includes('generated')` |
| User-defined | .gitignore sync | Dynamic loading |

### Performance Guidelines

| Metric | Target | Warning |
|--------|--------|---------|
| Files watched | <5,000 | >10,000 |
| inotify watches | <1,000 | >5,000 |
| Memory usage | <50MB | >200MB |
| Pattern match time | <1ms | >10ms |

Proper ignore patterns are essential for a responsive development environment. Always start with the essential patterns and add project-specific ones as needed.
