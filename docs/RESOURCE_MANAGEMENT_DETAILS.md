# Resource Management Details

This guide covers OOM handling, CPU burst policies, network shaping, storage quotas, and fair CPU scheduling across sandboxes.

---

## Table of Contents

1. [OOM Handling](#oom-handling)
2. [CPU Burst Policies](#cpu-burst-policies)
3. [Network Shaping](#network-shaping)
4. [Storage Quotas](#storage-quotas)
5. [Fair CPU Scheduling](#fair-cpu-scheduling)

---

## OOM Handling

### Strategy: Kill Processes, Not Throttle

When a sandbox hits its memory limit, we **kill processes** rather than throttle. This provides clearer feedback and prevents zombie states.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           OOM HANDLING FLOW                                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Memory Usage Monitoring                                                                │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  0%────────50%────────75%────────90%────────95%────────100%                     │   │
│  │  │         │          │          │          │           │                       │   │
│  │  │      Normal     Warning    Critical   Danger       OOM                       │   │
│  │  │                    │          │          │           │                       │   │
│  │  │                 Log warn   Alert     Soft limit   Kill                       │   │
│  │  │                            user      (reclaim)    processes                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### cgroups v2 Memory Configuration

```yaml
# Kubernetes Pod spec for sandbox
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-abc123
spec:
  containers:
  - name: sandbox
    resources:
      requests:
        memory: "512Mi"
      limits:
        memory: "2Gi"
    # Memory QoS settings
    securityContext:
      # Prevent OOM score adjustment
      procMount: Default
```

### OOM Killer Configuration

```typescript
// oom-handler.ts

interface OOMConfig {
  softLimitPercent: number;    // Trigger reclaim
  hardLimitPercent: number;    // Trigger OOM
  oomScoreAdj: number;         // OOM priority (-1000 to 1000)
  reclaimStrategy: 'cache' | 'swap' | 'kill';
  killOrder: string[];         // Process kill priority
}

const defaultOOMConfig: OOMConfig = {
  softLimitPercent: 90,
  hardLimitPercent: 100,
  oomScoreAdj: 500,  // Higher = more likely to be killed
  reclaimStrategy: 'cache',
  killOrder: [
    'chrome',           // Browser processes (heavy)
    'node',             // Node.js processes
    'python',           // Python processes
    'java',             // Java processes
    'code-server',      // VS Code server
  ],
};

class OOMHandler {
  private config: OOMConfig;
  private memoryWatcher: NodeJS.Timer | null = null;
  
  constructor(config: Partial<OOMConfig> = {}) {
    this.config = { ...defaultOOMConfig, ...config };
  }
  
  /**
   * Start memory monitoring
   */
  startMonitoring(sandboxId: string, memoryLimitBytes: number): void {
    this.memoryWatcher = setInterval(async () => {
      const usage = await this.getMemoryUsage(sandboxId);
      const percent = (usage / memoryLimitBytes) * 100;
      
      if (percent >= this.config.hardLimitPercent) {
        await this.handleOOM(sandboxId);
      } else if (percent >= this.config.softLimitPercent) {
        await this.handleSoftLimit(sandboxId);
      }
    }, 1000);  // Check every second
  }
  
  /**
   * Get memory usage from cgroups
   */
  private async getMemoryUsage(sandboxId: string): Promise<number> {
    // Read from cgroups v2
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const currentUsage = await fs.readFile(
      `${cgroupPath}/memory.current`,
      'utf-8'
    );
    return parseInt(currentUsage.trim(), 10);
  }
  
  /**
   * Handle soft limit (reclaim memory)
   */
  private async handleSoftLimit(sandboxId: string): Promise<void> {
    console.log(`Sandbox ${sandboxId}: Memory soft limit reached, reclaiming`);
    
    switch (this.config.reclaimStrategy) {
      case 'cache':
        // Drop caches
        await this.dropCaches(sandboxId);
        break;
        
      case 'swap':
        // Force swap out
        await this.forceSwap(sandboxId);
        break;
        
      case 'kill':
        // Kill lowest priority process
        await this.killLowestPriority(sandboxId);
        break;
    }
    
    // Notify user
    await this.notifyUser(sandboxId, 'warning', 
      'Memory usage is high. Consider closing unused applications.');
  }
  
  /**
   * Handle OOM (kill processes)
   */
  private async handleOOM(sandboxId: string): Promise<void> {
    console.log(`Sandbox ${sandboxId}: OOM triggered`);
    
    // Get processes sorted by memory usage
    const processes = await this.getProcessesByMemory(sandboxId);
    
    // Kill processes in order until memory is freed
    for (const proc of processes) {
      if (this.shouldKill(proc)) {
        await this.killProcess(sandboxId, proc.pid);
        
        // Check if enough memory freed
        const usage = await this.getMemoryUsage(sandboxId);
        if (usage < this.config.softLimitPercent) {
          break;
        }
      }
    }
    
    // Notify user
    await this.notifyUser(sandboxId, 'error',
      'Out of memory. Some processes were terminated.');
  }
  
  /**
   * Drop filesystem caches
   */
  private async dropCaches(sandboxId: string): Promise<void> {
    // Drop page cache, dentries, and inodes
    await execInSandbox(sandboxId, 'sync && echo 3 > /proc/sys/vm/drop_caches');
  }
  
  /**
   * Force swap out
   */
  private async forceSwap(sandboxId: string): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    // Force memory reclaim
    await fs.writeFile(`${cgroupPath}/memory.reclaim`, '1');
  }
  
  /**
   * Kill lowest priority process
   */
  private async killLowestPriority(sandboxId: string): Promise<void> {
    const processes = await this.getProcessesByMemory(sandboxId);
    
    // Find first killable process
    for (const proc of processes) {
      if (this.shouldKill(proc)) {
        await this.killProcess(sandboxId, proc.pid);
        return;
      }
    }
  }
  
  /**
   * Get processes sorted by memory (descending)
   */
  private async getProcessesByMemory(sandboxId: string): Promise<ProcessInfo[]> {
    const result = await execInSandbox(sandboxId, 
      'ps aux --sort=-%mem | head -20'
    );
    
    return this.parseProcessList(result.stdout);
  }
  
  /**
   * Check if process should be killed
   */
  private shouldKill(proc: ProcessInfo): boolean {
    // Never kill essential processes
    const essential = ['init', 'systemd', 'sshd', 'containerd'];
    if (essential.includes(proc.name)) {
      return false;
    }
    
    // Check kill order
    const priority = this.config.killOrder.indexOf(proc.name);
    return priority !== -1 || proc.memoryPercent > 10;
  }
  
  /**
   * Kill process
   */
  private async killProcess(sandboxId: string, pid: number): Promise<void> {
    console.log(`Killing process ${pid} in sandbox ${sandboxId}`);
    await execInSandbox(sandboxId, `kill -9 ${pid}`);
  }
}

interface ProcessInfo {
  pid: number;
  name: string;
  memoryPercent: number;
  memoryBytes: number;
  cpuPercent: number;
}

export { OOMHandler, OOMConfig };
```

### Kubernetes Memory QoS

```yaml
# memory-qos-class.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: sandbox-memory-limits
  namespace: sandboxes
spec:
  limits:
  - type: Container
    default:
      memory: "2Gi"
    defaultRequest:
      memory: "512Mi"
    max:
      memory: "8Gi"
    min:
      memory: "256Mi"
---
# ResourceQuota for namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: sandbox-quota
  namespace: sandboxes
spec:
  hard:
    requests.memory: "100Gi"
    limits.memory: "200Gi"
    pods: "100"
```

---

## CPU Burst Policies

### Burst Configuration

We allow **CPU bursting for up to 30 seconds** before throttling kicks in.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CPU BURST TIMELINE                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CPU Usage                                                                              │
│  400% ┤                    ████████████                                                 │
│       │                    █ BURST    █                                                 │
│  300% ┤                    █ ALLOWED  █                                                 │
│       │                    █ (30s)    █                                                 │
│  200% ┤                    █          █                                                 │
│       │                    █          █                                                 │
│  100% ┤────────────────────█──────────█────────────────────── LIMIT                    │
│       │  Normal usage      █          █  Throttled                                      │
│   50% ┤                    █          █                                                 │
│       │                    █          █                                                 │
│    0% ┼────────────────────┴──────────┴────────────────────────────────▶ Time          │
│       0s                  10s        40s                               60s              │
│                                                                                         │
│  Legend:                                                                                │
│  ─── Normal operation (within limits)                                                   │
│  ███ Burst period (up to 4x limit for 30s)                                             │
│  ─── Throttled (back to limit)                                                         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### cgroups v2 CPU Configuration

```typescript
// cpu-burst-manager.ts

interface CPUBurstConfig {
  burstDurationMs: number;     // Max burst duration
  burstMultiplier: number;     // Max burst (e.g., 4x limit)
  cooldownMs: number;          // Cooldown after burst
  quotaPeriodUs: number;       // CFS period (100ms default)
}

const defaultCPUBurstConfig: CPUBurstConfig = {
  burstDurationMs: 30000,      // 30 seconds
  burstMultiplier: 4,          // 4x normal limit
  cooldownMs: 60000,           // 1 minute cooldown
  quotaPeriodUs: 100000,       // 100ms
};

class CPUBurstManager {
  private config: CPUBurstConfig;
  private burstState: Map<string, BurstState> = new Map();
  
  constructor(config: Partial<CPUBurstConfig> = {}) {
    this.config = { ...defaultCPUBurstConfig, ...config };
  }
  
  /**
   * Configure CPU limits for sandbox
   */
  async configureCPU(
    sandboxId: string,
    cpuLimit: number  // Number of cores (e.g., 2.0)
  ): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Calculate quota (microseconds per period)
    const quotaUs = cpuLimit * this.config.quotaPeriodUs;
    const burstUs = quotaUs * this.config.burstMultiplier;
    
    // Set CPU quota
    await fs.writeFile(
      `${cgroupPath}/cpu.max`,
      `${quotaUs} ${this.config.quotaPeriodUs}`
    );
    
    // Set CPU burst (cgroups v2)
    await fs.writeFile(
      `${cgroupPath}/cpu.max.burst`,
      `${burstUs}`
    );
    
    // Initialize burst state
    this.burstState.set(sandboxId, {
      burstStartTime: null,
      burstUsed: 0,
      inCooldown: false,
      cooldownEndTime: null,
    });
  }
  
  /**
   * Monitor and manage CPU burst
   */
  async monitorBurst(sandboxId: string): Promise<void> {
    const state = this.burstState.get(sandboxId);
    if (!state) return;
    
    const usage = await this.getCPUUsage(sandboxId);
    const limit = await this.getCPULimit(sandboxId);
    
    // Check if bursting
    if (usage > limit) {
      if (!state.burstStartTime) {
        // Start burst tracking
        state.burstStartTime = Date.now();
        console.log(`Sandbox ${sandboxId}: CPU burst started`);
      }
      
      // Check burst duration
      const burstDuration = Date.now() - state.burstStartTime;
      if (burstDuration > this.config.burstDurationMs) {
        // Burst exceeded, throttle
        await this.throttle(sandboxId);
        state.inCooldown = true;
        state.cooldownEndTime = Date.now() + this.config.cooldownMs;
        console.log(`Sandbox ${sandboxId}: CPU burst limit exceeded, throttling`);
      }
    } else {
      // Reset burst tracking
      state.burstStartTime = null;
    }
    
    // Check cooldown
    if (state.inCooldown && state.cooldownEndTime) {
      if (Date.now() > state.cooldownEndTime) {
        await this.unthrottle(sandboxId);
        state.inCooldown = false;
        state.cooldownEndTime = null;
        console.log(`Sandbox ${sandboxId}: CPU cooldown ended`);
      }
    }
  }
  
  /**
   * Get current CPU usage
   */
  private async getCPUUsage(sandboxId: string): Promise<number> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const stat = await fs.readFile(`${cgroupPath}/cpu.stat`, 'utf-8');
    
    // Parse usage_usec
    const match = stat.match(/usage_usec (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  /**
   * Get CPU limit
   */
  private async getCPULimit(sandboxId: string): Promise<number> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const max = await fs.readFile(`${cgroupPath}/cpu.max`, 'utf-8');
    
    const [quota, period] = max.trim().split(' ').map(Number);
    return quota / period;  // Returns number of cores
  }
  
  /**
   * Throttle CPU (remove burst)
   */
  private async throttle(sandboxId: string): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Set burst to 0
    await fs.writeFile(`${cgroupPath}/cpu.max.burst`, '0');
  }
  
  /**
   * Unthrottle CPU (restore burst)
   */
  private async unthrottle(sandboxId: string): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const limit = await this.getCPULimit(sandboxId);
    
    // Restore burst
    const burstUs = limit * this.config.quotaPeriodUs * this.config.burstMultiplier;
    await fs.writeFile(`${cgroupPath}/cpu.max.burst`, `${burstUs}`);
  }
}

interface BurstState {
  burstStartTime: number | null;
  burstUsed: number;
  inCooldown: boolean;
  cooldownEndTime: number | null;
}

export { CPUBurstManager, CPUBurstConfig };
```

### Kubernetes CPU Configuration

```yaml
# cpu-burst-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-abc123
  annotations:
    # Enable CPU burst (if supported by runtime)
    cpu-burst.alpha.kubernetes.io/enabled: "true"
    cpu-burst.alpha.kubernetes.io/burst-percent: "400"
    cpu-burst.alpha.kubernetes.io/burst-duration: "30s"
spec:
  containers:
  - name: sandbox
    resources:
      requests:
        cpu: "500m"      # 0.5 cores guaranteed
      limits:
        cpu: "2000m"     # 2 cores max (can burst to 8 for 30s)
```

---

## Network Shaping

### Implementation: tc (Traffic Control) + CNI

We use **tc (traffic control)** via CNI plugins for network bandwidth limits.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           NETWORK SHAPING ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX POD                              HOST NETWORK                                  │
│  ┌─────────────────────────┐              ┌─────────────────────────────────────────┐  │
│  │  eth0 (veth pair)       │              │  veth-abc123                            │  │
│  │  ├── Ingress limit      │◀────────────▶│  ├── tc qdisc (HTB)                    │  │
│  │  │   (10 Mbps)          │              │  │   ├── class 1:1 (rate 10mbit)       │  │
│  │  └── Egress limit       │              │  │   └── class 1:2 (rate 10mbit)       │  │
│  │      (10 Mbps)          │              │  └── tc filter (classify traffic)      │  │
│  └─────────────────────────┘              └─────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### tc Configuration

```typescript
// network-shaper.ts

interface NetworkShapingConfig {
  ingressRateMbps: number;
  egressRateMbps: number;
  burstKb: number;
  latencyMs: number;
}

const tierConfigs: Record<string, NetworkShapingConfig> = {
  free: {
    ingressRateMbps: 10,
    egressRateMbps: 10,
    burstKb: 32,
    latencyMs: 50,
  },
  pro: {
    ingressRateMbps: 50,
    egressRateMbps: 50,
    burstKb: 64,
    latencyMs: 20,
  },
  enterprise: {
    ingressRateMbps: 100,
    egressRateMbps: 100,
    burstKb: 128,
    latencyMs: 10,
  },
};

class NetworkShaper {
  /**
   * Apply network shaping to sandbox
   */
  async applyShaping(
    sandboxId: string,
    vethInterface: string,
    tier: string
  ): Promise<void> {
    const config = tierConfigs[tier] || tierConfigs.free;
    
    // Clear existing rules
    await this.clearRules(vethInterface);
    
    // Apply egress shaping (outbound from sandbox)
    await this.applyEgressShaping(vethInterface, config);
    
    // Apply ingress shaping (inbound to sandbox)
    await this.applyIngressShaping(vethInterface, config);
  }
  
  /**
   * Clear existing tc rules
   */
  private async clearRules(iface: string): Promise<void> {
    try {
      await execAsync(`tc qdisc del dev ${iface} root 2>/dev/null || true`);
      await execAsync(`tc qdisc del dev ${iface} ingress 2>/dev/null || true`);
    } catch {
      // Ignore errors if no rules exist
    }
  }
  
  /**
   * Apply egress shaping (HTB qdisc)
   */
  private async applyEgressShaping(
    iface: string,
    config: NetworkShapingConfig
  ): Promise<void> {
    const rateBits = config.egressRateMbps * 1000000;
    const burstBytes = config.burstKb * 1024;
    
    // Create HTB qdisc
    await execAsync(`tc qdisc add dev ${iface} root handle 1: htb default 10`);
    
    // Create rate-limiting class
    await execAsync(
      `tc class add dev ${iface} parent 1: classid 1:10 htb ` +
      `rate ${rateBits}bit burst ${burstBytes} cburst ${burstBytes}`
    );
    
    // Add SFQ for fairness within the class
    await execAsync(`tc qdisc add dev ${iface} parent 1:10 handle 10: sfq perturb 10`);
  }
  
  /**
   * Apply ingress shaping (using IFB)
   */
  private async applyIngressShaping(
    iface: string,
    config: NetworkShapingConfig
  ): Promise<void> {
    const rateBits = config.ingressRateMbps * 1000000;
    const burstBytes = config.burstKb * 1024;
    const ifbDevice = `ifb-${iface.slice(-6)}`;
    
    // Create IFB device for ingress shaping
    await execAsync(`ip link add ${ifbDevice} type ifb 2>/dev/null || true`);
    await execAsync(`ip link set ${ifbDevice} up`);
    
    // Redirect ingress to IFB
    await execAsync(`tc qdisc add dev ${iface} handle ffff: ingress`);
    await execAsync(
      `tc filter add dev ${iface} parent ffff: protocol ip u32 match u32 0 0 ` +
      `action mirred egress redirect dev ${ifbDevice}`
    );
    
    // Apply shaping on IFB (now egress)
    await execAsync(`tc qdisc add dev ${ifbDevice} root handle 1: htb default 10`);
    await execAsync(
      `tc class add dev ${ifbDevice} parent 1: classid 1:10 htb ` +
      `rate ${rateBits}bit burst ${burstBytes}`
    );
  }
  
  /**
   * Get current bandwidth usage
   */
  async getBandwidthUsage(iface: string): Promise<{
    txBytes: number;
    rxBytes: number;
    txPackets: number;
    rxPackets: number;
  }> {
    const stats = await fs.readFile(`/sys/class/net/${iface}/statistics/tx_bytes`, 'utf-8');
    const rxStats = await fs.readFile(`/sys/class/net/${iface}/statistics/rx_bytes`, 'utf-8');
    const txPackets = await fs.readFile(`/sys/class/net/${iface}/statistics/tx_packets`, 'utf-8');
    const rxPackets = await fs.readFile(`/sys/class/net/${iface}/statistics/rx_packets`, 'utf-8');
    
    return {
      txBytes: parseInt(stats.trim(), 10),
      rxBytes: parseInt(rxStats.trim(), 10),
      txPackets: parseInt(txPackets.trim(), 10),
      rxPackets: parseInt(rxPackets.trim(), 10),
    };
  }
}

export { NetworkShaper, NetworkShapingConfig };
```

### CNI Plugin Configuration

```json
{
  "cniVersion": "0.4.0",
  "name": "sandbox-network",
  "plugins": [
    {
      "type": "bridge",
      "bridge": "sandbox-br0",
      "isGateway": true,
      "ipMasq": true,
      "ipam": {
        "type": "host-local",
        "subnet": "10.244.0.0/16",
        "routes": [
          { "dst": "0.0.0.0/0" }
        ]
      }
    },
    {
      "type": "bandwidth",
      "capabilities": {
        "bandwidth": true
      },
      "ingressRate": 10000000,
      "ingressBurst": 32768,
      "egressRate": 10000000,
      "egressBurst": 32768
    },
    {
      "type": "portmap",
      "capabilities": {
        "portMappings": true
      }
    }
  ]
}
```

---

## Storage Quotas

### Implementation: XFS Project Quotas

We use **XFS project quotas** for per-sandbox storage limits.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           XFS PROJECT QUOTA ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  XFS FILESYSTEM (/data)                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Project ID: 1001 (sandbox-abc123)                                              │   │
│  │  ├── Soft limit: 9 GB                                                           │   │
│  │  ├── Hard limit: 10 GB                                                          │   │
│  │  └── Grace period: 7 days                                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────────────┤   │
│  │  Project ID: 1002 (sandbox-def456)                                              │   │
│  │  ├── Soft limit: 45 GB                                                          │   │
│  │  ├── Hard limit: 50 GB                                                          │   │
│  │  └── Grace period: 7 days                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### XFS Quota Configuration

```typescript
// storage-quota.ts

interface StorageQuotaConfig {
  softLimitGB: number;
  hardLimitGB: number;
  inodeSoftLimit: number;
  inodeHardLimit: number;
  gracePeriodDays: number;
}

const tierQuotas: Record<string, StorageQuotaConfig> = {
  free: {
    softLimitGB: 9,
    hardLimitGB: 10,
    inodeSoftLimit: 900000,
    inodeHardLimit: 1000000,
    gracePeriodDays: 7,
  },
  pro: {
    softLimitGB: 45,
    hardLimitGB: 50,
    inodeSoftLimit: 4500000,
    inodeHardLimit: 5000000,
    gracePeriodDays: 14,
  },
  enterprise: {
    softLimitGB: 90,
    hardLimitGB: 100,
    inodeSoftLimit: 9000000,
    inodeHardLimit: 10000000,
    gracePeriodDays: 30,
  },
};

class StorageQuotaManager {
  private mountPoint: string;
  private projectIdCounter: number = 1000;
  private projectMap: Map<string, number> = new Map();
  
  constructor(mountPoint: string = '/data') {
    this.mountPoint = mountPoint;
  }
  
  /**
   * Initialize quota for sandbox
   */
  async initializeQuota(sandboxId: string, tier: string): Promise<void> {
    const config = tierQuotas[tier] || tierQuotas.free;
    const projectId = this.getOrCreateProjectId(sandboxId);
    const sandboxPath = `${this.mountPoint}/sandboxes/${sandboxId}`;
    
    // Create sandbox directory
    await fs.mkdir(sandboxPath, { recursive: true });
    
    // Set project ID on directory
    await this.setProjectId(sandboxPath, projectId);
    
    // Set quota limits
    await this.setQuotaLimits(projectId, config);
  }
  
  /**
   * Get or create project ID for sandbox
   */
  private getOrCreateProjectId(sandboxId: string): number {
    if (!this.projectMap.has(sandboxId)) {
      this.projectIdCounter++;
      this.projectMap.set(sandboxId, this.projectIdCounter);
      
      // Add to /etc/projid
      fs.appendFileSync('/etc/projid', `${sandboxId}:${this.projectIdCounter}\n`);
      
      // Add to /etc/projects
      fs.appendFileSync('/etc/projects', 
        `${this.projectIdCounter}:${this.mountPoint}/sandboxes/${sandboxId}\n`);
    }
    
    return this.projectMap.get(sandboxId)!;
  }
  
  /**
   * Set project ID on directory
   */
  private async setProjectId(path: string, projectId: number): Promise<void> {
    // Set project ID recursively
    await execAsync(`xfs_quota -x -c "project -s ${projectId}" ${this.mountPoint}`);
  }
  
  /**
   * Set quota limits
   */
  private async setQuotaLimits(
    projectId: number,
    config: StorageQuotaConfig
  ): Promise<void> {
    const softBlocks = config.softLimitGB * 1024 * 1024;  // KB
    const hardBlocks = config.hardLimitGB * 1024 * 1024;  // KB
    
    // Set block quota
    await execAsync(
      `xfs_quota -x -c "limit -p bsoft=${softBlocks}k bhard=${hardBlocks}k ${projectId}" ${this.mountPoint}`
    );
    
    // Set inode quota
    await execAsync(
      `xfs_quota -x -c "limit -p isoft=${config.inodeSoftLimit} ihard=${config.inodeHardLimit} ${projectId}" ${this.mountPoint}`
    );
  }
  
  /**
   * Get quota usage
   */
  async getQuotaUsage(sandboxId: string): Promise<{
    usedGB: number;
    softLimitGB: number;
    hardLimitGB: number;
    usedInodes: number;
    inodeLimit: number;
    percentUsed: number;
  }> {
    const projectId = this.projectMap.get(sandboxId);
    if (!projectId) {
      throw new Error(`No quota found for sandbox ${sandboxId}`);
    }
    
    const result = await execAsync(
      `xfs_quota -x -c "quota -p ${projectId}" ${this.mountPoint}`
    );
    
    // Parse output
    const lines = result.stdout.split('\n');
    const dataLine = lines.find(l => l.includes(projectId.toString()));
    
    if (!dataLine) {
      throw new Error('Could not parse quota output');
    }
    
    const parts = dataLine.trim().split(/\s+/);
    const usedKB = parseInt(parts[1], 10);
    const softKB = parseInt(parts[2], 10);
    const hardKB = parseInt(parts[3], 10);
    
    return {
      usedGB: usedKB / (1024 * 1024),
      softLimitGB: softKB / (1024 * 1024),
      hardLimitGB: hardKB / (1024 * 1024),
      usedInodes: parseInt(parts[5], 10),
      inodeLimit: parseInt(parts[7], 10),
      percentUsed: (usedKB / hardKB) * 100,
    };
  }
  
  /**
   * Remove quota for sandbox
   */
  async removeQuota(sandboxId: string): Promise<void> {
    const projectId = this.projectMap.get(sandboxId);
    if (!projectId) return;
    
    // Remove quota limits
    await execAsync(
      `xfs_quota -x -c "limit -p bsoft=0 bhard=0 isoft=0 ihard=0 ${projectId}" ${this.mountPoint}`
    );
    
    // Remove from map
    this.projectMap.delete(sandboxId);
  }
}

export { StorageQuotaManager, StorageQuotaConfig };
```

### Alternative: ext4 Quotas

```bash
#!/bin/bash
# ext4-quota-setup.sh

# Enable quota on filesystem
tune2fs -O quota /dev/sda1

# Mount with quota options
mount -o usrquota,grpquota,prjquota /dev/sda1 /data

# Initialize quota database
quotacheck -ugm /data
quotaon /data

# Set project quota (similar to XFS)
setquota -P $PROJECT_ID $SOFT_LIMIT $HARD_LIMIT $INODE_SOFT $INODE_HARD /data
```

---

## Fair CPU Scheduling

### Implementation: CFS Bandwidth Control + CPU Sets

We ensure fair CPU scheduling using **CFS bandwidth control** and **CPU sets**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           FAIR CPU SCHEDULING                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  NODE (8 CPUs)                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  CPU 0   CPU 1   CPU 2   CPU 3   CPU 4   CPU 5   CPU 6   CPU 7                  │   │
│  │  ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐   ┌───┐                │   │
│  │  │ A │   │ A │   │ B │   │ B │   │ C │   │ C │   │ D │   │ D │                │   │
│  │  └───┘   └───┘   └───┘   └───┘   └───┘   └───┘   └───┘   └───┘                │   │
│  │                                                                                 │   │
│  │  Sandbox A: cpuset 0-1, shares 1024, quota 200ms/100ms (2 cores)               │   │
│  │  Sandbox B: cpuset 2-3, shares 1024, quota 200ms/100ms (2 cores)               │   │
│  │  Sandbox C: cpuset 4-5, shares 512,  quota 100ms/100ms (1 core)                │   │
│  │  Sandbox D: cpuset 6-7, shares 512,  quota 100ms/100ms (1 core)                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### CFS Configuration

```typescript
// fair-scheduler.ts

interface SchedulingConfig {
  cpuShares: number;           // Relative weight (default 1024)
  cpuQuotaUs: number;          // Max CPU time per period
  cpuPeriodUs: number;         // CFS period (100ms default)
  cpusetCpus: string;          // CPU affinity (e.g., "0-3")
  cpusetMems: string;          // NUMA memory nodes
}

const tierScheduling: Record<string, Partial<SchedulingConfig>> = {
  free: {
    cpuShares: 512,
    cpuQuotaUs: 100000,    // 1 core
    cpuPeriodUs: 100000,
  },
  pro: {
    cpuShares: 1024,
    cpuQuotaUs: 200000,    // 2 cores
    cpuPeriodUs: 100000,
  },
  enterprise: {
    cpuShares: 2048,
    cpuQuotaUs: 400000,    // 4 cores
    cpuPeriodUs: 100000,
  },
};

class FairScheduler {
  private cpuAllocator: CPUAllocator;
  
  constructor() {
    this.cpuAllocator = new CPUAllocator();
  }
  
  /**
   * Configure fair scheduling for sandbox
   */
  async configureScheduling(
    sandboxId: string,
    tier: string
  ): Promise<void> {
    const config = tierScheduling[tier] || tierScheduling.free;
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Set CPU shares (relative weight)
    await fs.writeFile(
      `${cgroupPath}/cpu.weight`,
      Math.round((config.cpuShares! / 1024) * 100).toString()  // cgroups v2 uses 1-10000
    );
    
    // Set CPU quota
    await fs.writeFile(
      `${cgroupPath}/cpu.max`,
      `${config.cpuQuotaUs} ${config.cpuPeriodUs}`
    );
    
    // Allocate CPUs
    const cpus = await this.cpuAllocator.allocate(sandboxId, tier);
    await fs.writeFile(`${cgroupPath}/cpuset.cpus`, cpus);
    
    // Set memory nodes (for NUMA)
    await fs.writeFile(`${cgroupPath}/cpuset.mems`, '0');
  }
  
  /**
   * Get CPU statistics
   */
  async getCPUStats(sandboxId: string): Promise<{
    usageUs: number;
    throttledUs: number;
    throttledCount: number;
    periods: number;
  }> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const stat = await fs.readFile(`${cgroupPath}/cpu.stat`, 'utf-8');
    
    const lines = stat.split('\n');
    const stats: Record<string, number> = {};
    
    for (const line of lines) {
      const [key, value] = line.split(' ');
      if (key && value) {
        stats[key] = parseInt(value, 10);
      }
    }
    
    return {
      usageUs: stats.usage_usec || 0,
      throttledUs: stats.throttled_usec || 0,
      throttledCount: stats.nr_throttled || 0,
      periods: stats.nr_periods || 0,
    };
  }
}

/**
 * CPU Allocator for fair distribution
 */
class CPUAllocator {
  private totalCPUs: number;
  private allocations: Map<string, string> = new Map();
  
  constructor() {
    this.totalCPUs = os.cpus().length;
  }
  
  /**
   * Allocate CPUs for sandbox
   */
  async allocate(sandboxId: string, tier: string): Promise<string> {
    // Get number of CPUs for tier
    const cpuCount = this.getCPUCountForTier(tier);
    
    // Find available CPUs
    const usedCPUs = new Set<number>();
    for (const cpus of this.allocations.values()) {
      for (const cpu of this.parseCPUSet(cpus)) {
        usedCPUs.add(cpu);
      }
    }
    
    // Allocate CPUs
    const allocated: number[] = [];
    for (let i = 0; i < this.totalCPUs && allocated.length < cpuCount; i++) {
      // Skip CPU 0 (reserved for system)
      if (i === 0) continue;
      
      if (!usedCPUs.has(i)) {
        allocated.push(i);
      }
    }
    
    // If not enough exclusive CPUs, share
    if (allocated.length < cpuCount) {
      // Use all CPUs (shared mode)
      const cpuSet = `1-${this.totalCPUs - 1}`;
      this.allocations.set(sandboxId, cpuSet);
      return cpuSet;
    }
    
    // Create CPU set string
    const cpuSet = this.formatCPUSet(allocated);
    this.allocations.set(sandboxId, cpuSet);
    return cpuSet;
  }
  
  /**
   * Release CPUs
   */
  release(sandboxId: string): void {
    this.allocations.delete(sandboxId);
  }
  
  /**
   * Get CPU count for tier
   */
  private getCPUCountForTier(tier: string): number {
    switch (tier) {
      case 'enterprise': return 4;
      case 'pro': return 2;
      default: return 1;
    }
  }
  
  /**
   * Parse CPU set string to array
   */
  private parseCPUSet(cpuSet: string): number[] {
    const cpus: number[] = [];
    const parts = cpuSet.split(',');
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          cpus.push(i);
        }
      } else {
        cpus.push(parseInt(part, 10));
      }
    }
    
    return cpus;
  }
  
  /**
   * Format CPU array to set string
   */
  private formatCPUSet(cpus: number[]): string {
    if (cpus.length === 0) return '';
    if (cpus.length === 1) return cpus[0].toString();
    
    cpus.sort((a, b) => a - b);
    
    // Check if contiguous
    const isContiguous = cpus.every((cpu, i) => 
      i === 0 || cpu === cpus[i - 1] + 1
    );
    
    if (isContiguous) {
      return `${cpus[0]}-${cpus[cpus.length - 1]}`;
    }
    
    return cpus.join(',');
  }
}

export { FairScheduler, CPUAllocator, SchedulingConfig };
```

### Kubernetes Pod Scheduling

```yaml
# fair-scheduling-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-abc123
  annotations:
    # CPU manager policy
    cpu-manager.alpha.kubernetes.io/policy: "static"
spec:
  # Guaranteed QoS for predictable scheduling
  containers:
  - name: sandbox
    resources:
      requests:
        cpu: "2000m"
        memory: "2Gi"
      limits:
        cpu: "2000m"
        memory: "2Gi"
  # Node affinity for consistent placement
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: node-type
            operator: In
            values:
            - sandbox-worker
  # Topology spread for even distribution
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: sandbox
```

---

## Summary

### Resource Management Strategies

| Resource | Strategy | Implementation |
|----------|----------|----------------|
| **Memory** | Kill processes on OOM | cgroups v2 memory.max |
| **CPU** | Burst then throttle | CFS bandwidth + burst |
| **Network** | Rate limiting | tc + CNI bandwidth plugin |
| **Storage** | Hard quotas | XFS project quotas |
| **Scheduling** | Fair shares | CFS weights + CPU sets |

### OOM Handling

| Threshold | Action |
|-----------|--------|
| 75% | Log warning |
| 90% | Alert user, reclaim cache |
| 95% | Soft limit, aggressive reclaim |
| 100% | Kill processes (OOM) |

### CPU Burst Policy

| Phase | Duration | CPU Limit |
|-------|----------|-----------|
| Normal | Unlimited | 100% of allocation |
| Burst | 30 seconds | 400% of allocation |
| Throttled | 60 seconds | 100% of allocation |
| Cooldown | After throttle | Burst re-enabled |

### Network Limits by Tier

| Tier | Ingress | Egress | Burst |
|------|---------|--------|-------|
| Free | 10 Mbps | 10 Mbps | 32 KB |
| Pro | 50 Mbps | 50 Mbps | 64 KB |
| Enterprise | 100 Mbps | 100 Mbps | 128 KB |

### Storage Quotas by Tier

| Tier | Soft Limit | Hard Limit | Inodes |
|------|------------|------------|--------|
| Free | 9 GB | 10 GB | 1M |
| Pro | 45 GB | 50 GB | 5M |
| Enterprise | 90 GB | 100 GB | 10M |
