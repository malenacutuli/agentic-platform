# Concurrent Edit Handling

This guide provides comprehensive coverage of handling concurrent edits in collaborative development environments, including same-file edits by different users, same-project edits by different sessions, and conflict resolution strategies.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Same File Concurrent Edits](#same-file-concurrent-edits)
4. [Same Project Different Sessions](#same-project-different-sessions)
5. [Conflict Detection](#conflict-detection)
6. [Conflict Resolution Strategies](#conflict-resolution-strategies)
7. [Lock-Based Concurrency](#lock-based-concurrency)
8. [Optimistic Concurrency Control](#optimistic-concurrency-control)
9. [Version Vectors](#version-vectors)
10. [Database Schema](#database-schema)
11. [Implementation](#implementation)
12. [API Reference](#api-reference)
13. [Testing Concurrent Edits](#testing-concurrent-edits)
14. [Best Practices](#best-practices)

---

## Overview

Concurrent editing occurs when multiple users or sessions modify the same resource simultaneously. Without proper handling, this leads to data loss, inconsistencies, or conflicts.

### Concurrency Scenarios

| Scenario | Description | Complexity |
|----------|-------------|------------|
| **Same file, same line** | Two users edit the same line | High |
| **Same file, different lines** | Two users edit different parts | Medium |
| **Same project, different files** | Two users edit different files | Low |
| **Same session, multiple tabs** | One user with multiple browser tabs | Medium |
| **AI + Human** | AI agent and human editing together | High |

### Concurrency Control Approaches

| Approach | Description | Use Case |
|----------|-------------|----------|
| **Pessimistic (Locking)** | Lock resource before editing | Critical data, short edits |
| **Optimistic** | Detect conflicts on save | Long edits, rare conflicts |
| **Real-time (CRDT/OT)** | Merge changes automatically | Collaborative editing |
| **Hybrid** | Combine approaches | Complex applications |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        CONCURRENT EDIT HANDLING ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CLIENT LAYER                                        │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   Editor    │    │   Version   │    │  Conflict   │    │   Session   │       │   │
│  │  │   Client    │◄──►│   Tracker   │◄──►│  Resolver   │◄──►│   Manager   │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │        │                  │                  │                  │                │   │
│  │        └──────────────────┼──────────────────┼──────────────────┘                │   │
│  │                           │                  │                                    │   │
│  │                           ▼                  ▼                                    │   │
│  │                    ┌─────────────────────────────────┐                           │   │
│  │                    │      Sync Engine                │                           │   │
│  │                    │   (WebSocket + REST)            │                           │   │
│  │                    └─────────────────────────────────┘                           │   │
│  │                                    │                                              │   │
│  └────────────────────────────────────┼──────────────────────────────────────────────┘   │
│                                       │                                                  │
│                                       │ WebSocket / HTTP                                 │
│                                       │                                                  │
│  ┌────────────────────────────────────┼──────────────────────────────────────────────┐   │
│  │                              SERVER LAYER                                         │   │
│  │                                    │                                              │   │
│  │        ┌───────────────────────────┼───────────────────────────┐                 │   │
│  │        │                           │                           │                 │   │
│  │        ▼                           ▼                           ▼                 │   │
│  │  ┌───────────┐              ┌───────────┐              ┌───────────┐            │   │
│  │  │ Conflict  │              │   Lock    │              │  Version  │            │   │
│  │  │ Detector  │              │  Manager  │              │  Control  │            │   │
│  │  └───────────┘              └───────────┘              └───────────┘            │   │
│  │        │                           │                           │                 │   │
│  │        └───────────────────────────┼───────────────────────────┘                 │   │
│  │                                    │                                              │   │
│  │                                    ▼                                              │   │
│  │                    ┌───────────────────────────────┐                             │   │
│  │                    │      Storage Layer            │                             │   │
│  │                    │   (Database + File System)    │                             │   │
│  │                    └───────────────────────────────┘                             │   │
│  │                                                                                   │   │
│  └───────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow for Concurrent Edits

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CONCURRENT EDIT DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER A                        SERVER                         USER B                    │
│    │                             │                              │                       │
│    │  1. Open file.ts            │                              │                       │
│    │     version: 5              │                              │                       │
│    │ ───────────────────────────►│                              │                       │
│    │                             │  2. Open file.ts             │                       │
│    │                             │     version: 5               │                       │
│    │                             │ ◄─────────────────────────────                       │
│    │                             │                              │                       │
│    │  3. Edit line 10            │                              │                       │
│    │     base: 5                 │                              │                       │
│    │ ───────────────────────────►│                              │                       │
│    │                             │                              │                       │
│    │                             │  4. Edit line 10             │                       │
│    │                             │     base: 5                  │                       │
│    │                             │ ◄─────────────────────────────                       │
│    │                             │                              │                       │
│    │                             │  5. CONFLICT DETECTED!       │                       │
│    │                             │     Same line, same base     │                       │
│    │                             │                              │                       │
│    │  6. Save (wins)             │                              │                       │
│    │     version: 6              │                              │                       │
│    │ ◄───────────────────────────│                              │                       │
│    │                             │                              │                       │
│    │                             │  7. Conflict notification    │                       │
│    │                             │     Your base is stale       │                       │
│    │                             │ ─────────────────────────────►                       │
│    │                             │                              │                       │
│    │                             │                              │  8. Resolve conflict  │
│    │                             │                              │ ─────────────────┐    │
│    │                             │                              │                  │    │
│    │                             │                              │ ◄────────────────┘    │
│    │                             │                              │                       │
│    │                             │  9. Save (merged)            │                       │
│    │                             │     version: 7               │                       │
│    │                             │ ◄─────────────────────────────                       │
│    │                             │                              │                       │
│    │  10. Receive update         │                              │                       │
│    │      version: 7             │                              │                       │
│    │ ◄───────────────────────────│                              │                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Same File Concurrent Edits

### Scenario Analysis

When two users edit the same file simultaneously, several outcomes are possible:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        SAME FILE EDIT SCENARIOS                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SCENARIO 1: Different Lines (Auto-Mergeable)                                           │
│  ─────────────────────────────────────────────                                          │
│                                                                                         │
│  Original:          User A:              User B:              Merged:                   │
│  ┌──────────┐      ┌──────────┐        ┌──────────┐        ┌──────────┐               │
│  │ Line 1   │      │ Line 1   │        │ Line 1   │        │ Line 1   │               │
│  │ Line 2   │      │ Line 2A  │ ◄──    │ Line 2   │        │ Line 2A  │               │
│  │ Line 3   │      │ Line 3   │        │ Line 3B  │ ◄──    │ Line 3B  │               │
│  │ Line 4   │      │ Line 4   │        │ Line 4   │        │ Line 4   │               │
│  └──────────┘      └──────────┘        └──────────┘        └──────────┘               │
│                                                                                         │
│  Result: ✅ Auto-merged successfully                                                    │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  SCENARIO 2: Same Line (Conflict)                                                       │
│  ────────────────────────────────                                                       │
│                                                                                         │
│  Original:          User A:              User B:              Conflict:                 │
│  ┌──────────┐      ┌──────────┐        ┌──────────┐        ┌──────────┐               │
│  │ Line 1   │      │ Line 1   │        │ Line 1   │        │ Line 1   │               │
│  │ Line 2   │      │ Line 2A  │ ◄──    │ Line 2B  │ ◄──    │ <<<<<<   │               │
│  │ Line 3   │      │ Line 3   │        │ Line 3   │        │ Line 2A  │               │
│  │ Line 4   │      │ Line 4   │        │ Line 4   │        │ ======   │               │
│  └──────────┘      └──────────┘        └──────────┘        │ Line 2B  │               │
│                                                             │ >>>>>>   │               │
│                                                             │ Line 3   │               │
│                                                             │ Line 4   │               │
│                                                             └──────────┘               │
│                                                                                         │
│  Result: ⚠️ Manual resolution required                                                  │
│                                                                                         │
│  ─────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  SCENARIO 3: Adjacent Lines (Context-Dependent)                                         │
│  ──────────────────────────────────────────────                                         │
│                                                                                         │
│  Original:          User A:              User B:              Result:                   │
│  ┌──────────┐      ┌──────────┐        ┌──────────┐        ┌──────────┐               │
│  │ Line 1   │      │ Line 1   │        │ Line 1   │        │ Line 1   │               │
│  │ Line 2   │      │ Line 2   │        │ New Line │ ◄──    │ New Line │               │
│  │ Line 3   │      │ Line 3A  │ ◄──    │ Line 2   │        │ Line 2   │               │
│  │ Line 4   │      │ Line 4   │        │ Line 3   │        │ Line 3A  │               │
│  └──────────┘      └──────────┘        │ Line 4   │        │ Line 4   │               │
│                                        └──────────┘        └──────────┘               │
│                                                                                         │
│  Result: ✅ Usually auto-mergeable (depends on algorithm)                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// src/concurrency/sameFileHandler.ts

import { diff_match_patch } from 'diff-match-patch';

interface FileVersion {
  content: string;
  version: number;
  hash: string;
  lastModifiedBy: string;
  lastModifiedAt: Date;
}

interface EditOperation {
  userId: string;
  sessionId: string;
  baseVersion: number;
  changes: Change[];
  timestamp: Date;
}

interface Change {
  type: 'insert' | 'delete' | 'replace';
  startLine: number;
  endLine: number;
  content?: string;
}

interface MergeResult {
  success: boolean;
  content?: string;
  conflicts?: Conflict[];
  newVersion: number;
}

interface Conflict {
  startLine: number;
  endLine: number;
  base: string;
  ours: string;
  theirs: string;
}

class SameFileEditHandler {
  private dmp: diff_match_patch;
  
  constructor() {
    this.dmp = new diff_match_patch();
  }
  
  // Handle concurrent edit attempt
  async handleEdit(
    fileId: string,
    edit: EditOperation,
    currentVersion: FileVersion
  ): Promise<MergeResult> {
    // Check if edit is based on current version
    if (edit.baseVersion === currentVersion.version) {
      // No conflict - apply directly
      return this.applyEdit(currentVersion, edit);
    }
    
    // Edit is based on older version - need to merge
    const baseVersion = await this.getVersion(fileId, edit.baseVersion);
    if (!baseVersion) {
      throw new Error(`Base version ${edit.baseVersion} not found`);
    }
    
    // Attempt three-way merge
    return this.threeWayMerge(baseVersion, currentVersion, edit);
  }
  
  private applyEdit(version: FileVersion, edit: EditOperation): MergeResult {
    let content = version.content;
    const lines = content.split('\n');
    
    // Apply changes in reverse order to preserve line numbers
    const sortedChanges = [...edit.changes].sort((a, b) => b.startLine - a.startLine);
    
    for (const change of sortedChanges) {
      switch (change.type) {
        case 'insert':
          lines.splice(change.startLine, 0, change.content || '');
          break;
        case 'delete':
          lines.splice(change.startLine, change.endLine - change.startLine + 1);
          break;
        case 'replace':
          lines.splice(
            change.startLine,
            change.endLine - change.startLine + 1,
            change.content || ''
          );
          break;
      }
    }
    
    return {
      success: true,
      content: lines.join('\n'),
      newVersion: version.version + 1,
    };
  }
  
  private threeWayMerge(
    base: FileVersion,
    current: FileVersion,
    edit: EditOperation
  ): MergeResult {
    // Apply edit to base to get "ours"
    const oursResult = this.applyEdit(base, edit);
    if (!oursResult.success || !oursResult.content) {
      throw new Error('Failed to apply edit to base');
    }
    
    const ours = oursResult.content;
    const theirs = current.content;
    const baseContent = base.content;
    
    // Use diff-match-patch for merging
    const diffs = this.dmp.diff_main(baseContent, theirs);
    this.dmp.diff_cleanupSemantic(diffs);
    
    const patches = this.dmp.patch_make(baseContent, diffs);
    const [merged, results] = this.dmp.patch_apply(patches, ours);
    
    // Check if all patches applied successfully
    const allApplied = results.every(r => r);
    
    if (allApplied) {
      return {
        success: true,
        content: merged,
        newVersion: current.version + 1,
      };
    }
    
    // Some patches failed - detect conflicts
    const conflicts = this.detectConflicts(baseContent, ours, theirs);
    
    if (conflicts.length === 0) {
      // Patches failed but no semantic conflicts - use merged result
      return {
        success: true,
        content: merged,
        newVersion: current.version + 1,
      };
    }
    
    return {
      success: false,
      conflicts,
      newVersion: current.version,
    };
  }
  
  private detectConflicts(base: string, ours: string, theirs: string): Conflict[] {
    const conflicts: Conflict[] = [];
    
    const baseLines = base.split('\n');
    const oursLines = ours.split('\n');
    const theirsLines = theirs.split('\n');
    
    // Simple line-by-line conflict detection
    const maxLines = Math.max(baseLines.length, oursLines.length, theirsLines.length);
    
    let conflictStart = -1;
    let conflictBase: string[] = [];
    let conflictOurs: string[] = [];
    let conflictTheirs: string[] = [];
    
    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i] || '';
      const oursLine = oursLines[i] || '';
      const theirsLine = theirsLines[i] || '';
      
      const oursChanged = oursLine !== baseLine;
      const theirsChanged = theirsLine !== baseLine;
      
      if (oursChanged && theirsChanged && oursLine !== theirsLine) {
        // Conflict detected
        if (conflictStart === -1) {
          conflictStart = i;
        }
        conflictBase.push(baseLine);
        conflictOurs.push(oursLine);
        conflictTheirs.push(theirsLine);
      } else if (conflictStart !== -1) {
        // End of conflict region
        conflicts.push({
          startLine: conflictStart,
          endLine: i - 1,
          base: conflictBase.join('\n'),
          ours: conflictOurs.join('\n'),
          theirs: conflictTheirs.join('\n'),
        });
        
        conflictStart = -1;
        conflictBase = [];
        conflictOurs = [];
        conflictTheirs = [];
      }
    }
    
    // Handle conflict at end of file
    if (conflictStart !== -1) {
      conflicts.push({
        startLine: conflictStart,
        endLine: maxLines - 1,
        base: conflictBase.join('\n'),
        ours: conflictOurs.join('\n'),
        theirs: conflictTheirs.join('\n'),
      });
    }
    
    return conflicts;
  }
  
  private async getVersion(fileId: string, version: number): Promise<FileVersion | null> {
    // Fetch from version history storage
    return null; // Implement based on storage
  }
}

export { SameFileEditHandler, FileVersion, EditOperation, MergeResult, Conflict };
```

---

## Same Project Different Sessions

### Session Management

```typescript
// src/concurrency/sessionManager.ts

interface Session {
  id: string;
  userId: string;
  projectId: string;
  sandboxId: string;
  createdAt: Date;
  lastActiveAt: Date;
  openFiles: Set<string>;
  unsavedChanges: Map<string, string>;
}

interface SessionConflict {
  type: 'file_lock' | 'unsaved_changes' | 'version_mismatch';
  fileId: string;
  sessions: string[];
  details: any;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private fileLocks: Map<string, string> = new Map(); // fileId -> sessionId
  private projectSessions: Map<string, Set<string>> = new Map(); // projectId -> sessionIds
  
  // Create new session
  createSession(userId: string, projectId: string, sandboxId: string): Session {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      projectId,
      sandboxId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      openFiles: new Set(),
      unsavedChanges: new Map(),
    };
    
    this.sessions.set(session.id, session);
    
    // Track project sessions
    if (!this.projectSessions.has(projectId)) {
      this.projectSessions.set(projectId, new Set());
    }
    this.projectSessions.get(projectId)!.add(session.id);
    
    return session;
  }
  
  // Open file in session
  openFile(sessionId: string, fileId: string): SessionConflict | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Check for conflicts with other sessions
    const conflict = this.checkFileConflicts(sessionId, fileId);
    if (conflict) {
      return conflict;
    }
    
    session.openFiles.add(fileId);
    session.lastActiveAt = new Date();
    
    return null;
  }
  
  // Track unsaved changes
  trackUnsavedChanges(sessionId: string, fileId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.unsavedChanges.set(fileId, content);
    session.lastActiveAt = new Date();
  }
  
  // Clear unsaved changes (after save)
  clearUnsavedChanges(sessionId: string, fileId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.unsavedChanges.delete(fileId);
  }
  
  // Acquire file lock
  acquireLock(sessionId: string, fileId: string): boolean {
    const currentLock = this.fileLocks.get(fileId);
    
    if (currentLock && currentLock !== sessionId) {
      // File is locked by another session
      return false;
    }
    
    this.fileLocks.set(fileId, sessionId);
    return true;
  }
  
  // Release file lock
  releaseLock(sessionId: string, fileId: string): void {
    const currentLock = this.fileLocks.get(fileId);
    
    if (currentLock === sessionId) {
      this.fileLocks.delete(fileId);
    }
  }
  
  // Check for conflicts when opening a file
  private checkFileConflicts(sessionId: string, fileId: string): SessionConflict | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Check if file is locked
    const lockHolder = this.fileLocks.get(fileId);
    if (lockHolder && lockHolder !== sessionId) {
      return {
        type: 'file_lock',
        fileId,
        sessions: [lockHolder],
        details: {
          lockedBy: this.sessions.get(lockHolder)?.userId,
        },
      };
    }
    
    // Check if other sessions have unsaved changes
    const projectSessionIds = this.projectSessions.get(session.projectId);
    if (projectSessionIds) {
      const sessionsWithUnsaved: string[] = [];
      
      projectSessionIds.forEach(sid => {
        if (sid !== sessionId) {
          const otherSession = this.sessions.get(sid);
          if (otherSession?.unsavedChanges.has(fileId)) {
            sessionsWithUnsaved.push(sid);
          }
        }
      });
      
      if (sessionsWithUnsaved.length > 0) {
        return {
          type: 'unsaved_changes',
          fileId,
          sessions: sessionsWithUnsaved,
          details: {
            message: 'Other sessions have unsaved changes to this file',
          },
        };
      }
    }
    
    return null;
  }
  
  // Get all sessions for a project
  getProjectSessions(projectId: string): Session[] {
    const sessionIds = this.projectSessions.get(projectId);
    if (!sessionIds) return [];
    
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is Session => s !== undefined);
  }
  
  // Get sessions editing a specific file
  getFileEditors(fileId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.openFiles.has(fileId));
  }
  
  // Close session
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Release all locks
    session.openFiles.forEach(fileId => {
      this.releaseLock(sessionId, fileId);
    });
    
    // Remove from project sessions
    const projectSessions = this.projectSessions.get(session.projectId);
    if (projectSessions) {
      projectSessions.delete(sessionId);
    }
    
    this.sessions.delete(sessionId);
  }
  
  // Handle session timeout
  cleanupInactiveSessions(maxInactiveMs: number = 3600000): void {
    const now = Date.now();
    
    this.sessions.forEach((session, id) => {
      if (now - session.lastActiveAt.getTime() > maxInactiveMs) {
        this.closeSession(id);
      }
    });
  }
}

export { SessionManager, Session, SessionConflict };
```

### Cross-Session Synchronization

```typescript
// src/concurrency/crossSessionSync.ts

import { EventEmitter } from 'events';

interface SyncEvent {
  type: 'file_changed' | 'file_created' | 'file_deleted' | 'file_renamed';
  projectId: string;
  fileId: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  data: any;
}

interface SyncSubscription {
  projectId: string;
  sessionId: string;
  callback: (event: SyncEvent) => void;
}

class CrossSessionSync extends EventEmitter {
  private subscriptions: Map<string, SyncSubscription[]> = new Map();
  private eventBuffer: Map<string, SyncEvent[]> = new Map();
  private bufferTimeout: number = 100; // ms
  private bufferTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Subscribe to project changes
  subscribe(
    projectId: string,
    sessionId: string,
    callback: (event: SyncEvent) => void
  ): () => void {
    const subscription: SyncSubscription = {
      projectId,
      sessionId,
      callback,
    };
    
    if (!this.subscriptions.has(projectId)) {
      this.subscriptions.set(projectId, []);
    }
    
    this.subscriptions.get(projectId)!.push(subscription);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(projectId);
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }
      }
    };
  }
  
  // Broadcast file change
  broadcastChange(event: SyncEvent): void {
    // Buffer events to batch rapid changes
    const bufferKey = `${event.projectId}:${event.fileId}`;
    
    if (!this.eventBuffer.has(bufferKey)) {
      this.eventBuffer.set(bufferKey, []);
    }
    
    this.eventBuffer.get(bufferKey)!.push(event);
    
    // Reset buffer timer
    const existingTimer = this.bufferTimers.get(bufferKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    this.bufferTimers.set(bufferKey, setTimeout(() => {
      this.flushBuffer(bufferKey);
    }, this.bufferTimeout));
  }
  
  private flushBuffer(bufferKey: string): void {
    const events = this.eventBuffer.get(bufferKey);
    if (!events || events.length === 0) return;
    
    // Take the latest event (or merge if needed)
    const latestEvent = events[events.length - 1];
    
    // Notify subscribers
    const projectSubs = this.subscriptions.get(latestEvent.projectId);
    if (projectSubs) {
      projectSubs.forEach(sub => {
        // Don't notify the session that made the change
        if (sub.sessionId !== latestEvent.sessionId) {
          sub.callback(latestEvent);
        }
      });
    }
    
    // Clear buffer
    this.eventBuffer.delete(bufferKey);
    this.bufferTimers.delete(bufferKey);
  }
  
  // Force sync for a session
  async forceSyncSession(sessionId: string, projectId: string): Promise<void> {
    // Get latest state from storage
    const latestState = await this.getProjectState(projectId);
    
    // Notify session
    const subs = this.subscriptions.get(projectId);
    const sessionSub = subs?.find(s => s.sessionId === sessionId);
    
    if (sessionSub) {
      sessionSub.callback({
        type: 'file_changed',
        projectId,
        fileId: '*',
        sessionId: 'system',
        userId: 'system',
        timestamp: new Date(),
        data: { fullSync: true, state: latestState },
      });
    }
  }
  
  private async getProjectState(projectId: string): Promise<any> {
    // Fetch from storage
    return {};
  }
}

export { CrossSessionSync, SyncEvent };
```

---

## Conflict Detection

### Conflict Detector

```typescript
// src/concurrency/conflictDetector.ts

interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: 'content' | 'delete' | 'rename' | 'permission';
  details?: any;
}

interface FileState {
  id: string;
  path: string;
  content: string;
  hash: string;
  version: number;
  deleted: boolean;
}

class ConflictDetector {
  // Check for conflicts before applying an edit
  checkEditConflict(
    baseState: FileState,
    currentState: FileState,
    proposedEdit: { content: string }
  ): ConflictCheckResult {
    // File was deleted
    if (currentState.deleted) {
      return {
        hasConflict: true,
        conflictType: 'delete',
        details: {
          message: 'File was deleted by another user',
          deletedAt: currentState.version,
        },
      };
    }
    
    // Version mismatch
    if (baseState.version !== currentState.version) {
      // Check if content actually changed
      if (baseState.hash !== currentState.hash) {
        // Check if changes overlap
        const overlap = this.checkChangeOverlap(
          baseState.content,
          currentState.content,
          proposedEdit.content
        );
        
        if (overlap.hasOverlap) {
          return {
            hasConflict: true,
            conflictType: 'content',
            details: {
              message: 'Conflicting changes detected',
              baseVersion: baseState.version,
              currentVersion: currentState.version,
              overlappingLines: overlap.lines,
            },
          };
        }
      }
    }
    
    return { hasConflict: false };
  }
  
  // Check for rename conflicts
  checkRenameConflict(
    fileId: string,
    newPath: string,
    existingFiles: Map<string, FileState>
  ): ConflictCheckResult {
    // Check if target path already exists
    for (const [id, state] of existingFiles) {
      if (id !== fileId && state.path === newPath && !state.deleted) {
        return {
          hasConflict: true,
          conflictType: 'rename',
          details: {
            message: 'A file already exists at the target path',
            existingFileId: id,
            targetPath: newPath,
          },
        };
      }
    }
    
    return { hasConflict: false };
  }
  
  // Check for delete conflicts
  checkDeleteConflict(
    fileState: FileState,
    openSessions: string[]
  ): ConflictCheckResult {
    if (openSessions.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'delete',
        details: {
          message: 'File is open in other sessions',
          sessions: openSessions,
        },
      };
    }
    
    return { hasConflict: false };
  }
  
  // Check if changes overlap
  private checkChangeOverlap(
    base: string,
    current: string,
    proposed: string
  ): { hasOverlap: boolean; lines: number[] } {
    const baseLines = base.split('\n');
    const currentLines = current.split('\n');
    const proposedLines = proposed.split('\n');
    
    const currentChangedLines = new Set<number>();
    const proposedChangedLines = new Set<number>();
    
    // Find lines changed in current
    for (let i = 0; i < Math.max(baseLines.length, currentLines.length); i++) {
      if (baseLines[i] !== currentLines[i]) {
        currentChangedLines.add(i);
      }
    }
    
    // Find lines changed in proposed
    for (let i = 0; i < Math.max(baseLines.length, proposedLines.length); i++) {
      if (baseLines[i] !== proposedLines[i]) {
        proposedChangedLines.add(i);
      }
    }
    
    // Find overlapping lines
    const overlappingLines: number[] = [];
    currentChangedLines.forEach(line => {
      if (proposedChangedLines.has(line)) {
        overlappingLines.push(line);
      }
    });
    
    return {
      hasOverlap: overlappingLines.length > 0,
      lines: overlappingLines,
    };
  }
  
  // Detect semantic conflicts (e.g., function signature changes)
  detectSemanticConflicts(
    base: string,
    current: string,
    proposed: string,
    language: string
  ): ConflictCheckResult {
    // This would use language-specific parsing
    // For example, detect if both changes modify the same function
    
    // Simplified example for JavaScript/TypeScript
    if (language === 'typescript' || language === 'javascript') {
      const baseFunctions = this.extractFunctions(base);
      const currentFunctions = this.extractFunctions(current);
      const proposedFunctions = this.extractFunctions(proposed);
      
      // Check for conflicting function changes
      for (const [name, baseBody] of baseFunctions) {
        const currentBody = currentFunctions.get(name);
        const proposedBody = proposedFunctions.get(name);
        
        if (currentBody && proposedBody) {
          if (currentBody !== baseBody && proposedBody !== baseBody) {
            if (currentBody !== proposedBody) {
              return {
                hasConflict: true,
                conflictType: 'content',
                details: {
                  message: `Conflicting changes to function: ${name}`,
                  functionName: name,
                },
              };
            }
          }
        }
      }
    }
    
    return { hasConflict: false };
  }
  
  private extractFunctions(code: string): Map<string, string> {
    // Simplified function extraction
    const functions = new Map<string, string>();
    const regex = /function\s+(\w+)\s*\([^)]*\)\s*\{([^}]*)\}/g;
    
    let match;
    while ((match = regex.exec(code)) !== null) {
      functions.set(match[1], match[2]);
    }
    
    return functions;
  }
}

