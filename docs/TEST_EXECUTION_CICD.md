# Test Execution and CI/CD Integration

This guide provides comprehensive coverage of test execution methods, UI integration, and CI/CD pipeline configuration for automated testing in cloud development environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Terminal Command Execution](#terminal-command-execution)
3. [UI Integration](#ui-integration)
4. [Test Runner Service](#test-runner-service)
5. [CI/CD Integration](#cicd-integration)
6. [GitHub Actions](#github-actions)
7. [GitLab CI](#gitlab-ci)
8. [Parallel Test Execution](#parallel-test-execution)
9. [Test Reporting](#test-reporting)
10. [Caching Strategies](#caching-strategies)
11. [Environment Management](#environment-management)
12. [Best Practices](#best-practices)

---

## Overview

Test execution in cloud development environments requires seamless integration between terminal commands, visual interfaces, and automated CI/CD pipelines to ensure code quality throughout the development lifecycle.

### Test Execution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEST EXECUTION ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            TRIGGER SOURCES                                       │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  Terminal   │  │  UI Button  │  │  File Save  │  │  Git Push   │            │   │
│  │  │  Command    │  │  Click      │  │  (Watch)    │  │  (CI/CD)    │            │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │   │
│  │         │                │                │                │                    │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼────────────────────┘   │
│            │                │                │                │                         │
│            ▼                ▼                ▼                ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         TEST RUNNER SERVICE                                      │   │
│  │                                                                                   │   │
│  │  • Queue management                                                              │   │
│  │  • Process spawning                                                              │   │
│  │  • Output streaming                                                              │   │
│  │  • Result aggregation                                                            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         TEST FRAMEWORKS                                          │   │
│  │                                                                                   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐  ┌─────────┐                        │   │
│  │  │  Jest   │  │ Vitest  │  │ Playwright  │  │ Cypress │                        │   │
│  │  └─────────┘  └─────────┘  └─────────────┘  └─────────┘                        │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         OUTPUT & REPORTING                                       │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  Terminal   │  │  UI Panel   │  │  Coverage   │  │  Artifacts  │            │   │
│  │  │  Output     │  │  Results    │  │  Reports    │  │  (Videos)   │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Execution Methods

| Method | Use Case | Feedback Speed |
|--------|----------|----------------|
| **Terminal** | Development, debugging | Immediate |
| **UI Panel** | Visual feedback, navigation | Immediate |
| **Watch Mode** | Active development | <1 second |
| **CI/CD** | Automated validation | Minutes |
| **Pre-commit** | Local validation | Seconds |

---

## Terminal Command Execution

### Standard Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test src/components/Button.test.tsx

# Run tests matching pattern
pnpm test --grep "should handle click"

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run E2E in headed mode (visible browser)
pnpm test:e2e:headed

# Run E2E with UI
pnpm test:e2e:ui

# Debug E2E tests
pnpm test:e2e:debug

# Run specific E2E test
pnpm test:e2e e2e/auth.spec.ts

# Generate test report
pnpm test:report
```

### Advanced CLI Options

```bash
# Vitest options
pnpm vitest run --reporter=verbose --coverage
pnpm vitest run --changed  # Only changed files
pnpm vitest run --bail 1   # Stop after first failure
pnpm vitest run --update   # Update snapshots
pnpm vitest run --threads=false  # Disable threading

# Playwright options
pnpm playwright test --project=chromium
pnpm playwright test --grep @smoke
pnpm playwright test --retries=2
pnpm playwright test --workers=4
pnpm playwright test --trace on
pnpm playwright show-report

# Jest options
pnpm jest --runInBand  # Sequential execution
pnpm jest --detectOpenHandles
pnpm jest --forceExit
pnpm jest --clearCache
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:changed": "vitest run --changed",
    "test:ci": "vitest run --coverage --reporter=junit --outputFile=test-results.xml",
    
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report",
    "test:e2e:ci": "playwright test --reporter=github,html",
    
    "test:all": "pnpm test && pnpm test:e2e",
    "test:smoke": "playwright test --grep @smoke",
    "test:regression": "playwright test --grep @regression",
    
    "pretest": "pnpm lint",
    "posttest": "pnpm test:coverage:check"
  }
}
```

---

## UI Integration

### Test Explorer Panel

```typescript
// src/ui/testExplorer/TestExplorerPanel.tsx

import React, { useState, useEffect } from 'react';
import { TestRunner, TestResult, TestFile } from '@/services/testRunner';

interface TestExplorerProps {
  projectPath: string;
}

export function TestExplorerPanel({ projectPath }: TestExplorerProps) {
  const [tests, setTests] = useState<TestFile[]>([]);
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'pending'>('all');

  const testRunner = new TestRunner(projectPath);

  useEffect(() => {
    // Discover tests on mount
    discoverTests();
    
    // Subscribe to test results
    testRunner.onResult((result) => {
      setResults(prev => new Map(prev).set(result.testId, result));
      setRunning(prev => {
        const next = new Set(prev);
        next.delete(result.testId);
        return next;
      });
    });

    return () => testRunner.dispose();
  }, [projectPath]);

  async function discoverTests() {
    const discovered = await testRunner.discover();
    setTests(discovered);
  }

  async function runTest(testId: string) {
    setRunning(prev => new Set(prev).add(testId));
    await testRunner.run(testId);
  }

  async function runAllTests() {
    const allIds = tests.flatMap(f => f.tests.map(t => t.id));
    setRunning(new Set(allIds));
    await testRunner.runAll();
  }

  async function runFailedTests() {
    const failedIds = Array.from(results.entries())
      .filter(([_, r]) => r.status === 'failed')
      .map(([id]) => id);
    setRunning(new Set(failedIds));
    await testRunner.runMultiple(failedIds);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'skipped': return '○';
      default: return '•';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'passed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'skipped': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  }

  const filteredTests = tests.map(file => ({
    ...file,
    tests: file.tests.filter(test => {
      if (filter === 'all') return true;
      const result = results.get(test.id);
      return result?.status === filter;
    }),
  })).filter(file => file.tests.length > 0);

  return (
    <div className="test-explorer h-full flex flex-col">
      {/* Toolbar */}
      <div className="toolbar flex items-center gap-2 p-2 border-b">
        <button
          onClick={runAllTests}
          className="btn btn-primary btn-sm"
          disabled={running.size > 0}
        >
          ▶ Run All
        </button>
        <button
          onClick={runFailedTests}
          className="btn btn-secondary btn-sm"
          disabled={running.size > 0}
        >
          ↻ Run Failed
        </button>
        <button
          onClick={discoverTests}
          className="btn btn-ghost btn-sm"
        >
          ⟳ Refresh
        </button>
        
        <div className="flex-1" />
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="select select-sm"
        >
          <option value="all">All Tests</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Test List */}
      <div className="test-list flex-1 overflow-auto">
        {filteredTests.map(file => (
          <div key={file.path} className="test-file">
            <div className="file-header flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800">
              <span className="font-mono text-sm">{file.path}</span>
              <span className="text-xs text-gray-500">
                ({file.tests.length} tests)
              </span>
            </div>
            
            <div className="test-items">
              {file.tests.map(test => {
                const result = results.get(test.id);
                const isRunning = running.has(test.id);
                
                return (
                  <div
                    key={test.id}
                    className="test-item flex items-center gap-2 p-2 pl-6 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                    onClick={() => !isRunning && runTest(test.id)}
                  >
                    {isRunning ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <span className={getStatusColor(result?.status || 'pending')}>
                        {getStatusIcon(result?.status || 'pending')}
                      </span>
                    )}
                    
                    <span className="test-name flex-1">{test.name}</span>
                    
                    {result?.duration && (
                      <span className="text-xs text-gray-500">
                        {result.duration}ms
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="summary flex items-center gap-4 p-2 border-t text-sm">
        <span className="text-green-500">
          ✓ {Array.from(results.values()).filter(r => r.status === 'passed').length} passed
        </span>
        <span className="text-red-500">
          ✗ {Array.from(results.values()).filter(r => r.status === 'failed').length} failed
        </span>
        <span className="text-yellow-500">
          ○ {Array.from(results.values()).filter(r => r.status === 'skipped').length} skipped
        </span>
      </div>
    </div>
  );
}
```

### Test Output Panel

```typescript
// src/ui/testExplorer/TestOutputPanel.tsx

import React, { useRef, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { TestRunner } from '@/services/testRunner';

interface TestOutputPanelProps {
  testRunner: TestRunner;
}

export function TestOutputPanel({ testRunner }: TestOutputPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    terminal.current = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        green: '#4ec9b0',
        red: '#f14c4c',
        yellow: '#dcdcaa',
      },
      fontSize: 13,
      fontFamily: 'Fira Code, monospace',
      scrollback: 10000,
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Subscribe to test output
    testRunner.onOutput((data) => {
      terminal.current?.write(data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.current?.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      terminal.current?.dispose();
      resizeObserver.disconnect();
    };
  }, [testRunner]);

  function clearOutput() {
    terminal.current?.clear();
  }

  return (
    <div className="test-output h-full flex flex-col">
      <div className="toolbar flex items-center gap-2 p-2 border-b">
        <span className="font-semibold">Test Output</span>
        <div className="flex-1" />
        <button onClick={clearOutput} className="btn btn-ghost btn-xs">
          Clear
        </button>
      </div>
      <div ref={terminalRef} className="flex-1" />
    </div>
  );
}
```

### Inline Test Results

```typescript
// src/ui/editor/InlineTestResults.tsx

import React from 'react';
import { TestResult } from '@/services/testRunner';

interface InlineTestResultsProps {
  results: TestResult[];
  line: number;
}

export function InlineTestResults({ results, line }: InlineTestResultsProps) {
  const lineResults = results.filter(r => r.line === line);
  
  if (lineResults.length === 0) return null;

  return (
    <div className="inline-test-results absolute right-4">
      {lineResults.map(result => (
        <span
          key={result.testId}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
            ${result.status === 'passed' ? 'bg-green-100 text-green-800' : ''}
            ${result.status === 'failed' ? 'bg-red-100 text-red-800' : ''}
          `}
        >
          {result.status === 'passed' ? '✓' : '✗'}
          {result.duration}ms
          
          {result.status === 'failed' && result.error && (
            <span className="ml-2 text-red-600" title={result.error}>
              {result.error.split('\n')[0].substring(0, 50)}...
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
```

---

## Test Runner Service

### Core Implementation

```typescript
// src/services/testRunner/TestRunnerService.ts

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface TestFile {
  path: string;
  tests: TestItem[];
}

interface TestItem {
  id: string;
  name: string;
  line: number;
  column: number;
}

interface TestResult {
  testId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  stack?: string;
  line?: number;
}

interface TestRunOptions {
  coverage?: boolean;
  watch?: boolean;
  grep?: string;
  updateSnapshots?: boolean;
  bail?: number;
}

class TestRunnerService extends EventEmitter {
  private projectPath: string;
  private framework: 'vitest' | 'jest' | 'playwright' | 'cypress';
  private process: ChildProcess | null = null;
  private queue: string[] = [];
  private isRunning = false;

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.framework = this.detectFramework();
  }

  // Detect testing framework
  private detectFramework(): 'vitest' | 'jest' | 'playwright' | 'cypress' {
    const packageJson = require(path.join(this.projectPath, 'package.json'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps.vitest) return 'vitest';
    if (deps.jest) return 'jest';
    if (deps['@playwright/test']) return 'playwright';
    if (deps.cypress) return 'cypress';

    return 'vitest'; // Default
  }

  // Discover tests
  async discover(): Promise<TestFile[]> {
    return new Promise((resolve, reject) => {
      const args = this.getDiscoverArgs();
      const proc = spawn('pnpm', args, {
        cwd: this.projectPath,
        shell: true,
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const tests = this.parseDiscoverOutput(output);
            resolve(tests);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Discovery failed with code ${code}`));
        }
      });
    });
  }

  // Get discovery arguments
  private getDiscoverArgs(): string[] {
    switch (this.framework) {
      case 'vitest':
        return ['vitest', 'list', '--json'];
      case 'jest':
        return ['jest', '--listTests', '--json'];
      case 'playwright':
        return ['playwright', 'test', '--list', '--reporter=json'];
      default:
        return ['vitest', 'list', '--json'];
    }
  }

  // Parse discovery output
  private parseDiscoverOutput(output: string): TestFile[] {
    // Framework-specific parsing
    try {
      const json = JSON.parse(output);
      return this.normalizeTestList(json);
    } catch {
      return [];
    }
  }

  // Normalize test list across frameworks
  private normalizeTestList(data: any): TestFile[] {
    // Implementation depends on framework
    return [];
  }

  // Run single test
  async run(testId: string, options: TestRunOptions = {}): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const args = this.getRunArgs(testId, options);
      
      this.process = spawn('pnpm', args, {
        cwd: this.projectPath,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
          CI: 'true',
        },
      });

      let output = '';
      
      this.process.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.emit('output', text);
      });

      this.process.stderr?.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.emit('output', text);
      });

      this.process.on('close', (code) => {
        const result = this.parseTestResult(testId, output, code);
        this.emit('result', result);
        resolve(result);
      });

      this.process.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Run all tests
  async runAll(options: TestRunOptions = {}): Promise<TestResult[]> {
    return new Promise((resolve, reject) => {
      const args = this.getRunAllArgs(options);
      const results: TestResult[] = [];

      this.process = spawn('pnpm', args, {
        cwd: this.projectPath,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
          CI: 'true',
        },
      });

      let output = '';

      this.process.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.emit('output', text);

        // Parse streaming results
        const streamResults = this.parseStreamingResults(text);
        for (const result of streamResults) {
          results.push(result);
          this.emit('result', result);
        }
      });

      this.process.stderr?.on('data', (data) => {
        this.emit('output', data.toString());
      });

      this.process.on('close', (code) => {
        resolve(results);
      });
    });
  }

  // Run multiple tests
  async runMultiple(testIds: string[], options: TestRunOptions = {}): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    for (const testId of testIds) {
      const result = await this.run(testId, options);
      results.push(result);
    }

    return results;
  }

  // Get run arguments
  private getRunArgs(testId: string, options: TestRunOptions): string[] {
    const args: string[] = [];

    switch (this.framework) {
      case 'vitest':
        args.push('vitest', 'run');
        args.push('--reporter=json');
        if (options.coverage) args.push('--coverage');
        if (options.updateSnapshots) args.push('--update');
        args.push('--testNamePattern', testId);
        break;

      case 'jest':
        args.push('jest');
        args.push('--json');
        if (options.coverage) args.push('--coverage');
        if (options.updateSnapshots) args.push('--updateSnapshot');
        args.push('--testNamePattern', testId);
        break;

      case 'playwright':
        args.push('playwright', 'test');
        args.push('--reporter=json');
        args.push('--grep', testId);
        break;
    }

    return args;
  }

  // Get run all arguments
  private getRunAllArgs(options: TestRunOptions): string[] {
    const args: string[] = [];

    switch (this.framework) {
      case 'vitest':
        args.push('vitest', 'run');
        args.push('--reporter=json');
        if (options.coverage) args.push('--coverage');
        if (options.watch) args.push('--watch');
        if (options.bail) args.push('--bail', options.bail.toString());
        break;

      case 'jest':
        args.push('jest');
        args.push('--json');
        if (options.coverage) args.push('--coverage');
        if (options.watch) args.push('--watch');
        if (options.bail) args.push('--bail');
        break;

      case 'playwright':
        args.push('playwright', 'test');
        args.push('--reporter=json');
        if (options.grep) args.push('--grep', options.grep);
        break;
    }

    return args;
  }

  // Parse test result
  private parseTestResult(testId: string, output: string, exitCode: number | null): TestResult {
    try {
      // Try to parse JSON output
      const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        return this.extractResult(testId, json);
      }
    } catch {}

    // Fallback based on exit code
    return {
      testId,
      status: exitCode === 0 ? 'passed' : 'failed',
      duration: 0,
      error: exitCode !== 0 ? output : undefined,
    };
  }

  // Extract result from JSON
  private extractResult(testId: string, json: any): TestResult {
    // Framework-specific extraction
    return {
      testId,
      status: 'passed',
      duration: 0,
    };
  }

  // Parse streaming results
  private parseStreamingResults(output: string): TestResult[] {
    // Parse incremental test results from output
    return [];
  }

  // Stop running tests
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  // Dispose
  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}

export { TestRunnerService, TestFile, TestItem, TestResult, TestRunOptions };
```

---

## CI/CD Integration

### CI/CD Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD PIPELINE ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              TRIGGER                                             │   │
│  │                                                                                   │   │
│  │  Push to main ──► Pull Request ──► Schedule ──► Manual                          │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              BUILD STAGE                                         │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  Checkout   │─►│  Install    │─►│   Build     │─►│   Lint      │            │   │
│  │  │  Code       │  │   Deps      │  │   Project   │  │   Check     │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              TEST STAGE (Parallel)                               │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   Unit      │  │ Integration │  │   E2E       │  │  Visual     │            │   │
│  │  │   Tests     │  │   Tests     │  │   Tests     │  │  Tests      │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              REPORT STAGE                                        │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  Coverage   │  │   Test      │  │  Artifacts  │  │   Notify    │            │   │
│  │  │  Report     │  │   Report    │  │   Upload    │  │   Team      │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## GitHub Actions

### Complete Workflow Configuration

```yaml
# .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  # Lint and type check
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run TypeScript check
        run: pnpm type-check

  # Unit and integration tests
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm test:ci --shard=${{ matrix.shard }}/4
        env:
          CI: true

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/
          retention-days: 7

  # Merge coverage reports
  coverage:
    name: Coverage Report
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download coverage artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: coverage-*
          merge-multiple: true
          path: coverage/

      - name: Merge coverage reports
        run: npx nyc merge coverage coverage/merged.json

      - name: Generate report
        run: npx nyc report --reporter=lcov --reporter=text-summary

      - name: Upload to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: coverage/lcov.info
          fail_ci_if_error: true

      - name: Check coverage threshold
        run: |
          COVERAGE=$(npx nyc report --reporter=text-summary | grep 'Lines' | awk '{print $3}' | tr -d '%')
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage $COVERAGE% is below threshold 70%"
            exit 1
          fi

  # E2E tests
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        shard: [1, 2]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps ${{ matrix.browser }}

      - name: Build application
        run: pnpm build

      - name: Run E2E tests
        run: |
          pnpm test:e2e \
            --project=${{ matrix.browser }} \
            --shard=${{ matrix.shard }}/2 \
            --reporter=github,html
        env:
          CI: true
          BASE_URL: http://localhost:3000

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.browser }}-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 30

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-artifacts-${{ matrix.browser }}-${{ matrix.shard }}
          path: |
            test-results/
            playwright-report/
          retention-days: 7

  # Visual regression tests
  visual-tests:
    name: Visual Regression
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run visual tests
        run: pnpm test:visual
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}

  # Summary job
  test-summary:
    name: Test Summary
    runs-on: ubuntu-latest
    needs: [unit-tests, e2e-tests, coverage]
    if: always()
    steps:
      - name: Check test results
        run: |
          if [[ "${{ needs.unit-tests.result }}" == "failure" ]] || \
             [[ "${{ needs.e2e-tests.result }}" == "failure" ]]; then
            echo "Tests failed"
            exit 1
          fi
          echo "All tests passed"

      - name: Post summary
        run: |
          echo "## Test Results Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Job | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-----|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Unit Tests | ${{ needs.unit-tests.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| E2E Tests | ${{ needs.e2e-tests.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Coverage | ${{ needs.coverage.result }} |" >> $GITHUB_STEP_SUMMARY
