# Language Server Protocol (LSP) Support

This guide provides comprehensive coverage of Language Server Protocol implementation in cloud development environments, including supported languages, language server management, resource allocation, and integration with code editors.

---

## Table of Contents

1. [Overview](#overview)
2. [LSP Architecture](#lsp-architecture)
3. [Supported Languages](#supported-languages)
4. [Language Server Management](#language-server-management)
5. [Resource Allocation](#resource-allocation)
6. [Monaco LSP Integration](#monaco-lsp-integration)
7. [Language Server Implementations](#language-server-implementations)
8. [Communication Protocol](#communication-protocol)
9. [Performance Optimization](#performance-optimization)
10. [Multi-Root Workspace Support](#multi-root-workspace-support)
11. [Custom Language Servers](#custom-language-servers)
12. [Monitoring and Diagnostics](#monitoring-and-diagnostics)
13. [Best Practices](#best-practices)

---

## Overview

The Language Server Protocol (LSP) defines a standard protocol for communication between code editors and language servers, enabling rich language features like autocomplete, go-to-definition, and diagnostics across different editors.

### Why LSP?

| Without LSP | With LSP |
|-------------|----------|
| N editors × M languages = N×M implementations | N editors + M servers = N+M implementations |
| Inconsistent features across editors | Consistent features everywhere |
| Duplicated effort | Shared language intelligence |
| Editor-specific plugins | Universal language servers |

### LSP Capabilities

| Category | Features |
|----------|----------|
| **Completion** | IntelliSense, snippets, auto-import |
| **Navigation** | Go to definition, find references, peek |
| **Diagnostics** | Errors, warnings, hints, linting |
| **Refactoring** | Rename, extract, code actions |
| **Formatting** | Document format, range format |
| **Hover** | Type information, documentation |
| **Symbols** | Document symbols, workspace symbols |
| **Folding** | Code folding ranges |
| **Semantic** | Semantic tokens, highlighting |

---

## LSP Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              LSP ARCHITECTURE                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CLIENT (Browser)                                    │   │
│  │                                                                                   │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐              │   │
│  │  │  Monaco Editor  │    │   LSP Client    │    │  WebSocket      │              │   │
│  │  │                 │◄──►│   Adapter       │◄──►│  Connection     │              │   │
│  │  │  - Text Model   │    │                 │    │                 │              │   │
│  │  │  - Decorations  │    │  - Request/     │    │  - JSON-RPC     │              │   │
│  │  │  - Completions  │    │    Response     │    │  - Multiplexing │              │   │
│  │  │  - Diagnostics  │    │  - Notifications│    │  - Reconnection │              │   │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘              │   │
│  │                                                         │                        │   │
│  └─────────────────────────────────────────────────────────┼────────────────────────┘   │
│                                                            │                            │
│                                                            │ WebSocket                  │
│                                                            │                            │
│  ┌─────────────────────────────────────────────────────────┼────────────────────────┐   │
│  │                              SERVER (Sandbox)           │                        │   │
│  │                                                         ▼                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                        LSP Proxy / Router                                │    │   │
│  │  │                                                                          │    │   │
│  │  │  - Language detection                                                    │    │   │
│  │  │  - Server lifecycle management                                           │    │   │
│  │  │  - Request routing                                                       │    │   │
│  │  │  - Response caching                                                      │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │           │                    │                    │                    │       │   │
│  │           ▼                    ▼                    ▼                    ▼       │   │
│  │  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐ │   │
│  │  │ TypeScript  │      │   Python    │      │     Go      │      │    Rust     │ │   │
│  │  │   Server    │      │   Server    │      │   Server    │      │   Server    │ │   │
│  │  │  (tsserver) │      │  (Pylance/  │      │  (gopls)    │      │ (rust-      │ │   │
│  │  │             │      │   Pyright)  │      │             │      │  analyzer)  │ │   │
│  │  └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘ │   │
│  │           │                    │                    │                    │       │   │
│  │           └────────────────────┴────────────────────┴────────────────────┘       │   │
│  │                                         │                                        │   │
│  │                                         ▼                                        │   │
│  │                              ┌─────────────────────┐                             │   │
│  │                              │    File System      │                             │   │
│  │                              │    (Project Files)  │                             │   │
│  │                              └─────────────────────┘                             │   │
│  │                                                                                   │   │
│  └───────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Communication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           LSP REQUEST/RESPONSE FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CLIENT                          PROXY                         LANGUAGE SERVER          │
│    │                               │                                │                   │
│    │  1. textDocument/completion   │                                │                   │
│    │ ─────────────────────────────►│                                │                   │
│    │                               │  2. Route to TypeScript        │                   │
│    │                               │ ──────────────────────────────►│                   │
│    │                               │                                │                   │
│    │                               │  3. Completion items           │                   │
│    │                               │ ◄──────────────────────────────│                   │
│    │  4. Completion response       │                                │                   │
│    │ ◄─────────────────────────────│                                │                   │
│    │                               │                                │                   │
│    │  5. textDocument/didChange    │                                │                   │
│    │ ─────────────────────────────►│                                │                   │
│    │                               │  6. Forward notification       │                   │
│    │                               │ ──────────────────────────────►│                   │
│    │                               │                                │                   │
│    │                               │  7. publishDiagnostics         │                   │
│    │                               │ ◄──────────────────────────────│                   │
│    │  8. Diagnostics notification  │                                │                   │
│    │ ◄─────────────────────────────│                                │                   │
│    │                               │                                │                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Supported Languages

### Language Server Matrix

| Language | Server | Features | Memory | Startup |
|----------|--------|----------|--------|---------|
| **TypeScript/JavaScript** | tsserver | Full | 200-500MB | 2-5s |
| **Python** | Pylance/Pyright | Full | 150-400MB | 1-3s |
| **Go** | gopls | Full | 100-300MB | 1-2s |
| **Rust** | rust-analyzer | Full | 300-800MB | 3-10s |
| **Java** | Eclipse JDT | Full | 500MB-1GB | 5-15s |
| **C/C++** | clangd | Full | 200-500MB | 2-5s |
| **C#** | OmniSharp | Full | 300-600MB | 3-8s |
| **PHP** | Intelephense | Full | 100-200MB | 1-2s |
| **Ruby** | Solargraph | Good | 100-200MB | 1-3s |
| **HTML/CSS** | vscode-html/css | Good | 50-100MB | <1s |
| **JSON** | vscode-json | Good | 30-50MB | <1s |
| **YAML** | yaml-language-server | Good | 50-100MB | <1s |
| **Markdown** | marksman | Basic | 30-50MB | <1s |
| **SQL** | sql-language-server | Basic | 50-100MB | <1s |
| **GraphQL** | graphql-language-service | Good | 50-100MB | <1s |
| **Dockerfile** | dockerfile-language-server | Basic | 30-50MB | <1s |
| **Terraform** | terraform-ls | Good | 100-200MB | 1-2s |
| **Kotlin** | kotlin-language-server | Good | 300-500MB | 3-8s |
| **Swift** | sourcekit-lsp | Good | 200-400MB | 2-5s |
| **Scala** | Metals | Full | 500MB-1GB | 5-15s |
| **Elixir** | elixir-ls | Good | 200-400MB | 2-5s |
| **Lua** | lua-language-server | Good | 50-100MB | <1s |
| **Zig** | zls | Good | 100-200MB | 1-2s |

### Feature Support by Language

| Feature | TS/JS | Python | Go | Rust | Java | C++ |
|---------|-------|--------|----|----- |------|-----|
| **Completion** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Hover** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Signature Help** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Go to Definition** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Find References** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Document Symbols** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Workspace Symbols** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Rename** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Formatting** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Code Actions** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Code Lens** | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| **Folding** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Semantic Tokens** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inlay Hints** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Call Hierarchy** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Type Hierarchy** | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |

---

## Language Server Management

### Server Lifecycle Manager

```typescript
// src/lsp/serverManager.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface ServerConfig {
  language: string;
  command: string;
  args: string[];
  rootPath: string;
  env?: Record<string, string>;
  initializationOptions?: any;
}

interface ServerInstance {
  process: ChildProcess;
  config: ServerConfig;
  status: 'starting' | 'ready' | 'error' | 'stopped';
  startedAt: Date;
  lastActivity: Date;
  requestCount: number;
  memoryUsage: number;
}

class LanguageServerManager extends EventEmitter {
  private servers: Map<string, ServerInstance> = new Map();
  private serverConfigs: Map<string, Omit<ServerConfig, 'rootPath'>> = new Map();
  private maxServers: number = 5;
  private idleTimeout: number = 300000; // 5 minutes

  constructor() {
    super();
    this.initializeConfigs();
    this.startIdleChecker();
  }

  private initializeConfigs(): void {
    // TypeScript/JavaScript
    this.serverConfigs.set('typescript', {
      language: 'typescript',
      command: 'typescript-language-server',
      args: ['--stdio'],
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
        },
      },
    });

    // Python
    this.serverConfigs.set('python', {
      language: 'python',
      command: 'pyright-langserver',
      args: ['--stdio'],
      initializationOptions: {
        python: {
          analysis: {
            autoSearchPaths: true,
            useLibraryCodeForTypes: true,
            diagnosticMode: 'workspace',
          },
        },
      },
    });

    // Go
    this.serverConfigs.set('go', {
      language: 'go',
      command: 'gopls',
      args: ['serve'],
      env: {
        GOPATH: '/home/ubuntu/go',
        GOMODCACHE: '/home/ubuntu/go/pkg/mod',
      },
      initializationOptions: {
        usePlaceholders: true,
        completionDocumentation: true,
        deepCompletion: true,
      },
    });

    // Rust
    this.serverConfigs.set('rust', {
      language: 'rust',
      command: 'rust-analyzer',
      args: [],
      initializationOptions: {
        cargo: {
          loadOutDirsFromCheck: true,
        },
        procMacro: {
          enable: true,
        },
        checkOnSave: {
          command: 'clippy',
        },
      },
    });

    // C/C++
    this.serverConfigs.set('cpp', {
      language: 'cpp',
      command: 'clangd',
      args: [
        '--background-index',
        '--clang-tidy',
        '--completion-style=detailed',
        '--header-insertion=iwyu',
      ],
    });

    // Java
    this.serverConfigs.set('java', {
      language: 'java',
      command: 'jdtls',
      args: [
        '-configuration', '/home/ubuntu/.jdtls/config',
        '-data', '/home/ubuntu/.jdtls/workspace',
      ],
    });

    // PHP
    this.serverConfigs.set('php', {
      language: 'php',
      command: 'intelephense',
      args: ['--stdio'],
    });

    // Ruby
    this.serverConfigs.set('ruby', {
      language: 'ruby',
      command: 'solargraph',
      args: ['stdio'],
    });
  }

  // Start language server for a project
  async startServer(language: string, rootPath: string): Promise<ServerInstance> {
    const serverId = `${language}:${rootPath}`;
    
    // Check if already running
    const existing = this.servers.get(serverId);
    if (existing && existing.status === 'ready') {
      existing.lastActivity = new Date();
      return existing;
    }

    // Check server limit
    if (this.servers.size >= this.maxServers) {
      await this.stopLeastRecentlyUsed();
    }

    // Get config
    const baseConfig = this.serverConfigs.get(language);
    if (!baseConfig) {
      throw new Error(`No server configuration for language: ${language}`);
    }

    const config: ServerConfig = {
      ...baseConfig,
      rootPath,
    };

    // Spawn server process
    const process = spawn(config.command, config.args, {
      cwd: rootPath,
      env: {
        ...process.env,
        ...config.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const instance: ServerInstance = {
      process,
      config,
      status: 'starting',
      startedAt: new Date(),
      lastActivity: new Date(),
      requestCount: 0,
      memoryUsage: 0,
    };

    this.servers.set(serverId, instance);

    // Handle process events
    process.on('error', (error) => {
      instance.status = 'error';
      this.emit('serverError', { serverId, error });
    });

    process.on('exit', (code) => {
      instance.status = 'stopped';
      this.emit('serverStopped', { serverId, code });
      this.servers.delete(serverId);
    });

    // Wait for initialization
    await this.waitForReady(instance);
    
    instance.status = 'ready';
    this.emit('serverReady', { serverId, language, rootPath });

    return instance;
  }

  // Stop a specific server
  async stopServer(language: string, rootPath: string): Promise<void> {
    const serverId = `${language}:${rootPath}`;
    const instance = this.servers.get(serverId);
    
    if (!instance) return;

    // Send shutdown request
    this.sendRequest(instance, 'shutdown', null);
    
    // Send exit notification
    this.sendNotification(instance, 'exit', null);

    // Force kill after timeout
    setTimeout(() => {
      if (instance.process.exitCode === null) {
        instance.process.kill('SIGKILL');
      }
    }, 5000);

    this.servers.delete(serverId);
  }

  // Get server for a file
  getServerForFile(filePath: string, language: string): ServerInstance | null {
    // Find server with matching root path
    for (const [id, instance] of this.servers) {
      if (id.startsWith(`${language}:`) && filePath.startsWith(instance.config.rootPath)) {
        instance.lastActivity = new Date();
        return instance;
      }
    }
    return null;
  }

  // Send request to server
  async sendRequest(instance: ServerInstance, method: string, params: any): Promise<any> {
    instance.requestCount++;
    instance.lastActivity = new Date();

    return new Promise((resolve, reject) => {
      const id = Date.now();
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const content = JSON.stringify(message);
      const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;

      instance.process.stdin?.write(header + content);

      // Handle response
      const handler = (data: Buffer) => {
        try {
          const response = this.parseResponse(data);
          if (response.id === id) {
            instance.process.stdout?.off('data', handler);
            if (response.error) {
              reject(response.error);
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {
          // Continue waiting for valid response
        }
      };

      instance.process.stdout?.on('data', handler);

      // Timeout
      setTimeout(() => {
        instance.process.stdout?.off('data', handler);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  // Send notification to server
  sendNotification(instance: ServerInstance, method: string, params: any): void {
    instance.lastActivity = new Date();

    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;

    instance.process.stdin?.write(header + content);
  }

  private async waitForReady(instance: ServerInstance): Promise<void> {
    // Send initialize request
    const result = await this.sendRequest(instance, 'initialize', {
      processId: process.pid,
      rootPath: instance.config.rootPath,
      rootUri: `file://${instance.config.rootPath}`,
      capabilities: this.getClientCapabilities(),
      initializationOptions: instance.config.initializationOptions,
    });

    // Send initialized notification
    this.sendNotification(instance, 'initialized', {});

    return result;
  }

  private getClientCapabilities(): any {
    return {
      textDocument: {
        synchronization: {
          dynamicRegistration: true,
          willSave: true,
          willSaveWaitUntil: true,
          didSave: true,
        },
        completion: {
          dynamicRegistration: true,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown', 'plaintext'],
            deprecatedSupport: true,
            preselectSupport: true,
            insertReplaceSupport: true,
            resolveSupport: {
              properties: ['documentation', 'detail', 'additionalTextEdits'],
            },
          },
          contextSupport: true,
        },
        hover: {
          dynamicRegistration: true,
          contentFormat: ['markdown', 'plaintext'],
        },
        signatureHelp: {
          dynamicRegistration: true,
          signatureInformation: {
            documentationFormat: ['markdown', 'plaintext'],
            parameterInformation: {
              labelOffsetSupport: true,
            },
          },
          contextSupport: true,
        },
        definition: { dynamicRegistration: true, linkSupport: true },
        references: { dynamicRegistration: true },
        documentHighlight: { dynamicRegistration: true },
        documentSymbol: {
          dynamicRegistration: true,
          hierarchicalDocumentSymbolSupport: true,
        },
        codeAction: {
          dynamicRegistration: true,
          codeActionLiteralSupport: {
            codeActionKind: {
              valueSet: [
                'quickfix',
                'refactor',
                'refactor.extract',
                'refactor.inline',
                'refactor.rewrite',
                'source',
                'source.organizeImports',
              ],
            },
          },
          resolveSupport: { properties: ['edit'] },
        },
        codeLens: { dynamicRegistration: true },
        formatting: { dynamicRegistration: true },
        rangeFormatting: { dynamicRegistration: true },
        rename: { dynamicRegistration: true, prepareSupport: true },
        publishDiagnostics: {
          relatedInformation: true,
          tagSupport: { valueSet: [1, 2] },
          versionSupport: true,
        },
        foldingRange: {
          dynamicRegistration: true,
          rangeLimit: 5000,
          lineFoldingOnly: true,
        },
        semanticTokens: {
          dynamicRegistration: true,
          requests: { range: true, full: { delta: true } },
          tokenTypes: [
            'namespace', 'type', 'class', 'enum', 'interface',
            'struct', 'typeParameter', 'parameter', 'variable',
            'property', 'enumMember', 'event', 'function', 'method',
            'macro', 'keyword', 'modifier', 'comment', 'string',
            'number', 'regexp', 'operator',
          ],
          tokenModifiers: [
            'declaration', 'definition', 'readonly', 'static',
            'deprecated', 'abstract', 'async', 'modification',
            'documentation', 'defaultLibrary',
          ],
          formats: ['relative'],
          overlappingTokenSupport: false,
          multilineTokenSupport: false,
        },
        inlayHint: {
          dynamicRegistration: true,
          resolveSupport: { properties: ['tooltip', 'textEdits', 'label.tooltip', 'label.location', 'label.command'] },
        },
      },
      workspace: {
        applyEdit: true,
        workspaceEdit: {
          documentChanges: true,
          resourceOperations: ['create', 'rename', 'delete'],
        },
        didChangeConfiguration: { dynamicRegistration: true },
        didChangeWatchedFiles: { dynamicRegistration: true },
        symbol: { dynamicRegistration: true },
        executeCommand: { dynamicRegistration: true },
        workspaceFolders: true,
        configuration: true,
      },
    };
  }

  private parseResponse(data: Buffer): any {
    const content = data.toString();
    const bodyStart = content.indexOf('\r\n\r\n');
    if (bodyStart === -1) throw new Error('Invalid response');
    
    const body = content.slice(bodyStart + 4);
    return JSON.parse(body);
  }

  private async stopLeastRecentlyUsed(): Promise<void> {
    let oldest: { id: string; instance: ServerInstance } | null = null;

    for (const [id, instance] of this.servers) {
      if (!oldest || instance.lastActivity < oldest.instance.lastActivity) {
        oldest = { id, instance };
      }
    }

    if (oldest) {
      const [language, rootPath] = oldest.id.split(':');
      await this.stopServer(language, rootPath);
    }
  }

  private startIdleChecker(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [id, instance] of this.servers) {
        if (now - instance.lastActivity.getTime() > this.idleTimeout) {
          const [language, rootPath] = id.split(':');
          this.stopServer(language, rootPath);
        }
      }
    }, 60000); // Check every minute
  }

  // Get server statistics
  getStats(): {
    activeServers: number;
    totalRequests: number;
    serverDetails: Array<{
      language: string;
      rootPath: string;
      status: string;
      uptime: number;
      requests: number;
      memory: number;
    }>;
  } {
    const serverDetails = Array.from(this.servers.entries()).map(([id, instance]) => {
      const [language, rootPath] = id.split(':');
      return {
        language,
        rootPath,
        status: instance.status,
        uptime: Date.now() - instance.startedAt.getTime(),
        requests: instance.requestCount,
        memory: instance.memoryUsage,
      };
    });

    return {
      activeServers: this.servers.size,
      totalRequests: serverDetails.reduce((sum, s) => sum + s.requests, 0),
      serverDetails,
    };
  }
}

export const serverManager = new LanguageServerManager();
```

---

## Resource Allocation

### Resource Limits by Language

```typescript
// src/lsp/resourceLimits.ts

interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxFileWatchers: number;
  indexingTimeout: number;
  requestTimeout: number;
}

const resourceLimits: Record<string, ResourceLimits> = {
  typescript: {
    maxMemoryMB: 512,
    maxCpuPercent: 50,
    maxFileWatchers: 5000,
    indexingTimeout: 60000,
    requestTimeout: 10000,
  },
  python: {
    maxMemoryMB: 512,
    maxCpuPercent: 50,
    maxFileWatchers: 5000,
    indexingTimeout: 60000,
    requestTimeout: 10000,
  },
  go: {
    maxMemoryMB: 384,
    maxCpuPercent: 40,
    maxFileWatchers: 3000,
    indexingTimeout: 45000,
    requestTimeout: 10000,
  },
  rust: {
    maxMemoryMB: 1024,
    maxCpuPercent: 60,
    maxFileWatchers: 5000,
    indexingTimeout: 120000,
    requestTimeout: 15000,
  },
  java: {
    maxMemoryMB: 1024,
    maxCpuPercent: 60,
    maxFileWatchers: 5000,
    indexingTimeout: 180000,
    requestTimeout: 15000,
  },
  cpp: {
    maxMemoryMB: 512,
    maxCpuPercent: 50,
    maxFileWatchers: 5000,
    indexingTimeout: 120000,
    requestTimeout: 10000,
  },
  default: {
    maxMemoryMB: 256,
    maxCpuPercent: 30,
    maxFileWatchers: 2000,
    indexingTimeout: 30000,
    requestTimeout: 5000,
  },
};

export function getResourceLimits(language: string): ResourceLimits {
  return resourceLimits[language] || resourceLimits.default;
}
```

### Kubernetes Resource Configuration

```yaml
# k8s/lsp-server-resources.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: lsp-resource-limits
data:
  limits.yaml: |
    servers:
      typescript:
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
      python:
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
      rust:
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        
      java:
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        
      go:
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "384Mi"
            cpu: "400m"
        
      default:
        resources:
          requests:
            memory: "128Mi"
            cpu: "50m"
          limits:
            memory: "256Mi"
            cpu: "300m"
```

### Memory Monitoring

```typescript
// src/lsp/memoryMonitor.ts

import { ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface MemoryStats {
  rss: number;      // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
}

class LSPMemoryMonitor {
  private checkInterval: number = 30000; // 30 seconds
  private memoryThreshold: number = 0.9; // 90% of limit
  private intervalId?: NodeJS.Timeout;

  start(
    servers: Map<string, { process: ChildProcess; maxMemoryMB: number }>,
    onThresholdExceeded: (serverId: string, usage: number, limit: number) => void
  ): void {
    this.intervalId = setInterval(async () => {
      for (const [serverId, { process, maxMemoryMB }] of servers) {
        if (process.pid) {
          const memoryMB = await this.getProcessMemory(process.pid);
          
          if (memoryMB > maxMemoryMB * this.memoryThreshold) {
            onThresholdExceeded(serverId, memoryMB, maxMemoryMB);
          }
        }
      }
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async getProcessMemory(pid: number): Promise<number> {
    try {
      // Linux: read from /proc
      const { stdout } = await execAsync(`cat /proc/${pid}/status | grep VmRSS`);
      const match = stdout.match(/VmRSS:\s+(\d+)\s+kB/);
      if (match) {
        return parseInt(match[1]) / 1024; // Convert to MB
      }
    } catch (e) {
      // Fallback: use ps command
      try {
        const { stdout } = await execAsync(`ps -o rss= -p ${pid}`);
        return parseInt(stdout.trim()) / 1024; // Convert to MB
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  // Force garbage collection (if exposed)
  async requestGC(serverId: string, server: { process: ChildProcess }): Promise<void> {
    // Send custom notification to trigger GC
    // This depends on the language server supporting it
  }
}

export const memoryMonitor = new LSPMemoryMonitor();
```

---

## Monaco LSP Integration

### LSP Client for Monaco

```typescript
// src/lsp/monacoLspClient.ts

import * as monaco from 'monaco-editor';
import {
  MonacoLanguageClient,
  MessageTransports,
  CloseAction,
  ErrorAction,
} from 'monaco-languageclient';
import {
  toSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc';

interface LSPClientConfig {
  languageId: string;
  websocketUrl: string;
  documentSelector: string[];
}

class MonacoLSPClient {
  private clients: Map<string, MonacoLanguageClient> = new Map();
  private sockets: Map<string, WebSocket> = new Map();

  async connect(config: LSPClientConfig): Promise<MonacoLanguageClient> {
    const { languageId, websocketUrl, documentSelector } = config;

    // Create WebSocket connection
    const socket = new WebSocket(websocketUrl);
    this.sockets.set(languageId, socket);

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = (e) => reject(e);
    });

    // Create message transports
    const reader = new WebSocketMessageReader(toSocket(socket));
    const writer = new WebSocketMessageWriter(toSocket(socket));

    // Create language client
    const client = new MonacoLanguageClient({
      name: `${languageId} Language Client`,
      clientOptions: {
        documentSelector,
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.Restart }),
        },
        synchronize: {
          configurationSection: languageId,
        },
        middleware: {
          // Custom middleware for request/response handling
          provideCompletionItem: async (document, position, context, token, next) => {
            const result = await next(document, position, context, token);
            // Post-process completions if needed
            return result;
          },
        },
      },
      connectionProvider: {
        get: () => Promise.resolve({ reader, writer }),
      },
    });

    // Start the client
    await client.start();
    this.clients.set(languageId, client);

    return client;
  }

  disconnect(languageId: string): void {
    const client = this.clients.get(languageId);
    if (client) {
      client.stop();
      this.clients.delete(languageId);
    }

    const socket = this.sockets.get(languageId);
    if (socket) {
      socket.close();
      this.sockets.delete(languageId);
    }
  }

  getClient(languageId: string): MonacoLanguageClient | undefined {
    return this.clients.get(languageId);
  }
}

export const monacoLSPClient = new MonacoLSPClient();
```

### Register Monaco Language Features

```typescript
// src/lsp/monacoLanguageFeatures.ts

import * as monaco from 'monaco-editor';

interface LSPFeatureProvider {
  provideCompletionItems: monaco.languages.CompletionItemProvider['provideCompletionItems'];
  provideHover: monaco.languages.HoverProvider['provideHover'];
  provideSignatureHelp: monaco.languages.SignatureHelpProvider['provideSignatureHelp'];
  provideDefinition: monaco.languages.DefinitionProvider['provideDefinition'];
  provideReferences: monaco.languages.ReferenceProvider['provideReferences'];
  provideDocumentSymbols: monaco.languages.DocumentSymbolProvider['provideDocumentSymbols'];
  provideCodeActions: monaco.languages.CodeActionProvider['provideCodeActions'];
  provideDocumentFormattingEdits: monaco.languages.DocumentFormattingEditProvider['provideDocumentFormattingEdits'];
  provideRenameEdits: monaco.languages.RenameProvider['provideRenameEdits'];
}

export function registerLSPFeatures(
  languageId: string,
  sendRequest: (method: string, params: any) => Promise<any>
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  // Completion provider
  disposables.push(
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ':', '<', '"', "'", '/', '@', '#'],
      provideCompletionItems: async (model, position, context, token) => {
        const result = await sendRequest('textDocument/completion', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
          context: {
            triggerKind: context.triggerKind,
            triggerCharacter: context.triggerCharacter,
          },
        });

        if (!result) return { suggestions: [] };

        const items = Array.isArray(result) ? result : result.items;
        
        return {
          suggestions: items.map((item: any) => ({
            label: item.label,
            kind: convertCompletionItemKind(item.kind),
            detail: item.detail,
            documentation: item.documentation,
            insertText: item.insertText || item.label,
            insertTextRules: item.insertTextFormat === 2
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            range: item.textEdit?.range
              ? convertRange(item.textEdit.range)
              : undefined,
            sortText: item.sortText,
            filterText: item.filterText,
            preselect: item.preselect,
            command: item.command,
            additionalTextEdits: item.additionalTextEdits?.map(convertTextEdit),
          })),
          incomplete: result.isIncomplete || false,
        };
      },
      resolveCompletionItem: async (item, token) => {
        const result = await sendRequest('completionItem/resolve', item);
        return result ? { ...item, ...result } : item;
      },
    })
  );

  // Hover provider
  disposables.push(
    monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position, token) => {
        const result = await sendRequest('textDocument/hover', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
        });

        if (!result) return null;

        return {
          contents: Array.isArray(result.contents)
            ? result.contents.map(convertMarkupContent)
            : [convertMarkupContent(result.contents)],
          range: result.range ? convertRange(result.range) : undefined,
        };
      },
    })
  );

  // Signature help provider
  disposables.push(
    monaco.languages.registerSignatureHelpProvider(languageId, {
      signatureHelpTriggerCharacters: ['(', ','],
      signatureHelpRetriggerCharacters: [','],
      provideSignatureHelp: async (model, position, token, context) => {
        const result = await sendRequest('textDocument/signatureHelp', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
          context: {
            triggerKind: context.triggerKind,
            triggerCharacter: context.triggerCharacter,
            isRetrigger: context.isRetrigger,
          },
        });

        if (!result) return null;

        return {
          value: {
            signatures: result.signatures.map((sig: any) => ({
              label: sig.label,
              documentation: sig.documentation,
              parameters: sig.parameters?.map((param: any) => ({
                label: param.label,
                documentation: param.documentation,
              })),
            })),
            activeSignature: result.activeSignature || 0,
            activeParameter: result.activeParameter || 0,
          },
          dispose: () => {},
        };
      },
    })
  );

  // Definition provider
  disposables.push(
    monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: async (model, position, token) => {
        const result = await sendRequest('textDocument/definition', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
        });

        if (!result) return null;

        const locations = Array.isArray(result) ? result : [result];
        
        return locations.map((loc: any) => ({
          uri: monaco.Uri.parse(loc.uri || loc.targetUri),
          range: convertRange(loc.range || loc.targetRange),
        }));
      },
    })
  );

  // References provider
  disposables.push(
    monaco.languages.registerReferenceProvider(languageId, {
      provideReferences: async (model, position, context, token) => {
        const result = await sendRequest('textDocument/references', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
          context: {
            includeDeclaration: context.includeDeclaration,
          },
        });

        if (!result) return null;

        return result.map((loc: any) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: convertRange(loc.range),
        }));
      },
    })
  );

  // Document symbol provider
  disposables.push(
    monaco.languages.registerDocumentSymbolProvider(languageId, {
      provideDocumentSymbols: async (model, token) => {
        const result = await sendRequest('textDocument/documentSymbol', {
          textDocument: { uri: model.uri.toString() },
        });

        if (!result) return null;

        return result.map(convertDocumentSymbol);
      },
    })
  );

  // Code action provider
  disposables.push(
    monaco.languages.registerCodeActionProvider(languageId, {
      provideCodeActions: async (model, range, context, token) => {
        const result = await sendRequest('textDocument/codeAction', {
          textDocument: { uri: model.uri.toString() },
          range: {
            start: {
              line: range.startLineNumber - 1,
              character: range.startColumn - 1,
            },
            end: {
              line: range.endLineNumber - 1,
              character: range.endColumn - 1,
            },
          },
          context: {
            diagnostics: context.markers.map(convertMarkerToDiagnostic),
            only: context.only ? [context.only] : undefined,
          },
        });

        if (!result) return { actions: [], dispose: () => {} };

        return {
          actions: result.map((action: any) => ({
            title: action.title,
            kind: action.kind,
            diagnostics: action.diagnostics?.map(convertDiagnosticToMarker),
            isPreferred: action.isPreferred,
            edit: action.edit ? convertWorkspaceEdit(action.edit) : undefined,
            command: action.command,
          })),
          dispose: () => {},
        };
      },
    })
  );

  // Formatting provider
  disposables.push(
    monaco.languages.registerDocumentFormattingEditProvider(languageId, {
      provideDocumentFormattingEdits: async (model, options, token) => {
        const result = await sendRequest('textDocument/formatting', {
          textDocument: { uri: model.uri.toString() },
          options: {
            tabSize: options.tabSize,
            insertSpaces: options.insertSpaces,
          },
        });

        if (!result) return null;

        return result.map(convertTextEdit);
      },
    })
  );

  // Rename provider
  disposables.push(
    monaco.languages.registerRenameProvider(languageId, {
      provideRenameEdits: async (model, position, newName, token) => {
        const result = await sendRequest('textDocument/rename', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
          newName,
        });

        if (!result) return null;

        return convertWorkspaceEdit(result);
      },
      resolveRenameLocation: async (model, position, token) => {
        const result = await sendRequest('textDocument/prepareRename', {
          textDocument: { uri: model.uri.toString() },
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
        });

        if (!result) return null;

        return {
          range: convertRange(result.range || result),
          text: result.placeholder || model.getWordAtPosition(position)?.word || '',
        };
      },
    })
  );

  // Inlay hints provider
  disposables.push(
    monaco.languages.registerInlayHintsProvider(languageId, {
      provideInlayHints: async (model, range, token) => {
        const result = await sendRequest('textDocument/inlayHint', {
          textDocument: { uri: model.uri.toString() },
          range: {
            start: {
              line: range.startLineNumber - 1,
              character: range.startColumn - 1,
            },
            end: {
              line: range.endLineNumber - 1,
              character: range.endColumn - 1,
            },
          },
        });

        if (!result) return { hints: [], dispose: () => {} };

        return {
          hints: result.map((hint: any) => ({
            position: {
              lineNumber: hint.position.line + 1,
              column: hint.position.character + 1,
            },
            label: hint.label,
            kind: hint.kind,
            paddingLeft: hint.paddingLeft,
            paddingRight: hint.paddingRight,
          })),
          dispose: () => {},
        };
      },
    })
  );

  return disposables;
}

