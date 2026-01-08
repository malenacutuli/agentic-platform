# webdev_init_project Complete Flow Guide

## Overview

The `webdev_init_project` function is the core initialization flow that takes a user request and produces a fully running development environment. This guide documents every step with timing estimates and comprehensive error handling.

---

## 1. High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     webdev_init_project COMPLETE FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER REQUEST                                                               │
│       │                                                                     │
│       ▼ (0ms)                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 1: REQUEST VALIDATION & PARSING                    [0-100ms]  │   │
│  │ • Validate project name                                             │   │
│  │ • Parse template selection                                          │   │
│  │ • Validate features                                                 │   │
│  │ • Check user permissions                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (100ms)                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 2: RESOURCE ALLOCATION                           [100-500ms]  │   │
│  │ • Allocate sandbox container                                        │   │
│  │ • Reserve database instance                                         │   │
│  │ • Allocate storage quota                                            │   │
│  │ • Generate environment variables                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (500ms)                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 3: SANDBOX PROVISIONING                        [500-3000ms]   │   │
│  │ • Create container from base image                                  │   │
│  │ • Mount persistent volumes                                          │   │
│  │ • Configure network isolation                                       │   │
│  │ • Start container services                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (3000ms)                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 4: TEMPLATE GENERATION                         [3000-5000ms]  │   │
│  │ • Select and load template                                          │   │
│  │ • Generate project files                                            │   │
│  │ • Apply customizations                                              │   │
│  │ • Initialize git repository                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (5000ms)                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 5: DEPENDENCY INSTALLATION                    [5000-25000ms]  │   │
│  │ • Install npm packages (pnpm install)                               │   │
│  │ • Build native modules                                              │   │
│  │ • Cache dependencies                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (25000ms)                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 6: DATABASE SETUP                            [25000-30000ms]  │   │
│  │ • Create database schema                                            │   │
│  │ • Run migrations                                                    │   │
│  │ • Seed initial data (if applicable)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (30000ms)                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 7: DEV SERVER STARTUP                        [30000-35000ms]  │   │
│  │ • Start development server                                          │   │
│  │ • Configure port exposure                                           │   │
│  │ • Wait for server ready                                             │   │
│  │ • Generate public URL                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (35000ms)                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 8: HEALTH CHECK & FINALIZATION               [35000-40000ms]  │   │
│  │ • Verify server responding                                          │   │
│  │ • Check database connectivity                                       │   │
│  │ • Create initial checkpoint                                         │   │
│  │ • Return success response                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (40000ms)                                                           │
│  RUNNING PROJECT                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

TOTAL TIME: 30-45 seconds (typical)
            15-20 seconds (cached/optimized)
            60-90 seconds (worst case)
```

---

## 2. Detailed Phase Breakdown

### Phase 1: Request Validation & Parsing (0-100ms)

```typescript
interface InitProjectRequest {
  projectName: string;
  template?: TemplateType;
  features?: Feature[];
  description?: string;
  userId: string;
  organizationId?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  normalizedRequest: NormalizedRequest;
}

interface ValidationError {
  code: string;
  message: string;
  field: string;
  suggestion?: string;
}

type TemplateType = 'web-static' | 'web-db-user' | 'web-ai-agent' | 'mobile-app' | 'data-pipeline' | 'api-service' | 'dashboard';
type Feature = 'db' | 'server' | 'user' | 'ai' | 'storage' | 'realtime' | 'stripe';

class RequestValidator {
  private reservedNames = ['admin', 'api', 'www', 'app', 'test', 'demo', 'null', 'undefined'];
  private maxProjectNameLength = 64;
  private minProjectNameLength = 3;

  async validate(request: InitProjectRequest): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const startTime = Date.now();

    // 1. Validate project name (5ms)
    const nameValidation = this.validateProjectName(request.projectName);
    if (!nameValidation.valid) {
      errors.push(...nameValidation.errors);
    }

    // 2. Validate template selection (2ms)
    const templateValidation = this.validateTemplate(request.template);
    if (!templateValidation.valid) {
      errors.push(...templateValidation.errors);
    }

    // 3. Validate features compatibility (5ms)
    const featuresValidation = this.validateFeatures(request.features, request.template);
    if (!featuresValidation.valid) {
      errors.push(...featuresValidation.errors);
    }
    warnings.push(...featuresValidation.warnings);

    // 4. Check user permissions (20ms - async)
    const permissionCheck = await this.checkUserPermissions(request.userId, request.organizationId);
    if (!permissionCheck.allowed) {
      errors.push({
        code: 'PERMISSION_DENIED',
        message: permissionCheck.reason,
        field: 'userId'
      });
    }

    // 5. Check project name availability (30ms - async)
    const nameAvailable = await this.checkProjectNameAvailability(
      request.projectName,
      request.userId
    );
    if (!nameAvailable) {
      errors.push({
        code: 'PROJECT_NAME_TAKEN',
        message: `Project name "${request.projectName}" is already in use`,
        field: 'projectName',
        suggestion: this.suggestAlternativeName(request.projectName)
      });
    }

