# Dev Server Architecture

This guide provides a comprehensive overview of how development servers are orchestrated in an agentic platform, covering framework-specific dev servers, unified entry points, and the hybrid approach that enables seamless development experiences.

---

## Table of Contents

1. [Overview](#overview)
2. [Dev Server Strategy](#dev-server-strategy)
3. [Framework-Specific Dev Servers](#framework-specific-dev-servers)
4. [Unified Entry Point Architecture](#unified-entry-point-architecture)
5. [Dev Server Orchestrator](#dev-server-orchestrator)
6. [Vite Integration](#vite-integration)
7. [Backend Hot Reload](#backend-hot-reload)
8. [Configuration Management](#configuration-management)
9. [Health Monitoring](#health-monitoring)
10. [Best Practices](#best-practices)

---

## Overview

The platform uses a **framework-aware dev server orchestrator** that delegates to the appropriate development server based on the project type. This approach leverages battle-tested dev servers from each framework ecosystem rather than reinventing the wheel.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DEV SERVER ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐             │
│  │ Project Type  │────►│  Orchestrator │────►│  Dev Server   │             │
│  │ Detection     │     │               │     │  (Framework)  │             │
│  └───────────────┘     └───────────────┘     └───────────────┘             │
│                                                      │                      │
│                                                      ▼                      │
│                                             ┌───────────────┐              │
│                                             │ Reverse Proxy │              │
│                                             │ Tunnel        │              │
│                                             └───────────────┘              │
│                                                      │                      │
│                                                      ▼                      │
│                                             ┌───────────────┐              │
│                                             │ Browser/User  │              │
│                                             └───────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dev Server Strategy

### Framework to Dev Server Mapping

| Project Type | Dev Server | HMR Mechanism | Default Port |
|--------------|------------|---------------|--------------|
| Vite + React | Vite built-in | Vite HMR (native ESM) | 5173 |
| Vite + Vue | Vite built-in | Vite HMR | 5173 |
| Vite + Svelte | Vite built-in | Vite HMR | 5173 |
| Next.js | `next dev` | Fast Refresh | 3000 |
| Nuxt.js | `nuxt dev` | Nuxt HMR | 3000 |
| Express/Node | tsx watch | Process restart | 3000 |
| FastAPI | uvicorn --reload | File watching | 8000 |
| Django | manage.py runserver | Auto-reload | 8000 |
| Go | air | Binary rebuild | 8080 |
| Rust | cargo watch | Rebuild | 8080 |

### Why This Hybrid Approach?

| Benefit | Explanation |
|---------|-------------|
| **Single port** | Everything on one port, no CORS issues |
| **Framework HMR** | Uses Vite's battle-tested HMR |
| **Backend reload** | tsx watch handles server changes |
| **Proxy simplicity** | One URL to tunnel through reverse proxy |
| **Ecosystem leverage** | No reinventing existing solutions |

---

## Framework-Specific Dev Servers

### Vite Dev Server

Vite provides an extremely fast development server with native ES modules support.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    hmr: {
      // WebSocket configuration for HMR
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 443, // For reverse proxy
    },
    watch: {
      usePolling: false, // Use native fs events
      interval: 100,
    },
  },
});
```

### Next.js Dev Server

Next.js includes its own development server with Fast Refresh.

```javascript
// next.config.js
module.exports = {
  reactStrictMode: true,
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};
```

### Express with tsx watch

For Node.js backends, tsx provides TypeScript execution with watch mode.

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/index.ts"
  }
}
```

---

## Unified Entry Point Architecture

The platform uses a unified entry point that combines frontend and backend servers.

```typescript
// server/index.ts - Unified Entry Point
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  if (process.env.NODE_ENV === 'development') {
    // Create Vite dev server in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Use Vite's connect instance as middleware
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist/client'));
  }

  // API routes
  app.use('/api', apiRouter);

  // Start server
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
```

### Benefits of Unified Entry Point

1. **Single process** - Easier debugging and monitoring
2. **Shared port** - No CORS configuration needed
3. **Unified logging** - All logs in one place
4. **Simpler deployment** - One process to manage



---

## Dev Server Orchestrator

The orchestrator detects project type and starts the appropriate dev server.

```typescript
// src/services/devServerOrchestrator.ts

interface DevServer {
  process: ChildProcess;
  port: number;
  type: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  url: string;
}

interface ProjectConfig {
  framework: string;
  path: string;
  port?: number;
  env?: Record<string, string>;
}

class DevServerOrchestrator {
  private servers: Map<string, DevServer> = new Map();

  async startDevServer(project: ProjectConfig): Promise<DevServer> {
    const { framework, path, port } = project;

    switch (framework) {
      case 'vite-react':
      case 'vite-vue':
      case 'vite-svelte':
        return this.startViteDevServer(project);

      case 'nextjs':
        return this.startNextDevServer(project);

      case 'nuxt':
        return this.startNuxtDevServer(project);

      case 'express':
      case 'fastify':
      case 'koa':
        return this.startNodeDevServer(project);

      case 'fastapi':
        return this.startUvicornDevServer(project);

      case 'django':
        return this.startDjangoDevServer(project);

      case 'go':
        return this.startAirDevServer(project);

      case 'rust':
        return this.startCargoWatchServer(project);

      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  private async startViteDevServer(project: ProjectConfig): Promise<DevServer> {
    const port = project.port || 5173;
    const process = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(port)], {
      cwd: project.path,
      env: { ...process.env, ...project.env },
      stdio: 'pipe',
    });

    return this.registerServer(project.path, {
      process,
      port,
      type: 'vite',
      status: 'starting',
      url: `http://localhost:${port}`,
    });
  }

  private async startNextDevServer(project: ProjectConfig): Promise<DevServer> {
    const port = project.port || 3000;
    const process = spawn('npx', ['next', 'dev', '-p', String(port)], {
      cwd: project.path,
      env: { ...process.env, ...project.env },
      stdio: 'pipe',
    });

    return this.registerServer(project.path, {
      process,
      port,
      type: 'nextjs',
      status: 'starting',
      url: `http://localhost:${port}`,
    });
  }

  private async startNodeDevServer(project: ProjectConfig): Promise<DevServer> {
    const port = project.port || 3000;
    const process = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
      cwd: project.path,
      env: { ...process.env, ...project.env, PORT: String(port) },
      stdio: 'pipe',
    });

    return this.registerServer(project.path, {
      process,
      port,
      type: 'node',
      status: 'starting',
      url: `http://localhost:${port}`,
    });
  }

  private async startUvicornDevServer(project: ProjectConfig): Promise<DevServer> {
    const port = project.port || 8000;
    const process = spawn('uvicorn', ['main:app', '--reload', '--host', '0.0.0.0', '--port', String(port)], {
      cwd: project.path,
      env: { ...process.env, ...project.env },
      stdio: 'pipe',
    });

    return this.registerServer(project.path, {
      process,
      port,
      type: 'fastapi',
      status: 'starting',
      url: `http://localhost:${port}`,
    });
  }

  private async startAirDevServer(project: ProjectConfig): Promise<DevServer> {
    const port = project.port || 8080;
    const process = spawn('air', [], {
      cwd: project.path,
      env: { ...process.env, ...project.env, PORT: String(port) },
      stdio: 'pipe',
    });

    return this.registerServer(project.path, {
      process,
      port,
      type: 'go',
      status: 'starting',
      url: `http://localhost:${port}`,
    });
  }

  private registerServer(projectPath: string, server: DevServer): DevServer {
    this.servers.set(projectPath, server);
    this.setupProcessHandlers(projectPath, server);
    return server;
  }

  private setupProcessHandlers(projectPath: string, server: DevServer): void {
    server.process.stdout?.on('data', (data) => {
      console.log(`[${server.type}] ${data}`);
      // Detect when server is ready
      if (this.isServerReady(server.type, data.toString())) {
        server.status = 'running';
      }
    });

    server.process.stderr?.on('data', (data) => {
      console.error(`[${server.type}] ${data}`);
    });

    server.process.on('exit', (code) => {
      server.status = code === 0 ? 'stopped' : 'error';
    });
  }

  private isServerReady(type: string, output: string): boolean {
    const readyPatterns: Record<string, RegExp> = {
      vite: /ready in \d+ms/i,
      nextjs: /ready - started server/i,
      node: /Server running on/i,
      fastapi: /Uvicorn running on/i,
      go: /running on/i,
    };

    return readyPatterns[type]?.test(output) ?? false;
  }

  async stopDevServer(projectPath: string): Promise<void> {
    const server = this.servers.get(projectPath);
    if (server) {
      server.process.kill('SIGTERM');
      this.servers.delete(projectPath);
    }
  }

  async restartDevServer(projectPath: string): Promise<DevServer | null> {
    const server = this.servers.get(projectPath);
    if (server) {
      await this.stopDevServer(projectPath);
      // Re-detect project and start
      const config = await this.detectProjectConfig(projectPath);
      return this.startDevServer(config);
    }
    return null;
  }

  private async detectProjectConfig(projectPath: string): Promise<ProjectConfig> {
    // Detect framework from package.json, config files, etc.
    const packageJson = await fs.readFile(
      path.join(projectPath, 'package.json'),
      'utf-8'
    ).then(JSON.parse).catch(() => ({}));

    if (packageJson.dependencies?.next) {
      return { framework: 'nextjs', path: projectPath };
    }
    if (packageJson.dependencies?.nuxt) {
      return { framework: 'nuxt', path: projectPath };
    }
    if (packageJson.devDependencies?.vite) {
      if (packageJson.dependencies?.react) {
        return { framework: 'vite-react', path: projectPath };
      }
      if (packageJson.dependencies?.vue) {
        return { framework: 'vite-vue', path: projectPath };
      }
      return { framework: 'vite-svelte', path: projectPath };
    }
    if (packageJson.dependencies?.express) {
      return { framework: 'express', path: projectPath };
    }

    // Check for Python projects
    if (await fs.access(path.join(projectPath, 'requirements.txt')).then(() => true).catch(() => false)) {
      if (await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8').then(c => c.includes('fastapi'))) {
        return { framework: 'fastapi', path: projectPath };
      }
      if (await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8').then(c => c.includes('django'))) {
        return { framework: 'django', path: projectPath };
      }
    }

    // Check for Go projects
    if (await fs.access(path.join(projectPath, 'go.mod')).then(() => true).catch(() => false)) {
      return { framework: 'go', path: projectPath };
    }

    throw new Error('Unable to detect project framework');
  }
}

export const devServerOrchestrator = new DevServerOrchestrator();
```

---

## Vite Integration

### Middleware Mode for Full-Stack Apps

```typescript
// server/viteIntegration.ts
import { createServer as createViteServer, ViteDevServer } from 'vite';
import express from 'express';

export async function setupViteMiddleware(app: express.Application): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        // Configure HMR for reverse proxy
        protocol: 'ws',
        clientPort: 443,
      },
    },
    appType: 'spa',
    optimizeDeps: {
      // Pre-bundle dependencies for faster startup
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  });

  // Use Vite's middleware
  app.use(vite.middlewares);

  return vite;
}
```

### HMR Configuration for Reverse Proxy

```typescript
// vite.config.ts for reverse proxy compatibility
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: {
      // When behind reverse proxy
      protocol: 'wss',
      host: 'your-sandbox-id.manus.computer',
      clientPort: 443,
    },
    // Allow connections from any host
    host: '0.0.0.0',
    // Strict port to avoid conflicts
    strictPort: true,
  },
});
```

---

## Backend Hot Reload

### tsx watch Configuration

```typescript
// For TypeScript Node.js backends
// package.json
{
  "scripts": {
    "dev": "tsx watch --clear-screen=false server/index.ts"
  }
}
```

### nodemon Configuration

```json
// nodemon.json
{
  "watch": ["server/", "shared/"],
  "ext": "ts,js,json",
  "ignore": ["node_modules/", "dist/", "*.test.ts"],
  "exec": "tsx server/index.ts",
  "delay": "100ms"
}
```

### Custom Watch Script

```typescript
// scripts/dev-server.ts
import { spawn, ChildProcess } from 'child_process';
import chokidar from 'chokidar';
import { debounce } from 'lodash';