export { ConflictDetector, ConflictCheckResult, FileState };
```

---

## Conflict Resolution Strategies

### Resolution Strategy Manager

```typescript
// src/concurrency/resolutionStrategies.ts

interface ResolutionContext {
  base: string;
  ours: string;
  theirs: string;
  oursMetadata: {
    userId: string;
    timestamp: Date;
    sessionId: string;
  };
  theirsMetadata: {
    userId: string;
    timestamp: Date;
    sessionId: string;
  };
}

interface ResolutionResult {
  resolved: string;
  strategy: string;
  autoResolved: boolean;
  manualInterventionRequired: boolean;
  conflictMarkers?: Array<{
    startLine: number;
    endLine: number;
    type: 'ours' | 'theirs' | 'both';
  }>;
}

type ResolutionStrategy = (context: ResolutionContext) => ResolutionResult;

class ResolutionStrategyManager {
  private strategies: Map<string, ResolutionStrategy> = new Map();
  
  constructor() {
    this.registerDefaultStrategies();
  }
  
  private registerDefaultStrategies(): void {
    // Last write wins
    this.strategies.set('last-write-wins', (ctx) => ({
      resolved: ctx.theirs,
      strategy: 'last-write-wins',
      autoResolved: true,
      manualInterventionRequired: false,
    }));
    
    // First write wins
    this.strategies.set('first-write-wins', (ctx) => ({
      resolved: ctx.ours,
      strategy: 'first-write-wins',
      autoResolved: true,
      manualInterventionRequired: false,
    }));
    
    // Merge with conflict markers
    this.strategies.set('merge-with-markers', (ctx) => {
      const result = this.mergeWithMarkers(ctx);
      return {
        resolved: result.content,
        strategy: 'merge-with-markers',
        autoResolved: false,
        manualInterventionRequired: true,
        conflictMarkers: result.markers,
      };
    });
    
    // Smart merge (attempt auto-merge, fallback to markers)
    this.strategies.set('smart-merge', (ctx) => {
      const autoMerge = this.attemptAutoMerge(ctx);
      if (autoMerge.success) {
        return {
          resolved: autoMerge.content!,
          strategy: 'smart-merge-auto',
          autoResolved: true,
          manualInterventionRequired: false,
        };
      }
      
      // Fallback to markers
      const result = this.mergeWithMarkers(ctx);
      return {
        resolved: result.content,
        strategy: 'smart-merge-manual',
        autoResolved: false,
        manualInterventionRequired: true,
        conflictMarkers: result.markers,
      };
    });
    
    // Keep both (for additive changes)
    this.strategies.set('keep-both', (ctx) => {
      const result = this.keepBoth(ctx);
      return {
        resolved: result,
        strategy: 'keep-both',
        autoResolved: true,
        manualInterventionRequired: false,
      };
    });
    
    // Timestamp-based (most recent wins)
    this.strategies.set('timestamp', (ctx) => {
      const winner = ctx.oursMetadata.timestamp > ctx.theirsMetadata.timestamp
        ? ctx.ours
        : ctx.theirs;
      return {
        resolved: winner,
        strategy: 'timestamp',
        autoResolved: true,
        manualInterventionRequired: false,
      };
    });
  }
  
