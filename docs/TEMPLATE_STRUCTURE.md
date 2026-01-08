# Template Structure: Directory Layout, Required Files, and Configuration

## Overview

This guide covers the complete structure of templates in the agentic platform, including:

- **Directory Layout** - Folder organization
- **Required Files** - Essential configuration and code files
- **Environment Variables** - Configuration and secrets
- **Post-Install Scripts** - Initialization and setup
- **File Naming Conventions** - Consistent naming patterns
- **Template Metadata** - Template definition and configuration

---

## 1. Template Directory Layout

### 1.1 Web-Static Template Structure

```
web-static/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # GitHub Actions CI/CD
│   │   └── deploy.yml              # Deployment workflow
│   └── ISSUE_TEMPLATE/
│       └── bug_report.md
├── .gitignore                       # Git ignore rules
├── .env.example                     # Environment variables template
├── .prettierrc                      # Code formatting config
├── .eslintrc.json                   # Linting config
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── postcss.config.js                # PostCSS configuration
├── README.md                        # Project documentation
├── LICENSE                          # License file
├── client/
│   ├── public/
│   │   ├── favicon.ico              # Favicon
│   │   ├── robots.txt               # SEO robots file
│   │   ├── sitemap.xml              # SEO sitemap
│   │   ├── manifest.json            # PWA manifest
│   │   ├── logo.svg                 # Logo asset
│   │   └── [other-assets]/          # Images, fonts, etc.
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Home page
│   │   │   ├── About.tsx            # About page
│   │   │   ├── Features.tsx         # Features page
│   │   │   ├── Pricing.tsx          # Pricing page
│   │   │   ├── Contact.tsx          # Contact page
│   │   │   ├── Blog.tsx             # Blog page
│   │   │   └── NotFound.tsx         # 404 page
│   │   ├── components/
│   │   │   ├── Header.tsx           # Header component
│   │   │   ├── Footer.tsx           # Footer component
│   │   │   ├── Hero.tsx             # Hero section
│   │   │   ├── FeatureCard.tsx      # Feature card
│   │   │   ├── TestimonialCard.tsx  # Testimonial
│   │   │   ├── PricingCard.tsx      # Pricing card
│   │   │   ├── ContactForm.tsx      # Contact form
│   │   │   ├── Newsletter.tsx       # Newsletter signup
│   │   │   └── ui/
│   │   │       ├── button.tsx       # Button component
│   │   │       ├── card.tsx         # Card component
│   │   │       ├── input.tsx        # Input component
│   │   │       ├── textarea.tsx     # Textarea component
│   │   │       └── [other-ui]/      # Other UI components
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx     # Theme context
│   │   ├── hooks/
│   │   │   ├── useTheme.ts          # Theme hook
│   │   │   └── useScroll.ts         # Scroll hook
│   │   ├── lib/
│   │   │   ├── utils.ts             # Utility functions
│   │   │   └── constants.ts         # Constants
│   │   ├── App.tsx                  # Main app component
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Global styles
│   └── index.html                   # HTML template
├── docs/
│   ├── SETUP.md                     # Setup guide
│   ├── DEPLOYMENT.md                # Deployment guide
│   ├── CUSTOMIZATION.md             # Customization guide
│   └── FAQ.md                       # FAQ
└── scripts/
    ├── setup.js                     # Setup script
    ├── build.js                     # Build script
    └── deploy.js                    # Deploy script
```

### 1.2 Web-DB-User Template Structure

