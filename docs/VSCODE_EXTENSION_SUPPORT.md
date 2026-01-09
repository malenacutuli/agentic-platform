# VS Code Extension Support

This guide provides comprehensive coverage of VS Code extension support in cloud development environments, including supported extensions, extension sandboxing, marketplace integration, and compatibility considerations.

---

## Table of Contents

1. [Overview](#overview)
2. [Extension Architecture](#extension-architecture)
3. [Supported Extensions](#supported-extensions)
4. [Extension Sandboxing](#extension-sandboxing)
5. [Extension Marketplace](#extension-marketplace)
6. [Extension Host Implementation](#extension-host-implementation)
7. [API Compatibility](#api-compatibility)
8. [Extension Installation](#extension-installation)
9. [Extension Configuration](#extension-configuration)
10. [Performance Considerations](#performance-considerations)
11. [Security Model](#security-model)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## Overview

VS Code extensions provide powerful customization capabilities, but running them in a cloud environment requires careful consideration of security, performance, and compatibility.

### Extension Support Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        EXTENSION SUPPORT ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              BROWSER (Client)                                    │   │
│  │                                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │   │
│  │  │  Monaco Editor   │  │  Web Extensions  │  │  Extension UI    │               │   │
│  │  │                  │  │  (Browser-only)  │  │  Components      │               │   │
│  │  │  - Text editing  │  │                  │  │                  │               │   │
│  │  │  - Syntax        │  │  - Themes        │  │  - Sidebars      │               │   │
│  │  │  - IntelliSense  │  │  - Keymaps       │  │  - Panels        │               │   │
│  │  │                  │  │  - Snippets      │  │  - Status bar    │               │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘               │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         │ WebSocket / HTTP                              │
│                                         │                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SANDBOX (Server)                                    │   │
│  │                                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                      Extension Host Process                               │   │   │
│  │  │                                                                            │   │   │
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐              │   │   │
│  │  │  │  Extension 1   │  │  Extension 2   │  │  Extension N   │              │   │   │
│  │  │  │  (TypeScript)  │  │  (Python)      │  │  (Git)         │              │   │   │
│  │  │  └────────────────┘  └────────────────┘  └────────────────┘              │   │   │
│  │  │                                                                            │   │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │   │
│  │  │  │                    VS Code Extension API                             │ │   │   │
│  │  │  │  - vscode.workspace  - vscode.window  - vscode.commands             │ │   │   │
│  │  │  │  - vscode.languages  - vscode.debug   - vscode.tasks                │ │   │   │
│  │  │  └─────────────────────────────────────────────────────────────────────┘ │   │   │
│  │  │                                                                            │   │   │
│  │  └──────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐               │   │
│  │  │ Language Servers │  │  File System     │  │  Terminal        │               │   │
│  │  │                  │  │                  │  │                  │               │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘               │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Support Tiers

| Tier | Description | Examples |
|------|-------------|----------|
| **Tier 1: Full Support** | Native integration, tested | Language extensions, themes |
| **Tier 2: Compatible** | Works with minor limitations | Linters, formatters |
| **Tier 3: Partial** | Some features may not work | Debuggers, complex extensions |
| **Tier 4: Unsupported** | Cannot run in cloud environment | Native binaries, desktop-only |

---

## Extension Architecture

### Extension Types

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           EXTENSION TYPE CLASSIFICATION                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         WEB EXTENSIONS (Browser-only)                            │   │
│  │                                                                                   │   │
│  │  ✅ Run entirely in browser                                                       │   │
│  │  ✅ No server-side component needed                                               │   │
│  │  ✅ Instant activation                                                            │   │
│  │                                                                                   │   │
│  │  Examples: Themes, Keymaps, Snippets, Simple language support                    │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                      WORKSPACE EXTENSIONS (Server-side)                          │   │
│  │                                                                                   │   │
│  │  ⚡ Run in Extension Host on server                                               │   │
│  │  ⚡ Full file system access                                                       │   │
│  │  ⚡ Can spawn processes                                                           │   │
│  │                                                                                   │   │
│  │  Examples: Language servers, Git, Debuggers, Task runners                        │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         UI EXTENSIONS (Hybrid)                                   │   │
│  │                                                                                   │   │
│  │  🔄 Browser component for UI                                                      │   │
│  │  🔄 Server component for logic                                                    │   │
│  │  🔄 Communication via RPC                                                         │   │
│  │                                                                                   │   │
│  │  Examples: Source control views, Custom editors, Webviews                        │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Extension Manifest Analysis

```typescript
// src/extensions/manifestAnalyzer.ts

interface ExtensionManifest {
  name: string;
  version: string;
  publisher: string;
  engines: { vscode: string };
  main?: string;
  browser?: string;
  activationEvents?: string[];
  contributes?: {
    commands?: any[];
    languages?: any[];
    grammars?: any[];
    themes?: any[];
    snippets?: any[];
    keybindings?: any[];
    configuration?: any;
    views?: any;
    viewsContainers?: any;
    debuggers?: any[];
    taskDefinitions?: any[];
  };
  extensionDependencies?: string[];
  extensionPack?: string[];
  capabilities?: {
    virtualWorkspaces?: boolean | { supported: boolean };
    untrustedWorkspaces?: { supported: boolean };
  };
}

interface CompatibilityResult {
  compatible: boolean;
  tier: 1 | 2 | 3 | 4;
  issues: string[];
  warnings: string[];
  requiredCapabilities: string[];
}

class ExtensionManifestAnalyzer {
  // Analyze extension compatibility
  analyzeCompatibility(manifest: ExtensionManifest): CompatibilityResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const requiredCapabilities: string[] = [];

    // Check for web extension support
    const isWebExtension = !!manifest.browser;
    const isWorkspaceExtension = !!manifest.main;

    // Check activation events
    const activationEvents = manifest.activationEvents || [];
    
    // Check for problematic activation events
    if (activationEvents.includes('*')) {
      warnings.push('Extension activates on startup, may impact performance');
    }

    // Check contributions
    const contributes = manifest.contributes || {};

    // Debugger support is limited
    if (contributes.debuggers?.length) {
      warnings.push('Debugger support may be limited in cloud environment');
      requiredCapabilities.push('debug');
    }

    // Task definitions require shell access
    if (contributes.taskDefinitions?.length) {
      requiredCapabilities.push('tasks');
    }

    // Check for native dependencies
    if (this.hasNativeDependencies(manifest)) {
      issues.push('Extension requires native binaries');
    }

    // Check virtual workspace support
    if (manifest.capabilities?.virtualWorkspaces === false) {
      issues.push('Extension does not support virtual workspaces');
    }

    // Determine tier
    let tier: 1 | 2 | 3 | 4;
    if (issues.length > 0) {
      tier = 4;
    } else if (isWebExtension && !isWorkspaceExtension) {
      tier = 1;
    } else if (warnings.length === 0) {
      tier = 1;
    } else if (warnings.length <= 2) {
      tier = 2;
    } else {
      tier = 3;
    }

    return {
      compatible: tier < 4,
      tier,
      issues,
      warnings,
      requiredCapabilities,
    };
  }

  private hasNativeDependencies(manifest: ExtensionManifest): boolean {
    // Check for known native dependency patterns
    const nativePatterns = [
      'node-gyp',
      'prebuild',
      'node-pre-gyp',
      'native',
      'binding.gyp',
    ];

    // Would need to check package.json dependencies
    // This is a simplified check
    return false;
  }

  // Get extension type
  getExtensionType(manifest: ExtensionManifest): 'web' | 'workspace' | 'hybrid' {
    const hasMain = !!manifest.main;
    const hasBrowser = !!manifest.browser;

    if (hasBrowser && !hasMain) return 'web';
    if (hasMain && !hasBrowser) return 'workspace';
    return 'hybrid';
  }

  // Get required VS Code version
  getRequiredVersion(manifest: ExtensionManifest): string {
    return manifest.engines?.vscode || '*';
  }
}

export { ExtensionManifestAnalyzer, ExtensionManifest, CompatibilityResult };
```

---

## Supported Extensions

### Tier 1: Fully Supported Extensions

| Category | Extensions | Notes |
|----------|------------|-------|
| **Languages** | TypeScript, JavaScript, Python, Go, Rust, Java, C/C++, C#, PHP, Ruby | Full LSP support |
| **Themes** | One Dark Pro, Dracula, Material Theme, GitHub Theme, Nord | All color themes work |
| **Icons** | Material Icon Theme, vscode-icons, File Icons | Full icon support |
| **Keymaps** | Vim, Sublime Text, Atom, IntelliJ | All keybindings work |
| **Snippets** | ES7 Snippets, Python Snippets, Go Snippets | All snippet extensions |
| **Formatters** | Prettier, ESLint, Black, gofmt | Full formatting support |

### Tier 2: Compatible Extensions

| Category | Extensions | Limitations |
|----------|------------|-------------|
| **Git** | GitLens, Git Graph, Git History | Some features may be slower |
| **Linters** | ESLint, Pylint, golangci-lint | Requires language runtime |
| **Testing** | Jest, Mocha, pytest | Test discovery may be delayed |
| **Docker** | Docker extension | Limited container management |
| **Database** | SQLTools, MongoDB | Connection may require setup |

### Tier 3: Partial Support

| Category | Extensions | Issues |
|----------|------------|--------|
| **Debuggers** | Node Debug, Python Debug | Breakpoints work, some features limited |
| **Remote** | Remote SSH, Remote Containers | Not applicable in cloud |
| **Live Share** | VS Live Share | Requires alternative implementation |
| **Notebooks** | Jupyter | Kernel management differs |

### Tier 4: Unsupported Extensions

| Category | Extensions | Reason |
|----------|------------|--------|
| **Native** | C/C++ Debug | Requires native debugger |
| **Desktop** | Browser Preview | Desktop-only features |
| **Hardware** | Serial Port | No hardware access |
| **System** | PowerShell ISE | Windows-only |

### Extension Compatibility Database

```typescript
// src/extensions/compatibilityDatabase.ts

interface ExtensionCompatibility {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  tested: boolean;
  lastTested?: string;
  notes?: string;
  workarounds?: string[];
  alternatives?: string[];
}

const compatibilityDatabase: ExtensionCompatibility[] = [
  // Tier 1: Fully Supported
  {
    id: 'ms-vscode.vscode-typescript-next',
    name: 'TypeScript Nightly',
    tier: 1,
    tested: true,
    lastTested: '2024-01-01',
  },
  {
    id: 'ms-python.python',
    name: 'Python',
    tier: 1,
    tested: true,
    lastTested: '2024-01-01',
    notes: 'Full support including Pylance',
  },
  {
    id: 'golang.go',
    name: 'Go',
    tier: 1,
    tested: true,
    lastTested: '2024-01-01',
  },
  {
    id: 'rust-lang.rust-analyzer',
    name: 'rust-analyzer',
    tier: 1,
    tested: true,
    lastTested: '2024-01-01',
  },
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier',
    tier: 1,
    tested: true,
    lastTested: '2024-01-01',
  },
  {
    id: 'dbaeumer.vscode-eslint',
    name: 'ESLint',
    tier: 1,
    tested: true,
    lastTested: '2024-01-01',
  },
  
  // Tier 2: Compatible
  {
    id: 'eamodio.gitlens',
    name: 'GitLens',
    tier: 2,
    tested: true,
    lastTested: '2024-01-01',
    notes: 'Some advanced features may be slower',
  },
  {
    id: 'ms-azuretools.vscode-docker',
    name: 'Docker',
    tier: 2,
    tested: true,
    lastTested: '2024-01-01',
    notes: 'Container management limited to sandbox',
  },
  
  // Tier 3: Partial
  {
    id: 'ms-vscode.js-debug',
    name: 'JavaScript Debugger',
    tier: 3,
    tested: true,
    lastTested: '2024-01-01',
    notes: 'Basic debugging works, some features limited',
    workarounds: ['Use console.log for complex debugging'],
  },
  
  // Tier 4: Unsupported
  {
    id: 'ms-vscode-remote.remote-ssh',
    name: 'Remote - SSH',
    tier: 4,
    tested: true,
    lastTested: '2024-01-01',
    notes: 'Not applicable - already in remote environment',
    alternatives: ['Use built-in terminal for SSH'],
  },
];

class CompatibilityChecker {
  private database: Map<string, ExtensionCompatibility>;

  constructor() {
    this.database = new Map(
      compatibilityDatabase.map(ext => [ext.id, ext])
    );
  }

  check(extensionId: string): ExtensionCompatibility | null {
    return this.database.get(extensionId) || null;
  }

  getByTier(tier: 1 | 2 | 3 | 4): ExtensionCompatibility[] {
    return compatibilityDatabase.filter(ext => ext.tier === tier);
  }

  search(query: string): ExtensionCompatibility[] {
    const lowerQuery = query.toLowerCase();
    return compatibilityDatabase.filter(
      ext =>
        ext.id.toLowerCase().includes(lowerQuery) ||
        ext.name.toLowerCase().includes(lowerQuery)
    );
  }
}

export { CompatibilityChecker, ExtensionCompatibility };
```

---

## Extension Sandboxing

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        EXTENSION SANDBOXING ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           SANDBOX CONTAINER                                      │   │
│  │                                                                                   │   │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      EXTENSION HOST PROCESS                                │  │   │
│  │  │                                                                             │  │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │   │
│  │  │  │                    EXTENSION SANDBOX                                 │  │  │   │
│  │  │  │                                                                       │  │  │   │
│  │  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │  │  │   │
│  │  │  │  │ Extension 1 │  │ Extension 2 │  │ Extension 3 │                  │  │  │   │
│  │  │  │  │             │  │             │  │             │                  │  │  │   │
│  │  │  │  │ Isolated    │  │ Isolated    │  │ Isolated    │                  │  │  │   │
│  │  │  │  │ Context     │  │ Context     │  │ Context     │                  │  │  │   │
│  │  │  │  └─────────────┘  └─────────────┘  └─────────────┘                  │  │  │   │
│  │  │  │                                                                       │  │  │   │
│  │  │  │  ┌─────────────────────────────────────────────────────────────────┐│  │  │   │
│  │  │  │  │                    API PROXY LAYER                              ││  │  │   │
│  │  │  │  │                                                                  ││  │  │   │
│  │  │  │  │  - Permission checks                                            ││  │  │   │
│  │  │  │  │  - Resource limits                                              ││  │  │   │
│  │  │  │  │  - Audit logging                                                ││  │  │   │
│  │  │  │  │  - Rate limiting                                                ││  │  │   │
│  │  │  │  └─────────────────────────────────────────────────────────────────┘│  │  │   │
│  │  │  │                                                                       │  │  │   │
│  │  │  └─────────────────────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                                             │  │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │   │
│  │  │  │                    RESTRICTED APIs                                   │  │  │   │
│  │  │  │                                                                       │  │  │   │
│  │  │  │  ❌ process.env (filtered)    ❌ child_process (restricted)         │  │  │   │
│  │  │  │  ❌ fs (scoped to workspace)  ❌ net (proxy required)               │  │  │   │
│  │  │  │  ❌ os (limited info)         ❌ crypto (allowed)                   │  │  │   │
│  │  │  │                                                                       │  │  │   │
│  │  │  └─────────────────────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                                             │  │   │
│  │  └───────────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Extension Sandbox Implementation

```typescript
// src/extensions/sandbox/extensionSandbox.ts

import * as vm from 'vm';
import * as path from 'path';

interface SandboxConfig {
  extensionId: string;
  extensionPath: string;
  workspacePath: string;
  permissions: ExtensionPermissions;
  resourceLimits: ResourceLimits;
}

interface ExtensionPermissions {
  fileSystem: 'none' | 'workspace' | 'full';
  network: 'none' | 'localhost' | 'full';
  process: 'none' | 'spawn' | 'full';
  env: 'none' | 'filtered' | 'full';
}

interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxFileHandles: number;
  maxNetworkConnections: number;
}

class ExtensionSandbox {
  private config: SandboxConfig;
  private context: vm.Context;
  private apiProxy: ExtensionAPIProxy;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.apiProxy = new ExtensionAPIProxy(config);
    this.context = this.createContext();
  }

  private createContext(): vm.Context {
    // Create sandboxed globals
    const sandboxGlobals = {
      // Safe globals
      console: this.createSafeConsole(),
      setTimeout: this.createSafeTimeout(),
      setInterval: this.createSafeInterval(),
      clearTimeout,
      clearInterval,
      Buffer,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      
      // Proxied Node.js modules
      require: this.createSafeRequire(),
      process: this.createSafeProcess(),
      __dirname: this.config.extensionPath,
      __filename: path.join(this.config.extensionPath, 'extension.js'),
      
      // VS Code API
      vscode: this.apiProxy.getVSCodeAPI(),
    };

    return vm.createContext(sandboxGlobals, {
      name: `Extension: ${this.config.extensionId}`,
    });
  }

  private createSafeConsole(): Console {
    const extensionId = this.config.extensionId;
    
    return {
      ...console,
      log: (...args: any[]) => console.log(`[${extensionId}]`, ...args),
      warn: (...args: any[]) => console.warn(`[${extensionId}]`, ...args),
      error: (...args: any[]) => console.error(`[${extensionId}]`, ...args),
      info: (...args: any[]) => console.info(`[${extensionId}]`, ...args),
      debug: (...args: any[]) => console.debug(`[${extensionId}]`, ...args),
    } as Console;
  }

  private createSafeTimeout(): typeof setTimeout {
    const maxTimeout = 30000; // 30 seconds max
    
    return ((callback: Function, delay: number, ...args: any[]) => {
      const safeDelay = Math.min(delay, maxTimeout);
      return setTimeout(callback, safeDelay, ...args);
    }) as typeof setTimeout;
  }

  private createSafeInterval(): typeof setInterval {
    const minInterval = 100; // 100ms minimum
    
    return ((callback: Function, delay: number, ...args: any[]) => {
      const safeDelay = Math.max(delay, minInterval);
      return setInterval(callback, safeDelay, ...args);
    }) as typeof setInterval;
  }

  private createSafeRequire(): NodeRequire {
    const allowedModules = new Set([
      'path',
      'url',
      'util',
      'events',
      'stream',
      'string_decoder',
      'querystring',
      'crypto',
      'zlib',
    ]);

    const restrictedModules = new Map<string, any>([
      ['fs', this.createSafeFS()],
      ['child_process', this.createSafeChildProcess()],
      ['net', this.createSafeNet()],
      ['http', this.createSafeHttp()],
      ['https', this.createSafeHttps()],
    ]);

    return ((moduleId: string) => {
      // Check for allowed modules
      if (allowedModules.has(moduleId)) {
        return require(moduleId);
      }

      // Check for restricted modules
      if (restrictedModules.has(moduleId)) {
        return restrictedModules.get(moduleId);
      }

      // Check for extension-local modules
      if (moduleId.startsWith('.') || moduleId.startsWith('/')) {
        const resolvedPath = path.resolve(this.config.extensionPath, moduleId);
        if (resolvedPath.startsWith(this.config.extensionPath)) {
          return require(resolvedPath);
        }
        throw new Error(`Cannot require module outside extension: ${moduleId}`);
      }

      // Check for node_modules within extension
      const extensionNodeModules = path.join(this.config.extensionPath, 'node_modules', moduleId);
      try {
        return require(extensionNodeModules);
      } catch (e) {
        throw new Error(`Module not found: ${moduleId}`);
      }
    }) as NodeRequire;
  }

  private createSafeProcess(): Partial<NodeJS.Process> {
    const filteredEnv: Record<string, string> = {};
    
    // Only expose safe environment variables
    const safeEnvVars = ['NODE_ENV', 'LANG', 'TZ'];
    for (const key of safeEnvVars) {
      if (process.env[key]) {
        filteredEnv[key] = process.env[key]!;
      }
    }

    return {
      env: this.config.permissions.env === 'full' 
        ? process.env 
        : filteredEnv,
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      versions: process.versions,
      cwd: () => this.config.workspacePath,
      nextTick: process.nextTick,
      hrtime: process.hrtime,
    };
  }

  private createSafeFS(): any {
    const workspacePath = this.config.workspacePath;
    const extensionPath = this.config.extensionPath;
    const permission = this.config.permissions.fileSystem;

    if (permission === 'none') {
      return this.createDeniedModule('fs');
    }

    const fs = require('fs');
    const fsPromises = require('fs/promises');

    const isAllowedPath = (filePath: string): boolean => {
      const resolved = path.resolve(filePath);
      
      if (permission === 'workspace') {
        return resolved.startsWith(workspacePath) || resolved.startsWith(extensionPath);
      }
      
      return true; // 'full' permission
    };

    const wrapMethod = (method: Function, methodName: string) => {
      return (...args: any[]) => {
        const filePath = args[0];
        if (typeof filePath === 'string' && !isAllowedPath(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }
        return method.apply(fs, args);
      };
    };

    return {
      readFile: wrapMethod(fs.readFile, 'readFile'),
      readFileSync: wrapMethod(fs.readFileSync, 'readFileSync'),
      writeFile: wrapMethod(fs.writeFile, 'writeFile'),
      writeFileSync: wrapMethod(fs.writeFileSync, 'writeFileSync'),
      readdir: wrapMethod(fs.readdir, 'readdir'),
      readdirSync: wrapMethod(fs.readdirSync, 'readdirSync'),
      stat: wrapMethod(fs.stat, 'stat'),
      statSync: wrapMethod(fs.statSync, 'statSync'),
      exists: wrapMethod(fs.exists, 'exists'),
      existsSync: wrapMethod(fs.existsSync, 'existsSync'),
      mkdir: wrapMethod(fs.mkdir, 'mkdir'),
      mkdirSync: wrapMethod(fs.mkdirSync, 'mkdirSync'),
      unlink: wrapMethod(fs.unlink, 'unlink'),
      unlinkSync: wrapMethod(fs.unlinkSync, 'unlinkSync'),
      promises: {
        readFile: wrapMethod(fsPromises.readFile, 'readFile'),
        writeFile: wrapMethod(fsPromises.writeFile, 'writeFile'),
        readdir: wrapMethod(fsPromises.readdir, 'readdir'),
        stat: wrapMethod(fsPromises.stat, 'stat'),
        mkdir: wrapMethod(fsPromises.mkdir, 'mkdir'),
        unlink: wrapMethod(fsPromises.unlink, 'unlink'),
      },
    };
  }

  private createSafeChildProcess(): any {
    const permission = this.config.permissions.process;

    if (permission === 'none') {
      return this.createDeniedModule('child_process');
    }

    const childProcess = require('child_process');
    const allowedCommands = new Set([
      'node', 'npm', 'npx', 'pnpm', 'yarn',
      'python', 'python3', 'pip', 'pip3',
      'go', 'cargo', 'rustc',
      'git',
    ]);

    const isAllowedCommand = (command: string): boolean => {
      const cmd = command.split(' ')[0];
      const basename = path.basename(cmd);
      return allowedCommands.has(basename);
    };

    return {
      spawn: (command: string, args?: string[], options?: any) => {
        if (!isAllowedCommand(command)) {
          throw new Error(`Command not allowed: ${command}`);
        }
        return childProcess.spawn(command, args, {
          ...options,
          cwd: this.config.workspacePath,
        });
      },
      exec: (command: string, options?: any, callback?: Function) => {
        if (!isAllowedCommand(command)) {
          throw new Error(`Command not allowed: ${command}`);
        }
        return childProcess.exec(command, {
          ...options,
          cwd: this.config.workspacePath,
        }, callback);
      },
      execSync: (command: string, options?: any) => {
        if (!isAllowedCommand(command)) {
          throw new Error(`Command not allowed: ${command}`);
        }
        return childProcess.execSync(command, {
          ...options,
          cwd: this.config.workspacePath,
        });
      },
    };
  }

  private createSafeNet(): any {
    const permission = this.config.permissions.network;

    if (permission === 'none') {
      return this.createDeniedModule('net');
    }

    const net = require('net');

    if (permission === 'localhost') {
      return {
        ...net,
        connect: (options: any, callback?: Function) => {
          const host = typeof options === 'object' ? options.host : 'localhost';
          if (host !== 'localhost' && host !== '127.0.0.1') {
            throw new Error(`Network access denied: ${host}`);
          }
          return net.connect(options, callback);
        },
        createConnection: (options: any, callback?: Function) => {
          const host = typeof options === 'object' ? options.host : 'localhost';
          if (host !== 'localhost' && host !== '127.0.0.1') {
            throw new Error(`Network access denied: ${host}`);
          }
          return net.createConnection(options, callback);
        },
      };
    }

    return net; // 'full' permission
  }

  private createSafeHttp(): any {
    return this.createNetworkModule('http');
  }

  private createSafeHttps(): any {
    return this.createNetworkModule('https');
  }

  private createNetworkModule(moduleName: 'http' | 'https'): any {
    const permission = this.config.permissions.network;

    if (permission === 'none') {
      return this.createDeniedModule(moduleName);
    }

    const httpModule = require(moduleName);

    // Add request logging/auditing
    const originalRequest = httpModule.request;
    httpModule.request = (options: any, callback?: Function) => {
      const url = typeof options === 'string' ? options : options.hostname || options.host;
      console.log(`[${this.config.extensionId}] HTTP request: ${url}`);
      return originalRequest(options, callback);
    };

    return httpModule;
  }

  private createDeniedModule(moduleName: string): any {
    return new Proxy({}, {
      get: (target, prop) => {
        throw new Error(`Module '${moduleName}' is not available in this extension`);
      },
    });
  }

  // Run extension code
  async run(code: string): Promise<any> {
    const script = new vm.Script(code, {
      filename: `${this.config.extensionId}/extension.js`,
    });

    return script.runInContext(this.context, {
      timeout: 30000, // 30 second timeout
    });
  }

  // Dispose sandbox
  dispose(): void {
    // Clean up resources
    this.apiProxy.dispose();
  }
}

// Extension API Proxy
class ExtensionAPIProxy {
  private config: SandboxConfig;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  getVSCodeAPI(): any {
    return {
      workspace: this.createWorkspaceAPI(),
      window: this.createWindowAPI(),
      commands: this.createCommandsAPI(),
      languages: this.createLanguagesAPI(),
      extensions: this.createExtensionsAPI(),
      env: this.createEnvAPI(),
      Uri: this.createUriAPI(),
      Range: this.createRangeClass(),
      Position: this.createPositionClass(),
      Selection: this.createSelectionClass(),
      TextEdit: this.createTextEditClass(),
      WorkspaceEdit: this.createWorkspaceEditClass(),
      Diagnostic: this.createDiagnosticClass(),
      DiagnosticSeverity: this.createDiagnosticSeverityEnum(),
      CompletionItem: this.createCompletionItemClass(),
      CompletionItemKind: this.createCompletionItemKindEnum(),
      // ... more VS Code API classes
    };
  }

  private createWorkspaceAPI(): any {
    return {
      workspaceFolders: [{
        uri: { fsPath: this.config.workspacePath },
        name: path.basename(this.config.workspacePath),
        index: 0,
      }],
      getConfiguration: (section?: string) => {
        // Return extension configuration
        return {
          get: (key: string, defaultValue?: any) => defaultValue,
          has: (key: string) => false,
          update: async (key: string, value: any) => {},
        };
      },
      openTextDocument: async (uri: any) => {
        // Implementation
      },
      onDidChangeTextDocument: (listener: Function) => {
        // Implementation
        return { dispose: () => {} };
      },
      // ... more workspace methods
    };
  }

  private createWindowAPI(): any {
    return {
      showInformationMessage: async (message: string, ...items: string[]) => {
        console.log(`[INFO] ${message}`);
        return items[0];
      },
      showWarningMessage: async (message: string, ...items: string[]) => {
        console.warn(`[WARN] ${message}`);
        return items[0];
      },
      showErrorMessage: async (message: string, ...items: string[]) => {
        console.error(`[ERROR] ${message}`);
        return items[0];
      },
      showQuickPick: async (items: any[], options?: any) => {
        return items[0];
      },
      showInputBox: async (options?: any) => {
        return options?.value || '';
      },
      createOutputChannel: (name: string) => {
        return {
          append: (value: string) => console.log(`[${name}] ${value}`),
          appendLine: (value: string) => console.log(`[${name}] ${value}`),
          clear: () => {},
          show: () => {},
          hide: () => {},
          dispose: () => {},
        };
      },
      // ... more window methods
    };
  }

  private createCommandsAPI(): any {
    const commands = new Map<string, Function>();

    return {
      registerCommand: (command: string, callback: Function) => {
        commands.set(command, callback);
        const disposable = { dispose: () => commands.delete(command) };
        this.disposables.push(disposable);
        return disposable;
      },
      executeCommand: async (command: string, ...args: any[]) => {
        const handler = commands.get(command);
        if (handler) {
          return handler(...args);
        }
        throw new Error(`Command not found: ${command}`);
      },
      getCommands: async () => Array.from(commands.keys()),
    };
  }

  private createLanguagesAPI(): any {
    return {
      registerCompletionItemProvider: (selector: any, provider: any, ...triggerCharacters: string[]) => {
        // Register with LSP client
        return { dispose: () => {} };
      },
      registerHoverProvider: (selector: any, provider: any) => {
        return { dispose: () => {} };
      },
      registerDefinitionProvider: (selector: any, provider: any) => {
        return { dispose: () => {} };
      },
      // ... more language methods
    };
  }

  private createExtensionsAPI(): any {
    return {
      getExtension: (extensionId: string) => null,
      all: [],
    };
  }

  private createEnvAPI(): any {
    return {
      appName: 'Cloud IDE',
      appRoot: '/app',
      language: 'en',
      machineId: 'cloud-sandbox',
      sessionId: Date.now().toString(),
      uriScheme: 'vscode',
      clipboard: {
        readText: async () => '',
        writeText: async (text: string) => {},
      },
    };
  }

  private createUriAPI(): any {
    return {
      file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
      parse: (value: string) => new URL(value),
    };
  }

  private createRangeClass(): any {
    return class Range {
      constructor(
        public startLine: number,
        public startCharacter: number,
        public endLine: number,
        public endCharacter: number
      ) {}
    };
  }

  private createPositionClass(): any {
    return class Position {
      constructor(public line: number, public character: number) {}
    };
  }

  private createSelectionClass(): any {
    return class Selection {
      constructor(
        public anchor: any,
        public active: any
      ) {}
    };
  }

  private createTextEditClass(): any {
    return class TextEdit {
      constructor(public range: any, public newText: string) {}
      static replace(range: any, newText: string) {
        return new TextEdit(range, newText);
      }
    };
  }

  private createWorkspaceEditClass(): any {
    return class WorkspaceEdit {
      private edits: Map<string, any[]> = new Map();
      
      replace(uri: any, range: any, newText: string) {
        const key = uri.fsPath || uri.toString();
        if (!this.edits.has(key)) {
          this.edits.set(key, []);
        }
        this.edits.get(key)!.push({ range, newText });
      }
    };
  }

  private createDiagnosticClass(): any {
    return class Diagnostic {
      constructor(
        public range: any,
        public message: string,
        public severity?: number
      ) {}
    };
  }

  private createDiagnosticSeverityEnum(): any {
    return {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    };
  }

  private createCompletionItemClass(): any {
    return class CompletionItem {
      constructor(public label: string, public kind?: number) {}
    };
  }

  private createCompletionItemKindEnum(): any {
    return {
      Text: 0,
      Method: 1,
      Function: 2,
      Constructor: 3,
      Field: 4,
      Variable: 5,
      Class: 6,
      Interface: 7,
      Module: 8,
      Property: 9,
      Unit: 10,
      Value: 11,
      Enum: 12,
      Keyword: 13,
      Snippet: 14,
      Color: 15,
      File: 16,
      Reference: 17,
      Folder: 18,
      EnumMember: 19,
      Constant: 20,
      Struct: 21,
      Event: 22,
      Operator: 23,
      TypeParameter: 24,
    };
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}

export { ExtensionSandbox, SandboxConfig, ExtensionPermissions, ResourceLimits };
```

---

## Extension Marketplace

### Marketplace Integration

```typescript
// src/extensions/marketplace/marketplaceClient.ts

interface MarketplaceExtension {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  version: string;
  description: string;
  categories: string[];
  tags: string[];
  installCount: number;
  rating: number;
  ratingCount: number;
  lastUpdated: string;
  icon?: string;
  repository?: string;
  license?: string;
}

interface SearchOptions {
  query: string;
  category?: string;
  sortBy?: 'relevance' | 'installs' | 'rating' | 'updated';
  pageSize?: number;
  page?: number;
}

interface SearchResult {
  extensions: MarketplaceExtension[];
  totalCount: number;
  page: number;
  pageSize: number;
}

class MarketplaceClient {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 300000; // 5 minutes

  constructor(baseUrl: string = 'https://marketplace.visualstudio.com') {
    this.baseUrl = baseUrl;
  }

  // Search extensions
  async search(options: SearchOptions): Promise<SearchResult> {
    const cacheKey = JSON.stringify(options);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${this.baseUrl}/_apis/public/gallery/extensionquery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json;api-version=6.1-preview.1',
      },
      body: JSON.stringify({
        filters: [{
          criteria: [
            { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
            { filterType: 10, value: options.query },
            ...(options.category ? [{ filterType: 5, value: options.category }] : []),
          ],
          pageNumber: options.page || 1,
          pageSize: options.pageSize || 50,
          sortBy: this.getSortBy(options.sortBy),
          sortOrder: 0,
        }],
        assetTypes: [],
        flags: 914,
      }),
    });

    const data = await response.json();
    const result = this.parseSearchResult(data, options);
    
    this.setCache(cacheKey, result);
    return result;
  }

  // Get extension details
  async getExtension(publisherName: string, extensionName: string): Promise<MarketplaceExtension | null> {
    const cacheKey = `${publisherName}.${extensionName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(
      `${this.baseUrl}/_apis/public/gallery/publishers/${publisherName}/extensions/${extensionName}`,
      {
        headers: {
          'Accept': 'application/json;api-version=6.1-preview.1',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const extension = this.parseExtension(data);
    
    this.setCache(cacheKey, extension);
    return extension;
  }

  // Download extension VSIX
  async downloadExtension(
    publisherName: string,
    extensionName: string,
    version: string
  ): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/_apis/public/gallery/publishers/${publisherName}/vsextensions/${extensionName}/${version}/vspackage`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download extension: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  // Get recommended extensions
  async getRecommended(category?: string): Promise<MarketplaceExtension[]> {
    const recommendations: Record<string, string[]> = {
      'web': [
        'esbenp.prettier-vscode',
        'dbaeumer.vscode-eslint',
        'bradlc.vscode-tailwindcss',
        'formulahendry.auto-rename-tag',
      ],
      'python': [
        'ms-python.python',
        'ms-python.vscode-pylance',
        'ms-python.black-formatter',
        'ms-python.isort',
      ],
      'go': [
        'golang.go',
      ],
      'rust': [
        'rust-lang.rust-analyzer',
        'serayuzgur.crates',
      ],
      'general': [
        'eamodio.gitlens',
        'usernamehw.errorlens',
        'christian-kohler.path-intellisense',
        'streetsidesoftware.code-spell-checker',
      ],
    };

    const ids = category 
      ? recommendations[category] || recommendations['general']
      : Object.values(recommendations).flat();

    const extensions: MarketplaceExtension[] = [];
    
    for (const id of ids) {
      const [publisher, name] = id.split('.');
      const ext = await this.getExtension(publisher, name);
      if (ext) extensions.push(ext);
    }

    return extensions;
  }

  private getSortBy(sortBy?: string): number {
    switch (sortBy) {
      case 'installs': return 4;
      case 'rating': return 12;
      case 'updated': return 1;
      default: return 0; // relevance
    }
  }

  private parseSearchResult(data: any, options: SearchOptions): SearchResult {
    const results = data.results?.[0];
    const extensions = results?.extensions?.map((ext: any) => this.parseExtension(ext)) || [];
    
    return {
      extensions,
      totalCount: results?.resultMetadata?.[0]?.metadataItems?.[0]?.count || 0,
      page: options.page || 1,
      pageSize: options.pageSize || 50,
    };
  }

  private parseExtension(data: any): MarketplaceExtension {
    const version = data.versions?.[0];
    const stats = data.statistics || [];
    
    const getStat = (name: string) => 
      stats.find((s: any) => s.statisticName === name)?.value || 0;

    return {
      id: `${data.publisher.publisherName}.${data.extensionName}`,
      name: data.extensionName,
      displayName: data.displayName,
      publisher: data.publisher.publisherName,
      version: version?.version || '0.0.0',
      description: data.shortDescription || '',
      categories: data.categories || [],
      tags: data.tags || [],
      installCount: getStat('install'),
      rating: getStat('averagerating'),
      ratingCount: getStat('ratingcount'),
      lastUpdated: version?.lastUpdated || '',
      icon: this.getAssetUrl(version, 'Microsoft.VisualStudio.Services.Icons.Default'),
      repository: this.getPropertyValue(version, 'Microsoft.VisualStudio.Services.Links.Source'),
      license: this.getPropertyValue(version, 'Microsoft.VisualStudio.Services.Links.License'),
    };
  }

  private getAssetUrl(version: any, assetType: string): string | undefined {
    const asset = version?.files?.find((f: any) => f.assetType === assetType);
    return asset?.source;
  }

  private getPropertyValue(version: any, key: string): string | undefined {
    const prop = version?.properties?.find((p: any) => p.key === key);
    return prop?.value;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

export { MarketplaceClient, MarketplaceExtension, SearchOptions, SearchResult };
```

### Extension Installation Manager

```typescript
// src/extensions/marketplace/installationManager.ts

import * as path from 'path';
import * as fs from 'fs/promises';
import { extract } from 'unzipper';

interface InstalledExtension {
  id: string;
  version: string;
  path: string;
  enabled: boolean;
  installedAt: string;
}

interface InstallOptions {
  version?: string;
  preRelease?: boolean;
}

class ExtensionInstallationManager {
  private extensionsDir: string;
  private installedExtensions: Map<string, InstalledExtension> = new Map();
  private marketplaceClient: MarketplaceClient;

  constructor(extensionsDir: string, marketplaceClient: MarketplaceClient) {
    this.extensionsDir = extensionsDir;
    this.marketplaceClient = marketplaceClient;
  }

  // Initialize - load installed extensions
  async initialize(): Promise<void> {
    await fs.mkdir(this.extensionsDir, { recursive: true });
    
    const entries = await fs.readdir(this.extensionsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(this.extensionsDir, entry.name, 'package.json');
        try {
          const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
          const id = `${manifest.publisher}.${manifest.name}`;
          
          this.installedExtensions.set(id, {
            id,
            version: manifest.version,
            path: path.join(this.extensionsDir, entry.name),
            enabled: true,
            installedAt: entry.name,
          });
        } catch (e) {
          // Invalid extension directory
        }
      }
    }
  }

  // Install extension
  async install(extensionId: string, options: InstallOptions = {}): Promise<InstalledExtension> {
    const [publisher, name] = extensionId.split('.');
    
    // Get extension info
    const extension = await this.marketplaceClient.getExtension(publisher, name);
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    const version = options.version || extension.version;

    // Check if already installed
    const existing = this.installedExtensions.get(extensionId);
    if (existing && existing.version === version) {
      return existing;
    }

    // Download VSIX
    const vsixData = await this.marketplaceClient.downloadExtension(publisher, name, version);

    // Extract to extensions directory
    const extensionDir = path.join(this.extensionsDir, `${publisher}.${name}-${version}`);
    await this.extractVsix(vsixData, extensionDir);

    // Register installed extension
    const installed: InstalledExtension = {
      id: extensionId,
      version,
      path: extensionDir,
      enabled: true,
      installedAt: new Date().toISOString(),
    };

    this.installedExtensions.set(extensionId, installed);

    // Save installation state
    await this.saveState();

    return installed;
  }

  // Uninstall extension
  async uninstall(extensionId: string): Promise<void> {
    const installed = this.installedExtensions.get(extensionId);
    if (!installed) {
      throw new Error(`Extension not installed: ${extensionId}`);
    }

    // Remove directory
    await fs.rm(installed.path, { recursive: true, force: true });

    // Remove from registry
    this.installedExtensions.delete(extensionId);

    // Save state
    await this.saveState();
  }

  // Update extension
  async update(extensionId: string): Promise<InstalledExtension> {
    const installed = this.installedExtensions.get(extensionId);
    if (!installed) {
      throw new Error(`Extension not installed: ${extensionId}`);
    }

    const [publisher, name] = extensionId.split('.');
    const extension = await this.marketplaceClient.getExtension(publisher, name);
    
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    if (extension.version === installed.version) {
      return installed; // Already up to date
    }

    // Uninstall old version
    await this.uninstall(extensionId);

    // Install new version
    return this.install(extensionId, { version: extension.version });
  }

  // Enable/disable extension
  async setEnabled(extensionId: string, enabled: boolean): Promise<void> {
    const installed = this.installedExtensions.get(extensionId);
    if (!installed) {
      throw new Error(`Extension not installed: ${extensionId}`);
    }

    installed.enabled = enabled;
    await this.saveState();
  }

  // Get installed extensions
  getInstalled(): InstalledExtension[] {
    return Array.from(this.installedExtensions.values());
  }

  // Check if extension is installed
  isInstalled(extensionId: string): boolean {
    return this.installedExtensions.has(extensionId);
  }

  // Get extension
  getExtension(extensionId: string): InstalledExtension | undefined {
    return this.installedExtensions.get(extensionId);
  }

  private async extractVsix(data: ArrayBuffer, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });

    // VSIX is a ZIP file
    const buffer = Buffer.from(data);
    
    // Use streaming extraction
    const Readable = require('stream').Readable;
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(extract({ path: targetDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    // Move extension folder contents to root
    const extensionFolder = path.join(targetDir, 'extension');
    try {
      const files = await fs.readdir(extensionFolder);
      for (const file of files) {
        await fs.rename(
          path.join(extensionFolder, file),
          path.join(targetDir, file)
        );
      }
      await fs.rmdir(extensionFolder);
    } catch (e) {
      // Extension folder might not exist in some VSIX structures
    }
  }

  private async saveState(): Promise<void> {
    const state = Array.from(this.installedExtensions.entries());
    const statePath = path.join(this.extensionsDir, '.installed.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }
}

export { ExtensionInstallationManager, InstalledExtension, InstallOptions };
```

---

## Performance Considerations

### Extension Performance Monitoring

```typescript
// src/extensions/performance/performanceMonitor.ts

interface ExtensionMetrics {
  extensionId: string;
  activationTime: number;
  memoryUsage: number;
  cpuTime: number;
  apiCalls: number;
  errors: number;
}

interface PerformanceThresholds {
  maxActivationTime: number;  // ms
  maxMemoryUsage: number;     // MB
  maxCpuPercent: number;
  maxApiCallsPerSecond: number;
}

class ExtensionPerformanceMonitor {
  private metrics: Map<string, ExtensionMetrics> = new Map();
  private thresholds: PerformanceThresholds;
  private apiCallCounts: Map<string, number[]> = new Map();

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = {
      maxActivationTime: 5000,
      maxMemoryUsage: 100,
      maxCpuPercent: 10,
      maxApiCallsPerSecond: 100,
      ...thresholds,
    };
  }

  // Record activation time
  recordActivation(extensionId: string, time: number): void {
    const metrics = this.getOrCreateMetrics(extensionId);
    metrics.activationTime = time;

    if (time > this.thresholds.maxActivationTime) {
      console.warn(`Extension ${extensionId} slow activation: ${time}ms`);
    }
  }

  // Record API call
  recordApiCall(extensionId: string): void {
    const metrics = this.getOrCreateMetrics(extensionId);
    metrics.apiCalls++;

    // Track calls per second
    const now = Date.now();
    let calls = this.apiCallCounts.get(extensionId) || [];
    calls.push(now);
    
    // Keep only last second
    calls = calls.filter(t => now - t < 1000);
    this.apiCallCounts.set(extensionId, calls);

    if (calls.length > this.thresholds.maxApiCallsPerSecond) {
      console.warn(`Extension ${extensionId} exceeding API rate limit`);
    }
  }

  // Record error
  recordError(extensionId: string, error: Error): void {
    const metrics = this.getOrCreateMetrics(extensionId);
    metrics.errors++;
    console.error(`Extension ${extensionId} error:`, error);
  }

  // Update memory usage
  updateMemoryUsage(extensionId: string, memoryMB: number): void {
    const metrics = this.getOrCreateMetrics(extensionId);
    metrics.memoryUsage = memoryMB;

    if (memoryMB > this.thresholds.maxMemoryUsage) {
      console.warn(`Extension ${extensionId} high memory: ${memoryMB}MB`);
    }
  }

  // Get metrics for extension
  getMetrics(extensionId: string): ExtensionMetrics | undefined {
    return this.metrics.get(extensionId);
  }

  // Get all metrics
  getAllMetrics(): ExtensionMetrics[] {
    return Array.from(this.metrics.values());
  }

  // Get slow extensions
  getSlowExtensions(): ExtensionMetrics[] {
    return this.getAllMetrics().filter(
      m => m.activationTime > this.thresholds.maxActivationTime
    );
  }

  // Get high memory extensions
  getHighMemoryExtensions(): ExtensionMetrics[] {
    return this.getAllMetrics().filter(
      m => m.memoryUsage > this.thresholds.maxMemoryUsage
    );
  }

  private getOrCreateMetrics(extensionId: string): ExtensionMetrics {
    let metrics = this.metrics.get(extensionId);
    if (!metrics) {
      metrics = {
        extensionId,
        activationTime: 0,
        memoryUsage: 0,
        cpuTime: 0,
        apiCalls: 0,
        errors: 0,
      };
      this.metrics.set(extensionId, metrics);
    }
    return metrics;
  }
}

export { ExtensionPerformanceMonitor, ExtensionMetrics, PerformanceThresholds };
```

---

## Best Practices

### Extension Development Guidelines

```typescript
// Best practices for extension compatibility

// 1. Support virtual workspaces
{
  "capabilities": {
    "virtualWorkspaces": true
  }
}

// 2. Support untrusted workspaces
{
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "restrictedConfigurations": ["myExtension.executablePath"]
    }
  }
}

// 3. Use web extension entry point
{
  "main": "./dist/extension.js",
  "browser": "./dist/web/extension.js"
}

// 4. Avoid synchronous file operations
// Bad
const content = fs.readFileSync(path);

// Good
const content = await fs.promises.readFile(path);

// 5. Use disposables properly
class MyExtension {
  private disposables: vscode.Disposable[] = [];

  activate(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('myCommand', () => {});
    this.disposables.push(command);
    context.subscriptions.push(...this.disposables);
  }

  deactivate() {
    this.disposables.forEach(d => d.dispose());
  }
}

// 6. Lazy activation
{
  "activationEvents": [
    "onCommand:myExtension.start",
    "onLanguage:javascript"
  ]
}
// Avoid: "activationEvents": ["*"]

// 7. Bundle dependencies
// Use webpack/esbuild to bundle all dependencies
// Avoid requiring external native modules
```

---

## Summary

### Extension Support Matrix

| Feature | Web Extension | Workspace Extension |
|---------|--------------|---------------------|
| File System | Limited | Full (scoped) |
| Network | Fetch API | Full (monitored) |
| Process Spawn | No | Restricted |
| Native Modules | No | No |
| UI Components | Full | Full |
| Language Features | Full | Full |

### Security Model

| Layer | Protection |
|-------|------------|
| **Sandbox** | Isolated VM context |
| **API Proxy** | Permission checks |
| **File System** | Workspace scoping |
| **Network** | Request logging |
| **Process** | Command whitelist |

### Performance Guidelines

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Activation | <1s | >3s | >5s |
| Memory | <50MB | >100MB | >200MB |
| API calls/sec | <50 | >100 | >200 |