  // Register custom strategy
  registerStrategy(name: string, strategy: ResolutionStrategy): void {
    this.strategies.set(name, strategy);
  }
  
  // Resolve conflict using specified strategy
  resolve(strategyName: string, context: ResolutionContext): ResolutionResult {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown resolution strategy: ${strategyName}`);
    }
    
    return strategy(context);
  }
  
  // Attempt automatic merge
  private attemptAutoMerge(ctx: ResolutionContext): { success: boolean; content?: string } {
    const baseLines = ctx.base.split('\n');
    const oursLines = ctx.ours.split('\n');
    const theirsLines = ctx.theirs.split('\n');
    
    const result: string[] = [];
    let hasConflict = false;
    
    const maxLines = Math.max(baseLines.length, oursLines.length, theirsLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i] ?? '';
      const oursLine = oursLines[i] ?? '';
      const theirsLine = theirsLines[i] ?? '';
      
      const oursChanged = oursLine !== baseLine;
      const theirsChanged = theirsLine !== baseLine;
      
      if (!oursChanged && !theirsChanged) {
        // No change
        result.push(baseLine);
      } else if (oursChanged && !theirsChanged) {
        // Only ours changed
        result.push(oursLine);
      } else if (!oursChanged && theirsChanged) {
        // Only theirs changed
        result.push(theirsLine);
      } else if (oursLine === theirsLine) {
        // Both changed to same value
        result.push(oursLine);
      } else {
        // Conflict!
        hasConflict = true;
        break;
      }
    }
    
    return {
      success: !hasConflict,
      content: hasConflict ? undefined : result.join('\n'),
    };
  }
  
  // Merge with Git-style conflict markers
  private mergeWithMarkers(ctx: ResolutionContext): {
    content: string;
    markers: Array<{ startLine: number; endLine: number; type: 'ours' | 'theirs' | 'both' }>;
  } {
    const baseLines = ctx.base.split('\n');
    const oursLines = ctx.ours.split('\n');
    const theirsLines = ctx.theirs.split('\n');
    
    const result: string[] = [];
    const markers: Array<{ startLine: number; endLine: number; type: 'ours' | 'theirs' | 'both' }> = [];
    
    const maxLines = Math.max(baseLines.length, oursLines.length, theirsLines.length);
    let currentLine = 0;
    
    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i] ?? '';
      const oursLine = oursLines[i] ?? '';
      const theirsLine = theirsLines[i] ?? '';
      
      const oursChanged = oursLine !== baseLine;
      const theirsChanged = theirsLine !== baseLine;
      
      if (!oursChanged && !theirsChanged) {
        result.push(baseLine);
        currentLine++;
      } else if (oursChanged && !theirsChanged) {
        result.push(oursLine);
        currentLine++;
      } else if (!oursChanged && theirsChanged) {
        result.push(theirsLine);
        currentLine++;
      } else if (oursLine === theirsLine) {
        result.push(oursLine);
        currentLine++;
      } else {
        // Add conflict markers
        const markerStart = currentLine;
        
        result.push(`<<<<<<< OURS (${ctx.oursMetadata.userId})`);
        currentLine++;
        result.push(oursLine);
        currentLine++;
        result.push('=======');
        currentLine++;
        result.push(theirsLine);
        currentLine++;
        result.push(`>>>>>>> THEIRS (${ctx.theirsMetadata.userId})`);
        currentLine++;
        
        markers.push({
          startLine: markerStart,
          endLine: currentLine - 1,
          type: 'both',
        });
      }
    }
    
    return {
      content: result.join('\n'),
      markers,
    };
  }
  
  // Keep both changes (for additive content)
  private keepBoth(ctx: ResolutionContext): string {
    // Find additions in ours
    const oursAdditions = this.findAdditions(ctx.base, ctx.ours);
    
    // Find additions in theirs
    const theirsAdditions = this.findAdditions(ctx.base, ctx.theirs);
    
    // Combine: base + ours additions + theirs additions
    let result = ctx.base;
    
    // Apply ours additions
    for (const addition of oursAdditions) {
      result = this.insertAt(result, addition.position, addition.content);
    }
    
    // Apply theirs additions (adjust positions)
    let offset = 0;
    for (const addition of theirsAdditions) {
      result = this.insertAt(result, addition.position + offset, addition.content);
      offset += addition.content.length;
    }
    
    return result;
  }
  
  private findAdditions(base: string, modified: string): Array<{ position: number; content: string }> {
    // Simplified - would use proper diff algorithm
    const additions: Array<{ position: number; content: string }> = [];
    
    if (modified.length > base.length) {
      // Find where content was added
      let i = 0;
      while (i < base.length && base[i] === modified[i]) {
        i++;
      }
      
      const addedContent = modified.slice(i, modified.length - (base.length - i));
      if (addedContent) {
        additions.push({ position: i, content: addedContent });
      }
    }
    
    return additions;
  }
  
  private insertAt(str: string, position: number, content: string): string {
    return str.slice(0, position) + content + str.slice(position);
  }
  
  // Get available strategies
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

export { ResolutionStrategyManager, ResolutionContext, ResolutionResult };
```

---

## Lock-Based Concurrency

### Distributed Lock Manager

```typescript
// src/concurrency/lockManager.ts

import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';

interface Lock {
  id: string;
  resourceId: string;
  ownerId: string;
  ownerType: 'user' | 'session' | 'system';
  acquiredAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

interface LockOptions {
  ttlMs?: number;
  waitTimeoutMs?: number;
  retryIntervalMs?: number;
}

class DistributedLockManager {
  private redis: RedisClientType;
  private locks: Map<string, Lock> = new Map();
  private lockPrefix: string = 'lock:';
  private defaultTtlMs: number = 30000; // 30 seconds
  
  constructor(redisUrl: string) {
    this.redis = createClient({ url: redisUrl });
  }
  
  async connect(): Promise<void> {
    await this.redis.connect();
  }
  
  // Acquire lock
  async acquireLock(
    resourceId: string,
    ownerId: string,
    ownerType: 'user' | 'session' | 'system',
    options: LockOptions = {}
  ): Promise<Lock | null> {
    const {
      ttlMs = this.defaultTtlMs,
      waitTimeoutMs = 0,
      retryIntervalMs = 100,
    } = options;
    
    const lockId = uuidv4();
    const lockKey = `${this.lockPrefix}${resourceId}`;
    const startTime = Date.now();
    
    while (true) {
      // Try to acquire lock using SET NX EX
      const acquired = await this.redis.set(
        lockKey,
        JSON.stringify({ lockId, ownerId, ownerType }),
        {
          NX: true,
          PX: ttlMs,
        }
      );
      
      if (acquired) {
        const lock: Lock = {
          id: lockId,
          resourceId,
          ownerId,
          ownerType,
          acquiredAt: new Date(),
          expiresAt: new Date(Date.now() + ttlMs),
        };
        
        this.locks.set(lockId, lock);
        return lock;
      }
      
      // Check if we should wait
      if (waitTimeoutMs === 0) {
        return null;
      }
      
      // Check timeout
      if (Date.now() - startTime >= waitTimeoutMs) {
        return null;
      }
      
      // Wait and retry
      await this.sleep(retryIntervalMs);
    }
  }
  
  // Release lock
  async releaseLock(lockId: string): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return false;
    }
    
    const lockKey = `${this.lockPrefix}${lock.resourceId}`;
    
    // Use Lua script for atomic check-and-delete
    const script = `
      local current = redis.call('GET', KEYS[1])
      if current then
        local data = cjson.decode(current)
        if data.lockId == ARGV[1] then
          redis.call('DEL', KEYS[1])
          return 1
        end
      end
      return 0
    `;
    
    const result = await this.redis.eval(script, {
      keys: [lockKey],
      arguments: [lockId],
    });
    
    if (result === 1) {
      this.locks.delete(lockId);
      return true;
    }
    
    return false;
  }
  
  // Extend lock TTL
  async extendLock(lockId: string, additionalTtlMs: number): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return false;
    }
    
    const lockKey = `${this.lockPrefix}${lock.resourceId}`;
    
    // Use Lua script for atomic check-and-extend
    const script = `
      local current = redis.call('GET', KEYS[1])
      if current then
        local data = cjson.decode(current)
        if data.lockId == ARGV[1] then
          redis.call('PEXPIRE', KEYS[1], ARGV[2])
          return 1
        end
      end
      return 0
    `;
    
    const result = await this.redis.eval(script, {
      keys: [lockKey],
      arguments: [lockId, additionalTtlMs.toString()],
    });
    
    if (result === 1) {
      lock.expiresAt = new Date(Date.now() + additionalTtlMs);
      return true;
    }
    
    return false;
  }
  
  // Check if resource is locked
  async isLocked(resourceId: string): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${resourceId}`;
    const exists = await this.redis.exists(lockKey);
    return exists === 1;
  }
  
