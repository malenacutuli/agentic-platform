# Port Exposure and URL Routing

This guide covers URL collision handling, Envoy configuration (xDS vs static), health check failure behavior, WebSocket upgrade handling, and maximum port limits.

---

## Table of Contents

1. [URL Collision Prevention](#url-collision-prevention)
2. [Envoy Configuration](#envoy-configuration)
3. [Health Check Failure Handling](#health-check-failure-handling)
4. [WebSocket Upgrade Handling](#websocket-upgrade-handling)
5. [Maximum Ports Per Sandbox](#maximum-ports-per-sandbox)

---

## URL Collision Prevention

### URL Format Design (Collision-Free)

The URL format is designed to be inherently collision-free:

```
https://{port}-{sandboxId}.{region}.manus.computer
        │      │           │
        │      │           └── Region (us2, eu1, ap1)
        │      └── Unique sandbox ID (globally unique)
        └── Port number (unique per sandbox)
```

### Why Collisions Cannot Occur

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           URL COLLISION PREVENTION                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX A                              SANDBOX B                                       │
│  ID: abc123                             ID: xyz789                                      │
│                                                                                         │
│  Exposes port 3000:                     Exposes port 3000:                              │
│  https://3000-abc123.us2.manus.computer https://3000-xyz789.us2.manus.computer         │
│           │                                      │                                      │
│           └──────────── DIFFERENT ───────────────┘                                      │
│                                                                                         │
│  SAME SANDBOX (abc123)                                                                  │
│                                                                                         │
│  Exposes port 3000:                     Exposes port 5173:                              │
│  https://3000-abc123.us2.manus.computer https://5173-abc123.us2.manus.computer         │
│           │                                      │                                      │
│           └──────────── DIFFERENT ───────────────┘                                      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Sandbox ID Generation

```typescript
// sandbox-id-generator.ts

import { customAlphabet } from 'nanoid';

// Base62 alphabet (URL-safe, no ambiguous characters)
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// 12 characters = 62^12 = 3.2 × 10^21 possible IDs
const generateId = customAlphabet(alphabet, 12);

interface SandboxIdConfig {
  length: number;
  prefix?: string;
  checkCollision: boolean;
}

class SandboxIdGenerator {
  private redis: Redis;
  private config: SandboxIdConfig;
  
  constructor(redis: Redis, config: Partial<SandboxIdConfig> = {}) {
    this.redis = redis;
    this.config = {
      length: 12,
      checkCollision: true,
      ...config,
    };
  }
  
  /**
   * Generate unique sandbox ID
   */
  async generate(): Promise<string> {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const id = generateId();
      const fullId = this.config.prefix ? `${this.config.prefix}-${id}` : id;
      
      if (!this.config.checkCollision) {
        return fullId;
      }
      
      // Check for collision (extremely rare)
      const exists = await this.redis.exists(`sandbox:${fullId}`);
      if (!exists) {
        // Reserve the ID
        await this.redis.set(`sandbox:${fullId}:reserved`, '1', 'EX', 300);
        return fullId;
      }
      
      console.warn(`Sandbox ID collision detected: ${fullId} (attempt ${attempt + 1})`);
    }
    
    throw new Error('Failed to generate unique sandbox ID after max attempts');
  }
  
  /**
   * Validate sandbox ID format
   */
  validate(id: string): boolean {
    const pattern = new RegExp(`^[${alphabet}]{${this.config.length}}$`);
    return pattern.test(id);
  }
}

// Collision probability calculation:
// With 62^12 possible IDs and 1 million sandboxes:
// P(collision) ≈ n² / (2 × N) = 10^12 / (2 × 3.2 × 10^21) ≈ 1.6 × 10^-10
// Essentially zero probability of collision

export { SandboxIdGenerator };
```

### Port Allocation Within Sandbox

```typescript
// port-allocator.ts

interface PortAllocation {
  port: number;
  sandboxId: string;
  url: string;
  createdAt: Date;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
}

class PortAllocator {
  private redis: Redis;
  private region: string;
  private domain: string;
  
  // Reserved ports that cannot be exposed
  private reservedPorts = new Set([
    22,    // SSH
    25,    // SMTP
    53,    // DNS
    80,    // HTTP (use 3000+ instead)
    443,   // HTTPS (use 3000+ instead)
    6379,  // Redis
    5432,  // PostgreSQL
    3306,  // MySQL
    27017, // MongoDB
  ]);
  
  // Valid port range
  private minPort = 1024;
  private maxPort = 65535;
  
  constructor(redis: Redis, region: string, domain: string) {
    this.redis = redis;
    this.region = region;
    this.domain = domain;
  }
  
  /**
   * Allocate port for sandbox
   */
  async allocate(sandboxId: string, port: number): Promise<PortAllocation> {
    // Validate port
    this.validatePort(port);
    
    // Check if already allocated (idempotent)
    const existing = await this.getExisting(sandboxId, port);
    if (existing) {
      return existing;
    }
    
    // Check sandbox port limit
    const currentCount = await this.getPortCount(sandboxId);
    if (currentCount >= 10) {
      throw new Error(`Maximum ports (10) reached for sandbox ${sandboxId}`);
    }
    
    // Generate URL
    const url = `https://${port}-${sandboxId}.${this.region}.${this.domain}`;
    
    // Store allocation
    const allocation: PortAllocation = {
      port,
      sandboxId,
      url,
      createdAt: new Date(),
      healthStatus: 'unknown',
    };
    
    await this.redis.hset(
      `sandbox:${sandboxId}:ports`,
      port.toString(),
      JSON.stringify(allocation)
    );
    
    // Add to global routing table
    await this.redis.hset(
      'routing:ports',
      `${port}-${sandboxId}`,
      JSON.stringify({
        sandboxId,
        port,
        url,
      })
    );
    
    return allocation;
  }
  
  /**
   * Validate port number
   */
  private validatePort(port: number): void {
    if (!Number.isInteger(port)) {
      throw new Error('Port must be an integer');
    }
    
    if (port < this.minPort || port > this.maxPort) {
      throw new Error(`Port must be between ${this.minPort} and ${this.maxPort}`);
    }
    
    if (this.reservedPorts.has(port)) {
      throw new Error(`Port ${port} is reserved and cannot be exposed`);
    }
  }
  
  /**
   * Get existing allocation
   */
  private async getExisting(sandboxId: string, port: number): Promise<PortAllocation | null> {
    const data = await this.redis.hget(
      `sandbox:${sandboxId}:ports`,
      port.toString()
    );
    
    return data ? JSON.parse(data) : null;
  }
  
  /**
   * Get current port count for sandbox
   */
  private async getPortCount(sandboxId: string): Promise<number> {
    return await this.redis.hlen(`sandbox:${sandboxId}:ports`);
  }
  
  /**
   * Deallocate port
   */
  async deallocate(sandboxId: string, port: number): Promise<void> {
    await this.redis.hdel(`sandbox:${sandboxId}:ports`, port.toString());
    await this.redis.hdel('routing:ports', `${port}-${sandboxId}`);
  }
  
  /**
   * Deallocate all ports for sandbox
   */
  async deallocateAll(sandboxId: string): Promise<void> {
    const ports = await this.redis.hkeys(`sandbox:${sandboxId}:ports`);
    
    for (const port of ports) {
      await this.redis.hdel('routing:ports', `${port}-${sandboxId}`);
    }
    
    await this.redis.del(`sandbox:${sandboxId}:ports`);
  }
}

export { PortAllocator, PortAllocation };
```

---

## Envoy Configuration

### xDS (Aggregated Discovery Service) Architecture

We use **Envoy xDS (ADS - Aggregated Discovery Service)** for dynamic configuration, not static configuration.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ENVOY xDS ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         CONTROL PLANE                                            │   │
│  │                                                                                  │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │   │
│  │  │   Sandbox   │    │   Sandbox   │    │   Health    │    │    xDS      │      │   │
│  │  │   Manager   │───▶│   Registry  │───▶│   Checker   │───▶│   Server    │      │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │   │
│  │                                                                  │               │   │
│  └──────────────────────────────────────────────────────────────────│───────────────┘   │
│                                                                     │                   │
│                                                        gRPC (ADS)   │                   │
│                                                                     ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA PLANE                                               │   │
│  │                                                                                  │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │   │
│  │  │   Envoy     │    │   Envoy     │    │   Envoy     │    │   Envoy     │      │   │
│  │  │   Proxy 1   │    │   Proxy 2   │    │   Proxy 3   │    │   Proxy N   │      │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │   │
│  │        │                  │                  │                  │               │   │
│  └────────│──────────────────│──────────────────│──────────────────│───────────────┘   │
│           │                  │                  │                  │                   │
│           ▼                  ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │  Sandbox 1  │    │  Sandbox 2  │    │  Sandbox 3  │    │  Sandbox N  │            │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### xDS Server Implementation

```typescript
// xds-server.ts

import * as grpc from '@grpc/grpc-js';
import { 
  AggregatedDiscoveryServiceService,
  DiscoveryRequest,
  DiscoveryResponse,
} from '@envoyproxy/envoy-api';

interface ClusterConfig {
  name: string;
  endpoints: EndpointConfig[];
  healthCheck: HealthCheckConfig;
}

interface EndpointConfig {
  address: string;
  port: number;
  weight: number;
}

interface HealthCheckConfig {
  path: string;
  interval: string;
  timeout: string;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

class XDSServer {
  private server: grpc.Server;
  private sandboxRegistry: SandboxRegistry;
  private subscribers: Map<string, grpc.ServerDuplexStream<DiscoveryRequest, DiscoveryResponse>>;
  private versionCounter: number = 0;
  
  constructor(sandboxRegistry: SandboxRegistry) {
    this.sandboxRegistry = sandboxRegistry;
    this.subscribers = new Map();
    this.server = new grpc.Server();
    
    // Register ADS service
    this.server.addService(AggregatedDiscoveryServiceService, {
      streamAggregatedResources: this.handleStream.bind(this),
    });
    
    // Subscribe to registry changes
    this.sandboxRegistry.on('change', () => this.pushUpdates());
  }
  
  /**
   * Handle xDS stream
   */
  private handleStream(
    stream: grpc.ServerDuplexStream<DiscoveryRequest, DiscoveryResponse>
  ): void {
    const nodeId = stream.metadata.get('node-id')[0]?.toString() || 'unknown';
    
    console.log(`xDS client connected: ${nodeId}`);
    this.subscribers.set(nodeId, stream);
    
    stream.on('data', (request: DiscoveryRequest) => {
      this.handleRequest(nodeId, request, stream);
    });
    
    stream.on('end', () => {
      console.log(`xDS client disconnected: ${nodeId}`);
      this.subscribers.delete(nodeId);
      stream.end();
    });
    
    stream.on('error', (error) => {
      console.error(`xDS stream error for ${nodeId}:`, error);
      this.subscribers.delete(nodeId);
    });
  }
  
  /**
   * Handle discovery request
   */
  private async handleRequest(
    nodeId: string,
    request: DiscoveryRequest,
    stream: grpc.ServerDuplexStream<DiscoveryRequest, DiscoveryResponse>
  ): Promise<void> {
    const typeUrl = request.type_url;
    
    switch (typeUrl) {
      case 'type.googleapis.com/envoy.config.cluster.v3.Cluster':
        await this.sendClusters(stream);
        break;
        
      case 'type.googleapis.com/envoy.config.endpoint.v3.ClusterLoadAssignment':
        await this.sendEndpoints(stream);
        break;
        
      case 'type.googleapis.com/envoy.config.listener.v3.Listener':
        await this.sendListeners(stream);
        break;
        
      case 'type.googleapis.com/envoy.config.route.v3.RouteConfiguration':
        await this.sendRoutes(stream);
        break;
    }
  }
  
  /**
   * Send cluster configuration
   */
  private async sendClusters(
    stream: grpc.ServerDuplexStream<DiscoveryRequest, DiscoveryResponse>
  ): Promise<void> {
    const sandboxes = await this.sandboxRegistry.getAll();
    const clusters = [];
    
    for (const sandbox of sandboxes) {
      for (const port of sandbox.exposedPorts) {
        clusters.push({
          '@type': 'type.googleapis.com/envoy.config.cluster.v3.Cluster',
          name: `sandbox-${sandbox.id}-${port}`,
          type: 'STRICT_DNS',
          lb_policy: 'ROUND_ROBIN',
          connect_timeout: '5s',
          
          // Health check configuration
          health_checks: [{
            timeout: '2s',
            interval: '10s',
            unhealthy_threshold: 3,
            healthy_threshold: 1,
            http_health_check: {
              path: '/health',
              expected_statuses: [{ start: 200, end: 299 }],
            },
          }],
          
          // Circuit breaker
          circuit_breakers: {
            thresholds: [{
              max_connections: 100,
              max_pending_requests: 100,
              max_requests: 1000,
              max_retries: 3,
            }],
          },
          
          // Load assignment (endpoints)
          load_assignment: {
            cluster_name: `sandbox-${sandbox.id}-${port}`,
            endpoints: [{
              lb_endpoints: [{
                endpoint: {
                  address: {
                    socket_address: {
                      address: sandbox.podIp,
                      port_value: port,
                    },
                  },
                },
              }],
            }],
          },
        });
      }
    }
    
    const response: DiscoveryResponse = {
      version_info: this.getVersion(),
      type_url: 'type.googleapis.com/envoy.config.cluster.v3.Cluster',
      resources: clusters,
      nonce: this.generateNonce(),
    };
    
    stream.write(response);
  }
  
  /**
   * Send route configuration
   */
  private async sendRoutes(
    stream: grpc.ServerDuplexStream<DiscoveryRequest, DiscoveryResponse>
  ): Promise<void> {
    const sandboxes = await this.sandboxRegistry.getAll();
    const virtualHosts = [];
    
    for (const sandbox of sandboxes) {
      for (const port of sandbox.exposedPorts) {
        virtualHosts.push({
          name: `sandbox-${sandbox.id}-${port}`,
          domains: [`${port}-${sandbox.id}.*.manus.computer`],
          routes: [{
            match: { prefix: '/' },
            route: {
              cluster: `sandbox-${sandbox.id}-${port}`,
              timeout: '60s',
              
              // Retry policy
              retry_policy: {
                retry_on: '5xx,reset,connect-failure',
                num_retries: 2,
                per_try_timeout: '10s',
              },
              
              // WebSocket upgrade
              upgrade_configs: [{
                upgrade_type: 'websocket',
                enabled: true,
              }],
            },
          }],
        });
      }
    }
    
    const routeConfig = {
      '@type': 'type.googleapis.com/envoy.config.route.v3.RouteConfiguration',
      name: 'sandbox-routes',
      virtual_hosts: virtualHosts,
    };
    
    const response: DiscoveryResponse = {
      version_info: this.getVersion(),
      type_url: 'type.googleapis.com/envoy.config.route.v3.RouteConfiguration',
      resources: [routeConfig],
      nonce: this.generateNonce(),
    };
    
    stream.write(response);
  }
  
  /**
   * Push updates to all subscribers
   */
  private async pushUpdates(): Promise<void> {
    this.versionCounter++;
    
    for (const [nodeId, stream] of this.subscribers) {
      try {
        await this.sendClusters(stream);
        await this.sendRoutes(stream);
        await this.sendEndpoints(stream);
      } catch (error) {
        console.error(`Failed to push update to ${nodeId}:`, error);
      }
    }
  }
  
  /**
   * Get current version
   */
  private getVersion(): string {
    return `v${this.versionCounter}`;
  }
  
  /**
   * Generate nonce for response
   */
  private generateNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Start server
   */
  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            reject(error);
          } else {
            this.server.start();
            console.log(`xDS server listening on port ${port}`);
            resolve();
          }
        }
      );
    });
  }
}