// Helper functions for type conversion
function convertCompletionItemKind(kind: number): monaco.languages.CompletionItemKind {
  const kindMap: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };
  return kindMap[kind] || monaco.languages.CompletionItemKind.Text;
}

function convertRange(range: any): monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

function convertTextEdit(edit: any): monaco.languages.TextEdit {
  return {
    range: convertRange(edit.range),
    text: edit.newText,
  };
}

function convertMarkupContent(content: any): monaco.IMarkdownString {
  if (typeof content === 'string') {
    return { value: content };
  }
  if (content.kind === 'markdown') {
    return { value: content.value };
  }
  return { value: content.value || content };
}

function convertDocumentSymbol(symbol: any): monaco.languages.DocumentSymbol {
  return {
    name: symbol.name,
    detail: symbol.detail || '',
    kind: symbol.kind,
    tags: symbol.tags || [],
    range: convertRange(symbol.range),
    selectionRange: convertRange(symbol.selectionRange),
    children: symbol.children?.map(convertDocumentSymbol),
  };
}

function convertMarkerToDiagnostic(marker: monaco.editor.IMarkerData): any {
  return {
    range: {
      start: {
        line: marker.startLineNumber - 1,
        character: marker.startColumn - 1,
      },
      end: {
        line: marker.endLineNumber - 1,
        character: marker.endColumn - 1,
      },
    },
    message: marker.message,
    severity: marker.severity,
    code: marker.code,
    source: marker.source,
  };
}

