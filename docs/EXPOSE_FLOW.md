# Expose Flow: Complete Implementation Guide

This guide provides comprehensive coverage of the `expose({ port: 3000 })` flow, from API call to accessible URL, including internal routing, health checks, and TTL handling.

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Flow Diagram](#complete-flow-diagram)
3. [API Implementation](#api-implementation)
4. [Validation Layer](#validation-layer)
5. [URL Generation](#url-generation)
6. [Service Registration](#service-registration)
7. [Envoy Routing Configuration](#envoy-routing-configuration)
8. [Health Check Setup](#health-check-setup)
9. [TTL and Expiration](#ttl-and-expiration)
10. [Error Handling](#error-handling)
11. [Timing Breakdown](#timing-breakdown)

---

## Overview

The `expose()` function makes a local port in a sandbox accessible via a public URL. This involves:

1. **Validation** - Verify port and sandbox state
2. **URL Generation** - Create unique, stable URL
3. **Registration** - Store mapping in Redis
4. **Routing** - Configure Envoy to route traffic
5. **Health Check** - Verify service is responding
6. **TTL Management** - Handle expiration

### Function Signature

```typescript
interface ExposeOptions {
  port: number;
  protocol?: 'http' | 'ws';
  healthCheck?: {
    path?: string;
    interval?: number;
    timeout?: number;
  };
  ttl?: number;  // seconds, 0 = no expiration
}

interface ExposeResult {
  url: string;
  port: number;
  status: 'active' | 'pending';
  expiresAt?: Date;
}

async function expose(options: ExposeOptions): Promise<ExposeResult>;
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           expose({ port: 3000 }) COMPLETE FLOW                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  T+0ms          T+5ms         T+50ms        T+100ms       T+200ms       T+500ms        │
│    │              │             │              │             │             │            │
│    ▼              ▼             ▼              ▼             ▼             ▼            │
│  ┌────┐        ┌────┐        ┌────┐        ┌────┐        ┌────┐        ┌────┐         │
│  │API │        │Vali│        │Regi│        │Envy│        │Hlth│        │URL │         │
│  │Call│───────▶│date│───────▶│ster│───────▶│Updt│───────▶│Chck│───────▶│Rtrn│         │
│  └────┘        └────┘        └────┘        └────┘        └────┘        └────┘         │
│                                                                                         │
│  Details:                                                                               │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  1. API Call (T+0ms)                                                                   │
│     • Receive expose({ port: 3000 }) request                                           │
│     • Extract sandbox context from request                                             │
│                                                                                         │
│  2. Validation (T+5ms)                                                                 │
│     • Validate port range (1-65535)                                                    │
│     • Check sandbox status (must be running)                                           │
│     • Verify port limit not exceeded                                                   │
│     • Check for existing exposure (idempotent)                                         │
│                                                                                         │
│  3. Registration (T+50ms)                                                              │
│     • Generate URL: https://3000-{sandboxId}.{region}.manus.computer                   │
│     • Store in Redis: URL → internal address mapping                                   │
│     • Set TTL if specified                                                             │
│                                                                                         │
│  4. Envoy Update (T+100ms)                                                             │
│     • Push endpoint to Envoy via xDS                                                   │
│     • Configure routing rules                                                          │
│     • Enable WebSocket upgrade if needed                                               │
│                                                                                         │
│  5. Health Check (T+200ms)                                                             │
│     • Perform initial health check                                                     │
│     • Mark endpoint as healthy/unhealthy                                               │
│     • Start periodic health checks                                                     │
│                                                                                         │
│  6. Return URL (T+500ms)                                                               │
│     • Return public URL to caller                                                      │
│     • Include status and expiration info                                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## API Implementation

### Main Expose Function

```typescript
// src/services/expose.ts

import { Redis } from 'ioredis';
import { EnvoyControlPlane } from './envoyControlPlane';
import { HealthChecker } from './healthChecker';
import { PreviewUrlGenerator } from './previewUrlGenerator';

interface ExposeContext {
  sandboxId: string;
  sandboxIp: string;
  region: string;
}

class ExposeService {
  private redis: Redis;
  private envoy: EnvoyControlPlane;
  private healthChecker: HealthChecker;
  private urlGenerator: PreviewUrlGenerator;
  
  constructor(deps: {
    redis: Redis;
    envoy: EnvoyControlPlane;
    healthChecker: HealthChecker;
  }) {
    this.redis = deps.redis;
    this.envoy = deps.envoy;
    this.healthChecker = deps.healthChecker;
    this.urlGenerator = new PreviewUrlGenerator({
      baseDomain: process.env.BASE_DOMAIN || 'manus.computer',
      region: process.env.REGION || 'us2',
      protocol: 'https',
    });
  }
  
  async expose(
    ctx: ExposeContext,
    options: ExposeOptions
  ): Promise<ExposeResult> {
    const startTime = Date.now();
    
    // Step 1: Validation
    await this.validate(ctx, options);
    console.log(`[expose] Validation completed in ${Date.now() - startTime}ms`);
    
    // Step 2: Check for existing exposure (idempotent)
    const existing = await this.getExisting(ctx.sandboxId, options.port);
    if (existing) {
      console.log(`[expose] Returning existing URL: ${existing.url}`);
      return existing;
    }
    
    // Step 3: Generate URL
    const { url } = this.urlGenerator.generate(ctx.sandboxId, options.port);
    console.log(`[expose] Generated URL: ${url}`);
    
    // Step 4: Register in Redis
    const registration = await this.register(ctx, options, url);
    console.log(`[expose] Registered in ${Date.now() - startTime}ms`);
    
    // Step 5: Update Envoy routing
    await this.updateEnvoy(ctx, options);
    console.log(`[expose] Envoy updated in ${Date.now() - startTime}ms`);
    
    // Step 6: Start health checks
    this.healthChecker.startChecking({
      sandboxId: ctx.sandboxId,
      port: options.port,
      internalAddress: `${ctx.sandboxIp}:${options.port}`,
      healthPath: options.healthCheck?.path || '/',
      interval: options.healthCheck?.interval || 10000,
      timeout: options.healthCheck?.timeout || 5000,
    });
    
    // Step 7: Perform initial health check
    const healthy = await this.healthChecker.checkOnce(
      `${ctx.sandboxIp}:${options.port}`,
      options.healthCheck?.path || '/'
    );
    
    console.log(`[expose] Total time: ${Date.now() - startTime}ms`);
    
    return {
      url,
      port: options.port,
      status: healthy ? 'active' : 'pending',
      expiresAt: registration.expiresAt,
    };
  }
  
  async unexpose(sandboxId: string, port: number): Promise<void> {
    // Stop health checks
    this.healthChecker.stopChecking(sandboxId, port);
    
    // Remove from Redis
    await this.redis.del(`expose:${sandboxId}:${port}`);
    await this.redis.srem(`sandbox:${sandboxId}:ports`, port.toString());
    
    // Update Envoy
    await this.envoy.removeEndpoint(sandboxId, port);
    
    console.log(`[unexpose] Removed ${sandboxId}:${port}`);
  }
  
  async unexposeAll(sandboxId: string): Promise<void> {
    const ports = await this.redis.smembers(`sandbox:${sandboxId}:ports`);
    
    for (const port of ports) {
      await this.unexpose(sandboxId, parseInt(port, 10));
    }
  }
  
  private async validate(ctx: ExposeContext, options: ExposeOptions): Promise<void> {
    // Validate port range
    if (options.port < 1 || options.port > 65535) {
      throw new ExposeError('INVALID_PORT', `Port must be between 1 and 65535`);
    }
    
    // Check reserved ports
    const reservedPorts = [22, 25, 53, 80, 443, 465, 587, 993, 995];
    if (reservedPorts.includes(options.port)) {
      throw new ExposeError('RESERVED_PORT', `Port ${options.port} is reserved`);
    }
    
    // Check sandbox status
    const sandboxStatus = await this.redis.hget(`sandbox:${ctx.sandboxId}`, 'status');
    if (sandboxStatus !== 'running') {
      throw new ExposeError('SANDBOX_NOT_RUNNING', `Sandbox is ${sandboxStatus}`);
    }
    
    // Check port limit
    const exposedPorts = await this.redis.scard(`sandbox:${ctx.sandboxId}:ports`);
    const maxPorts = 10;
    if (exposedPorts >= maxPorts) {
      throw new ExposeError('PORT_LIMIT_EXCEEDED', `Maximum ${maxPorts} ports allowed`);
    }
  }
  
  private async getExisting(
    sandboxId: string,
    port: number
  ): Promise<ExposeResult | null> {
    const data = await this.redis.hgetall(`expose:${sandboxId}:${port}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      url: data.url,
      port: parseInt(data.port, 10),
      status: data.status as 'active' | 'pending',
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    };
  }
  
  private async register(
    ctx: ExposeContext,
    options: ExposeOptions,
    url: string
  ): Promise<{ expiresAt?: Date }> {
    const key = `expose:${ctx.sandboxId}:${options.port}`;
    const now = new Date();
    
    const data: Record<string, string> = {
      url,
      port: options.port.toString(),
      sandboxId: ctx.sandboxId,
      sandboxIp: ctx.sandboxIp,
      region: ctx.region,
      protocol: options.protocol || 'http',
      status: 'pending',
      createdAt: now.toISOString(),
    };
    
    let expiresAt: Date | undefined;
    
    if (options.ttl && options.ttl > 0) {
      expiresAt = new Date(now.getTime() + options.ttl * 1000);
      data.expiresAt = expiresAt.toISOString();
    }
    
    // Store in Redis
    await this.redis.hset(key, data);
    
    // Set TTL if specified
    if (options.ttl && options.ttl > 0) {
      await this.redis.expire(key, options.ttl);
    }
    
    // Track exposed ports for this sandbox
    await this.redis.sadd(`sandbox:${ctx.sandboxId}:ports`, options.port.toString());
    
    return { expiresAt };
  }
  
  private async updateEnvoy(ctx: ExposeContext, options: ExposeOptions): Promise<void> {
    await this.envoy.addEndpoint({
      sandboxId: ctx.sandboxId,
      port: options.port,
      address: ctx.sandboxIp,
      internalPort: options.port,
      protocol: options.protocol || 'http',
      enableWebSocket: options.protocol === 'ws',
    });
  }
}

class ExposeError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ExposeError';
  }
}

export const exposeService = new ExposeService({
  redis: new Redis(process.env.REDIS_URL),
  envoy: new EnvoyControlPlane(),
  healthChecker: new HealthChecker(),
});
```

---

## Validation Layer

### Comprehensive Validation

```typescript
// src/services/validation.ts

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

class ExposeValidator {
  private reservedPorts = new Set([
    22,    // SSH
    25,    // SMTP
    53,    // DNS
    80,    // HTTP (use 443 instead)
    443,   // HTTPS (handled by proxy)
    465,   // SMTPS
    587,   // Submission
    993,   // IMAPS
    995,   // POP3S
  ]);
  
  private maxPortsPerSandbox = 10;
  private maxTtl = 7 * 24 * 60 * 60; // 7 days
  
  async validate(
    ctx: ExposeContext,
    options: ExposeOptions,
    redis: Redis
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Port validation
    if (!Number.isInteger(options.port)) {
      errors.push({
        code: 'INVALID_PORT_TYPE',
        message: 'Port must be an integer',
        field: 'port',
      });
    } else if (options.port < 1 || options.port > 65535) {
      errors.push({
        code: 'PORT_OUT_OF_RANGE',
        message: 'Port must be between 1 and 65535',
        field: 'port',
      });
    } else if (this.reservedPorts.has(options.port)) {
      errors.push({
        code: 'RESERVED_PORT',
        message: `Port ${options.port} is reserved for system use`,
        field: 'port',
      });
    }
    
    // Protocol validation
    if (options.protocol && !['http', 'ws'].includes(options.protocol)) {
      errors.push({
        code: 'INVALID_PROTOCOL',
        message: 'Protocol must be "http" or "ws"',
        field: 'protocol',
      });
    }
    
    // TTL validation
    if (options.ttl !== undefined) {
      if (!Number.isInteger(options.ttl) || options.ttl < 0) {
        errors.push({
          code: 'INVALID_TTL',
          message: 'TTL must be a non-negative integer',
          field: 'ttl',
        });
      } else if (options.ttl > this.maxTtl) {
        errors.push({
          code: 'TTL_TOO_LONG',
          message: `TTL cannot exceed ${this.maxTtl} seconds (7 days)`,
          field: 'ttl',
        });
      }
    }
    
    // Health check validation
    if (options.healthCheck) {
      if (options.healthCheck.interval && options.healthCheck.interval < 1000) {
        errors.push({
          code: 'HEALTH_CHECK_INTERVAL_TOO_SHORT',
          message: 'Health check interval must be at least 1000ms',
          field: 'healthCheck.interval',
        });
      }
      if (options.healthCheck.timeout && options.healthCheck.timeout < 100) {
        errors.push({
          code: 'HEALTH_CHECK_TIMEOUT_TOO_SHORT',
          message: 'Health check timeout must be at least 100ms',
          field: 'healthCheck.timeout',
        });
      }
    }
    
    // Sandbox state validation
    const sandboxStatus = await redis.hget(`sandbox:${ctx.sandboxId}`, 'status');
    if (!sandboxStatus) {
      errors.push({
        code: 'SANDBOX_NOT_FOUND',
        message: 'Sandbox does not exist',
      });
    } else if (sandboxStatus !== 'running') {
      errors.push({
        code: 'SANDBOX_NOT_RUNNING',
        message: `Sandbox is ${sandboxStatus}, must be running`,
      });
    }
    
    // Port limit validation
    const exposedCount = await redis.scard(`sandbox:${ctx.sandboxId}:ports`);
    const existingPort = await redis.exists(`expose:${ctx.sandboxId}:${options.port}`);
    
    if (!existingPort && exposedCount >= this.maxPortsPerSandbox) {
      errors.push({
        code: 'PORT_LIMIT_EXCEEDED',
        message: `Maximum ${this.maxPortsPerSandbox} exposed ports per sandbox`,
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const exposeValidator = new ExposeValidator();
```

---

## URL Generation

### URL Generator Implementation

```typescript
// src/services/previewUrlGenerator.ts

interface UrlGeneratorConfig {
  baseDomain: string;
  region: string;
  protocol: 'http' | 'https';
}

interface GeneratedUrl {
  url: string;
  host: string;
  subdomain: string;
}

class PreviewUrlGenerator {
  constructor(private config: UrlGeneratorConfig) {}
  
  generate(sandboxId: string, port: number): GeneratedUrl {
    // Format: {port}-{sandboxId}.{region}.{baseDomain}
    const subdomain = `${port}-${sandboxId}`;
    const host = `${subdomain}.${this.config.region}.${this.config.baseDomain}`;
    const url = `${this.config.protocol}://${host}`;
    
    return { url, host, subdomain };
  }
  
  parse(url: string): { sandboxId: string; port: number; region: string } | null {
    try {
      const parsed = new URL(url);
      const hostParts = parsed.hostname.split('.');
      
      if (hostParts.length < 3) return null;
      
      const [portAndId, region] = hostParts;
      const dashIndex = portAndId.indexOf('-');
      
      if (dashIndex === -1) return null;
      
      const port = parseInt(portAndId.substring(0, dashIndex), 10);
      const sandboxId = portAndId.substring(dashIndex + 1);
      
      if (isNaN(port)) return null;
      
      return { sandboxId, port, region };
    } catch {
      return null;
    }
  }
}

export { PreviewUrlGenerator };
```

---

## Service Registration

### Redis Data Model

```typescript
// Redis key structure for expose

// Per-port exposure data
// Key: expose:{sandboxId}:{port}
// Type: Hash
{
  url: "https://3000-abc123.us2.manus.computer",
  port: "3000",
  sandboxId: "abc123",
  sandboxIp: "10.0.1.50",
  region: "us2",
  protocol: "http",
  status: "active",  // pending | active | unhealthy
  createdAt: "2024-01-15T10:30:00Z",
  expiresAt: "2024-01-15T11:30:00Z",  // optional
  lastHealthCheck: "2024-01-15T10:35:00Z",
  healthCheckFailures: "0"
}

// Sandbox's exposed ports set
// Key: sandbox:{sandboxId}:ports
// Type: Set
["3000", "5173", "8080"]

// URL to sandbox mapping (for routing)
// Key: url:{host}
// Type: String
"abc123:3000"
```

### Registration Service

```typescript
// src/services/registration.ts

class RegistrationService {
  constructor(private redis: Redis) {}
  
  async register(
    sandboxId: string,
    port: number,
    data: {
      url: string;
      sandboxIp: string;
      region: string;
      protocol: string;
      ttl?: number;
    }
  ): Promise<void> {
    const key = `expose:${sandboxId}:${port}`;
    const now = new Date();
    
    const hashData: Record<string, string> = {
      url: data.url,
      port: port.toString(),
      sandboxId,
      sandboxIp: data.sandboxIp,
      region: data.region,
      protocol: data.protocol,
      status: 'pending',
      createdAt: now.toISOString(),
      healthCheckFailures: '0',
    };
    
    if (data.ttl) {
      hashData.expiresAt = new Date(now.getTime() + data.ttl * 1000).toISOString();
    }
    
    // Use transaction for atomicity
    const multi = this.redis.multi();
    
    // Store exposure data
    multi.hset(key, hashData);
    
    // Set TTL if specified
    if (data.ttl) {
      multi.expire(key, data.ttl);
    }
    
    // Add to sandbox's port set
    multi.sadd(`sandbox:${sandboxId}:ports`, port.toString());
    
    // Create URL mapping for routing
    const host = new URL(data.url).hostname;
    multi.set(`url:${host}`, `${sandboxId}:${port}`);
    
    await multi.exec();
  }
  
  async updateStatus(
    sandboxId: string,
    port: number,
    status: 'pending' | 'active' | 'unhealthy'
  ): Promise<void> {
    await this.redis.hset(`expose:${sandboxId}:${port}`, 'status', status);
  }
  
  async deregister(sandboxId: string, port: number): Promise<void> {
    const data = await this.redis.hgetall(`expose:${sandboxId}:${port}`);
    
    if (!data.url) return;
    
    const host = new URL(data.url).hostname;
    
    const multi = this.redis.multi();
    multi.del(`expose:${sandboxId}:${port}`);
    multi.srem(`sandbox:${sandboxId}:ports`, port.toString());
    multi.del(`url:${host}`);
    await multi.exec();
  }
}

export const registrationService = new RegistrationService(redis);
```

---

## Envoy Routing Configuration

### xDS Control Plane

```typescript
// src/services/envoyControlPlane.ts

interface Endpoint {
  sandboxId: string;
  port: number;
  address: string;
  internalPort: number;
  protocol: 'http' | 'ws';
  enableWebSocket: boolean;
}

class EnvoyControlPlane {
  private endpoints: Map<string, Endpoint> = new Map();
  private subscribers: Set<any> = new Set();
  private version = 0;
  
  async addEndpoint(endpoint: Endpoint): Promise<void> {
    const key = `${endpoint.sandboxId}:${endpoint.port}`;
    this.endpoints.set(key, endpoint);
    
    this.version++;
    await this.pushUpdate();
  }
  
  async removeEndpoint(sandboxId: string, port: number): Promise<void> {
    const key = `${sandboxId}:${port}`;
    this.endpoints.delete(key);
    
    this.version++;
    await this.pushUpdate();
  }
  
  async updateEndpointHealth(
    sandboxId: string,
    port: number,
    healthy: boolean
  ): Promise<void> {
    const key = `${sandboxId}:${port}`;
    const endpoint = this.endpoints.get(key);
    
    if (endpoint) {
      // Update health status in Envoy
      await this.pushHealthUpdate(endpoint, healthy);
    }
  }
  
  private async pushUpdate(): Promise<void> {
    const clusters = this.buildClusters();
    const routes = this.buildRoutes();
    
    const response = {
      version_info: this.version.toString(),
      resources: [...clusters, ...routes],
    };
    
    for (const subscriber of this.subscribers) {
      subscriber.write(response);
    }
  }
  
  private buildClusters(): any[] {
    const clusters: any[] = [];
    
    for (const [key, endpoint] of this.endpoints) {
      clusters.push({
        '@type': 'type.googleapis.com/envoy.config.cluster.v3.Cluster',
        name: `sandbox_${key.replace(':', '_')}`,
        type: 'STRICT_DNS',
        connect_timeout: '5s',
        lb_policy: 'ROUND_ROBIN',
        load_assignment: {
          cluster_name: `sandbox_${key.replace(':', '_')}`,
          endpoints: [{
            lb_endpoints: [{
              endpoint: {
                address: {
                  socket_address: {
                    address: endpoint.address,
                    port_value: endpoint.internalPort,
                  },
                },
              },
            }],
          }],
        },
        health_checks: [{
          timeout: '5s',
          interval: '10s',
          unhealthy_threshold: 3,
          healthy_threshold: 1,
          http_health_check: {
            path: '/health',
          },
        }],
      });
    }
    
    return clusters;
  }
  
  private buildRoutes(): any[] {
    const virtualHosts: any[] = [];
    
    for (const [key, endpoint] of this.endpoints) {
      const [sandboxId, port] = key.split(':');
      const domain = `${port}-${sandboxId}.*.manus.computer`;
      
      virtualHosts.push({
        name: `vh_${key.replace(':', '_')}`,
        domains: [domain],
        routes: [{
          match: { prefix: '/' },
          route: {
            cluster: `sandbox_${key.replace(':', '_')}`,
            timeout: '60s',
            upgrade_configs: endpoint.enableWebSocket ? [{
              upgrade_type: 'websocket',
            }] : [],
          },
        }],
      });
    }
    
    return [{
      '@type': 'type.googleapis.com/envoy.config.route.v3.RouteConfiguration',
      name: 'sandbox_routes',
      virtual_hosts: virtualHosts,
    }];
  }
  
  private async pushHealthUpdate(endpoint: Endpoint, healthy: boolean): Promise<void> {
    // EDS health update
    const key = `${endpoint.sandboxId}:${endpoint.port}`;
    
    const response = {
      version_info: `health_${Date.now()}`,
      resources: [{
        '@type': 'type.googleapis.com/envoy.config.endpoint.v3.ClusterLoadAssignment',
        cluster_name: `sandbox_${key.replace(':', '_')}`,
        endpoints: [{
          lb_endpoints: [{
            endpoint: {
              address: {
                socket_address: {
                  address: endpoint.address,
                  port_value: endpoint.internalPort,
                },
              },
            },
            health_status: healthy ? 'HEALTHY' : 'UNHEALTHY',
          }],
        }],
      }],
    };
    
    for (const subscriber of this.subscribers) {
      subscriber.write(response);
    }
  }
  
  handleStream(stream: any): void {
    this.subscribers.add(stream);
    
    // Send current state
    this.pushUpdate();
    
    stream.on('end', () => {
      this.subscribers.delete(stream);
    });
  }
}

export const envoyControlPlane = new EnvoyControlPlane();
```

---

## Health Check Setup

### Health Checker Implementation

```typescript
// src/services/healthChecker.ts

interface HealthCheckConfig {
  sandboxId: string;
  port: number;
  internalAddress: string;
  healthPath: string;
  interval: number;
  timeout: number;
}

interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
}

class HealthChecker {
  private checks: Map<string, NodeJS.Timeout> = new Map();
  private status: Map<string, HealthStatus> = new Map();
  private redis: Redis;
  private envoy: EnvoyControlPlane;
  
  constructor(redis: Redis, envoy: EnvoyControlPlane) {
    this.redis = redis;
    this.envoy = envoy;
  }
  
  startChecking(config: HealthCheckConfig): void {
    const key = `${config.sandboxId}:${config.port}`;
    
    // Stop existing check if any
    this.stopChecking(config.sandboxId, config.port);
    
    // Initialize status
    this.status.set(key, {
      healthy: false,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });
    
    // Start periodic checks
    const timer = setInterval(async () => {
      await this.performCheck(config);
    }, config.interval);
    
    this.checks.set(key, timer);
    
    // Perform initial check
    this.performCheck(config);
  }
  
  stopChecking(sandboxId: string, port: number): void {
    const key = `${sandboxId}:${port}`;
    
    const timer = this.checks.get(key);
    if (timer) {
      clearInterval(timer);
      this.checks.delete(key);
    }
    
    this.status.delete(key);
  }
  
  async checkOnce(address: string, path: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`http://${address}${path}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private async performCheck(config: HealthCheckConfig): Promise<void> {
    const key = `${config.sandboxId}:${config.port}`;
    const currentStatus = this.status.get(key);
    
    if (!currentStatus) return;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout);
      
      const response = await fetch(
        `http://${config.internalAddress}${config.healthPath}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeout);
      
      if (response.ok) {
        await this.markHealthy(config, currentStatus);
      } else {
        await this.markUnhealthy(config, currentStatus, `HTTP ${response.status}`);
      }
    } catch (error) {
      await this.markUnhealthy(config, currentStatus, error.message);
    }
  }
  
  private async markHealthy(
    config: HealthCheckConfig,
    status: HealthStatus
  ): Promise<void> {
    const key = `${config.sandboxId}:${config.port}`;
    const wasUnhealthy = !status.healthy;
    
    status.healthy = true;
    status.lastCheck = new Date();
    status.consecutiveFailures = 0;
    status.lastError = undefined;
    
    this.status.set(key, status);
    
    // Update Redis
    await this.redis.hset(`expose:${key}`, {
      status: 'active',
      lastHealthCheck: status.lastCheck.toISOString(),
      healthCheckFailures: '0',
    });
    
    // Update Envoy if status changed
    if (wasUnhealthy) {
      await this.envoy.updateEndpointHealth(config.sandboxId, config.port, true);
      console.log(`[health] ${key} is now healthy`);
    }
  }
  
  private async markUnhealthy(
    config: HealthCheckConfig,
    status: HealthStatus,
    error: string
  ): Promise<void> {
    const key = `${config.sandboxId}:${config.port}`;
    const wasHealthy = status.healthy;
    
    status.lastCheck = new Date();
    status.consecutiveFailures++;
    status.lastError = error;
    
    // Only mark unhealthy after threshold
    const unhealthyThreshold = 3;
    if (status.consecutiveFailures >= unhealthyThreshold) {
      status.healthy = false;
    }
    
    this.status.set(key, status);
    
    // Update Redis
    await this.redis.hset(`expose:${key}`, {
      status: status.healthy ? 'active' : 'unhealthy',
      lastHealthCheck: status.lastCheck.toISOString(),
      healthCheckFailures: status.consecutiveFailures.toString(),
    });
    
    // Update Envoy if status changed
    if (wasHealthy && !status.healthy) {
      await this.envoy.updateEndpointHealth(config.sandboxId, config.port, false);
      console.log(`[health] ${key} is now unhealthy: ${error}`);
    }
  }
  
  getStatus(sandboxId: string, port: number): HealthStatus | undefined {
    return this.status.get(`${sandboxId}:${port}`);
  }
}

export const healthChecker = new HealthChecker(redis, envoyControlPlane);
```

---

## TTL and Expiration

### Expiration Manager

```typescript
// src/services/expirationManager.ts

class ExpirationManager {
  private redis: Redis;
  private exposeService: ExposeService;
  private checkInterval: NodeJS.Timeout | null = null;
  
  constructor(redis: Redis, exposeService: ExposeService) {
    this.redis = redis;
    this.exposeService = exposeService;
  }
  
  start(): void {
    // Check for expired exposures every minute
    this.checkInterval = setInterval(async () => {
      await this.checkExpirations();
    }, 60 * 1000);
    
    // Also check immediately
    this.checkExpirations();
  }
  
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  private async checkExpirations(): Promise<void> {
    // Redis handles TTL automatically for keys with EXPIRE
    // This is for additional cleanup and logging
    
    const pattern = 'expose:*:*';
    const keys = await this.scanKeys(pattern);
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      
      // TTL of -2 means key doesn't exist (already expired)
      // TTL of -1 means no expiration set
      if (ttl === -2) {
        // Key expired, clean up related data
        const [, sandboxId, port] = key.split(':');
        await this.cleanupExpired(sandboxId, parseInt(port, 10));
      } else if (ttl > 0 && ttl < 300) {
        // Less than 5 minutes until expiration, log warning
        console.log(`[expiration] ${key} expires in ${ttl} seconds`);
      }
    }
  }
  
  private async cleanupExpired(sandboxId: string, port: number): Promise<void> {
    console.log(`[expiration] Cleaning up expired exposure: ${sandboxId}:${port}`);
    
    // Remove from sandbox's port set
    await this.redis.srem(`sandbox:${sandboxId}:ports`, port.toString());
    
    // Stop health checks
    healthChecker.stopChecking(sandboxId, port);
    
    // Remove from Envoy
    await envoyControlPlane.removeEndpoint(sandboxId, port);
  }
  
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    
    return keys;
  }
  
  async extendTtl(sandboxId: string, port: number, additionalSeconds: number): Promise<void> {
    const key = `expose:${sandboxId}:${port}`;
    const currentTtl = await this.redis.ttl(key);
    
    if (currentTtl > 0) {
      const newTtl = currentTtl + additionalSeconds;
      await this.redis.expire(key, newTtl);
      
      // Update expiresAt field
      const expiresAt = new Date(Date.now() + newTtl * 1000);
      await this.redis.hset(key, 'expiresAt', expiresAt.toISOString());
    }
  }
}

export const expirationManager = new ExpirationManager(redis, exposeService);
```

### Idle Expiration

```typescript
// src/services/idleExpiration.ts

class IdleExpirationManager {
  private lastActivity: Map<string, Date> = new Map();
  private idleTimeout = 30 * 60 * 1000; // 30 minutes
  
  recordActivity(sandboxId: string, port: number): void {
    const key = `${sandboxId}:${port}`;
    this.lastActivity.set(key, new Date());
  }
  
  async checkIdleExposures(): Promise<void> {
    const now = Date.now();
    
    for (const [key, lastActive] of this.lastActivity) {
      const idleTime = now - lastActive.getTime();
      
      if (idleTime > this.idleTimeout) {
        const [sandboxId, port] = key.split(':');
        console.log(`[idle] Expiring idle exposure: ${key}`);
        
        await exposeService.unexpose(sandboxId, parseInt(port, 10));
        this.lastActivity.delete(key);
      }
    }
  }
}

export const idleExpirationManager = new IdleExpirationManager();
```

---

## Error Handling

### Error Types

```typescript
// src/errors/exposeErrors.ts

export class ExposeError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ExposeError';
  }
}

export const ExposeErrors = {
  INVALID_PORT: (port: number) => 
    new ExposeError('INVALID_PORT', `Invalid port: ${port}`, 400),
  
  RESERVED_PORT: (port: number) => 
    new ExposeError('RESERVED_PORT', `Port ${port} is reserved`, 400),
  
  PORT_LIMIT_EXCEEDED: (max: number) => 
    new ExposeError('PORT_LIMIT_EXCEEDED', `Maximum ${max} ports allowed`, 400),
  
  SANDBOX_NOT_FOUND: (id: string) => 
    new ExposeError('SANDBOX_NOT_FOUND', `Sandbox ${id} not found`, 404),
  
  SANDBOX_NOT_RUNNING: (status: string) => 
    new ExposeError('SANDBOX_NOT_RUNNING', `Sandbox is ${status}`, 409),
  
  REGISTRATION_FAILED: (reason: string) => 
    new ExposeError('REGISTRATION_FAILED', `Registration failed: ${reason}`, 500),
  
  ENVOY_UPDATE_FAILED: (reason: string) => 
    new ExposeError('ENVOY_UPDATE_FAILED', `Routing update failed: ${reason}`, 500),
};
```

### Error Handler Middleware

```typescript
// src/middleware/errorHandler.ts

function exposeErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ExposeError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }
  
  // Log unexpected errors
  console.error('Unexpected error in expose:', err);
  
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

---

## Timing Breakdown

### Performance Metrics

| Step | Duration | Cumulative | Notes |
|------|----------|------------|-------|
| **1. Validate** | 1-5ms | 5ms | In-memory + Redis checks |
| **2. Generate URL** | <1ms | 6ms | String formatting |
| **3. Register Redis** | 5-20ms | 26ms | Network RTT to Redis |
| **4. Update Envoy** | 20-50ms | 76ms | xDS push + apply |
| **5. First health check** | 50-200ms | 276ms | HTTP request to sandbox |
| **6. Return URL** | <1ms | 277ms | Response formatting |
| **TOTAL** | | **~300ms** | Typical case |

### Optimization Strategies

```typescript
// Parallel operations where possible
async function exposeOptimized(ctx: ExposeContext, options: ExposeOptions): Promise<ExposeResult> {
  // Validation can't be parallelized
  await validate(ctx, options);
  
  const url = generateUrl(ctx.sandboxId, options.port);
  
  // These can run in parallel
  await Promise.all([
    register(ctx, options, url),
    updateEnvoy(ctx, options),
  ]);
  
  // Health check runs after routing is ready
  const healthy = await healthCheck(ctx, options);
  
  return { url, port: options.port, status: healthy ? 'active' : 'pending' };
}
```

---

## Summary

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| **Validation** | Port range, limits, sandbox status | Prevent invalid exposes |
| **URL Generation** | `{port}-{sandboxId}.{region}.{domain}` | Unique, stable URLs |
| **Registration** | Redis hashes + sets | Distributed state |
| **Routing** | Envoy xDS | Dynamic routing |
| **Health Check** | HTTP polling | Ensure availability |
| **TTL** | Redis EXPIRE + background checker | Auto cleanup |

### Key Features

1. **Idempotent** - Re-exposing same port returns existing URL
2. **Health-aware** - Only marks active after health check passes
3. **Auto-expiring** - TTL and idle expiration
4. **Zero-downtime** - Envoy hot-reloads routing
5. **Observable** - Metrics for latency, success rate
