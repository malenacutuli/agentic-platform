# WebSocket Handling Through Reverse Proxy Tunnels

This guide provides comprehensive coverage of WebSocket connection handling through reverse proxy tunnels, including connection upgrades, keep-alive configuration, reconnection strategies, and message buffering.

---

## Table of Contents

1. [Overview](#overview)
2. [WebSocket Upgrade Flow](#websocket-upgrade-flow)
3. [Connection Upgrade Handling](#connection-upgrade-handling)
4. [Keep-Alive Configuration](#keep-alive-configuration)
5. [Reconnection Strategies](#reconnection-strategies)
6. [Message Buffering](#message-buffering)
7. [Envoy WebSocket Configuration](#envoy-websocket-configuration)
8. [HMR WebSocket Handling](#hmr-websocket-handling)
9. [Monitoring and Debugging](#monitoring-and-debugging)
10. [Best Practices](#best-practices)

---

## Overview

WebSocket connections through reverse proxy tunnels require special handling due to the long-lived nature of connections and the need to maintain state across multiple proxy hops.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        WEBSOCKET THROUGH TUNNEL                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  BROWSER                   CLOUDFLARE              ENVOY                 SANDBOX        │
│     │                          │                     │                      │           │
│     │  GET /_hmr HTTP/1.1      │                     │                      │           │
│     │  Upgrade: websocket      │                     │                      │           │
│     │  Connection: Upgrade     │                     │                      │           │
│     │  Sec-WebSocket-Key: xxx  │                     │                      │           │
│     │─────────────────────────▶│                     │                      │           │
│     │                          │                     │                      │           │
│     │                          │  Forward upgrade    │                      │           │
│     │                          │  (preserve headers) │                      │           │
│     │                          │────────────────────▶│                      │           │
│     │                          │                     │                      │           │
│     │                          │                     │  Forward to sandbox  │           │
│     │                          │                     │─────────────────────▶│           │
│     │                          │                     │                      │           │
│     │                          │                     │  101 Switching       │           │
│     │                          │                     │◀─────────────────────│           │
│     │                          │                     │                      │           │
│     │                          │  101 Switching      │                      │           │
│     │                          │◀────────────────────│                      │           │
│     │                          │                     │                      │           │
│     │  101 Switching Protocols │                     │                      │           │
│     │◀─────────────────────────│                     │                      │           │
│     │                          │                     │                      │           │
│     │◀═══════════════════════════════════ WebSocket Established ═══════════════════▶│  │
│     │                          │                     │                      │           │
│     │  WS Frame: {"type":"hmr"}│                     │                      │           │
│     │═════════════════════════════════════════════════════════════════════▶│           │
│     │                          │                     │                      │           │
│     │  WS Frame: {"type":"update", "path":"..."}    │                      │           │
│     │◀═════════════════════════════════════════════════════════════════════│           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Upgrade Flow

### HTTP Upgrade Handshake

```
Client Request:
GET /_hmr HTTP/1.1
Host: 3000-abc123.us2.manus.computer
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://3000-abc123.us2.manus.computer

Server Response:
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### Upgrade Flow Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEBSOCKET UPGRADE TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  T+0ms     T+5ms      T+20ms     T+50ms     T+80ms     T+100ms             │
│    │         │          │          │          │          │                  │
│    ▼         ▼          ▼          ▼          ▼          ▼                  │
│  ┌────┐   ┌────┐     ┌────┐     ┌────┐     ┌────┐     ┌────┐              │
│  │HTTP│   │Edge│     │Prxy│     │Sand│     │ 101│     │ WS │              │
│  │ GET│──▶│ CF │────▶│Envy│────▶│ box│────▶│Resp│────▶│Open│              │
│  └────┘   └────┘     └────┘     └────┘     └────┘     └────┘              │
│                                                                             │
│  Latency breakdown:                                                         │
│  • Client → Cloudflare: 5-20ms (user's network)                            │
│  • Cloudflare → Envoy: 5-15ms (internal network)                           │
│  • Envoy → Sandbox: 5-20ms (container network)                             │
│  • Sandbox processing: 1-5ms                                               │
│  • Response back: similar path                                             │
│  • Total: 50-150ms typical                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Connection Upgrade Handling

### Envoy Upgrade Configuration

```yaml
# envoy-websocket.yaml
static_resources:
  listeners:
    - name: https_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_https
                codec_type: AUTO
                
                # Enable WebSocket upgrades
                upgrade_configs:
                  - upgrade_type: websocket
                    enabled: true
                
                route_config:
                  name: sandbox_routes
                  virtual_hosts:
                    - name: sandbox_vhost
                      domains: ["*.us2.manus.computer"]
                      routes:
                        - match:
                            prefix: "/"
                          route:
                            cluster: sandbox_cluster
                            timeout: 0s  # No timeout for WebSocket
                            upgrade_configs:
                              - upgrade_type: websocket
                                enabled: true
```

### WebSocket Proxy Implementation

```typescript
// src/services/websocketProxy.ts

import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

interface WebSocketConnection {
  clientWs: WebSocket;
  serverWs: WebSocket;
  sandboxId: string;
  port: number;
  createdAt: Date;
  lastActivity: Date;
}

class WebSocketProxy {
  private connections: Map<string, WebSocketConnection> = new Map();
  
  handleUpgrade(
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
    sandboxAddress: string
  ): void {
    const clientWs = new WebSocket(null);
    
    // Accept the client connection
    clientWs.setSocket(socket, head, {
      maxPayload: 100 * 1024 * 1024, // 100MB
      skipUTF8Validation: true,
    });
    
    // Connect to sandbox
    const serverWs = new WebSocket(`ws://${sandboxAddress}${request.url}`, {
      headers: this.filterHeaders(request.headers),
    });
    
    const connectionId = this.generateConnectionId();
    
    serverWs.on('open', () => {
      console.log(`[ws] Connection established: ${connectionId}`);
      this.setupBidirectionalProxy(clientWs, serverWs, connectionId);
    });
    
    serverWs.on('error', (error) => {
      console.error(`[ws] Server connection error: ${error.message}`);
      clientWs.close(1011, 'Server connection failed');
    });
    
    clientWs.on('error', (error) => {
      console.error(`[ws] Client connection error: ${error.message}`);
      serverWs.close();
    });
  }
  
  private setupBidirectionalProxy(
    clientWs: WebSocket,
    serverWs: WebSocket,
    connectionId: string
  ): void {
    // Client → Server
    clientWs.on('message', (data, isBinary) => {
      if (serverWs.readyState === WebSocket.OPEN) {
        serverWs.send(data, { binary: isBinary });
      }
    });
    
    // Server → Client
    serverWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });
    
    // Handle close from either side
    clientWs.on('close', (code, reason) => {
      console.log(`[ws] Client closed: ${code} ${reason}`);
      serverWs.close(code, reason);
      this.connections.delete(connectionId);
    });
    
    serverWs.on('close', (code, reason) => {
      console.log(`[ws] Server closed: ${code} ${reason}`);
      clientWs.close(code, reason);
      this.connections.delete(connectionId);
    });
    
    // Store connection for management
    this.connections.set(connectionId, {
      clientWs,
      serverWs,
      sandboxId: '', // Extract from request
      port: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
    });
  }
  
  private filterHeaders(headers: Record<string, string | string[]>): Record<string, string> {
    const filtered: Record<string, string> = {};
    const allowedHeaders = [
      'sec-websocket-protocol',
      'sec-websocket-extensions',
      'cookie',
      'authorization',
    ];
    
    for (const [key, value] of Object.entries(headers)) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        filtered[key] = Array.isArray(value) ? value[0] : value;
      }
    }
    
    return filtered;
  }
  
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getActiveConnections(): number {
    return this.connections.size;
  }
  
  closeAllForSandbox(sandboxId: string): void {
    for (const [id, conn] of this.connections) {
      if (conn.sandboxId === sandboxId) {
        conn.clientWs.close(1001, 'Sandbox shutting down');
        conn.serverWs.close();
        this.connections.delete(id);
      }
    }
  }
}

export const websocketProxy = new WebSocketProxy();
```

---

## Keep-Alive Configuration

### Ping-Pong Heartbeat

```typescript
// src/services/websocketKeepAlive.ts

interface KeepAliveConfig {
  pingInterval: number;      // ms between pings
  pongTimeout: number;       // ms to wait for pong
  maxMissedPongs: number;    // max missed pongs before disconnect
}

class WebSocketKeepAlive {
  private config: KeepAliveConfig = {
    pingInterval: 30000,     // 30 seconds
    pongTimeout: 10000,      // 10 seconds
    maxMissedPongs: 2,       // 2 missed = disconnect
  };
  
  private pingTimers: Map<WebSocket, NodeJS.Timeout> = new Map();
  private pongTimers: Map<WebSocket, NodeJS.Timeout> = new Map();
  private missedPongs: Map<WebSocket, number> = new Map();
  
  startKeepAlive(ws: WebSocket): void {
    this.missedPongs.set(ws, 0);
    this.schedulePing(ws);
    
    ws.on('pong', () => {
      this.handlePong(ws);
    });
    
    ws.on('close', () => {
      this.stopKeepAlive(ws);
    });
  }
  
  stopKeepAlive(ws: WebSocket): void {
    const pingTimer = this.pingTimers.get(ws);
    const pongTimer = this.pongTimers.get(ws);
    
    if (pingTimer) clearInterval(pingTimer);
    if (pongTimer) clearTimeout(pongTimer);
    
    this.pingTimers.delete(ws);
    this.pongTimers.delete(ws);
    this.missedPongs.delete(ws);
  }
  
  private schedulePing(ws: WebSocket): void {
    const timer = setInterval(() => {
      this.sendPing(ws);
    }, this.config.pingInterval);
    
    this.pingTimers.set(ws, timer);
  }
  
  private sendPing(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) {
      this.stopKeepAlive(ws);
      return;
    }
    
    try {
      ws.ping();
      
      // Set timeout for pong response
      const pongTimer = setTimeout(() => {
        this.handleMissedPong(ws);
      }, this.config.pongTimeout);
      
      this.pongTimers.set(ws, pongTimer);
    } catch (error) {
      console.error('[keepalive] Ping failed:', error);
      this.stopKeepAlive(ws);
    }
  }
  
  private handlePong(ws: WebSocket): void {
    // Clear pong timeout
    const pongTimer = this.pongTimers.get(ws);
    if (pongTimer) {
      clearTimeout(pongTimer);
      this.pongTimers.delete(ws);
    }
    
    // Reset missed pong counter
    this.missedPongs.set(ws, 0);
  }
  
  private handleMissedPong(ws: WebSocket): void {
    const missed = (this.missedPongs.get(ws) || 0) + 1;
    this.missedPongs.set(ws, missed);
    
    console.warn(`[keepalive] Missed pong #${missed}`);
    
    if (missed >= this.config.maxMissedPongs) {
      console.error('[keepalive] Too many missed pongs, closing connection');
      ws.terminate();
      this.stopKeepAlive(ws);
    }
  }
}

export const websocketKeepAlive = new WebSocketKeepAlive();
```

### Cloudflare WebSocket Timeout

```yaml
# Cloudflare settings (via API or dashboard)
websocket_timeout: 100  # seconds of inactivity before disconnect

# To prevent timeout, ensure:
# 1. Ping interval < 100 seconds
# 2. Application sends periodic messages
```

### Envoy Idle Timeout

```yaml
# envoy-timeouts.yaml
route_config:
  virtual_hosts:
    - name: sandbox_vhost
      routes:
        - match:
            prefix: "/"
          route:
            cluster: sandbox_cluster
            timeout: 0s  # Disable HTTP timeout
            idle_timeout: 3600s  # 1 hour idle timeout for WebSocket
```

---

## Reconnection Strategies

### Client-Side Reconnection

```typescript
// client/src/lib/websocketReconnect.ts

interface ReconnectConfig {
  initialDelay: number;      // Initial delay in ms
  maxDelay: number;          // Maximum delay in ms
  multiplier: number;        // Backoff multiplier
  jitter: number;            // Random jitter (0-1)
  maxAttempts: number;       // Max reconnection attempts
}

class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private config: ReconnectConfig;
  private attempt: number = 0;
  private messageQueue: any[] = [];
  private listeners: Map<string, Set<Function>> = new Map();
  
  constructor(url: string, config: Partial<ReconnectConfig> = {}) {
    this.url = url;
    this.config = {
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: 0.3,
      maxAttempts: 10,
      ...config,
    };
    
    this.connect();
  }
  
  private connect(): void {
    console.log(`[ws] Connecting to ${this.url} (attempt ${this.attempt + 1})`);
    
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('[ws] Connected');
      this.attempt = 0;
      this.flushMessageQueue();
      this.emit('open');
    };
    
    this.ws.onmessage = (event) => {
      this.emit('message', event.data);
    };
    
    this.ws.onclose = (event) => {
      console.log(`[ws] Closed: ${event.code} ${event.reason}`);
      this.emit('close', event);
      
      if (!event.wasClean) {
        this.scheduleReconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[ws] Error:', error);
      this.emit('error', error);
    };
  }
  
  private scheduleReconnect(): void {
    if (this.attempt >= this.config.maxAttempts) {
      console.error('[ws] Max reconnection attempts reached');
      this.emit('maxRetriesReached');
      return;
    }
    
    const delay = this.calculateDelay();
    console.log(`[ws] Reconnecting in ${delay}ms`);
    
    setTimeout(() => {
      this.attempt++;
      this.connect();
    }, delay);
  }
  
  private calculateDelay(): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.multiplier, this.attempt),
      this.config.maxDelay
    );
    
    // Add random jitter
    const jitter = exponentialDelay * this.config.jitter * Math.random();
    
    return Math.floor(exponentialDelay + jitter);
  }
  
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(data);
    }
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }
  
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(callback => callback(...args));
  }
  
  close(): void {
    this.config.maxAttempts = 0; // Prevent reconnection
    this.ws?.close();
  }
  
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