    // 6. Check resource quotas (20ms - async)
    const quotaCheck = await this.checkResourceQuotas(request.userId, request.template);
    if (!quotaCheck.allowed) {
      errors.push({
        code: 'QUOTA_EXCEEDED',
        message: quotaCheck.reason,
        field: 'userId',
        suggestion: 'Upgrade your plan or delete unused projects'
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Phase 1] Validation completed in ${duration}ms`);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedRequest: this.normalizeRequest(request)
    };
  }

  private validateProjectName(name: string): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Check length
    if (name.length < this.minProjectNameLength) {
      errors.push({
        code: 'NAME_TOO_SHORT',
        message: `Project name must be at least ${this.minProjectNameLength} characters`,
        field: 'projectName'
      });
    }

    if (name.length > this.maxProjectNameLength) {
      errors.push({
        code: 'NAME_TOO_LONG',
        message: `Project name must be at most ${this.maxProjectNameLength} characters`,
        field: 'projectName'
      });
    }

    // Check format (lowercase, alphanumeric, hyphens)
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
      errors.push({
        code: 'INVALID_NAME_FORMAT',
        message: 'Project name must start with a letter, contain only lowercase letters, numbers, and hyphens, and end with a letter or number',
        field: 'projectName',
        suggestion: this.sanitizeProjectName(name)
      });
    }

    // Check reserved names
    if (this.reservedNames.includes(name.toLowerCase())) {
      errors.push({
        code: 'RESERVED_NAME',
        message: `"${name}" is a reserved name and cannot be used`,
        field: 'projectName'
      });
    }

    return { valid: errors.length === 0, errors };
  }

  private validateTemplate(template?: TemplateType): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    const validTemplates: TemplateType[] = [
      'web-static', 'web-db-user', 'web-ai-agent', 
      'mobile-app', 'data-pipeline', 'api-service', 'dashboard'
    ];

    if (template && !validTemplates.includes(template)) {
      errors.push({
        code: 'INVALID_TEMPLATE',
        message: `Invalid template "${template}". Valid options: ${validTemplates.join(', ')}`,
        field: 'template'
      });
    }

    return { valid: errors.length === 0, errors };
  }

  private validateFeatures(
    features?: Feature[],
    template?: TemplateType
  ): { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Feature compatibility matrix
    const templateFeatures: Record<TemplateType, Feature[]> = {
      'web-static': [],
      'web-db-user': ['db', 'server', 'user'],
      'web-ai-agent': ['db', 'server', 'user', 'ai'],
      'mobile-app': ['db', 'server', 'user'],
      'data-pipeline': ['db', 'server'],
      'api-service': ['db', 'server'],
      'dashboard': ['db', 'server', 'user']
    };

    if (features && template) {
      const supportedFeatures = templateFeatures[template];
      
      for (const feature of features) {
        if (!supportedFeatures.includes(feature)) {
          warnings.push({
            code: 'UNSUPPORTED_FEATURE',
            message: `Feature "${feature}" is not typically used with ${template} template`,
            field: 'features'
          });
        }
      }
    }

    // Check feature dependencies
    if (features?.includes('user') && !features?.includes('db')) {
      errors.push({
        code: 'MISSING_DEPENDENCY',
        message: 'User authentication requires database feature',
        field: 'features',
        suggestion: 'Add "db" to features'
      });
    }

    if (features?.includes('ai') && !features?.includes('server')) {
      errors.push({
        code: 'MISSING_DEPENDENCY',
        message: 'AI feature requires server feature',
        field: 'features',
        suggestion: 'Add "server" to features'
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private async checkUserPermissions(
    userId: string,
    organizationId?: string
  ): Promise<{ allowed: boolean; reason: string }> {
    // Check user exists and is active
    const user = await this.getUserById(userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    if (user.status !== 'active') {
      return { allowed: false, reason: 'User account is not active' };
    }

    // Check organization permissions if applicable
    if (organizationId) {
      const orgMember = await this.getOrgMembership(userId, organizationId);
      if (!orgMember) {
        return { allowed: false, reason: 'User is not a member of this organization' };
      }

      if (!['admin', 'developer'].includes(orgMember.role)) {
        return { allowed: false, reason: 'User does not have permission to create projects' };
      }
    }

    return { allowed: true, reason: '' };
  }

  private async checkProjectNameAvailability(name: string, userId: string): Promise<boolean> {
    const existing = await this.db.query(
      'SELECT id FROM projects WHERE name = ? AND (user_id = ? OR visibility = "public")',
      [name, userId]
    );
    return existing.length === 0;
  }

  private async checkResourceQuotas(
    userId: string,
    template?: TemplateType
  ): Promise<{ allowed: boolean; reason: string }> {
    const user = await this.getUserById(userId);
    const plan = await this.getUserPlan(userId);
    
    // Count existing projects
    const projectCount = await this.db.query(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = ?',
      [userId]
    );

    if (projectCount[0].count >= plan.maxProjects) {
      return {
        allowed: false,
        reason: `You have reached your project limit (${plan.maxProjects}). Upgrade your plan or delete unused projects.`
      };
    }

    return { allowed: true, reason: '' };
  }

  private normalizeRequest(request: InitProjectRequest): NormalizedRequest {
    return {
      ...request,
      projectName: request.projectName.toLowerCase().trim(),
      template: request.template || 'web-db-user',
      features: request.features || this.getDefaultFeatures(request.template || 'web-db-user')
    };
  }

  private getDefaultFeatures(template: TemplateType): Feature[] {
    const defaults: Record<TemplateType, Feature[]> = {
      'web-static': [],
      'web-db-user': ['db', 'server', 'user'],
      'web-ai-agent': ['db', 'server', 'user', 'ai'],
      'mobile-app': ['db', 'server', 'user'],
      'data-pipeline': ['db', 'server'],
      'api-service': ['db', 'server'],
      'dashboard': ['db', 'server', 'user']
    };
    return defaults[template];
  }

  private sanitizeProjectName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private suggestAlternativeName(name: string): string {
    const timestamp = Date.now().toString(36).slice(-4);
    return `${name}-${timestamp}`;
  }

  // Stub methods for database operations
  private async getUserById(userId: string): Promise<any> { /* ... */ }
  private async getUserPlan(userId: string): Promise<any> { /* ... */ }
  private async getOrgMembership(userId: string, orgId: string): Promise<any> { /* ... */ }
  private db = { query: async (sql: string, params: any[]) => [] as any[] };
}

// Error handling for Phase 1
const phase1Errors = {
  'NAME_TOO_SHORT': { recoverable: true, action: 'prompt_user' },
  'NAME_TOO_LONG': { recoverable: true, action: 'prompt_user' },
  'INVALID_NAME_FORMAT': { recoverable: true, action: 'auto_fix_or_prompt' },
  'RESERVED_NAME': { recoverable: true, action: 'prompt_user' },
  'PROJECT_NAME_TAKEN': { recoverable: true, action: 'suggest_alternative' },
  'INVALID_TEMPLATE': { recoverable: true, action: 'prompt_user' },
  'MISSING_DEPENDENCY': { recoverable: true, action: 'auto_add_dependency' },
  'PERMISSION_DENIED': { recoverable: false, action: 'abort' },
  'QUOTA_EXCEEDED': { recoverable: false, action: 'prompt_upgrade' }
};
```

### Phase 2: Resource Allocation (100-500ms)

```typescript
interface ResourceAllocation {
  sandboxId: string;
  databaseId?: string;
  storageQuota: number;
  envVars: Record<string, string>;
  networkConfig: NetworkConfig;
}

interface NetworkConfig {
  internalIp: string;
  publicPort: number;
  tunnelId: string;
}

class ResourceAllocator {
  private sandboxPool: SandboxPool;
  private databasePool: DatabasePool;
  private storageManager: StorageManager;

  async allocate(request: NormalizedRequest): Promise<ResourceAllocation> {
    const startTime = Date.now();
    const allocation: Partial<ResourceAllocation> = {};

    try {
      // 1. Allocate sandbox container (100-200ms)
      console.log('[Phase 2] Allocating sandbox...');
      allocation.sandboxId = await this.allocateSandbox(request);
      
      // 2. Reserve database instance if needed (50-100ms)
      if (request.features.includes('db')) {
        console.log('[Phase 2] Reserving database...');
        allocation.databaseId = await this.reserveDatabase(request);
      }

      // 3. Allocate storage quota (20ms)
      console.log('[Phase 2] Allocating storage...');
      allocation.storageQuota = await this.allocateStorage(request);

      // 4. Generate environment variables (50ms)
      console.log('[Phase 2] Generating environment variables...');
      allocation.envVars = await this.generateEnvVars(request, allocation);

      // 5. Configure network (100ms)
      console.log('[Phase 2] Configuring network...');
      allocation.networkConfig = await this.configureNetwork(allocation.sandboxId!);

      const duration = Date.now() - startTime;
      console.log(`[Phase 2] Resource allocation completed in ${duration}ms`);

      return allocation as ResourceAllocation;
    } catch (error) {
      // Rollback any partial allocations
      await this.rollbackAllocation(allocation);
      throw error;
    }
  }

  private async allocateSandbox(request: NormalizedRequest): Promise<string> {
    // Try to get a warm sandbox from pool first (faster)
    const warmSandbox = await this.sandboxPool.getWarm(request.template);
    if (warmSandbox) {
      console.log('[Phase 2] Using warm sandbox from pool');
      return warmSandbox.id;
    }

    // Otherwise, create a new sandbox
    console.log('[Phase 2] Creating new sandbox');
    const sandbox = await this.sandboxPool.create({
      template: request.template,
      userId: request.userId,
      projectName: request.projectName
    });

    return sandbox.id;
  }

  private async reserveDatabase(request: NormalizedRequest): Promise<string> {
    // Get database configuration based on plan
    const plan = await this.getUserPlan(request.userId);
    const dbConfig = this.getDatabaseConfig(plan);

    // Reserve database instance
    const database = await this.databasePool.reserve({
      userId: request.userId,
      projectName: request.projectName,
      ...dbConfig
    });

    return database.id;
  }

  private getDatabaseConfig(plan: UserPlan): DatabaseConfig {
    const configs: Record<string, DatabaseConfig> = {
      free: { maxConnections: 5, storageMb: 500, type: 'shared' },
      pro: { maxConnections: 20, storageMb: 5000, type: 'shared' },
      enterprise: { maxConnections: 100, storageMb: 50000, type: 'dedicated' }
    };
    return configs[plan.tier] || configs.free;
  }

  private async allocateStorage(request: NormalizedRequest): Promise<number> {
    const plan = await this.getUserPlan(request.userId);
    const quotas: Record<string, number> = {
      free: 1024 * 1024 * 500,      // 500 MB
      pro: 1024 * 1024 * 1024 * 5,  // 5 GB
      enterprise: 1024 * 1024 * 1024 * 50 // 50 GB
    };
    return quotas[plan.tier] || quotas.free;
  }

  private async generateEnvVars(
    request: NormalizedRequest,
    allocation: Partial<ResourceAllocation>
  ): Promise<Record<string, string>> {
    const envVars: Record<string, string> = {};

    // Core environment variables
    envVars.NODE_ENV = 'development';
    envVars.VITE_APP_ID = this.generateAppId();
    envVars.VITE_APP_TITLE = this.formatProjectTitle(request.projectName);
    envVars.VITE_APP_LOGO = '/logo.svg';

    // Database URL if database is allocated
    if (allocation.databaseId) {
      const dbInfo = await this.databasePool.getConnectionInfo(allocation.databaseId);
      envVars.DATABASE_URL = this.buildDatabaseUrl(dbInfo);
    }

    // JWT secret for authentication
    if (request.features.includes('user')) {
      envVars.JWT_SECRET = this.generateSecureSecret(64);
      envVars.OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL!;
      envVars.VITE_OAUTH_PORTAL_URL = process.env.VITE_OAUTH_PORTAL_URL!;
    }

    // LLM API keys if AI feature is enabled
    if (request.features.includes('ai')) {
      envVars.BUILT_IN_FORGE_API_URL = process.env.FORGE_API_URL!;
      envVars.BUILT_IN_FORGE_API_KEY = await this.generateForgeApiKey(request.userId);
      envVars.VITE_FRONTEND_FORGE_API_URL = process.env.FORGE_API_URL!;
      envVars.VITE_FRONTEND_FORGE_API_KEY = await this.generateFrontendForgeApiKey(request.userId);
    }

    // Storage configuration
    if (request.features.includes('storage')) {
      envVars.S3_BUCKET = await this.allocateS3Bucket(request.projectName);
      envVars.S3_REGION = 'us-east-1';
      envVars.S3_ACCESS_KEY = await this.generateS3AccessKey(request.userId);
      envVars.S3_SECRET_KEY = await this.generateS3SecretKey(request.userId);
    }

    // Owner information
    const user = await this.getUserById(request.userId);
    envVars.OWNER_OPEN_ID = user.openId;
    envVars.OWNER_NAME = user.name;

    // Analytics
    envVars.VITE_ANALYTICS_ENDPOINT = process.env.ANALYTICS_ENDPOINT!;
    envVars.VITE_ANALYTICS_WEBSITE_ID = this.generateAnalyticsId();

    return envVars;
  }

  private async configureNetwork(sandboxId: string): Promise<NetworkConfig> {
    // Allocate internal IP
    const internalIp = await this.allocateInternalIp(sandboxId);

    // Allocate public port
    const publicPort = await this.allocatePublicPort();

    // Create tunnel for public access
    const tunnelId = await this.createTunnel(sandboxId, publicPort);

    return { internalIp, publicPort, tunnelId };
  }

  private async rollbackAllocation(allocation: Partial<ResourceAllocation>): Promise<void> {
    console.log('[Phase 2] Rolling back partial allocation...');

    if (allocation.sandboxId) {
      await this.sandboxPool.release(allocation.sandboxId);
    }

    if (allocation.databaseId) {
      await this.databasePool.release(allocation.databaseId);
    }

    if (allocation.networkConfig?.tunnelId) {
      await this.destroyTunnel(allocation.networkConfig.tunnelId);
    }
  }

  // Helper methods
  private generateAppId(): string {
    return `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private formatProjectTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateSecureSecret(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private buildDatabaseUrl(dbInfo: DatabaseInfo): string {
    return `mysql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?ssl=true`;
  }

  // Stub methods
  private async getUserPlan(userId: string): Promise<UserPlan> { return { tier: 'pro' } as UserPlan; }
  private async getUserById(userId: string): Promise<any> { return {}; }
  private async allocateInternalIp(sandboxId: string): Promise<string> { return '10.0.0.1'; }
  private async allocatePublicPort(): Promise<number> { return 3000; }
  private async createTunnel(sandboxId: string, port: number): Promise<string> { return 'tunnel_123'; }
  private async destroyTunnel(tunnelId: string): Promise<void> { }
  private async generateForgeApiKey(userId: string): Promise<string> { return 'forge_key'; }
  private async generateFrontendForgeApiKey(userId: string): Promise<string> { return 'forge_frontend_key'; }
  private async allocateS3Bucket(projectName: string): Promise<string> { return `bucket-${projectName}`; }
  private async generateS3AccessKey(userId: string): Promise<string> { return 's3_access_key'; }
  private async generateS3SecretKey(userId: string): Promise<string> { return 's3_secret_key'; }
  private generateAnalyticsId(): string { return `analytics_${Date.now()}`; }
}

// Error handling for Phase 2
const phase2Errors = {
  'SANDBOX_POOL_EXHAUSTED': { 
    recoverable: true, 
    action: 'wait_and_retry',
    maxRetries: 3,
    retryDelay: 5000
  },
  'DATABASE_POOL_EXHAUSTED': { 
    recoverable: true, 
    action: 'wait_and_retry',
    maxRetries: 3,
    retryDelay: 5000
  },
  'STORAGE_QUOTA_EXCEEDED': { 
    recoverable: false, 
    action: 'prompt_upgrade'
  },
  'NETWORK_ALLOCATION_FAILED': { 
    recoverable: true, 
    action: 'retry_with_different_port'
  },
  'ENV_VAR_GENERATION_FAILED': { 
    recoverable: true, 
    action: 'retry'
  }
};
```

### Phase 3: Sandbox Provisioning (500-3000ms)

```typescript
interface SandboxConfig {
  sandboxId: string;
  baseImage: string;
  volumes: VolumeMount[];
  networkPolicy: NetworkPolicy;
  resourceLimits: ResourceLimits;
}

interface VolumeMount {
  name: string;
  mountPath: string;
  type: 'persistent' | 'ephemeral' | 'shared';
  size: string;
}

interface ResourceLimits {
  cpu: string;
  memory: string;
  storage: string;
}

class SandboxProvisioner {
  private docker: DockerClient;
  private k8s: KubernetesClient;

  async provision(
    allocation: ResourceAllocation,
    request: NormalizedRequest
  ): Promise<SandboxConfig> {
    const startTime = Date.now();

    try {
      // 1. Select base image (10ms)
      console.log('[Phase 3] Selecting base image...');
      const baseImage = this.selectBaseImage(request.template);

      // 2. Configure volumes (50ms)
      console.log('[Phase 3] Configuring volumes...');
      const volumes = await this.configureVolumes(allocation.sandboxId, request);

      // 3. Configure network policy (100ms)
      console.log('[Phase 3] Configuring network policy...');
      const networkPolicy = await this.configureNetworkPolicy(allocation);

      // 4. Set resource limits (20ms)
      console.log('[Phase 3] Setting resource limits...');
      const resourceLimits = this.getResourceLimits(request.userId);

      // 5. Create container (1000-2000ms)
      console.log('[Phase 3] Creating container...');
      await this.createContainer({
        sandboxId: allocation.sandboxId,
        baseImage,
        volumes,
        networkPolicy,
        resourceLimits,
        envVars: allocation.envVars
      });

      // 6. Start container (500-1000ms)
      console.log('[Phase 3] Starting container...');
      await this.startContainer(allocation.sandboxId);

      // 7. Wait for container ready (200-500ms)
      console.log('[Phase 3] Waiting for container ready...');
      await this.waitForContainerReady(allocation.sandboxId);

      const duration = Date.now() - startTime;
      console.log(`[Phase 3] Sandbox provisioning completed in ${duration}ms`);

      return {
        sandboxId: allocation.sandboxId,
        baseImage,
        volumes,
        networkPolicy,
        resourceLimits
      };
    } catch (error) {
      // Cleanup on failure
      await this.cleanup(allocation.sandboxId);
      throw error;
    }
  }

  private selectBaseImage(template: TemplateType): string {
    const images: Record<TemplateType, string> = {
      'web-static': 'manus/sandbox-web-static:latest',
      'web-db-user': 'manus/sandbox-web-db-user:latest',
      'web-ai-agent': 'manus/sandbox-web-ai-agent:latest',
      'mobile-app': 'manus/sandbox-mobile-app:latest',
      'data-pipeline': 'manus/sandbox-data-pipeline:latest',
      'api-service': 'manus/sandbox-api-service:latest',
      'dashboard': 'manus/sandbox-dashboard:latest'
    };
    return images[template];
  }

  private async configureVolumes(
    sandboxId: string,
    request: NormalizedRequest
  ): Promise<VolumeMount[]> {
    const volumes: VolumeMount[] = [];

    // Project files volume (persistent)
    volumes.push({
      name: `${sandboxId}-project`,
      mountPath: `/home/ubuntu/${request.projectName}`,
      type: 'persistent',
      size: '10Gi'
    });

    // Node modules cache (shared across sandboxes)
    volumes.push({
      name: 'node-modules-cache',
      mountPath: '/home/ubuntu/.pnpm-store',
      type: 'shared',
      size: '50Gi'
    });

    // Temp directory (ephemeral)
    volumes.push({
      name: `${sandboxId}-tmp`,
      mountPath: '/tmp',
      type: 'ephemeral',
      size: '5Gi'
    });

    // Create volumes
    for (const volume of volumes) {
      await this.createVolume(volume);
    }

    return volumes;
  }

  private async configureNetworkPolicy(allocation: ResourceAllocation): Promise<NetworkPolicy> {
    return {
      // Allow outbound internet access
      egress: [
        { to: [{ ipBlock: { cidr: '0.0.0.0/0' } }] }
      ],
      // Only allow inbound from load balancer
      ingress: [
        {
          from: [{ namespaceSelector: { matchLabels: { name: 'ingress' } } }],
          ports: [{ port: allocation.networkConfig.publicPort, protocol: 'TCP' }]
        }
      ],
      // Deny all inter-sandbox communication
      podSelector: {
        matchLabels: { sandboxId: allocation.sandboxId }
      }
    };
  }

  private getResourceLimits(userId: string): ResourceLimits {
    // Get limits based on user plan
    const plan = this.getUserPlan(userId);
    
    const limits: Record<string, ResourceLimits> = {
      free: { cpu: '0.5', memory: '512Mi', storage: '1Gi' },
      pro: { cpu: '2', memory: '4Gi', storage: '10Gi' },
      enterprise: { cpu: '8', memory: '16Gi', storage: '100Gi' }
    };

    return limits[plan.tier] || limits.free;
  }

  private async createContainer(config: ContainerConfig): Promise<void> {
    const containerSpec = {
      name: config.sandboxId,
      image: config.baseImage,
      env: Object.entries(config.envVars).map(([name, value]) => ({ name, value })),
      volumeMounts: config.volumes.map(v => ({
        name: v.name,
        mountPath: v.mountPath
      })),
      resources: {
        limits: {
          cpu: config.resourceLimits.cpu,
          memory: config.resourceLimits.memory,
          'ephemeral-storage': config.resourceLimits.storage
        },
        requests: {
          cpu: '0.1',
          memory: '256Mi'
        }
      },
      securityContext: {
        runAsUser: 1000,
        runAsGroup: 1000,
        fsGroup: 1000,
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: false,
        capabilities: {
          drop: ['ALL'],
          add: ['NET_BIND_SERVICE']
        }
      }
    };

    await this.k8s.createPod(containerSpec);
  }

  private async startContainer(sandboxId: string): Promise<void> {
    await this.k8s.startPod(sandboxId);
  }

  private async waitForContainerReady(sandboxId: string, timeout = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await this.k8s.getPodStatus(sandboxId);
      
      if (status.phase === 'Running' && status.ready) {
        return;
      }
      
      if (status.phase === 'Failed') {
        throw new Error(`Container failed to start: ${status.reason}`);
      }
      
      await this.sleep(500);
    }
    
    throw new Error('Container startup timeout');
  }

  private async cleanup(sandboxId: string): Promise<void> {
    try {
      await this.k8s.deletePod(sandboxId);
    } catch (error) {
      console.error(`Failed to cleanup sandbox ${sandboxId}:`, error);
    }
  }

  private async createVolume(volume: VolumeMount): Promise<void> {
    // Create PersistentVolumeClaim for persistent volumes
    if (volume.type === 'persistent') {
      await this.k8s.createPVC({
        name: volume.name,
        size: volume.size,
        storageClass: 'standard'
      });
    }
  }

  private getUserPlan(userId: string): UserPlan {
    return { tier: 'pro' } as UserPlan;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Error handling for Phase 3
const phase3Errors = {
  'IMAGE_PULL_FAILED': {
    recoverable: true,
    action: 'retry_with_fallback_registry',
    maxRetries: 3
  },
  'VOLUME_CREATION_FAILED': {
    recoverable: true,
    action: 'retry_with_different_storage_class',
    maxRetries: 2
  },
  'CONTAINER_START_FAILED': {
    recoverable: true,
    action: 'retry_with_reduced_resources',
    maxRetries: 2
  },
  'CONTAINER_STARTUP_TIMEOUT': {
    recoverable: true,
    action: 'extend_timeout_and_retry',
    maxRetries: 2
  },
  'NETWORK_POLICY_FAILED': {
    recoverable: true,
    action: 'retry',
    maxRetries: 3
  },
  'RESOURCE_LIMIT_EXCEEDED': {
    recoverable: false,
    action: 'prompt_upgrade'
  }
};
```

### Phase 4: Template Generation (3000-5000ms)

```typescript
interface GeneratedProject {
  files: GeneratedFile[];
  gitInitialized: boolean;
  initialCommit: string;
}

interface GeneratedFile {
  path: string;
  content: string;
  executable: boolean;
}

class TemplateGenerator {
  private templateRegistry: TemplateRegistry;
  private fileSystem: SandboxFileSystem;

  async generate(
    sandboxConfig: SandboxConfig,
    request: NormalizedRequest,
    allocation: ResourceAllocation
  ): Promise<GeneratedProject> {
    const startTime = Date.now();
    const projectPath = `/home/ubuntu/${request.projectName}`;

    try {
      // 1. Load template (100ms)
      console.log('[Phase 4] Loading template...');
      const template = await this.loadTemplate(request.template);

      // 2. Generate project files (500-1000ms)
      console.log('[Phase 4] Generating project files...');
      const files = await this.generateFiles(template, request, allocation);

      // 3. Write files to sandbox (500-1000ms)
      console.log('[Phase 4] Writing files to sandbox...');
      await this.writeFiles(sandboxConfig.sandboxId, projectPath, files);

      // 4. Apply customizations (200ms)
      console.log('[Phase 4] Applying customizations...');
      await this.applyCustomizations(sandboxConfig.sandboxId, projectPath, request);

      // 5. Initialize git repository (500ms)
      console.log('[Phase 4] Initializing git repository...');
      const gitResult = await this.initializeGit(sandboxConfig.sandboxId, projectPath);

      const duration = Date.now() - startTime;
      console.log(`[Phase 4] Template generation completed in ${duration}ms`);

      return {
        files,
        gitInitialized: true,
        initialCommit: gitResult.commitHash
      };
    } catch (error) {
      // Cleanup on failure
      await this.cleanup(sandboxConfig.sandboxId, projectPath);
      throw error;
    }
  }

  private async loadTemplate(templateType: TemplateType): Promise<Template> {
    const template = await this.templateRegistry.get(templateType);
    
    if (!template) {
      throw new Error(`Template ${templateType} not found`);
    }

    return template;
  }

  private async generateFiles(
    template: Template,
    request: NormalizedRequest,
    allocation: ResourceAllocation
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const context = this.buildTemplateContext(request, allocation);

    // Process each template file
    for (const templateFile of template.files) {
      const content = await this.processTemplateFile(templateFile, context);
      
      files.push({
        path: this.interpolatePath(templateFile.path, context),
        content,
        executable: templateFile.executable || false
      });
    }

    // Add feature-specific files
    for (const feature of request.features) {
      const featureFiles = await this.generateFeatureFiles(feature, context);
      files.push(...featureFiles);
    }

    return files;
  }

  private buildTemplateContext(
    request: NormalizedRequest,
    allocation: ResourceAllocation
  ): TemplateContext {
    return {
      projectName: request.projectName,
      projectTitle: this.formatProjectTitle(request.projectName),
      features: request.features,
      envVars: allocation.envVars,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  private async processTemplateFile(
    templateFile: TemplateFile,
    context: TemplateContext
  ): Promise<string> {
    let content = templateFile.content;

    // Replace template variables
    content = this.interpolateVariables(content, context);

    // Process conditional blocks
    content = this.processConditionals(content, context);

    // Process loops
    content = this.processLoops(content, context);

    return content;
  }

  private interpolateVariables(content: string, context: TemplateContext): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }

  private processConditionals(content: string, context: TemplateContext): string {
    // Process {{#if feature}}...{{/if}} blocks
    return content.replace(
      /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, block) => {
        if (context.features.includes(condition) || context[condition]) {
          return block;
        }
        return '';
      }
    );
  }

  private processLoops(content: string, context: TemplateContext): string {
    // Process {{#each items}}...{{/each}} blocks
    return content.replace(
      /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, arrayName, block) => {
        const array = context[arrayName];
        if (!Array.isArray(array)) return '';
        
        return array.map(item => {
          return block.replace(/\{\{this\}\}/g, item);
        }).join('\n');
      }
    );
  }

  private interpolatePath(path: string, context: TemplateContext): string {
    return path.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }

  private async generateFeatureFiles(
    feature: Feature,
    context: TemplateContext
  ): Promise<GeneratedFile[]> {
    const featureTemplates: Record<Feature, () => GeneratedFile[]> = {
      db: () => this.generateDatabaseFiles(context),
      server: () => this.generateServerFiles(context),
      user: () => this.generateAuthFiles(context),
      ai: () => this.generateAIFiles(context),
      storage: () => this.generateStorageFiles(context),
      realtime: () => this.generateRealtimeFiles(context),
      stripe: () => this.generateStripeFiles(context)
    };

    const generator = featureTemplates[feature];
    return generator ? generator() : [];
  }

  private generateDatabaseFiles(context: TemplateContext): GeneratedFile[] {
    return [
      {
        path: 'drizzle/schema.ts',
        content: this.getDatabaseSchemaTemplate(context),
        executable: false
      },
      {
        path: 'drizzle.config.ts',
        content: this.getDrizzleConfigTemplate(context),
        executable: false
      }
    ];
  }

  private generateAuthFiles(context: TemplateContext): GeneratedFile[] {
    return [
      {
        path: 'server/_core/auth.ts',
        content: this.getAuthTemplate(context),
        executable: false
      }
    ];
  }

  private generateAIFiles(context: TemplateContext): GeneratedFile[] {
    return [
      {
        path: 'server/_core/llm.ts',
        content: this.getLLMTemplate(context),
        executable: false
      }
    ];
  }

  private async writeFiles(
    sandboxId: string,
    projectPath: string,
    files: GeneratedFile[]
  ): Promise<void> {
    // Create project directory
    await this.fileSystem.mkdir(sandboxId, projectPath, { recursive: true });

    // Write files in parallel batches
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map(file => this.writeFile(sandboxId, projectPath, file))
      );
    }
  }

  private async writeFile(
    sandboxId: string,
    projectPath: string,
    file: GeneratedFile
  ): Promise<void> {
    const fullPath = `${projectPath}/${file.path}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

    // Ensure directory exists
    await this.fileSystem.mkdir(sandboxId, dir, { recursive: true });

    // Write file
    await this.fileSystem.writeFile(sandboxId, fullPath, file.content);

    // Set executable permission if needed
    if (file.executable) {
      await this.fileSystem.chmod(sandboxId, fullPath, '755');
    }
  }

  private async applyCustomizations(
    sandboxId: string,
    projectPath: string,
    request: NormalizedRequest
  ): Promise<void> {
    // Update package.json with project name
    const packageJsonPath = `${projectPath}/package.json`;
    const packageJson = JSON.parse(
      await this.fileSystem.readFile(sandboxId, packageJsonPath)
    );
    packageJson.name = request.projectName;
    await this.fileSystem.writeFile(
      sandboxId,
      packageJsonPath,
      JSON.stringify(packageJson, null, 2)
    );

    // Update README with project name
    const readmePath = `${projectPath}/README.md`;
    let readme = await this.fileSystem.readFile(sandboxId, readmePath);
    readme = readme.replace(/\{\{projectName\}\}/g, request.projectName);
    readme = readme.replace(/\{\{projectTitle\}\}/g, this.formatProjectTitle(request.projectName));
    await this.fileSystem.writeFile(sandboxId, readmePath, readme);
  }

  private async initializeGit(
    sandboxId: string,
    projectPath: string
  ): Promise<{ commitHash: string }> {
    // Initialize git repository
    await this.exec(sandboxId, `cd ${projectPath} && git init`);

    // Configure git
    await this.exec(sandboxId, `cd ${projectPath} && git config user.email "manus@manus.im"`);
    await this.exec(sandboxId, `cd ${projectPath} && git config user.name "Manus"`);

    // Add all files
    await this.exec(sandboxId, `cd ${projectPath} && git add .`);

    // Create initial commit
    const result = await this.exec(
      sandboxId,
      `cd ${projectPath} && git commit -m "Initial commit from Manus" --quiet && git rev-parse HEAD`
    );

    return { commitHash: result.stdout.trim() };
  }

  private async cleanup(sandboxId: string, projectPath: string): Promise<void> {
    try {
      await this.fileSystem.rm(sandboxId, projectPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to cleanup ${projectPath}:`, error);
    }
  }

  private formatProjectTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Stub methods
  private async exec(sandboxId: string, command: string): Promise<{ stdout: string; stderr: string }> {
    return { stdout: '', stderr: '' };
  }

  private getDatabaseSchemaTemplate(context: TemplateContext): string { return ''; }
  private getDrizzleConfigTemplate(context: TemplateContext): string { return ''; }
  private getAuthTemplate(context: TemplateContext): string { return ''; }
  private getLLMTemplate(context: TemplateContext): string { return ''; }
  private generateServerFiles(context: TemplateContext): GeneratedFile[] { return []; }
  private generateStorageFiles(context: TemplateContext): GeneratedFile[] { return []; }
  private generateRealtimeFiles(context: TemplateContext): GeneratedFile[] { return []; }
  private generateStripeFiles(context: TemplateContext): GeneratedFile[] { return []; }
}

