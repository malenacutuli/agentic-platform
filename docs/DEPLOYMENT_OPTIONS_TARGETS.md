# Deployment Options and Targets

This guide provides comprehensive coverage of deployment options, supported deployment targets, custom domain configuration, and deployment preview functionality in cloud development environments.

---

## Table of Contents

1. [Overview](#overview)
2. [One-Click Deploy](#one-click-deploy)
3. [Custom Domain Support](#custom-domain-support)
4. [Deployment Preview](#deployment-preview)
5. [Deployment Targets](#deployment-targets)
6. [Platform-Specific Deployment](#platform-specific-deployment)
7. [Self-Hosted Deployment](#self-hosted-deployment)
8. [CI/CD Integration](#cicd-integration)
9. [Rollback and Versioning](#rollback-and-versioning)
10. [Best Practices](#best-practices)

---

## Overview

Modern cloud development platforms provide multiple deployment options to accommodate different project requirements, from simple one-click deployments to complex multi-environment CI/CD pipelines.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           DEPLOYMENT ARCHITECTURE                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SOURCE                    BUILD                    DEPLOY                    SERVE     │
│                                                                                         │
│  ┌─────────┐            ┌─────────┐            ┌─────────┐            ┌─────────┐      │
│  │  Git    │───────────▶│  Build  │───────────▶│  CDN/   │───────────▶│  Users  │      │
│  │  Repo   │            │  System │            │  Edge   │            │         │      │
│  └─────────┘            └─────────┘            └─────────┘            └─────────┘      │
│       │                      │                      │                                   │
│       │                      │                      │                                   │
│       ▼                      ▼                      ▼                                   │
│  ┌─────────┐            ┌─────────┐            ┌─────────┐                             │
│  │ Webhook │            │ Artifact│            │ Preview │                             │
│  │ Trigger │            │ Storage │            │  URLs   │                             │
│  └─────────┘            └─────────┘            └─────────┘                             │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Options Comparison

| Feature | One-Click | CI/CD | Self-Hosted |
|---------|-----------|-------|-------------|
| **Setup Time** | <1 min | 10-30 min | 1-4 hours |
| **Customization** | Low | High | Full |
| **Scalability** | Auto | Configurable | Manual |
| **Cost** | Pay-per-use | Variable | Fixed |
| **Control** | Limited | Medium | Full |

---

## One-Click Deploy

### Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ONE-CLICK DEPLOY FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER CLICKS "DEPLOY"                                                                   │
│         │                                                                               │
│         ▼                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  1. VALIDATION                                                                   │   │
│  │     • Check project configuration                                               │   │
│  │     • Verify build settings                                                     │   │
│  │     • Validate environment variables                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                               │
│         ▼                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  2. BUILD                                                                        │   │
│  │     • Install dependencies                                                      │   │
│  │     • Run build command                                                         │   │
│  │     • Generate static assets                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                               │
│         ▼                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  3. UPLOAD                                                                       │   │
│  │     • Upload to CDN/Edge                                                        │   │
│  │     • Invalidate cache                                                          │   │
│  │     • Configure routing                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                               │
│         ▼                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  4. ACTIVATE                                                                     │   │
│  │     • Update DNS/routing                                                        │   │
│  │     • Enable SSL                                                                │   │
│  │     • Health check                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                               │
│         ▼                                                                               │
│  DEPLOYMENT COMPLETE → URL AVAILABLE                                                    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### One-Click Deploy Implementation

```typescript
// src/deployment/oneClickDeploy.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface DeployConfig {
  projectId: string;
  projectPath: string;
  buildCommand: string;
  outputDir: string;
  environment: 'preview' | 'production';
}

interface DeployResult {
  success: boolean;
  url: string;
  deploymentId: string;
  duration: number;
  error?: string;
}

class OneClickDeployer {
  private s3: S3Client;
  private cloudfront: CloudFrontClient;
  private bucket: string;
  private distributionId: string;

  constructor() {
    this.s3 = new S3Client({});
    this.cloudfront = new CloudFrontClient({});
    this.bucket = process.env.DEPLOY_BUCKET!;
    this.distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID!;
  }

  /**
   * Deploy project with one click
   */
  async deploy(config: DeployConfig): Promise<DeployResult> {
    const startTime = Date.now();
    const deploymentId = this.generateDeploymentId();

    try {
      // Step 1: Validate
      await this.validate(config);

      // Step 2: Build
      await this.build(config);

      // Step 3: Upload
      await this.upload(config, deploymentId);

      // Step 4: Activate
      const url = await this.activate(config, deploymentId);

      return {
        success: true,
        url,
        deploymentId,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        url: '',
        deploymentId,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Step 1: Validate project configuration
   */
  private async validate(config: DeployConfig): Promise<void> {
    // Check if project path exists
    if (!fs.existsSync(config.projectPath)) {
      throw new Error('Project path does not exist');
    }

    // Check if package.json exists
    const packageJsonPath = path.join(config.projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    // Validate build command
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const buildScript = config.buildCommand.replace('npm run ', '').replace('pnpm ', '');
    
    if (!packageJson.scripts?.[buildScript] && !config.buildCommand.includes(' ')) {
      throw new Error(`Build script "${buildScript}" not found in package.json`);
    }
  }

  /**
   * Step 2: Build project
   */
  private async build(config: DeployConfig): Promise<void> {
    const cwd = config.projectPath;

    // Install dependencies
    execSync('pnpm install --frozen-lockfile', { cwd, stdio: 'pipe' });

    // Run build
    execSync(config.buildCommand, {
      cwd,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });

    // Verify output directory
    const outputPath = path.join(cwd, config.outputDir);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Build output directory "${config.outputDir}" not found`);
    }
  }

  /**
   * Step 3: Upload to CDN
   */
  private async upload(config: DeployConfig, deploymentId: string): Promise<void> {
    const outputPath = path.join(config.projectPath, config.outputDir);
    const files = this.getAllFiles(outputPath);

    // Upload all files in parallel
    const uploadPromises = files.map(async (file) => {
      const relativePath = path.relative(outputPath, file);
      const key = `${config.projectId}/${deploymentId}/${relativePath}`;
      const content = fs.readFileSync(file);
      const contentType = this.getContentType(file);

      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: this.getCacheControl(file),
      }));
    });

    await Promise.all(uploadPromises);
  }

  /**
   * Step 4: Activate deployment
   */
  private async activate(config: DeployConfig, deploymentId: string): Promise<string> {
    // Update routing to point to new deployment
    await this.updateRouting(config.projectId, deploymentId);

    // Invalidate CloudFront cache
    await this.cloudfront.send(new CreateInvalidationCommand({
      DistributionId: this.distributionId,
      InvalidationBatch: {
        CallerReference: deploymentId,
        Paths: {
          Quantity: 1,
          Items: [`/${config.projectId}/*`],
        },
      },
    }));

    // Generate URL
    const subdomain = config.environment === 'production' 
      ? config.projectId 
      : `${deploymentId}.preview`;
    
    return `https://${subdomain}.example.com`;
  }

  /**
   * Update routing configuration
   */
  private async updateRouting(projectId: string, deploymentId: string): Promise<void> {
    // Implementation depends on routing infrastructure
    // Could be Lambda@Edge, CloudFront Functions, or origin configuration
  }

  /**
   * Get all files in directory recursively
   */
  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };
    
    walk(dir);
    return files;
  }

  /**
   * Get content type for file
   */
  private getContentType(file: string): string {
    const ext = path.extname(file).toLowerCase();
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.ico': 'image/x-icon',
    };
    
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Get cache control header
   */
  private getCacheControl(file: string): string {
    const ext = path.extname(file).toLowerCase();
    
    // HTML files - no cache
    if (ext === '.html') {
      return 'no-cache, no-store, must-revalidate';
    }
    
    // Hashed assets - long cache
    if (file.includes('.[hash]') || /\.[a-f0-9]{8,}\./.test(file)) {
      return 'public, max-age=31536000, immutable';
    }
    
    // Other assets - medium cache
    return 'public, max-age=86400';
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }
}

export { OneClickDeployer, DeployConfig, DeployResult };
```

---

## Custom Domain Support

### Domain Configuration

```typescript
// src/deployment/customDomain.ts

import { Route53Client, ChangeResourceRecordSetsCommand, ListHostedZonesByNameCommand } from '@aws-sdk/client-route-53';
import { ACMClient, RequestCertificateCommand, DescribeCertificateCommand } from '@aws-sdk/client-acm';

interface DomainConfig {
  projectId: string;
  domain: string;
  subdomain?: string;
}

interface DomainResult {
  success: boolean;
  domain: string;
  status: 'pending' | 'active' | 'failed';
  sslStatus: 'pending' | 'issued' | 'failed';
  dnsRecords: DNSRecord[];
  error?: string;
}

interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  ttl: number;
}