function convertDiagnosticToMarker(diagnostic: any): monaco.editor.IMarkerData {
  return {
    startLineNumber: diagnostic.range.start.line + 1,
    startColumn: diagnostic.range.start.character + 1,
    endLineNumber: diagnostic.range.end.line + 1,
    endColumn: diagnostic.range.end.character + 1,
    message: diagnostic.message,
    severity: diagnostic.severity || monaco.MarkerSeverity.Error,
    code: diagnostic.code,
    source: diagnostic.source,
  };
}

function convertWorkspaceEdit(edit: any): monaco.languages.WorkspaceEdit {
  const edits: monaco.languages.IWorkspaceTextEdit[] = [];

  if (edit.changes) {
    for (const [uri, textEdits] of Object.entries(edit.changes)) {
      for (const textEdit of textEdits as any[]) {
        edits.push({
          resource: monaco.Uri.parse(uri),
          textEdit: convertTextEdit(textEdit),
          versionId: undefined,
        });
      }
    }
  }

  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      if (change.textDocument) {
        for (const textEdit of change.edits) {
          edits.push({
            resource: monaco.Uri.parse(change.textDocument.uri),
            textEdit: convertTextEdit(textEdit),
            versionId: change.textDocument.version,
          });
        }
      }
    }
  }

  return { edits };
}
```

---

## Language Server Implementations

### TypeScript Server Configuration

```typescript
// src/lsp/servers/typescript.ts

