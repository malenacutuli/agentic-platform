# Sandbox Persistence: File Changes During Hibernation

## Overview

Sandbox persistence is the mechanism that ensures all file changes made by users are preserved when a sandbox hibernates and survives across resume cycles. This guide covers the three main strategies (volume mounts, S3 sync, and hybrid), their trade-offs, and complete implementation details.

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                     Three Persistence Strategies                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. VOLUME MOUNTS (EBS/PVC)                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Fast | Local | Persistent | Pod-attached | Limited     │  │
│  │ Latency: <1ms | Cost: High | Durability: Zone-bound    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  2. S3 SYNC (Object Storage)                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Durable | Geo-redundant | Slow | Cost-effective        │  │
│  │ Latency: 100-500ms | Cost: Low | Durability: Global    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  3. HYBRID (Volume + S3)                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Best of both | Incremental sync | Optimal performance  │  │
│  │ Latency: <1ms + async | Cost: Medium | Durability: Max │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Volume Mount Strategy

### 1.1 How It Works

```typescript
/**
 * Volume Mount Strategy: Files stored on persistent block storage
 * 
 * Pros:
 * - Extremely fast (local SSD speeds)
 * - No network latency
 * - Ideal for active development
 * - POSIX-compliant filesystem
 * 
 * Cons:
 * - Limited to single availability zone
 * - Can't migrate pods across zones
 * - Expensive storage costs
 * - Manual backup required
 * - Snapshot-based recovery only
 */

interface VolumeConfig {
  size: string;           // "50Gi", "100Gi"
  storageClass: string;   // "fast-ssd", "standard"
  accessMode: string;     // "ReadWriteOnce", "ReadWriteMany"
  zone: string;           // Availability zone
  snapshotPolicy: {
    enabled: boolean;
    frequency: string;    // "hourly", "daily"
    retention: number;    // days
  };
}

class VolumeMountPersistence {
  /**
   * Create persistent volume for sandbox
   */
  async createVolume(sandboxId: string, config: VolumeConfig): Promise<void> {
    const pvcManifest = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: `sandbox-${sandboxId}-pvc`,
        namespace: 'sandboxes'
      },
      spec: {
        accessModes: [config.accessMode],
        storageClassName: config.storageClass,
        resources: {
          requests: {
            storage: config.size
          }
        },
        selector: {
          matchLabels: {
            'sandbox-id': sandboxId,
            'zone': config.zone
          }
        }
      }
    };

    // Create PVC
    await this.kubernetesClient.create(pvcManifest);

    // Set up snapshot policy
    if (config.snapshotPolicy.enabled) {
      await this.setupSnapshotPolicy(sandboxId, config.snapshotPolicy);
    }
  }

  /**
   * Mount volume to pod
   */
  async mountVolumeToPod(sandboxId: string, podName: string): Promise<void> {
    const volumeMount = {
      name: `sandbox-${sandboxId}-storage`,
      mountPath: '/workspace',
      subPath: 'projects'
    };

    const volume = {
      name: `sandbox-${sandboxId}-storage`,
      persistentVolumeClaim: {
        claimName: `sandbox-${sandboxId}-pvc`
      }
    };

    // Update pod spec
    await this.kubernetesClient.patch(podName, {
      spec: {
        volumes: [volume],
        containers: [
          {
            name: 'app',
            volumeMounts: [volumeMount]
          }
        ]
      }
    });
  }

  /**
   * Set up automatic snapshots
   */
  private async setupSnapshotPolicy(
    sandboxId: string,
    policy: { frequency: string; retention: number }
  ): Promise<void> {
    const snapshotSchedule = {
      apiVersion: 'snapshot.storage.k8s.io/v1',
      kind: 'VolumeSnapshotClass',
      metadata: {
        name: `sandbox-${sandboxId}-snapshot-class`
      },
      driver: 'ebs.csi.aws.com',
      deletionPolicy: 'Delete'
    };

    await this.kubernetesClient.create(snapshotSchedule);

    // Schedule snapshots
    const cronJob = {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: {
        name: `snapshot-${sandboxId}`
      },
      spec: {
        schedule: this.frequencyToCron(policy.frequency),
        jobTemplate: {
          spec: {
            template: {
              spec: {
                serviceAccountName: 'snapshot-creator',
                containers: [
                  {
                    name: 'snapshot',
                    image: 'snapshot-creator:latest',
                    env: [
                      { name: 'SANDBOX_ID', value: sandboxId },
                      { name: 'RETENTION_DAYS', value: String(policy.retention) }
                    ]
                  }
                ],
                restartPolicy: 'OnFailure'
              }
            }
          }
        }
      }
    };

    await this.kubernetesClient.create(cronJob);
  }

  /**
   * Create on-demand snapshot
   */
  async createSnapshot(sandboxId: string, label: string): Promise<string> {
    const snapshotId = `snapshot-${sandboxId}-${Date.now()}`;

    const snapshot = {
      apiVersion: 'snapshot.storage.k8s.io/v1',
      kind: 'VolumeSnapshot',
      metadata: {
        name: snapshotId,
        namespace: 'sandboxes'
      },
      spec: {
        volumeSnapshotClassName: `sandbox-${sandboxId}-snapshot-class`,
        source: {
          persistentVolumeClaimName: `sandbox-${sandboxId}-pvc`
        }
      }
    };

    await this.kubernetesClient.create(snapshot);

    // Store snapshot metadata
    await this.db.query(
      `INSERT INTO volume_snapshots (snapshot_id, sandbox_id, label, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [snapshotId, sandboxId, label]
    );

    return snapshotId;
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(sandboxId: string, snapshotId: string): Promise<void> {
    const pvcManifest = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: `sandbox-${sandboxId}-pvc-restored`
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'fast-ssd',
        dataSource: {
          name: snapshotId,
          kind: 'VolumeSnapshot',
          apiGroup: 'snapshot.storage.k8s.io'
        },
        resources: {
          requests: {
            storage: '50Gi'
          }
        }
      }
    };

    await this.kubernetesClient.create(pvcManifest);

    // Wait for PVC to be bound
    await this.waitForPVCBound(`sandbox-${sandboxId}-pvc-restored`);

    // Swap PVCs
    await this.kubernetesClient.patch(`sandbox-${sandboxId}`, {
      spec: {
        volumes: [
          {
            name: `sandbox-${sandboxId}-storage`,
            persistentVolumeClaim: {
              claimName: `sandbox-${sandboxId}-pvc-restored`
            }
          }
        ]
      }
    });
  }

  /**
   * Monitor volume usage
   */
  async monitorVolumeUsage(sandboxId: string): Promise<VolumeUsageMetrics> {
    const { stdout } = await execAsync(
      `kubectl exec -n sandboxes pod-${sandboxId} -- df /workspace`
    );

    const lines = stdout.trim().split('\n');
    const [_, total, used, available] = lines[1].split(/\s+/).map(Number);

    return {
      sandboxId,
      totalGB: total / 1024 / 1024,
      usedGB: used / 1024 / 1024,
      availableGB: available / 1024 / 1024,
      utilizationPercent: (used / total) * 100,
      timestamp: new Date()
    };
  }

  /**
   * Handle volume full scenario
   */
  async handleVolumeFull(sandboxId: string): Promise<void> {
    console.warn(`Volume full for sandbox ${sandboxId}`);

    // Option 1: Expand volume
    const currentSize = await this.getVolumeSize(sandboxId);
    const newSize = this.calculateNewSize(currentSize);

    await this.expandVolume(sandboxId, newSize);

    // Option 2: Clean up old files
    await this.cleanupOldFiles(sandboxId);

    // Option 3: Archive to S3
    await this.archiveToS3(sandboxId);
  }

  private frequencyToCron(frequency: string): string {
    const cronMap: Record<string, string> = {
      'hourly': '0 * * * *',
      'daily': '0 0 * * *',
      'weekly': '0 0 * * 0',
      'monthly': '0 0 1 * *'
    };
    return cronMap[frequency] || '0 0 * * *';
  }

  private async waitForPVCBound(pvcName: string): Promise<void> {
    let retries = 0;
    while (retries < 30) {
      const pvc = await this.kubernetesClient.get('PersistentVolumeClaim', pvcName);
      if (pvc.status.phase === 'Bound') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
    throw new Error(`PVC ${pvcName} failed to bind`);
  }
}

