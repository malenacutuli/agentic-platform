# Parameterized Templates Guide

## Overview

This guide covers how to create parameterized templates that allow users to customize projects with optional features like "Create a React app with Tailwind and Supabase". It includes feature toggles, conditional generation, and dynamic scaffolding.

---

## Table of Contents

1. [Template Parameterization Architecture](#1-template-parameterization-architecture)
2. [Feature Definition System](#2-feature-definition-system)
3. [Conditional File Generation](#3-conditional-file-generation)
4. [Dynamic Code Injection](#4-dynamic-code-injection)
5. [Feature Composition Engine](#5-feature-composition-engine)
6. [Natural Language Feature Parsing](#6-natural-language-feature-parsing)
7. [Feature Dependency Resolution](#7-feature-dependency-resolution)
8. [Complete Example: React + Tailwind + Supabase](#8-complete-example)

---

## 1. Template Parameterization Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Template Parameterization Flow                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Request                                                               │
│  "Create a React app with Tailwind and Supabase"                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                        │
│  │ NLP Parser      │ → Extract: framework=react, styling=tailwind,         │
│  │                 │            database=supabase                           │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Feature         │ → Resolve dependencies: react needs vite,             │
│  │ Resolver        │   supabase needs auth, tailwind needs postcss         │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Template        │ → Select base template: web-static or web-db-user     │
│  │ Selector        │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Code Generator  │ → Generate files with feature-specific code           │
│  │                 │   Inject dependencies, configs, components            │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ Post-Processor  │ → Run feature-specific setup scripts                  │
│  │                 │   Initialize databases, configure services            │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  Complete Project with All Features Integrated                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Parameter Types

```typescript
// src/services/templates/parameterTypes.ts

type ParameterType = 
  | 'boolean'      // true/false toggle
  | 'string'       // text input
  | 'number'       // numeric input
  | 'select'       // single selection from options
  | 'multiselect'  // multiple selections from options
  | 'object'       // nested configuration
  | 'array';       // list of values

interface TemplateParameter {
  name: string;
  type: ParameterType;
  label: string;
  description: string;
  default?: any;
  required: boolean;
  
  // For select/multiselect
  options?: ParameterOption[];
  
  // For validation
  validation?: ParameterValidation;
  
  // For conditional display
  condition?: ParameterCondition;
  
  // For dependencies
  dependsOn?: string[];
  conflicts?: string[];
}

interface ParameterOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  tags?: string[];
}

interface ParameterValidation {
  pattern?: string;        // Regex pattern
  min?: number;            // Min value/length
  max?: number;            // Max value/length
  custom?: (value: any) => boolean | string;
}

interface ParameterCondition {
  parameter: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'exists';
  value?: any;
}
```

---

## 2. Feature Definition System

### Feature Registry

```typescript
// src/services/templates/featureRegistry.ts

interface Feature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  icon: string;
  
  // Dependencies
  requires: string[];           // Required features
  conflicts: string[];          // Incompatible features
  optionalWith: string[];       // Enhanced when combined
  
  // Files to add/modify
  files: FeatureFile[];
  
  // Dependencies to install
  dependencies: FeatureDependency[];
  
  // Environment variables
  envVars: FeatureEnvVar[];
  
  // Post-install scripts
  scripts: FeatureScript[];
  
  // Configuration
  config: FeatureConfig;
}

type FeatureCategory = 
  | 'framework'      // React, Vue, Svelte
  | 'styling'        // Tailwind, CSS Modules, Styled Components
  | 'database'       // Supabase, Firebase, PostgreSQL
  | 'auth'           // Auth0, Clerk, NextAuth
  | 'api'            // tRPC, GraphQL, REST
  | 'testing'        // Jest, Vitest, Playwright
  | 'deployment'     // Vercel, Netlify, Docker
  | 'monitoring'     // Sentry, LogRocket
  | 'payment'        // Stripe, PayPal
  | 'storage'        // S3, Cloudinary
  | 'email'          // SendGrid, Resend
  | 'ai'             // OpenAI, Anthropic
  | 'realtime'       // Socket.io, Pusher
  | 'analytics';     // Posthog, Mixpanel

interface FeatureFile {
  path: string;                 // Relative path in project
  action: 'create' | 'modify' | 'delete';
  template?: string;            // Template content or path
  insertions?: FileInsertion[]; // For modify action
  condition?: string;           // Conditional inclusion
}

interface FileInsertion {
  marker: string;               // Where to insert
  position: 'before' | 'after' | 'replace';
  content: string;              // Content to insert
}

interface FeatureDependency {
  name: string;
  version: string;
  dev: boolean;
  condition?: string;
}

interface FeatureEnvVar {
  key: string;
  description: string;
  required: boolean;
  default?: string;
  secret: boolean;
}

interface FeatureScript {
  name: string;
  command: string;
  runOn: 'install' | 'build' | 'dev' | 'manual';
}

interface FeatureConfig {
  files?: Record<string, any>;  // Config file contents
  packageJson?: Record<string, any>; // package.json additions
}
```

### Complete Feature Definitions

```typescript
// src/services/templates/features/index.ts

const FEATURE_REGISTRY: Map<string, Feature> = new Map([
  // ============================================
  // FRAMEWORK FEATURES
  // ============================================
  ['react', {
    id: 'react',
    name: 'React',
    description: 'A JavaScript library for building user interfaces',
    category: 'framework',
    icon: '⚛️',
    requires: [],
    conflicts: ['vue', 'svelte', 'angular'],
    optionalWith: ['typescript', 'tailwind'],
    
    dependencies: [
      { name: 'react', version: '^18.2.0', dev: false },
      { name: 'react-dom', version: '^18.2.0', dev: false },
      { name: '@vitejs/plugin-react', version: '^4.0.0', dev: true },
    ],
    
    files: [
      {
        path: 'src/main.tsx',
        action: 'create',
        template: `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
{{#if tailwind}}
import './index.css';
{{/if}}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
        `,
      },
      {
        path: 'src/App.tsx',
        action: 'create',
        template: `
{{#if typescript}}
import React from 'react';
{{/if}}

function App() {
  return (
    <div{{#if tailwind}} className="min-h-screen bg-gray-100"{{/if}}>
      <h1>Welcome to {{projectName}}</h1>
    </div>
  );
}

export default App;
        `,
      },
      {
        path: 'vite.config.ts',
        action: 'create',
        template: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
        `,
      },
    ],
    
    envVars: [],
    scripts: [],
    config: {
      packageJson: {
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
      },
    },
  }],

  // ============================================
  // STYLING FEATURES
  // ============================================
  ['tailwind', {
    id: 'tailwind',
    name: 'Tailwind CSS',
    description: 'A utility-first CSS framework',
    category: 'styling',
    icon: '🎨',
    requires: [],
    conflicts: ['bootstrap', 'bulma'],
    optionalWith: ['react', 'vue'],
    
    dependencies: [
      { name: 'tailwindcss', version: '^3.4.0', dev: true },
      { name: 'postcss', version: '^8.4.0', dev: true },
      { name: 'autoprefixer', version: '^10.4.0', dev: true },
    ],
    
    files: [
      {
        path: 'tailwind.config.js',
        action: 'create',
        template: `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      {{#if customColors}}
      colors: {
        primary: '{{primaryColor}}',
        secondary: '{{secondaryColor}}',
      },
      {{/if}}
    },
  },
  plugins: [
    {{#if typography}}
    require('@tailwindcss/typography'),
    {{/if}}
    {{#if forms}}
    require('@tailwindcss/forms'),
    {{/if}}
  ],
};
        `,
      },
      {
        path: 'postcss.config.js',
        action: 'create',
        template: `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
        `,
      },
      {
        path: 'src/index.css',
        action: 'create',
        template: `
@tailwind base;
@tailwind components;
@tailwind utilities;

{{#if customStyles}}
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90;
  }
}
{{/if}}
        `,
      },
    ],
    
    envVars: [],
    scripts: [],
    config: {},
  }],

  // ============================================
  // DATABASE FEATURES
  // ============================================
  ['supabase', {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with PostgreSQL',
    category: 'database',
    icon: '⚡',
    requires: [],
    conflicts: ['firebase'],
    optionalWith: ['auth', 'storage'],
    
    dependencies: [
      { name: '@supabase/supabase-js', version: '^2.39.0', dev: false },
      { name: '@supabase/auth-helpers-react', version: '^0.4.0', dev: false, condition: 'react' },
    ],
    
    files: [
      {
        path: 'src/lib/supabase.ts',
        action: 'create',
        template: `
import { createClient } from '@supabase/supabase-js';
{{#if typescript}}
import type { Database } from './database.types';
{{/if}}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient{{#if typescript}}<Database>{{/if}}(
  supabaseUrl,
  supabaseAnonKey
);

// Auth helpers
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
        `,
      },
      {
        path: 'src/lib/database.types.ts',
        action: 'create',
        condition: 'typescript',
        template: `
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Add your table types here
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
        `,
      },
      {
        path: 'src/hooks/useSupabase.ts',
        action: 'create',
        condition: 'react',
        template: `
import { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    getCurrentUser().then(setUser).finally(() => setLoading(false));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useSupabaseQuery<T>(
  tableName: string,
  options?: {
    select?: string;
    filter?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        let query = supabase
          .from(tableName)
          .select(options?.select || '*');

        if (options?.filter) {
          for (const [key, value] of Object.entries(options.filter)) {
            query = query.eq(key, value);
          }
        }

        if (options?.orderBy) {
          query = query.order(options.orderBy.column, {
            ascending: options.orderBy.ascending ?? true,
          });
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;
        setData(data as T[]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tableName, JSON.stringify(options)]);

  return { data, loading, error };
}
        `,
      },
      {
        path: 'src/components/AuthProvider.tsx',
        action: 'create',
        condition: 'react',
        template: `
import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../hooks/useSupabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
        `,
      },
    ],
    
    envVars: [
      {
        key: 'VITE_SUPABASE_URL',
        description: 'Your Supabase project URL',
        required: true,
        secret: false,
      },
      {
        key: 'VITE_SUPABASE_ANON_KEY',
        description: 'Your Supabase anonymous/public key',
        required: true,
        secret: false,
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        description: 'Your Supabase service role key (server-side only)',
        required: false,
        secret: true,
      },
    ],
    
    scripts: [
      {
        name: 'supabase:types',
        command: 'npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/database.types.ts',
        runOn: 'manual',
      },
    ],
    
    config: {
      packageJson: {
        scripts: {
          'supabase:types': 'supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/database.types.ts',
        },
      },
    },
  }],

  // ============================================
  // AUTH FEATURES
  // ============================================
  ['auth0', {
    id: 'auth0',
    name: 'Auth0',
    description: 'Authentication and authorization platform',
    category: 'auth',
    icon: '🔐',
    requires: [],
    conflicts: ['clerk', 'supabase-auth'],
    optionalWith: ['react'],
    
    dependencies: [
      { name: '@auth0/auth0-react', version: '^2.2.0', dev: false, condition: 'react' },
      { name: '@auth0/nextjs-auth0', version: '^3.5.0', dev: false, condition: 'nextjs' },
    ],
    
    files: [
      {
        path: 'src/components/Auth0Provider.tsx',
        action: 'create',
        condition: 'react',
        template: `
import { Auth0Provider as Provider } from '@auth0/auth0-react';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function Auth0Provider({ children }: Props) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const redirectUri = window.location.origin;

  if (!domain || !clientId) {
    throw new Error('Missing Auth0 environment variables');
  }

  return (
    <Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
      }}
    >
      {children}
    </Provider>
  );
}
        `,
      },
      {
        path: 'src/hooks/useAuth0.ts',
        action: 'create',
        condition: 'react',
        template: `
import { useAuth0 } from '@auth0/auth0-react';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginWithRedirect,
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    getToken: getAccessTokenSilently,
  };
}
        `,
      },
    ],
    
    envVars: [
      {
        key: 'VITE_AUTH0_DOMAIN',
        description: 'Your Auth0 domain (e.g., your-tenant.auth0.com)',
        required: true,
        secret: false,
      },
      {
        key: 'VITE_AUTH0_CLIENT_ID',
        description: 'Your Auth0 application client ID',
        required: true,
        secret: false,
      },
      {
        key: 'AUTH0_CLIENT_SECRET',
        description: 'Your Auth0 application client secret (server-side only)',
        required: false,
        secret: true,
      },
    ],
    
    scripts: [],
    config: {},
  }],

  // ============================================
  // TESTING FEATURES
  // ============================================
  ['vitest', {
    id: 'vitest',
    name: 'Vitest',
    description: 'Blazing fast unit test framework powered by Vite',
    category: 'testing',
    icon: '🧪',
    requires: [],
    conflicts: ['jest'],
    optionalWith: ['react', 'typescript'],
    
    dependencies: [
      { name: 'vitest', version: '^1.2.0', dev: true },
      { name: '@testing-library/react', version: '^14.1.0', dev: true, condition: 'react' },
      { name: '@testing-library/jest-dom', version: '^6.2.0', dev: true },
      { name: 'jsdom', version: '^24.0.0', dev: true },
    ],
    
    files: [
      {
        path: 'vitest.config.ts',
        action: 'create',
        template: `
import { defineConfig } from 'vitest/config';
{{#if react}}
import react from '@vitejs/plugin-react';
{{/if}}

export default defineConfig({
  {{#if react}}
  plugins: [react()],
  {{/if}}
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
        `,
      },
      {
        path: 'src/test/setup.ts',
        action: 'create',
        template: `
import '@testing-library/jest-dom';

// Add any global test setup here
        `,
      },
      {
        path: 'src/test/example.test.ts',
        action: 'create',
        template: `
import { describe, it, expect } from 'vitest';

describe('Example Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});
        `,
      },
    ],
    
    envVars: [],
    
    scripts: [
      {
        name: 'test',
        command: 'vitest',
        runOn: 'manual',
      },
      {
        name: 'test:coverage',
        command: 'vitest run --coverage',
        runOn: 'manual',
      },
    ],
    
    config: {
      packageJson: {
        scripts: {
          test: 'vitest',
          'test:run': 'vitest run',
          'test:coverage': 'vitest run --coverage',
        },
      },
    },
  }],

  // ============================================
  // AI FEATURES
  // ============================================
  ['openai', {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI API integration for GPT and DALL-E',
    category: 'ai',
    icon: '🤖',
    requires: [],
    conflicts: [],
    optionalWith: ['anthropic', 'langchain'],
    
    dependencies: [
      { name: 'openai', version: '^4.28.0', dev: false },
    ],
    
    files: [
      {
        path: 'src/lib/openai.ts',
        action: 'create',
        template: `
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const { model = 'gpt-4-turbo-preview', temperature = 0.7, maxTokens = 1000 } = options || {};

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0].message.content;
}

export async function streamChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  onChunk: (chunk: string) => void,
  options?: {
    model?: string;
    temperature?: number;
  }
) {
  const { model = 'gpt-4-turbo-preview', temperature = 0.7 } = options || {};

  const stream = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    stream: true,
  });

  let fullContent = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    fullContent += content;
    onChunk(content);
  }

  return fullContent;
}

export async function generateImage(
  prompt: string,
  options?: {
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
  }
) {
  const { size = '1024x1024', quality = 'standard' } = options || {};

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size,
    quality,
    n: 1,
  });

  return response.data[0].url;
}

export async function transcribeAudio(audioFile: File) {
  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
  });

  return response.text;
}

export { openai };
        `,
      },
      {
        path: 'src/hooks/useOpenAI.ts',
        action: 'create',
        condition: 'react',
        template: `
import { useState, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    setError(null);

    const userMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      const assistantMessage: Message = { role: 'assistant', content: data.content };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
        `,
      },
    ],
    
    envVars: [
      {
        key: 'OPENAI_API_KEY',
        description: 'Your OpenAI API key',
        required: true,
        secret: true,
      },
    ],
    
    scripts: [],
    config: {},
  }],

  // ============================================
  // PAYMENT FEATURES
  // ============================================
  ['stripe', {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing platform',
    category: 'payment',
    icon: '💳',
    requires: [],
    conflicts: [],
    optionalWith: ['react'],
    
    dependencies: [
      { name: 'stripe', version: '^14.14.0', dev: false },
      { name: '@stripe/stripe-js', version: '^2.4.0', dev: false },
      { name: '@stripe/react-stripe-js', version: '^2.4.0', dev: false, condition: 'react' },
    ],
    
    files: [
      {
        path: 'src/lib/stripe.ts',
        action: 'create',
        template: `
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createCheckoutSession(
  priceId: string,
  customerId?: string,
  metadata?: Record<string, string>
) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: \`\${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${process.env.NEXT_PUBLIC_URL}/cancel\`,
    customer: customerId,
    metadata,
  });

  return session;
}

export async function createCustomer(email: string, name?: string) {
  const customer = await stripe.customers.create({
    email,
    name,
  });

  return customer;
}

export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId);
}
        `,
      },
      {
        path: 'src/components/StripeProvider.tsx',
        action: 'create',
        condition: 'react',
        template: `
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ReactNode } from 'react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface Props {
  children: ReactNode;
}

export function StripeProvider({ children }: Props) {
  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
        `,
      },
    ],
    
    envVars: [
      {
        key: 'STRIPE_SECRET_KEY',
        description: 'Your Stripe secret key',
        required: true,
        secret: true,
      },
      {
        key: 'VITE_STRIPE_PUBLISHABLE_KEY',
        description: 'Your Stripe publishable key',
        required: true,
        secret: false,
      },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        description: 'Your Stripe webhook signing secret',
        required: false,
        secret: true,
      },
    ],
    
    scripts: [],
    config: {},
  }],

  // ============================================
  // TYPESCRIPT
  // ============================================
  ['typescript', {
    id: 'typescript',
    name: 'TypeScript',
    description: 'Typed superset of JavaScript',
    category: 'framework',
    icon: '📘',
    requires: [],
    conflicts: [],
    optionalWith: ['react', 'vue'],
    
    dependencies: [
      { name: 'typescript', version: '^5.3.0', dev: true },
      { name: '@types/node', version: '^20.11.0', dev: true },
      { name: '@types/react', version: '^18.2.0', dev: true, condition: 'react' },
      { name: '@types/react-dom', version: '^18.2.0', dev: true, condition: 'react' },
    ],
    
    files: [
      {
        path: 'tsconfig.json',
        action: 'create',
        template: `
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
    {{#if react}}
    "jsx": "react-jsx",
    {{/if}}
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
        `,
      },
      {
        path: 'tsconfig.node.json',
        action: 'create',
        template: `
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
        `,
      },
    ],
    
    envVars: [],
    scripts: [],
    config: {
      packageJson: {
        scripts: {
          typecheck: 'tsc --noEmit',
        },
      },
    },
  }],
]);

export { FEATURE_REGISTRY };
```

---

## 3. Conditional File Generation

### Template Engine with Conditionals

```typescript
// src/services/templates/templateEngine.ts

import Handlebars from 'handlebars';

interface TemplateContext {
  projectName: string;
  features: string[];
  parameters: Record<string, any>;
  // Feature flags
  [key: string]: any;
}

class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  // Register custom Handlebars helpers
  private registerHelpers(): void {
    // Check if feature is enabled
    this.handlebars.registerHelper('hasFeature', (feature: string, options: any) => {
      const features = options.data.root.features || [];
      return features.includes(feature) ? options.fn(this) : options.inverse(this);
    });

    // Check if any of the features are enabled
    this.handlebars.registerHelper('hasAnyFeature', (...args: any[]) => {
      const options = args.pop();
      const features = options.data.root.features || [];
      const hasAny = args.some(f => features.includes(f));
      return hasAny ? options.fn(this) : options.inverse(this);
    });

    // Check if all features are enabled
    this.handlebars.registerHelper('hasAllFeatures', (...args: any[]) => {
      const options = args.pop();
      const features = options.data.root.features || [];
      const hasAll = args.every(f => features.includes(f));
      return hasAll ? options.fn(this) : options.inverse(this);
    });

    // Conditional import
    this.handlebars.registerHelper('importIf', (condition: boolean, importStatement: string) => {
      return condition ? importStatement : '';
    });

    // Join array with separator
    this.handlebars.registerHelper('join', (array: any[], separator: string) => {
      return array.join(separator);
    });

    // Capitalize first letter
    this.handlebars.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Convert to camelCase
    this.handlebars.registerHelper('camelCase', (str: string) => {
      return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    });

    // Convert to PascalCase
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      const camel = str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    });

    // Equality check
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    // Not equal check
    this.handlebars.registerHelper('neq', (a: any, b: any) => a !== b);

    // Greater than
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);

    // Less than
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    // Logical AND
    this.handlebars.registerHelper('and', (...args: any[]) => {
      args.pop(); // Remove options
      return args.every(Boolean);
    });

    // Logical OR
    this.handlebars.registerHelper('or', (...args: any[]) => {
      args.pop(); // Remove options
      return args.some(Boolean);
    });

    // Logical NOT
    this.handlebars.registerHelper('not', (value: any) => !value);

    // Include partial conditionally
    this.handlebars.registerHelper('includeIf', (condition: boolean, partialName: string, options: any) => {
      if (condition) {
        const partial = this.handlebars.partials[partialName];
        if (partial) {
          return new this.handlebars.SafeString(partial(options.data.root));
        }
      }
      return '';
    });
  }

  // Compile and render template
  render(template: string, context: TemplateContext): string {
    // Add feature flags to context
    const enhancedContext = {
      ...context,
      // Add boolean flags for each feature
      ...Object.fromEntries(
        context.features.map(f => [f, true])
      ),
    };

    const compiled = this.handlebars.compile(template, { noEscape: true });
    return compiled(enhancedContext);
  }

  // Register a partial template
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
  }

  // Compile template to function
  compile(template: string): (context: TemplateContext) => string {
    const compiled = this.handlebars.compile(template, { noEscape: true });
    return (context: TemplateContext) => {
      const enhancedContext = {
        ...context,
        ...Object.fromEntries(context.features.map(f => [f, true])),
      };
      return compiled(enhancedContext);
    };
  }
}

export { TemplateEngine, TemplateContext };
```

### Conditional File Generator

```typescript
// src/services/templates/conditionalGenerator.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { TemplateEngine, TemplateContext } from './templateEngine';
import { Feature, FeatureFile } from './featureRegistry';

interface GenerationResult {
  path: string;
  action: 'created' | 'modified' | 'deleted' | 'skipped';
  content?: string;
  error?: string;
}

class ConditionalFileGenerator {
  private engine: TemplateEngine;
  private projectPath: string;

  constructor(projectPath: string) {
    this.engine = new TemplateEngine();
    this.projectPath = projectPath;
  }

  // Generate all files for selected features
  async generateFiles(
    features: Feature[],
    context: TemplateContext
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const feature of features) {
      for (const file of feature.files) {
        const result = await this.processFile(file, context);
        results.push(result);
      }
    }

    return results;
  }

  // Process a single file
  private async processFile(
    file: FeatureFile,
    context: TemplateContext
  ): Promise<GenerationResult> {
    const fullPath = path.join(this.projectPath, file.path);

    // Check condition
    if (file.condition && !this.evaluateCondition(file.condition, context)) {
      return {
        path: file.path,
        action: 'skipped',
      };
    }

    try {
      switch (file.action) {
        case 'create':
          return await this.createFile(fullPath, file, context);

        case 'modify':
          return await this.modifyFile(fullPath, file, context);

        case 'delete':
          return await this.deleteFile(fullPath);

        default:
          return {
            path: file.path,
            action: 'skipped',
            error: `Unknown action: ${file.action}`,
          };
      }
    } catch (error: any) {
      return {
        path: file.path,
        action: 'skipped',
        error: error.message,
      };
    }
  }

  // Evaluate condition expression
  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    // Simple condition: just a feature name
    if (context.features.includes(condition)) {
      return true;
    }

    // Complex condition: expression like "react && typescript"
    const expression = condition
      .replace(/&&/g, ' && ')
      .replace(/\|\|/g, ' || ')
      .replace(/!/g, ' ! ')
      .split(/\s+/)
      .map(token => {
        if (['&&', '||', '!', '(', ')'].includes(token)) {
          return token;
        }
        return context.features.includes(token) ? 'true' : 'false';
      })
      .join(' ');

    try {
      return new Function(`return ${expression}`)();
    } catch {
      return false;
    }
  }

  // Create a new file
  private async createFile(
    fullPath: string,
    file: FeatureFile,
    context: TemplateContext
  ): Promise<GenerationResult> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Render template
    const content = this.engine.render(file.template || '', context);

    // Write file
    await fs.writeFile(fullPath, content.trim() + '\n');

    return {
      path: file.path,
      action: 'created',
      content,
    };
  }

  // Modify an existing file
  private async modifyFile(
    fullPath: string,
    file: FeatureFile,
    context: TemplateContext
  ): Promise<GenerationResult> {
    // Read existing content
    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch {
      // File doesn't exist, create it
      if (file.template) {
        return this.createFile(fullPath, { ...file, action: 'create' }, context);
      }
      throw new Error(`File not found: ${fullPath}`);
    }

    // Apply insertions
    if (file.insertions) {
      for (const insertion of file.insertions) {
        const renderedContent = this.engine.render(insertion.content, context);
        content = this.applyInsertion(content, insertion.marker, insertion.position, renderedContent);
      }
    }

    // Write modified content
    await fs.writeFile(fullPath, content);

    return {
      path: file.path,
      action: 'modified',
      content,
    };
  }

  // Apply insertion at marker
  private applyInsertion(
    content: string,
    marker: string,
    position: 'before' | 'after' | 'replace',
    insertion: string
  ): string {
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) {
      // Marker not found, append to end
      return content + '\n' + insertion;
    }

    switch (position) {
      case 'before':
        return content.slice(0, markerIndex) + insertion + '\n' + content.slice(markerIndex);

      case 'after':
        const afterMarker = markerIndex + marker.length;
        return content.slice(0, afterMarker) + '\n' + insertion + content.slice(afterMarker);

      case 'replace':
        return content.slice(0, markerIndex) + insertion + content.slice(markerIndex + marker.length);

      default:
        return content;
    }
  }

  // Delete a file
  private async deleteFile(fullPath: string): Promise<GenerationResult> {
    try {
      await fs.unlink(fullPath);
      return {
        path: fullPath,
        action: 'deleted',
      };
    } catch {
      return {
        path: fullPath,
        action: 'skipped',
        error: 'File not found',
      };
    }
  }
}

