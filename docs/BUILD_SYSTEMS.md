# Build Systems Support

This guide provides comprehensive coverage of build system support in cloud development environments, including Vite, Webpack, esbuild, and SWC configurations, optimizations, and best practices.

---

## Table of Contents

1. [Overview](#overview)
2. [Build System Architecture](#build-system-architecture)
3. [Vite](#vite)
4. [Webpack](#webpack)
5. [esbuild](#esbuild)
6. [SWC](#swc)
7. [Build System Detection](#build-system-detection)
8. [Hybrid Configurations](#hybrid-configurations)
9. [Plugin Ecosystem](#plugin-ecosystem)
10. [Migration Guides](#migration-guides)
11. [Best Practices](#best-practices)

---

## Overview

Modern web development relies on sophisticated build systems to transform, bundle, and optimize code for production. Cloud development environments support multiple build systems to accommodate diverse project requirements.

### Build System Comparison

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           BUILD SYSTEM COMPARISON                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SPEED (Cold Build)                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│  esbuild    ████████████████████████████████████████████████████████████  100x         │
│  SWC        ██████████████████████████████████████████████████            70x          │
│  Vite       ████████████████████████████████████                          50x          │
│  Webpack    ████████                                                       1x          │
│                                                                                         │
│  FEATURES                                                                               │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│  Webpack    ████████████████████████████████████████████████████████████  Full         │
│  Vite       ██████████████████████████████████████████████████            High         │
│  SWC        ████████████████████████████████████                          Medium       │
│  esbuild    ████████████████████████████                                  Basic        │
│                                                                                         │
│  ECOSYSTEM                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│  Webpack    ████████████████████████████████████████████████████████████  Largest      │
│  Vite       ██████████████████████████████████████████████████            Growing      │
│  SWC        ████████████████████████████████████                          Medium       │
│  esbuild    ████████████████████████████                                  Focused      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Feature Matrix

| Feature | Vite | Webpack | esbuild | SWC |
|---------|------|---------|---------|-----|
| **Dev Server** | ✅ Native | ✅ webpack-dev-server | ⚠️ Basic | ❌ |
| **HMR** | ✅ Fast | ✅ Full | ⚠️ Limited | ❌ |
| **Code Splitting** | ✅ | ✅ | ✅ | ⚠️ |
| **Tree Shaking** | ✅ | ✅ | ✅ | ✅ |
| **CSS Processing** | ✅ | ✅ Plugin | ⚠️ Basic | ❌ |
| **TypeScript** | ✅ | ✅ Loader | ✅ Native | ✅ Native |
| **JSX** | ✅ | ✅ Loader | ✅ Native | ✅ Native |
| **Minification** | ✅ | ✅ Plugin | ✅ Native | ✅ Native |
| **Source Maps** | ✅ | ✅ | ✅ | ✅ |
| **Legacy Browser** | ✅ Plugin | ✅ | ⚠️ Limited | ⚠️ Limited |

---

## Build System Architecture

### Build Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              BUILD PIPELINE ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SOURCE FILES                                                                           │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         RESOLUTION                                               │   │
│  │  • Module resolution (node_modules, aliases)                                    │   │
│  │  • Path mapping (tsconfig paths)                                                │   │
│  │  • Import analysis                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         TRANSFORMATION                                           │   │
│  │  • TypeScript → JavaScript                                                      │   │
│  │  • JSX → JavaScript                                                             │   │
│  │  • CSS preprocessing (Sass, Less, PostCSS)                                      │   │
│  │  • Asset processing (images, fonts)                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         BUNDLING                                                 │   │
│  │  • Dependency graph construction                                                │   │
│  │  • Code splitting                                                               │   │
│  │  • Chunk optimization                                                           │   │
│  │  • Tree shaking                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         OPTIMIZATION                                             │   │
│  │  • Minification                                                                 │   │
│  │  • Compression (gzip, brotli)                                                   │   │
│  │  • Asset hashing                                                                │   │
│  │  • Source maps                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  OUTPUT FILES                                                                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Vite

### Overview

Vite is a next-generation frontend build tool that leverages native ES modules for lightning-fast development and Rollup for optimized production builds.

### Configuration

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // Plugins
  plugins: [
    react({
      // Use SWC for faster refresh
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
        ],
      },
    }),
  ],

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@hooks': resolve(__dirname, 'src/hooks'),
    },
  },

  // Development server
  server: {
    port: 3000,
    host: true,
    open: false,
    cors: true,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // Build configuration
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    
    // CSS code splitting
    cssCodeSplit: true,
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // Optimization
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['@vite/client', '@vite/env'],
  },

  // Environment variables
  envPrefix: 'VITE_',
  envDir: '.',

  // Preview server (production preview)
  preview: {
    port: 4173,
    host: true,
  },
});
```

### Vite with React + SWC

```typescript
// vite.config.ts - Using SWC for faster builds

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [
    react({
      // SWC options
      jsxImportSource: '@emotion/react',
      plugins: [
        ['@swc/plugin-emotion', {}],
      ],
    }),
  ],
  
  // esbuild is still used for dependencies
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
});
```

### Vite Library Mode

```typescript
// vite.config.ts - Library build

import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyLibrary',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => `my-library.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
```

---

## Webpack

### Overview

Webpack is the most mature and feature-rich bundler with extensive plugin ecosystem and configuration options.

### Configuration

```javascript
// webpack.config.js

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDev ? 'development' : 'production',
  
  entry: {
    main: './src/index.tsx',
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? '[name].js' : '[name].[contenthash].js',
    chunkFilename: isDev ? '[name].chunk.js' : '[name].[contenthash].chunk.js',
    assetModuleFilename: 'assets/[name].[contenthash][ext]',
    clean: true,
    publicPath: '/',
  },
  
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    },
  },
  
  module: {
    rules: [
      // TypeScript/JavaScript
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
              plugins: [
                isDev && require.resolve('react-refresh/babel'),
              ].filter(Boolean),
            },
          },
        ],
      },
      
      // CSS
      {
        test: /\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                localIdentName: isDev 
                  ? '[name]__[local]--[hash:base64:5]'
                  : '[hash:base64]',
              },
            },
          },
          'postcss-loader',
        ],
      },
      
      // SCSS
      {
        test: /\.scss$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              additionalData: `@import "@/styles/variables.scss";`,
            },
          },
        ],
      },
      
      // Images
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8kb
          },
        },
      },
      
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      favicon: './public/favicon.ico',
    }),
    
    !isDev && new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[name].[contenthash].chunk.css',
    }),
    
    new ForkTsCheckerWebpackPlugin({
      async: isDev,
      typescript: {
        configFile: './tsconfig.json',
      },
    }),
    
    process.env.ANALYZE && new BundleAnalyzerPlugin(),
  ].filter(Boolean),
  
  optimization: {
    minimize: !isDev,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
      new CssMinimizerPlugin(),
    ],
    
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    
    runtimeChunk: 'single',
  },
  
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    compress: true,
    client: {
      overlay: true,
      progress: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  
  devtool: isDev ? 'eval-source-map' : 'source-map',
  
  stats: isDev ? 'minimal' : 'normal',
  
  performance: {
    hints: isDev ? false : 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
};
```

### Webpack with SWC Loader

```javascript
// webpack.config.js - Using SWC instead of Babel

module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  refresh: process.env.NODE_ENV === 'development',
                },
              },
              target: 'es2020',
            },
            minify: process.env.NODE_ENV === 'production',
          },
        },
      },
    ],
  },
};
```

---

## esbuild

### Overview

esbuild is an extremely fast JavaScript bundler written in Go, offering 10-100x faster builds than traditional bundlers.

### Configuration

```javascript
// esbuild.config.js