  // Get lock info
  async getLockInfo(resourceId: string): Promise<Lock | null> {
    const lockKey = `${this.lockPrefix}${resourceId}`;
    const data = await this.redis.get(lockKey);
    
    if (!data) {
      return null;
    }
    
    const parsed = JSON.parse(data);
    const ttl = await this.redis.pTTL(lockKey);
    
    return {
      id: parsed.lockId,
      resourceId,
      ownerId: parsed.ownerId,
      ownerType: parsed.ownerType,
      acquiredAt: new Date(), // Approximate
      expiresAt: new Date(Date.now() + ttl),
    };
  }
  
  // Force release (admin only)
  async forceRelease(resourceId: string): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${resourceId}`;
    const result = await this.redis.del(lockKey);
    return result === 1;
  }
  
  // Execute with lock
  async withLock<T>(
    resourceId: string,
    ownerId: string,
    ownerType: 'user' | 'session' | 'system',
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const lock = await this.acquireLock(resourceId, ownerId, ownerType, options);
    
    if (!lock) {
      throw new Error(`Failed to acquire lock for resource: ${resourceId}`);
    }
    
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock.id);
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export { DistributedLockManager, Lock, LockOptions };
```

### File-Level Locking

```typescript
// src/concurrency/fileLocking.ts

interface FileLock {
  fileId: string;
  filePath: string;
  lockType: 'exclusive' | 'shared';
  holders: Array<{
    userId: string;
    sessionId: string;
    acquiredAt: Date;
  }>;
}

class FileLockManager {
  private locks: Map<string, FileLock> = new Map();
  private lockManager: DistributedLockManager;
  
  constructor(lockManager: DistributedLockManager) {
    this.lockManager = lockManager;
  }
  
  // Acquire exclusive lock (for editing)
  async acquireExclusiveLock(
    fileId: string,
    filePath: string,
    userId: string,
    sessionId: string
  ): Promise<boolean> {
    const existingLock = this.locks.get(fileId);
    
    if (existingLock) {
      // Check if same user/session already has lock
      const hasLock = existingLock.holders.some(
        h => h.userId === userId && h.sessionId === sessionId
      );
      
      if (hasLock) {
        return true; // Already have lock
      }
      
      return false; // Someone else has lock
    }
    
    // Acquire distributed lock
    const lock = await this.lockManager.acquireLock(
      `file:${fileId}`,
      sessionId,
      'session',
      { ttlMs: 60000 }
    );
    
    if (!lock) {
      return false;
    }
    
    this.locks.set(fileId, {
      fileId,
      filePath,
      lockType: 'exclusive',
      holders: [{
        userId,
        sessionId,
        acquiredAt: new Date(),
      }],
    });
    
    return true;
  }
  
  // Acquire shared lock (for reading)
  async acquireSharedLock(
    fileId: string,
    filePath: string,
    userId: string,
    sessionId: string
  ): Promise<boolean> {
    const existingLock = this.locks.get(fileId);
    
    if (existingLock) {
      if (existingLock.lockType === 'exclusive') {
        // Can't acquire shared lock when exclusive lock exists
        return false;
      }
      
      // Add to shared holders
      existingLock.holders.push({
        userId,
        sessionId,
        acquiredAt: new Date(),
      });
      
      return true;
    }
    
    this.locks.set(fileId, {
      fileId,
      filePath,
      lockType: 'shared',
      holders: [{
        userId,
        sessionId,
        acquiredAt: new Date(),
      }],
    });
    
    return true;
  }
  
  // Release lock
  async releaseLock(fileId: string, sessionId: string): Promise<void> {
    const lock = this.locks.get(fileId);
    if (!lock) return;
    
    // Remove holder
    lock.holders = lock.holders.filter(h => h.sessionId !== sessionId);
    
    if (lock.holders.length === 0) {
      this.locks.delete(fileId);
      await this.lockManager.forceRelease(`file:${fileId}`);
    }
  }
  
  // Check lock status
  getLockStatus(fileId: string): FileLock | null {
    return this.locks.get(fileId) || null;
  }
  
  // Get all locks for a session
  getSessionLocks(sessionId: string): FileLock[] {
    return Array.from(this.locks.values())
      .filter(lock => lock.holders.some(h => h.sessionId === sessionId));
  }
  
  // Release all locks for a session
  async releaseSessionLocks(sessionId: string): Promise<void> {
    const sessionLocks = this.getSessionLocks(sessionId);
    
    for (const lock of sessionLocks) {
      await this.releaseLock(lock.fileId, sessionId);
    }
  }
}

export { FileLockManager, FileLock };
```

---

## Optimistic Concurrency Control

### Version-Based OCC

```typescript
// src/concurrency/optimisticControl.ts

interface VersionedDocument {
  id: string;
  content: string;
  version: number;
  etag: string;
  lastModified: Date;
  lastModifiedBy: string;
}

interface UpdateRequest {
  documentId: string;
  content: string;
  baseVersion: number;
  baseEtag: string;
  userId: string;
}

interface UpdateResult {
  success: boolean;
  document?: VersionedDocument;
  error?: {
    code: 'VERSION_CONFLICT' | 'ETAG_MISMATCH' | 'NOT_FOUND';
    message: string;
    currentVersion?: number;
    currentEtag?: string;
  };
}

class OptimisticConcurrencyController {
  private documents: Map<string, VersionedDocument> = new Map();
  
  // Get document with version info
  async getDocument(documentId: string): Promise<VersionedDocument | null> {
    return this.documents.get(documentId) || null;
  }
  
  // Update with optimistic concurrency check
  async updateDocument(request: UpdateRequest): Promise<UpdateResult> {
    const current = this.documents.get(request.documentId);
    
    if (!current) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      };
    }
    
    // Check version
    if (current.version !== request.baseVersion) {
      return {
        success: false,
        error: {
          code: 'VERSION_CONFLICT',
          message: `Version conflict: expected ${request.baseVersion}, found ${current.version}`,
          currentVersion: current.version,
          currentEtag: current.etag,
        },
      };
    }
    
    // Check ETag
    if (current.etag !== request.baseEtag) {
      return {
        success: false,
        error: {
          code: 'ETAG_MISMATCH',
          message: 'ETag mismatch - document was modified',
          currentVersion: current.version,
          currentEtag: current.etag,
        },
      };
    }
    
    // Update document
    const updated: VersionedDocument = {
      id: request.documentId,
      content: request.content,
      version: current.version + 1,
      etag: this.generateEtag(request.content),
      lastModified: new Date(),
      lastModifiedBy: request.userId,
    };
    
    this.documents.set(request.documentId, updated);
    
    return {
      success: true,
      document: updated,
    };
  }
  
  // Create new document
  async createDocument(
    documentId: string,
    content: string,
    userId: string
  ): Promise<VersionedDocument> {
    const document: VersionedDocument = {
      id: documentId,
      content,
      version: 1,
      etag: this.generateEtag(content),
      lastModified: new Date(),
      lastModifiedBy: userId,
    };
    
    this.documents.set(documentId, document);
    return document;
  }
  
  // Generate ETag from content
  private generateEtag(content: string): string {
    // Use hash of content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(16)}"`;
  }
}