// Error handling for Phase 4
const phase4Errors = {
  'TEMPLATE_NOT_FOUND': {
    recoverable: false,
    action: 'abort'
  },
  'FILE_WRITE_FAILED': {
    recoverable: true,
    action: 'retry',
    maxRetries: 3
  },
  'GIT_INIT_FAILED': {
    recoverable: true,
    action: 'retry_without_git',
    maxRetries: 1
  },
  'DISK_SPACE_EXHAUSTED': {
    recoverable: false,
    action: 'cleanup_and_abort'
  },
  'PERMISSION_DENIED': {
    recoverable: true,
    action: 'fix_permissions_and_retry',
    maxRetries: 1
  }
};
```

### Phase 5: Dependency Installation (5000-25000ms)

```typescript
interface DependencyInstallResult {
  success: boolean;
  installedPackages: number;
  duration: number;
  cacheHit: boolean;
  warnings: string[];
}

class DependencyInstaller {
  private cache: DependencyCache;
  private packageManager: 'pnpm' | 'npm' | 'yarn' = 'pnpm';

  async install(
    sandboxId: string,
    projectPath: string
  ): Promise<DependencyInstallResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // 1. Check cache (100ms)
      console.log('[Phase 5] Checking dependency cache...');
      const cacheResult = await this.checkCache(sandboxId, projectPath);
      
