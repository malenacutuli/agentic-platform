# Environment-Specific Builds

This guide provides comprehensive coverage of environment-specific build configurations, including development vs production builds, environment variable injection, and build-time vs runtime configuration strategies.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Types](#environment-types)
3. [Build Mode Configuration](#build-mode-configuration)
4. [Environment Variable Injection](#environment-variable-injection)
5. [Build-Time vs Runtime Config](#build-time-vs-runtime-config)
6. [Framework-Specific Configuration](#framework-specific-configuration)
7. [Secrets Management](#secrets-management)
8. [Multi-Environment Pipelines](#multi-environment-pipelines)
9. [Feature Flags](#feature-flags)
10. [Best Practices](#best-practices)

---

## Overview

Environment-specific builds allow applications to behave differently based on where they're deployed, enabling features like debug logging in development, optimized bundles in production, and environment-specific API endpoints.

### Environment Build Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT-SPECIFIC BUILD FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SOURCE CODE                                                                            │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         BUILD PROCESS                                            │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │   │
│  │  │  Environment │    │   Bundler    │    │  Optimizer   │                       │   │
│  │  │   Variables  │───▶│   (Vite/     │───▶│  (Terser/    │                       │   │
│  │  │   Injection  │    │   Webpack)   │    │   esbuild)   │                       │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │   │
│  │         │                   │                   │                                │   │
│  │         ▼                   ▼                   ▼                                │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │   │
│  │  │ process.env  │    │  Dead Code   │    │  Minification│                       │   │
│  │  │ Replacement  │    │  Elimination │    │  Tree Shake  │                       │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         OUTPUT ARTIFACTS                                         │   │
│  │                                                                                  │   │
│  │  DEVELOPMENT          STAGING              PRODUCTION                           │   │
│  │  ┌──────────┐        ┌──────────┐        ┌──────────┐                          │   │
│  │  │ Unminified│        │ Minified │        │ Minified │                          │   │
│  │  │ Source    │        │ Source   │        │ No Source│                          │   │
│  │  │ Maps      │        │ Maps     │        │ Maps     │                          │   │
│  │  │ Debug     │        │ Limited  │        │ No Debug │                          │   │
│  │  │ Logging   │        │ Logging  │        │ Logging  │                          │   │
│  │  └──────────┘        └──────────┘        └──────────┘                          │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Environment Comparison

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Minification** | No | Yes | Yes |
| **Source Maps** | Inline | External | None/Hidden |
| **Debug Logging** | Full | Limited | None |
| **API Endpoint** | localhost | staging.api | api |
| **Error Details** | Full stack | Limited | Generic |
| **HMR** | Enabled | Disabled | Disabled |
| **Bundle Size** | Large | Optimized | Optimized |

---

## Environment Types

### Standard Environments

```typescript
// src/config/environments.ts

type Environment = 'development' | 'staging' | 'production' | 'test';

interface EnvironmentConfig {
  name: Environment;
  apiUrl: string;
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  features: {
    analytics: boolean;
    errorReporting: boolean;
    performanceMonitoring: boolean;
  };
  build: {
    minify: boolean;
    sourceMaps: boolean | 'inline' | 'hidden';
    treeshake: boolean;
  };
}

const environments: Record<Environment, EnvironmentConfig> = {
  development: {
    name: 'development',
    apiUrl: 'http://localhost:3001',
    debug: true,
    logLevel: 'debug',
    features: {
      analytics: false,
      errorReporting: false,
      performanceMonitoring: false,
    },
    build: {
      minify: false,
      sourceMaps: 'inline',
      treeshake: false,
    },
  },

  staging: {
    name: 'staging',
    apiUrl: 'https://staging-api.example.com',
    debug: true,
    logLevel: 'info',
    features: {
      analytics: true,
      errorReporting: true,
      performanceMonitoring: true,
    },
    build: {
      minify: true,
      sourceMaps: true,
      treeshake: true,
    },
  },

  production: {
    name: 'production',
    apiUrl: 'https://api.example.com',
    debug: false,
    logLevel: 'error',
    features: {
      analytics: true,
      errorReporting: true,
      performanceMonitoring: true,
    },
    build: {
      minify: true,
      sourceMaps: 'hidden',
      treeshake: true,
    },
  },

  test: {
    name: 'test',
    apiUrl: 'http://localhost:3001',
    debug: true,
    logLevel: 'warn',
    features: {
      analytics: false,
      errorReporting: false,
      performanceMonitoring: false,
    },
    build: {
      minify: false,
      sourceMaps: 'inline',
      treeshake: false,
    },
  },
};

function getEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment;
  return environments[env] ? env : 'development';
}

function getConfig(): EnvironmentConfig {
  return environments[getEnvironment()];
}

export { environments, getEnvironment, getConfig, Environment, EnvironmentConfig };
```

### Environment Detection

```typescript
// src/utils/environment.ts

/**
 * Detect current environment
 */
export function detectEnvironment(): string {
  // Check NODE_ENV first
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Check for CI environment
  if (process.env.CI) {
    return 'test';
  }

  // Check for common platform indicators
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV || 'production';
  }

  if (process.env.NETLIFY) {
    return process.env.CONTEXT || 'production';
  }

  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return process.env.STAGE || 'production';
  }

  // Default to development
  return 'development';
}

/**
 * Environment checks
 */
export const isDevelopment = () => detectEnvironment() === 'development';
export const isProduction = () => detectEnvironment() === 'production';
export const isStaging = () => detectEnvironment() === 'staging';
export const isTest = () => detectEnvironment() === 'test';
export const isCI = () => Boolean(process.env.CI);

/**
 * Feature availability based on environment
 */
export function isFeatureAvailable(feature: string): boolean {
  const env = detectEnvironment();
  
  const featureMatrix: Record<string, string[]> = {
    'debug-panel': ['development', 'staging'],
    'mock-api': ['development', 'test'],
    'analytics': ['staging', 'production'],
    'error-boundary-details': ['development', 'staging'],
  };

  return featureMatrix[feature]?.includes(env) ?? false;
}
```

---

## Build Mode Configuration

### Vite Configuration

```typescript
// vite.config.ts

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command, mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  const isDev = mode === 'development';
  const isProd = mode === 'production';
  const isStaging = mode === 'staging';

  return {
    plugins: [
      react(),
      // Bundle analyzer for production builds
      isProd && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
      }),
    ].filter(Boolean),

    define: {
      // Inject environment variables
      'process.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
      
      // Feature flags
      '__DEV__': isDev,
      '__PROD__': isProd,
      '__DEBUG__': isDev || isStaging,
    },

    build: {
      // Source maps configuration
      sourcemap: isDev ? 'inline' : isStaging ? true : 'hidden',
      
      // Minification
      minify: isProd || isStaging ? 'esbuild' : false,
      
      // Target browsers
      target: isProd ? 'es2020' : 'esnext',
      
      // Chunk size warnings
      chunkSizeWarningLimit: isProd ? 500 : 1000,
      
      rollupOptions: {
        output: {
          // Manual chunk splitting
          manualChunks: isProd ? {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          } : undefined,
          
          // Asset naming
          assetFileNames: isProd 
            ? 'assets/[name].[hash][extname]'
            : 'assets/[name][extname]',
          chunkFileNames: isProd
            ? 'chunks/[name].[hash].js'
            : 'chunks/[name].js',
          entryFileNames: isProd
            ? '[name].[hash].js'
            : '[name].js',
        },
      },
    },

    // Development server
    server: {
      port: parseInt(env.PORT) || 3000,
      strictPort: false,
      open: isDev,
      cors: true,
    },

    // Preview server (for testing production builds locally)
    preview: {
      port: 4173,
      strictPort: true,
    },

    // Optimization
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: isDev ? ['@vite/client'] : [],
    },

    // Environment directory
    envDir: '.',
    envPrefix: 'VITE_',
  };
});
```

### Webpack Configuration

```javascript
// webpack.config.js

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const dotenv = require('dotenv');

module.exports = (env, argv) => {
  const mode = argv.mode || 'development';
  const isDev = mode === 'development';
  const isProd = mode === 'production';
  const isStaging = env.staging === 'true';

  // Load environment variables
  const envFile = `.env.${mode}`;
  const envConfig = dotenv.config({ path: envFile }).parsed || {};

  // Create environment variables for DefinePlugin
  const envKeys = Object.keys(envConfig).reduce((prev, next) => {
    prev[`process.env.${next}`] = JSON.stringify(envConfig[next]);
    return prev;
  }, {});

  return {
    mode,
    
    entry: './src/index.tsx',
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? 'chunks/[name].[contenthash].js' : 'chunks/[name].js',
      publicPath: '/',
      clean: true,
    },

    devtool: isDev ? 'eval-source-map' : isStaging ? 'source-map' : 'hidden-source-map',

    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            'css-loader',
            'postcss-loader',
          ],
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb
            },
          },
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        minify: isProd ? {
          removeComments: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
        } : false,
      }),
      
      new webpack.DefinePlugin({
        ...envKeys,
        'process.env.NODE_ENV': JSON.stringify(mode),
        '__DEV__': isDev,
        '__PROD__': isProd,
      }),

      isProd && new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash].css',
      }),

      env.analyze && new BundleAnalyzerPlugin(),
    ].filter(Boolean),

    optimization: {
      minimize: isProd,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProd,
              drop_debugger: isProd,
            },
            output: {
              comments: false,
            },
          },
        }),
        new CssMinimizerPlugin(),
      ],
      splitChunks: isProd ? {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      } : false,
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },

    devServer: {
      port: 3000,
      hot: true,
      historyApiFallback: true,
      open: true,
    },
  };
};
```

---

## Environment Variable Injection

### Environment Files Structure

```
project/
├── .env                    # Default/shared variables
├── .env.local              # Local overrides (gitignored)
├── .env.development        # Development-specific
├── .env.staging            # Staging-specific
├── .env.production         # Production-specific
├── .env.test               # Test-specific
└── .env.example            # Template for required variables
```

### Environment File Examples

```bash
# .env (shared defaults)
VITE_APP_NAME=MyApp
VITE_DEFAULT_LOCALE=en

# .env.development
VITE_API_URL=http://localhost:3001
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
VITE_MOCK_API=true

# .env.staging
VITE_API_URL=https://staging-api.example.com
VITE_DEBUG=true
VITE_LOG_LEVEL=info
VITE_SENTRY_DSN=https://xxx@sentry.io/staging

# .env.production
VITE_API_URL=https://api.example.com
VITE_DEBUG=false
VITE_LOG_LEVEL=error
VITE_SENTRY_DSN=https://xxx@sentry.io/production
VITE_ANALYTICS_ID=UA-XXXXX-X

# .env.example
VITE_API_URL=
VITE_DEBUG=
VITE_LOG_LEVEL=
VITE_SENTRY_DSN=
VITE_ANALYTICS_ID=
```

### Type-Safe Environment Variables

```typescript
// src/env.ts

/**
 * Environment variable schema and validation
 */

// Define required environment variables
const envSchema = {
  // Required
  VITE_API_URL: { required: true, type: 'string' as const },
  VITE_APP_NAME: { required: true, type: 'string' as const },
  
  // Optional with defaults
  VITE_DEBUG: { required: false, type: 'boolean' as const, default: false },
  VITE_LOG_LEVEL: { required: false, type: 'string' as const, default: 'info' },
  VITE_ANALYTICS_ID: { required: false, type: 'string' as const },
  VITE_SENTRY_DSN: { required: false, type: 'string' as const },
} as const;

type EnvSchema = typeof envSchema;
type EnvKey = keyof EnvSchema;

// Infer types from schema
type EnvValue<K extends EnvKey> = 
  EnvSchema[K]['type'] extends 'boolean' ? boolean :
  EnvSchema[K]['type'] extends 'number' ? number :
  string;

type EnvConfig = {
  [K in EnvKey]: EnvSchema[K]['required'] extends true 
    ? EnvValue<K> 
    : EnvValue<K> | undefined;
};

/**
 * Parse and validate environment variables
 */
function parseEnv(): EnvConfig {
  const env: Partial<EnvConfig> = {};
  const errors: string[] = [];

  for (const [key, schema] of Object.entries(envSchema)) {
    const value = import.meta.env[key];

    if (schema.required && !value) {
      errors.push(`Missing required environment variable: ${key}`);
      continue;
    }

    if (value === undefined) {
      (env as any)[key] = (schema as any).default;
      continue;
    }

    // Type conversion
    switch (schema.type) {
      case 'boolean':
        (env as any)[key] = value === 'true';
        break;
      case 'number':
        (env as any)[key] = Number(value);
        break;
      default:
        (env as any)[key] = value;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return env as EnvConfig;
}

// Export validated config
export const env = parseEnv();

// Type-safe accessors
export const config = {
  apiUrl: env.VITE_API_URL,
  appName: env.VITE_APP_NAME,
  debug: env.VITE_DEBUG ?? false,
  logLevel: env.VITE_LOG_LEVEL ?? 'info',
  analyticsId: env.VITE_ANALYTICS_ID,
  sentryDsn: env.VITE_SENTRY_DSN,
  
  // Computed properties
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
} as const;

export type Config = typeof config;
```

### Server-Side Environment Variables

```typescript
// server/env.ts

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment-specific file
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: envFile });
dotenv.config(); // Also load .env for defaults

/**
 * Server environment schema using Zod
 */
const serverEnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('10'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // External Services
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // Feature Flags
  ENABLE_RATE_LIMITING: z.string().transform(v => v === 'true').default('true'),
  ENABLE_CACHING: z.string().transform(v => v === 'true').default('true'),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parse and validate server environment
 */
function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const serverEnv = parseServerEnv();

// Convenience exports
export const isDev = serverEnv.NODE_ENV === 'development';
export const isProd = serverEnv.NODE_ENV === 'production';
export const isTest = serverEnv.NODE_ENV === 'test';
```

---

## Build-Time vs Runtime Config

### Configuration Types

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     BUILD-TIME vs RUNTIME CONFIGURATION                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  BUILD-TIME (Compiled into bundle)          RUNTIME (Loaded at startup)                │
│                                                                                         │
│  ┌─────────────────────────────────┐       ┌─────────────────────────────────┐         │
│  │ • API URLs                      │       │ • Feature flags                 │         │
│  │ • Public keys                   │       │ • A/B test variants             │         │
│  │ • Analytics IDs                 │       │ • User preferences              │         │
│  │ • App version                   │       │ • Tenant configuration          │         │
│  │ • Build timestamp               │       │ • Dynamic endpoints             │         │
│  │ • Feature toggles (static)      │       │ • Localization                  │         │
│  └─────────────────────────────────┘       └─────────────────────────────────┘         │
│                                                                                         │
│  Pros:                                      Pros:                                       │
│  ✓ Dead code elimination                    ✓ No rebuild needed                        │
│  ✓ Smaller bundles                          ✓ Instant updates                          │
│  ✓ Type safety                              ✓ Per-user config                          │
│                                                                                         │
│  Cons:                                      Cons:                                       │
│  ✗ Requires rebuild                         ✗ Extra network request                    │
│  ✗ No per-user config                       ✗ Larger initial payload                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Build-Time Configuration

```typescript
// vite.config.ts - Build-time injection

export default defineConfig(({ mode }) => ({
  define: {
    // These are replaced at build time
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
    '__COMMIT_SHA__': JSON.stringify(process.env.COMMIT_SHA || 'unknown'),
    '__API_URL__': JSON.stringify(process.env.VITE_API_URL),
    
    // Feature flags (enables dead code elimination)
    '__FEATURE_NEW_DASHBOARD__': mode === 'production' ? 'true' : 'false',
    '__FEATURE_DARK_MODE__': 'true',
  },
}));

// Usage in code
function App() {
  // This code is removed in production if feature is disabled
  if (__FEATURE_NEW_DASHBOARD__) {
    return <NewDashboard />;
  }
  return <OldDashboard />;
}
```

### Runtime Configuration

```typescript
// src/config/runtime.ts

interface RuntimeConfig {
  features: {
    newDashboard: boolean;
    darkMode: boolean;
    betaFeatures: boolean;
  };
  experiments: {
    variant: string;
    bucket: number;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
}

class RuntimeConfigManager {
  private config: RuntimeConfig | null = null;
  private configUrl: string;
  private refreshInterval: number;
  private listeners: Set<(config: RuntimeConfig) => void> = new Set();

  constructor(configUrl: string, refreshInterval = 60000) {
    this.configUrl = configUrl;
    this.refreshInterval = refreshInterval;
  }

  /**
   * Initialize and start auto-refresh
   */
  async init(): Promise<RuntimeConfig> {
    await this.fetch();
    this.startAutoRefresh();
    return this.config!;
  }

  /**
   * Fetch configuration from server
   */
  async fetch(): Promise<void> {
    try {
      const response = await fetch(this.configUrl, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.status}`);
      }

      const newConfig = await response.json();
      
      // Check if config changed
      if (JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
        this.config = newConfig;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to fetch runtime config:', error);
      // Keep existing config on error
    }
  }

  /**
   * Start auto-refresh
   */
  private startAutoRefresh(): void {
    setInterval(() => this.fetch(), this.refreshInterval);
  }

  /**
   * Subscribe to config changes
   */
  subscribe(listener: (config: RuntimeConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.config!);
    }
  }

  /**
   * Get current config
   */
  get(): RuntimeConfig {
    if (!this.config) {
      throw new Error('Runtime config not initialized');
    }
    return this.config;
  }

  /**
   * Check feature flag
   */
  isFeatureEnabled(feature: keyof RuntimeConfig['features']): boolean {
    return this.config?.features[feature] ?? false;
  }
}

// Singleton instance
export const runtimeConfig = new RuntimeConfigManager('/api/config');

// React hook
export function useRuntimeConfig(): RuntimeConfig | null {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    runtimeConfig.init().then(setConfig);
    return runtimeConfig.subscribe(setConfig);
  }, []);

  return config;
}
```

### Hybrid Configuration

```typescript
// src/config/index.ts

import { config as buildTimeConfig } from './buildTime';
import { runtimeConfig } from './runtime';

/**
 * Unified configuration that combines build-time and runtime config
 */
class UnifiedConfig {
  /**
   * Get API URL (build-time, can be overridden at runtime)
   */
  get apiUrl(): string {
    return runtimeConfig.get()?.apiOverrides?.apiUrl ?? buildTimeConfig.apiUrl;
  }

  /**
   * Check if feature is enabled (runtime takes precedence)
   */
  isFeatureEnabled(feature: string): boolean {
    // Check runtime config first
    const runtimeFeatures = runtimeConfig.get()?.features;
    if (runtimeFeatures && feature in runtimeFeatures) {
      return runtimeFeatures[feature as keyof typeof runtimeFeatures];
    }

    // Fall back to build-time config
    return buildTimeConfig.features[feature] ?? false;
  }

  /**
   * Get app version (build-time only)
   */
  get version(): string {
    return buildTimeConfig.version;
  }

  /**
   * Get build info (build-time only)
   */
  get buildInfo(): { time: string; commit: string } {
    return {
      time: buildTimeConfig.buildTime,
      commit: buildTimeConfig.commitSha,
    };
  }

  /**
   * Check if in maintenance mode (runtime only)
   */
  get isMaintenanceMode(): boolean {
    return runtimeConfig.get()?.maintenance?.enabled ?? false;
  }
}

export const appConfig = new UnifiedConfig();
```

---

## Framework-Specific Configuration

### Next.js Configuration

```javascript
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Environment-specific settings
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Build configuration based on environment
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    },
  }),

  // Source maps
  productionBrowserSourceMaps: process.env.NODE_ENV === 'staging',

  // Webpack customization
  webpack: (config, { dev, isServer }) => {
    // Add environment-specific plugins
    if (!dev && !isServer) {
      // Production client-side optimizations
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }

    return config;
  },

  // Headers based on environment
  async headers() {
    const headers = [];

    if (process.env.NODE_ENV === 'production') {
      headers.push({
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      });
    }

    return headers;
  },
};

