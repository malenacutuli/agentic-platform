# Git Integration Details

This guide covers auto-commit debouncing, checkpoint storage, large file handling (LFS), branch protection, and webhook security.

---

## Table of Contents

1. [Auto-Commit Debouncing](#auto-commit-debouncing)
2. [Checkpoint Storage](#checkpoint-storage)
3. [Large File Handling](#large-file-handling)
4. [Branch Protection](#branch-protection)
5. [Webhook Security](#webhook-security)

---

## Auto-Commit Debouncing

### Default Debounce Configuration

| Setting | Default Value | Range | Description |
|---------|---------------|-------|-------------|
| **Debounce time** | 2000ms | 500-10000ms | Wait time after last change |
| **Max wait** | 30000ms | 5000-60000ms | Maximum time before forced commit |
| **Batch size** | 50 files | 10-200 | Max files per commit |
| **Idle threshold** | 5000ms | 1000-30000ms | Idle time to trigger commit |

### Debounce Implementation

```typescript
// auto-commit-debouncer.ts

interface DebounceConfig {
  debounceMs: number;      // Wait after last change
  maxWaitMs: number;       // Max time before forced commit
  maxBatchSize: number;    // Max files per commit
  idleThresholdMs: number; // Idle time to trigger
  excludePatterns: string[]; // Files to exclude
}

const defaultConfig: DebounceConfig = {
  debounceMs: 2000,
  maxWaitMs: 30000,
  maxBatchSize: 50,
  idleThresholdMs: 5000,
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    '*.log',
    '.env.local',
    '*.tmp',
  ],
};

class AutoCommitDebouncer {
  private config: DebounceConfig;
  private pendingChanges: Map<string, FileChange> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private maxWaitTimer: NodeJS.Timeout | null = null;
  private firstChangeTime: number | null = null;
  private gitService: GitService;
  
  constructor(gitService: GitService, config: Partial<DebounceConfig> = {}) {
    this.gitService = gitService;
    this.config = { ...defaultConfig, ...config };
  }
  
  /**
   * Handle file change event
   */
  onFileChange(change: FileChange): void {
    // Check if file should be excluded
    if (this.shouldExclude(change.path)) {
      return;
    }
    
    // Record change
    this.pendingChanges.set(change.path, change);
    
    // Set first change time if not set
    if (!this.firstChangeTime) {
      this.firstChangeTime = Date.now();
      this.startMaxWaitTimer();
    }
    
    // Reset debounce timer
    this.resetDebounceTimer();
    
    // Check batch size
    if (this.pendingChanges.size >= this.config.maxBatchSize) {
      this.commit('Batch size limit reached');
    }
  }
  
  /**
   * Reset debounce timer
   */
  private resetDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.commit('Debounce timer expired');
    }, this.config.debounceMs);
  }
  
  /**
   * Start max wait timer
   */
  private startMaxWaitTimer(): void {
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
    }
    
    this.maxWaitTimer = setTimeout(() => {
      this.commit('Max wait time reached');
    }, this.config.maxWaitMs);
  }
  
  /**
   * Commit pending changes
   */
  private async commit(reason: string): Promise<void> {
    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
    
    // Get pending changes
    const changes = Array.from(this.pendingChanges.values());
    if (changes.length === 0) {
      return;
    }
    
    // Clear pending changes
    this.pendingChanges.clear();
    this.firstChangeTime = null;
    
    // Generate commit message
    const message = this.generateCommitMessage(changes, reason);
    
    try {
      // Stage and commit
      await this.gitService.stageFiles(changes.map(c => c.path));
      await this.gitService.commit(message);
      
      console.log(`Auto-commit: ${message} (${changes.length} files)`);
    } catch (error) {
      console.error('Auto-commit failed:', error);
      // Re-add changes to pending
      for (const change of changes) {
        this.pendingChanges.set(change.path, change);
      }
    }
  }
  
  /**
   * Generate commit message
   */
  private generateCommitMessage(changes: FileChange[], reason: string): string {
    const fileCount = changes.length;
    const types = new Set(changes.map(c => c.type));
    
    let action = 'Update';
    if (types.size === 1) {
      const type = types.values().next().value;
      action = type === 'add' ? 'Add' : type === 'delete' ? 'Delete' : 'Update';
    }
    
    // Get common directory
    const dirs = changes.map(c => c.path.split('/').slice(0, -1).join('/'));
    const commonDir = this.findCommonPrefix(dirs);
    
    if (fileCount === 1) {
      return `${action} ${changes[0].path}`;
    } else if (commonDir) {
      return `${action} ${fileCount} files in ${commonDir}`;
    } else {
      return `${action} ${fileCount} files`;
    }
  }
  
  /**
   * Check if file should be excluded
   */
  private shouldExclude(path: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      const regex = this.globToRegex(pattern);
      return regex.test(path);
    });
  }
  
  /**
   * Convert glob to regex
   */
  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*');
    return new RegExp(`^${escaped}$`);
  }
  
  /**
   * Find common prefix
   */
  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];
    
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }
  
  /**
   * Force commit now
   */
  async forceCommit(): Promise<void> {
    await this.commit('Manual trigger');
  }
  
  /**
   * Get pending changes count
   */
  getPendingCount(): number {
    return this.pendingChanges.size;
  }
}

interface FileChange {
  path: string;
  type: 'add' | 'modify' | 'delete';
  timestamp: number;
}

export { AutoCommitDebouncer, DebounceConfig, FileChange };
```

### Debounce Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AUTO-COMMIT DEBOUNCE FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  File Change Events                                                                     │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  T+0ms: File A modified                                                          │   │
│  │         Start debounce timer (2000ms)                                           │   │
│  │         Start max-wait timer (30000ms)                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  T+500ms: File B modified                                                        │   │
│  │           Reset debounce timer (2000ms from now)                                │   │
│  │           Max-wait timer continues                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  T+1200ms: File C modified                                                       │   │
│  │            Reset debounce timer (2000ms from now)                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ No more changes for 2000ms                                                      │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  T+3200ms: Debounce timer expires                                                │   │
│  │            COMMIT: "Update 3 files"                                             │   │
│  │            Clear all timers                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ALTERNATIVE: Max-wait scenario                                                         │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Continuous rapid changes for 30+ seconds                                        │   │
│  │  T+30000ms: Max-wait timer expires                                              │   │
│  │             COMMIT: "Update N files" (forced)                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Checkpoint Storage

### Storage Architecture

Checkpoints are stored **separately from the main volume** for safety and performance.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CHECKPOINT STORAGE ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX VOLUME (ephemeral)              CHECKPOINT STORAGE (persistent)                │
│  ┌─────────────────────────┐             ┌─────────────────────────────────────────┐   │
│  │  /home/ubuntu/project/  │             │  S3 Bucket: checkpoints-{region}        │   │
│  │  ├── src/               │             │  ├── {sandboxId}/                       │   │
│  │  ├── package.json       │ ──snapshot──▶│  │   ├── v1/                           │   │
│  │  ├── node_modules/      │             │  │   │   ├── files.tar.gz              │   │
│  │  └── .git/              │             │  │   │   ├── metadata.json             │   │
│  └─────────────────────────┘             │  │   │   └── git-bundle.bundle         │   │
│                                          │  │   ├── v2/                           │   │
│                                          │  │   └── latest -> v2                  │   │
│                                          │  └── index.json                        │   │
│                                          └─────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Checkpoint Storage Implementation

```typescript
// checkpoint-storage.ts

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import tar from 'tar';

interface CheckpointMetadata {
  id: string;
  sandboxId: string;
  version: number;
  createdAt: string;
  description: string;
  fileCount: number;
  totalSize: number;
  gitCommit: string;
  gitBranch: string;
}

interface CheckpointConfig {
  bucket: string;
  region: string;
  maxVersions: number;
  compressionLevel: number;
  excludePatterns: string[];
}

const defaultConfig: CheckpointConfig = {
  bucket: 'checkpoints-us2',
  region: 'us-east-2',
  maxVersions: 50,
  compressionLevel: 6,
  excludePatterns: [
    'node_modules/**',
    '.git/objects/**',
    'dist/**',
    '.next/**',
    '*.log',
    '.env.local',
  ],
};

class CheckpointStorage {
  private s3: S3Client;
  private config: CheckpointConfig;
  
  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.s3 = new S3Client({ region: this.config.region });
  }
  
  /**
   * Create checkpoint
   */
  async create(
    sandboxId: string,
    projectPath: string,
    description: string
  ): Promise<CheckpointMetadata> {
    const version = await this.getNextVersion(sandboxId);
    const checkpointId = `${sandboxId}-v${version}`;
    
    // Create tar.gz of project files
    const tarPath = `/tmp/${checkpointId}.tar.gz`;
    await this.createTarball(projectPath, tarPath);
    
    // Create git bundle
    const bundlePath = `/tmp/${checkpointId}.bundle`;
    await this.createGitBundle(projectPath, bundlePath);
    
    // Get file stats
    const stats = await this.getProjectStats(projectPath);
    const gitInfo = await this.getGitInfo(projectPath);
    
    // Upload to S3
    const s3Prefix = `${sandboxId}/v${version}`;
    
    await this.uploadFile(tarPath, `${s3Prefix}/files.tar.gz`);
    await this.uploadFile(bundlePath, `${s3Prefix}/git-bundle.bundle`);
    
    // Create and upload metadata
    const metadata: CheckpointMetadata = {
      id: checkpointId,
      sandboxId,
      version,
      createdAt: new Date().toISOString(),
      description,
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
      gitCommit: gitInfo.commit,
      gitBranch: gitInfo.branch,
    };
    
    await this.uploadMetadata(s3Prefix, metadata);
    
    // Update latest pointer
    await this.updateLatestPointer(sandboxId, version);
    
    // Cleanup old versions
    await this.cleanupOldVersions(sandboxId);
    
    // Cleanup temp files
    await fs.unlink(tarPath);
    await fs.unlink(bundlePath);
    
    return metadata;
  }
  
  /**
   * Restore checkpoint
   */
  async restore(
    sandboxId: string,
    version: number | 'latest',
    targetPath: string
  ): Promise<void> {
    const resolvedVersion = version === 'latest'
      ? await this.getLatestVersion(sandboxId)
      : version;
    
    const s3Prefix = `${sandboxId}/v${resolvedVersion}`;
    
    // Download files
    const tarPath = `/tmp/restore-${sandboxId}.tar.gz`;
    await this.downloadFile(`${s3Prefix}/files.tar.gz`, tarPath);
    
    // Clear target directory (except .git)
    await this.clearDirectory(targetPath, ['.git']);
    
    // Extract tarball
    await this.extractTarball(tarPath, targetPath);
    
    // Restore git state
    const bundlePath = `/tmp/restore-${sandboxId}.bundle`;
    await this.downloadFile(`${s3Prefix}/git-bundle.bundle`, bundlePath);
    await this.restoreGitBundle(bundlePath, targetPath);
    
    // Cleanup temp files
    await fs.unlink(tarPath);
    await fs.unlink(bundlePath);
  }
  
  /**
   * Create tarball of project
   */
  private async createTarball(sourcePath: string, destPath: string): Promise<void> {
    await tar.create(
      {
        gzip: { level: this.config.compressionLevel },
        file: destPath,
        cwd: sourcePath,
        filter: (path) => !this.shouldExclude(path),
      },
      ['.']
    );
  }
  
  /**
   * Extract tarball
   */
  private async extractTarball(tarPath: string, destPath: string): Promise<void> {
    await tar.extract({
      file: tarPath,
      cwd: destPath,
    });
  }
  
  /**
   * Create git bundle
   */
  private async createGitBundle(projectPath: string, bundlePath: string): Promise<void> {
    await execAsync(`cd ${projectPath} && git bundle create ${bundlePath} --all`);
  }
  
  /**
   * Restore git bundle
   */
  private async restoreGitBundle(bundlePath: string, projectPath: string): Promise<void> {
    // Verify bundle
    await execAsync(`git bundle verify ${bundlePath}`);
    
    // Fetch from bundle
    await execAsync(`cd ${projectPath} && git fetch ${bundlePath} '*:*'`);
  }
  
  /**
   * Upload file to S3
   */
  private async uploadFile(localPath: string, s3Key: string): Promise<void> {
    const fileStream = fs.createReadStream(localPath);
    
    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Key,
      Body: fileStream,
      ServerSideEncryption: 'AES256',
    }));
  }
  
  /**
   * Download file from S3
   */
  private async downloadFile(s3Key: string, localPath: string): Promise<void> {
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Key,
    }));
    
    const writeStream = fs.createWriteStream(localPath);
    await pipeline(response.Body as any, writeStream);
  }
  
  /**
   * Get next version number
   */
  private async getNextVersion(sandboxId: string): Promise<number> {
    const latest = await this.getLatestVersion(sandboxId);
    return latest + 1;
  }
  
  /**
   * Get latest version
   */
  private async getLatestVersion(sandboxId: string): Promise<number> {
    try {
      const response = await this.s3.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: `${sandboxId}/latest`,
      }));
      
      const body = await response.Body?.transformToString();
      return parseInt(body || '0', 10);
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Update latest pointer
   */
  private async updateLatestPointer(sandboxId: string, version: number): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: `${sandboxId}/latest`,
      Body: version.toString(),
    }));
  }
  
  /**
   * Cleanup old versions
   */
  private async cleanupOldVersions(sandboxId: string): Promise<void> {
    const versions = await this.listVersions(sandboxId);
    
    if (versions.length > this.config.maxVersions) {
      const toDelete = versions.slice(0, versions.length - this.config.maxVersions);
      
      for (const version of toDelete) {
        await this.deleteVersion(sandboxId, version);
      }
    }
  }
  
  /**
   * Check if path should be excluded
   */
  private shouldExclude(path: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(path);
    });
  }
}

export { CheckpointStorage, CheckpointMetadata, CheckpointConfig };
```

### Checkpoint Storage Comparison

| Storage Location | Pros | Cons |
|------------------|------|------|
| **Same volume** | Fast access | Lost if volume fails |
| **Separate volume** | Isolated | Still local |
| **S3 (chosen)** | Durable, scalable | Network latency |
| **Git remote** | Native versioning | Size limits |

---

## Large File Handling

### Git LFS Integration

We use **Git LFS** for files larger than 100MB.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           GIT LFS ARCHITECTURE                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX                                 LFS SERVER                                      │
│  ┌─────────────────────────┐             ┌─────────────────────────────────────────┐   │
│  │  .git/                  │             │  S3 Bucket: lfs-{region}                │   │
│  │  ├── objects/           │             │  ├── {oid-prefix}/                      │   │
│  │  │   └── (small files)  │             │  │   └── {oid}                          │   │
│  │  └── lfs/               │             │  │       (actual file content)          │   │
│  │      └── objects/       │             │  └── ...                                │   │
│  │          └── (pointers) │ ◀──fetch───▶│                                         │   │
│  │                         │             │                                         │   │
│  │  project/               │             │                                         │   │
│  │  ├── model.bin (100MB)  │──pointer───▶│  Stored as pointer in Git              │   │
│  │  └── data.csv (500MB)   │──pointer───▶│  Actual content in LFS                 │   │
│  └─────────────────────────┘             └─────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### LFS Configuration

```typescript
// lfs-manager.ts

interface LFSConfig {
  threshold: number;        // Size threshold for LFS (bytes)
  patterns: string[];       // File patterns to track
  server: string;           // LFS server URL
  batchSize: number;        // Batch upload size
}

const defaultLFSConfig: LFSConfig = {
  threshold: 100 * 1024 * 1024,  // 100 MB
  patterns: [
    '*.bin',
    '*.model',
    '*.weights',
    '*.h5',
    '*.pkl',
    '*.parquet',
    '*.zip',
    '*.tar.gz',
    '*.mp4',
    '*.mov',
  ],
  server: 'https://lfs.manus.computer',
  batchSize: 10,
};

class LFSManager {
  private config: LFSConfig;
  private gitService: GitService;
  
  constructor(gitService: GitService, config: Partial<LFSConfig> = {}) {
    this.gitService = gitService;
    this.config = { ...defaultLFSConfig, ...config };
  }
  
  /**
   * Initialize LFS for repository
   */
  async initialize(projectPath: string): Promise<void> {
    // Install LFS
    await execAsync(`cd ${projectPath} && git lfs install`);
    
    // Track patterns
    for (const pattern of this.config.patterns) {
      await execAsync(`cd ${projectPath} && git lfs track "${pattern}"`);
    }
    
    // Add .gitattributes
    await execAsync(`cd ${projectPath} && git add .gitattributes`);
  }
  
  /**
   * Check if file should use LFS
   */
  shouldUseLFS(filePath: string, size: number): boolean {
    // Check size threshold
    if (size >= this.config.threshold) {
      return true;
    }
    
    // Check patterns
    return this.config.patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    });
  }
  
  /**
   * Track file with LFS
   */
  async trackFile(projectPath: string, filePath: string): Promise<void> {
    const extension = path.extname(filePath);
    const pattern = `*${extension}`;
    
    // Check if pattern already tracked
    const tracked = await this.getTrackedPatterns(projectPath);
    if (!tracked.includes(pattern)) {
      await execAsync(`cd ${projectPath} && git lfs track "${pattern}"`);
    }
  }
  
  /**
   * Get tracked patterns
   */
  async getTrackedPatterns(projectPath: string): Promise<string[]> {
    const result = await execAsync(`cd ${projectPath} && git lfs track`);
    const lines = result.stdout.split('\n');
    
    return lines
      .filter(line => line.includes('('))
      .map(line => line.split('(')[0].trim());
  }
  
  /**
   * Migrate existing large files to LFS
   */
  async migrateToLFS(projectPath: string): Promise<void> {
    // Find large files
    const largeFiles = await this.findLargeFiles(projectPath);
    
    for (const file of largeFiles) {
      // Track the pattern
      await this.trackFile(projectPath, file.path);
    }
    
    // Migrate history (optional, can be slow)
    // await execAsync(`cd ${projectPath} && git lfs migrate import --include="*.bin,*.model" --everything`);
  }
  
  /**
   * Find large files in repository
   */
  private async findLargeFiles(projectPath: string): Promise<Array<{ path: string; size: number }>> {
    const result = await execAsync(
      `find ${projectPath} -type f -size +${this.config.threshold}c -not -path "*/node_modules/*" -not -path "*/.git/*"`
    );
    
    const files = result.stdout.split('\n').filter(Boolean);
    const largeFiles = [];
    
    for (const filePath of files) {
      const stats = await fs.stat(filePath);
      largeFiles.push({
        path: path.relative(projectPath, filePath),
        size: stats.size,
      });
    }
    
    return largeFiles;
  }
  
  /**
   * Get LFS storage usage
   */
  async getStorageUsage(projectPath: string): Promise<{ used: number; files: number }> {
    const result = await execAsync(`cd ${projectPath} && git lfs ls-files -s`);
    const lines = result.stdout.split('\n').filter(Boolean);
    
    let totalSize = 0;
    for (const line of lines) {
      const match = line.match(/\((\d+(?:\.\d+)?)\s*(KB|MB|GB)\)/);
      if (match) {
        const size = parseFloat(match[1]);
        const unit = match[2];
        const multiplier = unit === 'GB' ? 1e9 : unit === 'MB' ? 1e6 : 1e3;
        totalSize += size * multiplier;
      }
    }
    
    return {
      used: totalSize,
      files: lines.length,
    };
  }
}

export { LFSManager, LFSConfig };
```

### LFS Server Implementation

```typescript
// lfs-server.ts

import express from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface LFSBatchRequest {
  operation: 'download' | 'upload';
  transfers: string[];
  ref?: { name: string };
  objects: Array<{
    oid: string;
    size: number;
  }>;
}

interface LFSBatchResponse {
  transfer: string;
  objects: Array<{
    oid: string;
    size: number;
    authenticated: boolean;
    actions?: {
      download?: { href: string; expires_in: number };
      upload?: { href: string; expires_in: number };
    };
    error?: { code: number; message: string };
  }>;
}

class LFSServer {
  private app: express.Application;
  private s3: S3Client;
  private bucket: string;
  
  constructor(bucket: string, region: string) {
    this.bucket = bucket;
    this.s3 = new S3Client({ region });
    this.app = express();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    this.app.use(express.json());
    
    // Batch API
    this.app.post('/:owner/:repo/objects/batch', async (req, res) => {
      const { owner, repo } = req.params;
      const request: LFSBatchRequest = req.body;
      
      const response: LFSBatchResponse = {
        transfer: 'basic',
        objects: [],
      };
      
      for (const obj of request.objects) {
        const s3Key = this.getS3Key(owner, repo, obj.oid);
        
        if (request.operation === 'download') {
          // Check if object exists
          const exists = await this.objectExists(s3Key);
          
          if (exists) {
            const downloadUrl = await this.getDownloadUrl(s3Key);
            response.objects.push({
              oid: obj.oid,
              size: obj.size,
              authenticated: true,
              actions: {
                download: {
                  href: downloadUrl,
                  expires_in: 3600,
                },
              },
            });
          } else {
            response.objects.push({
              oid: obj.oid,
              size: obj.size,
              authenticated: true,
              error: {
                code: 404,
                message: 'Object not found',
              },
            });
          }
        } else if (request.operation === 'upload') {
          const uploadUrl = await this.getUploadUrl(s3Key, obj.size);
          response.objects.push({
            oid: obj.oid,
            size: obj.size,
            authenticated: true,
            actions: {
              upload: {
                href: uploadUrl,
                expires_in: 3600,
              },
            },
          });
        }
      }
      
      res.json(response);
    });
  }
  
  private getS3Key(owner: string, repo: string, oid: string): string {
    // Use first 2 chars of OID as prefix for better S3 performance
    const prefix = oid.substring(0, 2);
    return `${owner}/${repo}/${prefix}/${oid}`;
  }
  
  private async objectExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }
  
  private async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
  
  private async getUploadUrl(key: string, size: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentLength: size,
    });
    
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }
  
  start(port: number): void {
    this.app.listen(port, () => {
      console.log(`LFS server listening on port ${port}`);
    });
  }
}

export { LFSServer };
```

---

## Branch Protection

### Branch Protection Rules

```typescript
// branch-protection.ts

interface BranchProtectionRule {
  pattern: string;
  requiredReviews: number;
  requireStatusChecks: boolean;
  statusChecks: string[];
  enforceAdmins: boolean;
  allowForcePush: boolean;
  allowDeletion: boolean;
  requireLinearHistory: boolean;
  requireSignedCommits: boolean;
}

const defaultProtectionRules: BranchProtectionRule[] = [
  {
    pattern: 'main',
    requiredReviews: 0,           // Sandbox doesn't have reviewers
    requireStatusChecks: false,   // Optional for sandbox
    statusChecks: [],
    enforceAdmins: false,
    allowForcePush: false,        // Prevent force push to main
    allowDeletion: false,         // Prevent deletion of main
    requireLinearHistory: false,
    requireSignedCommits: false,
  },
  {
    pattern: 'production',
    requiredReviews: 0,
    requireStatusChecks: true,
    statusChecks: ['build', 'test'],
    enforceAdmins: true,
    allowForcePush: false,
    allowDeletion: false,
    requireLinearHistory: true,
    requireSignedCommits: false,
  },
];

class BranchProtection {
  private rules: Map<string, BranchProtectionRule> = new Map();
  private gitService: GitService;
  
  constructor(gitService: GitService) {
    this.gitService = gitService;
    
    // Load default rules
    for (const rule of defaultProtectionRules) {
      this.rules.set(rule.pattern, rule);
    }
  }
  
  /**
   * Check if operation is allowed
   */
  async checkOperation(
    branch: string,
    operation: 'push' | 'force-push' | 'delete' | 'merge'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const rule = this.getMatchingRule(branch);
    
    if (!rule) {
      return { allowed: true };
    }
    
    switch (operation) {
      case 'force-push':
        if (!rule.allowForcePush) {
          return {
            allowed: false,
            reason: `Force push is not allowed on branch '${branch}'`,
          };
        }
        break;
        
      case 'delete':
        if (!rule.allowDeletion) {
          return {
            allowed: false,
            reason: `Deletion is not allowed for branch '${branch}'`,
          };
        }
        break;
        
      case 'merge':
        if (rule.requireLinearHistory) {
          const isLinear = await this.checkLinearHistory(branch);
          if (!isLinear) {
            return {
              allowed: false,
              reason: `Branch '${branch}' requires linear history. Use rebase instead of merge.`,
            };
          }
        }
        break;
    }
    
    return { allowed: true };
  }
  
  /**
   * Get matching rule for branch
   */
  private getMatchingRule(branch: string): BranchProtectionRule | null {
    // Exact match first
    if (this.rules.has(branch)) {
      return this.rules.get(branch)!;
    }
    
    // Pattern match
    for (const [pattern, rule] of this.rules) {
      if (this.matchPattern(branch, pattern)) {
        return rule;
      }
    }
    
    return null;
  }
  
  /**
   * Match branch against pattern
   */
  private matchPattern(branch: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*') + '$'
    );
    return regex.test(branch);
  }
  
  /**
   * Check if branch has linear history
   */
  private async checkLinearHistory(branch: string): Promise<boolean> {
    try {
      // Check if there are any merge commits
      const result = await execAsync(
        `git log --merges --oneline ${branch} | head -1`
      );
      return result.stdout.trim() === '';
    } catch {
      return true;
    }
  }
  
  /**
   * Add protection rule
   */
  addRule(rule: BranchProtectionRule): void {
    this.rules.set(rule.pattern, rule);
  }
  
  /**
   * Remove protection rule
   */
  removeRule(pattern: string): void {
    this.rules.delete(pattern);
  }
  
  /**
   * Get all rules
   */
  getRules(): BranchProtectionRule[] {
    return Array.from(this.rules.values());
  }
}

export { BranchProtection, BranchProtectionRule };
```

### Git Hooks for Protection

```bash
#!/bin/bash
# .git/hooks/pre-receive

# Branch protection hook
while read oldrev newrev refname; do
  branch=$(echo "$refname" | sed 's|refs/heads/||')
  
  # Check if this is a protected branch
  protected_branches=("main" "production" "release/*")
  
  for pattern in "${protected_branches[@]}"; do
    if [[ "$branch" == $pattern ]]; then
      # Check for force push
      if [ "$oldrev" != "0000000000000000000000000000000000000000" ]; then
        # Not a new branch, check if force push
        merge_base=$(git merge-base "$oldrev" "$newrev" 2>/dev/null)
        if [ "$merge_base" != "$oldrev" ]; then
          echo "ERROR: Force push to protected branch '$branch' is not allowed"
          exit 1
        fi
      fi
      
      # Check for deletion
      if [ "$newrev" == "0000000000000000000000000000000000000000" ]; then
        echo "ERROR: Deletion of protected branch '$branch' is not allowed"
        exit 1
      fi
    fi
  done
done

exit 0
```

---

## Webhook Security

### Webhook Signature Verification

```typescript
// webhook-security.ts

import crypto from 'crypto';
import express from 'express';

interface WebhookConfig {
  secret: string;
  algorithm: 'sha1' | 'sha256';
  tolerance: number;  // Timestamp tolerance in seconds
}

const defaultWebhookConfig: WebhookConfig = {
  secret: process.env.WEBHOOK_SECRET || '',
  algorithm: 'sha256',
  tolerance: 300,  // 5 minutes
};

class WebhookSecurity {
  private config: WebhookConfig;
  
  constructor(config: Partial<WebhookConfig> = {}) {
    this.config = { ...defaultWebhookConfig, ...config };
  }
  
  /**
   * Verify GitHub webhook signature
   */
  verifyGitHubSignature(payload: string, signature: string): boolean {
    if (!signature) {
      return false;
    }
    
    // GitHub uses sha256 with 'sha256=' prefix
    const expectedSignature = this.computeSignature(payload, 'sha256');
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  }
  
  /**
   * Verify GitLab webhook token
   */
  verifyGitLabToken(token: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(this.config.secret),
      Buffer.from(token)
    );
  }
  
  /**
   * Compute HMAC signature
   */
  private computeSignature(payload: string, algorithm: string): string {
    return crypto
      .createHmac(algorithm, this.config.secret)
      .update(payload)
      .digest('hex');
  }
  
  /**
   * Express middleware for GitHub webhooks
   */
  githubMiddleware(): express.RequestHandler {
    return (req, res, next) => {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const delivery = req.headers['x-github-delivery'] as string;
      
      // Verify signature
      const payload = JSON.stringify(req.body);
      if (!this.verifyGitHubSignature(payload, signature)) {
        console.warn(`Invalid GitHub webhook signature for delivery ${delivery}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Add event info to request
      (req as any).githubEvent = event;
      (req as any).githubDelivery = delivery;
      
      next();
    };
  }
  
  /**
   * Express middleware for GitLab webhooks
   */
  gitlabMiddleware(): express.RequestHandler {
    return (req, res, next) => {
      const token = req.headers['x-gitlab-token'] as string;
      const event = req.headers['x-gitlab-event'] as string;
      
      // Verify token
      if (!this.verifyGitLabToken(token)) {
        console.warn('Invalid GitLab webhook token');
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      // Add event info to request
      (req as any).gitlabEvent = event;
      
      next();
    };
  }
}

export { WebhookSecurity, WebhookConfig };
```

### Webhook Handler Implementation

```typescript
// webhook-handler.ts

import express from 'express';
import { WebhookSecurity } from './webhook-security';

interface WebhookEvent {
  provider: 'github' | 'gitlab';
  event: string;
  payload: any;
  delivery?: string;
  timestamp: Date;
}

class WebhookHandler {
  private app: express.Application;
  private security: WebhookSecurity;
  private handlers: Map<string, (event: WebhookEvent) => Promise<void>> = new Map();
  
  constructor(app: express.Application, secret: string) {
    this.app = app;
    this.security = new WebhookSecurity({ secret });
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // GitHub webhook endpoint
    this.app.post(
      '/webhooks/github',
      express.json({ verify: this.rawBodySaver }),
      this.security.githubMiddleware(),
      this.handleGitHub.bind(this)
    );
    
    // GitLab webhook endpoint
    this.app.post(
      '/webhooks/gitlab',
      express.json(),
      this.security.gitlabMiddleware(),
      this.handleGitLab.bind(this)
    );
  }
  
  /**
   * Save raw body for signature verification
   */
  private rawBodySaver(
    req: express.Request,
    res: express.Response,
    buf: Buffer
  ): void {
    (req as any).rawBody = buf.toString();
  }
  
  /**
   * Handle GitHub webhook
   */
  private async handleGitHub(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const event: WebhookEvent = {
      provider: 'github',
      event: (req as any).githubEvent,
      payload: req.body,
      delivery: (req as any).githubDelivery,
      timestamp: new Date(),
    };
    
    // Log webhook
    console.log(`GitHub webhook: ${event.event} (${event.delivery})`);
    
    // Process asynchronously
    this.processEvent(event).catch(console.error);
    
    // Respond immediately
    res.status(200).json({ received: true });
  }
  
  /**
   * Handle GitLab webhook
   */
  private async handleGitLab(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const event: WebhookEvent = {
      provider: 'gitlab',
      event: (req as any).gitlabEvent,
      payload: req.body,
      timestamp: new Date(),
    };
    
    // Log webhook
    console.log(`GitLab webhook: ${event.event}`);
    
    // Process asynchronously
    this.processEvent(event).catch(console.error);
    
    // Respond immediately
    res.status(200).json({ received: true });
  }
  
  /**
   * Process webhook event
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    const handlerKey = `${event.provider}:${event.event}`;
    const handler = this.handlers.get(handlerKey);
    
    if (handler) {
      await handler(event);
    } else {
      console.log(`No handler for ${handlerKey}`);
    }
  }
  
  /**
   * Register event handler
   */
  on(
    provider: 'github' | 'gitlab',
    event: string,
    handler: (event: WebhookEvent) => Promise<void>
  ): void {
    this.handlers.set(`${provider}:${event}`, handler);
  }
}

// Usage example
const webhookHandler = new WebhookHandler(app, process.env.WEBHOOK_SECRET!);

// Handle push events
webhookHandler.on('github', 'push', async (event) => {
  const { repository, commits, ref } = event.payload;
  const branch = ref.replace('refs/heads/', '');
  
  console.log(`Push to ${repository.full_name}:${branch}`);
  console.log(`Commits: ${commits.length}`);
  
  // Trigger sync to sandbox
  await syncToSandbox(repository.full_name, branch);
});

// Handle pull request events
webhookHandler.on('github', 'pull_request', async (event) => {
  const { action, pull_request, repository } = event.payload;
  
  if (action === 'opened' || action === 'synchronize') {
    // Create preview deployment
    await createPreviewDeployment(
      repository.full_name,
      pull_request.head.ref,
      pull_request.number
    );
  }
});

export { WebhookHandler, WebhookEvent };
```

### Webhook Security Best Practices

| Practice | Implementation |
|----------|---------------|
| **Signature verification** | HMAC-SHA256 with timing-safe comparison |
| **Timestamp validation** | Reject events older than 5 minutes |
| **IP whitelisting** | GitHub/GitLab IP ranges |
| **Rate limiting** | 100 requests/minute per repo |
| **Idempotency** | Track delivery IDs to prevent replay |
| **Async processing** | Respond immediately, process in background |

---

## Summary

### Auto-Commit Debouncing

| Setting | Default | Purpose |
|---------|---------|---------|
| Debounce time | 2000ms | Wait after last change |
| Max wait | 30000ms | Force commit threshold |
| Batch size | 50 files | Max files per commit |

### Checkpoint Storage

| Aspect | Implementation |
|--------|---------------|
| Location | S3 (separate from sandbox) |
| Format | tar.gz + git bundle |
| Retention | 50 versions |
| Encryption | AES-256 server-side |

### Large File Handling

| Threshold | Action |
|-----------|--------|
| < 100 MB | Normal Git |
| ≥ 100 MB | Git LFS |
| Patterns | *.bin, *.model, *.weights |

### Branch Protection

| Branch | Force Push | Delete | Linear History |
|--------|------------|--------|----------------|
| main | ❌ | ❌ | Optional |
| production | ❌ | ❌ | Required |
| feature/* | ✅ | ✅ | Optional |

### Webhook Security

| Provider | Verification Method |
|----------|---------------------|
| GitHub | HMAC-SHA256 signature |
| GitLab | Secret token header |