const esbuild = require('esbuild');
const { sassPlugin } = require('esbuild-sass-plugin');
const { copy } = require('esbuild-plugin-copy');

const isDev = process.env.NODE_ENV !== 'production';

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    outdir: 'dist',
    
    // Output format
    format: 'esm',
    splitting: true,
    
    // Minification
    minify: !isDev,
    
    // Source maps
    sourcemap: isDev ? 'inline' : true,
    
    // Target browsers
    target: ['es2020', 'chrome90', 'firefox88', 'safari14'],
    
    // Asset handling
    loader: {
      '.png': 'file',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.gif': 'file',
      '.svg': 'file',
      '.woff': 'file',
      '.woff2': 'file',
      '.eot': 'file',
      '.ttf': 'file',
    },
    assetNames: 'assets/[name]-[hash]',
    
    // Chunk naming
    chunkNames: 'chunks/[name]-[hash]',
    entryNames: '[name]-[hash]',
    
    // External packages (not bundled)
    external: [],
    
    // Define globals
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
    },
    
    // Plugins
    plugins: [
      sassPlugin(),
      copy({
        assets: [
          { from: './public/*', to: './' },
        ],
      }),
    ],
    
    // Metafile for analysis
    metafile: true,
    
    // Tree shaking
    treeShaking: true,
    
    // Legal comments
    legalComments: 'none',
    
    // JSX
    jsx: 'automatic',
    jsxImportSource: 'react',
  });

  if (isDev) {
    // Watch mode with serve
    await ctx.watch();
    
    const { host, port } = await ctx.serve({
      servedir: 'dist',
      port: 3000,
    });
    
    console.log(`Server running at http://${host}:${port}`);
  } else {
    // Production build
    const result = await ctx.rebuild();
    
    // Output metafile for analysis
    require('fs').writeFileSync(
      'dist/meta.json',
      JSON.stringify(result.metafile, null, 2)
    );
    
    await ctx.dispose();
    console.log('Build complete');
  }
}

