# Real-Time Collaboration

This guide provides comprehensive coverage of real-time collaboration features similar to Figma, including CRDT/OT algorithms for conflict resolution, presence indicators, cursor sharing, and collaborative editing infrastructure.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [CRDT vs OT Comparison](#crdt-vs-ot-comparison)
4. [CRDT Implementation](#crdt-implementation)
5. [Operational Transformation](#operational-transformation)
6. [Presence System](#presence-system)
7. [Cursor Sharing](#cursor-sharing)
8. [Selection Synchronization](#selection-synchronization)
9. [Awareness Protocol](#awareness-protocol)
10. [WebSocket Infrastructure](#websocket-infrastructure)
11. [Conflict Resolution](#conflict-resolution)
12. [Performance Optimization](#performance-optimization)
13. [Offline Support](#offline-support)
14. [API Reference](#api-reference)
15. [Best Practices](#best-practices)

---

## Overview

Real-time collaboration enables multiple users to edit the same document simultaneously, seeing each other's changes instantly. This requires sophisticated algorithms to handle concurrent edits without conflicts.

### Collaboration Features

| Feature | Description | Latency Target |
|---------|-------------|----------------|
| **Live Editing** | See changes as they're typed | <50ms |
| **Presence** | Know who's online | <100ms |
| **Cursors** | See where others are editing | <50ms |
| **Selections** | See what others have selected | <50ms |
| **Comments** | Real-time comment threads | <200ms |
| **History** | Collaborative undo/redo | <100ms |

### Technology Choices

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **CRDT** | No central server needed, offline-first | Higher memory usage | P2P, offline-heavy |
| **OT** | Lower memory, proven at scale | Requires central server | Google Docs style |
| **Hybrid** | Best of both worlds | More complex | Modern editors |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        REAL-TIME COLLABORATION ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CLIENT LAYER                                        │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   Editor    │    │   CRDT      │    │  Presence   │    │  Awareness  │       │   │
│  │  │   Binding   │◄──►│   Document  │◄──►│   Manager   │◄──►│   Protocol  │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │        │                  │                  │                  │                │   │
│  │        └──────────────────┼──────────────────┼──────────────────┘                │   │
│  │                           │                  │                                    │   │
│  │                           ▼                  ▼                                    │   │
│  │                    ┌─────────────────────────────────┐                           │   │
│  │                    │      WebSocket Provider         │                           │   │
│  │                    │   (y-websocket / Hocuspocus)    │                           │   │
│  │                    └─────────────────────────────────┘                           │   │
│  │                                    │                                              │   │
│  └────────────────────────────────────┼──────────────────────────────────────────────┘   │
│                                       │                                                  │
│                                       │ WebSocket                                        │
│                                       │                                                  │
│  ┌────────────────────────────────────┼──────────────────────────────────────────────┐   │
│  │                              SERVER LAYER                                         │   │
│  │                                    │                                              │   │
│  │                    ┌───────────────▼───────────────┐                             │   │
│  │                    │      Collaboration Server      │                             │   │
│  │                    │   (Hocuspocus / y-websocket)   │                             │   │
│  │                    └───────────────┬───────────────┘                             │   │
│  │                                    │                                              │   │
│  │        ┌───────────────────────────┼───────────────────────────┐                 │   │
│  │        │                           │                           │                 │   │
│  │        ▼                           ▼                           ▼                 │   │
│  │  ┌───────────┐              ┌───────────┐              ┌───────────┐            │   │
│  │  │  Document │              │  Presence │              │  Message  │            │   │
│  │  │  Storage  │              │   Store   │              │   Queue   │            │   │
│  │  │  (Redis)  │              │  (Redis)  │              │  (Redis)  │            │   │
│  │  └───────────┘              └───────────┘              └───────────┘            │   │
│  │                                                                                   │   │
│  └───────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           COLLABORATIVE EDIT DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER A                        SERVER                         USER B                    │
│    │                             │                              │                       │
│    │  1. Type "Hello"            │                              │                       │
│    │ ───────────────────────────►│                              │                       │
│    │                             │                              │                       │
│    │                             │  2. Broadcast to others      │                       │
│    │                             │ ─────────────────────────────►                       │
│    │                             │                              │                       │
│    │                             │                              │  3. Apply & render    │
│    │                             │                              │ ─────────────────┐    │
│    │                             │                              │                  │    │
│    │                             │                              │ ◄────────────────┘    │
│    │                             │                              │                       │
│    │                             │  4. Type "World"             │                       │
│    │                             │ ◄─────────────────────────────                       │
│    │                             │                              │                       │
│    │  5. Receive & merge         │                              │                       │
│    │ ◄───────────────────────────│                              │                       │
│    │                             │                              │                       │
│    │  6. Both see "HelloWorld"   │                              │                       │
│    │                             │                              │                       │
│    │  LATENCY: ~30-50ms          │                              │                       │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## CRDT vs OT Comparison

### Conflict-free Replicated Data Types (CRDT)

CRDTs are data structures that can be replicated across multiple nodes, where replicas can be updated independently and concurrently without coordination, and it's always mathematically possible to resolve inconsistencies.

### Operational Transformation (OT)

OT is an algorithm that transforms operations so they can be applied in different orders while maintaining consistency. It requires a central server to determine the canonical order.

### Detailed Comparison

| Aspect | CRDT | OT |
|--------|------|-----|
| **Consistency Model** | Eventual consistency | Strong eventual consistency |
| **Server Requirement** | Optional (P2P possible) | Required for ordering |
| **Offline Support** | Excellent | Limited |
| **Memory Usage** | Higher (tombstones) | Lower |
| **Complexity** | Simpler algorithms | Complex transformation functions |
| **Undo/Redo** | More complex | Well-established |
| **Latency** | Lower (no server round-trip) | Higher (server coordination) |
| **Scalability** | Better (no central bottleneck) | Limited by server |
| **Industry Adoption** | Figma, Linear, Notion | Google Docs, Microsoft Office |

### Decision Matrix

```typescript
// When to use CRDT vs OT
const decisionMatrix = {
  useCRDT: [
    'Offline-first applications',
    'Peer-to-peer collaboration',
    'High latency tolerance',
    'Distributed systems without central server',
    'Simple data structures (text, lists)',
  ],
  useOT: [
    'Real-time collaboration with low latency requirements',
    'Complex document structures',
    'Strong consistency requirements',
    'Existing infrastructure with central server',
    'Need for sophisticated undo/redo',
  ],
  useHybrid: [
    'Best of both worlds needed',
    'Variable network conditions',
    'Mixed online/offline usage patterns',
  ],
};
```

---

## CRDT Implementation

### Yjs-Based Implementation

Yjs is a high-performance CRDT implementation that's widely used for collaborative editing.

```typescript
// src/collaboration/yjs/yjsDocument.ts

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

interface CollaborationConfig {
  documentId: string;
  serverUrl: string;
  userId: string;
  userName: string;
  userColor: string;
}

interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor: {
    anchor: number;
    head: number;
  } | null;
  selection: {
    ranges: Array<{ anchor: number; head: number }>;
  } | null;
}

class YjsCollaborationDocument {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private persistence: IndexeddbPersistence;
  private config: CollaborationConfig;
  
  constructor(config: CollaborationConfig) {
    this.config = config;
    this.doc = new Y.Doc();
    
    // Set up WebSocket provider for real-time sync
    this.provider = new WebsocketProvider(
      config.serverUrl,
      config.documentId,
      this.doc,
      {
        connect: true,
        awareness: this.doc.awareness,
        params: {
          userId: config.userId,
        },
      }
    );
    
    // Set up IndexedDB persistence for offline support
    this.persistence = new IndexeddbPersistence(
      config.documentId,
      this.doc
    );
    
    // Initialize awareness (presence) state
    this.initializeAwareness();
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  private initializeAwareness(): void {
    const awareness = this.provider.awareness;
    
    // Set local user state
    awareness.setLocalState({
      user: {
        id: this.config.userId,
        name: this.config.userName,
        color: this.config.userColor,
      },
      cursor: null,
      selection: null,
    } as AwarenessState);
  }
  
  private setupEventHandlers(): void {
    // Connection status
    this.provider.on('status', (event: { status: string }) => {
      console.log('[Yjs] Connection status:', event.status);
      this.emit('connectionStatus', event.status);
    });
    
    // Sync status
    this.provider.on('sync', (isSynced: boolean) => {
      console.log('[Yjs] Sync status:', isSynced);
      this.emit('syncStatus', isSynced);
    });
    
    // Awareness changes (presence updates)
    this.provider.awareness.on('change', (changes: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      this.handleAwarenessChange(changes);
    });
    
    // Document updates
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      this.emit('documentUpdate', { update, origin });
    });
  }
  
  private handleAwarenessChange(changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void {
    const states = this.provider.awareness.getStates();
    
    // Emit presence updates
    const users: AwarenessState[] = [];
    states.forEach((state, clientId) => {
      if (state && clientId !== this.doc.clientID) {
        users.push(state as AwarenessState);
      }
    });
    
    this.emit('presenceUpdate', {
      users,
      added: changes.added,
      removed: changes.removed,
    });
  }
  
  // Get the Y.Text for code editing
  getText(name: string = 'content'): Y.Text {
    return this.doc.getText(name);
  }
  
  // Get Y.Map for structured data
  getMap(name: string): Y.Map<any> {
    return this.doc.getMap(name);
  }
  
  // Get Y.Array for lists
  getArray(name: string): Y.Array<any> {
    return this.doc.getArray(name);
  }
  
  // Update cursor position
  updateCursor(anchor: number, head: number): void {
    this.provider.awareness.setLocalStateField('cursor', {
      anchor,
      head,
    });
  }
  
  // Update selection
  updateSelection(ranges: Array<{ anchor: number; head: number }>): void {
    this.provider.awareness.setLocalStateField('selection', {
      ranges,
    });
  }
  
  // Clear cursor (e.g., when editor loses focus)
  clearCursor(): void {
    this.provider.awareness.setLocalStateField('cursor', null);
  }
  
  // Get all connected users
  getConnectedUsers(): AwarenessState[] {
    const states = this.provider.awareness.getStates();
    const users: AwarenessState[] = [];
    
    states.forEach((state, clientId) => {
      if (state) {
        users.push(state as AwarenessState);
      }
    });
    
    return users;
  }
  
  // Check if document is synced
  isSynced(): boolean {
    return this.provider.synced;
  }
  
  // Check connection status
  isConnected(): boolean {
    return this.provider.wsconnected;
  }
  
  // Destroy and cleanup
  destroy(): void {
    this.provider.awareness.setLocalState(null);
    this.provider.disconnect();
    this.persistence.destroy();
    this.doc.destroy();
  }
  
  // Event emitter methods (simplified)
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}

export { YjsCollaborationDocument, CollaborationConfig, AwarenessState };
```

### CRDT Text Operations

```typescript
// src/collaboration/yjs/textOperations.ts

import * as Y from 'yjs';

interface TextChange {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
}

class CRDTTextOperations {
  private yText: Y.Text;
  private doc: Y.Doc;
  
  constructor(yText: Y.Text, doc: Y.Doc) {
    this.yText = yText;
    this.doc = doc;
  }
  
  // Insert text at position
  insert(position: number, content: string, attributes?: Record<string, any>): void {
    this.doc.transact(() => {
      this.yText.insert(position, content, attributes);
    });
  }
  
  // Delete text at position
  delete(position: number, length: number): void {
    this.doc.transact(() => {
      this.yText.delete(position, length);
    });
  }
  
  // Apply formatting to range
  format(position: number, length: number, attributes: Record<string, any>): void {
    this.doc.transact(() => {
      this.yText.format(position, length, attributes);
    });
  }
  
  // Apply a batch of changes atomically
  applyChanges(changes: TextChange[]): void {
    this.doc.transact(() => {
      // Sort changes by position (descending) to avoid position shifts
      const sortedChanges = [...changes].sort((a, b) => b.position - a.position);
      
      for (const change of sortedChanges) {
        switch (change.type) {
          case 'insert':
            if (change.content) {
              this.yText.insert(change.position, change.content, change.attributes);
            }
            break;
          case 'delete':
            if (change.length) {
              this.yText.delete(change.position, change.length);
            }
            break;
        }
      }
    });
  }
  
  // Get text content
  toString(): string {
    return this.yText.toString();
  }
  
  // Get length
  get length(): number {
    return this.yText.length;
  }
  
  // Observe changes
  observe(callback: (event: Y.YTextEvent) => void): void {
    this.yText.observe(callback);
  }
  
  // Convert editor delta to Yjs operations
  applyDelta(delta: Array<{ insert?: string; delete?: number; retain?: number; attributes?: any }>): void {
    this.doc.transact(() => {
      let position = 0;
      
      for (const op of delta) {
        if (op.retain !== undefined) {
          if (op.attributes) {
            this.yText.format(position, op.retain, op.attributes);
          }
          position += op.retain;
        } else if (op.insert !== undefined) {
          this.yText.insert(position, op.insert, op.attributes);
          position += op.insert.length;
        } else if (op.delete !== undefined) {
          this.yText.delete(position, op.delete);
        }
      }
    });
  }
}

export { CRDTTextOperations, TextChange };
```

### Yjs Server (Hocuspocus)

```typescript
// src/collaboration/server/hocuspocusServer.ts

import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Redis } from '@hocuspocus/extension-redis';
import { Logger } from '@hocuspocus/extension-logger';
import { Throttle } from '@hocuspocus/extension-throttle';

interface HocuspocusConfig {
  port: number;
  redisUrl: string;
  databaseUrl: string;
  maxConnections: number;
  debounce: number;
}

class CollaborationServer {
  private server: Hocuspocus;
  
  constructor(config: HocuspocusConfig) {
    this.server = new Hocuspocus({
      port: config.port,
      
      // Extensions
      extensions: [
        // Logging
        new Logger({
          log: (message) => console.log(`[Hocuspocus] ${message}`),
        }),
        
        // Redis for scaling across multiple server instances
        new Redis({
          host: new URL(config.redisUrl).hostname,
          port: parseInt(new URL(config.redisUrl).port || '6379'),
        }),
        
        // Database persistence
        new Database({
          fetch: async ({ documentName }) => {
            return await this.fetchDocument(documentName);
          },
          store: async ({ documentName, state }) => {
            await this.storeDocument(documentName, state);
          },
        }),
        
        // Rate limiting
        new Throttle({
          throttle: 15,        // Max 15 updates per interval
          banTime: 5,          // Ban for 5 seconds if exceeded
        }),
      ],
      
      // Debounce database writes
      debounce: config.debounce,
      
      // Maximum connections per document
      maxConnections: config.maxConnections,
      
      // Authentication
      async onAuthenticate(data) {
        const { token, documentName } = data;
        
        // Verify token and check document access
        const user = await verifyToken(token);
        if (!user) {
          throw new Error('Unauthorized');
        }
        
        const hasAccess = await checkDocumentAccess(user.id, documentName);
        if (!hasAccess) {
          throw new Error('Access denied');
        }
        
        return {
          user: {
            id: user.id,
            name: user.name,
            color: user.color || generateUserColor(user.id),
          },
        };
      },
      
      // Connection handling
      async onConnect(data) {
        console.log(`[Hocuspocus] User connected: ${data.context.user?.name}`);
        
        // Track active connections
        await trackConnection(data.documentName, data.context.user?.id);
      },
      
      async onDisconnect(data) {
        console.log(`[Hocuspocus] User disconnected: ${data.context.user?.name}`);
        
        // Remove from active connections
        await removeConnection(data.documentName, data.context.user?.id);
      },
      
      // Document lifecycle
      async onLoadDocument(data) {
        console.log(`[Hocuspocus] Loading document: ${data.documentName}`);
        
        // Initialize document structure if needed
        if (data.document.isEmpty) {
          const yText = data.document.getText('content');
          // Could load initial content here
        }
      },
      
      async onStoreDocument(data) {
        console.log(`[Hocuspocus] Storing document: ${data.documentName}`);
        
        // Additional storage logic (e.g., create version snapshot)
        await createVersionSnapshot(data.documentName, data.state);
      },
      
      // Change handling
      async onChange(data) {
        // Called on every change
        // Useful for analytics or real-time processing
      },
    });
  }
  
  private async fetchDocument(documentName: string): Promise<Uint8Array | null> {
    // Fetch from database
    const doc = await db.query(
      'SELECT state FROM documents WHERE name = ?',
      [documentName]
    );
    
    return doc?.state || null;
  }
  
  private async storeDocument(documentName: string, state: Uint8Array): Promise<void> {
    await db.query(
      `INSERT INTO documents (name, state, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE state = ?, updated_at = NOW()`,
      [documentName, state, state]
    );
  }
  
  start(): void {
    this.server.listen();
    console.log(`[Hocuspocus] Server listening on port ${this.server.configuration.port}`);
  }
  
  stop(): Promise<void> {
    return this.server.destroy();
  }
  
  // Get statistics
  getStats(): {
    connections: number;
    documents: number;
    messagesSent: number;
  } {
    return {
      connections: this.server.getConnectionsCount(),
      documents: this.server.getDocumentsCount(),
      messagesSent: 0, // Would need custom tracking
    };
  }
}

// Helper functions
async function verifyToken(token: string): Promise<{ id: string; name: string; color?: string } | null> {
  // Implement token verification
  return null;
}

async function checkDocumentAccess(userId: string, documentName: string): Promise<boolean> {
  // Implement access control
  return true;
}

function generateUserColor(userId: string): string {
  // Generate consistent color from user ID
  const hash = userId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

async function trackConnection(documentName: string, userId?: string): Promise<void> {
  // Track in Redis
}

async function removeConnection(documentName: string, userId?: string): Promise<void> {
  // Remove from Redis
}

async function createVersionSnapshot(documentName: string, state: Uint8Array): Promise<void> {
  // Create version history entry
}

export { CollaborationServer, HocuspocusConfig };
```

---

## Operational Transformation

### OT Implementation

```typescript
// src/collaboration/ot/otDocument.ts

interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  clientId: string;
  revision: number;
  timestamp: number;
}

interface TransformResult {
  op1Prime: Operation;
  op2Prime: Operation;
}

class OTDocument {
  private content: string = '';
  private revision: number = 0;
  private pendingOps: Operation[] = [];
  private sentOps: Operation[] = [];
  private clientId: string;
  
  constructor(clientId: string, initialContent: string = '') {
    this.clientId = clientId;
    this.content = initialContent;
  }
  
  // Apply local operation
  applyLocal(op: Omit<Operation, 'clientId' | 'revision' | 'timestamp'>): Operation {
    const fullOp: Operation = {
      ...op,
      clientId: this.clientId,
      revision: this.revision,
      timestamp: Date.now(),
    };
    
    // Apply to local content
    this.applyOperation(fullOp);
    
    // Add to pending (waiting to be acknowledged by server)
    this.pendingOps.push(fullOp);
    
    return fullOp;
  }
  
  // Receive operation from server
  receiveOperation(op: Operation): void {
    if (op.clientId === this.clientId) {
      // This is our own operation being acknowledged
      this.acknowledgeOperation(op);
    } else {
      // Transform against pending operations
      let transformedOp = op;
      
      for (const pendingOp of this.pendingOps) {
        const result = this.transform(transformedOp, pendingOp);
        transformedOp = result.op1Prime;
      }
      
      // Apply transformed operation
      this.applyOperation(transformedOp);
      this.revision = Math.max(this.revision, op.revision + 1);
    }
  }
  
  private acknowledgeOperation(op: Operation): void {
    // Remove from pending
    const index = this.pendingOps.findIndex(
      p => p.timestamp === op.timestamp && p.clientId === op.clientId
    );
    
    if (index !== -1) {
      this.pendingOps.splice(index, 1);
    }
    
    this.revision = op.revision + 1;
  }
  
  private applyOperation(op: Operation): void {
    switch (op.type) {
      case 'insert':
        if (op.content) {
          this.content = 
            this.content.slice(0, op.position) + 
            op.content + 
            this.content.slice(op.position);
        }
        break;
      case 'delete':
        if (op.length) {
          this.content = 
            this.content.slice(0, op.position) + 
            this.content.slice(op.position + op.length);
        }
        break;
    }
  }
  
  // Transform two concurrent operations
  private transform(op1: Operation, op2: Operation): TransformResult {
    // Both insert
    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInsertInsert(op1, op2);
    }
    
    // Both delete
    if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeleteDelete(op1, op2);
    }
    
    // Insert vs Delete
    if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(op1, op2);
    }
    
    if (op1.type === 'delete' && op2.type === 'insert') {
      const result = this.transformInsertDelete(op2, op1);
      return { op1Prime: result.op2Prime, op2Prime: result.op1Prime };
    }
    
    // No transformation needed
    return { op1Prime: op1, op2Prime: op2 };
  }
  
  private transformInsertInsert(op1: Operation, op2: Operation): TransformResult {
    const op1Prime = { ...op1 };
    const op2Prime = { ...op2 };
    
    if (op1.position < op2.position) {
      // op1 is before op2, adjust op2's position
      op2Prime.position += op1.content?.length || 0;
    } else if (op1.position > op2.position) {
      // op2 is before op1, adjust op1's position
      op1Prime.position += op2.content?.length || 0;
    } else {
      // Same position - use client ID for deterministic ordering
      if (op1.clientId < op2.clientId) {
        op2Prime.position += op1.content?.length || 0;
      } else {
        op1Prime.position += op2.content?.length || 0;
      }
    }
    
    return { op1Prime, op2Prime };
  }
  
  private transformDeleteDelete(op1: Operation, op2: Operation): TransformResult {
    const op1Prime = { ...op1 };
    const op2Prime = { ...op2 };
    
    const op1End = op1.position + (op1.length || 0);
    const op2End = op2.position + (op2.length || 0);
    
    if (op1End <= op2.position) {
      // op1 is entirely before op2
      op2Prime.position -= op1.length || 0;
    } else if (op2End <= op1.position) {
      // op2 is entirely before op1
      op1Prime.position -= op2.length || 0;
    } else {
      // Overlapping deletes
      if (op1.position <= op2.position) {
        if (op1End >= op2End) {
          // op1 contains op2
          op1Prime.length = (op1.length || 0) - (op2.length || 0);
          op2Prime.length = 0;
        } else {
          // Partial overlap
          const overlap = op1End - op2.position;
          op1Prime.length = (op1.length || 0) - overlap;
          op2Prime.position = op1.position;
          op2Prime.length = (op2.length || 0) - overlap;
        }
      } else {
        if (op2End >= op1End) {
          // op2 contains op1
          op2Prime.length = (op2.length || 0) - (op1.length || 0);
          op1Prime.length = 0;
        } else {
          // Partial overlap
          const overlap = op2End - op1.position;
          op2Prime.length = (op2.length || 0) - overlap;
          op1Prime.position = op2.position;
          op1Prime.length = (op1.length || 0) - overlap;
        }
      }
    }
    
    return { op1Prime, op2Prime };
  }
  
  private transformInsertDelete(insertOp: Operation, deleteOp: Operation): TransformResult {
    const insertPrime = { ...insertOp };
    const deletePrime = { ...deleteOp };
    
    const deleteEnd = deleteOp.position + (deleteOp.length || 0);
    
    if (insertOp.position <= deleteOp.position) {
      // Insert is before delete
      deletePrime.position += insertOp.content?.length || 0;
    } else if (insertOp.position >= deleteEnd) {
      // Insert is after delete
      insertPrime.position -= deleteOp.length || 0;
    } else {
      // Insert is within delete range
      // Move insert to delete position
      insertPrime.position = deleteOp.position;
      // Split delete around insert
      deletePrime.length = insertOp.position - deleteOp.position;
      // Note: Would need second delete operation for the rest
    }
    
    return { op1Prime: insertPrime, op2Prime: deletePrime };
  }
  
  getContent(): string {
    return this.content;
  }
  
  getRevision(): number {
    return this.revision;
  }
  
  hasPendingOperations(): boolean {
    return this.pendingOps.length > 0;
  }
}

export { OTDocument, Operation, TransformResult };
```

### OT Server

```typescript
// src/collaboration/ot/otServer.ts

import { WebSocket } from 'ws';

interface ClientState {
  ws: WebSocket;
  userId: string;
  userName: string;
  lastRevision: number;
  cursor?: { line: number; column: number };
}

interface DocumentState {
  content: string;
  revision: number;
  operations: Operation[];
  clients: Map<string, ClientState>;
}

class OTServer {
  private documents: Map<string, DocumentState> = new Map();
  
  handleConnection(ws: WebSocket, documentId: string, userId: string, userName: string): void {
    // Get or create document
    let doc = this.documents.get(documentId);
    if (!doc) {
      doc = {
        content: '',
        revision: 0,
        operations: [],
        clients: new Map(),
      };
      this.documents.set(documentId, doc);
    }
    
    // Add client
    const clientState: ClientState = {
      ws,
      userId,
      userName,
      lastRevision: doc.revision,
    };
    doc.clients.set(userId, clientState);
    
    // Send initial state
    ws.send(JSON.stringify({
      type: 'init',
      content: doc.content,
      revision: doc.revision,
      users: this.getDocumentUsers(documentId),
    }));
    
    // Broadcast user joined
    this.broadcastToDocument(documentId, {
      type: 'user_joined',
      user: { id: userId, name: userName },
    }, userId);
    
    // Handle messages
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(documentId, userId, message);
    });
    
    // Handle disconnect
    ws.on('close', () => {
      this.handleDisconnect(documentId, userId);
    });
  }
  
  private handleMessage(documentId: string, userId: string, message: any): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;
    
    switch (message.type) {
      case 'operation':
        this.handleOperation(documentId, userId, message.operation);
        break;
      case 'cursor':
        this.handleCursor(documentId, userId, message.cursor);
        break;
      case 'selection':
        this.handleSelection(documentId, userId, message.selection);
        break;
    }
  }
  
  private handleOperation(documentId: string, userId: string, op: Operation): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;
    
    const client = doc.clients.get(userId);
    if (!client) return;
    
    // Transform operation against any operations the client hasn't seen
    let transformedOp = op;
    for (let i = op.revision; i < doc.revision; i++) {
      const serverOp = doc.operations[i];
      if (serverOp && serverOp.clientId !== userId) {
        transformedOp = this.transform(transformedOp, serverOp).op1Prime;
      }
    }
    
    // Apply operation
    transformedOp.revision = doc.revision;
    this.applyOperation(doc, transformedOp);
    
    // Store operation
    doc.operations.push(transformedOp);
    doc.revision++;
    
    // Acknowledge to sender
    client.ws.send(JSON.stringify({
      type: 'ack',
      revision: doc.revision,
      operation: transformedOp,
    }));
    
    // Broadcast to other clients
    this.broadcastToDocument(documentId, {
      type: 'operation',
      operation: transformedOp,
    }, userId);
  }
  
  private handleCursor(documentId: string, userId: string, cursor: { line: number; column: number }): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;
    
    const client = doc.clients.get(userId);
    if (client) {
      client.cursor = cursor;
    }
    
    // Broadcast cursor position
    this.broadcastToDocument(documentId, {
      type: 'cursor',
      userId,
      cursor,
    }, userId);
  }
  
  private handleSelection(documentId: string, userId: string, selection: any): void {
    // Broadcast selection
    this.broadcastToDocument(documentId, {
      type: 'selection',
      userId,
      selection,
    }, userId);
  }
  
  private handleDisconnect(documentId: string, userId: string): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;
    
    doc.clients.delete(userId);
    
    // Broadcast user left
    this.broadcastToDocument(documentId, {
      type: 'user_left',
      userId,
    });
    
    // Clean up empty documents
    if (doc.clients.size === 0) {
      // Optionally persist and remove from memory
      this.persistDocument(documentId, doc);
    }
  }
  
  private applyOperation(doc: DocumentState, op: Operation): void {
    switch (op.type) {
      case 'insert':
        if (op.content) {
          doc.content = 
            doc.content.slice(0, op.position) + 
            op.content + 
            doc.content.slice(op.position);
        }
        break;
      case 'delete':
        if (op.length) {
          doc.content = 
            doc.content.slice(0, op.position) + 
            doc.content.slice(op.position + op.length);
        }
        break;
    }
  }
  
  private transform(op1: Operation, op2: Operation): { op1Prime: Operation; op2Prime: Operation } {
    // Same transformation logic as client
    // ... (implementation same as OTDocument.transform)
    return { op1Prime: op1, op2Prime: op2 };
  }
  
  private broadcastToDocument(documentId: string, message: any, excludeUserId?: string): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;
    
    const data = JSON.stringify(message);
    
    doc.clients.forEach((client, id) => {
      if (id !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }
  
  private getDocumentUsers(documentId: string): Array<{ id: string; name: string }> {
    const doc = this.documents.get(documentId);
    if (!doc) return [];
    
    return Array.from(doc.clients.values()).map(c => ({
      id: c.userId,
      name: c.userName,
    }));
  }
  
  private async persistDocument(documentId: string, doc: DocumentState): Promise<void> {
    // Save to database
  }
}

export { OTServer, ClientState, DocumentState };
```

---

## Presence System

### Presence Manager

```typescript
// src/collaboration/presence/presenceManager.ts

interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  status: 'online' | 'idle' | 'away';
  lastActive: Date;
  currentFile?: string;
  cursor?: CursorPosition;
  selection?: SelectionRange[];
}

interface CursorPosition {
  line: number;
  column: number;
  offset: number;
}

interface SelectionRange {
  anchor: { line: number; column: number; offset: number };
  head: { line: number; column: number; offset: number };
}

interface PresenceUpdate {
  type: 'join' | 'leave' | 'update';
  user: UserPresence;
  timestamp: Date;
}

class PresenceManager {
  private presence: Map<string, UserPresence> = new Map();
  private listeners: Set<(update: PresenceUpdate) => void> = new Set();
  private idleTimeout: number = 60000; // 1 minute
  private awayTimeout: number = 300000; // 5 minutes
  private idleTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Add or update user presence
  setPresence(userId: string, data: Partial<UserPresence>): void {
    const existing = this.presence.get(userId);
    
    const presence: UserPresence = {
      userId,
      userName: data.userName || existing?.userName || 'Unknown',
      userColor: data.userColor || existing?.userColor || this.generateColor(userId),
      status: 'online',
      lastActive: new Date(),
      ...data,
    };
    
    this.presence.set(userId, presence);
    
    // Reset idle timer
    this.resetIdleTimer(userId);
    
    // Notify listeners
    this.notifyListeners({
      type: existing ? 'update' : 'join',
      user: presence,
      timestamp: new Date(),
    });
  }
  
  // Remove user presence
  removePresence(userId: string): void {
    const presence = this.presence.get(userId);
    if (!presence) return;
    
    this.presence.delete(userId);
    this.clearIdleTimer(userId);
    
    this.notifyListeners({
      type: 'leave',
      user: presence,
      timestamp: new Date(),
    });
  }
  
  // Update cursor position
  updateCursor(userId: string, cursor: CursorPosition): void {
    const presence = this.presence.get(userId);
    if (!presence) return;
    
    presence.cursor = cursor;
    presence.lastActive = new Date();
    presence.status = 'online';
    
    this.resetIdleTimer(userId);
    
    this.notifyListeners({
      type: 'update',
      user: presence,
      timestamp: new Date(),
    });
  }
  
  // Update selection
  updateSelection(userId: string, selection: SelectionRange[]): void {
    const presence = this.presence.get(userId);
    if (!presence) return;
    
    presence.selection = selection;
    presence.lastActive = new Date();
    presence.status = 'online';
    
    this.resetIdleTimer(userId);
    
    this.notifyListeners({
      type: 'update',
      user: presence,
      timestamp: new Date(),
    });
  }
  
  // Update current file
  updateCurrentFile(userId: string, filePath: string): void {
    const presence = this.presence.get(userId);
    if (!presence) return;
    
    presence.currentFile = filePath;
    presence.lastActive = new Date();
    
    this.notifyListeners({
      type: 'update',
      user: presence,
      timestamp: new Date(),
    });
  }
  
  // Get all present users
  getAllPresence(): UserPresence[] {
    return Array.from(this.presence.values());
  }
  
  // Get users in a specific file
  getUsersInFile(filePath: string): UserPresence[] {
    return Array.from(this.presence.values())
      .filter(p => p.currentFile === filePath);
  }
  
  // Subscribe to presence updates
  subscribe(callback: (update: PresenceUpdate) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private resetIdleTimer(userId: string): void {
    this.clearIdleTimer(userId);
    
    const timer = setTimeout(() => {
      this.setUserIdle(userId);
    }, this.idleTimeout);
    
    this.idleTimers.set(userId, timer);
  }
  
  private clearIdleTimer(userId: string): void {
    const timer = this.idleTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(userId);
    }
  }
  
  private setUserIdle(userId: string): void {
    const presence = this.presence.get(userId);
    if (!presence) return;
    
    presence.status = 'idle';
    
    this.notifyListeners({
      type: 'update',
      user: presence,
      timestamp: new Date(),
    });
    
    // Set away timer
    const timer = setTimeout(() => {
      this.setUserAway(userId);
    }, this.awayTimeout - this.idleTimeout);
    
    this.idleTimers.set(userId, timer);
  }
  
  private setUserAway(userId: string): void {
    const presence = this.presence.get(userId);
    if (!presence) return;
    
    presence.status = 'away';
    
    this.notifyListeners({
      type: 'update',
      user: presence,
      timestamp: new Date(),
    });
  }
  
  private notifyListeners(update: PresenceUpdate): void {
    this.listeners.forEach(callback => callback(update));
  }
  
  private generateColor(userId: string): string {
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  }
}

export { PresenceManager, UserPresence, CursorPosition, SelectionRange, PresenceUpdate };
```

### Presence UI Component

```typescript
// src/components/PresenceIndicator.tsx

import React from 'react';

interface PresenceIndicatorProps {
  users: UserPresence[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  users,
  maxVisible = 5,
  size = 'md',
}) => {
  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };
  
  const statusColors = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    away: 'bg-gray-400',
  };
  
  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user, index) => (
        <div
          key={user.userId}
          className={`
            relative rounded-full border-2 border-white
            flex items-center justify-center
            ${sizeClasses[size]}
          `}
          style={{
            backgroundColor: user.userColor,
            zIndex: visibleUsers.length - index,
          }}
          title={`${user.userName} (${user.status})`}
        >
          {/* User initial */}
          <span className="text-white font-medium">
            {user.userName.charAt(0).toUpperCase()}
          </span>
          
          {/* Status indicator */}
          <span
            className={`
              absolute bottom-0 right-0
              w-2 h-2 rounded-full border border-white
              ${statusColors[user.status]}
            `}
          />
        </div>
      ))}
      
      {overflowCount > 0 && (
        <div
          className={`
            rounded-full border-2 border-white bg-gray-200
            flex items-center justify-center text-gray-600
            ${sizeClasses[size]}
          `}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
};

// Presence list with details
const PresenceList: React.FC<{ users: UserPresence[] }> = ({ users }) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-500">
        {users.length} user{users.length !== 1 ? 's' : ''} online
      </h3>
      
      <ul className="space-y-1">
        {users.map(user => (
          <li
            key={user.userId}
            className="flex items-center gap-2 p-2 rounded hover:bg-gray-100"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: user.userColor }}
            >
              {user.userName.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.userName}
              </p>
              {user.currentFile && (
                <p className="text-xs text-gray-500 truncate">
                  {user.currentFile}
                </p>
              )}
            </div>
            
            <span
              className={`
                w-2 h-2 rounded-full
                ${user.status === 'online' ? 'bg-green-500' : ''}
                ${user.status === 'idle' ? 'bg-yellow-500' : ''}
                ${user.status === 'away' ? 'bg-gray-400' : ''}
              `}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export { PresenceIndicator, PresenceList };
```

---

## Cursor Sharing

### Remote Cursor Renderer

```typescript
// src/collaboration/cursors/remoteCursors.ts

interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  position: {
    line: number;
    column: number;
  };
  selection?: {
    anchor: { line: number; column: number };
    head: { line: number; column: number };
  };
  lastUpdate: number;
}

class RemoteCursorManager {
  private cursors: Map<string, RemoteCursor> = new Map();
  private container: HTMLElement;
  private editor: any; // Monaco, CodeMirror, etc.
  private decorations: Map<string, string[]> = new Map();
  
  constructor(container: HTMLElement, editor: any) {
    this.container = container;
    this.editor = editor;
  }
  
  // Update remote cursor position
  updateCursor(
    userId: string,
    userName: string,
    color: string,
    position: { line: number; column: number },
    selection?: { anchor: { line: number; column: number }; head: { line: number; column: number } }
  ): void {
    const cursor: RemoteCursor = {
      userId,
      userName,
      color,
      position,
      selection,
      lastUpdate: Date.now(),
    };
    
    this.cursors.set(userId, cursor);
    this.renderCursor(cursor);
  }
  
  // Remove cursor
  removeCursor(userId: string): void {
    this.cursors.delete(userId);
    this.clearCursorDecorations(userId);
  }
  
  // Render cursor in editor (Monaco example)
  private renderCursor(cursor: RemoteCursor): void {
    // Clear existing decorations
    this.clearCursorDecorations(cursor.userId);
    
    const decorations: any[] = [];
    
    // Cursor line decoration
    decorations.push({
      range: {
        startLineNumber: cursor.position.line,
        startColumn: cursor.position.column,
        endLineNumber: cursor.position.line,
        endColumn: cursor.position.column + 1,
      },
      options: {
        className: `remote-cursor-${cursor.userId}`,
        beforeContentClassName: `remote-cursor-line-${cursor.userId}`,
        stickiness: 1,
      },
    });
    
    // Selection decoration
    if (cursor.selection) {
      const { anchor, head } = cursor.selection;
      const startLine = Math.min(anchor.line, head.line);
      const endLine = Math.max(anchor.line, head.line);
      const startColumn = startLine === anchor.line ? anchor.column : head.column;
      const endColumn = endLine === anchor.line ? anchor.column : head.column;
      
      decorations.push({
        range: {
          startLineNumber: startLine,
          startColumn: startColumn,
          endLineNumber: endLine,
          endColumn: endColumn,
        },
        options: {
          className: `remote-selection-${cursor.userId}`,
          stickiness: 1,
        },
      });
    }
    
    // Apply decorations
    const ids = this.editor.deltaDecorations([], decorations);
    this.decorations.set(cursor.userId, ids);
    
    // Inject dynamic CSS
    this.injectCursorStyles(cursor);
    
    // Render cursor widget (name label)
    this.renderCursorWidget(cursor);
  }
  
  private clearCursorDecorations(userId: string): void {
    const ids = this.decorations.get(userId);
    if (ids) {
      this.editor.deltaDecorations(ids, []);
      this.decorations.delete(userId);
    }
    
    // Remove cursor widget
    const widget = document.getElementById(`cursor-widget-${userId}`);
    if (widget) {
      widget.remove();
    }
  }
  
  private injectCursorStyles(cursor: RemoteCursor): void {
    const styleId = `cursor-style-${cursor.userId}`;
    let styleEl = document.getElementById(styleId);
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    styleEl.textContent = `
      .remote-cursor-${cursor.userId} {
        background-color: transparent;
      }
      
      .remote-cursor-line-${cursor.userId}::before {
        content: '';
        position: absolute;
        width: 2px;
        height: 18px;
        background-color: ${cursor.color};
        animation: cursor-blink 1s infinite;
      }
      
      .remote-selection-${cursor.userId} {
        background-color: ${cursor.color}33;
      }
      
      @keyframes cursor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.5; }
      }
    `;
  }
  
  private renderCursorWidget(cursor: RemoteCursor): void {
    // Remove existing widget
    const existingWidget = document.getElementById(`cursor-widget-${cursor.userId}`);
    if (existingWidget) {
      existingWidget.remove();
    }
    
    // Create widget
    const widget = document.createElement('div');
    widget.id = `cursor-widget-${cursor.userId}`;
    widget.className = 'remote-cursor-widget';
    widget.style.cssText = `
      position: absolute;
      background-color: ${cursor.color};
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      transform: translateY(-100%);
    `;
    widget.textContent = cursor.userName;
    
    // Position widget
    const coords = this.editor.getScrolledVisiblePosition({
      lineNumber: cursor.position.line,
      column: cursor.position.column,
    });
    
    if (coords) {
      widget.style.left = `${coords.left}px`;
      widget.style.top = `${coords.top}px`;
    }
    
    this.container.appendChild(widget);
    
    // Auto-hide after 3 seconds of inactivity
    setTimeout(() => {
      widget.style.opacity = '0';
      widget.style.transition = 'opacity 0.3s';
    }, 3000);
  }
  
  // Update all cursor positions (e.g., after scroll)
  updateAllPositions(): void {
    this.cursors.forEach(cursor => {
      const widget = document.getElementById(`cursor-widget-${cursor.userId}`);
      if (widget) {
        const coords = this.editor.getScrolledVisiblePosition({
          lineNumber: cursor.position.line,
          column: cursor.position.column,
        });
        
        if (coords) {
          widget.style.left = `${coords.left}px`;
          widget.style.top = `${coords.top}px`;
        }
      }
    });
  }
  
  // Clean up stale cursors
  cleanupStaleCursors(maxAge: number = 30000): void {
    const now = Date.now();
    
    this.cursors.forEach((cursor, userId) => {
      if (now - cursor.lastUpdate > maxAge) {
        this.removeCursor(userId);
      }
    });
  }
  
  // Destroy all cursors
  destroy(): void {
    this.cursors.forEach((_, userId) => {
      this.removeCursor(userId);
    });
    
    // Remove injected styles
    document.querySelectorAll('[id^="cursor-style-"]').forEach(el => el.remove());
  }
}

export { RemoteCursorManager, RemoteCursor };
```

### CodeMirror 6 Cursor Extension

```typescript
// src/collaboration/cursors/codemirrorCursors.ts

import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

interface CursorState {
  id: string;
  name: string;
  color: string;
  from: number;
  to: number;
}

// State effect for updating cursors
const setCursors = StateEffect.define<CursorState[]>();

// State field to track remote cursors
const remoteCursorsField = StateField.define<CursorState[]>({
  create() {
    return [];
  },
  update(cursors, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCursors)) {
        return effect.value;
      }
    }
    
    // Map positions through document changes
    if (tr.docChanged) {
      return cursors.map(cursor => ({
        ...cursor,
        from: tr.changes.mapPos(cursor.from),
        to: tr.changes.mapPos(cursor.to),
      }));
    }
    
    return cursors;
  },
});

// Create cursor decorations
function createCursorDecorations(cursors: CursorState[]): DecorationSet {
  const decorations: any[] = [];
  
  for (const cursor of cursors) {
    // Cursor line
    decorations.push({
      from: cursor.from,
      to: cursor.from,
      value: Decoration.widget({
        widget: new CursorWidget(cursor),
        side: 1,
      }),
    });
    
    // Selection highlight
    if (cursor.from !== cursor.to) {
      decorations.push({
        from: Math.min(cursor.from, cursor.to),
        to: Math.max(cursor.from, cursor.to),
        value: Decoration.mark({
          class: 'cm-remote-selection',
          attributes: {
            style: `background-color: ${cursor.color}33`,
          },
        }),
      });
    }
  }
  
  return Decoration.set(decorations.sort((a, b) => a.from - b.from));
}

// Cursor widget class
class CursorWidget {
  private cursor: CursorState;
  
  constructor(cursor: CursorState) {
    this.cursor = cursor;
  }
  
  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-remote-cursor';
    wrapper.style.cssText = `
      position: relative;
      display: inline-block;
      width: 0;
      height: 1.2em;
    `;
    
    // Cursor line
    const line = document.createElement('span');
    line.style.cssText = `
      position: absolute;
      width: 2px;
      height: 100%;
      background-color: ${this.cursor.color};
      animation: cursor-blink 1s infinite;
    `;
    wrapper.appendChild(line);
    
    // Name label
    const label = document.createElement('span');
    label.className = 'cm-remote-cursor-label';
    label.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 0;
      background-color: ${this.cursor.color};
      color: white;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 10px;
      white-space: nowrap;
      pointer-events: none;
    `;
    label.textContent = this.cursor.name;
    wrapper.appendChild(label);
    
    return wrapper;
  }
  
  eq(other: CursorWidget): boolean {
    return (
      this.cursor.id === other.cursor.id &&
      this.cursor.from === other.cursor.from &&
      this.cursor.to === other.cursor.to
    );
  }
}

// View plugin for cursor rendering
const remoteCursorsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      this.decorations = createCursorDecorations(
        view.state.field(remoteCursorsField)
      );
    }
    
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.state.field(remoteCursorsField) !== update.startState.field(remoteCursorsField)
      ) {
        this.decorations = createCursorDecorations(
          update.state.field(remoteCursorsField)
        );
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
);

// Extension bundle
function remoteCursors() {
  return [remoteCursorsField, remoteCursorsPlugin];
}

// Helper to update cursors
function updateRemoteCursors(view: EditorView, cursors: CursorState[]): void {
  view.dispatch({
    effects: setCursors.of(cursors),
  });
}

export { remoteCursors, updateRemoteCursors, CursorState };
```

---

## Selection Synchronization

### Selection Sync Manager

```typescript
// src/collaboration/selection/selectionSync.ts

interface SelectionState {
  userId: string;
  ranges: Array<{
    anchor: number;
    head: number;
  }>;
  timestamp: number;
}

class SelectionSyncManager {
  private selections: Map<string, SelectionState> = new Map();
  private localUserId: string;
  private onSelectionChange: (selections: SelectionState[]) => void;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number = 50;
  
  constructor(
    localUserId: string,
    onSelectionChange: (selections: SelectionState[]) => void
  ) {
    this.localUserId = localUserId;
    this.onSelectionChange = onSelectionChange;
  }
  
  // Update local selection (debounced)
  updateLocalSelection(ranges: Array<{ anchor: number; head: number }>): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      const selection: SelectionState = {
        userId: this.localUserId,
        ranges,
        timestamp: Date.now(),
      };
      
      this.selections.set(this.localUserId, selection);
      this.broadcastSelection(selection);
    }, this.debounceMs);
  }
  
  // Receive remote selection
  receiveRemoteSelection(selection: SelectionState): void {
    if (selection.userId === this.localUserId) return;
    
    this.selections.set(selection.userId, selection);
    this.notifySelectionChange();
  }
  
  // Remove user selection
  removeSelection(userId: string): void {
    this.selections.delete(userId);
    this.notifySelectionChange();
  }
  
  // Get all remote selections
  getRemoteSelections(): SelectionState[] {
    return Array.from(this.selections.values())
      .filter(s => s.userId !== this.localUserId);
  }
  
  private broadcastSelection(selection: SelectionState): void {
    // Implement WebSocket broadcast
    // websocket.send({ type: 'selection', data: selection });
  }
  
  private notifySelectionChange(): void {
    this.onSelectionChange(this.getRemoteSelections());
  }
}

export { SelectionSyncManager, SelectionState };
```

---

## Awareness Protocol

### Yjs Awareness Extension

```typescript
// src/collaboration/awareness/awarenessProtocol.ts

import { Awareness } from 'y-protocols/awareness';

interface AwarenessUserState {
  user: {
    id: string;
    name: string;
    color: string;
    avatar?: string;
  };
  cursor?: {
    anchor: number;
    head: number;
    file?: string;
  };
  selection?: Array<{
    anchor: number;
    head: number;
  }>;
  viewport?: {
    startLine: number;
    endLine: number;
  };
  activity?: {
    type: 'typing' | 'idle' | 'viewing';
    file?: string;
    lastActive: number;
  };
}

class AwarenessManager {
  private awareness: Awareness;
  private localClientId: number;
  private stateUpdateCallbacks: Set<(states: Map<number, AwarenessUserState>) => void> = new Set();
  
  constructor(awareness: Awareness) {
    this.awareness = awareness;
    this.localClientId = awareness.clientID;
    
    // Listen for awareness changes
    awareness.on('change', this.handleAwarenessChange.bind(this));
  }
  
  // Set local user info
  setUser(user: AwarenessUserState['user']): void {
    this.awareness.setLocalStateField('user', user);
  }
  
  // Update cursor position
  setCursor(cursor: AwarenessUserState['cursor']): void {
    this.awareness.setLocalStateField('cursor', cursor);
    this.setActivity('typing');
  }
  
  // Clear cursor
  clearCursor(): void {
    this.awareness.setLocalStateField('cursor', null);
  }
  
  // Update selection
  setSelection(selection: AwarenessUserState['selection']): void {
    this.awareness.setLocalStateField('selection', selection);
  }
  
  // Update viewport
  setViewport(viewport: AwarenessUserState['viewport']): void {
    this.awareness.setLocalStateField('viewport', viewport);
  }
  
  // Update activity
  setActivity(type: 'typing' | 'idle' | 'viewing', file?: string): void {
    this.awareness.setLocalStateField('activity', {
      type,
      file,
      lastActive: Date.now(),
    });
  }
  
  // Get all states
  getStates(): Map<number, AwarenessUserState> {
    return this.awareness.getStates() as Map<number, AwarenessUserState>;
  }
  
  // Get remote states (excluding local)
  getRemoteStates(): AwarenessUserState[] {
    const states: AwarenessUserState[] = [];
    
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId !== this.localClientId && state) {
        states.push(state as AwarenessUserState);
      }
    });
    
    return states;
  }
  
  // Subscribe to state changes
  onStateChange(callback: (states: Map<number, AwarenessUserState>) => void): () => void {
    this.stateUpdateCallbacks.add(callback);
    return () => this.stateUpdateCallbacks.delete(callback);
  }
  
  private handleAwarenessChange(changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void {
    const states = this.getStates();
    this.stateUpdateCallbacks.forEach(cb => cb(states));
  }
  
  // Clean up
  destroy(): void {
    this.awareness.setLocalState(null);
    this.stateUpdateCallbacks.clear();
  }
}

export { AwarenessManager, AwarenessUserState };
```

---

## WebSocket Infrastructure

### Scalable WebSocket Server

```typescript
// src/collaboration/websocket/scalableWsServer.ts

import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

interface WsMessage {
  type: string;
  room: string;
  data: any;
  sender?: string;
}

interface RoomState {
  clients: Map<string, WebSocket>;
  document?: any;
}

class ScalableWebSocketServer {
  private wss: WebSocketServer;
  private rooms: Map<string, RoomState> = new Map();
  private pubClient: ReturnType<typeof createClient>;
  private subClient: ReturnType<typeof createClient>;
  private serverId: string;
  
  constructor(port: number, redisUrl: string) {
    this.serverId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ port });
    
    // Initialize Redis clients for pub/sub
    this.pubClient = createClient({ url: redisUrl });
    this.subClient = this.pubClient.duplicate();
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    await this.pubClient.connect();
    await this.subClient.connect();
    
    // Subscribe to Redis channel for cross-server communication
    await this.subClient.subscribe('collaboration', (message) => {
      this.handleRedisMessage(JSON.parse(message));
    });
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    console.log(`[WS] Server ${this.serverId} initialized`);
  }
  
  private handleConnection(ws: WebSocket, req: any): void {
    const url = new URL(req.url, 'ws://localhost');
    const room = url.searchParams.get('room');
    const userId = url.searchParams.get('userId');
    
    if (!room || !userId) {
      ws.close(4000, 'Missing room or userId');
      return;
    }
    
    // Join room
    this.joinRoom(room, userId, ws);
    
    // Handle messages
    ws.on('message', (data) => {
      const message: WsMessage = JSON.parse(data.toString());
      this.handleMessage(room, userId, message);
    });
    
    // Handle disconnect
    ws.on('close', () => {
      this.leaveRoom(room, userId);
    });
  }
  
  private joinRoom(room: string, userId: string, ws: WebSocket): void {
    let roomState = this.rooms.get(room);
    
    if (!roomState) {
      roomState = { clients: new Map() };
      this.rooms.set(room, roomState);
    }
    
    roomState.clients.set(userId, ws);
    
    // Broadcast join to room (including other servers)
    this.broadcastToRoom(room, {
      type: 'user_joined',
      room,
      data: { userId },
    }, userId);
    
    console.log(`[WS] User ${userId} joined room ${room}`);
  }
  
  private leaveRoom(room: string, userId: string): void {
    const roomState = this.rooms.get(room);
    if (!roomState) return;
    
    roomState.clients.delete(userId);
    
    // Clean up empty rooms
    if (roomState.clients.size === 0) {
      this.rooms.delete(room);
    }
    
    // Broadcast leave
    this.broadcastToRoom(room, {
      type: 'user_left',
      room,
      data: { userId },
    });
    
    console.log(`[WS] User ${userId} left room ${room}`);
  }
  
  private handleMessage(room: string, userId: string, message: WsMessage): void {
    switch (message.type) {
      case 'sync':
      case 'update':
      case 'awareness':
        // Broadcast to room
        this.broadcastToRoom(room, {
          ...message,
          sender: userId,
        }, userId);
        break;
        
      case 'cursor':
      case 'selection':
        // Broadcast presence updates
        this.broadcastToRoom(room, {
          ...message,
          sender: userId,
        }, userId);
        break;
    }
  }
  
  private broadcastToRoom(room: string, message: WsMessage, excludeUserId?: string): void {
    // Broadcast to local clients
    const roomState = this.rooms.get(room);
    if (roomState) {
      roomState.clients.forEach((ws, id) => {
        if (id !== excludeUserId && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    }
    
    // Publish to Redis for other servers
    this.pubClient.publish('collaboration', JSON.stringify({
      ...message,
      serverId: this.serverId,
    }));
  }
  
  private handleRedisMessage(message: WsMessage & { serverId: string }): void {
    // Ignore messages from this server
    if (message.serverId === this.serverId) return;
    
    // Broadcast to local clients in the room
    const roomState = this.rooms.get(message.room);
    if (roomState) {
      roomState.clients.forEach((ws, id) => {
        if (id !== message.sender && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    }
  }
  
  async shutdown(): Promise<void> {
    // Close all connections
    this.rooms.forEach((roomState) => {
      roomState.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
      });
    });
    
    // Close Redis connections
    await this.pubClient.quit();
    await this.subClient.quit();
    
    // Close WebSocket server
    this.wss.close();
  }
}

export { ScalableWebSocketServer };
```

---

## Conflict Resolution

### Automatic Conflict Resolution

```typescript
// src/collaboration/conflicts/autoResolve.ts

interface ConflictResolutionStrategy {
  name: string;
  resolve: (base: string, ours: string, theirs: string) => string;
}

const strategies: Record<string, ConflictResolutionStrategy> = {
  // Last write wins
  lastWriteWins: {
    name: 'Last Write Wins',
    resolve: (base, ours, theirs) => theirs,
  },
  
  // First write wins
  firstWriteWins: {
    name: 'First Write Wins',
    resolve: (base, ours, theirs) => ours,
  },
  
  // Merge (for compatible changes)
  merge: {
    name: 'Merge',
    resolve: (base, ours, theirs) => {
      // Use diff-match-patch for text merging
      const dmp = new diff_match_patch();
      
      const patches = dmp.patch_make(base, theirs);
      const [merged] = dmp.patch_apply(patches, ours);
      
      return merged;
    },
  },
  
  // Keep both (for lists)
  keepBoth: {
    name: 'Keep Both',
    resolve: (base, ours, theirs) => {
      // Assuming JSON arrays
      try {
        const oursArr = JSON.parse(ours);
        const theirsArr = JSON.parse(theirs);
        const merged = [...new Set([...oursArr, ...theirsArr])];
        return JSON.stringify(merged);
      } catch {
        return `${ours}\n${theirs}`;
      }
    },
  },
};

class ConflictResolver {
  private defaultStrategy: string = 'merge';
  
  resolve(
    base: string,
    ours: string,
    theirs: string,
    strategyName?: string
  ): { resolved: string; strategy: string; hadConflict: boolean } {
    // Check if there's actually a conflict
    if (ours === theirs) {
      return { resolved: ours, strategy: 'none', hadConflict: false };
    }
    
    if (ours === base) {
      return { resolved: theirs, strategy: 'theirs_only', hadConflict: false };
    }
    
    if (theirs === base) {
      return { resolved: ours, strategy: 'ours_only', hadConflict: false };
    }
    
    // Apply resolution strategy
    const strategy = strategies[strategyName || this.defaultStrategy];
    const resolved = strategy.resolve(base, ours, theirs);
    
    return {
      resolved,
      strategy: strategy.name,
      hadConflict: true,
    };
  }
  
  setDefaultStrategy(strategyName: string): void {
    if (strategies[strategyName]) {
      this.defaultStrategy = strategyName;
    }
  }
}

export { ConflictResolver, strategies };
```

---

## Performance Optimization

### Batching and Throttling

```typescript
// src/collaboration/performance/optimization.ts

class UpdateBatcher {
  private pendingUpdates: any[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private flushInterval: number;
  private maxBatchSize: number;
  private onFlush: (updates: any[]) => void;
  
  constructor(options: {
    flushInterval?: number;
    maxBatchSize?: number;
    onFlush: (updates: any[]) => void;
  }) {
    this.flushInterval = options.flushInterval || 50;
    this.maxBatchSize = options.maxBatchSize || 100;
    this.onFlush = options.onFlush;
  }
  
  add(update: any): void {
    this.pendingUpdates.push(update);
    
    // Flush immediately if batch is full
    if (this.pendingUpdates.length >= this.maxBatchSize) {
      this.flush();
      return;
    }
    
    // Schedule flush
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.flushInterval);
    }
  }
  
  flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    if (this.pendingUpdates.length === 0) return;
    
    const updates = this.pendingUpdates;
    this.pendingUpdates = [];
    
    this.onFlush(updates);
  }
}

// Throttle cursor updates
class CursorThrottler {
  private lastUpdate: number = 0;
  private minInterval: number;
  private pendingUpdate: any = null;
  private timeout: NodeJS.Timeout | null = null;
  
  constructor(minInterval: number = 50) {
    this.minInterval = minInterval;
  }
  
  throttle(update: any, callback: (update: any) => void): void {
    const now = Date.now();
    const elapsed = now - this.lastUpdate;
    
    if (elapsed >= this.minInterval) {
      // Send immediately
      this.lastUpdate = now;
      callback(update);
    } else {
      // Queue for later
      this.pendingUpdate = update;
      
      if (!this.timeout) {
        this.timeout = setTimeout(() => {
          this.timeout = null;
          if (this.pendingUpdate) {
            this.lastUpdate = Date.now();
            callback(this.pendingUpdate);
            this.pendingUpdate = null;
          }
        }, this.minInterval - elapsed);
      }
    }
  }
}

export { UpdateBatcher, CursorThrottler };
```

---

## Offline Support

### Offline Queue

```typescript
// src/collaboration/offline/offlineQueue.ts

interface QueuedOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private storage: Storage;
  private storageKey: string;
  private maxRetries: number = 3;
  
  constructor(storageKey: string = 'offline_queue') {
    this.storageKey = storageKey;
    this.storage = localStorage;
    this.loadFromStorage();
  }
  
  enqueue(type: string, data: any): string {
    const operation: QueuedOperation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    };
    
    this.queue.push(operation);
    this.saveToStorage();
    
    return operation.id;
  }
  
  dequeue(): QueuedOperation | undefined {
    const operation = this.queue.shift();
    this.saveToStorage();
    return operation;
  }
  
  peek(): QueuedOperation | undefined {
    return this.queue[0];
  }
  
  requeue(operation: QueuedOperation): void {
    operation.retries++;
    
    if (operation.retries < this.maxRetries) {
      this.queue.unshift(operation);
      this.saveToStorage();
    } else {
      console.error('[OfflineQueue] Max retries exceeded:', operation);
    }
  }
  
  remove(id: string): void {
    this.queue = this.queue.filter(op => op.id !== id);
    this.saveToStorage();
  }
  
  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }
  
  get length(): number {
    return this.queue.length;
  }
  
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  private loadFromStorage(): void {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load from storage:', error);
    }
  }
  
  private saveToStorage(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save to storage:', error);
    }
  }
}