export { ReconnectingWebSocket };
```

### Reconnection Backoff Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECONNECTION BACKOFF TIMELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Attempt   Delay (base)   With Jitter (30%)   Total Wait                   │
│  ────────────────────────────────────────────────────────────────────────  │
│     1         1s            1.0-1.3s            ~1s                         │
│     2         2s            2.0-2.6s            ~3s                         │
│     3         4s            4.0-5.2s            ~8s                         │
│     4         8s            8.0-10.4s           ~18s                        │
│     5        16s           16.0-20.8s           ~38s                        │
│     6        30s (max)     30.0-39.0s           ~75s                        │
│     7        30s           30.0-39.0s           ~110s                       │
│     ...                                                                     │
│    10        30s           30.0-39.0s           ~230s                       │
│                                                                             │
│  After 10 attempts (~4 minutes), give up and show error to user            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Message Buffering

### Server-Side Message Buffer

```typescript
// src/services/messageBuffer.ts

interface BufferedMessage {
  data: any;
  timestamp: Date;
  id: string;
}

interface BufferConfig {
  maxSize: number;           // Max messages to buffer
  maxAge: number;            // Max age in ms
  flushOnReconnect: boolean; // Flush buffer on reconnect
}

class MessageBuffer {
  private buffers: Map<string, BufferedMessage[]> = new Map();
  private config: BufferConfig;
  