      if (cacheResult.fullHit) {
        console.log('[Phase 5] Full cache hit, restoring from cache...');
        await this.restoreFromCache(sandboxId, projectPath, cacheResult);
        
        return {
          success: true,
          installedPackages: cacheResult.packageCount,
          duration: Date.now() - startTime,
          cacheHit: true,
          warnings
        };
      }

      // 2. Install dependencies (5000-20000ms)
      console.log('[Phase 5] Installing dependencies...');
      const installResult = await this.runInstall(sandboxId, projectPath);

      if (installResult.warnings.length > 0) {
        warnings.push(...installResult.warnings);
      }

      // 3. Build native modules if needed (1000-5000ms)
      if (installResult.hasNativeModules) {
        console.log('[Phase 5] Building native modules...');
        await this.buildNativeModules(sandboxId, projectPath);
      }

      // 4. Update cache (500ms)
      console.log('[Phase 5] Updating dependency cache...');
      await this.updateCache(sandboxId, projectPath);

      const duration = Date.now() - startTime;
      console.log(`[Phase 5] Dependency installation completed in ${duration}ms`);

      return {
        success: true,
        installedPackages: installResult.packageCount,
        duration,
        cacheHit: cacheResult.partialHit,
        warnings
      };
    } catch (error) {
      // Try fallback strategies
      return await this.handleInstallError(sandboxId, projectPath, error, startTime);
    }
  }

  private async checkCache(
    sandboxId: string,
    projectPath: string
  ): Promise<CacheCheckResult> {
    // Read package.json and lock file
    const packageJson = await this.readPackageJson(sandboxId, projectPath);
    const lockFile = await this.readLockFile(sandboxId, projectPath);

    // Generate cache key
    const cacheKey = this.generateCacheKey(packageJson, lockFile);

    // Check if we have a full cache hit
    const fullHit = await this.cache.has(cacheKey);
    
    // Check for partial cache (shared node_modules)
    const partialHit = await this.cache.hasPartial(cacheKey);

    return {
      fullHit,
      partialHit,
      cacheKey,
      packageCount: Object.keys(packageJson.dependencies || {}).length +
                   Object.keys(packageJson.devDependencies || {}).length
    };
  }

  private async restoreFromCache(
    sandboxId: string,
    projectPath: string,
    cacheResult: CacheCheckResult
  ): Promise<void> {
    // Restore node_modules from cache
    await this.cache.restore(cacheResult.cacheKey, `${projectPath}/node_modules`);

    // Verify restoration
    const verified = await this.verifyNodeModules(sandboxId, projectPath);
    if (!verified) {
      throw new Error('Cache restoration verification failed');
    }
  }

  private async runInstall(
    sandboxId: string,
    projectPath: string
  ): Promise<InstallResult> {
    const command = this.getInstallCommand();
    
    // Set timeout based on project size
    const timeout = 120000; // 2 minutes

    const result = await this.exec(sandboxId, `cd ${projectPath} && ${command}`, {
      timeout,
      env: {
        // Optimize pnpm for speed
        PNPM_HOME: '/home/ubuntu/.pnpm-store',
        npm_config_prefer_offline: 'true',
        npm_config_audit: 'false',
        npm_config_fund: 'false'
      }
    });

    // Parse output for warnings and package count
    const warnings = this.parseWarnings(result.stderr);
    const packageCount = this.parsePackageCount(result.stdout);
    const hasNativeModules = this.detectNativeModules(result.stdout);

    return {
      success: result.exitCode === 0,
      warnings,
      packageCount,
      hasNativeModules
    };
  }

  private getInstallCommand(): string {
    switch (this.packageManager) {
      case 'pnpm':
        return 'pnpm install --frozen-lockfile --prefer-offline';
      case 'yarn':
        return 'yarn install --frozen-lockfile --prefer-offline';
      case 'npm':
        return 'npm ci --prefer-offline';
      default:
        return 'pnpm install --frozen-lockfile --prefer-offline';
    }
  }

  private async buildNativeModules(
    sandboxId: string,
    projectPath: string
  ): Promise<void> {
    // Run node-gyp rebuild for native modules
    await this.exec(sandboxId, `cd ${projectPath} && pnpm rebuild`, {
      timeout: 60000
    });
  }

  private async updateCache(
    sandboxId: string,
    projectPath: string
  ): Promise<void> {
    const packageJson = await this.readPackageJson(sandboxId, projectPath);
    const lockFile = await this.readLockFile(sandboxId, projectPath);
    const cacheKey = this.generateCacheKey(packageJson, lockFile);

    // Store node_modules in cache
    await this.cache.store(cacheKey, `${projectPath}/node_modules`);
  }

  private async handleInstallError(
    sandboxId: string,
    projectPath: string,
    error: Error,
    startTime: number
  ): Promise<DependencyInstallResult> {
    console.error('[Phase 5] Install failed, trying fallback strategies...');

    // Strategy 1: Clear cache and retry
    try {
      console.log('[Phase 5] Clearing cache and retrying...');
      await this.exec(sandboxId, `cd ${projectPath} && rm -rf node_modules`);
      await this.exec(sandboxId, `cd ${projectPath} && pnpm install`, { timeout: 180000 });
      
      return {
        success: true,
        installedPackages: 0,
        duration: Date.now() - startTime,
        cacheHit: false,
        warnings: ['Installation required cache clear and retry']
      };
    } catch (retryError) {
      // Strategy 2: Try npm instead of pnpm
      try {
        console.log('[Phase 5] Trying npm instead of pnpm...');
        await this.exec(sandboxId, `cd ${projectPath} && rm -rf node_modules`);
        await this.exec(sandboxId, `cd ${projectPath} && npm install`, { timeout: 180000 });
        
        return {
          success: true,
          installedPackages: 0,
          duration: Date.now() - startTime,
          cacheHit: false,
          warnings: ['Installation required fallback to npm']
        };
      } catch (npmError) {
        // All strategies failed
        throw new Error(`Dependency installation failed: ${error.message}`);
      }
    }
  }

  private async verifyNodeModules(
    sandboxId: string,
    projectPath: string
  ): Promise<boolean> {
    try {
      const result = await this.exec(
        sandboxId,
        `cd ${projectPath} && test -d node_modules && echo "exists"`
      );
      return result.stdout.includes('exists');
    } catch {
      return false;
    }
  }

  private generateCacheKey(packageJson: any, lockFile: string): string {
    const crypto = require('crypto');
    const content = JSON.stringify(packageJson) + lockFile;
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private parseWarnings(stderr: string): string[] {
    const warnings: string[] = [];
    const lines = stderr.split('\n');
    
    for (const line of lines) {
      if (line.includes('WARN') || line.includes('warning')) {
        warnings.push(line.trim());
      }
    }
    
    return warnings;
  }

  private parsePackageCount(stdout: string): number {
    const match = stdout.match(/(\d+) packages/);
    return match ? parseInt(match[1]) : 0;
  }

  private detectNativeModules(stdout: string): boolean {
    return stdout.includes('node-gyp') || 
           stdout.includes('prebuild') ||
           stdout.includes('node-pre-gyp');
  }

  // Stub methods
  private async readPackageJson(sandboxId: string, projectPath: string): Promise<any> { return {}; }
  private async readLockFile(sandboxId: string, projectPath: string): Promise<string> { return ''; }
  private async exec(sandboxId: string, command: string, options?: any): Promise<any> { return { stdout: '', stderr: '', exitCode: 0 }; }
}