export { ConditionalFileGenerator, GenerationResult };
```

---

## 4. Dynamic Code Injection

### Code Injection System

```typescript
// src/services/templates/codeInjector.ts

interface InjectionPoint {
  file: string;
  marker: string;
  type: 'import' | 'provider' | 'route' | 'config' | 'hook' | 'component';
}

interface CodeInjection {
  point: InjectionPoint;
  code: string;
  condition?: string;
}

const INJECTION_POINTS: Record<string, InjectionPoint[]> = {
  react: [
    {
      file: 'src/main.tsx',
      marker: '// INJECT_IMPORTS',
      type: 'import',
    },
    {
      file: 'src/main.tsx',
      marker: '{/* INJECT_PROVIDERS */}',
      type: 'provider',
    },
    {
      file: 'src/App.tsx',
      marker: '{/* INJECT_ROUTES */}',
      type: 'route',
    },
  ],
  vite: [
    {
      file: 'vite.config.ts',
      marker: '// INJECT_PLUGINS',
      type: 'config',
    },
  ],
};

class CodeInjector {
  private projectPath: string;
  private injections: CodeInjection[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  // Add injection
  addInjection(injection: CodeInjection): void {
    this.injections.push(injection);
  }

  // Add import injection
  addImport(file: string, importStatement: string, condition?: string): void {
    this.injections.push({
      point: { file, marker: '// INJECT_IMPORTS', type: 'import' },
      code: importStatement,
      condition,
    });
  }

  // Add provider wrapper
  addProvider(providerCode: string, condition?: string): void {
    this.injections.push({
      point: {
        file: 'src/main.tsx',
        marker: '{/* INJECT_PROVIDERS */}',
        type: 'provider',
      },
      code: providerCode,
      condition,
    });
  }

  // Add route
  addRoute(routeCode: string, condition?: string): void {
    this.injections.push({
      point: {
        file: 'src/App.tsx',
        marker: '{/* INJECT_ROUTES */}',
        type: 'route',
      },
      code: routeCode,
      condition,
    });
  }

  // Apply all injections
  async applyInjections(context: TemplateContext): Promise<void> {
    // Group injections by file
    const fileInjections = new Map<string, CodeInjection[]>();

    for (const injection of this.injections) {
      // Check condition
      if (injection.condition && !context.features.includes(injection.condition)) {
        continue;
      }

      const file = injection.point.file;
      if (!fileInjections.has(file)) {
        fileInjections.set(file, []);
      }
      fileInjections.get(file)!.push(injection);
    }

    // Apply injections to each file
    for (const [file, injections] of fileInjections) {
      await this.applyFileInjections(file, injections);
    }
  }

  // Apply injections to a single file
  private async applyFileInjections(
    file: string,
    injections: CodeInjection[]
  ): Promise<void> {
    const fullPath = path.join(this.projectPath, file);

    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch {
      console.warn(`File not found for injection: ${file}`);
      return;
    }

    // Group by marker
    const markerInjections = new Map<string, string[]>();
    for (const injection of injections) {
      const marker = injection.point.marker;
      if (!markerInjections.has(marker)) {
        markerInjections.set(marker, []);
      }
      markerInjections.get(marker)!.push(injection.code);
    }

    // Apply each marker's injections
    for (const [marker, codes] of markerInjections) {
      const combined = codes.join('\n');
      content = content.replace(marker, combined + '\n' + marker);
    }

    await fs.writeFile(fullPath, content);
  }
}

export { CodeInjector, InjectionPoint, CodeInjection };
```

---

## 5. Feature Composition Engine

### Main Composition Engine

```typescript
// src/services/templates/featureComposer.ts

import { Feature, FEATURE_REGISTRY } from './featureRegistry';
import { TemplateEngine, TemplateContext } from './templateEngine';
import { ConditionalFileGenerator } from './conditionalGenerator';
import { CodeInjector } from './codeInjector';

interface CompositionResult {
  success: boolean;
  features: string[];
  files: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  envVars: string[];
  scripts: Record<string, string>;
  errors: string[];
  warnings: string[];
}

class FeatureComposer {
  private projectPath: string;
  private engine: TemplateEngine;
  private generator: ConditionalFileGenerator;
  private injector: CodeInjector;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.engine = new TemplateEngine();
    this.generator = new ConditionalFileGenerator(projectPath);
    this.injector = new CodeInjector(projectPath);
  }

