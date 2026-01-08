# Git Integration

This guide provides comprehensive coverage of Git integration in the sandbox environment, including auto-commit strategies, manual commit triggers, branch management, and the complete version control workflow.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Auto-Commit Strategies](#auto-commit-strategies)
4. [Manual Commit Triggers](#manual-commit-triggers)
5. [Branch Management](#branch-management)
6. [Checkpoint System](#checkpoint-system)
7. [Git Configuration](#git-configuration)
8. [Conflict Prevention](#conflict-prevention)
9. [History Management](#history-management)
10. [API Reference](#api-reference)
11. [Best Practices](#best-practices)

---

## Overview

Git integration provides version control capabilities within sandboxes, enabling users to track changes, create checkpoints, and collaborate effectively. The system balances automatic versioning with manual control.

### Integration Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **Automatic** | Background commits on save | Continuous backup |
| **Checkpoint** | User-triggered snapshots | Milestone versioning |
| **Manual** | Full Git CLI access | Advanced workflows |
| **Integrated** | GitHub/GitLab sync | Team collaboration |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              GIT INTEGRATION ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SANDBOX ENVIRONMENT                                 │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   Editor    │    │  File       │    │   Git       │    │  Checkpoint │       │   │
│  │  │   (VSCode)  │───►│  Watcher    │───►│  Service    │───►│  Manager    │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │        │                  │                  │                  │                │   │
│  │        │                  │                  │                  │                │   │
│  │        ▼                  ▼                  ▼                  ▼                │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │                         LOCAL GIT REPOSITORY                             │    │   │
│  │  │                                                                           │    │   │
│  │  │  .git/                                                                   │    │   │
│  │  │  ├── objects/     (blob, tree, commit objects)                          │    │   │
│  │  │  ├── refs/        (branches, tags)                                      │    │   │
│  │  │  ├── HEAD         (current branch pointer)                              │    │   │
│  │  │  └── config       (repository configuration)                            │    │   │
│  │  │                                                                           │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                      │                                           │   │
│  └──────────────────────────────────────┼───────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              REMOTE SERVICES                                     │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   GitHub    │    │   GitLab    │    │  Bitbucket  │    │  Platform   │       │   │
│  │  │   Remote    │    │   Remote    │    │   Remote    │    │  Backup     │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Auto-Commit Strategies

### Strategy Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AUTO-COMMIT STRATEGIES                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  STRATEGY 1: CONTINUOUS (Every Save)                                                   │
│  ─────────────────────────────────────                                                 │
│  • Commit on every file save                                                           │
│  • Maximum granularity                                                                 │
│  • High storage overhead                                                               │
│  • Best for: Learning, experimentation                                                 │
│                                                                                         │
│  STRATEGY 2: DEBOUNCED (Batched Saves)                                                 │
│  ────────────────────────────────────────                                              │
│  • Batch changes within time window (30s-5min)                                         │
│  • Balanced granularity                                                                │
│  • Moderate storage overhead                                                           │
│  • Best for: Active development                                                        │
│                                                                                         │
│  STRATEGY 3: IDLE-BASED (On Inactivity)                                               │
│  ──────────────────────────────────────                                                │
│  • Commit when user becomes idle (5-15min)                                             │
│  • Logical change grouping                                                             │
│  • Low storage overhead                                                                │
│  • Best for: Focused work sessions                                                     │
│                                                                                         │
│  STRATEGY 4: MANUAL ONLY                                                               │
│  ───────────────────────                                                               │
│  • No automatic commits                                                                │
│  • Full user control                                                                   │
│  • Minimal storage overhead                                                            │
│  • Best for: Experienced Git users                                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Auto-Commit Service Implementation

```typescript
// src/services/autoCommitService.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import chokidar from 'chokidar';

const execAsync = promisify(exec);

interface AutoCommitConfig {
  strategy: 'continuous' | 'debounced' | 'idle' | 'manual';
  debounceMs: number;
  idleTimeoutMs: number;
  excludePatterns: string[];
  commitMessageTemplate: string;
  maxCommitsPerHour: number;
  squashThreshold: number;
}

interface PendingChange {
  path: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: Date;
}

class AutoCommitService {
  private config: AutoCommitConfig;
  private watcher: chokidar.FSWatcher | null = null;
  private pendingChanges: PendingChange[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private commitCount: number = 0;
  private commitCountResetTime: Date = new Date();
  private projectPath: string;
  
  constructor(projectPath: string, config: Partial<AutoCommitConfig> = {}) {
    this.projectPath = projectPath;
    this.config = {
      strategy: 'debounced',
      debounceMs: 30000,        // 30 seconds
      idleTimeoutMs: 300000,    // 5 minutes
      excludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
        '**/.DS_Store',
        '**/coverage/**',
      ],
      commitMessageTemplate: 'Auto-save: {files} file(s) changed',
      maxCommitsPerHour: 60,
      squashThreshold: 10,
      ...config,
    };
  }
  
  async start(): Promise<void> {
    // Initialize Git repository if needed
    await this.ensureGitRepo();
    
    // Start file watcher
    this.watcher = chokidar.watch(this.projectPath, {
      ignored: this.config.excludePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });
    
    this.watcher
      .on('add', (path) => this.handleChange(path, 'add'))
      .on('change', (path) => this.handleChange(path, 'change'))
      .on('unlink', (path) => this.handleChange(path, 'unlink'));
    
    console.log(`[AutoCommit] Started with strategy: ${this.config.strategy}`);
  }
  
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    
    // Commit any pending changes
    if (this.pendingChanges.length > 0) {
      await this.commitChanges();
    }
  }
  
  private handleChange(path: string, type: 'add' | 'change' | 'unlink'): void {
    this.pendingChanges.push({
      path,
      type,
      timestamp: new Date(),
    });
    
    switch (this.config.strategy) {
      case 'continuous':
        this.commitChanges();
        break;
      case 'debounced':
        this.scheduleDebounced();
        break;
      case 'idle':
        this.scheduleIdle();
        break;
      case 'manual':
        // Do nothing, user will commit manually
        break;
    }
  }
  
  private scheduleDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.commitChanges();
    }, this.config.debounceMs);
  }
  
  private scheduleIdle(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    
    this.idleTimer = setTimeout(() => {
      this.commitChanges();
    }, this.config.idleTimeoutMs);
  }
  
  private async commitChanges(): Promise<void> {
    if (this.pendingChanges.length === 0) return;
    
    // Check rate limit
    if (!this.checkRateLimit()) {
      console.log('[AutoCommit] Rate limit reached, skipping commit');
      return;
    }
    
    const changes = [...this.pendingChanges];
    this.pendingChanges = [];
    
    try {
      // Stage changes
      await this.stageChanges(changes);
      
      // Check if there are staged changes
      const hasChanges = await this.hasStagedChanges();
      if (!hasChanges) {
        console.log('[AutoCommit] No changes to commit');
        return;
      }
      
      // Generate commit message
      const message = this.generateCommitMessage(changes);
      
      // Commit
      await execAsync(`git commit -m "${message}"`, { cwd: this.projectPath });
      
      this.commitCount++;
      console.log(`[AutoCommit] Committed: ${message}`);
      
      // Check if squashing is needed
      await this.checkSquash();
      
    } catch (error) {
      console.error('[AutoCommit] Commit failed:', error);
      // Re-add changes to pending
      this.pendingChanges.push(...changes);
    }
  }
  
  private async stageChanges(changes: PendingChange[]): Promise<void> {
    for (const change of changes) {
      const relativePath = change.path.replace(this.projectPath + '/', '');
      
      if (change.type === 'unlink') {
        await execAsync(`git rm --cached "${relativePath}" 2>/dev/null || true`, { cwd: this.projectPath });
      } else {
        await execAsync(`git add "${relativePath}"`, { cwd: this.projectPath });
      }
    }
  }
  
  private async hasStagedChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: this.projectPath });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
  
  private generateCommitMessage(changes: PendingChange[]): string {
    const fileCount = changes.length;
    const types = {
      add: changes.filter(c => c.type === 'add').length,
      change: changes.filter(c => c.type === 'change').length,
      unlink: changes.filter(c => c.type === 'unlink').length,
    };
    
    let message = this.config.commitMessageTemplate
      .replace('{files}', fileCount.toString());
    
    // Add details for small changesets
    if (fileCount <= 3) {
      const files = changes.map(c => c.path.split('/').pop()).join(', ');
      message += ` (${files})`;
    } else {
      const parts = [];
      if (types.add > 0) parts.push(`+${types.add}`);
      if (types.change > 0) parts.push(`~${types.change}`);
      if (types.unlink > 0) parts.push(`-${types.unlink}`);
      message += ` (${parts.join(', ')})`;
    }
    
    return message;
  }
  
  private checkRateLimit(): boolean {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    
    if (this.commitCountResetTime < hourAgo) {
      this.commitCount = 0;
      this.commitCountResetTime = now;
    }
    
    return this.commitCount < this.config.maxCommitsPerHour;
  }
  
  private async checkSquash(): Promise<void> {
    // Count recent auto-commits
    const { stdout } = await execAsync(
      'git log --oneline --since="1 hour ago" --grep="Auto-save" | wc -l',
      { cwd: this.projectPath }
    );
    
    const recentCommits = parseInt(stdout.trim(), 10);
    
    if (recentCommits >= this.config.squashThreshold) {
      await this.squashAutoCommits();
    }
  }
  
  private async squashAutoCommits(): Promise<void> {
    try {
      // Find the first non-auto-commit
      const { stdout } = await execAsync(
        'git log --oneline --invert-grep --grep="Auto-save" -1 --format=%H',
        { cwd: this.projectPath }
      );
      
      const baseCommit = stdout.trim();
      if (!baseCommit) return;
      
      // Soft reset to base commit
      await execAsync(`git reset --soft ${baseCommit}`, { cwd: this.projectPath });
      
      // Create squashed commit
      await execAsync(
        'git commit -m "Auto-save: Squashed multiple auto-commits"',
        { cwd: this.projectPath }
      );
      
      console.log('[AutoCommit] Squashed recent auto-commits');
    } catch (error) {
      console.error('[AutoCommit] Squash failed:', error);
    }
  }
  
  private async ensureGitRepo(): Promise<void> {
    try {
      await execAsync('git status', { cwd: this.projectPath });
    } catch {
      // Initialize new repo
      await execAsync('git init', { cwd: this.projectPath });
      await execAsync('git config user.email "sandbox@platform.dev"', { cwd: this.projectPath });
      await execAsync('git config user.name "Sandbox Auto-Commit"', { cwd: this.projectPath });
      
      // Create initial commit
      await execAsync('git add -A', { cwd: this.projectPath });
      await execAsync('git commit -m "Initial commit" --allow-empty', { cwd: this.projectPath });
      
      console.log('[AutoCommit] Initialized new Git repository');
    }
  }
  
  // Public methods for manual control
  async forceCommit(message?: string): Promise<string> {
    const changes = [...this.pendingChanges];
    this.pendingChanges = [];
    
    await execAsync('git add -A', { cwd: this.projectPath });
    
    const hasChanges = await this.hasStagedChanges();
    if (!hasChanges) {
      return 'No changes to commit';
    }
    
    const commitMessage = message || this.generateCommitMessage(changes);
    await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.projectPath });
    
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.projectPath });
    return stdout.trim();
  }
  
  getPendingChanges(): PendingChange[] {
    return [...this.pendingChanges];
  }
  
  setStrategy(strategy: AutoCommitConfig['strategy']): void {
    this.config.strategy = strategy;
    console.log(`[AutoCommit] Strategy changed to: ${strategy}`);
  }
}

export { AutoCommitService, AutoCommitConfig, PendingChange };
```

### Auto-Commit Configuration Options

```typescript
// src/config/autoCommitConfig.ts

const autoCommitPresets = {
  // For beginners - maximum safety
  beginner: {
    strategy: 'continuous' as const,
    debounceMs: 5000,
    idleTimeoutMs: 60000,
    maxCommitsPerHour: 120,
    squashThreshold: 20,
  },
  
  // For active development - balanced
  development: {
    strategy: 'debounced' as const,
    debounceMs: 30000,
    idleTimeoutMs: 300000,
    maxCommitsPerHour: 60,
    squashThreshold: 10,
  },
  
  // For focused work - minimal interruption
  focused: {
    strategy: 'idle' as const,
    debounceMs: 60000,
    idleTimeoutMs: 600000,
    maxCommitsPerHour: 30,
    squashThreshold: 5,
  },
  
  // For experienced users - full control
  expert: {
    strategy: 'manual' as const,
    debounceMs: 0,
    idleTimeoutMs: 0,
    maxCommitsPerHour: 0,
    squashThreshold: 0,
  },
};

export { autoCommitPresets };
```

---

## Manual Commit Triggers

### Commit Trigger Points

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MANUAL COMMIT TRIGGERS                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  UI TRIGGERS                                                                            │
│  ───────────                                                                            │
│  • "Save Checkpoint" button in toolbar                                                 │
│  • Keyboard shortcut (Cmd/Ctrl + Shift + S)                                           │
│  • Right-click context menu                                                            │
│  • Before closing sandbox                                                              │
│                                                                                         │
│  API TRIGGERS                                                                           │
│  ────────────                                                                           │
│  • POST /api/v1/sandboxes/{id}/checkpoint                                             │
│  • WebSocket command: { type: 'checkpoint', message: '...' }                          │
│                                                                                         │
│  AUTOMATIC TRIGGERS                                                                     │
│  ──────────────────                                                                     │
│  • Before sandbox hibernation                                                          │
│  • Before resource scaling                                                             │
│  • Before template upgrade                                                             │
│  • On session timeout                                                                  │
│                                                                                         │
│  CLI TRIGGERS                                                                           │
│  ────────────                                                                           │
│  • git commit (standard Git)                                                           │
│  • sandbox checkpoint (platform CLI)                                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Manual Commit Service

```typescript
// src/services/manualCommitService.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CommitOptions {
  message: string;
  author?: string;
  amend?: boolean;
  allowEmpty?: boolean;
  signoff?: boolean;
}

interface CommitResult {
  success: boolean;
  commitHash?: string;
  message?: string;
  error?: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

class ManualCommitService {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  async commit(options: CommitOptions): Promise<CommitResult> {
    try {
      // Stage all changes
      await execAsync('git add -A', { cwd: this.projectPath });
      
      // Check for changes
      const { stdout: statusOutput } = await execAsync(
        'git status --porcelain',
        { cwd: this.projectPath }
      );
      
      if (!statusOutput.trim() && !options.allowEmpty) {
        return {
          success: false,
          error: 'No changes to commit',
        };
      }
      
      // Build commit command
      let commitCmd = 'git commit';
      
      if (options.amend) {
        commitCmd += ' --amend';
      }
      
      if (options.allowEmpty) {
        commitCmd += ' --allow-empty';
      }
      
      if (options.signoff) {
        commitCmd += ' --signoff';
      }
      
      if (options.author) {
        commitCmd += ` --author="${options.author}"`;
      }
      
      commitCmd += ` -m "${this.escapeMessage(options.message)}"`;
      
      // Execute commit
      const { stdout: commitOutput } = await execAsync(commitCmd, { cwd: this.projectPath });
      
      // Get commit hash
      const { stdout: hashOutput } = await execAsync(
        'git rev-parse HEAD',
        { cwd: this.projectPath }
      );
      
      // Parse commit stats
      const stats = this.parseCommitStats(commitOutput);
      
      return {
        success: true,
        commitHash: hashOutput.trim(),
        message: options.message,
        ...stats,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  
  async stageFiles(files: string[]): Promise<void> {
    for (const file of files) {
      await execAsync(`git add "${file}"`, { cwd: this.projectPath });
    }
  }
  
  async unstageFiles(files: string[]): Promise<void> {
    for (const file of files) {
      await execAsync(`git reset HEAD "${file}"`, { cwd: this.projectPath });
    }
  }
  
  async getStatus(): Promise<GitStatus> {
    const { stdout } = await execAsync(
      'git status --porcelain -b',
      { cwd: this.projectPath }
    );
    
    return this.parseStatus(stdout);
  }
  
  async getDiff(staged: boolean = false): Promise<string> {
    const cmd = staged ? 'git diff --cached' : 'git diff';
    const { stdout } = await execAsync(cmd, { cwd: this.projectPath });
    return stdout;
  }
  
  private escapeMessage(message: string): string {
    return message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
  
  private parseCommitStats(output: string): { filesChanged?: number; insertions?: number; deletions?: number } {
    const match = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    
    if (match) {
      return {
        filesChanged: parseInt(match[1], 10),
        insertions: match[2] ? parseInt(match[2], 10) : 0,
        deletions: match[3] ? parseInt(match[3], 10) : 0,
      };
    }
    
    return {};
  }
  
  private parseStatus(output: string): GitStatus {
    const lines = output.split('\n').filter(l => l.trim());
    const status: GitStatus = {
      branch: '',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
    };
    
    for (const line of lines) {
      if (line.startsWith('##')) {
        // Branch info
        const branchMatch = line.match(/## (\S+?)(?:\.\.\.(\S+))?(?: \[ahead (\d+)(?:, behind (\d+))?\])?/);
        if (branchMatch) {
          status.branch = branchMatch[1];
          status.ahead = branchMatch[3] ? parseInt(branchMatch[3], 10) : 0;
          status.behind = branchMatch[4] ? parseInt(branchMatch[4], 10) : 0;
        }
      } else {
        const indexStatus = line[0];
        const workingStatus = line[1];
        const file = line.substring(3);
        
        if (indexStatus !== ' ' && indexStatus !== '?') {
          status.staged.push({ file, status: indexStatus });
        }
        if (workingStatus !== ' ' && workingStatus !== '?') {
          status.unstaged.push({ file, status: workingStatus });
        }
        if (indexStatus === '?' && workingStatus === '?') {
          status.untracked.push(file);
        }
      }
    }
    
    return status;
  }
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: Array<{ file: string; status: string }>;
  unstaged: Array<{ file: string; status: string }>;
  untracked: string[];
}

export { ManualCommitService, CommitOptions, CommitResult, GitStatus };
```

---

## Branch Management

### Branch Management UI Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           BRANCH MANAGEMENT UI                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  BRANCH SELECTOR (Dropdown)                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  🌿 main (current)                                              ▼       │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                                                                   │   │
│  │  LOCAL BRANCHES                                                                  │   │
│  │  ├── 🌿 main ✓ (current)                                                        │   │
│  │  ├── 🌿 feature/auth                                                            │   │
│  │  ├── 🌿 feature/dashboard                                                       │   │
│  │  └── 🌿 bugfix/login-error                                                      │   │
│  │                                                                                   │   │
│  │  REMOTE BRANCHES                                                                 │   │
│  │  ├── 🌐 origin/main                                                             │   │
│  │  ├── 🌐 origin/develop                                                          │   │
│  │  └── 🌐 origin/feature/api                                                      │   │
│  │                                                                                   │   │
│  │  ACTIONS                                                                         │   │
│  │  ├── [+ New Branch]                                                             │   │
│  │  ├── [↗ Push Current]                                                           │   │
│  │  ├── [↙ Pull Latest]                                                            │   │
│  │  └── [🔀 Merge Branch]                                                          │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Branch Manager Implementation

```typescript
// src/services/branchManager.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Branch {
  name: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
}

interface BranchCreateOptions {
  name: string;
  startPoint?: string;
  checkout?: boolean;
  track?: string;
}

interface MergeOptions {
  source: string;
  strategy?: 'ours' | 'theirs' | 'recursive';
  noFastForward?: boolean;
  squash?: boolean;
  message?: string;
}

class BranchManager {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  async listBranches(): Promise<Branch[]> {
    const branches: Branch[] = [];
    
    // Get local branches
    const { stdout: localOutput } = await execAsync(
      'git branch -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(authorname)|%(committerdate:iso)"',
      { cwd: this.projectPath }
    );
    
    const { stdout: currentBranch } = await execAsync(
      'git branch --show-current',
      { cwd: this.projectPath }
    );
    
    for (const line of localOutput.split('\n').filter(l => l.trim())) {
      const [name, hash, message, author, dateStr] = line.split('|');
      branches.push({
        name,
        current: name === currentBranch.trim(),
        remote: false,
        lastCommit: {
          hash,
          message,
          author,
          date: new Date(dateStr),
        },
      });
    }
    
    // Get remote branches
    const { stdout: remoteOutput } = await execAsync(
      'git branch -r -v --format="%(refname:short)|%(objectname:short)|%(subject)|%(authorname)|%(committerdate:iso)"',
      { cwd: this.projectPath }
    );
    
    for (const line of remoteOutput.split('\n').filter(l => l.trim())) {
      const [name, hash, message, author, dateStr] = line.split('|');
      if (!name.includes('HEAD')) {
        branches.push({
          name,
          current: false,
          remote: true,
          lastCommit: {
            hash,
            message,
            author,
            date: new Date(dateStr),
          },
        });
      }
    }
    
    return branches;
  }
  
  async createBranch(options: BranchCreateOptions): Promise<Branch> {
    let cmd = `git branch "${options.name}"`;
    
    if (options.startPoint) {
      cmd += ` "${options.startPoint}"`;
    }
    
    if (options.track) {
      cmd = `git branch --track "${options.name}" "${options.track}"`;
    }
    
    await execAsync(cmd, { cwd: this.projectPath });
    
    if (options.checkout) {
      await this.checkout(options.name);
    }
    
    // Return branch info
    const branches = await this.listBranches();
    return branches.find(b => b.name === options.name)!;
  }
  
  async deleteBranch(name: string, force: boolean = false): Promise<void> {
    const flag = force ? '-D' : '-d';
    await execAsync(`git branch ${flag} "${name}"`, { cwd: this.projectPath });
  }
  
  async checkout(name: string, create: boolean = false): Promise<void> {
    const flag = create ? '-b' : '';
    await execAsync(`git checkout ${flag} "${name}"`, { cwd: this.projectPath });
  }
  
  async merge(options: MergeOptions): Promise<MergeResult> {
    try {
      let cmd = `git merge "${options.source}"`;
      
      if (options.noFastForward) {
        cmd += ' --no-ff';
      }
      
      if (options.squash) {
        cmd += ' --squash';
      }
      
      if (options.strategy) {
        cmd += ` -X ${options.strategy}`;
      }
      
      if (options.message) {
        cmd += ` -m "${options.message}"`;
      }
      
      const { stdout } = await execAsync(cmd, { cwd: this.projectPath });
      
      // If squash, need to commit
      if (options.squash) {
        await execAsync(
          `git commit -m "${options.message || `Merge ${options.source}`}"`,
          { cwd: this.projectPath }
        );
      }
      
      return {
        success: true,
        message: stdout,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('CONFLICT')) {
        return {
          success: false,
          hasConflicts: true,
          conflictFiles: await this.getConflictFiles(),
          message: errorMessage,
        };
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }
  
  async rebase(onto: string, interactive: boolean = false): Promise<RebaseResult> {
    try {
      const flag = interactive ? '-i' : '';
      await execAsync(`git rebase ${flag} "${onto}"`, { cwd: this.projectPath });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        hasConflicts: true,
        message: (error as Error).message,
      };
    }
  }
  
  async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git branch --show-current', { cwd: this.projectPath });
    return stdout.trim();
  }
  
  async getConflictFiles(): Promise<string[]> {
    const { stdout } = await execAsync(
      'git diff --name-only --diff-filter=U',
      { cwd: this.projectPath }
    );
    return stdout.split('\n').filter(f => f.trim());
  }
  
  async getBranchGraph(maxCommits: number = 50): Promise<string> {
    const { stdout } = await execAsync(
      `git log --all --graph --oneline --decorate -n ${maxCommits}`,
      { cwd: this.projectPath }
    );
    return stdout;
  }
  
  async compareBranches(branch1: string, branch2: string): Promise<BranchComparison> {
    // Commits in branch2 not in branch1
    const { stdout: aheadOutput } = await execAsync(
      `git rev-list --count "${branch1}..${branch2}"`,
      { cwd: this.projectPath }
    );
    
    // Commits in branch1 not in branch2
    const { stdout: behindOutput } = await execAsync(
      `git rev-list --count "${branch2}..${branch1}"`,
      { cwd: this.projectPath }
    );
    
    // Files changed
    const { stdout: filesOutput } = await execAsync(
      `git diff --name-only "${branch1}...${branch2}"`,
      { cwd: this.projectPath }
    );
    
    return {
      ahead: parseInt(aheadOutput.trim(), 10),
      behind: parseInt(behindOutput.trim(), 10),
      filesChanged: filesOutput.split('\n').filter(f => f.trim()),
    };
  }
}

interface MergeResult {
  success: boolean;
  hasConflicts?: boolean;
  conflictFiles?: string[];
  message?: string;
}

interface RebaseResult {
  success: boolean;
  hasConflicts?: boolean;
  message?: string;
}

interface BranchComparison {
  ahead: number;
  behind: number;
  filesChanged: string[];
}

export { BranchManager, Branch, BranchCreateOptions, MergeOptions, MergeResult };
```

### Branch Protection Rules

```typescript
// src/services/branchProtection.ts

interface ProtectionRule {
  pattern: string;  // e.g., 'main', 'release/*'
  rules: {
    requirePullRequest: boolean;
    requireReviews: number;
    requireStatusChecks: string[];
    preventForcePush: boolean;
    preventDeletion: boolean;
    requireSignedCommits: boolean;
  };
}

class BranchProtection {
  private rules: ProtectionRule[] = [];
  
  addRule(rule: ProtectionRule): void {
    this.rules.push(rule);
  }
  
  checkPush(branch: string, forcePush: boolean): { allowed: boolean; reason?: string } {
    const rule = this.findMatchingRule(branch);
    
    if (!rule) {
      return { allowed: true };
    }
    
    if (forcePush && rule.rules.preventForcePush) {
      return { allowed: false, reason: 'Force push is not allowed on this branch' };
    }
    
    return { allowed: true };
  }
  
  checkDelete(branch: string): { allowed: boolean; reason?: string } {
    const rule = this.findMatchingRule(branch);
    
    if (rule?.rules.preventDeletion) {
      return { allowed: false, reason: 'This branch cannot be deleted' };
    }
    
    return { allowed: true };
  }
  
  checkMerge(targetBranch: string, hasPullRequest: boolean, reviews: number, statusChecks: string[]): { allowed: boolean; reason?: string } {
    const rule = this.findMatchingRule(targetBranch);
    
    if (!rule) {
      return { allowed: true };
    }
    
    if (rule.rules.requirePullRequest && !hasPullRequest) {
      return { allowed: false, reason: 'Pull request required for this branch' };
    }
    
    if (reviews < rule.rules.requireReviews) {
      return { allowed: false, reason: `${rule.rules.requireReviews} review(s) required` };
    }
    
    const missingChecks = rule.rules.requireStatusChecks.filter(c => !statusChecks.includes(c));
    if (missingChecks.length > 0) {
      return { allowed: false, reason: `Missing status checks: ${missingChecks.join(', ')}` };
    }
    
    return { allowed: true };
  }
  
  private findMatchingRule(branch: string): ProtectionRule | undefined {
    return this.rules.find(rule => {
      if (rule.pattern.includes('*')) {
        const regex = new RegExp('^' + rule.pattern.replace('*', '.*') + '$');
        return regex.test(branch);
      }
      return rule.pattern === branch;
    });
  }
}

export { BranchProtection, ProtectionRule };
```

---

## Checkpoint System

### Checkpoint vs Git Commit

| Feature | Git Commit | Checkpoint |
|---------|------------|------------|
| **Scope** | Code changes only | Full sandbox state |
| **Includes** | Tracked files | Files + env + deps + DB |
| **Restore** | Code only | Complete environment |
| **Storage** | Git objects | Platform backup |
| **Granularity** | Fine-grained | Milestone-based |

### Checkpoint Manager

```typescript
// src/services/checkpointManager.ts

interface Checkpoint {
  id: string;
  sandboxId: string;
  userId: string;
  gitCommitHash: string;
  description: string;
  createdAt: Date;
  metadata: {
    filesCount: number;
    totalSize: number;
    dependencies: Record<string, string>;
    envVars: string[];
    databaseSnapshot?: string;
  };
  status: 'creating' | 'ready' | 'restoring' | 'failed';
}

class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  
  async createCheckpoint(
    sandboxId: string,
    userId: string,
    description: string
  ): Promise<Checkpoint> {
    const checkpointId = this.generateCheckpointId();
    
    const checkpoint: Checkpoint = {
      id: checkpointId,
      sandboxId,
      userId,
      gitCommitHash: '',
      description,
      createdAt: new Date(),
      metadata: {
        filesCount: 0,
        totalSize: 0,
        dependencies: {},
        envVars: [],
      },
      status: 'creating',
    };
    
    this.checkpoints.set(checkpointId, checkpoint);
    
    try {
      // 1. Commit all changes
      const commitHash = await this.commitAllChanges(sandboxId, description);
      checkpoint.gitCommitHash = commitHash;
      
      // 2. Capture file metadata
      checkpoint.metadata = await this.captureMetadata(sandboxId);
      
      // 3. Backup to S3
      await this.backupToS3(sandboxId, checkpointId);
      
      // 4. Create database snapshot (if applicable)
      if (await this.hasDatabase(sandboxId)) {
        checkpoint.metadata.databaseSnapshot = await this.createDbSnapshot(sandboxId, checkpointId);
      }
      
      checkpoint.status = 'ready';
      
      return checkpoint;
    } catch (error) {
      checkpoint.status = 'failed';
      throw error;
    }
  }
  
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error('Checkpoint not found');
    }
    
    checkpoint.status = 'restoring';
    
    try {
      // 1. Restore files from S3
      await this.restoreFromS3(checkpoint.sandboxId, checkpointId);
      
      // 2. Reset Git to checkpoint commit
      await this.resetToCommit(checkpoint.sandboxId, checkpoint.gitCommitHash);
      
      // 3. Restore database (if applicable)
      if (checkpoint.metadata.databaseSnapshot) {
        await this.restoreDbSnapshot(checkpoint.sandboxId, checkpoint.metadata.databaseSnapshot);
      }
      
      // 4. Reinstall dependencies
      await this.reinstallDependencies(checkpoint.sandboxId);
      
      checkpoint.status = 'ready';
    } catch (error) {
      checkpoint.status = 'failed';
      throw error;
    }
  }
  
  async listCheckpoints(sandboxId: string): Promise<Checkpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter(c => c.sandboxId === sandboxId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return;
    
    // Delete S3 backup
    await this.deleteFromS3(checkpoint.sandboxId, checkpointId);
    
    // Delete database snapshot
    if (checkpoint.metadata.databaseSnapshot) {
      await this.deleteDbSnapshot(checkpoint.metadata.databaseSnapshot);
    }
    
    this.checkpoints.delete(checkpointId);
  }
  
  async compareCheckpoints(checkpointId1: string, checkpointId2: string): Promise<CheckpointDiff> {
    const cp1 = this.checkpoints.get(checkpointId1);
    const cp2 = this.checkpoints.get(checkpointId2);
    
    if (!cp1 || !cp2) {
      throw new Error('Checkpoint not found');
    }
    
    // Get Git diff between commits
    const diff = await this.getGitDiff(cp1.sandboxId, cp1.gitCommitHash, cp2.gitCommitHash);
    
    return {
      filesAdded: diff.added,
      filesModified: diff.modified,
      filesDeleted: diff.deleted,
      dependenciesChanged: this.compareDependencies(cp1.metadata.dependencies, cp2.metadata.dependencies),
    };
  }
  
  // Helper methods
  private generateCheckpointId(): string {
    return `cp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  private async commitAllChanges(sandboxId: string, message: string): Promise<string> {
    // Implementation
    return '';
  }
  
  private async captureMetadata(sandboxId: string): Promise<Checkpoint['metadata']> {
    return {
      filesCount: 0,
      totalSize: 0,
      dependencies: {},
      envVars: [],
    };
  }
  
  private async backupToS3(sandboxId: string, checkpointId: string): Promise<void> {}
  private async restoreFromS3(sandboxId: string, checkpointId: string): Promise<void> {}
  private async deleteFromS3(sandboxId: string, checkpointId: string): Promise<void> {}
  private async hasDatabase(sandboxId: string): Promise<boolean> { return false; }
  private async createDbSnapshot(sandboxId: string, checkpointId: string): Promise<string> { return ''; }
  private async restoreDbSnapshot(sandboxId: string, snapshotId: string): Promise<void> {}
  private async deleteDbSnapshot(snapshotId: string): Promise<void> {}
  private async resetToCommit(sandboxId: string, commitHash: string): Promise<void> {}
  private async reinstallDependencies(sandboxId: string): Promise<void> {}
  private async getGitDiff(sandboxId: string, hash1: string, hash2: string): Promise<any> { return {}; }
  private compareDependencies(deps1: Record<string, string>, deps2: Record<string, string>): any { return {}; }
}

interface CheckpointDiff {
  filesAdded: string[];
  filesModified: string[];
  filesDeleted: string[];
  dependenciesChanged: {
    added: Record<string, string>;
    removed: Record<string, string>;
    updated: Record<string, { from: string; to: string }>;
  };
}

export { CheckpointManager, Checkpoint, CheckpointDiff };
```

---

## Git Configuration

### Default Git Configuration

```typescript
// src/services/gitConfiguration.ts

interface GitConfig {
  user: {
    name: string;
    email: string;
  };
  core: {
    autocrlf: 'input' | 'true' | 'false';
    safecrlf: boolean;
    filemode: boolean;
    ignorecase: boolean;
  };
  init: {
    defaultBranch: string;
  };
  pull: {
    rebase: boolean;
  };
  push: {
    default: 'simple' | 'current' | 'upstream' | 'matching';
    autoSetupRemote: boolean;
  };
  merge: {
    ff: 'only' | 'true' | 'false';
  };
  diff: {
    algorithm: 'default' | 'patience' | 'minimal' | 'histogram';
  };
  alias: Record<string, string>;
}

const defaultGitConfig: GitConfig = {
  user: {
    name: 'Sandbox User',
    email: 'user@sandbox.dev',
  },
  core: {
    autocrlf: 'input',
    safecrlf: true,
    filemode: false,
    ignorecase: true,
  },
  init: {
    defaultBranch: 'main',
  },
  pull: {
    rebase: true,
  },
  push: {
    default: 'current',
    autoSetupRemote: true,
  },
  merge: {
    ff: 'false',
  },
  diff: {
    algorithm: 'histogram',
  },
  alias: {
    st: 'status',
    co: 'checkout',
    br: 'branch',
    ci: 'commit',
    lg: 'log --oneline --graph --decorate',
  },
};

class GitConfigurator {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  async applyConfig(config: Partial<GitConfig>): Promise<void> {
    const fullConfig = { ...defaultGitConfig, ...config };
    
    // User config
    await this.setConfig('user.name', fullConfig.user.name);
    await this.setConfig('user.email', fullConfig.user.email);
    
    // Core config
    await this.setConfig('core.autocrlf', fullConfig.core.autocrlf);
    await this.setConfig('core.safecrlf', fullConfig.core.safecrlf.toString());
    await this.setConfig('core.filemode', fullConfig.core.filemode.toString());
    await this.setConfig('core.ignorecase', fullConfig.core.ignorecase.toString());
    
    // Init config
    await this.setConfig('init.defaultBranch', fullConfig.init.defaultBranch);
    
    // Pull config
    await this.setConfig('pull.rebase', fullConfig.pull.rebase.toString());
    
    // Push config
    await this.setConfig('push.default', fullConfig.push.default);
    await this.setConfig('push.autoSetupRemote', fullConfig.push.autoSetupRemote.toString());
    
    // Merge config
    await this.setConfig('merge.ff', fullConfig.merge.ff);
    
    // Diff config
    await this.setConfig('diff.algorithm', fullConfig.diff.algorithm);
    
    // Aliases
    for (const [alias, command] of Object.entries(fullConfig.alias)) {
      await this.setConfig(`alias.${alias}`, command);
    }
  }
  
  private async setConfig(key: string, value: string): Promise<void> {
    await execAsync(`git config "${key}" "${value}"`, { cwd: this.projectPath });
  }
  
  async getConfig(key: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`git config "${key}"`, { cwd: this.projectPath });
      return stdout.trim();
    } catch {
      return null;
    }
  }
}

export { GitConfigurator, GitConfig, defaultGitConfig };
```

### .gitignore Template

```typescript
// src/templates/gitignore.ts

const gitignoreTemplates: Record<string, string[]> = {
  node: [
    'node_modules/',
    'dist/',
    'build/',
    '.npm',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    '.env',
    '.env.local',
    '.env.*.local',
    'coverage/',
    '.nyc_output/',
  ],
  python: [
    '__pycache__/',
    '*.py[cod]',
    '*$py.class',
    '*.so',
    '.Python',
    'venv/',
    'env/',
    '.env',
    '*.egg-info/',
    'dist/',
    'build/',
    '.pytest_cache/',
    '.coverage',
    'htmlcov/',
  ],
  common: [
    '.DS_Store',
    'Thumbs.db',
    '*.swp',
    '*.swo',
    '*~',
    '.idea/',
    '.vscode/',
    '*.sublime-*',
  ],
  sandbox: [
    '.sandbox/',
    '.checkpoints/',
    '*.sandbox.log',
  ],
};

function generateGitignore(projectType: string): string {
  const patterns: string[] = [
    ...gitignoreTemplates.common,
    ...gitignoreTemplates.sandbox,
    ...(gitignoreTemplates[projectType] || []),
  ];
  
  return patterns.join('\n') + '\n';
}

export { gitignoreTemplates, generateGitignore };
```

---

## Conflict Prevention

### Strategies to Prevent Conflicts

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CONFLICT PREVENTION STRATEGIES                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. FREQUENT SYNC                                                                       │
│  ─────────────────                                                                      │
│  • Auto-pull before starting work                                                      │
│  • Auto-push after commits                                                             │
│  • Background sync every 5 minutes                                                     │
│                                                                                         │
│  2. BRANCH ISOLATION                                                                    │
│  ────────────────────                                                                   │
│  • Each user works on separate branch                                                  │
│  • Merge to main via pull request                                                      │
│  • Short-lived feature branches                                                        │
│                                                                                         │
│  3. FILE LOCKING (Optional)                                                            │
│  ──────────────────────────                                                            │
│  • Lock files being edited                                                             │
│  • Warn when editing locked files                                                      │
│  • Auto-release on save/close                                                          │
│                                                                                         │
│  4. REAL-TIME AWARENESS                                                                │
│  ────────────────────────                                                              │
│  • Show who is editing what                                                            │
│  • Highlight potentially conflicting changes                                           │
│  • Notify before conflict occurs                                                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Conflict Prevention Service

```typescript
// src/services/conflictPrevention.ts

interface FileEdit {
  userId: string;
  sandboxId: string;
  filePath: string;
  startedAt: Date;
  lastActivity: Date;
}

class ConflictPreventionService {
  private activeEdits: Map<string, FileEdit[]> = new Map();
  private fileLocks: Map<string, { userId: string; lockedAt: Date }> = new Map();
  
  // Track when a user starts editing a file
  startEditing(userId: string, sandboxId: string, filePath: string): EditWarning | null {
    const key = `${sandboxId}:${filePath}`;
    
    // Check for existing edits
    const existingEdits = this.activeEdits.get(key) || [];
    const otherEdits = existingEdits.filter(e => e.userId !== userId);
    
    // Add this edit
    const edit: FileEdit = {
      userId,
      sandboxId,
      filePath,
      startedAt: new Date(),
      lastActivity: new Date(),
    };
    
    this.activeEdits.set(key, [...existingEdits.filter(e => e.userId !== userId), edit]);
    
    // Return warning if others are editing
    if (otherEdits.length > 0) {
      return {
        type: 'concurrent_edit',
        message: `${otherEdits.length} other user(s) are editing this file`,
        users: otherEdits.map(e => e.userId),
      };
    }
    
    return null;
  }
  
  // Track activity to keep edit session alive
  updateActivity(userId: string, sandboxId: string, filePath: string): void {
    const key = `${sandboxId}:${filePath}`;
    const edits = this.activeEdits.get(key) || [];
    
    const edit = edits.find(e => e.userId === userId);
    if (edit) {
      edit.lastActivity = new Date();
    }
  }
  
  // Stop tracking when user closes file
  stopEditing(userId: string, sandboxId: string, filePath: string): void {
    const key = `${sandboxId}:${filePath}`;
    const edits = this.activeEdits.get(key) || [];
    
    this.activeEdits.set(key, edits.filter(e => e.userId !== userId));
  }
  
  // Lock a file for exclusive editing
  lockFile(userId: string, sandboxId: string, filePath: string): LockResult {
    const key = `${sandboxId}:${filePath}`;
    
    const existingLock = this.fileLocks.get(key);
    if (existingLock && existingLock.userId !== userId) {
      return {
        success: false,
        lockedBy: existingLock.userId,
        lockedAt: existingLock.lockedAt,
      };
    }
    
    this.fileLocks.set(key, { userId, lockedAt: new Date() });
    
    return { success: true };
  }
  
  // Release a file lock
  unlockFile(userId: string, sandboxId: string, filePath: string): boolean {
    const key = `${sandboxId}:${filePath}`;
    
    const lock = this.fileLocks.get(key);
    if (lock && lock.userId === userId) {
      this.fileLocks.delete(key);
      return true;
    }
    
    return false;
  }
  
  // Check if a file is locked
  isFileLocked(sandboxId: string, filePath: string): { locked: boolean; lockedBy?: string } {
    const key = `${sandboxId}:${filePath}`;
    const lock = this.fileLocks.get(key);
    
    if (lock) {
      return { locked: true, lockedBy: lock.userId };
    }
    
    return { locked: false };
  }
  
  // Get all active edits for a sandbox
  getActiveEdits(sandboxId: string): FileEdit[] {
    const edits: FileEdit[] = [];
    
    for (const [key, fileEdits] of this.activeEdits.entries()) {
      if (key.startsWith(`${sandboxId}:`)) {
        edits.push(...fileEdits);
      }
    }
    
    return edits;
  }
  
  // Clean up stale edits (no activity for 10 minutes)
  cleanupStaleEdits(): void {
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const now = new Date();
    
    for (const [key, edits] of this.activeEdits.entries()) {
      const activeEdits = edits.filter(
        e => now.getTime() - e.lastActivity.getTime() < staleThreshold
      );
      
      if (activeEdits.length === 0) {
        this.activeEdits.delete(key);
      } else {
        this.activeEdits.set(key, activeEdits);
      }
    }
  }
}

interface EditWarning {
  type: 'concurrent_edit' | 'file_locked';
  message: string;
  users?: string[];
}

interface LockResult {
  success: boolean;
  lockedBy?: string;
  lockedAt?: Date;
}

export { ConflictPreventionService, FileEdit, EditWarning, LockResult };
```

---

## History Management

### Git History Viewer

```typescript
// src/services/historyManager.ts

interface CommitInfo {
  hash: string;
  shortHash: string;
  author: {
    name: string;
    email: string;
  };
  date: Date;
  message: string;
  parents: string[];
  stats?: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

interface FileHistory {
  path: string;
  commits: CommitInfo[];
}

class HistoryManager {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  async getCommitLog(options: {
    branch?: string;
    maxCount?: number;
    since?: Date;
    until?: Date;
    author?: string;
    grep?: string;
  } = {}): Promise<CommitInfo[]> {
    let cmd = 'git log --format="%H|%h|%an|%ae|%aI|%s|%P"';
    
    if (options.branch) {
      cmd += ` ${options.branch}`;
    }
    
    if (options.maxCount) {
      cmd += ` -n ${options.maxCount}`;
    }
    
    if (options.since) {
      cmd += ` --since="${options.since.toISOString()}"`;
    }
    
    if (options.until) {
      cmd += ` --until="${options.until.toISOString()}"`;
    }
    
    if (options.author) {
      cmd += ` --author="${options.author}"`;
    }
    
    if (options.grep) {
      cmd += ` --grep="${options.grep}"`;
    }
    
    const { stdout } = await execAsync(cmd, { cwd: this.projectPath });
    
    return stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, shortHash, authorName, authorEmail, date, message, parents] = line.split('|');
        return {
          hash,
          shortHash,
          author: { name: authorName, email: authorEmail },
          date: new Date(date),
          message,
          parents: parents ? parents.split(' ') : [],
        };
      });
  }
  
  async getFileHistory(filePath: string, maxCount: number = 50): Promise<FileHistory> {
    const { stdout } = await execAsync(
      `git log --format="%H|%h|%an|%ae|%aI|%s" -n ${maxCount} -- "${filePath}"`,
      { cwd: this.projectPath }
    );
    
    const commits = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, shortHash, authorName, authorEmail, date, message] = line.split('|');
        return {
          hash,
          shortHash,
          author: { name: authorName, email: authorEmail },
          date: new Date(date),
          message,
          parents: [],
        };
      });
    
    return { path: filePath, commits };
  }
  
  async getCommitDetails(commitHash: string): Promise<CommitInfo & { files: FileChange[] }> {
    // Get commit info
    const { stdout: infoOutput } = await execAsync(
      `git show --format="%H|%h|%an|%ae|%aI|%s|%P" --stat ${commitHash}`,
      { cwd: this.projectPath }
    );
    
    const lines = infoOutput.split('\n');
    const [hash, shortHash, authorName, authorEmail, date, message, parents] = lines[0].split('|');
    
    // Parse file changes
    const files: FileChange[] = [];
    for (let i = 2; i < lines.length - 1; i++) {
      const match = lines[i].match(/^\s*(.+?)\s+\|\s+(\d+)\s+(\++)?(-+)?/);
      if (match) {
        files.push({
          path: match[1].trim(),
          changes: parseInt(match[2], 10),
          insertions: (match[3] || '').length,
          deletions: (match[4] || '').length,
        });
      }
    }
    
    // Parse stats from last line
    const statsMatch = lines[lines.length - 1].match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    
    return {
      hash,
      shortHash,
      author: { name: authorName, email: authorEmail },
      date: new Date(date),
      message,
      parents: parents ? parents.split(' ') : [],
      stats: statsMatch ? {
        filesChanged: parseInt(statsMatch[1], 10),
        insertions: statsMatch[2] ? parseInt(statsMatch[2], 10) : 0,
        deletions: statsMatch[3] ? parseInt(statsMatch[3], 10) : 0,
      } : undefined,
      files,
    };
  }
  
  async getFileDiff(commitHash: string, filePath: string): Promise<string> {
    const { stdout } = await execAsync(
      `git show ${commitHash} -- "${filePath}"`,
      { cwd: this.projectPath }
    );
    return stdout;
  }
  
  async getFileAtCommit(commitHash: string, filePath: string): Promise<string> {
    const { stdout } = await execAsync(
      `git show ${commitHash}:"${filePath}"`,
      { cwd: this.projectPath }
    );
    return stdout;
  }
  
  async blame(filePath: string): Promise<BlameLine[]> {
    const { stdout } = await execAsync(
      `git blame --line-porcelain "${filePath}"`,
      { cwd: this.projectPath }
    );
    
    const lines: BlameLine[] = [];
    const chunks = stdout.split(/^([a-f0-9]{40})/m).filter(c => c.trim());
    
    for (let i = 0; i < chunks.length; i += 2) {
      const hash = chunks[i];
      const info = chunks[i + 1];
      
      const authorMatch = info.match(/author (.+)/);
      const timeMatch = info.match(/author-time (\d+)/);
      const lineMatch = info.match(/\t(.*)$/m);
      
      lines.push({
        hash,
        author: authorMatch ? authorMatch[1] : 'Unknown',
        date: timeMatch ? new Date(parseInt(timeMatch[1], 10) * 1000) : new Date(),
        line: lineMatch ? lineMatch[1] : '',
      });
    }
    
    return lines;
  }
  
  async search(query: string, options: { type: 'commit' | 'code' | 'file' } = { type: 'commit' }): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    switch (options.type) {
      case 'commit':
        const { stdout: commitOutput } = await execAsync(
          `git log --all --grep="${query}" --format="%H|%s|%an|%aI"`,
          { cwd: this.projectPath }
        );
        for (const line of commitOutput.split('\n').filter(l => l.trim())) {
          const [hash, message, author, date] = line.split('|');
          results.push({ type: 'commit', hash, message, author, date: new Date(date) });
        }
        break;
        
      case 'code':
        const { stdout: codeOutput } = await execAsync(
          `git grep -n "${query}"`,
          { cwd: this.projectPath }
        );
        for (const line of codeOutput.split('\n').filter(l => l.trim())) {
          const [file, lineNum, ...content] = line.split(':');
          results.push({ type: 'code', file, lineNumber: parseInt(lineNum, 10), content: content.join(':') });
        }
        break;
        
      case 'file':
        const { stdout: fileOutput } = await execAsync(
          `git ls-files "*${query}*"`,
          { cwd: this.projectPath }
        );
        for (const file of fileOutput.split('\n').filter(f => f.trim())) {
          results.push({ type: 'file', file });
        }
        break;
    }
    
    return results;
  }
}

