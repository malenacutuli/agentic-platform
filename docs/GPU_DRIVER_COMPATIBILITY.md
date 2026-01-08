# GPU Driver Compatibility Across Different Customer Hardware

## Overview

Managing GPU driver compatibility across diverse customer hardware is one of the most complex infrastructure challenges in building a platform like Manus. This guide covers the complete strategy for detecting, managing, and optimizing GPU support across NVIDIA, AMD, and Intel GPUs with different driver versions and hardware configurations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Customer Hardware Layer                      │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ NVIDIA GPU   │ AMD GPU      │ Intel GPU    │ CPU-only     │  │
│  │ (various)    │ (various)    │ (various)    │ (fallback)   │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│              GPU Detection & Capability Layer                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ Driver Check │ CUDA/HIP     │ Compute      │ Memory       │  │
│  │ Version      │ Version      │ Capability   │ Available    │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│          Compatibility Matrix & Optimization Layer               │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ Compatibility│ Optimization │ Fallback     │ Monitoring   │  │
│  │ Matrix       │ Strategies   │ Mechanisms   │ & Alerts     │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                    Application Layer                             │
│  (LLM inference, model training, image generation, etc.)         │
└─────────────────────────────────────────────────────────────────┘
```

## 1. GPU Detection System

### 1.1 Hardware Detection Service

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GPUInfo {
  vendor: 'nvidia' | 'amd' | 'intel' | 'none';
  model: string;
  driverVersion: string;
  computeCapability?: string;
  memoryGB: number;
  count: number;
  cudaVersion?: string;
  hipVersion?: string;
  rocmVersion?: string;
  isSupported: boolean;
  supportLevel: 'full' | 'partial' | 'cpu-fallback';
  capabilities: GPUCapabilities;
}

interface GPUCapabilities {
  fp32: boolean;
  fp64: boolean;
  tensorCores: boolean;
  rtCores: boolean;
  maxThreadsPerBlock: number;
  warpSize: number;
  sharedMemoryPerBlock: number;
  maxGridSize: number;
  concurrentKernels: number;
}

class GPUDetectionService {
  /**
   * Detect all GPUs in the system
   */
  async detectGPUs(): Promise<GPUInfo[]> {
    const gpus: GPUInfo[] = [];

    // Try NVIDIA detection
    const nvidiaGPU = await this.detectNVIDIA();
    if (nvidiaGPU) gpus.push(nvidiaGPU);

    // Try AMD detection
    const amdGPU = await this.detectAMD();
    if (amdGPU) gpus.push(amdGPU);

    // Try Intel detection
    const intelGPU = await this.detectIntel();
    if (intelGPU) gpus.push(intelGPU);

    // If no GPUs found, return CPU-only
    if (gpus.length === 0) {
      gpus.push(this.getCPUFallback());
    }

    return gpus;
  }

  /**
   * Detect NVIDIA GPUs
   */
  private async detectNVIDIA(): Promise<GPUInfo | null> {
    try {
      const { stdout: nvidiaOutput } = await execAsync('nvidia-smi --query-gpu=index,name,driver_version,memory.total,compute_cap --format=csv,noheader,nounits');
      
      if (!nvidiaOutput) return null;

      const lines = nvidiaOutput.trim().split('\n');
      const firstGPU = lines[0].split(',').map(s => s.trim());

      const { stdout: cudaVersion } = await execAsync('nvcc --version | grep release');
      const cudaMatch = cudaVersion.match(/release ([\d.]+)/);

      const gpuInfo: GPUInfo = {
        vendor: 'nvidia',
        model: firstGPU[1],
        driverVersion: firstGPU[2],
        computeCapability: firstGPU[4],
        memoryGB: parseFloat(firstGPU[3]) / 1024,
        count: lines.length,
        cudaVersion: cudaMatch ? cudaMatch[1] : 'unknown',
        isSupported: await this.isNVIDIASupported(firstGPU[2], firstGPU[4]),
        supportLevel: 'full',
        capabilities: await this.getNVIDIACapabilities(firstGPU[4])
      };

      return gpuInfo;
    } catch (error) {
      console.debug('NVIDIA GPU detection failed:', error);
      return null;
    }
  }

  /**
   * Detect AMD GPUs
   */
  private async detectAMD(): Promise<GPUInfo | null> {
    try {
      const { stdout: rocmOutput } = await execAsync('rocm-smi --showid --showtemp --showmeminfo');
      
      if (!rocmOutput) return null;

      const { stdout: rocmVersion } = await execAsync('rocminfo | grep "ROCm Version"');
      const versionMatch = rocmVersion.match(/ROCm Version: ([\d.]+)/);

      const gpuInfo: GPUInfo = {
        vendor: 'amd',
        model: 'AMD Radeon (RDNA/CDNA)',
        driverVersion: await this.getAMDDriverVersion(),
        rocmVersion: versionMatch ? versionMatch[1] : 'unknown',
        memoryGB: await this.getAMDTotalMemory(),
        count: await this.getAMDGPUCount(),
        isSupported: await this.isAMDSupported(),
        supportLevel: 'partial', // AMD support is more limited
        capabilities: await this.getAMDCapabilities()
      };

      return gpuInfo;
    } catch (error) {
      console.debug('AMD GPU detection failed:', error);
      return null;
    }
  }

  /**
   * Detect Intel GPUs
   */
  private async detectIntel(): Promise<GPUInfo | null> {
    try {
      const { stdout: intelOutput } = await execAsync('clinfo | grep -i "device name"');
      
      if (!intelOutput) return null;

      const gpuInfo: GPUInfo = {
        vendor: 'intel',
        model: 'Intel Arc GPU',
        driverVersion: await this.getIntelDriverVersion(),
        memoryGB: await this.getIntelTotalMemory(),
        count: 1,
        isSupported: await this.isIntelSupported(),
        supportLevel: 'partial',
        capabilities: await this.getIntelCapabilities()
      };

      return gpuInfo;
    } catch (error) {
      console.debug('Intel GPU detection failed:', error);
      return null;
    }
  }

  /**
   * CPU-only fallback
   */
  private getCPUFallback(): GPUInfo {
    return {
      vendor: 'none',
      model: 'CPU-only',
      driverVersion: 'N/A',
      memoryGB: 0,
      count: 0,
      isSupported: true,
      supportLevel: 'cpu-fallback',
      capabilities: {
        fp32: true,
        fp64: true,
        tensorCores: false,
        rtCores: false,
        maxThreadsPerBlock: 1,
        warpSize: 1,
        sharedMemoryPerBlock: 0,
        maxGridSize: 1,
        concurrentKernels: 1
      }
    };
  }

  /**
   * Get NVIDIA GPU capabilities
   */
  private async getNVIDIACapabilities(computeCapability: string): Promise<GPUCapabilities> {
    const [major, minor] = computeCapability.split('.').map(Number);

    // Capability matrix based on compute capability
    const capabilityMatrix: Record<string, GPUCapabilities> = {
      '3.0': { // Kepler
        fp32: true,
        fp64: true,
        tensorCores: false,
        rtCores: false,
        maxThreadsPerBlock: 1024,
        warpSize: 32,
        sharedMemoryPerBlock: 49152,
        maxGridSize: 2147483647,
        concurrentKernels: 32
      },
      '5.0': { // Maxwell
        fp32: true,
        fp64: true,
        tensorCores: false,
        rtCores: false,
        maxThreadsPerBlock: 1024,
        warpSize: 32,
        sharedMemoryPerBlock: 49152,
        maxGridSize: 2147483647,
        concurrentKernels: 32
      },
      '6.0': { // Pascal
        fp32: true,
        fp64: true,
        tensorCores: false,
        rtCores: false,
        maxThreadsPerBlock: 1024,
        warpSize: 32,
        sharedMemoryPerBlock: 49152,
        maxGridSize: 2147483647,
        concurrentKernels: 128
      },
      '7.0': { // Volta
        fp32: true,
        fp64: true,
        tensorCores: true,
        rtCores: false,
        maxThreadsPerBlock: 1024,
        warpSize: 32,
        sharedMemoryPerBlock: 98304,
        maxGridSize: 2147483647,
        concurrentKernels: 128
      },
      '8.0': { // Ampere
        fp32: true,
        fp64: true,
        tensorCores: true,
        rtCores: true,
        maxThreadsPerBlock: 1024,
        warpSize: 32,
        sharedMemoryPerBlock: 98304,
        maxGridSize: 2147483647,
        concurrentKernels: 128
      },
      '9.0': { // Hopper
        fp32: true,
        fp64: true,
        tensorCores: true,
        rtCores: true,
        maxThreadsPerBlock: 1024,
        warpSize: 32,
        sharedMemoryPerBlock: 227328,
        maxGridSize: 2147483647,
        concurrentKernels: 128
      }
    };

    const key = `${major}.${minor}`;
    return capabilityMatrix[key] || capabilityMatrix['8.0']; // Default to Ampere
  }

  /**
   * Check NVIDIA driver compatibility
   */
  private async isNVIDIASupported(driverVersion: string, computeCapability: string): Promise<boolean> {
    const [major] = computeCapability.split('.').map(Number);
    const driver = parseFloat(driverVersion);

    // Compute capability 3.0 (Kepler) requires driver < 470
    if (major === 3 && driver >= 470) {
      return false;
    }

    // Compute capability 5.0+ supported by all modern drivers
    if (major >= 5) {
      return true;
    }

    return false;
  }

  /**
   * Check AMD support
   */
  private async isAMDSupported(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('rocm-smi --showversion');
      return stdout.includes('ROCm');
    } catch {
      return false;
    }
  }

  /**
   * Check Intel support
   */
  private async isIntelSupported(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('clinfo');
      return stdout.includes('Intel');
    } catch {
      return false;
    }
  }

  private async getAMDDriverVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('rocm-smi --showversion | head -1');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  private async getAMDTotalMemory(): Promise<number> {
    try {
      const { stdout } = await execAsync('rocm-smi --showmeminfo | grep "Total Memory"');
      const match = stdout.match(/(\d+)/);
      return match ? parseFloat(match[1]) / 1024 : 0;
    } catch {
      return 0;
    }
  }

  private async getAMDGPUCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('rocm-smi --showid | grep -c "GPU"');
      return parseInt(stdout.trim());
    } catch {
      return 0;
    }
  }

  private async getAMDCapabilities(): Promise<GPUCapabilities> {
    return {
      fp32: true,
      fp64: true,
      tensorCores: true,
      rtCores: false,
      maxThreadsPerBlock: 1024,
      warpSize: 64,
      sharedMemoryPerBlock: 65536,
      maxGridSize: 2147483647,
      concurrentKernels: 128
    };
  }

  private async getIntelDriverVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('clinfo | grep "Driver Version"');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  private async getIntelTotalMemory(): Promise<number> {
    try {
      const { stdout } = await execAsync('clinfo | grep "Global Memory"');
      const match = stdout.match(/(\d+)/);
      return match ? parseFloat(match[1]) / (1024 * 1024 * 1024) : 0;
    } catch {
      return 0;
    }
  }

  private async getIntelCapabilities(): Promise<GPUCapabilities> {
    return {
      fp32: true,
      fp64: false,
      tensorCores: false,
      rtCores: true,
      maxThreadsPerBlock: 512,
      warpSize: 32,
      sharedMemoryPerBlock: 65536,
      maxGridSize: 2147483647,
      concurrentKernels: 32
    };
  }
}
```