  // Compose project with selected features
  async compose(
    selectedFeatures: string[],
    parameters: Record<string, any> = {}
  ): Promise<CompositionResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Resolve feature dependencies
    const resolvedFeatures = this.resolveFeatures(selectedFeatures, errors, warnings);

    // 2. Check for conflicts
    this.checkConflicts(resolvedFeatures, errors);

    if (errors.length > 0) {
      return {
        success: false,
        features: [],
        files: [],
        dependencies: {},
        devDependencies: {},
        envVars: [],
        scripts: {},
        errors,
        warnings,
      };
    }

    // 3. Get feature objects
    const features = resolvedFeatures
      .map(id => FEATURE_REGISTRY.get(id))
      .filter((f): f is Feature => f !== undefined);

    // 4. Create context
    const context: TemplateContext = {
      projectName: parameters.projectName || 'my-app',
      features: resolvedFeatures,
      parameters,
    };

    // 5. Generate files
    const fileResults = await this.generator.generateFiles(features, context);
    const files = fileResults
      .filter(r => r.action !== 'skipped')
      .map(r => r.path);

    // 6. Collect dependencies
    const { dependencies, devDependencies } = this.collectDependencies(features, context);

    // 7. Collect environment variables
    const envVars = this.collectEnvVars(features);