export { OptimisticConcurrencyController, VersionedDocument, UpdateRequest, UpdateResult };
```

---

## Version Vectors

### Vector Clock Implementation

```typescript
// src/concurrency/versionVector.ts

type VectorClock = Map<string, number>;

interface VectorClockComparison {
  relation: 'before' | 'after' | 'concurrent' | 'equal';
  divergentNodes: string[];
}

class VectorClockManager {
  // Create new vector clock
  create(nodeId: string): VectorClock {
    const clock = new Map<string, number>();
    clock.set(nodeId, 0);
    return clock;
  }
  
  // Increment clock for a node
  increment(clock: VectorClock, nodeId: string): VectorClock {
    const newClock = new Map(clock);
    const current = newClock.get(nodeId) || 0;
    newClock.set(nodeId, current + 1);
    return newClock;
  }
  
  // Merge two clocks (take max of each component)
  merge(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const merged = new Map<string, number>();
    
    // Get all node IDs
    const allNodes = new Set([...clock1.keys(), ...clock2.keys()]);
    
    allNodes.forEach(nodeId => {
      const v1 = clock1.get(nodeId) || 0;
      const v2 = clock2.get(nodeId) || 0;
      merged.set(nodeId, Math.max(v1, v2));
    });
    
    return merged;
  }
  
