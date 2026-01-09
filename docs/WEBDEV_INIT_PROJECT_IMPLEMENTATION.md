# webdev_init_project() Implementation Guide

This document provides the exact implementation details of the `webdev_init_project()` function, including step-by-step code, environment variable injection, dependency installation, and comprehensive error handling.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Complete Implementation](#complete-implementation)
4. [Step-by-Step Execution Flow](#step-by-step-execution-flow)
5. [Environment Variable Injection](#environment-variable-injection)
6. [Dependency Installation](#dependency-installation)
7. [Error Handling](#error-handling)
8. [Database Schema](#database-schema)
9. [API Contracts](#api-contracts)
10. [Monitoring and Observability](#monitoring-and-observability)

---

## Overview

The `webdev_init_project()` function is the entry point for creating new web development projects in the sandbox environment. It orchestrates template fetching, file scaffolding, environment configuration, dependency installation, and dev server startup.

### Key Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Template Resolution | Resolve template name to Git URL and version |
| Sandbox Preparation | Ensure sandbox is running and has sufficient resources |
| Template Cloning | Clone template repository to project directory |
| Variable Substitution | Replace template placeholders with project-specific values |
| Environment Injection | Inject secrets and configuration as environment variables |
| Dependency Installation | Install npm/pnpm dependencies |
| Database Setup | Run migrations and seed data if applicable |
| Dev Server Start | Start the development server and expose ports |
| Health Verification | Verify the project is running correctly |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        webdev_init_project() ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Agent     │───▶│  Orchestrator│───▶│  Template   │───▶│   Sandbox   │              │
│  │   Request   │    │   Service   │    │   Service   │    │   Manager   │              │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘              │
│                            │                  │                  │                      │
│                            ▼                  ▼                  ▼                      │
│                     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│                     │   Secrets   │    │  Template   │    │  Container  │              │
│                     │   Manager   │    │  Registry   │    │   Runtime   │              │
│                     └─────────────┘    └─────────────┘    └─────────────┘              │
│                            │                  │                  │                      │
│                            ▼                  ▼                  ▼                      │
│                     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│                     │    Vault    │    │     Git     │    │   gVisor    │              │
│                     │   / KMS    │    │   Server    │    │   Runtime   │              │
│                     └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Implementation

### Main Entry Point

```typescript
// src/services/webdev/initProject.ts

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TemplateService } from './templateService';
import { SandboxManager } from '../sandbox/sandboxManager';
import { SecretsManager } from '../secrets/secretsManager';
import { DependencyInstaller } from './dependencyInstaller';
import { DevServerManager } from './devServerManager';
import { DatabaseManager } from './databaseManager';
import { HealthChecker } from './healthChecker';
import { ProjectRegistry } from './projectRegistry';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Input validation schema
const InitProjectInputSchema = z.object({
  projectName: z.string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Project name must be lowercase alphanumeric with hyphens'),
  template: z.string().default('web-static'),
  features: z.array(z.enum(['db', 'server', 'user', 'stripe'])).default([]),
  description: z.string().optional(),
  visibility: z.enum(['private', 'public']).default('private'),
});

type InitProjectInput = z.infer<typeof InitProjectInputSchema>;

// Output type
interface InitProjectResult {
  projectName: string;
  projectPath: string;
  versionId: string;
  features: string[];
  devServerUrl: string;
  devServerPort: number;
  status: 'running' | 'starting' | 'error';
  createdFiles: string[];
  secrets: string[];
  readme: string;
}

// Main implementation
export async function webdevInitProject(
  input: InitProjectInput,
  context: {
    sandboxId: string;
    userId: string;
    organizationId?: string;
  }
): Promise<InitProjectResult> {
  const startTime = Date.now();
  const operationId = generateOperationId();
  
  logger.info('Starting webdev_init_project', {
    operationId,
    projectName: input.projectName,
    template: input.template,
    features: input.features,
    sandboxId: context.sandboxId,
  });

  // Track metrics
  metrics.increment('webdev.init_project.started', {
    template: input.template,
  });

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: VALIDATE INPUT AND CHECK PREREQUISITES
    // ═══════════════════════════════════════════════════════════════════════
    
    const validatedInput = await validateAndPrepare(input, context);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: RESOLVE TEMPLATE
    // ═══════════════════════════════════════════════════════════════════════
    
    const template = await resolveTemplate(validatedInput, context);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: PREPARE SANDBOX
    // ═══════════════════════════════════════════════════════════════════════
    
    const sandbox = await prepareSandbox(context.sandboxId, template);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: CLONE AND SCAFFOLD TEMPLATE
    // ═══════════════════════════════════════════════════════════════════════
    
    const scaffoldResult = await scaffoldTemplate(
      sandbox,
      template,
      validatedInput,
      context
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: INJECT ENVIRONMENT VARIABLES
    // ═══════════════════════════════════════════════════════════════════════
    
    const injectedSecrets = await injectEnvironmentVariables(
      sandbox,
      scaffoldResult.projectPath,
      validatedInput,
      context
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: INSTALL DEPENDENCIES
    // ═══════════════════════════════════════════════════════════════════════
    
    await installDependencies(
      sandbox,
      scaffoldResult.projectPath,
      template
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 7: SETUP DATABASE (IF APPLICABLE)
    // ═══════════════════════════════════════════════════════════════════════
    
    if (validatedInput.features.includes('db')) {
      await setupDatabase(
        sandbox,
        scaffoldResult.projectPath,
        validatedInput,
        context
      );
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 8: START DEV SERVER
    // ═══════════════════════════════════════════════════════════════════════
    
    const devServer = await startDevServer(
      sandbox,
      scaffoldResult.projectPath,
      template
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 9: VERIFY HEALTH
    // ═══════════════════════════════════════════════════════════════════════
    
    await verifyProjectHealth(devServer);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 10: REGISTER PROJECT
    // ═══════════════════════════════════════════════════════════════════════
    
    const registration = await registerProject(
      validatedInput,
      scaffoldResult,
      devServer,
      context
    );
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 11: CREATE INITIAL CHECKPOINT
    // ═══════════════════════════════════════════════════════════════════════
    
    const checkpoint = await createInitialCheckpoint(
      sandbox,
      scaffoldResult.projectPath,
      validatedInput.projectName
    );

    // Track success metrics
    const duration = Date.now() - startTime;
    metrics.timing('webdev.init_project.duration', duration, {
      template: input.template,
      features: input.features.join(','),
    });
    metrics.increment('webdev.init_project.success', {
      template: input.template,
    });

    logger.info('webdev_init_project completed successfully', {
      operationId,
      projectName: input.projectName,
      duration,
      versionId: checkpoint.versionId,
    });

    return {
      projectName: validatedInput.projectName,
      projectPath: scaffoldResult.projectPath,
      versionId: checkpoint.versionId,
      features: validatedInput.features,
      devServerUrl: devServer.url,
      devServerPort: devServer.port,
      status: 'running',
      createdFiles: scaffoldResult.createdFiles,
      secrets: injectedSecrets,
      readme: scaffoldResult.readme,
    };

  } catch (error) {
    // Track failure metrics
    metrics.increment('webdev.init_project.failed', {
      template: input.template,
      error: error.code || 'unknown',
    });

    logger.error('webdev_init_project failed', {
      operationId,
      projectName: input.projectName,
      error: error.message,
      stack: error.stack,
    });

    // Cleanup on failure
    await cleanupOnFailure(context.sandboxId, input.projectName);

    throw error;
  }
}
```

---

## Step-by-Step Execution Flow

### Step 1: Validate Input and Check Prerequisites

```typescript
// src/services/webdev/steps/validateAndPrepare.ts

interface ValidatedInput extends InitProjectInput {
  normalizedName: string;
  projectPath: string;
  templateFeatures: string[];
}

async function validateAndPrepare(
  input: InitProjectInput,
  context: { sandboxId: string; userId: string }
): Promise<ValidatedInput> {
  
  // 1.1 Validate input schema
  const parsed = InitProjectInputSchema.parse(input);
  
  // 1.2 Normalize project name
  const normalizedName = parsed.projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // 1.3 Check for existing project
  const projectPath = `/home/ubuntu/${normalizedName}`;
  const exists = await checkPathExists(context.sandboxId, projectPath);
  
  if (exists) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Project directory already exists: ${projectPath}`,
      cause: {
        suggestion: 'Use a different project name or delete the existing directory',
        existingPath: projectPath,
      },
    });
  }
  
  // 1.4 Check user quotas
  const userProjects = await ProjectRegistry.countByUser(context.userId);
  const maxProjects = await getQuotaLimit(context.userId, 'max_projects');
  
  if (userProjects >= maxProjects) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Project limit reached (${maxProjects}). Upgrade your plan for more projects.`,
      cause: {
        currentCount: userProjects,
        limit: maxProjects,
      },
    });
  }
  
  // 1.5 Validate feature combinations
  const templateFeatures = resolveFeatures(parsed.template, parsed.features);
  validateFeatureCombinations(templateFeatures);
  
  // 1.6 Check sandbox resources
  const sandboxResources = await SandboxManager.getResources(context.sandboxId);
  const requiredResources = calculateRequiredResources(templateFeatures);
  
  if (sandboxResources.availableMemory < requiredResources.memory) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Insufficient sandbox memory for this template',
      cause: {
        available: sandboxResources.availableMemory,
        required: requiredResources.memory,
      },
    });
  }

  return {
    ...parsed,
    normalizedName,
    projectPath,
    templateFeatures,
  };
}

function resolveFeatures(template: string, requestedFeatures: string[]): string[] {
  // Template base features
  const templateBaseFeatures: Record<string, string[]> = {
    'web-static': [],
    'web-server': ['server'],
    'web-db': ['server', 'db'],
    'web-db-user': ['server', 'db', 'user'],
  };
  
  const baseFeatures = templateBaseFeatures[template] || [];
  const allFeatures = [...new Set([...baseFeatures, ...requestedFeatures])];
  
  // Validate feature dependencies
  if (allFeatures.includes('user') && !allFeatures.includes('db')) {
    allFeatures.push('db');
  }
  if (allFeatures.includes('db') && !allFeatures.includes('server')) {
    allFeatures.push('server');
  }
  if (allFeatures.includes('stripe') && !allFeatures.includes('user')) {
    allFeatures.push('user', 'db', 'server');
  }
  
  return [...new Set(allFeatures)].sort();
}

function validateFeatureCombinations(features: string[]): void {
  // Define invalid combinations
  const invalidCombinations = [
    // Add any invalid feature combinations here
  ];
  
  for (const invalid of invalidCombinations) {
    if (invalid.every(f => features.includes(f))) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid feature combination: ${invalid.join(' + ')}`,
      });
    }
  }
}
```

### Step 2: Resolve Template

```typescript
// src/services/webdev/steps/resolveTemplate.ts