```

### PR Comment Workflow

```yaml
# .github/workflows/pr-comment.yml

name: PR Test Report

on:
  workflow_run:
    workflows: ["Test Suite"]
    types: [completed]

jobs:
  comment:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.event == 'pull_request'
    steps:
      - name: Download artifacts
        uses: actions/github-script@v7
        with:
          script: |
            const artifacts = await github.rest.actions.listWorkflowRunArtifacts({
              owner: context.repo.owner,
              repo: context.repo.repo,
              run_id: context.payload.workflow_run.id,
            });
            
            for (const artifact of artifacts.data.artifacts) {
              if (artifact.name.startsWith('playwright-report')) {
                const download = await github.rest.actions.downloadArtifact({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  artifact_id: artifact.id,
                  archive_format: 'zip',
                });
                
                require('fs').writeFileSync(
                  `${artifact.name}.zip`,
                  Buffer.from(download.data)
                );
              }
            }

      - name: Post comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            
            // Parse test results
            const results = {
              passed: 0,
              failed: 0,
              skipped: 0,
            };
            
            // Create comment body
            const body = `## Test Results
            
            | Status | Count |
            |--------|-------|
            | ✅ Passed | ${results.passed} |
            | ❌ Failed | ${results.failed} |
            | ⏭️ Skipped | ${results.skipped} |
            
            [View full report](${context.payload.workflow_run.html_url})
            `;
            
            // Find PR number
            const prs = await github.rest.pulls.list({
              owner: context.repo.owner,
              repo: context.repo.repo,
              head: context.payload.workflow_run.head_sha,
            });
            
            if (prs.data.length > 0) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prs.data[0].number,
                body,
              });
            }