    // 8. Collect scripts
    const scripts = this.collectScripts(features);

    // 9. Apply code injections
    await this.applyInjections(features, context);

    // 10. Generate package.json
    await this.generatePackageJson(context, dependencies, devDependencies, scripts);

    // 11. Generate .env.example
    await this.generateEnvExample(features);

    return {
      success: true,
      features: resolvedFeatures,
      files,
      dependencies,
      devDependencies,
      envVars,
      scripts,
      errors,
      warnings,
    };
  }

  // Resolve feature dependencies recursively
  private resolveFeatures(
    selected: string[],
    errors: string[],
    warnings: string[]
  ): string[] {
    const resolved = new Set<string>();
    const queue = [...selected];

    while (queue.length > 0) {
      const featureId = queue.shift()!;

      if (resolved.has(featureId)) continue;

      const feature = FEATURE_REGISTRY.get(featureId);
      if (!feature) {
        errors.push(`Unknown feature: ${featureId}`);
        continue;
      }

      // Add required dependencies first
      for (const required of feature.requires) {
        if (!resolved.has(required) && !queue.includes(required)) {
          queue.unshift(required); // Add to front
        }
      }

      resolved.add(featureId);

      // Check optional enhancements
      for (const optional of feature.optionalWith) {
        if (selected.includes(optional) && !resolved.has(optional)) {
          warnings.push(`Feature ${featureId} works better with ${optional}`);
        }
      }
    }

    return Array.from(resolved);
  }

  // Check for feature conflicts
  private checkConflicts(features: string[], errors: string[]): void {
    for (const featureId of features) {
      const feature = FEATURE_REGISTRY.get(featureId);
      if (!feature) continue;

      for (const conflict of feature.conflicts) {
        if (features.includes(conflict)) {
          errors.push(`Feature conflict: ${featureId} conflicts with ${conflict}`);
        }
      }
    }
  }

  // Collect all dependencies
  private collectDependencies(
    features: Feature[],
    context: TemplateContext
  ): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {};

    for (const feature of features) {
      for (const dep of feature.dependencies) {
        // Check condition
        if (dep.condition && !context.features.includes(dep.condition)) {
          continue;
        }

        if (dep.dev) {
          devDependencies[dep.name] = dep.version;
        } else {
          dependencies[dep.name] = dep.version;
        }
      }
    }

    return { dependencies, devDependencies };
  }

  // Collect environment variables
  private collectEnvVars(features: Feature[]): string[] {
    const envVars: string[] = [];

    for (const feature of features) {
      for (const env of feature.envVars) {
        envVars.push(env.key);
      }
    }

    return envVars;
  }

  // Collect scripts
  private collectScripts(features: Feature[]): Record<string, string> {
    const scripts: Record<string, string> = {};

    for (const feature of features) {
      if (feature.config.packageJson?.scripts) {
        Object.assign(scripts, feature.config.packageJson.scripts);
      }
    }

    return scripts;
  }

  // Apply code injections for features
  private async applyInjections(
    features: Feature[],
    context: TemplateContext
  ): Promise<void> {
    // Add provider wrappers
    for (const feature of features) {
      if (feature.id === 'supabase' && context.features.includes('react')) {
        this.injector.addImport(
          'src/main.tsx',
          "import { AuthProvider } from './components/AuthProvider';",
          'supabase'
        );
        this.injector.addProvider('<AuthProvider>', 'supabase');
      }

      if (feature.id === 'auth0' && context.features.includes('react')) {
        this.injector.addImport(
          'src/main.tsx',
          "import { Auth0Provider } from './components/Auth0Provider';",
          'auth0'
        );
        this.injector.addProvider('<Auth0Provider>', 'auth0');
      }

      if (feature.id === 'stripe' && context.features.includes('react')) {
        this.injector.addImport(
          'src/main.tsx',
          "import { StripeProvider } from './components/StripeProvider';",
          'stripe'
        );
        this.injector.addProvider('<StripeProvider>', 'stripe');
      }
    }

    await this.injector.applyInjections(context);
  }

  // Generate package.json
  private async generatePackageJson(
    context: TemplateContext,
    dependencies: Record<string, string>,
    devDependencies: Record<string, string>,
    scripts: Record<string, string>
  ): Promise<void> {
    const packageJson = {
      name: context.projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        ...scripts,
      },
      dependencies,
      devDependencies,
    };

    const fullPath = path.join(this.projectPath, 'package.json');
    await fs.writeFile(fullPath, JSON.stringify(packageJson, null, 2));
  }

  // Generate .env.example
  private async generateEnvExample(features: Feature[]): Promise<void> {
    const lines: string[] = ['# Environment Variables', ''];

    for (const feature of features) {
      if (feature.envVars.length > 0) {
        lines.push(`# ${feature.name}`);
        for (const env of feature.envVars) {
          const required = env.required ? '(required)' : '(optional)';
          lines.push(`# ${env.description} ${required}`);
          lines.push(`${env.key}=${env.default || ''}`);
          lines.push('');
        }
      }
    }

    const fullPath = path.join(this.projectPath, '.env.example');
    await fs.writeFile(fullPath, lines.join('\n'));
  }
}