interface ResolvedTemplate {
  name: string;
  version: string;
  gitUrl: string;
  gitRef: string;
  metadata: TemplateMetadata;
  hooks: TemplateHooks;
  cachePath: string | null;
}

interface TemplateMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  features: string[];
  dependencies: {
    node?: string;
    pnpm?: string;
  };
  ports: {
    dev: number;
    preview?: number;
  };
  scripts: {
    dev: string;
    build: string;
    start?: string;
  };
  env: {
    required: string[];
    optional: string[];
  };
}

interface TemplateHooks {
  preInit?: string;
  postInit?: string;
  preInstall?: string;
  postInstall?: string;
}

async function resolveTemplate(
  input: ValidatedInput,
  context: { sandboxId: string; userId: string }
): Promise<ResolvedTemplate> {
  
  const templateService = new TemplateService();
  
  // 2.1 Resolve template name to registry entry
  const templateEntry = await templateService.resolve(input.template);
  
  if (!templateEntry) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Template not found: ${input.template}`,
      cause: {
        availableTemplates: await templateService.listAvailable(),
      },
    });
  }
  
  // 2.2 Determine version (latest stable or specific)
  const version = templateEntry.latestStable;
  const gitRef = `v${version}`;
  
  // 2.3 Construct Git URL
  const gitUrl = constructGitUrl(templateEntry);
  
  // 2.4 Fetch template metadata
  const metadata = await templateService.fetchMetadata(gitUrl, gitRef);
  
  // 2.5 Validate template compatibility
  await validateTemplateCompatibility(metadata, input.templateFeatures);
  
  // 2.6 Check template cache
  const cachePath = await checkTemplateCache(templateEntry.id, version);
  
  // 2.7 Load hooks
  const hooks = await loadTemplateHooks(gitUrl, gitRef);

  logger.debug('Template resolved', {
    template: input.template,
    version,
    gitUrl,
    cached: !!cachePath,
  });

  return {
    name: templateEntry.name,
    version,
    gitUrl,
    gitRef,
    metadata,
    hooks,
    cachePath,
  };
}

function constructGitUrl(entry: TemplateRegistryEntry): string {
  // Official templates
  if (entry.official) {
    return `https://github.com/manus-templates/${entry.repoName}.git`;
  }
  
  // Community templates
  if (entry.source === 'github') {
    return `https://github.com/${entry.owner}/${entry.repoName}.git`;
  }
  
  // GitLab templates
  if (entry.source === 'gitlab') {
    return `https://gitlab.com/${entry.owner}/${entry.repoName}.git`;
  }
  
  // Custom URL
  return entry.customUrl;
}

