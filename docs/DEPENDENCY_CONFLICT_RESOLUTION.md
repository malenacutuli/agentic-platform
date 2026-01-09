# Dependency Conflict Resolution

This guide covers how the platform handles dependency conflicts between template dependencies and user additions, including package.json merging strategies, version resolution algorithms, and conflict detection and resolution mechanisms.

---

## Table of Contents

1. [Conflict Overview](#conflict-overview)
2. [Package.json Merging](#packagejson-merging)
3. [Version Resolution](#version-resolution)
4. [Conflict Detection](#conflict-detection)
5. [Resolution Strategies](#resolution-strategies)
6. [Lockfile Handling](#lockfile-handling)
7. [Peer Dependencies](#peer-dependencies)
8. [Monorepo Considerations](#monorepo-considerations)

---

## Conflict Overview

### Types of Conflicts

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY CONFLICT TYPES                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. VERSION CONFLICT                                                                    │
│     Template: "react": "^18.2.0"                                                       │
│     User adds: "react": "^17.0.2"                                                      │
│     → Incompatible major versions                                                       │
│                                                                                         │
│  2. PEER DEPENDENCY CONFLICT                                                            │
│     Template: "next": "14.0.0" (requires react ^18)                                    │
│     User adds: "some-lib" (requires react ^17)                                         │
│     → Peer dependency mismatch                                                          │
│                                                                                         │
│  3. DUPLICATE DEPENDENCY                                                                │
│     Template: "lodash": "^4.17.21"                                                     │
│     User adds: "lodash": "^4.17.21"                                                    │
│     → Same version, no conflict (dedupe)                                               │
│                                                                                         │
│  4. TRANSITIVE CONFLICT                                                                 │
│     Template dep A requires: "typescript": "^5.0.0"                                    │
│     User dep B requires: "typescript": "^4.9.0"                                        │
│     → Indirect version conflict                                                         │
│                                                                                         │
│  5. SCRIPT CONFLICT                                                                     │
│     Template: "scripts": { "build": "vite build" }                                     │
│     User adds: "scripts": { "build": "webpack build" }                                 │
│     → Script name collision                                                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Conflict Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Critical** | Breaking incompatibility | Block merge, require resolution |
| **Warning** | Potential issues | Warn user, suggest resolution |
| **Info** | Minor differences | Auto-resolve, log decision |
| **None** | Compatible | Merge silently |

---

## Package.json Merging

### Merge Strategy Overview

```typescript
// dependencies/merger.ts

interface MergeStrategy {
  dependencies: 'template' | 'user' | 'latest' | 'interactive';
  devDependencies: 'template' | 'user' | 'latest' | 'interactive';
  scripts: 'template' | 'user' | 'merge' | 'interactive';
  other: 'template' | 'user' | 'deep-merge';
}

const defaultMergeStrategy: MergeStrategy = {
  dependencies: 'latest',        // Use latest compatible version
  devDependencies: 'latest',     // Use latest compatible version
  scripts: 'merge',              // Merge with prefix for conflicts
  other: 'deep-merge',           // Deep merge other fields
};
```

### Complete Merger Implementation

```typescript
// dependencies/package-merger.ts

import semver from 'semver';
import deepmerge from 'deepmerge';

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

interface MergeResult {
  merged: PackageJson;
  conflicts: Conflict[];
  resolutions: Resolution[];
  warnings: string[];
}

interface Conflict {
  type: 'version' | 'peer' | 'script' | 'field';
  field: string;
  package?: string;
  templateValue: string;
  userValue: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion?: string;
}

interface Resolution {
  field: string;
  package?: string;
  originalTemplate: string;
  originalUser: string;
  resolved: string;
  reason: string;
}

class PackageJsonMerger {
  private strategy: MergeStrategy;
  private conflicts: Conflict[] = [];
  private resolutions: Resolution[] = [];
  private warnings: string[] = [];

  constructor(strategy: Partial<MergeStrategy> = {}) {
    this.strategy = { ...defaultMergeStrategy, ...strategy };
  }

  /**
   * Merge template and user package.json
   */
  async merge(
    templatePkg: PackageJson,
    userPkg: PackageJson
  ): Promise<MergeResult> {
    this.conflicts = [];
    this.resolutions = [];
    this.warnings = [];

    const merged: PackageJson = {
      // User values take precedence for identity fields
      name: userPkg.name || templatePkg.name,
      version: userPkg.version || templatePkg.version || '0.1.0',
      description: userPkg.description || templatePkg.description,
      
      // Merge dependencies
      dependencies: await this.mergeDependencies(
        templatePkg.dependencies || {},
        userPkg.dependencies || {},
        'dependencies'
      ),
      
      devDependencies: await this.mergeDependencies(
        templatePkg.devDependencies || {},
        userPkg.devDependencies || {},
        'devDependencies'
      ),
      
      peerDependencies: this.mergePeerDependencies(
        templatePkg.peerDependencies || {},
        userPkg.peerDependencies || {}
      ),
      
      // Merge scripts
      scripts: this.mergeScripts(
        templatePkg.scripts || {},
        userPkg.scripts || {}
      ),
    };

    // Deep merge other fields
    const otherFields = this.mergeOtherFields(templatePkg, userPkg);
    Object.assign(merged, otherFields);

    return {
      merged,
      conflicts: this.conflicts,
      resolutions: this.resolutions,
      warnings: this.warnings,
    };
  }

  /**
   * Merge dependencies with conflict resolution
   */
  private async mergeDependencies(
    templateDeps: Record<string, string>,
    userDeps: Record<string, string>,
    field: string
  ): Promise<Record<string, string>> {
    const merged: Record<string, string> = {};
    const allPackages = new Set([
      ...Object.keys(templateDeps),
      ...Object.keys(userDeps),
    ]);

    for (const pkg of allPackages) {
      const templateVersion = templateDeps[pkg];
      const userVersion = userDeps[pkg];

      if (templateVersion && userVersion) {
        // Both have the package - resolve conflict
        const resolved = await this.resolveVersionConflict(
          pkg,
          templateVersion,
          userVersion,
          field
        );
        merged[pkg] = resolved;
      } else {
        // Only one has it - use that version
        merged[pkg] = templateVersion || userVersion;
      }
    }

    return merged;
  }

  /**
   * Resolve version conflict between template and user
   */
  private async resolveVersionConflict(
    pkg: string,
    templateVersion: string,
    userVersion: string,
    field: string
  ): Promise<string> {
    // Normalize versions
    const templateRange = this.normalizeVersion(templateVersion);
    const userRange = this.normalizeVersion(userVersion);

    // Check if versions are compatible
    if (this.areVersionsCompatible(templateRange, userRange)) {
      // Use the more restrictive (higher minimum) version
      const resolved = this.selectHigherMinimum(templateRange, userRange);
      
      this.resolutions.push({
        field,
        package: pkg,
        originalTemplate: templateVersion,
        originalUser: userVersion,
        resolved,
        reason: 'Compatible versions - selected higher minimum',
      });
      
      return resolved;
    }

    // Versions are incompatible
    const templateMajor = semver.major(semver.minVersion(templateRange) || '0.0.0');
    const userMajor = semver.major(semver.minVersion(userRange) || '0.0.0');

    if (templateMajor !== userMajor) {
      // Major version conflict
      this.conflicts.push({
        type: 'version',
        field,
        package: pkg,
        templateValue: templateVersion,
        userValue: userVersion,
        severity: 'critical',
        suggestion: `Consider upgrading to ${pkg}@^${Math.max(templateMajor, userMajor)}.0.0`,
      });

      // Strategy-based resolution
      switch (this.strategy.dependencies) {
        case 'template':
          return templateVersion;
        case 'user':
          return userVersion;
        case 'latest':
          return await this.fetchLatestVersion(pkg);
        default:
          // Default to template for safety
          return templateVersion;
      }
    }

    // Minor/patch conflict - use higher version
    const resolved = this.selectHigherMinimum(templateRange, userRange);
    
    this.resolutions.push({
      field,
      package: pkg,
      originalTemplate: templateVersion,
      originalUser: userVersion,
      resolved,
      reason: 'Minor version difference - selected higher version',
    });

    return resolved;
  }

  /**
   * Check if two version ranges are compatible
   */
  private areVersionsCompatible(range1: string, range2: string): boolean {
    try {
      // Check if there's any version that satisfies both ranges
      const min1 = semver.minVersion(range1);
      const min2 = semver.minVersion(range2);
      
      if (!min1 || !min2) return false;
      
      return (
        semver.satisfies(min1, range2) ||
        semver.satisfies(min2, range1)
      );
    } catch {
      return false;
    }
  }

  /**
   * Select the version with higher minimum
   */
  private selectHigherMinimum(range1: string, range2: string): string {
    const min1 = semver.minVersion(range1);
    const min2 = semver.minVersion(range2);
    
    if (!min1) return range2;
    if (!min2) return range1;
    
    return semver.gt(min1, min2) ? range1 : range2;
  }

  /**
   * Normalize version string
   */
  private normalizeVersion(version: string): string {
    // Handle workspace protocol
    if (version.startsWith('workspace:')) {
      return '*';
    }
    
    // Handle npm: protocol
    if (version.startsWith('npm:')) {
      const match = version.match(/npm:.*@(.+)/);
      return match ? match[1] : '*';
    }
    
    // Handle git URLs
    if (version.includes('github.com') || version.startsWith('git+')) {
      return '*';
    }
    
    // Handle file: protocol
    if (version.startsWith('file:')) {
      return '*';
    }
    
    return version;
  }

  /**
   * Fetch latest version from npm registry
   */
  private async fetchLatestVersion(pkg: string): Promise<string> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
      const data = await response.json();
      return `^${data.version}`;
    } catch {
      this.warnings.push(`Failed to fetch latest version for ${pkg}`);
      return '*';
    }
  }

  /**
   * Merge peer dependencies
   */
  private mergePeerDependencies(
    templatePeers: Record<string, string>,
    userPeers: Record<string, string>
  ): Record<string, string> {
    // For peer dependencies, template takes precedence
    // as they define the expected environment
    return { ...userPeers, ...templatePeers };
  }

  /**
   * Merge scripts with conflict handling
   */
  private mergeScripts(
    templateScripts: Record<string, string>,
    userScripts: Record<string, string>
  ): Record<string, string> {
    const merged: Record<string, string> = {};
    const allScripts = new Set([
      ...Object.keys(templateScripts),
      ...Object.keys(userScripts),
    ]);

    for (const script of allScripts) {
      const templateCmd = templateScripts[script];
      const userCmd = userScripts[script];

      if (templateCmd && userCmd && templateCmd !== userCmd) {
        // Script conflict
        switch (this.strategy.scripts) {
          case 'template':
            merged[script] = templateCmd;
            break;
          case 'user':
            merged[script] = userCmd;
            break;
          case 'merge':
            // Keep both with prefixes
            merged[script] = templateCmd;
            merged[`user:${script}`] = userCmd;
            this.warnings.push(
              `Script "${script}" conflict: template version kept, user version saved as "user:${script}"`
            );
            break;
          default:
            merged[script] = templateCmd;
        }

        this.conflicts.push({
          type: 'script',
          field: 'scripts',
          package: script,
          templateValue: templateCmd,
          userValue: userCmd,
          severity: 'warning',
          suggestion: `Review and merge scripts manually`,
        });
      } else {
        merged[script] = templateCmd || userCmd;
      }
    }

    return merged;
  }

  /**
   * Deep merge other package.json fields
   */
  private mergeOtherFields(
    templatePkg: PackageJson,
    userPkg: PackageJson
  ): Partial<PackageJson> {
    const excludeFields = [
      'name', 'version', 'description',
      'dependencies', 'devDependencies', 'peerDependencies',
      'scripts',
    ];

    const templateOther: Record<string, unknown> = {};
    const userOther: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(templatePkg)) {
      if (!excludeFields.includes(key)) {
        templateOther[key] = value;
      }
    }

    for (const [key, value] of Object.entries(userPkg)) {
      if (!excludeFields.includes(key)) {
        userOther[key] = value;
      }
    }

    // Deep merge with user taking precedence
    return deepmerge(templateOther, userOther, {
      arrayMerge: (target, source) => [...new Set([...target, ...source])],
    });
  }
}

export { PackageJsonMerger, MergeResult, Conflict, Resolution };
```

---

## Version Resolution

### Resolution Algorithm

```typescript
// dependencies/version-resolver.ts

import semver from 'semver';

interface VersionConstraint {
  package: string;
  range: string;
  source: 'template' | 'user' | 'transitive';
  requiredBy?: string;
}

interface ResolvedVersion {
  package: string;
  version: string;
  constraints: VersionConstraint[];
  satisfiesAll: boolean;
}

class VersionResolver {
  private constraints: Map<string, VersionConstraint[]> = new Map();
  private resolved: Map<string, string> = new Map();

  /**
   * Add version constraint
   */
  addConstraint(constraint: VersionConstraint): void {
    const existing = this.constraints.get(constraint.package) || [];
    existing.push(constraint);
    this.constraints.set(constraint.package, existing);
  }

  /**
   * Resolve all versions
   */
  async resolveAll(): Promise<Map<string, ResolvedVersion>> {
    const results = new Map<string, ResolvedVersion>();

    for (const [pkg, constraints] of this.constraints) {
      const resolved = await this.resolvePackage(pkg, constraints);
      results.set(pkg, resolved);
    }

    return results;
  }

  /**
   * Resolve single package version
   */
  private async resolvePackage(
    pkg: string,
    constraints: VersionConstraint[]
  ): Promise<ResolvedVersion> {
    // Get all available versions
    const availableVersions = await this.fetchAvailableVersions(pkg);
    
    // Find version that satisfies all constraints
    const satisfyingVersion = this.findSatisfyingVersion(
      availableVersions,
      constraints
    );

    if (satisfyingVersion) {
      return {
        package: pkg,
        version: satisfyingVersion,
        constraints,
        satisfiesAll: true,
      };
    }

    // No version satisfies all - find best compromise
    const bestVersion = this.findBestCompromise(
      availableVersions,
      constraints
    );

    return {
      package: pkg,
      version: bestVersion,
      constraints,
      satisfiesAll: false,
    };
  }

  /**
   * Find version satisfying all constraints
   */
  private findSatisfyingVersion(
    versions: string[],
    constraints: VersionConstraint[]
  ): string | null {
    // Sort versions descending (prefer latest)
    const sorted = versions.sort((a, b) => semver.rcompare(a, b));

    for (const version of sorted) {
      const satisfiesAll = constraints.every((c) =>
        semver.satisfies(version, c.range)
      );
      
      if (satisfiesAll) {
        return version;
      }
    }

    return null;
  }

  /**
   * Find best compromise when no version satisfies all
   */
  private findBestCompromise(
    versions: string[],
    constraints: VersionConstraint[]
  ): string {
    // Score each version by how many constraints it satisfies
    const scored = versions.map((version) => {
      const satisfied = constraints.filter((c) =>
        semver.satisfies(version, c.range)
      );
      
      // Weight by source priority
      const score = satisfied.reduce((sum, c) => {
        const weight = c.source === 'template' ? 2 : 1;
        return sum + weight;
      }, 0);

      return { version, score, satisfied: satisfied.length };
    });

    // Sort by score descending, then by version descending
    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return semver.rcompare(a.version, b.version);
    });

    return scored[0]?.version || versions[0];
  }

  /**
   * Fetch available versions from npm
   */
  private async fetchAvailableVersions(pkg: string): Promise<string[]> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${pkg}`);
      const data = await response.json();
      return Object.keys(data.versions || {});
    } catch {
      return [];
    }
  }
}

export { VersionResolver, VersionConstraint, ResolvedVersion };
```

### Semver Range Handling

```typescript
// dependencies/semver-utils.ts

import semver from 'semver';

interface RangeAnalysis {
  range: string;
  minVersion: string | null;
  maxVersion: string | null;
  allowsMajorUpgrades: boolean;
  allowsMinorUpgrades: boolean;
  allowsPatchUpgrades: boolean;
  isExact: boolean;
  isAny: boolean;
}

class SemverUtils {
  /**
   * Analyze a semver range
   */
  static analyzeRange(range: string): RangeAnalysis {
    const minVersion = semver.minVersion(range)?.version || null;
    
    return {
      range,
      minVersion,
      maxVersion: this.getMaxVersion(range),
      allowsMajorUpgrades: range.startsWith('>=') || range === '*',
      allowsMinorUpgrades: range.startsWith('^') || range.startsWith('>='),
      allowsPatchUpgrades: range.startsWith('~') || range.startsWith('^'),
      isExact: !range.includes('^') && !range.includes('~') && !range.includes('*'),
      isAny: range === '*' || range === '',
    };
  }

  /**
   * Get maximum version allowed by range
   */
  private static getMaxVersion(range: string): string | null {
    try {
      // For caret ranges, max is next major
      if (range.startsWith('^')) {
        const min = semver.minVersion(range);
        if (min) {
          const major = semver.major(min);
          return `${major + 1}.0.0`;
        }
      }
      
      // For tilde ranges, max is next minor
      if (range.startsWith('~')) {
        const min = semver.minVersion(range);
        if (min) {
          const major = semver.major(min);
          const minor = semver.minor(min);
          return `${major}.${minor + 1}.0`;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find intersection of two ranges
   */
  static intersectRanges(range1: string, range2: string): string | null {
    try {
      const r1 = new semver.Range(range1);
      const r2 = new semver.Range(range2);
      
      // Find versions that satisfy both
      const intersection = semver.intersects(range1, range2);
      
      if (!intersection) {
        return null;
      }
      
      // Return the more restrictive range
      const min1 = semver.minVersion(range1);
      const min2 = semver.minVersion(range2);
      
      if (!min1 || !min2) return null;
      
      return semver.gt(min1, min2) ? range1 : range2;
    } catch {
      return null;
    }
  }

  /**
   * Suggest compatible range for two conflicting ranges
   */
  static suggestCompatibleRange(
    range1: string,
    range2: string
  ): string | null {
    const min1 = semver.minVersion(range1);
    const min2 = semver.minVersion(range2);
    
    if (!min1 || !min2) return null;
    
    // If same major, suggest caret range with higher minimum
    const major1 = semver.major(min1);
    const major2 = semver.major(min2);
    
    if (major1 === major2) {
      const higher = semver.gt(min1, min2) ? min1 : min2;
      return `^${higher.version}`;
    }
    
    // Different majors - suggest latest major
    const latestMajor = Math.max(major1, major2);
    return `^${latestMajor}.0.0`;
  }
}

export { SemverUtils, RangeAnalysis };
```

---

## Conflict Detection

### Conflict Detector

```typescript
// dependencies/conflict-detector.ts

interface ConflictReport {
  hasConflicts: boolean;
  critical: ConflictDetail[];
  warnings: ConflictDetail[];
  info: ConflictDetail[];
}

interface ConflictDetail {
  type: 'version' | 'peer' | 'engine' | 'script' | 'resolution';
  packages: string[];
  description: string;
  suggestion: string;
  autoResolvable: boolean;
}

class ConflictDetector {
  /**
   * Detect all conflicts between two package.json files
   */
  async detectConflicts(
    templatePkg: PackageJson,
    userPkg: PackageJson
  ): Promise<ConflictReport> {
    const critical: ConflictDetail[] = [];
    const warnings: ConflictDetail[] = [];
    const info: ConflictDetail[] = [];

    // Detect version conflicts
    const versionConflicts = this.detectVersionConflicts(
      templatePkg.dependencies || {},
      userPkg.dependencies || {}
    );
    
    for (const conflict of versionConflicts) {
      if (conflict.severity === 'critical') {
        critical.push(conflict);
      } else if (conflict.severity === 'warning') {
        warnings.push(conflict);
      } else {
        info.push(conflict);
      }
    }

    // Detect peer dependency conflicts
    const peerConflicts = await this.detectPeerConflicts(
      { ...templatePkg.dependencies, ...userPkg.dependencies },
      { ...templatePkg.peerDependencies, ...userPkg.peerDependencies }
    );
    
    critical.push(...peerConflicts.filter(c => c.severity === 'critical'));
    warnings.push(...peerConflicts.filter(c => c.severity === 'warning'));

    // Detect engine conflicts
    const engineConflicts = this.detectEngineConflicts(
      templatePkg.engines || {},
      userPkg.engines || {}
    );
    
    warnings.push(...engineConflicts);

    // Detect script conflicts
    const scriptConflicts = this.detectScriptConflicts(
      templatePkg.scripts || {},
      userPkg.scripts || {}
    );
    
    info.push(...scriptConflicts);

    return {
      hasConflicts: critical.length > 0 || warnings.length > 0,
      critical,
      warnings,
      info,
    };
  }

  /**
   * Detect version conflicts
   */
  private detectVersionConflicts(
    templateDeps: Record<string, string>,
    userDeps: Record<string, string>
  ): (ConflictDetail & { severity: string })[] {
    const conflicts: (ConflictDetail & { severity: string })[] = [];
    
    for (const [pkg, templateVersion] of Object.entries(templateDeps)) {
      const userVersion = userDeps[pkg];
      
      if (!userVersion) continue;
      
      if (templateVersion === userVersion) continue;
      
      // Check compatibility
      const templateMin = semver.minVersion(templateVersion);
      const userMin = semver.minVersion(userVersion);
      
      if (!templateMin || !userMin) continue;
      
      const templateMajor = semver.major(templateMin);
      const userMajor = semver.major(userMin);
      
      if (templateMajor !== userMajor) {
        // Major version conflict
        conflicts.push({
          type: 'version',
          packages: [pkg],
          description: `Major version conflict: template requires ${templateVersion}, user has ${userVersion}`,
          suggestion: `Upgrade to ^${Math.max(templateMajor, userMajor)}.0.0`,
          autoResolvable: false,
          severity: 'critical',
        });
      } else if (!semver.intersects(templateVersion, userVersion)) {
        // Non-intersecting ranges
        conflicts.push({
          type: 'version',
          packages: [pkg],
          description: `Version ranges don't intersect: ${templateVersion} vs ${userVersion}`,
          suggestion: `Use ${SemverUtils.suggestCompatibleRange(templateVersion, userVersion)}`,
          autoResolvable: true,
          severity: 'warning',
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Detect peer dependency conflicts
   */
  private async detectPeerConflicts(
    dependencies: Record<string, string>,
    peerDependencies: Record<string, string>
  ): Promise<(ConflictDetail & { severity: string })[]> {
    const conflicts: (ConflictDetail & { severity: string })[] = [];
    
    for (const [peer, peerRange] of Object.entries(peerDependencies)) {
      const installedVersion = dependencies[peer];
      
      if (!installedVersion) {
        // Missing peer dependency
        conflicts.push({
          type: 'peer',
          packages: [peer],
          description: `Missing peer dependency: ${peer}@${peerRange}`,
          suggestion: `Add ${peer}@${peerRange} to dependencies`,
          autoResolvable: true,
          severity: 'warning',
        });
        continue;
      }
      
      // Check if installed version satisfies peer requirement
      const installedMin = semver.minVersion(installedVersion);
      
      if (installedMin && !semver.satisfies(installedMin, peerRange)) {
        conflicts.push({
          type: 'peer',
          packages: [peer],
          description: `Peer dependency mismatch: installed ${installedVersion}, requires ${peerRange}`,
          suggestion: `Update ${peer} to satisfy ${peerRange}`,
          autoResolvable: false,
          severity: 'critical',
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Detect engine conflicts
   */
  private detectEngineConflicts(
    templateEngines: Record<string, string>,
    userEngines: Record<string, string>
  ): ConflictDetail[] {
    const conflicts: ConflictDetail[] = [];
    
    for (const [engine, templateRange] of Object.entries(templateEngines)) {
      const userRange = userEngines[engine];
      
      if (!userRange) continue;
      
      if (!semver.intersects(templateRange, userRange)) {
        conflicts.push({
          type: 'engine',
          packages: [engine],
          description: `Engine requirement conflict: template ${templateRange}, user ${userRange}`,
          suggestion: `Align ${engine} requirements`,
          autoResolvable: false,
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Detect script conflicts
   */
  private detectScriptConflicts(
    templateScripts: Record<string, string>,
    userScripts: Record<string, string>
  ): ConflictDetail[] {
    const conflicts: ConflictDetail[] = [];
    
    for (const [script, templateCmd] of Object.entries(templateScripts)) {
      const userCmd = userScripts[script];
      
      if (userCmd && userCmd !== templateCmd) {
        conflicts.push({
          type: 'script',
          packages: [script],
          description: `Script "${script}" has different commands`,
          suggestion: `Review and merge: "${templateCmd}" vs "${userCmd}"`,
          autoResolvable: true,
        });
      }
    }
    
    return conflicts;
  }
}

export { ConflictDetector, ConflictReport, ConflictDetail };
```

---

## Resolution Strategies

### Strategy Configuration

```typescript
// dependencies/resolution-strategies.ts

type ResolutionStrategy = 
  | 'template-wins'      // Template version always wins
  | 'user-wins'          // User version always wins
  | 'latest-wins'        // Latest version wins
  | 'strictest-wins'     // Most restrictive range wins
  | 'loosest-wins'       // Least restrictive range wins
  | 'interactive'        // Ask user for each conflict
  | 'smart';             // AI-assisted resolution

interface StrategyConfig {
  default: ResolutionStrategy;
  byPackage: Record<string, ResolutionStrategy>;
  byType: {
    dependencies: ResolutionStrategy;
    devDependencies: ResolutionStrategy;
    peerDependencies: ResolutionStrategy;
  };
}

const defaultStrategyConfig: StrategyConfig = {
  default: 'smart',
  byPackage: {
    // Critical packages always use template version
    'react': 'template-wins',
    'react-dom': 'template-wins',
    'next': 'template-wins',
    'typescript': 'latest-wins',
  },
  byType: {
    dependencies: 'smart',
    devDependencies: 'latest-wins',
    peerDependencies: 'template-wins',
  },
};

class ResolutionStrategyExecutor {
  private config: StrategyConfig;

  constructor(config: Partial<StrategyConfig> = {}) {
    this.config = { ...defaultStrategyConfig, ...config };
  }

  /**
   * Resolve conflict using configured strategy
   */
  async resolve(
    pkg: string,
    templateVersion: string,
    userVersion: string,
    depType: 'dependencies' | 'devDependencies' | 'peerDependencies'
  ): Promise<string> {
    // Check package-specific strategy
    const packageStrategy = this.config.byPackage[pkg];
    if (packageStrategy) {
      return this.executeStrategy(
        packageStrategy,
        pkg,
        templateVersion,
        userVersion
      );
    }

    // Check type-specific strategy
    const typeStrategy = this.config.byType[depType];
    if (typeStrategy) {
      return this.executeStrategy(
        typeStrategy,
        pkg,
        templateVersion,
        userVersion
      );
    }

    // Use default strategy
    return this.executeStrategy(
      this.config.default,
      pkg,
      templateVersion,
      userVersion
    );
  }

  /**
   * Execute specific strategy
   */
  private async executeStrategy(
    strategy: ResolutionStrategy,
    pkg: string,
    templateVersion: string,
    userVersion: string
  ): Promise<string> {
    switch (strategy) {
      case 'template-wins':
        return templateVersion;

      case 'user-wins':
        return userVersion;

      case 'latest-wins':
        return this.getLatestVersion(pkg, templateVersion, userVersion);

      case 'strictest-wins':
        return this.getStrictestRange(templateVersion, userVersion);

      case 'loosest-wins':
        return this.getLoosestRange(templateVersion, userVersion);

      case 'smart':
        return this.smartResolve(pkg, templateVersion, userVersion);

      case 'interactive':
        throw new Error('Interactive resolution requires user input');

      default:
        return templateVersion;
    }
  }

  /**
   * Get latest version
   */
  private async getLatestVersion(
    pkg: string,
    templateVersion: string,
    userVersion: string
  ): Promise<string> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
      const data = await response.json();
      return `^${data.version}`;
    } catch {
      // Fallback to higher of the two
      const tMin = semver.minVersion(templateVersion);
      const uMin = semver.minVersion(userVersion);
      
      if (tMin && uMin) {
        return semver.gt(tMin, uMin) ? templateVersion : userVersion;
      }
      
      return templateVersion;
    }
  }

  /**
   * Get strictest (most restrictive) range
   */
  private getStrictestRange(
    templateVersion: string,
    userVersion: string
  ): string {
    const tMin = semver.minVersion(templateVersion);
    const uMin = semver.minVersion(userVersion);
    
    if (!tMin || !uMin) return templateVersion;
    
    // Higher minimum is more restrictive
    return semver.gt(tMin, uMin) ? templateVersion : userVersion;
  }

  /**
   * Get loosest (least restrictive) range
   */
  private getLoosestRange(
    templateVersion: string,
    userVersion: string
  ): string {
    // Check for wildcards
    if (templateVersion === '*') return templateVersion;
    if (userVersion === '*') return userVersion;
    
    // >= is looser than ^
    if (templateVersion.startsWith('>=')) return templateVersion;
    if (userVersion.startsWith('>=')) return userVersion;
    
    // ^ is looser than ~
    if (templateVersion.startsWith('^') && userVersion.startsWith('~')) {
      return templateVersion;
    }
    if (userVersion.startsWith('^') && templateVersion.startsWith('~')) {
      return userVersion;
    }
    
    // Lower minimum is looser
    const tMin = semver.minVersion(templateVersion);
    const uMin = semver.minVersion(userVersion);
    
    if (!tMin || !uMin) return templateVersion;
    
    return semver.lt(tMin, uMin) ? templateVersion : userVersion;
  }

  /**
   * Smart resolution using heuristics
   */
  private async smartResolve(
    pkg: string,
    templateVersion: string,
    userVersion: string
  ): Promise<string> {
    // 1. Check if versions are compatible
    if (semver.intersects(templateVersion, userVersion)) {
      // Use higher minimum for security
      return this.getStrictestRange(templateVersion, userVersion);
    }

    // 2. Check if one is significantly newer
    const tMin = semver.minVersion(templateVersion);
    const uMin = semver.minVersion(userVersion);
    
    if (tMin && uMin) {
      const tMajor = semver.major(tMin);
      const uMajor = semver.major(uMin);
      
      // If major versions differ, prefer template (it's tested)
      if (tMajor !== uMajor) {
        return templateVersion;
      }
    }

    // 3. Fetch latest and check compatibility
    try {
      const response = await fetch(`https://registry.npmjs.org/${pkg}`);
      const data = await response.json();
      const latest = data['dist-tags']?.latest;
      
      if (latest) {
        // If latest satisfies template, use latest
        if (semver.satisfies(latest, templateVersion)) {
          return `^${latest}`;
        }
      }
    } catch {
      // Ignore fetch errors
    }

    // 4. Default to template version
    return templateVersion;
  }
}

export { ResolutionStrategyExecutor, StrategyConfig, ResolutionStrategy };
```

---

## Lockfile Handling

### Lockfile Merger

```typescript
// dependencies/lockfile-merger.ts

interface LockfileEntry {
  version: string;
  resolved: string;
  integrity: string;
  dependencies?: Record<string, string>;
}

type Lockfile = Record<string, LockfileEntry>;

class LockfileMerger {
  /**
   * Merge two lockfiles
   */
  mergeLockfiles(
    templateLock: Lockfile,
    userLock: Lockfile,
    mergedPackageJson: PackageJson
  ): Lockfile {
    const merged: Lockfile = {};
    const requiredPackages = new Set([
      ...Object.keys(mergedPackageJson.dependencies || {}),
      ...Object.keys(mergedPackageJson.devDependencies || {}),
    ]);

    // Start with template lockfile
    for (const [key, entry] of Object.entries(templateLock)) {
      const pkgName = this.extractPackageName(key);
      
      if (requiredPackages.has(pkgName)) {
        merged[key] = entry;
      }
    }

    // Add user lockfile entries for packages not in template
    for (const [key, entry] of Object.entries(userLock)) {
      const pkgName = this.extractPackageName(key);
      
      if (requiredPackages.has(pkgName) && !merged[key]) {
        merged[key] = entry;
      }
    }

    return merged;
  }

  /**
   * Extract package name from lockfile key
   */
  private extractPackageName(key: string): string {
    // Handle scoped packages
    if (key.startsWith('@')) {
      const parts = key.split('/');
      return `${parts[0]}/${parts[1].split('@')[0]}`;
    }
    
    return key.split('@')[0];
  }

  /**
   * Regenerate lockfile from package.json
   */
  async regenerateLockfile(
    packageJson: PackageJson,
    packageManager: 'npm' | 'pnpm' | 'yarn'
  ): Promise<void> {
    const commands = {
      npm: 'npm install --package-lock-only',
      pnpm: 'pnpm install --lockfile-only',
      yarn: 'yarn install --mode update-lockfile',
    };

    const { execSync } = require('child_process');
    execSync(commands[packageManager], { stdio: 'inherit' });
  }
}

export { LockfileMerger, Lockfile, LockfileEntry };
```

---

## Peer Dependencies

### Peer Dependency Resolver

```typescript
// dependencies/peer-resolver.ts

interface PeerDependencyInfo {
  package: string;
  requiredBy: string;
  range: string;
  optional: boolean;
}

interface PeerResolutionResult {
  satisfied: PeerDependencyInfo[];
  missing: PeerDependencyInfo[];
  conflicts: PeerDependencyInfo[];
  suggestions: Record<string, string>;
}

class PeerDependencyResolver {
  /**
   * Analyze peer dependencies
   */
  async analyzePeerDependencies(
    dependencies: Record<string, string>
  ): Promise<PeerResolutionResult> {
    const allPeers: PeerDependencyInfo[] = [];
    
    // Fetch peer dependencies for each package
    for (const [pkg, version] of Object.entries(dependencies)) {
      const peers = await this.fetchPeerDependencies(pkg, version);
      allPeers.push(...peers.map(p => ({ ...p, requiredBy: pkg })));
    }

    // Categorize peers
    const satisfied: PeerDependencyInfo[] = [];
    const missing: PeerDependencyInfo[] = [];
    const conflicts: PeerDependencyInfo[] = [];
    const suggestions: Record<string, string> = {};

    for (const peer of allPeers) {
      const installedVersion = dependencies[peer.package];
      
      if (!installedVersion) {
        if (!peer.optional) {
          missing.push(peer);
          suggestions[peer.package] = peer.range;
        }
        continue;
      }

      const installedMin = semver.minVersion(installedVersion);
      
      if (installedMin && semver.satisfies(installedMin, peer.range)) {
        satisfied.push(peer);
      } else {
        conflicts.push(peer);
        suggestions[peer.package] = peer.range;
      }
    }

    return { satisfied, missing, conflicts, suggestions };
  }

  /**
   * Fetch peer dependencies from npm
   */
  private async fetchPeerDependencies(
    pkg: string,
    version: string
  ): Promise<Omit<PeerDependencyInfo, 'requiredBy'>[]> {
    try {
      const resolvedVersion = semver.minVersion(version)?.version || 'latest';
      const response = await fetch(
        `https://registry.npmjs.org/${pkg}/${resolvedVersion}`
      );
      const data = await response.json();
      
      const peers = data.peerDependencies || {};
      const optionalPeers = data.peerDependenciesMeta || {};
      
      return Object.entries(peers).map(([name, range]) => ({
        package: name,
        range: range as string,
        optional: optionalPeers[name]?.optional || false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Auto-install missing peer dependencies
   */
  async autoInstallPeers(
    missing: PeerDependencyInfo[],
    packageManager: 'npm' | 'pnpm' | 'yarn'
  ): Promise<void> {
    if (missing.length === 0) return;

    const packages = missing.map(p => `${p.package}@${p.range}`).join(' ');
    
    const commands = {
      npm: `npm install ${packages}`,
      pnpm: `pnpm add ${packages}`,
      yarn: `yarn add ${packages}`,
    };

    const { execSync } = require('child_process');
    execSync(commands[packageManager], { stdio: 'inherit' });
  }
}

export { PeerDependencyResolver, PeerDependencyInfo, PeerResolutionResult };
```

---

## Monorepo Considerations

### Workspace Dependency Handling

```typescript
// dependencies/workspace-merger.ts

interface WorkspaceConfig {
  packages: string[];
  nohoist?: string[];
}

class WorkspaceDependencyMerger {
  /**
   * Merge dependencies in monorepo context
   */
  async mergeWorkspaceDependencies(
    rootPackageJson: PackageJson,
    workspacePackages: Map<string, PackageJson>,
    templateDeps: Record<string, string>
  ): Promise<MergeResult> {
    // Collect all workspace package names
    const workspaceNames = new Set(
      Array.from(workspacePackages.values()).map(p => p.name!)
    );

    // Handle workspace: protocol
    const processedDeps: Record<string, string> = {};
    
    for (const [pkg, version] of Object.entries(templateDeps)) {
      if (workspaceNames.has(pkg)) {
        // Internal workspace dependency
        processedDeps[pkg] = 'workspace:*';
      } else if (version.startsWith('workspace:')) {
        // Keep workspace protocol for internal deps
        processedDeps[pkg] = version;
      } else {
        // External dependency - normal merge
        processedDeps[pkg] = version;
      }
    }

    // Merge with root package.json
    const merger = new PackageJsonMerger();
    return merger.merge(
      { dependencies: processedDeps },
      rootPackageJson
    );
  }

  /**
   * Hoist common dependencies to root
   */
  hoistDependencies(
    workspacePackages: Map<string, PackageJson>
  ): {
    hoisted: Record<string, string>;
    perPackage: Map<string, Record<string, string>>;
  } {
    // Count dependency usage across packages
    const depUsage = new Map<string, Map<string, number>>();
    
    for (const pkg of workspacePackages.values()) {
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      
      for (const [dep, version] of Object.entries(allDeps)) {
        if (!depUsage.has(dep)) {
          depUsage.set(dep, new Map());
        }
        
        const versions = depUsage.get(dep)!;
        versions.set(version, (versions.get(version) || 0) + 1);
      }
    }

    // Hoist dependencies used by multiple packages
    const hoisted: Record<string, string> = {};
    const threshold = Math.ceil(workspacePackages.size / 2);
    
    for (const [dep, versions] of depUsage) {
      const totalUsage = Array.from(versions.values()).reduce((a, b) => a + b, 0);
      
      if (totalUsage >= threshold) {
        // Find most common version
        let maxCount = 0;
        let hoistedVersion = '';
        
        for (const [version, count] of versions) {
          if (count > maxCount) {
            maxCount = count;
            hoistedVersion = version;
          }
        }
        
        hoisted[dep] = hoistedVersion;
      }
    }

    // Calculate per-package overrides
    const perPackage = new Map<string, Record<string, string>>();
    
    for (const [name, pkg] of workspacePackages) {
      const overrides: Record<string, string> = {};
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      for (const [dep, version] of Object.entries(allDeps)) {
        if (hoisted[dep] && hoisted[dep] !== version) {
          overrides[dep] = version;
        }
      }
      
      if (Object.keys(overrides).length > 0) {
        perPackage.set(name, overrides);
      }
    }

    return { hoisted, perPackage };
  }
}

export { WorkspaceDependencyMerger, WorkspaceConfig };
```

---

## Summary

### Merge Strategy Summary

| Field | Default Strategy | Notes |
|-------|------------------|-------|
| **dependencies** | Latest compatible | Security-focused |
| **devDependencies** | Latest compatible | Less critical |
| **peerDependencies** | Template wins | Tested compatibility |
| **scripts** | Merge with prefix | Preserve both |
| **other fields** | Deep merge | User overrides |

### Conflict Resolution Priority

| Priority | Strategy | Use Case |
|----------|----------|----------|
| 1 | Package-specific | Critical packages (react, next) |
| 2 | Type-specific | By dependency type |
| 3 | Default | All other packages |

### Resolution Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **template-wins** | Always use template | Framework packages |
| **user-wins** | Always use user | User preferences |
| **latest-wins** | Use latest version | Dev dependencies |
| **strictest-wins** | Most restrictive | Security |
| **smart** | AI-assisted | Default |

### Best Practices

1. **Always run conflict detection** before merging
2. **Use lockfiles** to ensure reproducible builds
3. **Hoist common dependencies** in monorepos
4. **Auto-install peer dependencies** when possible
5. **Log all resolutions** for debugging
