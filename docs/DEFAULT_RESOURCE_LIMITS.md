# Default Resource Limits Per Sandbox

This guide provides comprehensive coverage of default resource limits for sandbox environments, including CPU, memory, disk I/O, and network bandwidth configurations with implementation details, Kubernetes manifests, and monitoring strategies.

---

## Table of Contents

1. [Overview](#overview)
2. [Resource Limit Architecture](#resource-limit-architecture)
3. [CPU Limits](#cpu-limits)
4. [Memory Limits](#memory-limits)
5. [Disk I/O Limits](#disk-io-limits)
6. [Network Bandwidth Limits](#network-bandwidth-limits)
7. [Storage Limits](#storage-limits)
8. [Process Limits](#process-limits)
9. [Kubernetes Configuration](#kubernetes-configuration)
10. [Docker Configuration](#docker-configuration)
11. [Monitoring and Alerting](#monitoring-and-alerting)
12. [Tier-Based Limits](#tier-based-limits)

---

## Overview

Resource limits ensure fair resource distribution across sandboxes, prevent resource abuse, and maintain system stability. Each sandbox operates within defined boundaries for CPU, memory, disk I/O, network bandwidth, and process counts.

### Default Limits Summary

| Resource | Free Tier | Standard Tier | Pro Tier | Enterprise |
|----------|-----------|---------------|----------|------------|
| **CPU** | 0.5 cores | 1 core | 2 cores | 4+ cores |
| **Memory** | 512 MB | 2 GB | 4 GB | 8+ GB |
| **Disk I/O Read** | 50 MB/s | 100 MB/s | 200 MB/s | 500 MB/s |
| **Disk I/O Write** | 25 MB/s | 50 MB/s | 100 MB/s | 250 MB/s |
| **Network Egress** | 10 Mbps | 50 Mbps | 100 Mbps | 1 Gbps |
| **Network Ingress** | 50 Mbps | 100 Mbps | 500 Mbps | 1 Gbps |
| **Storage** | 1 GB | 5 GB | 20 GB | 100+ GB |
| **Processes** | 50 | 100 | 200 | 500 |

---

## Resource Limit Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           RESOURCE LIMIT ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         KUBERNETES CLUSTER                                       │   │
│  │                                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    RESOURCE QUOTA (per namespace)                        │    │   │
│  │  │                                                                           │    │   │
│  │  │  • Total CPU: 100 cores                                                  │    │   │
│  │  │  • Total Memory: 200 GB                                                  │    │   │
│  │  │  • Total Storage: 1 TB                                                   │    │   │
│  │  │  • Max Pods: 500                                                         │    │   │
│  │  │                                                                           │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                    LIMIT RANGE (per pod/container)                       │    │   │
│  │  │                                                                           │    │   │
│  │  │  • Default CPU Request: 250m                                             │    │   │
│  │  │  • Default CPU Limit: 1000m                                              │    │   │
│  │  │  • Default Memory Request: 256Mi                                         │    │   │
│  │  │  • Default Memory Limit: 2Gi                                             │    │   │
│  │  │                                                                           │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                         SANDBOX POD                                       │    │   │
│  │  │                                                                           │    │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │  │                    CONTAINER                                     │    │    │   │
│  │  │  │                                                                   │    │    │   │
│  │  │  │  resources:                                                      │    │    │   │
│  │  │  │    requests:                                                     │    │    │   │
│  │  │  │      cpu: "500m"                                                 │    │    │   │
│  │  │  │      memory: "512Mi"                                             │    │    │   │
│  │  │  │    limits:                                                       │    │    │   │
│  │  │  │      cpu: "1000m"                                                │    │    │   │
│  │  │  │      memory: "2Gi"                                               │    │    │   │
│  │  │  │                                                                   │    │    │   │
│  │  │  └─────────────────────────────────────────────────────────────────┘    │    │   │
│  │  │                                                                           │    │   │
│  │  │  ┌─────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │  │                    CGROUPS v2                                    │    │    │   │
│  │  │  │                                                                   │    │    │   │
│  │  │  │  • cpu.max: 100000 100000 (1 CPU)                               │    │    │   │
│  │  │  │  • memory.max: 2147483648 (2GB)                                 │    │    │   │
│  │  │  │  • io.max: rbps=104857600 wbps=52428800                         │    │    │   │
│  │  │  │  • pids.max: 100                                                 │    │    │   │
│  │  │  │                                                                   │    │    │   │
│  │  │  └─────────────────────────────────────────────────────────────────┘    │    │   │
│  │  │                                                                           │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## CPU Limits

### CPU Limit Configuration

CPU limits control how much CPU time a sandbox can consume. Kubernetes uses millicores (m) where 1000m = 1 CPU core.

### CPU Limit Tiers

| Tier | Request | Limit | Burst | Throttling |
|------|---------|-------|-------|------------|
| Free | 250m | 500m | None | Hard throttle at 500m |
| Standard | 500m | 1000m | 1500m (30s) | Soft throttle above 1000m |
| Pro | 1000m | 2000m | 3000m (60s) | Soft throttle above 2000m |
| Enterprise | 2000m | 4000m | 8000m (120s) | Configurable |

### cgroups v2 CPU Configuration

```bash
# CPU quota and period (cgroups v2)
# Format: $MAX $PERIOD (microseconds)

# 1 CPU = 100000/100000 (100ms quota per 100ms period)
echo "100000 100000" > /sys/fs/cgroup/sandbox-123/cpu.max

# 0.5 CPU = 50000/100000
echo "50000 100000" > /sys/fs/cgroup/sandbox-123/cpu.max

# 2 CPUs = 200000/100000
echo "200000 100000" > /sys/fs/cgroup/sandbox-123/cpu.max

# CPU weight (relative priority, 1-10000, default 100)
echo "100" > /sys/fs/cgroup/sandbox-123/cpu.weight
```

### CPU Shares and Weights

```typescript
// src/config/cpuLimits.ts

interface CpuLimitConfig {
  requestMillicores: number;
  limitMillicores: number;
  weight: number;           // cgroups v2 weight (1-10000)
  shares: number;           // cgroups v1 shares (2-262144)
  quotaMicroseconds: number;
  periodMicroseconds: number;
}

const cpuLimitsByTier: Record<string, CpuLimitConfig> = {
  free: {
    requestMillicores: 250,
    limitMillicores: 500,
    weight: 50,
    shares: 512,
    quotaMicroseconds: 50000,
    periodMicroseconds: 100000,
  },
  standard: {
    requestMillicores: 500,
    limitMillicores: 1000,
    weight: 100,
    shares: 1024,
    quotaMicroseconds: 100000,
    periodMicroseconds: 100000,
  },
  pro: {
    requestMillicores: 1000,
    limitMillicores: 2000,
    weight: 200,
    shares: 2048,
    quotaMicroseconds: 200000,
    periodMicroseconds: 100000,
  },
  enterprise: {
    requestMillicores: 2000,
    limitMillicores: 4000,
    weight: 400,
    shares: 4096,
    quotaMicroseconds: 400000,
    periodMicroseconds: 100000,
  },
};

function getCpuConfig(tier: string): CpuLimitConfig {
  return cpuLimitsByTier[tier] || cpuLimitsByTier.standard;
}
```

### CPU Pinning (Optional)

```yaml
# kubernetes-cpu-pinning.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  containers:
    - name: sandbox
      resources:
        limits:
          cpu: "2"
          memory: "4Gi"
      # CPU Manager policy: static (requires kubelet config)
      # This enables CPU pinning for guaranteed QoS pods
```

### Kubernetes CPU Manager Configuration

```yaml
# kubelet-config.yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cpuManagerPolicy: static
cpuManagerReconcilePeriod: 10s
reservedSystemCPUs: "0-1"  # Reserve CPUs 0-1 for system
```

---

## Memory Limits

### Memory Limit Configuration

Memory limits control the maximum amount of RAM a sandbox can use. Exceeding the limit triggers the OOM killer.

### Memory Limit Tiers

| Tier | Request | Limit | Swap | OOM Score Adj |
|------|---------|-------|------|---------------|
| Free | 256 MB | 512 MB | 0 | 1000 (first to kill) |
| Standard | 512 MB | 2 GB | 0 | 500 |
| Pro | 1 GB | 4 GB | 0 | 250 |
| Enterprise | 2 GB | 8 GB | Optional | 0 |

### cgroups v2 Memory Configuration

```bash
# Memory limit (bytes)
# 2GB = 2147483648 bytes
echo "2147483648" > /sys/fs/cgroup/sandbox-123/memory.max

# Memory soft limit (for reclaim pressure)
echo "1073741824" > /sys/fs/cgroup/sandbox-123/memory.high

# Disable swap
echo "0" > /sys/fs/cgroup/sandbox-123/memory.swap.max

# OOM group kill (kill all processes in cgroup on OOM)
echo "1" > /sys/fs/cgroup/sandbox-123/memory.oom.group
```

### Memory Configuration Implementation

```typescript
// src/config/memoryLimits.ts

interface MemoryLimitConfig {
  requestBytes: number;
  limitBytes: number;
  softLimitBytes: number;
  swapBytes: number;
  oomScoreAdj: number;
  oomKillGroup: boolean;
}

const memoryLimitsByTier: Record<string, MemoryLimitConfig> = {
  free: {
    requestBytes: 256 * 1024 * 1024,      // 256 MB
    limitBytes: 512 * 1024 * 1024,         // 512 MB
    softLimitBytes: 384 * 1024 * 1024,     // 384 MB
    swapBytes: 0,
    oomScoreAdj: 1000,
    oomKillGroup: true,
  },
  standard: {
    requestBytes: 512 * 1024 * 1024,       // 512 MB
    limitBytes: 2 * 1024 * 1024 * 1024,    // 2 GB
    softLimitBytes: 1.5 * 1024 * 1024 * 1024, // 1.5 GB
    swapBytes: 0,
    oomScoreAdj: 500,
    oomKillGroup: true,
  },
  pro: {
    requestBytes: 1 * 1024 * 1024 * 1024,  // 1 GB
    limitBytes: 4 * 1024 * 1024 * 1024,    // 4 GB
    softLimitBytes: 3 * 1024 * 1024 * 1024, // 3 GB
    swapBytes: 0,
    oomScoreAdj: 250,
    oomKillGroup: true,
  },
  enterprise: {
    requestBytes: 2 * 1024 * 1024 * 1024,  // 2 GB
    limitBytes: 8 * 1024 * 1024 * 1024,    // 8 GB
    softLimitBytes: 6 * 1024 * 1024 * 1024, // 6 GB
    swapBytes: 0,
    oomScoreAdj: 0,
    oomKillGroup: false,
  },
};

function getMemoryConfig(tier: string): MemoryLimitConfig {
  return memoryLimitsByTier[tier] || memoryLimitsByTier.standard;
}

function formatMemoryForKubernetes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${Math.floor(bytes / (1024 * 1024 * 1024))}Gi`;
  }
  return `${Math.floor(bytes / (1024 * 1024))}Mi`;
}
```

### Huge Pages Configuration (Optional)

```yaml
# kubernetes-hugepages.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-with-hugepages
spec:
  containers:
    - name: sandbox
      resources:
        limits:
          memory: "4Gi"
          hugepages-2Mi: "100Mi"  # 100MB of 2MB huge pages
        requests:
          memory: "4Gi"
          hugepages-2Mi: "100Mi"
      volumeMounts:
        - name: hugepage
          mountPath: /hugepages
  volumes:
    - name: hugepage
      emptyDir:
        medium: HugePages
```

---

## Disk I/O Limits

### I/O Limit Configuration

Disk I/O limits control read/write throughput and IOPS to prevent I/O-intensive workloads from affecting other sandboxes.

### I/O Limit Tiers

| Tier | Read BPS | Write BPS | Read IOPS | Write IOPS |
|------|----------|-----------|-----------|------------|
| Free | 50 MB/s | 25 MB/s | 500 | 250 |
| Standard | 100 MB/s | 50 MB/s | 1000 | 500 |
| Pro | 200 MB/s | 100 MB/s | 2000 | 1000 |
| Enterprise | 500 MB/s | 250 MB/s | 5000 | 2500 |

### cgroups v2 I/O Configuration

```bash
# Get device major:minor numbers
# Example: /dev/sda is 8:0
ls -l /dev/sda
# brw-rw---- 1 root disk 8, 0 Jan  1 00:00 /dev/sda

# Set I/O limits (cgroups v2)
# Format: MAJOR:MINOR rbps=BYTES wbps=BYTES riops=NUM wiops=NUM

# 100 MB/s read, 50 MB/s write, 1000 read IOPS, 500 write IOPS
echo "8:0 rbps=104857600 wbps=52428800 riops=1000 wiops=500" > /sys/fs/cgroup/sandbox-123/io.max

# I/O weight (1-10000, default 100)
echo "default 100" > /sys/fs/cgroup/sandbox-123/io.weight
echo "8:0 200" > /sys/fs/cgroup/sandbox-123/io.weight
```

### I/O Configuration Implementation

```typescript
// src/config/ioLimits.ts

interface IoLimitConfig {
  readBytesPerSecond: number;
  writeBytesPerSecond: number;
  readIopsPerSecond: number;
  writeIopsPerSecond: number;
  weight: number;
}

const ioLimitsByTier: Record<string, IoLimitConfig> = {
  free: {
    readBytesPerSecond: 50 * 1024 * 1024,   // 50 MB/s
    writeBytesPerSecond: 25 * 1024 * 1024,  // 25 MB/s
    readIopsPerSecond: 500,
    writeIopsPerSecond: 250,
    weight: 50,
  },
  standard: {
    readBytesPerSecond: 100 * 1024 * 1024,  // 100 MB/s
    writeBytesPerSecond: 50 * 1024 * 1024,  // 50 MB/s
    readIopsPerSecond: 1000,
    writeIopsPerSecond: 500,
    weight: 100,
  },
  pro: {
    readBytesPerSecond: 200 * 1024 * 1024,  // 200 MB/s
    writeBytesPerSecond: 100 * 1024 * 1024, // 100 MB/s
    readIopsPerSecond: 2000,
    writeIopsPerSecond: 1000,
    weight: 200,
  },
  enterprise: {
    readBytesPerSecond: 500 * 1024 * 1024,  // 500 MB/s
    writeBytesPerSecond: 250 * 1024 * 1024, // 250 MB/s
    readIopsPerSecond: 5000,
    writeIopsPerSecond: 2500,
    weight: 400,
  },
};

function generateIoMaxConfig(config: IoLimitConfig, deviceMajorMinor: string): string {
  return `${deviceMajorMinor} rbps=${config.readBytesPerSecond} wbps=${config.writeBytesPerSecond} riops=${config.readIopsPerSecond} wiops=${config.writeIopsPerSecond}`;
}
```

### Docker I/O Configuration

```yaml
# docker-compose-io-limits.yaml
version: '3.8'
services:
  sandbox:
    image: sandbox:latest
    blkio_config:
      weight: 100
      weight_device:
        - path: /dev/sda
          weight: 100
      device_read_bps:
        - path: /dev/sda
          rate: '100mb'
      device_write_bps:
        - path: /dev/sda
          rate: '50mb'
      device_read_iops:
        - path: /dev/sda
          rate: 1000
      device_write_iops:
        - path: /dev/sda
          rate: 500
```

---

## Network Bandwidth Limits

### Network Limit Configuration

Network bandwidth limits control ingress and egress traffic to prevent network abuse and ensure fair bandwidth distribution.

### Network Limit Tiers

| Tier | Egress | Ingress | Connections | Packets/sec |
|------|--------|---------|-------------|-------------|
| Free | 10 Mbps | 50 Mbps | 100 | 1000 |
| Standard | 50 Mbps | 100 Mbps | 500 | 5000 |
| Pro | 100 Mbps | 500 Mbps | 1000 | 10000 |
| Enterprise | 1 Gbps | 1 Gbps | 5000 | 50000 |

### Traffic Control (tc) Configuration

```bash
#!/bin/bash
# network-limits.sh - Configure network bandwidth limits

SANDBOX_ID="sandbox-123"
INTERFACE="eth0"
EGRESS_RATE="50mbit"
INGRESS_RATE="100mbit"
BURST="32kbit"

# Clear existing rules
tc qdisc del dev $INTERFACE root 2>/dev/null
tc qdisc del dev $INTERFACE ingress 2>/dev/null

# Egress limiting (outgoing traffic)
tc qdisc add dev $INTERFACE root handle 1: htb default 10
tc class add dev $INTERFACE parent 1: classid 1:1 htb rate $EGRESS_RATE burst $BURST
tc class add dev $INTERFACE parent 1:1 classid 1:10 htb rate $EGRESS_RATE burst $BURST

# Filter by cgroup (net_cls)
tc filter add dev $INTERFACE parent 1: protocol ip prio 1 \
    cgroup

# Ingress limiting (incoming traffic)
tc qdisc add dev $INTERFACE handle ffff: ingress
tc filter add dev $INTERFACE parent ffff: protocol ip prio 1 \
    u32 match u32 0 0 \
    police rate $INGRESS_RATE burst $BURST drop \
    flowid :1
```

### CNI Bandwidth Plugin Configuration

```json
{
  "cniVersion": "0.3.1",
  "name": "sandbox-network",
  "plugins": [
    {
      "type": "bridge",
      "bridge": "cni0",
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
      "ingressRate": 104857600,
      "ingressBurst": 1048576,
      "egressRate": 52428800,
      "egressBurst": 1048576
    }
  ]
}
```

### Network Configuration Implementation

```typescript
// src/config/networkLimits.ts

interface NetworkLimitConfig {
  egressBitsPerSecond: number;
  ingressBitsPerSecond: number;
  egressBurstBytes: number;
  ingressBurstBytes: number;
  maxConnections: number;
  maxPacketsPerSecond: number;
}

const networkLimitsByTier: Record<string, NetworkLimitConfig> = {
  free: {
    egressBitsPerSecond: 10 * 1000 * 1000,    // 10 Mbps
    ingressBitsPerSecond: 50 * 1000 * 1000,   // 50 Mbps
    egressBurstBytes: 32 * 1024,               // 32 KB
    ingressBurstBytes: 64 * 1024,              // 64 KB
    maxConnections: 100,
    maxPacketsPerSecond: 1000,
  },
  standard: {
    egressBitsPerSecond: 50 * 1000 * 1000,    // 50 Mbps
    ingressBitsPerSecond: 100 * 1000 * 1000,  // 100 Mbps
    egressBurstBytes: 64 * 1024,               // 64 KB
    ingressBurstBytes: 128 * 1024,             // 128 KB
    maxConnections: 500,
    maxPacketsPerSecond: 5000,
  },
  pro: {
    egressBitsPerSecond: 100 * 1000 * 1000,   // 100 Mbps
    ingressBitsPerSecond: 500 * 1000 * 1000,  // 500 Mbps
    egressBurstBytes: 128 * 1024,              // 128 KB
    ingressBurstBytes: 256 * 1024,             // 256 KB
    maxConnections: 1000,
    maxPacketsPerSecond: 10000,
  },
  enterprise: {
    egressBitsPerSecond: 1000 * 1000 * 1000,  // 1 Gbps
    ingressBitsPerSecond: 1000 * 1000 * 1000, // 1 Gbps
    egressBurstBytes: 1024 * 1024,             // 1 MB
    ingressBurstBytes: 1024 * 1024,            // 1 MB
    maxConnections: 5000,
    maxPacketsPerSecond: 50000,
  },
};

function generateBandwidthAnnotation(config: NetworkLimitConfig): object {
  return {
    'kubernetes.io/ingress-bandwidth': `${config.ingressBitsPerSecond / 1000000}M`,
    'kubernetes.io/egress-bandwidth': `${config.egressBitsPerSecond / 1000000}M`,
  };
}
```

### Kubernetes Network Policy with Bandwidth

```yaml
# kubernetes-network-bandwidth.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
  annotations:
    kubernetes.io/ingress-bandwidth: "100M"
    kubernetes.io/egress-bandwidth: "50M"
spec:
  containers:
    - name: sandbox
      image: sandbox:latest
```

### Cilium Bandwidth Manager

```yaml
# cilium-bandwidth-policy.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: sandbox-bandwidth
spec:
  endpointSelector:
    matchLabels:
      app: sandbox
  egress:
    - toEndpoints:
        - matchLabels:
            "k8s:io.kubernetes.pod.namespace": kube-system
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
  egressDeny:
    - toEntities:
        - world
      toPorts:
        - ports:
            - port: "0"
              protocol: ANY
          rules:
            http:
              - method: ".*"
```

---

## Storage Limits

### Storage Limit Configuration

Storage limits control the amount of persistent and ephemeral storage available to each sandbox.

### Storage Limit Tiers

| Tier | Ephemeral | Persistent | Inodes |
|------|-----------|------------|--------|
| Free | 1 GB | 0 | 100,000 |
| Standard | 5 GB | 5 GB | 500,000 |
| Pro | 20 GB | 50 GB | 1,000,000 |
| Enterprise | 100 GB | 500 GB | 10,000,000 |

### Kubernetes Ephemeral Storage

```yaml
# kubernetes-storage-limits.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  containers:
    - name: sandbox
      image: sandbox:latest
      resources:
        requests:
          ephemeral-storage: "1Gi"
        limits:
          ephemeral-storage: "5Gi"
      volumeMounts:
        - name: workspace
          mountPath: /home/sandbox
  volumes:
    - name: workspace
      emptyDir:
        sizeLimit: 5Gi
```

### Storage Quota with Project Quotas

```bash
# Enable project quotas on XFS filesystem
# /etc/fstab entry:
# /dev/sda1 /data xfs defaults,prjquota 0 0

# Create project for sandbox
echo "100:/data/sandbox-123" >> /etc/projects
echo "sandbox-123:100" >> /etc/projid

# Set quota (5GB soft, 6GB hard)
xfs_quota -x -c "project -s sandbox-123" /data
xfs_quota -x -c "limit -p bsoft=5g bhard=6g sandbox-123" /data
xfs_quota -x -c "limit -p isoft=500000 ihard=600000 sandbox-123" /data
```

### Storage Configuration Implementation

```typescript
// src/config/storageLimits.ts

interface StorageLimitConfig {
  ephemeralStorageBytes: number;
  persistentStorageBytes: number;
  inodeLimit: number;
  tmpfsSizeBytes: number;
}

const storageLimitsByTier: Record<string, StorageLimitConfig> = {
  free: {
    ephemeralStorageBytes: 1 * 1024 * 1024 * 1024,      // 1 GB
    persistentStorageBytes: 0,
    inodeLimit: 100000,
    tmpfsSizeBytes: 100 * 1024 * 1024,                   // 100 MB
  },
  standard: {
    ephemeralStorageBytes: 5 * 1024 * 1024 * 1024,      // 5 GB
    persistentStorageBytes: 5 * 1024 * 1024 * 1024,     // 5 GB
    inodeLimit: 500000,
    tmpfsSizeBytes: 500 * 1024 * 1024,                   // 500 MB
  },
  pro: {
    ephemeralStorageBytes: 20 * 1024 * 1024 * 1024,     // 20 GB
    persistentStorageBytes: 50 * 1024 * 1024 * 1024,    // 50 GB
    inodeLimit: 1000000,
    tmpfsSizeBytes: 1 * 1024 * 1024 * 1024,              // 1 GB
  },
  enterprise: {
    ephemeralStorageBytes: 100 * 1024 * 1024 * 1024,    // 100 GB
    persistentStorageBytes: 500 * 1024 * 1024 * 1024,   // 500 GB
    inodeLimit: 10000000,
    tmpfsSizeBytes: 4 * 1024 * 1024 * 1024,              // 4 GB
  },
};
```

---

## Process Limits

### Process Limit Configuration

Process limits (pids.max) prevent fork bombs and excessive process creation.

### Process Limit Tiers

| Tier | Max Processes | Max Threads | Max Open Files |
|------|---------------|-------------|----------------|
| Free | 50 | 100 | 1024 |
| Standard | 100 | 500 | 4096 |
| Pro | 200 | 1000 | 16384 |
| Enterprise | 500 | 5000 | 65536 |

### cgroups v2 Process Limits

```bash
# Set max processes
echo "100" > /sys/fs/cgroup/sandbox-123/pids.max

# Check current process count
cat /sys/fs/cgroup/sandbox-123/pids.current
```

### ulimit Configuration

```bash
# /etc/security/limits.d/sandbox.conf
sandbox    soft    nproc     100
sandbox    hard    nproc     100
sandbox    soft    nofile    4096
sandbox    hard    nofile    4096
sandbox    soft    stack     8192
sandbox    hard    stack     8192
sandbox    soft    memlock   65536
sandbox    hard    memlock   65536
```

### Process Configuration Implementation

```typescript
// src/config/processLimits.ts

interface ProcessLimitConfig {
  maxProcesses: number;
  maxThreads: number;
  maxOpenFiles: number;
  maxStackSizeKb: number;
  maxMemlockKb: number;
}

const processLimitsByTier: Record<string, ProcessLimitConfig> = {
  free: {
    maxProcesses: 50,
    maxThreads: 100,
    maxOpenFiles: 1024,
    maxStackSizeKb: 8192,
    maxMemlockKb: 65536,
  },
  standard: {
    maxProcesses: 100,
    maxThreads: 500,
    maxOpenFiles: 4096,
    maxStackSizeKb: 8192,
    maxMemlockKb: 65536,
  },
  pro: {
    maxProcesses: 200,
    maxThreads: 1000,
    maxOpenFiles: 16384,
    maxStackSizeKb: 16384,
    maxMemlockKb: 131072,
  },
  enterprise: {
    maxProcesses: 500,
    maxThreads: 5000,
    maxOpenFiles: 65536,
    maxStackSizeKb: 32768,
    maxMemlockKb: 262144,
  },
};
```

---

## Kubernetes Configuration

### Complete LimitRange

```yaml
# kubernetes-limitrange.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: sandbox-limits
  namespace: sandboxes
spec:
  limits:
    # Container defaults
    - type: Container
      default:
        cpu: "1"
        memory: "2Gi"
        ephemeral-storage: "5Gi"
      defaultRequest:
        cpu: "500m"
        memory: "512Mi"
        ephemeral-storage: "1Gi"
      max:
        cpu: "4"
        memory: "8Gi"
        ephemeral-storage: "100Gi"
      min:
        cpu: "100m"
        memory: "128Mi"
        ephemeral-storage: "100Mi"
    
    # Pod limits
    - type: Pod
      max:
        cpu: "4"
        memory: "8Gi"
      min:
        cpu: "100m"
        memory: "128Mi"
    
    # PVC limits
    - type: PersistentVolumeClaim
      max:
        storage: "100Gi"
      min:
        storage: "1Gi"
```

### Complete ResourceQuota

```yaml
# kubernetes-resourcequota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: sandbox-quota
  namespace: sandboxes
spec:
  hard:
    # Compute resources
    requests.cpu: "100"
    requests.memory: "200Gi"
    limits.cpu: "200"
    limits.memory: "400Gi"
    
    # Storage resources
    requests.storage: "1Ti"
    requests.ephemeral-storage: "500Gi"
    limits.ephemeral-storage: "1Ti"
    
    # Object counts
    pods: "500"
    services: "100"
    secrets: "500"
    configmaps: "500"
    persistentvolumeclaims: "200"
    
    # Specific storage classes
    gold.storageclass.storage.k8s.io/requests.storage: "500Gi"
    silver.storageclass.storage.k8s.io/requests.storage: "500Gi"
```

### Complete Sandbox Pod Spec

```yaml
# kubernetes-sandbox-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-123
  namespace: sandboxes
  labels:
    app: sandbox
    tier: standard
  annotations:
    kubernetes.io/ingress-bandwidth: "100M"
    kubernetes.io/egress-bandwidth: "50M"
spec:
  # Security context
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: Localhost
      localhostProfile: sandbox.json
  
  # Container spec
  containers:
    - name: sandbox
      image: sandbox:latest
      
      # Resource limits
      resources:
        requests:
          cpu: "500m"
          memory: "512Mi"
          ephemeral-storage: "1Gi"
        limits:
          cpu: "1"
          memory: "2Gi"
          ephemeral-storage: "5Gi"
      
      # Security context
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      
      # Volume mounts
      volumeMounts:
        - name: workspace
          mountPath: /home/sandbox
        - name: tmp
          mountPath: /tmp
  
  # Volumes
  volumes:
    - name: workspace
      emptyDir:
        sizeLimit: 5Gi
    - name: tmp
      emptyDir:
        medium: Memory
        sizeLimit: 100Mi
  
  # Node selection
  nodeSelector:
    node-type: sandbox
  
  # Tolerations
  tolerations:
    - key: "sandbox"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
  
  # Priority
  priorityClassName: sandbox-priority
  
  # Termination
  terminationGracePeriodSeconds: 30
```

---

## Docker Configuration

### Complete Docker Run Command

```bash
docker run \
  --name sandbox-123 \
  --runtime runsc \
  --user 1000:1000 \
  --read-only \
  --security-opt no-new-privileges:true \
  --security-opt seccomp=/etc/seccomp/sandbox.json \
  --security-opt apparmor=sandbox-profile \
  --cap-drop ALL \
  --cpus 1.0 \
  --cpu-shares 1024 \
  --memory 2g \
  --memory-swap 2g \
  --memory-reservation 512m \
  --pids-limit 100 \
  --ulimit nofile=4096:4096 \
  --ulimit nproc=100:100 \
  --device-read-bps /dev/sda:100mb \
  --device-write-bps /dev/sda:50mb \
  --device-read-iops /dev/sda:1000 \
  --device-write-iops /dev/sda:500 \
  --tmpfs /tmp:size=100m,mode=1777 \
  --mount type=tmpfs,destination=/home/sandbox,tmpfs-size=5g \
  --network sandbox-net \
  sandbox:latest
```

### Docker Compose Complete Configuration

```yaml
# docker-compose-complete.yaml
version: '3.8'
services:
  sandbox:
    image: sandbox:latest
    runtime: runsc
    user: "1000:1000"
    read_only: true
    
    security_opt:
      - no-new-privileges:true
      - seccomp:/etc/seccomp/sandbox.json
      - apparmor:sandbox-profile
    
    cap_drop:
      - ALL
    
    # CPU limits
    cpus: 1.0
    cpu_shares: 1024
    
    # Memory limits
    mem_limit: 2g
    mem_reservation: 512m
    memswap_limit: 2g
    
    # Process limits
    pids_limit: 100
    ulimits:
      nofile:
        soft: 4096
        hard: 4096
      nproc:
        soft: 100
        hard: 100
    
    # I/O limits
    blkio_config:
      weight: 100
      device_read_bps:
        - path: /dev/sda
          rate: '100mb'
      device_write_bps:
        - path: /dev/sda
          rate: '50mb'
      device_read_iops:
        - path: /dev/sda
          rate: 1000
      device_write_iops:
        - path: /dev/sda
          rate: 500
    
    # Storage
    tmpfs:
      - /tmp:size=100m,mode=1777
      - /home/sandbox:size=5g,mode=0755
    
    # Network
    networks:
      - sandbox-net

networks:
  sandbox-net:
    driver: bridge
    internal: true
```

---

## Monitoring and Alerting

### Prometheus Metrics

```typescript
// src/services/resourceMetrics.ts

import { Gauge, Counter, Histogram } from 'prom-client';

const resourceMetrics = {
  // CPU metrics
  cpuUsage: new Gauge({
    name: 'sandbox_cpu_usage_cores',
    help: 'Current CPU usage in cores',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  cpuThrottled: new Counter({
    name: 'sandbox_cpu_throttled_seconds_total',
    help: 'Total CPU throttled time in seconds',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  // Memory metrics
  memoryUsage: new Gauge({
    name: 'sandbox_memory_usage_bytes',
    help: 'Current memory usage in bytes',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  memoryLimit: new Gauge({
    name: 'sandbox_memory_limit_bytes',
    help: 'Memory limit in bytes',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  oomKills: new Counter({
    name: 'sandbox_oom_kills_total',
    help: 'Total OOM kills',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  // I/O metrics
  ioReadBytes: new Counter({
    name: 'sandbox_io_read_bytes_total',
    help: 'Total bytes read',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  ioWriteBytes: new Counter({
    name: 'sandbox_io_write_bytes_total',
    help: 'Total bytes written',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  // Network metrics
  networkRxBytes: new Counter({
    name: 'sandbox_network_rx_bytes_total',
    help: 'Total bytes received',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  networkTxBytes: new Counter({
    name: 'sandbox_network_tx_bytes_total',
    help: 'Total bytes transmitted',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  // Storage metrics
  storageUsage: new Gauge({
    name: 'sandbox_storage_usage_bytes',
    help: 'Current storage usage in bytes',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  // Process metrics
  processCount: new Gauge({
    name: 'sandbox_process_count',
    help: 'Current number of processes',
    labelNames: ['sandbox_id', 'tier'],
  }),
};

export { resourceMetrics };
```

### Alerting Rules

```yaml
# prometheus-alerts.yaml
groups:
  - name: sandbox-resources
    rules:
      # CPU alerts
      - alert: SandboxCpuThrottling
        expr: rate(sandbox_cpu_throttled_seconds_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} is being CPU throttled"
          
      # Memory alerts
      - alert: SandboxMemoryHigh
        expr: sandbox_memory_usage_bytes / sandbox_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} memory usage above 90%"
          
      - alert: SandboxOomKill
        expr: increase(sandbox_oom_kills_total[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} experienced OOM kill"
          
      # Storage alerts
      - alert: SandboxStorageHigh
        expr: sandbox_storage_usage_bytes / sandbox_storage_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} storage usage above 90%"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Sandbox Resource Usage",
    "panels": [
      {
        "title": "CPU Usage by Tier",
        "type": "graph",
        "targets": [
          {
            "expr": "avg by (tier) (sandbox_cpu_usage_cores)",
            "legendFormat": "{{ tier }}"
          }
        ]
      },
      {
        "title": "Memory Usage by Tier",
        "type": "graph",
        "targets": [
          {
            "expr": "avg by (tier) (sandbox_memory_usage_bytes / sandbox_memory_limit_bytes * 100)",
            "legendFormat": "{{ tier }} %"
          }
        ]
      },
      {
        "title": "OOM Kills",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(increase(sandbox_oom_kills_total[24h]))",
            "legendFormat": "OOM Kills (24h)"
          }
        ]
      }
    ]
  }
}
```

---

## Tier-Based Limits

### Complete Tier Configuration

```typescript
// src/config/tierLimits.ts

interface TierLimits {
  cpu: CpuLimitConfig;
  memory: MemoryLimitConfig;
  io: IoLimitConfig;
  network: NetworkLimitConfig;
  storage: StorageLimitConfig;
  process: ProcessLimitConfig;
}

const tierLimits: Record<string, TierLimits> = {
  free: {
    cpu: {
      requestMillicores: 250,
      limitMillicores: 500,
      weight: 50,
      shares: 512,
      quotaMicroseconds: 50000,
      periodMicroseconds: 100000,
    },
    memory: {
      requestBytes: 256 * 1024 * 1024,
      limitBytes: 512 * 1024 * 1024,
      softLimitBytes: 384 * 1024 * 1024,
      swapBytes: 0,
      oomScoreAdj: 1000,
      oomKillGroup: true,
    },
    io: {
      readBytesPerSecond: 50 * 1024 * 1024,
      writeBytesPerSecond: 25 * 1024 * 1024,
      readIopsPerSecond: 500,
      writeIopsPerSecond: 250,
      weight: 50,
    },
    network: {
      egressBitsPerSecond: 10 * 1000 * 1000,
      ingressBitsPerSecond: 50 * 1000 * 1000,
      egressBurstBytes: 32 * 1024,
      ingressBurstBytes: 64 * 1024,
      maxConnections: 100,
      maxPacketsPerSecond: 1000,
    },
    storage: {
      ephemeralStorageBytes: 1 * 1024 * 1024 * 1024,
      persistentStorageBytes: 0,
      inodeLimit: 100000,
      tmpfsSizeBytes: 100 * 1024 * 1024,
    },
    process: {
      maxProcesses: 50,
      maxThreads: 100,
      maxOpenFiles: 1024,
      maxStackSizeKb: 8192,
      maxMemlockKb: 65536,
    },
  },
  // ... standard, pro, enterprise configurations
};

export function getTierLimits(tier: string): TierLimits {
  return tierLimits[tier] || tierLimits.standard;
}
```

---

## Summary

### Default Limits Quick Reference

| Resource | Free | Standard | Pro | Enterprise |
|----------|------|----------|-----|------------|
| **CPU Request** | 250m | 500m | 1000m | 2000m |
| **CPU Limit** | 500m | 1000m | 2000m | 4000m |
| **Memory Request** | 256 MB | 512 MB | 1 GB | 2 GB |
| **Memory Limit** | 512 MB | 2 GB | 4 GB | 8 GB |
| **Disk Read** | 50 MB/s | 100 MB/s | 200 MB/s | 500 MB/s |
| **Disk Write** | 25 MB/s | 50 MB/s | 100 MB/s | 250 MB/s |
| **Network Egress** | 10 Mbps | 50 Mbps | 100 Mbps | 1 Gbps |
| **Network Ingress** | 50 Mbps | 100 Mbps | 500 Mbps | 1 Gbps |
| **Storage** | 1 GB | 5 GB | 20 GB | 100 GB |
| **Processes** | 50 | 100 | 200 | 500 |

### Implementation Checklist

- [ ] cgroups v2 CPU limits configured
- [ ] cgroups v2 memory limits configured
- [ ] cgroups v2 I/O limits configured
- [ ] Network bandwidth limits via CNI
- [ ] Storage quotas via project quotas
- [ ] Process limits via pids.max
- [ ] Kubernetes LimitRange applied
- [ ] Kubernetes ResourceQuota applied
- [ ] Prometheus metrics collecting
- [ ] Alerting rules configured
- [ ] Grafana dashboards deployed
