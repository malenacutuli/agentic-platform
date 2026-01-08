# Custom Templates: Authoring, Marketplace, and Validation

## Overview

This guide covers everything needed to enable users to create, share, and monetize custom templates:

- **Template Authoring Process** - Step-by-step guide to creating templates
- **Template Marketplace** - Discovery, sharing, and monetization
- **Validation Requirements** - Security, quality, and compliance checks
- **Template SDK** - Tools for template development
- **Review Process** - Submission and approval workflow

---

## 1. Template Authoring Process

### 1.1 Template Development Workflow

```typescript
/**
 * Complete template authoring workflow
 */

interface TemplateAuthoringWorkflow {
  phases: AuthoringPhase[];
  estimatedTime: string;
  requiredSkills: string[];
}

interface AuthoringPhase {
  id: number;
  name: string;
  description: string;
  tasks: string[];
  deliverables: string[];
  estimatedHours: number;
}

const authoringWorkflow: TemplateAuthoringWorkflow = {
  phases: [
    {
      id: 1,
      name: 'Planning',
      description: 'Define template purpose and requirements',
      tasks: [
        'Identify target use case',
        'Research existing templates',
        'Define feature set',
        'Plan technology stack',
        'Create wireframes/mockups'
      ],
      deliverables: ['Template specification document', 'Feature list', 'Tech stack decision'],
      estimatedHours: 4
    },
    {
      id: 2,
      name: 'Scaffolding',
      description: 'Create base template structure',
      tasks: [
        'Initialize project structure',
        'Set up configuration files',
        'Create directory layout',
        'Add placeholder files',
        'Configure build tools'
      ],
      deliverables: ['Base project structure', 'Configuration files', 'Build setup'],
      estimatedHours: 8
    },
    {
      id: 3,
      name: 'Development',
      description: 'Implement template features',
      tasks: [
        'Implement core functionality',
        'Create reusable components',
        'Add styling and theming',
        'Implement API routes',
        'Add database schema'
      ],
      deliverables: ['Working template', 'Components library', 'API implementation'],
      estimatedHours: 20
    },
    {
      id: 4,
      name: 'Documentation',
      description: 'Write comprehensive documentation',
      tasks: [
        'Write README.md',
        'Create setup guide',
        'Document API endpoints',
        'Add inline code comments',
        'Create usage examples'
      ],
      deliverables: ['README.md', 'Setup guide', 'API docs', 'Examples'],
      estimatedHours: 8
    },
    {
      id: 5,
      name: 'Testing',
      description: 'Test template thoroughly',
      tasks: [
        'Write unit tests',
        'Test installation process',
        'Test on multiple environments',
        'Security testing',
        'Performance testing'
      ],
      deliverables: ['Test suite', 'Test results', 'Performance report'],
      estimatedHours: 12
    },
    {
      id: 6,
      name: 'Submission',
      description: 'Submit for review and publish',
      tasks: [
        'Run validation checks',
        'Create marketplace listing',
        'Submit for review',
        'Address feedback',
        'Publish template'
      ],
      deliverables: ['Validated template', 'Marketplace listing', 'Published template'],
      estimatedHours: 4
    }
  ],
  estimatedTime: '56 hours (1-2 weeks)',
  requiredSkills: ['TypeScript', 'React', 'Node.js', 'Documentation']
};
```

### 1.2 Template SDK

```typescript
/**
 * Template SDK for creating custom templates
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface TemplateConfig {
  name: string;
  version: string;
  description: string;
  author: AuthorInfo;
  category: TemplateCategory;
  tags: string[];
  features: string[];
  tech: TechStack;
  requirements: Requirements;
  pricing: PricingConfig;
}

interface AuthorInfo {
  name: string;
  email: string;
  url?: string;
  organization?: string;
}

type TemplateCategory = 
  | 'web-app'
  | 'mobile-app'
  | 'api'
  | 'ai-agent'
  | 'data-pipeline'
  | 'dashboard'
  | 'e-commerce'
  | 'saas'
  | 'landing-page'
  | 'blog'
  | 'portfolio'
  | 'other';

interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  infrastructure?: string[];
}

interface Requirements {
  nodeVersion: string;
  disk: string;
  memory: string;
  features?: string[];
}

interface PricingConfig {
  type: 'free' | 'paid' | 'freemium';
  price?: number;
  currency?: string;
  trialDays?: number;
}

class TemplateSDK {
  private templatePath: string;
  private config: TemplateConfig;

  constructor(templatePath: string) {
    this.templatePath = templatePath;
    this.config = this.loadConfig();
  }

  /**
   * Initialize a new template
   */
  static async init(
    name: string,
    category: TemplateCategory,
    options: Partial<TemplateConfig> = {}
  ): Promise<TemplateSDK> {
    const templatePath = path.join(process.cwd(), name);

    // Create directory structure
    const directories = [
      '',
      'client/src/pages',
      'client/src/components',
      'client/src/hooks',
      'client/src/lib',
      'client/public',
      'server',
      'docs',
      'scripts',
      'tests'
    ];

    for (const dir of directories) {
      fs.mkdirSync(path.join(templatePath, dir), { recursive: true });
    }

    // Create template.config.json
    const config: TemplateConfig = {
      name,
      version: '1.0.0',
      description: options.description || `A ${category} template`,
      author: options.author || {
        name: 'Template Author',
        email: 'author@example.com'
      },
      category,
      tags: options.tags || [category],
      features: options.features || [],
      tech: options.tech || {},
      requirements: options.requirements || {
        nodeVersion: '18.x || 20.x',
        disk: '500MB',
        memory: '2GB'
      },
      pricing: options.pricing || { type: 'free' }
    };

    fs.writeFileSync(
      path.join(templatePath, 'template.config.json'),
      JSON.stringify(config, null, 2)
    );

    // Create base files
    await TemplateSDK.createBaseFiles(templatePath, config);

    console.log(`✅ Template "${name}" initialized at ${templatePath}`);
    return new TemplateSDK(templatePath);
  }

  /**
   * Create base template files
   */
  private static async createBaseFiles(
    templatePath: string,
    config: TemplateConfig
  ): Promise<void> {
    // package.json
    const packageJson = {
      name: config.name,
      version: config.version,
      description: config.description,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        test: 'vitest run',
        lint: 'eslint . --ext .ts,.tsx',
        format: 'prettier --write .'
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0'
      },
      devDependencies: {
        typescript: '^5.0.0',
        vite: '^5.0.0',
        '@vitejs/plugin-react': '^4.0.0',
        vitest: '^1.0.0'
      }
    };

    fs.writeFileSync(
      path.join(templatePath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./client/src/*']
        }
      },
      include: ['client/src', 'server']
    };

    fs.writeFileSync(
      path.join(templatePath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // .env.example
    const envExample = `# Application