```
web-db-user/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # GitHub Actions CI/CD
│   │   ├── deploy.yml              # Deployment workflow
│   │   └── test.yml                # Test workflow
│   └── ISSUE_TEMPLATE/
├── .gitignore
├── .env.example
├── .prettierrc
├── .eslintrc.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts                 # Vitest configuration
├── README.md
├── LICENSE
├── client/
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── robots.txt
│   │   ├── sitemap.xml
│   │   ├── manifest.json
│   │   └── [assets]/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── NotFound.tsx
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx  # Dashboard layout
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── Form.tsx
│   │   │   └── ui/
│   │   ├── contexts/
│   │   │   ├── ThemeContext.tsx
│   │   │   └── AuthContext.tsx
│   │   ├── hooks/
│   │   │   ├── useTheme.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useApi.ts
│   │   ├── lib/
│   │   │   ├── trpc.ts              # tRPC client
│   │   │   ├── utils.ts
│   │   │   └── constants.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   └── index.html
├── server/
│   ├── _core/
│   │   ├── index.ts                 # Server entry point
│   │   ├── context.ts               # tRPC context
│   │   ├── trpc.ts                  # tRPC setup
│   │   ├── env.ts                   # Environment variables
│   │   ├── cookies.ts               # Cookie handling
│   │   ├── llm.ts                   # LLM integration
│   │   ├── storage.ts               # File storage
│   │   ├── notification.ts          # Notifications
│   │   ├── voiceTranscription.ts    # Voice transcription
│   │   ├── imageGeneration.ts       # Image generation
│   │   ├── map.ts                   # Maps integration
│   │   └── systemRouter.ts          # System routes
│   ├── routers/
│   │   ├── index.ts                 # Router exports
│   │   ├── auth.ts                  # Auth routes
│   │   ├── users.ts                 # User routes
│   │   └── [feature].ts             # Feature routes
│   ├── db.ts                        # Database helpers
│   ├── routers.ts                   # Main routers file
│   └── index.ts                     # Server entry
├── drizzle/
│   ├── schema.ts                    # Database schema
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   └── [other-migrations]/
│   └── drizzle.config.ts            # Drizzle configuration
├── storage/
│   └── index.ts                     # S3 storage helpers
├── shared/
│   ├── const.ts                     # Shared constants
│   ├── types.ts                     # Shared types
│   └── utils.ts                     # Shared utilities
├── tests/
│   ├── server/
│   │   ├── auth.test.ts
│   │   ├── users.test.ts
│   │   └── [feature].test.ts
│   └── client/
│       ├── components/
│       └── pages/
├── docs/
│   ├── SETUP.md
│   ├── DEPLOYMENT.md
│   ├── DATABASE.md
│   ├── API.md
│   └── CUSTOMIZATION.md
└── scripts/
    ├── setup.js
    ├── seed-db.mjs
    └── migrate.mjs
```

### 1.3 Web-AI-Agent Template Structure

```
web-ai-agent/
├── [Same as web-db-user, plus:]
├── server/
│   ├── routers/
│   │   ├── ai.ts                    # AI routes
│   │   ├── chat.ts                  # Chat routes
│   │   ├── conversations.ts         # Conversation routes
│   │   └── [other-routes]/
│   ├── services/
│   │   ├── llm/
│   │   │   ├── providers.ts         # LLM providers
│   │   │   ├── router.ts            # LLM router
│   │   │   └── streaming.ts         # Streaming support
│   │   ├── chat.ts                  # Chat service
│   │   ├── conversation.ts          # Conversation service
│   │   └── [other-services]/
│   └── _core/
│       ├── llm.ts                   # Enhanced LLM integration
│       ├── streaming.ts             # Streaming utilities
│       └── [other-core]/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AIChatBox.tsx        # Chat interface
│   │   │   ├── MessageList.tsx      # Message list
│   │   │   ├── SettingsPanel.tsx    # Settings
│   │   │   └── StreamingResponse.tsx # Streaming display
│   │   ├── pages/
│   │   │   ├── Chat.tsx
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx
│   │   └── [other-client]/
├── docs/
│   ├── LLM_SETUP.md                 # LLM configuration
│   ├── STREAMING.md                 # Streaming guide
│   ├── COST_TRACKING.md             # Cost tracking guide
│   └── [other-docs]/
└── [other-files]/
```

### 1.4 Mobile-App Template Structure