module.exports = nextConfig;
```

### Create React App Configuration

```javascript
// config-overrides.js (with react-app-rewired)

const webpack = require('webpack');

module.exports = function override(config, env) {
  const isProd = env === 'production';
  const isStaging = process.env.REACT_APP_ENV === 'staging';

  // Add custom DefinePlugin entries
  config.plugins.push(
    new webpack.DefinePlugin({
      '__DEV__': !isProd,
      '__STAGING__': isStaging,
      '__VERSION__': JSON.stringify(process.env.npm_package_version),
    })
  );

  // Modify source maps for staging
  if (isStaging) {
    config.devtool = 'source-map';
  }

  // Remove console in production
  if (isProd) {
    config.optimization.minimizer[0].options.terserOptions.compress.drop_console = true;
  }

  return config;
};
```

---

## Secrets Management

### Secrets Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SECRETS MANAGEMENT ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  DEVELOPMENT                  STAGING/PRODUCTION                                        │
│                                                                                         │
│  ┌─────────────────┐         ┌─────────────────────────────────────────────────────┐   │
│  │  .env.local     │         │                 SECRETS MANAGER                      │   │
│  │  (gitignored)   │         │                                                      │   │
│  │                 │         │  ┌───────────┐  ┌───────────┐  ┌───────────┐       │   │
│  │  API_KEY=xxx    │         │  │  AWS      │  │  HashiCorp│  │  GCP      │       │   │
│  │  DB_PASSWORD=   │         │  │  Secrets  │  │  Vault    │  │  Secret   │       │   │
│  │                 │         │  │  Manager  │  │           │  │  Manager  │       │   │
│  └─────────────────┘         │  └───────────┘  └───────────┘  └───────────┘       │   │
│                              │         │              │              │              │   │
│                              │         └──────────────┴──────────────┘              │   │
│                              │                        │                             │   │
│                              │                        ▼                             │   │
│                              │              ┌─────────────────┐                     │   │
│                              │              │  Application    │                     │   │
│                              │              │  (at runtime)   │                     │   │
│                              │              └─────────────────┘                     │   │
│                              │                                                      │   │
│                              └──────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### AWS Secrets Manager Integration

```typescript
// src/secrets/aws.ts

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface SecretCache {
  value: Record<string, string>;
  expiresAt: number;
}

class AWSSecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, SecretCache> = new Map();
  private cacheTTL: number;

  constructor(region: string, cacheTTL = 300000) { // 5 minutes default
    this.client = new SecretsManagerClient({ region });
    this.cacheTTL = cacheTTL;
  }

  /**
   * Get secret value
   */
  async getSecret(secretName: string): Promise<Record<string, string>> {
    // Check cache
    const cached = this.cache.get(secretName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Fetch from AWS
    const response = await this.client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    const value = JSON.parse(response.SecretString || '{}');

    // Cache result
    this.cache.set(secretName, {
      value,
      expiresAt: Date.now() + this.cacheTTL,
    });

    return value;
  }

  /**
   * Get specific key from secret
   */
  async getSecretKey(secretName: string, key: string): Promise<string | undefined> {
    const secret = await this.getSecret(secretName);
    return secret[key];
  }

  /**
   * Load secrets into environment
   */
  async loadIntoEnv(secretName: string): Promise<void> {
    const secrets = await this.getSecret(secretName);
    
    for (const [key, value] of Object.entries(secrets)) {
      process.env[key] = value;
    }
  }
}

export const secretsManager = new AWSSecretsManager(
  process.env.AWS_REGION || 'us-east-1'
);
```

### Environment-Specific Secrets

```typescript
// src/secrets/loader.ts

