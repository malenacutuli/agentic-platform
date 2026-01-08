# Multi-Language Projects & Monorepo Support

## Overview

This guide covers how to support multi-language (polyglot) projects and monorepo architectures in an agentic platform like SwissBrain. This includes frontend + backend combinations, microservices in different languages, and unified build/deploy pipelines.

---

## Table of Contents

1. [Monorepo Architecture](#1-monorepo-architecture)
2. [Polyglot Project Support](#2-polyglot-project-support)
3. [Workspace Management](#3-workspace-management)
4. [Cross-Language Communication](#4-cross-language-communication)
5. [Unified Build Pipeline](#5-unified-build-pipeline)
6. [Shared Code & Types](#6-shared-code--types)
7. [Development Workflow](#7-development-workflow)
8. [Deployment Strategies](#8-deployment-strategies)

---

## 1. Monorepo Architecture

### 1.1 Monorepo vs Polyrepo Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Monorepo vs Polyrepo Comparison                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MONOREPO                              POLYREPO                             │
│  ┌─────────────────────────┐           ┌─────────────┐ ┌─────────────┐     │
│  │ my-platform/            │           │ frontend/   │ │ backend/    │     │
│  │ ├── apps/               │           │ └── ...     │ │ └── ...     │     │
│  │ │   ├── web/            │           └─────────────┘ └─────────────┘     │
│  │ │   ├── api/            │           ┌─────────────┐ ┌─────────────┐     │
│  │ │   └── mobile/         │           │ mobile/     │ │ shared/     │     │
│  │ ├── packages/           │           │ └── ...     │ │ └── ...     │     │
│  │ │   ├── shared/         │           └─────────────┘ └─────────────┘     │
│  │ │   └── ui/             │                                               │
│  │ └── package.json        │           4 separate repositories             │
│  └─────────────────────────┘                                               │
│                                                                             │
│  ✅ Single source of truth             ✅ Independent deployments          │
│  ✅ Atomic changes across apps         ✅ Clear ownership boundaries        │
│  ✅ Shared code without publishing     ✅ Smaller clone/CI times            │
│  ✅ Unified CI/CD pipeline             ❌ Dependency version drift          │
│  ❌ Larger repository size             ❌ Cross-repo changes are hard       │
│  ❌ Complex tooling required           ❌ Code sharing requires publishing  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Monorepo Tool Comparison

| Tool | Language Support | Performance | Learning Curve | Best For |
|------|-----------------|-------------|----------------|----------|
| **Turborepo** | JS/TS | Excellent | Low | JS/TS monorepos |
| **Nx** | Multi-language | Excellent | Medium | Enterprise, multi-lang |
| **pnpm Workspaces** | JS/TS | Very Good | Low | Simple JS monorepos |
| **Lerna** | JS/TS | Good | Low | Publishing packages |
| **Bazel** | Any | Excellent | High | Large scale, any lang |
| **Rush** | JS/TS | Very Good | Medium | Microsoft ecosystem |

### 1.3 Recommended Monorepo Structure

```typescript
// Monorepo directory structure
interface MonorepoStructure {
  root: {
    'package.json': 'Root package with workspaces config';
    'pnpm-workspace.yaml': 'pnpm workspace definition';
    'turbo.json': 'Turborepo pipeline configuration';
    'nx.json': 'Nx configuration (if using Nx)';
    '.github/': 'CI/CD workflows';
  };
  apps: {
    'web/': 'React/Next.js frontend application';
    'api/': 'Node.js/Express backend API';
    'api-python/': 'Python FastAPI service';
    'api-go/': 'Go microservice';
    'mobile/': 'React Native mobile app';
    'admin/': 'Admin dashboard';
    'docs/': 'Documentation site';
  };
  packages: {
    'shared/': 'Shared utilities and types';
    'ui/': 'Shared UI component library';
    'config/': 'Shared configuration (ESLint, TSConfig)';
    'database/': 'Database schema and migrations';
    'api-client/': 'Generated API client';
  };
  services: {
    'ml-service/': 'Python ML/AI service';
    'worker/': 'Background job processor';
    'gateway/': 'API gateway';
  };
}
```

### 1.4 Root Package.json Configuration

```json
{
  "name": "my-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "db:push": "pnpm --filter @my-platform/database db:push",
    "db:studio": "pnpm --filter @my-platform/database db:studio"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@8.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 1.5 pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'services/*'
  # Exclude certain directories
  - '!**/test/**'
  - '!**/dist/**'
```

### 1.6 Turborepo Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV", "DATABASE_URL"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "test/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    },
    "deploy": {
      "dependsOn": ["build", "test", "lint"],
      "outputs": []
    }
  }
}
```

---

## 2. Polyglot Project Support

### 2.1 Supported Language Combinations

```typescript
// Language support matrix
interface LanguageSupport {
  frontend: {
    'typescript': { frameworks: ['React', 'Next.js', 'Vue', 'Svelte', 'Angular'] };
    'javascript': { frameworks: ['React', 'Vue', 'Vanilla'] };
    'dart': { frameworks: ['Flutter'] };
    'swift': { frameworks: ['SwiftUI'] };
    'kotlin': { frameworks: ['Jetpack Compose'] };
  };
  backend: {
    'typescript': { frameworks: ['Express', 'Fastify', 'NestJS', 'Hono'] };
    'python': { frameworks: ['FastAPI', 'Django', 'Flask'] };
    'go': { frameworks: ['Gin', 'Echo', 'Fiber'] };
    'rust': { frameworks: ['Actix', 'Axum', 'Rocket'] };
    'java': { frameworks: ['Spring Boot', 'Quarkus'] };
    'csharp': { frameworks: ['ASP.NET Core'] };
  };
  database: {
    'sql': ['PostgreSQL', 'MySQL', 'SQLite'];
    'nosql': ['MongoDB', 'Redis', 'DynamoDB'];
    'graph': ['Neo4j', 'ArangoDB'];
    'vector': ['Pinecone', 'Weaviate', 'Qdrant'];
  };
}
```

### 2.2 Polyglot Project Manager

```typescript
// src/services/polyglotManager.ts

interface LanguageRuntime {
  name: string;
  version: string;
  packageManager: string;
  installCommand: string;
  buildCommand: string;
  devCommand: string;
  testCommand: string;
  configFiles: string[];
}

interface PolyglotProject {
  id: string;
  name: string;
  rootPath: string;
  languages: Map<string, LanguageRuntime>;
  apps: PolyglotApp[];
  sharedPackages: SharedPackage[];
}

interface PolyglotApp {
  name: string;
  path: string;
  language: string;
  framework: string;
  port: number;
  dependencies: string[];
}

interface SharedPackage {
  name: string;
  path: string;
  language: string;
  consumers: string[];
}

class PolyglotProjectManager {
  private runtimes: Map<string, LanguageRuntime> = new Map();

  constructor() {
    this.initializeRuntimes();
  }

  private initializeRuntimes(): void {
    // TypeScript/JavaScript
    this.runtimes.set('typescript', {
      name: 'TypeScript',
      version: '5.3.0',
      packageManager: 'pnpm',
      installCommand: 'pnpm install',
      buildCommand: 'pnpm build',
      devCommand: 'pnpm dev',
      testCommand: 'pnpm test',
      configFiles: ['package.json', 'tsconfig.json', 'pnpm-lock.yaml']
    });

    // Python
    this.runtimes.set('python', {
      name: 'Python',
      version: '3.11',
      packageManager: 'poetry',
      installCommand: 'poetry install',
      buildCommand: 'poetry build',
      devCommand: 'poetry run uvicorn main:app --reload',
      testCommand: 'poetry run pytest',
      configFiles: ['pyproject.toml', 'poetry.lock']
    });

    // Go
    this.runtimes.set('go', {
      name: 'Go',
      version: '1.21',
      packageManager: 'go mod',
      installCommand: 'go mod download',
      buildCommand: 'go build -o bin/server ./cmd/server',
      devCommand: 'go run ./cmd/server',
      testCommand: 'go test ./...',
      configFiles: ['go.mod', 'go.sum']
    });

    // Rust
    this.runtimes.set('rust', {
      name: 'Rust',
      version: '1.75',
      packageManager: 'cargo',
      installCommand: 'cargo fetch',
      buildCommand: 'cargo build --release',
      devCommand: 'cargo run',
      testCommand: 'cargo test',
      configFiles: ['Cargo.toml', 'Cargo.lock']
    });

    // Java
    this.runtimes.set('java', {
      name: 'Java',
      version: '21',
      packageManager: 'gradle',
      installCommand: './gradlew dependencies',
      buildCommand: './gradlew build',
      devCommand: './gradlew bootRun',
      testCommand: './gradlew test',
      configFiles: ['build.gradle.kts', 'settings.gradle.kts']
    });
  }

  async createPolyglotProject(config: {
    name: string;
    apps: Array<{
      name: string;
      language: string;
      framework: string;
      type: 'frontend' | 'backend' | 'service';
    }>;
  }): Promise<PolyglotProject> {
    const projectId = this.generateProjectId();
    const rootPath = `/projects/${projectId}`;

    // Create root directory structure
    await this.createRootStructure(rootPath, config.name);

    // Create each app
    const apps: PolyglotApp[] = [];
    let port = 3000;

    for (const appConfig of config.apps) {
      const app = await this.createApp({
        ...appConfig,
        rootPath,
        port: port++
      });
      apps.push(app);
    }

    // Create shared packages
    const sharedPackages = await this.createSharedPackages(rootPath, config.apps);

    // Generate unified configuration
    await this.generateUnifiedConfig(rootPath, apps);

    return {
      id: projectId,
      name: config.name,
      rootPath,
      languages: this.runtimes,
      apps,
      sharedPackages
    };
  }

  private async createRootStructure(rootPath: string, name: string): Promise<void> {
    const structure = `
${rootPath}/
├── apps/
├── packages/
├── services/
├── scripts/
├── .github/
│   └── workflows/
├── docker/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── Makefile
└── README.md
    `;

    // Create directories
    const dirs = [
      'apps',
      'packages',
      'services',
      'scripts',
      '.github/workflows',
      'docker'
    ];

    for (const dir of dirs) {
      await fs.mkdir(`${rootPath}/${dir}`, { recursive: true });
    }

    // Create root package.json
    await this.createRootPackageJson(rootPath, name);
  }

  private async createApp(config: {
    name: string;
    language: string;
    framework: string;
    type: 'frontend' | 'backend' | 'service';
    rootPath: string;
    port: number;
  }): Promise<PolyglotApp> {
    const appPath = `${config.rootPath}/apps/${config.name}`;
    const runtime = this.runtimes.get(config.language);

    if (!runtime) {
      throw new Error(`Unsupported language: ${config.language}`);
    }

    // Create app based on framework
    switch (config.framework.toLowerCase()) {
      case 'react':
      case 'next.js':
        await this.createReactApp(appPath, config);
        break;
      case 'fastapi':
        await this.createFastAPIApp(appPath, config);
        break;
      case 'gin':
        await this.createGinApp(appPath, config);
        break;
      case 'express':
        await this.createExpressApp(appPath, config);
        break;
      default:
        throw new Error(`Unsupported framework: ${config.framework}`);
    }

    return {
      name: config.name,
      path: appPath,
      language: config.language,
      framework: config.framework,
      port: config.port,
      dependencies: []
    };
  }

  private async createFastAPIApp(appPath: string, config: any): Promise<void> {
    // Create directory structure
    await fs.mkdir(`${appPath}/app`, { recursive: true });
    await fs.mkdir(`${appPath}/app/api`, { recursive: true });
    await fs.mkdir(`${appPath}/app/models`, { recursive: true });
    await fs.mkdir(`${appPath}/app/services`, { recursive: true });
    await fs.mkdir(`${appPath}/tests`, { recursive: true });

    // pyproject.toml
    const pyproject = `
[tool.poetry]
name = "${config.name}"
version = "0.1.0"
description = "${config.name} API service"
authors = ["Your Name <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
pydantic = "^2.5.0"
pydantic-settings = "^2.1.0"
sqlalchemy = "^2.0.25"
alembic = "^1.13.0"
asyncpg = "^0.29.0"
httpx = "^0.26.0"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
pytest-asyncio = "^0.23.0"
pytest-cov = "^4.1.0"
black = "^24.1.0"
ruff = "^0.1.0"
mypy = "^1.8.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.black]
line-length = 100
target-version = ['py311']

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
python_version = "3.11"
strict = true
`;

    await fs.writeFile(`${appPath}/pyproject.toml`, pyproject.trim());

    // Main application
    const mainApp = `
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.app_name}...")
    yield
    # Shutdown
    print(f"Shutting down {settings.app_name}...")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "${config.name}"}
`;

    await fs.writeFile(`${appPath}/app/main.py`, mainApp.trim());

    // Config
    const configPy = `
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = "${config.name}"
    version: str = "0.1.0"
    debug: bool = False
    
    # Database
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/db"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]
    
    # JWT
    jwt_secret: str = "your-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_expiration: int = 3600
    
    class Config:
        env_file = ".env"


settings = Settings()
`;

    await fs.writeFile(`${appPath}/app/config.py`, configPy.trim());

    // Dockerfile
    const dockerfile = `
FROM python:3.11-slim

WORKDIR /app

# Install poetry
RUN pip install poetry

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry config virtualenvs.create false \\
    && poetry install --no-interaction --no-ansi --no-root

# Copy application
COPY . .

# Expose port
EXPOSE ${config.port}

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${config.port}"]
`;

    await fs.writeFile(`${appPath}/Dockerfile`, dockerfile.trim());
  }

  private async createGinApp(appPath: string, config: any): Promise<void> {
    // Create directory structure
    await fs.mkdir(`${appPath}/cmd/server`, { recursive: true });
    await fs.mkdir(`${appPath}/internal/api`, { recursive: true });
    await fs.mkdir(`${appPath}/internal/models`, { recursive: true });
    await fs.mkdir(`${appPath}/internal/services`, { recursive: true });
    await fs.mkdir(`${appPath}/pkg`, { recursive: true });

    // go.mod
    const goMod = `
module github.com/myorg/${config.name}

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/gin-contrib/cors v1.5.0
	github.com/joho/godotenv v1.5.1
	github.com/lib/pq v1.10.9
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/google/uuid v1.5.0
	go.uber.org/zap v1.26.0
)
`;

    await fs.writeFile(`${appPath}/go.mod`, goMod.trim());

    // Main server
    const mainGo = `
package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	
	"github.com/myorg/${config.name}/internal/api"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Set Gin mode
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"service": "${config.name}",
		})
	})

	// API routes
	api.RegisterRoutes(r)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "${config.port}"
	}

	log.Printf("Starting server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
`;

    await fs.writeFile(`${appPath}/cmd/server/main.go`, mainGo.trim());

    // API routes
    const apiGo = `
package api

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.GET("/", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "Welcome to ${config.name} API",
			})
		})
		
		// Add more routes here
	}
}
`;

    await fs.writeFile(`${appPath}/internal/api/routes.go`, apiGo.trim());

    // Dockerfile
    const dockerfile = `
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# Run stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /server .

EXPOSE ${config.port}

CMD ["./server"]
`;

    await fs.writeFile(`${appPath}/Dockerfile`, dockerfile.trim());

    // Makefile
    const makefile = `
.PHONY: build run test clean

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

test:
	go test -v ./...

clean:
	rm -rf bin/

docker-build:
	docker build -t ${config.name} .

docker-run:
	docker run -p ${config.port}:${config.port} ${config.name}
`;

    await fs.writeFile(`${appPath}/Makefile`, makefile.trim());
  }

  private async generateUnifiedConfig(rootPath: string, apps: PolyglotApp[]): Promise<void> {
    // Generate docker-compose.yml
    const dockerCompose = this.generateDockerCompose(apps);
    await fs.writeFile(`${rootPath}/docker-compose.yml`, dockerCompose);

    // Generate Makefile
    const makefile = this.generateMakefile(apps);
    await fs.writeFile(`${rootPath}/Makefile`, makefile);

    // Generate GitHub Actions workflow
    const workflow = this.generateGitHubWorkflow(apps);
    await fs.writeFile(`${rootPath}/.github/workflows/ci.yml`, workflow);
  }

  private generateDockerCompose(apps: PolyglotApp[]): string {
    let services = '';

    for (const app of apps) {
      services += `
  ${app.name}:
    build:
      context: ./apps/${app.name}
      dockerfile: Dockerfile
    ports:
      - "${app.port}:${app.port}"
    environment:
      - NODE_ENV=development
      - PORT=${app.port}
    volumes:
      - ./apps/${app.name}:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis
`;
    }

    return `
version: '3.8'

services:
${services}
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myplatform
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`.trim();
  }

  private generateMakefile(apps: PolyglotApp[]): string {
    let targets = '';

    for (const app of apps) {
      targets += `
# ${app.name} (${app.language}/${app.framework})
${app.name}-install:
	cd apps/${app.name} && ${this.getInstallCommand(app.language)}

${app.name}-dev:
	cd apps/${app.name} && ${this.getDevCommand(app.language)}

${app.name}-build:
	cd apps/${app.name} && ${this.getBuildCommand(app.language)}

${app.name}-test:
	cd apps/${app.name} && ${this.getTestCommand(app.language)}
`;
    }

    return `
.PHONY: install dev build test clean docker-up docker-down

# All apps
install:
	pnpm install
${apps.map(a => `\tmake ${a.name}-install`).join('\n')}

dev:
	docker-compose up -d postgres redis
	pnpm dev

build:
	pnpm build

test:
	pnpm test

clean:
	pnpm clean
	rm -rf node_modules

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker-compose build

# Individual apps
${targets}
`.trim();
  }

  private getInstallCommand(language: string): string {
    const commands: Record<string, string> = {
      typescript: 'pnpm install',
      python: 'poetry install',
      go: 'go mod download',
      rust: 'cargo fetch',
      java: './gradlew dependencies'
    };
    return commands[language] || 'echo "Unknown language"';
  }

  private getDevCommand(language: string): string {
    const commands: Record<string, string> = {
      typescript: 'pnpm dev',
      python: 'poetry run uvicorn app.main:app --reload',
      go: 'go run ./cmd/server',
      rust: 'cargo run',
      java: './gradlew bootRun'
    };
    return commands[language] || 'echo "Unknown language"';
  }

  private getBuildCommand(language: string): string {
    const commands: Record<string, string> = {
      typescript: 'pnpm build',
      python: 'poetry build',
      go: 'go build -o bin/server ./cmd/server',
      rust: 'cargo build --release',
      java: './gradlew build'
    };
    return commands[language] || 'echo "Unknown language"';
  }

  private getTestCommand(language: string): string {
    const commands: Record<string, string> = {
      typescript: 'pnpm test',
      python: 'poetry run pytest',
      go: 'go test ./...',
      rust: 'cargo test',
      java: './gradlew test'
    };
    return commands[language] || 'echo "Unknown language"';
  }

  private generateGitHubWorkflow(apps: PolyglotApp[]): string {
    const jobs: string[] = [];

    // Group apps by language
    const appsByLanguage = new Map<string, PolyglotApp[]>();
    for (const app of apps) {
      const existing = appsByLanguage.get(app.language) || [];
      existing.push(app);
      appsByLanguage.set(app.language, existing);
    }

    // TypeScript/JavaScript apps
    if (appsByLanguage.has('typescript')) {
      jobs.push(`
  typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Type check
        run: pnpm type-check
        
      - name: Lint
        run: pnpm lint
        
      - name: Test
        run: pnpm test
        
      - name: Build
        run: pnpm build`);
    }

    // Python apps
    if (appsByLanguage.has('python')) {
      const pythonApps = appsByLanguage.get('python')!;
      jobs.push(`
  python:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [${pythonApps.map(a => `'${a.name}'`).join(', ')}]
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          
      - name: Install Poetry
        run: pip install poetry
        
      - name: Install dependencies
        run: |
          cd apps/\${{ matrix.app }}
          poetry install
          
      - name: Lint
        run: |
          cd apps/\${{ matrix.app }}
          poetry run ruff check .
          poetry run black --check .
          
      - name: Type check
        run: |
          cd apps/\${{ matrix.app }}
          poetry run mypy .
          
      - name: Test
        run: |
          cd apps/\${{ matrix.app }}
          poetry run pytest --cov`);
    }

    // Go apps
    if (appsByLanguage.has('go')) {
      const goApps = appsByLanguage.get('go')!;
      jobs.push(`
  go:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [${goApps.map(a => `'${a.name}'`).join(', ')}]
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          
      - name: Download dependencies
        run: |
          cd apps/\${{ matrix.app }}
          go mod download
          
      - name: Lint
        uses: golangci/golangci-lint-action@v3
        with:
          working-directory: apps/\${{ matrix.app }}
          
      - name: Test
        run: |
          cd apps/\${{ matrix.app }}
          go test -v -race -coverprofile=coverage.out ./...
          
      - name: Build
        run: |
          cd apps/\${{ matrix.app }}
          go build -o bin/server ./cmd/server`);
    }

    return `
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
${jobs.join('\n')}
`.trim();
  }

  private generateProjectId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const polyglotManager = new PolyglotProjectManager();
```

---

## 3. Workspace Management

### 3.1 Workspace Configuration

```typescript
// src/services/workspaceManager.ts

interface Workspace {
  name: string;
  path: string;
  type: 'app' | 'package' | 'service';
  language: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
}

interface WorkspaceGraph {
  nodes: Map<string, Workspace>;
  edges: Map<string, Set<string>>; // dependency graph
}

class WorkspaceManager {
  private graph: WorkspaceGraph = {
    nodes: new Map(),
    edges: new Map()
  };

  async discoverWorkspaces(rootPath: string): Promise<Workspace[]> {
    const workspaces: Workspace[] = [];

    // Scan apps directory
    const appsDir = `${rootPath}/apps`;
    const apps = await fs.readdir(appsDir);
    
    for (const app of apps) {
      const workspace = await this.parseWorkspace(`${appsDir}/${app}`, 'app');
      if (workspace) {
        workspaces.push(workspace);
        this.graph.nodes.set(workspace.name, workspace);
      }
    }

    // Scan packages directory
    const packagesDir = `${rootPath}/packages`;
    const packages = await fs.readdir(packagesDir);
    
    for (const pkg of packages) {
      const workspace = await this.parseWorkspace(`${packagesDir}/${pkg}`, 'package');
      if (workspace) {
        workspaces.push(workspace);
        this.graph.nodes.set(workspace.name, workspace);
      }
    }

    // Build dependency graph
    this.buildDependencyGraph();

    return workspaces;
  }

  private async parseWorkspace(path: string, type: 'app' | 'package' | 'service'): Promise<Workspace | null> {
    // Try to detect language and parse config
    
    // Check for package.json (Node.js)
    if (await this.fileExists(`${path}/package.json`)) {
      const pkg = JSON.parse(await fs.readFile(`${path}/package.json`, 'utf-8'));
      return {
        name: pkg.name,
        path,
        type,
        language: 'typescript',
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scripts: pkg.scripts || {}
      };
    }

    // Check for pyproject.toml (Python)
    if (await this.fileExists(`${path}/pyproject.toml`)) {
      // Parse TOML (simplified)
      return {
        name: path.split('/').pop()!,
        path,
        type,
        language: 'python',
        dependencies: [],
        devDependencies: [],
        scripts: {
          dev: 'poetry run uvicorn app.main:app --reload',
          test: 'poetry run pytest',
          build: 'poetry build'
        }
      };
    }

    // Check for go.mod (Go)
    if (await this.fileExists(`${path}/go.mod`)) {
      return {
        name: path.split('/').pop()!,
        path,
        type,
        language: 'go',
        dependencies: [],
        devDependencies: [],
        scripts: {
          dev: 'go run ./cmd/server',
          test: 'go test ./...',
          build: 'go build -o bin/server ./cmd/server'
        }
      };
    }

    // Check for Cargo.toml (Rust)
    if (await this.fileExists(`${path}/Cargo.toml`)) {
      return {
        name: path.split('/').pop()!,
        path,
        type,
        language: 'rust',
        dependencies: [],
        devDependencies: [],
        scripts: {
          dev: 'cargo run',
          test: 'cargo test',
          build: 'cargo build --release'
        }
      };
    }

    return null;
  }

  private buildDependencyGraph(): void {
    for (const [name, workspace] of this.graph.nodes) {
      const deps = new Set<string>();
      
      for (const dep of workspace.dependencies) {
        // Check if dependency is an internal workspace
        if (this.graph.nodes.has(dep)) {
          deps.add(dep);
        }
      }
      
      this.graph.edges.set(name, deps);
    }
  }

  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const deps = this.graph.edges.get(name) || new Set();
      for (const dep of deps) {
        visit(dep);
      }

      result.push(name);
    };

    for (const name of this.graph.nodes.keys()) {
      visit(name);
    }

    return result;
  }

  getAffectedWorkspaces(changedFiles: string[]): string[] {
    const affected = new Set<string>();

    // Find directly affected workspaces
    for (const file of changedFiles) {
      for (const [name, workspace] of this.graph.nodes) {
        if (file.startsWith(workspace.path)) {
          affected.add(name);
        }
      }
    }

    // Find transitively affected workspaces
    const addDependents = (name: string) => {
      for (const [wsName, deps] of this.graph.edges) {
        if (deps.has(name) && !affected.has(wsName)) {
          affected.add(wsName);
          addDependents(wsName);
        }
      }
    };

    for (const name of [...affected]) {
      addDependents(name);
    }

    return [...affected];
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

export const workspaceManager = new WorkspaceManager();
```

---

## 4. Cross-Language Communication

### 4.1 Communication Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Cross-Language Communication Patterns                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REST API (HTTP)                                                         │
│     ┌─────────┐    HTTP/JSON    ┌─────────┐                                │
│     │ React   │ ───────────────► │ FastAPI │                                │
│     │ (TS)    │ ◄─────────────── │ (Python)│                                │
│     └─────────┘                  └─────────┘                                │
│     ✅ Simple, universal                                                    │
│     ❌ Higher latency, no streaming                                         │
│                                                                             │
│  2. gRPC (Protocol Buffers)                                                 │
│     ┌─────────┐    gRPC/Proto   ┌─────────┐                                │
│     │ Node.js │ ───────────────► │ Go      │                                │
│     │ (TS)    │ ◄─────────────── │ (Gin)   │                                │
│     └─────────┘                  └─────────┘                                │
│     ✅ Fast, type-safe, streaming                                           │
│     ❌ More complex setup                                                   │
│                                                                             │
│  3. Message Queue (Redis/RabbitMQ)                                          │
│     ┌─────────┐                  ┌─────────┐                                │
│     │ Node.js │ ──► [Queue] ──► │ Python  │                                │
│     │ (TS)    │                  │ Worker  │                                │
│     └─────────┘                  └─────────┘                                │
│     ✅ Async, decoupled, reliable                                           │
│     ❌ Eventually consistent                                                │
│                                                                             │
│  4. WebSocket (Real-time)                                                   │
│     ┌─────────┐    WebSocket    ┌─────────┐                                │
│     │ React   │ ◄──────────────► │ Node.js │                                │
│     │ (TS)    │                  │ (TS)    │                                │
│     └─────────┘                  └─────────┘                                │
│     ✅ Real-time, bidirectional                                             │
│     ❌ Connection management                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 API Client Generation

```typescript
// src/services/apiClientGenerator.ts

interface APISchema {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, any>;
  components: { schemas: Record<string, any> };
}

class APIClientGenerator {
  async generateClients(schema: APISchema, outputDir: string): Promise<void> {
    // Generate TypeScript client
    await this.generateTypeScriptClient(schema, `${outputDir}/typescript`);
    
    // Generate Python client
    await this.generatePythonClient(schema, `${outputDir}/python`);
    
    // Generate Go client
    await this.generateGoClient(schema, `${outputDir}/go`);
  }

  private async generateTypeScriptClient(schema: APISchema, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate types
    let types = '// Auto-generated types\n\n';
    
    for (const [name, schemaObj] of Object.entries(schema.components.schemas)) {
      types += this.schemaToTypeScript(name, schemaObj);
    }

    await fs.writeFile(`${outputDir}/types.ts`, types);

    // Generate client
    let client = `
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface APIClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class APIClient {
  private client: AxiosInstance;

  constructor(config: APIClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: config.headers,
      timeout: config.timeout || 30000,
    });
  }
`;

    // Generate methods for each endpoint
    for (const [path, methods] of Object.entries(schema.paths)) {
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        client += this.generateTypeScriptMethod(path, method, operation);
      }
    }

    client += '\n}\n';

    await fs.writeFile(`${outputDir}/client.ts`, client);
  }

  private schemaToTypeScript(name: string, schema: any): string {
    if (schema.type === 'object') {
      let props = '';
      for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
        const required = schema.required?.includes(propName);
        const type = this.getTypeScriptType(propSchema as any);
        props += `  ${propName}${required ? '' : '?'}: ${type};\n`;
      }
      return `export interface ${name} {\n${props}}\n\n`;
    }
    return '';
  }

  private getTypeScriptType(schema: any): string {
    switch (schema.type) {
      case 'string': return 'string';
      case 'number':
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return `${this.getTypeScriptType(schema.items)}[]`;
      case 'object': return 'Record<string, any>';
      default:
        if (schema.$ref) {
          return schema.$ref.split('/').pop();
        }
        return 'any';
    }
  }

  private generateTypeScriptMethod(path: string, method: string, operation: any): string {
    const operationId = operation.operationId || `${method}${path.replace(/\//g, '_')}`;
    const params = this.extractParams(operation);
    
    return `
  async ${operationId}(${params.signature}): Promise<${params.returnType}> {
    const response = await this.client.${method}(\`${path.replace(/{/g, '${')}\`${params.body ? ', data' : ''});
    return response.data;
  }
`;
  }

  private extractParams(operation: any): { signature: string; returnType: string; body: boolean } {
    const params: string[] = [];
    let hasBody = false;

    // Path parameters
    for (const param of operation.parameters || []) {
      if (param.in === 'path') {
        params.push(`${param.name}: ${this.getTypeScriptType(param.schema)}`);
      }
    }

    // Request body
    if (operation.requestBody) {
      hasBody = true;
      const schema = operation.requestBody.content?.['application/json']?.schema;
      const type = schema?.$ref ? schema.$ref.split('/').pop() : 'any';
      params.push(`data: ${type}`);
    }

    // Return type
    const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
    const returnType = responseSchema?.$ref ? responseSchema.$ref.split('/').pop() : 'any';

    return {
      signature: params.join(', '),
      returnType,
      body: hasBody
    };
  }

  private async generatePythonClient(schema: APISchema, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate models
    let models = `
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

`;

    for (const [name, schemaObj] of Object.entries(schema.components.schemas)) {
      models += this.schemaToPython(name, schemaObj);
    }

    await fs.writeFile(`${outputDir}/models.py`, models);

    // Generate client
    let client = `
import httpx
from typing import Optional, Dict, Any
from .models import *


class APIClient:
    def __init__(self, base_url: str, headers: Optional[Dict[str, str]] = None):
        self.base_url = base_url
        self.headers = headers or {}
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers=self.headers,
            timeout=30.0
        )

    async def close(self):
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()
`;

    // Generate methods
    for (const [path, methods] of Object.entries(schema.paths)) {
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        client += this.generatePythonMethod(path, method, operation);
      }
    }

    await fs.writeFile(`${outputDir}/client.py`, client);
  }

  private schemaToPython(name: string, schema: any): string {
    if (schema.type === 'object') {
      let props = '';
      for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
        const required = schema.required?.includes(propName);
        const type = this.getPythonType(propSchema as any);
        props += `    ${propName}: ${required ? type : `Optional[${type}]`} = None\n`;
      }
      return `class ${name}(BaseModel):\n${props}\n\n`;
    }
    return '';
  }

  private getPythonType(schema: any): string {
    switch (schema.type) {
      case 'string': return 'str';
      case 'number': return 'float';
      case 'integer': return 'int';
      case 'boolean': return 'bool';
      case 'array': return `List[${this.getPythonType(schema.items)}]`;
      case 'object': return 'Dict[str, Any]';
      default:
        if (schema.$ref) {
          return schema.$ref.split('/').pop();
        }
        return 'Any';
    }
  }

  private generatePythonMethod(path: string, method: string, operation: any): string {
    const operationId = operation.operationId || `${method}_${path.replace(/\//g, '_')}`;
    const params = this.extractPythonParams(operation);
    
    return `
    async def ${operationId}(self${params.signature ? ', ' + params.signature : ''}) -> ${params.returnType}:
        response = await self.client.${method}(
            f"${path.replace(/{/g, '{')}"${params.body ? ', json=data.dict()' : ''}
        )
        response.raise_for_status()
        return ${params.returnType}(**response.json())
`;
  }

  private extractPythonParams(operation: any): { signature: string; returnType: string; body: boolean } {
    const params: string[] = [];
    let hasBody = false;

    // Path parameters
    for (const param of operation.parameters || []) {
      if (param.in === 'path') {
        params.push(`${param.name}: ${this.getPythonType(param.schema)}`);
      }
    }

    // Request body
    if (operation.requestBody) {
      hasBody = true;
      const schema = operation.requestBody.content?.['application/json']?.schema;
      const type = schema?.$ref ? schema.$ref.split('/').pop() : 'Any';
      params.push(`data: ${type}`);
    }

    // Return type
    const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
    const returnType = responseSchema?.$ref ? responseSchema.$ref.split('/').pop() : 'Any';

    return {
      signature: params.join(', '),
      returnType,
      body: hasBody
    };
  }

  private async generateGoClient(schema: APISchema, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate types
    let types = `package client

import "time"

`;

    for (const [name, schemaObj] of Object.entries(schema.components.schemas)) {
      types += this.schemaToGo(name, schemaObj);
    }

    await fs.writeFile(`${outputDir}/types.go`, types);

    // Generate client
    let client = `package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
	headers    map[string]string
}

func NewClient(baseURL string, headers map[string]string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		headers: headers,
	}
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("API error: %d", resp.StatusCode)
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}
`;

    // Generate methods
    for (const [path, methods] of Object.entries(schema.paths)) {
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        client += this.generateGoMethod(path, method, operation);
      }
    }

    await fs.writeFile(`${outputDir}/client.go`, client);
  }

  private schemaToGo(name: string, schema: any): string {
    if (schema.type === 'object') {
      let fields = '';
      for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
        const goName = this.toPascalCase(propName);
        const type = this.getGoType(propSchema as any);
        fields += `\t${goName} ${type} \`json:"${propName}"\`\n`;
      }
      return `type ${name} struct {\n${fields}}\n\n`;
    }
    return '';
  }

  private getGoType(schema: any): string {
    switch (schema.type) {
      case 'string': return 'string';
      case 'number': return 'float64';
      case 'integer': return 'int64';
      case 'boolean': return 'bool';
      case 'array': return `[]${this.getGoType(schema.items)}`;
      case 'object': return 'map[string]interface{}';
      default:
        if (schema.$ref) {
          return '*' + schema.$ref.split('/').pop();
        }
        return 'interface{}';
    }
  }

  private generateGoMethod(path: string, method: string, operation: any): string {
    const operationId = operation.operationId || `${method}${path.replace(/\//g, '')}`;
    const goMethod = this.toPascalCase(operationId);
    const params = this.extractGoParams(operation);
    
    return `
func (c *Client) ${goMethod}(ctx context.Context${params.signature ? ', ' + params.signature : ''}) (*${params.returnType}, error) {
	var result ${params.returnType}
	err := c.doRequest(ctx, "${method.toUpperCase()}", fmt.Sprintf("${path.replace(/{(\w+)}/g, '%v')}"${params.pathParams}), ${params.body ? 'body' : 'nil'}, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}
`;
  }

  private extractGoParams(operation: any): { signature: string; returnType: string; body: boolean; pathParams: string } {
    const params: string[] = [];
    const pathParams: string[] = [];
    let hasBody = false;

    // Path parameters
    for (const param of operation.parameters || []) {
      if (param.in === 'path') {
        params.push(`${param.name} ${this.getGoType(param.schema)}`);
        pathParams.push(param.name);
      }
    }

    // Request body
    if (operation.requestBody) {
      hasBody = true;
      const schema = operation.requestBody.content?.['application/json']?.schema;
      const type = schema?.$ref ? '*' + schema.$ref.split('/').pop() : 'interface{}';
      params.push(`body ${type}`);
    }

    // Return type
    const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
    const returnType = responseSchema?.$ref ? responseSchema.$ref.split('/').pop() : 'map[string]interface{}';

    return {
      signature: params.join(', '),
      returnType,
      body: hasBody,
      pathParams: pathParams.length > 0 ? ', ' + pathParams.join(', ') : ''
    };
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

export const apiClientGenerator = new APIClientGenerator();
```

---

## 5. Unified Build Pipeline

### 5.1 Build Orchestration

```typescript
// src/services/buildOrchestrator.ts

interface BuildConfig {
  workspace: string;
  language: string;
  buildCommand: string;
  outputDir: string;
  env: Record<string, string>;
}

interface BuildResult {
  workspace: string;
  success: boolean;
  duration: number;
  outputSize: number;
  logs: string[];
  errors: string[];
}

class BuildOrchestrator {
  async buildAll(rootPath: string, parallel: boolean = true): Promise<BuildResult[]> {
    const workspaces = await workspaceManager.discoverWorkspaces(rootPath);
    const buildOrder = workspaceManager.getTopologicalOrder();

    if (parallel) {
      return this.buildParallel(workspaces, buildOrder);
    } else {
      return this.buildSequential(workspaces, buildOrder);
    }
  }

  private async buildParallel(workspaces: Workspace[], buildOrder: string[]): Promise<BuildResult[]> {
    // Group workspaces by dependency level
    const levels = this.groupByDependencyLevel(workspaces, buildOrder);
    const results: BuildResult[] = [];

    for (const level of levels) {
      // Build all workspaces in this level in parallel
      const levelResults = await Promise.all(
        level.map(ws => this.buildWorkspace(ws))
      );
      results.push(...levelResults);

      // Check for failures
      const failures = levelResults.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`Build failed for: ${failures.map(f => f.workspace).join(', ')}`);
        // Continue or abort based on configuration
      }
    }

    return results;
  }

  private async buildSequential(workspaces: Workspace[], buildOrder: string[]): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    for (const name of buildOrder) {
      const workspace = workspaces.find(w => w.name === name);
      if (workspace) {
        const result = await this.buildWorkspace(workspace);
        results.push(result);

        if (!result.success) {
          console.error(`Build failed for ${name}, aborting`);
          break;
        }
      }
    }

    return results;
  }

  private async buildWorkspace(workspace: Workspace): Promise<BuildResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    try {
      logs.push(`Building ${workspace.name} (${workspace.language})`);

      // Get build command based on language
      const buildCommand = this.getBuildCommand(workspace);
      
      // Execute build
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: workspace.path,
        env: { ...process.env, NODE_ENV: 'production' }
      });

      if (stdout) logs.push(stdout);
      if (stderr) errors.push(stderr);

      // Calculate output size
      const outputDir = this.getOutputDir(workspace);
      const outputSize = await this.calculateDirSize(`${workspace.path}/${outputDir}`);

      return {
        workspace: workspace.name,
        success: true,
        duration: Date.now() - startTime,
        outputSize,
        logs,
        errors
      };
    } catch (error: any) {
      errors.push(error.message);
      return {
        workspace: workspace.name,
        success: false,
        duration: Date.now() - startTime,
        outputSize: 0,
        logs,
        errors
      };
    }
  }

  private getBuildCommand(workspace: Workspace): string {
    const commands: Record<string, string> = {
      typescript: 'pnpm build',
      python: 'poetry build',
      go: 'go build -o bin/server ./cmd/server',
      rust: 'cargo build --release',
      java: './gradlew build'
    };
    return commands[workspace.language] || 'echo "No build command"';
  }

  private getOutputDir(workspace: Workspace): string {
    const dirs: Record<string, string> = {
      typescript: 'dist',
      python: 'dist',
      go: 'bin',
      rust: 'target/release',
      java: 'build/libs'
    };
    return dirs[workspace.language] || 'dist';
  }

  private groupByDependencyLevel(workspaces: Workspace[], buildOrder: string[]): Workspace[][] {
    // Simple implementation: group by dependency depth
    const levels: Workspace[][] = [];
    const processed = new Set<string>();

    while (processed.size < workspaces.length) {
      const level: Workspace[] = [];

      for (const ws of workspaces) {
        if (processed.has(ws.name)) continue;

        // Check if all dependencies are processed
        const allDepsProcessed = ws.dependencies.every(dep => 
          processed.has(dep) || !workspaces.find(w => w.name === dep)
        );

        if (allDepsProcessed) {
          level.push(ws);
        }
      }

      if (level.length === 0) {
        // Circular dependency or error
        break;
      }

      for (const ws of level) {
        processed.add(ws.name);
      }

      levels.push(level);
    }

    return levels;
  }

  private async calculateDirSize(dirPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`du -sb ${dirPath} | cut -f1`);
      return parseInt(stdout.trim(), 10);
    } catch {
      return 0;
    }
  }
}