```
mobile-app/
├── .github/
│   └── workflows/
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
├── app.json                         # Expo configuration
├── eas.json                         # EAS Build configuration
├── babel.config.js                  # Babel configuration
├── README.md
├── LICENSE
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx                # Home tab
│   │   ├── explore.tsx              # Explore tab
│   │   └── profile.tsx              # Profile tab
│   ├── (auth)/
│   │   ├── login.tsx                # Login screen
│   │   ├── signup.tsx               # Signup screen
│   │   └── reset-password.tsx       # Password reset
│   ├── _layout.tsx                  # Root layout
│   └── +not-found.tsx               # 404 screen
├── components/
│   ├── ThemedText.tsx               # Themed text
│   ├── ThemedView.tsx               # Themed view
│   ├── TabBar.tsx                   # Tab bar
│   └── [other-components]/
├── hooks/
│   ├── useThemeColor.ts
│   ├── useAuth.ts
│   └── [other-hooks]/
├── constants/
│   ├── Colors.ts
│   ├── Layout.ts
│   └── [other-constants]/
├── services/
│   ├── api.ts                       # API service
│   ├── auth.ts                      # Auth service
│   └── [other-services]/
├── types/
│   └── index.ts
├── assets/
│   ├── images/
│   ├── fonts/
│   └── [other-assets]/
├── tests/
│   ├── screens/
│   └── components/
├── docs/
│   ├── SETUP.md
│   ├── DEPLOYMENT.md
│   └── [other-docs]/
└── scripts/
    ├── setup.js
    └── build.js
```

---

## 2. Required Files for Each Template

### 2.1 Core Files (All Templates)

```typescript
/**
 * Required files present in ALL templates
 */

const requiredCoreFiles = {
  // Configuration
  'package.json': {
    description: 'Node.js dependencies and scripts',
    required: true,
    example: 'package.json'
  },
  'tsconfig.json': {
    description: 'TypeScript configuration',
    required: true,
    example: 'tsconfig.json'
  },
  '.gitignore': {
    description: 'Git ignore rules',
    required: true,
    example: '.gitignore'
  },
  '.env.example': {
    description: 'Environment variables template',
    required: true,
    example: '.env.example'
  },
  'README.md': {
    description: 'Project documentation',
    required: true,
    example: 'README.md'
  },
  'LICENSE': {
    description: 'License file (MIT)',
    required: true,
    example: 'LICENSE'
  },

  // Code formatting
  '.prettierrc': {
    description: 'Prettier configuration',
    required: true,
    example: '.prettierrc'
  },
  '.eslintrc.json': {
    description: 'ESLint configuration',
    required: true,
    example: '.eslintrc.json'
  },

  // CI/CD
  '.github/workflows/ci.yml': {
    description: 'GitHub Actions CI workflow',
    required: true,
    example: '.github/workflows/ci.yml'
  }
};

/**
 * Template-specific required files
 */

const templateSpecificFiles = {
  'web-static': {
    'vite.config.ts': 'Vite build configuration',
    'tailwind.config.ts': 'Tailwind CSS configuration',
    'postcss.config.js': 'PostCSS configuration',
    'client/index.html': 'HTML entry point',
    'client/src/main.tsx': 'React entry point',
    'client/src/App.tsx': 'Main app component'
  },

  'web-db-user': {
    'vite.config.ts': 'Vite build configuration',
    'tailwind.config.ts': 'Tailwind CSS configuration',
    'postcss.config.js': 'PostCSS configuration',
    'vitest.config.ts': 'Vitest configuration',
    'client/index.html': 'HTML entry point',
    'client/src/main.tsx': 'React entry point',
    'client/src/App.tsx': 'Main app component',
    'client/src/lib/trpc.ts': 'tRPC client setup',
    'server/_core/index.ts': 'Express server entry',
    'server/_core/trpc.ts': 'tRPC setup',
    'server/_core/context.ts': 'tRPC context',
    'server/routers.ts': 'tRPC routers',
    'server/db.ts': 'Database helpers',
    'drizzle/schema.ts': 'Database schema',
    'drizzle/drizzle.config.ts': 'Drizzle configuration'
  },

  'web-ai-agent': {
    // All web-db-user files, plus:
    'server/services/llm/providers.ts': 'LLM providers',
    'server/services/llm/router.ts': 'LLM router',
    'server/services/chat.ts': 'Chat service',
    'client/src/components/AIChatBox.tsx': 'Chat component'
  },

  'mobile-app': {
    'app.json': 'Expo configuration',
    'eas.json': 'EAS Build configuration',
    'babel.config.js': 'Babel configuration',
    'app/_layout.tsx': 'Root layout',
    'app/(tabs)/index.tsx': 'Home screen',
    'components/ThemedText.tsx': 'Themed text component',
    'components/ThemedView.tsx': 'Themed view component'
  },

  'data-pipeline': {
    'package.json': 'Dependencies',
    'tsconfig.json': 'TypeScript config',
    'src/jobs/index.ts': 'Job definitions',
    'src/workers/index.ts': 'Worker setup',
    'src/services/index.ts': 'Services',
    'src/config/index.ts': 'Configuration'
  },

  'api-service': {
    'package.json': 'Dependencies',
    'tsconfig.json': 'TypeScript config',
    'src/server.ts': 'Express server',
    'src/routes/index.ts': 'API routes',
    'src/middleware/index.ts': 'Middleware',
    'src/swagger.ts': 'Swagger/OpenAPI config'
  },

  'dashboard': {
    'vite.config.ts': 'Vite configuration',
    'tailwind.config.ts': 'Tailwind CSS',
    'client/src/main.tsx': 'React entry',
    'client/src/App.tsx': 'Main app',
    'client/src/lib/trpc.ts': 'tRPC client',
    'server/_core/index.ts': 'Express server'
  }
};
```