export { XDSServer };
```

### Envoy Bootstrap Configuration

```yaml
# envoy-bootstrap.yaml
node:
  id: envoy-proxy-${POD_NAME}
  cluster: sandbox-proxies
  metadata:
    region: ${REGION}

admin:
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 9901

dynamic_resources:
  # Use ADS for all dynamic resources
  ads_config:
    api_type: GRPC
    transport_api_version: V3
    grpc_services:
      - envoy_grpc:
          cluster_name: xds_cluster
    set_node_on_first_message_only: true
  
  # Cluster Discovery Service
  cds_config:
    resource_api_version: V3
    ads: {}
  
  # Listener Discovery Service
  lds_config:
    resource_api_version: V3
    ads: {}

static_resources:
  clusters:
    # xDS server cluster
    - name: xds_cluster
      type: STRICT_DNS
      connect_timeout: 5s
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: xds_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: xds-server.sandbox-system.svc.cluster.local
                      port_value: 18000

layered_runtime:
  layers:
    - name: static_layer
      static_layer:
        overload:
          global_downstream_max_connections: 50000
```

### Why xDS Over Static Configuration

| Aspect | Static Config | xDS (Dynamic) |
|--------|---------------|---------------|
| **Config updates** | Requires restart | Hot reload |
| **Scalability** | Manual management | Automatic |
| **Consistency** | File sync needed | Centralized |
| **Latency** | Minutes | Seconds |
| **Complexity** | Simple | More complex |

**We chose xDS because:**
1. Sandboxes are created/destroyed frequently
2. Zero-downtime updates are required
3. Centralized control plane simplifies management
4. Health check integration is automatic

---

## Health Check Failure Handling

### Health Check Configuration

```yaml
# health-check-config.yaml
health_checks:
  - timeout: 2s
    interval: 10s
    unhealthy_threshold: 3
    healthy_threshold: 1
    
    http_health_check:
      path: /health
      expected_statuses:
        - start: 200
          end: 299
      
    # Custom headers for health check
    request_headers_to_add:
      - header:
          key: X-Health-Check
          value: "true"
    
    # Event logging
    event_log_path: /var/log/envoy/health_check.log
    
    # Always log health check events
    always_log_health_check_failures: true