async function checkTemplateCache(
  templateId: string,
  version: string
): Promise<string | null> {
  const cacheKey = `template:${templateId}:${version}`;
  const cachePath = `/var/cache/templates/${templateId}/${version}`;
  
  // Check if cache exists and is valid
  const cacheEntry = await redis.get(cacheKey);
  
  if (cacheEntry) {
    const { path, hash, expiresAt } = JSON.parse(cacheEntry);
    
    if (Date.now() < expiresAt && await verifyCache(path, hash)) {
      logger.debug('Template cache hit', { templateId, version });
      return path;
    }
  }
  
  return null;
}
```

### Step 3: Prepare Sandbox

```typescript
// src/services/webdev/steps/prepareSandbox.ts

interface PreparedSandbox {
  id: string;
  status: 'running';
  workDir: string;
  env: Record<string, string>;
  resources: SandboxResources;
}

async function prepareSandbox(
  sandboxId: string,
  template: ResolvedTemplate
): Promise<PreparedSandbox> {
  
  const sandboxManager = new SandboxManager();
  
  // 3.1 Get current sandbox status
  let sandbox = await sandboxManager.get(sandboxId);
  
  // 3.2 Wake sandbox if hibernated
  if (sandbox.status === 'hibernated') {
    logger.info('Waking hibernated sandbox', { sandboxId });
    
    sandbox = await sandboxManager.wake(sandboxId, {
      timeout: 30000, // 30 second timeout
      reason: 'webdev_init_project',
    });
  }
  
  // 3.3 Wait for sandbox to be ready
  if (sandbox.status === 'starting') {
    sandbox = await sandboxManager.waitForReady(sandboxId, {
      timeout: 60000, // 60 second timeout
      pollInterval: 1000,
    });
  }
  
  // 3.4 Verify sandbox is running
  if (sandbox.status !== 'running') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Sandbox is not running: ${sandbox.status}`,
      cause: {
        sandboxId,
        status: sandbox.status,
      },
    });
  }
  
  // 3.5 Ensure required tools are available
  await ensureToolsAvailable(sandbox, template.metadata.dependencies);
  
  // 3.6 Clean up any stale processes
  await cleanupStaleProcesses(sandbox);
  
  // 3.7 Prepare working directory
  const workDir = '/home/ubuntu';
  await sandboxManager.exec(sandboxId, `mkdir -p ${workDir}`);

  return {
    id: sandboxId,
    status: 'running',
    workDir,
    env: sandbox.env,
    resources: sandbox.resources,
  };
}

async function ensureToolsAvailable(
  sandbox: Sandbox,
  dependencies: { node?: string; pnpm?: string }
): Promise<void> {
  
  // Check Node.js version
  if (dependencies.node) {
    const nodeVersion = await getInstalledVersion(sandbox, 'node');
    
    if (!semver.satisfies(nodeVersion, dependencies.node)) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Node.js version mismatch. Required: ${dependencies.node}, Installed: ${nodeVersion}`,
      });
    }
  }
  
  // Check pnpm version
  if (dependencies.pnpm) {
    const pnpmVersion = await getInstalledVersion(sandbox, 'pnpm');
    
    if (!semver.satisfies(pnpmVersion, dependencies.pnpm)) {
      // Auto-upgrade pnpm if needed
      await sandbox.exec(`npm install -g pnpm@${dependencies.pnpm}`);
    }
  }
}

async function cleanupStaleProcesses(sandbox: Sandbox): Promise<void> {
  // Kill any existing dev servers
  const processes = await sandbox.exec('pgrep -f "node.*dev" || true');
  
  if (processes.stdout.trim()) {
    const pids = processes.stdout.trim().split('\n');
    for (const pid of pids) {
      await sandbox.exec(`kill -9 ${pid} 2>/dev/null || true`);
    }
  }
  
  // Kill any processes on common dev ports
  const devPorts = [3000, 5173, 8080, 4000];
  for (const port of devPorts) {
    await sandbox.exec(`fuser -k ${port}/tcp 2>/dev/null || true`);
  }
}
```

### Step 4: Clone and Scaffold Template

```typescript
// src/services/webdev/steps/scaffoldTemplate.ts

interface ScaffoldResult {
  projectPath: string;
  createdFiles: string[];
  readme: string;
  gitInitialized: boolean;
}