VITE_APP_TITLE=${config.name}
VITE_APP_LOGO=/logo.svg

# Add your environment variables here
`;

    fs.writeFileSync(path.join(templatePath, '.env.example'), envExample);

    // .gitignore
    const gitignore = `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
`;

    fs.writeFileSync(path.join(templatePath, '.gitignore'), gitignore);

    // README.md
    const readme = `# ${config.name}

${config.description}

## Features

${config.features.map(f => `- ${f}`).join('\n') || '- Add features here'}

## Getting Started

### Prerequisites

- Node.js ${config.requirements.nodeVersion}
- npm or pnpm

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

### Build

\`\`\`bash
npm run build
\`\`\`

## Documentation

See [docs/](./docs/) for detailed documentation.

## License

MIT
`;

    fs.writeFileSync(path.join(templatePath, 'README.md'), readme);

    // Basic App.tsx
    const appTsx = `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-bold">Welcome to ${config.name}</h1>
    </div>
  );
}
`;

    fs.writeFileSync(path.join(templatePath, 'client/src/App.tsx'), appTsx);

    // main.tsx
    const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

    fs.writeFileSync(path.join(templatePath, 'client/src/main.tsx'), mainTsx);

    // index.css
    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #3b82f6;
  --secondary: #8b5cf6;
}
`;

    fs.writeFileSync(path.join(templatePath, 'client/src/index.css'), indexCss);

    // index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

    fs.writeFileSync(path.join(templatePath, 'client/index.html'), indexHtml);
  }

  /**
   * Load template configuration
   */
  private loadConfig(): TemplateConfig {
    const configPath = path.join(this.templatePath, 'template.config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    throw new Error('template.config.json not found');
  }

  /**
   * Add a component to the template
   */
  addComponent(name: string, code: string): void {
    const componentPath = path.join(
      this.templatePath,
      'client/src/components',
      `${name}.tsx`
    );
    fs.writeFileSync(componentPath, code);
    console.log(`✅ Component "${name}" added`);
  }

  /**
   * Add a page to the template
   */
  addPage(name: string, code: string): void {
    const pagePath = path.join(
      this.templatePath,
      'client/src/pages',
      `${name}.tsx`
    );
    fs.writeFileSync(pagePath, code);
    console.log(`✅ Page "${name}" added`);
  }

  /**
   * Add a hook to the template
   */
  addHook(name: string, code: string): void {
    const hookPath = path.join(
      this.templatePath,
      'client/src/hooks',
      `${name}.ts`
    );
    fs.writeFileSync(hookPath, code);
    console.log(`✅ Hook "${name}" added`);
  }

  /**
   * Add a dependency
   */
  addDependency(name: string, version: string, dev: boolean = false): void {
    const packageJsonPath = path.join(this.templatePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    if (dev) {
      packageJson.devDependencies = packageJson.devDependencies || {};
      packageJson.devDependencies[name] = version;
    } else {
      packageJson.dependencies = packageJson.dependencies || {};
      packageJson.dependencies[name] = version;
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`✅ Dependency "${name}@${version}" added`);
  }

  /**
   * Add an environment variable
   */
  addEnvVariable(name: string, description: string, example: string): void {
    const envExamplePath = path.join(this.templatePath, '.env.example');
    let content = fs.readFileSync(envExamplePath, 'utf-8');
    content += `\n# ${description}\n${name}=${example}\n`;
    fs.writeFileSync(envExamplePath, content);
    console.log(`✅ Environment variable "${name}" added`);
  }

  /**
   * Validate template
   */
  async validate(): Promise<ValidationResult> {
    const validator = new TemplateValidator(this.templatePath);
    return validator.validate();
  }

  /**
   * Package template for submission
   */
  async package(): Promise<string> {
    const outputPath = path.join(
      this.templatePath,
      '..',
      `${this.config.name}-${this.config.version}.tar.gz`
    );

    execSync(`tar -czf ${outputPath} -C ${this.templatePath} .`);
    console.log(`✅ Template packaged: ${outputPath}`);
    return outputPath;
  }

  /**
   * Submit template to marketplace
   */
  async submit(): Promise<SubmissionResult> {
    // Validate first
    const validation = await this.validate();
    if (!validation.passed) {
      return {
        success: false,
        errors: validation.errors,
        message: 'Template validation failed'
      };
    }

    // Package template
    const packagePath = await this.package();

    // Submit to marketplace API
    const submission = await this.submitToMarketplace(packagePath);

    return submission;
  }

  private async submitToMarketplace(packagePath: string): Promise<SubmissionResult> {
    // Simulated API call
    console.log(`📤 Submitting template to marketplace...`);
    
    // In production, this would call the marketplace API
    return {
      success: true,
      submissionId: `sub_${Date.now()}`,
      message: 'Template submitted for review',
      estimatedReviewTime: '2-3 business days'
    };
  }
}

