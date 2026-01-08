# GPU Sharing and Memory Management: Multi-Tenant GPU Architecture

## Overview

GPU sharing across multiple users is one of the most critical infrastructure challenges in building a platform like SwissBrain. This guide covers GPU scheduling strategies, memory fragmentation solutions, isolation mechanisms, and complete implementation details for managing thousands of concurrent users on a limited number of GPUs.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GPU Sharing Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Layer (1000s of concurrent users)                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ User 1 │ User 2 │ User 3 │ ... │ User N               │  │
│  └────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  Scheduling Layer (GPU allocation & prioritization)          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Fair Share Scheduler │ Priority Queue │ Bin Packing    │  │
│  └────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  Memory Management Layer (Fragmentation & Isolation)         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Memory Pool │ Defragmentation │ Garbage Collection     │  │
│  └────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  GPU Layer (Physical GPUs)                                   │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐  │
│  │ GPU 0 (80GB) │ GPU 1 (80GB) │ GPU 2 (80GB) │ GPU 3... │  │
│  │ A100         │ A100         │ A100         │ A100     │  │
│  └──────────────┴──────────────┴──────────────┴──────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1. GPU Sharing Strategies

### 1.1 Three Main Approaches

```typescript
/**
 * GPU Sharing Strategy Comparison
 * 
 * 1. DEDICATED GPU PER SANDBOX
 *    - Each user gets exclusive GPU
 *    - No interference
 *    - Expensive (low utilization)
 *    - Used for: Premium tier, production inference
 * 
 * 2. TIME-SLICED SHARING
 *    - Users get GPU for time quantum
 *    - Context switching between users
 *    - Medium utilization
 *    - Used for: Development, testing
 * 
 * 3. SPACE-SHARED (MPS - Multi-Process Service)
 *    - Multiple processes share GPU simultaneously
 *    - High utilization
 *    - Complex memory management
 *    - Used for: Batch inference, training
 */

interface GPUSharingStrategy {
  name: string;
  isolation: 'dedicated' | 'time-sliced' | 'space-shared';
  maxUsersPerGPU: number;
  utilizationTarget: number;
  latency: string;
  costPerUser: number;
  complexity: 'low' | 'medium' | 'high';
}

const strategies: GPUSharingStrategy[] = [
  {
    name: 'Dedicated GPU',
    isolation: 'dedicated',
    maxUsersPerGPU: 1,
    utilizationTarget: 0.3,
    latency: '<10ms',
    costPerUser: 100,
    complexity: 'low'
  },
  {
    name: 'Time-Sliced (Context Switching)',
    isolation: 'time-sliced',
    maxUsersPerGPU: 4,
    utilizationTarget: 0.7,
    latency: '100-500ms',
    costPerUser: 25,
    complexity: 'medium'
  },
  {
    name: 'Space-Shared (MPS)',
    isolation: 'space-shared',
    maxUsersPerGPU: 8,
    utilizationTarget: 0.85,
    latency: '50-200ms',
    costPerUser: 12.5,
    complexity: 'high'
  }
];
```

### 1.2 NVIDIA MPS (Multi-Process Service)

```typescript
/**
 * NVIDIA MPS enables space-sharing of GPUs
 * Multiple processes can run kernels simultaneously
 * Managed by MPS daemon and control daemon
 */

class MPSGPUManager {
  private mpsControl: string = '/usr/bin/nvidia-cuda-mps-control';
  private mpsServer: string = '/usr/bin/nvidia-cuda-mps-server';

  /**
   * Initialize MPS on GPU
   */
  async initializeMPS(gpuIndex: number, maxClients: number = 8): Promise<void> {
    console.log(`Initializing MPS on GPU ${gpuIndex} with ${maxClients} max clients...`);

    // Set GPU index
    await execAsync(`export CUDA_VISIBLE_DEVICES=${gpuIndex}`);

    // Start MPS server
    await execAsync(`${this.mpsServer} &`);

    // Configure MPS
    await this.runMPSControl(`set_default_client_type wddm`);
    await this.runMPSControl(`set_default_active_thread_percentage 100`);

    // Set max active threads
    const threadsPerClient = Math.floor(100 / maxClients);
    await this.runMPSControl(`set_default_active_thread_percentage ${threadsPerClient}`);

    console.log(`✓ MPS initialized on GPU ${gpuIndex}`);
  }

  /**
   * Run MPS control command
   */
  private async runMPSControl(command: string): Promise<void> {
    const fullCommand = `echo "${command}" | ${this.mpsControl}`;
    await execAsync(fullCommand);
  }

  /**
   * Get MPS status
   */
  async getMPSStatus(gpuIndex: number): Promise<MPSStatus> {
    const { stdout } = await execAsync(
      `CUDA_VISIBLE_DEVICES=${gpuIndex} ${this.mpsControl} get_status`
    );

    const lines = stdout.split('\n');
    const status: MPSStatus = {
      gpuIndex,
      serverActive: lines.some(l => l.includes('Server Active')),
      clientCount: 0,
      activeThreadPercent: 0,
      maxThreadPercent: 0,
      clients: []
    };

    // Parse client information
    const clientMatch = stdout.match(/(\d+) active clients/);
    if (clientMatch) {
      status.clientCount = parseInt(clientMatch[1]);
    }

    return status;
  }

  /**
   * Shutdown MPS
   */
  async shutdownMPS(gpuIndex: number): Promise<void> {
    console.log(`Shutting down MPS on GPU ${gpuIndex}...`);

    await this.runMPSControl('quit');
    await execAsync('pkill -f nvidia-cuda-mps-server');

    console.log(`✓ MPS shutdown on GPU ${gpuIndex}`);
  }
}

interface MPSStatus {
  gpuIndex: number;
  serverActive: boolean;
  clientCount: number;
  activeThreadPercent: number;
  maxThreadPercent: number;
  clients: MPSClient[];
}

interface MPSClient {
  pid: number;
  name: string;
  activeThreadPercent: number;
}
```