### 2.2 File Descriptions

```typescript
/**
 * Detailed file descriptions and purposes
 */

interface FileDescription {
  path: string;
  purpose: string;
  required: boolean;
  template: string[];
  example: string;
}

const fileDescriptions: FileDescription[] = [
  {
    path: 'package.json',
    purpose: 'Node.js project metadata, dependencies, and npm scripts',
    required: true,
    template: ['all'],
    example: `{
  "name": "web-static",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}`
  },

  {
    path: 'tsconfig.json',
    purpose: 'TypeScript compiler configuration',
    required: true,
    template: ['all'],
    example: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/src/*"]
    }
  }
}`
  },

  {
    path: '.env.example',
    purpose: 'Template for environment variables (no secrets)',
    required: true,
    template: ['all'],
    example: `# Application
VITE_APP_TITLE=My App
VITE_APP_LOGO=/logo.svg

# Backend
VITE_API_URL=http://localhost:3000
DATABASE_URL=mysql://user:pass@localhost/db

# LLM (if applicable)
OPENAI_API_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...`
  },

  {
    path: 'vite.config.ts',
    purpose: 'Vite build tool configuration',
    required: true,
    template: ['web-static', 'web-db-user', 'web-ai-agent', 'dashboard'],
    example: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})`
  },

  {
    path: 'tailwind.config.ts',
    purpose: 'Tailwind CSS configuration',
    required: true,
    template: ['web-static', 'web-db-user', 'web-ai-agent', 'dashboard', 'mobile-app'],
    example: `import type { Config } from 'tailwindcss'

export default {
  content: ['./client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6'
      }
    }
  },
  plugins: []
} satisfies Config`
  },

  {
    path: 'server/_core/index.ts',
    purpose: 'Express server entry point and middleware setup',
    required: true,
    template: ['web-db-user', 'web-ai-agent', 'api-service', 'dashboard'],
    example: `import express from 'express'
import cors from 'cors'
import { appRouter } from '../routers'
import { createExpressMiddleware } from '@trpc/server/adapters/express'

const app = express()

app.use(cors())
app.use(express.json())

app.use(
  '/api/trpc',
  createExpressMiddleware({ router: appRouter })
)