class DevServerManager {
  private serverProcess: ChildProcess | null = null;
  private isRestarting = false;

  start(): void {
    this.startServer();
    this.setupWatcher();
  }

  private startServer(): void {
    console.log('Starting server...');
    this.serverProcess = spawn('tsx', ['server/index.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
    });

    this.serverProcess.on('exit', (code) => {
      if (!this.isRestarting) {
        console.log(`Server exited with code ${code}`);
      }
    });
  }

  private setupWatcher(): void {
    const watcher = chokidar.watch(['server/**/*.ts', 'shared/**/*.ts'], {
      ignored: /node_modules/,
      persistent: true,
    });

    const restart = debounce(() => {
      this.restartServer();
    }, 100);

    watcher.on('change', (path) => {
      console.log(`File changed: ${path}`);
      restart();
    });
  }

  private restartServer(): void {
    this.isRestarting = true;
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess.on('exit', () => {
        this.startServer();
        this.isRestarting = false;
      });
    } else {
      this.startServer();
      this.isRestarting = false;
    }
  }
}

new DevServerManager().start();
```

---

## Configuration Management

### Environment-Based Configuration

```typescript
// config/devServer.ts
interface DevServerConfig {
  port: number;
  host: string;
  hmr: {
    enabled: boolean;
    protocol: 'ws' | 'wss';
    clientPort?: number;
  };
  watch: {
    usePolling: boolean;
    interval: number;
  };
  proxy?: Record<string, string>;
}

