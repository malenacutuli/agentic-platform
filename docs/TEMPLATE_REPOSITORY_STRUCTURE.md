# Template Repository URL Structure

This guide covers the exact Git URL structure for template repositories, including naming conventions, organization, versioning, and access patterns for both official and community templates.

---

## Table of Contents

1. [URL Structure Overview](#url-structure-overview)
2. [Official Template URLs](#official-template-urls)
3. [Community Template URLs](#community-template-urls)
4. [Version Tagging](#version-tagging)
5. [Repository Organization](#repository-organization)
6. [Access Patterns](#access-patterns)
7. [Implementation Guide](#implementation-guide)

---

## URL Structure Overview

### URL Format

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE URL STRUCTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  OFFICIAL TEMPLATES                                                                     │
│  https://github.com/{org}/templates/{category}-{framework}-{variant}                   │
│                                                                                         │
│  Examples:                                                                              │
│  • https://github.com/manus-templates/web-react-vite                                   │
│  • https://github.com/manus-templates/web-nextjs-app                                   │
│  • https://github.com/manus-templates/api-express-trpc                                 │
│  • https://github.com/manus-templates/fullstack-nextjs-prisma                          │
│                                                                                         │
│  COMMUNITY TEMPLATES                                                                    │
│  https://github.com/{username}/manus-template-{name}                                   │
│                                                                                         │
│  Examples:                                                                              │
│  • https://github.com/johndoe/manus-template-saas-starter                              │
│  • https://github.com/acme-corp/manus-template-enterprise-dashboard                    │
│                                                                                         │
│  INTERNAL REGISTRY (CDN-backed)                                                        │
│  https://templates.manus.im/{category}/{name}@{version}                                │
│                                                                                         │
│  Examples:                                                                              │
│  • https://templates.manus.im/web/react-vite@2.1.0                                     │
│  • https://templates.manus.im/api/express-trpc@1.5.0                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### URL Components

| Component | Description | Examples |
|-----------|-------------|----------|
| **org** | GitHub organization | `manus-templates`, `manus-official` |
| **category** | Template category | `web`, `api`, `fullstack`, `mobile` |
| **framework** | Primary framework | `react`, `nextjs`, `express`, `fastapi` |
| **variant** | Configuration variant | `vite`, `webpack`, `trpc`, `prisma` |
| **version** | Semantic version | `1.0.0`, `2.1.0`, `latest` |

---

## Official Template URLs

### Naming Convention

```typescript
// templates/registry/naming.ts

interface TemplateNaming {
  // Pattern: {category}-{framework}-{variant}
  pattern: RegExp;
  
  // Category prefixes
  categories: {
    web: 'Frontend web applications',
    api: 'Backend API services',
    fullstack: 'Full-stack applications',
    mobile: 'Mobile applications',
    cli: 'Command-line tools',
    lib: 'Libraries and packages',
  };
  
  // Framework identifiers
  frameworks: {
    // Frontend
    react: 'React',
    vue: 'Vue.js',
    svelte: 'Svelte',
    nextjs: 'Next.js',
    nuxt: 'Nuxt',
    
    // Backend
    express: 'Express.js',
    fastify: 'Fastify',
    nestjs: 'NestJS',
    fastapi: 'FastAPI',
    django: 'Django',
    
    // Mobile
    reactnative: 'React Native',
    flutter: 'Flutter',
    expo: 'Expo',
  };
  
  // Variant suffixes
  variants: {
    // Build tools
    vite: 'Vite bundler',
    webpack: 'Webpack bundler',
    esbuild: 'esbuild bundler',
    
    // API styles
    trpc: 'tRPC',
    graphql: 'GraphQL',
    rest: 'REST API',
    
    // Databases
    prisma: 'Prisma ORM',
    drizzle: 'Drizzle ORM',
    mongoose: 'Mongoose ODM',
    
    // Auth
    auth: 'With authentication',
    oauth: 'OAuth integration',
  };
}

// Validation regex
const TEMPLATE_NAME_PATTERN = /^(web|api|fullstack|mobile|cli|lib)-[a-z]+-[a-z]+$/;
```

### Official Template Registry

```typescript
// templates/registry/official.ts

interface OfficialTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: TemplateCategory;
  framework: string;
  variant: string;
  repoUrl: string;
  registryUrl: string;
  version: string;
  features: string[];
  dependencies: Record<string, string>;
}

const officialTemplates: OfficialTemplate[] = [
  // Frontend Templates
  {
    id: 'web-react-vite',
    name: 'web-react-vite',
    displayName: 'React + Vite',
    description: 'Modern React app with Vite, TypeScript, and Tailwind CSS',
    category: 'web',
    framework: 'react',
    variant: 'vite',
    repoUrl: 'https://github.com/manus-templates/web-react-vite',
    registryUrl: 'https://templates.manus.im/web/react-vite',
    version: '2.1.0',
    features: ['typescript', 'tailwind', 'eslint', 'prettier'],
    dependencies: {
      'react': '^18.2.0',
      'vite': '^5.0.0',
      'tailwindcss': '^3.4.0',
    },
  },
  {
    id: 'web-nextjs-app',
    name: 'web-nextjs-app',
    displayName: 'Next.js App Router',
    description: 'Next.js 14 with App Router, TypeScript, and Tailwind CSS',
    category: 'web',
    framework: 'nextjs',
    variant: 'app',
    repoUrl: 'https://github.com/manus-templates/web-nextjs-app',
    registryUrl: 'https://templates.manus.im/web/nextjs-app',
    version: '3.0.0',
    features: ['typescript', 'tailwind', 'app-router', 'server-components'],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'tailwindcss': '^3.4.0',
    },
  },
  
  // Backend Templates
  {
    id: 'api-express-trpc',
    name: 'api-express-trpc',
    displayName: 'Express + tRPC',
    description: 'Express.js API with tRPC, TypeScript, and Zod validation',
    category: 'api',
    framework: 'express',
    variant: 'trpc',
    repoUrl: 'https://github.com/manus-templates/api-express-trpc',
    registryUrl: 'https://templates.manus.im/api/express-trpc',
    version: '1.5.0',
    features: ['typescript', 'trpc', 'zod', 'cors'],
    dependencies: {
      'express': '^4.18.0',
      '@trpc/server': '^10.0.0',
      'zod': '^3.22.0',
    },
  },
  {
    id: 'api-fastapi-sqlalchemy',
    name: 'api-fastapi-sqlalchemy',
    displayName: 'FastAPI + SQLAlchemy',
    description: 'FastAPI with SQLAlchemy ORM and Pydantic validation',
    category: 'api',
    framework: 'fastapi',
    variant: 'sqlalchemy',
    repoUrl: 'https://github.com/manus-templates/api-fastapi-sqlalchemy',
    registryUrl: 'https://templates.manus.im/api/fastapi-sqlalchemy',
    version: '1.2.0',
    features: ['python', 'sqlalchemy', 'pydantic', 'alembic'],
    dependencies: {
      'fastapi': '>=0.100.0',
      'sqlalchemy': '>=2.0.0',
      'pydantic': '>=2.0.0',
    },
  },
  
  // Full-stack Templates
  {
    id: 'fullstack-nextjs-prisma',
    name: 'fullstack-nextjs-prisma',
    displayName: 'Next.js + Prisma',
    description: 'Full-stack Next.js with Prisma ORM and NextAuth',
    category: 'fullstack',
    framework: 'nextjs',
    variant: 'prisma',
    repoUrl: 'https://github.com/manus-templates/fullstack-nextjs-prisma',
    registryUrl: 'https://templates.manus.im/fullstack/nextjs-prisma',
    version: '2.0.0',
    features: ['typescript', 'prisma', 'nextauth', 'tailwind'],
    dependencies: {
      'next': '^14.0.0',
      '@prisma/client': '^5.0.0',
      'next-auth': '^4.24.0',
    },
  },
  {
    id: 'fullstack-t3-stack',
    name: 'fullstack-t3-stack',
    displayName: 'T3 Stack',
    description: 'Next.js with tRPC, Prisma, NextAuth, and Tailwind',
    category: 'fullstack',
    framework: 'nextjs',
    variant: 't3',
    repoUrl: 'https://github.com/manus-templates/fullstack-t3-stack',
    registryUrl: 'https://templates.manus.im/fullstack/t3-stack',
    version: '1.8.0',
    features: ['typescript', 'trpc', 'prisma', 'nextauth', 'tailwind'],
    dependencies: {
      'next': '^14.0.0',
      '@trpc/server': '^10.0.0',
      '@prisma/client': '^5.0.0',
    },
  },
];
```

### Repository Structure

```
manus-templates/
├── web-react-vite/
│   ├── .github/
│   │   └── workflows/
│   │       └── release.yml
│   ├── template/              # Actual template files
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── ...
│   ├── template.json          # Template metadata
│   ├── hooks/
│   │   ├── pre-init.sh
│   │   └── post-init.sh
│   ├── README.md
│   └── CHANGELOG.md
│
├── web-nextjs-app/
│   └── ...
│
├── api-express-trpc/
│   └── ...
│
└── fullstack-nextjs-prisma/
    └── ...
```

---

## Community Template URLs

### Naming Requirements

```typescript
// templates/registry/community.ts

interface CommunityTemplateRequirements {
  // Repository naming
  repoNaming: {
    // Must start with 'manus-template-'
    prefix: 'manus-template-',
    // Followed by kebab-case name
    pattern: /^manus-template-[a-z][a-z0-9-]*$/,
    // Maximum length
    maxLength: 50,
  };
  
  // Required files
  requiredFiles: [
    'template.json',      // Template metadata
    'template/',          // Template directory
    'README.md',          // Documentation
    'LICENSE',            // License file
  ];
  
  // Required metadata fields
  requiredMetadata: [
    'name',
    'displayName',
    'description',
    'version',
    'author',
    'license',
    'category',
    'framework',
  ];
}

// Community template URL resolver
class CommunityTemplateResolver {
  /**
   * Resolve community template URL
   */
  resolveUrl(identifier: string): string {
    // Format: @username/template-name or github:username/repo-name
    
    if (identifier.startsWith('@')) {
      // @username/template-name format
      const [, username, name] = identifier.match(/@([^/]+)\/(.+)/) || [];
      return `https://github.com/${username}/manus-template-${name}`;
    }
    
    if (identifier.startsWith('github:')) {
      // github:username/repo-name format
      const repoPath = identifier.replace('github:', '');
      return `https://github.com/${repoPath}`;
    }
    
    // Direct URL
    if (identifier.startsWith('https://')) {
      return identifier;
    }
    
    throw new Error(`Invalid template identifier: ${identifier}`);
  }
  
  /**
   * Validate community template repository
   */
  async validateRepository(repoUrl: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check repository name
    const repoName = this.extractRepoName(repoUrl);
    if (!repoName.startsWith('manus-template-')) {
      errors.push('Repository name must start with "manus-template-"');
    }
    
    // Check required files
    const files = await this.listRepositoryFiles(repoUrl);
    for (const required of ['template.json', 'template/', 'README.md', 'LICENSE']) {
      if (!files.includes(required)) {
        errors.push(`Missing required file: ${required}`);
      }
    }
    
    // Validate template.json
    const metadata = await this.fetchTemplateMetadata(repoUrl);
    if (metadata) {
      const metadataErrors = this.validateMetadata(metadata);
      errors.push(...metadataErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

### Community Template Registry

```typescript
// templates/registry/communityRegistry.ts

interface CommunityTemplate {
  id: string;
  repoUrl: string;
  author: {
    username: string;
    displayName: string;
    verified: boolean;
  };
  metadata: TemplateMetadata;
  stats: {
    downloads: number;
    stars: number;
    forks: number;
    lastUpdated: Date;
  };
  verification: {
    status: 'pending' | 'approved' | 'rejected';
    reviewedAt?: Date;
    reviewedBy?: string;
    notes?: string;
  };
}

class CommunityTemplateRegistry {
  private db: Database;
  
  /**
   * Submit template for review
   */
  async submitTemplate(repoUrl: string, userId: string): Promise<SubmissionResult> {
    // Validate repository
    const validation = await this.validator.validateRepository(repoUrl);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }
    
    // Fetch metadata
    const metadata = await this.fetchMetadata(repoUrl);
    
    // Check for duplicates
    const existing = await this.findByRepoUrl(repoUrl);
    if (existing) {
      return {
        success: false,
        errors: ['Template already submitted'],
      };
    }
    
    // Create submission
    const template: CommunityTemplate = {
      id: crypto.randomUUID(),
      repoUrl,
      author: await this.resolveAuthor(repoUrl),
      metadata,
      stats: {
        downloads: 0,
        stars: await this.fetchStars(repoUrl),
        forks: await this.fetchForks(repoUrl),
        lastUpdated: new Date(),
      },
      verification: {
        status: 'pending',
      },
    };
    
    await this.db.insert('community_templates', template);
    
    // Notify reviewers
    await this.notifyReviewers(template);
    
    return {
      success: true,
      templateId: template.id,
    };
  }
  
  /**
   * Search community templates
   */
  async search(query: SearchQuery): Promise<CommunityTemplate[]> {
    return this.db.query('community_templates', {
      where: {
        'verification.status': 'approved',
        ...(query.category && { 'metadata.category': query.category }),
        ...(query.framework && { 'metadata.framework': query.framework }),
        ...(query.search && {
          $or: [
            { 'metadata.name': { $regex: query.search, $options: 'i' } },
            { 'metadata.description': { $regex: query.search, $options: 'i' } },
          ],
        }),
      },
      orderBy: query.sortBy || 'stats.downloads',
      order: 'desc',
      limit: query.limit || 20,
      offset: query.offset || 0,
    });
  }
}
```

---

## Version Tagging

### Semantic Versioning

```typescript
// templates/versioning/semver.ts

interface VersionTag {
  // Full version: v2.1.0
  full: string;
  // Major version: v2
  major: string;
  // Minor version: v2.1
  minor: string;
  // Pre-release: v2.1.0-beta.1
  preRelease?: string;
}

class TemplateVersioning {
  /**
   * Parse version from tag
   */
  parseVersion(tag: string): VersionTag {
    const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(-([a-zA-Z0-9.-]+))?$/);
    if (!match) {
      throw new Error(`Invalid version tag: ${tag}`);
    }
    
    const [, major, minor, patch, , preRelease] = match;
    
    return {
      full: `v${major}.${minor}.${patch}${preRelease ? `-${preRelease}` : ''}`,
      major: `v${major}`,
      minor: `v${major}.${minor}`,
      preRelease,
    };
  }
  
  /**
   * Resolve version to specific tag
   */
  async resolveVersion(
    repoUrl: string,
    versionSpec: string
  ): Promise<string> {
    // Fetch all tags
    const tags = await this.fetchTags(repoUrl);
    
    // Handle special versions
    if (versionSpec === 'latest') {
      return this.getLatestStable(tags);
    }
    
    if (versionSpec === 'next') {
      return this.getLatestPreRelease(tags) || this.getLatestStable(tags);
    }
    
    // Handle version ranges
    if (versionSpec.startsWith('^') || versionSpec.startsWith('~')) {
      return this.resolveRange(tags, versionSpec);
    }
    
    // Exact version
    const exactMatch = tags.find(t => t === versionSpec || t === `v${versionSpec}`);
    if (exactMatch) {
      return exactMatch;
    }
    
    throw new Error(`Version not found: ${versionSpec}`);
  }
  
  /**
   * Get latest stable version
   */
  private getLatestStable(tags: string[]): string {
    const stableTags = tags
      .filter(t => !t.includes('-'))
      .sort(this.compareVersions)
      .reverse();
    
    return stableTags[0] || 'main';
  }
}
```

### Git Tag Structure

```
Template Repository Tags:
├── v1.0.0          # Initial release
├── v1.0.1          # Patch release
├── v1.1.0          # Minor release
├── v1.1.0-beta.1   # Pre-release
├── v2.0.0          # Major release
├── v2.0.0-rc.1     # Release candidate
└── latest          # Points to latest stable
```

### Version Resolution URLs

```typescript
// templates/versioning/urls.ts

class VersionedUrlResolver {
  /**
   * Build versioned template URL
   */
  buildUrl(template: string, version: string): TemplateUrls {
    const baseUrl = this.getBaseUrl(template);
    
    return {
      // GitHub archive URL
      archive: `${baseUrl}/archive/refs/tags/${version}.tar.gz`,
      
      // Raw file access
      raw: `${baseUrl}/raw/${version}`,
      
      // Git clone URL with tag
      clone: `${baseUrl}.git#${version}`,
      
      // Registry URL
      registry: `https://templates.manus.im/${template}@${version}`,
      
      // CDN-backed URL (fastest)
      cdn: `https://cdn.manus.im/templates/${template}/${version}.tar.gz`,
    };
  }
}

// URL examples:
// Archive: https://github.com/manus-templates/web-react-vite/archive/refs/tags/v2.1.0.tar.gz
// Raw: https://github.com/manus-templates/web-react-vite/raw/v2.1.0/template.json
// Clone: https://github.com/manus-templates/web-react-vite.git#v2.1.0
// Registry: https://templates.manus.im/web/react-vite@2.1.0
// CDN: https://cdn.manus.im/templates/web-react-vite/v2.1.0.tar.gz
```

---

## Repository Organization

### Monorepo vs Multi-repo

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           REPOSITORY ORGANIZATION OPTIONS                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  OPTION 1: MONOREPO (Recommended for official templates)                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  manus-templates/                                                               │   │
│  │  ├── packages/                                                                  │   │
│  │  │   ├── web-react-vite/                                                        │   │
│  │  │   ├── web-nextjs-app/                                                        │   │
│  │  │   ├── api-express-trpc/                                                      │   │
│  │  │   └── ...                                                                    │   │
│  │  ├── shared/                                                                    │   │
│  │  │   ├── eslint-config/                                                         │   │
│  │  │   ├── tsconfig/                                                              │   │
│  │  │   └── prettier-config/                                                       │   │
│  │  ├── scripts/                                                                   │   │
│  │  │   ├── build-all.ts                                                           │   │
│  │  │   ├── publish-all.ts                                                         │   │
│  │  │   └── validate-all.ts                                                        │   │
│  │  └── pnpm-workspace.yaml                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  OPTION 2: MULTI-REPO (Used for community templates)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  manus-templates/web-react-vite           (separate repo)                       │   │
│  │  manus-templates/web-nextjs-app           (separate repo)                       │   │
│  │  manus-templates/api-express-trpc         (separate repo)                       │   │
│  │  johndoe/manus-template-saas-starter      (community repo)                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Template Directory Structure

```
template-name/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # CI pipeline
│   │   ├── release.yml         # Release automation
│   │   └── validate.yml        # Template validation
│   └── CODEOWNERS
│
├── template/                    # 📁 TEMPLATE FILES (copied to user project)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── public/
│   │   └── favicon.ico
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── README.md
│
├── hooks/                       # 📁 LIFECYCLE HOOKS
│   ├── pre-init.sh             # Before template copy
│   ├── post-init.sh            # After template copy
│   ├── pre-init.js             # Node.js alternative
│   └── post-init.js            # Node.js alternative
│
├── prompts/                     # 📁 INTERACTIVE PROMPTS
│   └── prompts.json            # User input configuration
│
├── tests/                       # 📁 TEMPLATE TESTS
│   ├── snapshot/               # Snapshot tests
│   └── integration/            # Integration tests
│
├── template.json               # 📄 TEMPLATE METADATA
├── README.md                   # 📄 DOCUMENTATION
├── CHANGELOG.md                # 📄 VERSION HISTORY
└── LICENSE                     # 📄 LICENSE FILE
```

### Template Metadata (template.json)

```json
{
  "$schema": "https://templates.manus.im/schema/template.json",
  "name": "web-react-vite",
  "displayName": "React + Vite",
  "description": "Modern React application with Vite, TypeScript, and Tailwind CSS",
  "version": "2.1.0",
  "author": {
    "name": "Manus Team",
    "email": "templates@manus.im",
    "url": "https://manus.im"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/manus-templates/web-react-vite"
  },
  "category": "web",
  "framework": "react",
  "variant": "vite",
  "features": [
    "typescript",
    "tailwind",
    "eslint",
    "prettier",
    "vitest"
  ],
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "hooks": {
    "preInit": "hooks/pre-init.sh",
    "postInit": "hooks/post-init.sh"
  },
  "prompts": [
    {
      "name": "projectName",
      "type": "text",
      "message": "Project name:",
      "default": "my-app",
      "validate": "^[a-z][a-z0-9-]*$"
    },
    {
      "name": "useAuth",
      "type": "confirm",
      "message": "Include authentication?",
      "default": false
    },
    {
      "name": "database",
      "type": "select",
      "message": "Database:",
      "choices": ["none", "postgresql", "mysql", "sqlite"],
      "default": "none"
    }
  ],
  "files": {
    "include": ["template/**/*"],
    "exclude": ["template/**/*.test.ts"]
  },
  "postInstall": [
    "pnpm install",
    "pnpm db:push"
  ],
  "keywords": ["react", "vite", "typescript", "tailwind"],
  "screenshots": [
    "https://templates.manus.im/screenshots/web-react-vite/home.png",
    "https://templates.manus.im/screenshots/web-react-vite/dashboard.png"
  ]
}
```

---

## Access Patterns

### Template Fetching Flow

```typescript
// templates/fetcher/index.ts

interface FetchOptions {
  template: string;
  version?: string;
  cache?: boolean;
  timeout?: number;
}

class TemplateFetcher {
  private cache: TemplateCache;
  private cdn: CDNClient;
  private github: GitHubClient;
  
  /**
   * Fetch template with fallback chain
   */
  async fetch(options: FetchOptions): Promise<TemplateBundle> {
    const { template, version = 'latest', cache = true } = options;
    
    // 1. Check local cache
    if (cache) {
      const cached = await this.cache.get(template, version);
      if (cached && !this.isExpired(cached)) {
        return cached;
      }
    }
    
    // 2. Try CDN (fastest)
    try {
      const cdnBundle = await this.fetchFromCDN(template, version);
      await this.cache.set(template, version, cdnBundle);
      return cdnBundle;
    } catch (error) {
      console.warn('CDN fetch failed, falling back to GitHub');
    }
    
    // 3. Fallback to GitHub
    try {
      const githubBundle = await this.fetchFromGitHub(template, version);
      await this.cache.set(template, version, githubBundle);
      return githubBundle;
    } catch (error) {
      throw new Error(`Failed to fetch template: ${template}@${version}`);
    }
  }
  
  /**
   * Fetch from CDN
   */
  private async fetchFromCDN(
    template: string,
    version: string
  ): Promise<TemplateBundle> {
    const url = `https://cdn.manus.im/templates/${template}/${version}.tar.gz`;
    
    const response = await fetch(url, {
      headers: {
        'Accept-Encoding': 'gzip',
      },
    });
    
    if (!response.ok) {
      throw new Error(`CDN returned ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    return this.extractBundle(buffer);
  }
  
  /**
   * Fetch from GitHub
   */
  private async fetchFromGitHub(
    template: string,
    version: string
  ): Promise<TemplateBundle> {
    const repoUrl = this.resolveRepoUrl(template);
    const archiveUrl = `${repoUrl}/archive/refs/tags/${version}.tar.gz`;
    
    const response = await this.github.fetch(archiveUrl);
    const buffer = await response.arrayBuffer();
    
    return this.extractBundle(buffer);
  }
}
```

### Authentication for Private Templates

```typescript
// templates/auth/index.ts

interface TemplateAuth {
  type: 'public' | 'private' | 'organization';
  credentials?: {
    token?: string;
    username?: string;
    password?: string;
  };
}

class AuthenticatedTemplateFetcher extends TemplateFetcher {
  /**
   * Fetch with authentication
   */
  async fetchAuthenticated(
    options: FetchOptions,
    auth: TemplateAuth
  ): Promise<TemplateBundle> {
    if (auth.type === 'public') {
      return this.fetch(options);
    }
    
    // Add authentication headers
    const headers: Record<string, string> = {};
    
    if (auth.credentials?.token) {
      headers['Authorization'] = `Bearer ${auth.credentials.token}`;
    } else if (auth.credentials?.username && auth.credentials?.password) {
      const encoded = btoa(`${auth.credentials.username}:${auth.credentials.password}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }
    
    return this.fetchWithHeaders(options, headers);
  }
}
```

---

## Implementation Guide

### Template URL Resolution

```typescript
// templates/resolver/index.ts

class TemplateResolver {
  private officialRegistry: OfficialTemplateRegistry;
  private communityRegistry: CommunityTemplateRegistry;
  
  /**
   * Resolve template identifier to URL
   */
  async resolve(identifier: string): Promise<ResolvedTemplate> {
    // 1. Check if it's an official template
    if (this.isOfficialTemplate(identifier)) {
      return this.resolveOfficial(identifier);
    }
    
    // 2. Check if it's a community template
    if (identifier.startsWith('@') || identifier.startsWith('github:')) {
      return this.resolveCommunity(identifier);
    }
    
    // 3. Check if it's a direct URL
    if (identifier.startsWith('https://')) {
      return this.resolveUrl(identifier);
    }
    
    // 4. Search registries
    const searchResult = await this.search(identifier);
    if (searchResult.length === 1) {
      return searchResult[0];
    }
    
    throw new Error(`Unable to resolve template: ${identifier}`);
  }
  
  /**
   * Resolve official template
   */
  private async resolveOfficial(name: string): Promise<ResolvedTemplate> {
    const template = await this.officialRegistry.get(name);
    
    return {
      type: 'official',
      name: template.name,
      repoUrl: template.repoUrl,
      registryUrl: template.registryUrl,
      version: template.version,
      metadata: template,
    };
  }
  
  /**
   * Resolve community template
   */
  private async resolveCommunity(identifier: string): Promise<ResolvedTemplate> {
    const repoUrl = this.communityResolver.resolveUrl(identifier);
    const metadata = await this.fetchMetadata(repoUrl);
    
    return {
      type: 'community',
      name: metadata.name,
      repoUrl,
      registryUrl: null,
      version: metadata.version,
      metadata,
    };
  }
}
```

### CLI Usage Examples

```bash
# Official templates
manus init web-react-vite
manus init web-react-vite@2.1.0
manus init web-react-vite@latest

# Community templates
manus init @johndoe/saas-starter
manus init github:johndoe/manus-template-saas-starter

# Direct URL
manus init https://github.com/acme/custom-template

# With version
manus init @johndoe/saas-starter@1.0.0

# List available templates
manus templates list
manus templates list --category=web
manus templates search "react dashboard"
```

---

## Summary

### URL Structure Quick Reference

| Type | Format | Example |
|------|--------|---------|
| **Official** | `{category}-{framework}-{variant}` | `web-react-vite` |
| **Community** | `@{user}/{name}` | `@johndoe/saas-starter` |
| **GitHub** | `github:{user}/{repo}` | `github:acme/template` |
| **Direct** | `https://...` | Full GitHub URL |
| **Registry** | `{category}/{name}@{version}` | `web/react-vite@2.1.0` |
| **CDN** | `cdn.manus.im/templates/...` | CDN-backed archive |

### Repository Requirements

| Requirement | Official | Community |
|-------------|----------|-----------|
| Naming convention | `{category}-{framework}-{variant}` | `manus-template-{name}` |
| template.json | Required | Required |
| template/ directory | Required | Required |
| README.md | Required | Required |
| LICENSE | Required | Required |
| Hooks | Optional | Optional |
| Tests | Required | Recommended |
| CI/CD | Required | Recommended |