app.listen(3000, () => {
  console.log('Server running on port 3000')
})`
  },

  {
    path: 'drizzle/schema.ts',
    purpose: 'Database table definitions using Drizzle ORM',
    required: true,
    template: ['web-db-user', 'web-ai-agent', 'dashboard'],
    example: `import { int, varchar, mysqlTable, timestamp } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow()
})`
  },

  {
    path: 'client/src/lib/trpc.ts',
    purpose: 'tRPC client setup and configuration',
    required: true,
    template: ['web-db-user', 'web-ai-agent', 'dashboard'],
    example: `import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../../../server/routers'

export const trpc = createTRPCReact<AppRouter>()`
  },

  {
    path: 'README.md',
    purpose: 'Project documentation and setup instructions',
    required: true,
    template: ['all'],
    example: `# Project Name

Description of the project.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation
\`\`\`bash
npm install
npm run dev
\`\`\`

### Environment Variables
Copy \`.env.example\` to \`.env\` and update values.

## Deployment
See docs/DEPLOYMENT.md`
  }
];
```

---

## 3. Environment Variables

### 3.1 Environment Variable Categories

```typescript
/**
 * Environment variable categories and definitions
 */

interface EnvironmentVariable {
  name: string;
  category: EnvCategory;
  required: boolean;
  description: string;
  example: string;
  templates: string[];
  scope: 'client' | 'server' | 'both';
}

type EnvCategory = 
  | 'application'
  | 'backend'
  | 'database'
  | 'authentication'
  | 'llm'
  | 'storage'
  | 'external-api'
  | 'monitoring';

const environmentVariables: EnvironmentVariable[] = [
  // Application
  {
    name: 'VITE_APP_TITLE',
    category: 'application',
    required: true,
    description: 'Application name displayed in UI',
    example: 'My Awesome App',
    templates: ['all'],
    scope: 'client'
  },
  {
    name: 'VITE_APP_LOGO',
    category: 'application',
    required: false,
    description: 'URL to application logo',
    example: '/logo.svg',
    templates: ['all'],
    scope: 'client'
  },
  {
    name: 'NODE_ENV',
    category: 'application',
    required: true,
    description: 'Environment: development, staging, or production',
    example: 'development',
    templates: ['all'],
    scope: 'both'
  },

  // Backend
  {
    name: 'VITE_API_URL',
    category: 'backend',
    required: true,
    description: 'Backend API URL (client-side)',
    example: 'http://localhost:3000',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'client'
  },
  {
    name: 'VITE_BACKEND_URL',
    category: 'backend',
    required: false,
    description: 'Backend URL for server-side requests',
    example: 'http://localhost:3000',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'server'
  },

  // Database
  {
    name: 'DATABASE_URL',
    category: 'database',
    required: true,
    description: 'Database connection string',
    example: 'mysql://user:password@localhost:3306/dbname',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard', 'data-pipeline'],
    scope: 'server'
  },

  // Authentication
  {
    name: 'JWT_SECRET',
    category: 'authentication',
    required: true,
    description: 'Secret key for JWT token signing',
    example: 'your-secret-key-min-32-chars-long',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard', 'api-service'],
    scope: 'server'
  },
  {
    name: 'OAUTH_SERVER_URL',
    category: 'authentication',
    required: false,
    description: 'OAuth server URL',
    example: 'https://auth.example.com',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'server'
  },

  // LLM
  {
    name: 'OPENAI_API_KEY',
    category: 'llm',
    required: false,
    description: 'OpenAI API key',
    example: 'sk-...',
    templates: ['web-ai-agent'],
    scope: 'server'
  },
  {
    name: 'ANTHROPIC_API_KEY',
    category: 'llm',
    required: false,
    description: 'Anthropic API key',
    example: 'sk-ant-...',
    templates: ['web-ai-agent'],
    scope: 'server'
  },
  {
    name: 'GOOGLE_API_KEY',
    category: 'llm',
    required: false,
    description: 'Google API key',
    example: 'AIza...',
    templates: ['web-ai-agent'],
    scope: 'server'
  },

  // Storage
  {
    name: 'AWS_ACCESS_KEY_ID',
    category: 'storage',
    required: false,
    description: 'AWS access key for S3',
    example: 'AKIA...',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'server'
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    category: 'storage',
    required: false,
    description: 'AWS secret key for S3',
    example: '...',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'server'
  },

  // External APIs
  {
    name: 'STRIPE_API_KEY',
    category: 'external-api',
    required: false,
    description: 'Stripe API key for payments',
    example: 'sk_test_...',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'server'
  },
  {
    name: 'SENDGRID_API_KEY',
    category: 'external-api',
    required: false,
    description: 'SendGrid API key for emails',
    example: 'SG...',
    templates: ['web-db-user', 'web-ai-agent', 'dashboard'],
    scope: 'server'
  }
];