## 2. GPU Scheduling System

### 2.1 Fair Share Scheduler

```typescript
/**
 * Fair Share Scheduler: Allocates GPU time fairly across users
 * Uses weighted round-robin with priority levels
 */

interface GPUAllocationRequest {
  userId: string;
  sandboxId: string;
  gpuMemoryRequired: number;  // MB
  priority: number;            // 0-100
  duration: number;            // milliseconds
  workloadType: 'inference' | 'training' | 'interactive';
}

interface GPUAllocation {
  allocationId: string;
  userId: string;
  gpuIndex: number;
  memoryAllocated: number;
  startTime: Date;
  endTime: Date;
  priority: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

class FairShareScheduler {
  private gpuPool: GPUResource[] = [];
  private allocationQueue: GPUAllocationRequest[] = [];
  private activeAllocations: Map<string, GPUAllocation> = new Map();
  private userWeights: Map<string, number> = new Map();
  private db: Database;

  constructor(gpuCount: number) {
    // Initialize GPU pool
    for (let i = 0; i < gpuCount; i++) {
      this.gpuPool.push({
        gpuIndex: i,
        totalMemory: 80 * 1024, // 80GB in MB
        allocatedMemory: 0,
        availableMemory: 80 * 1024,
        utilizationPercent: 0,
        allocations: [],
        lastDefragmentation: new Date()
      });
    }
  }

  /**
   * Request GPU allocation
   */
  async requestGPU(request: GPUAllocationRequest): Promise<GPUAllocation> {
    console.log(`GPU request from user ${request.userId}: ${request.gpuMemoryRequired}MB`);

    // Check if immediate allocation possible
    const gpu = this.findBestGPU(request);

    if (gpu && gpu.availableMemory >= request.gpuMemoryRequired) {
      return this.allocateGPU(gpu, request);
    }

    // Queue request if no GPU available
    this.allocationQueue.push(request);
    console.log(`Request queued. Queue length: ${this.allocationQueue.length}`);

    // Try defragmentation if memory fragmented
    if (this.isMemoryFragmented()) {
      await this.defragmentMemory();
      
      // Retry allocation after defragmentation
      const gpuAfterDefrag = this.findBestGPU(request);
      if (gpuAfterDefrag && gpuAfterDefrag.availableMemory >= request.gpuMemoryRequired) {
        return this.allocateGPU(gpuAfterDefrag, request);
      }
    }

    // Wait for allocation
    return this.waitForAllocation(request);
  }

  /**
   * Find best GPU for allocation using bin packing
   */
  private findBestGPU(request: GPUAllocationRequest): GPUResource | null {
    // Filter GPUs with enough memory
    const candidates = this.gpuPool.filter(
      gpu => gpu.availableMemory >= request.gpuMemoryRequired
    );

    if (candidates.length === 0) {
      return null;
    }

    // Sort by priority:
    // 1. Lowest utilization (for spreading load)
    // 2. Least fragmented
    // 3. Most recent defragmentation
    candidates.sort((a, b) => {
      const utilDiff = a.utilizationPercent - b.utilizationPercent;
      if (utilDiff !== 0) return utilDiff;

      const fragDiff = this.getFragmentationScore(a) - this.getFragmentationScore(b);
      if (fragDiff !== 0) return fragDiff;

      return b.lastDefragmentation.getTime() - a.lastDefragmentation.getTime();
    });

    return candidates[0];
  }

  /**
   * Allocate GPU to user
   */
  private allocateGPU(gpu: GPUResource, request: GPUAllocationRequest): GPUAllocation {
    const allocation: GPUAllocation = {
      allocationId: `alloc-${Date.now()}-${Math.random()}`,
      userId: request.userId,
      gpuIndex: gpu.gpuIndex,
      memoryAllocated: request.gpuMemoryRequired,
      startTime: new Date(),
      endTime: new Date(Date.now() + request.duration),
      priority: request.priority,
      status: 'active'
    };

    // Update GPU state
    gpu.allocatedMemory += request.gpuMemoryRequired;
    gpu.availableMemory -= request.gpuMemoryRequired;
    gpu.utilizationPercent = (gpu.allocatedMemory / gpu.totalMemory) * 100;
    gpu.allocations.push(allocation);

    // Store allocation
    this.activeAllocations.set(allocation.allocationId, allocation);

    // Update database
    this.db.query(
      `INSERT INTO gpu_allocations (allocation_id, user_id, gpu_index, memory_allocated, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        allocation.allocationId,
        request.userId,
        gpu.gpuIndex,
        request.gpuMemoryRequired,
        allocation.startTime,
        allocation.endTime
      ]
    );

    console.log(
      `✓ GPU ${gpu.gpuIndex} allocated to ${request.userId}: ${request.gpuMemoryRequired}MB ` +
      `(${gpu.utilizationPercent.toFixed(1)}% utilized)`
    );

    // Set timer for deallocation
    setTimeout(() => this.deallocateGPU(allocation.allocationId), request.duration);

    return allocation;
  }

  /**
   * Deallocate GPU
   */
  private deallocateGPU(allocationId: string): void {
    const allocation = this.activeAllocations.get(allocationId);
    if (!allocation) return;

    const gpu = this.gpuPool[allocation.gpuIndex];

    // Free memory
    gpu.allocatedMemory -= allocation.memoryAllocated;
    gpu.availableMemory += allocation.memoryAllocated;
    gpu.utilizationPercent = (gpu.allocatedMemory / gpu.totalMemory) * 100;

    // Remove allocation
    gpu.allocations = gpu.allocations.filter(a => a.allocationId !== allocationId);
    this.activeAllocations.delete(allocationId);

    console.log(
      `✓ GPU ${gpu.gpuIndex} deallocated: ${allocation.memoryAllocated}MB freed ` +
      `(${gpu.utilizationPercent.toFixed(1)}% utilized)`
    );

    // Process queued requests
    this.processQueue();
  }

  /**
   * Process allocation queue
   */
  private processQueue(): void {
    while (this.allocationQueue.length > 0) {
      const request = this.allocationQueue[0];
      const gpu = this.findBestGPU(request);

      if (gpu && gpu.availableMemory >= request.gpuMemoryRequired) {
        this.allocationQueue.shift();
        this.allocateGPU(gpu, request);
      } else {
        break; // Can't allocate, wait for more memory
      }
    }
  }

  /**
   * Wait for GPU allocation with timeout
   */
  private async waitForAllocation(
    request: GPUAllocationRequest,
    timeout: number = 300000 // 5 minutes
  ): Promise<GPUAllocation> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const gpu = this.findBestGPU(request);

        if (gpu && gpu.availableMemory >= request.gpuMemoryRequired) {
          clearInterval(checkInterval);
          resolve(this.allocateGPU(gpu, request));
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`GPU allocation timeout after ${timeout}ms`));
        }
      }, 1000);
    });
  }

  /**
   * Get GPU utilization stats
   */
  getUtilizationStats(): UtilizationStats {
    const totalMemory = this.gpuPool.reduce((sum, gpu) => sum + gpu.totalMemory, 0);
    const allocatedMemory = this.gpuPool.reduce((sum, gpu) => sum + gpu.allocatedMemory, 0);
    const avgUtilization = this.gpuPool.reduce((sum, gpu) => sum + gpu.utilizationPercent, 0) / this.gpuPool.length;

    return {
      totalMemory,
      allocatedMemory,
      availableMemory: totalMemory - allocatedMemory,
      utilizationPercent: (allocatedMemory / totalMemory) * 100,
      avgUtilizationPerGPU: avgUtilization,
      activeAllocations: this.activeAllocations.size,
      queuedRequests: this.allocationQueue.length
    };
  }

  private getFragmentationScore(gpu: GPUResource): number {
    if (gpu.allocations.length === 0) return 0;

    // Calculate fragmentation as variance in allocation sizes
    const sizes = gpu.allocations.map(a => a.memoryAllocated);
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;

    return Math.sqrt(variance);
  }

  private isMemoryFragmented(): boolean {
    return this.gpuPool.some(gpu => {
      const fragmentation = this.getFragmentationScore(gpu);
      return fragmentation > gpu.totalMemory * 0.2; // >20% fragmentation
    });
  }

  private async defragmentMemory(): Promise<void> {
    console.log('Starting GPU memory defragmentation...');

    for (const gpu of this.gpuPool) {
      if (gpu.allocations.length < 2) continue;

      // Sort allocations by start time
      gpu.allocations.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Migrate allocations to consolidate memory
      for (let i = 0; i < gpu.allocations.length - 1; i++) {
        const current = gpu.allocations[i];
        const next = gpu.allocations[i + 1];

        // Calculate gap between allocations
        const gap = next.startTime.getTime() - current.endTime.getTime();

        if (gap > 0 && gap < 1000) {
          // Try to migrate next allocation earlier
          await this.migrateAllocation(next);
        }
      }

      gpu.lastDefragmentation = new Date();
    }

    console.log('✓ GPU memory defragmentation complete');
  }

  private async migrateAllocation(allocation: GPUAllocation): Promise<void> {
    // Implementation for migrating allocation to different GPU
    console.log(`Migrating allocation ${allocation.allocationId} to different GPU...`);
  }
}