export const buildOrchestrator = new BuildOrchestrator();
```

---

## 6. Shared Code & Types

### 6.1 Cross-Language Type Sharing

```typescript
// packages/shared/src/types.ts

// Define shared types in TypeScript
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### 6.2 Type Generation for Other Languages

```typescript
// scripts/generate-types.ts

import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph';

class TypeGenerator {
  private project: Project;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: './tsconfig.json'
    });
  }

  async generateAll(inputFile: string, outputDir: string): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(inputFile);

    // Generate Python types
    await this.generatePython(sourceFile, `${outputDir}/python/types.py`);

    // Generate Go types
    await this.generateGo(sourceFile, `${outputDir}/go/types.go`);

    // Generate Rust types
    await this.generateRust(sourceFile, `${outputDir}/rust/types.rs`);

    // Generate JSON Schema
    await this.generateJsonSchema(sourceFile, `${outputDir}/schema.json`);
  }

  private async generatePython(sourceFile: SourceFile, outputPath: string): Promise<void> {
    let output = `
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

`;

    for (const iface of sourceFile.getInterfaces()) {
      output += `class ${iface.getName()}(BaseModel):\n`;
      
      for (const prop of iface.getProperties()) {
        const name = prop.getName();
        const type = this.tsPythonType(prop.getType().getText());
        const optional = prop.hasQuestionToken();
        
        output += `    ${name}: ${optional ? f'Optional[${type}]' : type}\n`;
      }
      output += '\n';
    }

    await fs.writeFile(outputPath, output);
  }

  private async generateGo(sourceFile: SourceFile, outputPath: string): Promise<void> {
    let output = `package types

