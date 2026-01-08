# Preview URL Generation

This guide provides comprehensive coverage of preview URL generation for sandbox environments, including URL format design, DNS configuration, URL stability across hibernation, and implementation details.

---

## Table of Contents

1. [Overview](#overview)
2. [URL Format Design](#url-format-design)
3. [DNS Configuration](#dns-configuration)
4. [URL Generation Implementation](#url-generation-implementation)
5. [Service Discovery](#service-discovery)
6. [URL Stability Across Hibernation](#url-stability-across-hibernation)
7. [Multi-Port Support](#multi-port-support)
8. [Security Considerations](#security-considerations)
9. [Best Practices](#best-practices)

---

## Overview

Preview URLs provide public access to development servers running inside sandboxes. The URL system must be:

- **Unique** - Each sandbox gets distinct URLs
- **Stable** - URLs don't change across hibernation
- **Multi-port** - Support multiple services per sandbox
- **Fast** - No DNS propagation delays
- **Secure** - Prevent enumeration attacks

### URL Format

```
https://{port}-{sandboxId}.{region}.manus.computer
        │      │           │
        │      │           └── Region identifier (us2, eu1, ap1)
        │      └── Unique sandbox identifier (base62 encoded)
        └── Port number being exposed (3000, 5173, 8080, etc.)

Examples:
- https://3000-abc123xyz.us2.manus.computer  (main app)
- https://5173-abc123xyz.us2.manus.computer  (Vite dev server)
- https://8080-abc123xyz.us2.manus.computer  (API server)
```

---

## URL Format Design

### Design Decisions

| Component | Format | Rationale |
|-----------|--------|-----------|
| Port | Numeric prefix | Easy parsing, multiple ports |
| Sandbox ID | Base62 | URL-safe, compact |
| Region | Short code | Route to nearest edge |
| Domain | Wildcard | Single DNS record |

### Why Port in Subdomain?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ALTERNATIVE FORMATS CONSIDERED                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Option 1: Port in path (rejected)                                          │
│  https://abc123.manus.computer:3000/                                        │
│  ❌ Non-standard ports blocked by firewalls                                 │
│  ❌ Requires port in URL                                                    │
│                                                                             │
│  Option 2: Port in path segment (rejected)                                  │
│  https://abc123.manus.computer/port/3000/                                   │
│  ❌ Breaks relative URLs in apps                                            │
│  ❌ Complex routing rules                                                   │
│                                                                             │
│  Option 3: Port in subdomain (chosen)                                       │
│  https://3000-abc123.manus.computer/                                        │
│  ✅ Standard HTTPS (port 443)                                               │
│  ✅ Clean URLs                                                              │
│  ✅ Easy to parse                                                           │
│  ✅ Works with wildcard SSL                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sandbox ID Generation

```typescript
// src/utils/sandboxId.ts

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateSandboxId(length: number = 12): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  
  for (const byte of bytes) {
    result += BASE62_CHARS[byte % 62];
  }
  
  return result;
}

export function isValidSandboxId(id: string): boolean {
  // Must be 8-16 characters, alphanumeric only
  return /^[a-zA-Z0-9]{8,16}$/.test(id);
}

// Examples:
// generateSandboxId() => "abc123XYZ789"
// generateSandboxId(8) => "Kj9mNp2Q"
```

---

## DNS Configuration

### Wildcard DNS Records

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DNS CONFIGURATION                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Zone: manus.computer                                                       │
│                                                                             │
│  Records:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  *.us2.manus.computer    A      203.0.113.10                        │   │
│  │  *.us2.manus.computer    AAAA   2001:db8::10                        │   │
│  │  *.eu1.manus.computer    A      203.0.113.20                        │   │
│  │  *.eu1.manus.computer    AAAA   2001:db8::20                        │   │
│  │  *.ap1.manus.computer    A      203.0.113.30                        │   │
│  │  *.ap1.manus.computer    AAAA   2001:db8::30                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Benefits:                                                                  │
│  • Single record covers all sandboxes                                       │
│  • No DNS propagation delay for new sandboxes                              │
│  • Regional routing built-in                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cloudflare Configuration

```typescript
// DNS records via Cloudflare API
const dnsRecords = [
  {
    type: 'A',
    name: '*.us2',
    content: '203.0.113.10',
    proxied: true,  // Enable Cloudflare proxy
    ttl: 1,         // Auto TTL
  },
  {
    type: 'AAAA',
    name: '*.us2',
    content: '2001:db8::10',
    proxied: true,
    ttl: 1,
  },
];

// Cloudflare handles:
// - DDoS protection
// - SSL termination (optional)
// - Caching
// - WAF
```

### Multi-Region Setup

```typescript
interface RegionConfig {
  code: string;
  proxyIp: string;
  proxyIpv6: string;
  location: string;
}

const regions: RegionConfig[] = [
  { code: 'us2', proxyIp: '203.0.113.10', proxyIpv6: '2001:db8::10', location: 'US East' },
  { code: 'eu1', proxyIp: '203.0.113.20', proxyIpv6: '2001:db8::20', location: 'EU West' },
  { code: 'ap1', proxyIp: '203.0.113.30', proxyIpv6: '2001:db8::30', location: 'Asia Pacific' },
];
```

---

## URL Generation Implementation

### Core URL Generator

```typescript
// src/services/previewUrlGenerator.ts

interface PreviewUrlConfig {
  baseDomain: string;
  region: string;
  protocol: 'http' | 'https';
}

interface GeneratedUrl {
  url: string;
  sandboxId: string;
  port: number;
  region: string;
}

class PreviewUrlGenerator {
  constructor(private config: PreviewUrlConfig) {}
  
  generate(sandboxId: string, port: number): GeneratedUrl {
    // Validate inputs
    if (!isValidSandboxId(sandboxId)) {
      throw new Error(`Invalid sandbox ID: ${sandboxId}`);
    }
    
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${port}`);
    }
    
    // Generate URL
    const subdomain = `${port}-${sandboxId}`;
    const host = `${subdomain}.${this.config.region}.${this.config.baseDomain}`;
    const url = `${this.config.protocol}://${host}`;
    
    return {
      url,
      sandboxId,
      port,
      region: this.config.region,
    };
  }
  
  parse(url: string): GeneratedUrl | null {
    try {
      const parsed = new URL(url);
      const hostParts = parsed.hostname.split('.');
      
      // Expected: {port}-{sandboxId}.{region}.{baseDomain}
      if (hostParts.length < 3) return null;
      
      const [portAndId, region] = hostParts;
      const [portStr, sandboxId] = portAndId.split('-');
      const port = parseInt(portStr, 10);
      
      if (isNaN(port) || !isValidSandboxId(sandboxId)) {
        return null;
      }
      
      return {
        url,
        sandboxId,
        port,
        region,
      };
    } catch {
      return null;
    }
  }
}

// Usage
const generator = new PreviewUrlGenerator({
  baseDomain: 'manus.computer',
  region: 'us2',
  protocol: 'https',
});

const result = generator.generate('abc123XYZ789', 3000);
// { url: 'https://3000-abc123XYZ789.us2.manus.computer', ... }
```

### URL Registry

```typescript
// src/services/urlRegistry.ts

interface UrlRegistration {
  sandboxId: string;
  port: number;
  url: string;
  internalAddress: string;
  createdAt: Date;
  expiresAt: Date | null;
  status: 'active' | 'hibernated' | 'expired';
}

class UrlRegistry {
  constructor(private redis: Redis) {}
  
  async register(registration: Omit<UrlRegistration, 'createdAt'>): Promise<void> {
    const key = this.getKey(registration.sandboxId, registration.port);
    
    await this.redis.hset(key, {
      ...registration,
      createdAt: new Date().toISOString(),
    });
    
    // Set expiration if specified
    if (registration.expiresAt) {
      const ttl = Math.floor((registration.expiresAt.getTime() - Date.now()) / 1000);
      await this.redis.expire(key, ttl);
    }
    
    // Add to sandbox's URL list
    await this.redis.sadd(`sandbox:${registration.sandboxId}:urls`, key);
  }
  
  async lookup(sandboxId: string, port: number): Promise<UrlRegistration | null> {
    const key = this.getKey(sandboxId, port);
    const data = await this.redis.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      ...data,
      port: parseInt(data.port, 10),
      createdAt: new Date(data.createdAt),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    } as UrlRegistration;
  }
  
  async getByUrl(url: string): Promise<UrlRegistration | null> {
    const parsed = new PreviewUrlGenerator({
      baseDomain: 'manus.computer',
      region: 'us2',
      protocol: 'https',
    }).parse(url);
    
    if (!parsed) return null;
    
    return this.lookup(parsed.sandboxId, parsed.port);
  }
  
  async deregister(sandboxId: string, port: number): Promise<void> {
    const key = this.getKey(sandboxId, port);
    await this.redis.del(key);
    await this.redis.srem(`sandbox:${sandboxId}:urls`, key);
  }
  
  async getAllForSandbox(sandboxId: string): Promise<UrlRegistration[]> {
    const keys = await this.redis.smembers(`sandbox:${sandboxId}:urls`);
    const registrations: UrlRegistration[] = [];
    
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        registrations.push({
          ...data,
          port: parseInt(data.port, 10),
          createdAt: new Date(data.createdAt),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        } as UrlRegistration);
      }
    }
    
    return registrations;
  }
  
  private getKey(sandboxId: string, port: number): string {
    return `url:${sandboxId}:${port}`;
  }
}
```

---

## Service Discovery

### Registration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SERVICE DISCOVERY FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Sandbox starts dev server on port 3000                                  │
│     │                                                                       │
│     ▼                                                                       │
│  2. Sandbox calls expose({ port: 3000 })                                    │
│     │                                                                       │
│     ▼                                                                       │
│  3. Platform generates URL: https://3000-abc123.us2.manus.computer          │
│     │                                                                       │
│     ▼                                                                       │
│  4. Platform registers in Redis:                                            │
│     • URL → Internal address mapping                                        │
│     • Sandbox → URL list                                                    │
│     │                                                                       │
│     ▼                                                                       │
│  5. Platform updates Envoy via xDS                                          │
│     │                                                                       │
│     ▼                                                                       │
│  6. URL is immediately accessible                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Registry Implementation

```typescript
// src/services/serviceRegistry.ts

interface ServiceEndpoint {
  sandboxId: string;
  port: number;
  internalIp: string;
  internalPort: number;
  healthy: boolean;
  lastHealthCheck: Date;
}

class ServiceRegistry {
  constructor(
    private redis: Redis,
    private envoyControlPlane: EnvoyControlPlane
  ) {}
  
  async register(endpoint: ServiceEndpoint): Promise<string> {
    const urlGenerator = new PreviewUrlGenerator({
      baseDomain: 'manus.computer',
      region: process.env.REGION || 'us2',
      protocol: 'https',
    });
    
    const { url } = urlGenerator.generate(endpoint.sandboxId, endpoint.port);
    
    // Store in Redis
    const key = `endpoint:${endpoint.sandboxId}:${endpoint.port}`;
    await this.redis.hset(key, {
      ...endpoint,
      url,
      registeredAt: new Date().toISOString(),
    });
    
    // Update Envoy routing
    await this.envoyControlPlane.addEndpoint({
      sandboxId: endpoint.sandboxId,
      address: endpoint.internalIp,
      port: endpoint.internalPort,
      healthy: endpoint.healthy,
    });
    
    // Publish registration event
    await this.redis.publish('endpoint:registered', JSON.stringify({
      sandboxId: endpoint.sandboxId,
      port: endpoint.port,
      url,
    }));
    
    return url;
  }
  
  async deregister(sandboxId: string, port: number): Promise<void> {
    const key = `endpoint:${sandboxId}:${port}`;
    
    // Remove from Redis
    await this.redis.del(key);
    
    // Update Envoy routing
    await this.envoyControlPlane.removeEndpoint(sandboxId);
    
    // Publish deregistration event
    await this.redis.publish('endpoint:deregistered', JSON.stringify({
      sandboxId,
      port,
    }));
  }
  
  async resolve(url: string): Promise<ServiceEndpoint | null> {
    const urlGenerator = new PreviewUrlGenerator({
      baseDomain: 'manus.computer',
      region: 'us2',
      protocol: 'https',
    });
    
    const parsed = urlGenerator.parse(url);
    if (!parsed) return null;
    
    const key = `endpoint:${parsed.sandboxId}:${parsed.port}`;
    const data = await this.redis.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      sandboxId: data.sandboxId,
      port: parseInt(data.port, 10),
      internalIp: data.internalIp,
      internalPort: parseInt(data.internalPort, 10),
      healthy: data.healthy === 'true',
      lastHealthCheck: new Date(data.lastHealthCheck),
    };
  }
}
```

---

## URL Stability Across Hibernation

### Hibernation States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    URL LIFECYCLE ACROSS HIBERNATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RUNNING STATE                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  URL: https://3000-abc123.us2.manus.computer                        │   │
│  │  Status: Active                                                      │   │
│  │  Backend: 10.0.1.50:3000                                            │   │
│  │  Response: 200 OK (immediate)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ Idle timeout (30 min)                        │
│                              ▼                                              │
│  HIBERNATED STATE                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  URL: https://3000-abc123.us2.manus.computer (SAME!)                │   │
│  │  Status: Hibernated                                                  │   │
│  │  Backend: None (sandbox stopped)                                    │   │
│  │  Response: 503 → Wake → 200 OK (2-5 seconds)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ Request received                             │
│                              ▼                                              │
│  WAKING STATE                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  URL: https://3000-abc123.us2.manus.computer (SAME!)                │   │
│  │  Status: Waking                                                      │   │
│  │  Backend: Starting...                                               │   │
│  │  Response: 202 Accepted + Retry-After                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ Sandbox ready                                │
│                              ▼                                              │
│  RUNNING STATE (restored)                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Wake-on-Request Implementation

```typescript
// src/services/wakeOnRequest.ts

class WakeOnRequestHandler {
  constructor(
    private sandboxManager: SandboxManager,
    private serviceRegistry: ServiceRegistry
  ) {}
  
  async handleRequest(url: string): Promise<WakeResult> {
    const endpoint = await this.serviceRegistry.resolve(url);
    
    if (!endpoint) {
      return { status: 'not_found', message: 'Unknown URL' };
    }
    
    const sandbox = await this.sandboxManager.get(endpoint.sandboxId);
    
    switch (sandbox.status) {
      case 'running':
        return { status: 'ready', endpoint };
      
      case 'hibernated':
        return this.wakeSandbox(sandbox, endpoint);
      
      case 'waking':
        return { status: 'waking', retryAfter: 2 };
      
      case 'stopped':
        return { status: 'stopped', message: 'Sandbox is stopped' };
      
      default:
        return { status: 'error', message: 'Unknown sandbox status' };
    }
  }
  
  private async wakeSandbox(
    sandbox: Sandbox,
    endpoint: ServiceEndpoint
  ): Promise<WakeResult> {
    // Start waking process
    await this.sandboxManager.wake(sandbox.id);
    
    // Wait for sandbox to be ready (with timeout)
    const ready = await this.waitForReady(sandbox.id, 30000);
    
    if (ready) {
      // Update endpoint with new internal address
      const updatedEndpoint = await this.serviceRegistry.resolve(
        `https://${endpoint.port}-${endpoint.sandboxId}.us2.manus.computer`
      );
      
      return { status: 'ready', endpoint: updatedEndpoint };
    } else {
      return { status: 'timeout', message: 'Sandbox wake timeout' };
    }
  }
  
  private async waitForReady(sandboxId: string, timeout: number): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const sandbox = await this.sandboxManager.get(sandboxId);
      
      if (sandbox.status === 'running') {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }
}
```

### Envoy Configuration for Wake-on-Request

```yaml
# Custom filter for wake-on-request
http_filters:
  - name: envoy.filters.http.lua
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
      inline_code: |
        function envoy_on_request(request_handle)
          local host = request_handle:headers():get(":authority")
          
          -- Check if sandbox is hibernated
          local status = request_handle:httpCall(
            "wake_service",
            {[":method"] = "GET", [":path"] = "/status/" .. host},
            "",
            5000
          )
          
          if status == "hibernated" then
            -- Trigger wake and return 202
            request_handle:httpCall(
              "wake_service",
              {[":method"] = "POST", [":path"] = "/wake/" .. host},
              "",
              1000
            )
            
            request_handle:respond(
              {[":status"] = "202", ["Retry-After"] = "2"},
              "Sandbox is waking up..."
            )
          end
        end
```

---

## Multi-Port Support

### Exposing Multiple Ports

```typescript
// src/services/multiPortManager.ts

interface ExposedPort {
  port: number;
  url: string;
  protocol: 'http' | 'ws';
  name?: string;
}

class MultiPortManager {
  private exposedPorts: Map<string, ExposedPort[]> = new Map();
  
  async expose(
    sandboxId: string,
    port: number,
    options: { protocol?: 'http' | 'ws'; name?: string } = {}
  ): Promise<ExposedPort> {
    const urlGenerator = new PreviewUrlGenerator({
      baseDomain: 'manus.computer',
      region: 'us2',
      protocol: 'https',
    });
    
    const { url } = urlGenerator.generate(sandboxId, port);
    
    const exposed: ExposedPort = {
      port,
      url,
      protocol: options.protocol || 'http',
      name: options.name,
    };
    
    // Track exposed ports
    const existing = this.exposedPorts.get(sandboxId) || [];
    existing.push(exposed);
    this.exposedPorts.set(sandboxId, existing);
    
    // Register with service registry
    await this.serviceRegistry.register({
      sandboxId,
      port,
      internalIp: await this.getSandboxIp(sandboxId),
      internalPort: port,
      healthy: true,
      lastHealthCheck: new Date(),
    });
    
    return exposed;
  }
  
  async getExposedPorts(sandboxId: string): Promise<ExposedPort[]> {
    return this.exposedPorts.get(sandboxId) || [];
  }
  
  async unexpose(sandboxId: string, port: number): Promise<void> {
    const existing = this.exposedPorts.get(sandboxId) || [];
    const filtered = existing.filter(p => p.port !== port);
    this.exposedPorts.set(sandboxId, filtered);
    
    await this.serviceRegistry.deregister(sandboxId, port);
  }
  
  async unexposeAll(sandboxId: string): Promise<void> {
    const ports = this.exposedPorts.get(sandboxId) || [];
    
    for (const port of ports) {
      await this.serviceRegistry.deregister(sandboxId, port.port);
    }
    
    this.exposedPorts.delete(sandboxId);
  }
}
```

### Common Port Configurations

| Port | Service | URL Example |
|------|---------|-------------|
| 3000 | Main app | https://3000-abc123.us2.manus.computer |
| 5173 | Vite dev | https://5173-abc123.us2.manus.computer |
| 8080 | API server | https://8080-abc123.us2.manus.computer |
| 3001 | Storybook | https://3001-abc123.us2.manus.computer |
| 9229 | Node debugger | https://9229-abc123.us2.manus.computer |

---

## Security Considerations

### Preventing URL Enumeration

```typescript
// Use sufficiently long, random sandbox IDs
const sandboxId = generateSandboxId(12); // 62^12 = 3.2e21 possibilities

// Rate limit URL probing
const rateLimiter = new RateLimiter({
  windowMs: 60000,  // 1 minute
  max: 10,          // 10 requests per IP
  message: 'Too many requests',
});
```

### URL Validation

```typescript
function validatePreviewUrl(url: string): boolean {
  const parsed = urlGenerator.parse(url);
  
  if (!parsed) return false;
  
  // Validate sandbox ID format
  if (!isValidSandboxId(parsed.sandboxId)) return false;
  
  // Validate port range
  if (parsed.port < 1 || parsed.port > 65535) return false;
  
  // Check if sandbox exists
  const exists = await sandboxManager.exists(parsed.sandboxId);
  if (!exists) return false;
  
  return true;
}
```

### Access Control

```typescript
// Optional: Require authentication for preview URLs
async function checkAccess(url: string, user: User): Promise<boolean> {
  const parsed = urlGenerator.parse(url);
  if (!parsed) return false;
  
  const sandbox = await sandboxManager.get(parsed.sandboxId);
  
  // Owner always has access
  if (sandbox.ownerId === user.id) return true;
  
  // Check if sandbox is public
  if (sandbox.visibility === 'public') return true;
  
  // Check if user is collaborator
  if (sandbox.collaborators.includes(user.id)) return true;
  
  return false;
}
```

---

## Best Practices

### 1. Use Stable Sandbox IDs

```typescript
// Generate once, store permanently
const sandboxId = generateSandboxId();
await db.sandbox.create({ id: sandboxId, ... });
```

### 2. Implement Health Checks

```typescript
// Regular health checks keep routing accurate
setInterval(async () => {
  const endpoints = await serviceRegistry.getAllEndpoints();
  
  for (const endpoint of endpoints) {
    const healthy = await checkHealth(endpoint);
    await serviceRegistry.updateHealth(endpoint.sandboxId, endpoint.port, healthy);
  }
}, 10000);
```

### 3. Handle Wake Gracefully

```typescript
// Return informative response during wake
if (sandbox.status === 'waking') {
  return new Response('Sandbox is starting...', {
    status: 202,
    headers: {
      'Retry-After': '2',
      'X-Sandbox-Status': 'waking',
    },
  });
}
```

### 4. Clean Up Expired URLs

```typescript
// Remove URLs for deleted sandboxes
async function cleanupExpiredUrls(): Promise<void> {
  const urls = await urlRegistry.getAllExpired();
  
  for (const url of urls) {
    await urlRegistry.deregister(url.sandboxId, url.port);
    await envoyControlPlane.removeEndpoint(url.sandboxId);
  }
}
```

---

## Summary

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| **URL Format** | `{port}-{id}.{region}.{domain}` | Unique, stable, multi-port |
| **DNS** | Wildcard records | No per-sandbox DNS updates |
| **Registry** | Redis | Track URL → endpoint mapping |
| **Routing** | Envoy xDS | Dynamic backend updates |
| **Hibernation** | Wake-on-request | Seamless resume |
| **Security** | Long random IDs | Prevent enumeration |

### Key Design Principles

1. **URL stability** - Same URL before/after hibernation
2. **DNS simplicity** - Wildcard records, no propagation delay
3. **Dynamic routing** - Envoy updates in <1 second
4. **Multi-port** - One sandbox, multiple services
5. **Security** - Unpredictable sandbox IDs
