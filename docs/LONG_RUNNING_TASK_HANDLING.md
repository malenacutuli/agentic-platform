# Long-Running Task Handling

This guide provides comprehensive coverage of how AI agents handle long-running tasks, including checkpointing strategies, progress reporting, timeout management, and task resumption.

---

## Table of Contents

1. [Overview](#overview)
2. [Task Lifecycle](#task-lifecycle)
3. [Checkpointing System](#checkpointing-system)
4. [Progress Reporting](#progress-reporting)
5. [Timeout Handling](#timeout-handling)
6. [Task Resumption](#task-resumption)
7. [Resource Management](#resource-management)
8. [Failure Recovery](#failure-recovery)
9. [Best Practices](#best-practices)

---

## Overview

Long-running tasks in AI agent systems require special handling to ensure reliability, recoverability, and user visibility. This includes periodic checkpointing, progress updates, graceful timeout handling, and the ability to resume interrupted tasks.

### Long-Running Task Characteristics

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        LONG-RUNNING TASK CHARACTERISTICS                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  DURATION                                                                               │
│  ├── Short: < 1 minute (single command)                                                 │
│  ├── Medium: 1-10 minutes (feature implementation)                                      │
│  ├── Long: 10-60 minutes (complex feature)                                              │
│  └── Extended: > 1 hour (full project)                                                  │
│                                                                                         │
│  CHALLENGES                                                                             │
│  ├── Network disconnections                                                             │
│  ├── Session timeouts                                                                   │
│  ├── Sandbox hibernation                                                                │
│  ├── User context loss                                                                  │
│  ├── Resource exhaustion                                                                │
│  └── Partial completion states                                                          │
│                                                                                         │
│  REQUIREMENTS                                                                           │
│  ├── Periodic state persistence                                                         │
│  ├── Progress visibility                                                                │
│  ├── Graceful interruption handling                                                     │
│  ├── Resumable execution                                                                │
│  └── Resource monitoring                                                                │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Task Duration Categories

| Category | Duration | Checkpoint Frequency | Progress Updates |
|----------|----------|---------------------|------------------|
| **Short** | < 1 min | End only | None |
| **Medium** | 1-10 min | Every phase | Per phase |
| **Long** | 10-60 min | Every 5 min | Every 2 min |
| **Extended** | > 1 hour | Every 5 min | Every 2 min |

---

## Task Lifecycle

### Lifecycle States

```typescript
// types/taskLifecycle.ts

enum TaskState {
  CREATED = 'created',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  CHECKPOINTING = 'checkpointing',
  RESUMING = 'resuming',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

interface TaskLifecycle {
  taskId: string;
  state: TaskState;
  createdAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  lastCheckpoint?: Date;
  lastProgress?: Date;
  totalDuration: number;
  activeDuration: number;
}

interface TaskTransition {
  from: TaskState;
  to: TaskState;
  trigger: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

### Lifecycle Manager

```typescript
// server/agent/lifecycleManager.ts

import { TaskState, TaskLifecycle, TaskTransition } from '../types/taskLifecycle';

/**
 * Manage task lifecycle states and transitions
 */
class TaskLifecycleManager {
  private tasks: Map<string, TaskLifecycle> = new Map();
  private transitions: Map<string, TaskTransition[]> = new Map();

  // Valid state transitions
  private validTransitions: Record<TaskState, TaskState[]> = {
    [TaskState.CREATED]: [TaskState.PLANNING, TaskState.CANCELLED],
    [TaskState.PLANNING]: [TaskState.EXECUTING, TaskState.FAILED, TaskState.CANCELLED],
    [TaskState.EXECUTING]: [
      TaskState.PAUSED,
      TaskState.CHECKPOINTING,
      TaskState.COMPLETING,
      TaskState.FAILED,
      TaskState.CANCELLED,
    ],
    [TaskState.PAUSED]: [TaskState.RESUMING, TaskState.CANCELLED],
    [TaskState.CHECKPOINTING]: [TaskState.EXECUTING, TaskState.PAUSED, TaskState.FAILED],
    [TaskState.RESUMING]: [TaskState.EXECUTING, TaskState.FAILED],
    [TaskState.COMPLETING]: [TaskState.COMPLETED, TaskState.FAILED],
    [TaskState.COMPLETED]: [],
    [TaskState.FAILED]: [TaskState.RESUMING],
    [TaskState.CANCELLED]: [],
  };

  /**
   * Create new task
   */
  createTask(taskId: string): TaskLifecycle {
    const lifecycle: TaskLifecycle = {
      taskId,
      state: TaskState.CREATED,
      createdAt: new Date(),
      totalDuration: 0,
      activeDuration: 0,
    };

    this.tasks.set(taskId, lifecycle);
    this.transitions.set(taskId, []);

    return lifecycle;
  }

  /**
   * Transition task to new state
   */
  transition(
    taskId: string,
    newState: TaskState,
    trigger: string,
    metadata?: Record<string, any>
  ): TaskLifecycle {
    const lifecycle = this.tasks.get(taskId);
    if (!lifecycle) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Validate transition
    if (!this.validTransitions[lifecycle.state].includes(newState)) {
      throw new Error(
        `Invalid transition from ${lifecycle.state} to ${newState}`
      );
    }

    // Record transition
    const transition: TaskTransition = {
      from: lifecycle.state,
      to: newState,
      trigger,
      timestamp: new Date(),
      metadata,
    };
    this.transitions.get(taskId)?.push(transition);

    // Update lifecycle
    const now = new Date();
    const previousState = lifecycle.state;

    lifecycle.state = newState;

    // Update timestamps based on state
    switch (newState) {
      case TaskState.PLANNING:
      case TaskState.EXECUTING:
        if (!lifecycle.startedAt) {
          lifecycle.startedAt = now;
        }
        break;

      case TaskState.PAUSED:
        lifecycle.pausedAt = now;
        break;

      case TaskState.RESUMING:
        // Calculate paused duration
        if (lifecycle.pausedAt) {
          const pausedDuration = now.getTime() - lifecycle.pausedAt.getTime();
          lifecycle.totalDuration += pausedDuration;
        }
        break;

      case TaskState.CHECKPOINTING:
        lifecycle.lastCheckpoint = now;
        break;

      case TaskState.COMPLETED:
      case TaskState.FAILED:
      case TaskState.CANCELLED:
        lifecycle.completedAt = now;
        if (lifecycle.startedAt) {
          lifecycle.activeDuration = 
            now.getTime() - lifecycle.startedAt.getTime() - 
            (lifecycle.totalDuration - lifecycle.activeDuration);
        }
        break;
    }

    return lifecycle;
  }

  /**
   * Get task lifecycle
   */
  getLifecycle(taskId: string): TaskLifecycle | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get task transitions
   */
  getTransitions(taskId: string): TaskTransition[] {
    return this.transitions.get(taskId) || [];
  }

  /**
   * Check if task can be resumed
   */
  canResume(taskId: string): boolean {
    const lifecycle = this.tasks.get(taskId);
    if (!lifecycle) return false;

    return [TaskState.PAUSED, TaskState.FAILED].includes(lifecycle.state);
  }

  /**
   * Get active duration
   */
  getActiveDuration(taskId: string): number {
    const lifecycle = this.tasks.get(taskId);
    if (!lifecycle || !lifecycle.startedAt) return 0;

    if (lifecycle.completedAt) {
      return lifecycle.activeDuration;
    }

    // Task still running
    const now = new Date();
    return now.getTime() - lifecycle.startedAt.getTime();
  }
}

export const taskLifecycleManager = new TaskLifecycleManager();
```

### Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TASK LIFECYCLE FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                              ┌──────────┐                                               │
│                              │ CREATED  │                                               │
│                              └────┬─────┘                                               │
│                                   │                                                     │
│                                   ▼                                                     │
│                              ┌──────────┐                                               │
│                              │ PLANNING │                                               │
│                              └────┬─────┘                                               │
│                                   │                                                     │
│                                   ▼                                                     │
│         ┌─────────────────► ┌──────────┐ ◄─────────────────┐                           │
│         │                   │EXECUTING │                   │                           │
│         │                   └────┬─────┘                   │                           │
│         │                        │                         │                           │
│         │          ┌─────────────┼─────────────┐          │                           │
│         │          │             │             │          │                           │
│         │          ▼             ▼             ▼          │                           │
│         │    ┌──────────┐ ┌───────────┐ ┌──────────┐     │                           │
│         │    │  PAUSED  │ │CHECKPOINT │ │COMPLETING│     │                           │
│         │    └────┬─────┘ └─────┬─────┘ └────┬─────┘     │                           │
│         │         │             │             │          │                           │
│         │         ▼             │             ▼          │                           │
│         │    ┌──────────┐       │       ┌──────────┐     │                           │
│         │    │ RESUMING │───────┘       │COMPLETED │     │                           │
│         │    └────┬─────┘               └──────────┘     │                           │
│         │         │                                      │                           │
│         └─────────┘                                      │                           │
│                                                          │                           │
│         ┌──────────┐                              ┌──────────┐                       │
│         │  FAILED  │ ◄────────────────────────────│CANCELLED │                       │
│         └────┬─────┘                              └──────────┘                       │
│              │                                                                       │
│              └─────────────── (can resume) ──────────────────┘                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Checkpointing System

### Checkpoint Types

```typescript
// types/checkpoint.ts

enum CheckpointType {
  AUTOMATIC = 'automatic',      // Periodic auto-save
  MANUAL = 'manual',            // User-triggered
  PHASE_COMPLETE = 'phase',     // End of phase
  MILESTONE = 'milestone',      // Significant progress
  PRE_RISKY = 'pre_risky',      // Before risky operation
  RECOVERY = 'recovery',        // After error recovery
}

interface Checkpoint {
  id: string;
  taskId: string;
  type: CheckpointType;
  timestamp: Date;
  state: CheckpointState;
  metadata: CheckpointMetadata;
}

interface CheckpointState {
  plan: TaskPlan;
  currentPhaseId: number;
  completedSteps: string[];
  pendingSteps: string[];
  variables: Record<string, any>;
  fileChanges: FileChange[];
}

interface CheckpointMetadata {
  description: string;
  duration: number;
  filesModified: number;
  linesChanged: number;
  gitCommit?: string;
}

interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  hash: string;
}
```

### Checkpoint Manager

```typescript
// server/agent/checkpointManager.ts

import { Checkpoint, CheckpointType, CheckpointState } from '../types/checkpoint';
import * as crypto from 'crypto';

/**
 * Manage task checkpoints for recovery
 */
class CheckpointManager {
  private checkpoints: Map<string, Checkpoint[]> = new Map();
  private autoCheckpointInterval = 5 * 60 * 1000; // 5 minutes
  private maxCheckpointsPerTask = 50;

  /**
   * Create checkpoint
   */
  async createCheckpoint(
    taskId: string,
    type: CheckpointType,
    state: CheckpointState,
    description: string
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: this.generateCheckpointId(),
      taskId,
      type,
      timestamp: new Date(),
      state,
      metadata: {
        description,
        duration: 0,
        filesModified: state.fileChanges.length,
        linesChanged: await this.countLinesChanged(state.fileChanges),
      },
    };

    // Store checkpoint
    if (!this.checkpoints.has(taskId)) {
      this.checkpoints.set(taskId, []);
    }

    const taskCheckpoints = this.checkpoints.get(taskId)!;
    taskCheckpoints.push(checkpoint);

    // Prune old checkpoints
    if (taskCheckpoints.length > this.maxCheckpointsPerTask) {
      this.pruneCheckpoints(taskId);
    }

    // Persist to storage
    await this.persistCheckpoint(checkpoint);

    // Create git commit if applicable
    if (state.fileChanges.length > 0) {
      checkpoint.metadata.gitCommit = await this.createGitCommit(
        checkpoint,
        description
      );
    }

    return checkpoint;
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(taskId: string): Checkpoint | undefined {
    const checkpoints = this.checkpoints.get(taskId);
    if (!checkpoints || checkpoints.length === 0) return undefined;
    return checkpoints[checkpoints.length - 1];
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(taskId: string, checkpointId: string): Checkpoint | undefined {
    const checkpoints = this.checkpoints.get(taskId);
    return checkpoints?.find(c => c.id === checkpointId);
  }

  /**
   * List checkpoints for task
   */
  listCheckpoints(taskId: string): Checkpoint[] {
    return this.checkpoints.get(taskId) || [];
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(
    taskId: string,
    checkpointId: string
  ): Promise<CheckpointState> {
    const checkpoint = this.getCheckpoint(taskId, checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    // Restore git state if available
    if (checkpoint.metadata.gitCommit) {
      await this.restoreGitState(checkpoint.metadata.gitCommit);
    }

    // Restore file changes
    await this.restoreFileChanges(checkpoint.state.fileChanges);

    return checkpoint.state;
  }

  /**
   * Schedule automatic checkpoints
   */
  scheduleAutoCheckpoint(
    taskId: string,
    getState: () => Promise<CheckpointState>
  ): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const state = await getState();
        await this.createCheckpoint(
          taskId,
          CheckpointType.AUTOMATIC,
          state,
          'Automatic checkpoint'
        );
      } catch (error) {
        console.error('Auto-checkpoint failed:', error);
      }
    }, this.autoCheckpointInterval);
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Count lines changed
   */
  private async countLinesChanged(changes: FileChange[]): Promise<number> {
    // Simplified - would actually diff files
    return changes.length * 10;
  }

  /**
   * Prune old checkpoints
   */
  private pruneCheckpoints(taskId: string): void {
    const checkpoints = this.checkpoints.get(taskId);
    if (!checkpoints) return;

    // Keep: latest 10, all milestones, all phase completions
    const toKeep = new Set<string>();

    // Latest 10
    checkpoints.slice(-10).forEach(c => toKeep.add(c.id));

    // Milestones and phase completions
    checkpoints
      .filter(c => 
        c.type === CheckpointType.MILESTONE || 
        c.type === CheckpointType.PHASE_COMPLETE
      )
      .forEach(c => toKeep.add(c.id));

    // Filter
    const pruned = checkpoints.filter(c => toKeep.has(c.id));
    this.checkpoints.set(taskId, pruned);
  }

  /**
   * Persist checkpoint to storage
   */
  private async persistCheckpoint(checkpoint: Checkpoint): Promise<void> {
    // Would persist to database/S3
    const fs = await import('fs/promises');
    const path = `/home/ubuntu/.checkpoints/${checkpoint.taskId}/${checkpoint.id}.json`;
    
    await fs.mkdir(`/home/ubuntu/.checkpoints/${checkpoint.taskId}`, { 
      recursive: true 
    });
    await fs.writeFile(path, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Create git commit for checkpoint
   */
  private async createGitCommit(
    checkpoint: Checkpoint,
    message: string
  ): Promise<string> {
    const { execSync } = await import('child_process');
    
    try {
      execSync('git add -A', { cwd: '/home/ubuntu/project' });
      execSync(`git commit -m "Checkpoint: ${message}"`, { 
        cwd: '/home/ubuntu/project' 
      });
      
      const hash = execSync('git rev-parse HEAD', { 
        cwd: '/home/ubuntu/project' 
      }).toString().trim();
      
      return hash;
    } catch {
      return '';
    }
  }

  /**
   * Restore git state
   */
  private async restoreGitState(commitHash: string): Promise<void> {
    const { execSync } = await import('child_process');
    
    try {
      execSync(`git checkout ${commitHash}`, { cwd: '/home/ubuntu/project' });
    } catch (error) {
      console.error('Git restore failed:', error);
    }
  }

  /**
   * Restore file changes
   */
  private async restoreFileChanges(changes: FileChange[]): Promise<void> {
    // Would restore files from backup
  }
}

export const checkpointManager = new CheckpointManager();
```

### Checkpoint Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CHECKPOINT STRATEGY                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  WHEN TO CHECKPOINT                                                                     │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                  │   │
│  │  AUTOMATIC (every 5 min)                                                        │   │
│  │  ├── During long execution phases                                               │   │
│  │  └── Background timer                                                           │   │
│  │                                                                                  │   │
│  │  PHASE COMPLETE                                                                 │   │
│  │  ├── After each plan phase                                                      │   │
│  │  └── Natural breakpoint                                                         │   │
│  │                                                                                  │   │
│  │  MILESTONE                                                                      │   │
│  │  ├── Feature complete                                                           │   │
│  │  ├── Tests passing                                                              │   │
│  │  └── User-visible progress                                                      │   │
│  │                                                                                  │   │
│  │  PRE-RISKY                                                                      │   │
│  │  ├── Before database migrations                                                 │   │
│  │  ├── Before major refactoring                                                   │   │
│  │  └── Before dependency updates                                                  │   │
│  │                                                                                  │   │
│  │  MANUAL                                                                         │   │
│  │  ├── User request                                                               │   │
│  │  └── Before delivery                                                            │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  WHAT TO SAVE                                                                           │
│                                                                                         │
│  ├── Task plan state                                                                    │
│  ├── Current phase and step                                                             │
│  ├── File changes (paths, hashes)                                                       │
│  ├── Git commit reference                                                               │
│  ├── Environment variables                                                              │
│  └── Todo.md state                                                                      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Progress Reporting

### Progress Reporter

```typescript
// server/agent/progressReporter.ts

interface ProgressReport {
  taskId: string;
  timestamp: Date;
  overall: ProgressMetrics;
  currentPhase: PhaseProgress;
  recentActivity: ActivityItem[];
  estimations: TimeEstimations;
}

interface ProgressMetrics {
  percentage: number;
  phasesCompleted: number;
  totalPhases: number;
  stepsCompleted: number;
  totalSteps: number;
}

interface PhaseProgress {
  id: number;
  title: string;
  percentage: number;
  startedAt: Date;
  estimatedCompletion: Date;
}

interface ActivityItem {
  timestamp: Date;
  type: 'step' | 'checkpoint' | 'error' | 'milestone';
  description: string;
}

interface TimeEstimations {
  elapsedTime: number;
  estimatedRemaining: number;
  estimatedTotal: number;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Report task progress to users
 */
class ProgressReporter {
  private reports: Map<string, ProgressReport[]> = new Map();
  private updateInterval = 2 * 60 * 1000; // 2 minutes
  private listeners: Map<string, ((report: ProgressReport) => void)[]> = new Map();

  /**
   * Generate progress report
   */
  generateReport(
    taskId: string,
    plan: TaskPlan,
    executionState: any
  ): ProgressReport {
    const now = new Date();
    
    // Calculate overall progress
    const completedPhases = plan.phases.filter(p => p.status === 'completed').length;
    const currentPhase = plan.phases.find(p => p.status === 'in_progress');
    
    // Estimate phase progress
    const phaseProgress = this.estimatePhaseProgress(currentPhase, executionState);
    
    // Calculate overall percentage
    const overallPercentage = Math.round(
      ((completedPhases + phaseProgress / 100) / plan.phases.length) * 100
    );

    // Time estimations
    const estimations = this.calculateEstimations(
      taskId,
      overallPercentage,
      executionState
    );

    const report: ProgressReport = {
      taskId,
      timestamp: now,
      overall: {
        percentage: overallPercentage,
        phasesCompleted: completedPhases,
        totalPhases: plan.phases.length,
        stepsCompleted: executionState.completedSteps?.length || 0,
        totalSteps: executionState.totalSteps || 0,
      },
      currentPhase: {
        id: currentPhase?.id || 0,
        title: currentPhase?.title || 'Unknown',
        percentage: phaseProgress,
        startedAt: currentPhase?.startedAt || now,
        estimatedCompletion: new Date(
          now.getTime() + estimations.estimatedRemaining
        ),
      },
      recentActivity: this.getRecentActivity(taskId),
      estimations,
    };

    // Store report
    if (!this.reports.has(taskId)) {
      this.reports.set(taskId, []);
    }
    this.reports.get(taskId)!.push(report);

    // Notify listeners
    this.notifyListeners(taskId, report);

    return report;
  }

  /**
   * Estimate phase progress
   */
  private estimatePhaseProgress(
    phase: Phase | undefined,
    executionState: any
  ): number {
    if (!phase) return 0;
    if (phase.status === 'completed') return 100;
    if (phase.status === 'pending') return 0;

    // Estimate based on steps if available
    if (executionState.phaseSteps) {
      const completed = executionState.phaseSteps.filter(
        (s: any) => s.status === 'completed'
      ).length;
      const total = executionState.phaseSteps.length;
      return total > 0 ? Math.round((completed / total) * 100) : 50;
    }

    // Estimate based on time
    if (phase.startedAt) {
      const elapsed = Date.now() - phase.startedAt.getTime();
      const estimatedDuration = 5 * 60 * 1000; // 5 minutes default
      return Math.min(90, Math.round((elapsed / estimatedDuration) * 100));
    }

    return 50; // Default to 50% if no other info
  }

  /**
   * Calculate time estimations
   */
  private calculateEstimations(
    taskId: string,
    currentProgress: number,
    executionState: any
  ): TimeEstimations {
    const startTime = executionState.startTime || Date.now();
    const elapsedTime = Date.now() - startTime;

    // Calculate rate of progress
    const progressRate = currentProgress / elapsedTime;

    // Estimate remaining time
    let estimatedRemaining = 0;
    let confidence: 'low' | 'medium' | 'high' = 'low';

    if (progressRate > 0 && currentProgress > 10) {
      estimatedRemaining = (100 - currentProgress) / progressRate;
      confidence = currentProgress > 50 ? 'high' : 'medium';
    } else {
      // Use historical data or defaults
      estimatedRemaining = 10 * 60 * 1000; // 10 minutes default
    }

    return {
      elapsedTime,
      estimatedRemaining,
      estimatedTotal: elapsedTime + estimatedRemaining,
      confidence,
    };
  }

  /**
   * Get recent activity
   */
  private getRecentActivity(taskId: string): ActivityItem[] {
    // Would pull from activity log
    return [];
  }

  /**
   * Format report for user display
   */
  formatForUser(report: ProgressReport): string {
    const bar = this.createProgressBar(report.overall.percentage);
    
    let output = `\n📊 **Progress Update**\n\n`;
    output += `${bar} ${report.overall.percentage}%\n\n`;
    output += `**Current Phase:** ${report.currentPhase.title}\n`;
    output += `**Phases:** ${report.overall.phasesCompleted}/${report.overall.totalPhases} completed\n`;
    
    if (report.estimations.confidence !== 'low') {
      output += `**Est. Remaining:** ${this.formatDuration(report.estimations.estimatedRemaining)}\n`;
    }

    return output;
  }

  /**
   * Create progress bar
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    return `[${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}]`;
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }

  /**
   * Subscribe to progress updates
   */
  subscribe(taskId: string, callback: (report: ProgressReport) => void): void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, []);
    }
    this.listeners.get(taskId)!.push(callback);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(taskId: string, report: ProgressReport): void {
    const callbacks = this.listeners.get(taskId) || [];
    callbacks.forEach(cb => cb(report));
  }

  /**
   * Schedule periodic reports
   */
  scheduleReports(
    taskId: string,
    getPlan: () => TaskPlan,
    getState: () => any
  ): NodeJS.Timeout {
    return setInterval(() => {
      const report = this.generateReport(taskId, getPlan(), getState());
      console.log(this.formatForUser(report));
    }, this.updateInterval);
  }
}

export const progressReporter = new ProgressReporter();
```

---

## Timeout Handling

### Timeout Configuration

```typescript
// types/timeout.ts

interface TimeoutConfig {
  // Tool-level timeouts
  shellCommand: number;        // 30s default
  fileOperation: number;       // 10s default
  browserAction: number;       // 30s default
  searchQuery: number;         // 60s default
  
  // Phase-level timeouts
  phaseDefault: number;        // 10 min default
  phaseMax: number;            // 30 min max
  
  // Task-level timeouts
  taskDefault: number;         // 1 hour default
  taskMax: number;             // 4 hours max
  
  // Idle timeouts
  idleWarning: number;         // 5 min
  idleTerminate: number;       // 15 min
}

const defaultTimeouts: TimeoutConfig = {
  shellCommand: 30 * 1000,
  fileOperation: 10 * 1000,
  browserAction: 30 * 1000,
  searchQuery: 60 * 1000,
  phaseDefault: 10 * 60 * 1000,
  phaseMax: 30 * 60 * 1000,
  phaseDefault: 60 * 60 * 1000,
  taskMax: 4 * 60 * 60 * 1000,
  idleWarning: 5 * 60 * 1000,
  idleTerminate: 15 * 60 * 1000,
};
```

### Timeout Manager

```typescript
// server/agent/timeoutManager.ts

import { TimeoutConfig } from '../types/timeout';

interface TimeoutState {
  taskId: string;
  startTime: number;
  lastActivity: number;
  warnings: number;
  timers: Map<string, NodeJS.Timeout>;
}

/**
 * Manage timeouts for long-running tasks
 */
class TimeoutManager {
  private config: TimeoutConfig;
  private states: Map<string, TimeoutState> = new Map();
  private handlers: Map<string, TimeoutHandler> = new Map();

  constructor(config: Partial<TimeoutConfig> = {}) {
    this.config = { ...defaultTimeouts, ...config };
  }

  /**
   * Start timeout tracking for task
   */
  startTracking(taskId: string): void {
    const state: TimeoutState = {
      taskId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      warnings: 0,
      timers: new Map(),
    };

    this.states.set(taskId, state);

    // Set up idle timeout
    this.setIdleTimeout(taskId);

    // Set up task timeout
    this.setTaskTimeout(taskId);
  }

  /**
   * Record activity
   */
  recordActivity(taskId: string): void {
    const state = this.states.get(taskId);
    if (!state) return;

    state.lastActivity = Date.now();
    state.warnings = 0;

    // Reset idle timeout
    this.clearTimer(taskId, 'idle');
    this.setIdleTimeout(taskId);
  }

  /**
   * Set tool timeout
   */
  setToolTimeout(
    taskId: string,
    toolName: string,
    customTimeout?: number
  ): { promise: Promise<never>; clear: () => void } {
    const timeout = customTimeout || this.getToolTimeout(toolName);

    let timeoutId: NodeJS.Timeout;
    const promise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Tool ${toolName} timed out after ${timeout}ms`));
      }, timeout);
    });

    const clear = () => clearTimeout(timeoutId);

    return { promise, clear };
  }

  /**
   * Get tool-specific timeout
   */
  private getToolTimeout(toolName: string): number {
    const toolTimeouts: Record<string, number> = {
      'shell.exec': this.config.shellCommand,
      'file.read': this.config.fileOperation,
      'file.write': this.config.fileOperation,
      'browser.navigate': this.config.browserAction,
      'search.info': this.config.searchQuery,
    };

    return toolTimeouts[toolName] || 30000;
  }

  /**
   * Set idle timeout
   */
  private setIdleTimeout(taskId: string): void {
    const state = this.states.get(taskId);
    if (!state) return;

    // Warning timeout
    const warningTimer = setTimeout(() => {
      this.handleIdleWarning(taskId);
    }, this.config.idleWarning);

    state.timers.set('idle_warning', warningTimer);

    // Terminate timeout
    const terminateTimer = setTimeout(() => {
      this.handleIdleTerminate(taskId);
    }, this.config.idleTerminate);

    state.timers.set('idle_terminate', terminateTimer);
  }

  /**
   * Set task timeout
   */
  private setTaskTimeout(taskId: string): void {
    const state = this.states.get(taskId);
    if (!state) return;

    const timer = setTimeout(() => {
      this.handleTaskTimeout(taskId);
    }, this.config.taskMax);

    state.timers.set('task', timer);
  }

  /**
   * Handle idle warning
   */
  private handleIdleWarning(taskId: string): void {
    const state = this.states.get(taskId);
    if (!state) return;

    state.warnings++;
    
    const handler = this.handlers.get(taskId);
    handler?.onIdleWarning?.(taskId, state.warnings);
  }

  /**
   * Handle idle terminate
   */
  private handleIdleTerminate(taskId: string): void {
    const handler = this.handlers.get(taskId);
    handler?.onIdleTerminate?.(taskId);
    
    this.stopTracking(taskId);
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const handler = this.handlers.get(taskId);
    handler?.onTaskTimeout?.(taskId);
    
    this.stopTracking(taskId);
  }

  /**
   * Clear specific timer
   */
  private clearTimer(taskId: string, timerName: string): void {
    const state = this.states.get(taskId);
    if (!state) return;

    const timer = state.timers.get(timerName);
    if (timer) {
      clearTimeout(timer);
      state.timers.delete(timerName);
    }
  }

  /**
   * Stop tracking task
   */
  stopTracking(taskId: string): void {
    const state = this.states.get(taskId);
    if (!state) return;

    // Clear all timers
    for (const timer of state.timers.values()) {
      clearTimeout(timer);
    }

    this.states.delete(taskId);
    this.handlers.delete(taskId);
  }

  /**
   * Register timeout handler
   */
  registerHandler(taskId: string, handler: TimeoutHandler): void {
    this.handlers.set(taskId, handler);
  }

  /**
   * Get remaining time
   */
  getRemainingTime(taskId: string): {
    taskRemaining: number;
    idleRemaining: number;
  } {
    const state = this.states.get(taskId);
    if (!state) {
      return { taskRemaining: 0, idleRemaining: 0 };
    }

    const now = Date.now();
    const taskRemaining = Math.max(
      0,
      this.config.taskMax - (now - state.startTime)
    );
    const idleRemaining = Math.max(
      0,
      this.config.idleTerminate - (now - state.lastActivity)
    );

    return { taskRemaining, idleRemaining };
  }
}

interface TimeoutHandler {
  onIdleWarning?: (taskId: string, warningCount: number) => void;
  onIdleTerminate?: (taskId: string) => void;
  onTaskTimeout?: (taskId: string) => void;
}

export const timeoutManager = new TimeoutManager();
```

### Timeout Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TIMEOUT HANDLING FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  TOOL TIMEOUT (30s default)                                                             │
│  ├── Command starts                                                                     │
│  ├── Timer begins                                                                       │
│  ├── If completes → Clear timer                                                         │
│  └── If timeout → Throw error, trigger retry logic                                      │
│                                                                                         │
│  IDLE TIMEOUT                                                                           │
│  ├── T+0: Task starts                                                                   │
│  ├── T+5min: Warning if no activity                                                     │
│  │   └── "Task appears idle, continuing..."                                             │
│  ├── T+15min: Terminate if still idle                                                   │
│  │   └── Save checkpoint, pause task                                                    │
│  └── Any activity → Reset timers                                                        │
│                                                                                         │
│  TASK TIMEOUT (4h max)                                                                  │
│  ├── T+0: Task starts                                                                   │
│  ├── T+3h: Warning                                                                      │
│  │   └── "Task approaching time limit..."                                               │
│  ├── T+4h: Force complete                                                               │
│  │   └── Save checkpoint, deliver partial results                                       │
│  └── User can extend if needed                                                          │
│                                                                                         │
│  GRACEFUL HANDLING                                                                      │
│  ├── Save checkpoint before timeout                                                     │
│  ├── Notify user of timeout                                                             │
│  ├── Provide partial results                                                            │
│  └── Enable resumption                                                                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Resumption

### Resumption Manager

```typescript
// server/agent/resumptionManager.ts

interface ResumptionContext {
  taskId: string;
  checkpoint: Checkpoint;
  reason: 'user_request' | 'timeout' | 'error' | 'hibernation';
  resumedAt: Date;
}

interface ResumptionResult {
  success: boolean;
  state: CheckpointState;
  skippedSteps: string[];
  message: string;
}

/**
 * Manage task resumption from checkpoints
 */
class ResumptionManager {
  private resumptions: Map<string, ResumptionContext[]> = new Map();

  /**
   * Resume task from checkpoint
   */
  async resumeTask(
    taskId: string,
    checkpointId?: string
  ): Promise<ResumptionResult> {
    // Get checkpoint
    const checkpoint = checkpointId
      ? checkpointManager.getCheckpoint(taskId, checkpointId)
      : checkpointManager.getLatestCheckpoint(taskId);

    if (!checkpoint) {
      return {
        success: false,
        state: {} as CheckpointState,
        skippedSteps: [],
        message: 'No checkpoint found for resumption',
      };
    }

    // Restore state
    const state = await checkpointManager.restoreCheckpoint(
      taskId,
      checkpoint.id
    );

    // Record resumption
    const context: ResumptionContext = {
      taskId,
      checkpoint,
      reason: 'user_request',
      resumedAt: new Date(),
    };

    if (!this.resumptions.has(taskId)) {
      this.resumptions.set(taskId, []);
    }
    this.resumptions.get(taskId)!.push(context);

    // Determine what to skip
    const skippedSteps = state.completedSteps;

    // Update task lifecycle
    taskLifecycleManager.transition(
      taskId,
      TaskState.RESUMING,
      'checkpoint_restore'
    );

    return {
      success: true,
      state,
      skippedSteps,
      message: `Resumed from checkpoint: ${checkpoint.metadata.description}`,
    };
  }

  /**
   * Resume from hibernation
   */
  async resumeFromHibernation(taskId: string): Promise<ResumptionResult> {
    // Similar to resumeTask but handles sandbox wake-up
    const result = await this.resumeTask(taskId);

    if (result.success) {
      // Wait for sandbox to be ready
      await this.waitForSandbox(taskId);

      // Restore environment
      await this.restoreEnvironment(taskId, result.state);
    }

    return result;
  }

  /**
   * Wait for sandbox to be ready
   */
  private async waitForSandbox(taskId: string): Promise<void> {
    const maxWait = 60000; // 1 minute
    const checkInterval = 1000;
    let waited = 0;

    while (waited < maxWait) {
      const isReady = await this.checkSandboxReady(taskId);
      if (isReady) return;

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    throw new Error('Sandbox failed to wake up');
  }

  /**
   * Check if sandbox is ready
   */
  private async checkSandboxReady(taskId: string): Promise<boolean> {
    // Would check sandbox status
    return true;
  }

  /**
   * Restore environment after resumption
   */
  private async restoreEnvironment(
    taskId: string,
    state: CheckpointState
  ): Promise<void> {
    // Restore environment variables
    for (const [key, value] of Object.entries(state.variables)) {
      process.env[key] = value as string;
    }

    // Restart dev server if needed
    // Restore database connections
    // etc.
  }

  /**
   * Get resumption history
   */
  getResumptionHistory(taskId: string): ResumptionContext[] {
    return this.resumptions.get(taskId) || [];
  }

  /**
   * Format resumption message for user
   */
  formatResumptionMessage(result: ResumptionResult): string {
    if (!result.success) {
      return `❌ Failed to resume: ${result.message}`;
    }

    let message = `✅ **Task Resumed**\n\n`;
    message += `${result.message}\n\n`;

    if (result.skippedSteps.length > 0) {
      message += `**Skipping completed steps:**\n`;
      result.skippedSteps.slice(0, 5).forEach(step => {
        message += `- ${step}\n`;
      });
      if (result.skippedSteps.length > 5) {
        message += `- ... and ${result.skippedSteps.length - 5} more\n`;
      }
    }

    return message;
  }
}

export const resumptionManager = new ResumptionManager();
```

---

## Resource Management

### Resource Monitor

```typescript
// server/agent/resourceMonitor.ts

interface ResourceMetrics {
  cpu: {
    usage: number;
    limit: number;
  };
  memory: {
    used: number;
    limit: number;
    percentage: number;
  };
  disk: {
    used: number;
    available: number;
    percentage: number;
  };
  processes: number;
}

interface ResourceAlert {
  type: 'cpu' | 'memory' | 'disk';
  level: 'warning' | 'critical';
  value: number;
  threshold: number;
  message: string;
}

/**
 * Monitor resource usage during long-running tasks
 */
class ResourceMonitor {
  private thresholds = {
    cpu: { warning: 80, critical: 95 },
    memory: { warning: 80, critical: 90 },
    disk: { warning: 80, critical: 95 },
  };

  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private alertHandlers: Map<string, (alert: ResourceAlert) => void> = new Map();

  /**
   * Start monitoring for task
   */
  startMonitoring(
    taskId: string,
    onAlert?: (alert: ResourceAlert) => void
  ): void {
    if (onAlert) {
      this.alertHandlers.set(taskId, onAlert);
    }

    const interval = setInterval(async () => {
      const metrics = await this.getMetrics();
      const alerts = this.checkThresholds(metrics);

      for (const alert of alerts) {
        this.alertHandlers.get(taskId)?.(alert);
      }
    }, 30000); // Check every 30 seconds

    this.monitoringIntervals.set(taskId, interval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(taskId: string): void {
    const interval = this.monitoringIntervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(taskId);
    }
    this.alertHandlers.delete(taskId);
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<ResourceMetrics> {
    const { execSync } = await import('child_process');

    // CPU usage
    const cpuInfo = execSync("top -bn1 | grep 'Cpu(s)'").toString();
    const cpuMatch = cpuInfo.match(/(\d+\.\d+)\s*id/);
    const cpuIdle = cpuMatch ? parseFloat(cpuMatch[1]) : 0;
    const cpuUsage = 100 - cpuIdle;

    // Memory usage
    const memInfo = execSync('free -b').toString();
    const memLines = memInfo.split('\n');
    const memParts = memLines[1].split(/\s+/);
    const memTotal = parseInt(memParts[1]);
    const memUsed = parseInt(memParts[2]);

    // Disk usage
    const diskInfo = execSync('df -B1 /home/ubuntu').toString();
    const diskLines = diskInfo.split('\n');
    const diskParts = diskLines[1].split(/\s+/);
    const diskTotal = parseInt(diskParts[1]);
    const diskUsed = parseInt(diskParts[2]);
    const diskAvailable = parseInt(diskParts[3]);

    // Process count
    const processCount = parseInt(
      execSync('ps aux | wc -l').toString().trim()
    );

    return {
      cpu: {
        usage: cpuUsage,
        limit: 100,
      },
      memory: {
        used: memUsed,
        limit: memTotal,
        percentage: (memUsed / memTotal) * 100,
      },
      disk: {
        used: diskUsed,
        available: diskAvailable,
        percentage: (diskUsed / (diskUsed + diskAvailable)) * 100,
      },
      processes: processCount,
    };
  }

  /**
   * Check thresholds and generate alerts
   */
  private checkThresholds(metrics: ResourceMetrics): ResourceAlert[] {
    const alerts: ResourceAlert[] = [];

    // CPU
    if (metrics.cpu.usage >= this.thresholds.cpu.critical) {
      alerts.push({
        type: 'cpu',
        level: 'critical',
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.critical,
        message: `CPU usage critical: ${metrics.cpu.usage.toFixed(1)}%`,
      });
    } else if (metrics.cpu.usage >= this.thresholds.cpu.warning) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.warning,
        message: `CPU usage high: ${metrics.cpu.usage.toFixed(1)}%`,
      });
    }

    // Memory
    if (metrics.memory.percentage >= this.thresholds.memory.critical) {
      alerts.push({
        type: 'memory',
        level: 'critical',
        value: metrics.memory.percentage,
        threshold: this.thresholds.memory.critical,
        message: `Memory usage critical: ${metrics.memory.percentage.toFixed(1)}%`,
      });
    } else if (metrics.memory.percentage >= this.thresholds.memory.warning) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        value: metrics.memory.percentage,
        threshold: this.thresholds.memory.warning,
        message: `Memory usage high: ${metrics.memory.percentage.toFixed(1)}%`,
      });
    }

    // Disk
    if (metrics.disk.percentage >= this.thresholds.disk.critical) {
      alerts.push({
        type: 'disk',
        level: 'critical',
        value: metrics.disk.percentage,
        threshold: this.thresholds.disk.critical,
        message: `Disk usage critical: ${metrics.disk.percentage.toFixed(1)}%`,
      });
    } else if (metrics.disk.percentage >= this.thresholds.disk.warning) {
      alerts.push({
        type: 'disk',
        level: 'warning',
        value: metrics.disk.percentage,
        threshold: this.thresholds.disk.warning,
        message: `Disk usage high: ${metrics.disk.percentage.toFixed(1)}%`,
      });
    }

    return alerts;
  }

  /**
   * Format metrics for display
   */
  formatMetrics(metrics: ResourceMetrics): string {
    const formatBytes = (bytes: number) => {
      const gb = bytes / (1024 * 1024 * 1024);
      return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    };

    return `
**Resource Usage:**
- CPU: ${metrics.cpu.usage.toFixed(1)}%
- Memory: ${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.limit)} (${metrics.memory.percentage.toFixed(1)}%)
- Disk: ${formatBytes(metrics.disk.used)} used, ${formatBytes(metrics.disk.available)} available
- Processes: ${metrics.processes}
    `.trim();
  }
}

export const resourceMonitor = new ResourceMonitor();
```

---

## Failure Recovery

### Recovery Strategies

```typescript
// server/agent/failureRecovery.ts

interface FailureContext {
  taskId: string;
  error: Error;
  phase: Phase;
  step?: ExecutionStep;
  attemptCount: number;
}

interface RecoveryAction {
  type: 'retry' | 'rollback' | 'skip' | 'abort' | 'checkpoint_restore';
  params?: Record<string, any>;
  message: string;
}

/**
 * Handle failures in long-running tasks
 */
class FailureRecoveryManager {
  private maxRetries = 3;
  private recoveryStrategies: RecoveryStrategy[] = [];

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Transient error - retry
    this.recoveryStrategies.push({
      name: 'transient_retry',
      matches: (ctx) => this.isTransientError(ctx.error),
      action: (ctx) => ({
        type: 'retry',
        params: { delay: 1000 * Math.pow(2, ctx.attemptCount) },
        message: 'Transient error, retrying...',
      }),
    });

    // Resource exhaustion - cleanup and retry
    this.recoveryStrategies.push({
      name: 'resource_cleanup',
      matches: (ctx) => this.isResourceError(ctx.error),
      action: async (ctx) => {
        await this.cleanupResources();
        return {
          type: 'retry',
          params: { delay: 5000 },
          message: 'Cleaned up resources, retrying...',
        };
      },
    });

    // Critical error - rollback to checkpoint
    this.recoveryStrategies.push({
      name: 'checkpoint_rollback',
      matches: (ctx) => this.isCriticalError(ctx.error) && ctx.attemptCount >= 2,
      action: (ctx) => ({
        type: 'checkpoint_restore',
        params: { checkpointId: 'latest' },
        message: 'Critical error, rolling back to last checkpoint...',
      }),
    });

    // Non-critical step - skip
    this.recoveryStrategies.push({
      name: 'skip_non_critical',
      matches: (ctx) => ctx.step && !this.isCriticalStep(ctx.step),
      action: (ctx) => ({
        type: 'skip',
        message: `Skipping non-critical step: ${ctx.step?.description}`,
      }),
    });

    // Default - abort with checkpoint
    this.recoveryStrategies.push({
      name: 'abort_with_checkpoint',
      matches: () => true,
      action: (ctx) => ({
        type: 'abort',
        message: 'Unrecoverable error, saving progress and stopping...',
      }),
    });
  }

  /**
   * Determine recovery action
   */
  async determineRecovery(context: FailureContext): Promise<RecoveryAction> {
    // Check attempt limit
    if (context.attemptCount >= this.maxRetries) {
      return {
        type: 'abort',
        message: `Max retries (${this.maxRetries}) exceeded`,
      };
    }

    // Find matching strategy
    for (const strategy of this.recoveryStrategies) {
      if (strategy.matches(context)) {
        return typeof strategy.action === 'function'
          ? await strategy.action(context)
          : strategy.action;
      }
    }

    // Default abort
    return {
      type: 'abort',
      message: 'No recovery strategy found',
    };
  }

  /**
   * Execute recovery action
   */
  async executeRecovery(
    context: FailureContext,
    action: RecoveryAction
  ): Promise<boolean> {
    switch (action.type) {
      case 'retry':
        if (action.params?.delay) {
          await new Promise(r => setTimeout(r, action.params!.delay));
        }
        return true;

      case 'rollback':
        await checkpointManager.restoreCheckpoint(
          context.taskId,
          action.params?.checkpointId || 'latest'
        );
        return true;

      case 'checkpoint_restore':
        await resumptionManager.resumeTask(
          context.taskId,
          action.params?.checkpointId
        );
        return true;

      case 'skip':
        // Mark step as skipped
        return true;

      case 'abort':
        // Save final checkpoint
        await checkpointManager.createCheckpoint(
          context.taskId,
          CheckpointType.RECOVERY,
          await this.getCurrentState(context.taskId),
          `Recovery checkpoint: ${action.message}`
        );
        return false;

      default:
        return false;
    }
  }

  /**
   * Check if error is transient
   */
  private isTransientError(error: Error): boolean {
    const transientPatterns = [
      /timeout/i,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /network/i,
      /temporary/i,
    ];
    return transientPatterns.some(p => p.test(error.message));
  }

  /**
   * Check if error is resource-related
   */
  private isResourceError(error: Error): boolean {
    const resourcePatterns = [
      /ENOMEM/,
      /ENOSPC/,
      /out of memory/i,
      /disk full/i,
    ];
    return resourcePatterns.some(p => p.test(error.message));
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /database/i,
      /corruption/i,
      /fatal/i,
      /unrecoverable/i,
    ];
    return criticalPatterns.some(p => p.test(error.message));
  }

  /**
   * Check if step is critical
   */
  private isCriticalStep(step: ExecutionStep): boolean {
    const criticalKeywords = [
      'database',
      'migration',
      'auth',
      'security',
      'payment',
    ];
    return criticalKeywords.some(k => 
      step.description.toLowerCase().includes(k)
    );
  }

  /**
   * Cleanup resources
   */
  private async cleanupResources(): Promise<void> {
    const { execSync } = await import('child_process');
    
    // Clear caches
    execSync('rm -rf /tmp/* 2>/dev/null || true');
    execSync('rm -rf ~/.cache/* 2>/dev/null || true');
    execSync('rm -rf node_modules/.cache 2>/dev/null || true');
    
    // Kill zombie processes
    execSync('pkill -9 -f "defunct" 2>/dev/null || true');
  }

  /**
   * Get current state for checkpoint
   */
  private async getCurrentState(taskId: string): Promise<CheckpointState> {
    // Would gather current state
    return {} as CheckpointState;
  }
}

interface RecoveryStrategy {
  name: string;
  matches: (context: FailureContext) => boolean;
  action: RecoveryAction | ((context: FailureContext) => Promise<RecoveryAction>);
}

export const failureRecoveryManager = new FailureRecoveryManager();
```

---

## Best Practices

### Long-Running Task Guidelines

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| **Checkpointing** | Every 5 minutes or phase | Balance recovery vs overhead |
| **Progress** | Update every 2 minutes | Keep user informed |
| **Timeouts** | Tool: 30s, Phase: 10m, Task: 4h | Prevent runaway tasks |
| **Resources** | Monitor every 30s | Early warning of issues |
| **Recovery** | Max 3 retries per step | Avoid infinite loops |

### Checkpoint Strategy

| Event | Checkpoint Type | Priority |
|-------|-----------------|----------|
| Phase complete | PHASE_COMPLETE | High |
| Before migration | PRE_RISKY | Critical |
| Every 5 minutes | AUTOMATIC | Medium |
| Feature complete | MILESTONE | High |
| User request | MANUAL | High |

### Timeout Configuration

| Operation | Default | Max | Notes |
|-----------|---------|-----|-------|
| Shell command | 30s | 5m | Increase for builds |
| File operation | 10s | 1m | Usually fast |
| Browser action | 30s | 2m | Network dependent |
| Search query | 60s | 2m | External service |
| Phase | 10m | 30m | Depends on complexity |
| Task | 1h | 4h | User can extend |

---

## Summary

### Long-Running Task Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        LONG-RUNNING TASK HANDLING SUMMARY                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  LIFECYCLE                    CHECKPOINTING               PROGRESS                      │
│  ├── State machine            ├── Automatic (5 min)       ├── Phase tracking            │
│  ├── Valid transitions        ├── Phase completion        ├── Time estimation           │
│  ├── Duration tracking        ├── Pre-risky operations    ├── User updates              │
│  └── Resumption support       └── Git integration         └── Activity log              │
│                                                                                         │
│  TIMEOUTS                     RESOURCES                   RECOVERY                      │
│  ├── Tool-level (30s)         ├── CPU monitoring          ├── Transient retry           │
│  ├── Phase-level (10m)        ├── Memory tracking         ├── Resource cleanup          │
│  ├── Task-level (4h)          ├── Disk usage              ├── Checkpoint rollback       │
│  └── Idle detection           └── Alert thresholds        └── Graceful abort            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