import "time"

`;

    for (const iface of sourceFile.getInterfaces()) {
      output += `type ${iface.getName()} struct {\n`;
      
      for (const prop of iface.getProperties()) {
        const name = this.toPascalCase(prop.getName());
        const jsonName = prop.getName();
        const type = this.tsToGoType(prop.getType().getText());
        
        output += `\t${name} ${type} \`json:"${jsonName}"\`\n`;
      }
      output += '}\n\n';
    }

    await fs.writeFile(outputPath, output);
  }

  private async generateRust(sourceFile: SourceFile, outputPath: string): Promise<void> {
    let output = `use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

`;

    for (const iface of sourceFile.getInterfaces()) {
      output += `#[derive(Debug, Clone, Serialize, Deserialize)]\n`;
      output += `pub struct ${iface.getName()} {\n`;
      
      for (const prop of iface.getProperties()) {
        const name = this.toSnakeCase(prop.getName());
        const type = this.tsToRustType(prop.getType().getText());
        const optional = prop.hasQuestionToken();
        
        output += `    #[serde(rename = "${prop.getName()}")]\n`;
        output += `    pub ${name}: ${optional ? `Option<${type}>` : type},\n`;
      }
      output += '}\n\n';
    }

    await fs.writeFile(outputPath, output);
  }

  private async generateJsonSchema(sourceFile: SourceFile, outputPath: string): Promise<void> {
    const schemas: Record<string, any> = {};

    for (const iface of sourceFile.getInterfaces()) {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const prop of iface.getProperties()) {
        const name = prop.getName();
        properties[name] = this.tsToJsonSchema(prop.getType().getText());
        
        if (!prop.hasQuestionToken()) {
          required.push(name);
        }
      }

      schemas[iface.getName()] = {
        type: 'object',
        properties,
        required
      };
    }

    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      definitions: schemas
    };

    await fs.writeFile(outputPath, JSON.stringify(schema, null, 2));
  }

  private tsPythonType(tsType: string): string {
    const mapping: Record<string, string> = {
      'string': 'str',
      'number': 'float',
      'boolean': 'bool',
      'Date': 'datetime',
      'any': 'Any'
    };
    return mapping[tsType] || tsType;
  }

  private tsToGoType(tsType: string): string {
    const mapping: Record<string, string> = {
      'string': 'string',
      'number': 'float64',
      'boolean': 'bool',
      'Date': 'time.Time',
      'any': 'interface{}'
    };
    return mapping[tsType] || tsType;
  }

  private tsToRustType(tsType: string): string {
    const mapping: Record<string, string> = {
      'string': 'String',
      'number': 'f64',
      'boolean': 'bool',
      'Date': 'DateTime<Utc>',
      'any': 'serde_json::Value'
    };
    return mapping[tsType] || tsType;
  }

  private tsToJsonSchema(tsType: string): any {
    const mapping: Record<string, any> = {
      'string': { type: 'string' },
      'number': { type: 'number' },
      'boolean': { type: 'boolean' },
      'Date': { type: 'string', format: 'date-time' },
      'any': {}
    };
    return mapping[tsType] || { type: 'string' };
  }

  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export const typeGenerator = new TypeGenerator();