```

---

## GitLab CI

### Complete Pipeline Configuration

```yaml
# .gitlab-ci.yml

stages:
  - prepare
  - lint
  - test
  - report
  - deploy

variables:
  NODE_VERSION: "20"
  PNPM_VERSION: "8"
  FF_USE_FASTZIP: "true"
  ARTIFACT_COMPRESSION_LEVEL: "fast"
  CACHE_COMPRESSION_LEVEL: "fast"

default:
  image: node:${NODE_VERSION}
  cache:
    key:
      files:
        - pnpm-lock.yaml
    paths:
      - .pnpm-store/
      - node_modules/
    policy: pull

# Prepare stage
install:
  stage: prepare
  cache:
    policy: pull-push
  script:
    - corepack enable
    - corepack prepare pnpm@${PNPM_VERSION} --activate
    - pnpm config set store-dir .pnpm-store
    - pnpm install --frozen-lockfile
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour

# Lint stage
lint:
  stage: lint
  needs: [install]
  script:
    - pnpm lint
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

type-check:
  stage: lint
  needs: [install]
  script:
    - pnpm type-check
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Test stage
unit-tests:
  stage: test
  needs: [install, lint]
  parallel: 4
  script:
    - pnpm test:ci --shard=${CI_NODE_INDEX}/${CI_NODE_TOTAL}
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    when: always
    paths:
      - coverage/
    reports:
      junit: test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    expire_in: 1 week

