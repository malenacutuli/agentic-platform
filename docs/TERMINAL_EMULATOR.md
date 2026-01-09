# Terminal Emulator Implementation

This guide provides comprehensive coverage of terminal emulator implementation in cloud development environments, including xterm.js integration, custom implementations, and advanced terminal features.

---

## Table of Contents

1. [Overview](#overview)
2. [xterm.js Architecture](#xtermjs-architecture)
3. [Terminal Integration](#terminal-integration)
4. [WebSocket Communication](#websocket-communication)
5. [Addons and Extensions](#addons-and-extensions)
6. [Theming and Customization](#theming-and-customization)
7. [Performance Optimization](#performance-optimization)
8. [Accessibility](#accessibility)
9. [Custom Implementation Considerations](#custom-implementation-considerations)
10. [Best Practices](#best-practices)

---

## Overview

Terminal emulators in cloud development environments provide users with command-line access to sandboxed environments. The industry standard is **xterm.js**, a full-featured terminal emulator that runs in the browser.

### Terminal Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TERMINAL EMULATOR ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  BROWSER                           SERVER                          SANDBOX              │
│                                                                                         │
│  ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐   │
│  │   xterm.js      │             │   WebSocket     │             │   PTY Master    │   │
│  │   Terminal      │◄───────────►│   Server        │◄───────────►│   (node-pty)    │   │
│  │   Emulator      │   WebSocket │   (ws/Socket.io)│   PTY I/O   │                 │   │
│  └─────────────────┘             └─────────────────┘             └─────────────────┘   │
│         │                               │                               │               │
│         │                               │                               │               │
│         ▼                               ▼                               ▼               │
│  ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐   │
│  │   Addons        │             │   Session       │             │   Shell         │   │
│  │   - fit         │             │   Manager       │             │   (bash/zsh)    │   │
│  │   - webgl       │             │   - Auth        │             │                 │   │
│  │   - search      │             │   - Resize      │             │                 │   │
│  │   - web-links   │             │   - Heartbeat   │             │                 │   │
│  └─────────────────┘             └─────────────────┘             └─────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Why xterm.js?

| Feature | xterm.js | Custom Implementation |
|---------|----------|----------------------|
| **Maturity** | 10+ years, VS Code uses it | Requires significant effort |
| **Performance** | WebGL renderer, optimized | Must build from scratch |
| **Compatibility** | Full VT100/VT220/xterm | Complex to implement |
| **Ecosystem** | Rich addon system | No ecosystem |
| **Maintenance** | Active community | Full responsibility |
| **Accessibility** | Built-in a11y support | Must implement |

---

## xterm.js Architecture

### Core Components

```typescript
// src/terminal/architecture.ts

/**
 * xterm.js Core Components
 * 
 * Terminal: Main class that coordinates all components
 * ├── Parser: Parses incoming data (escape sequences, control chars)
 * ├── Buffer: Stores terminal state (lines, cursor, attributes)
 * ├── Renderer: Draws terminal to screen (DOM/Canvas/WebGL)
 * ├── InputHandler: Processes keyboard/mouse input
 * ├── SelectionService: Handles text selection
 * └── LinkProvider: Detects and handles links
 */

interface TerminalArchitecture {
  // Core
  terminal: Terminal;
  
  // Data flow
  parser: IParser;
  buffer: IBuffer;
  
  // Rendering
  renderer: IRenderer;
  renderService: IRenderService;
  
  // Input
  inputHandler: IInputHandler;
  coreService: ICoreService;
  
  // Features
  selectionService: ISelectionService;
  linkProvider: ILinkProvider;
}

// Data flow through xterm.js
const dataFlow = `
  Input Data (from PTY)
       │
       ▼
  ┌─────────────┐
  │   Parser    │  Parse escape sequences, control characters
  └─────────────┘
       │
       ▼
  ┌─────────────┐
  │   Buffer    │  Update terminal state (lines, cursor, attrs)
  └─────────────┘
       │
       ▼
  ┌─────────────┐
  │  Renderer   │  Draw changes to screen (WebGL/Canvas/DOM)
  └─────────────┘
`;
```

### Installation and Setup

```bash
# Install xterm.js and addons
pnpm add xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-search @xterm/addon-web-links @xterm/addon-serialize @xterm/addon-unicode11
```

```typescript
// src/terminal/Terminal.tsx

import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import 'xterm/css/xterm.css';

interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  theme: ITheme;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  allowTransparency: boolean;
}

class TerminalManager {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private webglAddon: WebglAddon | null = null;
  private searchAddon: SearchAddon;
  private serializeAddon: SerializeAddon;
  private container: HTMLElement;

  constructor(container: HTMLElement, config: Partial<TerminalConfig> = {}) {
    this.container = container;
    
    // Create terminal with configuration
    this.terminal = new Terminal({
      fontSize: config.fontSize ?? 14,
      fontFamily: config.fontFamily ?? 'Menlo, Monaco, "Courier New", monospace',
      theme: config.theme ?? this.getDefaultTheme(),
      cursorStyle: config.cursorStyle ?? 'block',
      cursorBlink: config.cursorBlink ?? true,
      scrollback: config.scrollback ?? 10000,
      allowTransparency: config.allowTransparency ?? false,
      allowProposedApi: true,
      
      // Performance options
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      
      // Accessibility
      screenReaderMode: false,
      
      // Bell
      bellStyle: 'sound',
      bellSound: 'data:audio/wav;base64,...', // Custom bell sound
    });

    // Initialize addons
    this.fitAddon = new FitAddon();
    this.searchAddon = new SearchAddon();
    this.serializeAddon = new SerializeAddon();
    
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(this.searchAddon);
    this.terminal.loadAddon(this.serializeAddon);
    this.terminal.loadAddon(new WebLinksAddon());
    this.terminal.loadAddon(new Unicode11Addon());
    
    // Open terminal in container
    this.terminal.open(container);
    
    // Try to load WebGL renderer
    this.initWebGL();
    
    // Initial fit
    this.fit();
    
    // Handle resize
    this.setupResizeObserver();
  }

  /**
   * Initialize WebGL renderer for better performance
   */
  private initWebGL(): void {
    try {
      this.webglAddon = new WebglAddon();
      this.webglAddon.onContextLoss(() => {
        this.webglAddon?.dispose();
        this.webglAddon = null;
        // Fall back to canvas renderer
      });
      this.terminal.loadAddon(this.webglAddon);
    } catch (e) {
      console.warn('WebGL not available, using canvas renderer');
    }
  }

  /**
   * Get default theme
   */
  private getDefaultTheme(): ITheme {
    return {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f78',
      selectionForeground: '#ffffff',
      selectionInactiveBackground: '#3a3d41',
      
      // ANSI colors
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      
      // Bright colors
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    };
  }

  /**
   * Setup resize observer
   */
  private setupResizeObserver(): void {
    const resizeObserver = new ResizeObserver(() => {
      this.fit();
    });
    resizeObserver.observe(this.container);
  }

  /**
   * Fit terminal to container
   */
  fit(): { cols: number; rows: number } {
    this.fitAddon.fit();
    return {
      cols: this.terminal.cols,
      rows: this.terminal.rows,
    };
  }

  /**
   * Write data to terminal
   */
  write(data: string | Uint8Array): void {
    this.terminal.write(data);
  }

  /**
   * Clear terminal
   */
  clear(): void {
    this.terminal.clear();
  }

  /**
   * Reset terminal
   */
  reset(): void {
    this.terminal.reset();
  }

  /**
   * Search in terminal
   */
  search(term: string, options?: { caseSensitive?: boolean; regex?: boolean }): boolean {
    return this.searchAddon.findNext(term, {
      caseSensitive: options?.caseSensitive ?? false,
      regex: options?.regex ?? false,
      decorations: {
        matchBackground: '#ffff00',
        matchBorder: '#ffff00',
        matchOverviewRuler: '#ffff00',
        activeMatchBackground: '#ff6600',
        activeMatchBorder: '#ff6600',
        activeMatchColorOverviewRuler: '#ff6600',
      },
    });
  }

  /**
   * Serialize terminal state
   */
  serialize(): string {
    return this.serializeAddon.serialize();
  }

  /**
   * Register data handler
   */
  onData(callback: (data: string) => void): void {
    this.terminal.onData(callback);
  }

  /**
   * Register binary data handler
   */
  onBinary(callback: (data: string) => void): void {
    this.terminal.onBinary(callback);
  }

  /**
   * Register resize handler
   */
  onResize(callback: (size: { cols: number; rows: number }) => void): void {
    this.terminal.onResize(callback);
  }

  /**
   * Focus terminal
   */
  focus(): void {
    this.terminal.focus();
  }

  /**
   * Dispose terminal
   */
  dispose(): void {
    this.webglAddon?.dispose();
    this.terminal.dispose();
  }

  /**
   * Get terminal instance
   */
  getTerminal(): Terminal {
    return this.terminal;
  }
}

export { TerminalManager, TerminalConfig };
```

---

## Terminal Integration

### React Component

```tsx
// src/components/TerminalComponent.tsx

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { TerminalManager } from '../terminal/Terminal';
import { useWebSocket } from '../hooks/useWebSocket';

interface TerminalComponentProps {
  sessionId: string;
  onReady?: () => void;
  onClose?: () => void;
  className?: string;
}

export function TerminalComponent({
  sessionId,
  onReady,
  onClose,
  className,
}: TerminalComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<TerminalManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket connection
  const { socket, send, isConnected: wsConnected } = useWebSocket(
    `/api/terminal/${sessionId}`
  );

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new TerminalManager(containerRef.current, {
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      cursorBlink: true,
      scrollback: 10000,
    });

    terminalRef.current = terminal;

    // Handle user input
    terminal.onData((data) => {
      send({ type: 'input', data });
    });

    // Handle resize
    terminal.onResize((size) => {
      send({ type: 'resize', cols: size.cols, rows: size.rows });
    });

    // Focus terminal
    terminal.focus();

    onReady?.();

    return () => {
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [sessionId]);

  // Handle incoming data
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'output':
          terminalRef.current?.write(message.data);
          break;
        case 'connected':
          setIsConnected(true);
          // Restore terminal state if available
          if (message.state) {
            terminalRef.current?.write(message.state);
          }
          break;
        case 'disconnected':
          setIsConnected(false);
          terminalRef.current?.write('\r\n\x1b[31mDisconnected from server\x1b[0m\r\n');
          break;
        case 'error':
          terminalRef.current?.write(`\r\n\x1b[31mError: ${message.message}\x1b[0m\r\n`);
          break;
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Shift+C: Copy
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      const selection = terminalRef.current?.getTerminal().getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
      e.preventDefault();
    }
    
    // Ctrl+Shift+V: Paste
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      navigator.clipboard.readText().then((text) => {
        send({ type: 'input', data: text });
      });
      e.preventDefault();
    }
    
    // Ctrl+Shift+F: Search
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      // Open search dialog
      e.preventDefault();
    }
  }, [send]);

  return (
    <div className={`terminal-wrapper ${className}`} onKeyDown={handleKeyDown}>
      <div className="terminal-header">
        <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
        <div className="terminal-actions">
          <button onClick={() => terminalRef.current?.clear()}>Clear</button>
          <button onClick={() => send({ type: 'kill' })}>Kill</button>
        </div>
      </div>
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
```

### Server-Side PTY Handler

```typescript
// server/terminal/ptyHandler.ts

import * as pty from 'node-pty';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

interface PTYSession {
  id: string;
  pty: pty.IPty;
  ws: WebSocket | null;
  buffer: string[];
  maxBufferSize: number;
  createdAt: Date;
  lastActivity: Date;
}

class PTYManager extends EventEmitter {
  private sessions: Map<string, PTYSession> = new Map();
  private defaultShell: string;
  private defaultCwd: string;

  constructor() {
    super();
    this.defaultShell = process.env.SHELL || '/bin/bash';
    this.defaultCwd = process.env.HOME || '/home/ubuntu';
  }

  /**
   * Create new PTY session
   */
  createSession(
    sessionId: string,
    options: {
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
      shell?: string;
    } = {}
  ): PTYSession {
    const shell = options.shell || this.defaultShell;
    const cwd = options.cwd || this.defaultCwd;

    // Create PTY
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd,
      env: {
        ...process.env,
        ...options.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: 'en_US.UTF-8',
      },
    });

    const session: PTYSession = {
      id: sessionId,
      pty: ptyProcess,
      ws: null,
      buffer: [],
      maxBufferSize: 50000, // Keep last 50KB of output
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Handle PTY output
    ptyProcess.onData((data) => {
      session.lastActivity = new Date();
      
      // Buffer output for reconnection
      this.bufferOutput(session, data);
      
      // Send to WebSocket if connected
      if (session.ws?.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', sessionId, exitCode, signal);
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Buffer output for reconnection
   */
  private bufferOutput(session: PTYSession, data: string): void {
    session.buffer.push(data);
    
    // Trim buffer if too large
    let totalSize = session.buffer.reduce((sum, s) => sum + s.length, 0);
    while (totalSize > session.maxBufferSize && session.buffer.length > 0) {
      const removed = session.buffer.shift();
      totalSize -= removed?.length || 0;
    }
  }

  /**
   * Attach WebSocket to session
   */
  attachWebSocket(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Detach previous WebSocket
    if (session.ws) {
      session.ws.close();
    }

    session.ws = ws;

    // Send buffered output
    const bufferedOutput = session.buffer.join('');
    if (bufferedOutput) {
      ws.send(JSON.stringify({ type: 'output', data: bufferedOutput }));
    }

    // Send connected message
    ws.send(JSON.stringify({ type: 'connected', sessionId }));

    return true;
  }

  /**
   * Write input to PTY
   */
  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastActivity = new Date();
    session.pty.write(data);
    return true;
  }

  /**
   * Resize PTY
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.pty.resize(cols, rows);
    return true;
  }

  /**
   * Kill PTY session
   */
  kill(sessionId: string, signal: string = 'SIGTERM'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.pty.kill(signal);
    return true;
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): PTYSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): PTYSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxInactiveMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > maxInactiveMs) {
        this.kill(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export const ptyManager = new PTYManager();
```

---

## WebSocket Communication

### WebSocket Server

```typescript
// server/terminal/websocketServer.ts

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ptyManager } from './ptyHandler';
import { verifyToken } from '../auth';

interface TerminalMessage {
  type: 'input' | 'resize' | 'kill' | 'ping';
  data?: string;
  cols?: number;
  rows?: number;
}

class TerminalWebSocketServer {
  private wss: WebSocketServer;

  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/terminal',
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    try {
      // Extract session ID from URL
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const sessionId = url.pathname.split('/').pop();

      if (!sessionId) {
        ws.close(4000, 'Missing session ID');
        return;
      }

      // Verify authentication
      const token = url.searchParams.get('token');
      if (!token || !await verifyToken(token)) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      // Get or create PTY session
      let session = ptyManager.getSession(sessionId);
      if (!session) {
        session = ptyManager.createSession(sessionId, {
          cols: parseInt(url.searchParams.get('cols') || '80'),
          rows: parseInt(url.searchParams.get('rows') || '24'),
        });
      }

      // Attach WebSocket to session
      ptyManager.attachWebSocket(sessionId, ws);

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message: TerminalMessage = JSON.parse(data.toString());
          this.handleMessage(sessionId, message);
        } catch (e) {
          console.error('Invalid message:', e);
        }
      });

      // Handle close
      ws.on('close', () => {
        // Don't kill session, just detach WebSocket
        const session = ptyManager.getSession(sessionId);
        if (session) {
          session.ws = null;
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Setup heartbeat
      this.setupHeartbeat(ws);

    } catch (error) {
      console.error('Connection error:', error);
      ws.close(4002, 'Internal error');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(sessionId: string, message: TerminalMessage): void {
    switch (message.type) {
      case 'input':
        if (message.data) {
          ptyManager.write(sessionId, message.data);
        }
        break;

      case 'resize':
        if (message.cols && message.rows) {
          ptyManager.resize(sessionId, message.cols, message.rows);
        }
        break;

      case 'kill':
        ptyManager.kill(sessionId);
        break;

      case 'ping':
        // Heartbeat response handled by WebSocket
        break;
    }
  }

  /**
   * Setup heartbeat to detect dead connections
   */
  private setupHeartbeat(ws: WebSocket): void {
    let isAlive = true;

    ws.on('pong', () => {
      isAlive = true;
    });

    const interval = setInterval(() => {
      if (!isAlive) {
        clearInterval(interval);
        ws.terminate();
        return;
      }

      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => {
      clearInterval(interval);
    });
  }
}

export { TerminalWebSocketServer };
```

### Message Protocol

```typescript
// shared/terminalProtocol.ts

/**
 * Terminal WebSocket Message Protocol
 */

// Client -> Server messages
interface ClientMessage {
  type: 'input' | 'resize' | 'kill' | 'ping' | 'search' | 'clear';
  data?: string;
  cols?: number;
  rows?: number;
  searchTerm?: string;
}

// Server -> Client messages
interface ServerMessage {
  type: 'output' | 'connected' | 'disconnected' | 'error' | 'pong' | 'searchResult';
  data?: string;
  sessionId?: string;
  message?: string;
  state?: string;
  found?: boolean;
}

// Binary protocol for high-performance scenarios
const BINARY_PROTOCOL = {
  // Message types (first byte)
  OUTPUT: 0x01,
  INPUT: 0x02,
  RESIZE: 0x03,
  PING: 0x04,
  PONG: 0x05,

  // Encode resize message
  encodeResize(cols: number, rows: number): Uint8Array {
    const buffer = new Uint8Array(5);
    buffer[0] = this.RESIZE;
    buffer[1] = (cols >> 8) & 0xff;
    buffer[2] = cols & 0xff;
    buffer[3] = (rows >> 8) & 0xff;
    buffer[4] = rows & 0xff;
    return buffer;
  },

  // Decode resize message
  decodeResize(buffer: Uint8Array): { cols: number; rows: number } {
    return {
      cols: (buffer[1] << 8) | buffer[2],
      rows: (buffer[3] << 8) | buffer[4],
    };
  },

  // Encode output with type prefix
  encodeOutput(data: string): Uint8Array {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const buffer = new Uint8Array(1 + dataBytes.length);
    buffer[0] = this.OUTPUT;
    buffer.set(dataBytes, 1);
    return buffer;
  },
};

export { ClientMessage, ServerMessage, BINARY_PROTOCOL };
```

---

## Addons and Extensions

### Essential Addons

```typescript
// src/terminal/addons.ts

import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { ImageAddon } from '@xterm/addon-image';
import { ClipboardAddon } from '@xterm/addon-clipboard';

/**
 * Addon Configuration
 */
interface AddonConfig {
  fit: boolean;
  webgl: boolean;
  search: boolean;
  webLinks: boolean;
  serialize: boolean;
  unicode11: boolean;
  image: boolean;
  clipboard: boolean;
}

const defaultAddonConfig: AddonConfig = {
  fit: true,
  webgl: true,
  search: true,
  webLinks: true,
  serialize: true,
  unicode11: true,
  image: false,
  clipboard: true,
};

/**
 * Load addons based on configuration
 */
function loadAddons(terminal: Terminal, config: Partial<AddonConfig> = {}): {
  fit?: FitAddon;
  webgl?: WebglAddon;
  search?: SearchAddon;
  serialize?: SerializeAddon;
} {
  const cfg = { ...defaultAddonConfig, ...config };
  const addons: any = {};

  // Fit addon (required for responsive terminals)
  if (cfg.fit) {
    addons.fit = new FitAddon();
    terminal.loadAddon(addons.fit);
  }

  // WebGL addon (better performance)
  if (cfg.webgl) {
    try {
      addons.webgl = new WebglAddon();
      addons.webgl.onContextLoss(() => {
        addons.webgl?.dispose();
        delete addons.webgl;
      });
      terminal.loadAddon(addons.webgl);
    } catch (e) {
      console.warn('WebGL addon not available');
    }
  }

  // Search addon
  if (cfg.search) {
    addons.search = new SearchAddon();
    terminal.loadAddon(addons.search);
  }

  // Web links addon (clickable URLs)
  if (cfg.webLinks) {
    terminal.loadAddon(new WebLinksAddon((event, uri) => {
      window.open(uri, '_blank');
    }));
  }

  // Serialize addon (for state persistence)
  if (cfg.serialize) {
    addons.serialize = new SerializeAddon();
    terminal.loadAddon(addons.serialize);
  }

  // Unicode 11 addon (better emoji support)
  if (cfg.unicode11) {
    terminal.loadAddon(new Unicode11Addon());
    terminal.unicode.activeVersion = '11';
  }

  // Image addon (inline images)
  if (cfg.image) {
    terminal.loadAddon(new ImageAddon());
  }

  // Clipboard addon
  if (cfg.clipboard) {
    terminal.loadAddon(new ClipboardAddon());
  }

  return addons;
}

export { loadAddons, AddonConfig };
```

### Custom Link Provider

```typescript
// src/terminal/linkProvider.ts

import { Terminal, ILinkProvider, ILink, IBufferRange } from 'xterm';

/**
 * Custom link provider for file paths, errors, etc.
 */
class CustomLinkProvider implements ILinkProvider {
  private terminal: Terminal;
  private onLinkClick: (link: string, type: string) => void;

  // Patterns to match
  private patterns = [
    // File paths with line numbers (e.g., /path/to/file.ts:42:10)
    {
      regex: /(?:^|\s)((?:\/[\w.-]+)+(?::\d+(?::\d+)?)?)/g,
      type: 'file',
    },
    // Error stack traces
    {
      regex: /at\s+(?:\w+\s+)?\(?((?:\/[\w.-]+)+:\d+:\d+)\)?/g,
      type: 'stack',
    },
    // Git commit hashes
    {
      regex: /\b([a-f0-9]{7,40})\b/g,
      type: 'commit',
    },
    // Issue references (#123)
    {
      regex: /#(\d+)/g,
      type: 'issue',
    },
  ];

  constructor(terminal: Terminal, onLinkClick: (link: string, type: string) => void) {
    this.terminal = terminal;
    this.onLinkClick = onLinkClick;
  }

  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const line = this.terminal.buffer.active.getLine(bufferLineNumber);
    if (!line) {
      callback(undefined);
      return;
    }

    const lineText = line.translateToString();
    const links: ILink[] = [];

    for (const pattern of this.patterns) {
      let match;
      pattern.regex.lastIndex = 0;

      while ((match = pattern.regex.exec(lineText)) !== null) {
        const startCol = match.index;
        const endCol = match.index + match[0].length;

        links.push({
          range: {
            start: { x: startCol + 1, y: bufferLineNumber + 1 },
            end: { x: endCol + 1, y: bufferLineNumber + 1 },
          },
          text: match[1] || match[0],
          activate: () => {
            this.onLinkClick(match[1] || match[0], pattern.type);
          },
          hover: (event, text) => {
            // Show tooltip
          },
        });
      }
    }

    callback(links.length > 0 ? links : undefined);
  }
}

export { CustomLinkProvider };
```

---

## Theming and Customization

### Theme System

```typescript
// src/terminal/themes.ts

import { ITheme } from 'xterm';

/**
 * Pre-defined terminal themes
 */
const themes: Record<string, ITheme> = {
  // VS Code Dark+ (default)
  'vscode-dark': {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },

  // Dracula
  'dracula': {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },

  // One Dark
  'one-dark': {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#282c34',
    selectionBackground: '#3e4451',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },

  // Solarized Dark
  'solarized-dark': {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    cursorAccent: '#002b36',
    selectionBackground: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#002b36',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  },

  // Nord
  'nord': {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selectionBackground: '#434c5e',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },

  // GitHub Dark
  'github-dark': {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#c9d1d9',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc',
  },
};

/**
 * Get theme by name
 */
function getTheme(name: string): ITheme {
  return themes[name] || themes['vscode-dark'];
}

/**
 * Get all available themes
 */
function getAvailableThemes(): string[] {
  return Object.keys(themes);
}

/**
 * Create custom theme
 */
function createTheme(base: string, overrides: Partial<ITheme>): ITheme {
  return { ...getTheme(base), ...overrides };
}

export { themes, getTheme, getAvailableThemes, createTheme };
```

---

## Performance Optimization

### Performance Best Practices

```typescript
// src/terminal/performance.ts

import { Terminal } from 'xterm';

/**
 * Performance optimization utilities
 */

/**
 * Optimize terminal for high-throughput scenarios
 */
function optimizeForThroughput(terminal: Terminal): void {
  // Reduce render frequency
  terminal.options.fastScrollModifier = 'alt';
  terminal.options.fastScrollSensitivity = 5;
  
  // Increase scrollback buffer (but not too much)
  terminal.options.scrollback = 5000;
  
  // Disable cursor blink (reduces repaints)
  terminal.options.cursorBlink = false;
}

/**
 * Batch write operations
 */
class BatchWriter {
  private terminal: Terminal;
  private buffer: string[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private flushInterval: number;

  constructor(terminal: Terminal, flushInterval = 16) { // ~60fps
    this.terminal = terminal;
    this.flushInterval = flushInterval;
  }

  write(data: string): void {
    this.buffer.push(data);
    
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.terminal.write(this.buffer.join(''));
      this.buffer = [];
    }
    this.flushTimeout = null;
  }

  dispose(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    this.flush();
  }
}

/**
 * Memory usage monitoring
 */
function getTerminalMemoryUsage(terminal: Terminal): {
  bufferSize: number;
  estimatedBytes: number;
} {
  const buffer = terminal.buffer.active;
  const lines = buffer.length;
  const cols = terminal.cols;
  
  // Rough estimate: each cell is ~20 bytes (char + attributes)
  const estimatedBytes = lines * cols * 20;
  
  return {
    bufferSize: lines,
    estimatedBytes,
  };
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  renderTime: number;
  inputLatency: number;
  frameRate: number;
}

class PerformanceMonitor {
  private terminal: Terminal;
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    inputLatency: 0,
    frameRate: 0,
  };
  private frameCount = 0;
  private lastFrameTime = performance.now();

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor frame rate
    const measureFrameRate = () => {
      this.frameCount++;
      const now = performance.now();
      const elapsed = now - this.lastFrameTime;
      
      if (elapsed >= 1000) {
        this.metrics.frameRate = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;
      }
      
      requestAnimationFrame(measureFrameRate);
    };
    
    requestAnimationFrame(measureFrameRate);
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}

export { optimizeForThroughput, BatchWriter, getTerminalMemoryUsage, PerformanceMonitor };
```

---

## Accessibility

### Accessibility Features

```typescript
// src/terminal/accessibility.ts

import { Terminal } from 'xterm';

/**
 * Accessibility configuration
 */
interface AccessibilityConfig {
  screenReaderMode: boolean;
  announceNewOutput: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

/**
 * Configure terminal for accessibility
 */
function configureAccessibility(
  terminal: Terminal,
  config: Partial<AccessibilityConfig> = {}
): void {
  // Enable screen reader mode
  if (config.screenReaderMode) {
    terminal.options.screenReaderMode = true;
  }

  // Disable cursor blink for reduced motion
  if (config.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    terminal.options.cursorBlink = false;
  }

  // High contrast theme
  if (config.highContrast || window.matchMedia('(prefers-contrast: more)').matches) {
    terminal.options.theme = {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selectionBackground: '#ffffff',
      selectionForeground: '#000000',
    };
  }
}

/**
 * Screen reader announcer
 */
class ScreenReaderAnnouncer {
  private liveRegion: HTMLElement;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private pendingAnnouncements: string[] = [];

  constructor() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('role', 'log');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'false');
    this.liveRegion.className = 'sr-only';
    document.body.appendChild(this.liveRegion);
  }

  announce(message: string): void {
    this.pendingAnnouncements.push(message);
    
    if (!this.debounceTimeout) {
      this.debounceTimeout = setTimeout(() => {
        this.flush();
      }, 100);
    }
  }

  private flush(): void {
    if (this.pendingAnnouncements.length > 0) {
      const announcement = this.pendingAnnouncements.join('\n');
      this.liveRegion.textContent = announcement;
      this.pendingAnnouncements = [];
    }
    this.debounceTimeout = null;
  }

  dispose(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.liveRegion.remove();
  }
}

export { configureAccessibility, ScreenReaderAnnouncer, AccessibilityConfig };
```

---

## Custom Implementation Considerations

### When to Consider Custom Implementation

| Scenario | Recommendation |
|----------|----------------|
| Standard terminal needs | Use xterm.js |
| Custom escape sequences | Extend xterm.js parser |
| Non-standard protocols | Custom implementation |
| Embedded systems | Lightweight custom |
| Extreme performance | Custom with WebGL |

### Custom Terminal Parser

```typescript
// src/terminal/customParser.ts

/**
 * Custom escape sequence parser
 * Only implement if xterm.js doesn't meet specific needs
 */

interface ParserState {
  mode: 'normal' | 'escape' | 'csi' | 'osc';
  params: number[];
  intermediates: string;
  payload: string;
}

class CustomParser {
  private state: ParserState = {
    mode: 'normal',
    params: [],
    intermediates: '',
    payload: '',
  };

  parse(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const code = data.charCodeAt(i);

      switch (this.state.mode) {
        case 'normal':
          this.handleNormal(char, code);
          break;
        case 'escape':
          this.handleEscape(char, code);
          break;
        case 'csi':
          this.handleCSI(char, code);
          break;
        case 'osc':
          this.handleOSC(char, code);
          break;
      }
    }
  }

  private handleNormal(char: string, code: number): void {
    if (code === 0x1b) { // ESC
      this.state.mode = 'escape';
    } else if (code < 0x20) {
      this.handleControlChar(code);
    } else {
      this.emitChar(char);
    }
  }

  private handleEscape(char: string, code: number): void {
    if (char === '[') {
      this.state.mode = 'csi';
      this.state.params = [];
      this.state.intermediates = '';
    } else if (char === ']') {
      this.state.mode = 'osc';
      this.state.payload = '';
    } else {
      this.handleEscapeSequence(char);
      this.state.mode = 'normal';
    }
  }

  private handleCSI(char: string, code: number): void {
    if (code >= 0x30 && code <= 0x3f) {
      // Parameter bytes
      if (char === ';') {
        this.state.params.push(0);
      } else {
        const lastParam = this.state.params.length - 1;
        if (lastParam < 0) {
          this.state.params.push(parseInt(char) || 0);
        } else {
          this.state.params[lastParam] = this.state.params[lastParam] * 10 + (parseInt(char) || 0);
        }
      }
    } else if (code >= 0x20 && code <= 0x2f) {
      // Intermediate bytes
      this.state.intermediates += char;
    } else if (code >= 0x40 && code <= 0x7e) {
      // Final byte
      this.handleCSISequence(char, this.state.params, this.state.intermediates);
      this.state.mode = 'normal';
    }
  }

  private handleOSC(char: string, code: number): void {
    if (code === 0x07 || (code === 0x1b && this.state.payload.endsWith('\\'))) {
      this.handleOSCSequence(this.state.payload);
      this.state.mode = 'normal';
    } else {
      this.state.payload += char;
    }
  }

  private handleControlChar(code: number): void {
    // Handle control characters (CR, LF, BS, etc.)
  }

  private handleEscapeSequence(char: string): void {
    // Handle simple escape sequences
  }

  private handleCSISequence(final: string, params: number[], intermediates: string): void {
    // Handle CSI sequences (cursor movement, colors, etc.)
  }

  private handleOSCSequence(payload: string): void {
    // Handle OSC sequences (title, colors, etc.)
  }

  private emitChar(char: string): void {
    // Output character to buffer
  }
}

export { CustomParser };
```

---

## Best Practices

### Terminal Implementation Checklist

| Feature | Priority | Implementation |
|---------|----------|----------------|
| **xterm.js integration** | Required | Use official package |
| **WebGL renderer** | High | Fallback to canvas |
| **Fit addon** | Required | Responsive sizing |
| **WebSocket communication** | Required | Binary protocol |
| **Session persistence** | High | Buffer + serialize |
| **Theme support** | Medium | Multiple themes |
| **Search** | Medium | Search addon |
| **Accessibility** | High | Screen reader mode |
| **Performance monitoring** | Low | Optional metrics |

### Security Considerations

| Risk | Mitigation |
|------|------------|
| **XSS via terminal output** | xterm.js sanitizes by default |
| **Command injection** | Server-side validation |
| **Session hijacking** | Token-based auth |
| **Data exfiltration** | Network monitoring |

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| **Input latency** | <16ms | <50ms |
| **Render time** | <16ms | <33ms |
| **Memory usage** | <50MB | <100MB |
| **Reconnection** | <1s | <3s |

---

## Summary

### Quick Reference

```typescript
// Basic xterm.js setup
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

const terminal = new Terminal({
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, monospace',
  cursorBlink: true,
  scrollback: 10000,
});

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebglAddon());

terminal.open(document.getElementById('terminal')!);
fitAddon.fit();

// Handle input
terminal.onData((data) => {
  websocket.send(JSON.stringify({ type: 'input', data }));
});

// Handle output
websocket.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'output') {
    terminal.write(data);
  }
};
```

### Architecture Summary

```
Browser (xterm.js) ←→ WebSocket ←→ Server (node-pty) ←→ Shell (bash/zsh)
```