async function scaffoldTemplate(
  sandbox: PreparedSandbox,
  template: ResolvedTemplate,
  input: ValidatedInput,
  context: { sandboxId: string; userId: string }
): Promise<ScaffoldResult> {
  
  const projectPath = input.projectPath;
  
  // 4.1 Run pre-init hook (if exists)
  if (template.hooks.preInit) {
    await runTemplateHook(sandbox, template.hooks.preInit, {
      projectName: input.normalizedName,
      projectPath,
      features: input.templateFeatures,
    });
  }
  
  // 4.2 Clone or copy template
  let createdFiles: string[];
  
  if (template.cachePath) {
    // Copy from cache (faster)
    createdFiles = await copyFromCache(sandbox, template.cachePath, projectPath);
  } else {
    // Clone from Git
    createdFiles = await cloneFromGit(sandbox, template, projectPath);
  }
  
  // 4.3 Remove template-specific files
  await removeTemplateFiles(sandbox, projectPath);
  
  // 4.4 Perform variable substitution
  await performVariableSubstitution(sandbox, projectPath, {
    PROJECT_NAME: input.normalizedName,
    PROJECT_TITLE: toTitleCase(input.normalizedName),
    PROJECT_DESCRIPTION: input.description || '',
    AUTHOR_NAME: context.userId,
    CREATED_AT: new Date().toISOString(),
    TEMPLATE_NAME: template.name,
    TEMPLATE_VERSION: template.version,
  });
  
  // 4.5 Apply feature-specific scaffolding
  for (const feature of input.templateFeatures) {
    await applyFeatureScaffolding(sandbox, projectPath, feature);
  }
  
  // 4.6 Initialize Git repository
  await initializeGitRepo(sandbox, projectPath, input.normalizedName);
  
  // 4.7 Run post-init hook (if exists)
  if (template.hooks.postInit) {
    await runTemplateHook(sandbox, template.hooks.postInit, {
      projectName: input.normalizedName,
      projectPath,
      features: input.templateFeatures,
    });
  }
  
  // 4.8 Read README content
  const readme = await readFileContent(sandbox, `${projectPath}/README.md`);
  
  // 4.9 Update created files list
  createdFiles = await listCreatedFiles(sandbox, projectPath);

  return {
    projectPath,
    createdFiles,
    readme,
    gitInitialized: true,
  };
}

async function cloneFromGit(
  sandbox: PreparedSandbox,
  template: ResolvedTemplate,
  projectPath: string
): Promise<string[]> {
  
  const sandboxManager = new SandboxManager();
  
  // Clone with specific ref
  const cloneCommand = [
    'git clone',
    '--depth 1',
    `--branch ${template.gitRef}`,
    '--single-branch',
    template.gitUrl,
    projectPath,
  ].join(' ');
  
  const result = await sandboxManager.exec(sandbox.id, cloneCommand, {
    timeout: 60000, // 60 second timeout
    env: {
      GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
    },
  });
  
  if (result.exitCode !== 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to clone template repository',
      cause: {
        command: cloneCommand,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
    });
  }
  
  // Remove .git directory (will reinitialize)
  await sandboxManager.exec(sandbox.id, `rm -rf ${projectPath}/.git`);
  
  // List created files
  const files = await sandboxManager.exec(
    sandbox.id,
    `find ${projectPath} -type f | sed 's|${projectPath}/||'`
  );
  
  return files.stdout.trim().split('\n').filter(Boolean);
}

async function performVariableSubstitution(
  sandbox: PreparedSandbox,
  projectPath: string,
  variables: Record<string, string>
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  
  // Files to process for substitution
  const substitutionFiles = [
    'package.json',
    'README.md',
    'index.html',
    'client/index.html',
    '.env.example',
  ];
  
  for (const file of substitutionFiles) {
    const filePath = `${projectPath}/${file}`;
    const exists = await checkPathExists(sandbox.id, filePath);
    
    if (!exists) continue;
    
    // Read file content
    let content = await readFileContent(sandbox, filePath);
    
    // Replace all variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      content = content.replace(regex, value);
    }
    
    // Write back
    await writeFileContent(sandbox, filePath, content);
  }
}

async function initializeGitRepo(
  sandbox: PreparedSandbox,
  projectPath: string,
  projectName: string
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  
  const commands = [
    `cd ${projectPath}`,
    'git init',
    'git config user.email "manus@manus.im"',
    'git config user.name "Manus"',
    'git add -A',
    `git commit -m "Initial commit: ${projectName} from template"`,
  ].join(' && ');
  
  await sandboxManager.exec(sandbox.id, commands);
}