interface GPUResource {
  gpuIndex: number;
  totalMemory: number;
  allocatedMemory: number;
  availableMemory: number;
  utilizationPercent: number;
  allocations: GPUAllocation[];
  lastDefragmentation: Date;
}

interface UtilizationStats {
  totalMemory: number;
  allocatedMemory: number;
  availableMemory: number;
  utilizationPercent: number;
  avgUtilizationPerGPU: number;
  activeAllocations: number;
  queuedRequests: number;
}
```

## 3. GPU Memory Fragmentation Solutions

### 3.1 Memory Fragmentation Analysis

```typescript
/**
 * GPU Memory Fragmentation Patterns
 * 
 * Problem: After many allocations/deallocations, memory becomes fragmented
 * Example: 80GB GPU with 60GB allocated but no contiguous 10GB block available
 * 
 * Causes:
 * - Variable allocation sizes
 * - Random deallocation order
 * - Long-running allocations blocking memory
 * - Lack of memory compaction
 */

interface MemoryBlock {
  address: number;
  size: number;
  allocated: boolean;
  allocationId?: string;
  userId?: string;
  timestamp: Date;
}

class MemoryFragmentationAnalyzer {
  /**
   * Analyze memory fragmentation
   */
  analyzeFragmentation(gpu: GPUResource): FragmentationReport {
    const blocks = this.getMemoryBlocks(gpu);
    const freeBlocks = blocks.filter(b => !b.allocated);
    const allocatedBlocks = blocks.filter(b => b.allocated);

    // Calculate fragmentation metrics
    const largestFreeBlock = Math.max(...freeBlocks.map(b => b.size), 0);
    const totalFreeMemory = freeBlocks.reduce((sum, b) => sum + b.size, 0);
    const averageFreeBlockSize = freeBlocks.length > 0 ? totalFreeMemory / freeBlocks.length : 0;
    const fragmentationRatio = freeBlocks.length / (blocks.length || 1);

    // Estimate defragmentation potential
    const potentialRecovery = this.estimateDefragmentationPotential(freeBlocks);

    return {
      gpuIndex: gpu.gpuIndex,
      totalMemory: gpu.totalMemory,
      allocatedMemory: gpu.allocatedMemory,
      freeMemory: totalFreeMemory,
      freeBlockCount: freeBlocks.length,
      allocatedBlockCount: allocatedBlocks.length,
      largestFreeBlock,
      averageFreeBlockSize,
      fragmentationRatio,
      fragmentationPercent: (fragmentationRatio * 100),
      potentialRecovery,
      recommendation: this.getDefragmentationRecommendation(fragmentationRatio, potentialRecovery)
    };
  }

