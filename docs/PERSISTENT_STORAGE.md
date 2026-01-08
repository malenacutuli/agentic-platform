# Persistent File Storage Across Sandbox Hibernation/Resume Cycles

## Overview

Manus handles persistent file storage through a **multi-layered architecture** that ensures data survives sandbox hibernation, container restarts, and infrastructure failures. This is one of the most complex aspects of building a platform like Manus.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│  (Project files, node_modules, build artifacts, user data)      │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  Storage Abstraction Layer                      │
│  (File sync, versioning, change detection, caching)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              Persistent Storage Backend                         │
│  ┌──────────────────┬──────────────────┬──────────────────┐    │
│  │  Local Volumes   │   S3/Object      │   Database       │    │
│  │  (EBS, PVC)      │   Storage        │   (Metadata)     │    │
│  └──────────────────┴──────────────────┴──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Storage Strategy

### 1.1 Persistent Volumes (EBS/PVC)

**Purpose**: Store project files and node_modules

```yaml
# Kubernetes PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: project-storage
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 50Gi
```

**Characteristics:**
- Survives pod restarts
- Survives node failures (with proper storage class)
- Mounted to `/projects` in container
- Supports snapshots for backups
- Can be replicated across zones

### 1.2 Object Storage (S3)

**Purpose**: Store build artifacts, user uploads, backups

```typescript
// Store build artifacts in S3
async function storeArtifact(projectId: string, filePath: string): Promise<void> {
  const fileContent = await fs.readFile(filePath);
  const s3Key = `projects/${projectId}/artifacts/${path.basename(filePath)}`;
  
  await s3.putObject({
    Bucket: 'agentic-platform-artifacts',
    Key: s3Key,
    Body: fileContent,
    Metadata: {
      'project-id': projectId,
      'timestamp': new Date().toISOString(),
      'original-path': filePath
    }
  }).promise();
}
```

**Characteristics:**
- Highly durable (99.999999999% durability)
- Geo-redundant
- Cost-effective for large files
- Versioning support
- Lifecycle policies for automatic cleanup

### 1.3 Database (PostgreSQL/MySQL)

**Purpose**: Store metadata, file manifests, version history

```typescript
// File metadata schema
interface FileMetadata {
  id: string;
  projectId: string;
  filePath: string;
  fileHash: string;           // SHA256 of content
  fileSize: number;
  lastModified: Date;
  s3Key?: string;             // If stored in S3
  localPath?: string;         // If on persistent volume
  version: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Database table
CREATE TABLE file_metadata (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  file_size BIGINT,
  last_modified TIMESTAMP,
  s3_key VARCHAR(1024),
  local_path VARCHAR(1024),
  version INT DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, file_path, version)
);

CREATE INDEX idx_project_files ON file_metadata(project_id);
CREATE INDEX idx_file_hash ON file_metadata(file_hash);
```

## 2. File Synchronization System

### 2.1 Change Detection

```typescript
// File watcher with change tracking
class FileChangeTracker {
  private watcher: chokidar.FSWatcher;
  private changeLog: Map<string, FileChange> = new Map();
  private db: Database;

  async startWatching(projectPath: string): Promise<void> {
    this.watcher = chokidar.watch(projectPath, {
      ignored: ['node_modules', '.git', 'dist', 'build'],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.watcher.on('change', (filePath) => this.handleChange(filePath));
    this.watcher.on('add', (filePath) => this.handleAdd(filePath));
    this.watcher.on('unlink', (filePath) => this.handleDelete(filePath));
  }

  private async handleChange(filePath: string): Promise<void> {
    const fileHash = await this.computeHash(filePath);
    const fileSize = (await fs.stat(filePath)).size;
    const timestamp = new Date();

    const change: FileChange = {
      type: 'modified',
      filePath,
      fileHash,
      fileSize,
      timestamp,
      syncStatus: 'pending'
    };

    this.changeLog.set(filePath, change);
    
    // Queue for sync
    await this.queueForSync(change);
  }

  private async computeHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async queueForSync(change: FileChange): Promise<void> {
    // Store in database for persistence
    await this.db.query(
      `INSERT INTO file_changes (project_id, file_path, change_type, file_hash, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [this.projectId, change.filePath, change.type, change.fileHash, change.timestamp]
    );
  }
}
```

### 2.2 Sync Queue

```typescript
// Persistent sync queue
class PersistentSyncQueue {
  private db: Database;
  private s3: S3Client;
  private batchSize: number = 100;

