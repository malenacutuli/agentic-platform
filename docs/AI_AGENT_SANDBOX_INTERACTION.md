# AI Agent Sandbox Interaction

This guide provides comprehensive coverage of how AI agents interact with cloud development sandboxes, including available tools, command execution mechanisms, error handling, and retry logic.

---

## Table of Contents

1. [Overview](#overview)
2. [Agent Tool Architecture](#agent-tool-architecture)
3. [Available Tools](#available-tools)
4. [Command Execution](#command-execution)
5. [File Operations](#file-operations)
6. [Browser Automation](#browser-automation)
7. [Error Handling](#error-handling)
8. [Retry Logic](#retry-logic)
9. [Observation Processing](#observation-processing)
10. [Best Practices](#best-practices)

---

## Overview

AI agents in cloud development platforms operate through a structured tool-calling interface that provides controlled access to sandbox resources. This architecture ensures safety, auditability, and reliable execution while giving agents the flexibility to complete complex development tasks.

### Agent-Sandbox Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENT SANDBOX INTERACTION                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              AI AGENT (LLM)                                      │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │   Reasoning  │  │   Planning   │  │ Tool Select  │  │  Observation │        │   │
│  │  │              │→ │              │→ │              │→ │  Processing  │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │         ↑                                                      │                │   │
│  │         └──────────────────────────────────────────────────────┘                │   │
│  │                              Agent Loop                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                                 │
│                                       │ Tool Calls (JSON)                              │
│                                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           TOOL EXECUTION LAYER                                   │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │    Shell     │  │    File      │  │   Browser    │  │   Search     │        │   │
│  │  │   Executor   │  │   Manager    │  │  Automation  │  │   Engine     │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │   Message    │  │    Plan      │  │   WebDev     │  │   Generate   │        │   │
│  │  │   Handler    │  │   Manager    │  │   Tools      │  │   Media      │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                                 │
│                                       │ Sandbox API                                    │
│                                       ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SANDBOX ENVIRONMENT                                 │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │  File System │  │   Processes  │  │   Network    │  │   Browser    │        │   │
│  │  │              │  │              │  │              │  │   Instance   │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Agent Loop Cycle

| Phase | Description | Duration |
|-------|-------------|----------|
| **Analyze** | Understand context and current state | ~1-2s |
| **Think** | Reason about next action | ~2-5s |
| **Select** | Choose appropriate tool | ~0.5s |
| **Execute** | Run tool in sandbox | Variable |
| **Observe** | Process execution result | ~1s |
| **Iterate** | Continue until task complete | Loop |

---

## Agent Tool Architecture

### Tool Definition Schema

```typescript
// types/tools.ts

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ParameterSchema;
  default?: any;
}

interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
}

interface ToolResult {
  id: string;
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, any>;
}
```

### Tool Registry

```typescript
// server/agent/toolRegistry.ts

import { ToolDefinition, ToolCall, ToolResult } from '../types/tools';

type ToolExecutor = (params: Record<string, any>, context: ExecutionContext) => Promise<ToolResult>;

interface ExecutionContext {
  sandboxId: string;
  userId: string;
  sessionId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;
}

/**
 * Registry for all available agent tools
 */
class ToolRegistry {
  private tools: Map<string, {
    definition: ToolDefinition;
    executor: ToolExecutor;
    category: string;
    riskLevel: 'low' | 'medium' | 'high';
  }> = new Map();

  /**
   * Register a new tool
   */
  register(
    definition: ToolDefinition,
    executor: ToolExecutor,
    options: { category: string; riskLevel: 'low' | 'medium' | 'high' }
  ): void {
    this.tools.set(definition.name, {
      definition,
      executor,
      ...options,
    });
  }

  /**
   * Get tool definition
   */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /**
   * Get all tool definitions for LLM
   */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * Execute a tool call
   */
  async execute(call: ToolCall, context: ExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    
    if (!tool) {
      return {
        id: call.id,
        success: false,
        error: `Unknown tool: ${call.name}`,
      };
    }

    try {
      // Validate parameters
      this.validateParameters(call.parameters, tool.definition);

      // Execute with timeout
      const result = await Promise.race([
        tool.executor(call.parameters, context),
        this.timeout(context.timeout, call.name),
      ]);

      return { id: call.id, ...result };
    } catch (error) {
      return {
        id: call.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate parameters against schema
   */
  private validateParameters(
    params: Record<string, any>,
    definition: ToolDefinition
  ): void {
    const { properties, required } = definition.parameters;

    // Check required parameters
    for (const req of required) {
      if (!(req in params)) {
        throw new Error(`Missing required parameter: ${req}`);
      }
    }

    // Validate types
    for (const [key, value] of Object.entries(params)) {
      const schema = properties[key];
      if (!schema) continue;

      if (schema.enum && !schema.enum.includes(value)) {
        throw new Error(`Invalid value for ${key}: must be one of ${schema.enum.join(', ')}`);
      }

      // Type checking
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        throw new Error(`Invalid type for ${key}: expected ${schema.type}, got ${actualType}`);
      }
    }
  }

  /**
   * Create timeout promise
   */
  private timeout(ms: number, toolName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool ${toolName} timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Get tools by category
   */
  getByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.category === category)
      .map(t => t.definition);
  }

  /**
   * Get tools by risk level
   */
  getByRiskLevel(level: 'low' | 'medium' | 'high'): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.riskLevel === level)
      .map(t => t.definition);
  }
}

export const toolRegistry = new ToolRegistry();
```

---

## Available Tools

### Core Tool Categories

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              AGENT TOOL CATEGORIES                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SHELL TOOLS                    FILE TOOLS                    BROWSER TOOLS             │
│  ├── shell.exec                 ├── file.read                 ├── browser.navigate      │
│  ├── shell.view                 ├── file.write                ├── browser.click         │
│  ├── shell.send                 ├── file.edit                 ├── browser.type          │
│  ├── shell.wait                 ├── file.append               ├── browser.screenshot    │
│  └── shell.kill                 ├── file.view                 ├── browser.scroll        │
│                                 └── match.glob/grep           └── browser.extract       │
│                                                                                         │
│  SEARCH TOOLS                   WEBDEV TOOLS                  COMMUNICATION             │
│  ├── search.info                ├── webdev.init               ├── message.info          │
│  ├── search.image               ├── webdev.checkpoint         ├── message.ask           │
│  ├── search.api                 ├── webdev.rollback           ├── message.result        │
│  ├── search.news                ├── webdev.status             └── plan.update/advance   │
│  └── search.data                ├── webdev.restart                                      │
│                                 └── webdev.sql                                          │
│                                                                                         │
│  GENERATION TOOLS               SCHEDULING                    PARALLEL                  │
│  ├── generate.image             ├── schedule.cron             └── map.parallel          │
│  ├── generate.video             └── schedule.interval                                   │
│  └── generate.audio                                                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Shell Tool Implementation

```typescript
// server/agent/tools/shell.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface ShellSession {
  id: string;
  process: ChildProcess;
  buffer: string;
  cwd: string;
  lastActivity: Date;
}

/**
 * Shell tool for executing commands in sandbox
 */
class ShellTool {
  private sessions: Map<string, ShellSession> = new Map();
  private maxSessions = 10;
  private defaultTimeout = 30000;

  /**
   * Execute command in shell session
   */
  async exec(params: {
    session: string;
    command: string;
    timeout?: number;
    brief: string;
  }): Promise<{ success: boolean; output?: string; error?: string }> {
    const { session: sessionId, command, timeout = this.defaultTimeout } = params;

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.createSession(sessionId);
    }

    return new Promise((resolve) => {
      let output = '';
      let error = '';
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: `Command timed out after ${timeout}ms`,
            output: output.slice(-10000), // Last 10KB
          });
        }
      }, timeout);

      // Capture output
      const onData = (data: Buffer) => {
        output += data.toString();
        session!.buffer += data.toString();
        session!.lastActivity = new Date();

        // Check for command completion (prompt returned)
        if (this.isCommandComplete(output)) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              success: true,
              output: this.cleanOutput(output),
            });
          }
        }
      };

      const onError = (data: Buffer) => {
        error += data.toString();
      };

      session.process.stdout?.on('data', onData);
      session.process.stderr?.on('data', onError);

      // Send command
      session.process.stdin?.write(command + '\n');
    });
  }

  /**
   * View current session output
   */
  async view(params: {
    session: string;
    brief: string;
  }): Promise<{ success: boolean; output?: string }> {
    const session = this.sessions.get(params.session);
    
    if (!session) {
      return {
        success: false,
        output: 'Session not found',
      };
    }

    return {
      success: true,
      output: session.buffer.slice(-50000), // Last 50KB
    };
  }

  /**
   * Send input to running process
   */
  async send(params: {
    session: string;
    input: string;
    brief: string;
  }): Promise<{ success: boolean }> {
    const session = this.sessions.get(params.session);
    
    if (!session) {
      return { success: false };
    }

    session.process.stdin?.write(params.input);
    return { success: true };
  }

  /**
   * Wait for process to complete
   */
  async wait(params: {
    session: string;
    timeout?: number;
    brief: string;
  }): Promise<{ success: boolean; output?: string }> {
    const { session: sessionId, timeout = 30000 } = params;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { success: false, output: 'Session not found' };
    }

    return new Promise((resolve) => {
      const startBuffer = session.buffer.length;
      
      const checkInterval = setInterval(() => {
        // Check if new output has stopped
        if (session.buffer.length === startBuffer) {
          clearInterval(checkInterval);
          resolve({
            success: true,
            output: session.buffer.slice(startBuffer),
          });
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({
          success: true,
          output: session.buffer.slice(startBuffer),
        });
      }, timeout);
    });
  }

  /**
   * Kill process in session
   */
  async kill(params: {
    session: string;
    brief: string;
  }): Promise<{ success: boolean }> {
    const session = this.sessions.get(params.session);
    
    if (!session) {
      return { success: false };
    }

    session.process.kill('SIGTERM');
    
    // Force kill after 5 seconds
    setTimeout(() => {
      if (!session.process.killed) {
        session.process.kill('SIGKILL');
      }
    }, 5000);

    return { success: true };
  }

  /**
   * Create new shell session
   */
  private async createSession(id: string): Promise<ShellSession> {
    // Enforce session limit
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest session
      const oldest = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastActivity.getTime() - b[1].lastActivity.getTime())[0];
      
      if (oldest) {
        oldest[1].process.kill();
        this.sessions.delete(oldest[0]);
      }
    }

    const process = spawn('/bin/bash', ['-i'], {
      cwd: '/home/ubuntu',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: '/home/ubuntu',
        USER: 'ubuntu',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session: ShellSession = {
      id,
      process,
      buffer: '',
      cwd: '/home/ubuntu',
      lastActivity: new Date(),
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Check if command has completed
   */
  private isCommandComplete(output: string): boolean {
    // Look for shell prompt patterns
    const promptPatterns = [
      /\$\s*$/m,
      />\s*$/m,
      /ubuntu@\S+:\S+\$\s*$/m,
    ];

    return promptPatterns.some(p => p.test(output));
  }

  /**
   * Clean command output
   */
  private cleanOutput(output: string): string {
    // Remove ANSI escape codes
    return output
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      .trim();
  }
}

export const shellTool = new ShellTool();
```

### File Tool Implementation

```typescript
// server/agent/tools/file.ts

import * as fs from 'fs/promises';
import * as path from 'path';

interface FileReadParams {
  path: string;
  range?: [number, number];
  brief: string;
}

interface FileWriteParams {
  path: string;
  text: string;
  brief: string;
}

interface FileEditParams {
  path: string;
  edits: Array<{
    find: string;
    replace: string;
    all?: boolean;
  }>;
  brief: string;
}

/**
 * File tool for reading and writing files
 */
class FileTool {
  private sandboxRoot = '/home/ubuntu';
  private maxFileSize = 10 * 1024 * 1024; // 10MB

  /**
   * Read file content
   */
  async read(params: FileReadParams): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    truncated?: boolean;
  }> {
    try {
      const filePath = this.resolvePath(params.path);
      await this.validatePath(filePath);

      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          error: `File too large: ${stats.size} bytes (max: ${this.maxFileSize})`,
        };
      }

      let content = await fs.readFile(filePath, 'utf-8');
      let truncated = false;

      // Apply line range if specified
      if (params.range) {
        const lines = content.split('\n');
        const [start, end] = params.range;
        const startLine = Math.max(0, start - 1);
        const endLine = end === -1 ? lines.length : Math.min(lines.length, end);
        content = lines.slice(startLine, endLine).join('\n');
      }

      // Truncate if too long
      const maxLength = 100000; // 100KB
      if (content.length > maxLength) {
        content = content.slice(0, maxLength);
        truncated = true;
      }

      return { success: true, content, truncated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Write file content
   */
  async write(params: FileWriteParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const filePath = this.resolvePath(params.path);
      await this.validatePath(filePath);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      await fs.writeFile(filePath, params.text);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Edit file with find/replace
   */
  async edit(params: FileEditParams): Promise<{
    success: boolean;
    error?: string;
    editsApplied?: number;
  }> {
    try {
      const filePath = this.resolvePath(params.path);
      await this.validatePath(filePath);

      let content = await fs.readFile(filePath, 'utf-8');
      let editsApplied = 0;

      for (const edit of params.edits) {
        if (edit.all) {
          const count = (content.match(new RegExp(this.escapeRegex(edit.find), 'g')) || []).length;
          content = content.split(edit.find).join(edit.replace);
          editsApplied += count;
        } else {
          if (content.includes(edit.find)) {
            content = content.replace(edit.find, edit.replace);
            editsApplied++;
          }
        }
      }

      if (editsApplied === 0) {
        return {
          success: false,
          error: 'No edits applied - patterns not found',
          editsApplied: 0,
        };
      }

      await fs.writeFile(filePath, content);
      return { success: true, editsApplied };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Append to file
   */
  async append(params: FileWriteParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const filePath = this.resolvePath(params.path);
      await this.validatePath(filePath);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      await fs.appendFile(filePath, params.text);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * View file (for images, PDFs)
   */
  async view(params: {
    path: string;
    range?: [number, number];
    brief: string;
  }): Promise<{
    success: boolean;
    content?: string;
    mimeType?: string;
    error?: string;
  }> {
    try {
      const filePath = this.resolvePath(params.path);
      await this.validatePath(filePath);

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.svg': 'image/svg+xml',
      };

      const mimeType = mimeTypes[ext];
      if (!mimeType) {
        // Fall back to text read
        return this.read(params);
      }

      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString('base64');

      return {
        success: true,
        content: `data:${mimeType};base64,${base64}`,
        mimeType,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve path relative to sandbox root
   */
  private resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    return path.join(this.sandboxRoot, inputPath);
  }

  /**
   * Validate path is within sandbox
   */
  private async validatePath(filePath: string): Promise<void> {
    const resolved = path.resolve(filePath);
    
    // Ensure path is within allowed directories
    const allowedPaths = [
      '/home/ubuntu',
      '/tmp',
    ];

    const isAllowed = allowedPaths.some(allowed => 
      resolved.startsWith(allowed)
    );

    if (!isAllowed) {
      throw new Error(`Access denied: ${filePath}`);
    }

    // Check for path traversal
    if (resolved.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const fileTool = new FileTool();
```

---

## Command Execution

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           COMMAND EXECUTION FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. TOOL CALL RECEIVED                                                                  │
│     │                                                                                   │
│     ▼                                                                                   │
│  2. PARAMETER VALIDATION                                                                │
│     ├── Check required parameters                                                       │
│     ├── Validate types                                                                  │
│     └── Sanitize inputs                                                                 │
│     │                                                                                   │
│     ▼                                                                                   │
│  3. SECURITY CHECKS                                                                     │
│     ├── Command whitelist/blacklist                                                     │
│     ├── Path validation                                                                 │
│     └── Rate limit check                                                                │
│     │                                                                                   │
│     ▼                                                                                   │
│  4. EXECUTION                                                                           │
│     ├── Spawn process / perform operation                                               │
│     ├── Capture stdout/stderr                                                           │
│     └── Apply timeout                                                                   │
│     │                                                                                   │
│     ▼                                                                                   │
│  5. RESULT PROCESSING                                                                   │
│     ├── Parse output                                                                    │
│     ├── Truncate if needed                                                              │
│     └── Format for LLM                                                                  │
│     │                                                                                   │
│     ▼                                                                                   │
│  6. RETURN TO AGENT                                                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Command Executor

```typescript
// server/agent/executor.ts

import { EventEmitter } from 'events';

interface ExecutionOptions {
  timeout: number;
  maxOutputSize: number;
  workingDirectory: string;
  environment: Record<string, string>;
}

interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
  truncated: boolean;
}

/**
 * Execute commands with safety controls
 */
class CommandExecutor extends EventEmitter {
  private defaultOptions: ExecutionOptions = {
    timeout: 30000,
    maxOutputSize: 100000, // 100KB
    workingDirectory: '/home/ubuntu',
    environment: {},
  };

  /**
   * Execute a command
   */
  async execute(
    command: string,
    options: Partial<ExecutionOptions> = {}
  ): Promise<ExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    // Security validation
    this.validateCommand(command);

    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let truncated = false;

      const proc = spawn('/bin/bash', ['-c', command], {
        cwd: opts.workingDirectory,
        env: { ...process.env, ...opts.environment },
        timeout: opts.timeout,
      });

      // Timeout handler
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, opts.timeout);

      // Capture stdout
      proc.stdout.on('data', (data: Buffer) => {
        const str = data.toString();
        if (stdout.length + str.length <= opts.maxOutputSize) {
          stdout += str;
        } else {
          truncated = true;
        }
        this.emit('stdout', str);
      });

      // Capture stderr
      proc.stderr.on('data', (data: Buffer) => {
        const str = data.toString();
        if (stderr.length + str.length <= opts.maxOutputSize) {
          stderr += str;
        }
        this.emit('stderr', str);
      });

      // Handle completion
      proc.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        
        resolve({
          exitCode: code ?? -1,
          stdout: this.cleanOutput(stdout),
          stderr: this.cleanOutput(stderr),
          duration: Date.now() - startTime,
          timedOut,
          truncated,
        });
      });

      // Handle errors
      proc.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        
        resolve({
          exitCode: -1,
          stdout: '',
          stderr: error.message,
          duration: Date.now() - startTime,
          timedOut: false,
          truncated: false,
        });
      });
    });
  }

  /**
   * Validate command for security
   */
  private validateCommand(command: string): void {
    // Blocked commands
    const blockedPatterns = [
      /\brm\s+-rf\s+\/(?!\s|$)/,  // rm -rf / (but allow rm -rf /tmp/...)
      /\bmkfs\b/,
      /\bdd\s+.*of=\/dev/,
      /\b:(){.*};\s*:/,  // Fork bomb
      /\bchmod\s+777\s+\//,
      /\bchown\s+.*\s+\//,
      /\bcurl\s+.*\|\s*(?:ba)?sh/,  // Pipe to shell
      /\bwget\s+.*\|\s*(?:ba)?sh/,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Blocked command pattern detected: ${pattern}`);
      }
    }

    // Command length limit
    if (command.length > 10000) {
      throw new Error('Command too long');
    }
  }

  /**
   * Clean output for display
   */
  private cleanOutput(output: string): string {
    return output
      // Remove ANSI escape codes
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      // Remove control characters except newline/tab
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .trim();
  }
}

export const commandExecutor = new CommandExecutor();
```

---

## Error Handling

### Error Classification

```typescript
// server/agent/errors.ts

enum ErrorCategory {
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  TIMEOUT = 'timeout',
  PERMISSION = 'permission',
  RESOURCE = 'resource',
  NETWORK = 'network',
  INTERNAL = 'internal',
}

interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  recoverable: boolean;
  suggestedAction?: string;
  retryable: boolean;
  retryDelay?: number;
}

/**
 * Classify and handle errors
 */
class ErrorHandler {
  /**
   * Classify an error
   */
  classify(error: Error | string): ClassifiedError {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    // Timeout errors
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return {
        category: ErrorCategory.TIMEOUT,
        message,
        recoverable: true,
        suggestedAction: 'Increase timeout or break into smaller operations',
        retryable: true,
        retryDelay: 1000,
      };
    }

    // Permission errors
    if (lowerMessage.includes('permission denied') || 
        lowerMessage.includes('access denied') ||
        lowerMessage.includes('eacces')) {
      return {
        category: ErrorCategory.PERMISSION,
        message,
        recoverable: false,
        suggestedAction: 'Check file permissions or use sudo if appropriate',
        retryable: false,
      };
    }

    // Resource errors
    if (lowerMessage.includes('no space left') ||
        lowerMessage.includes('out of memory') ||
        lowerMessage.includes('enomem') ||
        lowerMessage.includes('enospc')) {
      return {
        category: ErrorCategory.RESOURCE,
        message,
        recoverable: false,
        suggestedAction: 'Clean up disk space or reduce memory usage',
        retryable: false,
      };
    }

    // Network errors
    if (lowerMessage.includes('econnrefused') ||
        lowerMessage.includes('enotfound') ||
        lowerMessage.includes('network') ||
        lowerMessage.includes('socket')) {
      return {
        category: ErrorCategory.NETWORK,
        message,
        recoverable: true,
        suggestedAction: 'Check network connectivity and retry',
        retryable: true,
        retryDelay: 2000,
      };
    }

    // Validation errors
    if (lowerMessage.includes('invalid') ||
        lowerMessage.includes('missing required') ||
        lowerMessage.includes('not found')) {
      return {
        category: ErrorCategory.VALIDATION,
        message,
        recoverable: true,
        suggestedAction: 'Check parameters and file paths',
        retryable: false,
      };
    }

    // Execution errors
    if (lowerMessage.includes('command failed') ||
        lowerMessage.includes('exit code') ||
        lowerMessage.includes('error:')) {
      return {
        category: ErrorCategory.EXECUTION,
        message,
        recoverable: true,
        suggestedAction: 'Review command syntax and dependencies',
        retryable: false,
      };
    }

    // Default: internal error
    return {
      category: ErrorCategory.INTERNAL,
      message,
      recoverable: false,
      suggestedAction: 'Report this issue',
      retryable: false,
    };
  }

  /**
   * Format error for agent consumption
   */
  formatForAgent(error: ClassifiedError): string {
    let formatted = `Error: ${error.message}\n`;
    formatted += `Category: ${error.category}\n`;
    
    if (error.suggestedAction) {
      formatted += `Suggested action: ${error.suggestedAction}\n`;
    }
    
    if (error.retryable) {
      formatted += `This error is retryable.\n`;
    }

    return formatted;
  }

  /**
   * Should the operation be retried?
   */
  shouldRetry(error: ClassifiedError, attempt: number, maxAttempts: number): boolean {
    if (!error.retryable) return false;
    if (attempt >= maxAttempts) return false;
    return true;
  }
}

export const errorHandler = new ErrorHandler();
```

### Error Recovery Strategies

```typescript
// server/agent/recovery.ts

interface RecoveryStrategy {
  name: string;
  applicable: (error: ClassifiedError) => boolean;
  execute: (context: RecoveryContext) => Promise<RecoveryResult>;
}

interface RecoveryContext {
  error: ClassifiedError;
  originalOperation: {
    tool: string;
    params: Record<string, any>;
  };
  attempt: number;
}

interface RecoveryResult {
  success: boolean;
  action: 'retry' | 'skip' | 'abort' | 'alternative';
  message?: string;
  alternativeOperation?: {
    tool: string;
    params: Record<string, any>;
  };
}

/**
 * Recovery strategies for different error types
 */
const recoveryStrategies: RecoveryStrategy[] = [
  // Timeout recovery: increase timeout and retry
  {
    name: 'timeout-increase',
    applicable: (error) => error.category === 'timeout',
    execute: async (context) => {
      const newTimeout = (context.originalOperation.params.timeout || 30000) * 2;
      
      if (newTimeout > 300000) { // Max 5 minutes
        return {
          success: false,
          action: 'abort',
          message: 'Maximum timeout exceeded',
        };
      }

      return {
        success: true,
        action: 'retry',
        alternativeOperation: {
          ...context.originalOperation,
          params: {
            ...context.originalOperation.params,
            timeout: newTimeout,
          },
        },
      };
    },
  },

  // Network recovery: wait and retry
  {
    name: 'network-retry',
    applicable: (error) => error.category === 'network',
    execute: async (context) => {
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, context.attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));

      return {
        success: true,
        action: 'retry',
      };
    },
  },

  // File not found: try alternative paths
  {
    name: 'file-path-recovery',
    applicable: (error) => 
      error.category === 'validation' && 
      error.message.toLowerCase().includes('not found'),
    execute: async (context) => {
      const originalPath = context.originalOperation.params.path;
      
      if (!originalPath) {
        return { success: false, action: 'abort' };
      }

      // Try common alternative paths
      const alternatives = [
        originalPath.replace('/home/ubuntu/', '~/'),
        originalPath.replace('~/', '/home/ubuntu/'),
        `./${originalPath.split('/').pop()}`,
      ];

      return {
        success: true,
        action: 'alternative',
        message: `File not found. Try these alternative paths: ${alternatives.join(', ')}`,
      };
    },
  },

  // Disk space recovery: suggest cleanup
  {
    name: 'disk-space-recovery',
    applicable: (error) => 
      error.category === 'resource' && 
      error.message.toLowerCase().includes('space'),
    execute: async () => {
      return {
        success: true,
        action: 'alternative',
        message: 'Disk space low. Consider running: rm -rf node_modules/.cache /tmp/* ~/.cache',
        alternativeOperation: {
          tool: 'shell',
          params: {
            command: 'df -h && du -sh /tmp/* ~/.cache node_modules/.cache 2>/dev/null | head -20',
            brief: 'Check disk usage',
          },
        },
      };
    },
  },
];

/**
 * Attempt recovery from error
 */
async function attemptRecovery(context: RecoveryContext): Promise<RecoveryResult> {
  for (const strategy of recoveryStrategies) {
    if (strategy.applicable(context.error)) {
      return strategy.execute(context);
    }
  }

  // No applicable strategy
  return {
    success: false,
    action: 'abort',
    message: 'No recovery strategy available',
  };
}

export { attemptRecovery, RecoveryStrategy, RecoveryContext, RecoveryResult };
```

---

## Retry Logic

### Retry Manager

```typescript
// server/agent/retry.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

interface RetryState {
  attempt: number;
  lastError?: Error;
  totalDelay: number;
  startTime: number;
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Manage retry logic for tool execution
 */
class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...defaultRetryConfig, ...config };
  }

  /**
   * Execute with retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error, attempt: number) => boolean = () => true
  ): Promise<T> {
    const state: RetryState = {
      attempt: 0,
      totalDelay: 0,
      startTime: Date.now(),
    };

    while (state.attempt < this.config.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        state.attempt++;
        state.lastError = error instanceof Error ? error : new Error(String(error));

        if (state.attempt >= this.config.maxAttempts) {
          throw state.lastError;
        }

        if (!shouldRetry(state.lastError, state.attempt)) {
          throw state.lastError;
        }

        const delay = this.calculateDelay(state.attempt);
        state.totalDelay += delay;

        console.log(`Retry attempt ${state.attempt}/${this.config.maxAttempts} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw state.lastError || new Error('Max retries exceeded');
  }

  /**
   * Calculate delay for attempt
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.round(delay);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create retry config for specific error types
   */
  static configForError(errorType: string): RetryConfig {
    const configs: Record<string, Partial<RetryConfig>> = {
      timeout: {
        maxAttempts: 2,
        baseDelay: 2000,
      },
      network: {
        maxAttempts: 5,
        baseDelay: 1000,
        backoffMultiplier: 2,
      },
      rate_limit: {
        maxAttempts: 3,
        baseDelay: 5000,
        maxDelay: 60000,
      },
      transient: {
        maxAttempts: 3,
        baseDelay: 500,
      },
    };

    return { ...defaultRetryConfig, ...configs[errorType] };
  }
}