interface VolumeUsageMetrics {
  sandboxId: string;
  totalGB: number;
  usedGB: number;
  availableGB: number;
  utilizationPercent: number;
  timestamp: Date;
}
```

### 1.2 Kubernetes Manifest for Volume Mount

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: sandbox-pv
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  awsElasticBlockStore:
    volumeID: vol-1234567890abcdef0
    fsType: ext4
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: topology.kubernetes.io/zone
          operator: In
          values:
          - us-east-1a
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: sandbox-pvc
  namespace: sandboxes
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 50Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-pod
  namespace: sandboxes
spec:
  containers:
  - name: app
    image: agentic-platform:latest
    volumeMounts:
    - name: workspace
      mountPath: /workspace
    - name: cache
      mountPath: /cache
  volumes:
  - name: workspace
    persistentVolumeClaim:
      claimName: sandbox-pvc
  - name: cache
    emptyDir:
      sizeLimit: 10Gi
```

## 2. S3 Sync Strategy

### 2.1 How It Works

```typescript
/**
 * S3 Sync Strategy: Files synced to object storage
 * 
 * Pros:
 * - Geo-redundant and durable
 * - Can migrate pods across zones/regions
 * - Cost-effective for large files
 * - Built-in versioning
 * - Easy backup and recovery
 * 
 * Cons:
 * - Network latency (100-500ms)
 * - Sync delays
 * - Eventual consistency
 * - Higher API costs
 * - Not POSIX-compliant
 */

interface S3SyncConfig {
  bucket: string;
  region: string;
  syncInterval: number;        // milliseconds
  batchSize: number;           // files per batch
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  versioning: boolean;
  retentionDays: number;
}

class S3SyncPersistence {
  private syncQueue: Map<string, FileChange[]> = new Map();
  private syncIntervals: Map<string, NodeJS.Timer> = new Map();
  private s3Client: S3Client;
  private db: Database;

  constructor(config: S3SyncConfig) {
    this.s3Client = new S3Client({ region: config.region });
    this.config = config;
  }

  /**
   * Initialize S3 sync for sandbox
   */
  async initializeS3Sync(sandboxId: string, projectPath: string): Promise<void> {
    // Create S3 bucket if not exists
    await this.ensureBucketExists(sandboxId);

    // Set up versioning
    if (this.config.versioning) {
      await this.enableVersioning(sandboxId);
    }

    // Set up lifecycle policy
    await this.setupLifecyclePolicy(sandboxId);

    // Start file watcher
    await this.startFileWatcher(sandboxId, projectPath);

    // Start periodic sync
    this.startPeriodicSync(sandboxId);

    // Store sync metadata
    await this.db.query(
      `INSERT INTO s3_sync_metadata (sandbox_id, bucket, last_sync)
       VALUES ($1, $2, NOW())`,
      [sandboxId, `${this.config.bucket}-${sandboxId}`]
    );
  }

  /**
   * Watch for file changes and queue for sync
   */
  private async startFileWatcher(sandboxId: string, projectPath: string): Promise<void> {
    const watcher = chokidar.watch(projectPath, {
      ignored: ['node_modules', '.git', 'dist', '.next'],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    watcher.on('change', (filePath) => this.queueFileChange(sandboxId, filePath, 'modified'));
    watcher.on('add', (filePath) => this.queueFileChange(sandboxId, filePath, 'added'));
    watcher.on('unlink', (filePath) => this.queueFileChange(sandboxId, filePath, 'deleted'));
  }

  /**
   * Queue file change for sync
   */
  private async queueFileChange(
    sandboxId: string,
    filePath: string,
    changeType: 'added' | 'modified' | 'deleted'
  ): Promise<void> {
    if (!this.syncQueue.has(sandboxId)) {
      this.syncQueue.set(sandboxId, []);
    }

    const change: FileChange = {
      filePath,
      changeType,
      timestamp: new Date(),
      synced: false
    };

    this.syncQueue.get(sandboxId)!.push(change);

    // Store in database for durability
    await this.db.query(
      `INSERT INTO file_changes (sandbox_id, file_path, change_type, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [sandboxId, filePath, changeType]
    );
  }

  /**
   * Periodic sync to S3
   */
  private startPeriodicSync(sandboxId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.syncToS3(sandboxId);
      } catch (error) {
        console.error(`S3 sync failed for ${sandboxId}:`, error);
      }
    }, this.config.syncInterval);

    this.syncIntervals.set(sandboxId, interval);
  }

  /**
   * Sync queued changes to S3
   */
  async syncToS3(sandboxId: string): Promise<SyncResult> {
    const changes = this.syncQueue.get(sandboxId) || [];
    
    if (changes.length === 0) {
      return { sandboxId, synced: 0, failed: 0, duration: 0 };
    }

    const startTime = Date.now();
    let synced = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < changes.length; i += this.config.batchSize) {
      const batch = changes.slice(i, i + this.config.batchSize);

      const results = await Promise.allSettled(
        batch.map(change => this.syncFileToS3(sandboxId, change))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          synced++;
        } else {
          failed++;
        }
      }
    }

    // Clear synced changes
    this.syncQueue.set(sandboxId, changes.filter(c => !c.synced));

    const duration = Date.now() - startTime;

    // Store sync result
    await this.db.query(
      `INSERT INTO sync_results (sandbox_id, synced, failed, duration)
       VALUES ($1, $2, $3, $4)`,
      [sandboxId, synced, failed, duration]
    );

    return { sandboxId, synced, failed, duration };
  }

  /**
   * Sync individual file to S3
   */
  private async syncFileToS3(sandboxId: string, change: FileChange): Promise<void> {
    const bucket = `${this.config.bucket}-${sandboxId}`;
    const s3Key = `files/${change.filePath}`;

    try {
      if (change.changeType === 'deleted') {
        // Delete from S3
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key
        }));
      } else {
        // Upload to S3
        const fileContent = await fs.readFile(change.filePath);
        
        const uploadParams: PutObjectCommandInput = {
          Bucket: bucket,
          Key: s3Key,
          Body: fileContent,
          Metadata: {
            'sandbox-id': sandboxId,
            'change-type': change.changeType,
            'timestamp': change.timestamp.toISOString()
          }
        };

        // Add compression if enabled
        if (this.config.compressionEnabled && fileContent.length > 1024) {
          const compressed = await gzip(fileContent);
          uploadParams.Body = compressed;
          uploadParams.ContentEncoding = 'gzip';
        }

        // Add encryption if enabled
        if (this.config.encryptionEnabled) {
          uploadParams.ServerSideEncryption = 'AES256';
        }

        await this.s3Client.send(new PutObjectCommand(uploadParams));
      }

      change.synced = true;

      // Update database
      await this.db.query(
        `UPDATE file_changes SET synced = true, synced_at = NOW()
         WHERE sandbox_id = $1 AND file_path = $2`,
        [sandboxId, change.filePath]
      );
    } catch (error) {
      console.error(`Failed to sync ${change.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Download files from S3 when sandbox resumes
   */
  async downloadFromS3(sandboxId: string, projectPath: string): Promise<void> {
    const bucket = `${this.config.bucket}-${sandboxId}`;

    console.log(`Downloading files from S3 for ${sandboxId}...`);

    // List all objects in bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket
    });

    let continuationToken: string | undefined;
    let downloadCount = 0;

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken
        })
      );

      if (!response.Contents) break;

      for (const obj of response.Contents) {
        if (!obj.Key) continue;

        try {
          await this.downloadFileFromS3(bucket, obj.Key, projectPath);
          downloadCount++;
        } catch (error) {
          console.error(`Failed to download ${obj.Key}:`, error);
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`Downloaded ${downloadCount} files from S3`);
  }

  private async downloadFileFromS3(
    bucket: string,
    s3Key: string,
    projectPath: string
  ): Promise<void> {
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key
    });

    const response = await this.s3Client.send(getCommand);
    
    if (!response.Body) return;

    const filePath = path.join(projectPath, s3Key.replace('files/', ''));
    await fs.ensureDir(path.dirname(filePath));

    const fileStream = fs.createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      response.Body!.pipe(fileStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  /**
   * Set up lifecycle policy for old versions
   */
  private async setupLifecyclePolicy(sandboxId: string): Promise<void> {
    const bucket = `${this.config.bucket}-${sandboxId}`;

    const lifecyclePolicy = {
      Rules: [
        {
          Id: 'delete-old-versions',
          Status: 'Enabled',
          NoncurrentVersionExpiration: {
            NoncurrentDays: this.config.retentionDays
          }
        },
        {
          Id: 'delete-incomplete-uploads',
          Status: 'Enabled',
          AbortIncompleteMultipartUpload: {
            DaysAfterInitiation: 7
          }
        }
      ]
    };

    await this.s3Client.send(new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: lifecyclePolicy
    }));
  }

  private async ensureBucketExists(sandboxId: string): Promise<void> {
    const bucket = `${this.config.bucket}-${sandboxId}`;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (error instanceof NoSuchBucket) {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
      } else {
        throw error;
      }
    }
  }

  private async enableVersioning(sandboxId: string): Promise<void> {
    const bucket = `${this.config.bucket}-${sandboxId}`;

    await this.s3Client.send(new PutBucketVersioningCommand({
      Bucket: bucket,
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    }));
  }

  /**
   * Clean up S3 resources
   */
  async cleanupS3(sandboxId: string): Promise<void> {
    const bucket = `${this.config.bucket}-${sandboxId}`;

    // Delete all objects
    const listCommand = new ListObjectsV2Command({ Bucket: bucket });
    const response = await this.s3Client.send(listCommand);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: obj.Key
          }));
        }
      }
    }

    // Delete bucket
    await this.s3Client.send(new DeleteBucketCommand({ Bucket: bucket }));
  }
}

interface FileChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  timestamp: Date;
  synced: boolean;
}

interface SyncResult {
  sandboxId: string;
  synced: number;
  failed: number;
  duration: number;
}
```

## 3. Hybrid Strategy (Recommended)

### 3.1 Best of Both Worlds

```typescript
/**
 * Hybrid Strategy: Volume Mount + S3 Sync
 * 
 * Architecture:
 * - Files stored on fast local volume
 * - Asynchronous sync to S3 in background
 * - On hibernation: flush pending syncs
 * - On resume: restore from volume or S3
 * 
 * Benefits:
 * - Fast local access (volume mount speeds)
 * - Durable backup (S3 geo-redundancy)
 * - Zone migration support
 * - Optimal cost/performance
 */

interface HybridPersistenceConfig {
  volumeSize: string;
  s3Bucket: string;
  s3Region: string;
  syncInterval: number;
  compressionEnabled: boolean;
  deduplicationEnabled: boolean;
  priorityOrder: ('volume' | 's3')[];
}

class HybridPersistence {
  private volumePersistence: VolumeMountPersistence;
  private s3Persistence: S3SyncPersistence;
  private db: Database;
  private config: HybridPersistenceConfig;

  constructor(config: HybridPersistenceConfig) {
    this.volumePersistence = new VolumeMountPersistence();
    this.s3Persistence = new S3SyncPersistence({
      bucket: config.s3Bucket,
      region: config.s3Region,
      syncInterval: config.syncInterval,
      batchSize: 100,
      compressionEnabled: config.compressionEnabled,
      encryptionEnabled: true,
      versioning: true,
      retentionDays: 30
    });
    this.config = config;
  }

  /**
   * Initialize hybrid persistence
   */
  async initialize(sandboxId: string, projectPath: string): Promise<void> {
    // 1. Create volume mount
    await this.volumePersistence.createVolume(sandboxId, {
      size: this.config.volumeSize,
      storageClass: 'fast-ssd',
      accessMode: 'ReadWriteOnce',
      zone: 'us-east-1a',
      snapshotPolicy: {
        enabled: true,
        frequency: 'hourly',
        retention: 7
      }
    });

    // 2. Initialize S3 sync
    await this.s3Persistence.initializeS3Sync(sandboxId, projectPath);

    // 3. Create sync metadata
    await this.db.query(
      `INSERT INTO hybrid_persistence (sandbox_id, volume_id, s3_bucket, status)
       VALUES ($1, $2, $3, 'active')`,
      [sandboxId, `sandbox-${sandboxId}-pvc`, `${this.config.s3Bucket}-${sandboxId}`]
    );
  }

  /**
   * Handle sandbox hibernation
   */
  async handleHibernation(sandboxId: string): Promise<HibernationCheckpoint> {
    console.log(`Preparing sandbox ${sandboxId} for hibernation...`);

    const checkpoint: HibernationCheckpoint = {
      sandboxId,
      timestamp: new Date(),
      volumeSnapshot: null,
      s3Sync: null,
      fileManifest: null
    };

    try {
      // 1. Flush pending S3 syncs
      console.log('Flushing pending S3 syncs...');
      const syncResult = await this.s3Persistence.syncToS3(sandboxId);
      checkpoint.s3Sync = syncResult;

      // 2. Create volume snapshot
      console.log('Creating volume snapshot...');
      const snapshotId = await this.volumePersistence.createSnapshot(
        sandboxId,
        `hibernation-${Date.now()}`
      );
      checkpoint.volumeSnapshot = snapshotId;

      // 3. Create file manifest
      console.log('Creating file manifest...');
      checkpoint.fileManifest = await this.createFileManifest(sandboxId);

      // 4. Store checkpoint
      await this.db.query(
        `INSERT INTO hibernation_checkpoints (sandbox_id, checkpoint_data)
         VALUES ($1, $2)`,
        [sandboxId, JSON.stringify(checkpoint)]
      );

      console.log(`✓ Sandbox ${sandboxId} ready for hibernation`);
      return checkpoint;
    } catch (error) {
      console.error(`Hibernation preparation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Handle sandbox resume
   */
  async handleResume(sandboxId: string): Promise<void> {
    console.log(`Resuming sandbox ${sandboxId}...`);

    try {
      // 1. Get latest checkpoint
      const checkpoint = await this.getLatestCheckpoint(sandboxId);

      // 2. Verify volume is available
      const volumeAvailable = await this.volumePersistence.isVolumeAvailable(sandboxId);

      if (volumeAvailable) {
        console.log('Volume available, using local files');
        // Volume is already mounted, files are there
      } else {
        console.log('Volume unavailable, restoring from S3');
        // Restore from S3
        const projectPath = await this.getProjectPath(sandboxId);
        await this.s3Persistence.downloadFromS3(sandboxId, projectPath);
      }

      // 3. Verify file integrity
      console.log('Verifying file integrity...');
      await this.verifyFileIntegrity(sandboxId, checkpoint.fileManifest);

      // 4. Resume sync
      console.log('Resuming S3 sync...');
      this.s3Persistence.startPeriodicSync(sandboxId);

      console.log(`✓ Sandbox ${sandboxId} resumed`);
    } catch (error) {
      console.error(`Resume failed: ${error}`);
      throw error;
    }
  }

  /**
   * Intelligent file access with fallback
   */
  async getFile(
    sandboxId: string,
    filePath: string
  ): Promise<Buffer> {
    // Try in priority order
    for (const source of this.config.priorityOrder) {
      try {
        if (source === 'volume') {
          return await this.getFileFromVolume(sandboxId, filePath);
        } else if (source === 's3') {
          return await this.getFileFromS3(sandboxId, filePath);
        }
      } catch (error) {
        console.warn(`Failed to get file from ${source}, trying next...`);
        continue;
      }
    }

    throw new Error(`File not found: ${filePath}`);
  }

  /**
   * Write file with dual persistence
   */
  async writeFile(
    sandboxId: string,
    filePath: string,
    content: Buffer
  ): Promise<void> {
    // 1. Write to volume (fast)
    await this.writeFileToVolume(sandboxId, filePath, content);

    // 2. Queue for S3 sync (async)
    this.s3Persistence.queueFileChange(sandboxId, filePath, 'modified');
  }

  /**
   * Create file manifest for integrity checking
   */
  private async createFileManifest(sandboxId: string): Promise<FileManifest> {
    const projectPath = await this.getProjectPath(sandboxId);
    const files: FileEntry[] = [];

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const content = await fs.readFile(fullPath);
          const fileHash = crypto.createHash('sha256').update(content).digest('hex');

          files.push({
            path: relativePath,
            hash: fileHash,
            size: content.length,
            mode: (await fs.stat(fullPath)).mode
          });
        }
      }
    };

    await walk(projectPath);

    return {
      sandboxId,
      timestamp: new Date(),
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      files
    };
  }

  /**
   * Verify file integrity
   */
  private async verifyFileIntegrity(
    sandboxId: string,
    manifest: FileManifest | null
  ): Promise<void> {
    if (!manifest) return;

    const projectPath = await this.getProjectPath(sandboxId);
    const missingFiles: string[] = [];
    const corruptedFiles: string[] = [];

    for (const file of manifest.files) {
      const filePath = path.join(projectPath, file.path);

      if (!await fs.pathExists(filePath)) {
        missingFiles.push(file.path);
        continue;
      }

      const content = await fs.readFile(filePath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');

      if (actualHash !== file.hash) {
        corruptedFiles.push(file.path);
      }
    }

    if (missingFiles.length > 0 || corruptedFiles.length > 0) {
      console.warn('File integrity issues detected:', {
        missingFiles,
        corruptedFiles
      });

      // Attempt recovery
      await this.recoverCorruptedFiles(sandboxId, missingFiles, corruptedFiles);
    }
  }

  private async recoverCorruptedFiles(
    sandboxId: string,
    missingFiles: string[],
    corruptedFiles: string[]
  ): Promise<void> {
    // Try to recover from S3
    for (const filePath of [...missingFiles, ...corruptedFiles]) {
      try {
        const content = await this.getFileFromS3(sandboxId, filePath);
        await this.writeFileToVolume(sandboxId, filePath, content);
      } catch (error) {
        console.error(`Failed to recover ${filePath}:`, error);
      }
    }
  }

  private shouldIgnore(name: string): boolean {
    const patterns = ['node_modules', '.git', 'dist', '.next', '.env.local'];
    return patterns.some(p => name === p || name.startsWith(p));
  }

  private async getFileFromVolume(sandboxId: string, filePath: string): Promise<Buffer> {
    const projectPath = await this.getProjectPath(sandboxId);
    return fs.readFile(path.join(projectPath, filePath));
  }

  private async getFileFromS3(sandboxId: string, filePath: string): Promise<Buffer> {
    // Implementation using S3 client
    throw new Error('Not implemented');
  }

  private async writeFileToVolume(
    sandboxId: string,
    filePath: string,
    content: Buffer
  ): Promise<void> {
    const projectPath = await this.getProjectPath(sandboxId);
    const fullPath = path.join(projectPath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
  }

  private async getLatestCheckpoint(sandboxId: string): Promise<HibernationCheckpoint> {
    const result = await this.db.query(
      `SELECT checkpoint_data FROM hibernation_checkpoints
       WHERE sandbox_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sandboxId]
    );

    if (result.length === 0) {
      throw new Error(`No checkpoint found for ${sandboxId}`);
    }

    return JSON.parse(result[0].checkpoint_data);
  }

  private async getProjectPath(sandboxId: string): Promise<string> {
    return `/workspace/${sandboxId}`;
  }
}

interface HibernationCheckpoint {
  sandboxId: string;
  timestamp: Date;
  volumeSnapshot: string | null;
  s3Sync: SyncResult | null;
  fileManifest: FileManifest | null;
}

interface FileManifest {
  sandboxId: string;
  timestamp: Date;
  fileCount: number;
  totalSize: number;
  files: FileEntry[];
}

interface FileEntry {
  path: string;
  hash: string;
  size: number;
  mode: number;
}
```

## 4. Performance Comparison

```typescript
interface PersistenceStrategy {
  name: string;
  readLatency: string;
  writeLatency: string;
  costPerGB: number;
  durability: string;
  zoneResilience: boolean;
  scalability: string;
}

const strategies: PersistenceStrategy[] = [
  {
    name: 'Volume Mount (EBS)',
    readLatency: '<1ms',
    writeLatency: '<1ms',
    costPerGB: 0.10,
    durability: 'Zone-bound',
    zoneResilience: false,
    scalability: 'Limited to pod'
  },
  {
    name: 'S3 Sync',
    readLatency: '100-500ms',
    writeLatency: '100-500ms',
    costPerGB: 0.023,
    durability: '99.999999999%',
    zoneResilience: true,
    scalability: 'Unlimited'
  },
  {
    name: 'Hybrid (Volume + S3)',
    readLatency: '<1ms (cached)',
    writeLatency: '<1ms + async',
    costPerGB: 0.06,
    durability: '99.999999999%',
    zoneResilience: true,
    scalability: 'Unlimited'
  }
];

// Decision matrix
const decisionMatrix = {
  'Performance critical': 'Volume Mount',
  'Cost sensitive': 'S3 Sync',
  'Balanced': 'Hybrid',
  'Multi-region': 'S3 Sync',
  'High availability': 'Hybrid',
  'Development': 'Volume Mount'
};
```

## 5. Monitoring and Observability

```typescript
class PersistenceMonitoring {
  /**
   * Monitor persistence health
   */
  async monitorPersistenceHealth(sandboxId: string): Promise<PersistenceHealth> {
    const health: PersistenceHealth = {
      sandboxId,
      timestamp: new Date(),
      volume: await this.checkVolumeHealth(sandboxId),
      s3: await this.checkS3Health(sandboxId),
      sync: await this.checkSyncHealth(sandboxId)
    };

    return health;
  }

  private async checkVolumeHealth(sandboxId: string): Promise<VolumeHealth> {
    // Check volume status, usage, latency
    return {
      status: 'healthy',
      utilizationPercent: 45,
      latencyMs: 0.5,
      iops: 1000
    };
  }

  private async checkS3Health(sandboxId: string): Promise<S3Health> {
    // Check S3 connectivity, sync status
    return {
      status: 'healthy',
      lastSyncTime: new Date(),
      pendingChanges: 0,
      failedSyncs: 0
    };
  }

  private async checkSyncHealth(sandboxId: string): Promise<SyncHealth> {
    // Check sync lag, consistency
    return {
      status: 'healthy',
      lagMs: 100,
      consistencyPercent: 100
    };
  }
}

interface PersistenceHealth {
  sandboxId: string;
  timestamp: Date;
  volume: VolumeHealth;
  s3: S3Health;
  sync: SyncHealth;
}

interface VolumeHealth {
  status: 'healthy' | 'degraded' | 'failed';
  utilizationPercent: number;
  latencyMs: number;
  iops: number;
}

interface S3Health {
  status: 'healthy' | 'degraded' | 'failed';
  lastSyncTime: Date;
  pendingChanges: number;
  failedSyncs: number;
}

interface SyncHealth {
  status: 'healthy' | 'degraded' | 'failed';
  lagMs: number;
  consistencyPercent: number;
}
```

## 6. Decision Tree

```
┌─ What's your primary concern?
│
├─ Performance?
│  └─ Volume Mount (EBS)
│
├─ Cost?
│  └─ S3 Sync
│
├─ Reliability?
│  └─ Hybrid (Volume + S3)
│
├─ Multi-region?
│  └─ S3 Sync
│
├─ High availability?
│  └─ Hybrid (Volume + S3)
│
└─ Balanced needs?
   └─ Hybrid (Volume + S3)
```

## 7. Implementation Checklist

- [ ] Choose persistence strategy
- [ ] Implement volume mount or S3 sync
- [ ] Set up file watching
- [ ] Implement sync queue
- [ ] Add error handling and retries
- [ ] Set up monitoring
- [ ] Create backup policies
- [ ] Test hibernation/resume
- [ ] Document procedures
- [ ] Train operations team

## 8. Recommendations

**For Manus-like Platform:**
- Use **Hybrid Strategy** (Volume Mount + S3 Sync)
- Fast local access for development
- Durable backup for disaster recovery
- Zone-resilient for high availability
- Cost-optimized with incremental sync

This ensures optimal performance, reliability, and cost efficiency across diverse use cases!