```

---

## 7. Development Workflow

### 7.1 Unified Dev Server

```typescript
// src/services/devServer.ts

interface DevServerConfig {
  rootPath: string;
  apps: Array<{
    name: string;
    port: number;
    language: string;
  }>;
}

class UnifiedDevServer {
  private processes: Map<string, ChildProcess> = new Map();
  private proxy: HttpProxy;

  async start(config: DevServerConfig): Promise<void> {
    // Start all app dev servers
    for (const app of config.apps) {
      await this.startAppServer(app, config.rootPath);
    }

    // Start unified proxy
    await this.startProxy(config.apps);

    console.log('All dev servers started');
    console.log('Unified proxy available at http://localhost:8000');
  }

  private async startAppServer(app: { name: string; port: number; language: string }, rootPath: string): Promise<void> {
    const appPath = `${rootPath}/apps/${app.name}`;
    const command = this.getDevCommand(app.language);

    const proc = spawn(command, [], {
      cwd: appPath,
      shell: true,
      env: {
        ...process.env,
        PORT: app.port.toString()
      }
    });

    proc.stdout?.on('data', (data) => {
      console.log(`[${app.name}] ${data}`);
    });

    proc.stderr?.on('data', (data) => {
      console.error(`[${app.name}] ${data}`);
    });

    this.processes.set(app.name, proc);
  }