interface SubmissionResult {
  success: boolean;
  submissionId?: string;
  errors?: string[];
  message: string;
  estimatedReviewTime?: string;
}
```

### 1.3 Template CLI Tool

```typescript
/**
 * CLI tool for template authoring
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';

const program = new Command();

program
  .name('template-cli')
  .description('CLI for creating and managing custom templates')
  .version('1.0.0');

// Initialize new template
program
  .command('init')
  .description('Initialize a new template')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Template name:',
        validate: (input) => input.length > 0 || 'Name is required'
      },
      {
        type: 'list',
        name: 'category',
        message: 'Template category:',
        choices: [
          'web-app',
          'mobile-app',
          'api',
          'ai-agent',
          'data-pipeline',
          'dashboard',
          'e-commerce',
          'saas',
          'landing-page',
          'blog',
          'portfolio',
          'other'
        ]
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          'Authentication',
          'Database',
          'API Routes',
          'File Upload',
          'Email',
          'Payments',
          'Real-time',
          'AI/LLM',
          'Analytics',
          'Admin Panel'
        ]
      },
      {
        type: 'list',
        name: 'pricing',
        message: 'Pricing model:',
        choices: ['free', 'paid', 'freemium']
      }
    ]);

    console.log(chalk.blue('\n🚀 Creating template...\n'));

    await TemplateSDK.init(answers.name, answers.category, {
      description: answers.description,
      features: answers.features,
      pricing: { type: answers.pricing }
    });

    console.log(chalk.green(`\n✅ Template "${answers.name}" created successfully!\n`));
    console.log('Next steps:');
    console.log(`  1. cd ${answers.name}`);
    console.log('  2. npm install');
    console.log('  3. Start building your template');
  });

// Validate template
program
  .command('validate')
  .description('Validate template for submission')
  .action(async () => {
    const sdk = new TemplateSDK(process.cwd());
    const result = await sdk.validate();

    if (result.passed) {
      console.log(chalk.green('\n✅ Template validation passed!\n'));
    } else {
      console.log(chalk.red('\n❌ Template validation failed:\n'));
      result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:\n'));
      result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
    }
  });

// Submit template
program
  .command('submit')
  .description('Submit template to marketplace')
  .action(async () => {
    const sdk = new TemplateSDK(process.cwd());
    const result = await sdk.submit();

    if (result.success) {
      console.log(chalk.green(`\n✅ ${result.message}\n`));
      console.log(`Submission ID: ${result.submissionId}`);
      console.log(`Estimated review time: ${result.estimatedReviewTime}`);
    } else {
      console.log(chalk.red(`\n❌ ${result.message}\n`));
      result.errors?.forEach(e => console.log(chalk.red(`  - ${e}`)));
    }
  });

// Add component
program
  .command('add:component <name>')
  .description('Add a new component')
  .action(async (name) => {
    const { code } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'code',
        message: 'Enter component code:'
      }
    ]);

    const sdk = new TemplateSDK(process.cwd());
    sdk.addComponent(name, code);
  });

// Add page
program
  .command('add:page <name>')
  .description('Add a new page')
  .action(async (name) => {
    const { code } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'code',
        message: 'Enter page code:'
      }
    ]);

    const sdk = new TemplateSDK(process.cwd());
    sdk.addPage(name, code);
  });

// Add dependency
program
  .command('add:dep <name> <version>')
  .description('Add a dependency')
  .option('-D, --dev', 'Add as dev dependency')
  .action((name, version, options) => {
    const sdk = new TemplateSDK(process.cwd());
    sdk.addDependency(name, version, options.dev);
  });

program.parse();
```

---

## 2. Template Marketplace

### 2.1 Marketplace Architecture

```typescript
/**
 * Template Marketplace System
 */

interface MarketplaceTemplate {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  longDescription: string;
  author: AuthorInfo;
  category: TemplateCategory;
  tags: string[];
  features: string[];
  tech: TechStack;
  pricing: PricingConfig;
  stats: TemplateStats;
  ratings: RatingInfo;
  screenshots: string[];
  demoUrl?: string;
  repositoryUrl?: string;
  documentation: string;
  changelog: ChangelogEntry[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
  status: TemplateStatus;
}

interface TemplateStats {
  downloads: number;
  weeklyDownloads: number;
  monthlyDownloads: number;
  activeInstalls: number;
  stars: number;
  forks: number;
}

interface RatingInfo {
  average: number;
  count: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  reviews: Review[];
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: Date;
  response?: {
    content: string;
    createdAt: Date;
  };
}

interface ChangelogEntry {
  version: string;
  date: Date;
  changes: string[];
  breaking: boolean;
}

type TemplateStatus = 
  | 'draft'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'deprecated'
  | 'removed';

/**
 * Marketplace API
 */
class MarketplaceAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Search templates
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.category) params.set('category', query.category);
    if (query.tags) params.set('tags', query.tags.join(','));
    if (query.pricing) params.set('pricing', query.pricing);
    if (query.sort) params.set('sort', query.sort);
    if (query.page) params.set('page', query.page.toString());
    if (query.limit) params.set('limit', query.limit.toString());

    const response = await fetch(`${this.baseUrl}/templates?${params}`);
    return response.json();
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<MarketplaceTemplate> {
    const response = await fetch(`${this.baseUrl}/templates/${id}`);
    return response.json();
  }

  /**
   * Get featured templates
   */
  async getFeatured(): Promise<MarketplaceTemplate[]> {
    const response = await fetch(`${this.baseUrl}/templates/featured`);
    return response.json();
  }

  /**
   * Get popular templates
   */
  async getPopular(limit: number = 10): Promise<MarketplaceTemplate[]> {
    const response = await fetch(`${this.baseUrl}/templates/popular?limit=${limit}`);
    return response.json();
  }

  /**
   * Get new templates
   */
  async getNew(limit: number = 10): Promise<MarketplaceTemplate[]> {
    const response = await fetch(`${this.baseUrl}/templates/new?limit=${limit}`);
    return response.json();
  }

  /**
   * Get templates by category
   */
  async getByCategory(category: TemplateCategory): Promise<MarketplaceTemplate[]> {
    const response = await fetch(`${this.baseUrl}/templates/category/${category}`);
    return response.json();
  }

  /**
   * Get templates by author
   */
  async getByAuthor(authorId: string): Promise<MarketplaceTemplate[]> {
    const response = await fetch(`${this.baseUrl}/templates/author/${authorId}`);
    return response.json();
  }

  /**
   * Install template
   */
  async install(templateId: string, projectPath: string): Promise<InstallResult> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath })
    });
    return response.json();
  }

  /**
   * Submit review
   */
  async submitReview(templateId: string, review: Omit<Review, 'id' | 'createdAt'>): Promise<Review> {
    const response = await fetch(`${this.baseUrl}/templates/${templateId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });
    return response.json();
  }

  /**
   * Report template
   */
  async report(templateId: string, reason: string, details: string): Promise<void> {
    await fetch(`${this.baseUrl}/templates/${templateId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details })
    });
  }
}