// Error handling for Phase 5
const phase5Errors = {
  'INSTALL_TIMEOUT': {
    recoverable: true,
    action: 'extend_timeout_and_retry',
    maxRetries: 2
  },
  'NETWORK_ERROR': {
    recoverable: true,
    action: 'retry_with_offline_cache',
    maxRetries: 3
  },
  'DISK_SPACE_EXHAUSTED': {
    recoverable: false,
    action: 'cleanup_and_abort'
  },
  'NATIVE_MODULE_BUILD_FAILED': {
    recoverable: true,
    action: 'skip_native_modules',
    maxRetries: 1
  },
  'LOCK_FILE_CONFLICT': {
    recoverable: true,
    action: 'regenerate_lock_file',
    maxRetries: 1
  },
  'PACKAGE_NOT_FOUND': {
    recoverable: false,
    action: 'abort_with_suggestion'
  }
};
```

### Phase 6: Database Setup (25000-30000ms)

```typescript
interface DatabaseSetupResult {
  success: boolean;
  tablesCreated: number;
  migrationsApplied: number;
  seedDataInserted: boolean;
}

class DatabaseSetup {
  async setup(
    sandboxId: string,
    projectPath: string,
    allocation: ResourceAllocation
  ): Promise<DatabaseSetupResult> {
    const startTime = Date.now();

    // Skip if no database feature
    if (!allocation.databaseId) {
      return {
        success: true,
        tablesCreated: 0,
        migrationsApplied: 0,
        seedDataInserted: false
      };
    }

    try {
      // 1. Wait for database ready (1000-2000ms)
      console.log('[Phase 6] Waiting for database ready...');
      await this.waitForDatabaseReady(allocation.databaseId);

      // 2. Generate migrations (500ms)
      console.log('[Phase 6] Generating migrations...');
      const migrationsGenerated = await this.generateMigrations(sandboxId, projectPath);

      // 3. Apply migrations (1000-2000ms)
      console.log('[Phase 6] Applying migrations...');
      const migrationsApplied = await this.applyMigrations(sandboxId, projectPath);

      // 4. Seed initial data if applicable (500-1000ms)
      console.log('[Phase 6] Seeding initial data...');
      const seedResult = await this.seedData(sandboxId, projectPath);

      const duration = Date.now() - startTime;
      console.log(`[Phase 6] Database setup completed in ${duration}ms`);

      return {
        success: true,
        tablesCreated: migrationsGenerated,
        migrationsApplied,
        seedDataInserted: seedResult
      };
    } catch (error) {
      return await this.handleDatabaseError(sandboxId, projectPath, error);
    }
  }