import { secretsManager } from './aws';

interface SecretsConfig {
  development: string[];
  staging: string[];
  production: string[];
}

const secretsConfig: SecretsConfig = {
  development: [
    // Usually loaded from .env.local in development
  ],
  staging: [
    'myapp/staging/database',
    'myapp/staging/api-keys',
  ],
  production: [
    'myapp/production/database',
    'myapp/production/api-keys',
    'myapp/production/encryption',
  ],
};

/**
 * Load all secrets for current environment
 */
async function loadSecrets(): Promise<void> {
  const env = process.env.NODE_ENV as keyof SecretsConfig;
  const secretNames = secretsConfig[env] || [];

  if (secretNames.length === 0) {
    console.log('No secrets to load for environment:', env);
    return;
  }

  console.log(`Loading ${secretNames.length} secrets for ${env}...`);

  await Promise.all(
    secretNames.map(name => secretsManager.loadIntoEnv(name))
  );

  console.log('Secrets loaded successfully');
}

export { loadSecrets };
```

---

## Multi-Environment Pipelines

### GitHub Actions Multi-Environment

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [development, staging, production]
        exclude:
          - environment: production
            # Only build production on main branch
          - environment: staging
            # Only build staging on staging branch
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - run: pnpm install --frozen-lockfile
      
      - name: Build for ${{ matrix.environment }}
        run: pnpm build
        env:
          NODE_ENV: ${{ matrix.environment }}
          VITE_API_URL: ${{ vars[format('VITE_API_URL_{0}', matrix.environment)] }}
          VITE_SENTRY_DSN: ${{ secrets[format('SENTRY_DSN_{0}', matrix.environment)] }}
          
      - uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.environment }}
          path: dist/

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-staging
          path: dist/
          
      - name: Deploy to Staging
        run: |
          # Deploy to staging environment
          echo "Deploying to staging..."

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-production
          path: dist/
          
      - name: Deploy to Production
        run: |
          # Deploy to production environment
          echo "Deploying to production..."
```