build().catch(() => process.exit(1));
```

### esbuild API Usage

```typescript
// build.ts - Programmatic API

import * as esbuild from 'esbuild';

// Simple build
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
});

// Transform API (no bundling)
const result = await esbuild.transform(code, {
  loader: 'tsx',
  target: 'es2020',
  minify: true,
});

// Build with custom plugin
const myPlugin: esbuild.Plugin = {
  name: 'my-plugin',
  setup(build) {
    // Resolve hook
    build.onResolve({ filter: /^env$/ }, (args) => ({
      path: args.path,
      namespace: 'env-ns',
    }));
    
    // Load hook
    build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
      contents: JSON.stringify(process.env),
      loader: 'json',
    }));
    
    // Start hook
    build.onStart(() => {
      console.log('Build started');
    });
    
    // End hook
    build.onEnd((result) => {
      console.log(`Build ended with ${result.errors.length} errors`);
    });
  },
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [myPlugin],
});
```

---

## SWC

### Overview

SWC (Speedy Web Compiler) is a Rust-based JavaScript/TypeScript compiler that can be used as a drop-in replacement for Babel with significantly faster performance.

### Configuration

```json
// .swcrc

{
  "$schema": "https://json.schemastore.org/swcrc",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "importSource": "react",
        "refresh": true,
        "development": true
      },
      "decoratorMetadata": true,
      "legacyDecorator": true
    },
    "target": "es2020",
    "loose": false,
    "externalHelpers": true,
    "keepClassNames": true,
    "minify": {
      "compress": {
        "unused": true,
        "dead_code": true,
        "drop_console": true
      },
      "mangle": true
    }
  },
  "module": {
    "type": "es6",
    "strict": true,
    "strictMode": true,
    "lazy": false,
    "noInterop": false
  },
  "minify": true,
  "sourceMaps": true,
  "env": {
    "targets": {
      "chrome": "90",
      "firefox": "88",
      "safari": "14"
    },
    "mode": "usage",
    "coreJs": "3"
  }
}
```

### SWC CLI Usage

```bash
# Compile single file
swc src/index.ts -o dist/index.js

# Compile directory
swc src -d dist

# Watch mode
swc src -d dist --watch

# With source maps
swc src -d dist --source-maps

# Minify
swc src/index.ts -o dist/index.min.js --minify
```

### SWC Programmatic API

```typescript
// build.ts - SWC API

import { transform, transformSync, bundle } from '@swc/core';

// Async transform
const output = await transform(code, {
  filename: 'input.tsx',
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
    },
    transform: {
      react: {
        runtime: 'automatic',
      },
    },
  },
  sourceMaps: true,
});

console.log(output.code);
console.log(output.map);

// Sync transform
const syncOutput = transformSync(code, {
  filename: 'input.tsx',
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
    },
  },
});

// Bundle (experimental)
const bundleOutput = await bundle({
  entry: {
    main: './src/index.ts',
  },
  output: {
    path: './dist',
  },
  module: {},
  options: {
    jsc: {
      parser: {
        syntax: 'typescript',
      },
    },
  },
});
```

### SWC with Next.js

```javascript
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SWC is enabled by default in Next.js 12+
  swcMinify: true,
  
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
    
    // Styled-components support
    styledComponents: true,
    
    // Emotion support
    emotion: true,
    
    // React removal of data-testid
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
  
  experimental: {
    // SWC plugins
    swcPlugins: [
      ['@swc/plugin-styled-components', {}],
    ],
  },
};