/**
 * Generate .env.example file
 */
function generateEnvExample(templates: string[]): string {
  const vars = environmentVariables.filter(v => 
    v.templates.some(t => templates.includes(t) || t === 'all')
  );

  let content = '# Environment Variables\n\n';

  // Group by category
  const byCategory = vars.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, EnvironmentVariable[]>);

  for (const [category, vars] of Object.entries(byCategory)) {
    content += `# ${category.toUpperCase()}\n`;
    for (const v of vars) {
      content += `# ${v.description}\n`;
      content += `${v.name}=${v.example}\n\n`;
    }
  }

  return content;
}
```

### 3.2 Environment Variable Validation

```typescript
/**
 * Validate environment variables at startup
 */

interface EnvValidationSchema {
  [key: string]: {
    required: boolean;
    type: 'string' | 'number' | 'boolean' | 'url';
    validate?: (value: string) => boolean;
  };
}

const envValidationSchema: EnvValidationSchema = {
  'NODE_ENV': {
    required: true,
    type: 'string',
    validate: (v) => ['development', 'staging', 'production'].includes(v)
  },
  'DATABASE_URL': {
    required: true,
    type: 'url',
    validate: (v) => v.startsWith('mysql://') || v.startsWith('postgresql://')
  },
  'JWT_SECRET': {
    required: true,
    type: 'string',
    validate: (v) => v.length >= 32
  },
  'OPENAI_API_KEY': {
    required: false,
    type: 'string',
    validate: (v) => v.startsWith('sk-')
  }
};

class EnvValidator {
  /**
   * Validate environment variables
   */
  static validate(schema: EnvValidationSchema): void {
    const errors: string[] = [];

    for (const [key, config] of Object.entries(schema)) {
      const value = process.env[key];

      // Check if required
      if (config.required && !value) {
        errors.push(`Missing required environment variable: ${key}`);
        continue;
      }

      if (!value) continue;

      // Validate type
      switch (config.type) {
        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push(`Invalid URL for ${key}: ${value}`);
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`Invalid number for ${key}: ${value}`);
          }
          break;
      }