export { FeatureComposer, CompositionResult };
```

---

## 6. Natural Language Feature Parsing

### NLP Feature Parser

```typescript
// src/services/templates/nlpFeatureParser.ts

interface ParsedRequest {
  baseTemplate: string;
  features: string[];
  parameters: Record<string, any>;
  confidence: number;
  suggestions: string[];
}

interface FeatureKeyword {
  feature: string;
  keywords: string[];
  aliases: string[];
  weight: number;
}

const FEATURE_KEYWORDS: FeatureKeyword[] = [
  // Frameworks
  {
    feature: 'react',
    keywords: ['react', 'reactjs', 'react.js'],
    aliases: ['frontend', 'ui library'],
    weight: 1.0,
  },
  {
    feature: 'vue',
    keywords: ['vue', 'vuejs', 'vue.js'],
    aliases: ['frontend', 'ui framework'],
    weight: 1.0,
  },
  {
    feature: 'svelte',
    keywords: ['svelte', 'sveltekit'],
    aliases: ['frontend', 'compiler'],
    weight: 1.0,
  },

  // Styling
  {
    feature: 'tailwind',
    keywords: ['tailwind', 'tailwindcss', 'tailwind css'],
    aliases: ['utility css', 'styling', 'css framework'],
    weight: 0.9,
  },
  {
    feature: 'styled-components',
    keywords: ['styled-components', 'styled components', 'css-in-js'],
    aliases: ['styling'],
    weight: 0.9,
  },

  // Databases
  {
    feature: 'supabase',
    keywords: ['supabase'],
    aliases: ['database', 'backend', 'postgres', 'auth'],
    weight: 0.95,
  },
  {
    feature: 'firebase',
    keywords: ['firebase', 'firestore'],
    aliases: ['database', 'backend', 'nosql'],
    weight: 0.95,
  },
  {
    feature: 'prisma',
    keywords: ['prisma'],
    aliases: ['orm', 'database'],
    weight: 0.8,
  },

  // Auth
  {
    feature: 'auth0',
    keywords: ['auth0'],
    aliases: ['authentication', 'auth', 'login'],
    weight: 0.9,
  },
  {
    feature: 'clerk',
    keywords: ['clerk'],
    aliases: ['authentication', 'auth', 'login'],
    weight: 0.9,
  },

  // Testing
  {
    feature: 'vitest',
    keywords: ['vitest'],
    aliases: ['testing', 'unit tests', 'test'],
    weight: 0.8,
  },
  {
    feature: 'jest',
    keywords: ['jest'],
    aliases: ['testing', 'unit tests', 'test'],
    weight: 0.8,
  },
  {
    feature: 'playwright',
    keywords: ['playwright'],
    aliases: ['e2e', 'end-to-end', 'testing'],
    weight: 0.8,
  },

  // AI
  {
    feature: 'openai',
    keywords: ['openai', 'gpt', 'chatgpt', 'gpt-4', 'gpt-3'],
    aliases: ['ai', 'llm', 'artificial intelligence'],
    weight: 0.9,
  },
  {
    feature: 'anthropic',
    keywords: ['anthropic', 'claude'],
    aliases: ['ai', 'llm'],
    weight: 0.9,
  },

  // Payment
  {
    feature: 'stripe',
    keywords: ['stripe'],
    aliases: ['payment', 'billing', 'subscription'],
    weight: 0.9,
  },

  // TypeScript
  {
    feature: 'typescript',
    keywords: ['typescript', 'ts'],
    aliases: ['typed', 'types'],
    weight: 0.85,
  },
];