module.exports = nextConfig;
```

---

## Build System Detection

### Auto-Detection Logic

```typescript
// src/build/detector.ts

import * as fs from 'fs';
import * as path from 'path';

type BuildSystem = 'vite' | 'webpack' | 'esbuild' | 'swc' | 'rollup' | 'parcel' | 'unknown';

interface DetectionResult {
  buildSystem: BuildSystem;
  configFile: string | null;
  confidence: number;
  features: string[];
}

class BuildSystemDetector {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async detect(): Promise<DetectionResult> {
    const checks = [
      this.checkVite(),
      this.checkWebpack(),
      this.checkEsbuild(),
      this.checkSwc(),
      this.checkRollup(),
      this.checkParcel(),
    ];

    const results = await Promise.all(checks);
    const detected = results.filter(r => r.confidence > 0);
    
    if (detected.length === 0) {
      return {
        buildSystem: 'unknown',
        configFile: null,
        confidence: 0,
        features: [],
      };
    }

    // Return highest confidence match
    return detected.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private async checkVite(): Promise<DetectionResult> {
    const configFiles = [
      'vite.config.ts',
      'vite.config.js',
      'vite.config.mjs',
    ];

    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        const features = await this.analyzeViteConfig(filePath);
        return {
          buildSystem: 'vite',
          configFile: file,
          confidence: 100,
          features,
        };
      }
    }

    // Check package.json for vite dependency
    const packageJson = this.readPackageJson();
    if (packageJson?.devDependencies?.vite || packageJson?.dependencies?.vite) {
      return {
        buildSystem: 'vite',
        configFile: null,
        confidence: 80,
        features: [],
      };
    }