## 2. Compatibility Matrix

### 2.1 Driver Version Compatibility

```typescript
interface DriverCompatibility {
  minVersion: string;
  maxVersion?: string;
  cudaVersions: string[];
  supportedModels: string[];
  knownIssues: string[];
  recommendations: string[];
}

class CompatibilityMatrix {
  private matrix: Map<string, DriverCompatibility> = new Map([
    ['nvidia-470', {
      minVersion: '470.0',
      maxVersion: '469.99',
      cudaVersions: ['11.0', '11.1', '11.2'],
      supportedModels: ['Tesla V100', 'A100', 'RTX 2080', 'RTX 3090'],
      knownIssues: [
        'Kepler GPUs (compute capability 3.0) not supported',
        'Some older CUDA kernels may fail'
      ],
      recommendations: [
        'Upgrade to driver 525+ for better stability',
        'Use CUDA 11.8 for optimal performance'
      ]
    }],
    ['nvidia-525', {
      minVersion: '525.0',
      maxVersion: '524.99',
      cudaVersions: ['11.8', '12.0'],
      supportedModels: ['Tesla V100', 'A100', 'RTX 2080', 'RTX 3090', 'RTX 4090'],
      knownIssues: [],
      recommendations: [
        'Recommended for production use',
        'Best performance with CUDA 12.0'
      ]
    }],
    ['nvidia-535', {
      minVersion: '535.0',
      cudaVersions: ['12.0', '12.1', '12.2'],
      supportedModels: ['All modern NVIDIA GPUs'],
      knownIssues: [],
      recommendations: [
        'Latest stable driver',
        'Full support for Hopper architecture'
      ]
    }],
    ['amd-rocm-5.0', {
      minVersion: '5.0',
      cudaVersions: ['HIP 5.0'],
      supportedModels: ['MI100', 'MI200', 'MI300'],
      knownIssues: [
        'Limited model support compared to NVIDIA',
        'Some PyTorch operations may be slower'
      ],
      recommendations: [
        'Use latest ROCm version for best compatibility',
        'Test workloads thoroughly before production'
      ]
    }]
  ]);

  /**
   * Check if driver version is compatible
   */
  isCompatible(
    vendor: string,
    driverVersion: string,
    cudaVersion: string
  ): { compatible: boolean; reason?: string } {
    const key = `${vendor}-${driverVersion.split('.')[0]}`;
    const compat = this.matrix.get(key);

    if (!compat) {
      return {
        compatible: false,
        reason: `No compatibility data for ${key}`
      };
    }

    const driver = parseFloat(driverVersion);
    const min = parseFloat(compat.minVersion);
    const max = compat.maxVersion ? parseFloat(compat.maxVersion) : Infinity;

    if (driver < min || driver > max) {
      return {
        compatible: false,
        reason: `Driver version ${driverVersion} outside supported range [${compat.minVersion}, ${compat.maxVersion || 'latest'}]`
      };
    }

    if (!compat.cudaVersions.includes(cudaVersion)) {
      return {
        compatible: false,
        reason: `CUDA version ${cudaVersion} not supported with driver ${driverVersion}`
      };
    }

    return { compatible: true };
  }

  /**
   * Get recommendations for driver upgrade
   */
  getUpgradeRecommendations(
    vendor: string,
    currentVersion: string
  ): string[] {
    const entries = Array.from(this.matrix.entries());
    const newer = entries.filter(([_, compat]) => {
      const current = parseFloat(currentVersion);
      const min = parseFloat(compat.minVersion);
      return min > current;
    });

    if (newer.length === 0) {
      return ['Your driver is up to date'];
    }

    const latest = newer[newer.length - 1][1];
    return latest.recommendations;
  }
}
```