  constructor(config: Partial<BufferConfig> = {}) {
    this.config = {
      maxSize: 100,
      maxAge: 60000, // 1 minute
      flushOnReconnect: true,
      ...config,
    };
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 10000);
  }
  
  buffer(connectionId: string, message: any): void {
    if (!this.buffers.has(connectionId)) {
      this.buffers.set(connectionId, []);
    }
    
    const buffer = this.buffers.get(connectionId)!;
    
    // Add message
    buffer.push({
      data: message,
      timestamp: new Date(),
      id: this.generateMessageId(),
    });
    
    // Enforce max size (remove oldest)
    while (buffer.length > this.config.maxSize) {
      buffer.shift();
    }
  }
  
  getBuffered(connectionId: string): BufferedMessage[] {
    const buffer = this.buffers.get(connectionId) || [];
    
    // Filter out expired messages
    const now = Date.now();
    return buffer.filter(msg => 
      now - msg.timestamp.getTime() < this.config.maxAge
    );
  }
  
  flush(connectionId: string, ws: WebSocket): void {
    const messages = this.getBuffered(connectionId);
    
    for (const msg of messages) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          ...msg.data,
          _buffered: true,
          _originalTimestamp: msg.timestamp.toISOString(),
        }));
      }
    }
    
    // Clear buffer after flush
    this.buffers.delete(connectionId);
  }
  
  clear(connectionId: string): void {
    this.buffers.delete(connectionId);
  }
  
  private cleanup(): void {
    const now = Date.now();
    
    for (const [connectionId, buffer] of this.buffers) {
      // Remove expired messages
      const filtered = buffer.filter(msg =>
        now - msg.timestamp.getTime() < this.config.maxAge
      );
      
      if (filtered.length === 0) {
        this.buffers.delete(connectionId);
      } else {
        this.buffers.set(connectionId, filtered);
      }
    }
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const messageBuffer = new MessageBuffer();
```

### HMR-Specific Buffering

```typescript
// src/services/hmrBuffer.ts

interface HMRUpdate {
  type: 'update' | 'full-reload' | 'prune' | 'error';
  path?: string;
  timestamp: number;
  acceptedPath?: string;
}

class HMRBuffer {
  private updates: Map<string, HMRUpdate[]> = new Map();
  private maxUpdatesPerConnection = 50;
  
  bufferUpdate(connectionId: string, update: HMRUpdate): void {
    if (!this.updates.has(connectionId)) {
      this.updates.set(connectionId, []);
    }
    
    const buffer = this.updates.get(connectionId)!;
    
    // Deduplicate: if same file updated multiple times, keep latest
    const existingIndex = buffer.findIndex(u => u.path === update.path);
    if (existingIndex !== -1) {
      buffer.splice(existingIndex, 1);
    }
    
    buffer.push(update);
    
    // Limit buffer size
    while (buffer.length > this.maxUpdatesPerConnection) {
      buffer.shift();
    }
  }
  
  getUpdates(connectionId: string, since?: number): HMRUpdate[] {
    const buffer = this.updates.get(connectionId) || [];
    
    if (since) {
      return buffer.filter(u => u.timestamp > since);
    }
    
    return buffer;
  }
  
  shouldFullReload(connectionId: string): boolean {
    const buffer = this.updates.get(connectionId) || [];
    
    // If any update requires full reload, return true
    return buffer.some(u => u.type === 'full-reload');
  }
  
  clear(connectionId: string): void {
    this.updates.delete(connectionId);
  }
}

export const hmrBuffer = new HMRBuffer();
```

---

## Envoy WebSocket Configuration

### Complete Envoy Configuration

```yaml
# envoy-websocket-complete.yaml
static_resources:
  listeners:
    - name: https_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/ssl/certs/wildcard.pem
                    private_key:
                      filename: /etc/ssl/private/wildcard.key
                alpn_protocols:
                  - h2
                  - http/1.1
          filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_https
                codec_type: AUTO
                
                # WebSocket upgrade configuration
                upgrade_configs:
                  - upgrade_type: websocket
                    enabled: true
                
                # Connection timeouts
                stream_idle_timeout: 3600s  # 1 hour
                request_timeout: 0s         # No timeout for WebSocket
                
                route_config:
                  name: sandbox_routes
                  virtual_hosts:
                    - name: sandbox_vhost
                      domains: ["*.us2.manus.computer"]
                      routes:
                        # WebSocket routes (HMR, etc.)
                        - match:
                            prefix: "/_hmr"
                          route:
                            cluster: sandbox_cluster
                            timeout: 0s
                            idle_timeout: 3600s
                            upgrade_configs:
                              - upgrade_type: websocket
                                enabled: true
                        
                        # Vite WebSocket
                        - match:
                            prefix: "/@vite/client"
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
                            upgrade_configs:
                              - upgrade_type: websocket
                                enabled: true
                
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
    - name: sandbox_cluster
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      
      # Circuit breaker for WebSocket connections
      circuit_breakers:
        thresholds:
          - priority: DEFAULT
            max_connections: 10000
            max_pending_requests: 1000
            max_requests: 10000
            max_retries: 3
      
      # HTTP/1.1 for WebSocket (HTTP/2 doesn't support WebSocket upgrade)
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http_protocol_options: {}
      
      load_assignment:
        cluster_name: sandbox_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: sandbox-service
                      port_value: 3000
```

---

## HMR WebSocket Handling

### Vite HMR Client Integration

```typescript
// client/src/lib/hmrClient.ts

interface HMRPayload {
  type: 'connected' | 'update' | 'full-reload' | 'prune' | 'error' | 'custom';
  path?: string;
  acceptedPath?: string;
  timestamp?: number;
  err?: { message: string; stack: string };
}

class HMRClient {
  private ws: ReconnectingWebSocket;
  private lastUpdateTimestamp: number = 0;
  
  constructor() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/_hmr`;
    
    this.ws = new ReconnectingWebSocket(url, {
      initialDelay: 500,
      maxDelay: 5000,
      maxAttempts: Infinity, // Keep trying for HMR
    });
    
    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data: string) => this.handleMessage(data));
    this.ws.on('close', () => this.handleClose());
  }
  
  private handleOpen(): void {
    console.log('[HMR] Connected');
    
    // Request any missed updates
    if (this.lastUpdateTimestamp > 0) {
      this.ws.send(JSON.stringify({
        type: 'sync',
        since: this.lastUpdateTimestamp,
      }));
    }
  }
  
  private handleMessage(data: string): void {
    try {
      const payload: HMRPayload = JSON.parse(data);
      
      switch (payload.type) {
        case 'connected':
          console.log('[HMR] Server connected');
          break;
        
        case 'update':
          this.handleUpdate(payload);
          break;
        
        case 'full-reload':
          console.log('[HMR] Full reload required');
          location.reload();
          break;
        
        case 'prune':
          // Module was removed
          console.log('[HMR] Module pruned:', payload.path);
          break;
        
        case 'error':
          console.error('[HMR] Error:', payload.err?.message);
          this.showErrorOverlay(payload.err);
          break;
      }
      
      if (payload.timestamp) {
        this.lastUpdateTimestamp = payload.timestamp;
      }
    } catch (error) {
      console.error('[HMR] Failed to parse message:', error);
    }
  }
  
  private handleUpdate(payload: HMRPayload): void {
    console.log('[HMR] Update:', payload.path);
    
    // Vite handles the actual module replacement
    // This is just for logging/debugging
  }
  
  private handleClose(): void {
    console.log('[HMR] Disconnected, will reconnect...');
  }
  
  private showErrorOverlay(err?: { message: string; stack: string }): void {
    if (!err) return;
    
    // Create error overlay
    const overlay = document.createElement('div');
    overlay.id = 'hmr-error-overlay';
    overlay.innerHTML = `
      <style>
        #hmr-error-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          color: #ff5555;
          font-family: monospace;
          padding: 20px;
          z-index: 99999;
          overflow: auto;
        }
        #hmr-error-overlay h1 {
          color: #ff5555;
          margin-bottom: 20px;
        }
        #hmr-error-overlay pre {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        #hmr-error-overlay button {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 10px 20px;
          background: #ff5555;
          color: white;
          border: none;
          cursor: pointer;
        }
      </style>
      <button onclick="this.parentElement.remove()">×</button>
      <h1>Build Error</h1>
      <pre>${err.message}\n\n${err.stack}</pre>
    `;
    
    document.body.appendChild(overlay);
  }
}

// Initialize HMR client
if (import.meta.hot) {
  new HMRClient();
}
```