export { RetryManager, RetryConfig, RetryState };
```

### Circuit Breaker

```typescript
// server/agent/circuitBreaker.ts

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

/**
 * Circuit breaker for tool execution
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      monitoringPeriod: 60000,
      ...config,
    };
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Check if we should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.config.timeout;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force reset
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
  }
}

export { CircuitBreaker, CircuitState, CircuitBreakerConfig };
```

---

## Observation Processing

### Observation Formatter

```typescript
// server/agent/observation.ts

interface ToolObservation {
  toolName: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}

interface FormattedObservation {
  text: string;
  truncated: boolean;
  highlights: string[];
}

/**
 * Format tool results for agent consumption
 */
class ObservationFormatter {
  private maxLength = 50000; // 50KB max observation

  /**
   * Format observation for agent
   */
  format(observation: ToolObservation): FormattedObservation {
    let text = '';
    let truncated = false;
    const highlights: string[] = [];

    // Header
    text += `Tool: ${observation.toolName}\n`;
    text += `Status: ${observation.success ? 'Success' : 'Failed'}\n`;
    text += `Duration: ${observation.duration}ms\n`;

    if (observation.metadata) {
      for (const [key, value] of Object.entries(observation.metadata)) {
        text += `${key}: ${JSON.stringify(value)}\n`;
      }
    }

    text += '\n';

    // Output or error
    if (observation.error) {
      text += `Error:\n${observation.error}\n`;
      highlights.push(observation.error.split('\n')[0]);
    }

    if (observation.output) {
      let output = observation.output;

      // Truncate if needed
      if (output.length > this.maxLength) {
        output = output.slice(0, this.maxLength);
        truncated = true;
        text += `Output (truncated to ${this.maxLength} chars):\n`;
      } else {
        text += 'Output:\n';
      }

      text += output;

      // Extract highlights
      highlights.push(...this.extractHighlights(output));
    }

    if (truncated) {
      text += '\n\n[Output truncated. Use file.read with range parameter for full content.]';
    }

    return { text, truncated, highlights };
  }