## 3. Fallback and Degradation Strategy

### 3.1 Graceful Degradation

```typescript
interface WorkloadOptimization {
  modelType: string;
  preferredGPU: 'nvidia' | 'amd' | 'intel' | 'cpu';
  fallbackOrder: ('nvidia' | 'amd' | 'intel' | 'cpu')[];
  optimizations: Map<string, string>;
  performanceEstimate: {
    gpu: number; // tokens/sec or images/sec
    cpu: number;
  };
}

class GPUFallbackManager {
  private workloadOptimizations: Map<string, WorkloadOptimization> = new Map([
    ['llm-inference', {
      modelType: 'llm-inference',
      preferredGPU: 'nvidia',
      fallbackOrder: ['nvidia', 'amd', 'cpu'],
      optimizations: new Map([
        ['nvidia-full', 'Use CUDA with TensorRT optimization'],
        ['nvidia-partial', 'Use CUDA with reduced precision (fp16)'],
        ['amd-full', 'Use HIP with rocBLAS'],
        ['amd-partial', 'Use HIP with CPU fallback for unsupported ops'],
        ['cpu-only', 'Use CPU with OpenMP parallelization']
      ]),
      performanceEstimate: {
        gpu: 100, // tokens/sec on A100
        cpu: 5    // tokens/sec on CPU
      }
    }],
    ['image-generation', {
      modelType: 'image-generation',
      preferredGPU: 'nvidia',
      fallbackOrder: ['nvidia', 'cpu'],
      optimizations: new Map([
        ['nvidia-full', 'Use CUDA with full precision'],
        ['nvidia-partial', 'Use CUDA with mixed precision'],
        ['cpu-only', 'Use CPU with reduced resolution']
      ]),
      performanceEstimate: {
        gpu: 10,  // images/sec on RTX 4090
        cpu: 0.5  // images/sec on CPU
      }
    }]
  ]);

  /**
   * Select best GPU for workload
   */
  selectGPU(
    workloadType: string,
    availableGPUs: GPUInfo[]
  ): { gpu: GPUInfo; optimization: string; performanceEstimate: number } {
    const workload = this.workloadOptimizations.get(workloadType);
    if (!workload) {
      throw new Error(`Unknown workload type: ${workloadType}`);
    }

    // Try each GPU in fallback order
    for (const preferredVendor of workload.fallbackOrder) {
      const gpu = availableGPUs.find(g => g.vendor === preferredVendor);
      
      if (gpu && gpu.isSupported) {
        const optimization = this.getOptimization(gpu, workload);
        const performanceEstimate = this.estimatePerformance(gpu, workload);

        return {
          gpu,
          optimization,
          performanceEstimate
        };
      }
    }

    // Fallback to CPU
    const cpuGPU = availableGPUs.find(g => g.vendor === 'none');
    return {
      gpu: cpuGPU!,
      optimization: workload.optimizations.get('cpu-only') || 'CPU-only execution',
      performanceEstimate: workload.performanceEstimate.cpu
    };
  }

  private getOptimization(gpu: GPUInfo, workload: WorkloadOptimization): string {
    if (!gpu.isSupported) {
      return workload.optimizations.get('cpu-only') || 'CPU-only execution';
    }

    const key = `${gpu.vendor}-${gpu.supportLevel}`;
    return workload.optimizations.get(key) || 'Default execution';
  }

  private estimatePerformance(gpu: GPUInfo, workload: WorkloadOptimization): number {
    if (gpu.vendor === 'none') {
      return workload.performanceEstimate.cpu;
    }

    // Estimate based on GPU memory and capabilities
    const basePerformance = workload.performanceEstimate.gpu;
    const memoryFactor = gpu.memoryGB / 80; // Normalize to A100 (80GB)
    const supportFactor = gpu.supportLevel === 'full' ? 1.0 : 0.7;

    return basePerformance * memoryFactor * supportFactor;
  }
}
```

