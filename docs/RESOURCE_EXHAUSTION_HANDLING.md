# Resource Exhaustion Handling

This guide provides comprehensive coverage of how to handle resource exhaustion in sandbox environments, including OOM killer configuration, CPU throttling behavior, graceful degradation strategies, and recovery mechanisms.

---

## Table of Contents

1. [Overview](#overview)
2. [Resource Exhaustion Architecture](#resource-exhaustion-architecture)
3. [OOM Killer Configuration](#oom-killer-configuration)
4. [CPU Throttling Behavior](#cpu-throttling-behavior)
5. [Memory Pressure Handling](#memory-pressure-handling)
6. [Disk I/O Throttling](#disk-io-throttling)
7. [Network Throttling](#network-throttling)
8. [Graceful Degradation vs Hard Limits](#graceful-degradation-vs-hard-limits)
9. [Recovery Mechanisms](#recovery-mechanisms)
10. [Monitoring and Detection](#monitoring-and-detection)
11. [User Communication](#user-communication)
12. [Best Practices](#best-practices)

---

## Overview

Resource exhaustion occurs when a sandbox attempts to use more resources than allocated. The system must handle these situations gracefully to maintain stability while providing a good user experience.

### Resource Exhaustion Response Matrix

| Resource | Soft Limit Action | Hard Limit Action | Recovery |
|----------|-------------------|-------------------|----------|
| **CPU** | Throttle | Hard throttle | Automatic |
| **Memory** | Reclaim pressure | OOM kill | Restart process |
| **Disk I/O** | Throttle | Block I/O | Automatic |
| **Network** | Shape traffic | Drop packets | Automatic |
| **Storage** | Warning | Block writes | Manual cleanup |
| **Processes** | Warning | Reject fork() | Automatic |

---

## Resource Exhaustion Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        RESOURCE EXHAUSTION HANDLING ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         RESOURCE MONITORING LAYER                                │   │
│  │                                                                                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │  │   CPU   │  │ Memory  │  │  Disk   │  │ Network │  │ Process │              │   │
│  │  │ Monitor │  │ Monitor │  │ Monitor │  │ Monitor │  │ Monitor │              │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘              │   │
│  │       │            │            │            │            │                     │   │
│  └───────┼────────────┼────────────┼────────────┼────────────┼─────────────────────┘   │
│          │            │            │            │            │                         │
│          ▼            ▼            ▼            ▼            ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         THRESHOLD EVALUATION                                     │   │
│  │                                                                                   │   │
│  │  Usage < 70%  ──────────────────────────────────────────────►  NORMAL           │   │
│  │  Usage 70-85% ──────────────────────────────────────────────►  WARNING          │   │
│  │  Usage 85-95% ──────────────────────────────────────────────►  SOFT LIMIT       │   │
│  │  Usage > 95%  ──────────────────────────────────────────────►  HARD LIMIT       │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│          │            │            │            │                                       │
│          ▼            ▼            ▼            ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         RESPONSE ACTIONS                                         │   │
│  │                                                                                   │   │
│  │  NORMAL:      No action                                                          │   │
│  │  WARNING:     Log + notify user + increase monitoring                           │   │
│  │  SOFT LIMIT:  Throttle + reclaim + warn user                                    │   │
│  │  HARD LIMIT:  Enforce limit + kill/block + alert                                │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                             │
│          ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         RECOVERY & NOTIFICATION                                  │   │
│  │                                                                                   │   │
│  │  • Auto-recovery when usage drops                                               │   │
│  │  • User notification via WebSocket                                              │   │
│  │  • Metrics exported to Prometheus                                               │   │
│  │  • Audit log for compliance                                                     │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## OOM Killer Configuration

### How OOM Killer Works

The Linux Out-Of-Memory (OOM) killer is invoked when the system runs out of memory. It selects and kills processes to free memory based on the OOM score.

### OOM Score Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OOM SCORE CALCULATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Base Score = (process_memory / total_memory) * 1000                        │
│                                                                             │
│  Adjustments:                                                               │
│  • oom_score_adj: -1000 to +1000 (added to base)                           │
│  • Root processes: -30 (legacy)                                             │
│  • Child processes: Inherit parent's adj                                    │
│                                                                             │
│  Final Score = Base Score + oom_score_adj                                   │
│  Range: 0 (never kill) to 1000 (always kill first)                         │
│                                                                             │
│  SANDBOX CONFIGURATION:                                                     │
│  • Free tier:       oom_score_adj = 1000 (kill first)                      │
│  • Standard tier:   oom_score_adj = 500                                     │
│  • Pro tier:        oom_score_adj = 250                                     │
│  • Enterprise tier: oom_score_adj = 0                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### cgroups v2 OOM Configuration

```bash
# Memory limit (hard limit)
echo "2147483648" > /sys/fs/cgroup/sandbox-123/memory.max

# Memory high (soft limit - triggers reclaim)
echo "1610612736" > /sys/fs/cgroup/sandbox-123/memory.high

# OOM group kill (kill all processes in cgroup on OOM)
echo "1" > /sys/fs/cgroup/sandbox-123/memory.oom.group

# Check OOM events
cat /sys/fs/cgroup/sandbox-123/memory.events
# oom 0
# oom_kill 0
# oom_group_kill 0
```

### OOM Score Adjustment

```bash
# Set OOM score adjustment for sandbox process
echo "500" > /proc/<pid>/oom_score_adj

# Protect critical system processes
echo "-1000" > /proc/1/oom_score_adj  # init
echo "-1000" > /proc/<kubelet_pid>/oom_score_adj
```

### Kubernetes OOM Configuration

```yaml
# kubernetes-oom-config.yaml
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
          memory: "512Mi"
        limits:
          memory: "2Gi"
      # OOM score is automatically set based on QoS class:
      # Guaranteed (requests == limits): -997
      # Burstable: 2-999 based on memory request ratio
      # BestEffort (no requests/limits): 1000
```

### OOM Handler Implementation

```typescript
// src/services/oomHandler.ts

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface OomEvent {
  sandboxId: string;
  timestamp: Date;
  processName: string;
  pid: number;
  memoryUsage: number;
  memoryLimit: number;
  oomScore: number;
}

interface OomConfig {
  oomScoreAdj: number;
  oomKillGroup: boolean;
  memoryMax: number;
  memoryHigh: number;
}

class OomHandler extends EventEmitter {
  private oomConfigs: Map<string, OomConfig> = new Map();
  private oomEvents: OomEvent[] = [];
  
  async configureOom(sandboxId: string, config: OomConfig): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Set memory limits
    await execAsync(`echo "${config.memoryMax}" > ${cgroupPath}/memory.max`);
    await execAsync(`echo "${config.memoryHigh}" > ${cgroupPath}/memory.high`);
    
    // Enable OOM group kill
    if (config.oomKillGroup) {
      await execAsync(`echo "1" > ${cgroupPath}/memory.oom.group`);
    }
    
    this.oomConfigs.set(sandboxId, config);
  }
  
  async setOomScoreAdj(pid: number, score: number): Promise<void> {
    // Clamp score to valid range
    const clampedScore = Math.max(-1000, Math.min(1000, score));
    await execAsync(`echo "${clampedScore}" > /proc/${pid}/oom_score_adj`);
  }
  
  async monitorOomEvents(sandboxId: string): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Watch memory.events file for OOM events
    const { stdout } = await execAsync(`cat ${cgroupPath}/memory.events`);
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('oom_kill ')) {
        const count = parseInt(line.split(' ')[1], 10);
        if (count > 0) {
          const event: OomEvent = {
            sandboxId,
            timestamp: new Date(),
            processName: 'unknown',
            pid: 0,
            memoryUsage: 0,
            memoryLimit: this.oomConfigs.get(sandboxId)?.memoryMax || 0,
            oomScore: 0,
          };
          
          this.oomEvents.push(event);
          this.emit('oom', event);
        }
      }
    }
  }
  
  async handleOomKill(sandboxId: string): Promise<void> {
    console.log(`[OOM] Sandbox ${sandboxId} experienced OOM kill`);
    
    // Notify user
    this.emit('notify', {
      sandboxId,
      type: 'oom_kill',
      message: 'Your sandbox ran out of memory and a process was killed.',
      suggestion: 'Consider upgrading to a higher tier for more memory.',
    });
    
    // Record metrics
    this.emit('metric', {
      name: 'sandbox_oom_kills_total',
      labels: { sandbox_id: sandboxId },
      value: 1,
    });
    
    // Attempt recovery
    await this.attemptRecovery(sandboxId);
  }
  
  private async attemptRecovery(sandboxId: string): Promise<void> {
    // Check if main process is still running
    // If not, restart the sandbox
    console.log(`[OOM] Attempting recovery for sandbox ${sandboxId}`);
  }
  
  getOomEvents(sandboxId?: string): OomEvent[] {
    if (sandboxId) {
      return this.oomEvents.filter(e => e.sandboxId === sandboxId);
    }
    return this.oomEvents;
  }
}

export const oomHandler = new OomHandler();
```

### OOM Prevention Strategies

```typescript
// src/services/oomPrevention.ts

interface MemoryPressureLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  usagePercent: number;
  action: string;
}

class OomPrevention {
  private pressureLevels: MemoryPressureLevel[] = [
    { level: 'low', usagePercent: 70, action: 'log' },
    { level: 'medium', usagePercent: 85, action: 'warn_user' },
    { level: 'high', usagePercent: 95, action: 'reclaim' },
    { level: 'critical', usagePercent: 99, action: 'kill_nonessential' },
  ];
  
  async checkMemoryPressure(sandboxId: string): Promise<MemoryPressureLevel> {
    const usage = await this.getMemoryUsage(sandboxId);
    const limit = await this.getMemoryLimit(sandboxId);
    const usagePercent = (usage / limit) * 100;
    
    // Find highest matching pressure level
    let currentLevel = this.pressureLevels[0];
    for (const level of this.pressureLevels) {
      if (usagePercent >= level.usagePercent) {
        currentLevel = level;
      }
    }
    
    return { ...currentLevel, usagePercent };
  }
  
  async handleMemoryPressure(sandboxId: string, level: MemoryPressureLevel): Promise<void> {
    switch (level.action) {
      case 'log':
        console.log(`[Memory] Sandbox ${sandboxId} at ${level.usagePercent.toFixed(1)}%`);
        break;
        
      case 'warn_user':
        await this.warnUser(sandboxId, level.usagePercent);
        break;
        
      case 'reclaim':
        await this.reclaimMemory(sandboxId);
        break;
        
      case 'kill_nonessential':
        await this.killNonessentialProcesses(sandboxId);
        break;
    }
  }
  
  private async warnUser(sandboxId: string, usagePercent: number): Promise<void> {
    // Send WebSocket notification to user
    console.log(`[Memory] Warning user: Sandbox ${sandboxId} at ${usagePercent.toFixed(1)}%`);
  }
  
  private async reclaimMemory(sandboxId: string): Promise<void> {
    // Trigger memory reclaim via cgroups
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Force memory reclaim
    // echo "1" > memory.reclaim (cgroups v2)
    console.log(`[Memory] Reclaiming memory for sandbox ${sandboxId}`);
  }
  
  private async killNonessentialProcesses(sandboxId: string): Promise<void> {
    // Kill background processes to free memory
    console.log(`[Memory] Killing non-essential processes in sandbox ${sandboxId}`);
  }
  
  private async getMemoryUsage(sandboxId: string): Promise<number> {
    // Read from cgroups
    return 0;
  }
  
  private async getMemoryLimit(sandboxId: string): Promise<number> {
    // Read from cgroups
    return 0;
  }
}

export const oomPrevention = new OomPrevention();
```

---

## CPU Throttling Behavior

### How CPU Throttling Works

CPU throttling occurs when a process exceeds its CPU quota. The kernel pauses the process until the next period begins.

### CPU Throttling Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CPU THROTTLING TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Period: 100ms (100,000 μs)                                                 │
│  Quota: 50ms (50,000 μs) = 0.5 CPU                                         │
│                                                                             │
│  0ms        25ms       50ms       75ms       100ms      125ms      150ms   │
│  │          │          │          │          │          │          │       │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤       │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│░░░░░░░░░░░░░░░░░░░░│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│       │
│  │    RUNNING         │    THROTTLED        │    RUNNING         │       │
│  │    (quota used)    │    (waiting)        │    (new period)    │       │
│  │                    │                      │                    │       │
│  └────────────────────┴──────────────────────┴────────────────────┘       │
│                                                                             │
│  ▓▓▓ = Process running (consuming CPU quota)                               │
│  ░░░ = Process throttled (waiting for next period)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### cgroups v2 CPU Throttling Configuration

```bash
# CPU quota and period
# Format: $MAX $PERIOD (microseconds)

# 0.5 CPU (50ms quota per 100ms period)
echo "50000 100000" > /sys/fs/cgroup/sandbox-123/cpu.max

# Check throttling statistics
cat /sys/fs/cgroup/sandbox-123/cpu.stat
# usage_usec 12345678
# user_usec 10000000
# system_usec 2345678
# nr_periods 1000
# nr_throttled 50
# throttled_usec 500000

# Burst configuration (cgroups v2.1+)
# Allow burst of 200ms accumulated over idle periods
echo "200000" > /sys/fs/cgroup/sandbox-123/cpu.max.burst
```

### CPU Throttling Handler

```typescript
// src/services/cpuThrottling.ts

interface CpuThrottleStats {
  nrPeriods: number;
  nrThrottled: number;
  throttledTime: number;  // microseconds
  throttlePercent: number;
}

interface CpuConfig {
  quotaMicroseconds: number;
  periodMicroseconds: number;
  burstMicroseconds: number;
  weight: number;
}

class CpuThrottlingHandler {
  private configs: Map<string, CpuConfig> = new Map();
  
  async configureCpu(sandboxId: string, config: CpuConfig): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Set CPU quota
    await this.writeFile(
      `${cgroupPath}/cpu.max`,
      `${config.quotaMicroseconds} ${config.periodMicroseconds}`
    );
    
    // Set CPU burst (if supported)
    try {
      await this.writeFile(
        `${cgroupPath}/cpu.max.burst`,
        `${config.burstMicroseconds}`
      );
    } catch {
      // Burst not supported on this kernel
    }
    
    // Set CPU weight
    await this.writeFile(`${cgroupPath}/cpu.weight`, `${config.weight}`);
    
    this.configs.set(sandboxId, config);
  }
  
  async getThrottleStats(sandboxId: string): Promise<CpuThrottleStats> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const stats = await this.readFile(`${cgroupPath}/cpu.stat`);
    
    const lines = stats.split('\n');
    let nrPeriods = 0;
    let nrThrottled = 0;
    let throttledTime = 0;
    
    for (const line of lines) {
      const [key, value] = line.split(' ');
      switch (key) {
        case 'nr_periods':
          nrPeriods = parseInt(value, 10);
          break;
        case 'nr_throttled':
          nrThrottled = parseInt(value, 10);
          break;
        case 'throttled_usec':
          throttledTime = parseInt(value, 10);
          break;
      }
    }
    
    const throttlePercent = nrPeriods > 0 ? (nrThrottled / nrPeriods) * 100 : 0;
    
    return { nrPeriods, nrThrottled, throttledTime, throttlePercent };
  }
  
  async handleHighThrottling(sandboxId: string, stats: CpuThrottleStats): Promise<void> {
    if (stats.throttlePercent > 50) {
      console.log(`[CPU] High throttling for sandbox ${sandboxId}: ${stats.throttlePercent.toFixed(1)}%`);
      
      // Notify user
      await this.notifyUser(sandboxId, {
        type: 'cpu_throttling',
        message: `Your sandbox is being CPU throttled ${stats.throttlePercent.toFixed(0)}% of the time.`,
        suggestion: 'Consider upgrading to a higher tier for more CPU resources.',
      });
    }
  }
  
  async adjustCpuDynamically(sandboxId: string): Promise<void> {
    const stats = await this.getThrottleStats(sandboxId);
    const config = this.configs.get(sandboxId);
    
    if (!config) return;
    
    // If consistently throttled, consider allowing burst
    if (stats.throttlePercent > 30 && config.burstMicroseconds === 0) {
      // Allow some burst capacity
      const newBurst = config.quotaMicroseconds * 2;
      await this.writeFile(
        `/sys/fs/cgroup/sandbox-${sandboxId}/cpu.max.burst`,
        `${newBurst}`
      );
      config.burstMicroseconds = newBurst;
    }
  }
  
  private async writeFile(path: string, content: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    await writeFile(path, content);
  }
  
  private async readFile(path: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    return readFile(path, 'utf-8');
  }
  
  private async notifyUser(sandboxId: string, notification: object): Promise<void> {
    // Send notification via WebSocket
  }
}

export const cpuThrottlingHandler = new CpuThrottlingHandler();
```

### CPU Burst Configuration

```typescript
// src/config/cpuBurst.ts

interface CpuBurstConfig {
  enabled: boolean;
  maxBurstMicroseconds: number;
  burstDecayRate: number;  // How fast burst capacity decays
  minIdleToAccumulate: number;  // Minimum idle time to accumulate burst
}

const cpuBurstByTier: Record<string, CpuBurstConfig> = {
  free: {
    enabled: false,
    maxBurstMicroseconds: 0,
    burstDecayRate: 0,
    minIdleToAccumulate: 0,
  },
  standard: {
    enabled: true,
    maxBurstMicroseconds: 150000,  // 150ms burst
    burstDecayRate: 0.5,
    minIdleToAccumulate: 10000,  // 10ms idle
  },
  pro: {
    enabled: true,
    maxBurstMicroseconds: 300000,  // 300ms burst
    burstDecayRate: 0.3,
    minIdleToAccumulate: 5000,  // 5ms idle
  },
  enterprise: {
    enabled: true,
    maxBurstMicroseconds: 600000,  // 600ms burst
    burstDecayRate: 0.2,
    minIdleToAccumulate: 1000,  // 1ms idle
  },
};
```

---

## Memory Pressure Handling

### Memory Pressure Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MEMORY PRESSURE LEVELS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  0%         50%        70%        85%        95%        100%               │
│  │          │          │          │          │          │                  │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┤                  │
│  │  NORMAL  │  NORMAL  │ WARNING  │   HIGH   │ CRITICAL │  OOM             │
│  │          │          │          │          │          │                  │
│  │          │          │          │          │          │                  │
│  │ No action│ No action│ Log +    │ Reclaim +│ Kill non-│ OOM              │
│  │          │          │ Notify   │ Throttle │ essential│ Kill             │
│  │          │          │          │          │          │                  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘                  │
│                                                                             │
│  memory.high (soft limit) ─────────────────────────────┐                   │
│  memory.max (hard limit) ──────────────────────────────┼───┐               │
│                                                         │   │               │
│                                                        85%  100%            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Memory Pressure Stall Information (PSI)

```bash
# Read memory pressure (cgroups v2)
cat /sys/fs/cgroup/sandbox-123/memory.pressure

# Output:
# some avg10=0.00 avg60=0.00 avg300=0.00 total=0
# full avg10=0.00 avg60=0.00 avg300=0.00 total=0

# some: At least one task stalled on memory
# full: All tasks stalled on memory
# avg10/60/300: 10s/60s/300s averages (percentage)
# total: Total stall time in microseconds
```

### Memory Pressure Handler

```typescript
// src/services/memoryPressure.ts

interface PressureStats {
  some: {
    avg10: number;
    avg60: number;
    avg300: number;
    total: number;
  };
  full: {
    avg10: number;
    avg60: number;
    avg300: number;
    total: number;
  };
}

interface MemoryStats {
  current: number;
  high: number;
  max: number;
  swap: number;
  pressure: PressureStats;
}

class MemoryPressureHandler {
  private thresholds = {
    warning: 70,
    high: 85,
    critical: 95,
    pressureWarning: 10,  // 10% avg10 pressure
    pressureCritical: 50, // 50% avg10 pressure
  };
  
  async getMemoryStats(sandboxId: string): Promise<MemoryStats> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    const current = parseInt(await this.readFile(`${cgroupPath}/memory.current`), 10);
    const high = parseInt(await this.readFile(`${cgroupPath}/memory.high`), 10);
    const max = parseInt(await this.readFile(`${cgroupPath}/memory.max`), 10);
    const swap = parseInt(await this.readFile(`${cgroupPath}/memory.swap.current`), 10);
    const pressure = await this.parsePressure(await this.readFile(`${cgroupPath}/memory.pressure`));
    
    return { current, high, max, swap, pressure };
  }
  
  private parsePressure(content: string): PressureStats {
    const lines = content.trim().split('\n');
    const stats: PressureStats = {
      some: { avg10: 0, avg60: 0, avg300: 0, total: 0 },
      full: { avg10: 0, avg60: 0, avg300: 0, total: 0 },
    };
    
    for (const line of lines) {
      const parts = line.split(' ');
      const type = parts[0] as 'some' | 'full';
      
      for (const part of parts.slice(1)) {
        const [key, value] = part.split('=');
        if (key && value) {
          (stats[type] as any)[key] = parseFloat(value);
        }
      }
    }
    
    return stats;
  }
  
  async handleMemoryPressure(sandboxId: string): Promise<void> {
    const stats = await this.getMemoryStats(sandboxId);
    const usagePercent = (stats.current / stats.max) * 100;
    
    // Check usage-based thresholds
    if (usagePercent >= this.thresholds.critical) {
      await this.handleCriticalMemory(sandboxId, stats);
    } else if (usagePercent >= this.thresholds.high) {
      await this.handleHighMemory(sandboxId, stats);
    } else if (usagePercent >= this.thresholds.warning) {
      await this.handleWarningMemory(sandboxId, stats);
    }
    
    // Check pressure-based thresholds
    if (stats.pressure.full.avg10 >= this.thresholds.pressureCritical) {
      await this.handleCriticalPressure(sandboxId, stats);
    } else if (stats.pressure.some.avg10 >= this.thresholds.pressureWarning) {
      await this.handleWarningPressure(sandboxId, stats);
    }
  }
  
  private async handleCriticalMemory(sandboxId: string, stats: MemoryStats): Promise<void> {
    console.log(`[Memory] CRITICAL: Sandbox ${sandboxId} at ${((stats.current / stats.max) * 100).toFixed(1)}%`);
    
    // Try to reclaim memory
    await this.forceReclaim(sandboxId);
    
    // Kill non-essential processes
    await this.killNonessential(sandboxId);
    
    // Notify user
    await this.notifyUser(sandboxId, {
      type: 'memory_critical',
      severity: 'critical',
      message: 'Your sandbox is critically low on memory.',
      action: 'Some processes may be killed to free memory.',
    });
  }
  
  private async handleHighMemory(sandboxId: string, stats: MemoryStats): Promise<void> {
    console.log(`[Memory] HIGH: Sandbox ${sandboxId} at ${((stats.current / stats.max) * 100).toFixed(1)}%`);
    
    // Trigger memory reclaim
    await this.triggerReclaim(sandboxId);
    
    // Notify user
    await this.notifyUser(sandboxId, {
      type: 'memory_high',
      severity: 'warning',
      message: 'Your sandbox is running low on memory.',
      suggestion: 'Consider closing unused applications or upgrading your plan.',
    });
  }
  
  private async handleWarningMemory(sandboxId: string, stats: MemoryStats): Promise<void> {
    console.log(`[Memory] WARNING: Sandbox ${sandboxId} at ${((stats.current / stats.max) * 100).toFixed(1)}%`);
    
    // Just log and notify
    await this.notifyUser(sandboxId, {
      type: 'memory_warning',
      severity: 'info',
      message: 'Your sandbox memory usage is elevated.',
    });
  }
  
  private async handleCriticalPressure(sandboxId: string, stats: MemoryStats): Promise<void> {
    console.log(`[Memory] CRITICAL PRESSURE: Sandbox ${sandboxId} - full.avg10=${stats.pressure.full.avg10}%`);
    
    // System is thrashing, need immediate action
    await this.forceReclaim(sandboxId);
  }
  
  private async handleWarningPressure(sandboxId: string, stats: MemoryStats): Promise<void> {
    console.log(`[Memory] PRESSURE WARNING: Sandbox ${sandboxId} - some.avg10=${stats.pressure.some.avg10}%`);
  }
  
  private async triggerReclaim(sandboxId: string): Promise<void> {
    // Trigger memory reclaim via cgroups v2
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    try {
      await this.writeFile(`${cgroupPath}/memory.reclaim`, '1');
    } catch {
      // memory.reclaim might not be available
    }
  }
  
  private async forceReclaim(sandboxId: string): Promise<void> {
    // More aggressive reclaim
    await this.triggerReclaim(sandboxId);
    
    // Drop caches
    // echo 3 > /proc/sys/vm/drop_caches (requires root)
  }
  
  private async killNonessential(sandboxId: string): Promise<void> {
    // Kill background processes, keeping main process alive
    console.log(`[Memory] Killing non-essential processes in sandbox ${sandboxId}`);
  }
  
  private async notifyUser(sandboxId: string, notification: object): Promise<void> {
    // Send via WebSocket
  }
  
  private async readFile(path: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    return readFile(path, 'utf-8');
  }
  
  private async writeFile(path: string, content: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    await writeFile(path, content);
  }
}

export const memoryPressureHandler = new MemoryPressureHandler();
```

---

## Disk I/O Throttling

### I/O Throttling Behavior

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         I/O THROTTLING BEHAVIOR                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WITHOUT THROTTLING:                                                        │
│  ───────────────────                                                        │
│  Request 1 ──► [████████████████████████████████████████] ──► Complete     │
│  Request 2 ──► [████████████████████████████████████████] ──► Complete     │
│  Request 3 ──► [████████████████████████████████████████] ──► Complete     │
│                                                                             │
│  WITH THROTTLING (100 MB/s limit):                                         │
│  ─────────────────────────────────                                          │
│  Request 1 ──► [████░░░░████░░░░████░░░░████] ──► Complete (delayed)       │
│  Request 2 ──► [    ████░░░░████░░░░████░░░░] ──► Complete (queued)        │
│  Request 3 ──► [        ████░░░░████░░░░████] ──► Complete (queued)        │
│                                                                             │
│  ████ = I/O in progress                                                    │
│  ░░░░ = Throttled (waiting)                                                │
│                                                                             │
│  THROTTLE STATS:                                                            │
│  • Bytes read: 100 MB/s (at limit)                                         │
│  • Bytes written: 50 MB/s (at limit)                                       │
│  • IOPS: 1000 (at limit)                                                   │
│  • Latency: Increased due to queuing                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### I/O Throttling Handler

```typescript
// src/services/ioThrottling.ts

interface IoStats {
  readBytes: number;
  writeBytes: number;
  readIos: number;
  writeIos: number;
  readBytesPerSecond: number;
  writeBytesPerSecond: number;
}

interface IoLimits {
  readBps: number;
  writeBps: number;
  readIops: number;
  writeIops: number;
}

class IoThrottlingHandler {
  private limits: Map<string, IoLimits> = new Map();
  private lastStats: Map<string, { stats: IoStats; timestamp: number }> = new Map();
  
  async configureIoLimits(sandboxId: string, limits: IoLimits, deviceMajorMinor: string): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Set I/O limits
    const ioMax = `${deviceMajorMinor} rbps=${limits.readBps} wbps=${limits.writeBps} riops=${limits.readIops} wiops=${limits.writeIops}`;
    await this.writeFile(`${cgroupPath}/io.max`, ioMax);
    
    this.limits.set(sandboxId, limits);
  }
  
  async getIoStats(sandboxId: string): Promise<IoStats> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const content = await this.readFile(`${cgroupPath}/io.stat`);
    
    // Parse io.stat
    // Format: MAJOR:MINOR rbytes=X wbytes=X rios=X wios=X ...
    let readBytes = 0;
    let writeBytes = 0;
    let readIos = 0;
    let writeIos = 0;
    
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const parts = line.split(' ');
      for (const part of parts.slice(1)) {
        const [key, value] = part.split('=');
        switch (key) {
          case 'rbytes':
            readBytes += parseInt(value, 10);
            break;
          case 'wbytes':
            writeBytes += parseInt(value, 10);
            break;
          case 'rios':
            readIos += parseInt(value, 10);
            break;
          case 'wios':
            writeIos += parseInt(value, 10);
            break;
        }
      }
    }
    
    // Calculate rates
    const now = Date.now();
    const last = this.lastStats.get(sandboxId);
    let readBytesPerSecond = 0;
    let writeBytesPerSecond = 0;
    
    if (last) {
      const timeDelta = (now - last.timestamp) / 1000;
      if (timeDelta > 0) {
        readBytesPerSecond = (readBytes - last.stats.readBytes) / timeDelta;
        writeBytesPerSecond = (writeBytes - last.stats.writeBytes) / timeDelta;
      }
    }
    
    const stats: IoStats = {
      readBytes,
      writeBytes,
      readIos,
      writeIos,
      readBytesPerSecond,
      writeBytesPerSecond,
    };
    
    this.lastStats.set(sandboxId, { stats, timestamp: now });
    
    return stats;
  }
  
  async checkIoThrottling(sandboxId: string): Promise<void> {
    const stats = await this.getIoStats(sandboxId);
    const limits = this.limits.get(sandboxId);
    
    if (!limits) return;
    
    // Check if approaching limits
    const readPercent = (stats.readBytesPerSecond / limits.readBps) * 100;
    const writePercent = (stats.writeBytesPerSecond / limits.writeBps) * 100;
    
    if (readPercent > 90 || writePercent > 90) {
      await this.notifyUser(sandboxId, {
        type: 'io_throttling',
        message: `I/O is being throttled (read: ${readPercent.toFixed(0)}%, write: ${writePercent.toFixed(0)}% of limit)`,
        suggestion: 'Consider upgrading for higher I/O limits.',
      });
    }
  }
  
  private async readFile(path: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    return readFile(path, 'utf-8');
  }
  
  private async writeFile(path: string, content: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    await writeFile(path, content);
  }
  
  private async notifyUser(sandboxId: string, notification: object): Promise<void> {
    // Send via WebSocket
  }
}

export const ioThrottlingHandler = new IoThrottlingHandler();
```

---

## Network Throttling

### Network Throttling Behavior

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NETWORK THROTTLING BEHAVIOR                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRAFFIC SHAPING (tc qdisc):                                               │
│  ──────────────────────────                                                 │
│                                                                             │
│  Incoming packets ──► [Token Bucket Filter] ──► Sandbox                    │
│                              │                                              │
│                              ▼                                              │
│                       Rate: 100 Mbps                                        │
│                       Burst: 128 KB                                         │
│                       Latency: 50ms max                                     │
│                                                                             │
│  BEHAVIOR:                                                                  │
│  • Packets within rate: Pass immediately                                   │
│  • Burst packets: Pass using burst allowance                               │
│  • Excess packets: Queued (up to latency limit)                            │
│  • Queue full: Packets DROPPED                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                                                                   │       │
│  │  Rate ─────────────────────────────────────────────────────────  │       │
│  │  100 Mbps │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │       │
│  │           │                                                   │  │       │
│  │  Actual   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │       │
│  │  Traffic  │                    ▲                              │  │       │
│  │           │                    │                              │  │       │
│  │           │                 Throttled                         │  │       │
│  │           │                                                   │  │       │
│  │  0 ───────┴───────────────────────────────────────────────────┘  │       │
│  │           0s        5s        10s       15s       20s            │       │
│  │                                                                   │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Network Throttling Handler

```typescript
// src/services/networkThrottling.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface NetworkLimits {
  egressRate: string;    // e.g., "50mbit"
  ingressRate: string;   // e.g., "100mbit"
  burst: string;         // e.g., "128kbit"
  latency: string;       // e.g., "50ms"
}

interface NetworkStats {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxDropped: number;
  txDropped: number;
}

class NetworkThrottlingHandler {
  private limits: Map<string, NetworkLimits> = new Map();
  
  async configureNetworkLimits(
    sandboxId: string,
    limits: NetworkLimits,
    interface_: string = 'eth0'
  ): Promise<void> {
    // Clear existing rules
    await this.clearRules(interface_);
    
    // Configure egress (outgoing) limiting
    await execAsync(`tc qdisc add dev ${interface_} root handle 1: htb default 10`);
    await execAsync(`tc class add dev ${interface_} parent 1: classid 1:1 htb rate ${limits.egressRate} burst ${limits.burst}`);
    await execAsync(`tc class add dev ${interface_} parent 1:1 classid 1:10 htb rate ${limits.egressRate} burst ${limits.burst}`);
    
    // Configure ingress (incoming) limiting
    await execAsync(`tc qdisc add dev ${interface_} handle ffff: ingress`);
    await execAsync(`tc filter add dev ${interface_} parent ffff: protocol ip prio 1 u32 match u32 0 0 police rate ${limits.ingressRate} burst ${limits.burst} drop flowid :1`);
    
    this.limits.set(sandboxId, limits);
  }
  
  private async clearRules(interface_: string): Promise<void> {
    try {
      await execAsync(`tc qdisc del dev ${interface_} root 2>/dev/null`);
      await execAsync(`tc qdisc del dev ${interface_} ingress 2>/dev/null`);
    } catch {
      // Ignore errors if rules don't exist
    }
  }
  
  async getNetworkStats(sandboxId: string, interface_: string = 'eth0'): Promise<NetworkStats> {
    const { stdout } = await execAsync(`cat /sys/class/net/${interface_}/statistics/rx_bytes`);
    const rxBytes = parseInt(stdout.trim(), 10);
    
    const { stdout: txOut } = await execAsync(`cat /sys/class/net/${interface_}/statistics/tx_bytes`);
    const txBytes = parseInt(txOut.trim(), 10);
    
    const { stdout: rxPktOut } = await execAsync(`cat /sys/class/net/${interface_}/statistics/rx_packets`);
    const rxPackets = parseInt(rxPktOut.trim(), 10);
    
    const { stdout: txPktOut } = await execAsync(`cat /sys/class/net/${interface_}/statistics/tx_packets`);
    const txPackets = parseInt(txPktOut.trim(), 10);
    
    const { stdout: rxDropOut } = await execAsync(`cat /sys/class/net/${interface_}/statistics/rx_dropped`);
    const rxDropped = parseInt(rxDropOut.trim(), 10);
    
    const { stdout: txDropOut } = await execAsync(`cat /sys/class/net/${interface_}/statistics/tx_dropped`);
    const txDropped = parseInt(txDropOut.trim(), 10);
    
    return { rxBytes, txBytes, rxPackets, txPackets, rxDropped, txDropped };
  }
  
  async checkNetworkThrottling(sandboxId: string): Promise<void> {
    const stats = await this.getNetworkStats(sandboxId);
    
    // Check for dropped packets (sign of throttling)
    if (stats.rxDropped > 0 || stats.txDropped > 0) {
      await this.notifyUser(sandboxId, {
        type: 'network_throttling',
        message: `Network traffic is being throttled. ${stats.rxDropped + stats.txDropped} packets dropped.`,
        suggestion: 'Consider upgrading for higher bandwidth limits.',
      });
    }
  }
  
  private async notifyUser(sandboxId: string, notification: object): Promise<void> {
    // Send via WebSocket
  }
}

export const networkThrottlingHandler = new NetworkThrottlingHandler();
```

---

## Graceful Degradation vs Hard Limits

### Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 GRACEFUL DEGRADATION vs HARD LIMITS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GRACEFUL DEGRADATION:                                                      │
│  ─────────────────────                                                      │
│                                                                             │
│  Usage    100% ┌────────────────────────────────────────────────────┐      │
│           90%  │                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│      │
│           80%  │              ░░░░░░                               │      │
│           70%  │         ░░░░░                                     │      │
│           60%  │      ░░░░                                         │      │
│           50%  │    ░░░                                            │      │
│           40%  │  ░░░                                              │      │
│           30%  │ ░░                                                │      │
│           20%  │░░                                                 │      │
│           10%  │░                                                  │      │
│            0%  └────────────────────────────────────────────────────┘      │
│                 ▲         ▲         ▲         ▲         ▲                  │
│                 │         │         │         │         │                  │
│              Normal    Warning   Throttle  Severe    Critical              │
│                                                                             │
│  • Gradual performance reduction                                           │
│  • User warnings at each stage                                             │
│  • Time to react and adjust                                                │
│  • Better user experience                                                  │
│                                                                             │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  HARD LIMITS:                                                               │
│  ────────────                                                               │
│                                                                             │
│  Usage    100% ┌────────────────────────────────────────────────────┐      │
│           90%  │                                                    │      │
│           80%  │                                                    │      │
│           70%  │                                                    │      │
│           60%  │                                                    │      │
│           50%  │                                                    │      │
│           40%  │                                                    │      │
│           30%  │                                                    │      │
│           20%  │                                                    │      │
│           10%  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│      │
│            0%  └────────────────────────────────────────────────────┘      │
│                                              ▲                              │
│                                              │                              │
│                                           BLOCKED                           │
│                                                                             │
│  • Immediate enforcement                                                   │
│  • No warning period                                                       │
│  • Process killed or blocked                                               │
│  • Simpler implementation                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Strategy by Resource Type

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| **CPU** | Graceful (throttle) | Throttling is transparent, process continues |
| **Memory** | Hard (OOM kill) | No way to "slow down" memory, must enforce |
| **Disk I/O** | Graceful (throttle) | Throttling is transparent, I/O continues |
| **Network** | Graceful (shape + drop) | Traffic shaping with eventual drops |
| **Storage** | Hard (block writes) | Disk full is disk full |
| **Processes** | Hard (reject fork) | Fork bomb prevention |

### Implementation

```typescript
// src/services/resourceEnforcement.ts

type EnforcementStrategy = 'graceful' | 'hard';

interface ResourceEnforcementConfig {
  cpu: {
    strategy: EnforcementStrategy;
    softLimitPercent: number;
    hardLimitPercent: number;
    throttleGradient: number[];  // Throttle percentages at each level
  };
  memory: {
    strategy: EnforcementStrategy;
    warningPercent: number;
    highPercent: number;
    criticalPercent: number;
  };
  io: {
    strategy: EnforcementStrategy;
    softLimitPercent: number;
    hardLimitPercent: number;
  };
  network: {
    strategy: EnforcementStrategy;
    softLimitPercent: number;
    dropThresholdPercent: number;
  };
  storage: {
    strategy: EnforcementStrategy;
    warningPercent: number;
    blockWritesPercent: number;
  };
  processes: {
    strategy: EnforcementStrategy;
    warningPercent: number;
  };
}

const defaultEnforcementConfig: ResourceEnforcementConfig = {
  cpu: {
    strategy: 'graceful',
    softLimitPercent: 80,
    hardLimitPercent: 100,
    throttleGradient: [0, 10, 25, 50, 75, 100],  // Throttle % at 80%, 85%, 90%, 95%, 100%
  },
  memory: {
    strategy: 'hard',
    warningPercent: 70,
    highPercent: 85,
    criticalPercent: 95,
  },
  io: {
    strategy: 'graceful',
    softLimitPercent: 80,
    hardLimitPercent: 100,
  },
  network: {
    strategy: 'graceful',
    softLimitPercent: 80,
    dropThresholdPercent: 100,
  },
  storage: {
    strategy: 'hard',
    warningPercent: 80,
    blockWritesPercent: 95,
  },
  processes: {
    strategy: 'hard',
    warningPercent: 80,
  },
};

class ResourceEnforcer {
  private config: ResourceEnforcementConfig;
  
  constructor(config: ResourceEnforcementConfig = defaultEnforcementConfig) {
    this.config = config;
  }
  
  async enforceCpu(sandboxId: string, usagePercent: number): Promise<void> {
    if (this.config.cpu.strategy === 'graceful') {
      await this.gracefulCpuEnforcement(sandboxId, usagePercent);
    } else {
      await this.hardCpuEnforcement(sandboxId, usagePercent);
    }
  }
  
  private async gracefulCpuEnforcement(sandboxId: string, usagePercent: number): Promise<void> {
    const { softLimitPercent, throttleGradient } = this.config.cpu;
    
    if (usagePercent < softLimitPercent) {
      // No throttling needed
      return;
    }
    
    // Calculate throttle level
    const overagePercent = usagePercent - softLimitPercent;
    const levelIndex = Math.min(
      Math.floor(overagePercent / 5),  // 5% increments
      throttleGradient.length - 1
    );
    const throttlePercent = throttleGradient[levelIndex];
    
    console.log(`[CPU] Sandbox ${sandboxId}: ${usagePercent}% usage, ${throttlePercent}% throttle`);
    
    // Apply throttle (reduce CPU quota)
    await this.applyCpuThrottle(sandboxId, throttlePercent);
    
    // Notify user
    if (throttlePercent > 0) {
      await this.notifyUser(sandboxId, {
        type: 'cpu_throttle',
        severity: throttlePercent > 50 ? 'warning' : 'info',
        message: `CPU is being throttled by ${throttlePercent}% due to high usage.`,
      });
    }
  }
  
  private async hardCpuEnforcement(sandboxId: string, usagePercent: number): Promise<void> {
    // Hard enforcement just uses the cgroups limit
    // No additional action needed - kernel enforces
  }
  
  async enforceMemory(sandboxId: string, usagePercent: number): Promise<void> {
    const { warningPercent, highPercent, criticalPercent } = this.config.memory;
    
    if (usagePercent >= criticalPercent) {
      // Hard limit - OOM killer will handle
      await this.notifyUser(sandboxId, {
        type: 'memory_critical',
        severity: 'critical',
        message: 'Memory usage is critical. Processes may be killed.',
      });
    } else if (usagePercent >= highPercent) {
      // Trigger reclaim
      await this.triggerMemoryReclaim(sandboxId);
      await this.notifyUser(sandboxId, {
        type: 'memory_high',
        severity: 'warning',
        message: 'Memory usage is high. Consider freeing memory.',
      });
    } else if (usagePercent >= warningPercent) {
      await this.notifyUser(sandboxId, {
        type: 'memory_warning',
        severity: 'info',
        message: 'Memory usage is elevated.',
      });
    }
  }
  
  async enforceStorage(sandboxId: string, usagePercent: number): Promise<void> {
    const { warningPercent, blockWritesPercent } = this.config.storage;
    
    if (usagePercent >= blockWritesPercent) {
      // Hard limit - block writes
      await this.blockStorageWrites(sandboxId);
      await this.notifyUser(sandboxId, {
        type: 'storage_full',
        severity: 'critical',
        message: 'Storage is full. Writes are blocked.',
        action: 'Please delete files to free space.',
      });
    } else if (usagePercent >= warningPercent) {
      await this.notifyUser(sandboxId, {
        type: 'storage_warning',
        severity: 'warning',
        message: `Storage is ${usagePercent.toFixed(0)}% full.`,
      });
    }
  }
  
  private async applyCpuThrottle(sandboxId: string, throttlePercent: number): Promise<void> {
    // Reduce CPU quota proportionally
  }
  
  private async triggerMemoryReclaim(sandboxId: string): Promise<void> {
    // Trigger cgroups memory reclaim
  }
  
  private async blockStorageWrites(sandboxId: string): Promise<void> {
    // Remount filesystem as read-only or use quota
  }
  
  private async notifyUser(sandboxId: string, notification: object): Promise<void> {
    // Send via WebSocket
  }
}

export const resourceEnforcer = new ResourceEnforcer();
```

---

## Recovery Mechanisms

### Automatic Recovery

```typescript
// src/services/resourceRecovery.ts

interface RecoveryAction {
  type: 'restart_process' | 'restart_sandbox' | 'clear_cache' | 'kill_zombie' | 'notify_user';
  priority: number;
  condition: (stats: ResourceStats) => boolean;
  execute: (sandboxId: string) => Promise<void>;
}

interface ResourceStats {
  cpu: { usage: number; throttled: number };
  memory: { usage: number; oomKills: number };
  io: { throttled: boolean };
  processes: { count: number; zombies: number };
}

class ResourceRecovery {
  private recoveryActions: RecoveryAction[] = [
    {
      type: 'kill_zombie',
      priority: 1,
      condition: (stats) => stats.processes.zombies > 0,
      execute: async (sandboxId) => {
        await this.killZombieProcesses(sandboxId);
      },
    },
    {
      type: 'clear_cache',
      priority: 2,
      condition: (stats) => stats.memory.usage > 90,
      execute: async (sandboxId) => {
        await this.clearCaches(sandboxId);
      },
    },
    {
      type: 'restart_process',
      priority: 3,
      condition: (stats) => stats.memory.oomKills > 0,
      execute: async (sandboxId) => {
        await this.restartMainProcess(sandboxId);
      },
    },
    {
      type: 'restart_sandbox',
      priority: 4,
      condition: (stats) => stats.memory.oomKills > 3,
      execute: async (sandboxId) => {
        await this.restartSandbox(sandboxId);
      },
    },
  ];
  
  async attemptRecovery(sandboxId: string, stats: ResourceStats): Promise<void> {
    // Sort by priority
    const sortedActions = [...this.recoveryActions].sort((a, b) => a.priority - b.priority);
    
    for (const action of sortedActions) {
      if (action.condition(stats)) {
        console.log(`[Recovery] Executing ${action.type} for sandbox ${sandboxId}`);
        await action.execute(sandboxId);
        
        // Check if recovery was successful
        const newStats = await this.getResourceStats(sandboxId);
        if (!action.condition(newStats)) {
          console.log(`[Recovery] ${action.type} successful for sandbox ${sandboxId}`);
          return;
        }
      }
    }
    
    // If all recovery actions failed, notify user
    await this.notifyUser(sandboxId, {
      type: 'recovery_failed',
      severity: 'critical',
      message: 'Automatic recovery failed. Manual intervention may be required.',
    });
  }
  
  private async killZombieProcesses(sandboxId: string): Promise<void> {
    // Find and kill zombie processes
    console.log(`[Recovery] Killing zombie processes in sandbox ${sandboxId}`);
  }
  
  private async clearCaches(sandboxId: string): Promise<void> {
    // Clear page cache, dentries, inodes
    console.log(`[Recovery] Clearing caches for sandbox ${sandboxId}`);
  }
  
  private async restartMainProcess(sandboxId: string): Promise<void> {
    // Restart the main sandbox process
    console.log(`[Recovery] Restarting main process for sandbox ${sandboxId}`);
  }
  
  private async restartSandbox(sandboxId: string): Promise<void> {
    // Full sandbox restart
    console.log(`[Recovery] Restarting sandbox ${sandboxId}`);
  }
  
  private async getResourceStats(sandboxId: string): Promise<ResourceStats> {
    // Get current resource stats
    return {
      cpu: { usage: 0, throttled: 0 },
      memory: { usage: 0, oomKills: 0 },
      io: { throttled: false },
      processes: { count: 0, zombies: 0 },
    };
  }
  
  private async notifyUser(sandboxId: string, notification: object): Promise<void> {
    // Send via WebSocket
  }
}

export const resourceRecovery = new ResourceRecovery();
```

---

## Monitoring and Detection

### Prometheus Metrics

```typescript
// src/services/exhaustionMetrics.ts

import { Counter, Gauge, Histogram } from 'prom-client';

const exhaustionMetrics = {
  // OOM metrics
  oomKills: new Counter({
    name: 'sandbox_oom_kills_total',
    help: 'Total OOM kills',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  memoryPressure: new Gauge({
    name: 'sandbox_memory_pressure_percent',
    help: 'Memory pressure percentage',
    labelNames: ['sandbox_id', 'type'],  // type: some, full
  }),
  
  // CPU throttling metrics
  cpuThrottledPeriods: new Counter({
    name: 'sandbox_cpu_throttled_periods_total',
    help: 'Total CPU throttled periods',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  cpuThrottledTime: new Counter({
    name: 'sandbox_cpu_throttled_seconds_total',
    help: 'Total CPU throttled time in seconds',
    labelNames: ['sandbox_id', 'tier'],
  }),
  
  // I/O metrics
  ioThrottled: new Counter({
    name: 'sandbox_io_throttled_total',
    help: 'Total I/O throttle events',
    labelNames: ['sandbox_id', 'tier', 'type'],  // type: read, write
  }),
  
  // Network metrics
  networkDropped: new Counter({
    name: 'sandbox_network_dropped_packets_total',
    help: 'Total dropped packets due to throttling',
    labelNames: ['sandbox_id', 'tier', 'direction'],  // direction: rx, tx
  }),
  
  // Recovery metrics
  recoveryAttempts: new Counter({
    name: 'sandbox_recovery_attempts_total',
    help: 'Total recovery attempts',
    labelNames: ['sandbox_id', 'action'],
  }),
  
  recoverySuccess: new Counter({
    name: 'sandbox_recovery_success_total',
    help: 'Total successful recoveries',
    labelNames: ['sandbox_id', 'action'],
  }),
};

export { exhaustionMetrics };
```

### Alerting Rules

```yaml
# prometheus-exhaustion-alerts.yaml
groups:
  - name: resource-exhaustion
    rules:
      # OOM alerts
      - alert: SandboxOomKill
        expr: increase(sandbox_oom_kills_total[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} experienced OOM kill"
          
      - alert: SandboxHighMemoryPressure
        expr: sandbox_memory_pressure_percent{type="full"} > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} under high memory pressure"
          
      # CPU throttling alerts
      - alert: SandboxHighCpuThrottling
        expr: rate(sandbox_cpu_throttled_periods_total[5m]) / rate(sandbox_cpu_periods_total[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} CPU throttled >50% of time"
          
      # Network alerts
      - alert: SandboxNetworkDrops
        expr: rate(sandbox_network_dropped_packets_total[5m]) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Sandbox {{ $labels.sandbox_id }} dropping >100 packets/sec"
```

---

## User Communication

### WebSocket Notification System

```typescript
// src/services/userNotification.ts

interface ResourceNotification {
  sandboxId: string;
  type: 'cpu_throttle' | 'memory_warning' | 'memory_critical' | 'oom_kill' | 
        'io_throttle' | 'network_throttle' | 'storage_warning' | 'storage_full' |
        'process_limit' | 'recovery_started' | 'recovery_complete' | 'recovery_failed';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestion?: string;
  action?: string;
  timestamp: Date;
  metrics?: Record<string, number>;
}

class UserNotificationService {
  private connections: Map<string, WebSocket> = new Map();
  
  async notify(notification: ResourceNotification): Promise<void> {
    const ws = this.connections.get(notification.sandboxId);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'resource_notification',
        data: notification,
      }));
    }
    
    // Also log for audit
    console.log(`[Notification] ${notification.sandboxId}: ${notification.type} - ${notification.message}`);
    
    // Store in database for history
    await this.storeNotification(notification);
  }
  
  async notifyThrottling(sandboxId: string, resource: string, percent: number): Promise<void> {
    await this.notify({
      sandboxId,
      type: `${resource}_throttle` as any,
      severity: percent > 75 ? 'warning' : 'info',
      message: `${resource.toUpperCase()} is being throttled (${percent.toFixed(0)}% of limit).`,
      suggestion: 'Consider upgrading your plan for more resources.',
      timestamp: new Date(),
      metrics: { throttlePercent: percent },
    });
  }
  
  async notifyOomKill(sandboxId: string, processName: string): Promise<void> {
    await this.notify({
      sandboxId,
      type: 'oom_kill',
      severity: 'critical',
      message: `Process "${processName}" was killed due to out of memory.`,
      suggestion: 'Consider upgrading your plan for more memory.',
      action: 'The process will be automatically restarted if possible.',
      timestamp: new Date(),
    });
  }
  
  async notifyRecovery(sandboxId: string, action: string, success: boolean): Promise<void> {
    await this.notify({
      sandboxId,
      type: success ? 'recovery_complete' : 'recovery_failed',
      severity: success ? 'info' : 'warning',
      message: success 
        ? `Recovery action "${action}" completed successfully.`
        : `Recovery action "${action}" failed.`,
      timestamp: new Date(),
    });
  }
  
  private async storeNotification(notification: ResourceNotification): Promise<void> {
    // Store in database
  }
}

export const userNotificationService = new UserNotificationService();
```

---

## Best Practices

### 1. Use Graceful Degradation Where Possible

```typescript
// Prefer throttling over killing
const enforcementStrategy = {
  cpu: 'graceful',      // Throttle, don't kill
  memory: 'hard',       // Must use hard limits (no alternative)
  io: 'graceful',       // Throttle I/O
  network: 'graceful',  // Shape traffic, then drop
  storage: 'hard',      // Block writes when full
};
```

### 2. Provide Early Warnings

```typescript
// Warn users before hitting limits
const warningThresholds = {
  cpu: 70,       // Warn at 70% usage
  memory: 70,    // Warn at 70% usage
  storage: 80,   // Warn at 80% usage
  processes: 80, // Warn at 80% of limit
};
```

### 3. Implement Automatic Recovery

```typescript
// Always try to recover automatically
const recoveryPriority = [
  'clear_cache',        // Low impact
  'kill_zombie',        // Low impact
  'restart_process',    // Medium impact
  'restart_sandbox',    // High impact (last resort)
];
```

### 4. Monitor and Alert

```typescript
// Set up comprehensive monitoring
const monitoringConfig = {
  scrapeInterval: '15s',
  alertEvaluationInterval: '30s',
  retentionPeriod: '30d',
};
```

### 5. Communicate with Users

```typescript
// Keep users informed
const notificationPolicy = {
  throttling: 'immediate',     // Notify immediately
  warning: 'immediate',        // Notify immediately
  recovery: 'on_complete',     // Notify when done
  oomKill: 'immediate',        // Notify immediately
};
```

---

## Summary

### Resource Exhaustion Response

| Resource | Soft Limit | Hard Limit | Recovery |
|----------|------------|------------|----------|
| **CPU** | Throttle | Hard throttle | Automatic |
| **Memory** | Reclaim | OOM kill | Restart process |
| **Disk I/O** | Throttle | Block I/O | Automatic |
| **Network** | Shape | Drop packets | Automatic |
| **Storage** | Warning | Block writes | Manual cleanup |
| **Processes** | Warning | Reject fork | Automatic |

### Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU throttle % | >30% | >70% |
| Memory usage % | >70% | >95% |
| Memory pressure (full) | >10% | >50% |
| OOM kills | >0 | >3 |
| I/O throttle events | >10/min | >100/min |
| Network drops | >10/sec | >100/sec |
| Storage usage % | >80% | >95% |