e2e-tests:
  stage: test
  needs: [install, lint]
  image: mcr.microsoft.com/playwright:v1.40.0-jammy
  parallel:
    matrix:
      - BROWSER: [chromium, firefox, webkit]
        SHARD: [1, 2]
  script:
    - pnpm build
    - pnpm test:e2e --project=${BROWSER} --shard=${SHARD}/2
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
    expire_in: 1 week
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

visual-tests:
  stage: test
  needs: [install, lint]
  image: mcr.microsoft.com/playwright:v1.40.0-jammy
  script:
    - pnpm build-storybook
    - pnpm test:visual
  artifacts:
    when: always
    paths:
      - .percy/
    expire_in: 1 week
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# Report stage
coverage-report:
  stage: report
  needs: [unit-tests]
  script:
    - npx nyc merge coverage coverage/merged.json
    - npx nyc report --reporter=html --reporter=text-summary
  artifacts:
    paths:
      - coverage/
    expire_in: 30 days
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'

pages:
  stage: report
  needs: [e2e-tests, coverage-report]
  script:
    - mkdir -p public
    - cp -r playwright-report public/e2e
    - cp -r coverage public/coverage
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Notify on failure
notify-failure:
  stage: report
  needs:
    - job: unit-tests
      artifacts: false
    - job: e2e-tests
      artifacts: false
  script:
    - |
      curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
          \"text\": \"❌ Tests failed on ${CI_COMMIT_BRANCH}\",
          \"attachments\": [{
            \"color\": \"danger\",
            \"fields\": [
              {\"title\": \"Pipeline\", \"value\": \"${CI_PIPELINE_URL}\", \"short\": true},
              {\"title\": \"Commit\", \"value\": \"${CI_COMMIT_SHORT_SHA}\", \"short\": true}
            ]
          }]
        }"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_failure