  private getMemoryBlocks(gpu: GPUResource): MemoryBlock[] {
    const blocks: MemoryBlock[] = [];
    let currentAddress = 0;

    // Sort allocations by address
    const sortedAllocations = [...gpu.allocations].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    for (const allocation of sortedAllocations) {
      // Add free block if gap exists
      if (currentAddress < allocation.startTime.getTime()) {
        blocks.push({
          address: currentAddress,
          size: allocation.startTime.getTime() - currentAddress,
          allocated: false,
          timestamp: new Date()
        });
      }

      // Add allocated block
      blocks.push({
        address: allocation.startTime.getTime(),
        size: allocation.memoryAllocated,
        allocated: true,
        allocationId: allocation.allocationId,
        userId: allocation.userId,
        timestamp: allocation.startTime
      });

      currentAddress = allocation.startTime.getTime() + allocation.memoryAllocated;
    }

    // Add remaining free memory
    if (currentAddress < gpu.totalMemory) {
      blocks.push({
        address: currentAddress,
        size: gpu.totalMemory - currentAddress,
        allocated: false,
        timestamp: new Date()
      });
    }

    return blocks;
  }

  private estimateDefragmentationPotential(freeBlocks: MemoryBlock[]): number {
    if (freeBlocks.length === 0) return 0;

    // Calculate how much memory could be recovered by consolidating
    const totalFree = freeBlocks.reduce((sum, b) => sum + b.size, 0);
    const maxFreeBlock = Math.max(...freeBlocks.map(b => b.size));

    // Potential recovery is the difference between total free and largest block
    return totalFree - maxFreeBlock;
  }