```

### Failure Response Behavior

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           HEALTH CHECK FAILURE HANDLING                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  HEALTH CHECK FAILS                                                                     │
│        │                                                                                │
│        │ 3 consecutive failures                                                         │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  1. Endpoint marked UNHEALTHY                                                    │   │
│  │     • Removed from load balancer rotation                                       │   │
│  │     • Existing connections allowed to drain                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        │ New request arrives                                                            │
│        ▼                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  2. Check if sandbox is hibernating                                              │   │
│  │     • Query sandbox state from registry                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│        │                                                                                │
│        ├─────────────────────────────────────────┐                                      │
│        │                                         │                                      │
│        ▼ Hibernating                             ▼ Not hibernating                      │
│  ┌─────────────────────────┐              ┌─────────────────────────┐                  │
│  │  3a. Return WAKE PAGE   │              │  3b. Return 503 ERROR   │                  │
│  │      (custom HTML)      │              │      with retry header  │                  │
│  └─────────────────────────┘              └─────────────────────────┘                  │
│        │                                         │                                      │
│        │ Trigger wake                            │                                      │
│        ▼                                         ▼                                      │
│  ┌─────────────────────────┐              ┌─────────────────────────┐                  │
│  │  4a. Auto-refresh after │              │  4b. Client retries     │                  │
│  │      sandbox ready      │              │      or shows error     │                  │
│  └─────────────────────────┘              └─────────────────────────┘                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Custom Error Pages

```typescript
// error-page-handler.ts