### Terraform Multi-Environment

```hcl
# terraform/environments/main.tf

variable "environment" {
  type        = string
  description = "Environment name (development, staging, production)"
}

locals {
  env_config = {
    development = {
      instance_type = "t3.micro"
      min_capacity  = 1
      max_capacity  = 2
      domain        = "dev.example.com"
    }
    staging = {
      instance_type = "t3.small"
      min_capacity  = 2
      max_capacity  = 4
      domain        = "staging.example.com"
    }
    production = {
      instance_type = "t3.medium"
      min_capacity  = 3
      max_capacity  = 10
      domain        = "example.com"
    }
  }

  config = local.env_config[var.environment]
}

resource "aws_instance" "app" {
  instance_type = local.config.instance_type
  
  tags = {
    Environment = var.environment
    Name        = "app-${var.environment}"
  }
}

resource "aws_autoscaling_group" "app" {
  min_size = local.config.min_capacity
  max_size = local.config.max_capacity
  
  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }
}
```

---

## Feature Flags

### Feature Flag System

```typescript
// src/features/flags.ts

interface FeatureFlag {
  name: string;
  enabled: boolean;
  environments: string[];
  percentage?: number; // For gradual rollout
  userGroups?: string[]; // For targeted rollout
}

const featureFlags: FeatureFlag[] = [
  {
    name: 'new-dashboard',
    enabled: true,
    environments: ['development', 'staging'],
    percentage: 100,
  },
  {
    name: 'dark-mode',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    percentage: 100,
  },
  {
    name: 'ai-assistant',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    percentage: 10, // 10% rollout
    userGroups: ['beta-testers'],
  },
  {
    name: 'new-checkout',
    enabled: true,
    environments: ['development', 'staging'],
    percentage: 50,
  },
];

class FeatureFlagManager {
  private flags: Map<string, FeatureFlag>;
  private environment: string;

  constructor(environment: string) {
    this.environment = environment;
    this.flags = new Map(featureFlags.map(f => [f.name, f]));
  }

  /**
   * Check if feature is enabled
   */
  isEnabled(
    featureName: string,
    context?: { userId?: string; userGroups?: string[] }
  ): boolean {
    const flag = this.flags.get(featureName);
    
    if (!flag || !flag.enabled) {
      return false;
    }

    // Check environment
    if (!flag.environments.includes(this.environment)) {
      return false;
    }

    // Check user groups
    if (flag.userGroups && context?.userGroups) {
      const hasGroup = flag.userGroups.some(g => context.userGroups?.includes(g));
      if (hasGroup) {
        return true;
      }
    }

    // Check percentage rollout
    if (flag.percentage !== undefined && flag.percentage < 100) {
      if (!context?.userId) {
        return false;
      }
      
      // Deterministic hash based on userId and feature name
      const hash = this.hashString(`${context.userId}-${featureName}`);
      const bucket = hash % 100;
      
      return bucket < flag.percentage;
    }

    return true;
  }

  /**
   * Get all enabled features for user
   */
  getEnabledFeatures(context?: { userId?: string; userGroups?: string[] }): string[] {
    return Array.from(this.flags.keys()).filter(name => 
      this.isEnabled(name, context)
    );
  }

  /**
   * Simple string hash
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const featureFlags = new FeatureFlagManager(
  process.env.NODE_ENV || 'development'
);

// React hook
export function useFeatureFlag(
  featureName: string,
  context?: { userId?: string; userGroups?: string[] }
): boolean {
  return featureFlags.isEnabled(featureName, context);
}
```