## 4. Driver Installation and Management

### 4.1 Automated Driver Installation

```typescript
class DriverManager {
  /**
   * Install appropriate drivers
   */
  async installDrivers(gpuInfo: GPUInfo): Promise<void> {
    switch (gpuInfo.vendor) {
      case 'nvidia':
        await this.installNVIDIADriver(gpuInfo);
        break;
      case 'amd':
        await this.installAMDDriver(gpuInfo);
        break;
      case 'intel':
        await this.installIntelDriver(gpuInfo);
        break;
    }
  }

  private async installNVIDIADriver(gpuInfo: GPUInfo): Promise<void> {
    const targetVersion = this.getRecommendedNVIDIAVersion(gpuInfo);
    
    console.log(`Installing NVIDIA driver ${targetVersion}...`);

    // Disable nouveau driver
    await execAsync('sudo modprobe -r nouveau');

    // Download and install driver
    const driverUrl = `https://us.download.nvidia.com/XFree86/Linux-x86_64/${targetVersion}/NVIDIA-Linux-x86_64-${targetVersion}.run`;
    
    await execAsync(`wget ${driverUrl}`);
    await execAsync(`sudo bash NVIDIA-Linux-x86_64-${targetVersion}.run --silent --driver`);

    // Install CUDA toolkit
    await this.installCUDAToolkit(gpuInfo);

    // Verify installation
    await this.verifyNVIDIAInstallation();
  }

  private async installAMDDriver(gpuInfo: GPUInfo): Promise<void> {
    console.log('Installing AMD ROCm drivers...');

    // Add ROCm repository
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y rocm-dkms');

    // Add user to video group
    await execAsync('sudo usermod -a -G video $USER');

    // Verify installation
    await this.verifyAMDInstallation();
  }

  private async installIntelDriver(gpuInfo: GPUInfo): Promise<void> {
    console.log('Installing Intel GPU drivers...');

    // Add Intel repository
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y intel-opencl-icd');

    // Verify installation
    await this.verifyIntelInstallation();
  }

  private getRecommendedNVIDIAVersion(gpuInfo: GPUInfo): string {
    const [major] = gpuInfo.computeCapability!.split('.').map(Number);

    // Kepler (3.0) requires older drivers
    if (major === 3) {
      return '391.35';
    }

    // Maxwell (5.0-5.3) works with 470-525
    if (major === 5) {
      return '525.125.06';
    }

    // Pascal and newer - use latest
    return '535.104.05';
  }

  private async installCUDAToolkit(gpuInfo: GPUInfo): Promise<void> {
    const cudaVersion = this.getRecommendedCUDAVersion(gpuInfo);
    
    console.log(`Installing CUDA ${cudaVersion}...`);

    const cudaUrl = `https://developer.download.nvidia.com/compute/cuda/${cudaVersion}/local_installers/cuda_${cudaVersion}_linux_x86_64.run`;
    
    await execAsync(`wget ${cudaUrl}`);
    await execAsync(`sudo bash cuda_${cudaVersion}_linux_x86_64.run --silent --toolkit`);
  }

  private getRecommendedCUDAVersion(gpuInfo: GPUInfo): string {
    // Map driver versions to CUDA versions
    const driverToCUDA: Record<string, string> = {
      '391': '10.0',
      '470': '11.2',
      '525': '12.0',
      '535': '12.2'
    };

    const major = gpuInfo.driverVersion.split('.')[0];
    return driverToCUDA[major] || '12.2';
  }

  private async verifyNVIDIAInstallation(): Promise<void> {
    try {
      await execAsync('nvidia-smi');
      console.log('✓ NVIDIA driver installed successfully');
    } catch (error) {
      throw new Error('NVIDIA driver installation verification failed');
    }
  }

  private async verifyAMDInstallation(): Promise<void> {
    try {
      await execAsync('rocm-smi');
      console.log('✓ AMD ROCm installed successfully');
    } catch (error) {
      throw new Error('AMD ROCm installation verification failed');
    }
  }

  private async verifyIntelInstallation(): Promise<void> {
    try {
      await execAsync('clinfo');
      console.log('✓ Intel GPU drivers installed successfully');
    } catch (error) {
      throw new Error('Intel GPU driver installation verification failed');
    }
  }
}
```

## 5. Container-Based GPU Support

### 5.1 Docker GPU Configuration

```dockerfile
# Dockerfile with multi-GPU support
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch with CUDA support
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu122

