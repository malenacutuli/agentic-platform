# Template Dependency Management Guide

## Overview

This guide covers comprehensive dependency management for templates including npm/pnpm lockfile versioning, dependency conflict resolution, and security vulnerability scanning.

---

## Table of Contents

1. [Lockfile Versioning Strategy](#1-lockfile-versioning-strategy)
2. [Dependency Conflict Resolution](#2-dependency-conflict-resolution)
3. [Security Vulnerability Scanning](#3-security-vulnerability-scanning)
4. [Dependency Update Automation](#4-dependency-update-automation)
5. [Dependency Caching](#5-dependency-caching)
6. [Best Practices](#6-best-practices)

---

## 1. Lockfile Versioning Strategy

### Why Lockfiles Matter

Lockfiles ensure **reproducible builds** by pinning exact dependency versions:

```
Without lockfile:
  User A installs → gets react@18.2.0
  User B installs → gets react@18.3.1 (newer)
  → Different behavior, potential bugs

With lockfile:
  User A installs → gets react@18.2.0
  User B installs → gets react@18.2.0 (same)
  → Identical behavior, reproducible
```

### Lockfile Types

```typescript
// src/services/dependencies/lockfileManager.ts

interface LockfileConfig {
  type: 'npm' | 'pnpm' | 'yarn';
  filename: string;
  format: 'json' | 'yaml';
  features: string[];
}

const LOCKFILE_CONFIGS: Record<string, LockfileConfig> = {
  npm: {
    type: 'npm',
    filename: 'package-lock.json',
    format: 'json',
    features: [
      'Flat dependency tree',
      'Integrity hashes (SHA-512)',
      'Resolved URLs',
      'Peer dependency tracking',
    ],
  },
  pnpm: {
    type: 'pnpm',
    filename: 'pnpm-lock.yaml',
    format: 'yaml',
    features: [
      'Content-addressable storage',
      'Strict dependency isolation',
      'Smaller lockfile size',
      'Faster installation',
      'Side-effects cache',
    ],
  },
  yarn: {
    type: 'yarn',
    filename: 'yarn.lock',
    format: 'yaml',
    features: [
      'Deterministic resolution',
      'Integrity hashes',
      'Flat mode support',
      'Workspaces support',
    ],
  },
};
```

### Lockfile Versioning Implementation

```typescript
// src/services/dependencies/lockfileVersioning.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

interface LockfileVersion {
  hash: string;
  timestamp: Date;
  packageManager: string;
  packageManagerVersion: string;
  nodeVersion: string;
  dependencyCount: number;
  totalPackages: number;
}

interface LockfileEntry {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

class LockfileVersioningService {
  private projectPath: string;
  private packageManager: 'npm' | 'pnpm' | 'yarn';

  constructor(projectPath: string, packageManager: 'npm' | 'pnpm' | 'yarn' = 'pnpm') {
    this.projectPath = projectPath;
    this.packageManager = packageManager;
  }

  // Get lockfile path based on package manager
  private getLockfilePath(): string {
    const lockfiles = {
      npm: 'package-lock.json',
      pnpm: 'pnpm-lock.yaml',
      yarn: 'yarn.lock',
    };
    return path.join(this.projectPath, lockfiles[this.packageManager]);
  }

  // Generate lockfile hash for versioning
  async generateLockfileHash(): Promise<string> {
    const lockfilePath = this.getLockfilePath();
    const content = await fs.readFile(lockfilePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Get lockfile version info
  async getLockfileVersion(): Promise<LockfileVersion> {
    const lockfilePath = this.getLockfilePath();
    const content = await fs.readFile(lockfilePath, 'utf-8');
    const stats = await fs.stat(lockfilePath);

    // Parse lockfile based on format
    const parsed = this.packageManager === 'npm' 
      ? JSON.parse(content)
      : this.parseYamlLockfile(content);

    // Count dependencies
    const dependencyCount = this.countDependencies(parsed);
    const totalPackages = this.countTotalPackages(parsed);

    return {
      hash: await this.generateLockfileHash(),
      timestamp: stats.mtime,
      packageManager: this.packageManager,
      packageManagerVersion: this.getPackageManagerVersion(),
      nodeVersion: process.version,
      dependencyCount,
      totalPackages,
    };
  }

  // Parse YAML lockfile (pnpm/yarn)
  private parseYamlLockfile(content: string): any {
    // Simple YAML parser for lockfiles
    const lines = content.split('\n');
    const result: any = { packages: {} };
    let currentPackage = '';

    for (const line of lines) {
      if (line.startsWith('/') || line.match(/^[\w@]/)) {
        currentPackage = line.replace(':', '').trim();
        result.packages[currentPackage] = {};
      } else if (line.startsWith('  ') && currentPackage) {
        const [key, value] = line.trim().split(': ');
        if (key && value) {
          result.packages[currentPackage][key] = value.replace(/['"]/g, '');
        }
      }
    }

    return result;
  }

  // Count direct dependencies from package.json
  private countDependencies(parsed: any): number {
    if (this.packageManager === 'npm') {
      return Object.keys(parsed.packages || {}).filter(
        (key) => !key.includes('node_modules/')
      ).length;
    }
    return Object.keys(parsed.packages || {}).length;
  }

  // Count total packages in lockfile
  private countTotalPackages(parsed: any): number {
    if (this.packageManager === 'npm') {
      return Object.keys(parsed.packages || {}).length;
    }
    return Object.keys(parsed.packages || {}).length;
  }

  // Get package manager version
  private getPackageManagerVersion(): string {
    try {
      return execSync(`${this.packageManager} --version`, { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  // Validate lockfile integrity
  async validateLockfileIntegrity(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const lockfilePath = this.getLockfilePath();
      const packageJsonPath = path.join(this.projectPath, 'package.json');

      // Check lockfile exists
      try {
        await fs.access(lockfilePath);
      } catch {
        errors.push(`Lockfile not found: ${lockfilePath}`);
        return { valid: false, errors, warnings };
      }

      // Check package.json exists
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Validate lockfile format
      const lockfileContent = await fs.readFile(lockfilePath, 'utf-8');
      
      if (this.packageManager === 'npm') {
        try {
          const parsed = JSON.parse(lockfileContent);
          if (!parsed.lockfileVersion) {
            warnings.push('Lockfile missing version field');
          }
          if (parsed.lockfileVersion < 2) {
            warnings.push('Lockfile version is outdated, consider upgrading');
          }
        } catch (e) {
          errors.push('Invalid JSON in lockfile');
        }
      }

      // Check for missing dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [name, version] of Object.entries(allDeps)) {
        if (!this.isDependencyInLockfile(lockfileContent, name)) {
          errors.push(`Dependency ${name}@${version} not found in lockfile`);
        }
      }

      // Check for integrity hashes
      if (!lockfileContent.includes('integrity')) {
        warnings.push('Lockfile missing integrity hashes');
      }

    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Check if dependency exists in lockfile
  private isDependencyInLockfile(lockfileContent: string, packageName: string): boolean {
    // Simple check - can be made more sophisticated
    return lockfileContent.includes(packageName);
  }

  // Update lockfile with new dependencies
  async updateLockfile(options: {
    frozen?: boolean;
    preferOffline?: boolean;
    ignoreScripts?: boolean;
  } = {}): Promise<{ success: boolean; output: string }> {
    const { frozen = false, preferOffline = true, ignoreScripts = true } = options;

    const commands = {
      npm: `npm install ${frozen ? '--frozen-lockfile' : ''} ${preferOffline ? '--prefer-offline' : ''} ${ignoreScripts ? '--ignore-scripts' : ''}`,
      pnpm: `pnpm install ${frozen ? '--frozen-lockfile' : ''} ${preferOffline ? '--prefer-offline' : ''} ${ignoreScripts ? '--ignore-scripts' : ''}`,
      yarn: `yarn install ${frozen ? '--frozen-lockfile' : ''} ${preferOffline ? '--prefer-offline' : ''} ${ignoreScripts ? '--ignore-scripts' : ''}`,
    };

    try {
      const output = execSync(commands[this.packageManager], {
        cwd: this.projectPath,
        encoding: 'utf-8',
        timeout: 300000, // 5 minutes
      });
      return { success: true, output };
    } catch (error: any) {
      return { success: false, output: error.message };
    }
  }

  // Create lockfile snapshot for rollback
  async createSnapshot(): Promise<string> {
    const lockfilePath = this.getLockfilePath();
    const content = await fs.readFile(lockfilePath, 'utf-8');
    const hash = await this.generateLockfileHash();
    const snapshotPath = path.join(
      this.projectPath,
      '.lockfile-snapshots',
      `${hash}.snapshot`
    );

    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, content);

    return snapshotPath;
  }

  // Restore lockfile from snapshot
  async restoreSnapshot(snapshotHash: string): Promise<boolean> {
    const snapshotPath = path.join(
      this.projectPath,
      '.lockfile-snapshots',
      `${snapshotHash}.snapshot`
    );

    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const lockfilePath = this.getLockfilePath();
      await fs.writeFile(lockfilePath, content);
      return true;
    } catch {
      return false;
    }
  }
}

export { LockfileVersioningService, LockfileVersion, LockfileEntry };
```

### Lockfile Best Practices

```typescript
// src/services/dependencies/lockfileBestPractices.ts

interface LockfileBestPractice {
  rule: string;
  description: string;
  check: (projectPath: string) => Promise<boolean>;
  fix?: (projectPath: string) => Promise<void>;
}

const LOCKFILE_BEST_PRACTICES: LockfileBestPractice[] = [
  {
    rule: 'COMMIT_LOCKFILE',
    description: 'Always commit lockfile to version control',
    check: async (projectPath) => {
      // Check if lockfile is in .gitignore
      const gitignorePath = path.join(projectPath, '.gitignore');
      try {
        const content = await fs.readFile(gitignorePath, 'utf-8');
        return !content.includes('pnpm-lock.yaml') && 
               !content.includes('package-lock.json') &&
               !content.includes('yarn.lock');
      } catch {
        return true; // No .gitignore, assume OK
      }
    },
  },
  {
    rule: 'USE_FROZEN_LOCKFILE_CI',
    description: 'Use --frozen-lockfile in CI/CD',
    check: async (projectPath) => {
      const ciFiles = ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile'];
      for (const ciFile of ciFiles) {
        const ciPath = path.join(projectPath, ciFile);
        try {
          const content = await fs.readFile(ciPath, 'utf-8');
          return content.includes('frozen-lockfile') || content.includes('ci');
        } catch {
          continue;
        }
      }
      return false;
    },
  },
  {
    rule: 'SINGLE_PACKAGE_MANAGER',
    description: 'Use only one package manager per project',
    check: async (projectPath) => {
      const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
      let count = 0;
      for (const lockfile of lockfiles) {
        try {
          await fs.access(path.join(projectPath, lockfile));
          count++;
        } catch {
          continue;
        }
      }
      return count <= 1;
    },
  },
  {
    rule: 'INTEGRITY_HASHES',
    description: 'Lockfile should contain integrity hashes',
    check: async (projectPath) => {
      const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
      for (const lockfile of lockfiles) {
        try {
          const content = await fs.readFile(path.join(projectPath, lockfile), 'utf-8');
          return content.includes('integrity') || content.includes('sha512');
        } catch {
          continue;
        }
      }
      return false;
    },
  },
  {
    rule: 'NO_FLOATING_VERSIONS',
    description: 'Avoid floating versions (*, latest) in package.json',
    check: async (projectPath) => {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')
      );
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      for (const version of Object.values(allDeps) as string[]) {
        if (version === '*' || version === 'latest' || version.startsWith('>')) {
          return false;
        }
      }
      return true;
    },
  },
];
```

---

## 2. Dependency Conflict Resolution

### Conflict Types

```typescript
// src/services/dependencies/conflictResolver.ts

interface DependencyConflict {
  type: ConflictType;
  package: string;
  versions: string[];
  requestedBy: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution?: ConflictResolution;
}

enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',      // Different versions requested
  PEER_DEPENDENCY = 'peer_dependency',         // Peer dependency not satisfied
  OPTIONAL_MISSING = 'optional_missing',       // Optional dependency missing
  CIRCULAR = 'circular',                       // Circular dependency
  PLATFORM_INCOMPATIBLE = 'platform_incompatible', // OS/arch incompatible
  ENGINE_MISMATCH = 'engine_mismatch',         // Node.js version mismatch
  DEPRECATED = 'deprecated',                   // Package deprecated
  LICENSE_CONFLICT = 'license_conflict',       // License incompatibility
}

interface ConflictResolution {
  strategy: ResolutionStrategy;
  action: string;
  newVersion?: string;
  override?: boolean;
}

enum ResolutionStrategy {
  USE_HIGHEST = 'use_highest',           // Use highest compatible version
  USE_LOWEST = 'use_lowest',             // Use lowest compatible version
  USE_SPECIFIED = 'use_specified',       // Use specifically requested version
  DEDUPE = 'dedupe',                      // Deduplicate to single version
  OVERRIDE = 'override',                  // Force override in package.json
  ALIAS = 'alias',                        // Create package alias
  EXCLUDE = 'exclude',                    // Exclude problematic package
  PATCH = 'patch',                        // Apply patch to fix issue
}

class DependencyConflictResolver {
  private projectPath: string;
  private packageManager: 'npm' | 'pnpm' | 'yarn';

  constructor(projectPath: string, packageManager: 'npm' | 'pnpm' | 'yarn' = 'pnpm') {
    this.projectPath = projectPath;
    this.packageManager = packageManager;
  }

  // Detect all conflicts in project
  async detectConflicts(): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];

    // Run package manager's built-in conflict detection
    const output = await this.runConflictDetection();

    // Parse version mismatches
    conflicts.push(...this.parseVersionMismatches(output));

    // Check peer dependencies
    conflicts.push(...await this.checkPeerDependencies());

    // Check for circular dependencies
    conflicts.push(...await this.checkCircularDependencies());

    // Check engine compatibility
    conflicts.push(...await this.checkEngineCompatibility());

    // Check for deprecated packages
    conflicts.push(...await this.checkDeprecatedPackages());

    // Check license conflicts
    conflicts.push(...await this.checkLicenseConflicts());

    return conflicts;
  }

  // Run package manager conflict detection
  private async runConflictDetection(): Promise<string> {
    const commands = {
      npm: 'npm ls --all --json 2>&1',
      pnpm: 'pnpm ls --json 2>&1',
      yarn: 'yarn list --json 2>&1',
    };

    try {
      return execSync(commands[this.packageManager], {
        cwd: this.projectPath,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });
    } catch (error: any) {
      return error.stdout || error.message;
    }
  }

  // Parse version mismatches from output
  private parseVersionMismatches(output: string): DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];
    
    // Parse npm ERESOLVE errors
    const eresolveMatch = output.match(/ERESOLVE.*?(?=npm ERR!|$)/gs);
    if (eresolveMatch) {
      for (const match of eresolveMatch) {
        const packageMatch = match.match(/Could not resolve dependency:\s*(\S+)/);
        const versionsMatch = match.match(/(\d+\.\d+\.\d+)/g);
        
        if (packageMatch) {
          conflicts.push({
            type: ConflictType.VERSION_MISMATCH,
            package: packageMatch[1],
            versions: versionsMatch || [],
            requestedBy: this.extractRequestedBy(match),
            severity: 'high',
          });
        }
      }
    }

    // Parse peer dependency warnings
    const peerMatch = output.match(/peer dep missing:.*?(?=\n|$)/gi);
    if (peerMatch) {
      for (const match of peerMatch) {
        const packageMatch = match.match(/peer dep missing: (\S+)/);
        if (packageMatch) {
          conflicts.push({
            type: ConflictType.PEER_DEPENDENCY,
            package: packageMatch[1],
            versions: [],
            requestedBy: [],
            severity: 'medium',
          });
        }
      }
    }

    return conflicts;
  }

  // Extract which packages requested the dependency
  private extractRequestedBy(output: string): string[] {
    const requestedBy: string[] = [];
    const matches = output.match(/required by (\S+)/gi);
    if (matches) {
      for (const match of matches) {
        const pkg = match.replace('required by ', '');
        requestedBy.push(pkg);
      }
    }
    return requestedBy;
  }

  // Check peer dependencies
  private async checkPeerDependencies(): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    
    try {
      const output = execSync(`${this.packageManager} ls --json`, {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });
      
      const parsed = JSON.parse(output);
      // Check for unmet peer dependencies
      this.traverseDependencies(parsed, (pkg, info) => {
        if (info.peerDependencies) {
          for (const [peerPkg, peerVersion] of Object.entries(info.peerDependencies)) {
            if (!this.isPeerSatisfied(peerPkg, peerVersion as string, parsed)) {
              conflicts.push({
                type: ConflictType.PEER_DEPENDENCY,
                package: peerPkg,
                versions: [peerVersion as string],
                requestedBy: [pkg],
                severity: 'medium',
              });
            }
          }
        }
      });
    } catch (error) {
      // Ignore parsing errors
    }

    return conflicts;
  }

  // Traverse dependency tree
  private traverseDependencies(
    tree: any,
    callback: (pkg: string, info: any) => void,
    visited = new Set<string>()
  ): void {
    const deps = tree.dependencies || {};
    for (const [pkg, info] of Object.entries(deps) as [string, any][]) {
      if (visited.has(pkg)) continue;
      visited.add(pkg);
      callback(pkg, info);
      if (info.dependencies) {
        this.traverseDependencies({ dependencies: info.dependencies }, callback, visited);
      }
    }
  }

  // Check if peer dependency is satisfied
  private isPeerSatisfied(peerPkg: string, peerVersion: string, tree: any): boolean {
    // Simple check - can be made more sophisticated with semver
    const deps = tree.dependencies || {};
    return peerPkg in deps;
  }

  // Check for circular dependencies
  private async checkCircularDependencies(): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    
    try {
      // Use madge or similar tool for circular dependency detection
      const output = execSync('npx madge --circular --json .', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });
      
      const circular = JSON.parse(output);
      for (const cycle of circular) {
        conflicts.push({
          type: ConflictType.CIRCULAR,
          package: cycle[0],
          versions: [],
          requestedBy: cycle,
          severity: 'high',
        });
      }
    } catch (error) {
      // madge not installed or no circular deps
    }

    return conflicts;
  }

  // Check engine compatibility
  private async checkEngineCompatibility(): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const nodeVersion = process.version;

    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      if (packageJson.engines?.node) {
        const requiredNode = packageJson.engines.node;
        if (!this.satisfiesVersion(nodeVersion, requiredNode)) {
          conflicts.push({
            type: ConflictType.ENGINE_MISMATCH,
            package: 'node',
            versions: [nodeVersion, requiredNode],
            requestedBy: ['package.json'],
            severity: 'critical',
          });
        }
      }
    } catch (error) {
      // Ignore
    }

    return conflicts;
  }

  // Simple version satisfaction check
  private satisfiesVersion(actual: string, required: string): boolean {
    // Simplified - use semver library for production
    const actualNum = actual.replace('v', '').split('.').map(Number);
    const requiredNum = required.replace(/[^0-9.]/g, '').split('.').map(Number);
    
    if (required.startsWith('>=')) {
      return actualNum[0] >= requiredNum[0];
    }
    return true;
  }

  // Check for deprecated packages
  private async checkDeprecatedPackages(): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];

    try {
      const output = execSync('npm outdated --json', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const outdated = JSON.parse(output);
      for (const [pkg, info] of Object.entries(outdated) as [string, any][]) {
        if (info.deprecated) {
          conflicts.push({
            type: ConflictType.DEPRECATED,
            package: pkg,
            versions: [info.current],
            requestedBy: [],
            severity: 'medium',
          });
        }
      }
    } catch (error) {
      // Ignore
    }

    return conflicts;
  }

  // Check license conflicts
  private async checkLicenseConflicts(): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];
    const incompatibleLicenses = ['GPL-3.0', 'AGPL-3.0', 'SSPL'];

    try {
      const output = execSync('npx license-checker --json', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const licenses = JSON.parse(output);
      for (const [pkg, info] of Object.entries(licenses) as [string, any][]) {
        if (incompatibleLicenses.some(l => info.licenses?.includes(l))) {
          conflicts.push({
            type: ConflictType.LICENSE_CONFLICT,
            package: pkg,
            versions: [],
            requestedBy: [],
            severity: 'high',
            resolution: {
              strategy: ResolutionStrategy.EXCLUDE,
              action: `Consider replacing ${pkg} due to license restrictions`,
            },
          });
        }
      }
    } catch (error) {
      // license-checker not installed
    }

    return conflicts;
  }

  // Resolve conflicts automatically
  async resolveConflicts(conflicts: DependencyConflict[]): Promise<{
    resolved: DependencyConflict[];
    unresolved: DependencyConflict[];
  }> {
    const resolved: DependencyConflict[] = [];
    const unresolved: DependencyConflict[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      if (resolution) {
        conflict.resolution = resolution;
        resolved.push(conflict);
      } else {
        unresolved.push(conflict);
      }
    }

    return { resolved, unresolved };
  }

  // Resolve a single conflict
  private async resolveConflict(conflict: DependencyConflict): Promise<ConflictResolution | null> {
    switch (conflict.type) {
      case ConflictType.VERSION_MISMATCH:
        return this.resolveVersionMismatch(conflict);

      case ConflictType.PEER_DEPENDENCY:
        return this.resolvePeerDependency(conflict);

      case ConflictType.DEPRECATED:
        return this.resolveDeprecated(conflict);

      case ConflictType.ENGINE_MISMATCH:
        return null; // Requires manual intervention

      case ConflictType.CIRCULAR:
        return null; // Requires code refactoring

      case ConflictType.LICENSE_CONFLICT:
        return null; // Requires manual decision

      default:
        return null;
    }
  }

  // Resolve version mismatch
  private async resolveVersionMismatch(conflict: DependencyConflict): Promise<ConflictResolution> {
    // Try to find highest compatible version
    const versions = conflict.versions.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
      }
      return 0;
    });

    return {
      strategy: ResolutionStrategy.USE_HIGHEST,
      action: `Update ${conflict.package} to ${versions[0]}`,
      newVersion: versions[0],
    };
  }

  // Resolve peer dependency
  private async resolvePeerDependency(conflict: DependencyConflict): Promise<ConflictResolution> {
    return {
      strategy: ResolutionStrategy.USE_SPECIFIED,
      action: `Install peer dependency: ${conflict.package}@${conflict.versions[0] || 'latest'}`,
      newVersion: conflict.versions[0] || 'latest',
    };
  }

  // Resolve deprecated package
  private async resolveDeprecated(conflict: DependencyConflict): Promise<ConflictResolution> {
    try {
      // Get latest version
      const output = execSync(`npm view ${conflict.package} version`, {
        encoding: 'utf-8',
      });
      const latestVersion = output.trim();

      return {
        strategy: ResolutionStrategy.USE_HIGHEST,
        action: `Update ${conflict.package} to ${latestVersion}`,
        newVersion: latestVersion,
      };
    } catch {
      return {
        strategy: ResolutionStrategy.EXCLUDE,
        action: `Consider removing deprecated package ${conflict.package}`,
      };
    }
  }

  // Apply resolutions to package.json
  async applyResolutions(conflicts: DependencyConflict[]): Promise<void> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    // Add overrides/resolutions based on package manager
    const overridesKey = this.packageManager === 'npm' ? 'overrides' : 
                         this.packageManager === 'pnpm' ? 'pnpm.overrides' : 
                         'resolutions';

    if (!packageJson[overridesKey]) {
      packageJson[overridesKey] = {};
    }

    for (const conflict of conflicts) {
      if (conflict.resolution?.newVersion) {
        packageJson[overridesKey][conflict.package] = conflict.resolution.newVersion;
      }
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Reinstall dependencies
    execSync(`${this.packageManager} install`, {
      cwd: this.projectPath,
      stdio: 'inherit',
    });
  }
}

export { DependencyConflictResolver, DependencyConflict, ConflictType, ResolutionStrategy };
```

---

## 3. Security Vulnerability Scanning

### Vulnerability Scanner Implementation

```typescript
// src/services/dependencies/securityScanner.ts

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface Vulnerability {
  id: string;                    // CVE or advisory ID
  package: string;               // Affected package
  installedVersion: string;      // Currently installed version
  vulnerableVersions: string;    // Vulnerable version range
  patchedVersions: string;       // Fixed version range
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  title: string;                 // Vulnerability title
  description: string;           // Detailed description
  url: string;                   // Reference URL
  cwe: string[];                 // CWE identifiers
  cvss: number;                  // CVSS score (0-10)
  exploitAvailable: boolean;     // Known exploit exists
  fixAvailable: boolean;         // Fix is available
  recommendation: string;        // Recommended action
}

interface ScanResult {
  timestamp: Date;
  projectPath: string;
  packageManager: string;
  totalDependencies: number;
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
  };
  fixable: number;
  breaking: number;
}

interface ScanOptions {
  includeDevDependencies?: boolean;
  severityThreshold?: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  ignoreAdvisories?: string[];
  auditLevel?: 'info' | 'low' | 'moderate' | 'high' | 'critical';
}

class SecurityVulnerabilityScanner {
  private projectPath: string;
  private packageManager: 'npm' | 'pnpm' | 'yarn';

  constructor(projectPath: string, packageManager: 'npm' | 'pnpm' | 'yarn' = 'pnpm') {
    this.projectPath = projectPath;
    this.packageManager = packageManager;
  }

  // Run full security scan
  async scan(options: ScanOptions = {}): Promise<ScanResult> {
    const {
      includeDevDependencies = true,
      severityThreshold = 'info',
      ignoreAdvisories = [],
      auditLevel = 'info',
    } = options;

    // Run package manager audit
    const auditResult = await this.runAudit(auditLevel, includeDevDependencies);

    // Parse vulnerabilities
    let vulnerabilities = this.parseAuditResult(auditResult);

    // Filter by severity threshold
    vulnerabilities = this.filterBySeverity(vulnerabilities, severityThreshold);

    // Filter ignored advisories
    vulnerabilities = vulnerabilities.filter(v => !ignoreAdvisories.includes(v.id));

    // Enrich with additional data
    vulnerabilities = await this.enrichVulnerabilities(vulnerabilities);

    // Calculate summary
    const summary = this.calculateSummary(vulnerabilities);

    // Count fixable vulnerabilities
    const fixable = vulnerabilities.filter(v => v.fixAvailable).length;
    const breaking = vulnerabilities.filter(v => !v.fixAvailable && v.severity === 'critical').length;

    return {
      timestamp: new Date(),
      projectPath: this.projectPath,
      packageManager: this.packageManager,
      totalDependencies: await this.countDependencies(),
      vulnerabilities,
      summary,
      fixable,
      breaking,
    };
  }

  // Run package manager audit command
  private async runAudit(level: string, includeDev: boolean): Promise<string> {
    const commands = {
      npm: `npm audit --json ${includeDev ? '' : '--omit=dev'} --audit-level=${level}`,
      pnpm: `pnpm audit --json ${includeDev ? '' : '--prod'}`,
      yarn: `yarn audit --json ${includeDev ? '' : '--groups dependencies'}`,
    };

    try {
      return execSync(commands[this.packageManager], {
        cwd: this.projectPath,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch (error: any) {
      // npm audit exits with non-zero when vulnerabilities found
      return error.stdout || '{}';
    }
  }

  // Parse audit result based on package manager
  private parseAuditResult(output: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    try {
      if (this.packageManager === 'npm') {
        return this.parseNpmAudit(output);
      } else if (this.packageManager === 'pnpm') {
        return this.parsePnpmAudit(output);
      } else {
        return this.parseYarnAudit(output);
      }
    } catch (error) {
      console.error('Failed to parse audit result:', error);
      return [];
    }
  }

  // Parse npm audit JSON output
  private parseNpmAudit(output: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      const parsed = JSON.parse(output);
      const advisories = parsed.vulnerabilities || parsed.advisories || {};

      for (const [pkg, data] of Object.entries(advisories) as [string, any][]) {
        // Handle npm v7+ format
        if (data.via && Array.isArray(data.via)) {
          for (const via of data.via) {
            if (typeof via === 'object') {
              vulnerabilities.push({
                id: via.source?.toString() || `npm-${pkg}`,
                package: pkg,
                installedVersion: data.version || 'unknown',
                vulnerableVersions: via.range || '*',
                patchedVersions: data.fixAvailable?.version || 'none',
                severity: this.normalizeSeverity(via.severity || data.severity),
                title: via.title || `Vulnerability in ${pkg}`,
                description: via.url || '',
                url: via.url || `https://npmjs.com/advisories/${via.source}`,
                cwe: via.cwe || [],
                cvss: via.cvss?.score || 0,
                exploitAvailable: false,
                fixAvailable: !!data.fixAvailable,
                recommendation: data.fixAvailable 
                  ? `Update to ${data.fixAvailable.version}`
                  : 'No fix available',
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse npm audit:', error);
    }

    return vulnerabilities;
  }

  // Parse pnpm audit JSON output
  private parsePnpmAudit(output: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const parsed = JSON.parse(output);
      const advisories = parsed.advisories || {};

      for (const [id, data] of Object.entries(advisories) as [string, any][]) {
        vulnerabilities.push({
          id: id,
          package: data.module_name,
          installedVersion: data.findings?.[0]?.version || 'unknown',
          vulnerableVersions: data.vulnerable_versions || '*',
          patchedVersions: data.patched_versions || 'none',
          severity: this.normalizeSeverity(data.severity),
          title: data.title,
          description: data.overview || '',
          url: data.url || `https://npmjs.com/advisories/${id}`,
          cwe: data.cwe || [],
          cvss: data.cvss?.score || 0,
          exploitAvailable: false,
          fixAvailable: data.patched_versions !== '<0.0.0',
          recommendation: data.recommendation || 'Update to patched version',
        });
      }
    } catch (error) {
      console.error('Failed to parse pnpm audit:', error);
    }

    return vulnerabilities;
  }

  // Parse yarn audit JSON output
  private parseYarnAudit(output: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Yarn outputs NDJSON (newline-delimited JSON)
      const lines = output.split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'auditAdvisory') {
            const data = parsed.data.advisory;
            vulnerabilities.push({
              id: data.id.toString(),
              package: data.module_name,
              installedVersion: parsed.data.resolution?.path?.split('>').pop() || 'unknown',
              vulnerableVersions: data.vulnerable_versions,
              patchedVersions: data.patched_versions,
              severity: this.normalizeSeverity(data.severity),
              title: data.title,
              description: data.overview,
              url: data.url,
              cwe: data.cwe || [],
              cvss: data.cvss?.score || 0,
              exploitAvailable: false,
              fixAvailable: data.patched_versions !== '<0.0.0',
              recommendation: data.recommendation,
            });
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.error('Failed to parse yarn audit:', error);
    }

    return vulnerabilities;
  }

  // Normalize severity levels across package managers
  private normalizeSeverity(severity: string): Vulnerability['severity'] {
    const normalized = severity?.toLowerCase();
    switch (normalized) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate':
      case 'medium': return 'moderate';
      case 'low': return 'low';
      default: return 'info';
    }
  }

  // Filter vulnerabilities by severity threshold
  private filterBySeverity(
    vulnerabilities: Vulnerability[],
    threshold: Vulnerability['severity']
  ): Vulnerability[] {
    const severityOrder = ['info', 'low', 'moderate', 'high', 'critical'];
    const thresholdIndex = severityOrder.indexOf(threshold);

    return vulnerabilities.filter(v => {
      const vulnIndex = severityOrder.indexOf(v.severity);
      return vulnIndex >= thresholdIndex;
    });
  }

  // Enrich vulnerabilities with additional data
  private async enrichVulnerabilities(vulnerabilities: Vulnerability[]): Promise<Vulnerability[]> {
    // Check for known exploits (simplified - use actual exploit DB in production)
    for (const vuln of vulnerabilities) {
      // Check if CVE has known exploit
      if (vuln.id.startsWith('CVE-')) {
        vuln.exploitAvailable = await this.checkExploitDB(vuln.id);
      }

      // Calculate CVSS if not provided
      if (!vuln.cvss) {
        vuln.cvss = this.estimateCVSS(vuln.severity);
      }
    }

    return vulnerabilities;
  }

  // Check exploit database (simplified)
  private async checkExploitDB(cveId: string): Promise<boolean> {
    // In production, query actual exploit databases like:
    // - Exploit-DB
    // - Metasploit modules
    // - GitHub Security Advisories
    return false;
  }

  // Estimate CVSS score from severity
  private estimateCVSS(severity: Vulnerability['severity']): number {
    const cvssMap = {
      critical: 9.5,
      high: 7.5,
      moderate: 5.5,
      low: 3.0,
      info: 1.0,
    };
    return cvssMap[severity];
  }

  // Calculate summary statistics
  private calculateSummary(vulnerabilities: Vulnerability[]): ScanResult['summary'] {
    return {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length,
      info: vulnerabilities.filter(v => v.severity === 'info').length,
    };
  }

  // Count total dependencies
  private async countDependencies(): Promise<number> {
    try {
      const output = execSync(`${this.packageManager} ls --json --depth=0`, {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });
      const parsed = JSON.parse(output);
      return Object.keys(parsed.dependencies || {}).length;
    } catch {
      return 0;
    }
  }

  // Auto-fix vulnerabilities
  async autoFix(options: {
    force?: boolean;
    dryRun?: boolean;
    breakingChanges?: boolean;
  } = {}): Promise<{
    fixed: Vulnerability[];
    failed: Vulnerability[];
    skipped: Vulnerability[];
  }> {
    const { force = false, dryRun = false, breakingChanges = false } = options;

    const scanResult = await this.scan();
    const fixed: Vulnerability[] = [];
    const failed: Vulnerability[] = [];
    const skipped: Vulnerability[] = [];

    for (const vuln of scanResult.vulnerabilities) {
      if (!vuln.fixAvailable) {
        skipped.push(vuln);
        continue;
      }

      // Skip breaking changes unless explicitly allowed
      if (!breakingChanges && this.isBreakingChange(vuln)) {
        skipped.push(vuln);
        continue;
      }

      if (dryRun) {
        fixed.push(vuln);
        continue;
      }

      try {
        await this.fixVulnerability(vuln, force);
        fixed.push(vuln);
      } catch (error) {
        failed.push(vuln);
      }
    }

    return { fixed, failed, skipped };
  }

  // Check if fix is a breaking change
  private isBreakingChange(vuln: Vulnerability): boolean {
    // Compare major versions
    const installed = vuln.installedVersion.split('.')[0];
    const patched = vuln.patchedVersions.split('.')[0];
    return installed !== patched;
  }

  // Fix a single vulnerability
  private async fixVulnerability(vuln: Vulnerability, force: boolean): Promise<void> {
    const commands = {
      npm: `npm install ${vuln.package}@${vuln.patchedVersions} ${force ? '--force' : ''}`,
      pnpm: `pnpm add ${vuln.package}@${vuln.patchedVersions} ${force ? '--force' : ''}`,
      yarn: `yarn add ${vuln.package}@${vuln.patchedVersions} ${force ? '--force' : ''}`,
    };

    execSync(commands[this.packageManager], {
      cwd: this.projectPath,
      stdio: 'inherit',
    });
  }

  // Generate security report
  async generateReport(format: 'json' | 'html' | 'markdown' = 'markdown'): Promise<string> {
    const scanResult = await this.scan();

    switch (format) {
      case 'json':
        return JSON.stringify(scanResult, null, 2);

      case 'html':
        return this.generateHtmlReport(scanResult);

      case 'markdown':
      default:
        return this.generateMarkdownReport(scanResult);
    }
  }

  // Generate Markdown report
  private generateMarkdownReport(result: ScanResult): string {
    let report = `# Security Vulnerability Report\n\n`;
    report += `**Generated:** ${result.timestamp.toISOString()}\n`;
    report += `**Project:** ${result.projectPath}\n`;
    report += `**Package Manager:** ${result.packageManager}\n`;
    report += `**Total Dependencies:** ${result.totalDependencies}\n\n`;

    report += `## Summary\n\n`;
    report += `| Severity | Count |\n`;
    report += `|----------|-------|\n`;
    report += `| Critical | ${result.summary.critical} |\n`;
    report += `| High | ${result.summary.high} |\n`;
    report += `| Moderate | ${result.summary.moderate} |\n`;
    report += `| Low | ${result.summary.low} |\n`;
    report += `| Info | ${result.summary.info} |\n`;
    report += `| **Total** | **${result.summary.total}** |\n\n`;

    report += `**Fixable:** ${result.fixable}\n`;
    report += `**Breaking:** ${result.breaking}\n\n`;

    if (result.vulnerabilities.length > 0) {
      report += `## Vulnerabilities\n\n`;

      for (const vuln of result.vulnerabilities) {
        report += `### ${vuln.title}\n\n`;
        report += `- **ID:** ${vuln.id}\n`;
        report += `- **Package:** ${vuln.package}\n`;
        report += `- **Installed Version:** ${vuln.installedVersion}\n`;
        report += `- **Severity:** ${vuln.severity.toUpperCase()}\n`;
        report += `- **CVSS:** ${vuln.cvss}\n`;
        report += `- **Fix Available:** ${vuln.fixAvailable ? 'Yes' : 'No'}\n`;
        report += `- **Recommendation:** ${vuln.recommendation}\n`;
        report += `- **URL:** ${vuln.url}\n\n`;
      }
    }

    return report;
  }

  // Generate HTML report
  private generateHtmlReport(result: ScanResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Security Vulnerability Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .critical { color: #d32f2f; }
    .high { color: #f57c00; }
    .moderate { color: #fbc02d; }
    .low { color: #388e3c; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Security Vulnerability Report</h1>
  <p><strong>Generated:</strong> ${result.timestamp.toISOString()}</p>
  <p><strong>Total Vulnerabilities:</strong> ${result.summary.total}</p>
  
  <h2>Summary</h2>
  <table>
    <tr><th>Severity</th><th>Count</th></tr>
    <tr><td class="critical">Critical</td><td>${result.summary.critical}</td></tr>
    <tr><td class="high">High</td><td>${result.summary.high}</td></tr>
    <tr><td class="moderate">Moderate</td><td>${result.summary.moderate}</td></tr>
    <tr><td class="low">Low</td><td>${result.summary.low}</td></tr>
  </table>

  <h2>Vulnerabilities</h2>
  <table>
    <tr>
      <th>Package</th>
      <th>Severity</th>
      <th>Title</th>
      <th>Fix Available</th>
    </tr>
    ${result.vulnerabilities.map(v => `
    <tr>
      <td>${v.package}</td>
      <td class="${v.severity}">${v.severity}</td>
      <td>${v.title}</td>
      <td>${v.fixAvailable ? 'Yes' : 'No'}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
    `;
  }
}

export { SecurityVulnerabilityScanner, Vulnerability, ScanResult, ScanOptions };
```

### Continuous Security Scanning

```typescript
// src/services/dependencies/continuousScanning.ts

interface ScanSchedule {
  projectId: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  lastScan: Date;
  nextScan: Date;
  alertThreshold: 'info' | 'low' | 'moderate' | 'high' | 'critical';
  notifyChannels: ('email' | 'slack' | 'webhook')[];
}

interface ScanAlert {
  projectId: string;
  timestamp: Date;
  newVulnerabilities: Vulnerability[];
  fixedVulnerabilities: Vulnerability[];
  summary: ScanResult['summary'];
}

class ContinuousSecurityScanner {
  private schedules: Map<string, ScanSchedule> = new Map();
  private previousResults: Map<string, ScanResult> = new Map();

  // Schedule continuous scanning for a project
  scheduleScanning(
    projectId: string,
    projectPath: string,
    options: Partial<ScanSchedule>
  ): void {
    const schedule: ScanSchedule = {
      projectId,
      frequency: options.frequency || 'daily',
      lastScan: new Date(0),
      nextScan: new Date(),
      alertThreshold: options.alertThreshold || 'high',
      notifyChannels: options.notifyChannels || ['email'],
    };

    this.schedules.set(projectId, schedule);
  }

  // Run scheduled scans
  async runScheduledScans(): Promise<void> {
    const now = new Date();

    for (const [projectId, schedule] of this.schedules) {
      if (now >= schedule.nextScan) {
        await this.runScanAndAlert(projectId, schedule);
        
        // Update next scan time
        schedule.lastScan = now;
        schedule.nextScan = this.calculateNextScan(now, schedule.frequency);
      }
    }
  }

  // Run scan and send alerts if needed
  private async runScanAndAlert(projectId: string, schedule: ScanSchedule): Promise<void> {
    const scanner = new SecurityVulnerabilityScanner(`/projects/${projectId}`);
    const result = await scanner.scan({ severityThreshold: schedule.alertThreshold });

    // Compare with previous results
    const previousResult = this.previousResults.get(projectId);
    const alert = this.generateAlert(projectId, result, previousResult);

    // Send alerts if new vulnerabilities found
    if (alert.newVulnerabilities.length > 0) {
      await this.sendAlerts(alert, schedule.notifyChannels);
    }

    // Store current result for next comparison
    this.previousResults.set(projectId, result);
  }

  // Generate alert by comparing results
  private generateAlert(
    projectId: string,
    current: ScanResult,
    previous?: ScanResult
  ): ScanAlert {
    const previousVulnIds = new Set(previous?.vulnerabilities.map(v => v.id) || []);
    const currentVulnIds = new Set(current.vulnerabilities.map(v => v.id));

    const newVulnerabilities = current.vulnerabilities.filter(
      v => !previousVulnIds.has(v.id)
    );

    const fixedVulnerabilities = (previous?.vulnerabilities || []).filter(
      v => !currentVulnIds.has(v.id)
    );

    return {
      projectId,
      timestamp: new Date(),
      newVulnerabilities,
      fixedVulnerabilities,
      summary: current.summary,
    };
  }

  // Calculate next scan time
  private calculateNextScan(from: Date, frequency: ScanSchedule['frequency']): Date {
    const next = new Date(from);
    switch (frequency) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
    }
    return next;
  }

  // Send alerts through configured channels
  private async sendAlerts(
    alert: ScanAlert,
    channels: ScanSchedule['notifyChannels']
  ): Promise<void> {
    for (const channel of channels) {
      switch (channel) {
        case 'email':
          await this.sendEmailAlert(alert);
          break;
        case 'slack':
          await this.sendSlackAlert(alert);
          break;
        case 'webhook':
          await this.sendWebhookAlert(alert);
          break;
      }
    }
  }

  // Send email alert
  private async sendEmailAlert(alert: ScanAlert): Promise<void> {
    // Implementation depends on email service
    console.log(`Email alert for ${alert.projectId}: ${alert.newVulnerabilities.length} new vulnerabilities`);
  }

  // Send Slack alert
  private async sendSlackAlert(alert: ScanAlert): Promise<void> {
    const message = {
      text: `🚨 Security Alert for ${alert.projectId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New Vulnerabilities Found:* ${alert.newVulnerabilities.length}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Critical:* ${alert.summary.critical}` },
            { type: 'mrkdwn', text: `*High:* ${alert.summary.high}` },
            { type: 'mrkdwn', text: `*Moderate:* ${alert.summary.moderate}` },
            { type: 'mrkdwn', text: `*Low:* ${alert.summary.low}` },
          ],
        },
      ],
    };

    // Send to Slack webhook
    console.log('Slack alert:', JSON.stringify(message));
  }

  // Send webhook alert
  private async sendWebhookAlert(alert: ScanAlert): Promise<void> {
    // Send to configured webhook URL
    console.log('Webhook alert:', JSON.stringify(alert));
  }
}

export { ContinuousSecurityScanner, ScanSchedule, ScanAlert };
```

---

## 4. Dependency Update Automation

### Automated Dependency Updates

```typescript
// src/services/dependencies/autoUpdater.ts

interface UpdatePolicy {
  packagePattern: string;      // Glob pattern for packages
  updateType: 'patch' | 'minor' | 'major' | 'all';
  autoMerge: boolean;
  requireTests: boolean;
  requireReview: boolean;
  schedule: 'daily' | 'weekly' | 'monthly';
}

interface UpdateResult {
  package: string;
  from: string;
  to: string;
  updateType: 'patch' | 'minor' | 'major';
  success: boolean;
  testsPassed?: boolean;
  error?: string;
}

class DependencyAutoUpdater {
  private projectPath: string;
  private packageManager: 'npm' | 'pnpm' | 'yarn';
  private policies: UpdatePolicy[];

  constructor(
    projectPath: string,
    packageManager: 'npm' | 'pnpm' | 'yarn' = 'pnpm',
    policies: UpdatePolicy[] = []
  ) {
    this.projectPath = projectPath;
    this.packageManager = packageManager;
    this.policies = policies.length > 0 ? policies : this.getDefaultPolicies();
  }

  // Default update policies
  private getDefaultPolicies(): UpdatePolicy[] {
    return [
      {
        packagePattern: '*',
        updateType: 'patch',
        autoMerge: true,
        requireTests: true,
        requireReview: false,
        schedule: 'daily',
      },
      {
        packagePattern: '*',
        updateType: 'minor',
        autoMerge: false,
        requireTests: true,
        requireReview: true,
        schedule: 'weekly',
      },
      {
        packagePattern: '*',
        updateType: 'major',
        autoMerge: false,
        requireTests: true,
        requireReview: true,
        schedule: 'monthly',
      },
    ];
  }

  // Check for available updates
  async checkUpdates(): Promise<{
    package: string;
    current: string;
    latest: string;
    updateType: 'patch' | 'minor' | 'major';
  }[]> {
    const updates: any[] = [];

    try {
      const output = execSync(`${this.packageManager} outdated --json`, {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const outdated = JSON.parse(output);

      for (const [pkg, info] of Object.entries(outdated) as [string, any][]) {
        const current = info.current || info.version;
        const latest = info.latest;
        const updateType = this.determineUpdateType(current, latest);

        updates.push({
          package: pkg,
          current,
          latest,
          updateType,
        });
      }
    } catch (error: any) {
      // npm outdated exits with non-zero when updates available
      if (error.stdout) {
        try {
          const outdated = JSON.parse(error.stdout);
          for (const [pkg, info] of Object.entries(outdated) as [string, any][]) {
            updates.push({
              package: pkg,
              current: info.current,
              latest: info.latest,
              updateType: this.determineUpdateType(info.current, info.latest),
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return updates;
  }

  // Determine update type (patch, minor, major)
  private determineUpdateType(current: string, latest: string): 'patch' | 'minor' | 'major' {
    const currentParts = current.replace(/[^0-9.]/g, '').split('.').map(Number);
    const latestParts = latest.replace(/[^0-9.]/g, '').split('.').map(Number);

    if (latestParts[0] > currentParts[0]) return 'major';
    if (latestParts[1] > currentParts[1]) return 'minor';
    return 'patch';
  }

  // Apply updates based on policies
  async applyUpdates(options: {
    dryRun?: boolean;
    updateTypes?: ('patch' | 'minor' | 'major')[];
  } = {}): Promise<UpdateResult[]> {
    const { dryRun = false, updateTypes = ['patch'] } = options;
    const results: UpdateResult[] = [];

    const updates = await this.checkUpdates();
    const filteredUpdates = updates.filter(u => updateTypes.includes(u.updateType));

    for (const update of filteredUpdates) {
      const policy = this.findMatchingPolicy(update.package, update.updateType);
      
      if (!policy) {
        results.push({
          ...update,
          from: update.current,
          to: update.latest,
          success: false,
          error: 'No matching policy',
        });
        continue;
      }

      if (dryRun) {
        results.push({
          ...update,
          from: update.current,
          to: update.latest,
          success: true,
        });
        continue;
      }

      try {
        // Apply update
        await this.updatePackage(update.package, update.latest);

        // Run tests if required
        let testsPassed = true;
        if (policy.requireTests) {
          testsPassed = await this.runTests();
        }

        if (!testsPassed) {
          // Rollback on test failure
          await this.updatePackage(update.package, update.current);
          results.push({
            ...update,
            from: update.current,
            to: update.latest,
            success: false,
            testsPassed: false,
            error: 'Tests failed',
          });
        } else {
          results.push({
            ...update,
            from: update.current,
            to: update.latest,
            success: true,
            testsPassed: true,
          });
        }
      } catch (error: any) {
        results.push({
          ...update,
          from: update.current,
          to: update.latest,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Find matching policy for a package
  private findMatchingPolicy(packageName: string, updateType: string): UpdatePolicy | undefined {
    return this.policies.find(p => {
      const patternMatch = this.matchGlob(packageName, p.packagePattern);
      const typeMatch = p.updateType === 'all' || p.updateType === updateType;
      return patternMatch && typeMatch;
    });
  }

  // Simple glob matching
  private matchGlob(str: string, pattern: string): boolean {
    if (pattern === '*') return true;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(str);
  }

  // Update a single package
  private async updatePackage(packageName: string, version: string): Promise<void> {
    const commands = {
      npm: `npm install ${packageName}@${version}`,
      pnpm: `pnpm add ${packageName}@${version}`,
      yarn: `yarn add ${packageName}@${version}`,
    };

    execSync(commands[this.packageManager], {
      cwd: this.projectPath,
      stdio: 'inherit',
    });
  }

  // Run project tests
  private async runTests(): Promise<boolean> {
    try {
      execSync('npm test', {
        cwd: this.projectPath,
        stdio: 'inherit',
        timeout: 300000, // 5 minutes
      });
      return true;
    } catch {
      return false;
    }
  }
}

export { DependencyAutoUpdater, UpdatePolicy, UpdateResult };
```

---

## 5. Dependency Caching

### Multi-Level Caching Strategy

```typescript
// src/services/dependencies/dependencyCache.ts

interface CacheEntry {
  key: string;
  hash: string;
  path: string;
  size: number;
  createdAt: Date;
  lastAccessed: Date;
  hitCount: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  avgAccessTime: number;
}

class DependencyCache {
  private cacheDir: string;
  private maxSize: number; // bytes
  private entries: Map<string, CacheEntry> = new Map();

  constructor(cacheDir: string = '/cache/dependencies', maxSize: number = 10 * 1024 * 1024 * 1024) {
    this.cacheDir = cacheDir;
    this.maxSize = maxSize;
  }

  // Generate cache key from lockfile
  async generateCacheKey(projectPath: string): Promise<string> {
    const lockfilePath = path.join(projectPath, 'pnpm-lock.yaml');
    const content = await fs.readFile(lockfilePath, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `deps-${hash.substring(0, 16)}`;
  }

  // Check if cache exists for lockfile
  async hasCache(cacheKey: string): Promise<boolean> {
    const entry = this.entries.get(cacheKey);
    if (!entry) return false;

    // Verify cache file exists
    try {
      await fs.access(entry.path);
      return true;
    } catch {
      this.entries.delete(cacheKey);
      return false;
    }
  }

  // Get cached dependencies
  async getCache(cacheKey: string): Promise<string | null> {
    const entry = this.entries.get(cacheKey);
    if (!entry) return null;

    try {
      // Update access stats
      entry.lastAccessed = new Date();
      entry.hitCount++;

      return entry.path;
    } catch {
      return null;
    }
  }

  // Store dependencies in cache
  async setCache(cacheKey: string, nodeModulesPath: string): Promise<void> {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.tar.gz`);

    // Compress node_modules
    execSync(`tar -czf ${cachePath} -C ${path.dirname(nodeModulesPath)} node_modules`, {
      encoding: 'utf-8',
    });

    const stats = await fs.stat(cachePath);

    const entry: CacheEntry = {
      key: cacheKey,
      hash: cacheKey,
      path: cachePath,
      size: stats.size,
      createdAt: new Date(),
      lastAccessed: new Date(),
      hitCount: 0,
    };

    this.entries.set(cacheKey, entry);

    // Evict old entries if needed
    await this.evictIfNeeded();
  }

  // Restore cached dependencies
  async restoreCache(cacheKey: string, targetPath: string): Promise<boolean> {
    const entry = this.entries.get(cacheKey);
    if (!entry) return false;

    try {
      // Extract cached node_modules
      execSync(`tar -xzf ${entry.path} -C ${targetPath}`, {
        encoding: 'utf-8',
      });

      // Update access stats
      entry.lastAccessed = new Date();
      entry.hitCount++;

      return true;
    } catch {
      return false;
    }
  }

  // Evict old entries if cache exceeds max size
  private async evictIfNeeded(): Promise<void> {
    let totalSize = 0;
    for (const entry of this.entries.values()) {
      totalSize += entry.size;
    }

    if (totalSize <= this.maxSize) return;

    // Sort by last accessed (LRU)
    const sorted = [...this.entries.entries()].sort(
      (a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
    );

    // Evict until under max size
    for (const [key, entry] of sorted) {
      if (totalSize <= this.maxSize * 0.8) break; // Keep 20% buffer

      try {
        await fs.unlink(entry.path);
        this.entries.delete(key);
        totalSize -= entry.size;
      } catch {
        // Ignore deletion errors
      }
    }
  }

  // Get cache statistics
  getStats(): CacheStats {
    let totalSize = 0;
    let totalHits = 0;
    let totalAccesses = 0;

    for (const entry of this.entries.values()) {
      totalSize += entry.size;
      totalHits += entry.hitCount;
      totalAccesses += entry.hitCount + 1; // +1 for initial miss
    }

    return {
      totalEntries: this.entries.size,
      totalSize,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      missRate: totalAccesses > 0 ? 1 - (totalHits / totalAccesses) : 1,
      avgAccessTime: 0, // Would need timing instrumentation
    };
  }

  // Clear entire cache
  async clearCache(): Promise<void> {
    for (const entry of this.entries.values()) {
      try {
        await fs.unlink(entry.path);
      } catch {
        // Ignore
      }
    }
    this.entries.clear();
  }
}

export { DependencyCache, CacheEntry, CacheStats };
```

---

## 6. Best Practices

### Dependency Management Best Practices

```typescript
// src/services/dependencies/bestPractices.ts

const DEPENDENCY_BEST_PRACTICES = {
  lockfile: [
    'Always commit lockfile to version control',
    'Use --frozen-lockfile in CI/CD',
    'Use only one package manager per project',
    'Ensure lockfile contains integrity hashes',
    'Avoid floating versions (*, latest)',
  ],
  
  security: [
    'Run security scans on every PR',
    'Set up continuous vulnerability monitoring',
    'Auto-fix patch-level vulnerabilities',
    'Review and approve minor/major updates',
    'Block deploys with critical vulnerabilities',
  ],
  
  updates: [
    'Apply patch updates automatically',
    'Review minor updates weekly',
    'Plan major updates monthly',
    'Always run tests after updates',
    'Keep dependencies up to date',
  ],
  
  caching: [
    'Cache node_modules based on lockfile hash',
    'Use multi-level caching (local, CI, CDN)',
    'Implement LRU eviction policy',
    'Monitor cache hit rates',
    'Clear cache on major updates',
  ],
  
  conflicts: [
    'Use overrides/resolutions for conflicts',
    'Prefer deduplication over aliasing',
    'Document conflict resolutions',
    'Test thoroughly after resolution',
    'Monitor for regression',
  ],
};

export { DEPENDENCY_BEST_PRACTICES };
```

---

## Summary

### Key Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **Lockfile Versioning** | Reproducible builds | Hash-based versioning, integrity validation, snapshots |
| **Conflict Resolution** | Resolve dependency conflicts | 8 conflict types, 8 resolution strategies, auto-fix |
| **Security Scanning** | Vulnerability detection | Multi-source scanning, CVSS scoring, auto-fix |
| **Auto Updates** | Keep dependencies current | Policy-based updates, test-gated, rollback support |
| **Caching** | Fast installations | LRU eviction, compression, multi-level cache |

### Recommended Stack

- **Package Manager**: pnpm (fastest, most efficient)
- **Lockfile**: pnpm-lock.yaml (content-addressable)
- **Security**: npm audit + Snyk + GitHub Advisory
- **Updates**: Dependabot + custom policies
- **Caching**: Multi-level (local + CI + CDN)

### Implementation Checklist

- [ ] Set up lockfile versioning
- [ ] Implement conflict detection
- [ ] Configure security scanning
- [ ] Set up auto-update policies
- [ ] Implement dependency caching
- [ ] Configure CI/CD integration
- [ ] Set up monitoring and alerts
- [ ] Document policies and procedures