      // Custom validation
      if (config.validate && !config.validate(value)) {
        errors.push(`Invalid value for ${key}: ${value}`);
      }
    }

    if (errors.length > 0) {
      console.error('Environment variable validation failed:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }

    console.log('✅ Environment variables validated');
  }
}
```

---

## 4. Post-Install Scripts

### 4.1 Setup Script

```typescript
/**
 * Post-install setup script
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

interface SetupConfig {
  template: string
  projectName: string
  projectPath: string
}

class TemplateSetup {
  private config: SetupConfig

  constructor(config: SetupConfig) {
    this.config = config
  }

  /**
   * Run complete setup
   */
  async setup(): Promise<void> {
    console.log('🚀 Setting up template...\n')

    try {
      // Step 1: Create .env file
      await this.createEnvFile()

      // Step 2: Install dependencies
      await this.installDependencies()

      // Step 3: Setup database (if applicable)
      if (['web-db-user', 'web-ai-agent', 'dashboard'].includes(this.config.template)) {
        await this.setupDatabase()
      }

      // Step 4: Generate types
      await this.generateTypes()

      // Step 5: Initialize git
      await this.initializeGit()

      console.log('\n✅ Setup complete!')
      console.log('\n📝 Next steps:')
      console.log('  1. Update .env with your configuration')
      console.log('  2. Run: npm run dev')
      console.log('  3. Open: http://localhost:3000')
    } catch (error) {
      console.error('❌ Setup failed:', error)
      process.exit(1)
    }
  }

  /**
   * Create .env file from .env.example
   */
  private async createEnvFile(): Promise<void> {
    console.log('📝 Creating .env file...')

    const envExamplePath = path.join(this.config.projectPath, '.env.example')
    const envPath = path.join(this.config.projectPath, '.env')

    if (!fs.existsSync(envPath)) {
      const content = fs.readFileSync(envExamplePath, 'utf-8')
      fs.writeFileSync(envPath, content)
      console.log('   ✅ .env created')
    } else {
      console.log('   ℹ️  .env already exists')
    }
  }

  /**
   * Install dependencies
   */
  private async installDependencies(): Promise<void> {
    console.log('📦 Installing dependencies...')

    try {
      execSync('npm install', {
        cwd: this.config.projectPath,
        stdio: 'inherit'
      })
      console.log('   ✅ Dependencies installed')
    } catch (error) {
      throw new Error('Failed to install dependencies')
    }
  }

  /**
   * Setup database
   */
  private async setupDatabase(): Promise<void> {
    console.log('🗄️  Setting up database...')

    try {
      execSync('pnpm db:push', {
        cwd: this.config.projectPath,
        stdio: 'inherit'
      })
      console.log('   ✅ Database initialized')
    } catch (error) {
      console.warn('   ⚠️  Database setup failed - update DATABASE_URL in .env')
    }
  }

  /**
   * Generate TypeScript types
   */
  private async generateTypes(): Promise<void> {
    console.log('🔧 Generating types...')

    try {
      execSync('npm run check', {
        cwd: this.config.projectPath,
        stdio: 'inherit'
      })
      console.log('   ✅ Types generated')
    } catch (error) {
      console.warn('   ⚠️  Type generation had warnings')
    }
  }

  /**
   * Initialize git repository
   */
  private async initializeGit(): Promise<void> {
    console.log('🔗 Initializing git...')

    try {
      execSync('git init', {
        cwd: this.config.projectPath,
        stdio: 'inherit'
      })
      execSync('git add .', {
        cwd: this.config.projectPath,
        stdio: 'inherit'
      })
      execSync('git commit -m "Initial commit"', {
        cwd: this.config.projectPath,
        stdio: 'inherit'
      })
      console.log('   ✅ Git initialized')
    } catch (error) {
      console.warn('   ⚠️  Git initialization failed')
    }
  }
}

// Run setup
const setup = new TemplateSetup({
  template: process.argv[2] || 'web-static',
  projectName: process.argv[3] || 'my-project',
  projectPath: process.cwd()
})

setup.setup()
```

### 4.2 Post-Install Hook in package.json

```json
{
  "name": "web-static",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "postinstall": "node scripts/setup.js"
  }
}
```

---

## 5. File Naming Conventions

### 5.1 Naming Rules

```typescript
/**
 * File naming conventions
 */