interface ErrorPageConfig {
  hibernatingPage: string;
  errorPage: string;
  maintenancePage: string;
}

class ErrorPageHandler {
  private sandboxRegistry: SandboxRegistry;
  private wakeService: WakeService;
  
  /**
   * Handle unhealthy endpoint request
   */
  async handleUnhealthy(
    sandboxId: string,
    port: number,
    req: Request
  ): Promise<Response> {
    const sandbox = await this.sandboxRegistry.get(sandboxId);
    
    if (!sandbox) {
      return this.notFoundResponse();
    }
    
    switch (sandbox.state) {
      case 'hibernating':
        return this.hibernatingResponse(sandboxId, port);
        
      case 'starting':
        return this.startingResponse(sandboxId);
        
      case 'error':
        return this.errorResponse(sandbox.errorMessage);
        
      default:
        return this.serviceUnavailableResponse();
    }
  }
  
  /**
   * Response for hibernating sandbox
   */
  private hibernatingResponse(sandboxId: string, port: number): Response {
    // Trigger wake in background
    this.wakeService.wake(sandboxId).catch(console.error);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Waking up...</title>
  <meta http-equiv="refresh" content="3">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0a0a0a;
      color: #fafafa;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #333;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0 0 0.5rem;
    }
    p {
      color: #888;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Waking up your sandbox...</h1>
    <p>This page will refresh automatically</p>
  </div>
  <script>
    // Poll for readiness
    const checkReady = async () => {
      try {
        const res = await fetch('/health', { method: 'HEAD' });
        if (res.ok) {
          window.location.reload();
        }
      } catch (e) {
        // Still waking up
      }
    };
    setInterval(checkReady, 1000);
  </script>
</body>
</html>
    `;
    
    return new Response(html, {
      status: 503,
      headers: {
        'Content-Type': 'text/html',
        'Retry-After': '5',
        'X-Sandbox-State': 'hibernating',
      },
    });
  }
  
  /**
   * Response for starting sandbox
   */
  private startingResponse(sandboxId: string): Response {
    return new Response(
      JSON.stringify({
        status: 'starting',
        message: 'Sandbox is starting up...',
        retryAfter: 3,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '3',
          'X-Sandbox-State': 'starting',
        },
      }
    );
  }
  
  /**
   * Response for service unavailable
   */
  private serviceUnavailableResponse(): Response {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Service temporarily unavailable',
        retryAfter: 10,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '10',
        },
      }
    );
  }
  
  /**
   * Response for not found
   */
  private notFoundResponse(): Response {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Sandbox not found',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export { ErrorPageHandler };
```

### Envoy Local Reply Configuration

```yaml
# envoy-local-reply.yaml
http_filters:
  - name: envoy.filters.http.local_ratelimit
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
      stat_prefix: http_local_rate_limiter

  - name: envoy.filters.http.router
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

# Custom local reply for 503 errors
local_reply_config:
  mappers:
    # Hibernating sandbox
    - filter:
        header_filter:
          header:
            name: x-sandbox-state
            exact_match: hibernating
      status_code: 503
      body:
        inline_string: |
          {"status":"hibernating","message":"Sandbox is waking up...","retryAfter":5}
      body_format_override:
        json_format:
          status: "%RESPONSE_CODE%"
          message: "Sandbox is waking up..."
          retryAfter: 5
    
    # Generic 503
    - filter:
        status_code_filter:
          comparison:
            op: EQ
            value:
              default_value: 503
              runtime_key: local_reply_503
      body_format_override:
        json_format:
          status: "%RESPONSE_CODE%"
          message: "Service temporarily unavailable"
          retryAfter: 10
```

---

## WebSocket Upgrade Handling

### WebSocket Upgrade in Envoy

We handle WebSocket upgrades **in Envoy**, not nginx.

```yaml
# envoy-websocket-config.yaml
route_config:
  name: sandbox-routes
  virtual_hosts:
    - name: sandbox-vhost
      domains: ["*"]
      routes:
        - match:
            prefix: "/"
          route:
            cluster: sandbox-cluster
            timeout: 0s  # Disable timeout for WebSocket
            
            # Enable WebSocket upgrade
            upgrade_configs:
              - upgrade_type: websocket
                enabled: true
            
            # Also support other upgrades
              - upgrade_type: connect
                enabled: true
```

### WebSocket Upgrade Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           WEBSOCKET UPGRADE FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  BROWSER                        ENVOY                         SANDBOX                   │
│     │                             │                              │                      │
│     │  GET /_hmr HTTP/1.1         │                              │                      │
│     │  Upgrade: websocket         │                              │                      │
│     │  Connection: Upgrade        │                              │                      │
│     │  Sec-WebSocket-Key: xxx     │                              │                      │
│     │────────────────────────────▶│                              │                      │
│     │                             │                              │                      │
│     │                             │  1. Validate upgrade request │                      │
│     │                             │  2. Check route config       │                      │
│     │                             │  3. Forward to upstream      │                      │
│     │                             │                              │                      │
│     │                             │  GET /_hmr HTTP/1.1          │                      │
│     │                             │  Upgrade: websocket          │                      │
│     │                             │  Connection: Upgrade         │                      │
│     │                             │  Sec-WebSocket-Key: xxx      │                      │
│     │                             │─────────────────────────────▶│                      │
│     │                             │                              │                      │
│     │                             │  HTTP/1.1 101 Switching      │                      │
│     │                             │  Upgrade: websocket          │                      │
│     │                             │  Connection: Upgrade         │                      │
│     │                             │  Sec-WebSocket-Accept: yyy   │                      │
│     │                             │◀─────────────────────────────│                      │
│     │                             │                              │                      │
│     │  HTTP/1.1 101 Switching     │                              │                      │
│     │  Upgrade: websocket         │                              │                      │
│     │  Connection: Upgrade        │                              │                      │
│     │  Sec-WebSocket-Accept: yyy  │                              │                      │
│     │◀────────────────────────────│                              │                      │
│     │                             │                              │                      │
│     │◀═══════════════════════════════════════════════════════════▶│                      │
│     │            BIDIRECTIONAL WEBSOCKET CONNECTION              │                      │
│     │                                                            │                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### WebSocket Configuration Details

```typescript
// websocket-config.ts

interface WebSocketConfig {
  // Timeouts
  connectTimeout: number;      // Connection establishment
  idleTimeout: number;         // Idle connection timeout (0 = disabled)
  maxConnectionDuration: number; // Max lifetime (0 = unlimited)
  
  // Ping/pong
  pingInterval: number;        // Interval between pings
  pongTimeout: number;         // Wait time for pong response
  
  // Buffering
  maxFrameSize: number;        // Max WebSocket frame size
  maxMessageSize: number;      // Max message size (multiple frames)
  
  // Backpressure
  sendBufferSize: number;      // Send buffer size
  receiveBufferSize: number;   // Receive buffer size
}

const defaultWebSocketConfig: WebSocketConfig = {
  connectTimeout: 10000,       // 10 seconds
  idleTimeout: 0,              // Disabled (keep alive handles this)
  maxConnectionDuration: 0,    // Unlimited
  
  pingInterval: 30000,         // 30 seconds
  pongTimeout: 5000,           // 5 seconds
  
  maxFrameSize: 16384,         // 16 KB
  maxMessageSize: 1048576,     // 1 MB
  
  sendBufferSize: 65536,       // 64 KB
  receiveBufferSize: 65536,    // 64 KB
};

// Envoy cluster config for WebSocket
const envoyWebSocketCluster = {
  name: 'sandbox-cluster',
  type: 'STRICT_DNS',
  connect_timeout: '10s',
  
  // HTTP/1.1 for WebSocket (HTTP/2 doesn't support upgrade)
  typed_extension_protocol_options: {
    'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': {
      '@type': 'type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions',
      explicit_http_config: {
        http_protocol_options: {
          // Enable WebSocket upgrade
          enable_trailers: true,
        },
      },
      // Common options
      common_http_protocol_options: {
        idle_timeout: '3600s',  // 1 hour
        max_connection_duration: '0s',  // Unlimited
      },
    },
  },
  
  // Connection pool settings
  upstream_connection_options: {
    tcp_keepalive: {
      keepalive_probes: 3,
      keepalive_time: 30,
      keepalive_interval: 10,
    },
  },
};

export { WebSocketConfig, defaultWebSocketConfig, envoyWebSocketCluster };
```

### WebSocket Proxy Implementation

```typescript
// websocket-proxy.ts

import WebSocket from 'ws';
import { IncomingMessage } from 'http';

class WebSocketProxy {
  private clientToServer: Map<WebSocket, WebSocket> = new Map();
  private serverToClient: Map<WebSocket, WebSocket> = new Map();
  
  /**
   * Handle WebSocket upgrade
   */
  handleUpgrade(
    req: IncomingMessage,
    socket: any,
    head: Buffer,
    targetUrl: string
  ): void {
    // Create upstream connection
    const upstream = new WebSocket(targetUrl, {
      headers: this.filterHeaders(req.headers),
    });
    
    upstream.on('open', () => {
      // Create client WebSocket
      const wss = new WebSocket.Server({ noServer: true });
      
      wss.handleUpgrade(req, socket, head, (client) => {
        this.setupProxy(client, upstream);
      });
    });
    
    upstream.on('error', (error) => {
      console.error('Upstream WebSocket error:', error);
      socket.destroy();
    });
  }
  
  /**
   * Setup bidirectional proxy
   */
  private setupProxy(client: WebSocket, server: WebSocket): void {
    this.clientToServer.set(client, server);
    this.serverToClient.set(server, client);
    
    // Client → Server
    client.on('message', (data, isBinary) => {
      if (server.readyState === WebSocket.OPEN) {
        server.send(data, { binary: isBinary });
      }
    });
    
    // Server → Client
    server.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
    
    // Handle close
    client.on('close', (code, reason) => {
      server.close(code, reason);
      this.cleanup(client, server);
    });
    
    server.on('close', (code, reason) => {
      client.close(code, reason);
      this.cleanup(client, server);
    });
    
    // Handle errors
    client.on('error', (error) => {
      console.error('Client WebSocket error:', error);
      server.close();
    });
    
    server.on('error', (error) => {
      console.error('Server WebSocket error:', error);
      client.close();
    });
    
    // Ping/pong keep-alive
    this.setupKeepAlive(client, server);
  }
  
  /**
   * Setup keep-alive ping/pong
   */
  private setupKeepAlive(client: WebSocket, server: WebSocket): void {
    const pingInterval = setInterval(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
      if (server.readyState === WebSocket.OPEN) {
        server.ping();
      }
    }, 30000);
    
    client.on('close', () => clearInterval(pingInterval));
    server.on('close', () => clearInterval(pingInterval));
  }
  
  /**
   * Cleanup connections
   */
  private cleanup(client: WebSocket, server: WebSocket): void {
    this.clientToServer.delete(client);
    this.serverToClient.delete(server);
  }
  
  /**
   * Filter headers for upstream
   */
  private filterHeaders(headers: any): Record<string, string> {
    const filtered: Record<string, string> = {};
    const skipHeaders = new Set([
      'host',
      'connection',
      'upgrade',
      'sec-websocket-key',
      'sec-websocket-version',
      'sec-websocket-extensions',
    ]);
    
    for (const [key, value] of Object.entries(headers)) {
      if (!skipHeaders.has(key.toLowerCase()) && typeof value === 'string') {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }
}

export { WebSocketProxy };
```

---

## Maximum Ports Per Sandbox

### Port Limits

| Tier | Max Ports | Reason |
|------|-----------|--------|
| **Free** | 5 | Resource conservation |
| **Pro** | 10 | Standard development |
| **Enterprise** | 25 | Complex microservices |

### Port Limit Implementation

```typescript
// port-limiter.ts

interface PortLimitConfig {
  free: number;
  pro: number;
  enterprise: number;
}

const portLimits: PortLimitConfig = {
  free: 5,
  pro: 10,
  enterprise: 25,
};

class PortLimiter {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  /**
   * Check if sandbox can expose another port
   */
  async canExpose(sandboxId: string, tier: keyof PortLimitConfig): Promise<boolean> {
    const currentCount = await this.getPortCount(sandboxId);
    const limit = portLimits[tier];
    
    return currentCount < limit;
  }
  
  /**
   * Get current port count
   */
  async getPortCount(sandboxId: string): Promise<number> {
    return await this.redis.hlen(`sandbox:${sandboxId}:ports`);
  }
  
  /**
   * Get remaining port quota
   */
  async getRemainingQuota(
    sandboxId: string,
    tier: keyof PortLimitConfig
  ): Promise<number> {
    const currentCount = await this.getPortCount(sandboxId);
    const limit = portLimits[tier];
    
    return Math.max(0, limit - currentCount);
  }
  
  /**
   * Expose port with limit check
   */
  async exposePort(
    sandboxId: string,
    port: number,
    tier: keyof PortLimitConfig
  ): Promise<{ success: boolean; error?: string }> {
    // Check limit
    if (!(await this.canExpose(sandboxId, tier))) {
      return {
        success: false,
        error: `Port limit (${portLimits[tier]}) reached. Upgrade to expose more ports.`,
      };
    }
    
    // Check if port already exposed
    const existing = await this.redis.hget(
      `sandbox:${sandboxId}:ports`,
      port.toString()
    );
    
    if (existing) {
      // Idempotent - return success for already exposed port
      return { success: true };
    }
    
    // Expose the port
    await this.redis.hset(
      `sandbox:${sandboxId}:ports`,
      port.toString(),
      JSON.stringify({
        port,
        exposedAt: new Date().toISOString(),
      })
    );
    
    return { success: true };
  }
}

export { PortLimiter, portLimits };
```

### Port Allocation Kubernetes Resource

```yaml
# port-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: sandbox-port-quota
  namespace: sandbox-${SANDBOX_ID}
spec:
  hard:
    # Limit services (each exposed port creates a service)
    services: "10"
    
    # Limit endpoints
    endpoints: "10"
    
    # Limit NodePorts (if using NodePort services)
    services.nodeports: "0"  # Disabled, use ClusterIP + Ingress
```

---

## Summary

### URL Collision Prevention

| Mechanism | Implementation |
|-----------|---------------|
| **Unique sandbox ID** | 12-char base62 (3.2×10²¹ possibilities) |
| **Port in subdomain** | `{port}-{sandboxId}.region.domain` |
| **Collision check** | Redis SETNX on ID reservation |

### Envoy Configuration

| Aspect | Choice | Reason |
|--------|--------|--------|
| **Config method** | xDS (ADS) | Dynamic updates |
| **Protocol** | gRPC | Efficient streaming |
| **Update latency** | <1 second | Real-time routing |

### Health Check Failure

| State | Response | Action |
|-------|----------|--------|
| **Hibernating** | 503 + wake page | Auto-refresh |
| **Starting** | 503 + retry | Wait |
| **Error** | 503 + error | Manual intervention |
| **Not found** | 404 | N/A |

### WebSocket Handling

| Aspect | Implementation |
|--------|---------------|
| **Upgrade handler** | Envoy (not nginx) |
| **Protocol** | HTTP/1.1 (required for upgrade) |
| **Keep-alive** | Ping/pong every 30s |
| **Timeout** | Disabled for WebSocket |

### Port Limits

| Tier | Max Ports |
|------|-----------|
| Free | 5 |
| Pro | 10 |
| Enterprise | 25 |