  async processPendingChanges(projectId: string): Promise<void> {
    // Get pending changes from database
    const pendingChanges = await this.db.query(
      `SELECT * FROM file_changes 
       WHERE project_id = $1 AND sync_status = 'pending'
       ORDER BY timestamp ASC
       LIMIT $2`,
      [projectId, this.batchSize]
    );

    for (const change of pendingChanges) {
      try {
        await this.syncChange(change);
        
        // Mark as synced
        await this.db.query(
          `UPDATE file_changes SET sync_status = 'synced', synced_at = NOW()
           WHERE id = $1`,
          [change.id]
        );
      } catch (error) {
        // Retry logic
        await this.db.query(
          `UPDATE file_changes SET retry_count = retry_count + 1, last_error = $1
           WHERE id = $2`,
          [error.message, change.id]
        );
      }
    }
  }

  private async syncChange(change: FileChange): Promise<void> {
    const filePath = path.join(this.projectPath, change.filePath);
    
    // Check if file still exists
    const exists = await fs.pathExists(filePath);
    
    if (!exists && change.type !== 'deleted') {
      // File was deleted, mark as deleted
      await this.db.query(
        `UPDATE file_metadata SET is_deleted = true WHERE file_path = $1`,
        [change.filePath]
      );
      return;
    }

    if (exists) {
      // Upload to S3
      const fileContent = await fs.readFile(filePath);
      const s3Key = `projects/${this.projectId}/files/${change.filePath}`;
      
      await this.s3.putObject({
        Bucket: 'agentic-platform-files',
        Key: s3Key,
        Body: fileContent,
        Metadata: {
          'project-id': this.projectId,
          'file-hash': change.fileHash,
          'timestamp': change.timestamp.toISOString()
        }
      }).promise();

      // Update metadata
      await this.db.query(
        `UPDATE file_metadata 
         SET s3_key = $1, file_hash = $2, file_size = $3, last_modified = NOW()
         WHERE project_id = $4 AND file_path = $5`,
        [s3Key, change.fileHash, change.fileSize, this.projectId, change.filePath]
      );
    }
  }
}
```

## 3. Sandbox Hibernation/Resume Handling

### 3.1 Pre-Hibernation Checkpoint

```typescript
// Before hibernating sandbox
class SandboxHibernationManager {
  async prepareForHibernation(sandboxId: string): Promise<void> {
    const sandbox = await this.getActiveSandbox(sandboxId);
    
    // 1. Flush pending file changes
    await this.syncQueue.processPendingChanges(sandbox.projectId);
    
    // 2. Create checkpoint
    const checkpoint = await this.createCheckpoint(sandbox);
    
    // 3. Store sandbox state
    await this.db.query(
      `UPDATE sandboxes 
       SET status = 'hibernated', 
           last_checkpoint_id = $1,
           hibernated_at = NOW()
       WHERE id = $2`,
      [checkpoint.id, sandboxId]
    );
    
    // 4. Store running processes
    await this.storeProcessState(sandbox);
    
    // 5. Compress and archive to S3
    await this.archiveToS3(checkpoint);
  }