async function runTemplateHook(
  sandbox: PreparedSandbox,
  hookScript: string,
  context: Record<string, any>
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  
  // Create temporary hook script
  const hookPath = `/tmp/hook-${Date.now()}.sh`;
  await writeFileContent(sandbox, hookPath, hookScript);
  await sandboxManager.exec(sandbox.id, `chmod +x ${hookPath}`);
  
  // Set environment variables for hook
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    env[`MANUS_${key.toUpperCase()}`] = String(value);
  }
  
  // Execute hook with timeout
  const result = await sandboxManager.exec(sandbox.id, hookPath, {
    timeout: 30000, // 30 second timeout
    env,
    cwd: context.projectPath,
  });
  
  // Cleanup
  await sandboxManager.exec(sandbox.id, `rm -f ${hookPath}`);
  
  if (result.exitCode !== 0) {
    logger.warn('Template hook failed', {
      hook: hookScript.substring(0, 100),
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
    // Don't throw - hooks are best-effort
  }
}
```

---

## Environment Variable Injection

### Step 5: Inject Environment Variables

```typescript
// src/services/webdev/steps/injectEnvironmentVariables.ts

interface InjectedSecret {
  key: string;
  source: 'system' | 'user' | 'generated';
  masked: boolean;
}

async function injectEnvironmentVariables(
  sandbox: PreparedSandbox,
  projectPath: string,
  input: ValidatedInput,
  context: { sandboxId: string; userId: string; organizationId?: string }
): Promise<string[]> {
  
  const secretsManager = new SecretsManager();
  const injectedSecrets: InjectedSecret[] = [];
  
  // 5.1 Collect system environment variables
  const systemEnvVars = await collectSystemEnvVars(input, context);
  
  // 5.2 Collect user-defined secrets
  const userSecrets = await secretsManager.getProjectSecrets(
    context.userId,
    input.normalizedName
  );
  
  // 5.3 Generate required secrets
  const generatedSecrets = await generateRequiredSecrets(input.templateFeatures);
  
  // 5.4 Merge all environment variables
  const allEnvVars: Record<string, string> = {
    ...systemEnvVars,
    ...userSecrets,
    ...generatedSecrets,
  };
  
  // 5.5 Create .env file
  await createEnvFile(sandbox, projectPath, allEnvVars);
  
  // 5.6 Inject into sandbox environment
  await injectIntoSandboxEnv(sandbox, allEnvVars);
  
  // 5.7 Track injected secrets
  for (const [key, _] of Object.entries(allEnvVars)) {
    injectedSecrets.push({
      key,
      source: systemEnvVars[key] ? 'system' : 
              userSecrets[key] ? 'user' : 'generated',
      masked: isSensitiveKey(key),
    });
  }

  logger.info('Environment variables injected', {
    projectPath,
    count: Object.keys(allEnvVars).length,
    keys: Object.keys(allEnvVars),
  });

  return injectedSecrets.map(s => s.key);
}

async function collectSystemEnvVars(
  input: ValidatedInput,
  context: { sandboxId: string; userId: string; organizationId?: string }
): Promise<Record<string, string>> {
  
  const envVars: Record<string, string> = {};
  
  // Core system variables
  envVars.NODE_ENV = 'development';
  envVars.VITE_APP_ID = await generateAppId(input.normalizedName);
  envVars.VITE_APP_TITLE = toTitleCase(input.normalizedName);
  
  // OAuth configuration
  envVars.OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL!;
  envVars.VITE_OAUTH_PORTAL_URL = process.env.VITE_OAUTH_PORTAL_URL!;
  
  // Owner information
  const owner = await getUserInfo(context.userId);
  envVars.OWNER_OPEN_ID = owner.openId;
  envVars.OWNER_NAME = owner.name;
  
  // API keys for built-in services
  envVars.BUILT_IN_FORGE_API_URL = process.env.FORGE_API_URL!;
  envVars.BUILT_IN_FORGE_API_KEY = await generateForgeApiKey(context.userId);
  envVars.VITE_FRONTEND_FORGE_API_URL = process.env.FORGE_API_URL!;
  envVars.VITE_FRONTEND_FORGE_API_KEY = await generateFrontendForgeApiKey(context.userId);
  
  // Analytics
  envVars.VITE_ANALYTICS_ENDPOINT = process.env.ANALYTICS_ENDPOINT!;
  envVars.VITE_ANALYTICS_WEBSITE_ID = await generateAnalyticsId(input.normalizedName);
  
  // Database (if feature enabled)
  if (input.templateFeatures.includes('db')) {
    const dbCredentials = await provisionDatabase(input.normalizedName, context);
    envVars.DATABASE_URL = dbCredentials.connectionString;
  }
  
  // JWT secret (if auth feature enabled)
  if (input.templateFeatures.includes('user')) {
    envVars.JWT_SECRET = await generateSecureSecret(64);
  }
  
  return envVars;
}

async function generateRequiredSecrets(
  features: string[]
): Promise<Record<string, string>> {
  
  const secrets: Record<string, string> = {};
  
  // Generate JWT secret
  if (features.includes('user')) {
    secrets.JWT_SECRET = await generateSecureSecret(64);
  }
  
  // Generate session secret
  if (features.includes('server')) {
    secrets.SESSION_SECRET = await generateSecureSecret(32);
  }
  
  return secrets;
}

async function createEnvFile(
  sandbox: PreparedSandbox,
  projectPath: string,
  envVars: Record<string, string>
): Promise<void> {
  
  // Generate .env content
  const envContent = Object.entries(envVars)
    .map(([key, value]) => {
      // Escape special characters in value
      const escapedValue = value.includes(' ') || value.includes('"')
        ? `"${value.replace(/"/g, '\\"')}"`
        : value;
      return `${key}=${escapedValue}`;
    })
    .join('\n');
  
  // Write .env file
  await writeFileContent(sandbox, `${projectPath}/.env`, envContent + '\n');
  
  // Also create .env.local for Vite
  await writeFileContent(sandbox, `${projectPath}/.env.local`, envContent + '\n');
  
  // Ensure .env is in .gitignore
  const gitignorePath = `${projectPath}/.gitignore`;
  const gitignoreContent = await readFileContent(sandbox, gitignorePath);
  
  if (!gitignoreContent.includes('.env')) {
    await appendFileContent(sandbox, gitignorePath, '\n# Environment files\n.env\n.env.local\n');
  }
}

async function injectIntoSandboxEnv(
  sandbox: PreparedSandbox,
  envVars: Record<string, string>
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  
  // Update sandbox environment
  await sandboxManager.updateEnv(sandbox.id, envVars);
  
  // Also export in current shell session
  const exportCommands = Object.entries(envVars)
    .map(([key, value]) => `export ${key}="${value.replace(/"/g, '\\"')}"`)
    .join(' && ');
  
  await sandboxManager.exec(sandbox.id, exportCommands);
}

function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /SECRET/i,
    /PASSWORD/i,
    /KEY/i,
    /TOKEN/i,
    /CREDENTIAL/i,
    /AUTH/i,
    /DATABASE_URL/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(key));
}

async function generateSecureSecret(length: number): Promise<string> {
  const { randomBytes } = await import('crypto');
  return randomBytes(length).toString('base64url').substring(0, length);
}
```

---

## Dependency Installation

### Step 6: Install Dependencies

```typescript
// src/services/webdev/steps/installDependencies.ts

interface InstallResult {
  success: boolean;
  duration: number;
  packageManager: 'pnpm' | 'npm' | 'yarn';
  installedPackages: number;
  cacheHit: boolean;
}

async function installDependencies(
  sandbox: PreparedSandbox,
  projectPath: string,
  template: ResolvedTemplate
): Promise<InstallResult> {
  
  const startTime = Date.now();
  const sandboxManager = new SandboxManager();
  
  // 6.1 Detect package manager
  const packageManager = await detectPackageManager(sandbox, projectPath);
  
  // 6.2 Check for lockfile
  const hasLockfile = await checkLockfile(sandbox, projectPath, packageManager);
  
  // 6.3 Run pre-install hook (if exists)
  if (template.hooks.preInstall) {
    await runTemplateHook(sandbox, template.hooks.preInstall, {
      projectPath,
      packageManager,
    });
  }
  
  // 6.4 Configure package manager cache
  await configurePackageManagerCache(sandbox, packageManager);
  
  // 6.5 Install dependencies
  const installCommand = getInstallCommand(packageManager, hasLockfile);
  
  logger.info('Installing dependencies', {
    projectPath,
    packageManager,
    command: installCommand,
  });
  
  const result = await sandboxManager.exec(sandbox.id, installCommand, {
    cwd: projectPath,
    timeout: 300000, // 5 minute timeout
    env: {
      ...sandbox.env,
      CI: 'true', // Disable interactive prompts
      npm_config_fund: 'false', // Disable funding messages
      npm_config_audit: 'false', // Disable audit (faster)
    },
  });
  
  if (result.exitCode !== 0) {
    // Try to diagnose the error
    const diagnosis = await diagnoseDependencyError(result.stderr);
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to install dependencies',
      cause: {
        command: installCommand,
        stderr: result.stderr.substring(0, 1000),
        diagnosis,
        suggestion: diagnosis.suggestion,
      },
    });
  }
  
  // 6.6 Run post-install hook (if exists)
  if (template.hooks.postInstall) {
    await runTemplateHook(sandbox, template.hooks.postInstall, {
      projectPath,
      packageManager,
    });
  }
  
  // 6.7 Verify installation
  await verifyInstallation(sandbox, projectPath);
  
  // 6.8 Count installed packages
  const installedPackages = await countInstalledPackages(sandbox, projectPath);
  
  const duration = Date.now() - startTime;
  
  logger.info('Dependencies installed', {
    projectPath,
    packageManager,
    duration,
    installedPackages,
  });

  return {
    success: true,
    duration,
    packageManager,
    installedPackages,
    cacheHit: result.stdout.includes('reused') || result.stdout.includes('cache'),
  };
}