class CustomDomainManager {
  private route53: Route53Client;
  private acm: ACMClient;

  constructor() {
    this.route53 = new Route53Client({});
    this.acm = new ACMClient({ region: 'us-east-1' }); // ACM for CloudFront must be in us-east-1
  }

  /**
   * Add custom domain to project
   */
  async addDomain(config: DomainConfig): Promise<DomainResult> {
    const fullDomain = config.subdomain 
      ? `${config.subdomain}.${config.domain}`
      : config.domain;

    try {
      // Step 1: Request SSL certificate
      const certificateArn = await this.requestCertificate(fullDomain);

      // Step 2: Get DNS validation records
      const validationRecords = await this.getValidationRecords(certificateArn);

      // Step 3: Create DNS records (if we manage the domain)
      const dnsRecords = await this.createDNSRecords(config, fullDomain);

      return {
        success: true,
        domain: fullDomain,
        status: 'pending',
        sslStatus: 'pending',
        dnsRecords: [...validationRecords, ...dnsRecords],
      };
    } catch (error: any) {
      return {
        success: false,
        domain: fullDomain,
        status: 'failed',
        sslStatus: 'failed',
        dnsRecords: [],
        error: error.message,
      };
    }
  }

  /**
   * Request SSL certificate from ACM
   */
  private async requestCertificate(domain: string): Promise<string> {
    const response = await this.acm.send(new RequestCertificateCommand({
      DomainName: domain,
      ValidationMethod: 'DNS',
      SubjectAlternativeNames: [domain, `www.${domain}`],
    }));

    return response.CertificateArn!;
  }