export function getDevServerConfig(): DevServerConfig {
  const isDocker = process.env.DOCKER === 'true';
  const isTunnel = process.env.TUNNEL === 'true';

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: '0.0.0.0',
    hmr: {
      enabled: true,
      protocol: isTunnel ? 'wss' : 'ws',
      clientPort: isTunnel ? 443 : undefined,
    },
    watch: {
      // Use polling in Docker/WSL
      usePolling: isDocker,
      interval: isDocker ? 300 : 100,
    },
  };
}
```

---

## Health Monitoring

### Dev Server Health Check

```typescript
// src/services/devServerHealth.ts
import axios from 'axios';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting';
  latency: number;
  lastCheck: Date;
  errors: string[];
}

class DevServerHealthMonitor {
  private healthStatus: Map<string, HealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  startMonitoring(servers: Map<string, { url: string; port: number }>): void {
    this.checkInterval = setInterval(() => {
      servers.forEach((server, projectPath) => {
        this.checkHealth(projectPath, server.url);
      });
    }, 5000);
  }

  private async checkHealth(projectPath: string, url: string): Promise<void> {
    const start = Date.now();
    
    try {
      await axios.get(`${url}/health`, { timeout: 3000 });
      
      this.healthStatus.set(projectPath, {
        status: 'healthy',
        latency: Date.now() - start,
        lastCheck: new Date(),
        errors: [],
      });
    } catch (error) {
      const current = this.healthStatus.get(projectPath);
      const errors = current?.errors || [];
      errors.push(error.message);
      
      this.healthStatus.set(projectPath, {
        status: 'unhealthy',
        latency: Date.now() - start,
        lastCheck: new Date(),
        errors: errors.slice(-5), // Keep last 5 errors
      });
    }
  }

