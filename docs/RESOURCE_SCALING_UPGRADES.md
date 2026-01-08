# Resource Scaling and Upgrades

This guide provides comprehensive coverage of resource scaling capabilities, premium tier allocation, dynamic resource scaling, and upgrade workflows for sandbox environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Tier Architecture](#tier-architecture)
3. [Premium Tier Resource Allocation](#premium-tier-resource-allocation)
4. [Dynamic Resource Scaling](#dynamic-resource-scaling)
5. [Vertical Scaling](#vertical-scaling)
6. [Horizontal Scaling](#horizontal-scaling)
7. [Upgrade Workflows](#upgrade-workflows)
8. [Downgrade Handling](#downgrade-handling)
9. [Resource Reservation](#resource-reservation)
10. [Billing Integration](#billing-integration)
11. [API Reference](#api-reference)
12. [Best Practices](#best-practices)

---

## Overview

Resource scaling allows users to upgrade their sandbox resources based on their needs. The platform supports both tier-based upgrades (predefined resource bundles) and dynamic scaling (on-demand resource adjustment).

### Scaling Options

| Scaling Type | Description | Use Case |
|--------------|-------------|----------|
| **Tier Upgrade** | Move to higher predefined tier | Permanent resource increase |
| **Dynamic Scaling** | Adjust resources on-demand | Temporary burst capacity |
| **Vertical Scaling** | Increase single sandbox resources | More CPU/memory per sandbox |
| **Horizontal Scaling** | Add more sandbox instances | Parallel workloads |

---

## Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TIER ARCHITECTURE                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           ENTERPRISE TIER                                        │   │
│  │  • 4+ CPU cores, 8+ GB RAM, 100+ GB storage                                     │   │
│  │  • Custom resource allocation                                                    │   │
│  │  • Dedicated nodes (optional)                                                    │   │
│  │  • SLA guarantees                                                                │   │
│  │  • Priority support                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          ▲                                              │
│                                          │ Upgrade                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              PRO TIER                                            │   │
│  │  • 2 CPU cores, 4 GB RAM, 20 GB storage                                         │   │
│  │  • CPU burst capability                                                          │   │
│  │  • Higher I/O limits                                                             │   │
│  │  • Extended session duration                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          ▲                                              │
│                                          │ Upgrade                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           STANDARD TIER                                          │   │
│  │  • 1 CPU core, 2 GB RAM, 5 GB storage                                           │   │
│  │  • Standard I/O limits                                                           │   │
│  │  • Standard network bandwidth                                                    │   │
│  │  • Email support                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          ▲                                              │
│                                          │ Upgrade                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                             FREE TIER                                            │   │
│  │  • 0.5 CPU cores, 512 MB RAM, 1 GB storage                                      │   │
│  │  • Limited session duration                                                      │   │
│  │  • Basic I/O limits                                                              │   │
│  │  • Community support                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tier Configuration

```typescript
// src/config/tiers.ts

interface TierConfig {
  id: string;
  name: string;
  description: string;
  resources: ResourceLimits;
  features: TierFeatures;
  pricing: TierPricing;
  quotas: TierQuotas;
}

interface ResourceLimits {
  cpu: {
    cores: number;
    burstCores: number;
    burstDurationSeconds: number;
  };
  memory: {
    limitGb: number;
    swapGb: number;
  };
  storage: {
    ephemeralGb: number;
    persistentGb: number;
  };
  network: {
    egressMbps: number;
    ingressMbps: number;
  };
  io: {
    readMbps: number;
    writeMbps: number;
    iops: number;
  };
}

interface TierFeatures {
  gpuAccess: boolean;
  customDomains: boolean;
  sshAccess: boolean;
  persistentStorage: boolean;
  teamCollaboration: boolean;
  prioritySupport: boolean;
  slaGuarantee: boolean;
  dedicatedNodes: boolean;
}

interface TierPricing {
  monthlyUsd: number;
  hourlyUsd: number;
  overagePerCpuHour: number;
  overagePerGbHour: number;
}

interface TierQuotas {
  maxSandboxes: number;
  maxConcurrentSandboxes: number;
  maxSessionHours: number;
  maxStorageGb: number;
}

const tiers: Record<string, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For personal projects and learning',
    resources: {
      cpu: { cores: 0.5, burstCores: 0, burstDurationSeconds: 0 },
      memory: { limitGb: 0.5, swapGb: 0 },
      storage: { ephemeralGb: 1, persistentGb: 0 },
      network: { egressMbps: 10, ingressMbps: 50 },
      io: { readMbps: 50, writeMbps: 25, iops: 500 },
    },
    features: {
      gpuAccess: false,
      customDomains: false,
      sshAccess: false,
      persistentStorage: false,
      teamCollaboration: false,
      prioritySupport: false,
      slaGuarantee: false,
      dedicatedNodes: false,
    },
    pricing: {
      monthlyUsd: 0,
      hourlyUsd: 0,
      overagePerCpuHour: 0,
      overagePerGbHour: 0,
    },
    quotas: {
      maxSandboxes: 3,
      maxConcurrentSandboxes: 1,
      maxSessionHours: 50,
      maxStorageGb: 1,
    },
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'For professional developers',
    resources: {
      cpu: { cores: 1, burstCores: 1.5, burstDurationSeconds: 30 },
      memory: { limitGb: 2, swapGb: 0 },
      storage: { ephemeralGb: 5, persistentGb: 5 },
      network: { egressMbps: 50, ingressMbps: 100 },
      io: { readMbps: 100, writeMbps: 50, iops: 1000 },
    },
    features: {
      gpuAccess: false,
      customDomains: true,
      sshAccess: true,
      persistentStorage: true,
      teamCollaboration: false,
      prioritySupport: false,
      slaGuarantee: false,
      dedicatedNodes: false,
    },
    pricing: {
      monthlyUsd: 20,
      hourlyUsd: 0.05,
      overagePerCpuHour: 0.02,
      overagePerGbHour: 0.01,
    },
    quotas: {
      maxSandboxes: 10,
      maxConcurrentSandboxes: 3,
      maxSessionHours: 200,
      maxStorageGb: 20,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For teams and power users',
    resources: {
      cpu: { cores: 2, burstCores: 3, burstDurationSeconds: 60 },
      memory: { limitGb: 4, swapGb: 0 },
      storage: { ephemeralGb: 20, persistentGb: 50 },
      network: { egressMbps: 100, ingressMbps: 500 },
      io: { readMbps: 200, writeMbps: 100, iops: 2000 },
    },
    features: {
      gpuAccess: true,
      customDomains: true,
      sshAccess: true,
      persistentStorage: true,
      teamCollaboration: true,
      prioritySupport: true,
      slaGuarantee: false,
      dedicatedNodes: false,
    },
    pricing: {
      monthlyUsd: 50,
      hourlyUsd: 0.10,
      overagePerCpuHour: 0.03,
      overagePerGbHour: 0.015,
    },
    quotas: {
      maxSandboxes: 50,
      maxConcurrentSandboxes: 10,
      maxSessionHours: 500,
      maxStorageGb: 100,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations with custom needs',
    resources: {
      cpu: { cores: 4, burstCores: 8, burstDurationSeconds: 120 },
      memory: { limitGb: 8, swapGb: 0 },
      storage: { ephemeralGb: 100, persistentGb: 500 },
      network: { egressMbps: 1000, ingressMbps: 1000 },
      io: { readMbps: 500, writeMbps: 250, iops: 5000 },
    },
    features: {
      gpuAccess: true,
      customDomains: true,
      sshAccess: true,
      persistentStorage: true,
      teamCollaboration: true,
      prioritySupport: true,
      slaGuarantee: true,
      dedicatedNodes: true,
    },
    pricing: {
      monthlyUsd: 200,  // Starting price, custom pricing available
      hourlyUsd: 0.25,
      overagePerCpuHour: 0.05,
      overagePerGbHour: 0.02,
    },
    quotas: {
      maxSandboxes: -1,  // Unlimited
      maxConcurrentSandboxes: 50,
      maxSessionHours: -1,  // Unlimited
      maxStorageGb: 1000,
    },
  },
};

export function getTier(tierId: string): TierConfig {
  return tiers[tierId] || tiers.free;
}

export function getAllTiers(): TierConfig[] {
  return Object.values(tiers);
}
```

---

## Premium Tier Resource Allocation

### Resource Allocation by Tier

| Resource | Free | Standard | Pro | Enterprise |
|----------|------|----------|-----|------------|
| **CPU Cores** | 0.5 | 1 | 2 | 4+ |
| **CPU Burst** | None | 1.5 (30s) | 3 (60s) | 8 (120s) |
| **Memory** | 512 MB | 2 GB | 4 GB | 8+ GB |
| **Ephemeral Storage** | 1 GB | 5 GB | 20 GB | 100+ GB |
| **Persistent Storage** | None | 5 GB | 50 GB | 500+ GB |
| **Network Egress** | 10 Mbps | 50 Mbps | 100 Mbps | 1 Gbps |
| **Network Ingress** | 50 Mbps | 100 Mbps | 500 Mbps | 1 Gbps |
| **Disk Read** | 50 MB/s | 100 MB/s | 200 MB/s | 500 MB/s |
| **Disk Write** | 25 MB/s | 50 MB/s | 100 MB/s | 250 MB/s |
| **IOPS** | 500 | 1000 | 2000 | 5000 |
| **Max Processes** | 50 | 100 | 200 | 500 |

### Premium Resource Allocator

```typescript
// src/services/premiumResourceAllocator.ts

interface AllocationRequest {
  userId: string;
  sandboxId: string;
  tier: string;
  customResources?: Partial<ResourceLimits>;
}

interface AllocationResult {
  success: boolean;
  resources: ResourceLimits;
  nodeId?: string;
  error?: string;
}

class PremiumResourceAllocator {
  async allocate(request: AllocationRequest): Promise<AllocationResult> {
    const tier = getTier(request.tier);
    
    // Check if user is eligible for tier
    const eligibility = await this.checkEligibility(request.userId, request.tier);
    if (!eligibility.eligible) {
      return {
        success: false,
        resources: tier.resources,
        error: eligibility.reason,
      };
    }
    
    // For enterprise tier, allow custom resources
    let resources = tier.resources;
    if (request.tier === 'enterprise' && request.customResources) {
      resources = this.mergeResources(tier.resources, request.customResources);
    }
    
    // Find suitable node
    const node = await this.findSuitableNode(resources, tier.features.dedicatedNodes);
    if (!node) {
      return {
        success: false,
        resources,
        error: 'No suitable node available',
      };
    }
    
    // Reserve resources on node
    await this.reserveResources(node.id, request.sandboxId, resources);
    
    // Apply resource limits
    await this.applyResourceLimits(request.sandboxId, resources);
    
    return {
      success: true,
      resources,
      nodeId: node.id,
    };
  }
  
  private async checkEligibility(userId: string, tier: string): Promise<{ eligible: boolean; reason?: string }> {
    // Check subscription status
    const subscription = await this.getSubscription(userId);
    
    if (!subscription) {
      return { eligible: tier === 'free', reason: 'No active subscription' };
    }
    
    if (subscription.tier !== tier && !this.canUpgrade(subscription.tier, tier)) {
      return { eligible: false, reason: 'Subscription does not include this tier' };
    }
    
    // Check quota limits
    const usage = await this.getUsage(userId);
    const tierConfig = getTier(tier);
    
    if (tierConfig.quotas.maxConcurrentSandboxes !== -1 && 
        usage.concurrentSandboxes >= tierConfig.quotas.maxConcurrentSandboxes) {
      return { eligible: false, reason: 'Maximum concurrent sandboxes reached' };
    }
    
    return { eligible: true };
  }
  
  private async findSuitableNode(resources: ResourceLimits, dedicated: boolean): Promise<{ id: string } | null> {
    // Query available nodes
    // For dedicated nodes, find nodes reserved for enterprise
    // For shared nodes, find nodes with sufficient capacity
    return { id: 'node-1' };
  }
  
  private async reserveResources(nodeId: string, sandboxId: string, resources: ResourceLimits): Promise<void> {
    // Reserve resources in node capacity tracker
  }
  
  private async applyResourceLimits(sandboxId: string, resources: ResourceLimits): Promise<void> {
    // Apply cgroups limits
    await this.applyCpuLimits(sandboxId, resources.cpu);
    await this.applyMemoryLimits(sandboxId, resources.memory);
    await this.applyIoLimits(sandboxId, resources.io);
    await this.applyNetworkLimits(sandboxId, resources.network);
  }
  
  private mergeResources(base: ResourceLimits, custom: Partial<ResourceLimits>): ResourceLimits {
    return {
      cpu: { ...base.cpu, ...custom.cpu },
      memory: { ...base.memory, ...custom.memory },
      storage: { ...base.storage, ...custom.storage },
      network: { ...base.network, ...custom.network },
      io: { ...base.io, ...custom.io },
    };
  }
  
  private canUpgrade(currentTier: string, targetTier: string): boolean {
    const tierOrder = ['free', 'standard', 'pro', 'enterprise'];
    return tierOrder.indexOf(targetTier) > tierOrder.indexOf(currentTier);
  }
  
  private async getSubscription(userId: string): Promise<any> {
    // Get user subscription from database
    return null;
  }
  
  private async getUsage(userId: string): Promise<any> {
    // Get current usage from database
    return { concurrentSandboxes: 0 };
  }
  
  private async applyCpuLimits(sandboxId: string, cpu: any): Promise<void> {}
  private async applyMemoryLimits(sandboxId: string, memory: any): Promise<void> {}
  private async applyIoLimits(sandboxId: string, io: any): Promise<void> {}
  private async applyNetworkLimits(sandboxId: string, network: any): Promise<void> {}
}

export const premiumResourceAllocator = new PremiumResourceAllocator();
```

---

## Dynamic Resource Scaling

### Dynamic Scaling Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           DYNAMIC RESOURCE SCALING                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         METRICS COLLECTION                                       │   │
│  │                                                                                   │   │
│  │  CPU Usage ──────┐                                                               │   │
│  │  Memory Usage ───┼──► Metrics Aggregator ──► Scaling Decision Engine           │   │
│  │  I/O Usage ──────┤                                                               │   │
│  │  Network Usage ──┘                                                               │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         SCALING DECISION ENGINE                                  │   │
│  │                                                                                   │   │
│  │  IF cpu_usage > 80% for 5 min AND tier.allowsBurst:                             │   │
│  │      scale_up(cpu, tier.burstCores)                                             │   │
│  │                                                                                   │   │
│  │  IF memory_usage > 90% AND tier.allowsOverage:                                  │   │
│  │      scale_up(memory, tier.maxOverageGb)                                        │   │
│  │                                                                                   │   │
│  │  IF usage < 30% for 15 min:                                                     │   │
│  │      scale_down(to_baseline)                                                    │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         RESOURCE ADJUSTMENT                                      │   │
│  │                                                                                   │   │
│  │  1. Update cgroups limits (live, no restart)                                    │   │
│  │  2. Update Kubernetes resource requests/limits                                  │   │
│  │  3. Record scaling event for billing                                            │   │
│  │  4. Notify user of scaling action                                               │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Dynamic Scaler Implementation

```typescript
// src/services/dynamicScaler.ts

interface ScalingPolicy {
  resource: 'cpu' | 'memory' | 'io' | 'network';
  scaleUpThreshold: number;      // Percentage
  scaleDownThreshold: number;    // Percentage
  scaleUpCooldown: number;       // Seconds
  scaleDownCooldown: number;     // Seconds
  evaluationPeriod: number;      // Seconds
  minValue: number;
  maxValue: number;
  stepSize: number;
}

interface ScalingEvent {
  sandboxId: string;
  resource: string;
  direction: 'up' | 'down';
  oldValue: number;
  newValue: number;
  reason: string;
  timestamp: Date;
}

class DynamicScaler {
  private policies: Map<string, ScalingPolicy[]> = new Map();
  private lastScaleTime: Map<string, Map<string, Date>> = new Map();
  private scalingEvents: ScalingEvent[] = [];
  
  async evaluateScaling(sandboxId: string): Promise<void> {
    const tier = await this.getSandboxTier(sandboxId);
    const policies = this.getPoliciesForTier(tier);
    
    for (const policy of policies) {
      const metrics = await this.getMetrics(sandboxId, policy.resource, policy.evaluationPeriod);
      const avgUsage = this.calculateAverage(metrics);
      
      if (avgUsage > policy.scaleUpThreshold) {
        await this.scaleUp(sandboxId, policy, avgUsage);
      } else if (avgUsage < policy.scaleDownThreshold) {
        await this.scaleDown(sandboxId, policy, avgUsage);
      }
    }
  }
  
  private async scaleUp(sandboxId: string, policy: ScalingPolicy, currentUsage: number): Promise<void> {
    // Check cooldown
    if (!this.canScale(sandboxId, policy.resource, 'up', policy.scaleUpCooldown)) {
      return;
    }
    
    const currentValue = await this.getCurrentValue(sandboxId, policy.resource);
    const newValue = Math.min(currentValue + policy.stepSize, policy.maxValue);
    
    if (newValue === currentValue) {
      // Already at max
      return;
    }
    
    // Apply new limit
    await this.applyResourceLimit(sandboxId, policy.resource, newValue);
    
    // Record event
    const event: ScalingEvent = {
      sandboxId,
      resource: policy.resource,
      direction: 'up',
      oldValue: currentValue,
      newValue,
      reason: `Usage at ${currentUsage.toFixed(1)}% exceeded threshold ${policy.scaleUpThreshold}%`,
      timestamp: new Date(),
    };
    this.scalingEvents.push(event);
    
    // Update last scale time
    this.updateLastScaleTime(sandboxId, policy.resource);
    
    // Notify user
    await this.notifyUser(sandboxId, event);
    
    // Record for billing
    await this.recordBillingEvent(sandboxId, event);
  }
  
  private async scaleDown(sandboxId: string, policy: ScalingPolicy, currentUsage: number): Promise<void> {
    // Check cooldown
    if (!this.canScale(sandboxId, policy.resource, 'down', policy.scaleDownCooldown)) {
      return;
    }
    
    const currentValue = await this.getCurrentValue(sandboxId, policy.resource);
    const newValue = Math.max(currentValue - policy.stepSize, policy.minValue);
    
    if (newValue === currentValue) {
      // Already at min
      return;
    }
    
    // Apply new limit
    await this.applyResourceLimit(sandboxId, policy.resource, newValue);
    
    // Record event
    const event: ScalingEvent = {
      sandboxId,
      resource: policy.resource,
      direction: 'down',
      oldValue: currentValue,
      newValue,
      reason: `Usage at ${currentUsage.toFixed(1)}% below threshold ${policy.scaleDownThreshold}%`,
      timestamp: new Date(),
    };
    this.scalingEvents.push(event);
    
    // Update last scale time
    this.updateLastScaleTime(sandboxId, policy.resource);
  }
  
  private canScale(sandboxId: string, resource: string, direction: string, cooldown: number): boolean {
    const sandboxScales = this.lastScaleTime.get(sandboxId);
    if (!sandboxScales) return true;
    
    const lastScale = sandboxScales.get(`${resource}_${direction}`);
    if (!lastScale) return true;
    
    const elapsed = (Date.now() - lastScale.getTime()) / 1000;
    return elapsed >= cooldown;
  }
  
  private updateLastScaleTime(sandboxId: string, resource: string): void {
    if (!this.lastScaleTime.has(sandboxId)) {
      this.lastScaleTime.set(sandboxId, new Map());
    }
    this.lastScaleTime.get(sandboxId)!.set(resource, new Date());
  }
  
  private getPoliciesForTier(tier: string): ScalingPolicy[] {
    // Define policies based on tier
    const basePolicies: ScalingPolicy[] = [
      {
        resource: 'cpu',
        scaleUpThreshold: 80,
        scaleDownThreshold: 30,
        scaleUpCooldown: 60,
        scaleDownCooldown: 300,
        evaluationPeriod: 60,
        minValue: 0.5,
        maxValue: 2,
        stepSize: 0.5,
      },
      {
        resource: 'memory',
        scaleUpThreshold: 85,
        scaleDownThreshold: 40,
        scaleUpCooldown: 120,
        scaleDownCooldown: 600,
        evaluationPeriod: 120,
        minValue: 512,
        maxValue: 4096,
        stepSize: 512,
      },
    ];
    
    // Adjust based on tier
    if (tier === 'pro' || tier === 'enterprise') {
      basePolicies[0].maxValue = 4;
      basePolicies[1].maxValue = 8192;
    }
    
    return basePolicies;
  }
  
  private async getMetrics(sandboxId: string, resource: string, period: number): Promise<number[]> {
    // Query Prometheus or metrics store
    return [];
  }
  
  private calculateAverage(metrics: number[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((a, b) => a + b, 0) / metrics.length;
  }
  
  private async getCurrentValue(sandboxId: string, resource: string): Promise<number> {
    // Get current resource limit
    return 0;
  }
  
  private async applyResourceLimit(sandboxId: string, resource: string, value: number): Promise<void> {
    // Apply via cgroups
  }
  
  private async notifyUser(sandboxId: string, event: ScalingEvent): Promise<void> {
    // Send WebSocket notification
  }
  
  private async recordBillingEvent(sandboxId: string, event: ScalingEvent): Promise<void> {
    // Record for billing purposes
  }
  
  private async getSandboxTier(sandboxId: string): Promise<string> {
    return 'standard';
  }
}

export const dynamicScaler = new DynamicScaler();
```

### Live Resource Adjustment (No Restart)

```typescript
// src/services/liveResourceAdjustment.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LiveResourceAdjustment {
  /**
   * Adjust CPU limit without restarting the container
   */
  async adjustCpuLimit(sandboxId: string, cpuCores: number): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    const quotaMicroseconds = cpuCores * 100000;  // 100ms period
    
    // Update cgroups v2 cpu.max
    await execAsync(`echo "${quotaMicroseconds} 100000" > ${cgroupPath}/cpu.max`);
    
    console.log(`[LiveAdjust] CPU limit for ${sandboxId} set to ${cpuCores} cores`);
  }
  
  /**
   * Adjust memory limit without restarting the container
   * Note: Can only increase, not decrease (to avoid OOM)
   */
  async adjustMemoryLimit(sandboxId: string, memoryBytes: number): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    // Get current limit
    const { stdout } = await execAsync(`cat ${cgroupPath}/memory.max`);
    const currentLimit = parseInt(stdout.trim(), 10);
    
    if (memoryBytes < currentLimit) {
      throw new Error('Cannot decrease memory limit on live container');
    }
    
    // Update memory limit
    await execAsync(`echo "${memoryBytes}" > ${cgroupPath}/memory.max`);
    
    // Also update high watermark (soft limit)
    const highLimit = Math.floor(memoryBytes * 0.9);
    await execAsync(`echo "${highLimit}" > ${cgroupPath}/memory.high`);
    
    console.log(`[LiveAdjust] Memory limit for ${sandboxId} set to ${memoryBytes} bytes`);
  }
  
  /**
   * Adjust I/O limits without restarting
   */
  async adjustIoLimits(
    sandboxId: string,
    deviceMajorMinor: string,
    readBps: number,
    writeBps: number
  ): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    await execAsync(
      `echo "${deviceMajorMinor} rbps=${readBps} wbps=${writeBps}" > ${cgroupPath}/io.max`
    );
    
    console.log(`[LiveAdjust] I/O limits for ${sandboxId} set to read=${readBps}, write=${writeBps}`);
  }
  
  /**
   * Adjust process limit without restarting
   */
  async adjustProcessLimit(sandboxId: string, maxProcesses: number): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/sandbox-${sandboxId}`;
    
    await execAsync(`echo "${maxProcesses}" > ${cgroupPath}/pids.max`);
    
    console.log(`[LiveAdjust] Process limit for ${sandboxId} set to ${maxProcesses}`);
  }
}

export const liveResourceAdjustment = new LiveResourceAdjustment();
```

---

## Vertical Scaling

### Vertical Scaling Process

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           VERTICAL SCALING PROCESS                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  STEP 1: REQUEST                                                                        │
│  ───────────────                                                                        │
│  User requests more resources (e.g., 2GB → 4GB RAM)                                    │
│                                                                                         │
│  STEP 2: VALIDATION                                                                     │
│  ─────────────────                                                                      │
│  • Check tier allows requested resources                                               │
│  • Check user has available quota                                                      │
│  • Check node has available capacity                                                   │
│                                                                                         │
│  STEP 3: DECISION                                                                       │
│  ───────────────                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Can scale in-place?                                                             │   │
│  │  ├── YES: Live adjustment (no downtime)                                         │   │
│  │  │   • Update cgroups limits                                                    │   │
│  │  │   • Update Kubernetes annotations                                            │   │
│  │  │                                                                               │   │
│  │  └── NO: Migration required                                                     │   │
│  │      • Find node with capacity                                                  │   │
│  │      • Checkpoint sandbox state                                                 │   │
│  │      • Migrate to new node                                                      │   │
│  │      • Restore sandbox state                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  STEP 4: APPLY                                                                          │
│  ────────────                                                                           │
│  • Apply new resource limits                                                           │
│  • Update billing records                                                              │
│  • Notify user of completion                                                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Vertical Scaler Implementation

```typescript
// src/services/verticalScaler.ts

interface VerticalScaleRequest {
  sandboxId: string;
  userId: string;
  targetResources: Partial<ResourceLimits>;
}

interface VerticalScaleResult {
  success: boolean;
  method: 'in_place' | 'migration';
  downtime: number;  // seconds
  newResources: ResourceLimits;
  error?: string;
}

class VerticalScaler {
  async scale(request: VerticalScaleRequest): Promise<VerticalScaleResult> {
    // Validate request
    const validation = await this.validateRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        method: 'in_place',
        downtime: 0,
        newResources: {} as ResourceLimits,
        error: validation.error,
      };
    }
    
    // Get current resources
    const currentResources = await this.getCurrentResources(request.sandboxId);
    const targetResources = this.mergeResources(currentResources, request.targetResources);
    
    // Determine scaling method
    const canScaleInPlace = await this.canScaleInPlace(request.sandboxId, targetResources);
    
    if (canScaleInPlace) {
      return await this.scaleInPlace(request.sandboxId, targetResources);
    } else {
      return await this.scaleWithMigration(request.sandboxId, targetResources);
    }
  }
  
  private async canScaleInPlace(sandboxId: string, targetResources: ResourceLimits): Promise<boolean> {
    // Check if current node has capacity
    const nodeId = await this.getNodeId(sandboxId);
    const nodeCapacity = await this.getNodeAvailableCapacity(nodeId);
    const currentResources = await this.getCurrentResources(sandboxId);
    
    // Calculate additional resources needed
    const additionalCpu = targetResources.cpu.cores - currentResources.cpu.cores;
    const additionalMemory = targetResources.memory.limitGb - currentResources.memory.limitGb;
    
    // Check if node can accommodate
    if (additionalCpu > nodeCapacity.cpu || additionalMemory > nodeCapacity.memory) {
      return false;
    }
    
    // Memory can only be increased in-place, not decreased
    if (targetResources.memory.limitGb < currentResources.memory.limitGb) {
      return false;
    }
    
    return true;
  }
  
  private async scaleInPlace(sandboxId: string, targetResources: ResourceLimits): Promise<VerticalScaleResult> {
    try {
      // Apply new limits live
      await liveResourceAdjustment.adjustCpuLimit(sandboxId, targetResources.cpu.cores);
      await liveResourceAdjustment.adjustMemoryLimit(
        sandboxId,
        targetResources.memory.limitGb * 1024 * 1024 * 1024
      );
      
      // Update Kubernetes pod annotations
      await this.updatePodAnnotations(sandboxId, targetResources);
      
      return {
        success: true,
        method: 'in_place',
        downtime: 0,
        newResources: targetResources,
      };
    } catch (error) {
      return {
        success: false,
        method: 'in_place',
        downtime: 0,
        newResources: targetResources,
        error: (error as Error).message,
      };
    }
  }
  
  private async scaleWithMigration(sandboxId: string, targetResources: ResourceLimits): Promise<VerticalScaleResult> {
    const startTime = Date.now();
    
    try {
      // Find suitable node
      const targetNode = await this.findNodeWithCapacity(targetResources);
      if (!targetNode) {
        return {
          success: false,
          method: 'migration',
          downtime: 0,
          newResources: targetResources,
          error: 'No node with sufficient capacity available',
        };
      }
      
      // Checkpoint sandbox state
      await this.checkpointSandbox(sandboxId);
      
      // Stop sandbox on current node
      await this.stopSandbox(sandboxId);
      
      // Migrate data to new node
      await this.migrateData(sandboxId, targetNode.id);
      
      // Start sandbox on new node with new resources
      await this.startSandbox(sandboxId, targetNode.id, targetResources);
      
      const downtime = (Date.now() - startTime) / 1000;
      
      return {
        success: true,
        method: 'migration',
        downtime,
        newResources: targetResources,
      };
    } catch (error) {
      // Attempt rollback
      await this.rollbackMigration(sandboxId);
      
      return {
        success: false,
        method: 'migration',
        downtime: (Date.now() - startTime) / 1000,
        newResources: targetResources,
        error: (error as Error).message,
      };
    }
  }
  
  private async validateRequest(request: VerticalScaleRequest): Promise<{ valid: boolean; error?: string }> {
    // Check tier limits
    const tier = await this.getUserTier(request.userId);
    const tierConfig = getTier(tier);
    
    if (request.targetResources.cpu && 
        request.targetResources.cpu.cores > tierConfig.resources.cpu.cores) {
      return { valid: false, error: `CPU limit exceeds tier maximum (${tierConfig.resources.cpu.cores} cores)` };
    }
    
    if (request.targetResources.memory && 
        request.targetResources.memory.limitGb > tierConfig.resources.memory.limitGb) {
      return { valid: false, error: `Memory limit exceeds tier maximum (${tierConfig.resources.memory.limitGb} GB)` };
    }
    
    return { valid: true };
  }
  
  private mergeResources(current: ResourceLimits, target: Partial<ResourceLimits>): ResourceLimits {
    return {
      cpu: { ...current.cpu, ...target.cpu },
      memory: { ...current.memory, ...target.memory },
      storage: { ...current.storage, ...target.storage },
      network: { ...current.network, ...target.network },
      io: { ...current.io, ...target.io },
    };
  }
  
  // Helper methods
  private async getCurrentResources(sandboxId: string): Promise<ResourceLimits> {
    return {} as ResourceLimits;
  }
  private async getNodeId(sandboxId: string): Promise<string> { return ''; }
  private async getNodeAvailableCapacity(nodeId: string): Promise<any> { return {}; }
  private async updatePodAnnotations(sandboxId: string, resources: ResourceLimits): Promise<void> {}
  private async findNodeWithCapacity(resources: ResourceLimits): Promise<any> { return null; }
  private async checkpointSandbox(sandboxId: string): Promise<void> {}
  private async stopSandbox(sandboxId: string): Promise<void> {}
  private async migrateData(sandboxId: string, nodeId: string): Promise<void> {}
  private async startSandbox(sandboxId: string, nodeId: string, resources: ResourceLimits): Promise<void> {}
  private async rollbackMigration(sandboxId: string): Promise<void> {}
  private async getUserTier(userId: string): Promise<string> { return 'standard'; }
}

export const verticalScaler = new VerticalScaler();
```

---

## Horizontal Scaling

### Horizontal Scaling for Parallel Workloads

```typescript
// src/services/horizontalScaler.ts

interface HorizontalScaleRequest {
  userId: string;
  templateId: string;
  instanceCount: number;
  resources: ResourceLimits;
  loadBalancing: 'round_robin' | 'least_connections' | 'ip_hash';
}

interface SandboxPool {
  id: string;
  userId: string;
  instances: SandboxInstance[];
  loadBalancer: LoadBalancerConfig;
  status: 'creating' | 'ready' | 'scaling' | 'terminating';
}

interface SandboxInstance {
  sandboxId: string;
  nodeId: string;
  status: 'pending' | 'running' | 'stopped' | 'failed';
  endpoint: string;
}

interface LoadBalancerConfig {
  strategy: 'round_robin' | 'least_connections' | 'ip_hash';
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
  };
}

class HorizontalScaler {
  private pools: Map<string, SandboxPool> = new Map();
  
  async createPool(request: HorizontalScaleRequest): Promise<SandboxPool> {
    const poolId = this.generatePoolId();
    
    const pool: SandboxPool = {
      id: poolId,
      userId: request.userId,
      instances: [],
      loadBalancer: {
        strategy: request.loadBalancing,
        healthCheck: {
          path: '/health',
          interval: 10,
          timeout: 5,
          unhealthyThreshold: 3,
        },
      },
      status: 'creating',
    };
    
    this.pools.set(poolId, pool);
    
    // Create instances in parallel
    const instancePromises = Array(request.instanceCount)
      .fill(null)
      .map(() => this.createInstance(pool, request.templateId, request.resources));
    
    const instances = await Promise.all(instancePromises);
    pool.instances = instances;
    pool.status = 'ready';
    
    // Configure load balancer
    await this.configureLoadBalancer(pool);
    
    return pool;
  }
  
  async scalePool(poolId: string, targetCount: number): Promise<void> {
    const pool = this.pools.get(poolId);
    if (!pool) throw new Error('Pool not found');
    
    pool.status = 'scaling';
    const currentCount = pool.instances.length;
    
    if (targetCount > currentCount) {
      // Scale up
      const newInstances = await Promise.all(
        Array(targetCount - currentCount)
          .fill(null)
          .map(() => this.createInstance(pool, '', {} as ResourceLimits))
      );
      pool.instances.push(...newInstances);
    } else if (targetCount < currentCount) {
      // Scale down
      const instancesToRemove = pool.instances.slice(targetCount);
      await Promise.all(
        instancesToRemove.map(instance => this.terminateInstance(instance))
      );
      pool.instances = pool.instances.slice(0, targetCount);
    }
    
    // Update load balancer
    await this.updateLoadBalancer(pool);
    pool.status = 'ready';
  }
  
  private async createInstance(
    pool: SandboxPool,
    templateId: string,
    resources: ResourceLimits
  ): Promise<SandboxInstance> {
    // Create sandbox via sandbox manager
    const sandboxId = this.generateSandboxId();
    
    // Find suitable node
    const nodeId = await this.findNode(resources);
    
    // Create sandbox
    await this.createSandbox(sandboxId, nodeId, templateId, resources);
    
    // Get endpoint
    const endpoint = await this.getEndpoint(sandboxId);
    
    return {
      sandboxId,
      nodeId,
      status: 'running',
      endpoint,
    };
  }
  
  private async terminateInstance(instance: SandboxInstance): Promise<void> {
    await this.terminateSandbox(instance.sandboxId);
    instance.status = 'stopped';
  }
  
  private async configureLoadBalancer(pool: SandboxPool): Promise<void> {
    // Configure Envoy or nginx for load balancing
    const upstreams = pool.instances.map(i => ({
      address: i.endpoint,
      weight: 1,
    }));
    
    // Generate Envoy cluster config
    const clusterConfig = {
      name: `pool-${pool.id}`,
      type: 'STRICT_DNS',
      lb_policy: this.mapLbPolicy(pool.loadBalancer.strategy),
      load_assignment: {
        cluster_name: `pool-${pool.id}`,
        endpoints: [{
          lb_endpoints: upstreams.map(u => ({
            endpoint: {
              address: {
                socket_address: {
                  address: u.address,
                  port_value: 3000,
                },
              },
            },
          })),
        }],
      },
      health_checks: [{
        timeout: `${pool.loadBalancer.healthCheck.timeout}s`,
        interval: `${pool.loadBalancer.healthCheck.interval}s`,
        unhealthy_threshold: pool.loadBalancer.healthCheck.unhealthyThreshold,
        healthy_threshold: 1,
        http_health_check: {
          path: pool.loadBalancer.healthCheck.path,
        },
      }],
    };
    
    // Apply via xDS
    await this.applyEnvoyConfig(clusterConfig);
  }
  
  private mapLbPolicy(strategy: string): string {
    switch (strategy) {
      case 'round_robin': return 'ROUND_ROBIN';
      case 'least_connections': return 'LEAST_REQUEST';
      case 'ip_hash': return 'RING_HASH';
      default: return 'ROUND_ROBIN';
    }
  }
  
  private async updateLoadBalancer(pool: SandboxPool): Promise<void> {
    await this.configureLoadBalancer(pool);
  }
  
  // Helper methods
  private generatePoolId(): string { return `pool-${Date.now()}`; }
  private generateSandboxId(): string { return `sandbox-${Date.now()}`; }
  private async findNode(resources: ResourceLimits): Promise<string> { return 'node-1'; }
  private async createSandbox(id: string, nodeId: string, templateId: string, resources: ResourceLimits): Promise<void> {}
  private async getEndpoint(sandboxId: string): Promise<string> { return ''; }
  private async terminateSandbox(sandboxId: string): Promise<void> {}
  private async applyEnvoyConfig(config: any): Promise<void> {}
}

export const horizontalScaler = new HorizontalScaler();
```

---

## Upgrade Workflows

### Tier Upgrade Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TIER UPGRADE WORKFLOW                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER                    PLATFORM                    BILLING                            │
│    │                        │                           │                               │
│    │  1. Request upgrade    │                           │                               │
│    │ ─────────────────────► │                           │                               │
│    │                        │                           │                               │
│    │                        │  2. Validate eligibility  │                               │
│    │                        │ ─────────────────────────►│                               │
│    │                        │                           │                               │
│    │                        │  3. Calculate proration   │                               │
│    │                        │ ◄─────────────────────────│                               │
│    │                        │                           │                               │
│    │  4. Confirm & pay      │                           │                               │
│    │ ◄───────────────────── │                           │                               │
│    │                        │                           │                               │
│    │  5. Payment confirmed  │                           │                               │
│    │ ─────────────────────► │                           │                               │
│    │                        │                           │                               │
│    │                        │  6. Process payment       │                               │
│    │                        │ ─────────────────────────►│                               │
│    │                        │                           │                               │
│    │                        │  7. Payment success       │                               │
│    │                        │ ◄─────────────────────────│                               │
│    │                        │                           │                               │
│    │                        │  8. Apply new tier        │                               │
│    │                        │ ────────────────────┐     │                               │
│    │                        │                     │     │                               │
│    │                        │ ◄───────────────────┘     │                               │
│    │                        │                           │                               │
│    │  9. Upgrade complete   │                           │                               │
│    │ ◄───────────────────── │                           │                               │
│    │                        │                           │                               │
│    │  10. New resources     │                           │                               │
│    │      available         │                           │                               │
│    │                        │                           │                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Upgrade Manager Implementation

```typescript
// src/services/upgradeManager.ts

interface UpgradeRequest {
  userId: string;
  currentTier: string;
  targetTier: string;
  paymentMethod: string;
}

interface UpgradeResult {
  success: boolean;
  newTier: string;
  effectiveDate: Date;
  prorationAmount: number;
  error?: string;
}

interface ProrationCalculation {
  daysRemaining: number;
  currentTierDailyRate: number;
  newTierDailyRate: number;
  creditAmount: number;
  chargeAmount: number;
  netAmount: number;
}

class UpgradeManager {
  async requestUpgrade(request: UpgradeRequest): Promise<UpgradeResult> {
    // Validate upgrade path
    const validation = this.validateUpgradePath(request.currentTier, request.targetTier);
    if (!validation.valid) {
      return {
        success: false,
        newTier: request.currentTier,
        effectiveDate: new Date(),
        prorationAmount: 0,
        error: validation.error,
      };
    }
    
    // Calculate proration
    const proration = await this.calculateProration(request.userId, request.currentTier, request.targetTier);
    
    // Process payment
    const paymentResult = await this.processPayment(request.userId, proration.netAmount, request.paymentMethod);
    if (!paymentResult.success) {
      return {
        success: false,
        newTier: request.currentTier,
        effectiveDate: new Date(),
        prorationAmount: proration.netAmount,
        error: paymentResult.error,
      };
    }
    
    // Apply tier upgrade
    await this.applyTierUpgrade(request.userId, request.targetTier);
    
    // Upgrade all active sandboxes
    await this.upgradeActiveSandboxes(request.userId, request.targetTier);
    
    // Send confirmation
    await this.sendUpgradeConfirmation(request.userId, request.targetTier);
    
    return {
      success: true,
      newTier: request.targetTier,
      effectiveDate: new Date(),
      prorationAmount: proration.netAmount,
    };
  }
  
  private validateUpgradePath(currentTier: string, targetTier: string): { valid: boolean; error?: string } {
    const tierOrder = ['free', 'standard', 'pro', 'enterprise'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(targetTier);
    
    if (targetIndex <= currentIndex) {
      return { valid: false, error: 'Can only upgrade to a higher tier' };
    }
    
    return { valid: true };
  }
  
  async calculateProration(userId: string, currentTier: string, targetTier: string): Promise<ProrationCalculation> {
    const subscription = await this.getSubscription(userId);
    const currentTierConfig = getTier(currentTier);
    const targetTierConfig = getTier(targetTier);
    
    // Calculate days remaining in billing cycle
    const billingCycleEnd = new Date(subscription.currentPeriodEnd);
    const now = new Date();
    const daysRemaining = Math.ceil((billingCycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate daily rates
    const currentTierDailyRate = currentTierConfig.pricing.monthlyUsd / 30;
    const newTierDailyRate = targetTierConfig.pricing.monthlyUsd / 30;
    
    // Calculate credit for unused time on current tier
    const creditAmount = currentTierDailyRate * daysRemaining;
    
    // Calculate charge for remaining time on new tier
    const chargeAmount = newTierDailyRate * daysRemaining;
    
    // Net amount to charge
    const netAmount = chargeAmount - creditAmount;
    
    return {
      daysRemaining,
      currentTierDailyRate,
      newTierDailyRate,
      creditAmount,
      chargeAmount,
      netAmount: Math.max(0, netAmount),  // Never negative
    };
  }
  
  private async processPayment(userId: string, amount: number, paymentMethod: string): Promise<{ success: boolean; error?: string }> {
    // Process via Stripe or other payment provider
    return { success: true };
  }
  
  private async applyTierUpgrade(userId: string, newTier: string): Promise<void> {
    // Update user's subscription in database
    await this.updateSubscription(userId, newTier);
    
    // Update quotas
    await this.updateQuotas(userId, newTier);
  }
  
  private async upgradeActiveSandboxes(userId: string, newTier: string): Promise<void> {
    const sandboxes = await this.getUserSandboxes(userId);
    const tierConfig = getTier(newTier);
    
    for (const sandbox of sandboxes) {
      if (sandbox.status === 'running') {
        // Apply new resource limits
        await premiumResourceAllocator.allocate({
          userId,
          sandboxId: sandbox.id,
          tier: newTier,
        });
      }
    }
  }
  
  private async sendUpgradeConfirmation(userId: string, newTier: string): Promise<void> {
    // Send email and in-app notification
  }
  
  // Helper methods
  private async getSubscription(userId: string): Promise<any> { return {}; }
  private async updateSubscription(userId: string, tier: string): Promise<void> {}
  private async updateQuotas(userId: string, tier: string): Promise<void> {}
  private async getUserSandboxes(userId: string): Promise<any[]> { return []; }
}

export const upgradeManager = new UpgradeManager();
```

---

## Downgrade Handling

### Downgrade Considerations

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DOWNGRADE HANDLING                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CHALLENGES:                                                                            │
│  ───────────                                                                            │
│  1. User may be using more resources than new tier allows                              │
│  2. User may have more sandboxes than new tier allows                                  │
│  3. User may have features not available in new tier                                   │
│                                                                                         │
│  STRATEGIES:                                                                            │
│  ───────────                                                                            │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  GRACEFUL DOWNGRADE (Recommended)                                                │   │
│  │                                                                                   │   │
│  │  1. Notify user of impending downgrade                                          │   │
│  │  2. Show what will be affected                                                  │   │
│  │  3. Give grace period to reduce usage                                           │   │
│  │  4. Apply downgrade at end of billing cycle                                     │   │
│  │  5. Enforce new limits on running sandboxes                                     │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  IMMEDIATE DOWNGRADE (User requested)                                            │   │
│  │                                                                                   │   │
│  │  1. Stop sandboxes exceeding new tier limits                                    │   │
│  │  2. Reduce resources on running sandboxes                                       │   │
│  │  3. Disable features not in new tier                                            │   │
│  │  4. Credit remaining balance                                                    │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Downgrade Manager

```typescript
// src/services/downgradeManager.ts

interface DowngradeImpact {
  sandboxesToStop: string[];
  sandboxesToResize: Array<{ id: string; newResources: ResourceLimits }>;
  featuresToDisable: string[];
  storageToReclaim: number;  // GB
  creditAmount: number;
}

class DowngradeManager {
  async analyzeDowngradeImpact(userId: string, targetTier: string): Promise<DowngradeImpact> {
    const currentUsage = await this.getCurrentUsage(userId);
    const targetTierConfig = getTier(targetTier);
    
    const impact: DowngradeImpact = {
      sandboxesToStop: [],
      sandboxesToResize: [],
      featuresToDisable: [],
      storageToReclaim: 0,
      creditAmount: 0,
    };
    
    // Check sandbox count
    if (currentUsage.sandboxCount > targetTierConfig.quotas.maxSandboxes) {
      const excess = currentUsage.sandboxCount - targetTierConfig.quotas.maxSandboxes;
      // Identify sandboxes to stop (oldest first)
      impact.sandboxesToStop = currentUsage.sandboxes
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, excess)
        .map(s => s.id);
    }
    
    // Check resource usage per sandbox
    for (const sandbox of currentUsage.sandboxes) {
      if (!impact.sandboxesToStop.includes(sandbox.id)) {
        if (sandbox.resources.cpu.cores > targetTierConfig.resources.cpu.cores ||
            sandbox.resources.memory.limitGb > targetTierConfig.resources.memory.limitGb) {
          impact.sandboxesToResize.push({
            id: sandbox.id,
            newResources: targetTierConfig.resources,
          });
        }
      }
    }
    
    // Check features
    const currentTierConfig = getTier(currentUsage.tier);
    for (const [feature, enabled] of Object.entries(currentTierConfig.features)) {
      if (enabled && !targetTierConfig.features[feature as keyof TierFeatures]) {
        impact.featuresToDisable.push(feature);
      }
    }
    
    // Check storage
    if (currentUsage.storageUsedGb > targetTierConfig.quotas.maxStorageGb) {
      impact.storageToReclaim = currentUsage.storageUsedGb - targetTierConfig.quotas.maxStorageGb;
    }
    
    // Calculate credit
    impact.creditAmount = await this.calculateDowngradeCredit(userId, targetTier);
    
    return impact;
  }
  
  async executeDowngrade(userId: string, targetTier: string, immediate: boolean = false): Promise<void> {
    const impact = await this.analyzeDowngradeImpact(userId, targetTier);
    
    if (immediate) {
      await this.executeImmediateDowngrade(userId, targetTier, impact);
    } else {
      await this.scheduleGracefulDowngrade(userId, targetTier, impact);
    }
  }
  
  private async executeImmediateDowngrade(
    userId: string,
    targetTier: string,
    impact: DowngradeImpact
  ): Promise<void> {
    // Stop excess sandboxes
    for (const sandboxId of impact.sandboxesToStop) {
      await this.stopSandbox(sandboxId);
    }
    
    // Resize sandboxes
    for (const resize of impact.sandboxesToResize) {
      await verticalScaler.scale({
        sandboxId: resize.id,
        userId,
        targetResources: resize.newResources,
      });
    }
    
    // Disable features
    for (const feature of impact.featuresToDisable) {
      await this.disableFeature(userId, feature);
    }
    
    // Update tier
    await this.updateUserTier(userId, targetTier);
    
    // Process credit
    if (impact.creditAmount > 0) {
      await this.issueCredit(userId, impact.creditAmount);
    }
    
    // Notify user
    await this.notifyDowngradeComplete(userId, targetTier, impact);
  }
  
  private async scheduleGracefulDowngrade(
    userId: string,
    targetTier: string,
    impact: DowngradeImpact
  ): Promise<void> {
    // Get end of current billing cycle
    const subscription = await this.getSubscription(userId);
    const effectiveDate = new Date(subscription.currentPeriodEnd);
    
    // Schedule downgrade
    await this.scheduleDowngrade(userId, targetTier, effectiveDate);
    
    // Notify user of upcoming changes
    await this.notifyUpcomingDowngrade(userId, targetTier, impact, effectiveDate);
  }
  
  // Helper methods
  private async getCurrentUsage(userId: string): Promise<any> { return {}; }
  private async calculateDowngradeCredit(userId: string, targetTier: string): Promise<number> { return 0; }
  private async stopSandbox(sandboxId: string): Promise<void> {}
  private async disableFeature(userId: string, feature: string): Promise<void> {}
  private async updateUserTier(userId: string, tier: string): Promise<void> {}
  private async issueCredit(userId: string, amount: number): Promise<void> {}
  private async notifyDowngradeComplete(userId: string, tier: string, impact: DowngradeImpact): Promise<void> {}
  private async getSubscription(userId: string): Promise<any> { return {}; }
  private async scheduleDowngrade(userId: string, tier: string, date: Date): Promise<void> {}
  private async notifyUpcomingDowngrade(userId: string, tier: string, impact: DowngradeImpact, date: Date): Promise<void> {}
}

export const downgradeManager = new DowngradeManager();
```

---

## Resource Reservation

### Guaranteed vs Best-Effort Resources

```typescript
// src/services/resourceReservation.ts

interface ResourceReservation {
  sandboxId: string;
  guaranteed: ResourceLimits;  // Always available
  burstable: ResourceLimits;   // Available when capacity exists
  priority: number;            // Higher = more priority for burst
}

class ResourceReservationManager {
  private reservations: Map<string, ResourceReservation> = new Map();
  
  async createReservation(
    sandboxId: string,
    tier: string,
    nodeId: string
  ): Promise<ResourceReservation> {
    const tierConfig = getTier(tier);
    
    const reservation: ResourceReservation = {
      sandboxId,
      guaranteed: {
        cpu: { cores: tierConfig.resources.cpu.cores, burstCores: 0, burstDurationSeconds: 0 },
        memory: { limitGb: tierConfig.resources.memory.limitGb, swapGb: 0 },
        storage: tierConfig.resources.storage,
        network: tierConfig.resources.network,
        io: tierConfig.resources.io,
      },
      burstable: {
        cpu: { 
          cores: tierConfig.resources.cpu.burstCores - tierConfig.resources.cpu.cores,
          burstCores: 0,
          burstDurationSeconds: tierConfig.resources.cpu.burstDurationSeconds,
        },
        memory: { limitGb: 0, swapGb: 0 },  // Memory is not burstable
        storage: { ephemeralGb: 0, persistentGb: 0 },
        network: { egressMbps: 0, ingressMbps: 0 },
        io: { readMbps: 0, writeMbps: 0, iops: 0 },
      },
      priority: this.getTierPriority(tier),
    };
    
    // Reserve guaranteed resources on node
    await this.reserveOnNode(nodeId, reservation.guaranteed);
    
    this.reservations.set(sandboxId, reservation);
    
    return reservation;
  }
  
  async requestBurst(sandboxId: string, resource: 'cpu' | 'memory'): Promise<boolean> {
    const reservation = this.reservations.get(sandboxId);
    if (!reservation) return false;
    
    const nodeId = await this.getNodeId(sandboxId);
    const availableCapacity = await this.getNodeAvailableCapacity(nodeId);
    
    // Check if burst is available
    if (resource === 'cpu') {
      const requestedBurst = reservation.burstable.cpu.cores;
      if (availableCapacity.cpu >= requestedBurst) {
        // Grant burst
        await this.grantBurst(sandboxId, resource, requestedBurst);
        return true;
      }
    }
    
    return false;
  }
  
  private getTierPriority(tier: string): number {
    const priorities: Record<string, number> = {
      enterprise: 100,
      pro: 75,
      standard: 50,
      free: 25,
    };
    return priorities[tier] || 25;
  }
  
  private async reserveOnNode(nodeId: string, resources: ResourceLimits): Promise<void> {
    // Update node capacity tracker
  }
  
  private async getNodeId(sandboxId: string): Promise<string> { return ''; }
  private async getNodeAvailableCapacity(nodeId: string): Promise<any> { return {}; }
  private async grantBurst(sandboxId: string, resource: string, amount: number): Promise<void> {}
}

export const resourceReservationManager = new ResourceReservationManager();
```

---

## Billing Integration

### Usage Tracking for Billing

```typescript
// src/services/billingIntegration.ts

interface UsageRecord {
  sandboxId: string;
  userId: string;
  tier: string;
  resource: 'cpu' | 'memory' | 'storage' | 'network' | 'gpu';
  quantity: number;
  unit: string;
  startTime: Date;
  endTime: Date;
  cost: number;
}

class BillingIntegration {
  private usageRecords: UsageRecord[] = [];
  
  async recordUsage(
    sandboxId: string,
    resource: string,
    quantity: number,
    unit: string,
    duration: number  // seconds
  ): Promise<void> {
    const sandbox = await this.getSandbox(sandboxId);
    const tier = getTier(sandbox.tier);
    
    // Calculate cost
    const cost = this.calculateCost(resource, quantity, duration, tier);
    
    const record: UsageRecord = {
      sandboxId,
      userId: sandbox.userId,
      tier: sandbox.tier,
      resource: resource as any,
      quantity,
      unit,
      startTime: new Date(Date.now() - duration * 1000),
      endTime: new Date(),
      cost,
    };
    
    this.usageRecords.push(record);
    
    // Send to billing system
    await this.sendToBillingSystem(record);
  }
  
  async recordScalingEvent(event: ScalingEvent): Promise<void> {
    // Record the scaling event for billing
    const sandbox = await this.getSandbox(event.sandboxId);
    
    if (event.direction === 'up') {
      // Additional resources = additional cost
      const additionalQuantity = event.newValue - event.oldValue;
      await this.recordUsage(
        event.sandboxId,
        event.resource,
        additionalQuantity,
        this.getUnit(event.resource),
        0  // Will be calculated based on duration
      );
    }
  }
  
  async generateInvoice(userId: string, periodStart: Date, periodEnd: Date): Promise<Invoice> {
    const records = this.usageRecords.filter(
      r => r.userId === userId &&
           r.startTime >= periodStart &&
           r.endTime <= periodEnd
    );
    
    // Group by resource
    const byResource = this.groupByResource(records);
    
    // Calculate totals
    const lineItems = Object.entries(byResource).map(([resource, recs]) => ({
      description: `${resource} usage`,
      quantity: recs.reduce((sum, r) => sum + r.quantity, 0),
      unit: recs[0]?.unit || '',
      unitPrice: this.getUnitPrice(resource),
      total: recs.reduce((sum, r) => sum + r.cost, 0),
    }));
    
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.1;  // 10% tax
    const total = subtotal + tax;
    
    return {
      userId,
      periodStart,
      periodEnd,
      lineItems,
      subtotal,
      tax,
      total,
      status: 'pending',
    };
  }
  
  private calculateCost(resource: string, quantity: number, duration: number, tier: TierConfig): number {
    const hours = duration / 3600;
    
    switch (resource) {
      case 'cpu':
        return quantity * hours * tier.pricing.overagePerCpuHour;
      case 'memory':
        return quantity * hours * tier.pricing.overagePerGbHour;
      default:
        return 0;
    }
  }
  
  private getUnit(resource: string): string {
    switch (resource) {
      case 'cpu': return 'core-hours';
      case 'memory': return 'GB-hours';
      case 'storage': return 'GB-months';
      case 'network': return 'GB';
      default: return 'units';
    }
  }
  
  private getUnitPrice(resource: string): number {
    // Return unit price for resource
    return 0;
  }
  
  private groupByResource(records: UsageRecord[]): Record<string, UsageRecord[]> {
    return records.reduce((acc, record) => {
      if (!acc[record.resource]) acc[record.resource] = [];
      acc[record.resource].push(record);
      return acc;
    }, {} as Record<string, UsageRecord[]>);
  }
  
  private async getSandbox(sandboxId: string): Promise<any> { return {}; }
  private async sendToBillingSystem(record: UsageRecord): Promise<void> {}
}

interface Invoice {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'overdue';
}

export const billingIntegration = new BillingIntegration();
```

---

## API Reference

### REST API Endpoints

```yaml
# openapi.yaml (partial)
paths:
  /api/v1/sandboxes/{sandboxId}/scale:
    post:
      summary: Scale sandbox resources
      parameters:
        - name: sandboxId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                cpu:
                  type: number
                  description: CPU cores
                memory:
                  type: number
                  description: Memory in GB
      responses:
        '200':
          description: Scaling successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScaleResult'
        '400':
          description: Invalid request
        '402':
          description: Payment required
        '403':
          description: Tier limit exceeded

  /api/v1/users/{userId}/tier:
    put:
      summary: Upgrade or downgrade user tier
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                targetTier:
                  type: string
                  enum: [free, standard, pro, enterprise]
                immediate:
                  type: boolean
                  default: false
      responses:
        '200':
          description: Tier change successful
        '400':
          description: Invalid tier transition
        '402':
          description: Payment required

  /api/v1/users/{userId}/usage:
    get:
      summary: Get user resource usage
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
        - name: period
          in: query
          schema:
            type: string
            enum: [day, week, month]
      responses:
        '200':
          description: Usage data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UsageReport'
```

---

## Best Practices

### 1. Start with Appropriate Tier

```typescript
// Recommend tier based on usage patterns
function recommendTier(usage: UsagePattern): string {
  if (usage.avgCpuCores > 2 || usage.avgMemoryGb > 4) {
    return 'enterprise';
  }
  if (usage.avgCpuCores > 1 || usage.avgMemoryGb > 2) {
    return 'pro';
  }
  if (usage.avgCpuCores > 0.5 || usage.avgMemoryGb > 0.5) {
    return 'standard';
  }
  return 'free';
}
```

### 2. Monitor Usage Before Scaling

```typescript
// Check if scaling is actually needed
async function shouldScale(sandboxId: string): Promise<boolean> {
  const metrics = await getMetrics(sandboxId, '1h');
  
  // Only scale if consistently high usage
  const avgCpu = average(metrics.cpu);
  const p95Cpu = percentile(metrics.cpu, 95);
  
  return avgCpu > 70 && p95Cpu > 85;
}
```

### 3. Use Burst Capacity Wisely

```typescript
// Burst for short spikes, upgrade for sustained load
function scaleStrategy(usage: UsagePattern): 'burst' | 'upgrade' {
  if (usage.spikeDuration < 300 && usage.spikeFrequency < 10) {
    return 'burst';  // Short, infrequent spikes
  }
  return 'upgrade';  // Sustained high usage
}
```

### 4. Plan for Downgrade Impact

```typescript
// Always analyze impact before downgrade
async function safeDowngrade(userId: string, targetTier: string): Promise<void> {
  const impact = await downgradeManager.analyzeDowngradeImpact(userId, targetTier);
  
  if (impact.sandboxesToStop.length > 0) {
    // Warn user and get confirmation
    await notifyUser(userId, {
      type: 'downgrade_warning',
      message: `${impact.sandboxesToStop.length} sandboxes will be stopped`,
    });
  }
}
```

---

## Summary

### Scaling Options

| Type | Use Case | Downtime | Cost Impact |
|------|----------|----------|-------------|
| **Tier Upgrade** | Permanent increase | None | Monthly increase |
| **Dynamic Scaling** | Temporary burst | None | Usage-based |
| **Vertical Scaling** | More per sandbox | 0-60s | Per-resource |
| **Horizontal Scaling** | Parallel workloads | None | Per-instance |

### Resource Limits by Tier

| Tier | CPU | Memory | Storage | Price |
|------|-----|--------|---------|-------|
| Free | 0.5 | 512 MB | 1 GB | $0 |
| Standard | 1 | 2 GB | 5 GB | $20/mo |
| Pro | 2 | 4 GB | 20 GB | $50/mo |
| Enterprise | 4+ | 8+ GB | 100+ GB | Custom |

### Implementation Checklist

- [ ] Tier configuration defined
- [ ] Dynamic scaling policies configured
- [ ] Live resource adjustment implemented
- [ ] Vertical scaler with migration support
- [ ] Horizontal scaler with load balancing
- [ ] Upgrade workflow with proration
- [ ] Downgrade handling with impact analysis
- [ ] Billing integration for usage tracking
- [ ] API endpoints documented
- [ ] Monitoring and alerting configured