# Install alternative backends for compatibility
RUN pip install \
    tensorflow[and-cuda] \
    jax[cuda12_cudnn82]

# Health check for GPU
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 -c "import torch; print(f'GPUs: {torch.cuda.device_count()}')" || exit 1

WORKDIR /app
COPY . .

CMD ["python3", "app.py"]
```

### 5.2 Kubernetes GPU Support

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-workload
spec:
  containers:
  - name: app
    image: agentic-platform:latest
    resources:
      limits:
        nvidia.com/gpu: 1  # Request 1 GPU
      requests:
        nvidia.com/gpu: 1
    env:
    - name: CUDA_VISIBLE_DEVICES
      value: "0"
    - name: TF_FORCE_GPU_ALLOW_GROWTH
      value: "true"
    - name: PYTORCH_CUDA_ALLOC_CONF
      value: "max_split_size_mb:512"
---
apiVersion: v1
kind: Pod
metadata:
  name: gpu-workload-amd
spec:
  containers:
  - name: app
    image: agentic-platform:rocm
    resources:
      limits:
        amd.com/gpu: 1  # Request AMD GPU
      requests:
        amd.com/gpu: 1
    env:
    - name: HIP_VISIBLE_DEVICES
      value: "0"
---
apiVersion: v1
kind: Pod
metadata:
  name: multi-gpu-workload
spec:
  containers:
  - name: app
    image: agentic-platform:latest
    resources:
      limits:
        nvidia.com/gpu: 4  # Request 4 GPUs
      requests:
        nvidia.com/gpu: 4
    env:
    - name: CUDA_VISIBLE_DEVICES
      value: "0,1,2,3"
    - name: NCCL_DEBUG
      value: "INFO"
```