  /**
   * Get DNS validation records for certificate
   */
  private async getValidationRecords(certificateArn: string): Promise<DNSRecord[]> {
    // Wait for validation options to be available
    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await this.acm.send(new DescribeCertificateCommand({
      CertificateArn: certificateArn,
    }));

    const validationOptions = response.Certificate?.DomainValidationOptions || [];
    
    return validationOptions.map(option => ({
      type: 'CNAME' as const,
      name: option.ResourceRecord?.Name || '',
      value: option.ResourceRecord?.Value || '',
      ttl: 300,
    }));
  }

  /**
   * Create DNS records for domain
   */
  private async createDNSRecords(config: DomainConfig, fullDomain: string): Promise<DNSRecord[]> {
    // Get hosted zone
    const hostedZone = await this.getHostedZone(config.domain);
    
    if (!hostedZone) {
      // Domain not managed by us, return records for manual setup
      return this.getManualDNSRecords(fullDomain);
    }

    // Create records in Route53
    await this.route53.send(new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZone,
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: fullDomain,
              Type: 'CNAME',
              TTL: 300,
              ResourceRecords: [
                { Value: `${config.projectId}.cdn.example.com` },
              ],
            },
          },
        ],
      },
    }));

    return [{
      type: 'CNAME',
      name: fullDomain,
      value: `${config.projectId}.cdn.example.com`,
      ttl: 300,
    }];
  }

  /**
   * Get hosted zone for domain
   */
  private async getHostedZone(domain: string): Promise<string | null> {
    const response = await this.route53.send(new ListHostedZonesByNameCommand({
      DNSName: domain,
      MaxItems: 1,
    }));

    const zone = response.HostedZones?.[0];
    if (zone && zone.Name === `${domain}.`) {
      return zone.Id?.replace('/hostedzone/', '') || null;
    }

    return null;
  }

  /**
   * Get DNS records for manual setup
   */
  private getManualDNSRecords(fullDomain: string): DNSRecord[] {
    return [
      {
        type: 'CNAME',
        name: fullDomain,
        value: 'proxy.example.com',
        ttl: 300,
      },
    ];
  }

  /**
   * Verify domain ownership
   */
  async verifyDomain(domain: string): Promise<boolean> {
    // Check if DNS records are properly configured
    const dns = require('dns').promises;
    
    try {
      const records = await dns.resolveCname(domain);
      return records.some((record: string) => record.includes('example.com'));
    } catch {
      return false;
    }
  }

  /**
   * Remove custom domain
   */
  async removeDomain(config: DomainConfig): Promise<void> {
    const fullDomain = config.subdomain 
      ? `${config.subdomain}.${config.domain}`
      : config.domain;

    const hostedZone = await this.getHostedZone(config.domain);
    
    if (hostedZone) {
      await this.route53.send(new ChangeResourceRecordSetsCommand({
        HostedZoneId: hostedZone,
        ChangeBatch: {
          Changes: [
            {
              Action: 'DELETE',
              ResourceRecordSet: {
                Name: fullDomain,
                Type: 'CNAME',
                TTL: 300,
                ResourceRecords: [
                  { Value: `${config.projectId}.cdn.example.com` },
                ],
              },
            },
          ],
        },
      }));
    }
  }
}