interface SearchQuery {
  q?: string;
  category?: TemplateCategory;
  tags?: string[];
  pricing?: 'free' | 'paid' | 'all';
  sort?: 'popular' | 'new' | 'rating' | 'downloads';
  page?: number;
  limit?: number;
}

interface SearchResult {
  templates: MarketplaceTemplate[];
  total: number;
  page: number;
  totalPages: number;
}

interface InstallResult {
  success: boolean;
  templateId: string;
  version: string;
  projectPath: string;
  message: string;
}
```

### 2.2 Marketplace Database Schema

```sql
-- Marketplace Database Schema

-- Templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  version VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  author_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  tech JSONB DEFAULT '{}',
  pricing JSONB NOT NULL,
  screenshots TEXT[] DEFAULT '{}',
  demo_url VARCHAR(500),
  repository_url VARCHAR(500),
  documentation TEXT,
  package_url VARCHAR(500) NOT NULL,
  package_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN (
    'draft', 'pending_review', 'in_review', 'approved', 
    'published', 'rejected', 'deprecated', 'removed'
  ))
);

-- Template versions table
CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id),
  version VARCHAR(20) NOT NULL,
  changelog TEXT[],
  breaking BOOLEAN DEFAULT FALSE,
  package_url VARCHAR(500) NOT NULL,
  package_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(template_id, version)
);

-- Template stats table
CREATE TABLE template_stats (
  template_id UUID PRIMARY KEY REFERENCES templates(id),
  downloads INTEGER DEFAULT 0,
  weekly_downloads INTEGER DEFAULT 0,
  monthly_downloads INTEGER DEFAULT 0,
  active_installs INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reviews table
CREATE TABLE template_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  content TEXT,
  helpful INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(template_id, user_id)
);

-- Review responses table
CREATE TABLE review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES template_reviews(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Downloads table (for analytics)
CREATE TABLE template_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id),
  user_id UUID REFERENCES users(id),
  version VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Installs table (for tracking active installs)
CREATE TABLE template_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id),
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID,
  version VARCHAR(20) NOT NULL,
  installed_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(template_id, user_id, project_id)
);

-- Reports table
CREATE TABLE template_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_author ON templates(author_id);
CREATE INDEX idx_template_downloads_template ON template_downloads(template_id);
CREATE INDEX idx_template_downloads_date ON template_downloads(created_at);
CREATE INDEX idx_template_reviews_template ON template_reviews(template_id);
CREATE INDEX idx_template_installs_template ON template_installs(template_id);
```

### 2.3 Revenue Sharing Model

```typescript
/**
 * Revenue sharing and monetization
 */

interface RevenueConfig {
  platformFee: number;        // Platform takes this percentage
  authorShare: number;        // Author receives this percentage
  minimumPayout: number;      // Minimum balance for payout
  payoutCurrency: string;     // Currency for payouts
  payoutMethods: string[];    // Available payout methods
}

const revenueConfig: RevenueConfig = {
  platformFee: 0.30,          // 30% platform fee
  authorShare: 0.70,          // 70% to author
  minimumPayout: 50,          // $50 minimum
  payoutCurrency: 'USD',
  payoutMethods: ['stripe', 'paypal', 'bank_transfer']
};

interface AuthorEarnings {
  authorId: string;
  totalEarnings: number;
  pendingPayout: number;
  lifetimeEarnings: number;
  thisMonth: number;
  lastMonth: number;
  byTemplate: TemplateEarnings[];
}

interface TemplateEarnings {
  templateId: string;
  templateName: string;
  totalSales: number;
  totalRevenue: number;
  authorEarnings: number;
  thisMonth: number;
}

class RevenueManager {
  /**
   * Process a template purchase
   */
  async processPurchase(
    templateId: string,
    userId: string,
    amount: number
  ): Promise<PurchaseResult> {
    // Calculate splits
    const platformFee = amount * revenueConfig.platformFee;
    const authorShare = amount * revenueConfig.authorShare;

    // Record transaction
    const transaction = await this.recordTransaction({
      templateId,
      userId,
      amount,
      platformFee,
      authorShare,
      currency: revenueConfig.payoutCurrency,
      status: 'completed'
    });

    // Update author balance
    await this.updateAuthorBalance(templateId, authorShare);

    // Check if payout threshold reached
    await this.checkPayoutThreshold(templateId);

    return {
      success: true,
      transactionId: transaction.id,
      amount,
      authorShare
    };
  }

  /**
   * Get author earnings
   */
  async getAuthorEarnings(authorId: string): Promise<AuthorEarnings> {
    // Query database for earnings
    const earnings = await db.query(`
      SELECT 
        t.id as template_id,
        t.name as template_name,
        COUNT(tr.id) as total_sales,
        SUM(tr.amount) as total_revenue,
        SUM(tr.author_share) as author_earnings,
        SUM(CASE WHEN tr.created_at >= DATE_TRUNC('month', NOW()) 
            THEN tr.author_share ELSE 0 END) as this_month
      FROM templates t
      LEFT JOIN transactions tr ON t.id = tr.template_id
      WHERE t.author_id = $1
      GROUP BY t.id, t.name
    `, [authorId]);

    return {
      authorId,
      totalEarnings: earnings.reduce((sum, e) => sum + e.author_earnings, 0),
      pendingPayout: await this.getPendingPayout(authorId),
      lifetimeEarnings: await this.getLifetimeEarnings(authorId),
      thisMonth: earnings.reduce((sum, e) => sum + e.this_month, 0),
      lastMonth: await this.getLastMonthEarnings(authorId),
      byTemplate: earnings
    };
  }

  /**
   * Request payout
   */
  async requestPayout(
    authorId: string,
    amount: number,
    method: string
  ): Promise<PayoutResult> {
    const balance = await this.getPendingPayout(authorId);

    if (balance < revenueConfig.minimumPayout) {
      return {
        success: false,
        error: `Minimum payout is $${revenueConfig.minimumPayout}`
      };
    }

    if (amount > balance) {
      return {
        success: false,
        error: 'Insufficient balance'
      };
    }

    // Process payout based on method
    const payout = await this.processPayout(authorId, amount, method);

    return {
      success: true,
      payoutId: payout.id,
      amount,
      method,
      estimatedArrival: payout.estimatedArrival
    };
  }