  getStatus(projectPath: string): HealthStatus | undefined {
    return this.healthStatus.get(projectPath);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const healthMonitor = new DevServerHealthMonitor();
```

---

## Best Practices

### 1. Use Framework-Native Dev Servers

Always prefer the framework's built-in dev server over custom solutions:

- **Vite** for React/Vue/Svelte
- **Next.js dev** for Next.js
- **uvicorn --reload** for FastAPI

### 2. Configure HMR for Reverse Proxy

When behind a reverse proxy, ensure WebSocket connections work:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
  },
});
```

### 3. Handle Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down dev server...');
  await devServer.close();
  process.exit(0);
});
```

### 4. Optimize for Container Environments

```typescript
// Use polling in Docker/WSL
const watchConfig = {
  usePolling: process.env.DOCKER === 'true',
  interval: 300,
};
```

### 5. Separate Frontend and Backend Concerns

Even with a unified entry point, keep frontend and backend code separate for better maintainability.

---

## Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend Dev** | Vite/Next.js/Nuxt | Fast HMR, native ESM |
| **Backend Dev** | tsx watch/nodemon | TypeScript execution with reload |
| **Orchestrator** | Custom service | Framework detection, lifecycle |
| **Health Monitor** | HTTP polling | Ensure server availability |
| **Configuration** | Environment-based | Adapt to different environments |

The dev server architecture prioritizes developer experience by leveraging existing, battle-tested solutions while providing a unified interface for the platform to manage development environments.