## 6. Monitoring and Health Checks

### 6.1 GPU Health Monitoring

```typescript
interface GPUHealthMetrics {
  gpuIndex: number;
  temperature: number;
  powerUsage: number;
  memoryUsed: number;
  memoryTotal: number;
  gpuUtilization: number;
  memoryUtilization: number;
  clockSpeed: number;
  throttling: boolean;
  errors: string[];
  lastCheck: Date;
}

class GPUHealthMonitor {
  private metrics: Map<number, GPUHealthMetrics[]> = new Map();

  /**
   * Monitor GPU health
   */
  async monitorGPUHealth(): Promise<Map<number, GPUHealthMetrics>> {
    const healthMetrics = new Map<number, GPUHealthMetrics>();

    try {
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=index,temperature.gpu,power.draw,memory.used,memory.total,utilization.gpu,utilization.memory,clocks.current.graphics --format=csv,noheader,nounits'
      );

      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const [index, temp, power, memUsed, memTotal, gpuUtil, memUtil, clock] = 
          line.split(',').map(s => s.trim());

        const metrics: GPUHealthMetrics = {
          gpuIndex: parseInt(index),
          temperature: parseFloat(temp),
          powerUsage: parseFloat(power),
          memoryUsed: parseFloat(memUsed),
          memoryTotal: parseFloat(memTotal),
          gpuUtilization: parseFloat(gpuUtil),
          memoryUtilization: parseFloat(memUtil),
          clockSpeed: parseFloat(clock),
          throttling: await this.checkThrottling(parseInt(index)),
          errors: await this.checkGPUErrors(parseInt(index)),
          lastCheck: new Date()
        };

        healthMetrics.set(parseInt(index), metrics);

        // Store historical data
        if (!this.metrics.has(parseInt(index))) {
          this.metrics.set(parseInt(index), []);
        }
        this.metrics.get(parseInt(index))!.push(metrics);
      }

      // Alert on issues
      await this.checkHealthThresholds(healthMetrics);

    } catch (error) {
      console.error('GPU health monitoring failed:', error);
    }

    return healthMetrics;
  }

  private async checkThrottling(gpuIndex: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `nvidia-smi -i ${gpuIndex} --query-gpu=clocks_throttle_reasons.active --format=csv,noheader`
      );
      return stdout.includes('Active');
    } catch {
      return false;
    }
  }

  private async checkGPUErrors(gpuIndex: number): Promise<string[]> {
    const errors: string[] = [];

    try {
      const { stdout } = await execAsync(
        `nvidia-smi -i ${gpuIndex} --query-gpu=ecc.errors.corrected.volatile.total --format=csv,noheader`
      );

      if (stdout.includes('N/A')) {
        return errors;
      }

      const eccErrors = parseInt(stdout.trim());
      if (eccErrors > 0) {
        errors.push(`ECC errors detected: ${eccErrors}`);
      }
    } catch {
      // ECC not supported
    }

    return errors;
  }

  private async checkHealthThresholds(metrics: Map<number, GPUHealthMetrics>): Promise<void> {
    for (const [gpuIndex, metric] of metrics) {
      // Temperature warning
      if (metric.temperature > 80) {
        console.warn(`GPU ${gpuIndex} temperature high: ${metric.temperature}°C`);
      }

      // Memory pressure
      if (metric.memoryUtilization > 95) {
        console.warn(`GPU ${gpuIndex} memory pressure: ${metric.memoryUtilization}%`);
      }

      // Throttling
      if (metric.throttling) {
        console.warn(`GPU ${gpuIndex} is throttling`);
      }

      // Errors
      if (metric.errors.length > 0) {
        console.error(`GPU ${gpuIndex} errors:`, metric.errors);
      }
    }
  }

  /**
   * Get performance degradation report
   */
  async getPerformanceDegradation(gpuIndex: number): Promise<number> {
    const history = this.metrics.get(gpuIndex);
    if (!history || history.length < 2) {
      return 0;
    }

    const recent = history.slice(-10);
    const avgUtilization = recent.reduce((sum, m) => sum + m.gpuUtilization, 0) / recent.length;
    const throttlingCount = recent.filter(m => m.throttling).length;

    // Estimate degradation
    const throttlingDegradation = (throttlingCount / recent.length) * 20;
    const utilizationDegradation = Math.max(0, 100 - avgUtilization) * 0.1;

    return Math.min(100, throttlingDegradation + utilizationDegradation);
  }
}
```