  private async startProxy(apps: Array<{ name: string; port: number }>): Promise<void> {
    const express = require('express');
    const { createProxyMiddleware } = require('http-proxy-middleware');

    const proxyApp = express();

    // Route based on path prefix
    for (const app of apps) {
      proxyApp.use(`/${app.name}`, createProxyMiddleware({
        target: `http://localhost:${app.port}`,
        changeOrigin: true,
        pathRewrite: {
          [`^/${app.name}`]: ''
        }
      }));
    }

    // Default to first app (usually frontend)
    if (apps.length > 0) {
      proxyApp.use('/', createProxyMiddleware({
        target: `http://localhost:${apps[0].port}`,
        changeOrigin: true
      }));
    }

    proxyApp.listen(8000, () => {
      console.log('Unified proxy listening on port 8000');
    });
  }

  private getDevCommand(language: string): string {
    const commands: Record<string, string> = {
      typescript: 'pnpm dev',
      python: 'poetry run uvicorn app.main:app --reload',
      go: 'go run ./cmd/server',
      rust: 'cargo watch -x run',
      java: './gradlew bootRun'
    };
    return commands[language] || 'echo "Unknown language"';
  }

  async stop(): Promise<void> {
    for (const [name, proc] of this.processes) {
      console.log(`Stopping ${name}...`);
      proc.kill();
    }
    this.processes.clear();
  }
}

