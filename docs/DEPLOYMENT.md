# Deployment Guide

This guide covers deploying the Agentic Platform to production environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker](#docker)
3. [Kubernetes](#kubernetes)
4. [AWS](#aws)
5. [Google Cloud](#google-cloud)
6. [Azure](#azure)
7. [Monitoring & Observability](#monitoring--observability)

## Local Development

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/agentic-platform.git
cd agentic-platform

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Configure environment variables
nano .env.local

# Start development server
npm run dev
```

The server will be available at `http://localhost:3000`.

## Docker

### Build Image

```bash
# Build Docker image
docker build -t agentic-platform:latest .

# Tag for registry
docker tag agentic-platform:latest myregistry/agentic-platform:latest
```

### Run Container

```bash
# Run with Docker
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk_test_... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e DATABASE_URL=postgresql://... \
  agentic-platform:latest

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Push to Registry

```bash
# Login to Docker Hub
docker login

# Push image
docker push myregistry/agentic-platform:latest

# Or use AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag agentic-platform:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/agentic-platform:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/agentic-platform:latest
```

## Kubernetes

### Prerequisites

- kubectl configured
- Kubernetes cluster (1.24+)
- Container registry access

### Secrets

Create Kubernetes secrets for sensitive data:

```bash
# Create LLM secrets
kubectl create secret generic llm-secrets \
  --from-literal=openai-key=sk_test_... \
  --from-literal=anthropic-key=sk-ant-... \
  --from-literal=google-key=...

# Create database secrets
kubectl create secret generic database-secrets \
  --from-literal=url=postgresql://user:password@postgres:5432/db

# Verify secrets
kubectl get secrets
```

### Deploy

```bash
# Apply deployment
kubectl apply -f k8s/deployment.yaml

# Check deployment status
kubectl get deployments
kubectl get pods -l app=agentic-platform

# View logs
kubectl logs -l app=agentic-platform -f

# Describe pod for debugging
kubectl describe pod <pod-name>
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment agentic-platform --replicas=5

# Check HPA status
kubectl get hpa

# View autoscaling metrics
kubectl describe hpa agentic-platform
```

### Updating Deployment

```bash
# Update image
kubectl set image deployment/agentic-platform \
  app=myregistry/agentic-platform:v1.2.0 \
  --record

# Check rollout status
kubectl rollout status deployment/agentic-platform

# Rollback if needed
kubectl rollout undo deployment/agentic-platform
```

### Cleanup

```bash
# Delete deployment
kubectl delete -f k8s/deployment.yaml

# Or delete specific resources
kubectl delete deployment agentic-platform
kubectl delete service agentic-platform
kubectl delete hpa agentic-platform
```

## AWS

### ECS (Elastic Container Service)

```bash
# Create ECR repository
aws ecr create-repository --repository-name agentic-platform

# Push image to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag agentic-platform:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/agentic-platform:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/agentic-platform:latest

# Create ECS task definition (see examples/ecs-task-definition.json)
aws ecs register-task-definition --cli-input-json file://examples/ecs-task-definition.json

# Create ECS service
aws ecs create-service \
  --cluster agentic-platform \
  --service-name agentic-platform \
  --task-definition agentic-platform:1 \
  --desired-count 3 \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=app,containerPort=3000
```

### RDS (Relational Database Service)

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier agentic-platform-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourPassword123! \
  --allocated-storage 20

# Get connection string
aws rds describe-db-instances \
  --db-instance-identifier agentic-platform-db \
  --query 'DBInstances[0].Endpoint'
```

### ElastiCache (Redis)

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id agentic-platform-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1

# Get endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id agentic-platform-redis \
  --show-cache-node-info
```

## Google Cloud

### Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/agentic-platform

# Deploy to Cloud Run
gcloud run deploy agentic-platform \
  --image gcr.io/PROJECT_ID/agentic-platform \
  --platform managed \
  --region us-central1 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars OPENAI_API_KEY=sk_test_...
```

### Cloud SQL

```bash
# Create Cloud SQL instance
gcloud sql instances create agentic-platform-db \
  --database-version POSTGRES_15 \
  --tier db-f1-micro \
  --region us-central1

# Create database
gcloud sql databases create agentic_platform \
  --instance agentic-platform-db

# Get connection string
gcloud sql instances describe agentic-platform-db \
  --format='value(connectionName)'
```

## Azure

### Container Instances

```bash
# Create resource group
az group create \
  --name agentic-platform \
  --location eastus

# Create container instance
az container create \
  --resource-group agentic-platform \
  --name agentic-platform \
  --image myregistry.azurecr.io/agentic-platform:latest \
  --cpu 1 \
  --memory 1 \
  --port 3000 \
  --environment-variables \
    OPENAI_API_KEY=sk_test_... \
    DATABASE_URL=postgresql://...
```

### App Service

```bash
# Create App Service plan
az appservice plan create \
  --name agentic-platform-plan \
  --resource-group agentic-platform \
  --sku B1 \
  --is-linux

# Create web app
az webapp create \
  --resource-group agentic-platform \
  --plan agentic-platform-plan \
  --name agentic-platform \
  --deployment-container-image-name myregistry.azurecr.io/agentic-platform:latest
```

## Monitoring & Observability

### Health Checks

```bash
# Check server health
curl http://localhost:3000/api/health

# Check readiness
curl http://localhost:3000/api/health/ready

# Check liveness
curl http://localhost:3000/api/health/live
```

### Logging

```bash
# View application logs
docker-compose logs -f app

# Or with Kubernetes
kubectl logs -l app=agentic-platform -f

# Stream logs from multiple pods
kubectl logs -l app=agentic-platform -f --all-containers=true
```

### Metrics

Prometheus metrics are available at `/metrics` (when configured).

### Alerting

Set up alerts for:
- High error rates
- High latency
- Low availability
- Resource exhaustion
- LLM provider failures

## Environment Variables

### Required

```bash
OPENAI_API_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://user:password@host:5432/db
```

### Optional

```bash
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
LOG_FORMAT=json
PORT=3000
NODE_ENV=production
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs <container-id>

# Check environment variables
docker inspect <container-id> | grep Env

# Test locally
docker run -it --entrypoint /bin/sh agentic-platform:latest
```

### Database connection issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check credentials
echo $DATABASE_URL

# Verify network connectivity
telnet <host> <port>
```

### LLM provider failures

```bash
# Check API keys
echo $OPENAI_API_KEY

# Test API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check rate limits
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -v
```

## Performance Tuning

### Node.js

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Enable clustering
NODE_CLUSTER_WORKERS=4
```

### Database

```bash
# Connection pooling
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Query timeout
DATABASE_STATEMENT_TIMEOUT=30000
```

### Redis

```bash
# Increase memory
REDIS_MAXMEMORY=1gb
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

## Security

### SSL/TLS

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Use in Node.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(3000);
```

### API Key Rotation

```bash
# Update secrets
kubectl patch secret llm-secrets -p '{"data":{"openai-key":"'$(echo -n "new_key" | base64)'"}}'

# Restart pods
kubectl rollout restart deployment/agentic-platform
```

## Backup & Recovery

### Database Backup

```bash
# Backup PostgreSQL
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

### Configuration Backup

```bash
# Backup Kubernetes manifests
kubectl get all -o yaml > backup.yaml

# Restore from backup
kubectl apply -f backup.yaml
```

## References

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [AWS Documentation](https://docs.aws.amazon.com/)
- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Azure Documentation](https://docs.microsoft.com/azure/)