  /**
   * Extract important information from output
   */
  private extractHighlights(output: string): string[] {
    const highlights: string[] = [];

    // Error patterns
    const errorPatterns = [
      /error[:\s]+(.+)/gi,
      /failed[:\s]+(.+)/gi,
      /exception[:\s]+(.+)/gi,
      /warning[:\s]+(.+)/gi,
    ];

    for (const pattern of errorPatterns) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !highlights.includes(match[1])) {
          highlights.push(match[1].trim().slice(0, 200));
        }
      }
    }

    // File paths
    const pathPattern = /(?:\/[\w.-]+)+/g;
    const paths = output.match(pathPattern) || [];
    highlights.push(...paths.slice(0, 5));

    // URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = output.match(urlPattern) || [];
    highlights.push(...urls.slice(0, 3));

    return highlights.slice(0, 10);
  }

  /**
   * Summarize long output
   */
  summarize(output: string, maxLines: number = 50): string {
    const lines = output.split('\n');
    
    if (lines.length <= maxLines) {
      return output;
    }

    const headLines = Math.floor(maxLines * 0.4);
    const tailLines = Math.floor(maxLines * 0.4);
    const omitted = lines.length - headLines - tailLines;

    return [
      ...lines.slice(0, headLines),
      `\n... ${omitted} lines omitted ...\n`,
      ...lines.slice(-tailLines),
    ].join('\n');
  }

  /**
   * Format multiple observations
   */
  formatBatch(observations: ToolObservation[]): string {
    return observations
      .map((obs, i) => {
        const formatted = this.format(obs);
        return `=== Observation ${i + 1} ===\n${formatted.text}`;
      })
      .join('\n\n');
  }
}