  private getDefragmentationRecommendation(
    fragmentationRatio: number,
    potentialRecovery: number
  ): string {
    if (fragmentationRatio < 0.1) {
      return 'No defragmentation needed';
    } else if (fragmentationRatio < 0.3) {
      return 'Monitor fragmentation';
    } else if (potentialRecovery > 1000) {
      return 'Defragmentation recommended';
    } else {
      return 'Immediate defragmentation required';
    }
  }
}

interface FragmentationReport {
  gpuIndex: number;
  totalMemory: number;
  allocatedMemory: number;
  freeMemory: number;
  freeBlockCount: number;
  allocatedBlockCount: number;
  largestFreeBlock: number;
  averageFreeBlockSize: number;
  fragmentationRatio: number;
  fragmentationPercent: number;
  potentialRecovery: number;
  recommendation: string;
}
```

### 3.2 Defragmentation Strategies

```typescript
class MemoryDefragmentationEngine {
  /**
   * Defragmentation Strategy 1: Stop-and-Compact
   * - Pause all allocations
   * - Compact memory
   * - Resume allocations
   * Best for: Batch workloads, off-peak hours
   */
  async defragmentStopAndCompact(gpu: GPUResource): Promise<DefragmentationResult> {
    console.log(`Starting stop-and-compact defragmentation on GPU ${gpu.gpuIndex}...`);

    const startTime = Date.now();
    const startFragmentation = this.calculateFragmentation(gpu);

    // 1. Pause all allocations
    const pausedAllocations = await this.pauseAllocations(gpu);

    // 2. Compact memory
    await this.compactMemory(gpu);

    // 3. Resume allocations
    await this.resumeAllocations(gpu, pausedAllocations);

    const duration = Date.now() - startTime;
    const endFragmentation = this.calculateFragmentation(gpu);

    return {
      strategy: 'stop-and-compact',
      startFragmentation,
      endFragmentation,
      fragmentationReduction: startFragmentation - endFragmentation,
      duration,
      allocationsAffected: pausedAllocations.length,
      success: true
    };
  }