export const unifiedDevServer = new UnifiedDevServer();
```

---

## 8. Deployment Strategies

### 8.1 Multi-Service Deployment

```yaml
# k8s/deployment.yaml

apiVersion: v1
kind: Namespace
metadata:
  name: my-platform

---
# Frontend deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: my-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: my-platform/web:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"

---
# Node.js API deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: my-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: my-platform/api:latest
          ports:
            - containerPort: 4000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"

---
# Python ML service deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-service
  namespace: my-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ml-service
  template:
    metadata:
      labels:
        app: ml-service
    spec:
      containers:
        - name: ml-service
          image: my-platform/ml-service:latest
          ports:
            - containerPort: 5000
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "4Gi"
              cpu: "2000m"

---
# Go microservice deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  namespace: my-platform
spec:
  replicas: 5
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
        - name: worker
          image: my-platform/worker:latest
          ports:
            - containerPort: 6000
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-platform-ingress
  namespace: my-platform
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - my-platform.com
        - api.my-platform.com
      secretName: my-platform-tls
  rules:
    - host: my-platform.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 3000
    - host: api.my-platform.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 4000
          - path: /ml
            pathType: Prefix
            backend:
              service:
                name: ml-service
                port:
                  number: 5000
```

---

## Summary

### Key Takeaways

| Feature | Implementation |
|---------|---------------|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Multi-language** | TypeScript, Python, Go, Rust, Java |
| **Workspace discovery** | Auto-detect by config files |
| **Dependency graph** | Topological sorting |
| **Cross-language comm** | REST, gRPC, Message Queue |
| **Type sharing** | Generate from TypeScript |
| **Unified build** | Parallel by dependency level |
| **Dev server** | Unified proxy + per-app servers |
| **Deployment** | Kubernetes multi-service |

### Recommended Stack for Manus-like Platform

| Component | Technology |
|-----------|------------|
| **Monorepo tool** | Turborepo |
| **Package manager** | pnpm |
| **Frontend** | React + TypeScript |
| **Backend API** | Node.js + Express/Fastify |
| **ML Services** | Python + FastAPI |
| **High-perf services** | Go + Gin |
| **Message queue** | Redis/BullMQ |
| **Database** | PostgreSQL |
| **Deployment** | Kubernetes |

This comprehensive multi-language and monorepo support enables building complex, polyglot applications with unified tooling and deployment!