  private async recordTransaction(data: any): Promise<any> {
    // Database insert
    return { id: `txn_${Date.now()}` };
  }

  private async updateAuthorBalance(templateId: string, amount: number): Promise<void> {
    // Update balance in database
  }

  private async checkPayoutThreshold(templateId: string): Promise<void> {
    // Check if author should be notified about payout
  }

  private async getPendingPayout(authorId: string): Promise<number> {
    return 0; // Query database
  }

  private async getLifetimeEarnings(authorId: string): Promise<number> {
    return 0; // Query database
  }

  private async getLastMonthEarnings(authorId: string): Promise<number> {
    return 0; // Query database
  }

  private async processPayout(authorId: string, amount: number, method: string): Promise<any> {
    return { id: `payout_${Date.now()}`, estimatedArrival: new Date() };
  }
}

interface PurchaseResult {
  success: boolean;
  transactionId: string;
  amount: number;
  authorShare: number;
}

interface PayoutResult {
  success: boolean;
  payoutId?: string;
  amount?: number;
  method?: string;
  estimatedArrival?: Date;
  error?: string;
}
```

---

## 3. Validation Requirements

### 3.1 Template Validator

```typescript
/**
 * Comprehensive template validation
 */

interface ValidationResult {
  passed: boolean;
  score: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  categories: ValidationCategory[];
}

interface ValidationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'error' | 'critical';
}

interface ValidationWarning {
  code: string;
  message: string;
  file?: string;
  suggestion?: string;
}

interface ValidationCategory {
  name: string;
  passed: boolean;
  score: number;
  checks: ValidationCheck[];
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}

class TemplateValidator {
  private templatePath: string;
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private categories: ValidationCategory[] = [];

  constructor(templatePath: string) {
    this.templatePath = templatePath;
  }

  /**
   * Run all validations
   */
  async validate(): Promise<ValidationResult> {
    console.log('🔍 Validating template...\n');

    // Run all validation categories
    await this.validateStructure();
    await this.validateConfiguration();
    await this.validateSecurity();
    await this.validateQuality();
    await this.validateDocumentation();
    await this.validatePerformance();
    await this.validateAccessibility();
    await this.validateCompliance();

    const passed = this.errors.length === 0;
    const score = this.calculateScore();

    return {
      passed,
      score,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.generateSuggestions(),
      categories: this.categories
    };
  }

