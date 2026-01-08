# Project Structure

Complete guide to the Agentic Platform repository structure.

## Directory Layout

```
agentic-platform/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI/CD pipeline
├── docs/
│   ├── DEPLOYMENT.md                 # Deployment guide
│   └── PROJECT_STRUCTURE.md          # This file
├── examples/
│   └── client.ts                     # Example client code
├── k8s/
│   └── deployment.yaml               # Kubernetes manifests
├── src/
│   ├── server/
│   │   ├── index.ts                  # Main server entry point
│   │   └── routes/
│   │       ├── health.ts             # Health check endpoints
│   │       ├── projects.ts           # Project management routes
│   │       ├── sandboxes.ts          # Sandbox management routes
│   │       └── llm.ts                # LLM completion routes
│   ├── services/
│   │   ├── llm/
│   │   │   ├── providers.ts          # LLM provider implementations
│   │   │   └── router.ts             # Intelligent LLM routing
│   │   ├── hmrServer.ts              # Hot module reloading
│   │   ├── sandboxManager.ts         # Container/sandbox management
│   │   └── templateGenerator.ts      # Project scaffolding
│   └── utils/
│       └── logger.ts                 # Logging utility
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── Dockerfile                        # Docker image definition
├── docker-compose.yml                # Docker Compose configuration
├── package.json                      # Node.js dependencies
├── README.md                         # Main documentation
└── tsconfig.json                     # TypeScript configuration
```

## Core Components

### Server (`src/server/`)

The Express.js server that handles all API requests.

**Main Entry Point**: `index.ts`
- Initializes Express app
- Sets up middleware (CORS, JSON parsing, logging)
- Initializes all services (LLM Router, Sandbox Manager, Template Generator)
- Mounts API routes
- Sets up WebSocket connections for HMR
- Error handling and graceful shutdown

**Routes**:
- `health.ts` - Health check endpoints
- `projects.ts` - Project generation and management
- `sandboxes.ts` - Sandbox creation and management
- `llm.ts` - LLM completion endpoints

### Services (`src/services/`)

Business logic and core functionality.

#### LLM Services (`src/services/llm/`)

**providers.ts**
- Abstract `LLMProvider` base class
- `OpenAIProvider` - OpenAI GPT models
- `AnthropicProvider` - Anthropic Claude models
- `GoogleGeminiProvider` - Google Gemini models
- Each provider implements:
  - `invoke()` - Non-streaming completion
  - `stream()` - Streaming completion
  - `countTokens()` - Token counting
  - `getCost()` - Cost calculation

**router.ts**
- `LLMRouter` class - Intelligent request routing
- Features:
  - Provider prioritization
  - Rate limiting per provider
  - Concurrent request management
  - Automatic failover
  - Cost tracking
  - Health checks

#### Other Services

**templateGenerator.ts**
- `TemplateGenerator` class
- Generates new projects from templates
- Features:
  - Template copying and customization
  - Git repository initialization
  - Environment variable generation
  - Dependency installation
  - README generation

**sandboxManager.ts**
- `SandboxManager` class
- Manages containerized development environments
- Features:
  - Sandbox creation
  - Command execution
  - Log retrieval
  - Sandbox lifecycle management

**hmrServer.ts**
- `HMRServer` class
- Hot Module Reloading via WebSockets
- Features:
  - File watching
  - Change detection
  - Real-time client updates
  - File type detection

### Utilities (`src/utils/`)

**logger.ts**
- Structured logging with Pino
- Log levels: debug, info, warn, error
- JSON and pretty-print formats
- Timestamp and context tracking

## Configuration Files

### package.json

```json
{
  "name": "agentic-platform",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "tsc && esbuild ...",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write ..."
  }
}
```

### tsconfig.json

TypeScript configuration with:
- ES2020 target
- ESNext modules
- Path aliases for imports
- Strict type checking
- Source maps

### .env.example

Template for environment variables:
- LLM API keys
- Database connection
- Redis URL
- Storage configuration
- Logging settings
- Security secrets

### Dockerfile

Multi-stage Docker build:
- Base: Node.js 22 Alpine
- Installs dependencies
- Copies source code
- Builds application
- Exposes ports 3000 and 9229
- Health checks included

### docker-compose.yml

Services:
- `app` - Main application
- `postgres` - PostgreSQL database
- `redis` - Redis cache
- Networks and volumes configured

## Kubernetes Configuration

### k8s/deployment.yaml

Kubernetes manifests:
- **Deployment** - 3 replicas with rolling updates
- **Service** - LoadBalancer on port 80
- **ServiceAccount** - RBAC
- **HorizontalPodAutoscaler** - Auto-scaling based on CPU/memory

Features:
- Liveness probes
- Readiness probes
- Resource requests/limits
- Environment variable injection from secrets

## CI/CD Pipeline

### .github/workflows/ci.yml