export { CustomDomainManager, DomainConfig, DomainResult, DNSRecord };
```

### Domain Configuration UI Data

```typescript
// src/deployment/domainUI.ts

interface DomainSetupInstructions {
  provider: string;
  steps: string[];
  records: {
    type: string;
    host: string;
    value: string;
    ttl: string;
  }[];
}

const domainSetupInstructions: Record<string, DomainSetupInstructions> = {
  cloudflare: {
    provider: 'Cloudflare',
    steps: [
      'Log in to your Cloudflare dashboard',
      'Select your domain',
      'Go to DNS settings',
      'Add the following records',
      'Set Proxy status to "DNS only" (gray cloud)',
    ],
    records: [
      { type: 'CNAME', host: '@', value: 'proxy.example.com', ttl: 'Auto' },
      { type: 'CNAME', host: 'www', value: 'proxy.example.com', ttl: 'Auto' },
    ],
  },
  
  godaddy: {
    provider: 'GoDaddy',
    steps: [
      'Log in to your GoDaddy account',
      'Go to My Products > Domains',
      'Click DNS next to your domain',
      'Add the following records',
    ],
    records: [
      { type: 'CNAME', host: '@', value: 'proxy.example.com', ttl: '1 Hour' },
      { type: 'CNAME', host: 'www', value: 'proxy.example.com', ttl: '1 Hour' },
    ],
  },
  
  namecheap: {
    provider: 'Namecheap',
    steps: [
      'Log in to your Namecheap account',
      'Go to Domain List',
      'Click Manage next to your domain',
      'Go to Advanced DNS',
      'Add the following records',
    ],
    records: [
      { type: 'CNAME', host: '@', value: 'proxy.example.com.', ttl: 'Automatic' },
      { type: 'CNAME', host: 'www', value: 'proxy.example.com.', ttl: 'Automatic' },
    ],
  },
  
  route53: {
    provider: 'AWS Route 53',
    steps: [
      'Log in to AWS Console',
      'Go to Route 53 > Hosted zones',
      'Select your domain',
      'Create the following records',
    ],
    records: [
      { type: 'CNAME', host: '', value: 'proxy.example.com', ttl: '300' },
      { type: 'CNAME', host: 'www', value: 'proxy.example.com', ttl: '300' },
    ],
  },
};

export { domainSetupInstructions, DomainSetupInstructions };
```

---

## Deployment Preview

### Preview Deployment System

```typescript
// src/deployment/preview.ts

interface PreviewConfig {
  projectId: string;
  branch: string;
  commitSha: string;
  pullRequestId?: number;
}

interface PreviewResult {
  url: string;
  deploymentId: string;
  expiresAt: Date;
  status: 'building' | 'ready' | 'failed';
}

class PreviewDeploymentManager {
  private deployer: OneClickDeployer;
  private previews: Map<string, PreviewResult> = new Map();

  constructor() {
    this.deployer = new OneClickDeployer();
  }

  /**
   * Create preview deployment
   */
  async createPreview(config: PreviewConfig): Promise<PreviewResult> {
    const previewId = this.generatePreviewId(config);
    
    // Check if preview already exists
    const existing = this.previews.get(previewId);
    if (existing && existing.status === 'ready') {
      return existing;
    }

    // Create new preview
    const result = await this.deployer.deploy({
      projectId: config.projectId,
      projectPath: `/tmp/previews/${previewId}`,
      buildCommand: 'pnpm build',
      outputDir: 'dist',
      environment: 'preview',
    });

    const preview: PreviewResult = {
      url: `https://${previewId}.preview.example.com`,
      deploymentId: result.deploymentId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: result.success ? 'ready' : 'failed',
    };

    this.previews.set(previewId, preview);
    
    // Post comment to PR if applicable
    if (config.pullRequestId) {
      await this.postPRComment(config, preview);
    }

    return preview;
  }

  /**
   * Generate preview ID from config
   */
  private generatePreviewId(config: PreviewConfig): string {
    const sanitizedBranch = config.branch
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .toLowerCase()
      .slice(0, 30);
    
    return `${config.projectId}-${sanitizedBranch}-${config.commitSha.slice(0, 7)}`;
  }