interface FileChange {
  path: string;
  changes: number;
  insertions: number;
  deletions: number;
}

interface BlameLine {
  hash: string;
  author: string;
  date: Date;
  line: string;
}

interface SearchResult {
  type: 'commit' | 'code' | 'file';
  hash?: string;
  message?: string;
  author?: string;
  date?: Date;
  file?: string;
  lineNumber?: number;
  content?: string;
}

export { HistoryManager, CommitInfo, FileHistory, BlameLine, SearchResult };
```

---

## API Reference

### REST API Endpoints

```yaml
# openapi.yaml (partial)
paths:
  /api/v1/sandboxes/{sandboxId}/git/status:
    get:
      summary: Get Git status
      responses:
        '200':
          description: Git status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GitStatus'

  /api/v1/sandboxes/{sandboxId}/git/commit:
    post:
      summary: Create a commit
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                files:
                  type: array
                  items:
                    type: string
      responses:
        '200':
          description: Commit created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CommitResult'

  /api/v1/sandboxes/{sandboxId}/git/branches:
    get:
      summary: List branches
      responses:
        '200':
          description: Branch list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Branch'
    post:
      summary: Create a branch
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                startPoint:
                  type: string
                checkout:
                  type: boolean
      responses:
        '201':
          description: Branch created

  /api/v1/sandboxes/{sandboxId}/git/checkout:
    post:
      summary: Checkout a branch or commit
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                target:
                  type: string
                create:
                  type: boolean
      responses:
        '200':
          description: Checkout successful

  /api/v1/sandboxes/{sandboxId}/checkpoints:
    get:
      summary: List checkpoints
      responses:
        '200':
          description: Checkpoint list
    post:
      summary: Create a checkpoint
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                description:
                  type: string
      responses:
        '201':
          description: Checkpoint created

  /api/v1/sandboxes/{sandboxId}/checkpoints/{checkpointId}/restore:
    post:
      summary: Restore a checkpoint
      responses:
        '200':
          description: Checkpoint restored