    return { buildSystem: 'vite', configFile: null, confidence: 0, features: [] };
  }

  private async checkWebpack(): Promise<DetectionResult> {
    const configFiles = [
      'webpack.config.js',
      'webpack.config.ts',
      'webpack.config.babel.js',
    ];

    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        return {
          buildSystem: 'webpack',
          configFile: file,
          confidence: 100,
          features: await this.analyzeWebpackConfig(filePath),
        };
      }
    }

    const packageJson = this.readPackageJson();
    if (packageJson?.devDependencies?.webpack || packageJson?.dependencies?.webpack) {
      return {
        buildSystem: 'webpack',
        configFile: null,
        confidence: 80,
        features: [],
      };
    }

    return { buildSystem: 'webpack', configFile: null, confidence: 0, features: [] };
  }

  private async checkEsbuild(): Promise<DetectionResult> {
    const configFiles = [
      'esbuild.config.js',
      'esbuild.config.mjs',
      'build.js',
    ];

    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('esbuild')) {
          return {
            buildSystem: 'esbuild',
            configFile: file,
            confidence: 100,
            features: [],
          };
        }
      }
    }

    const packageJson = this.readPackageJson();
    if (packageJson?.devDependencies?.esbuild || packageJson?.dependencies?.esbuild) {
      return {
        buildSystem: 'esbuild',
        configFile: null,
        confidence: 70,
        features: [],
      };
    }

    return { buildSystem: 'esbuild', configFile: null, confidence: 0, features: [] };
  }

  private async checkSwc(): Promise<DetectionResult> {
    const configFiles = ['.swcrc', 'swc.config.js'];

    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        return {
          buildSystem: 'swc',
          configFile: file,
          confidence: 100,
          features: [],
        };
      }
    }

    const packageJson = this.readPackageJson();
    if (packageJson?.devDependencies?.['@swc/core']) {
      return {
        buildSystem: 'swc',
        configFile: null,
        confidence: 70,
        features: [],
      };
    }

    return { buildSystem: 'swc', configFile: null, confidence: 0, features: [] };
  }

  private async checkRollup(): Promise<DetectionResult> {
    const configFiles = ['rollup.config.js', 'rollup.config.mjs', 'rollup.config.ts'];

    for (const file of configFiles) {
      const filePath = path.join(this.projectPath, file);
      if (fs.existsSync(filePath)) {
        return {
          buildSystem: 'rollup',
          configFile: file,
          confidence: 100,
          features: [],
        };
      }
    }

    return { buildSystem: 'rollup', configFile: null, confidence: 0, features: [] };
  }

  private async checkParcel(): Promise<DetectionResult> {
    const packageJson = this.readPackageJson();
    
    if (packageJson?.devDependencies?.parcel || packageJson?.dependencies?.parcel) {
      return {
        buildSystem: 'parcel',
        configFile: null,
        confidence: 80,
        features: [],
      };
    }

    return { buildSystem: 'parcel', configFile: null, confidence: 0, features: [] };
  }

  private readPackageJson(): any {
    try {
      const content = fs.readFileSync(
        path.join(this.projectPath, 'package.json'),
        'utf-8'
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async analyzeViteConfig(filePath: string): Promise<string[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const features: string[] = [];

    if (content.includes('@vitejs/plugin-react')) features.push('react');
    if (content.includes('@vitejs/plugin-vue')) features.push('vue');
    if (content.includes('vite-plugin-svelte')) features.push('svelte');
    if (content.includes('plugin-react-swc')) features.push('swc');
    if (content.includes('vite-plugin-pwa')) features.push('pwa');

    return features;
  }

  private async analyzeWebpackConfig(filePath: string): Promise<string[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const features: string[] = [];

    if (content.includes('babel-loader')) features.push('babel');
    if (content.includes('swc-loader')) features.push('swc');
    if (content.includes('ts-loader')) features.push('typescript');
    if (content.includes('sass-loader')) features.push('sass');
    if (content.includes('MiniCssExtractPlugin')) features.push('css-extract');

    return features;
  }
}

export { BuildSystemDetector, BuildSystem, DetectionResult };
```

---

## Hybrid Configurations

### Vite + esbuild (Default)

```typescript
// vite.config.ts - Vite uses esbuild by default

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  // esbuild options (used for deps optimization and minification)
  esbuild: {
    // JSX configuration
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsxInject: `import React from 'react'`,
    
    // Target
    target: 'es2020',
    
    // Minification options
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    
    // Keep names for debugging
    keepNames: false,
    
    // Legal comments
    legalComments: 'none',
  },
  
  // Dependency optimization
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
      supported: {
        'top-level-await': true,
      },
    },
  },
});
```

### Vite + SWC

```typescript
// vite.config.ts - Using SWC for React

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [
    react({
      // SWC options
      jsxImportSource: '@emotion/react',
      plugins: [
        ['@swc/plugin-emotion', {}],
        ['@swc/plugin-styled-components', {
          displayName: true,
          ssr: true,
        }],
      ],
    }),
  ],
});
```

### Webpack + esbuild

```javascript
// webpack.config.js - Using esbuild for minification

const { EsbuildPlugin } = require('esbuild-loader');

module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: 'esbuild-loader',
        options: {
          target: 'es2020',
        },
      },
    ],
  },
  
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        target: 'es2020',
        css: true,
      }),
    ],
  },
};
```

### Webpack + SWC

```javascript
// webpack.config.js - Using SWC loader

module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
      },
    ],
  },
};
```

---

## Plugin Ecosystem

### Vite Plugins

```typescript
// vite.config.ts - Common plugins

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import compression from 'vite-plugin-compression';
import imagemin from 'vite-plugin-imagemin';

export default defineConfig({
  plugins: [
    // React support
    react(),
    
    // PWA support
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'My App',
        short_name: 'App',
        theme_color: '#ffffff',
      },
    }),
    
    // Legacy browser support
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
    
    // Gzip/Brotli compression
    compression({
      algorithm: 'gzip',
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    
    // Image optimization
    imagemin({
      gifsicle: { optimizationLevel: 3 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: { plugins: [{ removeViewBox: false }] },
    }),
    
    // Bundle analyzer
    visualizer({
      open: true,
      filename: 'dist/stats.html',
    }),
  ],
});
```

### Webpack Plugins

```javascript
// webpack.config.js - Common plugins

const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');