---

## Monitoring and Debugging

### WebSocket Metrics

```typescript
// src/services/websocketMetrics.ts

interface WebSocketMetrics {
  activeConnections: number;
  totalConnections: number;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  reconnections: number;
}

class WebSocketMetricsCollector {
  private metrics: WebSocketMetrics = {
    activeConnections: 0,
    totalConnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0,
    reconnections: 0,
  };
  
  recordConnection(): void {
    this.metrics.activeConnections++;
    this.metrics.totalConnections++;
  }
  
  recordDisconnection(): void {
    this.metrics.activeConnections--;
  }
  
  recordMessage(direction: 'in' | 'out', bytes: number): void {
    if (direction === 'in') {
      this.metrics.messagesReceived++;
      this.metrics.bytesReceived += bytes;
    } else {
      this.metrics.messagesSent++;
      this.metrics.bytesSent += bytes;
    }
  }
  
  recordError(): void {
    this.metrics.errors++;
  }
  
  recordReconnection(): void {
    this.metrics.reconnections++;
  }
  
  getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }
  
  getPrometheusMetrics(): string {
    return `
# HELP websocket_active_connections Current number of active WebSocket connections
# TYPE websocket_active_connections gauge
websocket_active_connections ${this.metrics.activeConnections}

# HELP websocket_total_connections Total number of WebSocket connections
# TYPE websocket_total_connections counter
websocket_total_connections ${this.metrics.totalConnections}

