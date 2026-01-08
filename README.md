# Agentic Platform

A production-grade agentic platform with multi-LLM support, project scaffolding, containerized development environments, and intelligent request routing.

## Features

✅ **Multi-LLM Support** - OpenAI, Anthropic, Google Gemini with intelligent fallback
✅ **Streaming Responses** - Real-time token streaming for all providers
✅ **Cost Tracking** - Detailed usage and billing per model
✅ **Project Scaffolding** - Generate projects from templates
✅ **Containerized Sandboxes** - Isolated development environments
✅ **Hot Module Reloading** - Instant feedback during development
✅ **Rate Limiting** - Per-provider rate limiting and concurrency control
✅ **Production Ready** - Kubernetes deployment, health checks, monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Agentic Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Express.js API Server                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │  Routes: /projects, /sandboxes, /llm, etc   │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           LLM Router                                │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ OpenAI │ Anthropic │ Google │ Fallback      │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Services                                  │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ Template Generator │ Sandbox Manager │ HMR  │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose (for containerized development)
- API keys for LLM providers (OpenAI, Anthropic, Google)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/agentic-platform.git
cd agentic-platform

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Add your API keys to .env.local
```

### Development

```bash
# Start development server
npm run dev

# Server runs on http://localhost:3000
# API available at http://localhost:3000/api
```

### Docker

```bash
# Build Docker image
npm run docker:build

# Start with Docker Compose
npm run docker:run

# Stop services
npm run docker:stop
```

### Kubernetes

```bash
# Deploy to Kubernetes
npm run k8s:deploy

# Check deployment status
kubectl get pods -l app=agentic-platform

# View logs
kubectl logs -l app=agentic-platform -f

# Delete deployment
npm run k8s:delete
```

## API Documentation

### Health Check

```bash
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-08T12:00:00.000Z",
  "uptime": 3600,
  "llmRouter": {
    "providers": [
      { "name": "openai", "active": 0, "available": true },
      { "name": "anthropic", "active": 1, "available": true }
    ]
  }
}
```

### Generate Project

```bash
POST /api/projects/generate
Content-Type: application/json

{
  "projectName": "my-ai-app",
  "template": "web-ai-agent",
  "owner": {
    "userId": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "features": ["ai", "database", "storage"]
}
```

### Create Sandbox

```bash
POST /api/sandboxes/create
Content-Type: application/json

{
  "projectId": "proj_123",
  "projectPath": "/projects/proj_123/my-app",
  "environment": {
    "OPENAI_API_KEY": "sk_test_...",
    "NODE_ENV": "development"
  }
}
```

### LLM Completion (Non-streaming)

```bash
POST /api/llm/complete
Content-Type: application/json

{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant" },
    { "role": "user", "content": "What is 2+2?" }
  ],
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 100
}
```

### LLM Completion (Streaming)

```bash
POST /api/llm/complete
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Tell me a story" }
  ],
  "model": "gpt-4",
  "stream": true
}
```

Response (Server-Sent Events):
```
data: {"type":"start"}
data: {"type":"content","content":"Once"}
data: {"type":"content","content":" upon"}
data: {"type":"content","content":" a"}
data: {"type":"end"}
```

## Project Structure

```
agentic-platform/
├── src/
│   ├── server/
│   │   ├── index.ts              # Main server entry point
│   │   └── routes/               # API routes
│   │       ├── health.ts
│   │       ├── projects.ts
│   │       ├── sandboxes.ts
│   │       └── llm.ts
│   ├── services/
│   │   ├── llm/
│   │   │   ├── providers.ts      # LLM provider implementations
│   │   │   └── router.ts         # Intelligent LLM routing
│   │   ├── templateGenerator.ts  # Project scaffolding
│   │   ├── sandboxManager.ts     # Container management
│   │   └── hmrServer.ts          # Hot module reloading
│   └── utils/
│       └── logger.ts             # Logging utility
├── k8s/
│   └── deployment.yaml           # Kubernetes manifests
├── Dockerfile                    # Docker image definition
├── docker-compose.yml            # Docker Compose configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

### Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# LLM Providers
OPENAI_API_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FORMAT=pretty
```

## LLM Provider Configuration

The platform supports multiple LLM providers with intelligent routing:

```typescript
const llmRouter = new LLMRouter([
  {
    name: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    enabled: true,
    priority: 1,           // Higher priority = tried first
    maxConcurrent: 10,     // Max concurrent requests
    rateLimitPerMinute: 60 // Rate limit
  },
  {
    name: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY,
    enabled: true,
    priority: 2,
    maxConcurrent: 10,
    rateLimitPerMinute: 60
  }
]);
```

### Provider Priorities

Requests are routed to providers in priority order:
1. Check if provider is available
2. Check rate limit
3. Check concurrent request capacity
4. If all checks pass, use provider
5. If provider fails, try next priority

## Monitoring & Observability

### Health Checks

- **Liveness**: `/api/health/live` - Is the server running?
- **Readiness**: `/api/health/ready` - Is the server ready to accept requests?
- **Full Health**: `/api/health` - Detailed health information

### Logging

Logs are structured and include:
- Timestamp
- Log level (info, warn, error, debug)
- Message
- Context (error details, request info, etc.)

### Metrics

The platform tracks:
- LLM API calls per provider
- Token usage and costs
- Request latency
- Error rates
- Sandbox resource usage

## Deployment

### Docker

```bash
# Build image
docker build -t agentic-platform:latest .

# Run container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk_test_... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  agentic-platform:latest
```

### Kubernetes

```bash
# Create secrets
kubectl create secret generic llm-secrets \
  --from-literal=openai-key=sk_test_... \
  --from-literal=anthropic-key=sk-ant-... \
  --from-literal=google-key=...

# Deploy
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=agentic-platform
kubectl logs -l app=agentic-platform -f
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With UI
npm run test:watch -- --ui
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check documentation at https://docs.agentic-platform.com
- Email: support@agentic-platform.com

## Roadmap

- [ ] Advanced caching layer
- [ ] Webhook support
- [ ] Custom LLM provider integration
- [ ] Advanced analytics dashboard
- [ ] Multi-tenant support
- [ ] API rate limiting per user
- [ ] Batch processing
- [ ] Fine-tuning support
- [ ] Vision capabilities
- [ ] Audio processing

## Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- LLM integrations: [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Google](https://ai.google.dev/)
- Containerization: [Docker](https://www.docker.com/), [Kubernetes](https://kubernetes.io/)
