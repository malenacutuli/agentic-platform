# Merge Conflict Handling

This guide provides comprehensive coverage of merge conflict detection, resolution strategies, and user interface design for handling conflicts in a cloud development platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Conflict Detection](#conflict-detection)
3. [Conflict Types](#conflict-types)
4. [Resolution Strategies](#resolution-strategies)
5. [Resolution UI](#resolution-ui)
6. [Merge Strategies](#merge-strategies)
7. [Automated Resolution](#automated-resolution)
8. [Three-Way Merge](#three-way-merge)
9. [Conflict Prevention](#conflict-prevention)
10. [API Reference](#api-reference)
11. [Best Practices](#best-practices)

---

## Overview

Merge conflicts occur when Git cannot automatically reconcile differences between branches. In a cloud development platform, handling conflicts gracefully is essential for maintaining developer productivity and preventing data loss.

### Conflict Scenarios

| Scenario | Description | Frequency |
|----------|-------------|-----------|
| **Pull Conflicts** | Remote changes conflict with local changes | Common |
| **Merge Conflicts** | Branch merge has conflicting changes | Common |
| **Rebase Conflicts** | Rebasing introduces conflicts | Moderate |
| **Cherry-pick Conflicts** | Picking commits causes conflicts | Rare |
| **Stash Pop Conflicts** | Stashed changes conflict with current state | Rare |

### Conflict Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MERGE CONFLICT RESOLUTION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │ Detect  │───►│ Analyze │───►│ Present │───►│ Resolve │───►│ Verify  │              │
│  │Conflict │    │ Conflict│    │   UI    │    │ Conflict│    │ Result  │              │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│       │              │              │              │              │                    │
│       ▼              ▼              ▼              ▼              ▼                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │ Parse   │    │ Extract │    │ 3-Way   │    │ Apply   │    │ Run     │              │
│  │ Git     │    │ Hunks   │    │ Diff    │    │ Changes │    │ Tests   │              │
│  │ Output  │    │         │    │ View    │    │         │    │         │              │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Conflict Detection

### Conflict Detection Service

```typescript
// src/services/conflictDetection.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface ConflictFile {
  path: string;
  status: 'both_modified' | 'both_added' | 'deleted_by_us' | 'deleted_by_them' | 'both_deleted';
  oursContent?: string;
  theirsContent?: string;
  baseContent?: string;
  conflictMarkers: ConflictMarker[];
}

interface ConflictMarker {
  startLine: number;
  separatorLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;
}

interface ConflictState {
  inProgress: boolean;
  operation: 'merge' | 'rebase' | 'cherry-pick' | 'revert' | null;
  sourceBranch?: string;
  targetBranch?: string;
  files: ConflictFile[];
  totalConflicts: number;
  resolvedConflicts: number;
}

class ConflictDetectionService {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  async detectConflictState(): Promise<ConflictState> {
    const state: ConflictState = {
      inProgress: false,
      operation: null,
      files: [],
      totalConflicts: 0,
      resolvedConflicts: 0,
    };
    
    // Check for ongoing merge
    if (await this.fileExists('.git/MERGE_HEAD')) {
      state.inProgress = true;
      state.operation = 'merge';
      state.sourceBranch = await this.readGitFile('MERGE_HEAD');
    }
    
    // Check for ongoing rebase
    if (await this.fileExists('.git/rebase-merge') || await this.fileExists('.git/rebase-apply')) {
      state.inProgress = true;
      state.operation = 'rebase';
    }
    
    // Check for ongoing cherry-pick
    if (await this.fileExists('.git/CHERRY_PICK_HEAD')) {
      state.inProgress = true;
      state.operation = 'cherry-pick';
    }
    
    // Check for ongoing revert
    if (await this.fileExists('.git/REVERT_HEAD')) {
      state.inProgress = true;
      state.operation = 'revert';
    }
    
    if (state.inProgress) {
      state.files = await this.getConflictFiles();
      state.totalConflicts = state.files.reduce(
        (sum, f) => sum + f.conflictMarkers.length,
        0
      );
    }
    
    return state;
  }
  
  async getConflictFiles(): Promise<ConflictFile[]> {
    try {
      const { stdout } = await execAsync(
        'git diff --name-only --diff-filter=U',
        { cwd: this.projectPath }
      );
      
      const files = stdout.split('\n').filter(f => f.trim());
      const conflictFiles: ConflictFile[] = [];
      
      for (const filePath of files) {
        const conflictFile = await this.analyzeConflictFile(filePath);
        conflictFiles.push(conflictFile);
      }
      
      return conflictFiles;
    } catch {
      return [];
    }
  }
  
  async analyzeConflictFile(filePath: string): Promise<ConflictFile> {
    const fullPath = path.join(this.projectPath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Determine conflict status
    const status = await this.getFileConflictStatus(filePath);
    
    // Parse conflict markers
    const conflictMarkers = this.parseConflictMarkers(content);
    
    // Get versions from git
    const [oursContent, theirsContent, baseContent] = await Promise.all([
      this.getFileVersion(filePath, ':2:'),  // Ours (current branch)
      this.getFileVersion(filePath, ':3:'),  // Theirs (merging branch)
      this.getFileVersion(filePath, ':1:'),  // Base (common ancestor)
    ]);
    
    return {
      path: filePath,
      status,
      oursContent,
      theirsContent,
      baseContent,
      conflictMarkers,
    };
  }
  
  private parseConflictMarkers(content: string): ConflictMarker[] {
    const markers: ConflictMarker[] = [];
    const lines = content.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      // Look for conflict start marker
      if (lines[i].startsWith('<<<<<<<')) {
        const startLine = i;
        let separatorLine = -1;
        let baseSeparatorLine = -1;
        let endLine = -1;
        
        // Find separator and end markers
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('|||||||')) {
            baseSeparatorLine = j;
          } else if (lines[j].startsWith('=======')) {
            separatorLine = j;
          } else if (lines[j].startsWith('>>>>>>>')) {
            endLine = j;
            break;
          }
        }
        
        if (separatorLine !== -1 && endLine !== -1) {
          // Extract content sections
          const oursStart = startLine + 1;
          const oursEnd = baseSeparatorLine !== -1 ? baseSeparatorLine : separatorLine;
          const theirsStart = separatorLine + 1;
          const theirsEnd = endLine;
          
          let baseContent: string | undefined;
          if (baseSeparatorLine !== -1) {
            baseContent = lines.slice(baseSeparatorLine + 1, separatorLine).join('\n');
          }
          
          markers.push({
            startLine,
            separatorLine,
            endLine,
            oursContent: lines.slice(oursStart, oursEnd).join('\n'),
            theirsContent: lines.slice(theirsStart, theirsEnd).join('\n'),
            baseContent,
          });
          
          i = endLine + 1;
          continue;
        }
      }
      i++;
    }
    
    return markers;
  }
  
  private async getFileConflictStatus(filePath: string): Promise<ConflictFile['status']> {
    try {
      const { stdout } = await execAsync(
        `git status --porcelain "${filePath}"`,
        { cwd: this.projectPath }
      );
      
      const status = stdout.substring(0, 2);
      
      switch (status) {
        case 'UU': return 'both_modified';
        case 'AA': return 'both_added';
        case 'DU': return 'deleted_by_us';
        case 'UD': return 'deleted_by_them';
        case 'DD': return 'both_deleted';
        default: return 'both_modified';
      }
    } catch {
      return 'both_modified';
    }
  }
  
  private async getFileVersion(filePath: string, stage: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(
        `git show "${stage}${filePath}"`,
        { cwd: this.projectPath }
      );
      return stdout;
    } catch {
      return undefined;
    }
  }
  
  private async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, relativePath));
      return true;
    } catch {
      return false;
    }
  }
  
  private async readGitFile(filename: string): Promise<string> {
    try {
      const content = await fs.readFile(
        path.join(this.projectPath, '.git', filename),
        'utf-8'
      );
      return content.trim();
    } catch {
      return '';
    }
  }
}

export { ConflictDetectionService, ConflictFile, ConflictMarker, ConflictState };
```

### Real-time Conflict Monitoring

```typescript
// src/services/conflictMonitor.ts

import { EventEmitter } from 'events';
import chokidar from 'chokidar';

interface ConflictEvent {
  type: 'conflict_started' | 'conflict_resolved' | 'file_resolved' | 'conflict_aborted';
  operation?: string;
  files?: string[];
  resolvedFile?: string;
}

class ConflictMonitor extends EventEmitter {
  private projectPath: string;
  private watcher: chokidar.FSWatcher | null = null;
  private detectionService: ConflictDetectionService;
  private lastState: ConflictState | null = null;
  
  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.detectionService = new ConflictDetectionService(projectPath);
  }
  
  start(): void {
    // Watch .git directory for conflict-related files
    this.watcher = chokidar.watch([
      `${this.projectPath}/.git/MERGE_HEAD`,
      `${this.projectPath}/.git/CHERRY_PICK_HEAD`,
      `${this.projectPath}/.git/REVERT_HEAD`,
      `${this.projectPath}/.git/rebase-merge`,
      `${this.projectPath}/.git/rebase-apply`,
      `${this.projectPath}/.git/index`,
    ], {
      ignoreInitial: true,
      persistent: true,
    });
    
    this.watcher.on('all', async () => {
      await this.checkConflictState();
    });
    
    // Initial check
    this.checkConflictState();
  }
  
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
  
  private async checkConflictState(): Promise<void> {
    const currentState = await this.detectionService.detectConflictState();
    
    if (!this.lastState) {
      this.lastState = currentState;
      if (currentState.inProgress) {
        this.emit('conflict', {
          type: 'conflict_started',
          operation: currentState.operation,
          files: currentState.files.map(f => f.path),
        } as ConflictEvent);
      }
      return;
    }
    
    // Detect state changes
    if (!this.lastState.inProgress && currentState.inProgress) {
      // Conflict started
      this.emit('conflict', {
        type: 'conflict_started',
        operation: currentState.operation,
        files: currentState.files.map(f => f.path),
      } as ConflictEvent);
    } else if (this.lastState.inProgress && !currentState.inProgress) {
      // Conflict resolved or aborted
      this.emit('conflict', {
        type: 'conflict_resolved',
        operation: this.lastState.operation,
      } as ConflictEvent);
    } else if (currentState.inProgress) {
      // Check for individual file resolutions
      const lastFiles = new Set(this.lastState.files.map(f => f.path));
      const currentFiles = new Set(currentState.files.map(f => f.path));
      
      for (const file of lastFiles) {
        if (!currentFiles.has(file)) {
          this.emit('conflict', {
            type: 'file_resolved',
            resolvedFile: file,
          } as ConflictEvent);
        }
      }
    }
    
    this.lastState = currentState;
  }
}

export { ConflictMonitor, ConflictEvent };
```

---

## Conflict Types

### Type Classification

```typescript
// src/services/conflictClassifier.ts

interface ConflictClassification {
  type: ConflictType;
  severity: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
  suggestedStrategy: string;
}

type ConflictType =
  | 'content_conflict'      // Same lines modified differently
  | 'add_add_conflict'      // Both added same file
  | 'modify_delete'         // One modified, one deleted
  | 'rename_conflict'       // Both renamed differently
  | 'mode_conflict'         // File mode changed differently
  | 'binary_conflict'       // Binary file conflict
  | 'submodule_conflict'    // Submodule reference conflict
  | 'whitespace_conflict'   // Only whitespace differences
  | 'import_conflict'       // Import/require statement conflicts
  | 'adjacent_conflict';    // Changes in adjacent lines

class ConflictClassifier {
  classifyConflict(file: ConflictFile, marker: ConflictMarker): ConflictClassification {
    // Check for whitespace-only conflict
    if (this.isWhitespaceOnly(marker)) {
      return {
        type: 'whitespace_conflict',
        severity: 'low',
        autoResolvable: true,
        suggestedStrategy: 'Use normalized whitespace',
      };
    }
    
    // Check for import conflicts (common in JS/TS)
    if (this.isImportConflict(marker)) {
      return {
        type: 'import_conflict',
        severity: 'low',
        autoResolvable: true,
        suggestedStrategy: 'Merge imports and deduplicate',
      };
    }
    
    // Check for adjacent line changes
    if (this.isAdjacentConflict(marker)) {
      return {
        type: 'adjacent_conflict',
        severity: 'medium',
        autoResolvable: true,
        suggestedStrategy: 'Keep both changes',
      };
    }
    
    // Check file status for special cases
    switch (file.status) {
      case 'both_added':
        return {
          type: 'add_add_conflict',
          severity: 'medium',
          autoResolvable: false,
          suggestedStrategy: 'Manual review required',
        };
      case 'deleted_by_us':
      case 'deleted_by_them':
        return {
          type: 'modify_delete',
          severity: 'high',
          autoResolvable: false,
          suggestedStrategy: 'Decide whether to keep or delete',
        };
      case 'both_deleted':
        return {
          type: 'modify_delete',
          severity: 'low',
          autoResolvable: true,
          suggestedStrategy: 'Accept deletion',
        };
    }
    
    // Default content conflict
    return {
      type: 'content_conflict',
      severity: 'medium',
      autoResolvable: false,
      suggestedStrategy: 'Manual merge required',
    };
  }
  
  private isWhitespaceOnly(marker: ConflictMarker): boolean {
    const normalizeWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();
    return normalizeWhitespace(marker.oursContent) === normalizeWhitespace(marker.theirsContent);
  }
  
  private isImportConflict(marker: ConflictMarker): boolean {
    const importPattern = /^(import|require|from|export)/m;
    return (
      importPattern.test(marker.oursContent) &&
      importPattern.test(marker.theirsContent)
    );
  }
  
  private isAdjacentConflict(marker: ConflictMarker): boolean {
    // Check if the changes don't actually overlap
    const oursLines = marker.oursContent.split('\n');
    const theirsLines = marker.theirsContent.split('\n');
    const baseLines = marker.baseContent?.split('\n') || [];
    
    // Simple heuristic: if base is empty and both have content, likely adjacent
    if (baseLines.length === 0 && oursLines.length > 0 && theirsLines.length > 0) {
      return true;
    }
    
    return false;
  }
  
  classifyFile(file: ConflictFile): {
    overallSeverity: 'low' | 'medium' | 'high';
    autoResolvableCount: number;
    manualCount: number;
    classifications: ConflictClassification[];
  } {
    const classifications = file.conflictMarkers.map(marker =>
      this.classifyConflict(file, marker)
    );
    
    const autoResolvableCount = classifications.filter(c => c.autoResolvable).length;
    const manualCount = classifications.length - autoResolvableCount;
    
    let overallSeverity: 'low' | 'medium' | 'high' = 'low';
    if (classifications.some(c => c.severity === 'high')) {
      overallSeverity = 'high';
    } else if (classifications.some(c => c.severity === 'medium')) {
      overallSeverity = 'medium';
    }
    
    return {
      overallSeverity,
      autoResolvableCount,
      manualCount,
      classifications,
    };
  }
}

export { ConflictClassifier, ConflictClassification, ConflictType };
```

---

## Resolution Strategies

### Resolution Service

```typescript
// src/services/conflictResolution.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

type ResolutionStrategy = 'ours' | 'theirs' | 'union' | 'manual' | 'base';

interface ResolutionResult {
  success: boolean;
  filePath: string;
  strategy: ResolutionStrategy;
  resolvedContent?: string;
  error?: string;
}

interface ManualResolution {
  filePath: string;
  markerIndex: number;
  resolvedContent: string;
}

class ConflictResolutionService {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  // Resolve entire file with a strategy
  async resolveFile(
    filePath: string,
    strategy: ResolutionStrategy
  ): Promise<ResolutionResult> {
    try {
      switch (strategy) {
        case 'ours':
          await execAsync(
            `git checkout --ours "${filePath}"`,
            { cwd: this.projectPath }
          );
          break;
        case 'theirs':
          await execAsync(
            `git checkout --theirs "${filePath}"`,
            { cwd: this.projectPath }
          );
          break;
        case 'base':
          // Checkout base version (common ancestor)
          await execAsync(
            `git show :1:"${filePath}" > "${filePath}"`,
            { cwd: this.projectPath }
          );
          break;
        case 'union':
          // Attempt union merge (keep both)
          await this.unionMerge(filePath);
          break;
        default:
          return {
            success: false,
            filePath,
            strategy,
            error: 'Manual resolution required',
          };
      }
      
      // Stage the resolved file
      await execAsync(`git add "${filePath}"`, { cwd: this.projectPath });
      
      const resolvedContent = await fs.readFile(
        path.join(this.projectPath, filePath),
        'utf-8'
      );
      
      return {
        success: true,
        filePath,
        strategy,
        resolvedContent,
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        strategy,
        error: (error as Error).message,
      };
    }
  }
  
  // Resolve individual conflict markers
  async resolveMarker(
    filePath: string,
    markerIndex: number,
    resolution: 'ours' | 'theirs' | 'both' | 'custom',
    customContent?: string
  ): Promise<ResolutionResult> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      const detectionService = new ConflictDetectionService(this.projectPath);
      const conflictFile = await detectionService.analyzeConflictFile(filePath);
      
      if (markerIndex >= conflictFile.conflictMarkers.length) {
        return {
          success: false,
          filePath,
          strategy: 'manual',
          error: 'Invalid marker index',
        };
      }
      
      const marker = conflictFile.conflictMarkers[markerIndex];
      let resolvedContent: string;
      
      switch (resolution) {
        case 'ours':
          resolvedContent = marker.oursContent;
          break;
        case 'theirs':
          resolvedContent = marker.theirsContent;
          break;
        case 'both':
          resolvedContent = `${marker.oursContent}\n${marker.theirsContent}`;
          break;
        case 'custom':
          if (!customContent) {
            return {
              success: false,
              filePath,
              strategy: 'manual',
              error: 'Custom content required',
            };
          }
          resolvedContent = customContent;
          break;
      }
      
      // Replace the conflict marker with resolved content
      const newContent = this.replaceMarker(content, marker, resolvedContent);
      await fs.writeFile(fullPath, newContent, 'utf-8');
      
      // Check if all conflicts are resolved
      const remainingConflicts = this.countConflictMarkers(newContent);
      if (remainingConflicts === 0) {
        await execAsync(`git add "${filePath}"`, { cwd: this.projectPath });
      }
      
      return {
        success: true,
        filePath,
        strategy: 'manual',
        resolvedContent: newContent,
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        strategy: 'manual',
        error: (error as Error).message,
      };
    }
  }
  
  // Apply manual resolution
  async applyManualResolution(resolution: ManualResolution): Promise<ResolutionResult> {
    return this.resolveMarker(
      resolution.filePath,
      resolution.markerIndex,
      'custom',
      resolution.resolvedContent
    );
  }
  
  // Apply full file content
  async applyFullResolution(filePath: string, content: string): Promise<ResolutionResult> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      await fs.writeFile(fullPath, content, 'utf-8');
      await execAsync(`git add "${filePath}"`, { cwd: this.projectPath });
      
      return {
        success: true,
        filePath,
        strategy: 'manual',
        resolvedContent: content,
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        strategy: 'manual',
        error: (error as Error).message,
      };
    }
  }
  
  // Complete the merge/rebase after all conflicts resolved
  async completeMerge(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check for remaining conflicts
      const { stdout } = await execAsync(
        'git diff --name-only --diff-filter=U',
        { cwd: this.projectPath }
      );
      
      if (stdout.trim()) {
        return {
          success: false,
          error: 'Unresolved conflicts remain',
        };
      }
      
      // Determine operation type and complete it
      const state = await new ConflictDetectionService(this.projectPath).detectConflictState();
      
      switch (state.operation) {
        case 'merge':
          await execAsync('git commit --no-edit', { cwd: this.projectPath });
          break;
        case 'rebase':
          await execAsync('git rebase --continue', { cwd: this.projectPath });
          break;
        case 'cherry-pick':
          await execAsync('git cherry-pick --continue', { cwd: this.projectPath });
          break;
        case 'revert':
          await execAsync('git revert --continue', { cwd: this.projectPath });
          break;
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  
  // Abort the current merge/rebase
  async abortMerge(): Promise<{ success: boolean; error?: string }> {
    try {
      const state = await new ConflictDetectionService(this.projectPath).detectConflictState();
      
      switch (state.operation) {
        case 'merge':
          await execAsync('git merge --abort', { cwd: this.projectPath });
          break;
        case 'rebase':
          await execAsync('git rebase --abort', { cwd: this.projectPath });
          break;
        case 'cherry-pick':
          await execAsync('git cherry-pick --abort', { cwd: this.projectPath });
          break;
        case 'revert':
          await execAsync('git revert --abort', { cwd: this.projectPath });
          break;
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  
  private async unionMerge(filePath: string): Promise<void> {
    const fullPath = path.join(this.projectPath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Simple union: keep both versions
    const resolved = content
      .replace(/<<<<<<< .+\n/g, '')
      .replace(/=======\n/g, '')
      .replace(/>>>>>>> .+\n/g, '');
    
    await fs.writeFile(fullPath, resolved, 'utf-8');
  }
  
  private replaceMarker(
    content: string,
    marker: ConflictMarker,
    resolvedContent: string
  ): string {
    const lines = content.split('\n');
    
    // Remove conflict marker lines and insert resolved content
    const before = lines.slice(0, marker.startLine);
    const after = lines.slice(marker.endLine + 1);
    
    return [...before, resolvedContent, ...after].join('\n');
  }
  
  private countConflictMarkers(content: string): number {
    const matches = content.match(/^<<<<<<< /gm);
    return matches ? matches.length : 0;
  }
}

export { ConflictResolutionService, ResolutionStrategy, ResolutionResult, ManualResolution };
```

---

## Resolution UI

### Three-Way Merge Editor Component

```typescript
// src/components/MergeEditor.tsx

import React, { useState, useEffect, useMemo } from 'react';

interface MergeEditorProps {
  filePath: string;
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  onResolve: (resolvedContent: string) => void;
  onCancel: () => void;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'conflict';
  lineNumber: {
    base?: number;
    ours?: number;
    theirs?: number;
  };
  content: string;
  conflictId?: number;
}

interface ConflictRegion {
  id: number;
  baseLines: string[];
  oursLines: string[];
  theirsLines: string[];
  resolution: 'ours' | 'theirs' | 'both' | 'custom' | null;
  customContent?: string;
}

const MergeEditor: React.FC<MergeEditorProps> = ({
  filePath,
  baseContent,
  oursContent,
  theirsContent,
  onResolve,
  onCancel,
}) => {
  const [conflicts, setConflicts] = useState<ConflictRegion[]>([]);
  const [resolvedContent, setResolvedContent] = useState<string>('');
  const [activeConflict, setActiveConflict] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  
  // Compute diff and identify conflicts
  useEffect(() => {
    const computedConflicts = computeThreeWayDiff(
      baseContent,
      oursContent,
      theirsContent
    );
    setConflicts(computedConflicts);
  }, [baseContent, oursContent, theirsContent]);
  
  // Generate resolved content when conflicts change
  useEffect(() => {
    const resolved = generateResolvedContent(
      baseContent,
      oursContent,
      theirsContent,
      conflicts
    );
    setResolvedContent(resolved);
  }, [conflicts, baseContent, oursContent, theirsContent]);
  
  const unresolvedCount = useMemo(
    () => conflicts.filter(c => c.resolution === null).length,
    [conflicts]
  );
  
  const handleResolveConflict = (
    conflictId: number,
    resolution: 'ours' | 'theirs' | 'both' | 'custom',
    customContent?: string
  ) => {
    setConflicts(prev =>
      prev.map(c =>
        c.id === conflictId
          ? { ...c, resolution, customContent }
          : c
      )
    );
  };
  
  const handleAcceptAll = (side: 'ours' | 'theirs') => {
    setConflicts(prev =>
      prev.map(c => ({ ...c, resolution: side }))
    );
  };
  
  return (
    <div className="merge-editor">
      {/* Header */}
      <div className="merge-editor-header">
        <h2>Resolve Conflicts: {filePath}</h2>
        <div className="conflict-status">
          {unresolvedCount > 0 ? (
            <span className="unresolved">
              {unresolvedCount} conflict{unresolvedCount > 1 ? 's' : ''} remaining
            </span>
          ) : (
            <span className="resolved">All conflicts resolved</span>
          )}
        </div>
        <div className="view-controls">
          <button
            className={viewMode === 'split' ? 'active' : ''}
            onClick={() => setViewMode('split')}
          >
            Split View
          </button>
          <button
            className={viewMode === 'unified' ? 'active' : ''}
            onClick={() => setViewMode('unified')}
          >
            Unified View
          </button>
        </div>
      </div>
      
      {/* Quick actions */}
      <div className="quick-actions">
        <button onClick={() => handleAcceptAll('ours')}>
          Accept All Ours
        </button>
        <button onClick={() => handleAcceptAll('theirs')}>
          Accept All Theirs
        </button>
      </div>
      
      {/* Editor panels */}
      {viewMode === 'split' ? (
        <SplitView
          baseContent={baseContent}
          oursContent={oursContent}
          theirsContent={theirsContent}
          conflicts={conflicts}
          activeConflict={activeConflict}
          onSelectConflict={setActiveConflict}
          onResolveConflict={handleResolveConflict}
        />
      ) : (
        <UnifiedView
          resolvedContent={resolvedContent}
          conflicts={conflicts}
          onResolveConflict={handleResolveConflict}
        />
      )}
      
      {/* Result preview */}
      <div className="result-preview">
        <h3>Result Preview</h3>
        <pre>{resolvedContent}</pre>
      </div>
      
      {/* Actions */}
      <div className="merge-editor-actions">
        <button onClick={onCancel}>Cancel</button>
        <button
          onClick={() => onResolve(resolvedContent)}
          disabled={unresolvedCount > 0}
          className="primary"
        >
          Accept Resolution
        </button>
      </div>
    </div>
  );
};

// Split view component
const SplitView: React.FC<{
  baseContent: string;
  oursContent: string;
  theirsContent: string;
  conflicts: ConflictRegion[];
  activeConflict: number | null;
  onSelectConflict: (id: number) => void;
  onResolveConflict: (
    id: number,
    resolution: 'ours' | 'theirs' | 'both' | 'custom',
    customContent?: string
  ) => void;
}> = ({
  baseContent,
  oursContent,
  theirsContent,
  conflicts,
  activeConflict,
  onSelectConflict,
  onResolveConflict,
}) => {
  return (
    <div className="split-view">
      <div className="panel ours">
        <div className="panel-header">
          <span>Current Branch (Ours)</span>
        </div>
        <CodePanel
          content={oursContent}
          conflicts={conflicts}
          side="ours"
          activeConflict={activeConflict}
          onSelectConflict={onSelectConflict}
        />
      </div>
      
      <div className="panel base">
        <div className="panel-header">
          <span>Common Ancestor (Base)</span>
        </div>
        <CodePanel
          content={baseContent}
          conflicts={conflicts}
          side="base"
          activeConflict={activeConflict}
          onSelectConflict={onSelectConflict}
        />
      </div>
      
      <div className="panel theirs">
        <div className="panel-header">
          <span>Incoming Branch (Theirs)</span>
        </div>
        <CodePanel
          content={theirsContent}
          conflicts={conflicts}
          side="theirs"
          activeConflict={activeConflict}
          onSelectConflict={onSelectConflict}
        />
      </div>
      
      {/* Conflict resolution panel */}
      {activeConflict !== null && (
        <ConflictResolutionPanel
          conflict={conflicts.find(c => c.id === activeConflict)!}
          onResolve={(resolution, custom) =>
            onResolveConflict(activeConflict, resolution, custom)
          }
        />
      )}
    </div>
  );
};

// Conflict resolution panel
const ConflictResolutionPanel: React.FC<{
  conflict: ConflictRegion;
  onResolve: (
    resolution: 'ours' | 'theirs' | 'both' | 'custom',
    customContent?: string
  ) => void;
}> = ({ conflict, onResolve }) => {
  const [customContent, setCustomContent] = useState(
    conflict.customContent || ''
  );
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  
  return (
    <div className="conflict-resolution-panel">
      <h4>Resolve Conflict #{conflict.id}</h4>
      
      <div className="resolution-options">
        <button
          className={conflict.resolution === 'ours' ? 'selected' : ''}
          onClick={() => onResolve('ours')}
        >
          Accept Ours
        </button>
        <button
          className={conflict.resolution === 'theirs' ? 'selected' : ''}
          onClick={() => onResolve('theirs')}
        >
          Accept Theirs
        </button>
        <button
          className={conflict.resolution === 'both' ? 'selected' : ''}
          onClick={() => onResolve('both')}
        >
          Accept Both
        </button>
        <button
          className={showCustomEditor ? 'selected' : ''}
          onClick={() => setShowCustomEditor(!showCustomEditor)}
        >
          Custom Edit
        </button>
      </div>
      
      {showCustomEditor && (
        <div className="custom-editor">
          <textarea
            value={customContent}
            onChange={(e) => setCustomContent(e.target.value)}
            placeholder="Enter custom resolution..."
          />
          <button onClick={() => onResolve('custom', customContent)}>
            Apply Custom
          </button>
        </div>
      )}
      
      <div className="conflict-preview">
        <div className="preview-section">
          <h5>Ours:</h5>
          <pre>{conflict.oursLines.join('\n')}</pre>
        </div>
        <div className="preview-section">
          <h5>Theirs:</h5>
          <pre>{conflict.theirsLines.join('\n')}</pre>
        </div>
      </div>
    </div>
  );
};

// Helper functions
function computeThreeWayDiff(
  base: string,
  ours: string,
  theirs: string
): ConflictRegion[] {
  // Simplified three-way diff algorithm
  // In production, use a proper diff library like diff3
  const conflicts: ConflictRegion[] = [];
  
  // This is a placeholder - real implementation would use
  // a proper three-way merge algorithm
  
  return conflicts;
}

function generateResolvedContent(
  base: string,
  ours: string,
  theirs: string,
  conflicts: ConflictRegion[]
): string {
  // Generate resolved content based on conflict resolutions
  let result = ours; // Start with ours as base
  
  for (const conflict of conflicts) {
    if (conflict.resolution === null) {
      // Keep conflict markers for unresolved
      continue;
    }
    
    let replacement: string;
    switch (conflict.resolution) {
      case 'ours':
        replacement = conflict.oursLines.join('\n');
        break;
      case 'theirs':
        replacement = conflict.theirsLines.join('\n');
        break;
      case 'both':
        replacement = [
          ...conflict.oursLines,
          ...conflict.theirsLines,
        ].join('\n');
        break;
      case 'custom':
        replacement = conflict.customContent || '';
        break;
    }
    
    // Apply replacement (simplified)
    // Real implementation would track line positions
  }
  
  return result;
}

export { MergeEditor };
```

### Conflict Resolution UI Styles

```css
/* src/styles/merge-editor.css */

.merge-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.merge-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.conflict-status .unresolved {
  color: var(--color-warning);
  font-weight: 600;
}

.conflict-status .resolved {
  color: var(--color-success);
  font-weight: 600;
}

.quick-actions {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.split-view {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  flex: 1;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.panel:last-child {
  border-right: none;
}

.panel-header {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
}

.panel.ours .panel-header {
  background: rgba(0, 128, 0, 0.1);
  border-left: 3px solid var(--color-success);
}

.panel.theirs .panel-header {
  background: rgba(0, 0, 255, 0.1);
  border-left: 3px solid var(--color-info);
}

.panel.base .panel-header {
  background: rgba(128, 128, 128, 0.1);
  border-left: 3px solid var(--color-muted);
}

/* Conflict highlighting */
.conflict-region {
  background: rgba(255, 200, 0, 0.2);
  border-left: 3px solid var(--color-warning);
  cursor: pointer;
}

.conflict-region:hover {
  background: rgba(255, 200, 0, 0.3);
}

.conflict-region.active {
  background: rgba(255, 200, 0, 0.4);
}

.conflict-region.resolved {
  background: rgba(0, 200, 0, 0.1);
  border-left-color: var(--color-success);
}

/* Resolution panel */
.conflict-resolution-panel {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  max-width: 90vw;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  padding: 16px;
  z-index: 100;
}

.resolution-options {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.resolution-options button {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.resolution-options button:hover {
  background: var(--bg-tertiary);
}

.resolution-options button.selected {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.custom-editor textarea {
  width: 100%;
  height: 150px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
}

/* Result preview */
.result-preview {
  padding: 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  max-height: 200px;
  overflow: auto;
}

.result-preview pre {
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
}

/* Actions */
.merge-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.merge-editor-actions button.primary {
  background: var(--color-primary);
  color: white;
}

.merge-editor-actions button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Merge Strategies

### Git Merge Strategies

```typescript
// src/services/mergeStrategies.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

type MergeStrategy =
  | 'recursive'    // Default, handles renames
  | 'resolve'      // Simple 3-way merge
  | 'ours'         // Keep our version entirely
  | 'theirs'       // Keep their version entirely (via recursive -X theirs)
  | 'octopus'      // Merge multiple branches
  | 'subtree';     // Subtree merge

interface MergeOptions {
  strategy: MergeStrategy;
  strategyOptions?: string[];  // -X options
  noCommit?: boolean;
  noFastForward?: boolean;
  squash?: boolean;
  message?: string;
}

interface MergeResult {
  success: boolean;
  fastForward: boolean;
  conflicts?: string[];
  commitHash?: string;
  error?: string;
}

class MergeStrategyService {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  async merge(branch: string, options: MergeOptions): Promise<MergeResult> {
    try {
      let cmd = 'git merge';
      
      // Add strategy
      cmd += ` -s ${options.strategy}`;
      
      // Add strategy options
      if (options.strategyOptions) {
        for (const opt of options.strategyOptions) {
          cmd += ` -X ${opt}`;
        }
      }
      
      // Add flags
      if (options.noCommit) cmd += ' --no-commit';
      if (options.noFastForward) cmd += ' --no-ff';
      if (options.squash) cmd += ' --squash';
      if (options.message) cmd += ` -m "${options.message}"`;
      
      cmd += ` ${branch}`;
      
      const { stdout, stderr } = await execAsync(cmd, { cwd: this.projectPath });
      
      // Check for fast-forward
      const fastForward = (stdout + stderr).includes('Fast-forward');
      
      // Get commit hash
      const { stdout: hashOutput } = await execAsync(
        'git rev-parse HEAD',
        { cwd: this.projectPath }
      );
      
      return {
        success: true,
        fastForward,
        commitHash: hashOutput.trim(),
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check for conflicts
      if (errorMessage.includes('CONFLICT') || errorMessage.includes('Automatic merge failed')) {
        const conflicts = await this.getConflictFiles();
        return {
          success: false,
          fastForward: false,
          conflicts,
          error: 'Merge conflicts detected',
        };
      }
      
      return {
        success: false,
        fastForward: false,
        error: errorMessage,
      };
    }
  }
  
  // Merge with automatic conflict resolution preference
  async mergeWithPreference(
    branch: string,
    preference: 'ours' | 'theirs'
  ): Promise<MergeResult> {
    return this.merge(branch, {
      strategy: 'recursive',
      strategyOptions: [preference],
      noFastForward: true,
    });
  }
  
  // Squash merge (combine all commits into one)
  async squashMerge(branch: string, message: string): Promise<MergeResult> {
    const result = await this.merge(branch, {
      strategy: 'recursive',
      squash: true,
    });
    
    if (result.success) {
      // Squash merge requires a separate commit
      await execAsync(
        `git commit -m "${message}"`,
        { cwd: this.projectPath }
      );
      
      const { stdout } = await execAsync(
        'git rev-parse HEAD',
        { cwd: this.projectPath }
      );
      
      result.commitHash = stdout.trim();
    }
    
    return result;
  }
  
  // Rebase instead of merge
  async rebase(branch: string): Promise<MergeResult> {
    try {
      await execAsync(`git rebase ${branch}`, { cwd: this.projectPath });
      
      const { stdout } = await execAsync(
        'git rev-parse HEAD',
        { cwd: this.projectPath }
      );
      
      return {
        success: true,
        fastForward: false,
        commitHash: stdout.trim(),
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('CONFLICT')) {
        const conflicts = await this.getConflictFiles();
        return {
          success: false,
          fastForward: false,
          conflicts,
          error: 'Rebase conflicts detected',
        };
      }
      
      return {
        success: false,
        fastForward: false,
        error: errorMessage,
      };
    }
  }
  
  // Interactive rebase
  async interactiveRebase(
    onto: string,
    instructions: RebaseInstruction[]
  ): Promise<MergeResult> {
    // Create todo file for non-interactive execution
    const todoContent = instructions
      .map(i => `${i.action} ${i.commitHash} ${i.message || ''}`)
      .join('\n');
    
    // Use GIT_SEQUENCE_EDITOR to provide instructions
    const env = {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `echo "${todoContent}" >`,
    };
    
    try {
      await execAsync(
        `git rebase -i ${onto}`,
        { cwd: this.projectPath, env }
      );
      
      return { success: true, fastForward: false };
    } catch (error) {
      return {
        success: false,
        fastForward: false,
        error: (error as Error).message,
      };
    }
  }
  
  private async getConflictFiles(): Promise<string[]> {
    const { stdout } = await execAsync(
      'git diff --name-only --diff-filter=U',
      { cwd: this.projectPath }
    );
    return stdout.split('\n').filter(f => f.trim());
  }
}

interface RebaseInstruction {
  action: 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';
  commitHash: string;
  message?: string;
}

export { MergeStrategyService, MergeStrategy, MergeOptions, MergeResult, RebaseInstruction };
```

### Strategy Selection Guide

| Strategy | Use Case | Conflict Handling |
|----------|----------|-------------------|
| **recursive** | Default, most scenarios | Manual resolution |
| **recursive -X ours** | Prefer current branch | Auto-resolve with ours |
| **recursive -X theirs** | Prefer incoming branch | Auto-resolve with theirs |
| **resolve** | Simple merges | Manual resolution |
| **ours** | Discard incoming entirely | No conflicts |
| **octopus** | Multiple branches | Fails on conflicts |
| **subtree** | Subproject merges | Manual resolution |

---

## Automated Resolution

### Auto-Resolution Service

```typescript
// src/services/autoResolution.ts

interface AutoResolutionConfig {
  enableWhitespaceResolution: boolean;
  enableImportMerging: boolean;
  enableAdjacentMerging: boolean;
  enablePackageJsonMerging: boolean;
  enableLockfileMerging: boolean;
}

interface AutoResolutionResult {
  filePath: string;
  resolved: boolean;
  strategy: string;
  confidence: number;  // 0-1
  warnings?: string[];
}

class AutoResolutionService {
  private projectPath: string;
  private config: AutoResolutionConfig;
  private classifier: ConflictClassifier;
  private resolutionService: ConflictResolutionService;
  
  constructor(
    projectPath: string,
    config: Partial<AutoResolutionConfig> = {}
  ) {
    this.projectPath = projectPath;
    this.config = {
      enableWhitespaceResolution: true,
      enableImportMerging: true,
      enableAdjacentMerging: true,
      enablePackageJsonMerging: true,
      enableLockfileMerging: true,
      ...config,
    };
    this.classifier = new ConflictClassifier();
    this.resolutionService = new ConflictResolutionService(projectPath);
  }
  
  async attemptAutoResolution(file: ConflictFile): Promise<AutoResolutionResult> {
    const results: AutoResolutionResult[] = [];
    
    // Special file handlers
    if (file.path === 'package.json' && this.config.enablePackageJsonMerging) {
      return await this.resolvePackageJson(file);
    }
    
    if (file.path.endsWith('lock') && this.config.enableLockfileMerging) {
      return await this.resolveLockfile(file);
    }
    
    // Process each conflict marker
    for (let i = 0; i < file.conflictMarkers.length; i++) {
      const marker = file.conflictMarkers[i];
      const classification = this.classifier.classifyConflict(file, marker);
      
      if (!classification.autoResolvable) {
        return {
          filePath: file.path,
          resolved: false,
          strategy: 'manual',
          confidence: 0,
        };
      }
      
      // Attempt resolution based on type
      let resolved = false;
      let strategy = '';
      
      switch (classification.type) {
        case 'whitespace_conflict':
          if (this.config.enableWhitespaceResolution) {
            resolved = await this.resolveWhitespace(file.path, i, marker);
            strategy = 'whitespace_normalization';
          }
          break;
          
        case 'import_conflict':
          if (this.config.enableImportMerging) {
            resolved = await this.resolveImports(file.path, i, marker);
            strategy = 'import_merge';
          }
          break;
          
        case 'adjacent_conflict':
          if (this.config.enableAdjacentMerging) {
            resolved = await this.resolveAdjacent(file.path, i, marker);
            strategy = 'keep_both';
          }
          break;
      }
      
      if (!resolved) {
        return {
          filePath: file.path,
          resolved: false,
          strategy: 'manual',
          confidence: 0,
        };
      }
    }
    
    return {
      filePath: file.path,
      resolved: true,
      strategy: 'auto',
      confidence: 0.9,
    };
  }
  
  private async resolveWhitespace(
    filePath: string,
    markerIndex: number,
    marker: ConflictMarker
  ): Promise<boolean> {
    // Normalize whitespace and use ours
    const normalized = marker.oursContent
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
    
    const result = await this.resolutionService.resolveMarker(
      filePath,
      markerIndex,
      'custom',
      normalized
    );
    
    return result.success;
  }
  
  private async resolveImports(
    filePath: string,
    markerIndex: number,
    marker: ConflictMarker
  ): Promise<boolean> {
    // Parse and merge imports
    const oursImports = this.parseImports(marker.oursContent);
    const theirsImports = this.parseImports(marker.theirsContent);
    
    // Merge and deduplicate
    const mergedImports = this.mergeImports(oursImports, theirsImports);
    const mergedContent = this.formatImports(mergedImports);
    
    const result = await this.resolutionService.resolveMarker(
      filePath,
      markerIndex,
      'custom',
      mergedContent
    );
    
    return result.success;
  }
  
  private async resolveAdjacent(
    filePath: string,
    markerIndex: number,
    marker: ConflictMarker
  ): Promise<boolean> {
    // Keep both changes
    const result = await this.resolutionService.resolveMarker(
      filePath,
      markerIndex,
      'both'
    );
    
    return result.success;
  }
  
  private async resolvePackageJson(file: ConflictFile): Promise<AutoResolutionResult> {
    try {
      const oursJson = JSON.parse(file.oursContent || '{}');
      const theirsJson = JSON.parse(file.theirsContent || '{}');
      const baseJson = JSON.parse(file.baseContent || '{}');
      
      // Deep merge with conflict detection
      const merged = this.deepMergePackageJson(baseJson, oursJson, theirsJson);
      
      if (merged.hasConflicts) {
        return {
          filePath: file.path,
          resolved: false,
          strategy: 'manual',
          confidence: 0,
          warnings: merged.conflicts,
        };
      }
      
      // Apply merged content
      const result = await this.resolutionService.applyFullResolution(
        file.path,
        JSON.stringify(merged.result, null, 2) + '\n'
      );
      
      return {
        filePath: file.path,
        resolved: result.success,
        strategy: 'package_json_merge',
        confidence: 0.95,
      };
    } catch (error) {
      return {
        filePath: file.path,
        resolved: false,
        strategy: 'manual',
        confidence: 0,
        warnings: [(error as Error).message],
      };
    }
  }
  
  private async resolveLockfile(file: ConflictFile): Promise<AutoResolutionResult> {
    // For lockfiles, regenerate from package.json
    // This is safer than trying to merge
    return {
      filePath: file.path,
      resolved: false,
      strategy: 'regenerate',
      confidence: 0,
      warnings: ['Lockfile should be regenerated after resolving package.json'],
    };
  }
  
  private parseImports(content: string): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // ES6 imports
      const es6Match = line.match(
        /^import\s+(?:(\*\s+as\s+\w+)|(\{[^}]+\})|(\w+))?\s*(?:,\s*(?:(\{[^}]+\})|(\w+)))?\s*from\s+['"]([^'"]+)['"]/
      );
      
      if (es6Match) {
        imports.push({
          type: 'es6',
          source: es6Match[6],
          raw: line,
        });
        continue;
      }
      
      // CommonJS require
      const cjsMatch = line.match(
        /^(?:const|let|var)\s+(?:(\{[^}]+\})|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/
      );
      
      if (cjsMatch) {
        imports.push({
          type: 'commonjs',
          source: cjsMatch[3],
          raw: line,
        });
      }
    }
    
    return imports;
  }
  
  private mergeImports(
    ours: ImportStatement[],
    theirs: ImportStatement[]
  ): ImportStatement[] {
    const seen = new Set<string>();
    const merged: ImportStatement[] = [];
    
    // Add all unique imports
    for (const imp of [...ours, ...theirs]) {
      const key = `${imp.type}:${imp.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(imp);
      }
    }
    
    // Sort by source
    merged.sort((a, b) => a.source.localeCompare(b.source));
    
    return merged;
  }
  
  private formatImports(imports: ImportStatement[]): string {
    return imports.map(i => i.raw).join('\n');
  }
  
  private deepMergePackageJson(
    base: any,
    ours: any,
    theirs: any
  ): { result: any; hasConflicts: boolean; conflicts: string[] } {
    const result: any = { ...base };
    const conflicts: string[] = [];
    
    const allKeys = new Set([
      ...Object.keys(ours),
      ...Object.keys(theirs),
    ]);
    
    for (const key of allKeys) {
      const baseVal = base[key];
      const oursVal = ours[key];
      const theirsVal = theirs[key];
      
      // Both same as base - no change
      if (JSON.stringify(oursVal) === JSON.stringify(baseVal) &&
          JSON.stringify(theirsVal) === JSON.stringify(baseVal)) {
        result[key] = baseVal;
        continue;
      }
      
      // Only ours changed
      if (JSON.stringify(theirsVal) === JSON.stringify(baseVal)) {
        result[key] = oursVal;
        continue;
      }
      
      // Only theirs changed
      if (JSON.stringify(oursVal) === JSON.stringify(baseVal)) {
        result[key] = theirsVal;
        continue;
      }
      
      // Both changed to same value
      if (JSON.stringify(oursVal) === JSON.stringify(theirsVal)) {
        result[key] = oursVal;
        continue;
      }
      
      // Both changed differently - handle special cases
      if (key === 'dependencies' || key === 'devDependencies' || key === 'peerDependencies') {
        // Merge dependencies
        result[key] = {
          ...(baseVal || {}),
          ...(theirsVal || {}),
          ...(oursVal || {}),  // Ours takes precedence
        };
        continue;
      }
      
      if (key === 'scripts') {
        // Merge scripts, ours takes precedence
        result[key] = {
          ...(baseVal || {}),
          ...(theirsVal || {}),
          ...(oursVal || {}),
        };
        continue;
      }
      
      // Conflict - can't auto-resolve
      conflicts.push(`Conflict in "${key}": ours="${JSON.stringify(oursVal)}", theirs="${JSON.stringify(theirsVal)}"`);
    }
    
    return {
      result,
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }
}

interface ImportStatement {
  type: 'es6' | 'commonjs';
  source: string;
  raw: string;
}

export { AutoResolutionService, AutoResolutionConfig, AutoResolutionResult };
```

---

## Three-Way Merge

### Three-Way Merge Algorithm

```typescript
// src/services/threeWayMerge.ts

interface DiffHunk {
  baseStart: number;
  baseLength: number;
  newStart: number;
  newLength: number;
  lines: string[];
}

interface MergeRegion {
  type: 'unchanged' | 'ours' | 'theirs' | 'conflict';
  baseLines: string[];
  oursLines: string[];
  theirsLines: string[];
}

class ThreeWayMerge {
  merge(
    base: string,
    ours: string,
    theirs: string
  ): { result: string; conflicts: MergeRegion[] } {
    const baseLines = base.split('\n');
    const oursLines = ours.split('\n');
    const theirsLines = theirs.split('\n');
    
    // Compute diffs
    const oursDiff = this.computeDiff(baseLines, oursLines);
    const theirsDiff = this.computeDiff(baseLines, theirsLines);
    
    // Find merge regions
    const regions = this.findMergeRegions(baseLines, oursDiff, theirsDiff);
    
    // Generate result
    const resultLines: string[] = [];
    const conflicts: MergeRegion[] = [];
    
    for (const region of regions) {
      switch (region.type) {
        case 'unchanged':
          resultLines.push(...region.baseLines);
          break;
        case 'ours':
          resultLines.push(...region.oursLines);
          break;
        case 'theirs':
          resultLines.push(...region.theirsLines);
          break;
        case 'conflict':
          // Add conflict markers
          resultLines.push(`<<<<<<< ours`);
          resultLines.push(...region.oursLines);
          resultLines.push(`=======`);
          resultLines.push(...region.theirsLines);
          resultLines.push(`>>>>>>> theirs`);
          conflicts.push(region);
          break;
      }
    }
    
    return {
      result: resultLines.join('\n'),
      conflicts,
    };
  }
  
  private computeDiff(base: string[], modified: string[]): DiffHunk[] {
    // Simplified LCS-based diff
    // In production, use a proper diff library
    const hunks: DiffHunk[] = [];
    
    const lcs = this.longestCommonSubsequence(base, modified);
    
    let baseIdx = 0;
    let modIdx = 0;
    let lcsIdx = 0;
    
    while (baseIdx < base.length || modIdx < modified.length) {
      // Find next common line
      let nextCommonBase = base.length;
      let nextCommonMod = modified.length;
      
      if (lcsIdx < lcs.length) {
        // Find position of next LCS element
        for (let i = baseIdx; i < base.length; i++) {
          if (base[i] === lcs[lcsIdx]) {
            nextCommonBase = i;
            break;
          }
        }
        for (let i = modIdx; i < modified.length; i++) {
          if (modified[i] === lcs[lcsIdx]) {
            nextCommonMod = i;
            break;
          }
        }
      }
      
      // Create hunk for differences before common line
      if (baseIdx < nextCommonBase || modIdx < nextCommonMod) {
        hunks.push({
          baseStart: baseIdx,
          baseLength: nextCommonBase - baseIdx,
          newStart: modIdx,
          newLength: nextCommonMod - modIdx,
          lines: modified.slice(modIdx, nextCommonMod),
        });
      }
      
      // Skip common line
      baseIdx = nextCommonBase + 1;
      modIdx = nextCommonMod + 1;
      lcsIdx++;
    }
    
    return hunks;
  }
  
  private findMergeRegions(
    base: string[],
    oursDiff: DiffHunk[],
    theirsDiff: DiffHunk[]
  ): MergeRegion[] {
    const regions: MergeRegion[] = [];
    
    // Create a timeline of changes
    const events: Array<{
      pos: number;
      type: 'ours_start' | 'ours_end' | 'theirs_start' | 'theirs_end';
      hunk?: DiffHunk;
    }> = [];
    
    for (const hunk of oursDiff) {
      events.push({ pos: hunk.baseStart, type: 'ours_start', hunk });
      events.push({ pos: hunk.baseStart + hunk.baseLength, type: 'ours_end' });
    }
    
    for (const hunk of theirsDiff) {
      events.push({ pos: hunk.baseStart, type: 'theirs_start', hunk });
      events.push({ pos: hunk.baseStart + hunk.baseLength, type: 'theirs_end' });
    }
    
    // Sort events by position
    events.sort((a, b) => a.pos - b.pos);
    
    // Process events to find regions
    let currentPos = 0;
    let inOurs = false;
    let inTheirs = false;
    let currentOursHunk: DiffHunk | null = null;
    let currentTheirsHunk: DiffHunk | null = null;
    
    for (const event of events) {
      // Add unchanged region before this event
      if (event.pos > currentPos && !inOurs && !inTheirs) {
        regions.push({
          type: 'unchanged',
          baseLines: base.slice(currentPos, event.pos),
          oursLines: base.slice(currentPos, event.pos),
          theirsLines: base.slice(currentPos, event.pos),
        });
      }
      
      // Process event
      switch (event.type) {
        case 'ours_start':
          inOurs = true;
          currentOursHunk = event.hunk!;
          break;
        case 'ours_end':
          if (!inTheirs && currentOursHunk) {
            regions.push({
              type: 'ours',
              baseLines: base.slice(currentOursHunk.baseStart, currentOursHunk.baseStart + currentOursHunk.baseLength),
              oursLines: currentOursHunk.lines,
              theirsLines: base.slice(currentOursHunk.baseStart, currentOursHunk.baseStart + currentOursHunk.baseLength),
            });
          }
          inOurs = false;
          currentOursHunk = null;
          break;
        case 'theirs_start':
          inTheirs = true;
          currentTheirsHunk = event.hunk!;
          break;
        case 'theirs_end':
          if (!inOurs && currentTheirsHunk) {
            regions.push({
              type: 'theirs',
              baseLines: base.slice(currentTheirsHunk.baseStart, currentTheirsHunk.baseStart + currentTheirsHunk.baseLength),
              oursLines: base.slice(currentTheirsHunk.baseStart, currentTheirsHunk.baseStart + currentTheirsHunk.baseLength),
              theirsLines: currentTheirsHunk.lines,
            });
          }
          inTheirs = false;
          currentTheirsHunk = null;
          break;
      }
      
      // Check for conflict (both active)
      if (inOurs && inTheirs && currentOursHunk && currentTheirsHunk) {
        regions.push({
          type: 'conflict',
          baseLines: base.slice(
            Math.min(currentOursHunk.baseStart, currentTheirsHunk.baseStart),
            Math.max(
              currentOursHunk.baseStart + currentOursHunk.baseLength,
              currentTheirsHunk.baseStart + currentTheirsHunk.baseLength
            )
          ),
          oursLines: currentOursHunk.lines,
          theirsLines: currentTheirsHunk.lines,
        });
      }
      
      currentPos = event.pos;
    }
    
    // Add final unchanged region
    if (currentPos < base.length) {
      regions.push({
        type: 'unchanged',
        baseLines: base.slice(currentPos),
        oursLines: base.slice(currentPos),
        theirsLines: base.slice(currentPos),
      });
    }
    
    return regions;
  }
  
  private longestCommonSubsequence(a: string[], b: string[]): string[] {
    const m = a.length;
    const n = b.length;
    
    // DP table
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));
    
    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Backtrack to find LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;
    
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        lcs.unshift(a[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return lcs;
  }
}

export { ThreeWayMerge, MergeRegion, DiffHunk };
```

---

## Conflict Prevention

### Pre-merge Conflict Check

```typescript
// src/services/conflictPrevention.ts

interface ConflictPreview {
  willConflict: boolean;
  conflictFiles: string[];
  conflictCount: number;
  safeToMerge: boolean;
  recommendations: string[];
}

class ConflictPreventionService {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }
  
  // Preview merge without actually merging
  async previewMerge(branch: string): Promise<ConflictPreview> {
    try {
      // Try merge with --no-commit --no-ff
      await execAsync(
        `git merge --no-commit --no-ff ${branch}`,
        { cwd: this.projectPath }
      );
      
      // Check for conflicts
      const { stdout } = await execAsync(
        'git diff --name-only --diff-filter=U',
        { cwd: this.projectPath }
      );
      
      const conflictFiles = stdout.split('\n').filter(f => f.trim());
      
      // Abort the merge
      await execAsync('git merge --abort', { cwd: this.projectPath });
      
      const recommendations: string[] = [];
      
      if (conflictFiles.length > 0) {
        recommendations.push('Consider rebasing your branch first');
        recommendations.push('Review conflicting files before merging');
        
        if (conflictFiles.some(f => f.endsWith('.lock'))) {
          recommendations.push('Regenerate lockfiles after merge');
        }
      }
      
      return {
        willConflict: conflictFiles.length > 0,
        conflictFiles,
        conflictCount: conflictFiles.length,
        safeToMerge: conflictFiles.length === 0,
        recommendations,
      };
    } catch (error) {
      // Merge failed - definitely has conflicts
      const { stdout } = await execAsync(
        'git diff --name-only --diff-filter=U',
        { cwd: this.projectPath }
      ).catch(() => ({ stdout: '' }));
      
      // Abort
      await execAsync('git merge --abort', { cwd: this.projectPath }).catch(() => {});
      
      const conflictFiles = stdout.split('\n').filter(f => f.trim());
      
      return {
        willConflict: true,
        conflictFiles,
        conflictCount: conflictFiles.length,
        safeToMerge: false,
        recommendations: [
          'Merge will have conflicts',
          'Consider resolving conflicts in a separate branch first',
        ],
      };
    }
  }
  
  // Check if branch is up to date
  async checkBranchStatus(branch: string): Promise<{
    isUpToDate: boolean;
    behind: number;
    ahead: number;
    diverged: boolean;
    recommendation: string;
  }> {
    try {
      const { stdout } = await execAsync(
        `git rev-list --left-right --count HEAD...${branch}`,
        { cwd: this.projectPath }
      );
      
      const [ahead, behind] = stdout.trim().split(/\s+/).map(n => parseInt(n, 10));
      
      let recommendation = '';
      
      if (behind === 0 && ahead === 0) {
        recommendation = 'Branches are identical';
      } else if (behind === 0) {
        recommendation = 'Fast-forward merge possible';
      } else if (ahead === 0) {
        recommendation = 'Your branch is behind - consider pulling first';
      } else {
        recommendation = 'Branches have diverged - merge or rebase needed';
      }
      
      return {
        isUpToDate: behind === 0,
        behind,
        ahead,
        diverged: ahead > 0 && behind > 0,
        recommendation,
      };
    } catch {
      return {
        isUpToDate: false,
        behind: 0,
        ahead: 0,
        diverged: false,
        recommendation: 'Unable to determine branch status',
      };
    }
  }
  
  // Suggest best merge strategy
  async suggestMergeStrategy(branch: string): Promise<{
    strategy: MergeStrategy;
    reason: string;
  }> {
    const status = await this.checkBranchStatus(branch);
    const preview = await this.previewMerge(branch);
    
    if (status.behind === 0) {
      return {
        strategy: 'recursive',
        reason: 'Fast-forward merge possible - no conflicts expected',
      };
    }
    
    if (!preview.willConflict) {
      return {
        strategy: 'recursive',
        reason: 'Clean merge possible with recursive strategy',
      };
    }
    
    if (preview.conflictCount <= 3) {
      return {
        strategy: 'recursive',
        reason: 'Few conflicts - manual resolution recommended',
      };
    }
    
    return {
      strategy: 'recursive',
      reason: 'Multiple conflicts - consider rebasing first to reduce conflicts',
    };
  }
}

export { ConflictPreventionService, ConflictPreview };
```

---

## API Reference

### REST API Endpoints

```yaml
# openapi.yaml (partial)
paths:
  /api/v1/sandboxes/{sandboxId}/conflicts:
    get:
      summary: Get current conflict state
      responses:
        '200':
          description: Conflict state
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConflictState'

  /api/v1/sandboxes/{sandboxId}/conflicts/files:
    get:
      summary: List files with conflicts
      responses:
        '200':
          description: Conflict files
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ConflictFile'

  /api/v1/sandboxes/{sandboxId}/conflicts/resolve:
    post:
      summary: Resolve a conflict
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                filePath:
                  type: string
                strategy:
                  type: string
                  enum: [ours, theirs, union, manual]
                customContent:
                  type: string
      responses:
        '200':
          description: Resolution result

  /api/v1/sandboxes/{sandboxId}/conflicts/complete:
    post:
      summary: Complete merge after resolving all conflicts
      responses:
        '200':
          description: Merge completed

  /api/v1/sandboxes/{sandboxId}/conflicts/abort:
    post:
      summary: Abort current merge/rebase
      responses:
        '200':
          description: Merge aborted

  /api/v1/sandboxes/{sandboxId}/merge/preview:
    post:
      summary: Preview merge without committing
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                branch:
                  type: string
      responses:
        '200':
          description: Merge preview
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConflictPreview'
```

---

## Best Practices

### 1. Always Preview Before Merge

```typescript
// Check for conflicts before merging
const preview = await conflictPrevention.previewMerge('feature-branch');

if (preview.willConflict) {
  console.log(`Warning: ${preview.conflictCount} files will conflict`);
  console.log('Conflicting files:', preview.conflictFiles);
}
```

### 2. Use Appropriate Strategies

| Scenario | Recommended Strategy |
|----------|---------------------|
| Feature branch merge | `recursive` (default) |
| Hotfix to main | `recursive` with `--no-ff` |
| Sync with upstream | `rebase` |
| Discard feature changes | `ours` |
| Accept all upstream | `recursive -X theirs` |

### 3. Handle Lockfiles Properly

```typescript
// After resolving package.json conflicts
if (conflictFiles.includes('package-lock.json')) {
  // Regenerate lockfile
  await execAsync('npm install', { cwd: projectPath });
  await execAsync('git add package-lock.json', { cwd: projectPath });
}
```

### 4. Communicate Conflict Status

```typescript
// Real-time conflict notifications
conflictMonitor.on('conflict', (event) => {
  switch (event.type) {
    case 'conflict_started':
      notifyUser(`Merge conflict detected in ${event.files?.length} files`);
      break;
    case 'file_resolved':
      notifyUser(`Resolved: ${event.resolvedFile}`);
      break;
    case 'conflict_resolved':
      notifyUser('All conflicts resolved - merge complete');
      break;
  }
});
```

---

## Summary

### Conflict Handling Components

| Component | Purpose |
|-----------|---------|
| **Detection Service** | Identify conflicts and parse markers |
| **Classifier** | Categorize conflicts by type |
| **Resolution Service** | Apply resolutions |
| **Auto-Resolution** | Automatically resolve simple conflicts |
| **Three-Way Merge** | Core merge algorithm |
| **Prevention Service** | Preview and prevent conflicts |
| **Merge Editor UI** | Visual conflict resolution |

### Resolution Strategies

| Strategy | Use Case | Auto-Resolvable |
|----------|----------|-----------------|
| **ours** | Keep current branch | Yes |
| **theirs** | Accept incoming | Yes |
| **both** | Keep both changes | Sometimes |
| **manual** | Complex conflicts | No |
| **union** | Merge all lines | Sometimes |

### Key Metrics

| Metric | Target |
|--------|--------|
| Conflict detection time | <100ms |
| Auto-resolution rate | >40% |
| UI response time | <50ms |
| Merge preview time | <2s |