module.exports = {
  plugins: [
    // HTML generation
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    
    // CSS extraction
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }),
    
    // Copy static files
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '.', globOptions: { ignore: ['**/index.html'] } },
      ],
    }),
    
    // Compression
    new CompressionPlugin({
      algorithm: 'gzip',
    }),
    
    // PWA
    new WorkboxPlugin.GenerateSW({
      clientsClaim: true,
      skipWaiting: true,
    }),
    
    // Bundle analyzer
    process.env.ANALYZE && new BundleAnalyzerPlugin(),
    
    // Image optimization
    new ImageMinimizerPlugin({
      minimizer: {
        implementation: ImageMinimizerPlugin.imageminMinify,
        options: {
          plugins: [
            ['gifsicle', { interlaced: true }],
            ['mozjpeg', { quality: 80 }],
            ['pngquant', { quality: [0.8, 0.9] }],
          ],
        },
      },
    }),
  ].filter(Boolean),
};
```

---

## Migration Guides

### Webpack to Vite

```typescript
// Migration checklist and configuration

/*
MIGRATION STEPS:

1. Install Vite and plugins
   pnpm add -D vite @vitejs/plugin-react

2. Create vite.config.ts

3. Update package.json scripts:
   - "dev": "vite"
   - "build": "vite build"
   - "preview": "vite preview"

4. Move index.html to root (not public/)

5. Update index.html:
   - Add <script type="module" src="/src/main.tsx"></script>
   - Remove webpack-specific placeholders

6. Update imports:
   - require() → import
   - require.context() → import.meta.glob()
   - process.env.* → import.meta.env.*

7. Update environment variables:
   - REACT_APP_* → VITE_*

8. Handle CSS modules:
   - *.module.css works the same
   - Global CSS imports work the same

9. Handle assets:
   - import logo from './logo.png' works the same
   - new URL('./asset.png', import.meta.url) for dynamic

10. Remove webpack dependencies
*/

// vite.config.ts for migrated project
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      // Match webpack aliases
      '@': resolve(__dirname, 'src'),
    },
  },
  
  // Handle require.context migration
  // Use import.meta.glob instead
  
  define: {
    // Polyfill process.env for libraries that expect it
    'process.env': {},
  },
});
```

### Create React App to Vite

```bash
# Migration script

#!/bin/bash

# 1. Install dependencies
pnpm add -D vite @vitejs/plugin-react @types/node

# 2. Remove CRA dependencies
pnpm remove react-scripts

# 3. Move index.html
mv public/index.html index.html

# 4. Update index.html
sed -i 's/%PUBLIC_URL%\///g' index.html
echo '<script type="module" src="/src/index.tsx"></script>' >> index.html

# 5. Rename environment variables
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/process.env.REACT_APP_/import.meta.env.VITE_/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/process.env.NODE_ENV/import.meta.env.MODE/g'

# 6. Rename .env variables
for file in .env*; do
  sed -i 's/REACT_APP_/VITE_/g' "$file"
done

# 7. Update package.json scripts
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="tsc && vite build"
npm pkg set scripts.preview="vite preview"
```

---

## Best Practices

### Build System Selection

| Project Type | Recommended | Reason |
|--------------|-------------|--------|
| **New React/Vue** | Vite | Fast dev, good defaults |
| **Large enterprise** | Webpack | Mature, flexible |
| **Library** | Rollup/Vite | Clean output |
| **Performance critical** | esbuild | Fastest builds |
| **Next.js** | Built-in (SWC) | Integrated |

### Performance Tips

| Tip | Impact |
|-----|--------|
| **Use SWC/esbuild** | 10-100x faster transforms |
| **Enable caching** | 50-90% faster rebuilds |
| **Code splitting** | Smaller initial load |
| **Tree shaking** | Remove unused code |
| **Lazy loading** | Load on demand |

### Configuration Guidelines

| Guideline | Description |
|-----------|-------------|
| **Start simple** | Add complexity as needed |
| **Use TypeScript** | Better IDE support |
| **Enable source maps** | Easier debugging |
| **Set targets** | Match browser support |
| **Analyze bundles** | Find optimization opportunities |

---

## Summary

### Quick Reference

```bash
# Vite
pnpm create vite my-app --template react-ts
pnpm dev
pnpm build

# Webpack
npx webpack serve --mode development
npx webpack --mode production

# esbuild
esbuild src/index.ts --bundle --outfile=dist/bundle.js

# SWC
swc src -d dist
```

### Performance Comparison

| Build System | Cold Build | HMR | Bundle Size |
|--------------|------------|-----|-------------|
| **Vite** | ~2s | <50ms | Optimal |
| **Webpack** | ~30s | ~200ms | Configurable |
| **esbuild** | ~0.5s | N/A | Good |
| **SWC** | ~1s | N/A | Good |