  private async waitForDatabaseReady(databaseId: string, timeout = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.checkDatabaseStatus(databaseId);
        if (status === 'ready') {
          return;
        }
      } catch (error) {
        // Ignore connection errors during startup
      }
      
      await this.sleep(1000);
    }
    
    throw new Error('Database startup timeout');
  }

  private async generateMigrations(
    sandboxId: string,
    projectPath: string
  ): Promise<number> {
    // Run drizzle-kit generate
    const result = await this.exec(
      sandboxId,
      `cd ${projectPath} && pnpm drizzle-kit generate`,
      { timeout: 30000 }
    );

    // Parse output for number of tables
    const match = result.stdout.match(/(\d+) tables?/);
    return match ? parseInt(match[1]) : 0;
  }

  private async applyMigrations(
    sandboxId: string,
    projectPath: string
  ): Promise<number> {
    // Run drizzle-kit migrate
    const result = await this.exec(
      sandboxId,
      `cd ${projectPath} && pnpm drizzle-kit migrate`,
      { timeout: 60000 }
    );

    // Parse output for number of migrations
    const match = result.stdout.match(/(\d+) migrations?/);
    return match ? parseInt(match[1]) : 0;
  }

  private async seedData(
    sandboxId: string,
    projectPath: string
  ): Promise<boolean> {
    // Check if seed script exists
    const seedExists = await this.fileExists(sandboxId, `${projectPath}/scripts/seed.ts`);
    
    if (!seedExists) {
      return false;
    }

    // Run seed script
    await this.exec(
      sandboxId,
      `cd ${projectPath} && pnpm tsx scripts/seed.ts`,
      { timeout: 30000 }
    );

    return true;
  }

  private async handleDatabaseError(
    sandboxId: string,
    projectPath: string,
    error: Error
  ): Promise<DatabaseSetupResult> {
    console.error('[Phase 6] Database setup failed:', error);

    // Try to recover
    if (error.message.includes('connection')) {
      // Retry with extended timeout
      await this.sleep(5000);
      return await this.setup(sandboxId, projectPath, {} as ResourceAllocation);
    }

    // Return partial success
    return {
      success: false,
      tablesCreated: 0,
      migrationsApplied: 0,
      seedDataInserted: false
    };
  }

  // Stub methods
  private async checkDatabaseStatus(databaseId: string): Promise<string> { return 'ready'; }
  private async exec(sandboxId: string, command: string, options?: any): Promise<any> { return { stdout: '', stderr: '' }; }
  private async fileExists(sandboxId: string, path: string): Promise<boolean> { return false; }
  private sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
}

// Error handling for Phase 6
const phase6Errors = {
  'DATABASE_CONNECTION_FAILED': {
    recoverable: true,
    action: 'wait_and_retry',
    maxRetries: 5,
    retryDelay: 5000
  },
  'MIGRATION_FAILED': {
    recoverable: true,
    action: 'rollback_and_retry',
    maxRetries: 2
  },
  'SCHEMA_CONFLICT': {
    recoverable: true,
    action: 'drop_and_recreate',
    maxRetries: 1
  },
  'SEED_FAILED': {
    recoverable: true,
    action: 'skip_seed',
    maxRetries: 0
  },
  'DATABASE_TIMEOUT': {
    recoverable: true,
    action: 'extend_timeout_and_retry',
    maxRetries: 3
  }
};
```

### Phase 7: Dev Server Startup (30000-35000ms)

```typescript
interface DevServerResult {
  success: boolean;
  port: number;
  publicUrl: string;
  startupTime: number;
}

class DevServerManager {
  async start(
    sandboxId: string,
    projectPath: string,
    allocation: ResourceAllocation
  ): Promise<DevServerResult> {
    const startTime = Date.now();

    try {
      // 1. Start dev server process (100ms)
      console.log('[Phase 7] Starting dev server...');
      const process = await this.startProcess(sandboxId, projectPath);

      // 2. Wait for server ready (2000-4000ms)
      console.log('[Phase 7] Waiting for server ready...');
      await this.waitForServerReady(sandboxId, allocation.networkConfig.publicPort);

      // 3. Configure port exposure (500ms)
      console.log('[Phase 7] Configuring port exposure...');
      const publicUrl = await this.configurePortExposure(
        sandboxId,
        allocation.networkConfig
      );

      // 4. Verify public access (500ms)
      console.log('[Phase 7] Verifying public access...');
      await this.verifyPublicAccess(publicUrl);

      const duration = Date.now() - startTime;
      console.log(`[Phase 7] Dev server startup completed in ${duration}ms`);

      return {
        success: true,
        port: allocation.networkConfig.publicPort,
        publicUrl,
        startupTime: duration
      };
    } catch (error) {
      return await this.handleStartupError(sandboxId, projectPath, allocation, error);
    }
  }