export const observationFormatter = new ObservationFormatter();
```

---

## Best Practices

### Tool Usage Guidelines

| Tool | Best Practice | Anti-Pattern |
|------|---------------|--------------|
| **shell.exec** | Use for single commands | Long scripts without checkpoints |
| **file.write** | Save code before execution | Write partial content |
| **file.edit** | Small, targeted changes | Large rewrites |
| **browser** | Verify page loaded | Click without waiting |
| **search** | Multiple query variants | Single vague query |

### Error Handling Checklist

| Scenario | Recommended Action |
|----------|-------------------|
| Command timeout | Increase timeout, break into smaller steps |
| File not found | Check path, list directory contents |
| Permission denied | Check permissions, use appropriate user |
| Network error | Retry with backoff |
| Syntax error | Review and fix code |

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| Tool execution | <5s | <30s |
| File operations | <1s | <5s |
| Shell commands | <30s | <120s |
| Browser actions | <10s | <30s |

---

## Summary

### Agent Tool Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TOOL INTERACTION SUMMARY                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  TOOL CATEGORIES          EXECUTION FLOW           ERROR HANDLING                       │
│  ├── Shell (exec/view)    ├── Validate params      ├── Classify error                  │
│  ├── File (read/write)    ├── Security check       ├── Determine recovery              │
│  ├── Browser (navigate)   ├── Execute operation    ├── Retry if applicable             │
│  ├── Search (info/api)    ├── Capture output       └── Report to agent                 │
│  ├── WebDev (init/save)   ├── Format result                                            │
│  └── Generate (image)     └── Return observation                                        │
│                                                                                         │
│  RETRY STRATEGY           CIRCUIT BREAKER          OBSERVATION                          │
│  ├── Exponential backoff  ├── Failure threshold    ├── Format output                   │
│  ├── Max 3 attempts       ├── Auto-recovery        ├── Extract highlights              │
│  ├── Jitter for spread    ├── Half-open testing    ├── Truncate if needed              │
│  └── Error-specific       └── Manual reset         └── Summarize long output           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
