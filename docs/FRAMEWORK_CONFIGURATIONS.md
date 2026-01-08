# Framework-Specific Configurations Guide

## Overview

This guide covers how to handle framework-specific configurations for different frontend frameworks (Next.js, Vite, plain React), backend options (Node.js, Python, Go), and database integrations (PostgreSQL, MySQL, MongoDB, Redis).

---

## Table of Contents

1. [Framework Configuration Architecture](#1-framework-configuration-architecture)
2. [Frontend Framework Configurations](#2-frontend-framework-configurations)
3. [Backend Framework Configurations](#3-backend-framework-configurations)
4. [Database Integration Configurations](#4-database-integration-configurations)
5. [Configuration Composition Engine](#5-configuration-composition-engine)
6. [Environment-Specific Configurations](#6-environment-specific-configurations)
7. [Configuration Validation](#7-configuration-validation)
8. [Complete Examples](#8-complete-examples)

---

## 1. Framework Configuration Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Framework Configuration Architecture                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Selection                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │  Frontend   │  │   Backend   │  │  Database   │                         │
│  │  Framework  │  │  Framework  │  │   System    │                         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                         │
│         │                │                │                                 │
│         ▼                ▼                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                   Configuration Registry                         │       │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │       │
│  │  │  Next.js  │  │   Vite    │  │   Node    │  │  Python   │    │       │
│  │  │  Config   │  │  Config   │  │  Config   │  │  Config   │    │       │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │       │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │       │
│  │  │ PostgreSQL│  │   MySQL   │  │  MongoDB  │  │   Redis   │    │       │
│  │  │  Config   │  │  Config   │  │  Config   │  │  Config   │    │       │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                   Configuration Composer                         │       │
│  │  • Merge configurations                                          │       │
│  │  • Resolve conflicts                                             │       │
│  │  • Generate files                                                │       │
│  │  • Validate output                                               │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                   Generated Project                              │       │
│  │  • Framework-specific config files                               │       │
│  │  • Database connection setup                                     │       │
│  │  • Environment variables                                         │       │
│  │  • Docker configurations                                         │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration Types

```typescript
// src/services/config/types.ts

type FrameworkType = 'frontend' | 'backend' | 'database' | 'cache' | 'queue';

interface FrameworkConfig {
  id: string;
  name: string;
  type: FrameworkType;
  version: string;
  
  // File configurations
  files: ConfigFile[];
  
  // Dependencies
  dependencies: Dependency[];
  
  // Environment variables
  envVars: EnvVar[];
  
  // Docker configuration
  docker?: DockerConfig;
  
  // Build configuration
  build?: BuildConfig;
  
  // Runtime configuration
  runtime?: RuntimeConfig;
  
  // Compatibility
  compatibleWith: string[];
  incompatibleWith: string[];
}

interface ConfigFile {
  path: string;
  content: string | ((context: ConfigContext) => string);
  condition?: string;
  merge?: boolean; // Merge with existing file
}

interface Dependency {
  name: string;
  version: string;
  dev: boolean;
  packageManager: 'npm' | 'pip' | 'go';
  condition?: string;
}

interface EnvVar {
  key: string;
  value?: string;
  description: string;
  required: boolean;
  secret: boolean;
  environments: ('development' | 'staging' | 'production')[];
}

interface DockerConfig {
  baseImage: string;
  ports: number[];
  volumes: string[];
  commands: string[];
  healthCheck?: string;
}

interface BuildConfig {
  command: string;
  outputDir: string;
  env?: Record<string, string>;
}

interface RuntimeConfig {
  command: string;
  port: number;
  env?: Record<string, string>;
}

interface ConfigContext {
  projectName: string;
  frameworks: string[];
  databases: string[];
  features: string[];
  parameters: Record<string, any>;
}
```

---

## 2. Frontend Framework Configurations

### Next.js Configuration

```typescript
// src/services/config/frontend/nextjs.ts

const NEXTJS_CONFIG: FrameworkConfig = {
  id: 'nextjs',
  name: 'Next.js',
  type: 'frontend',
  version: '14.1.0',
  
  compatibleWith: ['typescript', 'tailwind', 'prisma', 'drizzle', 'trpc'],
  incompatibleWith: ['vite', 'cra'],
  
  files: [
    // next.config.js
    {
      path: 'next.config.js',
      content: (ctx) => `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ${ctx.features.includes('standalone') ? `output: 'standalone',` : ''}
  ${ctx.features.includes('images') ? `
  images: {
    domains: ['${ctx.parameters.imageDomains?.join("', '") || ''}'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },` : ''}
  ${ctx.features.includes('i18n') ? `
  i18n: {
    locales: ${JSON.stringify(ctx.parameters.locales || ['en'])},
    defaultLocale: '${ctx.parameters.defaultLocale || 'en'}',
  },` : ''}
  ${ctx.databases.includes('prisma') ? `
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },` : ''}
};

module.exports = nextConfig;
      `.trim(),
    },
    
    // tsconfig.json
    {
      path: 'tsconfig.json',
      condition: 'typescript',
      content: `
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
      `.trim(),
    },
    
    // App Router layout
    {
      path: 'src/app/layout.tsx',
      content: (ctx) => `
import type { Metadata } from 'next';
${ctx.features.includes('tailwind') ? "import './globals.css';" : ''}
${ctx.features.includes('fonts') ? `
import { ${ctx.parameters.font || 'Inter'} } from 'next/font/google';

const font = ${ctx.parameters.font || 'Inter'}({ subsets: ['latin'] });
` : ''}

export const metadata: Metadata = {
  title: '${ctx.projectName}',
  description: '${ctx.parameters.description || 'Generated with Agentic Platform'}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="${ctx.parameters.defaultLocale || 'en'}">
      <body${ctx.features.includes('fonts') ? ' className={font.className}' : ''}>
        ${ctx.features.includes('providers') ? '<Providers>' : ''}
        {children}
        ${ctx.features.includes('providers') ? '</Providers>' : ''}
      </body>
    </html>
  );
}
      `.trim(),
    },
    
    // App Router page
    {
      path: 'src/app/page.tsx',
      content: (ctx) => `
export default function Home() {
  return (
    <main${ctx.features.includes('tailwind') ? ' className="flex min-h-screen flex-col items-center justify-center p-24"' : ''}>
      <h1${ctx.features.includes('tailwind') ? ' className="text-4xl font-bold"' : ''}>
        Welcome to ${ctx.projectName}
      </h1>
    </main>
  );
}
      `.trim(),
    },
    
    // API Route example
    {
      path: 'src/app/api/health/route.ts',
      content: `
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
      `.trim(),
    },
    
    // Middleware
    {
      path: 'src/middleware.ts',
      condition: 'auth',
      content: (ctx) => `
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/profile', '/settings'];
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('${ctx.parameters.authCookieName || 'token'}')?.value;

  // Redirect to login if accessing protected route without token
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if accessing auth routes with token
  if (authRoutes.some(route => pathname.startsWith(route)) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
      `.trim(),
    },
    
    // Tailwind config for Next.js
    {
      path: 'tailwind.config.ts',
      condition: 'tailwind',
      content: `
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

export default config;
      `.trim(),
    },
    
    // Global CSS
    {
      path: 'src/app/globals.css',
      condition: 'tailwind',
      content: `
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'next', version: '^14.1.0', dev: false, packageManager: 'npm' },
    { name: 'react', version: '^18.2.0', dev: false, packageManager: 'npm' },
    { name: 'react-dom', version: '^18.2.0', dev: false, packageManager: 'npm' },
    { name: 'typescript', version: '^5.3.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/node', version: '^20.11.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/react', version: '^18.2.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/react-dom', version: '^18.2.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: 'tailwindcss', version: '^3.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'postcss', version: '^8.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'autoprefixer', version: '^10.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
  ],
  
  envVars: [
    {
      key: 'NEXT_PUBLIC_APP_URL',
      description: 'Public URL of the application',
      required: false,
      secret: false,
      environments: ['development', 'staging', 'production'],
    },
  ],
  
  docker: {
    baseImage: 'node:20-alpine',
    ports: [3000],
    volumes: [],
    commands: [
      'WORKDIR /app',
      'COPY package*.json ./',
      'RUN npm ci',
      'COPY . .',
      'RUN npm run build',
      'CMD ["npm", "start"]',
    ],
    healthCheck: 'curl -f http://localhost:3000/api/health || exit 1',
  },
  
  build: {
    command: 'npm run build',
    outputDir: '.next',
  },
  
  runtime: {
    command: 'npm start',
    port: 3000,
  },
};
```

### Vite Configuration

```typescript
// src/services/config/frontend/vite.ts

const VITE_CONFIG: FrameworkConfig = {
  id: 'vite',
  name: 'Vite',
  type: 'frontend',
  version: '5.1.0',
  
  compatibleWith: ['react', 'vue', 'svelte', 'typescript', 'tailwind'],
  incompatibleWith: ['nextjs', 'cra'],
  
  files: [
    // vite.config.ts
    {
      path: 'vite.config.ts',
      content: (ctx) => `
import { defineConfig } from 'vite';
${ctx.features.includes('react') ? "import react from '@vitejs/plugin-react';" : ''}
${ctx.features.includes('vue') ? "import vue from '@vitejs/plugin-vue';" : ''}
${ctx.features.includes('svelte') ? "import { svelte } from '@sveltejs/vite-plugin-svelte';" : ''}
import path from 'path';

export default defineConfig({
  plugins: [
    ${ctx.features.includes('react') ? 'react(),' : ''}
    ${ctx.features.includes('vue') ? 'vue(),' : ''}
    ${ctx.features.includes('svelte') ? 'svelte(),' : ''}
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: ${ctx.parameters.port || 5173},
    ${ctx.features.includes('proxy') ? `
    proxy: {
      '/api': {
        target: '${ctx.parameters.apiUrl || 'http://localhost:3000'}',
        changeOrigin: true,
      },
    },` : ''}
  },
  build: {
    outDir: 'dist',
    sourcemap: ${ctx.parameters.sourcemap !== false},
    ${ctx.features.includes('legacy') ? `
    target: 'es2015',` : ''}
  },
  ${ctx.features.includes('env') ? `
  envPrefix: '${ctx.parameters.envPrefix || 'VITE_'}',` : ''}
});
      `.trim(),
    },
    
    // index.html
    {
      path: 'index.html',
      content: (ctx) => `
<!DOCTYPE html>
<html lang="${ctx.parameters.lang || 'en'}">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${ctx.projectName}</title>
    ${ctx.features.includes('fonts') ? `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${ctx.parameters.font || 'Inter'}:wght@400;500;600;700&display=swap" rel="stylesheet">
    ` : ''}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${ctx.features.includes('typescript') ? 'tsx' : 'jsx'}"></script>
  </body>
</html>
      `.trim(),
    },
    
    // Main entry (React)
    {
      path: 'src/main.tsx',
      condition: 'react',
      content: (ctx) => `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
${ctx.features.includes('tailwind') ? "import './index.css';" : ''}
${ctx.features.includes('router') ? "import { BrowserRouter } from 'react-router-dom';" : ''}
${ctx.features.includes('query') ? "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';" : ''}

${ctx.features.includes('query') ? 'const queryClient = new QueryClient();' : ''}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    ${ctx.features.includes('query') ? '<QueryClientProvider client={queryClient}>' : ''}
    ${ctx.features.includes('router') ? '<BrowserRouter>' : ''}
    <App />
    ${ctx.features.includes('router') ? '</BrowserRouter>' : ''}
    ${ctx.features.includes('query') ? '</QueryClientProvider>' : ''}
  </React.StrictMode>
);
      `.trim(),
    },
    
    // Main entry (Vue)
    {
      path: 'src/main.ts',
      condition: 'vue',
      content: (ctx) => `
import { createApp } from 'vue';
${ctx.features.includes('tailwind') ? "import './index.css';" : ''}
import App from './App.vue';
${ctx.features.includes('router') ? "import router from './router';" : ''}
${ctx.features.includes('pinia') ? "import { createPinia } from 'pinia';" : ''}

const app = createApp(App);

${ctx.features.includes('pinia') ? 'app.use(createPinia());' : ''}
${ctx.features.includes('router') ? 'app.use(router);' : ''}

app.mount('#app');
      `.trim(),
    },
    
    // App component (React)
    {
      path: 'src/App.tsx',
      condition: 'react',
      content: (ctx) => `
${ctx.features.includes('router') ? "import { Routes, Route } from 'react-router-dom';" : ''}

function App() {
  return (
    <div${ctx.features.includes('tailwind') ? ' className="min-h-screen bg-gray-50"' : ''}>
      ${ctx.features.includes('router') ? `
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
      ` : `
      <h1>Welcome to ${ctx.projectName}</h1>
      `}
    </div>
  );
}

export default App;
      `.trim(),
    },
    
    // App component (Vue)
    {
      path: 'src/App.vue',
      condition: 'vue',
      content: (ctx) => `
<script setup lang="ts">
${ctx.features.includes('router') ? "import { RouterView } from 'vue-router';" : ''}
</script>

<template>
  <div${ctx.features.includes('tailwind') ? ' class="min-h-screen bg-gray-50"' : ''}>
    ${ctx.features.includes('router') ? '<RouterView />' : `<h1>Welcome to ${ctx.projectName}</h1>`}
  </div>
</template>

<style scoped>
</style>
      `.trim(),
    },
    
    // Tailwind config
    {
      path: 'tailwind.config.js',
      condition: 'tailwind',
      content: (ctx) => `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{${ctx.features.includes('vue') ? 'vue,' : ''}js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ${ctx.parameters.colors ? `
      colors: ${JSON.stringify(ctx.parameters.colors, null, 8)},` : ''}
    },
  },
  plugins: [
    ${ctx.features.includes('forms') ? "require('@tailwindcss/forms')," : ''}
    ${ctx.features.includes('typography') ? "require('@tailwindcss/typography')," : ''}
  ],
};
      `.trim(),
    },
    
    // PostCSS config
    {
      path: 'postcss.config.js',
      condition: 'tailwind',
      content: `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
      `.trim(),
    },
    
    // Index CSS
    {
      path: 'src/index.css',
      condition: 'tailwind',
      content: `
@tailwind base;
@tailwind components;
@tailwind utilities;
      `.trim(),
    },
    
    // TypeScript config
    {
      path: 'tsconfig.json',
      condition: 'typescript',
      content: (ctx) => `
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    ${ctx.features.includes('react') ? '"jsx": "react-jsx",' : ''}
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
      `.trim(),
    },
    
    // TypeScript node config
    {
      path: 'tsconfig.node.json',
      condition: 'typescript',
      content: `
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'vite', version: '^5.1.0', dev: true, packageManager: 'npm' },
    { name: 'react', version: '^18.2.0', dev: false, packageManager: 'npm', condition: 'react' },
    { name: 'react-dom', version: '^18.2.0', dev: false, packageManager: 'npm', condition: 'react' },
    { name: '@vitejs/plugin-react', version: '^4.2.0', dev: true, packageManager: 'npm', condition: 'react' },
    { name: 'vue', version: '^3.4.0', dev: false, packageManager: 'npm', condition: 'vue' },
    { name: '@vitejs/plugin-vue', version: '^5.0.0', dev: true, packageManager: 'npm', condition: 'vue' },
    { name: 'typescript', version: '^5.3.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/react', version: '^18.2.0', dev: true, packageManager: 'npm', condition: 'react && typescript' },
    { name: '@types/react-dom', version: '^18.2.0', dev: true, packageManager: 'npm', condition: 'react && typescript' },
    { name: 'tailwindcss', version: '^3.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'postcss', version: '^8.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'autoprefixer', version: '^10.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'react-router-dom', version: '^6.22.0', dev: false, packageManager: 'npm', condition: 'react && router' },
    { name: 'vue-router', version: '^4.2.0', dev: false, packageManager: 'npm', condition: 'vue && router' },
    { name: '@tanstack/react-query', version: '^5.20.0', dev: false, packageManager: 'npm', condition: 'react && query' },
    { name: 'pinia', version: '^2.1.0', dev: false, packageManager: 'npm', condition: 'vue && pinia' },
  ],
  
  envVars: [
    {
      key: 'VITE_API_URL',
      description: 'Backend API URL',
      required: false,
      secret: false,
      environments: ['development', 'staging', 'production'],
    },
  ],
  
  docker: {
    baseImage: 'node:20-alpine',
    ports: [5173],
    volumes: [],
    commands: [
      'WORKDIR /app',
      'COPY package*.json ./',
      'RUN npm ci',
      'COPY . .',
      'RUN npm run build',
      'FROM nginx:alpine',
      'COPY --from=0 /app/dist /usr/share/nginx/html',
      'EXPOSE 80',
      'CMD ["nginx", "-g", "daemon off;"]',
    ],
  },
  
  build: {
    command: 'npm run build',
    outputDir: 'dist',
  },
  
  runtime: {
    command: 'npm run dev',
    port: 5173,
  },
};
```

### Plain React (Create React App) Configuration

```typescript
// src/services/config/frontend/cra.ts

const CRA_CONFIG: FrameworkConfig = {
  id: 'cra',
  name: 'Create React App',
  type: 'frontend',
  version: '5.0.1',
  
  compatibleWith: ['typescript', 'tailwind'],
  incompatibleWith: ['nextjs', 'vite'],
  
  files: [
    // craco.config.js (for customization)
    {
      path: 'craco.config.js',
      content: (ctx) => `
module.exports = {
  style: {
    ${ctx.features.includes('tailwind') ? `
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },` : ''}
  },
  ${ctx.features.includes('alias') ? `
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },` : ''}
};
      `.trim(),
    },
    
    // public/index.html
    {
      path: 'public/index.html',
      content: (ctx) => `
<!DOCTYPE html>
<html lang="${ctx.parameters.lang || 'en'}">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="${ctx.parameters.description || 'React App'}" />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>${ctx.projectName}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
      `.trim(),
    },
    
    // src/index.tsx
    {
      path: 'src/index.tsx',
      content: (ctx) => `
import React from 'react';
import ReactDOM from 'react-dom/client';
${ctx.features.includes('tailwind') ? "import './index.css';" : ''}
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
      `.trim(),
    },
    
    // src/App.tsx
    {
      path: 'src/App.tsx',
      content: (ctx) => `
import React from 'react';
${!ctx.features.includes('tailwind') ? "import './App.css';" : ''}

function App() {
  return (
    <div${ctx.features.includes('tailwind') ? ' className="min-h-screen bg-gray-100 flex items-center justify-center"' : ' className="App"'}>
      <h1${ctx.features.includes('tailwind') ? ' className="text-4xl font-bold text-gray-900"' : ''}>
        Welcome to ${ctx.projectName}
      </h1>
    </div>
  );
}

export default App;
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'react', version: '^18.2.0', dev: false, packageManager: 'npm' },
    { name: 'react-dom', version: '^18.2.0', dev: false, packageManager: 'npm' },
    { name: 'react-scripts', version: '5.0.1', dev: false, packageManager: 'npm' },
    { name: 'typescript', version: '^5.3.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/react', version: '^18.2.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/react-dom', version: '^18.2.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@craco/craco', version: '^7.1.0', dev: true, packageManager: 'npm' },
    { name: 'tailwindcss', version: '^3.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'postcss', version: '^8.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
    { name: 'autoprefixer', version: '^10.4.0', dev: true, packageManager: 'npm', condition: 'tailwind' },
  ],
  
  envVars: [
    {
      key: 'REACT_APP_API_URL',
      description: 'Backend API URL',
      required: false,
      secret: false,
      environments: ['development', 'staging', 'production'],
    },
  ],
  
  docker: {
    baseImage: 'node:20-alpine',
    ports: [3000],
    volumes: [],
    commands: [
      'WORKDIR /app',
      'COPY package*.json ./',
      'RUN npm ci',
      'COPY . .',
      'RUN npm run build',
      'FROM nginx:alpine',
      'COPY --from=0 /app/build /usr/share/nginx/html',
      'EXPOSE 80',
      'CMD ["nginx", "-g", "daemon off;"]',
    ],
  },
  
  build: {
    command: 'npm run build',
    outputDir: 'build',
  },
  
  runtime: {
    command: 'npm start',
    port: 3000,
  },
};
```

---

## 3. Backend Framework Configurations

### Node.js (Express) Configuration

```typescript
// src/services/config/backend/node-express.ts

const NODE_EXPRESS_CONFIG: FrameworkConfig = {
  id: 'node-express',
  name: 'Node.js + Express',
  type: 'backend',
  version: '4.18.0',
  
  compatibleWith: ['typescript', 'prisma', 'drizzle', 'postgresql', 'mysql', 'mongodb'],
  incompatibleWith: [],
  
  files: [
    // src/index.ts
    {
      path: 'src/index.ts',
      content: (ctx) => `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
${ctx.features.includes('dotenv') ? "import 'dotenv/config';" : ''}
${ctx.features.includes('compression') ? "import compression from 'compression';" : ''}
${ctx.databases.includes('prisma') ? "import { prisma } from './lib/prisma';" : ''}
${ctx.databases.includes('drizzle') ? "import { db } from './lib/db';" : ''}

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || ${ctx.parameters.port || 3000};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
${ctx.features.includes('compression') ? 'app.use(compression());' : ''}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  ${ctx.databases.includes('prisma') ? 'await prisma.$disconnect();' : ''}
  process.exit(0);
});

export default app;
      `.trim(),
    },
    
    // src/routes/index.ts
    {
      path: 'src/routes/index.ts',
      content: (ctx) => `
import { Router } from 'express';
${ctx.features.includes('auth') ? "import authRoutes from './auth';" : ''}
${ctx.features.includes('users') ? "import userRoutes from './users';" : ''}

const router = Router();

${ctx.features.includes('auth') ? "router.use('/auth', authRoutes);" : ''}
${ctx.features.includes('users') ? "router.use('/users', userRoutes);" : ''}

// Add your routes here
router.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

export default router;
      `.trim(),
    },
    
    // src/middleware/errorHandler.ts
    {
      path: 'src/middleware/errorHandler.ts',
      content: `
import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(\`[Error] \${statusCode}: \${message}\`);
  console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
      `.trim(),
    },
    
    // src/middleware/notFoundHandler.ts
    {
      path: 'src/middleware/notFoundHandler.ts',
      content: `
import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: \`Route \${req.method} \${req.path} not found\`,
    },
  });
};
      `.trim(),
    },
    
    // src/middleware/auth.ts
    {
      path: 'src/middleware/auth.ts',
      condition: 'auth',
      content: (ctx) => `
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'No token provided' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token' },
    });
  }
};
      `.trim(),
    },
    
    // tsconfig.json
    {
      path: 'tsconfig.json',
      condition: 'typescript',
      content: `
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'express', version: '^4.18.0', dev: false, packageManager: 'npm' },
    { name: 'cors', version: '^2.8.5', dev: false, packageManager: 'npm' },
    { name: 'helmet', version: '^7.1.0', dev: false, packageManager: 'npm' },
    { name: 'morgan', version: '^1.10.0', dev: false, packageManager: 'npm' },
    { name: 'dotenv', version: '^16.4.0', dev: false, packageManager: 'npm', condition: 'dotenv' },
    { name: 'compression', version: '^1.7.4', dev: false, packageManager: 'npm', condition: 'compression' },
    { name: 'jsonwebtoken', version: '^9.0.0', dev: false, packageManager: 'npm', condition: 'auth' },
    { name: 'bcryptjs', version: '^2.4.3', dev: false, packageManager: 'npm', condition: 'auth' },
    { name: 'typescript', version: '^5.3.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/express', version: '^4.17.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/cors', version: '^2.8.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/morgan', version: '^1.9.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: '@types/compression', version: '^1.7.0', dev: true, packageManager: 'npm', condition: 'typescript && compression' },
    { name: '@types/jsonwebtoken', version: '^9.0.0', dev: true, packageManager: 'npm', condition: 'typescript && auth' },
    { name: '@types/bcryptjs', version: '^2.4.0', dev: true, packageManager: 'npm', condition: 'typescript && auth' },
    { name: 'tsx', version: '^4.7.0', dev: true, packageManager: 'npm', condition: 'typescript' },
    { name: 'nodemon', version: '^3.0.0', dev: true, packageManager: 'npm' },
  ],
  
  envVars: [
    { key: 'PORT', description: 'Server port', required: false, secret: false, environments: ['development', 'staging', 'production'] },
    { key: 'NODE_ENV', description: 'Environment', required: false, secret: false, environments: ['development', 'staging', 'production'] },
    { key: 'CORS_ORIGIN', description: 'CORS origin', required: false, secret: false, environments: ['development', 'staging', 'production'] },
    { key: 'JWT_SECRET', description: 'JWT signing secret', required: true, secret: true, environments: ['development', 'staging', 'production'] },
  ],
  
  docker: {
    baseImage: 'node:20-alpine',
    ports: [3000],
    volumes: [],
    commands: [
      'WORKDIR /app',
      'COPY package*.json ./',
      'RUN npm ci --only=production',
      'COPY . .',
      'RUN npm run build',
      'EXPOSE 3000',
      'CMD ["node", "dist/index.js"]',
    ],
    healthCheck: 'curl -f http://localhost:3000/health || exit 1',
  },
  
  build: {
    command: 'npm run build',
    outputDir: 'dist',
  },
  
  runtime: {
    command: 'npm run dev',
    port: 3000,
  },
};
```

### Python (FastAPI) Configuration

```typescript
// src/services/config/backend/python-fastapi.ts

const PYTHON_FASTAPI_CONFIG: FrameworkConfig = {
  id: 'python-fastapi',
  name: 'Python + FastAPI',
  type: 'backend',
  version: '0.109.0',
  
  compatibleWith: ['postgresql', 'mysql', 'mongodb', 'redis'],
  incompatibleWith: [],
  
  files: [
    // main.py
    {
      path: 'app/main.py',
      content: (ctx) => `
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
${ctx.databases.includes('postgresql') || ctx.databases.includes('mysql') ? 'from app.db import engine, Base' : ''}
${ctx.features.includes('auth') ? 'from app.routers import auth' : ''}
from app.routers import api

app = FastAPI(
    title="${ctx.projectName}",
    description="${ctx.parameters.description || 'API Documentation'}",
    version="${ctx.parameters.version || '1.0.0'}",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["${ctx.parameters.corsOrigins || '*'}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

${ctx.databases.includes('postgresql') || ctx.databases.includes('mysql') ? `
# Create tables
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
` : ''}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Routers
${ctx.features.includes('auth') ? 'app.include_router(auth.router, prefix="/api/auth", tags=["auth"])' : ''}
app.include_router(api.router, prefix="/api", tags=["api"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=${ctx.parameters.port || 8000})
      `.trim(),
    },
    
    // app/db.py
    {
      path: 'app/db.py',
      condition: 'postgresql || mysql',
      content: (ctx) => `
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "${ctx.databases.includes('postgresql') ? 'postgresql+asyncpg://user:password@localhost/db' : 'mysql+aiomysql://user:password@localhost/db'}")

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
      `.trim(),
    },
    
    // app/models.py
    {
      path: 'app/models.py',
      condition: 'postgresql || mysql',
      content: (ctx) => `
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
      `.trim(),
    },
    
    // app/routers/api.py
    {
      path: 'app/routers/api.py',
      content: `
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def root():
    return {"message": "API is running"}
      `.trim(),
    },
    
    // app/routers/auth.py
    {
      path: 'app/routers/auth.py',
      condition: 'auth',
      content: `
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os

router = APIRouter()

# Security
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Implement user verification here
    access_token = create_access_token(
        data={"sub": form_data.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    # Implement user registration here
    hashed_password = pwd_context.hash(user.password)
    return {"id": 1, "email": user.email}
      `.trim(),
    },
    
    // requirements.txt
    {
      path: 'requirements.txt',
      content: (ctx) => `
fastapi==${ctx.parameters.fastapiVersion || '0.109.0'}
uvicorn[standard]==0.27.0
pydantic==2.6.0
python-dotenv==1.0.1
${ctx.features.includes('auth') ? `python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4` : ''}
${ctx.databases.includes('postgresql') ? `sqlalchemy==2.0.25
asyncpg==0.29.0
alembic==1.13.1` : ''}
${ctx.databases.includes('mysql') ? `sqlalchemy==2.0.25
aiomysql==0.2.0
alembic==1.13.1` : ''}
${ctx.databases.includes('mongodb') ? `motor==3.3.2
beanie==1.25.0` : ''}
${ctx.databases.includes('redis') ? `redis==5.0.1
aioredis==2.0.1` : ''}
      `.trim(),
    },
    
    // pyproject.toml
    {
      path: 'pyproject.toml',
      content: (ctx) => `
[tool.poetry]
name = "${ctx.projectName}"
version = "${ctx.parameters.version || '0.1.0'}"
description = "${ctx.parameters.description || ''}"
authors = ["${ctx.parameters.author || 'Developer'}"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
pydantic = "^2.6.0"
python-dotenv = "^1.0.1"
${ctx.features.includes('auth') ? `python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}` : ''}
${ctx.databases.includes('postgresql') ? `sqlalchemy = "^2.0.25"
asyncpg = "^0.29.0"
alembic = "^1.13.1"` : ''}

[tool.poetry.dev-dependencies]
pytest = "^8.0.0"
pytest-asyncio = "^0.23.0"
httpx = "^0.26.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
      `.trim(),
    },
    
    // Dockerfile
    {
      path: 'Dockerfile',
      content: (ctx) => `
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE ${ctx.parameters.port || 8000}

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${ctx.parameters.port || 8000}"]
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'fastapi', version: '0.109.0', dev: false, packageManager: 'pip' },
    { name: 'uvicorn[standard]', version: '0.27.0', dev: false, packageManager: 'pip' },
    { name: 'pydantic', version: '2.6.0', dev: false, packageManager: 'pip' },
    { name: 'python-dotenv', version: '1.0.1', dev: false, packageManager: 'pip' },
    { name: 'python-jose[cryptography]', version: '3.3.0', dev: false, packageManager: 'pip', condition: 'auth' },
    { name: 'passlib[bcrypt]', version: '1.7.4', dev: false, packageManager: 'pip', condition: 'auth' },
    { name: 'sqlalchemy', version: '2.0.25', dev: false, packageManager: 'pip', condition: 'postgresql || mysql' },
    { name: 'asyncpg', version: '0.29.0', dev: false, packageManager: 'pip', condition: 'postgresql' },
    { name: 'aiomysql', version: '0.2.0', dev: false, packageManager: 'pip', condition: 'mysql' },
    { name: 'motor', version: '3.3.2', dev: false, packageManager: 'pip', condition: 'mongodb' },
    { name: 'redis', version: '5.0.1', dev: false, packageManager: 'pip', condition: 'redis' },
    { name: 'pytest', version: '8.0.0', dev: true, packageManager: 'pip' },
    { name: 'pytest-asyncio', version: '0.23.0', dev: true, packageManager: 'pip' },
    { name: 'httpx', version: '0.26.0', dev: true, packageManager: 'pip' },
  ],
  
  envVars: [
    { key: 'DATABASE_URL', description: 'Database connection string', required: true, secret: true, environments: ['development', 'staging', 'production'] },
    { key: 'JWT_SECRET', description: 'JWT signing secret', required: true, secret: true, environments: ['development', 'staging', 'production'] },
    { key: 'REDIS_URL', description: 'Redis connection string', required: false, secret: true, environments: ['development', 'staging', 'production'] },
  ],
  
  docker: {
    baseImage: 'python:3.11-slim',
    ports: [8000],
    volumes: [],
    commands: [
      'WORKDIR /app',
      'COPY requirements.txt .',
      'RUN pip install --no-cache-dir -r requirements.txt',
      'COPY . .',
      'EXPOSE 8000',
      'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]',
    ],
    healthCheck: 'curl -f http://localhost:8000/health || exit 1',
  },
  
  build: {
    command: 'pip install -r requirements.txt',
    outputDir: '.',
  },
  
  runtime: {
    command: 'uvicorn app.main:app --reload',
    port: 8000,
  },
};
```

### Go (Gin) Configuration

```typescript
// src/services/config/backend/go-gin.ts

const GO_GIN_CONFIG: FrameworkConfig = {
  id: 'go-gin',
  name: 'Go + Gin',
  type: 'backend',
  version: '1.9.1',
  
  compatibleWith: ['postgresql', 'mysql', 'mongodb', 'redis'],
  incompatibleWith: [],
  
  files: [
    // main.go
    {
      path: 'main.go',
      content: (ctx) => `
package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	${ctx.databases.includes('postgresql') || ctx.databases.includes('mysql') ? '"github.com/jinzhu/gorm"' : ''}
	${ctx.databases.includes('postgresql') ? '_ "github.com/jinzhu/gorm/dialects/postgres"' : ''}
	${ctx.databases.includes('mysql') ? '_ "github.com/jinzhu/gorm/dialects/mysql"' : ''}
	${ctx.databases.includes('mongodb') ? '"go.mongodb.org/mongo-driver/mongo"' : ''}
	${ctx.databases.includes('redis') ? '"github.com/go-redis/redis/v8"' : ''}
)

${ctx.databases.includes('postgresql') || ctx.databases.includes('mysql') ? `
var db *gorm.DB

func initDB() {
	var err error
	dsn := os.Getenv("DATABASE_URL")
	db, err = gorm.Open("${ctx.databases.includes('postgresql') ? 'postgres' : 'mysql'}", dsn)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	
	// Auto migrate
	db.AutoMigrate(&User{})
}
` : ''}

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	${ctx.databases.includes('postgresql') || ctx.databases.includes('mysql') ? 'initDB()' : ''}

	// Setup router
	r := gin.Default()

	// CORS
	r.Use(corsMiddleware())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	api := r.Group("/api")
	{
		api.GET("/", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "API is running"})
		})
		${ctx.features.includes('auth') ? `
		auth := api.Group("/auth")
		{
			auth.POST("/login", loginHandler)
			auth.POST("/register", registerHandler)
		}
		` : ''}
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "${ctx.parameters.port || '8080'}"
	}
	
	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
      `.trim(),
    },
    
    // models.go
    {
      path: 'models.go',
      condition: 'postgresql || mysql',
      content: `
package main

import (
	"time"
)

type User struct {
	ID        uint      \`gorm:"primary_key" json:"id"\`
	Email     string    \`gorm:"unique;not null" json:"email"\`
	Password  string    \`gorm:"not null" json:"-"\`
	CreatedAt time.Time \`json:"created_at"\`
	UpdatedAt time.Time \`json:"updated_at"\`
}
      `.trim(),
    },
    
    // auth.go
    {
      path: 'auth.go',
      condition: 'auth',
      content: `
package main

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string \`json:"email" binding:"required,email"\`
	Password string \`json:"password" binding:"required"\`
}

type RegisterRequest struct {
	Email    string \`json:"email" binding:"required,email"\`
	Password string \`json:"password" binding:"required,min=6"\`
}

func loginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user
	var user User
	if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": tokenString})
}

func registerHandler(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	user := User{
		Email:    req.Email,
		Password: string(hashedPassword),
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": user.ID, "email": user.Email})
}
      `.trim(),
    },
    
    // go.mod
    {
      path: 'go.mod',
      content: (ctx) => `
module ${ctx.projectName}

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/joho/godotenv v1.5.1
	${ctx.databases.includes('postgresql') || ctx.databases.includes('mysql') ? 'github.com/jinzhu/gorm v1.9.16' : ''}
	${ctx.features.includes('auth') ? `github.com/golang-jwt/jwt/v5 v5.2.0
	golang.org/x/crypto v0.18.0` : ''}
	${ctx.databases.includes('mongodb') ? 'go.mongodb.org/mongo-driver v1.13.1' : ''}
	${ctx.databases.includes('redis') ? 'github.com/go-redis/redis/v8 v8.11.5' : ''}
)
      `.trim(),
    },
    
    // Dockerfile
    {
      path: 'Dockerfile',
      content: (ctx) => `
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Run stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/main .

EXPOSE ${ctx.parameters.port || 8080}

CMD ["./main"]
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'github.com/gin-gonic/gin', version: 'v1.9.1', dev: false, packageManager: 'go' },
    { name: 'github.com/joho/godotenv', version: 'v1.5.1', dev: false, packageManager: 'go' },
    { name: 'github.com/jinzhu/gorm', version: 'v1.9.16', dev: false, packageManager: 'go', condition: 'postgresql || mysql' },
    { name: 'github.com/golang-jwt/jwt/v5', version: 'v5.2.0', dev: false, packageManager: 'go', condition: 'auth' },
    { name: 'golang.org/x/crypto', version: 'v0.18.0', dev: false, packageManager: 'go', condition: 'auth' },
    { name: 'go.mongodb.org/mongo-driver', version: 'v1.13.1', dev: false, packageManager: 'go', condition: 'mongodb' },
    { name: 'github.com/go-redis/redis/v8', version: 'v8.11.5', dev: false, packageManager: 'go', condition: 'redis' },
  ],
  
  envVars: [
    { key: 'PORT', description: 'Server port', required: false, secret: false, environments: ['development', 'staging', 'production'] },
    { key: 'DATABASE_URL', description: 'Database connection string', required: true, secret: true, environments: ['development', 'staging', 'production'] },
    { key: 'JWT_SECRET', description: 'JWT signing secret', required: true, secret: true, environments: ['development', 'staging', 'production'] },
  ],
  
  docker: {
    baseImage: 'golang:1.21-alpine',
    ports: [8080],
    volumes: [],
    commands: [
      'WORKDIR /app',
      'COPY go.mod go.sum ./',
      'RUN go mod download',
      'COPY . .',
      'RUN CGO_ENABLED=0 GOOS=linux go build -o main .',
      'FROM alpine:latest',
      'WORKDIR /app',
      'COPY --from=builder /app/main .',
      'EXPOSE 8080',
      'CMD ["./main"]',
    ],
    healthCheck: 'wget -qO- http://localhost:8080/health || exit 1',
  },
  
  build: {
    command: 'go build -o main .',
    outputDir: '.',
  },
  
  runtime: {
    command: 'go run .',
    port: 8080,
  },
};
```

---

## 4. Database Integration Configurations

### PostgreSQL Configuration

```typescript
// src/services/config/database/postgresql.ts

const POSTGRESQL_CONFIG: FrameworkConfig = {
  id: 'postgresql',
  name: 'PostgreSQL',
  type: 'database',
  version: '16',
  
  compatibleWith: ['node-express', 'python-fastapi', 'go-gin', 'nextjs', 'prisma', 'drizzle'],
  incompatibleWith: [],
  
  files: [
    // Prisma schema
    {
      path: 'prisma/schema.prisma',
      condition: 'prisma',
      content: (ctx) => `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ${ctx.features.includes('posts') ? `
  posts     Post[]
  ` : ''}
}

${ctx.features.includes('posts') ? `
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
` : ''}
      `.trim(),
    },
    
    // Drizzle schema
    {
      path: 'src/db/schema.ts',
      condition: 'drizzle',
      content: (ctx) => `
import { pgTable, serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

${ctx.features.includes('posts') ? `
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  published: boolean('published').default(false),
  authorId: integer('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
` : ''}

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
      `.trim(),
    },
    
    // Drizzle config
    {
      path: 'drizzle.config.ts',
      condition: 'drizzle',
      content: `
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
      `.trim(),
    },
    
    // Database connection (Drizzle)
    {
      path: 'src/db/index.ts',
      condition: 'drizzle',
      content: `
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
      `.trim(),
    },
    
    // Prisma client
    {
      path: 'src/lib/prisma.ts',
      condition: 'prisma',
      content: `
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
      `.trim(),
    },
    
    // Docker compose for PostgreSQL
    {
      path: 'docker-compose.yml',
      merge: true,
      content: (ctx) => `
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: \${POSTGRES_DB:-${ctx.projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: '@prisma/client', version: '^5.9.0', dev: false, packageManager: 'npm', condition: 'prisma' },
    { name: 'prisma', version: '^5.9.0', dev: true, packageManager: 'npm', condition: 'prisma' },
    { name: 'drizzle-orm', version: '^0.29.0', dev: false, packageManager: 'npm', condition: 'drizzle' },
    { name: 'drizzle-kit', version: '^0.20.0', dev: true, packageManager: 'npm', condition: 'drizzle' },
    { name: 'pg', version: '^8.11.0', dev: false, packageManager: 'npm', condition: 'drizzle' },
    { name: '@types/pg', version: '^8.10.0', dev: true, packageManager: 'npm', condition: 'drizzle && typescript' },
  ],
  
  envVars: [
    {
      key: 'DATABASE_URL',
      value: 'postgresql://postgres:postgres@localhost:5432/mydb',
      description: 'PostgreSQL connection string',
      required: true,
      secret: true,
      environments: ['development', 'staging', 'production'],
    },
    {
      key: 'POSTGRES_USER',
      value: 'postgres',
      description: 'PostgreSQL username',
      required: false,
      secret: false,
      environments: ['development'],
    },
    {
      key: 'POSTGRES_PASSWORD',
      value: 'postgres',
      description: 'PostgreSQL password',
      required: false,
      secret: true,
      environments: ['development'],
    },
  ],
  
  docker: {
    baseImage: 'postgres:16-alpine',
    ports: [5432],
    volumes: ['postgres_data:/var/lib/postgresql/data'],
    commands: [],
    healthCheck: 'pg_isready -U postgres',
  },
};
```

### MySQL Configuration

```typescript
// src/services/config/database/mysql.ts

const MYSQL_CONFIG: FrameworkConfig = {
  id: 'mysql',
  name: 'MySQL',
  type: 'database',
  version: '8.0',
  
  compatibleWith: ['node-express', 'python-fastapi', 'go-gin', 'nextjs', 'prisma', 'drizzle'],
  incompatibleWith: [],
  
  files: [
    // Prisma schema
    {
      path: 'prisma/schema.prisma',
      condition: 'prisma',
      content: (ctx) => `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255)
  name      String?  @db.VarChar(255)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
      `.trim(),
    },
    
    // Drizzle schema
    {
      path: 'src/db/schema.ts',
      condition: 'drizzle',
      content: `
import { mysqlTable, serial, varchar, text, boolean, timestamp, int } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
      `.trim(),
    },
    
    // Drizzle config
    {
      path: 'drizzle.config.ts',
      condition: 'drizzle',
      content: `
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'mysql2',
  dbCredentials: {
    uri: process.env.DATABASE_URL!,
  },
} satisfies Config;
      `.trim(),
    },
    
    // Database connection (Drizzle)
    {
      path: 'src/db/index.ts',
      condition: 'drizzle',
      content: `
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const pool = mysql.createPool(process.env.DATABASE_URL!);

export const db = drizzle(pool, { schema, mode: 'default' });
      `.trim(),
    },
    
    // Docker compose for MySQL
    {
      path: 'docker-compose.yml',
      merge: true,
      content: (ctx) => `
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-${ctx.projectName}}
      MYSQL_USER: \${MYSQL_USER:-user}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD:-password}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: '@prisma/client', version: '^5.9.0', dev: false, packageManager: 'npm', condition: 'prisma' },
    { name: 'prisma', version: '^5.9.0', dev: true, packageManager: 'npm', condition: 'prisma' },
    { name: 'drizzle-orm', version: '^0.29.0', dev: false, packageManager: 'npm', condition: 'drizzle' },
    { name: 'drizzle-kit', version: '^0.20.0', dev: true, packageManager: 'npm', condition: 'drizzle' },
    { name: 'mysql2', version: '^3.9.0', dev: false, packageManager: 'npm', condition: 'drizzle' },
  ],
  
  envVars: [
    {
      key: 'DATABASE_URL',
      value: 'mysql://user:password@localhost:3306/mydb',
      description: 'MySQL connection string',
      required: true,
      secret: true,
      environments: ['development', 'staging', 'production'],
    },
  ],
  
  docker: {
    baseImage: 'mysql:8.0',
    ports: [3306],
    volumes: ['mysql_data:/var/lib/mysql'],
    commands: [],
    healthCheck: 'mysqladmin ping -h localhost',
  },
};
```

### MongoDB Configuration

```typescript
// src/services/config/database/mongodb.ts

const MONGODB_CONFIG: FrameworkConfig = {
  id: 'mongodb',
  name: 'MongoDB',
  type: 'database',
  version: '7.0',
  
  compatibleWith: ['node-express', 'python-fastapi', 'go-gin', 'nextjs'],
  incompatibleWith: ['prisma', 'drizzle'],
  
  files: [
    // MongoDB connection (Node.js)
    {
      path: 'src/lib/mongodb.ts',
      condition: 'node-express || nextjs',
      content: `
import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'mydb';

let client: MongoClient;
let db: Db;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  console.log('Connected to MongoDB');
  return db;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

export { db };
      `.trim(),
    },
    
    // Mongoose models
    {
      path: 'src/models/User.ts',
      condition: 'mongoose',
      content: `
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
      `.trim(),
    },
    
    // Mongoose connection
    {
      path: 'src/lib/mongoose.ts',
      condition: 'mongoose',
      content: `
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mydb';

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  return mongoose.connect(MONGODB_URI);
}

export default mongoose;
      `.trim(),
    },
    
    // Docker compose for MongoDB
    {
      path: 'docker-compose.yml',
      merge: true,
      content: (ctx) => `
services:
  mongodb:
    image: mongo:7.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_USER:-root}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_PASSWORD:-password}
      MONGO_INITDB_DATABASE: \${MONGO_DB:-${ctx.projectName}}
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  mongodb_data:
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'mongodb', version: '^6.3.0', dev: false, packageManager: 'npm' },
    { name: 'mongoose', version: '^8.1.0', dev: false, packageManager: 'npm', condition: 'mongoose' },
    { name: '@types/mongoose', version: '^5.11.0', dev: true, packageManager: 'npm', condition: 'mongoose && typescript' },
  ],
  
  envVars: [
    {
      key: 'MONGODB_URI',
      value: 'mongodb://localhost:27017/mydb',
      description: 'MongoDB connection string',
      required: true,
      secret: true,
      environments: ['development', 'staging', 'production'],
    },
    {
      key: 'MONGODB_DB',
      value: 'mydb',
      description: 'MongoDB database name',
      required: false,
      secret: false,
      environments: ['development', 'staging', 'production'],
    },
  ],
  
  docker: {
    baseImage: 'mongo:7.0',
    ports: [27017],
    volumes: ['mongodb_data:/data/db'],
    commands: [],
    healthCheck: "echo 'db.runCommand(\"ping\").ok' | mongosh localhost:27017/test --quiet",
  },
};
```

### Redis Configuration

```typescript
// src/services/config/database/redis.ts

const REDIS_CONFIG: FrameworkConfig = {
  id: 'redis',
  name: 'Redis',
  type: 'cache',
  version: '7.2',
  
  compatibleWith: ['node-express', 'python-fastapi', 'go-gin', 'nextjs'],
  incompatibleWith: [],
  
  files: [
    // Redis client (Node.js)
    {
      path: 'src/lib/redis.ts',
      condition: 'node-express || nextjs',
      content: `
import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: RedisClientType;

export async function getRedisClient(): Promise<RedisClientType> {
  if (client && client.isOpen) {
    return client;
  }

  client = createClient({ url: REDIS_URL });

  client.on('error', (err) => console.error('Redis Client Error', err));
  client.on('connect', () => console.log('Connected to Redis'));

  await client.connect();
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    console.log('Disconnected from Redis');
  }
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<void> {
  const redis = await getRedisClient();
  const serialized = JSON.stringify(value);
  
  if (ttlSeconds) {
    await redis.setEx(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const redis = await getRedisClient();
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(keys);
  }
}

export { client as redis };
      `.trim(),
    },
    
    // Session store with Redis
    {
      path: 'src/lib/session.ts',
      condition: 'session',
      content: `
import session from 'express-session';
import RedisStore from 'connect-redis';
import { getRedisClient } from './redis';

export async function createSessionMiddleware() {
  const redisClient = await getRedisClient();

  return session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  });
}
      `.trim(),
    },
    
    // Rate limiter with Redis
    {
      path: 'src/middleware/rateLimiter.ts',
      condition: 'rateLimit',
      content: `
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../lib/redis';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl:' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = await getRedisClient();
    const key = \`\${keyPrefix}\${req.ip}\`;

    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }

    if (current > max) {
      return res.status(429).json({
        error: 'Too many requests, please try again later.',
      });
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));

    next();
  };
}
      `.trim(),
    },
    
    // Docker compose for Redis
    {
      path: 'docker-compose.yml',
      merge: true,
      content: `
services:
  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes

volumes:
  redis_data:
      `.trim(),
    },
  ],
  
  dependencies: [
    { name: 'redis', version: '^4.6.0', dev: false, packageManager: 'npm' },
    { name: 'connect-redis', version: '^7.1.0', dev: false, packageManager: 'npm', condition: 'session' },
    { name: 'express-session', version: '^1.17.0', dev: false, packageManager: 'npm', condition: 'session' },
    { name: '@types/express-session', version: '^1.17.0', dev: true, packageManager: 'npm', condition: 'session && typescript' },
  ],
  
  envVars: [
    {
      key: 'REDIS_URL',
      value: 'redis://localhost:6379',
      description: 'Redis connection string',
      required: true,
      secret: true,
      environments: ['development', 'staging', 'production'],
    },
    {
      key: 'SESSION_SECRET',
      description: 'Session secret for cookie signing',
      required: true,
      secret: true,
      environments: ['development', 'staging', 'production'],
    },
  ],
  
  docker: {
    baseImage: 'redis:7.2-alpine',
    ports: [6379],
    volumes: ['redis_data:/data'],
    commands: ['redis-server --appendonly yes'],
    healthCheck: 'redis-cli ping',
  },
};
```

---

## 5. Configuration Composition Engine

### Main Composition Engine

```typescript
// src/services/config/configComposer.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { merge } from 'lodash';

interface CompositionOptions {
  frontend?: string;
  backend?: string;
  databases?: string[];
  features?: string[];
  parameters?: Record<string, any>;
}

interface CompositionResult {
  success: boolean;
  files: string[];
  dependencies: {
    npm: Record<string, string>;
    pip: Record<string, string>;
    go: string[];
  };
  envVars: EnvVar[];
  dockerCompose: string;
  errors: string[];
}

class ConfigComposer {
  private projectPath: string;
  private configs: Map<string, FrameworkConfig>;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configs = new Map();
    this.loadConfigs();
  }

  private loadConfigs(): void {
    // Load all framework configs
    this.configs.set('nextjs', NEXTJS_CONFIG);
    this.configs.set('vite', VITE_CONFIG);
    this.configs.set('cra', CRA_CONFIG);
    this.configs.set('node-express', NODE_EXPRESS_CONFIG);
    this.configs.set('python-fastapi', PYTHON_FASTAPI_CONFIG);
    this.configs.set('go-gin', GO_GIN_CONFIG);
    this.configs.set('postgresql', POSTGRESQL_CONFIG);
    this.configs.set('mysql', MYSQL_CONFIG);
    this.configs.set('mongodb', MONGODB_CONFIG);
    this.configs.set('redis', REDIS_CONFIG);
  }

  async compose(options: CompositionOptions): Promise<CompositionResult> {
    const errors: string[] = [];
    const files: string[] = [];
    const dependencies = {
      npm: {} as Record<string, string>,
      pip: {} as Record<string, string>,
      go: [] as string[],
    };
    const envVars: EnvVar[] = [];
    const dockerServices: string[] = [];

    // Create context
    const context: ConfigContext = {
      projectName: options.parameters?.projectName || 'my-app',
      frameworks: [options.frontend, options.backend].filter(Boolean) as string[],
      databases: options.databases || [],
      features: options.features || [],
      parameters: options.parameters || {},
    };

    // Validate compatibility
    const compatibilityErrors = this.validateCompatibility(options);
    if (compatibilityErrors.length > 0) {
      return {
        success: false,
        files: [],
        dependencies,
        envVars: [],
        dockerCompose: '',
        errors: compatibilityErrors,
      };
    }

    // Process frontend
    if (options.frontend) {
      const result = await this.processConfig(options.frontend, context);
      files.push(...result.files);
      Object.assign(dependencies.npm, result.npmDeps);
      envVars.push(...result.envVars);
      if (result.dockerService) dockerServices.push(result.dockerService);
    }

    // Process backend
    if (options.backend) {
      const result = await this.processConfig(options.backend, context);
      files.push(...result.files);
      
      if (options.backend.startsWith('python')) {
        Object.assign(dependencies.pip, result.pipDeps);
      } else if (options.backend.startsWith('go')) {
        dependencies.go.push(...result.goDeps);
      } else {
        Object.assign(dependencies.npm, result.npmDeps);
      }
      
      envVars.push(...result.envVars);
      if (result.dockerService) dockerServices.push(result.dockerService);
    }

    // Process databases
    for (const db of options.databases || []) {
      const result = await this.processConfig(db, context);
      files.push(...result.files);
      Object.assign(dependencies.npm, result.npmDeps);
      envVars.push(...result.envVars);
      if (result.dockerService) dockerServices.push(result.dockerService);
    }

    // Generate docker-compose.yml
    const dockerCompose = this.generateDockerCompose(dockerServices, context);

    // Generate package.json
    await this.generatePackageJson(dependencies.npm, context);

    // Generate .env.example
    await this.generateEnvExample(envVars);

    return {
      success: true,
      files,
      dependencies,
      envVars,
      dockerCompose,
      errors,
    };
  }

  private validateCompatibility(options: CompositionOptions): string[] {
    const errors: string[] = [];

    // Check frontend-backend compatibility
    if (options.frontend && options.backend) {
      const frontendConfig = this.configs.get(options.frontend);
      const backendConfig = this.configs.get(options.backend);

      if (frontendConfig && backendConfig) {
        if (frontendConfig.incompatibleWith.includes(options.backend)) {
          errors.push(`${options.frontend} is incompatible with ${options.backend}`);
        }
      }
    }

    // Check database compatibility
    for (const db of options.databases || []) {
      const dbConfig = this.configs.get(db);
      if (dbConfig) {
        if (options.backend && !dbConfig.compatibleWith.includes(options.backend)) {
          errors.push(`${db} may not be fully compatible with ${options.backend}`);
        }
      }
    }

    return errors;
  }

  private async processConfig(
    configId: string,
    context: ConfigContext
  ): Promise<{
    files: string[];
    npmDeps: Record<string, string>;
    pipDeps: Record<string, string>;
    goDeps: string[];
    envVars: EnvVar[];
    dockerService?: string;
  }> {
    const config = this.configs.get(configId);
    if (!config) {
      return { files: [], npmDeps: {}, pipDeps: {}, goDeps: [], envVars: [] };
    }

    const files: string[] = [];
    const npmDeps: Record<string, string> = {};
    const pipDeps: Record<string, string> = {};
    const goDeps: string[] = [];

    // Process files
    for (const file of config.files) {
      // Check condition
      if (file.condition && !this.evaluateCondition(file.condition, context)) {
        continue;
      }

      // Generate content
      const content = typeof file.content === 'function'
        ? file.content(context)
        : file.content;

      // Write file
      const fullPath = path.join(this.projectPath, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      if (file.merge) {
        await this.mergeFile(fullPath, content);
      } else {
        await fs.writeFile(fullPath, content);
      }

      files.push(file.path);
    }

    // Process dependencies
    for (const dep of config.dependencies) {
      if (dep.condition && !this.evaluateCondition(dep.condition, context)) {
        continue;
      }

      switch (dep.packageManager) {
        case 'npm':
          npmDeps[dep.name] = dep.version;
          break;
        case 'pip':
          pipDeps[dep.name] = dep.version;
          break;
        case 'go':
          goDeps.push(`${dep.name}@${dep.version}`);
          break;
      }
    }

    return {
      files,
      npmDeps,
      pipDeps,
      goDeps,
      envVars: config.envVars,
      dockerService: config.docker ? this.generateDockerService(config, context) : undefined,
    };
  }

  private evaluateCondition(condition: string, context: ConfigContext): boolean {
    // Simple condition evaluation
    const tokens = condition.split(/\s*(&&|\|\|)\s*/);
    let result = this.evaluateSingleCondition(tokens[0], context);

    for (let i = 1; i < tokens.length; i += 2) {
      const operator = tokens[i];
      const nextCondition = this.evaluateSingleCondition(tokens[i + 1], context);

      if (operator === '&&') {
        result = result && nextCondition;
      } else if (operator === '||') {
        result = result || nextCondition;
      }
    }

    return result;
  }

  private evaluateSingleCondition(condition: string, context: ConfigContext): boolean {
    const trimmed = condition.trim();
    
    // Check if it's a negation
    if (trimmed.startsWith('!')) {
      return !this.evaluateSingleCondition(trimmed.slice(1), context);
    }

    // Check frameworks
    if (context.frameworks.includes(trimmed)) return true;

    // Check databases
    if (context.databases.includes(trimmed)) return true;

    // Check features
    if (context.features.includes(trimmed)) return true;

    return false;
  }

  private async mergeFile(filePath: string, newContent: string): Promise<void> {
    try {
      const existing = await fs.readFile(filePath, 'utf-8');
      
      // For YAML files (docker-compose), merge services
      if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
        const yaml = await import('js-yaml');
        const existingObj = yaml.load(existing) as any;
        const newObj = yaml.load(newContent) as any;
        const merged = merge(existingObj, newObj);
        await fs.writeFile(filePath, yaml.dump(merged));
      } else {
        // For other files, append
        await fs.writeFile(filePath, existing + '\n' + newContent);
      }
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(filePath, newContent);
    }
  }

  private generateDockerService(config: FrameworkConfig, context: ConfigContext): string {
    if (!config.docker) return '';

    const serviceName = config.id.replace(/-/g, '_');
    const ports = config.docker.ports.map(p => `      - "${p}:${p}"`).join('\n');
    const volumes = config.docker.volumes.map(v => `      - ${v}`).join('\n');

    return `
  ${serviceName}:
    image: ${config.docker.baseImage}
    ports:
${ports}
${volumes ? `    volumes:\n${volumes}` : ''}
${config.docker.healthCheck ? `    healthcheck:
      test: ${JSON.stringify(config.docker.healthCheck.split(' '))}
      interval: 5s
      timeout: 5s
      retries: 5` : ''}
    `.trim();
  }

  private generateDockerCompose(services: string[], context: ConfigContext): string {
    return `
version: '3.8'

services:
${services.join('\n\n')}

volumes:
  ${context.databases.map(db => `${db}_data:`).join('\n  ')}
    `.trim();
  }

  private async generatePackageJson(
    dependencies: Record<string, string>,
    context: ConfigContext
  ): Promise<void> {
    const devDeps: Record<string, string> = {};
    const prodDeps: Record<string, string> = {};

    for (const [name, version] of Object.entries(dependencies)) {
      if (name.startsWith('@types/') || ['typescript', 'vitest', 'jest'].some(d => name.includes(d))) {
        devDeps[name] = version;
      } else {
        prodDeps[name] = version;
      }
    }

    const packageJson = {
      name: context.projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'npm run start:dev',
        build: 'npm run build:prod',
        start: 'npm run start:prod',
        test: 'vitest',
      },
      dependencies: prodDeps,
      devDependencies: devDeps,
    };

    const fullPath = path.join(this.projectPath, 'package.json');
    await fs.writeFile(fullPath, JSON.stringify(packageJson, null, 2));
  }

  private async generateEnvExample(envVars: EnvVar[]): Promise<void> {
    const lines: string[] = ['# Environment Variables', ''];

    // Group by category
    const grouped = new Map<string, EnvVar[]>();
    for (const env of envVars) {
      const category = env.key.split('_')[0];
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(env);
    }

    for (const [category, vars] of grouped) {
      lines.push(`# ${category}`);
      for (const env of vars) {
        const required = env.required ? '(required)' : '(optional)';
        lines.push(`# ${env.description} ${required}`);
        lines.push(`${env.key}=${env.value || ''}`);
        lines.push('');
      }
    }

    const fullPath = path.join(this.projectPath, '.env.example');
    await fs.writeFile(fullPath, lines.join('\n'));
  }
}

export { ConfigComposer, CompositionOptions, CompositionResult };
```

---

## 6. Environment-Specific Configurations

### Environment Manager

```typescript
// src/services/config/environmentManager.ts

type Environment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  name: Environment;
  variables: Record<string, string>;
  features: string[];
  settings: Record<string, any>;
}

const ENVIRONMENT_CONFIGS: Record<Environment, Partial<EnvironmentConfig>> = {
  development: {
    features: ['debug', 'hotReload', 'sourceMaps'],
    settings: {
      logLevel: 'debug',
      minify: false,
      sourceMaps: true,
      apiMocking: true,
    },
  },
  staging: {
    features: ['debug', 'sourceMaps'],
    settings: {
      logLevel: 'info',
      minify: true,
      sourceMaps: true,
      apiMocking: false,
    },
  },
  production: {
    features: [],
    settings: {
      logLevel: 'error',
      minify: true,
      sourceMaps: false,
      apiMocking: false,
    },
  },
};

class EnvironmentManager {
  private environment: Environment;
  private config: EnvironmentConfig;

  constructor(environment: Environment = 'development') {
    this.environment = environment;
    this.config = this.loadConfig(environment);
  }

  private loadConfig(env: Environment): EnvironmentConfig {
    const baseConfig = ENVIRONMENT_CONFIGS[env];
    return {
      name: env,
      variables: {},
      features: baseConfig.features || [],
      settings: baseConfig.settings || {},
    };
  }

  // Get environment-specific value
  get<T>(key: string, defaultValue: T): T {
    return (this.config.settings[key] as T) ?? defaultValue;
  }

  // Check if feature is enabled
  hasFeature(feature: string): boolean {
    return this.config.features.includes(feature);
  }

  // Generate environment-specific config files
  async generateConfigs(projectPath: string): Promise<void> {
    // Generate .env files for each environment
    for (const env of ['development', 'staging', 'production'] as Environment[]) {
      const envConfig = this.loadConfig(env);
      const content = this.generateEnvFile(envConfig);
      
      const filename = env === 'development' ? '.env.local' : `.env.${env}`;
      await fs.writeFile(path.join(projectPath, filename), content);
    }
  }

  private generateEnvFile(config: EnvironmentConfig): string {
    const lines: string[] = [
      `# ${config.name.toUpperCase()} Environment`,
      `NODE_ENV=${config.name}`,
      '',
    ];

    for (const [key, value] of Object.entries(config.variables)) {
      lines.push(`${key}=${value}`);
    }

    return lines.join('\n');
  }
}

export { EnvironmentManager, Environment, EnvironmentConfig };
```

---

## 7. Configuration Validation

### Config Validator

```typescript
// src/services/config/configValidator.ts

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity: 'error';
}

interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  severity: 'warning';
}

class ConfigValidator {
  // Validate entire configuration
  validate(options: CompositionOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate frontend
    if (options.frontend) {
      this.validateFramework(options.frontend, 'frontend', errors, warnings);
    }

    // Validate backend
    if (options.backend) {
      this.validateFramework(options.backend, 'backend', errors, warnings);
    }

    // Validate databases
    for (const db of options.databases || []) {
      this.validateDatabase(db, errors, warnings);
    }

    // Validate compatibility
    this.validateCompatibility(options, errors, warnings);

    // Validate required parameters
    this.validateParameters(options, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateFramework(
    framework: string,
    type: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const validFrameworks = {
      frontend: ['nextjs', 'vite', 'cra'],
      backend: ['node-express', 'python-fastapi', 'go-gin'],
    };

    if (!validFrameworks[type as keyof typeof validFrameworks]?.includes(framework)) {
      errors.push({
        code: 'INVALID_FRAMEWORK',
        message: `Invalid ${type} framework: ${framework}`,
        severity: 'error',
      });
    }
  }

  private validateDatabase(
    database: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const validDatabases = ['postgresql', 'mysql', 'mongodb', 'redis'];

    if (!validDatabases.includes(database)) {
      errors.push({
        code: 'INVALID_DATABASE',
        message: `Invalid database: ${database}`,
        severity: 'error',
      });
    }
  }

  private validateCompatibility(
    options: CompositionOptions,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check for known incompatibilities
    if (options.frontend === 'nextjs' && options.backend) {
      warnings.push({
        code: 'NEXTJS_HAS_BACKEND',
        message: 'Next.js includes API routes; separate backend may be redundant',
        severity: 'warning',
      });
    }

    // Check database ORM compatibility
    if (options.databases?.includes('mongodb') && options.features?.includes('prisma')) {
      warnings.push({
        code: 'MONGODB_PRISMA',
        message: 'Prisma MongoDB support is limited; consider Mongoose instead',
        severity: 'warning',
      });
    }
  }

  private validateParameters(
    options: CompositionOptions,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check required parameters
    if (!options.parameters?.projectName) {
      errors.push({
        code: 'MISSING_PROJECT_NAME',
        message: 'Project name is required',
        severity: 'error',
      });
    }

    // Validate project name format
    if (options.parameters?.projectName && !/^[a-z0-9-]+$/.test(options.parameters.projectName)) {
      errors.push({
        code: 'INVALID_PROJECT_NAME',
        message: 'Project name must be lowercase alphanumeric with hyphens only',
        severity: 'error',
      });
    }
  }
}

export { ConfigValidator, ValidationResult, ValidationError, ValidationWarning };
```

---

## 8. Complete Examples

### Example 1: Next.js + PostgreSQL + Prisma

```typescript
const options: CompositionOptions = {
  frontend: 'nextjs',
  databases: ['postgresql'],
  features: ['typescript', 'tailwind', 'prisma', 'auth'],
  parameters: {
    projectName: 'my-nextjs-app',
    description: 'A Next.js application with PostgreSQL',
  },
};

const composer = new ConfigComposer('/projects/my-nextjs-app');
const result = await composer.compose(options);

// Generated files:
// - next.config.js
// - tsconfig.json
// - tailwind.config.ts
// - src/app/layout.tsx
// - src/app/page.tsx
// - src/app/api/health/route.ts
// - src/middleware.ts
// - prisma/schema.prisma
// - src/lib/prisma.ts
// - docker-compose.yml
// - package.json
// - .env.example
```

### Example 2: Vite + React + Node.js + MongoDB

```typescript
const options: CompositionOptions = {
  frontend: 'vite',
  backend: 'node-express',
  databases: ['mongodb', 'redis'],
  features: ['react', 'typescript', 'tailwind', 'auth', 'mongoose'],
  parameters: {
    projectName: 'my-fullstack-app',
    port: 3000,
    apiUrl: 'http://localhost:4000',
  },
};

const composer = new ConfigComposer('/projects/my-fullstack-app');
const result = await composer.compose(options);

// Generated files:
// Frontend:
// - vite.config.ts
// - index.html
// - src/main.tsx
// - src/App.tsx
// - tailwind.config.js
// - tsconfig.json
//
// Backend:
// - src/index.ts
// - src/routes/index.ts
// - src/middleware/errorHandler.ts
// - src/middleware/auth.ts
// - src/lib/mongodb.ts
// - src/lib/redis.ts
// - src/models/User.ts
//
// Infrastructure:
// - docker-compose.yml
// - package.json
// - .env.example
```

### Example 3: Python FastAPI + PostgreSQL

```typescript
const options: CompositionOptions = {
  backend: 'python-fastapi',
  databases: ['postgresql', 'redis'],
  features: ['auth'],
  parameters: {
    projectName: 'my-python-api',
    port: 8000,
    fastapiVersion: '0.109.0',
  },
};

const composer = new ConfigComposer('/projects/my-python-api');
const result = await composer.compose(options);

// Generated files:
// - app/main.py
// - app/db.py
// - app/models.py
// - app/routers/api.py
// - app/routers/auth.py
// - requirements.txt
// - pyproject.toml
// - Dockerfile
// - docker-compose.yml
// - .env.example
```

### Example 4: Go Gin + MySQL

```typescript
const options: CompositionOptions = {
  backend: 'go-gin',
  databases: ['mysql', 'redis'],
  features: ['auth'],
  parameters: {
    projectName: 'my-go-api',
    port: 8080,
  },
};

const composer = new ConfigComposer('/projects/my-go-api');
const result = await composer.compose(options);

// Generated files:
// - main.go
// - models.go
// - auth.go
// - go.mod
// - Dockerfile
// - docker-compose.yml
// - .env.example
```

---

## Summary

### Supported Configurations

| Category | Options |
|----------|---------|
| **Frontend** | Next.js, Vite, Create React App |
| **Backend** | Node.js + Express, Python + FastAPI, Go + Gin |
| **Database** | PostgreSQL, MySQL, MongoDB |
| **Cache** | Redis |
| **ORM** | Prisma, Drizzle, Mongoose, GORM |

### Key Features

✅ **Framework-specific configurations** - Tailored for each framework
✅ **Database integrations** - Complete setup with ORMs
✅ **Docker support** - docker-compose for all services
✅ **Environment management** - Dev, staging, production configs
✅ **Validation** - Compatibility and parameter validation
✅ **Conditional generation** - Features toggle file generation
✅ **Merge support** - Combine configurations from multiple sources

This comprehensive configuration system enables flexible, production-ready project generation across multiple tech stacks!
