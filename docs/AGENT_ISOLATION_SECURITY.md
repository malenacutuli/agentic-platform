# Agent Isolation and Security

This guide covers how to prevent AI agents from accessing other users' data, making excessive API calls, and running malicious code through comprehensive isolation and security mechanisms.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Isolation](#data-isolation)
3. [API Call Protection](#api-call-protection)
4. [Malicious Code Prevention](#malicious-code-prevention)
5. [Network Isolation](#network-isolation)
6. [Audit and Compliance](#audit-and-compliance)

---

## Overview

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT ISOLATION ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  USER A SANDBOX                           USER B SANDBOX                         │   │
│  │  ┌─────────────────────┐                 ┌─────────────────────┐                │   │
│  │  │  Agent A            │                 │  Agent B            │                │   │
│  │  │  ├── Files          │                 │  ├── Files          │                │   │
│  │  │  ├── Processes      │    ISOLATED     │  ├── Processes      │                │   │
│  │  │  ├── Network        │◄───────────────►│  ├── Network        │                │   │
│  │  │  └── Resources      │                 │  └── Resources      │                │   │
│  │  └─────────────────────┘                 └─────────────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SHARED SERVICES (with access control)                                          │   │
│  │  ├── Database (row-level security)                                              │   │
│  │  ├── Storage (bucket isolation)                                                 │   │
│  │  ├── APIs (rate limited, scoped)                                                │   │
│  │  └── LLM (quota managed)                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Security Principles

| Principle | Implementation |
|-----------|----------------|
| **Complete Isolation** | Separate sandboxes per user |
| **Zero Trust** | Verify every request |
| **Least Privilege** | Minimal permissions |
| **Defense in Depth** | Multiple security layers |
| **Audit Everything** | Comprehensive logging |

---

## Data Isolation

### Sandbox Isolation

```typescript
// server/sandbox/isolation.ts

interface SandboxConfig {
  userId: string;
  sandboxId: string;
  rootPath: string;
  allowedPaths: string[];
  deniedPaths: string[];
}

class SandboxIsolation {
  /**
   * Validate file path is within sandbox
   */
  validatePath(sandboxConfig: SandboxConfig, requestedPath: string): boolean {
    const normalizedPath = path.normalize(requestedPath);
    
    // Must be within sandbox root
    if (!normalizedPath.startsWith(sandboxConfig.rootPath)) {
      return false;
    }
    
    // Check against denied paths
    for (const denied of sandboxConfig.deniedPaths) {
      if (normalizedPath.startsWith(denied)) {
        return false;
      }
    }
    
    // Check for path traversal
    if (normalizedPath.includes('..')) {
      return false;
    }
    
    return true;
  }

  /**
   * Create isolated filesystem view
   */
  createIsolatedFs(sandboxConfig: SandboxConfig): IsolatedFs {
    return {
      root: sandboxConfig.rootPath,
      read: (filePath: string) => {
        if (!this.validatePath(sandboxConfig, filePath)) {
          throw new Error('Access denied: path outside sandbox');
        }
        return fs.readFileSync(filePath);
      },
      write: (filePath: string, content: Buffer) => {
        if (!this.validatePath(sandboxConfig, filePath)) {
          throw new Error('Access denied: path outside sandbox');
        }
        return fs.writeFileSync(filePath, content);
      },
    };
  }
}
```

### Database Row-Level Security

```sql
-- Enable row-level security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY user_data_isolation ON user_data
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Policy: Agents can only access their task's data
CREATE POLICY agent_data_isolation ON task_data
  FOR ALL
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  );
```

### Storage Bucket Isolation

```typescript
// server/storage/isolation.ts

class StorageIsolation {
  /**
   * Get isolated storage path for user
   */
  getUserStoragePath(userId: string): string {
    // Each user gets their own S3 prefix
    return `users/${userId}/`;
  }

  /**
   * Validate storage access
   */
  validateStorageAccess(userId: string, objectKey: string): boolean {
    const userPrefix = this.getUserStoragePath(userId);
    
    // Object must be within user's prefix
    if (!objectKey.startsWith(userPrefix)) {
      return false;
    }
    
    // No path traversal
    if (objectKey.includes('..')) {
      return false;
    }
    
    return true;
  }

  /**
   * Upload with isolation
   */
  async upload(userId: string, fileName: string, data: Buffer): Promise<string> {
    const objectKey = `${this.getUserStoragePath(userId)}${fileName}`;
    
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: objectKey,
      Body: data,
      Metadata: {
        'x-user-id': userId,
        'x-uploaded-at': new Date().toISOString(),
      },
    });
    
    return objectKey;
  }
}
```

---

## API Call Protection

### Rate Limiting per User

```typescript
// server/api/rateLimiting.ts

interface UserQuota {
  userId: string;
  tier: 'free' | 'pro' | 'enterprise';
  limits: {
    llmCallsPerHour: number;
    apiCallsPerMinute: number;
    storageBytes: number;
    computeMinutes: number;
  };
  usage: {
    llmCalls: number;
    apiCalls: number;
    storageUsed: number;
    computeUsed: number;
  };
}

const tierLimits = {
  free: {
    llmCallsPerHour: 100,
    apiCallsPerMinute: 60,
    storageBytes: 1 * 1024 * 1024 * 1024, // 1GB
    computeMinutes: 60,
  },
  pro: {
    llmCallsPerHour: 1000,
    apiCallsPerMinute: 300,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10GB
    computeMinutes: 600,
  },
  enterprise: {
    llmCallsPerHour: 10000,
    apiCallsPerMinute: 1000,
    storageBytes: 100 * 1024 * 1024 * 1024, // 100GB
    computeMinutes: 6000,
  },
};

class UserRateLimiter {
  private redis: Redis;

  async checkLimit(userId: string, resource: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const quota = await this.getUserQuota(userId);
    const limit = quota.limits[resource];
    const key = `ratelimit:${userId}:${resource}`;
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      // Set expiry on first request
      await this.redis.expire(key, this.getWindowSeconds(resource));
    }
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt: new Date(Date.now() + await this.redis.ttl(key) * 1000),
    };
  }

  async trackCost(userId: string, cost: number): Promise<void> {
    const key = `cost:${userId}:${this.getCurrentPeriod()}`;
    await this.redis.incrbyfloat(key, cost);
  }
}
```

### API Scoping

```typescript
// server/api/scoping.ts

interface ApiScope {
  resources: string[];
  actions: ('read' | 'write' | 'delete')[];
  conditions?: Record<string, any>;
}

const agentScopes: Record<string, ApiScope> = {
  'file.read': {
    resources: ['sandbox:files'],
    actions: ['read'],
    conditions: { pathPrefix: '/home/ubuntu/project' },
  },
  'file.write': {
    resources: ['sandbox:files'],
    actions: ['write'],
    conditions: { pathPrefix: '/home/ubuntu/project' },
  },
  'db.query': {
    resources: ['database:user_tables'],
    actions: ['read', 'write'],
    conditions: { excludeTables: ['system_*', 'audit_*'] },
  },
  'external.api': {
    resources: ['external:approved_apis'],
    actions: ['read'],
    conditions: { allowedDomains: ['api.github.com', 'api.openai.com'] },
  },
};

class ApiScopeValidator {
  validate(action: string, params: Record<string, any>): boolean {
    const scope = agentScopes[action];
    if (!scope) {
      return false; // Unknown action = deny
    }
    
    // Check conditions
    if (scope.conditions) {
      for (const [key, value] of Object.entries(scope.conditions)) {
        if (!this.checkCondition(key, value, params)) {
          return false;
        }
      }
    }
    
    return true;
  }
}
```

---

## Malicious Code Prevention

### Code Analysis

```typescript
// server/security/codeAnalysis.ts

interface CodeAnalysisResult {
  safe: boolean;
  risks: CodeRisk[];
  score: number; // 0-100, higher = safer
}

interface CodeRisk {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line?: number;
  description: string;
}

class CodeAnalyzer {
  private dangerousPatterns = [
    // System access
    { pattern: /process\.exit/g, type: 'process_exit', severity: 'high' },
    { pattern: /child_process/g, type: 'child_process', severity: 'high' },
    { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g, type: 'fs_access', severity: 'medium' },
    
    // Network
    { pattern: /net\.createServer/g, type: 'server_creation', severity: 'high' },
    { pattern: /dgram\.createSocket/g, type: 'udp_socket', severity: 'high' },
    
    // Eval and dynamic code
    { pattern: /\beval\s*\(/g, type: 'eval', severity: 'critical' },
    { pattern: /new\s+Function\s*\(/g, type: 'dynamic_function', severity: 'critical' },
    { pattern: /vm\.runInContext/g, type: 'vm_execution', severity: 'high' },
    
    // Prototype pollution
    { pattern: /__proto__/g, type: 'proto_access', severity: 'high' },
    { pattern: /constructor\s*\[/g, type: 'constructor_access', severity: 'high' },
    
    // Crypto mining indicators
    { pattern: /stratum\+tcp/g, type: 'mining_pool', severity: 'critical' },
    { pattern: /cryptonight/gi, type: 'mining_algo', severity: 'critical' },
  ];

  analyze(code: string): CodeAnalysisResult {
    const risks: CodeRisk[] = [];
    
    for (const { pattern, type, severity } of this.dangerousPatterns) {
      const matches = code.matchAll(pattern);
      for (const match of matches) {
        const line = this.getLineNumber(code, match.index!);
        risks.push({
          type,
          severity: severity as any,
          line,
          description: `Potentially dangerous pattern: ${type}`,
        });
      }
    }
    
    // Calculate safety score
    const score = this.calculateScore(risks);
    
    return {
      safe: risks.filter(r => r.severity === 'critical').length === 0,
      risks,
      score,
    };
  }

  private calculateScore(risks: CodeRisk[]): number {
    let score = 100;
    for (const risk of risks) {
      switch (risk.severity) {
        case 'critical': score -= 50; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    return Math.max(0, score);
  }
}
```

### Execution Sandboxing

```typescript
// server/security/executionSandbox.ts

interface ExecutionConfig {
  timeout: number;
  memoryLimit: number;
  cpuLimit: number;
  networkAccess: boolean;
  allowedModules: string[];
}

class ExecutionSandbox {
  private defaultConfig: ExecutionConfig = {
    timeout: 30000, // 30 seconds
    memoryLimit: 256 * 1024 * 1024, // 256MB
    cpuLimit: 1, // 1 CPU
    networkAccess: false,
    allowedModules: ['path', 'url', 'querystring', 'util'],
  };

  async execute(code: string, config?: Partial<ExecutionConfig>): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    metrics: ExecutionMetrics;
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Create isolated VM context
    const context = this.createSafeContext(finalConfig);
    
    // Set resource limits
    const resourceLimiter = new ResourceLimiter(finalConfig);
    
    try {
      // Execute with timeout
      const result = await Promise.race([
        this.runInContext(code, context),
        this.timeout(finalConfig.timeout),
      ]);
      
      return {
        success: true,
        result,
        metrics: resourceLimiter.getMetrics(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metrics: resourceLimiter.getMetrics(),
      };
    }
  }

  private createSafeContext(config: ExecutionConfig): vm.Context {
    const safeGlobals = {
      console: this.createSafeConsole(),
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      process: undefined,
      require: this.createSafeRequire(config.allowedModules),
      Buffer: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
    
    return vm.createContext(safeGlobals);
  }

  private createSafeRequire(allowedModules: string[]): Function {
    return (moduleName: string) => {
      if (!allowedModules.includes(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed`);
      }
      return require(moduleName);
    };
  }
}
```

---

## Network Isolation

### Network Policy

```yaml
# kubernetes/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sandbox-isolation
spec:
  podSelector:
    matchLabels:
      app: sandbox
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Only allow from proxy
    - from:
        - podSelector:
            matchLabels:
              app: proxy
      ports:
        - port: 3000
  egress:
    # Allow DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
    # Allow approved external APIs
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8      # Block internal
              - 172.16.0.0/12   # Block internal
              - 192.168.0.0/16  # Block internal
      ports:
        - port: 443