import { spawn } from 'child_process';
import * as path from 'path';

interface TypeScriptServerOptions {
  rootPath: string;
  tsdk?: string;
  maxTsServerMemory?: number;
  plugins?: string[];
}

export function createTypeScriptServer(options: TypeScriptServerOptions) {
  const {
    rootPath,
    tsdk = path.join(rootPath, 'node_modules', 'typescript', 'lib'),
    maxTsServerMemory = 4096,
    plugins = [],
  } = options;

  const args = [
    '--stdio',
    '--tsserver-path', path.join(tsdk, 'tsserver.js'),
  ];

  // Add plugins
  for (const plugin of plugins) {
    args.push('--plugin', plugin);
  }

  const env = {
    ...process.env,
    TSS_LOG: '-level verbose -file /tmp/tsserver.log',
    NODE_OPTIONS: `--max-old-space-size=${maxTsServerMemory}`,
  };

  return spawn('typescript-language-server', args, {
    cwd: rootPath,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// TypeScript-specific initialization options
export const typescriptInitOptions = {
  preferences: {
    includeCompletionsForModuleExports: true,
    includeCompletionsWithInsertText: true,
    includeCompletionsWithSnippetText: true,
    includeAutomaticOptionalChainCompletions: true,
    includeCompletionsWithClassMemberSnippets: true,
    includeCompletionsWithObjectLiteralMethodSnippets: true,
    useLabelDetailsInCompletionEntries: true,
    allowIncompleteCompletions: true,
    importModuleSpecifierPreference: 'shortest',
    importModuleSpecifierEnding: 'auto',
    allowTextChangesInNewFiles: true,
    providePrefixAndSuffixTextForRename: true,
    provideRefactorNotApplicableReason: true,
    allowRenameOfImportPath: true,
    includePackageJsonAutoImports: 'auto',
    jsxAttributeCompletionStyle: 'auto',
    displayPartsForJSDoc: true,
    generateReturnInDocTemplate: true,
  },
  tsserver: {
    logDirectory: '/tmp/tsserver-logs',
    logVerbosity: 'verbose',
    trace: 'verbose',
    useSyntaxServer: 'auto',
    maxTsServerMemory: 4096,
  },
};
```

### Python Server Configuration

```typescript
// src/lsp/servers/python.ts

import { spawn } from 'child_process';

interface PythonServerOptions {
  rootPath: string;
  pythonPath?: string;
  venvPath?: string;
  extraPaths?: string[];
}

export function createPythonServer(options: PythonServerOptions) {
  const {
    rootPath,
    pythonPath = 'python3',
    venvPath,
    extraPaths = [],
  } = options;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
  };

  // Set virtual environment
  if (venvPath) {
    env.VIRTUAL_ENV = venvPath;
    env.PATH = `${venvPath}/bin:${env.PATH}`;
  }

  // Set extra paths
  if (extraPaths.length > 0) {
    env.PYTHONPATH = extraPaths.join(':');
  }

  return spawn('pyright-langserver', ['--stdio'], {
    cwd: rootPath,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// Python-specific initialization options
export const pythonInitOptions = {
  python: {
    pythonPath: 'python3',
    analysis: {
      autoSearchPaths: true,
      useLibraryCodeForTypes: true,
      diagnosticMode: 'workspace',
      typeCheckingMode: 'basic',
      autoImportCompletions: true,
      indexing: true,
      inlayHints: {
        variableTypes: true,
        functionReturnTypes: true,
        callArgumentNames: true,
        pytestParameters: true,
      },
    },
  },
};
```

### Go Server Configuration

```typescript
// src/lsp/servers/go.ts

import { spawn } from 'child_process';

interface GoServerOptions {
  rootPath: string;
  gopath?: string;
  goroot?: string;
  goproxy?: string;
}

export function createGoServer(options: GoServerOptions) {
  const {
    rootPath,
    gopath = '/home/ubuntu/go',
    goroot,
    goproxy = 'https://proxy.golang.org,direct',
  } = options;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    GOPATH: gopath,
    GOMODCACHE: `${gopath}/pkg/mod`,
    GOPROXY: goproxy,
  };

  if (goroot) {
    env.GOROOT = goroot;
  }

  return spawn('gopls', ['serve'], {
    cwd: rootPath,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// Go-specific initialization options
export const goInitOptions = {
  usePlaceholders: true,
  completionDocumentation: true,
  deepCompletion: true,
  completeUnimported: true,
  staticcheck: true,
  analyses: {
    unusedparams: true,
    shadow: true,
    nilness: true,
    unusedwrite: true,
    useany: true,
  },
  codelenses: {
    gc_details: true,
    generate: true,
    regenerate_cgo: true,
    run_govulncheck: true,
    tidy: true,
    upgrade_dependency: true,
    vendor: true,
  },
  hints: {
    assignVariableTypes: true,
    compositeLiteralFields: true,
    compositeLiteralTypes: true,
    constantValues: true,
    functionTypeParameters: true,
    parameterNames: true,
    rangeVariableTypes: true,
  },
};
```

### Rust Server Configuration

```typescript
// src/lsp/servers/rust.ts

import { spawn } from 'child_process';

interface RustServerOptions {
  rootPath: string;
  cargoHome?: string;
  rustupHome?: string;
}

export function createRustServer(options: RustServerOptions) {
  const {
    rootPath,
    cargoHome = '/home/ubuntu/.cargo',
    rustupHome = '/home/ubuntu/.rustup',
  } = options;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    CARGO_HOME: cargoHome,
    RUSTUP_HOME: rustupHome,
    PATH: `${cargoHome}/bin:${process.env.PATH}`,
  };

  return spawn('rust-analyzer', [], {
    cwd: rootPath,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// Rust-specific initialization options
export const rustInitOptions = {
  cargo: {
    loadOutDirsFromCheck: true,
    runBuildScripts: true,
    features: 'all',
  },
  procMacro: {
    enable: true,
    attributes: { enable: true },
  },
  checkOnSave: {
    enable: true,
    command: 'clippy',
    extraArgs: ['--', '-W', 'clippy::all'],
  },
  completion: {
    autoimport: { enable: true },
    autoself: { enable: true },
    postfix: { enable: true },
    privateEditable: { enable: true },
  },
  inlayHints: {
    bindingModeHints: { enable: true },
    chainingHints: { enable: true },
    closingBraceHints: { enable: true },
    closureReturnTypeHints: { enable: 'always' },
    lifetimeElisionHints: { enable: 'skip_trivial' },
    maxLength: 25,
    parameterHints: { enable: true },
    reborrowHints: { enable: 'never' },
    renderColons: true,
    typeHints: { enable: true },
  },
  lens: {
    enable: true,
    debug: { enable: true },
    implementations: { enable: true },
    references: { enable: true },
    run: { enable: true },
  },
};
```

---

## Communication Protocol

### JSON-RPC Message Handler

```typescript
// src/lsp/jsonrpc.ts

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

type RequestHandler = (params: any) => Promise<any>;
type NotificationHandler = (params: any) => void;

class JsonRpcHandler {
  private requestId: number = 0;
  private pendingRequests: Map<number | string, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  private requestHandlers: Map<string, RequestHandler> = new Map();
  private notificationHandlers: Map<string, NotificationHandler> = new Map();
  
  private sendMessage: (message: string) => void;
  private defaultTimeout: number = 30000;

  constructor(sendMessage: (message: string) => void) {
    this.sendMessage = sendMessage;
  }

  // Send request and wait for response
  async sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.defaultTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const message: JsonRpcMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.send(message);
    });
  }

  // Send notification (no response expected)
  sendNotification(method: string, params?: any): void {
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.send(message);
  }

  // Register handler for incoming requests
  onRequest(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  // Register handler for incoming notifications
  onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  // Handle incoming message
  async handleMessage(data: string): Promise<void> {
    const message: JsonRpcMessage = JSON.parse(data);

    if (message.id !== undefined && message.method) {
      // Incoming request
      await this.handleRequest(message);
    } else if (message.id !== undefined) {
      // Response to our request
      this.handleResponse(message);
    } else if (message.method) {
      // Incoming notification
      this.handleNotification(message);
    }
  }

  private async handleRequest(message: JsonRpcMessage): Promise<void> {
    const handler = this.requestHandlers.get(message.method!);
    
    if (!handler) {
      this.sendError(message.id!, -32601, `Method not found: ${message.method}`);
      return;
    }

    try {
      const result = await handler(message.params);
      this.sendResult(message.id!, result);
    } catch (error: any) {
      this.sendError(message.id!, -32603, error.message);
    }
  }

  private handleResponse(message: JsonRpcMessage): void {
    const pending = this.pendingRequests.get(message.id!);
    
    if (!pending) {
      console.warn(`No pending request for id: ${message.id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(message.id!);

    if (message.error) {
      pending.reject(message.error);
    } else {
      pending.resolve(message.result);
    }
  }

  private handleNotification(message: JsonRpcMessage): void {
    const handler = this.notificationHandlers.get(message.method!);
    
    if (handler) {
      handler(message.params);
    }
  }

  private sendResult(id: number | string, result: any): void {
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      result,
    };

    this.send(message);
  }

  private sendError(id: number | string, code: number, message: string): void {
    const errorMessage: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };

    this.send(errorMessage);
  }

  private send(message: JsonRpcMessage): void {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.sendMessage(header + content);
  }
}

export { JsonRpcHandler, JsonRpcMessage };
```

---

## Performance Optimization

### Request Caching

```typescript
// src/lsp/cache.ts

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  version: number;
}

class LSPCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private ttl: number = 5000; // 5 seconds default TTL
  private maxSize: number = 1000;

  // Generate cache key
  private generateKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  // Get cached result
  get<T>(method: string, params: any, documentVersion?: number): T | null {
    const key = this.generateKey(method, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Check document version
    if (documentVersion !== undefined && entry.version !== documentVersion) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  // Set cached result
  set<T>(method: string, params: any, value: T, documentVersion?: number): void {
    // Enforce max size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const key = this.generateKey(method, params);
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      version: documentVersion || 0,
    });
  }

  // Invalidate cache for a document
  invalidateDocument(uri: string): void {
    for (const [key] of this.cache) {
      if (key.includes(uri)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

export const lspCache = new LSPCache();
```

### Request Debouncing

```typescript
// src/lsp/debounce.ts

type DebouncedRequest = {
  method: string;
  params: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
};

class RequestDebouncer {
  private pending: Map<string, DebouncedRequest> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private delays: Record<string, number> = {
    'textDocument/completion': 100,
    'textDocument/hover': 150,
    'textDocument/signatureHelp': 100,
    'textDocument/documentSymbol': 200,
    'textDocument/semanticTokens/full': 300,
    default: 50,
  };

  debounce(
    method: string,
    params: any,
    execute: (method: string, params: any) => Promise<any>
  ): Promise<any> {
    const key = this.generateKey(method, params);
    const delay = this.delays[method] || this.delays.default;

    // Cancel existing timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Reject existing pending request
    const existingRequest = this.pending.get(key);
    if (existingRequest) {
      existingRequest.reject(new Error('Request superseded'));
    }

    return new Promise((resolve, reject) => {
      this.pending.set(key, { method, params, resolve, reject });

      const timer = setTimeout(async () => {
        this.timers.delete(key);
        const request = this.pending.get(key);
        this.pending.delete(key);

        if (request) {
          try {
            const result = await execute(request.method, request.params);
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }
        }
      }, delay);

      this.timers.set(key, timer);
    });
  }

  private generateKey(method: string, params: any): string {
    // For document-specific requests, include URI and position
    if (params?.textDocument?.uri) {
      const uri = params.textDocument.uri;
      const position = params.position
        ? `${params.position.line}:${params.position.character}`
        : '';
      return `${method}:${uri}:${position}`;
    }
    return method;
  }

  cancel(method: string, params: any): void {
    const key = this.generateKey(method, params);
    
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    const request = this.pending.get(key);
    if (request) {
      request.reject(new Error('Request cancelled'));
      this.pending.delete(key);
    }
  }

  cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    for (const request of this.pending.values()) {
      request.reject(new Error('All requests cancelled'));
    }
    this.pending.clear();
  }
}

export const requestDebouncer = new RequestDebouncer();
```

---

## Monitoring and Diagnostics

### LSP Metrics

```typescript
// src/lsp/metrics.ts

interface RequestMetrics {
  method: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  errors: number;
}

class LSPMetrics {
  private metrics: Map<string, RequestMetrics> = new Map();
  private requestTimes: Map<string, number[]> = new Map();
  private maxSamples: number = 100;

  recordRequest(method: string, duration: number, success: boolean): void {
    let metric = this.metrics.get(method);
    
    if (!metric) {
      metric = {
        method,
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
      };
      this.metrics.set(method, metric);
      this.requestTimes.set(method, []);
    }

    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    
    if (!success) {
      metric.errors++;
    }

    // Store recent times for percentile calculation
    const times = this.requestTimes.get(method)!;
    times.push(duration);
    if (times.length > this.maxSamples) {
      times.shift();
    }
  }

  getMetrics(): RequestMetrics[] {
    return Array.from(this.metrics.values());
  }

  getPercentile(method: string, percentile: number): number {
    const times = this.requestTimes.get(method);
    if (!times || times.length === 0) return 0;

    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getSummary(): {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const allMetrics = this.getMetrics();
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.count, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors, 0);
    const totalTime = allMetrics.reduce((sum, m) => sum + m.totalTime, 0);

    // Aggregate all times for percentiles
    const allTimes: number[] = [];
    for (const times of this.requestTimes.values()) {
      allTimes.push(...times);
    }
    allTimes.sort((a, b) => a - b);

    const getPercentile = (p: number) => {
      if (allTimes.length === 0) return 0;
      const index = Math.ceil((p / 100) * allTimes.length) - 1;
      return allTimes[Math.max(0, index)];
    };

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      avgResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0,
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  reset(): void {
    this.metrics.clear();
    this.requestTimes.clear();
  }
}

export const lspMetrics = new LSPMetrics();
```

---

## Best Practices

### 1. Server Lifecycle

```typescript
// DO: Start servers on-demand
const server = await serverManager.startServer(language, rootPath);

// DON'T: Start all servers at once
languages.forEach(lang => serverManager.startServer(lang, rootPath)); // ❌
```

### 2. Request Handling

```typescript
// DO: Debounce frequent requests
const result = await requestDebouncer.debounce(
  'textDocument/completion',
  params,
  sendRequest
);

// DON'T: Send every keystroke immediately
editor.onDidChangeModelContent(() => {
  sendRequest('textDocument/completion', params); // ❌ Too frequent
});
```

### 3. Memory Management

```typescript
// DO: Monitor and limit memory
if (memoryUsage > threshold) {
  await serverManager.stopServer(language, rootPath);
}

// DON'T: Let servers grow unbounded
// No memory monitoring ❌
```

### 4. Error Handling

```typescript
// DO: Handle errors gracefully
try {
  const result = await sendRequest(method, params);
} catch (error) {
  if (error.code === -32601) {
    // Method not supported - disable feature
  }
  // Fall back to basic functionality
}

// DON'T: Let errors crash the editor
const result = await sendRequest(method, params); // ❌ No error handling
```

---

## Summary

### LSP Implementation Checklist

| Component | Implementation |
|-----------|----------------|
| **Server Manager** | Lifecycle, routing, resource limits |
| **Monaco Integration** | Language features registration |
| **Communication** | JSON-RPC over WebSocket/stdio |
| **Caching** | Request caching, debouncing |
| **Monitoring** | Metrics, health checks |

### Resource Allocation by Language

| Language | Memory | CPU | Startup |
|----------|--------|-----|---------|
| TypeScript | 512MB | 50% | 2-5s |
| Python | 512MB | 50% | 1-3s |
| Go | 384MB | 40% | 1-2s |
| Rust | 1GB | 60% | 3-10s |
| Java | 1GB | 60% | 5-15s |

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| Completion latency | <100ms | <200ms |
| Hover latency | <50ms | <100ms |
| Go to definition | <100ms | <200ms |
| Diagnostics update | <500ms | <1s |
| Server startup | <5s | <10s |