  /**
   * Defragmentation Strategy 2: Incremental Compaction
   * - Gradually move allocations
   * - Minimal disruption
   * - Longer duration
   * Best for: Production environments, interactive workloads
   */
  async defragmentIncremental(gpu: GPUResource): Promise<DefragmentationResult> {
    console.log(`Starting incremental defragmentation on GPU ${gpu.gpuIndex}...`);

    const startTime = Date.now();
    const startFragmentation = this.calculateFragmentation(gpu);
    let movedAllocations = 0;

    // Sort allocations by size (move smaller ones first)
    const sortedAllocations = [...gpu.allocations].sort(
      (a, b) => a.memoryAllocated - b.memoryAllocated
    );

    for (const allocation of sortedAllocations) {
      // Check if moving this allocation would reduce fragmentation
      const currentFragmentation = this.calculateFragmentation(gpu);

      if (currentFragmentation < 0.2) {
        break; // Stop if fragmentation is low enough
      }

      // Move allocation to consolidate memory
      await this.moveAllocation(gpu, allocation);
      movedAllocations++;

      // Small delay to avoid disruption
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;
    const endFragmentation = this.calculateFragmentation(gpu);

    return {
      strategy: 'incremental',
      startFragmentation,
      endFragmentation,
      fragmentationReduction: startFragmentation - endFragmentation,
      duration,
      allocationsAffected: movedAllocations,
      success: true
    };
  }

  /**
   * Defragmentation Strategy 3: Predictive Compaction
   * - Predict future allocations
   * - Proactively compact memory
   * - Minimize future fragmentation
   * Best for: Known workload patterns
   */
  async defragmentPredictive(
    gpu: GPUResource,
    upcomingAllocations: GPUAllocationRequest[]
  ): Promise<DefragmentationResult> {
    console.log(`Starting predictive defragmentation on GPU ${gpu.gpuIndex}...`);

    const startTime = Date.now();
    const startFragmentation = this.calculateFragmentation(gpu);

    // Analyze upcoming allocations
    const largestUpcoming = Math.max(...upcomingAllocations.map(a => a.gpuMemoryRequired));

    // Find largest contiguous free block
    const largestFreeBlock = this.findLargestFreeBlock(gpu);

    if (largestFreeBlock < largestUpcoming) {
      // Need to defragment to fit upcoming allocation
      await this.compactMemoryForSize(gpu, largestUpcoming);
    }

    const duration = Date.now() - startTime;
    const endFragmentation = this.calculateFragmentation(gpu);

    return {
      strategy: 'predictive',
      startFragmentation,
      endFragmentation,
      fragmentationReduction: startFragmentation - endFragmentation,
      duration,
      allocationsAffected: gpu.allocations.length,
      success: true
    };
  }

  private calculateFragmentation(gpu: GPUResource): number {
    if (gpu.allocations.length === 0) return 0;

    const sizes = gpu.allocations.map(a => a.memoryAllocated);
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;

    return Math.sqrt(variance) / gpu.totalMemory;
  }

  private findLargestFreeBlock(gpu: GPUResource): number {
    // Implementation to find largest contiguous free block
    return 0;
  }

  private async pauseAllocations(gpu: GPUResource): Promise<GPUAllocation[]> {
    // Pause all active allocations
    return gpu.allocations;
  }

  private async compactMemory(gpu: GPUResource): Promise<void> {
    // Compact memory by moving allocations
  }

  private async compactMemoryForSize(gpu: GPUResource, requiredSize: number): Promise<void> {
    // Compact memory to create contiguous block of requiredSize
  }

  private async resumeAllocations(
    gpu: GPUResource,
    allocations: GPUAllocation[]
  ): Promise<void> {
    // Resume paused allocations
  }

  private async moveAllocation(gpu: GPUResource, allocation: GPUAllocation): Promise<void> {
    // Move allocation to new memory location
  }
}

interface DefragmentationResult {
  strategy: string;
  startFragmentation: number;
  endFragmentation: number;
  fragmentationReduction: number;
  duration: number;
  allocationsAffected: number;
  success: boolean;
}
```

## 4. GPU Isolation and Security

### 4.1 Process Isolation

```typescript
/**
 * GPU Isolation Mechanisms
 * 
 * 1. Process Isolation: Each user runs in separate process
 * 2. Container Isolation: Each user in separate container
 * 3. VM Isolation: Each user in separate VM (most secure)
 * 4. MPS Isolation: Shared GPU with MPS client isolation
 */

class GPUIsolationManager {
  /**
   * Create isolated GPU environment for user
   */
  async createIsolatedEnvironment(
    userId: string,
    gpuIndex: number,
    isolationLevel: 'process' | 'container' | 'vm'
  ): Promise<IsolatedGPUEnv> {
    switch (isolationLevel) {
      case 'process':
        return this.createProcessIsolation(userId, gpuIndex);
      case 'container':
        return this.createContainerIsolation(userId, gpuIndex);
      case 'vm':
        return this.createVMIsolation(userId, gpuIndex);
    }
  }

  /**
   * Process Isolation: Using cgroups and namespaces
   */
  private async createProcessIsolation(
    userId: string,
    gpuIndex: number
  ): Promise<IsolatedGPUEnv> {
    const cgroupPath = `/sys/fs/cgroup/gpu_${userId}`;

    // Create cgroup
    await execAsync(`mkdir -p ${cgroupPath}`);

    // Set GPU memory limit
    await execAsync(
      `echo 10737418240 > ${cgroupPath}/memory.limit_in_bytes` // 10GB
    );

    // Set GPU time limit (if using time-slicing)
    await execAsync(
      `echo 100000 > ${cgroupPath}/cpu.cfs_quota_us` // 100ms per 1s
    );

    // Create network namespace
    const nsName = `gpu_ns_${userId}`;
    await execAsync(`ip netns add ${nsName}`);

    return {
      userId,
      gpuIndex,
      isolationType: 'process',
      cgroupPath,
      namespace: nsName,
      memoryLimit: 10 * 1024, // MB
      timeQuota: 100000 // microseconds
    };
  }