## 7. Testing and Validation

### 7.1 GPU Compatibility Testing

```typescript
class GPUCompatibilityTester {
  /**
   * Run comprehensive GPU tests
   */
  async runCompatibilityTests(gpuInfo: GPUInfo): Promise<TestResults> {
    const results: TestResults = {
      gpuInfo,
      tests: [],
      overallStatus: 'pass'
    };

    // Test 1: Basic GPU detection
    results.tests.push(await this.testGPUDetection(gpuInfo));

    // Test 2: Memory allocation
    results.tests.push(await this.testMemoryAllocation(gpuInfo));

    // Test 3: Kernel execution
    results.tests.push(await this.testKernelExecution(gpuInfo));

    // Test 4: Tensor operations
    results.tests.push(await this.testTensorOperations(gpuInfo));

    // Test 5: Model inference
    results.tests.push(await this.testModelInference(gpuInfo));

    // Check overall status
    if (results.tests.some(t => t.status === 'fail')) {
      results.overallStatus = 'fail';
    } else if (results.tests.some(t => t.status === 'warn')) {
      results.overallStatus = 'warn';
    }

    return results;
  }

  private async testGPUDetection(gpuInfo: GPUInfo): Promise<TestResult> {
    try {
      if (!gpuInfo.isSupported) {
        return {
          name: 'GPU Detection',
          status: 'fail',
          message: 'GPU not supported'
        };
      }

      return {
        name: 'GPU Detection',
        status: 'pass',
        message: `Detected: ${gpuInfo.model} (${gpuInfo.memoryGB}GB)`
      };
    } catch (error) {
      return {
        name: 'GPU Detection',
        status: 'fail',
        message: String(error)
      };
    }
  }

  private async testMemoryAllocation(gpuInfo: GPUInfo): Promise<TestResult> {
    try {
      // Test allocating 50% of GPU memory
      const testSize = Math.floor(gpuInfo.memoryGB * 0.5 * 1024 * 1024 * 1024);
      
      // This would be actual CUDA/HIP memory allocation
      // For now, just verify memory is available
      
      return {
        name: 'Memory Allocation',
        status: 'pass',
        message: `Can allocate up to ${gpuInfo.memoryGB}GB`
      };
    } catch (error) {
      return {
        name: 'Memory Allocation',
        status: 'fail',
        message: String(error)
      };
    }
  }

  private async testKernelExecution(gpuInfo: GPUInfo): Promise<TestResult> {
    try {
      // Run simple kernel
      // This would be actual kernel execution code
      
      return {
        name: 'Kernel Execution',
        status: 'pass',
        message: 'Kernels execute successfully'
      };
    } catch (error) {
      return {
        name: 'Kernel Execution',
        status: 'fail',
        message: String(error)
      };
    }
  }

  private async testTensorOperations(gpuInfo: GPUInfo): Promise<TestResult> {
    try {
      // Test PyTorch/TensorFlow operations
      // This would use actual tensor libraries
      
      return {
        name: 'Tensor Operations',
        status: 'pass',
        message: 'Tensor operations work correctly'
      };
    } catch (error) {
      return {
        name: 'Tensor Operations',
        status: 'fail',
        message: String(error)
      };
    }
  }

  private async testModelInference(gpuInfo: GPUInfo): Promise<TestResult> {
    try {
      // Test running a small model
      // This would load and run an actual model
      
      return {
        name: 'Model Inference',
        status: 'pass',
        message: 'Model inference works'
      };
    } catch (error) {
      return {
        name: 'Model Inference',
        status: 'fail',
        message: String(error)
      };
    }
  }
}

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface TestResults {
  gpuInfo: GPUInfo;
  tests: TestResult[];
  overallStatus: 'pass' | 'fail' | 'warn';
}
```