  private async startProcess(
    sandboxId: string,
    projectPath: string
  ): Promise<ProcessInfo> {
    // Start dev server in background
    const result = await this.exec(
      sandboxId,
      `cd ${projectPath} && NODE_ENV=development nohup pnpm dev > /tmp/dev-server.log 2>&1 &`,
      { timeout: 5000 }
    );

    // Get process ID
    const pidResult = await this.exec(
      sandboxId,
      `pgrep -f "pnpm dev"`,
      { timeout: 1000 }
    );

    return {
      pid: parseInt(pidResult.stdout.trim()),
      startedAt: new Date()
    };
  }

  private async waitForServerReady(
    sandboxId: string,
    port: number,
    timeout = 60000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if server is responding
        const result = await this.exec(
          sandboxId,
          `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`,
          { timeout: 5000 }
        );

        const statusCode = parseInt(result.stdout.trim());
        if (statusCode >= 200 && statusCode < 500) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }

      await this.sleep(1000);
    }

    throw new Error('Dev server startup timeout');
  }

  private async configurePortExposure(
    sandboxId: string,
    networkConfig: NetworkConfig
  ): Promise<string> {
    // Generate public URL
    const publicUrl = `https://${networkConfig.publicPort}-${sandboxId}.manus.computer`;

    // Configure reverse proxy
    await this.configureReverseProxy(sandboxId, networkConfig.publicPort, publicUrl);

    return publicUrl;
  }

  private async configureReverseProxy(
    sandboxId: string,
    port: number,
    publicUrl: string
  ): Promise<void> {
    // Configure nginx or similar reverse proxy
    const config = `
      upstream ${sandboxId} {
        server 127.0.0.1:${port};
      }
      
      server {
        listen 443 ssl;
        server_name ${publicUrl.replace('https://', '')};
        
        location / {
          proxy_pass http://${sandboxId};
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
        }
      }
    `;

    // Apply configuration
    await this.applyProxyConfig(sandboxId, config);
  }

  private async verifyPublicAccess(publicUrl: string): Promise<void> {
    const response = await fetch(publicUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Public access verification failed: ${response.status}`);
    }
  }

  private async handleStartupError(
    sandboxId: string,
    projectPath: string,
    allocation: ResourceAllocation,
    error: Error
  ): Promise<DevServerResult> {
    console.error('[Phase 7] Dev server startup failed:', error);

    // Check server logs
    const logs = await this.getServerLogs(sandboxId);
    console.log('[Phase 7] Server logs:', logs);

    // Try to restart
    try {
      await this.killExistingProcesses(sandboxId);
      await this.sleep(2000);
      return await this.start(sandboxId, projectPath, allocation);
    } catch (retryError) {
      throw new Error(`Dev server startup failed: ${error.message}`);
    }
  }

  private async getServerLogs(sandboxId: string): Promise<string> {
    const result = await this.exec(
      sandboxId,
      'tail -100 /tmp/dev-server.log',
      { timeout: 5000 }
    );
    return result.stdout;
  }

  private async killExistingProcesses(sandboxId: string): Promise<void> {
    await this.exec(sandboxId, 'pkill -f "pnpm dev" || true', { timeout: 5000 });
  }

  // Stub methods
  private async exec(sandboxId: string, command: string, options?: any): Promise<any> { return { stdout: '', stderr: '' }; }
  private async applyProxyConfig(sandboxId: string, config: string): Promise<void> { }
  private sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
}

// Error handling for Phase 7
const phase7Errors = {
  'SERVER_START_FAILED': {
    recoverable: true,
    action: 'check_logs_and_retry',
    maxRetries: 3
  },
  'PORT_ALREADY_IN_USE': {
    recoverable: true,
    action: 'kill_existing_and_retry',
    maxRetries: 2
  },
  'SERVER_STARTUP_TIMEOUT': {
    recoverable: true,
    action: 'extend_timeout_and_retry',
    maxRetries: 2
  },
  'PROXY_CONFIG_FAILED': {
    recoverable: true,
    action: 'retry_with_different_port',
    maxRetries: 3
  },
  'PUBLIC_ACCESS_FAILED': {
    recoverable: true,
    action: 'retry',
    maxRetries: 5
  }
};
```

### Phase 8: Health Check & Finalization (35000-40000ms)

```typescript
interface HealthCheckResult {
  success: boolean;
  checks: HealthCheck[];
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  duration: number;
}

interface InitProjectResult {
  success: boolean;
  projectName: string;
  projectPath: string;
  publicUrl: string;
  versionId: string;
  features: Feature[];
  healthStatus: HealthCheckResult;
  duration: number;
}

class HealthChecker {
  async check(
    sandboxId: string,
    projectPath: string,
    allocation: ResourceAllocation,
    devServerResult: DevServerResult
  ): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];

    // 1. Server health check
    checks.push(await this.checkServer(devServerResult.publicUrl));

    // 2. Database connectivity check
    if (allocation.databaseId) {
      checks.push(await this.checkDatabase(sandboxId, projectPath));
    }

    // 3. File system check
    checks.push(await this.checkFileSystem(sandboxId, projectPath));

    // 4. Environment variables check
    checks.push(await this.checkEnvVars(sandboxId, projectPath, allocation.envVars));

    // 5. TypeScript compilation check
    checks.push(await this.checkTypeScript(sandboxId, projectPath));

    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks);

    return {
      success: overallStatus !== 'unhealthy',
      checks,
      overallStatus
    };
  }

  private async checkServer(publicUrl: string): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(publicUrl, {
        signal: AbortSignal.timeout(10000)
      });

      return {
        name: 'Server Health',
        status: response.ok ? 'pass' : 'warn',
        message: response.ok ? 'Server responding' : `Server returned ${response.status}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Server Health',
        status: 'fail',
        message: `Server not responding: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkDatabase(
    sandboxId: string,
    projectPath: string
  ): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Run a simple database query
      const result = await this.exec(
        sandboxId,
        `cd ${projectPath} && pnpm tsx -e "
          import { getDb } from './server/db';
          const db = await getDb();
          if (db) {
            await db.execute('SELECT 1');
            console.log('OK');
          }
        "`,
        { timeout: 10000 }
      );

      const success = result.stdout.includes('OK');
      
      return {
        name: 'Database Connectivity',
        status: success ? 'pass' : 'fail',
        message: success ? 'Database connected' : 'Database connection failed',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Database Connectivity',
        status: 'fail',
        message: `Database check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkFileSystem(
    sandboxId: string,
    projectPath: string
  ): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check essential files exist
      const essentialFiles = [
        'package.json',
        'tsconfig.json',
        'node_modules',
        'client/src/App.tsx',
        'server/routers.ts'
      ];

      const results = await Promise.all(
        essentialFiles.map(file => 
          this.fileExists(sandboxId, `${projectPath}/${file}`)
        )
      );

      const missingFiles = essentialFiles.filter((_, i) => !results[i]);
      
      return {
        name: 'File System',
        status: missingFiles.length === 0 ? 'pass' : 'warn',
        message: missingFiles.length === 0 
          ? 'All essential files present'
          : `Missing files: ${missingFiles.join(', ')}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'File System',
        status: 'fail',
        message: `File system check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkEnvVars(
    sandboxId: string,
    projectPath: string,
    expectedEnvVars: Record<string, string>
  ): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check that env vars are accessible
      const result = await this.exec(
        sandboxId,
        `cd ${projectPath} && env | grep -E "^(VITE_|DATABASE_|JWT_)" | wc -l`,
        { timeout: 5000 }
      );

      const count = parseInt(result.stdout.trim());
      const expected = Object.keys(expectedEnvVars).length;
      
      return {
        name: 'Environment Variables',
        status: count >= expected * 0.8 ? 'pass' : 'warn',
        message: `${count}/${expected} environment variables set`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'Environment Variables',
        status: 'warn',
        message: `Env var check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkTypeScript(
    sandboxId: string,
    projectPath: string
  ): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const result = await this.exec(
        sandboxId,
        `cd ${projectPath} && pnpm tsc --noEmit 2>&1 | tail -5`,
        { timeout: 60000 }
      );

      const hasErrors = result.stdout.includes('error TS');
      
      return {
        name: 'TypeScript Compilation',
        status: hasErrors ? 'warn' : 'pass',
        message: hasErrors ? 'TypeScript errors detected' : 'TypeScript compiles successfully',
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'TypeScript Compilation',
        status: 'warn',
        message: `TypeScript check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;

    if (failCount > 0) return 'unhealthy';
    if (warnCount > 1) return 'degraded';
    return 'healthy';
  }

  // Stub methods
  private async exec(sandboxId: string, command: string, options?: any): Promise<any> { return { stdout: '', stderr: '' }; }
  private async fileExists(sandboxId: string, path: string): Promise<boolean> { return true; }
}

class ProjectFinalizer {
  async finalize(
    request: NormalizedRequest,
    allocation: ResourceAllocation,
    devServerResult: DevServerResult,
    healthResult: HealthCheckResult
  ): Promise<InitProjectResult> {
    const startTime = Date.now();

    // 1. Create initial checkpoint
    console.log('[Phase 8] Creating initial checkpoint...');
    const versionId = await this.createCheckpoint(
      allocation.sandboxId,
      `/home/ubuntu/${request.projectName}`,
      'Initial project setup'
    );

    // 2. Record project in database
    console.log('[Phase 8] Recording project...');
    await this.recordProject(request, allocation, devServerResult, versionId);

    // 3. Send notifications
    console.log('[Phase 8] Sending notifications...');
    await this.sendNotifications(request, devServerResult);

    const totalDuration = Date.now() - startTime;
    console.log(`[Phase 8] Finalization completed in ${totalDuration}ms`);

    return {
      success: true,
      projectName: request.projectName,
      projectPath: `/home/ubuntu/${request.projectName}`,
      publicUrl: devServerResult.publicUrl,
      versionId,
      features: request.features,
      healthStatus: healthResult,
      duration: totalDuration
    };
  }

  private async createCheckpoint(
    sandboxId: string,
    projectPath: string,
    message: string
  ): Promise<string> {
    // Create git commit
    await this.exec(sandboxId, `cd ${projectPath} && git add -A`);
    await this.exec(sandboxId, `cd ${projectPath} && git commit -m "${message}" --allow-empty`);
    
    // Get commit hash
    const result = await this.exec(sandboxId, `cd ${projectPath} && git rev-parse --short HEAD`);
    return result.stdout.trim();
  }

  private async recordProject(
    request: NormalizedRequest,
    allocation: ResourceAllocation,
    devServerResult: DevServerResult,
    versionId: string
  ): Promise<void> {
    await this.db.insert('projects', {
      name: request.projectName,
      userId: request.userId,
      organizationId: request.organizationId,
      template: request.template,
      features: JSON.stringify(request.features),
      sandboxId: allocation.sandboxId,
      databaseId: allocation.databaseId,
      publicUrl: devServerResult.publicUrl,
      currentVersion: versionId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  private async sendNotifications(
    request: NormalizedRequest,
    devServerResult: DevServerResult
  ): Promise<void> {
    // Send email notification
    await this.emailService.send({
      to: request.userId,
      subject: `Your project "${request.projectName}" is ready!`,
      body: `
        Your project has been created successfully.
        
        Public URL: ${devServerResult.publicUrl}
        
        Get started by visiting the URL above or opening the project in your IDE.
      `
    });
  }

  // Stub methods
  private async exec(sandboxId: string, command: string): Promise<any> { return { stdout: '', stderr: '' }; }
  private db = { insert: async (table: string, data: any) => {} };
  private emailService = { send: async (options: any) => {} };
}
```

---

## 3. Complete Orchestrator

```typescript
class WebdevInitProjectOrchestrator {
  private validator: RequestValidator;
  private allocator: ResourceAllocator;
  private provisioner: SandboxProvisioner;
  private generator: TemplateGenerator;
  private installer: DependencyInstaller;
  private databaseSetup: DatabaseSetup;
  private devServerManager: DevServerManager;
  private healthChecker: HealthChecker;
  private finalizer: ProjectFinalizer;

  async initProject(request: InitProjectRequest): Promise<InitProjectResult> {
    const totalStartTime = Date.now();
    const timings: Record<string, number> = {};

    try {
      // Phase 1: Validation (0-100ms)
      console.log('=== Phase 1: Request Validation ===');
      const phase1Start = Date.now();
      const validation = await this.validator.validate(request);
      timings.phase1 = Date.now() - phase1Start;
      
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      // Phase 2: Resource Allocation (100-500ms)
      console.log('=== Phase 2: Resource Allocation ===');
      const phase2Start = Date.now();
      const allocation = await this.allocator.allocate(validation.normalizedRequest);
      timings.phase2 = Date.now() - phase2Start;

      // Phase 3: Sandbox Provisioning (500-3000ms)
      console.log('=== Phase 3: Sandbox Provisioning ===');
      const phase3Start = Date.now();
      const sandboxConfig = await this.provisioner.provision(
        allocation,
        validation.normalizedRequest
      );
      timings.phase3 = Date.now() - phase3Start;

      // Phase 4: Template Generation (3000-5000ms)
      console.log('=== Phase 4: Template Generation ===');
      const phase4Start = Date.now();
      const generatedProject = await this.generator.generate(
        sandboxConfig,
        validation.normalizedRequest,
        allocation
      );
      timings.phase4 = Date.now() - phase4Start;

      // Phase 5: Dependency Installation (5000-25000ms)
      console.log('=== Phase 5: Dependency Installation ===');
      const phase5Start = Date.now();
      const installResult = await this.installer.install(
        sandboxConfig.sandboxId,
        `/home/ubuntu/${validation.normalizedRequest.projectName}`
      );
      timings.phase5 = Date.now() - phase5Start;

      // Phase 6: Database Setup (25000-30000ms)
      console.log('=== Phase 6: Database Setup ===');
      const phase6Start = Date.now();
      const dbResult = await this.databaseSetup.setup(
        sandboxConfig.sandboxId,
        `/home/ubuntu/${validation.normalizedRequest.projectName}`,
        allocation
      );
      timings.phase6 = Date.now() - phase6Start;

      // Phase 7: Dev Server Startup (30000-35000ms)
      console.log('=== Phase 7: Dev Server Startup ===');
      const phase7Start = Date.now();
      const devServerResult = await this.devServerManager.start(
        sandboxConfig.sandboxId,
        `/home/ubuntu/${validation.normalizedRequest.projectName}`,
        allocation
      );
      timings.phase7 = Date.now() - phase7Start;

      // Phase 8: Health Check & Finalization (35000-40000ms)
      console.log('=== Phase 8: Health Check & Finalization ===');
      const phase8Start = Date.now();
      const healthResult = await this.healthChecker.check(
        sandboxConfig.sandboxId,
        `/home/ubuntu/${validation.normalizedRequest.projectName}`,
        allocation,
        devServerResult
      );
      
      const result = await this.finalizer.finalize(
        validation.normalizedRequest,
        allocation,
        devServerResult,
        healthResult
      );
      timings.phase8 = Date.now() - phase8Start;

      // Log timings
      const totalDuration = Date.now() - totalStartTime;
      console.log('\n=== Timing Summary ===');
      console.log(`Phase 1 (Validation):      ${timings.phase1}ms`);
      console.log(`Phase 2 (Allocation):      ${timings.phase2}ms`);
      console.log(`Phase 3 (Provisioning):    ${timings.phase3}ms`);
      console.log(`Phase 4 (Generation):      ${timings.phase4}ms`);
      console.log(`Phase 5 (Dependencies):    ${timings.phase5}ms`);
      console.log(`Phase 6 (Database):        ${timings.phase6}ms`);
      console.log(`Phase 7 (Dev Server):      ${timings.phase7}ms`);
      console.log(`Phase 8 (Finalization):    ${timings.phase8}ms`);
      console.log(`Total:                     ${totalDuration}ms`);

      return {
        ...result,
        duration: totalDuration
      };
    } catch (error) {
      // Global error handling
      console.error('Project initialization failed:', error);
      throw error;
    }
  }
}
```

---

## 4. Timing Summary

| Phase | Description | Typical Time | Best Case | Worst Case |
|-------|-------------|--------------|-----------|------------|
| **1** | Request Validation | 50-100ms | 30ms | 200ms |
| **2** | Resource Allocation | 200-500ms | 100ms | 1000ms |
| **3** | Sandbox Provisioning | 1500-3000ms | 500ms | 5000ms |
| **4** | Template Generation | 1000-2000ms | 500ms | 3000ms |
| **5** | Dependency Installation | 10000-20000ms | 2000ms | 60000ms |
| **6** | Database Setup | 2000-5000ms | 1000ms | 10000ms |
| **7** | Dev Server Startup | 3000-5000ms | 1000ms | 15000ms |
| **8** | Health Check & Finalization | 2000-5000ms | 1000ms | 10000ms |
| **Total** | | **20-40 seconds** | **7 seconds** | **105 seconds** |

---

## 5. Error Handling Summary

| Phase | Error Type | Recovery Strategy |
|-------|-----------|-------------------|
| 1 | Validation errors | Prompt user to fix |
| 2 | Resource exhaustion | Wait and retry |
| 3 | Container failures | Retry with fallback |
| 4 | Template errors | Abort (non-recoverable) |
| 5 | Install failures | Clear cache and retry |
| 6 | Database errors | Wait and retry |
| 7 | Server failures | Check logs and retry |
| 8 | Health check failures | Continue with warnings |

This comprehensive guide documents the complete `webdev_init_project` flow with all phases, timing estimates, and error handling strategies!
