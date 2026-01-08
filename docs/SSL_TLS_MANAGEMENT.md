# SSL/TLS Management for Preview URLs

This guide provides comprehensive coverage of SSL/TLS management for dynamic preview URLs, including wildcard certificates, Let's Encrypt automation, certificate rotation, and security best practices.

---

## Table of Contents

1. [Overview](#overview)
2. [Certificate Strategy](#certificate-strategy)
3. [Wildcard Certificates](#wildcard-certificates)
4. [Let's Encrypt Automation](#lets-encrypt-automation)
5. [Certificate Rotation](#certificate-rotation)
6. [Envoy TLS Configuration](#envoy-tls-configuration)
7. [Certificate Monitoring](#certificate-monitoring)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

SSL/TLS for preview URLs presents unique challenges due to the dynamic nature of sandbox subdomains. The solution uses wildcard certificates to cover all possible subdomains without per-sandbox certificate issuance.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SSL/TLS ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BROWSER                                                                    │
│     │                                                                       │
│     │ TLS 1.3 (HTTPS)                                                      │
│     │ SNI: 3000-abc123.us2.manus.computer                                  │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ENVOY PROXY (TLS Termination)                     │   │
│  │                                                                       │   │
│  │  Wildcard Certificate: *.us2.manus.computer                          │   │
│  │  Covers: 3000-abc123.us2.manus.computer                              │   │
│  │          5173-xyz789.us2.manus.computer                              │   │
│  │          *.us2.manus.computer                                        │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     │                                                                       │
│     │ Plain HTTP (internal)                                                │
│     ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SANDBOX (Dev Server)                              │   │
│  │                    http://10.0.1.50:3000                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Certificate Strategy

### Why Wildcard Certificates?

| Approach | Pros | Cons |
|----------|------|------|
| **Per-sandbox certs** | Fine-grained control | Slow issuance, rate limits |
| **Wildcard certs** | Instant coverage, simple | Single point of failure |
| **Cloudflare proxy** | Automatic SSL | Vendor lock-in |

**Recommendation**: Use wildcard certificates with automated renewal.

### Certificate Requirements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CERTIFICATE REQUIREMENTS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Domain Coverage:                                                           │
│  ├── *.us2.manus.computer    (US East region)                              │
│  ├── *.eu1.manus.computer    (EU West region)                              │
│  └── *.ap1.manus.computer    (Asia Pacific region)                         │
│                                                                             │
│  Certificate Type: Wildcard (*.region.domain.tld)                          │
│  Validation: DNS-01 (required for wildcards)                               │
│  Key Type: ECDSA P-256 (recommended) or RSA 2048                           │
│  Validity: 90 days (Let's Encrypt)                                         │
│  Renewal: 30 days before expiry                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Wildcard Certificates

### Certificate Structure

```
Certificate:
    Subject: CN=*.us2.manus.computer
    Subject Alternative Names:
        DNS: *.us2.manus.computer
        DNS: us2.manus.computer (optional, for apex)
    Issuer: Let's Encrypt Authority X3
    Validity:
        Not Before: Jan 1 00:00:00 2024 GMT
        Not After:  Apr 1 00:00:00 2024 GMT
    Public Key: ECDSA P-256
```

### Multi-Region Certificate Setup

```typescript
// src/config/certificates.ts

interface CertificateConfig {
  domain: string;
  wildcard: string;
  keyType: 'ecdsa' | 'rsa';
  renewalDays: number;
}

const certificateConfigs: CertificateConfig[] = [
  {
    domain: 'us2.manus.computer',
    wildcard: '*.us2.manus.computer',
    keyType: 'ecdsa',
    renewalDays: 30,
  },
  {
    domain: 'eu1.manus.computer',
    wildcard: '*.eu1.manus.computer',
    keyType: 'ecdsa',
    renewalDays: 30,
  },
  {
    domain: 'ap1.manus.computer',
    wildcard: '*.ap1.manus.computer',
    keyType: 'ecdsa',
    renewalDays: 30,
  },
];
```

---

## Let's Encrypt Automation

### DNS-01 Challenge

Wildcard certificates require DNS-01 validation, which proves domain ownership by creating a TXT record.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DNS-01 CHALLENGE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Request certificate for *.us2.manus.computer                           │
│     │                                                                       │
│     ▼                                                                       │
│  2. Let's Encrypt returns challenge token                                   │
│     │                                                                       │
│     ▼                                                                       │
│  3. Create DNS TXT record:                                                  │
│     _acme-challenge.us2.manus.computer TXT "challenge-token"               │
│     │                                                                       │
│     ▼                                                                       │
│  4. Let's Encrypt verifies TXT record                                       │
│     │                                                                       │
│     ▼                                                                       │
│  5. Certificate issued                                                      │
│     │                                                                       │
│     ▼                                                                       │
│  6. Delete TXT record (cleanup)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Certbot with Cloudflare DNS

```bash
# Install certbot and Cloudflare plugin
apt-get install certbot python3-certbot-dns-cloudflare

# Create Cloudflare credentials file
cat > /etc/letsencrypt/cloudflare.ini << EOF
dns_cloudflare_api_token = your-cloudflare-api-token
EOF
chmod 600 /etc/letsencrypt/cloudflare.ini

# Request wildcard certificate
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d "*.us2.manus.computer" \
  -d "us2.manus.computer" \
  --preferred-challenges dns-01 \
  --key-type ecdsa \
  --elliptic-curve secp256r1 \
  --agree-tos \
  --email admin@manus.computer \
  --non-interactive
```

### Automated Certificate Manager

```typescript
// src/services/certificateManager.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface Certificate {
  domain: string;
  certPath: string;
  keyPath: string;
  expiresAt: Date;
  issuedAt: Date;
}

class CertificateManager {
  private certificates: Map<string, Certificate> = new Map();
  private renewalTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private cloudflareToken: string,
    private email: string
  ) {}
  
  async initialize(): Promise<void> {
    // Load existing certificates
    await this.loadCertificates();
    
    // Start renewal checker
    this.startRenewalChecker();
  }
  
  async requestCertificate(domain: string): Promise<Certificate> {
    const wildcard = `*.${domain}`;
    
    console.log(`Requesting certificate for ${wildcard}`);
    
    // Write Cloudflare credentials
    await fs.writeFile('/tmp/cloudflare.ini', 
      `dns_cloudflare_api_token = ${this.cloudflareToken}`,
      { mode: 0o600 }
    );
    
    // Request certificate
    const { stdout, stderr } = await execAsync(`
      certbot certonly \
        --dns-cloudflare \
        --dns-cloudflare-credentials /tmp/cloudflare.ini \
        --dns-cloudflare-propagation-seconds 60 \
        -d "${wildcard}" \
        -d "${domain}" \
        --preferred-challenges dns-01 \
        --key-type ecdsa \
        --agree-tos \
        --email ${this.email} \
        --non-interactive \
        --cert-name ${domain}
    `);
    
    console.log('Certbot output:', stdout);
    if (stderr) console.error('Certbot stderr:', stderr);
    
    // Clean up credentials
    await fs.unlink('/tmp/cloudflare.ini');
    
    // Load and return certificate info
    return this.loadCertificate(domain);
  }
  
  async renewCertificate(domain: string): Promise<Certificate> {
    console.log(`Renewing certificate for ${domain}`);
    
    await fs.writeFile('/tmp/cloudflare.ini',
      `dns_cloudflare_api_token = ${this.cloudflareToken}`,
      { mode: 0o600 }
    );
    
    await execAsync(`
      certbot renew \
        --cert-name ${domain} \
        --dns-cloudflare \
        --dns-cloudflare-credentials /tmp/cloudflare.ini \
        --non-interactive
    `);
    
    await fs.unlink('/tmp/cloudflare.ini');
    
    return this.loadCertificate(domain);
  }
  
  private async loadCertificate(domain: string): Promise<Certificate> {
    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
    
    // Parse certificate to get expiry
    const { stdout } = await execAsync(
      `openssl x509 -enddate -noout -in ${certPath}`
    );
    
    const expiryMatch = stdout.match(/notAfter=(.+)/);
    const expiresAt = expiryMatch 
      ? new Date(expiryMatch[1]) 
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    
    const cert: Certificate = {
      domain,
      certPath,
      keyPath,
      expiresAt,
      issuedAt: new Date(),
    };
    
    this.certificates.set(domain, cert);
    return cert;
  }
  
  private async loadCertificates(): Promise<void> {
    const certDirs = await fs.readdir('/etc/letsencrypt/live').catch(() => []);
    
    for (const domain of certDirs) {
      if (domain === 'README') continue;
      
      try {
        await this.loadCertificate(domain);
      } catch (error) {
        console.error(`Failed to load certificate for ${domain}:`, error);
      }
    }
  }
  
  private startRenewalChecker(): void {
    // Check every hour
    this.renewalTimer = setInterval(async () => {
      await this.checkRenewals();
    }, 60 * 60 * 1000);
    
    // Also check immediately
    this.checkRenewals();
  }
  
  private async checkRenewals(): Promise<void> {
    const renewalThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    for (const [domain, cert] of this.certificates) {
      const timeUntilExpiry = cert.expiresAt.getTime() - Date.now();
      
      if (timeUntilExpiry < renewalThreshold) {
        console.log(`Certificate for ${domain} expires in ${Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000))} days, renewing...`);
        
        try {
          await this.renewCertificate(domain);
          await this.notifyEnvoy(domain);
        } catch (error) {
          console.error(`Failed to renew certificate for ${domain}:`, error);
          // Alert operations team
          await this.sendAlert(domain, error);
        }
      }
    }
  }
  
  private async notifyEnvoy(domain: string): Promise<void> {
    // Trigger Envoy to reload certificates via SDS
    // Implementation depends on your Envoy setup
  }
  
  private async sendAlert(domain: string, error: Error): Promise<void> {
    // Send alert to operations team
    console.error(`ALERT: Certificate renewal failed for ${domain}`, error);
  }
  
  getCertificate(domain: string): Certificate | undefined {
    return this.certificates.get(domain);
  }
  
  getAllCertificates(): Certificate[] {
    return Array.from(this.certificates.values());
  }
}

export const certificateManager = new CertificateManager(
  process.env.CLOUDFLARE_API_TOKEN!,
  process.env.ACME_EMAIL!
);
```

---

## Certificate Rotation

### Zero-Downtime Rotation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ZERO-DOWNTIME CERTIFICATE ROTATION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Timeline:                                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  0        30        60        75    83    90                               │
│  │         │         │         │     │     │                               │
│  Issue     │      Renew     Alert  Crit  Expire                            │
│            │      Window                                                    │
│            │                                                                │
│         Normal                                                              │
│        Operation                                                            │
│                                                                             │
│  Rotation Steps:                                                            │
│  1. New certificate issued (day 60)                                        │
│  2. New cert deployed to Envoy via SDS                                     │
│  3. Envoy hot-reloads (no connection drop)                                 │
│  4. Old cert remains valid until expiry                                    │
│  5. Monitoring confirms new cert in use                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Envoy Secret Discovery Service (SDS)

```yaml
# envoy-sds.yaml
static_resources:
  listeners:
    - name: https_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_certificate_sds_secret_configs:
                  - name: wildcard_cert
                    sds_config:
                      resource_api_version: V3
                      api_config_source:
                        api_type: GRPC
                        transport_api_version: V3
                        grpc_services:
                          - envoy_grpc:
                              cluster_name: sds_cluster

  clusters:
    - name: sds_cluster
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: sds_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: sds-server
                      port_value: 8443
```

### SDS Server Implementation

```typescript
// src/services/sdsServer.ts

import { Server, ServerCredentials } from '@grpc/grpc-js';
import * as fs from 'fs/promises';

interface TlsCertificate {
  certificateChain: string;
  privateKey: string;
}

class SDSServer {
  private certificates: Map<string, TlsCertificate> = new Map();
  private subscribers: Set<any> = new Set();
  
  async loadCertificates(): Promise<void> {
    const domains = ['us2.manus.computer', 'eu1.manus.computer', 'ap1.manus.computer'];
    
    for (const domain of domains) {
      const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
      
      try {
        const cert = await fs.readFile(certPath, 'utf-8');
        const key = await fs.readFile(keyPath, 'utf-8');
        
        this.certificates.set(domain, {
          certificateChain: cert,
          privateKey: key,
        });
      } catch (error) {
        console.error(`Failed to load certificate for ${domain}:`, error);
      }
    }
  }
  
  async reloadCertificate(domain: string): Promise<void> {
    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
    
    const cert = await fs.readFile(certPath, 'utf-8');
    const key = await fs.readFile(keyPath, 'utf-8');
    
    this.certificates.set(domain, {
      certificateChain: cert,
      privateKey: key,
    });
    
    // Push update to all subscribers
    this.pushUpdate(domain);
  }
  
  private pushUpdate(domain: string): void {
    const cert = this.certificates.get(domain);
    if (!cert) return;
    
    const response = this.buildSecretResponse(domain, cert);
    
    for (const subscriber of this.subscribers) {
      subscriber.write(response);
    }
  }
  
  private buildSecretResponse(domain: string, cert: TlsCertificate): any {
    return {
      version_info: Date.now().toString(),
      resources: [{
        '@type': 'type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.Secret',
        name: `wildcard_cert_${domain}`,
        tls_certificate: {
          certificate_chain: {
            inline_string: cert.certificateChain,
          },
          private_key: {
            inline_string: cert.privateKey,
          },
        },
      }],
    };
  }
  
  handleStream(stream: any): void {
    this.subscribers.add(stream);
    
    // Send initial certificates
    for (const [domain, cert] of this.certificates) {
      stream.write(this.buildSecretResponse(domain, cert));
    }
    
    stream.on('end', () => {
      this.subscribers.delete(stream);
    });
  }
}

export const sdsServer = new SDSServer();
```

---

## Envoy TLS Configuration

### Full TLS Configuration

```yaml
# envoy-tls.yaml
static_resources:
  listeners:
    - name: https_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      listener_filters:
        - name: envoy.filters.listener.tls_inspector
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.filters.listener.tls_inspector.v3.TlsInspector
      filter_chains:
        # US2 region
        - filter_chain_match:
            server_names:
              - "*.us2.manus.computer"
          transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_params:
                  tls_minimum_protocol_version: TLSv1_2
                  tls_maximum_protocol_version: TLSv1_3
                  cipher_suites:
                    - ECDHE-ECDSA-AES128-GCM-SHA256
                    - ECDHE-RSA-AES128-GCM-SHA256
                    - ECDHE-ECDSA-AES256-GCM-SHA384
                    - ECDHE-RSA-AES256-GCM-SHA384
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/ssl/certs/us2.manus.computer/fullchain.pem
                    private_key:
                      filename: /etc/ssl/private/us2.manus.computer/privkey.pem
                alpn_protocols:
                  - h2
                  - http/1.1
          filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_https
                codec_type: AUTO
                upgrade_configs:
                  - upgrade_type: websocket
                route_config:
                  name: us2_routes
                  virtual_hosts:
                    - name: sandbox_routing
                      domains: ["*.us2.manus.computer"]
                      routes:
                        - match:
                            prefix: "/"
                          route:
                            cluster: sandbox_cluster
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
        
        # EU1 region (similar configuration)
        - filter_chain_match:
            server_names:
              - "*.eu1.manus.computer"
          # ... similar TLS config for EU1
        
        # AP1 region (similar configuration)
        - filter_chain_match:
            server_names:
              - "*.ap1.manus.computer"
          # ... similar TLS config for AP1
```

### TLS Security Settings

```yaml
# Recommended TLS settings
tls_params:
  # Minimum TLS 1.2
  tls_minimum_protocol_version: TLSv1_2
  tls_maximum_protocol_version: TLSv1_3
  
  # Strong cipher suites only
  cipher_suites:
    # TLS 1.3 ciphers (automatically selected)
    # TLS 1.2 ciphers
    - ECDHE-ECDSA-AES128-GCM-SHA256
    - ECDHE-RSA-AES128-GCM-SHA256
    - ECDHE-ECDSA-AES256-GCM-SHA384
    - ECDHE-RSA-AES256-GCM-SHA384
    - ECDHE-ECDSA-CHACHA20-POLY1305
    - ECDHE-RSA-CHACHA20-POLY1305
  
  # ECDH curves
  ecdh_curves:
    - X25519
    - P-256
    - P-384
```

---

## Certificate Monitoring

### Monitoring Dashboard

```typescript
// src/services/certificateMonitor.ts

interface CertificateStatus {
  domain: string;
  expiresAt: Date;
  daysUntilExpiry: number;
  status: 'healthy' | 'warning' | 'critical' | 'expired';
  lastChecked: Date;
}

class CertificateMonitor {
  private status: Map<string, CertificateStatus> = new Map();
  
  async checkCertificate(domain: string): Promise<CertificateStatus> {
    const cert = certificateManager.getCertificate(domain);
    
    if (!cert) {
      return {
        domain,
        expiresAt: new Date(0),
        daysUntilExpiry: -1,
        status: 'expired',
        lastChecked: new Date(),
      };
    }
    
    const daysUntilExpiry = Math.floor(
      (cert.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    
    let status: CertificateStatus['status'];
    if (daysUntilExpiry <= 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= 7) {
      status = 'critical';
    } else if (daysUntilExpiry <= 30) {
      status = 'warning';
    } else {
      status = 'healthy';
    }
    
    const certStatus: CertificateStatus = {
      domain,
      expiresAt: cert.expiresAt,
      daysUntilExpiry,
      status,
      lastChecked: new Date(),
    };
    
    this.status.set(domain, certStatus);
    
    // Send alerts if needed
    if (status === 'critical' || status === 'expired') {
      await this.sendAlert(certStatus);
    }
    
    return certStatus;
  }
  
  async checkAllCertificates(): Promise<CertificateStatus[]> {
    const domains = ['us2.manus.computer', 'eu1.manus.computer', 'ap1.manus.computer'];
    const results: CertificateStatus[] = [];
    
    for (const domain of domains) {
      const status = await this.checkCertificate(domain);
      results.push(status);
    }
    
    return results;
  }
  
  private async sendAlert(status: CertificateStatus): Promise<void> {
    console.error(`CERTIFICATE ALERT: ${status.domain} - ${status.status}`);
    console.error(`Days until expiry: ${status.daysUntilExpiry}`);
    
    // Send to alerting system (PagerDuty, Slack, etc.)
  }
  
  getMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    for (const [domain, status] of this.status) {
      metrics[`cert_days_until_expiry{domain="${domain}"}`] = status.daysUntilExpiry;
      metrics[`cert_status{domain="${domain}",status="${status.status}"}`] = 1;
    }
    
    return metrics;
  }
}

export const certificateMonitor = new CertificateMonitor();
```

### Prometheus Metrics

```typescript
// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = certificateMonitor.getMetrics();
  
  let output = '';
  for (const [name, value] of Object.entries(metrics)) {
    output += `${name} ${value}\n`;
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(output);
});

// Example output:
// cert_days_until_expiry{domain="us2.manus.computer"} 45
// cert_days_until_expiry{domain="eu1.manus.computer"} 45
// cert_days_until_expiry{domain="ap1.manus.computer"} 45
// cert_status{domain="us2.manus.computer",status="healthy"} 1
```

### Alert Rules

```yaml
# prometheus-alerts.yaml
groups:
  - name: certificate_alerts
    rules:
      - alert: CertificateExpiringSoon
        expr: cert_days_until_expiry < 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Certificate expiring soon"
          description: "Certificate for {{ $labels.domain }} expires in {{ $value }} days"
      
      - alert: CertificateCritical
        expr: cert_days_until_expiry < 7
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Certificate critically close to expiry"
          description: "Certificate for {{ $labels.domain }} expires in {{ $value }} days"
      
      - alert: CertificateExpired
        expr: cert_days_until_expiry <= 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Certificate expired"
          description: "Certificate for {{ $labels.domain }} has expired"
```

---

## Security Best Practices

### 1. Use Strong Key Types

```bash
# Prefer ECDSA P-256 over RSA
certbot certonly \
  --key-type ecdsa \
  --elliptic-curve secp256r1 \
  ...
```

### 2. Enable HSTS

```yaml
# Envoy response headers
response_headers_to_add:
  - header:
      key: Strict-Transport-Security
      value: "max-age=31536000; includeSubDomains; preload"
```

### 3. Disable Weak Protocols

```yaml
tls_params:
  tls_minimum_protocol_version: TLSv1_2
  # TLS 1.0 and 1.1 are disabled
```

### 4. Use Strong Cipher Suites

```yaml
cipher_suites:
  # Only AEAD ciphers
  - ECDHE-ECDSA-AES128-GCM-SHA256
  - ECDHE-RSA-AES128-GCM-SHA256
  - ECDHE-ECDSA-AES256-GCM-SHA384
  - ECDHE-RSA-AES256-GCM-SHA384
  - ECDHE-ECDSA-CHACHA20-POLY1305
  - ECDHE-RSA-CHACHA20-POLY1305
```

### 5. Protect Private Keys

```bash
# Restrict key file permissions
chmod 600 /etc/letsencrypt/live/*/privkey.pem
chown root:root /etc/letsencrypt/live/*/privkey.pem
```

### 6. Enable OCSP Stapling

```yaml
# Envoy OCSP stapling
common_tls_context:
  tls_certificates:
    - certificate_chain:
        filename: /etc/ssl/certs/fullchain.pem
      private_key:
        filename: /etc/ssl/private/privkey.pem
      ocsp_staple:
        filename: /etc/ssl/certs/ocsp.der
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Certificate not trusted | Missing intermediate | Use fullchain.pem |
| SNI mismatch | Wrong cert for domain | Check filter_chain_match |
| Renewal failed | DNS propagation | Increase propagation delay |
| Envoy not reloading | SDS not configured | Enable SDS or hot restart |

### Debugging Commands

```bash
# Check certificate details
openssl x509 -in /etc/letsencrypt/live/domain/fullchain.pem -text -noout

# Test TLS connection
openssl s_client -connect 3000-abc123.us2.manus.computer:443 -servername 3000-abc123.us2.manus.computer

# Check certificate chain
openssl s_client -connect domain:443 -showcerts

# Verify certificate matches key
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
```

---

## Summary

| Component | Implementation | Purpose |
|-----------|---------------|---------|
| **Certificate Type** | Wildcard | Cover all subdomains |
| **Validation** | DNS-01 | Required for wildcards |
| **Automation** | Certbot + Cloudflare | Hands-free renewal |
| **Rotation** | SDS | Zero-downtime updates |
| **Monitoring** | Prometheus | Expiry alerts |
| **Security** | TLS 1.2+, ECDSA | Strong encryption |

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Days until expiry | >30 | <30 warning, <7 critical |
| Renewal success rate | 100% | <100% alert |
| TLS handshake time | <50ms | >100ms investigate |
