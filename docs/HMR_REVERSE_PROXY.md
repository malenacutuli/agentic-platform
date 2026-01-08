# HMR Through Reverse Proxy Tunnel

## Overview

This guide explains how Hot Module Replacement (HMR) works through reverse proxy tunnels in platforms like SwissBrain. This is a complex engineering challenge involving WebSocket proxying, latency optimization, and connection stability across sandbox hibernation/resume cycles.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [WebSocket Connection Handling](#2-websocket-connection-handling)
3. [Latency Optimization](#3-latency-optimization)
4. [Connection Stability Through Hibernation](#4-connection-stability-through-hibernation)
5. [Implementation Details](#5-implementation-details)
6. [Monitoring & Debugging](#6-monitoring--debugging)

---

## 1. Architecture Overview

### 1.1 HMR Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           HMR Through Reverse Proxy Tunnel                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER'S BROWSER                    MANUS EDGE                    SANDBOX                │
│  ┌─────────────┐                   ┌─────────────┐              ┌─────────────┐        │
│  │             │                   │             │              │             │        │
│  │  React App  │◄──── HTTPS ──────►│   Reverse   │◄─── WS ────►│  Vite Dev   │        │
│  │             │                   │   Proxy     │              │  Server     │        │
│  │  ┌───────┐  │                   │             │              │             │        │
│  │  │ HMR   │  │◄─── WebSocket ───►│  ┌───────┐  │◄─── WS ────►│  ┌───────┐  │        │
│  │  │Client │  │     (wss://)      │  │  WS   │  │              │  │ HMR   │  │        │
│  │  └───────┘  │                   │  │ Proxy │  │              │  │Server │  │        │
│  │             │                   │  └───────┘  │              │  └───────┘  │        │
│  └─────────────┘                   └─────────────┘              └─────────────┘        │
│        │                                 │                            │                │
│        │                                 │                            │                │
│        ▼                                 ▼                            ▼                │
│   Port: 443                         Port: 443                    Port: 3000            │
│   Protocol: WSS                     Protocol: WS/WSS             Protocol: WS          │
│   URL: https://xxx.manus.computer   Internal routing             localhost:3000        │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Complete HMR Flow (File Save to Browser Update)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              HMR Update Flow Timeline                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  T+0ms     T+5ms      T+15ms     T+25ms     T+35ms     T+50ms     T+75ms    T+100ms   │
│    │         │          │          │          │          │          │          │       │
│    ▼         ▼          ▼          ▼          ▼          ▼          ▼          ▼       │
│  ┌───┐    ┌───┐      ┌───┐      ┌───┐      ┌───┐      ┌───┐      ┌───┐      ┌───┐    │
│  │   │    │   │      │   │      │   │      │   │      │   │      │   │      │   │    │
│  │ F │    │ C │      │ T │      │ B │      │ W │      │ P │      │ C │      │ R │    │
│  │ i │    │ h │      │ r │      │ u │      │ S │      │ r │      │ l │      │ e │    │
│  │ l │    │ o │      │ a │      │ n │      │   │      │ o │      │ i │      │ n │    │
│  │ e │    │ k │      │ n │      │ d │      │ M │      │ x │      │ e │      │ d │    │
│  │   │    │ i │      │ s │      │ l │      │ s │      │ y │      │ n │      │ e │    │
│  │ S │    │ d │      │ f │      │ e │      │ g │      │   │      │ t │      │ r │    │
│  │ a │    │ a │      │ o │      │   │      │   │      │   │      │   │      │   │    │
│  │ v │    │ r │      │ r │      │   │      │   │      │   │      │   │      │   │    │
│  │ e │    │   │      │ m │      │   │      │   │      │   │      │   │      │   │    │
│  └───┘    └───┘      └───┘      └───┘      └───┘      └───┘      └───┘      └───┘    │
│    │         │          │          │          │          │          │          │       │
│    └─────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘       │
│                                                                                         │
│  TOTAL LATENCY: 75-150ms (typical)                                                     │
│                                                                                         │
│  Breakdown:                                                                             │
│  - File system detection: 5ms                                                          │
│  - Chokidar event: 5ms                                                                 │
│  - Transform/compile: 10-30ms                                                          │
│  - Bundle update: 10-20ms                                                              │
│  - WebSocket send (sandbox → proxy): 5-15ms                                            │
│  - Proxy forwarding: 2-5ms                                                             │
│  - WebSocket send (proxy → browser): 20-50ms                                           │
│  - Client-side update: 10-30ms                                                         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Components

| Component | Role | Technology |
|-----------|------|------------|
| **Vite Dev Server** | HMR source, file watching, module transformation | Vite, esbuild |
| **WebSocket Server** | HMR message broadcasting | ws, socket.io |
| **Reverse Proxy** | WebSocket tunneling, SSL termination | nginx, Envoy |
| **HMR Client** | Receives updates, applies patches | Vite client |
| **Connection Manager** | Reconnection, state sync | Custom |

---

## 2. WebSocket Connection Handling

### 2.1 WebSocket Proxy Architecture

```typescript
// src/services/websocketProxy.ts

import WebSocket from 'ws';
import http from 'http';
import https from 'https';
import { URL } from 'url';

interface ProxyConnection {
  id: string;
  clientWs: WebSocket;
  serverWs: WebSocket | null;
  sandboxId: string;
  targetPort: number;
  createdAt: Date;
  lastActivity: Date;
  reconnectAttempts: number;
  messageQueue: Buffer[];
  state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

interface WebSocketProxyConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  messageQueueSize: number;
  connectionTimeout: number;
}

class WebSocketProxy {
  private connections: Map<string, ProxyConnection> = new Map();
  private config: WebSocketProxyConfig;
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<WebSocketProxyConfig> = {}) {
    this.config = {
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
      connectionTimeout: 10000,
      ...config
    };
  }

  /**
   * Handle incoming WebSocket upgrade request
   */
  handleUpgrade(
    request: http.IncomingMessage,
    socket: any,
    head: Buffer,
    wss: WebSocket.Server
  ): void {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    
    // Extract sandbox ID and target port from URL
    // URL format: wss://3000-{sandboxId}.manus.computer/_hmr
    const hostParts = request.headers.host?.split('-') || [];
    const port = parseInt(hostParts[0] || '3000', 10);
    const sandboxId = this.extractSandboxId(request.headers.host || '');

    if (!sandboxId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (clientWs) => {
      this.createProxyConnection(clientWs, sandboxId, port, url.pathname);
    });
  }

  /**
   * Create a proxied WebSocket connection
   */
  private async createProxyConnection(
    clientWs: WebSocket,
    sandboxId: string,
    targetPort: number,
    path: string
  ): Promise<void> {
    const connectionId = this.generateConnectionId();

    const connection: ProxyConnection = {
      id: connectionId,
      clientWs,
      serverWs: null,
      sandboxId,
      targetPort,
      createdAt: new Date(),
      lastActivity: new Date(),
      reconnectAttempts: 0,
      messageQueue: [],
      state: 'connecting'
    };

    this.connections.set(connectionId, connection);

    // Set up client WebSocket handlers
    this.setupClientHandlers(connection);

    // Connect to sandbox WebSocket server
    await this.connectToSandbox(connection, path);

    // Start heartbeat
    this.startHeartbeat(connection);

    console.log(`[WS Proxy] Connection ${connectionId} created for sandbox ${sandboxId}`);
  }

  /**
   * Connect to the sandbox's WebSocket server
   */
  private async connectToSandbox(connection: ProxyConnection, path: string): Promise<void> {
    const sandboxHost = await this.resolveSandboxHost(connection.sandboxId);
    const wsUrl = `ws://${sandboxHost}:${connection.targetPort}${path}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      try {
        const serverWs = new WebSocket(wsUrl, {
          headers: {
            'X-Forwarded-For': 'proxy',
            'X-Sandbox-Id': connection.sandboxId
          }
        });

        serverWs.on('open', () => {
          clearTimeout(timeout);
          connection.serverWs = serverWs;
          connection.state = 'connected';
          connection.reconnectAttempts = 0;

          // Flush queued messages
          this.flushMessageQueue(connection);

          console.log(`[WS Proxy] Connected to sandbox ${connection.sandboxId}`);
          resolve();
        });

        serverWs.on('message', (data) => {
          this.forwardToClient(connection, data as Buffer);
        });

        serverWs.on('close', (code, reason) => {
          console.log(`[WS Proxy] Sandbox connection closed: ${code} ${reason}`);
          this.handleServerDisconnect(connection);
        });

        serverWs.on('error', (error) => {
          console.error(`[WS Proxy] Sandbox connection error:`, error);
          clearTimeout(timeout);
          reject(error);
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Set up handlers for client WebSocket
   */
  private setupClientHandlers(connection: ProxyConnection): void {
    const { clientWs } = connection;

    clientWs.on('message', (data) => {
      connection.lastActivity = new Date();
      this.forwardToServer(connection, data as Buffer);
    });

    clientWs.on('close', (code, reason) => {
      console.log(`[WS Proxy] Client disconnected: ${code} ${reason}`);
      this.cleanupConnection(connection);
    });

    clientWs.on('error', (error) => {
      console.error(`[WS Proxy] Client error:`, error);
      this.cleanupConnection(connection);
    });

    clientWs.on('pong', () => {
      connection.lastActivity = new Date();
    });
  }

  /**
   * Forward message from client to sandbox server
   */
  private forwardToServer(connection: ProxyConnection, data: Buffer): void {
    if (connection.serverWs?.readyState === WebSocket.OPEN) {
      connection.serverWs.send(data);
    } else {
      // Queue message if server is not connected
      this.queueMessage(connection, data);
    }
  }

  /**
   * Forward message from sandbox server to client
   */
  private forwardToClient(connection: ProxyConnection, data: Buffer): void {
    if (connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.send(data);
    }
  }

  /**
   * Queue message when server is not available
   */
  private queueMessage(connection: ProxyConnection, data: Buffer): void {
    if (connection.messageQueue.length < this.config.messageQueueSize) {
      connection.messageQueue.push(data);
    } else {
      // Drop oldest message
      connection.messageQueue.shift();
      connection.messageQueue.push(data);
      console.warn(`[WS Proxy] Message queue full, dropping oldest message`);
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  private flushMessageQueue(connection: ProxyConnection): void {
    while (connection.messageQueue.length > 0) {
      const message = connection.messageQueue.shift();
      if (message && connection.serverWs?.readyState === WebSocket.OPEN) {
        connection.serverWs.send(message);
      }
    }
  }

  /**
   * Handle server disconnection with reconnection logic
   */
  private async handleServerDisconnect(connection: ProxyConnection): Promise<void> {
    connection.serverWs = null;
    connection.state = 'reconnecting';

    if (connection.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(`[WS Proxy] Max reconnect attempts reached for ${connection.id}`);
      this.notifyClientOfDisconnect(connection);
      return;
    }

    connection.reconnectAttempts++;
    const delay = this.calculateBackoff(connection.reconnectAttempts);

    console.log(`[WS Proxy] Reconnecting in ${delay}ms (attempt ${connection.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connectToSandbox(connection, '/_hmr');
        this.notifyClientOfReconnect(connection);
      } catch (error) {
        console.error(`[WS Proxy] Reconnection failed:`, error);
        this.handleServerDisconnect(connection);
      }
    }, delay);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = this.config.reconnectDelay;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add jitter
    return delay + Math.random() * 1000;
  }

  /**
   * Notify client of disconnection
   */
  private notifyClientOfDisconnect(connection: ProxyConnection): void {
    if (connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.send(JSON.stringify({
        type: 'proxy:disconnect',
        reason: 'Sandbox connection lost',
        reconnecting: false
      }));
    }
  }

  /**
   * Notify client of successful reconnection
   */
  private notifyClientOfReconnect(connection: ProxyConnection): void {
    if (connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.send(JSON.stringify({
        type: 'proxy:reconnected',
        timestamp: Date.now()
      }));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(connection: ProxyConnection): void {
    const timer = setInterval(() => {
      if (connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.ping();
      }

      // Check for stale connections
      const inactiveTime = Date.now() - connection.lastActivity.getTime();
      if (inactiveTime > this.config.heartbeatInterval * 3) {
        console.warn(`[WS Proxy] Connection ${connection.id} inactive, closing`);
        this.cleanupConnection(connection);
      }
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(connection.id, timer);
  }

  /**
   * Clean up connection resources
   */
  private cleanupConnection(connection: ProxyConnection): void {
    // Stop heartbeat
    const timer = this.heartbeatTimers.get(connection.id);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(connection.id);
    }

    // Close WebSocket connections
    if (connection.serverWs?.readyState === WebSocket.OPEN) {
      connection.serverWs.close();
    }
    if (connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.close();
    }

    // Remove from connections map
    this.connections.delete(connection.id);

    console.log(`[WS Proxy] Connection ${connection.id} cleaned up`);
  }

  /**
   * Resolve sandbox host from sandbox ID
   */
  private async resolveSandboxHost(sandboxId: string): Promise<string> {
    // In production, this would query the sandbox registry
    // For now, return internal DNS name
    return `sandbox-${sandboxId}.internal`;
  }

  /**
   * Extract sandbox ID from host header
   */
  private extractSandboxId(host: string): string | null {
    // Format: 3000-{sandboxId}.manus.computer
    const match = host.match(/^\d+-([a-z0-9]+)\./);
    return match ? match[1] : null;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    reconnectingConnections: number;
    averageLatency: number;
  } {
    let active = 0;
    let reconnecting = 0;

    for (const conn of this.connections.values()) {
      if (conn.state === 'connected') active++;
      if (conn.state === 'reconnecting') reconnecting++;
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: active,
      reconnectingConnections: reconnecting,
      averageLatency: 0 // Would need to track this
    };
  }
}

export const websocketProxy = new WebSocketProxy();
```

### 2.2 HMR Message Protocol

```typescript
// src/services/hmrProtocol.ts

/**
 * HMR Message Types (Vite-compatible)
 */
interface HMRMessage {
  type: 'connected' | 'update' | 'full-reload' | 'prune' | 'error' | 'custom';
  timestamp?: number;
}

interface HMRUpdateMessage extends HMRMessage {
  type: 'update';
  updates: Array<{
    type: 'js-update' | 'css-update';
    path: string;
    acceptedPath: string;
    timestamp: number;
    explicitImportRequired?: boolean;
  }>;
}

interface HMRFullReloadMessage extends HMRMessage {
  type: 'full-reload';
  path?: string;
}

interface HMRErrorMessage extends HMRMessage {
  type: 'error';
  err: {
    message: string;
    stack: string;
    id?: string;
    frame?: string;
    plugin?: string;
    pluginCode?: string;
    loc?: {
      file: string;
      line: number;
      column: number;
    };
  };
}

interface HMRCustomMessage extends HMRMessage {
  type: 'custom';
  event: string;
  data?: any;
}

/**
 * HMR Protocol Handler
 */
class HMRProtocolHandler {
  private pendingUpdates: Map<string, HMRUpdateMessage> = new Map();
  private updateDebounceMs = 50;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Process incoming HMR message
   */
  processMessage(data: Buffer): HMRMessage | null {
    try {
      const message = JSON.parse(data.toString()) as HMRMessage;
      
      switch (message.type) {
        case 'update':
          return this.processUpdate(message as HMRUpdateMessage);
        case 'full-reload':
          return this.processFullReload(message as HMRFullReloadMessage);
        case 'error':
          return this.processError(message as HMRErrorMessage);
        case 'connected':
          return message;
        default:
          return message;
      }
    } catch (error) {
      console.error('[HMR Protocol] Failed to parse message:', error);
      return null;
    }
  }

  /**
   * Process update message with debouncing
   */
  private processUpdate(message: HMRUpdateMessage): HMRUpdateMessage {
    // Add timestamp if missing
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Debounce rapid updates to the same file
    for (const update of message.updates) {
      const key = update.path;
      
      // Clear existing timer
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Merge with pending update
      const pending = this.pendingUpdates.get(key);
      if (pending) {
        // Update timestamp to latest
        pending.timestamp = message.timestamp;
      } else {
        this.pendingUpdates.set(key, message);
      }
    }

    return message;
  }

  /**
   * Process full reload message
   */
  private processFullReload(message: HMRFullReloadMessage): HMRFullReloadMessage {
    // Clear all pending updates
    this.pendingUpdates.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    return message;
  }

  /**
   * Process error message
   */
  private processError(message: HMRErrorMessage): HMRErrorMessage {
    // Enhance error with additional context
    if (message.err && !message.err.stack) {
      message.err.stack = new Error(message.err.message).stack || '';
    }

    return message;
  }

  /**
   * Create connected message
   */
  createConnectedMessage(): HMRMessage {
    return {
      type: 'connected',
      timestamp: Date.now()
    };
  }

  /**
   * Create custom message for proxy events
   */
  createProxyMessage(event: string, data?: any): HMRCustomMessage {
    return {
      type: 'custom',
      event,
      data,
      timestamp: Date.now()
    };
  }
}

export const hmrProtocol = new HMRProtocolHandler();
```

---

## 3. Latency Optimization

### 3.1 Latency Breakdown and Optimization

```typescript
// src/services/latencyOptimizer.ts

interface LatencyMetrics {
  fileSystemDetection: number;    // Time for chokidar to detect change
  moduleTransform: number;        // Time to transform/compile module
  bundleUpdate: number;           // Time to update bundle
  wsServerSend: number;           // Time to send from sandbox to proxy
  proxyForward: number;           // Time for proxy to forward
  wsClientReceive: number;        // Time for client to receive
  clientUpdate: number;           // Time for client to apply update
  total: number;
}

interface OptimizationConfig {
  // File watching
  usePolling: boolean;
  pollingInterval: number;
  ignorePatterns: string[];
  
  // Transform
  esbuildTarget: string;
  skipTypeCheck: boolean;
  
  // WebSocket
  compression: boolean;
  binaryMessages: boolean;
  
  // Caching
  transformCache: boolean;
  dependencyPreBundle: boolean;
}

class LatencyOptimizer {
  private metrics: LatencyMetrics[] = [];
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      usePolling: false,
      pollingInterval: 100,
      ignorePatterns: ['**/node_modules/**', '**/.git/**'],
      esbuildTarget: 'esnext',
      skipTypeCheck: true,
      compression: false, // Compression adds latency for small messages
      binaryMessages: true,
      transformCache: true,
      dependencyPreBundle: true,
      ...config
    };
  }

  /**
   * Optimized file watcher configuration
   */
  getChokidarConfig(): any {
    return {
      // Use native events when possible (faster than polling)
      usePolling: this.config.usePolling,
      interval: this.config.pollingInterval,
      
      // Ignore non-source files
      ignored: this.config.ignorePatterns,
      
      // Don't wait for write to complete
      awaitWriteFinish: false,
      
      // Use atomic writes detection
      atomic: true,
      
      // Persistent watching
      persistent: true,
      
      // Follow symlinks
      followSymlinks: true,
      
      // Depth limit for performance
      depth: 10,
      
      // Ignore initial scan
      ignoreInitial: true
    };
  }

  /**
   * Optimized Vite config for HMR
   */
  getViteHMRConfig(): any {
    return {
      server: {
        hmr: {
          // Use WebSocket protocol
          protocol: 'ws',
          
          // Overlay for errors
          overlay: true,
          
          // Timeout for HMR connection
          timeout: 30000,
          
          // Client port (for proxy scenarios)
          clientPort: 443,
          
          // Path for HMR WebSocket
          path: '/_hmr'
        },
        
        watch: {
          // Use native file system events
          usePolling: this.config.usePolling,
          interval: this.config.pollingInterval
        }
      },
      
      // Optimize dependencies
      optimizeDeps: {
        // Pre-bundle dependencies
        include: [],
        
        // Force optimization
        force: false,
        
        // esbuild options
        esbuildOptions: {
          target: this.config.esbuildTarget
        }
      },
      
      // esbuild options for transforms
      esbuild: {
        target: this.config.esbuildTarget,
        
        // Skip type checking for speed
        tsconfigRaw: this.config.skipTypeCheck ? {
          compilerOptions: {
            skipLibCheck: true,
            skipDefaultLibCheck: true
          }
        } : undefined
      }
    };
  }

  /**
   * Optimized WebSocket configuration
   */
  getWebSocketConfig(): any {
    return {
      // Disable per-message compression for low latency
      // Compression adds ~5-10ms latency but saves bandwidth
      perMessageDeflate: this.config.compression ? {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3 // Low compression for speed
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        threshold: 1024 // Only compress messages > 1KB
      } : false,
      
      // Binary messages are faster to parse
      binary: this.config.binaryMessages,
      
      // Maximum payload size
      maxPayload: 10 * 1024 * 1024, // 10MB
      
      // Backpressure handling
      backpressure: 64 * 1024
    };
  }

  /**
   * Record latency metrics
   */
  recordMetrics(metrics: Partial<LatencyMetrics>): void {
    const fullMetrics: LatencyMetrics = {
      fileSystemDetection: metrics.fileSystemDetection || 0,
      moduleTransform: metrics.moduleTransform || 0,
      bundleUpdate: metrics.bundleUpdate || 0,
      wsServerSend: metrics.wsServerSend || 0,
      proxyForward: metrics.proxyForward || 0,
      wsClientReceive: metrics.wsClientReceive || 0,
      clientUpdate: metrics.clientUpdate || 0,
      total: 0
    };

    fullMetrics.total = Object.values(fullMetrics).reduce((a, b) => a + b, 0);
    
    this.metrics.push(fullMetrics);
    
    // Keep last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  /**
   * Get latency statistics
   */
  getStatistics(): {
    average: LatencyMetrics;
    p50: LatencyMetrics;
    p95: LatencyMetrics;
    p99: LatencyMetrics;
  } {
    if (this.metrics.length === 0) {
      const empty: LatencyMetrics = {
        fileSystemDetection: 0,
        moduleTransform: 0,
        bundleUpdate: 0,
        wsServerSend: 0,
        proxyForward: 0,
        wsClientReceive: 0,
        clientUpdate: 0,
        total: 0
      };
      return { average: empty, p50: empty, p95: empty, p99: empty };
    }

    const sorted = [...this.metrics].sort((a, b) => a.total - b.total);
    
    return {
      average: this.calculateAverage(),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  private calculateAverage(): LatencyMetrics {
    const sum: LatencyMetrics = {
      fileSystemDetection: 0,
      moduleTransform: 0,
      bundleUpdate: 0,
      wsServerSend: 0,
      proxyForward: 0,
      wsClientReceive: 0,
      clientUpdate: 0,
      total: 0
    };

    for (const m of this.metrics) {
      sum.fileSystemDetection += m.fileSystemDetection;
      sum.moduleTransform += m.moduleTransform;
      sum.bundleUpdate += m.bundleUpdate;
      sum.wsServerSend += m.wsServerSend;
      sum.proxyForward += m.proxyForward;
      sum.wsClientReceive += m.wsClientReceive;
      sum.clientUpdate += m.clientUpdate;
      sum.total += m.total;
    }

    const count = this.metrics.length;
    return {
      fileSystemDetection: sum.fileSystemDetection / count,
      moduleTransform: sum.moduleTransform / count,
      bundleUpdate: sum.bundleUpdate / count,
      wsServerSend: sum.wsServerSend / count,
      proxyForward: sum.proxyForward / count,
      wsClientReceive: sum.wsClientReceive / count,
      clientUpdate: sum.clientUpdate / count,
      total: sum.total / count
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const stats = this.getStatistics();
    const recommendations: string[] = [];

    if (stats.average.fileSystemDetection > 20) {
      recommendations.push('Consider using native file system events instead of polling');
    }

    if (stats.average.moduleTransform > 50) {
      recommendations.push('Enable esbuild transform caching');
      recommendations.push('Pre-bundle heavy dependencies');
    }

    if (stats.average.wsServerSend > 20) {
      recommendations.push('Check sandbox network connectivity');
      recommendations.push('Consider colocating proxy with sandbox');
    }

    if (stats.average.wsClientReceive > 50) {
      recommendations.push('User may have high latency connection');
      recommendations.push('Consider enabling WebSocket compression for large updates');
    }

    if (stats.average.clientUpdate > 30) {
      recommendations.push('Check for expensive React re-renders');
      recommendations.push('Consider using React.memo for components');
    }

    return recommendations;
  }
}

export const latencyOptimizer = new LatencyOptimizer();
```

### 3.2 Latency Targets

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HMR Latency Targets                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Component                    Target      Acceptable    Poor                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  File system detection        < 5ms       < 20ms        > 50ms              │
│  Module transform             < 20ms      < 50ms        > 100ms             │
│  Bundle update                < 10ms      < 30ms        > 50ms              │
│  WebSocket (sandbox→proxy)    < 10ms      < 20ms        > 50ms              │
│  Proxy forwarding             < 5ms       < 10ms        > 20ms              │
│  WebSocket (proxy→browser)    < 30ms      < 50ms        > 100ms             │
│  Client-side update           < 20ms      < 50ms        > 100ms             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  TOTAL                        < 100ms     < 230ms       > 470ms             │
│                                                                             │
│  User Experience:                                                           │
│  - < 100ms: Instant feedback, excellent UX                                  │
│  - 100-300ms: Noticeable but acceptable                                     │
│  - 300-500ms: Sluggish, impacts productivity                                │
│  - > 500ms: Poor UX, consider full page reload                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Connection Stability Through Hibernation

### 4.1 Hibernation-Aware Connection Manager

```typescript
// src/services/hibernationConnectionManager.ts

interface ConnectionState {
  id: string;
  sandboxId: string;
  clientId: string;
  wsUrl: string;
  lastMessageId: number;
  pendingMessages: Array<{ id: number; data: Buffer; timestamp: number }>;
  hibernatedAt: Date | null;
  resumedAt: Date | null;
  state: 'active' | 'hibernating' | 'hibernated' | 'resuming' | 'disconnected';
}

interface HibernationEvent {
  type: 'hibernating' | 'hibernated' | 'resuming' | 'resumed';
  sandboxId: string;
  timestamp: Date;
  estimatedResumeTime?: number;
}

class HibernationConnectionManager {
  private connections: Map<string, ConnectionState> = new Map();
  private hibernationListeners: Map<string, ((event: HibernationEvent) => void)[]> = new Map();
  private messageBuffer: Map<string, Buffer[]> = new Map();
  private maxBufferSize = 1000;
  private maxBufferAge = 300000; // 5 minutes

  /**
   * Register a connection for hibernation awareness
   */
  registerConnection(
    connectionId: string,
    sandboxId: string,
    clientId: string,
    wsUrl: string
  ): void {
    const state: ConnectionState = {
      id: connectionId,
      sandboxId,
      clientId,
      wsUrl,
      lastMessageId: 0,
      pendingMessages: [],
      hibernatedAt: null,
      resumedAt: null,
      state: 'active'
    };

    this.connections.set(connectionId, state);
    this.messageBuffer.set(connectionId, []);

    console.log(`[Hibernation] Registered connection ${connectionId} for sandbox ${sandboxId}`);
  }

  /**
   * Handle sandbox hibernation event
   */
  async handleHibernation(sandboxId: string): Promise<void> {
    console.log(`[Hibernation] Sandbox ${sandboxId} is hibernating`);

    // Find all connections for this sandbox
    for (const [connId, state] of this.connections) {
      if (state.sandboxId === sandboxId) {
        state.state = 'hibernating';
        state.hibernatedAt = new Date();

        // Notify client of hibernation
        this.notifyClient(connId, {
          type: 'hibernating',
          sandboxId,
          timestamp: new Date(),
          estimatedResumeTime: 5000 // 5 seconds typical
        });
      }
    }

    // Emit hibernation event
    this.emitHibernationEvent({
      type: 'hibernating',
      sandboxId,
      timestamp: new Date()
    });

    // Wait for hibernation to complete
    await this.waitForHibernation(sandboxId);

    // Update state to hibernated
    for (const [connId, state] of this.connections) {
      if (state.sandboxId === sandboxId) {
        state.state = 'hibernated';
      }
    }

    this.emitHibernationEvent({
      type: 'hibernated',
      sandboxId,
      timestamp: new Date()
    });
  }

  /**
   * Handle sandbox resume event
   */
  async handleResume(sandboxId: string): Promise<void> {
    console.log(`[Hibernation] Sandbox ${sandboxId} is resuming`);

    // Update state to resuming
    for (const [connId, state] of this.connections) {
      if (state.sandboxId === sandboxId) {
        state.state = 'resuming';

        // Notify client of resume
        this.notifyClient(connId, {
          type: 'resuming',
          sandboxId,
          timestamp: new Date()
        });
      }
    }

    this.emitHibernationEvent({
      type: 'resuming',
      sandboxId,
      timestamp: new Date()
    });

    // Wait for sandbox to be fully ready
    await this.waitForSandboxReady(sandboxId);

    // Reconnect WebSocket connections
    for (const [connId, state] of this.connections) {
      if (state.sandboxId === sandboxId) {
        await this.reconnectConnection(connId);
      }
    }

    // Update state to active
    for (const [connId, state] of this.connections) {
      if (state.sandboxId === sandboxId) {
        state.state = 'active';
        state.resumedAt = new Date();

        // Flush buffered messages
        await this.flushBufferedMessages(connId);

        // Notify client of successful resume
        this.notifyClient(connId, {
          type: 'resumed',
          sandboxId,
          timestamp: new Date()
        });
      }
    }

    this.emitHibernationEvent({
      type: 'resumed',
      sandboxId,
      timestamp: new Date()
    });
  }

  /**
   * Buffer message during hibernation
   */
  bufferMessage(connectionId: string, data: Buffer): boolean {
    const state = this.connections.get(connectionId);
    if (!state || state.state === 'active') {
      return false; // Don't buffer if active
    }

    const buffer = this.messageBuffer.get(connectionId) || [];
    
    // Check buffer limits
    if (buffer.length >= this.maxBufferSize) {
      console.warn(`[Hibernation] Buffer full for ${connectionId}, dropping oldest message`);
      buffer.shift();
    }

    buffer.push(data);
    this.messageBuffer.set(connectionId, buffer);

    // Track message for replay
    state.pendingMessages.push({
      id: ++state.lastMessageId,
      data,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Flush buffered messages after resume
   */
  private async flushBufferedMessages(connectionId: string): Promise<void> {
    const state = this.connections.get(connectionId);
    const buffer = this.messageBuffer.get(connectionId);

    if (!state || !buffer || buffer.length === 0) {
      return;
    }

    console.log(`[Hibernation] Flushing ${buffer.length} buffered messages for ${connectionId}`);

    // Send buffered messages
    for (const message of buffer) {
      // Check message age
      const messageState = state.pendingMessages.find(m => m.data === message);
      if (messageState && Date.now() - messageState.timestamp > this.maxBufferAge) {
        console.log(`[Hibernation] Skipping stale message`);
        continue;
      }

      // Send message through WebSocket proxy
      await this.sendBufferedMessage(connectionId, message);
    }

    // Clear buffer
    this.messageBuffer.set(connectionId, []);
    state.pendingMessages = [];
  }

  /**
   * Send buffered message
   */
  private async sendBufferedMessage(connectionId: string, data: Buffer): Promise<void> {
    // This would integrate with the WebSocket proxy
    // For now, emit an event
    const state = this.connections.get(connectionId);
    if (state) {
      // Emit to WebSocket proxy
      console.log(`[Hibernation] Sending buffered message for ${connectionId}`);
    }
  }

  /**
   * Wait for hibernation to complete
   */
  private async waitForHibernation(sandboxId: string): Promise<void> {
    // Poll sandbox status until hibernated
    const maxWait = 30000;
    const pollInterval = 500;
    let waited = 0;

    while (waited < maxWait) {
      const status = await this.getSandboxStatus(sandboxId);
      if (status === 'hibernated') {
        return;
      }
      await this.sleep(pollInterval);
      waited += pollInterval;
    }

    throw new Error(`Sandbox ${sandboxId} did not hibernate within ${maxWait}ms`);
  }

  /**
   * Wait for sandbox to be ready after resume
   */
  private async waitForSandboxReady(sandboxId: string): Promise<void> {
    const maxWait = 60000;
    const pollInterval = 500;
    let waited = 0;

    while (waited < maxWait) {
      const status = await this.getSandboxStatus(sandboxId);
      if (status === 'running') {
        // Additional check: wait for dev server to be ready
        const devServerReady = await this.checkDevServerReady(sandboxId);
        if (devServerReady) {
          return;
        }
      }
      await this.sleep(pollInterval);
      waited += pollInterval;
    }

    throw new Error(`Sandbox ${sandboxId} did not become ready within ${maxWait}ms`);
  }

  /**
   * Check if dev server is ready
   */
  private async checkDevServerReady(sandboxId: string): Promise<boolean> {
    try {
      const host = `sandbox-${sandboxId}.internal`;
      const response = await fetch(`http://${host}:3000/`, {
        method: 'HEAD',
        timeout: 2000
      } as any);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Reconnect WebSocket connection after resume
   */
  private async reconnectConnection(connectionId: string): Promise<void> {
    const state = this.connections.get(connectionId);
    if (!state) return;

    console.log(`[Hibernation] Reconnecting ${connectionId}`);

    // This would trigger WebSocket proxy reconnection
    // The actual implementation depends on the proxy architecture
  }

  /**
   * Get sandbox status
   */
  private async getSandboxStatus(sandboxId: string): Promise<string> {
    // This would query the sandbox registry
    return 'running';
  }

  /**
   * Notify client of hibernation event
   */
  private notifyClient(connectionId: string, event: HibernationEvent): void {
    // This would send a message through the WebSocket
    console.log(`[Hibernation] Notifying client ${connectionId}:`, event.type);
  }

  /**
   * Emit hibernation event to listeners
   */
  private emitHibernationEvent(event: HibernationEvent): void {
    const listeners = this.hibernationListeners.get(event.sandboxId) || [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Subscribe to hibernation events
   */
  onHibernation(sandboxId: string, callback: (event: HibernationEvent) => void): () => void {
    const listeners = this.hibernationListeners.get(sandboxId) || [];
    listeners.push(callback);
    this.hibernationListeners.set(sandboxId, listeners);

    // Return unsubscribe function
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) {
        listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Get connection state
   */
  getConnectionState(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const hibernationConnectionManager = new HibernationConnectionManager();
```

### 4.2 Client-Side Reconnection Handler

```typescript
// client/src/hmr/reconnectionHandler.ts

interface ReconnectionConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

interface ConnectionStatus {
  state: 'connected' | 'disconnected' | 'reconnecting' | 'hibernated';
  lastConnected: Date | null;
  reconnectAttempts: number;
  nextRetryIn: number | null;
}

class HMRReconnectionHandler {
  private ws: WebSocket | null = null;
  private config: ReconnectionConfig;
  private status: ConnectionStatus;
  private reconnectTimer: number | null = null;
  private statusListeners: ((status: ConnectionStatus) => void)[] = [];
  private messageQueue: string[] = [];

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = {
      maxRetries: 20,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      ...config
    };

    this.status = {
      state: 'disconnected',
      lastConnected: null,
      reconnectAttempts: 0,
      nextRetryIn: null
    };
  }

  /**
   * Connect to HMR WebSocket
   */
  connect(url: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('[HMR] Connecting to', url);
    this.updateStatus({ state: 'reconnecting' });

    try {
      this.ws = new WebSocket(url);
      this.setupHandlers();
    } catch (error) {
      console.error('[HMR] Connection failed:', error);
      this.scheduleReconnect(url);
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[HMR] Connected');
      this.updateStatus({
        state: 'connected',
        lastConnected: new Date(),
        reconnectAttempts: 0,
        nextRetryIn: null
      });

      // Flush queued messages
      this.flushMessageQueue();
    };

    this.ws.onclose = (event) => {
      console.log('[HMR] Disconnected:', event.code, event.reason);
      
      // Check if this is a hibernation-related close
      if (event.code === 4000) {
        this.updateStatus({ state: 'hibernated' });
        // Don't auto-reconnect during hibernation
        return;
      }

      this.updateStatus({ state: 'disconnected' });
      this.scheduleReconnect(this.ws?.url || '');
    };

    this.ws.onerror = (error) => {
      console.error('[HMR] WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle proxy messages
      if (message.type === 'proxy:disconnect') {
        console.log('[HMR] Proxy disconnected:', message.reason);
        if (!message.reconnecting) {
          this.updateStatus({ state: 'disconnected' });
        }
        return;
      }

      if (message.type === 'proxy:reconnected') {
        console.log('[HMR] Proxy reconnected');
        this.updateStatus({ state: 'connected' });
        return;
      }

      // Handle hibernation messages
      if (message.type === 'custom' && message.event?.startsWith('hibernat')) {
        this.handleHibernationMessage(message);
        return;
      }

      // Handle standard HMR messages
      this.handleHMRMessage(message);
    } catch (error) {
      console.error('[HMR] Failed to parse message:', error);
    }
  }

  /**
   * Handle hibernation-related messages
   */
  private handleHibernationMessage(message: any): void {
    switch (message.event) {
      case 'hibernating':
        console.log('[HMR] Sandbox is hibernating...');
        this.updateStatus({ state: 'hibernated' });
        this.showHibernationOverlay('Sandbox is hibernating...');
        break;

      case 'hibernated':
        console.log('[HMR] Sandbox hibernated');
        this.showHibernationOverlay('Sandbox hibernated. Will resume on next request.');
        break;

      case 'resuming':
        console.log('[HMR] Sandbox is resuming...');
        this.showHibernationOverlay('Sandbox is resuming...');
        break;

      case 'resumed':
        console.log('[HMR] Sandbox resumed');
        this.updateStatus({ state: 'connected' });
        this.hideHibernationOverlay();
        // Trigger full page reload to ensure state is fresh
        this.triggerFullReload();
        break;
    }
  }

  /**
   * Handle standard HMR messages
   */
  private handleHMRMessage(message: any): void {
    switch (message.type) {
      case 'connected':
        console.log('[HMR] HMR connected');
        break;

      case 'update':
        console.log('[HMR] Update received:', message.updates?.length, 'modules');
        // Let Vite's HMR client handle the actual update
        break;

      case 'full-reload':
        console.log('[HMR] Full reload requested');
        this.triggerFullReload();
        break;

      case 'error':
        console.error('[HMR] Error:', message.err?.message);
        this.showErrorOverlay(message.err);
        break;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(url: string): void {
    if (this.status.reconnectAttempts >= this.config.maxRetries) {
      console.error('[HMR] Max reconnection attempts reached');
      this.showReconnectFailedOverlay();
      return;
    }

    const delay = this.calculateBackoff();
    this.updateStatus({
      state: 'reconnecting',
      reconnectAttempts: this.status.reconnectAttempts + 1,
      nextRetryIn: delay
    });

    console.log(`[HMR] Reconnecting in ${delay}ms (attempt ${this.status.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect(url);
    }, delay);
  }

  /**
   * Calculate backoff delay with jitter
   */
  private calculateBackoff(): number {
    const { baseDelay, maxDelay, jitter } = this.config;
    const attempt = this.status.reconnectAttempts;
    
    let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    if (jitter) {
      delay = delay * (0.5 + Math.random());
    }
    
    return Math.floor(delay);
  }

  /**
   * Queue message when disconnected
   */
  queueMessage(message: string): void {
    if (this.messageQueue.length < 100) {
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(message);
      }
    }
  }

  /**
   * Update connection status
   */
  private updateStatus(updates: Partial<ConnectionStatus>): void {
    this.status = { ...this.status, ...updates };
    this.notifyStatusListeners();
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    return () => {
      const idx = this.statusListeners.indexOf(callback);
      if (idx >= 0) {
        this.statusListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Notify status listeners
   */
  private notifyStatusListeners(): void {
    for (const listener of this.statusListeners) {
      listener(this.status);
    }
  }

  /**
   * Show hibernation overlay
   */
  private showHibernationOverlay(message: string): void {
    let overlay = document.getElementById('hmr-hibernation-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hmr-hibernation-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: system-ui, sans-serif;
      `;
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="text-align: center; color: white;">
        <div style="font-size: 48px; margin-bottom: 16px;">💤</div>
        <div style="font-size: 18px; margin-bottom: 8px;">${message}</div>
        <div style="font-size: 14px; opacity: 0.7;">This won't take long...</div>
      </div>
    `;
    overlay.style.display = 'flex';
  }

  /**
   * Hide hibernation overlay
   */
  private hideHibernationOverlay(): void {
    const overlay = document.getElementById('hmr-hibernation-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * Show error overlay
   */
  private showErrorOverlay(error: any): void {
    // Vite's error overlay handles this, but we can enhance it
    console.error('[HMR] Error overlay:', error);
  }

  /**
   * Show reconnect failed overlay
   */
  private showReconnectFailedOverlay(): void {
    let overlay = document.getElementById('hmr-reconnect-failed-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hmr-reconnect-failed-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: system-ui, sans-serif;
      `;
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="text-align: center; color: white;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 18px; margin-bottom: 16px;">Connection Lost</div>
        <div style="font-size: 14px; opacity: 0.7; margin-bottom: 24px;">
          Unable to reconnect to the development server.
        </div>
        <button onclick="location.reload()" style="
          padding: 12px 24px;
          font-size: 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        ">
          Reload Page
        </button>
      </div>
    `;
    overlay.style.display = 'flex';
  }

  /**
   * Trigger full page reload
   */
  private triggerFullReload(): void {
    console.log('[HMR] Triggering full page reload');
    location.reload();
  }

  /**
   * Get current status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.updateStatus({ state: 'disconnected' });
  }
}

// Export singleton instance
export const hmrReconnectionHandler = new HMRReconnectionHandler();
```

---

## 5. Implementation Details

### 5.1 Nginx WebSocket Proxy Configuration

```nginx
# /etc/nginx/conf.d/websocket-proxy.conf

# Upstream for sandbox WebSocket connections
upstream sandbox_ws {
    # Dynamic upstream based on sandbox ID
    # In production, use nginx-plus or lua for dynamic routing
    server sandbox-pool:3000;
    keepalive 1000;
}

# Map for WebSocket upgrade
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# Rate limiting for WebSocket connections
limit_conn_zone $binary_remote_addr zone=ws_conn:10m;
limit_req_zone $binary_remote_addr zone=ws_req:10m rate=100r/s;

server {
    listen 443 ssl http2;
    server_name *.manus.computer;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/manus.crt;
    ssl_certificate_key /etc/ssl/private/manus.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Connection limits
    limit_conn ws_conn 100;
    limit_req zone=ws_req burst=200 nodelay;

    # WebSocket location for HMR
    location /_hmr {
        proxy_pass http://sandbox_ws;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Preserve host header
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-lived connections
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # Disable buffering for real-time
        proxy_buffering off;
        proxy_cache off;
        
        # WebSocket-specific settings
        proxy_socket_keepalive on;
        
        # Error handling
        proxy_next_upstream error timeout;
        proxy_next_upstream_tries 3;
    }

    # Vite WebSocket location (alternative path)
    location ~ ^/@vite/client {
        proxy_pass http://sandbox_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }

    # Regular HTTP requests
    location / {
        proxy_pass http://sandbox_ws;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Enable keep-alive
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering for regular requests
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}
```

### 5.2 Envoy WebSocket Proxy Configuration

```yaml
# envoy.yaml

static_resources:
  listeners:
    - name: listener_0
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                upgrade_configs:
                  - upgrade_type: websocket
                    enabled: true
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: sandbox_service
                      domains: ["*.manus.computer"]
                      routes:
                        # HMR WebSocket route
                        - match:
                            prefix: "/_hmr"
                          route:
                            cluster: sandbox_cluster
                            timeout: 0s  # No timeout for WebSocket
                            upgrade_configs:
                              - upgrade_type: websocket
                                enabled: true
                        
                        # Vite client route
                        - match:
                            prefix: "/@vite"
                          route:
                            cluster: sandbox_cluster
                            timeout: 0s
                            upgrade_configs:
                              - upgrade_type: websocket
                                enabled: true
                        
                        # Default route
                        - match:
                            prefix: "/"
                          route:
                            cluster: sandbox_cluster
                            timeout: 60s
                
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
          
          transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/ssl/certs/manus.crt
                    private_key:
                      filename: /etc/ssl/private/manus.key

  clusters:
    - name: sandbox_cluster
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      load_assignment:
        cluster_name: sandbox_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: sandbox-pool
                      port_value: 3000
      
      # Health checking
      health_checks:
        - timeout: 5s
          interval: 10s
          unhealthy_threshold: 3
          healthy_threshold: 2
          http_health_check:
            path: /health
      
      # Circuit breaker
      circuit_breakers:
        thresholds:
          - max_connections: 10000
            max_pending_requests: 10000
            max_requests: 10000
            max_retries: 3
```

---

## 6. Monitoring & Debugging

### 6.1 HMR Metrics Collection

```typescript
// src/services/hmrMetrics.ts

import { Counter, Histogram, Gauge } from 'prom-client';

// Metrics definitions
const hmrConnectionsTotal = new Counter({
  name: 'hmr_connections_total',
  help: 'Total number of HMR WebSocket connections',
  labelNames: ['sandbox_id', 'status']
});

const hmrMessagesTotal = new Counter({
  name: 'hmr_messages_total',
  help: 'Total number of HMR messages',
  labelNames: ['sandbox_id', 'type', 'direction']
});

const hmrLatencyHistogram = new Histogram({
  name: 'hmr_latency_seconds',
  help: 'HMR update latency in seconds',
  labelNames: ['sandbox_id', 'phase'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

const hmrActiveConnections = new Gauge({
  name: 'hmr_active_connections',
  help: 'Number of active HMR connections',
  labelNames: ['sandbox_id']
});

const hmrReconnectionsTotal = new Counter({
  name: 'hmr_reconnections_total',
  help: 'Total number of HMR reconnection attempts',
  labelNames: ['sandbox_id', 'success']
});

const hmrBufferedMessages = new Gauge({
  name: 'hmr_buffered_messages',
  help: 'Number of buffered messages during hibernation',
  labelNames: ['sandbox_id']
});

class HMRMetricsCollector {
  recordConnection(sandboxId: string, status: 'connected' | 'disconnected' | 'error'): void {
    hmrConnectionsTotal.inc({ sandbox_id: sandboxId, status });
    
    if (status === 'connected') {
      hmrActiveConnections.inc({ sandbox_id: sandboxId });
    } else {
      hmrActiveConnections.dec({ sandbox_id: sandboxId });
    }
  }

  recordMessage(sandboxId: string, type: string, direction: 'inbound' | 'outbound'): void {
    hmrMessagesTotal.inc({ sandbox_id: sandboxId, type, direction });
  }

  recordLatency(sandboxId: string, phase: string, durationMs: number): void {
    hmrLatencyHistogram.observe(
      { sandbox_id: sandboxId, phase },
      durationMs / 1000
    );
  }

  recordReconnection(sandboxId: string, success: boolean): void {
    hmrReconnectionsTotal.inc({ sandbox_id: sandboxId, success: success.toString() });
  }

  recordBufferedMessages(sandboxId: string, count: number): void {
    hmrBufferedMessages.set({ sandbox_id: sandboxId }, count);
  }

  // Get metrics for a specific sandbox
  async getSandboxMetrics(sandboxId: string): Promise<{
    connections: number;
    messagesPerMinute: number;
    averageLatency: number;
    reconnections: number;
  }> {
    // This would query Prometheus or internal metrics store
    return {
      connections: 0,
      messagesPerMinute: 0,
      averageLatency: 0,
      reconnections: 0
    };
  }
}

export const hmrMetrics = new HMRMetricsCollector();
```

### 6.2 Debug Dashboard

```typescript
// src/services/hmrDebugDashboard.ts

interface DebugInfo {
  connectionId: string;
  sandboxId: string;
  state: string;
  latencyMs: number;
  messagesReceived: number;
  messagesSent: number;
  lastActivity: Date;
  reconnectAttempts: number;
  bufferedMessages: number;
}

class HMRDebugDashboard {
  private debugInfo: Map<string, DebugInfo> = new Map();

  updateDebugInfo(connectionId: string, info: Partial<DebugInfo>): void {
    const existing = this.debugInfo.get(connectionId) || {
      connectionId,
      sandboxId: '',
      state: 'unknown',
      latencyMs: 0,
      messagesReceived: 0,
      messagesSent: 0,
      lastActivity: new Date(),
      reconnectAttempts: 0,
      bufferedMessages: 0
    };

    this.debugInfo.set(connectionId, { ...existing, ...info });
  }

  getDebugInfo(): DebugInfo[] {
    return Array.from(this.debugInfo.values());
  }

  generateDebugReport(): string {
    const info = this.getDebugInfo();
    
    let report = '=== HMR Debug Report ===\n\n';
    
    for (const conn of info) {
      report += `Connection: ${conn.connectionId}\n`;
      report += `  Sandbox: ${conn.sandboxId}\n`;
      report += `  State: ${conn.state}\n`;
      report += `  Latency: ${conn.latencyMs}ms\n`;
      report += `  Messages: ${conn.messagesReceived} received, ${conn.messagesSent} sent\n`;
      report += `  Last Activity: ${conn.lastActivity.toISOString()}\n`;
      report += `  Reconnect Attempts: ${conn.reconnectAttempts}\n`;
      report += `  Buffered Messages: ${conn.bufferedMessages}\n`;
      report += '\n';
    }

    return report;
  }
}

export const hmrDebugDashboard = new HMRDebugDashboard();
```

---

## Summary

### Key Takeaways

| Component | Implementation | Latency Impact |
|-----------|---------------|----------------|
| **WebSocket Proxy** | nginx/Envoy with upgrade support | +2-5ms |
| **File Watching** | chokidar with native events | 5ms |
| **Module Transform** | esbuild with caching | 10-30ms |
| **Message Protocol** | JSON with debouncing | <1ms |
| **Reconnection** | Exponential backoff with jitter | N/A |
| **Hibernation** | Message buffering + state sync | 5-10s resume |

### Latency Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| **Total HMR latency** | <100ms | <300ms |
| **WebSocket RTT** | <50ms | <100ms |
| **Reconnection time** | <5s | <15s |
| **Hibernation resume** | <10s | <30s |

### Best Practices

1. **Use native file system events** instead of polling
2. **Disable WebSocket compression** for small messages
3. **Implement message debouncing** for rapid changes
4. **Buffer messages during hibernation** for seamless resume
5. **Use exponential backoff with jitter** for reconnection
6. **Monitor latency at each phase** for optimization
7. **Provide clear UI feedback** during connection issues

This comprehensive HMR system ensures sub-100ms updates while handling the complexities of reverse proxy tunneling and sandbox hibernation!