### Feature Flag Component

```tsx
// src/components/FeatureFlag.tsx

import { useFeatureFlag } from '../features/flags';
import { useAuth } from '../hooks/useAuth';

interface FeatureFlagProps {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlag({ name, children, fallback = null }: FeatureFlagProps) {
  const { user } = useAuth();
  
  const isEnabled = useFeatureFlag(name, {
    userId: user?.id,
    userGroups: user?.groups,
  });

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
function App() {
  return (
    <div>
      <FeatureFlag name="new-dashboard" fallback={<OldDashboard />}>
        <NewDashboard />
      </FeatureFlag>
      
      <FeatureFlag name="ai-assistant">
        <AIAssistant />
      </FeatureFlag>
    </div>
  );
}
```

---

## Best Practices

### Environment Configuration Checklist

| Practice | Description | Required |
|----------|-------------|----------|
| **Separate env files** | One per environment | ✅ |
| **Type validation** | Validate all env vars | ✅ |
| **Secrets in vault** | Never commit secrets | ✅ |
| **Default values** | Sensible defaults | ⚠️ |
| **Documentation** | .env.example file | ✅ |
| **Build-time injection** | For static config | ⚠️ |
| **Runtime config** | For dynamic config | ⚠️ |

### Security Best Practices

| Practice | Description |
|----------|-------------|
| **Never commit secrets** | Use .gitignore for .env.local |
| **Rotate secrets** | Regular rotation schedule |
| **Least privilege** | Minimal permissions per env |
| **Audit access** | Log secret access |
| **Encrypt at rest** | Use secrets managers |

### Configuration Hierarchy

```
Priority (highest to lowest):
1. Runtime config (API response)
2. Environment variables
3. .env.local (development only)
4. .env.[environment]
5. .env
6. Default values in code
```

---

## Summary

### Quick Reference

```bash
# Build for different environments
NODE_ENV=development pnpm build
NODE_ENV=staging pnpm build
NODE_ENV=production pnpm build

# Run with environment
NODE_ENV=production node dist/server.js

# Load specific env file
dotenv -e .env.staging -- pnpm start
```

### Environment Comparison

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Source Maps** | Inline | External | Hidden |
| **Minification** | No | Yes | Yes |
| **Debug Logging** | Full | Limited | None |
| **Error Details** | Full | Limited | Generic |
| **Feature Flags** | All | Most | Stable only |
| **Analytics** | No | Yes | Yes |
| **Secrets** | Local | Vault | Vault |