```

---

## Parallel Test Execution

### Sharding Configuration

```typescript
// vitest.config.ts - Sharding

export default defineConfig({
  test: {
    // Automatic sharding based on CI environment
    ...(process.env.CI && {
      shard: process.env.SHARD,
    }),
    
    // Pool configuration for parallelism
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: process.env.CI ? 2 : 4,
        minThreads: 1,
      },
    },
  },
});
```

### Playwright Sharding

```typescript
// playwright.config.ts - Sharding

export default defineConfig({
  // Shard configuration
  ...(process.env.CI && {
    shard: {
      current: parseInt(process.env.SHARD_INDEX || '1'),
      total: parseInt(process.env.SHARD_TOTAL || '1'),
    },
  }),
  
  // Worker configuration
  workers: process.env.CI ? 2 : undefined,
  fullyParallel: true,
  
  // Retry configuration
  retries: process.env.CI ? 2 : 0,
});
```

### Test Distribution Strategy

```typescript
// src/ci/testDistributor.ts

interface TestDistributionConfig {
  totalShards: number;
  currentShard: number;
  balanceStrategy: 'round-robin' | 'duration-based' | 'file-size';
}

class TestDistributor {
  private config: TestDistributionConfig;
  private testDurations: Map<string, number> = new Map();

  constructor(config: TestDistributionConfig) {
    this.config = config;
  }