  /**
   * Validate template structure
   */
  private async validateStructure(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // Required files
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.env.example',
      'README.md',
      'template.config.json'
    ];

    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(this.templatePath, file));
      checks.push({
        name: `${file} exists`,
        passed: exists,
        message: exists ? `✓ ${file} found` : `✗ ${file} missing`
      });

      if (!exists) {
        this.errors.push({
          code: 'MISSING_FILE',
          message: `Required file "${file}" is missing`,
          severity: 'error'
        });
      }
    }

    // Required directories
    const requiredDirs = ['client/src', 'docs'];
    for (const dir of requiredDirs) {
      const exists = fs.existsSync(path.join(this.templatePath, dir));
      checks.push({
        name: `${dir}/ directory exists`,
        passed: exists,
        message: exists ? `✓ ${dir}/ found` : `✗ ${dir}/ missing`
      });
    }

    this.categories.push({
      name: 'Structure',
      passed: checks.every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate configuration files
   */
  private async validateConfiguration(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // Validate package.json
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.templatePath, 'package.json'), 'utf-8')
      );

      // Check required fields
      const requiredFields = ['name', 'version', 'scripts'];
      for (const field of requiredFields) {
        const exists = packageJson[field] !== undefined;
        checks.push({
          name: `package.json has ${field}`,
          passed: exists,
          message: exists ? `✓ ${field} defined` : `✗ ${field} missing`
        });

        if (!exists) {
          this.errors.push({
            code: 'INVALID_PACKAGE_JSON',
            message: `package.json missing required field: ${field}`,
            file: 'package.json',
            severity: 'error'
          });
        }
      }

      // Check for required scripts
      const requiredScripts = ['dev', 'build'];
      for (const script of requiredScripts) {
        const exists = packageJson.scripts?.[script] !== undefined;
        checks.push({
          name: `"${script}" script defined`,
          passed: exists,
          message: exists ? `✓ ${script} script found` : `✗ ${script} script missing`
        });
      }

      // Check version format
      const validVersion = /^\d+\.\d+\.\d+/.test(packageJson.version);
      checks.push({
        name: 'Valid semver version',
        passed: validVersion,
        message: validVersion ? '✓ Valid version format' : '✗ Invalid version format'
      });

    } catch (error) {
      this.errors.push({
        code: 'INVALID_JSON',
        message: 'package.json is not valid JSON',
        file: 'package.json',
        severity: 'critical'
      });
    }

    // Validate template.config.json
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(this.templatePath, 'template.config.json'), 'utf-8')
      );

      const requiredConfigFields = ['name', 'version', 'description', 'category'];
      for (const field of requiredConfigFields) {
        const exists = config[field] !== undefined;
        checks.push({
          name: `template.config.json has ${field}`,
          passed: exists,
          message: exists ? `✓ ${field} defined` : `✗ ${field} missing`
        });
      }

    } catch (error) {
      this.errors.push({
        code: 'INVALID_CONFIG',
        message: 'template.config.json is not valid JSON',
        file: 'template.config.json',
        severity: 'critical'
      });
    }

    this.categories.push({
      name: 'Configuration',
      passed: checks.every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate security
   */
  private async validateSecurity(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /secret\s*[:=]\s*['"][^'"]+['"]/gi,
      /password\s*[:=]\s*['"][^'"]+['"]/gi,
      /sk[_-]live[_-][a-zA-Z0-9]+/g,
      /sk[_-]test[_-][a-zA-Z0-9]+/g,
      /AKIA[A-Z0-9]{16}/g
    ];

    const files = this.getAllFiles(this.templatePath);
    let hasHardcodedSecrets = false;

    for (const file of files) {
      if (file.endsWith('.md') || file.includes('node_modules')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          hasHardcodedSecrets = true;
          this.errors.push({
            code: 'HARDCODED_SECRET',
            message: `Potential hardcoded secret found`,
            file: path.relative(this.templatePath, file),
            severity: 'critical'
          });
        }
      }
    }

    checks.push({
      name: 'No hardcoded secrets',
      passed: !hasHardcodedSecrets,
      message: hasHardcodedSecrets ? '✗ Hardcoded secrets found' : '✓ No hardcoded secrets'
    });

    // Check for .env in .gitignore
    const gitignorePath = path.join(this.templatePath, '.gitignore');
    let envIgnored = false;
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      envIgnored = gitignore.includes('.env');
    }

    checks.push({
      name: '.env in .gitignore',
      passed: envIgnored,
      message: envIgnored ? '✓ .env is ignored' : '✗ .env not in .gitignore'
    });

    if (!envIgnored) {
      this.errors.push({
        code: 'ENV_NOT_IGNORED',
        message: '.env file is not in .gitignore',
        file: '.gitignore',
        severity: 'error'
      });
    }

    // Check for vulnerable dependencies
    try {
      const auditResult = execSync('npm audit --json', {
        cwd: this.templatePath,
        encoding: 'utf-8'
      });
      const audit = JSON.parse(auditResult);
      const hasVulnerabilities = audit.metadata?.vulnerabilities?.high > 0 ||
                                  audit.metadata?.vulnerabilities?.critical > 0;

      checks.push({
        name: 'No critical vulnerabilities',
        passed: !hasVulnerabilities,
        message: hasVulnerabilities ? '✗ Critical vulnerabilities found' : '✓ No critical vulnerabilities'
      });

      if (hasVulnerabilities) {
        this.errors.push({
          code: 'VULNERABLE_DEPS',
          message: 'Template has dependencies with critical vulnerabilities',
          severity: 'critical'
        });
      }
    } catch (error) {
      // npm audit failed, skip this check
    }

    this.categories.push({
      name: 'Security',
      passed: checks.every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate code quality
   */
  private async validateQuality(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // TypeScript compilation
    try {
      execSync('npx tsc --noEmit', {
        cwd: this.templatePath,
        encoding: 'utf-8'
      });
      checks.push({
        name: 'TypeScript compiles',
        passed: true,
        message: '✓ TypeScript compilation successful'
      });
    } catch (error) {
      checks.push({
        name: 'TypeScript compiles',
        passed: false,
        message: '✗ TypeScript compilation failed'
      });
      this.errors.push({
        code: 'TS_COMPILE_ERROR',
        message: 'TypeScript compilation failed',
        severity: 'error'
      });
    }

    // ESLint check
    try {
      execSync('npx eslint . --ext .ts,.tsx --max-warnings 0', {
        cwd: this.templatePath,
        encoding: 'utf-8'
      });
      checks.push({
        name: 'No ESLint errors',
        passed: true,
        message: '✓ No ESLint errors'
      });
    } catch (error) {
      checks.push({
        name: 'No ESLint errors',
        passed: false,
        message: '✗ ESLint errors found'
      });
      this.warnings.push({
        code: 'ESLINT_ERRORS',
        message: 'ESLint found errors in the code',
        suggestion: 'Run "npm run lint" to see details'
      });
    }

    // Check for console.log statements
    const files = this.getAllFiles(this.templatePath);
    let hasConsoleLogs = false;
    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      if (file.includes('node_modules')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (/console\.log\(/.test(content)) {
        hasConsoleLogs = true;
        this.warnings.push({
          code: 'CONSOLE_LOG',
          message: 'console.log found',
          file: path.relative(this.templatePath, file),
          suggestion: 'Remove console.log statements before publishing'
        });
      }
    }

    checks.push({
      name: 'No console.log statements',
      passed: !hasConsoleLogs,
      message: hasConsoleLogs ? '⚠ console.log statements found' : '✓ No console.log statements'
    });

    // Check for tests
    const hasTests = fs.existsSync(path.join(this.templatePath, 'tests')) ||
                     files.some(f => f.includes('.test.') || f.includes('.spec.'));

    checks.push({
      name: 'Has tests',
      passed: hasTests,
      message: hasTests ? '✓ Tests found' : '⚠ No tests found'
    });

    if (!hasTests) {
      this.warnings.push({
        code: 'NO_TESTS',
        message: 'No tests found in template',
        suggestion: 'Add tests to improve template quality'
      });
    }

    this.categories.push({
      name: 'Quality',
      passed: checks.filter(c => c.name !== 'Has tests' && c.name !== 'No console.log statements').every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate documentation
   */
  private async validateDocumentation(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // README.md exists and has content
    const readmePath = path.join(this.templatePath, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf-8');

      // Check for required sections
      const requiredSections = ['# ', '## Getting Started', '## Installation'];
      for (const section of requiredSections) {
        const hasSection = readme.includes(section);
        checks.push({
          name: `README has "${section}" section`,
          passed: hasSection,
          message: hasSection ? `✓ "${section}" found` : `✗ "${section}" missing`
        });
      }

      // Check minimum length
      const hasMinLength = readme.length > 500;
      checks.push({
        name: 'README has sufficient content',
        passed: hasMinLength,
        message: hasMinLength ? '✓ README has sufficient content' : '✗ README too short'
      });

      if (!hasMinLength) {
        this.warnings.push({
          code: 'SHORT_README',
          message: 'README.md is too short',
          suggestion: 'Add more documentation to help users understand the template'
        });
      }
    }

    // Check for docs folder
    const docsPath = path.join(this.templatePath, 'docs');
    const hasDocs = fs.existsSync(docsPath) && fs.readdirSync(docsPath).length > 0;

    checks.push({
      name: 'Has documentation folder',
      passed: hasDocs,
      message: hasDocs ? '✓ docs/ folder found' : '⚠ No docs/ folder'
    });

    // Check for inline comments
    const files = this.getAllFiles(this.templatePath);
    let totalLines = 0;
    let commentLines = 0;

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      if (file.includes('node_modules')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      totalLines += lines.length;
      commentLines += lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*') || l.trim().startsWith('*')).length;
    }

    const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
    const hasGoodComments = commentRatio > 0.05; // At least 5% comments

    checks.push({
      name: 'Has inline comments',
      passed: hasGoodComments,
      message: hasGoodComments ? '✓ Good comment coverage' : '⚠ Low comment coverage'
    });

    this.categories.push({
      name: 'Documentation',
      passed: checks.filter(c => !c.name.includes('inline')).every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate performance
   */
  private async validatePerformance(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // Check bundle size (if build exists)
    try {
      execSync('npm run build', {
        cwd: this.templatePath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const distPath = path.join(this.templatePath, 'dist');
      if (fs.existsSync(distPath)) {
        const bundleSize = this.getDirectorySize(distPath);
        const maxSize = 5 * 1024 * 1024; // 5MB

        checks.push({
          name: 'Bundle size < 5MB',
          passed: bundleSize < maxSize,
          message: bundleSize < maxSize
            ? `✓ Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)}MB`
            : `✗ Bundle size too large: ${(bundleSize / 1024 / 1024).toFixed(2)}MB`
        });

        if (bundleSize >= maxSize) {
          this.warnings.push({
            code: 'LARGE_BUNDLE',
            message: 'Bundle size exceeds 5MB',
            suggestion: 'Consider code splitting or removing unused dependencies'
          });
        }
      }
    } catch (error) {
      // Build failed, skip performance checks
    }

    // Check for large dependencies
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.templatePath, 'package.json'), 'utf-8')
    );
    const deps = Object.keys(packageJson.dependencies || {});
    const largeDeps = ['moment', 'lodash', 'jquery'];
    const hasLargeDeps = deps.some(d => largeDeps.includes(d));

    checks.push({
      name: 'No unnecessarily large dependencies',
      passed: !hasLargeDeps,
      message: hasLargeDeps
        ? '⚠ Large dependencies found (consider alternatives)'
        : '✓ No unnecessarily large dependencies'
    });

    if (hasLargeDeps) {
      this.warnings.push({
        code: 'LARGE_DEPS',
        message: 'Template uses large dependencies',
        suggestion: 'Consider using lighter alternatives (date-fns instead of moment, etc.)'
      });
    }

    this.categories.push({
      name: 'Performance',
      passed: checks.every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate accessibility
   */
  private async validateAccessibility(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // Check for alt attributes on images
    const files = this.getAllFiles(this.templatePath);
    let hasImagesWithoutAlt = false;

    for (const file of files) {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) continue;
      if (file.includes('node_modules')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const imgWithoutAlt = /<img[^>]*(?!alt=)[^>]*>/g;
      if (imgWithoutAlt.test(content)) {
        hasImagesWithoutAlt = true;
      }
    }

    checks.push({
      name: 'Images have alt attributes',
      passed: !hasImagesWithoutAlt,
      message: hasImagesWithoutAlt
        ? '⚠ Some images missing alt attributes'
        : '✓ All images have alt attributes'
    });

    // Check for semantic HTML
    let usesSemanticHtml = false;
    const semanticTags = ['<header', '<nav', '<main', '<footer', '<article', '<section'];

    for (const file of files) {
      if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) continue;
      if (file.includes('node_modules')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (semanticTags.some(tag => content.includes(tag))) {
        usesSemanticHtml = true;
        break;
      }
    }

    checks.push({
      name: 'Uses semantic HTML',
      passed: usesSemanticHtml,
      message: usesSemanticHtml
        ? '✓ Uses semantic HTML elements'
        : '⚠ Consider using semantic HTML elements'
    });

    this.categories.push({
      name: 'Accessibility',
      passed: checks.every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Validate compliance
   */
  private async validateCompliance(): Promise<void> {
    const checks: ValidationCheck[] = [];

    // Check for LICENSE file
    const hasLicense = fs.existsSync(path.join(this.templatePath, 'LICENSE'));
    checks.push({
      name: 'Has LICENSE file',
      passed: hasLicense,
      message: hasLicense ? '✓ LICENSE file found' : '✗ LICENSE file missing'
    });

    if (!hasLicense) {
      this.errors.push({
        code: 'NO_LICENSE',
        message: 'LICENSE file is required',
        severity: 'error'
      });
    }

    // Check for privacy policy mention (if applicable)
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.templatePath, 'package.json'), 'utf-8')
    );
    const hasAnalytics = Object.keys(packageJson.dependencies || {}).some(
      d => d.includes('analytics') || d.includes('tracking')
    );

    if (hasAnalytics) {
      const readme = fs.readFileSync(path.join(this.templatePath, 'README.md'), 'utf-8');
      const mentionsPrivacy = readme.toLowerCase().includes('privacy');

      checks.push({
        name: 'Privacy policy mentioned',
        passed: mentionsPrivacy,
        message: mentionsPrivacy
          ? '✓ Privacy policy mentioned'
          : '⚠ Template uses analytics but no privacy policy mentioned'
      });
    }

    this.categories.push({
      name: 'Compliance',
      passed: checks.every(c => c.passed),
      score: checks.filter(c => c.passed).length / checks.length * 100,
      checks
    });
  }

  /**
   * Calculate overall score
   */
  private calculateScore(): number {
    const weights = {
      'Structure': 15,
      'Configuration': 15,
      'Security': 25,
      'Quality': 20,
      'Documentation': 10,
      'Performance': 5,
      'Accessibility': 5,
      'Compliance': 5
    };

    let totalWeight = 0;
    let weightedScore = 0;

    for (const category of this.categories) {
      const weight = weights[category.name as keyof typeof weights] || 10;
      totalWeight += weight;
      weightedScore += category.score * weight;
    }

    return Math.round(weightedScore / totalWeight);
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(): string[] {
    const suggestions: string[] = [];

    for (const category of this.categories) {
      if (category.score < 80) {
        suggestions.push(`Improve ${category.name}: ${category.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`);
      }
    }

    return suggestions;
  }

  /**
   * Get all files in directory
   */
  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.getAllFiles(fullPath));
        }
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Get directory size
   */
  private getDirectorySize(dir: string): number {
    let size = 0;
    const files = this.getAllFiles(dir);

    for (const file of files) {
      size += fs.statSync(file).size;
    }

    return size;
  }
}
```

### 3.2 Review Process

```typescript
/**
 * Template review and approval workflow
 */

interface ReviewSubmission {
  id: string;
  templateId: string;
  authorId: string;
  version: string;
  packageUrl: string;
  validationResult: ValidationResult;
  status: ReviewStatus;
  reviewer?: string;
  reviewNotes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

type ReviewStatus = 
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'needs_changes';

interface ReviewCriteria {
  category: string;
  weight: number;
  checks: ReviewCheck[];
}

interface ReviewCheck {
  name: string;
  description: string;
  automated: boolean;
  required: boolean;
}

const reviewCriteria: ReviewCriteria[] = [
  {
    category: 'Functionality',
    weight: 30,
    checks: [
      { name: 'Template installs successfully', description: 'npm install completes without errors', automated: true, required: true },
      { name: 'Dev server starts', description: 'npm run dev starts without errors', automated: true, required: true },
      { name: 'Build succeeds', description: 'npm run build completes successfully', automated: true, required: true },
      { name: 'Core features work', description: 'Main features function as described', automated: false, required: true }
    ]
  },
  {
    category: 'Security',
    weight: 25,
    checks: [
      { name: 'No hardcoded secrets', description: 'No API keys or passwords in code', automated: true, required: true },
      { name: 'No critical vulnerabilities', description: 'npm audit shows no critical issues', automated: true, required: true },
      { name: 'Proper input validation', description: 'User inputs are properly validated', automated: false, required: true },
      { name: 'Secure authentication', description: 'Auth implementation follows best practices', automated: false, required: false }
    ]
  },
  {
    category: 'Quality',
    weight: 20,
    checks: [
      { name: 'TypeScript compiles', description: 'No TypeScript errors', automated: true, required: true },
      { name: 'No linting errors', description: 'ESLint passes', automated: true, required: true },
      { name: 'Code is readable', description: 'Code follows best practices', automated: false, required: true },
      { name: 'Has tests', description: 'Includes unit tests', automated: true, required: false }
    ]
  },
  {
    category: 'Documentation',
    weight: 15,
    checks: [
      { name: 'README is complete', description: 'README explains setup and usage', automated: true, required: true },
      { name: 'API is documented', description: 'API endpoints are documented', automated: false, required: false },
      { name: 'Code is commented', description: 'Complex code has comments', automated: true, required: false }
    ]
  },
  {
    category: 'User Experience',
    weight: 10,
    checks: [
      { name: 'Responsive design', description: 'Works on mobile and desktop', automated: false, required: true },
      { name: 'Accessible', description: 'Follows accessibility guidelines', automated: true, required: false },
      { name: 'Good performance', description: 'Loads quickly', automated: true, required: false }
    ]
  }
];

class ReviewManager {
  /**
   * Submit template for review
   */
  async submitForReview(
    templateId: string,
    authorId: string,
    packageUrl: string
  ): Promise<ReviewSubmission> {
    // Run automated validation
    const validator = new TemplateValidator(packageUrl);
    const validationResult = await validator.validate();

    // Check if validation passed
    if (!validationResult.passed) {
      throw new Error('Template failed validation. Fix errors before submitting.');
    }

    // Check minimum score
    if (validationResult.score < 60) {
      throw new Error(`Template score (${validationResult.score}) is below minimum (60)`);
    }

    // Create submission
    const submission: ReviewSubmission = {
      id: `review_${Date.now()}`,
      templateId,
      authorId,
      version: '1.0.0',
      packageUrl,
      validationResult,
      status: 'pending',
      submittedAt: new Date()
    };

    // Save to database
    await this.saveSubmission(submission);

    // Notify reviewers
    await this.notifyReviewers(submission);

    return submission;
  }

  /**
   * Start review
   */
  async startReview(submissionId: string, reviewerId: string): Promise<void> {
    await this.updateSubmission(submissionId, {
      status: 'in_review',
      reviewer: reviewerId
    });
  }

  /**
   * Complete review
   */
  async completeReview(
    submissionId: string,
    decision: 'approved' | 'rejected' | 'needs_changes',
    notes: string
  ): Promise<void> {
    const submission = await this.getSubmission(submissionId);

    await this.updateSubmission(submissionId, {
      status: decision,
      reviewNotes: notes,
      reviewedAt: new Date()
    });

    // Notify author
    await this.notifyAuthor(submission, decision, notes);

    // If approved, publish template
    if (decision === 'approved') {
      await this.publishTemplate(submission.templateId);
    }
  }

  /**
   * Get review queue
   */
  async getReviewQueue(): Promise<ReviewSubmission[]> {
    // Query database for pending reviews
    return [];
  }

  private async saveSubmission(submission: ReviewSubmission): Promise<void> {
    // Save to database
  }

  private async updateSubmission(id: string, updates: Partial<ReviewSubmission>): Promise<void> {
    // Update in database
  }

  private async getSubmission(id: string): Promise<ReviewSubmission> {
    // Get from database
    return {} as ReviewSubmission;
  }

  private async notifyReviewers(submission: ReviewSubmission): Promise<void> {
    // Send notification to review team
  }

  private async notifyAuthor(
    submission: ReviewSubmission,
    decision: string,
    notes: string
  ): Promise<void> {
    // Send notification to author
  }

  private async publishTemplate(templateId: string): Promise<void> {
    // Update template status to published
  }
}
```

---

## 4. Summary

### Template Authoring Checklist

- ✅ Initialize template with SDK
- ✅ Implement core features
- ✅ Add components and pages
- ✅ Configure environment variables
- ✅ Write comprehensive documentation
- ✅ Add tests
- ✅ Run validation
- ✅ Fix all errors and warnings
- ✅ Submit for review
- ✅ Address reviewer feedback
- ✅ Publish to marketplace

### Validation Requirements

| Category | Weight | Minimum Score |
|----------|--------|---------------|
| Structure | 15% | 100% |
| Configuration | 15% | 100% |
| Security | 25% | 100% |
| Quality | 20% | 80% |
| Documentation | 10% | 80% |
| Performance | 5% | 60% |
| Accessibility | 5% | 60% |
| Compliance | 5% | 100% |

### Marketplace Features

- ✅ Template discovery and search
- ✅ Categories and tags
- ✅ Ratings and reviews
- ✅ Download statistics
- ✅ Revenue sharing (70/30)
- ✅ Author dashboard
- ✅ Payout management

This comprehensive system enables users to create, validate, and monetize custom templates while maintaining quality and security standards!