const namingConventions = {
  components: {
    rule: 'PascalCase.tsx',
    examples: ['Button.tsx', 'UserProfile.tsx', 'DashboardLayout.tsx'],
    reason: 'React components are classes/functions'
  },

  pages: {
    rule: 'PascalCase.tsx',
    examples: ['Home.tsx', 'Dashboard.tsx', 'NotFound.tsx'],
    reason: 'Pages are components'
  },

  hooks: {
    rule: 'useXxx.ts',
    examples: ['useAuth.ts', 'useTheme.ts', 'useFetch.ts'],
    reason: 'React hook naming convention'
  },

  utilities: {
    rule: 'camelCase.ts',
    examples: ['utils.ts', 'helpers.ts', 'constants.ts'],
    reason: 'Utility files are not components'
  },

  types: {
    rule: 'camelCase.ts or PascalCase.ts',
    examples: ['types.ts', 'User.ts', 'api.ts'],
    reason: 'Can be either depending on export type'
  },

  tests: {
    rule: '[filename].test.ts or [filename].spec.ts',
    examples: ['utils.test.ts', 'Button.spec.tsx'],
    reason: 'Test runner convention'
  },

  styles: {
    rule: '[filename].module.css or [filename].css',
    examples: ['Button.module.css', 'global.css'],
    reason: 'CSS module or global styles'
  },

  directories: {
    rule: 'kebab-case or lowercase',
    examples: ['src/', 'components/', 'utils/', 'api-routes/'],
    reason: 'Consistency and URL safety'
  }
};
```

---

## 6. Template Metadata

### 6.1 Template Configuration File

```typescript
/**
 * template.config.json - Template metadata
 */

interface TemplateConfig {
  name: string
  version: string
  description: string
  author: string
  license: string
  keywords: string[]
  features: string[]
  tech: {
    frontend?: string[]
    backend?: string[]
    database?: string[]
  }
  requirements: {
    nodeVersion: string
    npmVersion?: string
    disk: string
    memory: string
  }
  files: {
    required: string[]
    optional: string[]
  }
  env: {
    required: string[]
    optional: string[]
  }
  scripts: {
    setup: string
    dev: string
    build: string
    deploy: string
  }
  documentation: {
    setup: string
    deployment: string
    customization: string
  }
}

const templateConfig: TemplateConfig = {
  name: 'web-db-user',
  version: '1.0.0',
  description: 'Full-stack web application with database and authentication',
  author: 'Agentic Platform',
  license: 'MIT',
  keywords: ['react', 'express', 'trpc', 'mysql', 'typescript'],
  features: [
    'User authentication',
    'Database integration',
    'Real-time updates',
    'Type-safe API',
    'Dark mode support'
  ],
  tech: {
    frontend: ['React 19', 'Tailwind CSS', 'TypeScript'],
    backend: ['Express 4', 'tRPC 11', 'Node.js'],
    database: ['MySQL', 'Drizzle ORM']
  },
  requirements: {
    nodeVersion: '18.x || 20.x',
    npmVersion: '9.x || 10.x',
    disk: '500MB',
    memory: '2GB'
  },
  files: {
    required: [
      'package.json',
      'tsconfig.json',
      '.env.example',
      'client/index.html',
      'server/_core/index.ts',
      'drizzle/schema.ts'
    ],
    optional: [
      '.prettierrc',
      '.eslintrc.json',
      'vitest.config.ts'
    ]
  },
  env: {
    required: [
      'DATABASE_URL',
      'JWT_SECRET'
    ],
    optional: [
      'OPENAI_API_KEY',
      'STRIPE_API_KEY'
    ]
  },
  scripts: {
    setup: 'npm install && pnpm db:push',
    dev: 'npm run dev',
    build: 'npm run build',
    deploy: 'npm run deploy'
  },
  documentation: {
    setup: 'docs/SETUP.md',
    deployment: 'docs/DEPLOYMENT.md',
    customization: 'docs/CUSTOMIZATION.md'
  }
}
```

---

## Summary

### Template Structure Checklist

- ✅ **Directory Layout**: Organized, scalable structure
- ✅ **Required Files**: All essential configuration files present
- ✅ **Environment Variables**: Properly defined and validated
- ✅ **Post-Install Scripts**: Automated setup and initialization
- ✅ **File Naming**: Consistent conventions across all templates
- ✅ **Template Metadata**: Clear documentation and requirements
- ✅ **Documentation**: Comprehensive guides for setup and deployment

This comprehensive template structure ensures consistency, scalability, and ease of use across all templates!