  private async createCheckpoint(sandbox: Sandbox): Promise<Checkpoint> {
    const projectPath = sandbox.projectPath;
    const timestamp = new Date();
    
    // Create manifest of all files
    const fileManifest = await this.createFileManifest(projectPath);
    
    const checkpoint: Checkpoint = {
      id: uuid(),
      sandboxId: sandbox.id,
      projectId: sandbox.projectId,
      timestamp,
      fileManifest,
      processState: null,
      status: 'created'
    };

    // Store in database
    await this.db.query(
      `INSERT INTO checkpoints (id, sandbox_id, project_id, file_manifest, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [checkpoint.id, sandbox.id, sandbox.projectId, JSON.stringify(fileManifest), timestamp]
    );

    return checkpoint;
  }

  private async createFileManifest(projectPath: string): Promise<FileManifest> {
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
          const fileHash = await this.computeHash(fullPath);
          const fileSize = (await fs.stat(fullPath)).size;
          
          files.push({
            path: relativePath,
            hash: fileHash,
            size: fileSize,
            mode: (await fs.stat(fullPath)).mode
          });
        }
      }
    };

    await walk(projectPath);
    
    return {
      projectId: this.projectId,
      timestamp: new Date(),
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      files
    };
  }

  private shouldIgnore(name: string): boolean {
    const ignoredPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'out',
      '.turbo',
      '.env.local',
      '*.log'
    ];
    
    return ignoredPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  private async archiveToS3(checkpoint: Checkpoint): Promise<void> {
    // Create tar.gz of checkpoint
    const archivePath = `/tmp/checkpoint-${checkpoint.id}.tar.gz`;
    
    await tar.create(
      {
        gzip: true,
        file: archivePath,
        cwd: checkpoint.projectPath
      },
      ['.']
    );

    // Upload to S3
    const fileStream = fs.createReadStream(archivePath);
    const s3Key = `checkpoints/${checkpoint.projectId}/${checkpoint.id}.tar.gz`;
    
    await this.s3.putObject({
      Bucket: 'agentic-platform-checkpoints',
      Key: s3Key,
      Body: fileStream,
      Metadata: {
        'checkpoint-id': checkpoint.id,
        'project-id': checkpoint.projectId,
        'timestamp': checkpoint.timestamp.toISOString()
      }
    }).promise();

    // Clean up local archive
    await fs.remove(archivePath);
  }
}
```

### 3.2 Resume from Hibernation

```typescript
// When sandbox resumes
class SandboxResumeManager {
  async resumeFromHibernation(sandboxId: string): Promise<void> {
    const sandbox = await this.getHibernatedSandbox(sandboxId);
    const checkpoint = await this.getLatestCheckpoint(sandbox.projectId);
    
    // 1. Restore files from checkpoint
    await this.restoreFilesFromCheckpoint(checkpoint);
    
    // 2. Verify file integrity
    await this.verifyFileIntegrity(checkpoint);
    
    // 3. Restore process state
    await this.restoreProcessState(checkpoint);
    
    // 4. Sync any remote changes
    await this.syncRemoteChanges(sandbox.projectId);
    
    // 5. Update sandbox status
    await this.db.query(
      `UPDATE sandboxes 
       SET status = 'running', resumed_at = NOW()
       WHERE id = $1`,
      [sandboxId]
    );
  }

  private async restoreFilesFromCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const projectPath = checkpoint.projectPath;
    
    // Download checkpoint archive from S3
    const s3Key = `checkpoints/${checkpoint.projectId}/${checkpoint.id}.tar.gz`;
    const archivePath = `/tmp/restore-${checkpoint.id}.tar.gz`;
    
    const fileStream = fs.createWriteStream(archivePath);
    
    await new Promise((resolve, reject) => {
      this.s3.getObject({
        Bucket: 'agentic-platform-checkpoints',
        Key: s3Key
      }).createReadStream()
        .pipe(fileStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    // Extract archive
    await tar.extract({
      gzip: true,
      file: archivePath,
      cwd: projectPath
    });

    // Clean up
    await fs.remove(archivePath);
  }

  private async verifyFileIntegrity(checkpoint: Checkpoint): Promise<void> {
    const projectPath = checkpoint.projectPath;
    const manifest = checkpoint.fileManifest;
    
    const missingFiles: string[] = [];
    const corruptedFiles: string[] = [];

    for (const file of manifest.files) {
      const filePath = path.join(projectPath, file.path);
      
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        missingFiles.push(file.path);
        continue;
      }

      // Verify hash
      const actualHash = await this.computeHash(filePath);
      if (actualHash !== file.hash) {
        corruptedFiles.push(file.path);
      }
    }

    if (missingFiles.length > 0 || corruptedFiles.length > 0) {
      // Log issues and attempt recovery
      console.error('File integrity check failed:', {
        missingFiles,
        corruptedFiles
      });

      // Attempt to restore from S3
      await this.restoreMissingFiles(checkpoint, missingFiles);
    }
  }

  private async restoreMissingFiles(
    checkpoint: Checkpoint,
    missingFiles: string[]
  ): Promise<void> {
    for (const filePath of missingFiles) {
      const s3Key = `projects/${checkpoint.projectId}/files/${filePath}`;
      
      try {
        const fileStream = this.s3.getObject({
          Bucket: 'agentic-platform-files',
          Key: s3Key
        }).createReadStream();

        const fullPath = path.join(checkpoint.projectPath, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        
        await new Promise((resolve, reject) => {
          fileStream
            .pipe(fs.createWriteStream(fullPath))
            .on('finish', resolve)
            .on('error', reject);
        });
      } catch (error) {
        console.error(`Failed to restore ${filePath}:`, error);
      }
    }
  }

  private async syncRemoteChanges(projectId: string): Promise<void> {
    // Check if there are any changes in S3 that aren't in local storage
    const remoteFiles = await this.listS3Files(projectId);
    const localFiles = await this.listLocalFiles(projectId);

    const remoteOnly = remoteFiles.filter(
      f => !localFiles.some(l => l.path === f.path && l.hash === f.hash)
    );

    // Download remote-only files
    for (const file of remoteOnly) {
      await this.downloadFileFromS3(projectId, file);
    }
  }
}
```

## 4. Consistency Guarantees

### 4.1 ACID Properties

```typescript
// Ensure atomicity of file operations
class AtomicFileOperation {
  async updateFile(
    projectId: string,
    filePath: string,
    newContent: string
  ): Promise<void> {
    const transaction = await this.db.startTransaction();
    
    try {
      // 1. Write to temporary file
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, newContent);

      // 2. Compute hash
      const fileHash = await this.computeHash(tempPath);

      // 3. Update database (atomic)
      await transaction.query(
        `UPDATE file_metadata 
         SET file_hash = $1, last_modified = NOW(), version = version + 1
         WHERE project_id = $2 AND file_path = $3`,
        [fileHash, projectId, filePath]
      );

      // 4. Atomic rename
      await fs.move(tempPath, filePath, { overwrite: true });

      // 5. Queue for S3 sync
      await transaction.query(
        `INSERT INTO file_changes (project_id, file_path, change_type, file_hash)
         VALUES ($1, $2, $3, $4)`,
        [projectId, filePath, 'modified', fileHash]
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

### 4.2 Conflict Resolution

```typescript
// Handle concurrent modifications
class ConflictResolver {
  async resolveConflict(
    projectId: string,
    filePath: string,
    localVersion: FileVersion,
    remoteVersion: FileVersion
  ): Promise<FileVersion> {
    // Strategy: Last-write-wins with version tracking
    
    if (remoteVersion.timestamp > localVersion.timestamp) {
      // Remote is newer
      return remoteVersion;
    } else if (localVersion.timestamp > remoteVersion.timestamp) {
      // Local is newer
      return localVersion;
    } else {
      // Same timestamp - use hash for deterministic ordering
      if (localVersion.hash > remoteVersion.hash) {
        return localVersion;
      } else {
        return remoteVersion;
      }
    }
  }

  async createMergeConflictMarker(
    projectId: string,
    filePath: string,
    localContent: string,
    remoteContent: string
  ): Promise<void> {
    const mergedContent = `
<<<<<<< LOCAL
${localContent}
=======
${remoteContent}
>>>>>>> REMOTE
`;

    await fs.writeFile(
      path.join(this.projectPath, filePath),
      mergedContent
    );
  }
}
```

## 5. Disaster Recovery

### 5.1 Backup Strategy

```typescript
class BackupManager {
  async createDailyBackup(projectId: string): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupKey = `backups/${projectId}/daily/${timestamp}.tar.gz`;

    // Create backup from latest checkpoint
    const checkpoint = await this.getLatestCheckpoint(projectId);
    
    // Download from S3, re-upload to backup location
    await this.s3.copyObject({
      Bucket: 'agentic-platform-backups',
      CopySource: `agentic-platform-checkpoints/${checkpoint.s3Key}`,
      Key: backupKey,
      Metadata: {
        'project-id': projectId,
        'backup-date': timestamp,
        'checkpoint-id': checkpoint.id
      }
    }).promise();

    // Set lifecycle policy to delete after 30 days
    await this.setBackupLifecycle(projectId);
  }

  async restoreFromBackup(projectId: string, backupDate: string): Promise<void> {
    const backupKey = `backups/${projectId}/daily/${backupDate}.tar.gz`;

    // Verify backup exists
    try {
      await this.s3.headObject({
        Bucket: 'agentic-platform-backups',
        Key: backupKey
      }).promise();
    } catch (error) {
      throw new Error(`Backup not found for date: ${backupDate}`);
    }

    // Restore process
    const archivePath = `/tmp/restore-backup-${backupDate}.tar.gz`;
    
    const fileStream = fs.createWriteStream(archivePath);
    
    await new Promise((resolve, reject) => {
      this.s3.getObject({
        Bucket: 'agentic-platform-backups',
        Key: backupKey
      }).createReadStream()
        .pipe(fileStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    // Extract to project path
    await tar.extract({
      gzip: true,
      file: archivePath,
      cwd: this.getProjectPath(projectId)
    });

    await fs.remove(archivePath);
  }
}
```

### 5.2 Point-in-Time Recovery

```typescript
class PointInTimeRecovery {
  async recoverToTimestamp(
    projectId: string,
    targetTimestamp: Date
  ): Promise<void> {
    // Get all file versions up to target timestamp
    const fileVersions = await this.db.query(
      `SELECT * FROM file_metadata 
       WHERE project_id = $1 AND created_at <= $2
       ORDER BY file_path, version DESC`,
      [projectId, targetTimestamp]
    );

    // Group by file path, keep only latest version before timestamp
    const latestVersions = new Map();
    for (const version of fileVersions) {
      if (!latestVersions.has(version.file_path)) {
        latestVersions.set(version.file_path, version);
      }
    }

    // Restore each file
    const projectPath = this.getProjectPath(projectId);
    
    for (const [filePath, version] of latestVersions) {
      if (version.is_deleted) {
        // File was deleted, remove it
        await fs.remove(path.join(projectPath, filePath));
      } else {
        // Restore from S3
        const fileStream = this.s3.getObject({
          Bucket: 'agentic-platform-files',
          Key: version.s3_key
        }).createReadStream();

        const fullPath = path.join(projectPath, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        
        await new Promise((resolve, reject) => {
          fileStream
            .pipe(fs.createWriteStream(fullPath))
            .on('finish', resolve)
            .on('error', reject);
        });
      }
    }
  }
}
```

## 6. Performance Optimization

### 6.1 Incremental Sync

```typescript
// Only sync changed files
class IncrementalSync {
  async syncChangedFilesOnly(projectId: string): Promise<void> {
    // Get last sync timestamp
    const lastSync = await this.db.query(
      `SELECT last_sync_timestamp FROM projects WHERE id = $1`,
      [projectId]
    );

    // Get files changed since last sync
    const changedFiles = await this.db.query(
      `SELECT * FROM file_changes 
       WHERE project_id = $1 AND timestamp > $2
       ORDER BY timestamp ASC`,
      [projectId, lastSync.last_sync_timestamp]
    );

    // Batch upload to S3
    const uploadPromises = changedFiles.map(change =>
      this.uploadFileToS3(projectId, change)
    );

    await Promise.all(uploadPromises);

    // Update last sync timestamp
    await this.db.query(
      `UPDATE projects SET last_sync_timestamp = NOW() WHERE id = $1`,
      [projectId]
    );
  }
}
```

### 6.2 Deduplication

```typescript
// Avoid storing duplicate content
class ContentDeduplication {
  async storeWithDedup(
    projectId: string,
    filePath: string,
    content: Buffer
  ): Promise<void> {
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');

    // Check if content already exists
    const existing = await this.db.query(
      `SELECT s3_key FROM file_metadata WHERE file_hash = $1 LIMIT 1`,
      [fileHash]
    );

    let s3Key: string;
    
    if (existing.length > 0) {
      // Reuse existing S3 object
      s3Key = existing[0].s3_key;
    } else {
      // Upload new content
      s3Key = `projects/${projectId}/content/${fileHash}`;
      
      await this.s3.putObject({
        Bucket: 'agentic-platform-files',
        Key: s3Key,
        Body: content
      }).promise();
    }

    // Store metadata with reference to S3 key
    await this.db.query(
      `INSERT INTO file_metadata (project_id, file_path, file_hash, s3_key)
       VALUES ($1, $2, $3, $4)`,
      [projectId, filePath, fileHash, s3Key]
    );
  }
}
```

## 7. Monitoring & Observability

### 7.1 Storage Metrics

```typescript
class StorageMonitoring {
  async trackStorageMetrics(projectId: string): Promise<void> {
    // Track local storage usage
    const localUsage = await this.getLocalStorageUsage(projectId);
    
    // Track S3 usage
    const s3Usage = await this.getS3StorageUsage(projectId);
    
    // Track database size
    const dbUsage = await this.getDatabaseUsage(projectId);

    // Store metrics
    await this.db.query(
      `INSERT INTO storage_metrics (project_id, local_usage, s3_usage, db_usage, timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [projectId, localUsage, s3Usage, dbUsage]
    );

    // Alert if usage exceeds threshold
    if (localUsage > this.localStorageLimit) {
      await this.alertStorageExceeded(projectId, 'local', localUsage);
    }
  }

  async getSyncStatus(projectId: string): Promise<SyncStatus> {
    const pendingChanges = await this.db.query(
      `SELECT COUNT(*) as count FROM file_changes 
       WHERE project_id = $1 AND sync_status = 'pending'`,
      [projectId]
    );

    const failedChanges = await this.db.query(
      `SELECT COUNT(*) as count FROM file_changes 
       WHERE project_id = $1 AND sync_status = 'failed'`,
      [projectId]
    );

    return {
      projectId,
      pendingChanges: pendingChanges[0].count,
      failedChanges: failedChanges[0].count,
      lastSyncTime: await this.getLastSyncTime(projectId)
    };
  }
}
```

## 8. Implementation Checklist

- [ ] Set up persistent volumes (EBS/PVC)
- [ ] Configure S3 buckets with versioning
- [ ] Create database schema for file metadata
- [ ] Implement file change tracking
- [ ] Build sync queue system
- [ ] Create checkpoint/restore logic
- [ ] Implement conflict resolution
- [ ] Set up backup policies
- [ ] Add monitoring and alerting
- [ ] Test disaster recovery procedures
- [ ] Document recovery procedures
- [ ] Train team on operations

## 9. Best Practices

1. **Immutable Backups**: Once created, backups should be immutable
2. **Encryption**: Encrypt data at rest and in transit
3. **Access Control**: Implement fine-grained access control
4. **Audit Logging**: Log all file operations for compliance
5. **Regular Testing**: Test recovery procedures regularly
6. **Monitoring**: Continuously monitor storage health
7. **Capacity Planning**: Plan for growth and scale proactively
8. **Cost Optimization**: Use lifecycle policies and deduplication

## 10. Troubleshooting

### File Sync Stuck

```bash
# Check pending changes
SELECT COUNT(*) FROM file_changes WHERE sync_status = 'pending';

# Check failed changes
SELECT * FROM file_changes WHERE sync_status = 'failed' LIMIT 10;

# Retry failed syncs
UPDATE file_changes SET sync_status = 'pending', retry_count = 0 
WHERE sync_status = 'failed';
```

### Storage Quota Exceeded

```bash
# Check storage usage
SELECT project_id, SUM(file_size) as total_size 
FROM file_metadata 
GROUP BY project_id 
ORDER BY total_size DESC;

# Clean up old versions
DELETE FROM file_metadata 
WHERE project_id = 'proj_123' AND version < 5 AND is_deleted = true;
```

### Corrupted Files

```bash
# Identify corrupted files
SELECT * FROM file_metadata 
WHERE file_hash NOT IN (SELECT file_hash FROM verified_files);

# Restore from backup
CALL restore_from_backup('proj_123', '2024-01-08');
```

This comprehensive system ensures that user data persists reliably across sandbox hibernation cycles while maintaining performance and cost efficiency.