# HELP websocket_messages_total Total number of WebSocket messages
# TYPE websocket_messages_total counter
websocket_messages_total{direction="received"} ${this.metrics.messagesReceived}
websocket_messages_total{direction="sent"} ${this.metrics.messagesSent}

# HELP websocket_bytes_total Total bytes transferred over WebSocket
# TYPE websocket_bytes_total counter
websocket_bytes_total{direction="received"} ${this.metrics.bytesReceived}
websocket_bytes_total{direction="sent"} ${this.metrics.bytesSent}

# HELP websocket_errors_total Total number of WebSocket errors
# TYPE websocket_errors_total counter
websocket_errors_total ${this.metrics.errors}

# HELP websocket_reconnections_total Total number of WebSocket reconnections
# TYPE websocket_reconnections_total counter
websocket_reconnections_total ${this.metrics.reconnections}
    `.trim();
  }
}

export const websocketMetrics = new WebSocketMetricsCollector();
```

### Debug Logging

```typescript
// src/utils/websocketDebug.ts

const DEBUG = process.env.WS_DEBUG === 'true';

export function wsDebug(category: string, message: string, data?: any): void {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[WS:${category}] ${timestamp}`;
  
  if (data) {
    console.log(prefix, message, JSON.stringify(data, null, 2));
  } else {
    console.log(prefix, message);
  }
}