GitHub Actions workflow:
1. **Test** - Run tests with PostgreSQL service
2. **Build** - Compile TypeScript
3. **Docker** - Build and push image
4. **Deploy** - Update Kubernetes deployment

## Documentation

### README.md

Main documentation covering:
- Features overview
- Architecture diagram
- Quick start guide
- API documentation
- Project structure
- Configuration
- Deployment options
- Development guidelines
- Contributing guide

### docs/DEPLOYMENT.md

Comprehensive deployment guide:
- Local development setup
- Docker deployment
- Kubernetes deployment
- Cloud provider guides (AWS, GCP, Azure)
- Monitoring and observability
- Troubleshooting
- Performance tuning
- Security considerations

### docs/PROJECT_STRUCTURE.md

This file - detailed project structure documentation.

## Examples

### examples/client.ts

Example client code demonstrating:
- Project generation
- Sandbox creation
- LLM completions (streaming and non-streaming)
- Status checking
- Token counting
- Sandbox management
- Full workflow example

## Type Definitions

TypeScript types are defined inline in service files:

```typescript
// LLM types
interface LLMMessage { ... }
interface LLMRequest { ... }
interface LLMResponse { ... }
interface StreamChunk { ... }

// Provider types
interface ProviderConfig { ... }

// Sandbox types
interface SandboxConfig { ... }
interface Sandbox { ... }

// Project types
interface ProjectConfig { ... }
```

## API Endpoints

### Health Check Routes

```
GET  /api/health          - Full health check
GET  /api/health/live     - Liveness probe
GET  /api/health/ready    - Readiness probe
```

### Project Routes

```
POST /api/projects/generate  - Generate new project
GET  /api/projects           - List projects
GET  /api/projects/:id       - Get project details
```

### Sandbox Routes

```
POST /api/sandboxes/create        - Create sandbox
GET  /api/sandboxes               - List sandboxes
GET  /api/sandboxes/:id           - Get sandbox status
GET  /api/sandboxes/:id/logs      - Get sandbox logs
POST /api/sandboxes/:id/stop      - Stop sandbox
```

### LLM Routes

```
POST /api/llm/complete       - Get LLM completion (streaming/non-streaming)
GET  /api/llm/status         - Get LLM router status
POST /api/llm/count-tokens   - Count tokens for text
```

## Module Dependencies

### Core Dependencies

```
express              - Web framework
cors                 - CORS middleware
socket.io            - WebSocket support
dotenv               - Environment variables
uuid                 - ID generation
fs-extra             - File system utilities
chokidar             - File watching
pino                 - Logging
```

### Development Dependencies

```
typescript           - TypeScript compiler
tsx                  - TypeScript execution
esbuild              - Bundler
vitest               - Test framework
eslint               - Linting
prettier             - Code formatting
```

## Build Process

### Development

```bash
npm run dev
# Runs: tsx watch src/server/index.ts
# Watches for file changes and auto-restarts
```

### Production Build

```bash
npm run build
# 1. Runs TypeScript compiler (tsc)
# 2. Bundles with esbuild
# 3. Outputs to dist/ directory
```

### Start Production

```bash
npm start
# Runs: node dist/server/index.js
```

## Testing

Tests are located alongside source files with `.test.ts` extension:

```
src/
├── server/
│   └── routes/
│       └── llm.test.ts
├── services/
│   ├── llm/
│   │   └── router.test.ts
│   └── templateGenerator.test.ts
```

Run tests:
```bash
npm test              # Run once
npm run test:watch   # Watch mode
```

## Environment

### Development

```bash
NODE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Production

```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
```

## Performance Considerations

### Code Organization

- Modular service architecture
- Clear separation of concerns
- Reusable utilities
- Minimal dependencies

### Optimization

- Streaming responses for large outputs
- Connection pooling for databases
- Rate limiting to prevent abuse
- Caching with Redis
- Lazy loading of providers

## Security

### Secrets Management

- Environment variables for sensitive data
- Kubernetes secrets for production
- No hardcoded credentials
- API key rotation support

### Access Control

- CORS configuration
- Request validation
- Error handling (no sensitive info in errors)
- Rate limiting

## Scalability

### Horizontal Scaling

- Stateless design
- Load balancer compatible
- Kubernetes auto-scaling
- Database connection pooling

### Vertical Scaling

- Configurable resource limits
- Memory optimization
- CPU efficiency

## Monitoring

### Health Checks

- Liveness endpoint
- Readiness endpoint
- Full health status

### Logging

- Structured JSON logs
- Log levels
- Request tracking
- Error tracking

### Metrics

- Request count
- Response time
- Error rate
- LLM usage
- Cost tracking

## Future Enhancements

- [ ] Database models and migrations
- [ ] Advanced caching
- [ ] Webhook support
- [ ] Custom LLM providers
- [ ] Analytics dashboard
- [ ] Multi-tenant support
- [ ] API authentication
- [ ] Rate limiting per user
- [ ] Batch processing
- [ ] Vision capabilities

## References

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/)