  /**
   * Post comment to PR with preview URL
   */
  private async postPRComment(config: PreviewConfig, preview: PreviewResult): Promise<void> {
    // Implementation depends on Git provider (GitHub, GitLab, etc.)
    const comment = `
## 🚀 Preview Deployment Ready

| Status | URL |
|--------|-----|
| ${preview.status === 'ready' ? '✅ Ready' : '❌ Failed'} | [${preview.url}](${preview.url}) |

**Commit:** \`${config.commitSha.slice(0, 7)}\`
**Expires:** ${preview.expiresAt.toISOString()}

---
*Deployed by Preview Bot*
    `.trim();

    // Post to GitHub/GitLab API
    console.log('PR Comment:', comment);
  }

  /**
   * Delete preview deployment
   */
  async deletePreview(previewId: string): Promise<void> {
    this.previews.delete(previewId);
    // Clean up S3 objects, CloudFront, etc.
  }

  /**
   * Clean up expired previews
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [id, preview] of this.previews) {
      if (preview.expiresAt < now) {
        await this.deletePreview(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export { PreviewDeploymentManager, PreviewConfig, PreviewResult };
```

---

## Deployment Targets

### Supported Platforms

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SUPPORTED DEPLOYMENT TARGETS                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  STATIC HOSTING                    SERVERLESS                    CONTAINERS            │
│                                                                                         │
│  ┌─────────────┐                  ┌─────────────┐              ┌─────────────┐         │
│  │   Vercel    │                  │ AWS Lambda  │              │   Docker    │         │
│  │   Netlify   │                  │ Cloudflare  │              │ Kubernetes  │         │
│  │ CloudFlare  │                  │   Workers   │              │    ECS      │         │
│  │   Pages     │                  │   Deno      │              │  Cloud Run  │         │
│  │   GitHub    │                  │   Deploy    │              │   Fly.io    │         │
│  │   Pages     │                  │             │              │   Railway   │         │
│  └─────────────┘                  └─────────────┘              └─────────────┘         │
│                                                                                         │
│  TRADITIONAL                       SELF-HOSTED                                          │
│                                                                                         │
│  ┌─────────────┐                  ┌─────────────┐                                      │
│  │    AWS      │                  │   VPS       │                                      │
│  │    S3 +     │                  │  (DigitalOcean,                                    │
│  │ CloudFront  │                  │   Linode,   │                                      │
│  │    GCP      │                  │   Hetzner)  │                                      │
│  │   Storage   │                  │   Bare      │                                      │
│  │   Azure     │                  │   Metal     │                                      │
│  │   Blob      │                  │             │                                      │
│  └─────────────┘                  └─────────────┘                                      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Platform Comparison

| Platform | Type | Best For | Pricing | Limits |
|----------|------|----------|---------|--------|
| **Vercel** | Serverless | Next.js, React | Free tier + usage | 100GB bandwidth |
| **Netlify** | Static + Functions | JAMstack | Free tier + usage | 100GB bandwidth |
| **Cloudflare Pages** | Edge | Static + Workers | Generous free | 500 builds/month |
| **AWS S3 + CloudFront** | Static | Enterprise | Pay-per-use | None |
| **Railway** | Container | Full-stack | $5/month + usage | None |
| **Fly.io** | Container | Global apps | Free tier + usage | 3 VMs free |
| **Self-hosted** | Any | Full control | Server cost | None |

---

## Platform-Specific Deployment

### Vercel Deployment

```typescript
// src/deployment/vercel.ts

interface VercelConfig {
  projectId: string;
  teamId?: string;
  token: string;
}

class VercelDeployer {
  private config: VercelConfig;
  private baseUrl = 'https://api.vercel.com';

  constructor(config: VercelConfig) {
    this.config = config;
  }

  /**
   * Deploy to Vercel
   */
  async deploy(projectPath: string): Promise<{ url: string; deploymentId: string }> {
    // Create deployment
    const response = await fetch(`${this.baseUrl}/v13/deployments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: this.config.projectId,
        files: await this.getFiles(projectPath),
        projectSettings: {
          framework: 'vite',
        },
        target: 'production',
      }),
    });

    const data = await response.json();
    
    return {
      url: `https://${data.url}`,
      deploymentId: data.id,
    };
  }

  /**
   * Get files for deployment
   */
  private async getFiles(projectPath: string): Promise<any[]> {
    // Implementation to read and encode files
    return [];
  }
}