  /**
   * Container Isolation: Using Docker
   */
  private async createContainerIsolation(
    userId: string,
    gpuIndex: number
  ): Promise<IsolatedGPUEnv> {
    const containerName = `gpu_container_${userId}`;

    const dockerCmd = `docker run -d \
      --name ${containerName} \
      --gpus '"device=${gpuIndex}"' \
      --memory 10g \
      --cpus 2 \
      --network none \
      --cap-drop ALL \
      --cap-add COMPUTE \
      --read-only \
      agentic-platform:latest`;

    const { stdout } = await execAsync(dockerCmd);
    const containerId = stdout.trim();

    return {
      userId,
      gpuIndex,
      isolationType: 'container',
      containerId,
      containerName,
      memoryLimit: 10 * 1024,
      cpuLimit: 2
    };
  }

  /**
   * VM Isolation: Using KVM/QEMU
   */
  private async createVMIsolation(
    userId: string,
    gpuIndex: number
  ): Promise<IsolatedGPUEnv> {
    const vmName = `gpu_vm_${userId}`;

    // Create VM with GPU passthrough
    const vmConfig = {
      name: vmName,
      memory: 16 * 1024, // 16GB
      vcpus: 4,
      gpuPassthrough: {
        gpuIndex,
        type: 'vfio'
      }
    };

    // Create and start VM
    await this.createVM(vmConfig);

    return {
      userId,
      gpuIndex,
      isolationType: 'vm',
      vmName,
      memoryLimit: 16 * 1024,
      cpuLimit: 4
    };
  }

  /**
   * Monitor isolation boundaries
   */
  async monitorIsolation(env: IsolatedGPUEnv): Promise<IsolationMetrics> {
    const metrics: IsolationMetrics = {
      userId: env.userId,
      gpuIndex: env.gpuIndex,
      timestamp: new Date(),
      memoryUsage: 0,
      cpuUsage: 0,
      gpuMemoryUsage: 0,
      isolationViolations: []
    };

    if (env.isolationType === 'process') {
      // Monitor cgroup limits
      const cgroupPath = (env as any).cgroupPath;
      const { stdout } = await execAsync(
        `cat ${cgroupPath}/memory.usage_in_bytes`
      );
      metrics.memoryUsage = parseInt(stdout.trim());
    } else if (env.isolationType === 'container') {
      // Monitor container stats
      const containerName = (env as any).containerName;
      const { stdout } = await execAsync(
        `docker stats ${containerName} --no-stream --format "{{.MemUsage}}"`
      );
      metrics.memoryUsage = this.parseMemoryUsage(stdout);
    }

    return metrics;
  }

  private async createVM(config: any): Promise<void> {
    // Implementation for VM creation
  }

  private parseMemoryUsage(output: string): number {
    // Parse memory usage from output
    return 0;
  }
}

interface IsolatedGPUEnv {
  userId: string;
  gpuIndex: number;
  isolationType: 'process' | 'container' | 'vm';
  [key: string]: any;
}

interface IsolationMetrics {
  userId: string;
  gpuIndex: number;
  timestamp: Date;
  memoryUsage: number;
  cpuUsage: number;
  gpuMemoryUsage: number;
  isolationViolations: string[];
}
```

## 5. GPU Monitoring and Metrics

### 5.1 Real-time GPU Monitoring

```typescript
class GPUMonitoringSystem {
  /**
   * Monitor GPU health and utilization
   */
  async monitorGPU(gpuIndex: number): Promise<GPUMetrics> {
    const { stdout } = await execAsync(
      `nvidia-smi -i ${gpuIndex} --query-gpu=temperature.gpu,power.draw,power.limit,memory.used,memory.total,utilization.gpu,utilization.memory,clocks.current.graphics,clocks.max.graphics --format=csv,noheader,nounits`
    );

    const [temp, power, powerLimit, memUsed, memTotal, gpuUtil, memUtil, clockCurrent, clockMax] =
      stdout.trim().split(',').map(s => parseFloat(s.trim()));

    return {
      gpuIndex,
      timestamp: new Date(),
      temperature: temp,
      powerUsage: power,
      powerLimit,
      memoryUsed: memUsed,
      memoryTotal: memTotal,
      gpuUtilization: gpuUtil,
      memoryUtilization: memUtil,
      clockSpeed: clockCurrent,
      maxClockSpeed: clockMax,
      thermalThrottling: temp > 80,
      powerThrottling: power > powerLimit * 0.95
    };
  }

  /**
   * Collect metrics for all GPUs
   */
  async collectMetrics(): Promise<Map<number, GPUMetrics>> {
    const metrics = new Map<number, GPUMetrics>();

    const { stdout: gpuCount } = await execAsync('nvidia-smi --list-gpus | wc -l');
    const count = parseInt(gpuCount.trim());

    for (let i = 0; i < count; i++) {
      metrics.set(i, await this.monitorGPU(i));
    }

    return metrics;
  }