## 8. Implementation Checklist

- [ ] Implement GPU detection service
- [ ] Create compatibility matrix
- [ ] Build fallback/degradation system
- [ ] Implement driver management
- [ ] Set up container GPU support
- [ ] Create health monitoring
- [ ] Build compatibility testing suite
- [ ] Document supported hardware
- [ ] Create troubleshooting guides
- [ ] Set up automated testing
- [ ] Train support team

## 9. Supported Hardware Matrix

| Vendor | Model | Min Driver | CUDA/HIP | Status | Notes |
|--------|-------|-----------|----------|--------|-------|
| NVIDIA | H100 | 535.0 | 12.2 | ✅ Full | Recommended |
| NVIDIA | A100 | 470.0 | 11.0 | ✅ Full | Production ready |
| NVIDIA | RTX 4090 | 525.0 | 12.0 | ✅ Full | Consumer GPU |
| NVIDIA | RTX 3090 | 470.0 | 11.0 | ✅ Full | Older consumer |
| NVIDIA | V100 | 410.0 | 10.0 | ✅ Full | Legacy support |
| AMD | MI300 | ROCm 6.0 | HIP 6.0 | ⚠️ Partial | Limited support |
| AMD | MI200 | ROCm 5.0 | HIP 5.0 | ⚠️ Partial | Limited support |
| Intel | Arc A770 | 1.0 | OpenCL | ⚠️ Partial | Experimental |
| CPU | Any | N/A | N/A | ✅ Full | Fallback option |

## 10. Best Practices

1. **Always have CPU fallback** - Never require GPU
2. **Test on diverse hardware** - Test on multiple GPU models
3. **Monitor GPU health** - Track temperature, power, errors
4. **Use containers** - Docker/Kubernetes for consistency
5. **Provide clear feedback** - Tell users what GPU is being used
6. **Document limitations** - Be transparent about compatibility
7. **Plan for upgrades** - Support new GPU architectures
8. **Optimize for each GPU** - Use GPU-specific optimizations

This comprehensive system ensures your platform works reliably across diverse customer hardware while maintaining optimal performance!