// vercel.json configuration
const vercelConfig = {
  version: 2,
  builds: [
    {
      src: 'package.json',
      use: '@vercel/static-build',
      config: {
        distDir: 'dist',
      },
    },
  ],
  routes: [
    {
      handle: 'filesystem',
    },
    {
      src: '/(.*)',
      dest: '/index.html',
    },
  ],
  env: {
    VITE_API_URL: '@api_url',
  },
};

export { VercelDeployer, VercelConfig, vercelConfig };
```

### Netlify Deployment

```typescript
// src/deployment/netlify.ts

interface NetlifyConfig {
  siteId: string;
  token: string;
}

class NetlifyDeployer {
  private config: NetlifyConfig;
  private baseUrl = 'https://api.netlify.com/api/v1';

  constructor(config: NetlifyConfig) {
    this.config = config;
  }

  /**
   * Deploy to Netlify
   */
  async deploy(distPath: string): Promise<{ url: string; deploymentId: string }> {
    // Create deploy
    const response = await fetch(`${this.baseUrl}/sites/${this.config.siteId}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/zip',
      },
      body: await this.createZip(distPath),
    });

    const data = await response.json();
    
    return {
      url: data.ssl_url,
      deploymentId: data.id,
    };
  }

  /**
   * Create zip of dist folder
   */
  private async createZip(distPath: string): Promise<Buffer> {
    // Implementation to create zip
    return Buffer.from([]);
  }
}

// netlify.toml configuration
const netlifyConfig = `
[build]
  command = "pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "no-cache"
`;

export { NetlifyDeployer, NetlifyConfig, netlifyConfig };
```

### AWS S3 + CloudFront Deployment

```typescript
// src/deployment/aws.ts

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';

interface AWSConfig {
  bucket: string;
  distributionId: string;
  region: string;
}

class AWSDeployer {
  private s3: S3Client;
  private cloudfront: CloudFrontClient;
  private config: AWSConfig;

  constructor(config: AWSConfig) {
    this.config = config;
    this.s3 = new S3Client({ region: config.region });
    this.cloudfront = new CloudFrontClient({ region: config.region });
  }

  /**
   * Deploy to S3 + CloudFront
   */
  async deploy(distPath: string): Promise<{ url: string }> {
    // Clear existing files
    await this.clearBucket();

    // Upload new files
    await this.uploadDirectory(distPath);

    // Invalidate CloudFront cache
    await this.invalidateCache();

    return {
      url: `https://${this.config.distributionId}.cloudfront.net`,
    };
  }

  /**
   * Clear S3 bucket
   */
  private async clearBucket(): Promise<void> {
    const listResponse = await this.s3.send(new ListObjectsV2Command({
      Bucket: this.config.bucket,
    }));

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      await this.s3.send(new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: {
          Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
        },
      }));
    }
  }

  /**
   * Upload directory to S3
   */
  private async uploadDirectory(dirPath: string, prefix = ''): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await this.uploadDirectory(fullPath, key);
      } else {
        const content = fs.readFileSync(fullPath);
        const contentType = mime.lookup(entry.name) || 'application/octet-stream';

        await this.s3.send(new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: content,
          ContentType: contentType,
          CacheControl: this.getCacheControl(entry.name),
        }));
      }
    }
  }

  /**
   * Invalidate CloudFront cache
   */
  private async invalidateCache(): Promise<void> {
    await this.cloudfront.send(new CreateInvalidationCommand({
      DistributionId: this.config.distributionId,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Quantity: 1,
          Items: ['/*'],
        },
      },
    }));
  }

  /**
   * Get cache control header
   */
  private getCacheControl(filename: string): string {
    if (filename.endsWith('.html')) {
      return 'no-cache, no-store, must-revalidate';
    }
    if (/\.[a-f0-9]{8,}\./.test(filename)) {
      return 'public, max-age=31536000, immutable';
    }
    return 'public, max-age=86400';
  }
}

// CloudFormation template for S3 + CloudFront
const cloudFormationTemplate = {
  AWSTemplateFormatVersion: '2010-09-09',
  Resources: {
    S3Bucket: {
      Type: 'AWS::S3::Bucket',
      Properties: {
        BucketName: '${ProjectName}-static',
        WebsiteConfiguration: {
          IndexDocument: 'index.html',
          ErrorDocument: 'index.html',
        },
      },
    },
    CloudFrontDistribution: {
      Type: 'AWS::CloudFront::Distribution',
      Properties: {
        DistributionConfig: {
          Origins: [
            {
              DomainName: { 'Fn::GetAtt': ['S3Bucket', 'DomainName'] },
              Id: 'S3Origin',
              S3OriginConfig: {
                OriginAccessIdentity: '',
              },
            },
          ],
          DefaultCacheBehavior: {
            TargetOriginId: 'S3Origin',
            ViewerProtocolPolicy: 'redirect-to-https',
            CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
          },
          DefaultRootObject: 'index.html',
          Enabled: true,
          HttpVersion: 'http2',
        },
      },
    },
  },
};

