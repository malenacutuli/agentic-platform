# gVisor Platform and Container Configuration

This guide covers the gVisor platform selection (systrap, kvm, ptrace), base Docker images, cold-start times, warm pool management, and container lifecycle configuration.

---

## Table of Contents

1. [gVisor Platform Selection](#gvisor-platform-selection)
2. [Container Base Image](#container-base-image)
3. [Cold Start Performance](#cold-start-performance)
4. [Warm Pool Management](#warm-pool-management)
5. [Container Lifetime Management](#container-lifetime-management)
6. [Production Configuration](#production-configuration)

---

## gVisor Platform Selection

### Platform Comparison

gVisor supports multiple platforms for syscall interception. The choice significantly impacts performance and security.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           gVISOR PLATFORM ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  APPLICATION                                                                            │
│      │                                                                                  │
│      │ syscall                                                                          │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         gVisor Sentry (User-space kernel)                        │   │
│  │                                                                                  │   │
│  │  • Implements Linux syscall interface                                           │   │
│  │  • Memory management                                                            │   │
│  │  • Process scheduling                                                           │   │
│  │  • File system operations                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      │ Platform-specific syscall interception                                          │
│      ▼                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                         │
│  │    SYSTRAP      │  │      KVM        │  │     PTRACE      │                         │
│  │  (Recommended)  │  │  (Fastest)      │  │   (Fallback)    │                         │
│  │                 │  │                 │  │                 │                         │
│  │ • SIGSYS trap   │  │ • Hardware VM   │  │ • Process trace │                         │
│  │ • No root req   │  │ • Requires KVM  │  │ • Highest compat│                         │
│  │ • Good perf     │  │ • Best perf     │  │ • Slowest       │                         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Platform Details

| Platform | Mechanism | Performance | Requirements | Use Case |
|----------|-----------|-------------|--------------|----------|
| **systrap** | SIGSYS signal trapping | Good (90-95% native) | Linux 4.8+ | **Production default** |
| **kvm** | Hardware virtualization | Best (95-99% native) | KVM access, nested virt | High-performance workloads |
| **ptrace** | Process tracing | Slowest (60-80% native) | None | Compatibility fallback |

### Recommended: systrap Platform

We use **systrap** as the default platform for the following reasons:

1. **No special privileges required** - Works without KVM access
2. **Cloud-compatible** - Works on all major cloud providers
3. **Good performance** - 90-95% of native performance
4. **Stable** - Production-ready since gVisor 2020

```yaml
# runsc configuration
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
scheduling:
  nodeSelector:
    sandbox.gvisor.dev/enabled: "true"
---
# Pod spec using gVisor
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-pod
spec:
  runtimeClassName: gvisor
  containers:
  - name: sandbox
    image: sandbox-base:latest
```

### gVisor Configuration

```toml
# /etc/containerd/runsc.toml

[runsc]
  # Platform selection
  platform = "systrap"
  
  # Enable debug logging (production: false)
  debug = false
  debug-log = "/var/log/runsc/"
  
  # Network configuration
  network = "sandbox"
  
  # File system configuration
  overlay = true
  fsgofer-host-uds = true
  
  # Resource limits
  watchdog-action = "panic"
  
  # Security options
  rootless = false
  
  # Performance tuning
  num-network-channels = 4
  
  # Compatibility flags
  vfs2 = true
  fuse = true
```

### Platform-Specific Configuration

```yaml
# Kubernetes RuntimeClass with platform options
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor-systrap
handler: runsc
scheduling:
  nodeSelector:
    sandbox.gvisor.dev/enabled: "true"
---
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor-kvm
handler: runsc-kvm
scheduling:
  nodeSelector:
    sandbox.gvisor.dev/kvm: "true"
```

```toml
# /etc/containerd/config.toml - Multiple runtime configurations

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc.options]
    TypeUrl = "io.containerd.runsc.v1.options"
    ConfigPath = "/etc/containerd/runsc-systrap.toml"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc-kvm]
  runtime_type = "io.containerd.runsc.v1"
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc-kvm.options]
    TypeUrl = "io.containerd.runsc.v1.options"
    ConfigPath = "/etc/containerd/runsc-kvm.toml"
```

---

## Container Base Image

### Base Image Selection

We use **Ubuntu 22.04 LTS** as the base image for the following reasons:

| Criteria | Ubuntu 22.04 | Debian 12 | Alpine 3.18 |
|----------|--------------|-----------|-------------|
| **Package availability** | Excellent | Good | Limited |
| **glibc compatibility** | Yes | Yes | No (musl) |
| **Security updates** | 5 years LTS | 3 years | 2 years |
| **Image size** | ~77MB | ~124MB | ~7MB |
| **Node.js compatibility** | Full | Full | Partial |
| **Python compatibility** | Full | Full | Partial |
| **Developer familiarity** | High | Medium | Low |

### Base Image Dockerfile

```dockerfile
# Dockerfile.base
FROM ubuntu:22.04 AS base

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# System configuration
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# Install essential packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    ca-certificates \
    curl \
    wget \
    git \
    gnupg \
    lsb-release \
    # Build tools
    build-essential \
    # Process management
    tini \
    # Shell
    bash \
    zsh \
    # Editors
    vim \
    nano \
    # Networking
    net-tools \
    iputils-ping \
    dnsutils \
    # File utilities
    zip \
    unzip \
    tar \
    gzip \
    # Process utilities
    htop \
    procps \
    # Locales
    locales \
    && rm -rf /var/lib/apt/lists/*

# Generate locales
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Create sandbox user
RUN useradd -m -s /bin/bash -u 1000 sandbox && \
    mkdir -p /home/sandbox && \
    chown -R sandbox:sandbox /home/sandbox

# Install Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm@9 yarn && \
    rm -rf /var/lib/apt/lists/*

# Install Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Install Go 1.22
RUN curl -fsSL https://go.dev/dl/go1.22.0.linux-amd64.tar.gz | tar -C /usr/local -xzf -
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/home/sandbox/go"

# Install Rust (optional, for performance-critical tools)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set working directory
WORKDIR /home/sandbox

# Switch to sandbox user
USER sandbox

# Set entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/bin/bash"]
```

### Multi-Stage Build for Optimization

```dockerfile
# Dockerfile.sandbox
# Stage 1: Build tools and dependencies
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Pre-download common packages
RUN mkdir -p /cache/npm && \
    npm config set cache /cache/npm

# Stage 2: Runtime image
FROM ubuntu:22.04 AS runtime

# Copy only necessary files from builder
COPY --from=builder /cache /cache

# ... rest of configuration
```

### Image Size Optimization

```dockerfile
# Optimized production image
FROM ubuntu:22.04 AS production

# Single RUN command to minimize layers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates curl git build-essential tini bash \
        locales && \
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm@9 && \
    # Cleanup
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    npm cache clean --force && \
    # Create user
    useradd -m -s /bin/bash -u 1000 sandbox

# Final image size: ~450MB (compared to ~1.2GB unoptimized)
```

---

## Cold Start Performance

### Cold Start Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           COLD START TIMELINE                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  T+0ms        T+200ms      T+800ms      T+1500ms     T+2500ms     T+4000ms             │
│    │            │            │            │            │            │                   │
│    ▼            ▼            ▼            ▼            ▼            ▼                   │
│  ┌────┐      ┌────┐       ┌────┐       ┌────┐       ┌────┐       ┌────┐               │
│  │Sched│     │Image│      │gVisor│     │User │      │Deps │      │Ready│              │
│  │ule  │────►│Pull │─────►│Init │─────►│Space│─────►│Load │─────►│    │               │
│  └────┘      └────┘       └────┘       └────┘       └────┘       └────┘               │
│                                                                                         │
│  Phases:                                                                                │
│  1. Schedule pod (50-200ms)                                                            │
│  2. Pull image layers (0-500ms, cached: 0ms)                                           │
│  3. gVisor sentry init (300-800ms)                                                     │
│  4. User space setup (200-500ms)                                                       │
│  5. Dependencies load (500-2000ms)                                                     │
│  6. Ready for requests                                                                 │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Measured Cold Start Times

| Scenario | P50 | P95 | P99 | Notes |
|----------|-----|-----|-----|-------|
| **Empty sandbox** | 1.2s | 2.1s | 3.5s | Base image only |
| **With Node.js deps** | 2.5s | 4.2s | 6.0s | node_modules cached |
| **With build cache** | 1.8s | 3.0s | 4.5s | Warm cache |
| **From warm pool** | 0.3s | 0.5s | 0.8s | Pre-warmed |

### Cold Start Optimization

```typescript
// cold-start-optimizer.ts

interface ColdStartMetrics {
  schedulingTime: number;
  imagePullTime: number;
  gvisorInitTime: number;
  userSpaceSetupTime: number;
  dependencyLoadTime: number;
  totalTime: number;
}

class ColdStartOptimizer {
  /**
   * Optimize cold start through various techniques
   */
  async optimizeColdStart(sandboxId: string): Promise<ColdStartMetrics> {
    const metrics: ColdStartMetrics = {
      schedulingTime: 0,
      imagePullTime: 0,
      gvisorInitTime: 0,
      userSpaceSetupTime: 0,
      dependencyLoadTime: 0,
      totalTime: 0,
    };

    const startTime = Date.now();

    // 1. Pre-pull images on all nodes
    await this.ensureImagePulled();
    metrics.imagePullTime = Date.now() - startTime;

    // 2. Use node affinity for cache locality
    const node = await this.selectOptimalNode(sandboxId);
    metrics.schedulingTime = Date.now() - startTime - metrics.imagePullTime;

    // 3. Parallel initialization
    await Promise.all([
      this.initGvisorSentry(),
      this.prepareUserSpace(),
      this.warmDependencyCache(),
    ]);

    metrics.totalTime = Date.now() - startTime;
    return metrics;
  }

  /**
   * Pre-pull images on all nodes
   */
  private async ensureImagePulled(): Promise<void> {
    // DaemonSet ensures image is on all nodes
    // No pull time if image is cached
  }

  /**
   * Select node with best cache locality
   */
  private async selectOptimalNode(sandboxId: string): Promise<string> {
    // Prefer nodes with:
    // 1. Warm dependency cache
    // 2. Recent similar workloads
    // 3. Available resources
    return 'node-1';
  }
}
```

### Image Pre-pulling DaemonSet

```yaml
# daemonset-image-puller.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: sandbox-image-puller
  namespace: sandbox-system
spec:
  selector:
    matchLabels:
      app: image-puller
  template:
    metadata:
      labels:
        app: image-puller
    spec:
      containers:
      - name: puller
        image: sandbox-base:latest
        command: ["sleep", "infinity"]
        resources:
          requests:
            cpu: "1m"
            memory: "1Mi"
          limits:
            cpu: "1m"
            memory: "1Mi"
      tolerations:
      - operator: Exists
```

---

## Warm Pool Management

### Warm Pool Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           WARM POOL ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         WARM POOL CONTROLLER                                     │   │
│  │                                                                                  │   │
│  │  • Monitors pool levels                                                         │   │
│  │  • Scales based on demand                                                       │   │
│  │  • Handles template-specific pools                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                          │
│              ┌───────────────┼───────────────┐                                         │
│              ▼               ▼               ▼                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                          │
│  │   us-east-1     │ │   eu-west-1     │ │   ap-south-1    │                          │
│  │                 │ │                 │ │                 │                          │
│  │  Generic: 50    │ │  Generic: 30    │ │  Generic: 20    │                          │
│  │  React: 20      │ │  React: 15      │ │  React: 10      │                          │
│  │  Next.js: 15    │ │  Next.js: 10    │ │  Next.js: 5     │                          │
│  │  Python: 10     │ │  Python: 8      │ │  Python: 5      │                          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                          │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Pool Configuration

| Region | Generic Pool | React Pool | Next.js Pool | Python Pool | Total |
|--------|--------------|------------|--------------|-------------|-------|
| **us-east-1** | 50 | 20 | 15 | 10 | 95 |
| **us-west-2** | 40 | 15 | 12 | 8 | 75 |
| **eu-west-1** | 30 | 15 | 10 | 8 | 63 |
| **eu-central-1** | 25 | 12 | 8 | 6 | 51 |
| **ap-south-1** | 20 | 10 | 5 | 5 | 40 |
| **ap-northeast-1** | 25 | 12 | 8 | 6 | 51 |
| **TOTAL** | 190 | 84 | 58 | 43 | **375** |

### Warm Pool Controller

```typescript
// warm-pool-controller.ts

interface PoolConfig {
  region: string;
  template: string;
  minSize: number;
  maxSize: number;
  targetSize: number;
  scaleUpThreshold: number;   // % of pool used
  scaleDownThreshold: number; // % of pool used
}

interface PoolStatus {
  available: number;
  inUse: number;
  warming: number;
  total: number;
}

class WarmPoolController {
  private pools: Map<string, PoolConfig> = new Map();
  private status: Map<string, PoolStatus> = new Map();

  constructor() {
    this.initializePools();
    this.startMonitoring();
  }

  /**
   * Initialize warm pools for all regions and templates
   */
  private initializePools(): void {
    const configs: PoolConfig[] = [
      // US East
      { region: 'us-east-1', template: 'generic', minSize: 30, maxSize: 100, targetSize: 50, scaleUpThreshold: 70, scaleDownThreshold: 30 },
      { region: 'us-east-1', template: 'react-vite', minSize: 10, maxSize: 40, targetSize: 20, scaleUpThreshold: 70, scaleDownThreshold: 30 },
      { region: 'us-east-1', template: 'nextjs', minSize: 8, maxSize: 30, targetSize: 15, scaleUpThreshold: 70, scaleDownThreshold: 30 },
      { region: 'us-east-1', template: 'python-fastapi', minSize: 5, maxSize: 20, targetSize: 10, scaleUpThreshold: 70, scaleDownThreshold: 30 },
      
      // EU West
      { region: 'eu-west-1', template: 'generic', minSize: 20, maxSize: 60, targetSize: 30, scaleUpThreshold: 70, scaleDownThreshold: 30 },
      { region: 'eu-west-1', template: 'react-vite', minSize: 8, maxSize: 30, targetSize: 15, scaleUpThreshold: 70, scaleDownThreshold: 30 },
      
      // Add more regions...
    ];

    for (const config of configs) {
      const key = `${config.region}:${config.template}`;
      this.pools.set(key, config);
      this.status.set(key, { available: 0, inUse: 0, warming: 0, total: 0 });
    }
  }

  /**
   * Acquire a warm sandbox from pool
   */
  async acquire(region: string, template: string): Promise<string | null> {
    const key = `${region}:${template}`;
    const status = this.status.get(key);
    
    if (!status || status.available === 0) {
      // Try generic pool as fallback
      const genericKey = `${region}:generic`;
      const genericStatus = this.status.get(genericKey);
      
      if (!genericStatus || genericStatus.available === 0) {
        return null; // No warm sandbox available
      }
      
      return this.acquireFromPool(genericKey);
    }
    
    return this.acquireFromPool(key);
  }

  /**
   * Acquire from specific pool
   */
  private async acquireFromPool(poolKey: string): Promise<string> {
    const status = this.status.get(poolKey)!;
    
    // Get available sandbox
    const sandboxId = await this.getAvailableSandbox(poolKey);
    
    // Update status
    status.available--;
    status.inUse++;
    
    // Trigger replenishment if needed
    await this.checkAndReplenish(poolKey);
    
    return sandboxId;
  }

  /**
   * Release sandbox back to pool or destroy
   */
  async release(sandboxId: string, poolKey: string): Promise<void> {
    const status = this.status.get(poolKey);
    const config = this.pools.get(poolKey);
    
    if (!status || !config) {
      await this.destroySandbox(sandboxId);
      return;
    }

    // Check if sandbox can be recycled
    const canRecycle = await this.canRecycleSandbox(sandboxId);
    
    if (canRecycle && status.total < config.maxSize) {
      // Reset and return to pool
      await this.resetSandbox(sandboxId);
      status.inUse--;
      status.available++;
    } else {
      // Destroy sandbox
      await this.destroySandbox(sandboxId);
      status.inUse--;
      status.total--;
    }
  }

  /**
   * Check and replenish pool
   */
  private async checkAndReplenish(poolKey: string): Promise<void> {
    const status = this.status.get(poolKey)!;
    const config = this.pools.get(poolKey)!;
    
    const utilizationPercent = ((status.inUse + status.warming) / status.total) * 100;
    
    if (utilizationPercent >= config.scaleUpThreshold) {
      const toCreate = Math.min(
        config.maxSize - status.total,
        Math.ceil(config.targetSize * 0.2) // Scale up by 20%
      );
      
      if (toCreate > 0) {
        await this.warmSandboxes(poolKey, toCreate);
      }
    }
  }

  /**
   * Warm new sandboxes
   */
  private async warmSandboxes(poolKey: string, count: number): Promise<void> {
    const status = this.status.get(poolKey)!;
    const [region, template] = poolKey.split(':');
    
    status.warming += count;
    
    const promises = Array(count).fill(null).map(async () => {
      try {
        const sandboxId = await this.createWarmSandbox(region, template);
        status.warming--;
        status.available++;
        status.total++;
        return sandboxId;
      } catch (error) {
        status.warming--;
        throw error;
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Create a warm sandbox
   */
  private async createWarmSandbox(region: string, template: string): Promise<string> {
    // Create sandbox with template pre-loaded
    const sandbox = await k8sClient.createSandbox({
      region,
      template,
      warm: true,
    });
    
    // Wait for sandbox to be ready
    await this.waitForReady(sandbox.id);
    
    // Pre-warm dependencies
    await this.prewarmDependencies(sandbox.id, template);
    
    return sandbox.id;
  }

  /**
   * Pre-warm dependencies for template
   */
  private async prewarmDependencies(sandboxId: string, template: string): Promise<void> {
    switch (template) {
      case 'react-vite':
        await this.execInSandbox(sandboxId, 'pnpm install vite react react-dom');
        break;
      case 'nextjs':
        await this.execInSandbox(sandboxId, 'pnpm install next react react-dom');
        break;
      case 'python-fastapi':
        await this.execInSandbox(sandboxId, 'pip install fastapi uvicorn');
        break;
    }
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    setInterval(async () => {
      for (const [poolKey, config] of this.pools.entries()) {
        const status = this.status.get(poolKey)!;
        
        // Log metrics
        metrics.gauge('warm_pool_available', status.available, { pool: poolKey });
        metrics.gauge('warm_pool_in_use', status.inUse, { pool: poolKey });
        metrics.gauge('warm_pool_total', status.total, { pool: poolKey });
        
        // Check for scale down
        const utilizationPercent = (status.inUse / status.total) * 100;
        if (utilizationPercent < config.scaleDownThreshold && status.total > config.minSize) {
          const toRemove = Math.min(
            status.available,
            status.total - config.minSize,
            Math.ceil(config.targetSize * 0.1) // Scale down by 10%
          );
          
          if (toRemove > 0) {
            await this.drainSandboxes(poolKey, toRemove);
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Drain excess sandboxes
   */
  private async drainSandboxes(poolKey: string, count: number): Promise<void> {
    const status = this.status.get(poolKey)!;
    
    for (let i = 0; i < count && status.available > 0; i++) {
      const sandboxId = await this.getAvailableSandbox(poolKey);
      await this.destroySandbox(sandboxId);
      status.available--;
      status.total--;
    }
  }
}

export { WarmPoolController, PoolConfig, PoolStatus };
```

### Kubernetes Warm Pool Operator

```yaml
# warm-pool-crd.yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: warmpools.sandbox.io
spec:
  group: sandbox.io
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              template:
                type: string
              minSize:
                type: integer
              maxSize:
                type: integer
              targetSize:
                type: integer
              scaleUpThreshold:
                type: integer
              scaleDownThreshold:
                type: integer
          status:
            type: object
            properties:
              available:
                type: integer
              inUse:
                type: integer
              warming:
                type: integer
  scope: Namespaced
  names:
    plural: warmpools
    singular: warmpool
    kind: WarmPool
---
# warm-pool-instance.yaml
apiVersion: sandbox.io/v1
kind: WarmPool
metadata:
  name: react-vite-pool
  namespace: sandbox-system
spec:
  template: react-vite
  minSize: 10
  maxSize: 40
  targetSize: 20
  scaleUpThreshold: 70
  scaleDownThreshold: 30
```

---

## Container Lifetime Management

### Maximum Lifetime Configuration

| Sandbox Type | Max Lifetime | Reason |
|--------------|--------------|--------|
| **Development** | 24 hours | Active development session |
| **Preview** | 7 days | Deployment preview |
| **CI/CD** | 2 hours | Build/test job |
| **Warm pool** | 1 hour | Freshness guarantee |

### Lifetime Controller

```typescript
// lifetime-controller.ts

interface LifetimeConfig {
  maxLifetime: number;        // seconds
  warningThreshold: number;   // seconds before max
  gracePeriod: number;        // seconds for graceful shutdown
  extensionAllowed: boolean;
  maxExtensions: number;
}

const lifetimeConfigs: Record<string, LifetimeConfig> = {
  development: {
    maxLifetime: 24 * 60 * 60,      // 24 hours
    warningThreshold: 30 * 60,      // 30 min warning
    gracePeriod: 5 * 60,            // 5 min grace
    extensionAllowed: true,
    maxExtensions: 3,
  },
  preview: {
    maxLifetime: 7 * 24 * 60 * 60,  // 7 days
    warningThreshold: 24 * 60 * 60, // 24 hour warning
    gracePeriod: 60 * 60,           // 1 hour grace
    extensionAllowed: true,
    maxExtensions: 2,
  },
  cicd: {
    maxLifetime: 2 * 60 * 60,       // 2 hours
    warningThreshold: 15 * 60,      // 15 min warning
    gracePeriod: 5 * 60,            // 5 min grace
    extensionAllowed: false,
    maxExtensions: 0,
  },
  warmPool: {
    maxLifetime: 60 * 60,           // 1 hour
    warningThreshold: 10 * 60,      // 10 min warning
    gracePeriod: 0,                 // No grace
    extensionAllowed: false,
    maxExtensions: 0,
  },
};

class LifetimeController {
  private sandboxes: Map<string, SandboxLifetime> = new Map();

  /**
   * Register sandbox with lifetime tracking
   */
  register(sandboxId: string, type: string): void {
    const config = lifetimeConfigs[type] || lifetimeConfigs.development;
    
    this.sandboxes.set(sandboxId, {
      sandboxId,
      type,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + config.maxLifetime * 1000),
      extensions: 0,
      config,
    });
  }

  /**
   * Extend sandbox lifetime
   */
  async extend(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    
    if (!sandbox) {
      return false;
    }
    
    if (!sandbox.config.extensionAllowed) {
      return false;
    }
    
    if (sandbox.extensions >= sandbox.config.maxExtensions) {
      return false;
    }
    
    // Extend by 50% of original lifetime
    const extension = sandbox.config.maxLifetime * 0.5 * 1000;
    sandbox.expiresAt = new Date(sandbox.expiresAt.getTime() + extension);
    sandbox.extensions++;
    
    return true;
  }

  /**
   * Check and enforce lifetimes
   */
  async enforceLifetimes(): Promise<void> {
    const now = Date.now();
    
    for (const [sandboxId, sandbox] of this.sandboxes.entries()) {
      const timeRemaining = sandbox.expiresAt.getTime() - now;
      
      // Send warning
      if (timeRemaining <= sandbox.config.warningThreshold * 1000 && 
          timeRemaining > sandbox.config.gracePeriod * 1000) {
        await this.sendWarning(sandboxId, timeRemaining);
      }
      
      // Start graceful shutdown
      if (timeRemaining <= sandbox.config.gracePeriod * 1000 && 
          timeRemaining > 0) {
        await this.startGracefulShutdown(sandboxId);
      }
      
      // Force termination
      if (timeRemaining <= 0) {
        await this.forceTerminate(sandboxId);
        this.sandboxes.delete(sandboxId);
      }
    }
  }

  /**
   * Send expiration warning
   */
  private async sendWarning(sandboxId: string, timeRemaining: number): Promise<void> {
    const minutes = Math.ceil(timeRemaining / 60000);
    
    await notificationService.send(sandboxId, {
      type: 'warning',
      title: 'Sandbox Expiring Soon',
      message: `Your sandbox will expire in ${minutes} minutes. Save your work or extend the session.`,
      actions: ['extend', 'save', 'dismiss'],
    });
  }

  /**
   * Start graceful shutdown
   */
  private async startGracefulShutdown(sandboxId: string): Promise<void> {
    // Save current state
    await checkpointService.createCheckpoint(sandboxId, 'auto-save-before-expiry');
    
    // Notify user
    await notificationService.send(sandboxId, {
      type: 'critical',
      title: 'Sandbox Shutting Down',
      message: 'Your sandbox is being shut down. A checkpoint has been saved.',
    });
    
    // Stop dev server gracefully
    await sandboxService.stopDevServer(sandboxId);
  }

  /**
   * Force terminate sandbox
   */
  private async forceTerminate(sandboxId: string): Promise<void> {
    await sandboxService.terminate(sandboxId, { force: true });
  }
}

export { LifetimeController, LifetimeConfig };
```

### Kubernetes TTL Controller

```yaml
# sandbox-ttl-controller.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox-ttl-controller
  namespace: sandbox-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ttl-controller
  template:
    metadata:
      labels:
        app: ttl-controller
    spec:
      serviceAccountName: ttl-controller
      containers:
      - name: controller
        image: sandbox-ttl-controller:latest
        env:
        - name: CHECK_INTERVAL
          value: "60"  # Check every 60 seconds
        - name: DEFAULT_TTL
          value: "86400"  # 24 hours
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
```

---

## Production Configuration

### Complete Production Setup

```yaml
# production-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: sandbox-config
  namespace: sandbox-system
data:
  # gVisor configuration
  gvisor.platform: "systrap"
  gvisor.network: "sandbox"
  gvisor.overlay: "true"
  
  # Container configuration
  container.baseImage: "sandbox-base:ubuntu-22.04-v1.2.3"
  container.user: "sandbox"
  container.uid: "1000"
  
  # Resource defaults
  resources.cpu.default: "1000m"
  resources.cpu.limit: "4000m"
  resources.memory.default: "2Gi"
  resources.memory.limit: "8Gi"
  resources.disk.default: "10Gi"
  resources.disk.limit: "50Gi"
  
  # Lifetime configuration
  lifetime.development: "86400"    # 24 hours
  lifetime.preview: "604800"       # 7 days
  lifetime.cicd: "7200"            # 2 hours
  
  # Warm pool configuration
  warmpool.generic.min: "30"
  warmpool.generic.max: "100"
  warmpool.generic.target: "50"
  warmpool.react.min: "10"
  warmpool.react.max: "40"
  warmpool.react.target: "20"
```

### Monitoring and Metrics

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: sandbox-alerts
  namespace: sandbox-system
spec:
  groups:
  - name: sandbox.rules
    rules:
    - alert: HighColdStartLatency
      expr: histogram_quantile(0.95, sandbox_cold_start_seconds_bucket) > 5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High cold start latency detected"
        
    - alert: WarmPoolDepleted
      expr: sandbox_warm_pool_available < 5
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "Warm pool is nearly depleted"
        
    - alert: SandboxLifetimeExceeded
      expr: sandbox_lifetime_seconds > 90000  # 25 hours
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "Sandbox exceeded maximum lifetime"
```

---

## Summary

### Configuration Choices

| Component | Choice | Reason |
|-----------|--------|--------|
| **gVisor Platform** | systrap | Best balance of performance and compatibility |
| **Base Image** | Ubuntu 22.04 | LTS support, package availability, compatibility |
| **Cold Start Target** | <2s (P50) | User experience requirement |
| **Warm Pool Size** | 375 total | Regional demand distribution |
| **Max Lifetime** | 24h (dev) | Resource management |

### Performance Targets

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| Cold start (empty) | <1.5s | <3s | >5s |
| Cold start (deps) | <3s | <5s | >8s |
| Warm pool acquisition | <500ms | <1s | >2s |
| gVisor overhead | <10% | <20% | >30% |

### Best Practices

1. **Use systrap platform** for cloud deployments
2. **Pre-pull images** on all nodes via DaemonSet
3. **Maintain warm pools** per region and template
4. **Monitor cold start latency** and adjust pool sizes
5. **Enforce lifetime limits** to prevent resource leaks
6. **Use Ubuntu 22.04** for maximum compatibility