// Usage
wsDebug('upgrade', 'Handling upgrade request', { url: req.url });
wsDebug('message', 'Received message', { size: data.length });
wsDebug('close', 'Connection closed', { code, reason });
```

---

## Best Practices

### 1. Always Use Reconnection

```typescript
// Never use raw WebSocket for production
// ❌ Bad
const ws = new WebSocket(url);

// ✅ Good
const ws = new ReconnectingWebSocket(url);
```

### 2. Implement Heartbeat

```typescript
// Keep connections alive through proxies
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.ping();
  }
}, 30000);
```

### 3. Handle Buffered Messages

```typescript
// On reconnect, check for missed updates
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'sync',
    lastMessageId: lastReceivedId,
  }));
});
```

### 4. Graceful Degradation

```typescript
// Fall back to polling if WebSocket fails
if (wsReconnectAttempts > maxAttempts) {
  console.warn('WebSocket unavailable, falling back to polling');
  startPolling();
}
```

### 5. Monitor Connection Health

```typescript
// Track connection quality
const metrics = {
  latency: [],
  disconnects: 0,
  messageDrops: 0,
};

// Alert on degradation
if (metrics.disconnects > threshold) {
  alertOperations('WebSocket connection unstable');
}
```

---

## Summary

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| **Upgrade** | Envoy + HTTP/1.1 | Protocol switch |
| **Keep-alive** | Ping/pong every 30s | Prevent timeout |
| **Reconnection** | Exponential backoff | Handle disconnects |
| **Buffering** | Server-side queue | No message loss |
| **Monitoring** | Prometheus metrics | Observability |

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Connection success rate | >99% | <95% |
| Reconnection rate | <1/hour | >5/hour |
| Message latency | <100ms | >500ms |
| Ping-pong success | 100% | <98% |