export { AWSDeployer, AWSConfig, cloudFormationTemplate };
```

### Docker/Kubernetes Deployment

```typescript
// src/deployment/kubernetes.ts

interface K8sConfig {
  namespace: string;
  imageName: string;
  replicas: number;
  domain: string;
}

class KubernetesDeployer {
  private config: K8sConfig;

  constructor(config: K8sConfig) {
    this.config = config;
  }

  /**
   * Generate Kubernetes manifests
   */
  generateManifests(): string {
    return `
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${this.config.imageName}
  namespace: ${this.config.namespace}
spec:
  replicas: ${this.config.replicas}
  selector:
    matchLabels:
      app: ${this.config.imageName}
  template:
    metadata:
      labels:
        app: ${this.config.imageName}
    spec:
      containers:
      - name: ${this.config.imageName}
        image: ${this.config.imageName}:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ${this.config.imageName}
  namespace: ${this.config.namespace}
spec:
  selector:
    app: ${this.config.imageName}
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${this.config.imageName}
  namespace: ${this.config.namespace}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - ${this.config.domain}
    secretName: ${this.config.imageName}-tls
  rules:
  - host: ${this.config.domain}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${this.config.imageName}
            port:
              number: 80
    `.trim();
  }

  /**
   * Generate Dockerfile
   */
  generateDockerfile(): string {
    return `
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
    `.trim();
  }

  /**
   * Generate nginx config
   */
  generateNginxConfig(): string {
    return `
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
    `.trim();
  }
}

export { KubernetesDeployer, K8sConfig };
```

---

## Self-Hosted Deployment

### VPS Deployment Script

```bash
#!/bin/bash
# deploy.sh - Self-hosted deployment script

set -e

# Configuration
APP_NAME="my-app"
DEPLOY_USER="deploy"
DEPLOY_HOST="server.example.com"
DEPLOY_PATH="/var/www/$APP_NAME"
REPO_URL="git@github.com:user/repo.git"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Starting deployment...${NC}"

# SSH to server and deploy
ssh $DEPLOY_USER@$DEPLOY_HOST << 'ENDSSH'
set -e

cd /var/www/my-app

# Pull latest code
git fetch origin
git reset --hard origin/main

# Install dependencies
pnpm install --frozen-lockfile

# Build
pnpm build

# Restart service
sudo systemctl restart my-app

echo "Deployment complete!"
ENDSSH

echo -e "${GREEN}Deployment successful!${NC}"
```

### Systemd Service Configuration

```ini
# /etc/systemd/system/my-app.service

[Unit]
Description=My App
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/my-app
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=my-app
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/my-app