class NLPFeatureParser {
  private keywords: FeatureKeyword[];

  constructor() {
    this.keywords = FEATURE_KEYWORDS;
  }

  // Parse natural language request
  parse(request: string): ParsedRequest {
    const normalizedRequest = request.toLowerCase();
    const detectedFeatures: Map<string, number> = new Map();
    const parameters: Record<string, any> = {};
    const suggestions: string[] = [];

    // Extract project name
    const nameMatch = request.match(/(?:called|named|for)\s+["']?([a-zA-Z0-9-_]+)["']?/i);
    if (nameMatch) {
      parameters.projectName = nameMatch[1];
    }

    // Detect features by keywords
    for (const featureKeyword of this.keywords) {
      let score = 0;

      // Check exact keywords
      for (const keyword of featureKeyword.keywords) {
        if (normalizedRequest.includes(keyword)) {
          score += featureKeyword.weight;
        }
      }

      // Check aliases (lower weight)
      for (const alias of featureKeyword.aliases) {
        if (normalizedRequest.includes(alias)) {
          score += featureKeyword.weight * 0.5;
        }
      }

      if (score > 0) {
        detectedFeatures.set(featureKeyword.feature, score);
      }
    }

    // Sort by score and get features
    const sortedFeatures = Array.from(detectedFeatures.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([feature]) => feature);

    // Determine base template
    const baseTemplate = this.determineBaseTemplate(sortedFeatures, normalizedRequest);

    // Calculate confidence
    const confidence = this.calculateConfidence(detectedFeatures, normalizedRequest);

    // Generate suggestions
    if (sortedFeatures.includes('react') && !sortedFeatures.includes('typescript')) {
      suggestions.push('Consider adding TypeScript for better type safety');
    }
    if (sortedFeatures.includes('supabase') && !sortedFeatures.includes('react')) {
      suggestions.push('Supabase works great with React hooks');
    }

    return {
      baseTemplate,
      features: sortedFeatures,
      parameters,
      confidence,
      suggestions,
    };
  }

  // Determine base template from features
  private determineBaseTemplate(features: string[], request: string): string {
    // Check for specific patterns
    if (request.includes('api') || request.includes('backend only')) {
      return 'api-service';
    }
    if (request.includes('mobile') || request.includes('app')) {
      return 'mobile-app';
    }
    if (request.includes('dashboard') || request.includes('admin')) {
      return 'dashboard';
    }

    // Check for database features
    const hasDatabase = features.some(f => 
      ['supabase', 'firebase', 'prisma', 'postgresql', 'mysql'].includes(f)
    );

    // Check for auth features
    const hasAuth = features.some(f =>
      ['auth0', 'clerk', 'supabase'].includes(f)
    );

    if (hasDatabase || hasAuth) {
      return 'web-db-user';
    }

    // Check for AI features
    if (features.some(f => ['openai', 'anthropic'].includes(f))) {
      return 'web-ai-agent';
    }

    // Default to static
    return 'web-static';
  }

  // Calculate confidence score
  private calculateConfidence(
    detectedFeatures: Map<string, number>,
    request: string
  ): number {
    if (detectedFeatures.size === 0) {
      return 0.1;
    }

    const totalScore = Array.from(detectedFeatures.values())
      .reduce((sum, score) => sum + score, 0);

    const wordCount = request.split(/\s+/).length;
    const featureCount = detectedFeatures.size;

    // Higher confidence if more features detected relative to request length
    const densityScore = Math.min(featureCount / (wordCount / 5), 1);

    // Higher confidence if scores are high
    const avgScore = totalScore / featureCount;

    return Math.min((densityScore * 0.4 + avgScore * 0.6), 1);
  }

  // Parse with LLM for complex requests
  async parseWithLLM(request: string): Promise<ParsedRequest> {
    // First try keyword-based parsing
    const keywordResult = this.parse(request);

    // If confidence is high enough, return keyword result
    if (keywordResult.confidence > 0.7) {
      return keywordResult;
    }

    // Use LLM for complex parsing
    const prompt = `
Parse the following project request and extract:
1. Base template type (web-static, web-db-user, web-ai-agent, mobile-app, api-service, dashboard)
2. Features to include (from: react, vue, svelte, tailwind, supabase, firebase, auth0, clerk, stripe, openai, typescript, vitest)
3. Any specific parameters (project name, colors, etc.)

Request: "${request}"

Respond in JSON format:
{
  "baseTemplate": "...",
  "features": ["..."],
  "parameters": {...},
  "confidence": 0.0-1.0
}
`;

    try {
      // Call LLM (implementation depends on your LLM service)
      const response = await this.callLLM(prompt);
      const parsed = JSON.parse(response);

      return {
        ...parsed,
        suggestions: keywordResult.suggestions,
      };
    } catch {
      // Fall back to keyword result
      return keywordResult;
    }
  }

  // Call LLM service
  private async callLLM(prompt: string): Promise<string> {
    // Implementation depends on your LLM service
    // This is a placeholder
    throw new Error('LLM not configured');
  }
}

export { NLPFeatureParser, ParsedRequest, FeatureKeyword };
```

---

## 7. Feature Dependency Resolution

### Dependency Resolver

```typescript
// src/services/templates/featureDependencyResolver.ts

interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>; // feature -> dependencies
  reverseEdges: Map<string, Set<string>>; // feature -> dependents
}

interface ResolutionResult {
  resolved: string[];
  unresolved: string[];
  conflicts: string[][];
  installOrder: string[];
}

class FeatureDependencyResolver {
  private graph: DependencyGraph;