```

---

## Best Practices

### 1. Commit Message Guidelines

```typescript
// Commit message format
const commitMessageFormat = `
<type>(<scope>): <subject>

<body>

<footer>
`;

// Types
const commitTypes = [
  'feat',     // New feature
  'fix',      // Bug fix
  'docs',     // Documentation
  'style',    // Formatting
  'refactor', // Code restructuring
  'test',     // Tests
  'chore',    // Maintenance
];

// Example
const exampleCommit = `
feat(auth): add OAuth2 login support

Implement OAuth2 authentication flow with Google and GitHub providers.
Includes token refresh and session management.

Closes #123
`;
```

### 2. Branch Naming Conventions

```typescript
const branchNamingConventions = {
  feature: 'feature/<ticket-id>-<short-description>',
  bugfix: 'bugfix/<ticket-id>-<short-description>',
  hotfix: 'hotfix/<version>-<short-description>',
  release: 'release/<version>',
  
  examples: [
    'feature/AUTH-123-oauth-login',
    'bugfix/UI-456-button-alignment',
    'hotfix/1.2.1-security-patch',
    'release/2.0.0',
  ],
};
```

### 3. When to Create Checkpoints

```typescript
const checkpointGuidelines = {
  always: [
    'Before major refactoring',
    'After completing a feature',
    'Before upgrading dependencies',
    'Before database migrations',
    'Before deploying to production',
  ],
  
  consider: [
    'After significant debugging sessions',
    'Before experimenting with new approaches',
    'At end of work day',
    'Before sharing with collaborators',
  ],
  
  avoid: [
    'After every small change (use auto-commit)',
    'When work is incomplete/broken',
    'Without meaningful description',
  ],
};
```

---

## Summary

### Git Integration Features

| Feature | Implementation | Use Case |
|---------|---------------|----------|
| **Auto-Commit** | Configurable strategies | Continuous backup |
| **Manual Commit** | UI, API, CLI triggers | Milestone versioning |
| **Branch Management** | Full CRUD operations | Feature isolation |
| **Checkpoints** | Full state snapshots | Environment restore |
| **Conflict Prevention** | Edit tracking, file locks | Team collaboration |
| **History Management** | Log, blame, search | Code archaeology |

### Auto-Commit Strategies

| Strategy | Interval | Best For |
|----------|----------|----------|
| Continuous | Every save | Beginners |
| Debounced | 30s batches | Active development |
| Idle-based | 5min idle | Focused work |
| Manual | User-triggered | Experts |

### Implementation Checklist

- [ ] Auto-commit service with configurable strategies
- [ ] Manual commit with staging support
- [ ] Branch CRUD operations
- [ ] Branch protection rules
- [ ] Checkpoint creation and restoration
- [ ] Conflict prevention with edit tracking
- [ ] History viewer with blame and search
- [ ] Git configuration management
- [ ] API endpoints documented