async function detectPackageManager(
  sandbox: PreparedSandbox,
  projectPath: string
): Promise<'pnpm' | 'npm' | 'yarn'> {
  
  const sandboxManager = new SandboxManager();
  
  // Check for lockfiles in order of preference
  const lockfiles = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' as const },
    { file: 'yarn.lock', manager: 'yarn' as const },
    { file: 'package-lock.json', manager: 'npm' as const },
  ];
  
  for (const { file, manager } of lockfiles) {
    const exists = await checkPathExists(sandbox.id, `${projectPath}/${file}`);
    if (exists) {
      return manager;
    }
  }
  
  // Check package.json for packageManager field
  const packageJsonPath = `${projectPath}/package.json`;
  const packageJson = await readJsonFile(sandbox, packageJsonPath);
  
  if (packageJson.packageManager) {
    const match = packageJson.packageManager.match(/^(pnpm|npm|yarn)@/);
    if (match) {
      return match[1] as 'pnpm' | 'npm' | 'yarn';
    }
  }
  
  // Default to pnpm
  return 'pnpm';
}

function getInstallCommand(
  packageManager: 'pnpm' | 'npm' | 'yarn',
  hasLockfile: boolean
): string {
  
  switch (packageManager) {
    case 'pnpm':
      return hasLockfile 
        ? 'pnpm install --frozen-lockfile'
        : 'pnpm install';
    
    case 'yarn':
      return hasLockfile
        ? 'yarn install --frozen-lockfile'
        : 'yarn install';
    
    case 'npm':
      return hasLockfile
        ? 'npm ci'
        : 'npm install';
  }
}

async function configurePackageManagerCache(
  sandbox: PreparedSandbox,
  packageManager: 'pnpm' | 'npm' | 'yarn'
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  const cacheDir = '/home/ubuntu/.cache';
  
  switch (packageManager) {
    case 'pnpm':
      await sandboxManager.exec(sandbox.id, [
        `pnpm config set store-dir ${cacheDir}/pnpm-store`,
        `pnpm config set cache-dir ${cacheDir}/pnpm-cache`,
      ].join(' && '));
      break;
    
    case 'npm':
      await sandboxManager.exec(sandbox.id, 
        `npm config set cache ${cacheDir}/npm-cache`
      );
      break;
    
    case 'yarn':
      await sandboxManager.exec(sandbox.id,
        `yarn config set cache-folder ${cacheDir}/yarn-cache`
      );
      break;
  }
}