  constructor() {
    this.graph = {
      nodes: new Set(),
      edges: new Map(),
      reverseEdges: new Map(),
    };

    this.buildGraph();
  }

  // Build dependency graph from feature registry
  private buildGraph(): void {
    for (const [id, feature] of FEATURE_REGISTRY) {
      this.graph.nodes.add(id);
      this.graph.edges.set(id, new Set(feature.requires));

      // Build reverse edges
      for (const dep of feature.requires) {
        if (!this.graph.reverseEdges.has(dep)) {
          this.graph.reverseEdges.set(dep, new Set());
        }
        this.graph.reverseEdges.get(dep)!.add(id);
      }
    }
  }

  // Resolve dependencies for selected features
  resolve(selectedFeatures: string[]): ResolutionResult {
    const resolved: string[] = [];
    const unresolved: string[] = [];
    const conflicts: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Topological sort with cycle detection
    const visit = (feature: string): boolean => {
      if (visited.has(feature)) return true;
      if (visiting.has(feature)) {
        // Cycle detected
        return false;
      }

      visiting.add(feature);

      const deps = this.graph.edges.get(feature) || new Set();
      for (const dep of deps) {
        if (!visit(dep)) {
          return false;
        }
      }

      visiting.delete(feature);
      visited.add(feature);
      resolved.push(feature);
      return true;
    };

    // Resolve each selected feature
    for (const feature of selectedFeatures) {
      if (!FEATURE_REGISTRY.has(feature)) {
        unresolved.push(feature);
        continue;
      }

      // Add dependencies
      const deps = this.getAllDependencies(feature);
      for (const dep of deps) {
        if (!selectedFeatures.includes(dep) && !resolved.includes(dep)) {
          selectedFeatures.push(dep);
        }
      }

      if (!visit(feature)) {
        unresolved.push(feature);
      }
    }

    // Check for conflicts
    for (const feature of resolved) {
      const featureObj = FEATURE_REGISTRY.get(feature);
      if (!featureObj) continue;

      for (const conflict of featureObj.conflicts) {
        if (resolved.includes(conflict)) {
          conflicts.push([feature, conflict]);
        }
      }
    }

    // Calculate install order (reverse of resolution order)
    const installOrder = [...resolved];

    return {
      resolved,
      unresolved,
      conflicts,
      installOrder,
    };
  }