  // Compare two clocks
  compare(clock1: VectorClock, clock2: VectorClock): VectorClockComparison {
    let clock1Greater = false;
    let clock2Greater = false;
    const divergentNodes: string[] = [];
    
    const allNodes = new Set([...clock1.keys(), ...clock2.keys()]);
    
    allNodes.forEach(nodeId => {
      const v1 = clock1.get(nodeId) || 0;
      const v2 = clock2.get(nodeId) || 0;
      
      if (v1 > v2) {
        clock1Greater = true;
        divergentNodes.push(nodeId);
      } else if (v2 > v1) {
        clock2Greater = true;
        divergentNodes.push(nodeId);
      }
    });
    
    if (clock1Greater && clock2Greater) {
      return { relation: 'concurrent', divergentNodes };
    } else if (clock1Greater) {
      return { relation: 'after', divergentNodes };
    } else if (clock2Greater) {
      return { relation: 'before', divergentNodes };
    } else {
      return { relation: 'equal', divergentNodes: [] };
    }
  }
  
  // Check if clock1 happened before clock2
  happenedBefore(clock1: VectorClock, clock2: VectorClock): boolean {
    return this.compare(clock1, clock2).relation === 'before';
  }
  
  // Check if clocks are concurrent (neither happened before the other)
  areConcurrent(clock1: VectorClock, clock2: VectorClock): boolean {
    return this.compare(clock1, clock2).relation === 'concurrent';
  }
  