  // Load historical test durations
  async loadDurations(historyFile: string): Promise<void> {
    try {
      const history = JSON.parse(await fs.readFile(historyFile, 'utf-8'));
      for (const [test, duration] of Object.entries(history)) {
        this.testDurations.set(test, duration as number);
      }
    } catch {
      // No history available
    }
  }

  // Distribute tests to shards
  distributeTests(tests: string[]): string[] {
    switch (this.config.balanceStrategy) {
      case 'round-robin':
        return this.roundRobinDistribution(tests);
      case 'duration-based':
        return this.durationBasedDistribution(tests);
      case 'file-size':
        return this.fileSizeDistribution(tests);
      default:
        return this.roundRobinDistribution(tests);
    }
  }

  // Round-robin distribution
  private roundRobinDistribution(tests: string[]): string[] {
    return tests.filter((_, index) => 
      index % this.config.totalShards === this.config.currentShard - 1
    );
  }

  // Duration-based distribution (balanced)
  private durationBasedDistribution(tests: string[]): string[] {
    // Sort tests by duration (longest first)
    const sorted = [...tests].sort((a, b) => {
      const durationA = this.testDurations.get(a) || 1000;
      const durationB = this.testDurations.get(b) || 1000;
      return durationB - durationA;
    });

    // Assign to shards using greedy algorithm
    const shards: { tests: string[]; duration: number }[] = 
      Array.from({ length: this.config.totalShards }, () => ({
        tests: [],
        duration: 0,
      }));

    for (const test of sorted) {
      // Find shard with minimum duration
      const minShard = shards.reduce((min, shard, index) => 
        shard.duration < shards[min].duration ? index : min, 0
      );

      shards[minShard].tests.push(test);
      shards[minShard].duration += this.testDurations.get(test) || 1000;
    }

    return shards[this.config.currentShard - 1].tests;
  }

  // File size distribution
  private fileSizeDistribution(tests: string[]): string[] {
    // Similar to duration-based but using file size
    return this.roundRobinDistribution(tests);
  }

  // Save test durations for future runs
  async saveDurations(results: Map<string, number>, historyFile: string): Promise<void> {
    // Merge with existing history
    for (const [test, duration] of results) {
      this.testDurations.set(test, duration);
    }

    await fs.writeFile(
      historyFile,
      JSON.stringify(Object.fromEntries(this.testDurations), null, 2)
    );
  }
}

export { TestDistributor, TestDistributionConfig };
```

---

## Test Reporting

### JUnit XML Reporter

```typescript
// src/reporters/junitReporter.ts

import { create } from 'xmlbuilder2';

interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testCases: TestCase[];
}

interface TestCase {
  name: string;
  classname: string;
  time: number;
  failure?: {
    message: string;
    type: string;
    content: string;
  };
  skipped?: boolean;
}

class JUnitReporter {
  private suites: TestSuite[] = [];

  addSuite(suite: TestSuite): void {
    this.suites.push(suite);
  }

  generate(): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('testsuites');

    for (const suite of this.suites) {
      const suiteEle = root.ele('testsuite', {
        name: suite.name,
        tests: suite.tests,
        failures: suite.failures,
        errors: suite.errors,
        skipped: suite.skipped,
        time: suite.time.toFixed(3),
      });

      for (const testCase of suite.testCases) {
        const caseEle = suiteEle.ele('testcase', {
          name: testCase.name,
          classname: testCase.classname,
          time: testCase.time.toFixed(3),
        });

        if (testCase.failure) {
          caseEle.ele('failure', {
            message: testCase.failure.message,
            type: testCase.failure.type,
          }).txt(testCase.failure.content);
        }

        if (testCase.skipped) {
          caseEle.ele('skipped');
        }
      }
    }