```

### Egress Filtering

```typescript
// server/network/egressFilter.ts

interface EgressRule {
  domain: string;
  ports: number[];
  rateLimit: number; // requests per minute
}

const allowedEgress: EgressRule[] = [
  { domain: 'api.github.com', ports: [443], rateLimit: 60 },
  { domain: 'api.openai.com', ports: [443], rateLimit: 30 },
  { domain: 'registry.npmjs.org', ports: [443], rateLimit: 100 },
  { domain: 'pypi.org', ports: [443], rateLimit: 100 },
];

class EgressFilter {
  validateRequest(url: string): { allowed: boolean; reason?: string } {
    const parsed = new URL(url);
    
    // Check against allowlist
    const rule = allowedEgress.find(r => 
      parsed.hostname === r.domain || 
      parsed.hostname.endsWith(`.${r.domain}`)
    );
    
    if (!rule) {
      return { allowed: false, reason: 'Domain not in allowlist' };
    }
    
    // Check port
    const port = parsed.port ? parseInt(parsed.port) : 
      (parsed.protocol === 'https:' ? 443 : 80);
    
    if (!rule.ports.includes(port)) {
      return { allowed: false, reason: 'Port not allowed' };
    }
    
    return { allowed: true };
  }
}
```

---

## Audit and Compliance

### Audit Logger

```typescript
// server/audit/logger.ts

interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  taskId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogger {
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
    };
    
    // Write to audit log (append-only)
    await this.writeToAuditLog(fullEvent);
    
    // Send to SIEM if critical
    if (this.isCriticalEvent(event)) {
      await this.sendToSiem(fullEvent);
    }
    
    // Update metrics
    this.updateMetrics(fullEvent);
  }

  private isCriticalEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): boolean {
    const criticalActions = [
      'auth.login_failed',
      'security.blocked',
      'data.export',
      'admin.permission_change',
    ];
    return criticalActions.includes(event.action) || event.result === 'blocked';
  }
}
```

### Compliance Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY COMPLIANCE DASHBOARD                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA ISOLATION                          API PROTECTION                     │
│  ├── ✅ Sandbox isolation: Active        ├── ✅ Rate limiting: Active       │
│  ├── ✅ Row-level security: Enabled      ├── ✅ API scoping: Enabled        │
│  ├── ✅ Storage isolation: Active        ├── ✅ Cost tracking: Active       │
│  └── ✅ Path validation: Enabled         └── ✅ Quota enforcement: Active   │
│                                                                             │
│  CODE SECURITY                           NETWORK SECURITY                   │
│  ├── ✅ Static analysis: Enabled         ├── ✅ Network policy: Active      │
│  ├── ✅ Execution sandbox: Active        ├── ✅ Egress filtering: Enabled   │
│  ├── ✅ Resource limits: Enforced        ├── ✅ TLS required: Yes           │
│  └── ✅ Module whitelist: Active         └── ✅ Internal blocked: Yes       │
│                                                                             │
│  AUDIT STATUS                                                               │
│  ├── Events logged (24h): 15,432                                            │
│  ├── Blocked actions: 23                                                    │
│  ├── Security alerts: 2                                                     │
│  └── Compliance score: 98%                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Security Layers

| Layer | Protection | Implementation |
|-------|------------|----------------|
| **Sandbox** | Process isolation | Containers + namespaces |
| **Filesystem** | Path validation | Chroot + allowlist |
| **Database** | Row-level security | PostgreSQL RLS |
| **Storage** | Bucket isolation | S3 prefix per user |
| **API** | Rate limiting + scoping | Redis + middleware |
| **Code** | Static analysis | Pattern matching |
| **Execution** | Resource limits | VM sandbox + cgroups |
| **Network** | Egress filtering | Network policies |

### Security Checklist

- [ ] Sandbox isolation configured
- [ ] Row-level security enabled
- [ ] Storage buckets isolated
- [ ] Rate limits per user
- [ ] API scopes defined
- [ ] Code analysis active
- [ ] Execution sandboxed
- [ ] Network policies applied
- [ ] Audit logging enabled
- [ ] Alerts configured