async function verifyInstallation(
  sandbox: PreparedSandbox,
  projectPath: string
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  
  // Check node_modules exists
  const nodeModulesExists = await checkPathExists(
    sandbox.id,
    `${projectPath}/node_modules`
  );
  
  if (!nodeModulesExists) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'node_modules directory not created after install',
    });
  }
  
  // Verify critical dependencies are installed
  const packageJson = await readJsonFile(sandbox, `${projectPath}/package.json`);
  const criticalDeps = ['react', 'vite', 'typescript'].filter(
    dep => packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
  );
  
  for (const dep of criticalDeps) {
    const depPath = `${projectPath}/node_modules/${dep}`;
    const exists = await checkPathExists(sandbox.id, depPath);
    
    if (!exists) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Critical dependency not installed: ${dep}`,
      });
    }
  }
}

interface DependencyErrorDiagnosis {
  type: 'network' | 'version' | 'peer' | 'disk' | 'unknown';
  message: string;
  suggestion: string;
}

async function diagnoseDependencyError(
  stderr: string
): Promise<DependencyErrorDiagnosis> {
  
  // Network errors
  if (stderr.includes('ENOTFOUND') || stderr.includes('ETIMEDOUT')) {
    return {
      type: 'network',
      message: 'Network error during package download',
      suggestion: 'Check internet connection and retry',
    };
  }
  
  // Version conflicts
  if (stderr.includes('ERESOLVE') || stderr.includes('peer dep')) {
    return {
      type: 'peer',
      message: 'Peer dependency conflict',
      suggestion: 'Try running with --legacy-peer-deps flag',
    };
  }
  
  // Disk space
  if (stderr.includes('ENOSPC')) {
    return {
      type: 'disk',
      message: 'Insufficient disk space',
      suggestion: 'Clear cache and retry, or upgrade sandbox resources',
    };
  }
  
  // Version not found
  if (stderr.includes('404') || stderr.includes('not found')) {
    return {
      type: 'version',
      message: 'Package version not found',
      suggestion: 'Check package name and version in package.json',
    };
  }
  
  return {
    type: 'unknown',
    message: 'Unknown installation error',
    suggestion: 'Check the error output for details',
  };
}
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
// src/services/webdev/errorHandling.ts

import { TRPCError } from '@trpc/server';

// Custom error types
export class WebdevInitError extends Error {
  constructor(
    message: string,
    public code: string,
    public step: string,
    public recoverable: boolean,
    public cause?: any
  ) {
    super(message);
    this.name = 'WebdevInitError';
  }
}

// Error codes
export const ErrorCodes = {
  // Validation errors (4xx)
  INVALID_PROJECT_NAME: 'INVALID_PROJECT_NAME',
  PROJECT_EXISTS: 'PROJECT_EXISTS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_TEMPLATE: 'INVALID_TEMPLATE',
  INVALID_FEATURES: 'INVALID_FEATURES',
  
  // Template errors
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_CLONE_FAILED: 'TEMPLATE_CLONE_FAILED',
  TEMPLATE_HOOK_FAILED: 'TEMPLATE_HOOK_FAILED',
  
  // Sandbox errors
  SANDBOX_NOT_READY: 'SANDBOX_NOT_READY',
  SANDBOX_WAKE_FAILED: 'SANDBOX_WAKE_FAILED',
  SANDBOX_RESOURCE_INSUFFICIENT: 'SANDBOX_RESOURCE_INSUFFICIENT',
  
  // Dependency errors
  DEPENDENCY_INSTALL_FAILED: 'DEPENDENCY_INSTALL_FAILED',
  DEPENDENCY_NETWORK_ERROR: 'DEPENDENCY_NETWORK_ERROR',
  DEPENDENCY_VERSION_CONFLICT: 'DEPENDENCY_VERSION_CONFLICT',
  
  // Database errors
  DATABASE_PROVISION_FAILED: 'DATABASE_PROVISION_FAILED',
  DATABASE_MIGRATION_FAILED: 'DATABASE_MIGRATION_FAILED',
  
  // Dev server errors
  DEV_SERVER_START_FAILED: 'DEV_SERVER_START_FAILED',
  DEV_SERVER_HEALTH_CHECK_FAILED: 'DEV_SERVER_HEALTH_CHECK_FAILED',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Error handler
export async function handleInitError(
  error: any,
  context: {
    sandboxId: string;
    projectName: string;
    step: string;
  }
): Promise<never> {
  
  logger.error('webdev_init_project error', {
    ...context,
    error: error.message,
    code: error.code,
    stack: error.stack,
  });
  
  // Attempt cleanup
  await cleanupOnFailure(context.sandboxId, context.projectName);
  
  // Map to TRPC error
  if (error instanceof TRPCError) {
    throw error;
  }
  
  if (error instanceof WebdevInitError) {
    throw new TRPCError({
      code: mapErrorCodeToTRPC(error.code),
      message: error.message,
      cause: {
        code: error.code,
        step: error.step,
        recoverable: error.recoverable,
        details: error.cause,
      },
    });
  }
  
  // Unknown error
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred during project initialization',
    cause: {
      code: ErrorCodes.INTERNAL_ERROR,
      step: context.step,
      originalError: error.message,
    },
  });
}

function mapErrorCodeToTRPC(code: string): TRPCError['code'] {
  const mapping: Record<string, TRPCError['code']> = {
    [ErrorCodes.INVALID_PROJECT_NAME]: 'BAD_REQUEST',
    [ErrorCodes.PROJECT_EXISTS]: 'CONFLICT',
    [ErrorCodes.QUOTA_EXCEEDED]: 'PRECONDITION_FAILED',
    [ErrorCodes.INVALID_TEMPLATE]: 'BAD_REQUEST',
    [ErrorCodes.TEMPLATE_NOT_FOUND]: 'NOT_FOUND',
    [ErrorCodes.SANDBOX_NOT_READY]: 'PRECONDITION_FAILED',
    [ErrorCodes.SANDBOX_RESOURCE_INSUFFICIENT]: 'PRECONDITION_FAILED',
  };
  
  return mapping[code] || 'INTERNAL_SERVER_ERROR';
}

// Cleanup on failure
async function cleanupOnFailure(
  sandboxId: string,
  projectName: string
): Promise<void> {
  
  const sandboxManager = new SandboxManager();
  
  try {
    // Remove project directory
    const projectPath = `/home/ubuntu/${projectName}`;
    await sandboxManager.exec(sandboxId, `rm -rf ${projectPath}`);
    
    // Kill any started processes
    await sandboxManager.exec(sandboxId, `pkill -f "${projectName}" || true`);
    
    // Remove from registry
    await ProjectRegistry.remove(projectName);
    
    logger.info('Cleanup completed after failure', {
      sandboxId,
      projectName,
    });
  } catch (cleanupError) {
    logger.warn('Cleanup failed', {
      sandboxId,
      projectName,
      error: cleanupError.message,
    });
    // Don't throw - cleanup is best-effort
  }
}

// Retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    retryDelay: number;
    retryableErrors: string[];
    onRetry?: (attempt: number, error: any) => void;
  }
): Promise<T> {
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = options.retryableErrors.some(
        code => error.code === code || error.message?.includes(code)
      );
      
      if (!isRetryable || attempt === options.maxRetries) {
        throw error;
      }
      
      // Call retry callback
      options.onRetry?.(attempt, error);
      
      // Wait before retry with exponential backoff
      const delay = options.retryDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// Usage example
async function cloneWithRetry(
  sandbox: PreparedSandbox,
  template: ResolvedTemplate,
  projectPath: string
): Promise<string[]> {
  
  return withRetry(
    () => cloneFromGit(sandbox, template, projectPath),
    {
      maxRetries: 3,
      retryDelay: 2000,
      retryableErrors: ['ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'],
      onRetry: (attempt, error) => {
        logger.warn('Retrying template clone', {
          attempt,
          error: error.message,
        });
      },
    }
  );
}
```

---

## Database Schema

### Project Registry Schema

```typescript
// drizzle/schema.ts

import { 
  mysqlTable, 
  varchar, 
  text, 
  json, 
  timestamp, 
  int,
  boolean,
  mysqlEnum,
} from 'drizzle-orm/mysql-core';

export const projects = mysqlTable('projects', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 128 }),
  description: text('description'),
  
  // Owner
  userId: varchar('user_id', { length: 36 }).notNull(),
  organizationId: varchar('organization_id', { length: 36 }),
  
  // Template info
  templateName: varchar('template_name', { length: 64 }).notNull(),
  templateVersion: varchar('template_version', { length: 32 }).notNull(),
  features: json('features').$type<string[]>().notNull().default([]),
  
  // Sandbox info
  sandboxId: varchar('sandbox_id', { length: 36 }).notNull(),
  projectPath: varchar('project_path', { length: 256 }).notNull(),
  
  // Status
  status: mysqlEnum('status', ['active', 'archived', 'deleted']).notNull().default('active'),
  
  // Dev server
  devServerPort: int('dev_server_port'),
  devServerUrl: varchar('dev_server_url', { length: 256 }),
  
  // Versioning
  currentVersionId: varchar('current_version_id', { length: 36 }),
  
  // Settings
  visibility: mysqlEnum('visibility', ['private', 'public']).notNull().default('private'),
  settings: json('settings').$type<ProjectSettings>().default({}),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  lastAccessedAt: timestamp('last_accessed_at'),
});

export const projectVersions = mysqlTable('project_versions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  
  // Version info
  versionNumber: int('version_number').notNull(),
  commitHash: varchar('commit_hash', { length: 40 }).notNull(),
  message: text('message'),
  
  // Snapshot
  snapshotPath: varchar('snapshot_path', { length: 256 }),
  snapshotSize: int('snapshot_size'),
  
  // Metadata
  filesChanged: int('files_changed').default(0),
  insertions: int('insertions').default(0),
  deletions: int('deletions').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 36 }),
});

export const projectSecrets = mysqlTable('project_secrets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  
  // Secret info
  key: varchar('key', { length: 128 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  
  // Metadata
  source: mysqlEnum('source', ['system', 'user', 'generated']).notNull(),
  isRequired: boolean('is_required').notNull().default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

interface ProjectSettings {
  customDomain?: string;
  favicon?: string;
  analytics?: {
    enabled: boolean;
    websiteId: string;
  };
  notifications?: {
    enabled: boolean;
    channels: string[];
  };
}
```

---

## API Contracts

### tRPC Router Definition

```typescript
// server/routers/webdev.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { webdevInitProject } from '../services/webdev/initProject';

export const webdevRouter = router({
  initProject: protectedProcedure
    .input(z.object({
      projectName: z.string()
        .min(1, 'Project name is required')
        .max(64, 'Project name too long')
        .regex(/^[a-z0-9-]+$/, 'Project name must be lowercase alphanumeric with hyphens'),
      template: z.string().default('web-static'),
      features: z.array(z.enum(['db', 'server', 'user', 'stripe'])).default([]),
      description: z.string().optional(),
      visibility: z.enum(['private', 'public']).default('private'),
    }))
    .output(z.object({
      projectName: z.string(),
      projectPath: z.string(),
      versionId: z.string(),
      features: z.array(z.string()),
      devServerUrl: z.string(),
      devServerPort: z.number(),
      status: z.enum(['running', 'starting', 'error']),
      createdFiles: z.array(z.string()),
      secrets: z.array(z.string()),
      readme: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return webdevInitProject(input, {
        sandboxId: ctx.sandboxId,
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId,
      });
    }),
});
```

---

## Monitoring and Observability

### Metrics and Logging

```typescript
// src/services/webdev/observability.ts

import { metrics } from '../utils/metrics';
import { logger } from '../utils/logger';

// Metrics definitions
export const webdevMetrics = {
  // Counters
  initStarted: 'webdev.init_project.started',
  initSuccess: 'webdev.init_project.success',
  initFailed: 'webdev.init_project.failed',
  
  // Timings
  initDuration: 'webdev.init_project.duration',
  stepDuration: 'webdev.init_project.step_duration',
  
  // Gauges
  activeProjects: 'webdev.projects.active',
};

// Step timing decorator
export function trackStep(stepName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        
        metrics.timing(webdevMetrics.stepDuration, Date.now() - startTime, {
          step: stepName,
          status: 'success',
        });
        
        return result;
      } catch (error) {
        metrics.timing(webdevMetrics.stepDuration, Date.now() - startTime, {
          step: stepName,
          status: 'error',
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Structured logging
export function logInitProgress(
  operationId: string,
  step: string,
  status: 'started' | 'completed' | 'failed',
  details?: Record<string, any>
): void {
  logger.info(`webdev_init_project:${step}`, {
    operationId,
    step,
    status,
    ...details,
  });
}
```

---

## Execution Timeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        webdev_init_project() EXECUTION TIMELINE                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  T+0ms      T+50ms     T+200ms    T+500ms    T+5s       T+30s      T+60s               │
│    │          │          │          │          │          │          │                  │
│    ▼          ▼          ▼          ▼          ▼          ▼          ▼                  │
│  ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐                   │
│  │Vali│    │Reso│    │Prep│    │Scaf│    │Inst│    │Data│    │Done│                   │
│  │date│───▶│lve │───▶│are │───▶│fold│───▶│all │───▶│base│───▶│    │                   │
│  └────┘    └────┘    └────┘    └────┘    └────┘    └────┘    └────┘                   │
│                                                                                         │
│  Steps:                                                                                 │
│  1. Validate input (~50ms)                                                              │
│  2. Resolve template (~150ms)                                                           │
│  3. Prepare sandbox (~300ms)                                                            │
│  4. Scaffold template (~2-5s)                                                           │
│  5. Inject env vars (~100ms)                                                            │
│  6. Install dependencies (~10-60s) ← SLOWEST STEP                                       │
│  7. Setup database (~5-10s if enabled)                                                  │
│  8. Start dev server (~2-5s)                                                            │
│  9. Verify health (~1-2s)                                                               │
│  10. Register project (~100ms)                                                          │
│  11. Create checkpoint (~1-2s)                                                          │
│                                                                                         │
│  TOTAL: 20-90 seconds (depending on template and cache)                                 │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Component | Implementation | Notes |
|-----------|---------------|-------|
| **Input Validation** | Zod schema | Strict validation with helpful errors |
| **Template Resolution** | Git-based | Supports official, community, private |
| **Sandbox Preparation** | Wake if hibernated | Ensures tools available |
| **Template Scaffolding** | Clone + substitute | Variable replacement, hooks |
| **Environment Injection** | .env + sandbox env | System + user + generated secrets |
| **Dependency Installation** | pnpm (default) | With retry logic, cache optimization |
| **Database Setup** | Drizzle migrations | Auto-provision if feature enabled |
| **Dev Server** | Vite + Express | Framework-aware startup |
| **Error Handling** | Comprehensive | Cleanup on failure, retry logic |
| **Observability** | Metrics + logging | Step-by-step timing |

---

## References

- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)
- [pnpm Documentation](https://pnpm.io/)
