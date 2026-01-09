# Terminal Persistence and Session Management

This guide provides comprehensive coverage of terminal session persistence, reconnection handling, history preservation, and multi-session management in cloud development environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Session Architecture](#session-architecture)
3. [Session Persistence](#session-persistence)
4. [Reconnection Handling](#reconnection-handling)
5. [History Preservation](#history-preservation)
6. [Multiple Terminal Sessions](#multiple-terminal-sessions)
7. [State Synchronization](#state-synchronization)
8. [Database Schema](#database-schema)
9. [Kubernetes Integration](#kubernetes-integration)
10. [Best Practices](#best-practices)

---

## Overview

Terminal persistence ensures that users don't lose their work when network connections drop, browsers refresh, or sessions timeout. This involves preserving terminal output, command history, and session state across reconnections.

### Persistence Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         TERMINAL PERSISTENCE ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SESSION MANAGER                                     │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │   Session    │  │   Output     │  │   History    │  │   State      │        │   │
│  │  │   Registry   │  │   Buffer     │  │   Store      │  │   Snapshot   │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │         │                 │                 │                 │                 │   │
│  │         └─────────────────┴─────────────────┴─────────────────┘                 │   │
│  │                                    │                                            │   │
│  └────────────────────────────────────┼────────────────────────────────────────────┘   │
│                                       │                                                 │
│                          ┌────────────┴────────────┐                                   │
│                          │                         │                                   │
│                          ▼                         ▼                                   │
│                   ┌─────────────┐           ┌─────────────┐                           │
│                   │    Redis    │           │  PostgreSQL │                           │
│                   │  (Hot Data) │           │ (Cold Data) │                           │
│                   └─────────────┘           └─────────────┘                           │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              PTY PROCESSES                                       │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │   Session 1  │  │   Session 2  │  │   Session 3  │  │   Session N  │        │   │
│  │  │   (bash)     │  │   (zsh)      │  │   (node)     │  │   (python)   │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Persistence Features

| Feature | Description | Storage |
|---------|-------------|---------|
| **Output Buffer** | Last N bytes of terminal output | Redis |
| **Command History** | Shell command history | File + DB |
| **Session State** | Cursor position, scroll, attributes | Redis |
| **Environment** | Environment variables, cwd | Redis |
| **Process State** | Running processes, exit codes | Memory |

---

## Session Architecture

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SESSION LIFECYCLE                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CREATE              ACTIVE              DISCONNECTED         RECONNECT                 │
│    │                   │                      │                   │                     │
│    ▼                   ▼                      ▼                   ▼                     │
│  ┌────┐             ┌────┐               ┌────┐              ┌────┐                    │
│  │New │────────────►│Live│──────────────►│Idle│─────────────►│Live│                    │
│  │PTY │             │PTY │  WS Closed    │PTY │  WS Opened   │PTY │                    │
│  └────┘             └────┘               └────┘              └────┘                    │
│    │                   │                      │                   │                     │
│    │                   │                      │                   │                     │
│    │                   ▼                      ▼                   │                     │
│    │              ┌────────┐            ┌────────┐                │                     │
│    │              │Buffer  │            │Buffer  │                │                     │
│    │              │Output  │            │Persist │                │                     │
│    │              └────────┘            └────────┘                │                     │
│    │                                         │                    │                     │
│    │                                         │  Timeout           │                     │
│    │                                         ▼                    │                     │
│    │                                    ┌────────┐                │                     │
│    │                                    │Cleanup │                │                     │
│    │                                    │Session │                │                     │
│    │                                    └────────┘                │                     │
│    │                                         │                    │                     │
│    ▼                                         ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              PERSISTENT STORAGE                                  │   │
│  │                                                                                  │   │
│  │  • Session metadata (user, sandbox, created_at)                                 │   │
│  │  • Output buffer (last 100KB)                                                   │   │
│  │  • Command history (last 1000 commands)                                         │   │
│  │  • Environment snapshot                                                          │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Session Manager Implementation

```typescript
// server/terminal/sessionManager.ts

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

interface SessionConfig {
  userId: string;
  sandboxId: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

interface Session {
  id: string;
  userId: string;
  sandboxId: string;
  pty: pty.IPty | null;
  status: 'creating' | 'active' | 'disconnected' | 'terminated';
  createdAt: Date;
  lastActivity: Date;
  outputBuffer: CircularBuffer;
  commandHistory: string[];
  environment: Record<string, string>;
  cwd: string;
  cols: number;
  rows: number;
}

/**
 * Circular buffer for output storage
 */
class CircularBuffer {
  private buffer: string[] = [];
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSize = 100 * 1024) { // 100KB default
    this.maxSize = maxSize;
  }

  push(data: string): void {
    this.buffer.push(data);
    this.currentSize += data.length;

    // Trim if over size
    while (this.currentSize > this.maxSize && this.buffer.length > 0) {
      const removed = this.buffer.shift();
      this.currentSize -= removed?.length || 0;
    }
  }

  getAll(): string {
    return this.buffer.join('');
  }

  clear(): void {
    this.buffer = [];
    this.currentSize = 0;
  }

  size(): number {
    return this.currentSize;
  }
}

/**
 * Session Manager with persistence
 */
class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private redis: Redis;
  private cleanupInterval: NodeJS.Timeout;

  // Configuration
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly OUTPUT_BUFFER_SIZE = 100 * 1024; // 100KB
  private readonly MAX_HISTORY = 1000;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor(redisUrl: string) {
    super();
    this.redis = new Redis(redisUrl);
    this.cleanupInterval = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Create new session
   */
  async createSession(config: SessionConfig): Promise<Session> {
    const sessionId = uuidv4();
    const shell = config.shell || process.env.SHELL || '/bin/bash';
    const cwd = config.cwd || process.env.HOME || '/home/ubuntu';

    // Create PTY
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: config.cols || 80,
      rows: config.rows || 24,
      cwd,
      env: {
        ...process.env,
        ...config.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    const session: Session = {
      id: sessionId,
      userId: config.userId,
      sandboxId: config.sandboxId,
      pty: ptyProcess,
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date(),
      outputBuffer: new CircularBuffer(this.OUTPUT_BUFFER_SIZE),
      commandHistory: [],
      environment: config.env || {},
      cwd,
      cols: config.cols || 80,
      rows: config.rows || 24,
    };

    // Handle PTY output
    ptyProcess.onData((data) => {
      session.lastActivity = new Date();
      session.outputBuffer.push(data);
      this.emit('output', sessionId, data);
      
      // Persist to Redis periodically
      this.persistOutputBuffer(sessionId);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      session.status = 'terminated';
      this.emit('exit', sessionId, exitCode, signal);
      this.persistSession(session);
    });

    // Store session
    this.sessions.set(sessionId, session);
    await this.persistSession(session);

    this.emit('created', sessionId);
    return session;
  }

  /**
   * Restore session from persistence
   */
  async restoreSession(sessionId: string): Promise<Session | null> {
    // Check if already in memory
    let session = this.sessions.get(sessionId);
    if (session && session.status !== 'terminated') {
      return session;
    }

    // Try to restore from Redis
    const data = await this.redis.get(`session:${sessionId}`);
    if (!data) return null;

    const stored = JSON.parse(data);
    
    // Recreate PTY
    const ptyProcess = pty.spawn(stored.shell || '/bin/bash', [], {
      name: 'xterm-256color',
      cols: stored.cols,
      rows: stored.rows,
      cwd: stored.cwd,
      env: stored.environment,
    });

    // Restore output buffer
    const outputBuffer = new CircularBuffer(this.OUTPUT_BUFFER_SIZE);
    const storedOutput = await this.redis.get(`session:${sessionId}:output`);
    if (storedOutput) {
      outputBuffer.push(storedOutput);
    }

    session = {
      id: sessionId,
      userId: stored.userId,
      sandboxId: stored.sandboxId,
      pty: ptyProcess,
      status: 'active',
      createdAt: new Date(stored.createdAt),
      lastActivity: new Date(),
      outputBuffer,
      commandHistory: stored.commandHistory || [],
      environment: stored.environment || {},
      cwd: stored.cwd,
      cols: stored.cols,
      rows: stored.rows,
    };

    // Setup handlers
    ptyProcess.onData((data) => {
      session!.lastActivity = new Date();
      session!.outputBuffer.push(data);
      this.emit('output', sessionId, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      session!.status = 'terminated';
      this.emit('exit', sessionId, exitCode, signal);
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Write to session
   */
  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return false;

    session.lastActivity = new Date();
    session.pty.write(data);

    // Track command history (detect Enter key)
    if (data === '\r' || data === '\n') {
      this.trackCommand(session);
    }

    return true;
  }

  /**
   * Resize session
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return false;

    session.cols = cols;
    session.rows = rows;
    session.pty.resize(cols, rows);
    
    return true;
  }

  /**
   * Mark session as disconnected
   */
  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'disconnected';
    this.persistSession(session);
  }

  /**
   * Reconnect to session
   */
  async reconnect(sessionId: string): Promise<{
    session: Session;
    bufferedOutput: string;
  } | null> {
    let session = this.sessions.get(sessionId);
    
    if (!session || session.status === 'terminated') {
      session = await this.restoreSession(sessionId);
      if (!session) return null;
    }

    session.status = 'active';
    session.lastActivity = new Date();

    return {
      session,
      bufferedOutput: session.outputBuffer.getAll(),
    };
  }

  /**
   * Kill session
   */
  kill(sessionId: string, signal: string = 'SIGTERM'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pty) return false;

    session.pty.kill(signal);
    return true;
  }

  /**
   * Get all sessions for user
   */
  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId && s.status !== 'terminated');
  }

  /**
   * Get all sessions for sandbox
   */
  getSandboxSessions(sandboxId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.sandboxId === sandboxId && s.status !== 'terminated');
  }

  /**
   * Persist session to Redis
   */
  private async persistSession(session: Session): Promise<void> {
    const data = {
      id: session.id,
      userId: session.userId,
      sandboxId: session.sandboxId,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      commandHistory: session.commandHistory.slice(-this.MAX_HISTORY),
      environment: session.environment,
      cwd: session.cwd,
      cols: session.cols,
      rows: session.rows,
    };

    await this.redis.setex(
      `session:${session.id}`,
      this.SESSION_TTL,
      JSON.stringify(data)
    );
  }

  /**
   * Persist output buffer (debounced)
   */
  private persistOutputBufferTimeout: Map<string, NodeJS.Timeout> = new Map();

  private persistOutputBuffer(sessionId: string): void {
    // Debounce persistence
    const existing = this.persistOutputBufferTimeout.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        await this.redis.setex(
          `session:${sessionId}:output`,
          this.SESSION_TTL,
          session.outputBuffer.getAll()
        );
      }
      this.persistOutputBufferTimeout.delete(sessionId);
    }, 1000); // Persist every 1 second max

    this.persistOutputBufferTimeout.set(sessionId, timeout);
  }

  /**
   * Track command history
   */
  private currentCommand: Map<string, string> = new Map();

  private trackCommand(session: Session): void {
    const command = this.currentCommand.get(session.id);
    if (command && command.trim()) {
      session.commandHistory.push(command.trim());
      
      // Trim history
      if (session.commandHistory.length > this.MAX_HISTORY) {
        session.commandHistory = session.commandHistory.slice(-this.MAX_HISTORY);
      }
    }
    this.currentCommand.set(session.id, '');
  }

  /**
   * Cleanup inactive sessions
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const maxInactive = this.SESSION_TTL * 1000;

    for (const [id, session] of this.sessions) {
      if (session.status === 'terminated') {
        this.sessions.delete(id);
        continue;
      }

      if (session.status === 'disconnected' && 
          now - session.lastActivity.getTime() > maxInactive) {
        // Persist final state
        await this.persistSession(session);
        
        // Kill PTY
        session.pty?.kill();
        session.status = 'terminated';
        
        this.emit('timeout', id);
      }
    }
  }

  /**
   * Shutdown manager
   */
  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);

    // Persist all sessions
    for (const session of this.sessions.values()) {
      await this.persistSession(session);
    }

    // Close Redis
    await this.redis.quit();
  }
}

export { SessionManager, Session, SessionConfig };
```

---

## Session Persistence

### Persistence Strategies

```typescript
// server/terminal/persistence.ts

import { Redis } from 'ioredis';
import { Pool } from 'pg';

interface PersistenceConfig {
  redis: Redis;
  postgres: Pool;
  outputBufferSize: number;
  historySize: number;
  snapshotInterval: number;
}

/**
 * Multi-tier persistence for terminal sessions
 */
class SessionPersistence {
  private redis: Redis;
  private postgres: Pool;
  private config: PersistenceConfig;

  constructor(config: PersistenceConfig) {
    this.redis = config.redis;
    this.postgres = config.postgres;
    this.config = config;
  }

  /**
   * Save session state (hot path - Redis)
   */
  async saveHotState(sessionId: string, state: {
    output: string;
    cursor: { x: number; y: number };
    scrollTop: number;
    lastActivity: Date;
  }): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Output buffer (circular, keep last N bytes)
    pipeline.append(`session:${sessionId}:output`, state.output);
    pipeline.getrange(`session:${sessionId}:output`, -this.config.outputBufferSize, -1);

    // Cursor and scroll state
    pipeline.hset(`session:${sessionId}:state`, {
      cursorX: state.cursor.x,
      cursorY: state.cursor.y,
      scrollTop: state.scrollTop,
      lastActivity: state.lastActivity.toISOString(),
    });

    // Set TTL
    pipeline.expire(`session:${sessionId}:output`, 3600);
    pipeline.expire(`session:${sessionId}:state`, 3600);

    await pipeline.exec();
  }

  /**
   * Load session state (hot path - Redis)
   */
  async loadHotState(sessionId: string): Promise<{
    output: string;
    cursor: { x: number; y: number };
    scrollTop: number;
  } | null> {
    const pipeline = this.redis.pipeline();
    pipeline.get(`session:${sessionId}:output`);
    pipeline.hgetall(`session:${sessionId}:state`);

    const results = await pipeline.exec();
    if (!results) return null;

    const [outputResult, stateResult] = results;
    const output = outputResult?.[1] as string || '';
    const state = stateResult?.[1] as Record<string, string> || {};

    if (!output && !Object.keys(state).length) {
      return null;
    }

    return {
      output,
      cursor: {
        x: parseInt(state.cursorX) || 0,
        y: parseInt(state.cursorY) || 0,
      },
      scrollTop: parseInt(state.scrollTop) || 0,
    };
  }

  /**
   * Save session metadata (cold path - PostgreSQL)
   */
  async saveMetadata(session: {
    id: string;
    userId: string;
    sandboxId: string;
    shell: string;
    cwd: string;
    environment: Record<string, string>;
    createdAt: Date;
  }): Promise<void> {
    await this.postgres.query(`
      INSERT INTO terminal_sessions (
        id, user_id, sandbox_id, shell, cwd, environment, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        cwd = EXCLUDED.cwd,
        environment = EXCLUDED.environment,
        updated_at = NOW()
    `, [
      session.id,
      session.userId,
      session.sandboxId,
      session.shell,
      session.cwd,
      JSON.stringify(session.environment),
      session.createdAt,
    ]);
  }

  /**
   * Save command history (cold path - PostgreSQL)
   */
  async saveHistory(sessionId: string, commands: string[]): Promise<void> {
    if (commands.length === 0) return;

    const values = commands.map((cmd, i) => 
      `($1, $${i + 2}, NOW())`
    ).join(', ');

    await this.postgres.query(`
      INSERT INTO terminal_history (session_id, command, executed_at)
      VALUES ${values}
    `, [sessionId, ...commands]);
  }

  /**
   * Load command history
   */
  async loadHistory(sessionId: string, limit = 1000): Promise<string[]> {
    const result = await this.postgres.query(`
      SELECT command FROM terminal_history
      WHERE session_id = $1
      ORDER BY executed_at DESC
      LIMIT $2
    `, [sessionId, limit]);

    return result.rows.map(r => r.command).reverse();
  }

  /**
   * Create snapshot for long-term storage
   */
  async createSnapshot(sessionId: string): Promise<string> {
    const snapshotId = `${sessionId}-${Date.now()}`;

    // Get current state from Redis
    const hotState = await this.loadHotState(sessionId);
    if (!hotState) {
      throw new Error('Session not found');
    }

    // Get metadata from PostgreSQL
    const metadata = await this.postgres.query(`
      SELECT * FROM terminal_sessions WHERE id = $1
    `, [sessionId]);

    if (metadata.rows.length === 0) {
      throw new Error('Session metadata not found');
    }

    // Get history
    const history = await this.loadHistory(sessionId);

    // Save snapshot
    await this.postgres.query(`
      INSERT INTO terminal_snapshots (
        id, session_id, output, cursor_x, cursor_y, scroll_top,
        history, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      snapshotId,
      sessionId,
      hotState.output,
      hotState.cursor.x,
      hotState.cursor.y,
      hotState.scrollTop,
      JSON.stringify(history),
      JSON.stringify(metadata.rows[0]),
    ]);

    return snapshotId;
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshotId: string): Promise<{
    output: string;
    cursor: { x: number; y: number };
    scrollTop: number;
    history: string[];
    metadata: any;
  }> {
    const result = await this.postgres.query(`
      SELECT * FROM terminal_snapshots WHERE id = $1
    `, [snapshotId]);

    if (result.rows.length === 0) {
      throw new Error('Snapshot not found');
    }

    const snapshot = result.rows[0];

    return {
      output: snapshot.output,
      cursor: {
        x: snapshot.cursor_x,
        y: snapshot.cursor_y,
      },
      scrollTop: snapshot.scroll_top,
      history: JSON.parse(snapshot.history),
      metadata: JSON.parse(snapshot.metadata),
    };
  }
}

export { SessionPersistence };
```

### Output Buffer Management

```typescript
// server/terminal/outputBuffer.ts

/**
 * Efficient circular buffer for terminal output
 */
class OutputBuffer {
  private chunks: Uint8Array[] = [];
  private totalSize = 0;
  private maxSize: number;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(maxSize = 100 * 1024) {
    this.maxSize = maxSize;
  }

  /**
   * Append data to buffer
   */
  append(data: string | Uint8Array): void {
    const chunk = typeof data === 'string' 
      ? this.encoder.encode(data) 
      : data;

    this.chunks.push(chunk);
    this.totalSize += chunk.length;

    // Trim if over size
    this.trim();
  }

  /**
   * Trim buffer to max size
   */
  private trim(): void {
    while (this.totalSize > this.maxSize && this.chunks.length > 0) {
      const removed = this.chunks.shift();
      if (removed) {
        this.totalSize -= removed.length;
      }
    }

    // If single chunk is too large, truncate it
    if (this.chunks.length === 1 && this.totalSize > this.maxSize) {
      const chunk = this.chunks[0];
      const start = chunk.length - this.maxSize;
      this.chunks[0] = chunk.slice(start);
      this.totalSize = this.chunks[0].length;
    }
  }

  /**
   * Get all data as string
   */
  toString(): string {
    if (this.chunks.length === 0) return '';
    
    // Concatenate all chunks
    const combined = new Uint8Array(this.totalSize);
    let offset = 0;
    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return this.decoder.decode(combined);
  }

  /**
   * Get all data as Uint8Array
   */
  toUint8Array(): Uint8Array {
    if (this.chunks.length === 0) return new Uint8Array(0);
    if (this.chunks.length === 1) return this.chunks[0];

    const combined = new Uint8Array(this.totalSize);
    let offset = 0;
    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  /**
   * Get last N bytes
   */
  getLastBytes(n: number): Uint8Array {
    if (n >= this.totalSize) {
      return this.toUint8Array();
    }

    const result = new Uint8Array(n);
    let remaining = n;
    let resultOffset = n;

    // Work backwards through chunks
    for (let i = this.chunks.length - 1; i >= 0 && remaining > 0; i--) {
      const chunk = this.chunks[i];
      const copyLength = Math.min(remaining, chunk.length);
      const sourceStart = chunk.length - copyLength;
      
      resultOffset -= copyLength;
      result.set(chunk.slice(sourceStart), resultOffset);
      remaining -= copyLength;
    }

    return result;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }

  /**
   * Get current size
   */
  size(): number {
    return this.totalSize;
  }

  /**
   * Serialize for storage
   */
  serialize(): string {
    return Buffer.from(this.toUint8Array()).toString('base64');
  }

  /**
   * Deserialize from storage
   */
  static deserialize(data: string, maxSize?: number): OutputBuffer {
    const buffer = new OutputBuffer(maxSize);
    const decoded = Buffer.from(data, 'base64');
    buffer.append(new Uint8Array(decoded));
    return buffer;
  }
}

export { OutputBuffer };
```

---

## Reconnection Handling

### Reconnection Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              RECONNECTION FLOW                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CLIENT                              SERVER                           PTY               │
│    │                                   │                               │                │
│    │  1. WebSocket Connect             │                               │                │
│    │──────────────────────────────────►│                               │                │
│    │                                   │                               │                │
│    │  2. Send session ID + token       │                               │                │
│    │──────────────────────────────────►│                               │                │
│    │                                   │                               │                │
│    │                                   │  3. Lookup session            │                │
│    │                                   │──────────────────────────────►│                │
│    │                                   │                               │                │
│    │                                   │  4. Session found (or create) │                │
│    │                                   │◄──────────────────────────────│                │
│    │                                   │                               │                │
│    │  5. Send buffered output          │                               │                │
│    │◄──────────────────────────────────│                               │                │
│    │                                   │                               │                │
│    │  6. Send current state            │                               │                │
│    │◄──────────────────────────────────│                               │                │
│    │                                   │                               │                │
│    │  7. Resume normal operation       │                               │                │
│    │◄─────────────────────────────────►│◄─────────────────────────────►│                │
│    │                                   │                               │                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Reconnection Handler

```typescript
// server/terminal/reconnectionHandler.ts

import { WebSocket } from 'ws';
import { SessionManager } from './sessionManager';

interface ReconnectionOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

const defaultOptions: ReconnectionOptions = {
  maxRetries: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
};

/**
 * Handle terminal reconnection with buffered output replay
 */
class ReconnectionHandler {
  private sessionManager: SessionManager;
  private options: ReconnectionOptions;

  constructor(sessionManager: SessionManager, options: Partial<ReconnectionOptions> = {}) {
    this.sessionManager = sessionManager;
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Handle reconnection request
   */
  async handleReconnect(ws: WebSocket, sessionId: string, token: string): Promise<boolean> {
    try {
      // Verify token
      if (!await this.verifyToken(token, sessionId)) {
        ws.close(4001, 'Unauthorized');
        return false;
      }

      // Try to reconnect to existing session
      const result = await this.sessionManager.reconnect(sessionId);
      
      if (!result) {
        // Session not found, create new one
        ws.send(JSON.stringify({
          type: 'session_not_found',
          message: 'Session expired or not found',
        }));
        return false;
      }

      const { session, bufferedOutput } = result;

      // Send reconnection success
      ws.send(JSON.stringify({
        type: 'reconnected',
        sessionId: session.id,
        cols: session.cols,
        rows: session.rows,
      }));

      // Replay buffered output
      if (bufferedOutput) {
        // Send in chunks to avoid overwhelming the client
        const chunkSize = 16384; // 16KB chunks
        for (let i = 0; i < bufferedOutput.length; i += chunkSize) {
          const chunk = bufferedOutput.slice(i, i + chunkSize);
          ws.send(JSON.stringify({
            type: 'output',
            data: chunk,
            replay: true,
          }));
          
          // Small delay between chunks
          if (i + chunkSize < bufferedOutput.length) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }

      // Send replay complete
      ws.send(JSON.stringify({
        type: 'replay_complete',
      }));

      return true;

    } catch (error) {
      console.error('Reconnection error:', error);
      ws.close(4002, 'Reconnection failed');
      return false;
    }
  }

  /**
   * Calculate reconnection delay with exponential backoff
   */
  calculateDelay(attempt: number): number {
    let delay = this.options.baseDelay * Math.pow(2, attempt);
    delay = Math.min(delay, this.options.maxDelay);

    if (this.options.jitter) {
      // Add ±25% jitter
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.round(delay);
  }

  /**
   * Verify reconnection token
   */
  private async verifyToken(token: string, sessionId: string): Promise<boolean> {
    // Implement token verification
    return true;
  }
}

/**
 * Client-side reconnection logic
 */
class ClientReconnector {
  private url: string;
  private sessionId: string;
  private token: string;
  private options: ReconnectionOptions;
  private ws: WebSocket | null = null;
  private attempt = 0;
  private reconnecting = false;

  constructor(
    url: string,
    sessionId: string,
    token: string,
    options: Partial<ReconnectionOptions> = {}
  ) {
    this.url = url;
    this.sessionId = sessionId;
    this.token = token;
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Connect with automatic reconnection
   */
  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      this.attempt = 0;
      this.tryConnect(resolve, reject);
    });
  }

  private tryConnect(
    resolve: (ws: WebSocket) => void,
    reject: (error: Error) => void
  ): void {
    const wsUrl = `${this.url}?sessionId=${this.sessionId}&token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.attempt = 0;
      this.reconnecting = false;
      resolve(this.ws!);
    };

    this.ws.onclose = (event) => {
      if (event.code === 4001) {
        reject(new Error('Unauthorized'));
        return;
      }

      if (this.attempt < this.options.maxRetries) {
        this.scheduleReconnect(resolve, reject);
      } else {
        reject(new Error('Max reconnection attempts reached'));
      }
    };

    this.ws.onerror = () => {
      // Error will trigger close
    };
  }

  private scheduleReconnect(
    resolve: (ws: WebSocket) => void,
    reject: (error: Error) => void
  ): void {
    this.reconnecting = true;
    const delay = this.calculateDelay(this.attempt);
    this.attempt++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.attempt}/${this.options.maxRetries})`);

    setTimeout(() => {
      this.tryConnect(resolve, reject);
    }, delay);
  }

  private calculateDelay(attempt: number): number {
    let delay = this.options.baseDelay * Math.pow(2, attempt);
    delay = Math.min(delay, this.options.maxDelay);

    if (this.options.jitter) {
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.round(delay);
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.reconnecting;
  }

  /**
   * Disconnect and stop reconnection
   */
  disconnect(): void {
    this.attempt = this.options.maxRetries; // Prevent further reconnection
    this.ws?.close();
  }
}

export { ReconnectionHandler, ClientReconnector };
```

---

## History Preservation

### Shell History Integration

```typescript
// server/terminal/historyManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';

interface HistoryEntry {
  command: string;
  timestamp: Date;
  exitCode?: number;
  duration?: number;
  cwd?: string;
}

/**
 * Manage shell command history
 */
class HistoryManager {
  private postgres: Pool;
  private historyDir: string;

  constructor(postgres: Pool, historyDir = '/home/ubuntu') {
    this.postgres = postgres;
    this.historyDir = historyDir;
  }

  /**
   * Get history file path for shell
   */
  private getHistoryFile(shell: string): string {
    const shellName = path.basename(shell);
    switch (shellName) {
      case 'bash':
        return path.join(this.historyDir, '.bash_history');
      case 'zsh':
        return path.join(this.historyDir, '.zsh_history');
      case 'fish':
        return path.join(this.historyDir, '.local/share/fish/fish_history');
      default:
        return path.join(this.historyDir, '.shell_history');
    }
  }

  /**
   * Load history from file
   */
  async loadFromFile(shell: string): Promise<string[]> {
    const historyFile = this.getHistoryFile(shell);
    
    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const shellName = path.basename(shell);

      switch (shellName) {
        case 'zsh':
          return this.parseZshHistory(content);
        case 'fish':
          return this.parseFishHistory(content);
        default:
          return this.parseBashHistory(content);
      }
    } catch (error) {
      // File doesn't exist or can't be read
      return [];
    }
  }

  /**
   * Parse bash history format
   */
  private parseBashHistory(content: string): string[] {
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'));
  }

  /**
   * Parse zsh history format (with timestamps)
   */
  private parseZshHistory(content: string): string[] {
    const lines = content.split('\n');
    const commands: string[] = [];

    for (const line of lines) {
      // Zsh format: : timestamp:0;command
      const match = line.match(/^: \d+:\d+;(.*)$/);
      if (match) {
        commands.push(match[1]);
      } else if (line.trim() && !line.startsWith(':')) {
        commands.push(line);
      }
    }

    return commands;
  }

  /**
   * Parse fish history format (YAML-like)
   */
  private parseFishHistory(content: string): string[] {
    const commands: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('- cmd: ')) {
        commands.push(line.slice(7));
      }
    }

    return commands;
  }

  /**
   * Save history to database
   */
  async saveToDatabase(
    sessionId: string,
    userId: string,
    entries: HistoryEntry[]
  ): Promise<void> {
    if (entries.length === 0) return;

    const values = entries.map((entry, i) => {
      const offset = i * 6;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    }).join(', ');

    const params = entries.flatMap(entry => [
      sessionId,
      userId,
      entry.command,
      entry.timestamp,
      entry.exitCode ?? null,
      entry.cwd ?? null,
    ]);

    await this.postgres.query(`
      INSERT INTO command_history (
        session_id, user_id, command, executed_at, exit_code, cwd
      ) VALUES ${values}
    `, params);
  }

  /**
   * Load history from database
   */
  async loadFromDatabase(
    userId: string,
    options: {
      limit?: number;
      sessionId?: string;
      search?: string;
      since?: Date;
    } = {}
  ): Promise<HistoryEntry[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.sessionId) {
      conditions.push(`session_id = $${paramIndex++}`);
      params.push(options.sessionId);
    }

    if (options.search) {
      conditions.push(`command ILIKE $${paramIndex++}`);
      params.push(`%${options.search}%`);
    }

    if (options.since) {
      conditions.push(`executed_at >= $${paramIndex++}`);
      params.push(options.since);
    }

    const limit = options.limit || 1000;
    params.push(limit);

    const result = await this.postgres.query(`
      SELECT command, executed_at, exit_code, cwd
      FROM command_history
      WHERE ${conditions.join(' AND ')}
      ORDER BY executed_at DESC
      LIMIT $${paramIndex}
    `, params);

    return result.rows.map(row => ({
      command: row.command,
      timestamp: row.executed_at,
      exitCode: row.exit_code,
      cwd: row.cwd,
    })).reverse();
  }

  /**
   * Sync file history to database
   */
  async syncFileToDatabase(
    sessionId: string,
    userId: string,
    shell: string
  ): Promise<number> {
    const commands = await this.loadFromFile(shell);
    
    if (commands.length === 0) return 0;

    // Get last synced command
    const lastSync = await this.postgres.query(`
      SELECT command FROM command_history
      WHERE user_id = $1
      ORDER BY executed_at DESC
      LIMIT 1
    `, [userId]);

    const lastCommand = lastSync.rows[0]?.command;
    
    // Find new commands
    let startIndex = 0;
    if (lastCommand) {
      const lastIndex = commands.lastIndexOf(lastCommand);
      if (lastIndex !== -1) {
        startIndex = lastIndex + 1;
      }
    }

    const newCommands = commands.slice(startIndex);
    if (newCommands.length === 0) return 0;

    // Save new commands
    const entries: HistoryEntry[] = newCommands.map((command, i) => ({
      command,
      timestamp: new Date(Date.now() - (newCommands.length - i) * 1000),
    }));

    await this.saveToDatabase(sessionId, userId, entries);
    return newCommands.length;
  }

  /**
   * Export history to file
   */
  async exportToFile(userId: string, shell: string): Promise<string> {
    const entries = await this.loadFromDatabase(userId, { limit: 10000 });
    const historyFile = this.getHistoryFile(shell);
    const shellName = path.basename(shell);

    let content: string;

    switch (shellName) {
      case 'zsh':
        content = entries.map(e => 
          `: ${Math.floor(e.timestamp.getTime() / 1000)}:0;${e.command}`
        ).join('\n');
        break;
      case 'fish':
        content = entries.map(e => 
          `- cmd: ${e.command}\n  when: ${Math.floor(e.timestamp.getTime() / 1000)}`
        ).join('\n');
        break;
      default:
        content = entries.map(e => e.command).join('\n');
    }

    await fs.writeFile(historyFile, content + '\n');
    return historyFile;
  }

  /**
   * Search history with fuzzy matching
   */
  async searchHistory(
    userId: string,
    query: string,
    limit = 50
  ): Promise<HistoryEntry[]> {
    // Use PostgreSQL trigram similarity for fuzzy search
    const result = await this.postgres.query(`
      SELECT command, executed_at, exit_code, cwd,
             similarity(command, $2) as sim
      FROM command_history
      WHERE user_id = $1
        AND (command ILIKE $3 OR similarity(command, $2) > 0.1)
      ORDER BY sim DESC, executed_at DESC
      LIMIT $4
    `, [userId, query, `%${query}%`, limit]);

    return result.rows.map(row => ({
      command: row.command,
      timestamp: row.executed_at,
      exitCode: row.exit_code,
      cwd: row.cwd,
    }));
  }
}

export { HistoryManager, HistoryEntry };
```

---

## Multiple Terminal Sessions

### Multi-Session Manager

```typescript
// server/terminal/multiSessionManager.ts

import { EventEmitter } from 'events';
import { SessionManager, Session } from './sessionManager';

interface SessionGroup {
  id: string;
  userId: string;
  sandboxId: string;
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  layout: SessionLayout;
}

interface SessionLayout {
  type: 'single' | 'split-horizontal' | 'split-vertical' | 'grid';
  panes: PaneConfig[];
}

interface PaneConfig {
  sessionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Manage multiple terminal sessions per user/sandbox
 */
class MultiSessionManager extends EventEmitter {
  private sessionManager: SessionManager;
  private groups: Map<string, SessionGroup> = new Map();
  private maxSessionsPerGroup = 10;

  constructor(sessionManager: SessionManager) {
    super();
    this.sessionManager = sessionManager;
  }

  /**
   * Create or get session group
   */
  getOrCreateGroup(userId: string, sandboxId: string): SessionGroup {
    const groupId = `${userId}:${sandboxId}`;
    
    let group = this.groups.get(groupId);
    if (!group) {
      group = {
        id: groupId,
        userId,
        sandboxId,
        sessions: new Map(),
        activeSessionId: null,
        layout: { type: 'single', panes: [] },
      };
      this.groups.set(groupId, group);
    }

    return group;
  }

  /**
   * Create new session in group
   */
  async createSession(
    userId: string,
    sandboxId: string,
    options: {
      shell?: string;
      cwd?: string;
      name?: string;
    } = {}
  ): Promise<Session> {
    const group = this.getOrCreateGroup(userId, sandboxId);

    if (group.sessions.size >= this.maxSessionsPerGroup) {
      throw new Error(`Maximum sessions (${this.maxSessionsPerGroup}) reached`);
    }

    const session = await this.sessionManager.createSession({
      userId,
      sandboxId,
      shell: options.shell,
      cwd: options.cwd,
    });

    group.sessions.set(session.id, session);
    
    // Set as active if first session
    if (!group.activeSessionId) {
      group.activeSessionId = session.id;
    }

    // Update layout
    this.updateLayout(group);

    this.emit('session:created', group.id, session.id);
    return session;
  }

  /**
   * Close session
   */
  async closeSession(userId: string, sandboxId: string, sessionId: string): Promise<void> {
    const group = this.getOrCreateGroup(userId, sandboxId);
    const session = group.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Kill PTY
    this.sessionManager.kill(sessionId);
    group.sessions.delete(sessionId);

    // Update active session
    if (group.activeSessionId === sessionId) {
      const remaining = Array.from(group.sessions.keys());
      group.activeSessionId = remaining[0] || null;
    }

    // Update layout
    this.updateLayout(group);

    this.emit('session:closed', group.id, sessionId);
  }

  /**
   * Set active session
   */
  setActiveSession(userId: string, sandboxId: string, sessionId: string): void {
    const group = this.getOrCreateGroup(userId, sandboxId);

    if (!group.sessions.has(sessionId)) {
      throw new Error('Session not found');
    }

    group.activeSessionId = sessionId;
    this.emit('session:activated', group.id, sessionId);
  }

  /**
   * Get all sessions in group
   */
  getSessions(userId: string, sandboxId: string): Session[] {
    const group = this.groups.get(`${userId}:${sandboxId}`);
    return group ? Array.from(group.sessions.values()) : [];
  }

  /**
   * Get session layout
   */
  getLayout(userId: string, sandboxId: string): SessionLayout {
    const group = this.groups.get(`${userId}:${sandboxId}`);
    return group?.layout || { type: 'single', panes: [] };
  }

  /**
   * Set session layout
   */
  setLayout(userId: string, sandboxId: string, layout: SessionLayout): void {
    const group = this.getOrCreateGroup(userId, sandboxId);
    group.layout = layout;
    this.emit('layout:changed', group.id, layout);
  }

  /**
   * Split session
   */
  async splitSession(
    userId: string,
    sandboxId: string,
    sessionId: string,
    direction: 'horizontal' | 'vertical'
  ): Promise<Session> {
    const group = this.getOrCreateGroup(userId, sandboxId);
    const sourceSession = group.sessions.get(sessionId);

    if (!sourceSession) {
      throw new Error('Session not found');
    }

    // Create new session with same cwd
    const newSession = await this.createSession(userId, sandboxId, {
      cwd: sourceSession.cwd,
      shell: undefined, // Use default shell
    });

    // Update layout for split
    this.updateLayoutForSplit(group, sessionId, newSession.id, direction);

    return newSession;
  }

  /**
   * Update layout automatically
   */
  private updateLayout(group: SessionGroup): void {
    const sessionIds = Array.from(group.sessions.keys());
    const count = sessionIds.length;

    if (count === 0) {
      group.layout = { type: 'single', panes: [] };
      return;
    }

    if (count === 1) {
      group.layout = {
        type: 'single',
        panes: [{
          sessionId: sessionIds[0],
          x: 0, y: 0, width: 100, height: 100,
        }],
      };
      return;
    }

    // Grid layout for multiple sessions
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const paneWidth = 100 / cols;
    const paneHeight = 100 / rows;

    group.layout = {
      type: 'grid',
      panes: sessionIds.map((id, i) => ({
        sessionId: id,
        x: (i % cols) * paneWidth,
        y: Math.floor(i / cols) * paneHeight,
        width: paneWidth,
        height: paneHeight,
      })),
    };
  }

  /**
   * Update layout for split
   */
  private updateLayoutForSplit(
    group: SessionGroup,
    sourceId: string,
    newId: string,
    direction: 'horizontal' | 'vertical'
  ): void {
    const sourcePane = group.layout.panes.find(p => p.sessionId === sourceId);
    if (!sourcePane) return;

    if (direction === 'horizontal') {
      // Split horizontally (side by side)
      const halfWidth = sourcePane.width / 2;
      sourcePane.width = halfWidth;
      
      group.layout.panes.push({
        sessionId: newId,
        x: sourcePane.x + halfWidth,
        y: sourcePane.y,
        width: halfWidth,
        height: sourcePane.height,
      });
    } else {
      // Split vertically (top and bottom)
      const halfHeight = sourcePane.height / 2;
      sourcePane.height = halfHeight;
      
      group.layout.panes.push({
        sessionId: newId,
        x: sourcePane.x,
        y: sourcePane.y + halfHeight,
        width: sourcePane.width,
        height: halfHeight,
      });
    }

    group.layout.type = direction === 'horizontal' ? 'split-horizontal' : 'split-vertical';
  }

  /**
   * Broadcast to all sessions in group
   */
  broadcastInput(userId: string, sandboxId: string, data: string): void {
    const group = this.groups.get(`${userId}:${sandboxId}`);
    if (!group) return;

    for (const sessionId of group.sessions.keys()) {
      this.sessionManager.write(sessionId, data);
    }
  }

  /**
   * Rename session
   */
  renameSession(
    userId: string,
    sandboxId: string,
    sessionId: string,
    name: string
  ): void {
    const group = this.groups.get(`${userId}:${sandboxId}`);
    const session = group?.sessions.get(sessionId);

    if (session) {
      (session as any).name = name;
      this.emit('session:renamed', group!.id, sessionId, name);
    }
  }
}

export { MultiSessionManager, SessionGroup, SessionLayout, PaneConfig };
```

---

## State Synchronization

### State Sync Protocol

```typescript
// server/terminal/stateSync.ts

import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

interface TerminalState {
  sessionId: string;
  cursor: { x: number; y: number };
  scrollTop: number;
  selection: { start: number; end: number } | null;
  buffer: string;
  timestamp: number;
}

/**
 * Synchronize terminal state across multiple clients
 */
class StateSynchronizer extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private stateCache: Map<string, TerminalState> = new Map();

  constructor(redisUrl: string) {
    super();
    this.redis = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    
    this.setupSubscriber();
  }

  /**
   * Setup Redis subscriber for state updates
   */
  private setupSubscriber(): void {
    this.subscriber.psubscribe('terminal:state:*');
    
    this.subscriber.on('pmessage', (pattern, channel, message) => {
      const sessionId = channel.split(':')[2];
      const state = JSON.parse(message);
      
      this.stateCache.set(sessionId, state);
      this.emit('state:updated', sessionId, state);
    });
  }

  /**
   * Update and broadcast state
   */
  async updateState(sessionId: string, state: Partial<TerminalState>): Promise<void> {
    const current = this.stateCache.get(sessionId) || {
      sessionId,
      cursor: { x: 0, y: 0 },
      scrollTop: 0,
      selection: null,
      buffer: '',
      timestamp: 0,
    };

    const updated: TerminalState = {
      ...current,
      ...state,
      timestamp: Date.now(),
    };

    // Store in Redis
    await this.redis.setex(
      `terminal:state:${sessionId}`,
      3600,
      JSON.stringify(updated)
    );

    // Broadcast update
    await this.redis.publish(
      `terminal:state:${sessionId}`,
      JSON.stringify(updated)
    );

    this.stateCache.set(sessionId, updated);
  }

  /**
   * Get current state
   */
  async getState(sessionId: string): Promise<TerminalState | null> {
    // Check cache first
    const cached = this.stateCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < 1000) {
      return cached;
    }

    // Load from Redis
    const data = await this.redis.get(`terminal:state:${sessionId}`);
    if (!data) return null;

    const state = JSON.parse(data);
    this.stateCache.set(sessionId, state);
    return state;
  }

  /**
   * Subscribe to state updates for session
   */
  subscribeToSession(sessionId: string, callback: (state: TerminalState) => void): () => void {
    const handler = (id: string, state: TerminalState) => {
      if (id === sessionId) {
        callback(state);
      }
    };

    this.on('state:updated', handler);

    return () => {
      this.off('state:updated', handler);
    };
  }

  /**
   * Cleanup
   */
  async close(): Promise<void> {
    await this.subscriber.quit();
    await this.redis.quit();
  }
}

export { StateSynchronizer, TerminalState };
```

---

## Database Schema

### PostgreSQL Schema

```sql
-- migrations/001_terminal_sessions.sql

-- Terminal sessions table
CREATE TABLE terminal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    shell VARCHAR(255) NOT NULL DEFAULT '/bin/bash',
    cwd VARCHAR(1024) NOT NULL DEFAULT '/home/ubuntu',
    environment JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terminated_at TIMESTAMPTZ,
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'disconnected', 'terminated'))
);

-- Indexes
CREATE INDEX idx_terminal_sessions_user ON terminal_sessions(user_id);
CREATE INDEX idx_terminal_sessions_sandbox ON terminal_sessions(sandbox_id);
CREATE INDEX idx_terminal_sessions_status ON terminal_sessions(status);

-- Command history table
CREATE TABLE command_history (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES terminal_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_code INTEGER,
    duration_ms INTEGER,
    cwd VARCHAR(1024)
);

-- Indexes for history
CREATE INDEX idx_command_history_user ON command_history(user_id);
CREATE INDEX idx_command_history_session ON command_history(session_id);
CREATE INDEX idx_command_history_executed ON command_history(executed_at DESC);
CREATE INDEX idx_command_history_command_trgm ON command_history USING gin(command gin_trgm_ops);

-- Terminal snapshots table
CREATE TABLE terminal_snapshots (
    id VARCHAR(255) PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES terminal_sessions(id) ON DELETE CASCADE,
    output TEXT NOT NULL,
    cursor_x INTEGER NOT NULL DEFAULT 0,
    cursor_y INTEGER NOT NULL DEFAULT 0,
    scroll_top INTEGER NOT NULL DEFAULT 0,
    history JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for snapshots
CREATE INDEX idx_terminal_snapshots_session ON terminal_snapshots(session_id);
CREATE INDEX idx_terminal_snapshots_created ON terminal_snapshots(created_at DESC);

-- Session groups table (for multi-session management)
CREATE TABLE session_groups (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    active_session_id UUID REFERENCES terminal_sessions(id),
    layout JSONB DEFAULT '{"type": "single", "panes": []}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER terminal_sessions_updated_at
    BEFORE UPDATE ON terminal_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER session_groups_updated_at
    BEFORE UPDATE ON session_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

---

## Kubernetes Integration

### Terminal Pod Configuration

```yaml
# kubernetes/terminal-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terminal-server
  namespace: platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: terminal-server
  template:
    metadata:
      labels:
        app: terminal-server
    spec:
      containers:
        - name: terminal-server
          image: platform/terminal-server:latest
          ports:
            - containerPort: 3000
              name: http
            - containerPort: 3001
              name: ws
          env:
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: url
            - name: SESSION_TTL
              value: "3600"
            - name: OUTPUT_BUFFER_SIZE
              value: "102400"
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: terminal-server
  namespace: platform
spec:
  selector:
    app: terminal-server
  ports:
    - name: http
      port: 80
      targetPort: 3000
    - name: ws
      port: 8080
      targetPort: 3001
  type: ClusterIP

---
# Redis for session state
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: terminal-redis
  namespace: platform
spec:
  serviceName: terminal-redis
  replicas: 1
  selector:
    matchLabels:
      app: terminal-redis
  template:
    metadata:
      labels:
        app: terminal-redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          command:
            - redis-server
            - --appendonly
            - "yes"
            - --maxmemory
            - 256mb
            - --maxmemory-policy
            - allkeys-lru
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
```

---

## Best Practices

### Implementation Checklist

| Feature | Priority | Implementation |
|---------|----------|----------------|
| **Output buffering** | Required | Circular buffer, 100KB default |
| **Session persistence** | Required | Redis + PostgreSQL |
| **Reconnection handling** | Required | Exponential backoff |
| **Command history** | High | File + database sync |
| **Multiple sessions** | High | Session groups |
| **State synchronization** | Medium | Redis pub/sub |
| **Layout management** | Medium | Split/grid layouts |
| **Snapshot/restore** | Low | Long-term storage |

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| **Reconnection time** | <500ms | <2s |
| **Output replay** | <1s for 100KB | <3s |
| **History search** | <100ms | <500ms |
| **State sync** | <50ms | <200ms |

### Security Considerations

| Risk | Mitigation |
|------|------------|
| **Session hijacking** | Token-based auth, session binding |
| **History exposure** | User isolation, encryption |
| **Buffer overflow** | Size limits, circular buffer |
| **DoS via sessions** | Rate limiting, max sessions |

---

## Summary

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         TERMINAL PERSISTENCE SUMMARY                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  HOT PATH (Redis)                    COLD PATH (PostgreSQL)                            │
│  ├── Output buffer                   ├── Session metadata                              │
│  ├── Cursor state                    ├── Command history                               │
│  ├── Scroll position                 ├── Snapshots                                     │
│  └── Active sessions                 └── Analytics                                     │
│                                                                                         │
│  RECONNECTION                        MULTI-SESSION                                     │
│  ├── Exponential backoff             ├── Session groups                               │
│  ├── Output replay                   ├── Layout management                            │
│  ├── State restoration               ├── Split/grid views                             │
│  └── Seamless resume                 └── Broadcast input                              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