upstream my_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Static files
    location /assets/ {
        alias /var/www/my-app/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api/ {
        proxy_pass http://my_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SPA routing
    location / {
        root /var/www/my-app/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  build:
    runs-on: ubuntu-latest
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
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-preview:
    needs: build
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
          
      - name: Deploy to Preview
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: my-app
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/
          
      - name: Deploy to Production
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: my-app
          directory: dist
          branch: main
```

### GitLab CI Pipeline

```yaml
# .gitlab-ci.yml

stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "20"

.node_template: &node_template
  image: node:${NODE_VERSION}
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
      - .pnpm-store/
  before_script:
    - corepack enable
    - pnpm config set store-dir .pnpm-store
    - pnpm install --frozen-lockfile

build:
  <<: *node_template
  stage: build
  script:
    - pnpm build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

test:
  <<: *node_template
  stage: test
  script:
    - pnpm lint
    - pnpm test --coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'

deploy_preview:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache curl
    - |
      curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME/deployments" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -F "branch=$CI_COMMIT_REF_NAME"
  environment:
    name: preview/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.my-app.pages.dev
  only:
    - merge_requests

deploy_production:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache curl
    - |
      curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME/deployments" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -F "branch=main"
  environment:
    name: production
    url: https://my-app.com
  only:
    - main
  when: manual
```

---

## Rollback and Versioning

### Deployment Versioning

```typescript
// src/deployment/versioning.ts

interface DeploymentVersion {
  id: string;
  version: string;
  commitSha: string;
  createdAt: Date;
  status: 'active' | 'inactive' | 'rolled-back';
  url: string;
  metadata: {
    buildDuration: number;
    fileCount: number;
    totalSize: number;
  };
}

class DeploymentVersionManager {
  private versions: Map<string, DeploymentVersion[]> = new Map();

  /**
   * Record new deployment
   */
  recordDeployment(projectId: string, version: DeploymentVersion): void {
    const projectVersions = this.versions.get(projectId) || [];
    
    // Deactivate previous active version
    for (const v of projectVersions) {
      if (v.status === 'active') {
        v.status = 'inactive';
      }
    }
    
    projectVersions.unshift(version);
    
    // Keep only last 50 versions
    if (projectVersions.length > 50) {
      projectVersions.pop();
    }
    
    this.versions.set(projectId, projectVersions);
  }

  /**
   * Rollback to previous version
   */
  async rollback(projectId: string, targetVersionId?: string): Promise<DeploymentVersion> {
    const projectVersions = this.versions.get(projectId);
    
    if (!projectVersions || projectVersions.length < 2) {
      throw new Error('No previous version available for rollback');
    }
    
    let targetVersion: DeploymentVersion;
    
    if (targetVersionId) {
      targetVersion = projectVersions.find(v => v.id === targetVersionId)!;
      if (!targetVersion) {
        throw new Error(`Version ${targetVersionId} not found`);
      }
    } else {
      // Rollback to previous version
      targetVersion = projectVersions[1];
    }
    
    // Mark current as rolled-back
    projectVersions[0].status = 'rolled-back';
    
    // Activate target version
    targetVersion.status = 'active';
    
    // Perform actual rollback (update routing, etc.)
    await this.performRollback(projectId, targetVersion);
    
    return targetVersion;
  }

  /**
   * Perform actual rollback
   */
  private async performRollback(projectId: string, version: DeploymentVersion): Promise<void> {
    // Update CDN routing to point to previous version
    // Invalidate cache
    // Update DNS if needed
  }

  /**
   * Get deployment history
   */
  getHistory(projectId: string): DeploymentVersion[] {
    return this.versions.get(projectId) || [];
  }

  /**
   * Get active version
   */
  getActiveVersion(projectId: string): DeploymentVersion | null {
    const versions = this.versions.get(projectId);
    return versions?.find(v => v.status === 'active') || null;
  }
}

export { DeploymentVersionManager, DeploymentVersion };
```

---

## Best Practices

### Deployment Checklist

| Step | Description | Required |
|------|-------------|----------|
| **Build passes** | All tests and linting pass | ✅ |
| **Environment variables** | All required vars configured | ✅ |
| **SSL certificate** | Valid and not expiring soon | ✅ |
| **Health check** | Endpoint responds correctly | ✅ |
| **Rollback plan** | Previous version available | ✅ |
| **Monitoring** | Alerts configured | ⚠️ |
| **Documentation** | Deployment notes updated | ⚠️ |

### Platform Selection Guide

| Requirement | Recommended Platform |
|-------------|---------------------|
| **Simple static site** | Cloudflare Pages, Netlify |
| **Next.js app** | Vercel |
| **Full-stack with DB** | Railway, Fly.io |
| **Enterprise scale** | AWS, GCP, Azure |
| **Maximum control** | Self-hosted VPS |
| **Edge computing** | Cloudflare Workers, Deno Deploy |

### Security Best Practices

| Practice | Description |
|----------|-------------|
| **HTTPS only** | Redirect all HTTP to HTTPS |
| **Security headers** | CSP, X-Frame-Options, etc. |
| **Environment secrets** | Never commit to repo |
| **Access control** | Limit deployment permissions |
| **Audit logs** | Track all deployments |

---

## Summary

### Quick Reference

```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod

# Cloudflare Pages
wrangler pages deploy dist

# AWS S3
aws s3 sync dist/ s3://bucket-name --delete

# Docker
docker build -t app . && docker push app
```

### Deployment Targets Summary

| Target | Setup Time | Cost | Best For |
|--------|------------|------|----------|
| **Vercel** | 5 min | Free-$20/mo | Next.js, React |
| **Netlify** | 5 min | Free-$19/mo | JAMstack |
| **Cloudflare** | 10 min | Free | Static + Edge |
| **AWS** | 30 min | Pay-per-use | Enterprise |
| **Self-hosted** | 2+ hours | $5-50/mo | Full control |