  /**
   * Alert on anomalies
   */
  async checkAnomalies(metrics: GPUMetrics): Promise<string[]> {
    const alerts: string[] = [];

    if (metrics.temperature > 85) {
      alerts.push(`GPU ${metrics.gpuIndex}: High temperature (${metrics.temperature}°C)`);
    }

    if (metrics.thermalThrottling) {
      alerts.push(`GPU ${metrics.gpuIndex}: Thermal throttling detected`);
    }

    if (metrics.powerThrottling) {
      alerts.push(`GPU ${metrics.gpuIndex}: Power throttling detected`);
    }

    if (metrics.gpuUtilization > 95) {
      alerts.push(`GPU ${metrics.gpuIndex}: Very high utilization (${metrics.gpuUtilization}%)`);
    }

    return alerts;
  }
}

interface GPUMetrics {
  gpuIndex: number;
  timestamp: Date;
  temperature: number;
  powerUsage: number;
  powerLimit: number;
  memoryUsed: number;
  memoryTotal: number;
  gpuUtilization: number;
  memoryUtilization: number;
  clockSpeed: number;
  maxClockSpeed: number;
  thermalThrottling: boolean;
  powerThrottling: boolean;
}
```

## 6. Cost Optimization

### 6.1 GPU Utilization Optimization

```typescript
class GPUCostOptimizer {
  /**
   * Calculate cost per allocation
   */
  calculateAllocationCost(allocation: GPUAllocation, gpuCostPerHour: number): number {
    const durationHours = (allocation.endTime.getTime() - allocation.startTime.getTime()) / (1000 * 60 * 60);
    const memoryPercent = allocation.memoryAllocated / 80; // Assuming 80GB GPU
    
    // Cost = hourly rate × duration × memory utilization
    return gpuCostPerHour * durationHours * memoryPercent;
  }

  /**
   * Optimize GPU allocation for cost
   */
  async optimizeForCost(requests: GPUAllocationRequest[]): Promise<OptimizationResult> {
    // Sort requests by priority and duration
    const sorted = [...requests].sort((a, b) => {
      // Prioritize shorter jobs
      return a.duration - b.duration;
    });

    let totalCost = 0;
    let allocations = 0;

    for (const request of sorted) {
      // Try to batch with similar requests
      const batchable = sorted.filter(
        r => Math.abs(r.gpuMemoryRequired - request.gpuMemoryRequired) < 1000
      );

      if (batchable.length > 1) {
        // Batch processing saves cost
        totalCost += this.calculateBatchCost(batchable);
        allocations += batchable.length;
      }
    }

    return {
      totalCost,
      allocations,
      costPerAllocation: totalCost / allocations,
      optimizationPercent: 25 // Estimated savings
    };
  }

  private calculateBatchCost(requests: GPUAllocationRequest[]): number {
    // Batch processing is more efficient
    const totalMemory = requests.reduce((sum, r) => sum + r.gpuMemoryRequired, 0);
    const maxDuration = Math.max(...requests.map(r => r.duration));
    
    return (totalMemory / 80) * (maxDuration / (1000 * 60 * 60)) * 0.75; // 25% discount for batching
  }
}

interface OptimizationResult {
  totalCost: number;
  allocations: number;
  costPerAllocation: number;
  optimizationPercent: number;
}
```

## 7. Implementation Checklist

- [ ] Implement fair share scheduler
- [ ] Set up MPS for space-sharing
- [ ] Implement memory fragmentation analysis
- [ ] Add defragmentation strategies
- [ ] Set up GPU isolation
- [ ] Create monitoring system
- [ ] Implement cost tracking
- [ ] Add alerting system
- [ ] Test with multiple users
- [ ] Document procedures

## 8. Recommendations for Manus-like Platform

**GPU Sharing Strategy:**
- Use **Space-Shared (MPS)** for maximum utilization
- Support **Time-Sliced** for interactive workloads
- Reserve **Dedicated** GPUs for premium users

**Memory Management:**
- Implement **Incremental Defragmentation** for production
- Use **Predictive Compaction** for known workload patterns
- Monitor fragmentation continuously

**Isolation:**
- Use **Container Isolation** for most users
- Use **VM Isolation** for sensitive workloads
- Implement **Process Isolation** for development

**Monitoring:**
- Track GPU utilization per user
- Alert on thermal/power throttling
- Monitor memory fragmentation
- Track cost per allocation

This architecture enables serving thousands of concurrent users on a limited number of GPUs while maintaining performance, isolation, and cost efficiency!