    return root.end({ prettyPrint: true });
  }

  async save(path: string): Promise<void> {
    const xml = this.generate();
    await fs.writeFile(path, xml);
  }
}

export { JUnitReporter, TestSuite, TestCase };
```

### HTML Report Generator

```typescript
// src/reporters/htmlReporter.ts

interface HtmlReportConfig {
  title: string;
  outputPath: string;
  includeScreenshots: boolean;
  includeVideos: boolean;
}

class HtmlReporter {
  private config: HtmlReportConfig;
  private results: TestResult[] = [];

  constructor(config: HtmlReportConfig) {
    this.config = config;
  }

  addResult(result: TestResult): void {
    this.results.push(result);
  }

  async generate(): Promise<void> {
    const html = this.buildHtml();
    await fs.writeFile(this.config.outputPath, html);
  }

  private buildHtml(): string {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const total = this.results.length;
    const duration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .stats { display: flex; gap: 20px; margin-top: 20px; }
    .stat { background: rgba(255,255,255,0.1); padding: 15px 25px; border-radius: 6px; }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { font-size: 12px; opacity: 0.8; }
    .stat.passed .stat-value { color: #4ade80; }
    .stat.failed .stat-value { color: #f87171; }
    .stat.skipped .stat-value { color: #fbbf24; }
    .tests { background: white; border-radius: 8px; overflow: hidden; }
    .test { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 15px; }
    .test:last-child { border-bottom: none; }
    .test-status { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .test-status.passed { background: #dcfce7; color: #16a34a; }
    .test-status.failed { background: #fee2e2; color: #dc2626; }
    .test-status.skipped { background: #fef3c7; color: #d97706; }
    .test-name { flex: 1; }
    .test-duration { color: #666; font-size: 14px; }
    .test-error { background: #fee2e2; padding: 10px 15px; margin: 10px 20px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
    .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; }
    .filter-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #e5e5e5; }
    .filter-btn.active { background: #1a1a2e; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.config.title}</h1>
      <p>Generated at ${new Date().toISOString()}</p>
      <div class="stats">
        <div class="stat passed">
          <div class="stat-value">${passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat failed">
          <div class="stat-value">${failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat skipped">
          <div class="stat-value">${skipped}</div>
          <div class="stat-label">Skipped</div>
        </div>
        <div class="stat">
          <div class="stat-value">${(duration / 1000).toFixed(2)}s</div>
          <div class="stat-label">Duration</div>
        </div>
      </div>
    </div>
    
    <div class="filter-bar">
      <button class="filter-btn active" data-filter="all">All (${total})</button>
      <button class="filter-btn" data-filter="passed">Passed (${passed})</button>
      <button class="filter-btn" data-filter="failed">Failed (${failed})</button>
      <button class="filter-btn" data-filter="skipped">Skipped (${skipped})</button>
    </div>
    
    <div class="tests">
      ${this.results.map(r => this.renderTest(r)).join('')}
    </div>
  </div>
  
  <script>
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.test').forEach(test => {
          if (filter === 'all' || test.dataset.status === filter) {
            test.style.display = 'flex';
          } else {
            test.style.display = 'none';
          }
        });
      });
    });
  </script>
</body>
</html>
    `;
  }

  private renderTest(result: TestResult): string {
    const statusIcon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '○';
    
    return `
      <div class="test" data-status="${result.status}">
        <div class="test-status ${result.status}">${statusIcon}</div>
        <div class="test-name">${result.testId}</div>
        <div class="test-duration">${result.duration}ms</div>
      </div>
      ${result.error ? `<div class="test-error">${result.error}</div>` : ''}
    `;
  }
}

export { HtmlReporter, HtmlReportConfig };
```

---

## Caching Strategies

### Dependency Caching

```yaml
# GitHub Actions caching
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      node_modules
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-

# Cache Playwright browsers
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/pnpm-lock.yaml') }}
```

### Test Result Caching

```typescript
// src/ci/testCache.ts

interface TestCacheConfig {
  cacheDir: string;
  maxAge: number; // milliseconds
}

class TestCache {
  private config: TestCacheConfig;

  constructor(config: TestCacheConfig) {
    this.config = config;
  }

  // Get cache key for test file
  getCacheKey(testFile: string, sourceFiles: string[]): string {
    const hashes = sourceFiles.map(f => this.hashFile(f));
    return crypto.createHash('sha256')
      .update(testFile)
      .update(hashes.join(''))
      .digest('hex');
  }

  // Check if cached result is valid
  async isCacheValid(key: string): Promise<boolean> {
    const cachePath = path.join(this.config.cacheDir, `${key}.json`);
    
    try {
      const stat = await fs.stat(cachePath);
      const age = Date.now() - stat.mtimeMs;
      return age < this.config.maxAge;
    } catch {
      return false;
    }
  }

  // Get cached result
  async getCachedResult(key: string): Promise<TestResult[] | null> {
    if (!await this.isCacheValid(key)) {
      return null;
    }

    const cachePath = path.join(this.config.cacheDir, `${key}.json`);
    const data = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(data);
  }

  // Save result to cache
  async cacheResult(key: string, results: TestResult[]): Promise<void> {
    await fs.mkdir(this.config.cacheDir, { recursive: true });
    const cachePath = path.join(this.config.cacheDir, `${key}.json`);
    await fs.writeFile(cachePath, JSON.stringify(results));
  }

  // Hash file content
  private hashFile(filePath: string): string {
    const content = require('fs').readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

export { TestCache, TestCacheConfig };
```

---

## Environment Management

### Test Environment Configuration

```typescript
// src/ci/testEnvironment.ts

interface TestEnvironment {
  name: string;
  variables: Record<string, string>;
  services: ServiceConfig[];
}

interface ServiceConfig {
  name: string;
  image: string;
  ports: number[];
  healthCheck?: {
    url: string;
    timeout: number;
  };
}

class TestEnvironmentManager {
  private environments: Map<string, TestEnvironment> = new Map();

  // Register environment
  registerEnvironment(env: TestEnvironment): void {
    this.environments.set(env.name, env);
  }

  // Setup environment
  async setup(envName: string): Promise<void> {
    const env = this.environments.get(envName);
    if (!env) throw new Error(`Environment not found: ${envName}`);

    // Set environment variables
    for (const [key, value] of Object.entries(env.variables)) {
      process.env[key] = value;
    }

    // Start services
    for (const service of env.services) {
      await this.startService(service);
    }
  }

  // Teardown environment
  async teardown(envName: string): Promise<void> {
    const env = this.environments.get(envName);
    if (!env) return;

    // Stop services
    for (const service of env.services) {
      await this.stopService(service);
    }
  }

  // Start a service
  private async startService(service: ServiceConfig): Promise<void> {
    // Docker compose or direct container start
    const { execSync } = require('child_process');
    execSync(`docker run -d --name ${service.name} ${service.image}`);

    // Wait for health check
    if (service.healthCheck) {
      await this.waitForHealth(service.healthCheck);
    }
  }

  // Stop a service
  private async stopService(service: ServiceConfig): Promise<void> {
    const { execSync } = require('child_process');
    execSync(`docker stop ${service.name} && docker rm ${service.name}`);
  }

  // Wait for service health
  private async waitForHealth(check: { url: string; timeout: number }): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < check.timeout) {
      try {
        const response = await fetch(check.url);
        if (response.ok) return;
      } catch {}
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Health check timeout: ${check.url}`);
  }
}

export { TestEnvironmentManager, TestEnvironment, ServiceConfig };
```

---

## Best Practices

### CI/CD Guidelines

| Practice | Description |
|----------|-------------|
| **Fail fast** | Stop on first failure in PR checks |
| **Parallel execution** | Use sharding for faster feedback |
| **Cache dependencies** | Reduce install time |
| **Artifact retention** | Keep reports for debugging |
| **Flaky test handling** | Retry with limits |
| **Coverage gates** | Enforce minimum coverage |
| **Branch protection** | Require passing tests |

### Performance Optimization

| Optimization | Impact |
|--------------|--------|
| **Dependency caching** | -60% install time |
| **Test sharding** | -70% total time |
| **Parallel jobs** | -50% pipeline time |
| **Incremental testing** | -80% for small changes |
| **Browser caching** | -30% E2E setup |

### Test Reliability

| Strategy | Implementation |
|----------|----------------|
| **Retry flaky tests** | Max 2 retries in CI |
| **Quarantine flaky tests** | Skip and track |
| **Timeout configuration** | Reasonable limits |
| **Clean state** | Reset between tests |
| **Deterministic data** | Use fixtures |

---

## Summary

### Execution Methods

| Method | Best For | Feedback Time |
|--------|----------|---------------|
| **Terminal** | Development | Immediate |
| **UI Panel** | Visual debugging | Immediate |
| **Watch Mode** | Active development | <1s |
| **CI/CD** | Automated validation | Minutes |

### CI/CD Integration

| Platform | Configuration | Features |
|----------|---------------|----------|
| **GitHub Actions** | `.github/workflows/` | Matrix, artifacts, caching |
| **GitLab CI** | `.gitlab-ci.yml` | Parallel, pages, coverage |
| **CircleCI** | `.circleci/config.yml` | Orbs, workflows |
| **Jenkins** | `Jenkinsfile` | Pipelines, plugins |

### Quick Reference

```bash
# Local development
pnpm test:watch          # Watch mode
pnpm test:ui             # Visual UI

# CI commands
pnpm test:ci             # CI mode with coverage
pnpm test:e2e:ci         # E2E in CI

# Debugging
pnpm test:e2e:debug      # Debug E2E
pnpm test -- --bail 1    # Stop on first failure
```