  // Serialize clock to string
  serialize(clock: VectorClock): string {
    const entries = Array.from(clock.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));
    return JSON.stringify(entries);
  }
  
  // Deserialize clock from string
  deserialize(serialized: string): VectorClock {
    const entries: [string, number][] = JSON.parse(serialized);
    return new Map(entries);
  }
}

export { VectorClockManager, VectorClock, VectorClockComparison };
```

---

## Database Schema

### PostgreSQL Schema

```sql
-- migrations/001_concurrent_edit_tables.sql

-- File versions table
CREATE TABLE file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_clock JSONB,
    
    UNIQUE(file_id, version)
);

CREATE INDEX idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX idx_file_versions_created_at ON file_versions(created_at);

-- Active locks table
CREATE TABLE file_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL UNIQUE,
    lock_type VARCHAR(20) NOT NULL CHECK (lock_type IN ('exclusive', 'shared')),
    acquired_by UUID NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT valid_expiry CHECK (expires_at > acquired_at)
);

CREATE INDEX idx_file_locks_expires_at ON file_locks(expires_at);

-- Edit sessions table
CREATE TABLE edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_id UUID NOT NULL,
    sandbox_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'idle', 'closed')),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_edit_sessions_user_id ON edit_sessions(user_id);
CREATE INDEX idx_edit_sessions_project_id ON edit_sessions(project_id);
CREATE INDEX idx_edit_sessions_status ON edit_sessions(status);

-- Pending changes (unsaved edits)
CREATE TABLE pending_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES edit_sessions(id) ON DELETE CASCADE,
    file_id UUID NOT NULL,
    base_version INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, file_id)
);

CREATE INDEX idx_pending_changes_file_id ON pending_changes(file_id);

-- Conflict history
CREATE TABLE conflict_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL,
    base_version INTEGER NOT NULL,
    ours_version INTEGER NOT NULL,
    theirs_version INTEGER NOT NULL,
    resolution_strategy VARCHAR(50),
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    conflict_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conflict_history_file_id ON conflict_history(file_id);
CREATE INDEX idx_conflict_history_created_at ON conflict_history(created_at);

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM file_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_active_at
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE edit_sessions 
    SET last_active_at = NOW() 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
AFTER INSERT OR UPDATE ON pending_changes
FOR EACH ROW EXECUTE FUNCTION update_session_activity();
```

### Drizzle Schema

```typescript
// drizzle/schema/concurrency.ts

import { pgTable, uuid, integer, text, varchar, timestamp, jsonb, uniqueIndex, index, check } from 'drizzle-orm/pg-core';

export const fileVersions = pgTable('file_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').notNull(),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  vectorClock: jsonb('vector_clock'),
}, (table) => ({
  fileVersionUnique: uniqueIndex('file_version_unique').on(table.fileId, table.version),
  fileIdIdx: index('idx_file_versions_file_id').on(table.fileId),
}));

export const fileLocks = pgTable('file_locks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').notNull().unique(),
  lockType: varchar('lock_type', { length: 20 }).notNull(),
  acquiredBy: uuid('acquired_by').notNull(),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const editSessions = pgTable('edit_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  projectId: uuid('project_id').notNull(),
  sandboxId: varchar('sandbox_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow(),
  status: varchar('status', { length: 20 }).default('active'),
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  userIdIdx: index('idx_edit_sessions_user_id').on(table.userId),
  projectIdIdx: index('idx_edit_sessions_project_id').on(table.projectId),
}));

export const pendingChanges = pgTable('pending_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => editSessions.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').notNull(),
  baseVersion: integer('base_version').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sessionFileUnique: uniqueIndex('pending_changes_session_file').on(table.sessionId, table.fileId),
}));