export { OfflineQueue, QueuedOperation };
```

---

## API Reference

### REST API Endpoints

```yaml
# openapi.yaml (partial)
paths:
  /api/v1/collaboration/documents/{documentId}:
    get:
      summary: Get document state
      responses:
        '200':
          description: Document state
          
  /api/v1/collaboration/documents/{documentId}/presence:
    get:
      summary: Get users present in document
      responses:
        '200':
          description: List of present users
          
  /api/v1/collaboration/documents/{documentId}/history:
    get:
      summary: Get document edit history
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: Edit history

  /api/v1/collaboration/websocket:
    get:
      summary: WebSocket endpoint for real-time collaboration
      description: |
        Connect via WebSocket with query params:
        - room: Document ID
        - userId: User ID
        - token: Auth token
```

---

## Best Practices

### 1. Choose the Right Algorithm

| Use Case | Recommendation |
|----------|----------------|
| Text editing | CRDT (Yjs) |
| Rich text | CRDT with formatting |
| Spreadsheets | OT |
| Drawings | CRDT |
| Offline-first | CRDT |

### 2. Optimize Network Usage

```typescript
// Batch updates
const batcher = new UpdateBatcher({
  flushInterval: 50,
  onFlush: (updates) => websocket.send(updates),
});

// Throttle cursor updates
const throttler = new CursorThrottler(50);
editor.onCursorChange((pos) => {
  throttler.throttle(pos, (p) => awareness.setCursor(p));
});
```

### 3. Handle Reconnection

```typescript
// Reconnection with exponential backoff
let reconnectAttempts = 0;
const maxReconnectDelay = 30000;

function reconnect() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
  reconnectAttempts++;
  
  setTimeout(() => {
    connect().catch(reconnect);
  }, delay);
}
```

---

## Summary

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **CRDT** | Yjs | Conflict-free data sync |
| **Server** | Hocuspocus | Yjs WebSocket server |
| **Presence** | y-protocols/awareness | User presence |
| **Cursors** | Custom decorations | Remote cursor display |
| **Scaling** | Redis pub/sub | Multi-server sync |
| **Offline** | IndexedDB | Local persistence |

### Performance Targets

| Metric | Target |
|--------|--------|
| Edit latency | <50ms |
| Cursor sync | <50ms |
| Presence update | <100ms |
| Reconnection | <5s |
| Offline sync | <10s |

### Key Features

- Real-time collaborative editing
- Presence indicators
- Remote cursor sharing
- Selection synchronization
- Offline support
- Conflict-free merging
- Scalable WebSocket infrastructure