  // Get all dependencies recursively
  private getAllDependencies(feature: string, visited = new Set<string>()): string[] {
    if (visited.has(feature)) return [];
    visited.add(feature);

    const deps: string[] = [];
    const featureObj = FEATURE_REGISTRY.get(feature);
    if (!featureObj) return [];

    for (const dep of featureObj.requires) {
      deps.push(dep);
      deps.push(...this.getAllDependencies(dep, visited));
    }

    return deps;
  }

  // Get features that depend on a given feature
  getDependents(feature: string): string[] {
    return Array.from(this.graph.reverseEdges.get(feature) || []);
  }

  // Check if adding a feature would cause conflicts
  checkConflicts(existing: string[], newFeature: string): string[] {
    const conflicts: string[] = [];
    const featureObj = FEATURE_REGISTRY.get(newFeature);
    if (!featureObj) return [];

    for (const conflict of featureObj.conflicts) {
      if (existing.includes(conflict)) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  // Suggest alternative features when conflicts exist
  suggestAlternatives(feature: string, conflicts: string[]): string[] {
    const featureObj = FEATURE_REGISTRY.get(feature);
    if (!featureObj) return [];

    const alternatives: string[] = [];
    const category = featureObj.category;

    // Find features in same category that don't conflict
    for (const [id, f] of FEATURE_REGISTRY) {
      if (f.category === category && id !== feature) {
        const hasConflict = conflicts.some(c => f.conflicts.includes(c));
        if (!hasConflict) {
          alternatives.push(id);
        }
      }
    }

    return alternatives;
  }
}

export { FeatureDependencyResolver, DependencyGraph, ResolutionResult };
```

---

## 8. Complete Example: React + Tailwind + Supabase

### Full Implementation Example

```typescript
// Example: Creating a React app with Tailwind and Supabase

import { FeatureComposer } from './featureComposer';
import { NLPFeatureParser } from './nlpFeatureParser';
import { FeatureDependencyResolver } from './featureDependencyResolver';

async function createProject(userRequest: string): Promise<void> {
  // 1. Parse user request
  const parser = new NLPFeatureParser();
  const parsed = parser.parse(userRequest);
  
  console.log('Parsed request:', parsed);
  // Output:
  // {
  //   baseTemplate: 'web-db-user',
  //   features: ['react', 'tailwind', 'supabase', 'typescript'],
  //   parameters: { projectName: 'my-app' },
  //   confidence: 0.85,
  //   suggestions: []
  // }

  // 2. Resolve dependencies
  const resolver = new FeatureDependencyResolver();
  const resolution = resolver.resolve(parsed.features);
  
  console.log('Resolved features:', resolution);
  // Output:
  // {
  //   resolved: ['typescript', 'react', 'tailwind', 'supabase'],
  //   unresolved: [],
  //   conflicts: [],
  //   installOrder: ['typescript', 'react', 'tailwind', 'supabase']
  // }

  // 3. Compose project
  const projectPath = `/projects/${parsed.parameters.projectName}`;
  const composer = new FeatureComposer(projectPath);
  
  const result = await composer.compose(resolution.resolved, parsed.parameters);
  
  console.log('Composition result:', result);
  // Output:
  // {
  //   success: true,
  //   features: ['typescript', 'react', 'tailwind', 'supabase'],
  //   files: [
  //     'src/main.tsx',
  //     'src/App.tsx',
  //     'vite.config.ts',
  //     'tsconfig.json',
  //     'tailwind.config.js',
  //     'postcss.config.js',
  //     'src/index.css',
  //     'src/lib/supabase.ts',
  //     'src/hooks/useSupabase.ts',
  //     'src/components/AuthProvider.tsx',
  //     ...
  //   ],
  //   dependencies: {
  //     'react': '^18.2.0',
  //     'react-dom': '^18.2.0',
  //     '@supabase/supabase-js': '^2.39.0',
  //     ...
  //   },
  //   devDependencies: {
  //     'typescript': '^5.3.0',
  //     'tailwindcss': '^3.4.0',
  //     ...
  //   },
  //   envVars: [
  //     'VITE_SUPABASE_URL',
  //     'VITE_SUPABASE_ANON_KEY',
  //   ],
  //   scripts: {
  //     'dev': 'vite',
  //     'build': 'vite build',
  //     'typecheck': 'tsc --noEmit',
  //     ...
  //   },
  //   errors: [],
  //   warnings: []
  // }

  // 4. Install dependencies
  await installDependencies(projectPath);

  // 5. Project is ready!
  console.log(`Project created at ${projectPath}`);
}

// Usage
createProject('Create a React app with Tailwind and Supabase called my-app');
```

### Generated Project Structure

```
my-app/
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── lib/
    │   ├── supabase.ts
    │   └── database.types.ts
    ├── hooks/
    │   └── useSupabase.ts
    └── components/
        └── AuthProvider.tsx
```

---

## Summary

### Key Components

| Component | Purpose |
|-----------|---------|
| **Feature Registry** | Defines all available features with dependencies, files, and configs |
| **Template Engine** | Renders templates with conditionals using Handlebars |
| **Conditional Generator** | Creates/modifies files based on feature selection |
| **Code Injector** | Dynamically injects code at predefined markers |
| **Feature Composer** | Orchestrates the entire composition process |
| **NLP Parser** | Extracts features from natural language requests |
| **Dependency Resolver** | Resolves feature dependencies and detects conflicts |

### Supported Features

| Category | Features |
|----------|----------|
| **Framework** | React, Vue, Svelte, TypeScript |
| **Styling** | Tailwind CSS, Styled Components |
| **Database** | Supabase, Firebase, Prisma |
| **Auth** | Auth0, Clerk |
| **Testing** | Vitest, Jest, Playwright |
| **AI** | OpenAI, Anthropic |
| **Payment** | Stripe |

### Usage Flow

1. User provides natural language request
2. NLP parser extracts features and parameters
3. Dependency resolver ensures all dependencies are included
4. Feature composer generates all files
5. Code injector adds dynamic integrations
6. Package.json and .env.example are generated
7. Dependencies are installed
8. Project is ready to use!