export const conflictHistory = pgTable('conflict_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').notNull(),
  baseVersion: integer('base_version').notNull(),
  oursVersion: integer('ours_version').notNull(),
  theirsVersion: integer('theirs_version').notNull(),
  resolutionStrategy: varchar('resolution_strategy', { length: 50 }),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  conflictDetails: jsonb('conflict_details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

---

## Implementation

### Complete Concurrent Edit Service

```typescript
// src/services/concurrentEditService.ts

import { SameFileEditHandler } from '../concurrency/sameFileHandler';
import { SessionManager } from '../concurrency/sessionManager';
import { CrossSessionSync } from '../concurrency/crossSessionSync';
import { ConflictDetector } from '../concurrency/conflictDetector';
import { ResolutionStrategyManager } from '../concurrency/resolutionStrategies';
import { DistributedLockManager } from '../concurrency/lockManager';
import { FileLockManager } from '../concurrency/fileLocking';
import { OptimisticConcurrencyController } from '../concurrency/optimisticControl';

interface EditRequest {
  sessionId: string;
  fileId: string;
  content: string;
  baseVersion: number;
}

interface EditResponse {
  success: boolean;
  newVersion?: number;
  conflict?: {
    type: string;
    details: any;
    resolutionOptions: string[];
  };
}

class ConcurrentEditService {
  private fileHandler: SameFileEditHandler;
  private sessionManager: SessionManager;
  private syncManager: CrossSessionSync;
  private conflictDetector: ConflictDetector;
  private resolutionManager: ResolutionStrategyManager;
  private lockManager: FileLockManager;
  private occController: OptimisticConcurrencyController;
  
  constructor(redisUrl: string) {
    this.fileHandler = new SameFileEditHandler();
    this.sessionManager = new SessionManager();
    this.syncManager = new CrossSessionSync();
    this.conflictDetector = new ConflictDetector();
    this.resolutionManager = new ResolutionStrategyManager();
    
    const distributedLockManager = new DistributedLockManager(redisUrl);
    this.lockManager = new FileLockManager(distributedLockManager);
    this.occController = new OptimisticConcurrencyController();
  }
  
  // Handle edit request
  async handleEdit(request: EditRequest): Promise<EditResponse> {
    const session = this.sessionManager.getSession(request.sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }
    
    // Get current file state
    const currentDoc = await this.occController.getDocument(request.fileId);
    if (!currentDoc) {
      throw new Error('File not found');
    }
    
    // Check for conflicts
    const conflictCheck = this.conflictDetector.checkEditConflict(
      { 
        id: request.fileId, 
        path: '', 
        content: '', // Would fetch base content
        hash: '',
        version: request.baseVersion,
        deleted: false,
      },
      {
        id: request.fileId,
        path: '',
        content: currentDoc.content,
        hash: currentDoc.etag,
        version: currentDoc.version,
        deleted: false,
      },
      { content: request.content }
    );
    
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        conflict: {
          type: conflictCheck.conflictType!,
          details: conflictCheck.details,
          resolutionOptions: this.resolutionManager.getAvailableStrategies(),
        },
      };
    }
    
    // Attempt optimistic update
    const updateResult = await this.occController.updateDocument({
      documentId: request.fileId,
      content: request.content,
      baseVersion: request.baseVersion,
      baseEtag: currentDoc.etag,
      userId: session.userId,
    });
    
    if (!updateResult.success) {
      return {
        success: false,
        conflict: {
          type: updateResult.error!.code,
          details: updateResult.error,
          resolutionOptions: this.resolutionManager.getAvailableStrategies(),
        },
      };
    }
    
    // Broadcast change to other sessions
    this.syncManager.broadcastChange({
      type: 'file_changed',
      projectId: session.projectId,
      fileId: request.fileId,
      sessionId: request.sessionId,
      userId: session.userId,
      timestamp: new Date(),
      data: {
        version: updateResult.document!.version,
        content: updateResult.document!.content,
      },
    });
    
    return {
      success: true,
      newVersion: updateResult.document!.version,
    };
  }
  
  // Resolve conflict with specified strategy
  async resolveConflict(
    fileId: string,
    sessionId: string,
    strategyName: string,
    base: string,
    ours: string,
    theirs: string
  ): Promise<EditResponse> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }
    
    const result = this.resolutionManager.resolve(strategyName, {
      base,
      ours,
      theirs,
      oursMetadata: {
        userId: session.userId,
        timestamp: new Date(),
        sessionId,
      },
      theirsMetadata: {
        userId: 'other',
        timestamp: new Date(),
        sessionId: 'other',
      },
    });
    
    if (result.manualInterventionRequired) {
      return {
        success: false,
        conflict: {
          type: 'MANUAL_RESOLUTION_REQUIRED',
          details: {
            content: result.resolved,
            markers: result.conflictMarkers,
          },
          resolutionOptions: [],
        },
      };
    }
    
    // Save resolved content
    const currentDoc = await this.occController.getDocument(fileId);
    
    const updateResult = await this.occController.updateDocument({
      documentId: fileId,
      content: result.resolved,
      baseVersion: currentDoc!.version,
      baseEtag: currentDoc!.etag,
      userId: session.userId,
    });
    
    return {
      success: updateResult.success,
      newVersion: updateResult.document?.version,
    };
  }
}

export { ConcurrentEditService, EditRequest, EditResponse };
```

---

## API Reference

### REST Endpoints

```yaml
# openapi.yaml (partial)
paths:
  /api/v1/files/{fileId}/edit:
    post:
      summary: Submit file edit
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                content:
                  type: string
                baseVersion:
                  type: integer
                sessionId:
                  type: string
      responses:
        '200':
          description: Edit successful
        '409':
          description: Conflict detected
          
  /api/v1/files/{fileId}/lock:
    post:
      summary: Acquire file lock
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                lockType:
                  type: string
                  enum: [exclusive, shared]
                sessionId:
                  type: string
      responses:
        '200':
          description: Lock acquired
        '423':
          description: File already locked
          
    delete:
      summary: Release file lock
      
  /api/v1/files/{fileId}/conflicts/resolve:
    post:
      summary: Resolve conflict
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                strategy:
                  type: string
                base:
                  type: string
                ours:
                  type: string
                theirs:
                  type: string
```

---

## Testing Concurrent Edits

### Test Suite

```typescript
// tests/concurrency.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ConcurrentEditService } from '../src/services/concurrentEditService';

describe('Concurrent Edit Handling', () => {
  let service: ConcurrentEditService;
  
  beforeEach(() => {
    service = new ConcurrentEditService('redis://localhost:6379');
  });
  
  describe('Same File Edits', () => {
    it('should handle non-conflicting edits', async () => {
      // User A edits line 1
      const resultA = await service.handleEdit({
        sessionId: 'session-a',
        fileId: 'file-1',
        content: 'Line 1 modified\nLine 2\nLine 3',
        baseVersion: 1,
      });
      
      expect(resultA.success).toBe(true);
      expect(resultA.newVersion).toBe(2);
    });
    
    it('should detect conflicting edits on same line', async () => {
      // User A and B both edit line 2 based on version 1
      const resultA = await service.handleEdit({
        sessionId: 'session-a',
        fileId: 'file-1',
        content: 'Line 1\nLine 2 by A\nLine 3',
        baseVersion: 1,
      });
      
      expect(resultA.success).toBe(true);
      
      // User B's edit should conflict
      const resultB = await service.handleEdit({
        sessionId: 'session-b',
        fileId: 'file-1',
        content: 'Line 1\nLine 2 by B\nLine 3',
        baseVersion: 1, // Same base version
      });
      
      expect(resultB.success).toBe(false);
      expect(resultB.conflict).toBeDefined();
      expect(resultB.conflict?.type).toBe('VERSION_CONFLICT');
    });
    
    it('should auto-merge non-overlapping changes', async () => {
      // Setup: create file with 3 lines
      // User A edits line 1, User B edits line 3
      // Should auto-merge
    });
  });
  
  describe('Conflict Resolution', () => {
    it('should resolve with last-write-wins strategy', async () => {
      const result = await service.resolveConflict(
        'file-1',
        'session-a',
        'last-write-wins',
        'original content',
        'content by A',
        'content by B'
      );
      
      expect(result.success).toBe(true);
    });
    
    it('should resolve with smart-merge strategy', async () => {
      const result = await service.resolveConflict(
        'file-1',
        'session-a',
        'smart-merge',
        'Line 1\nLine 2\nLine 3',
        'Line 1 A\nLine 2\nLine 3',
        'Line 1\nLine 2\nLine 3 B'
      );
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('Session Management', () => {
    it('should track multiple sessions per project', () => {
      // Test session tracking
    });
    
    it('should detect unsaved changes in other sessions', () => {
      // Test unsaved change detection
    });
  });
  
  describe('Locking', () => {
    it('should prevent edits when file is locked', async () => {
      // Test exclusive lock
    });
    
    it('should allow multiple shared locks', async () => {
      // Test shared locks
    });
  });
});
```

---

## Best Practices

### 1. Choose the Right Concurrency Model

| Scenario | Recommended Approach |
|----------|---------------------|
| Short edits, critical data | Pessimistic locking |
| Long editing sessions | Optimistic concurrency |
| Real-time collaboration | CRDT/OT |
| Mixed usage | Hybrid approach |

### 2. Conflict Prevention

```typescript
// Prevent conflicts by:
// 1. Frequent auto-saves
// 2. Real-time presence indicators
// 3. Warning before editing locked files
// 4. Automatic refresh of stale content
```

### 3. User Experience

- Show who else is editing
- Warn before potential conflicts
- Provide clear conflict resolution UI
- Auto-save frequently
- Show version history

### 4. Performance

- Batch small changes
- Debounce sync operations
- Use efficient diff algorithms
- Cache version history

---

## Summary

### Concurrency Control Methods

| Method | Pros | Cons | Use Case |
|--------|------|------|----------|
| **Locking** | Simple, prevents conflicts | Blocks users | Short edits |
| **OCC** | Non-blocking | Conflicts on save | Long edits |
| **CRDT** | Real-time, no conflicts | Complex | Collaboration |
| **Version Vectors** | Distributed | Memory overhead | P2P systems |

### Key Components

| Component | Purpose |
|-----------|---------|
| Session Manager | Track active editing sessions |
| Lock Manager | Distributed file locking |
| Conflict Detector | Identify conflicting changes |
| Resolution Manager | Apply resolution strategies |
| Sync Manager | Cross-session synchronization |
| OCC Controller | Version-based concurrency |

### Conflict Resolution Strategies

| Strategy | Description | Auto-Resolve |
|----------|-------------|--------------|
| Last Write Wins | Most recent change wins | ✅ |
| First Write Wins | First change wins | ✅ |
| Smart Merge | Attempt auto-merge | Sometimes |
| Keep Both | Preserve all changes | ✅ |
| Manual | User resolves | ❌ |
