# Audit Logging for Compliance

This guide covers comprehensive audit logging implementation for compliance requirements, including what events are logged, log retention policies, access controls, and integration with compliance frameworks like ISO 27001, SOC 2, and FINMA.

---

## Table of Contents

1. [Audit Logging Architecture](#audit-logging-architecture)
2. [Events Logged](#events-logged)
3. [Log Format and Structure](#log-format-and-structure)
4. [Log Retention Policies](#log-retention-policies)
5. [Access to Logs](#access-to-logs)
6. [Compliance Integration](#compliance-integration)
7. [Implementation Guide](#implementation-guide)

---

## Audit Logging Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT LOGGING ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  EVENT SOURCES                                                                  │   │
│  │  ├── API Gateway (authentication, authorization)                                │   │
│  │  ├── Sandbox Controller (lifecycle events)                                      │   │
│  │  ├── File System (read, write, delete)                                          │   │
│  │  ├── Database (queries, modifications)                                          │   │
│  │  ├── Key Management (key operations)                                            │   │
│  │  └── Admin Console (configuration changes)                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                          │
│                              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  AUDIT LOG COLLECTOR                                                            │   │
│  │  ├── Event normalization                                                        │   │
│  │  ├── Enrichment (user context, geo, device)                                     │   │
│  │  ├── Validation and schema enforcement                                          │   │
│  │  └── Cryptographic signing                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                          │
│                              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  IMMUTABLE LOG STORAGE                                                          │   │
│  │  ├── Write-once storage (S3 Object Lock / WORM)                                 │   │
│  │  ├── Cryptographic chain (hash linking)                                         │   │
│  │  ├── Tamper detection                                                           │   │
│  │  └── Geographic redundancy                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                          │
│                              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LOG ANALYSIS & ALERTING                                                        │   │
│  │  ├── Real-time anomaly detection                                                │   │
│  │  ├── Compliance dashboards                                                      │   │
│  │  ├── SIEM integration                                                           │   │
│  │  └── Automated compliance reporting                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Event Collector** | Aggregate events from all sources | Kafka / Kinesis |
| **Log Processor** | Normalize, enrich, sign events | Stream processor |
| **Immutable Storage** | Tamper-proof log storage | S3 Object Lock |
| **Search & Analytics** | Query and analyze logs | Elasticsearch / OpenSearch |
| **SIEM Integration** | Security monitoring | Splunk / Sentinel |

---

## Events Logged

### Event Categories

```typescript
// server/audit/eventCategories.ts

enum AuditEventCategory {
  // Authentication & Authorization
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SESSION = 'session',
  
  // Resource Access
  DATA_ACCESS = 'data_access',
  FILE_OPERATION = 'file_operation',
  DATABASE_OPERATION = 'database_operation',
  
  // Sandbox Lifecycle
  SANDBOX_LIFECYCLE = 'sandbox_lifecycle',
  RESOURCE_ALLOCATION = 'resource_allocation',
  
  // Security
  SECURITY_EVENT = 'security_event',
  KEY_MANAGEMENT = 'key_management',
  ENCRYPTION = 'encryption',
  
  // Administration
  CONFIGURATION_CHANGE = 'configuration_change',
  USER_MANAGEMENT = 'user_management',
  POLICY_CHANGE = 'policy_change',
  
  // Compliance
  COMPLIANCE_EVENT = 'compliance_event',
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
}
```

### Detailed Event Types

```typescript
// server/audit/eventTypes.ts

interface AuditEventTypes {
  // Authentication Events
  authentication: {
    'auth.login.success': { userId: string; method: string; mfaUsed: boolean };
    'auth.login.failure': { userId: string; reason: string; attempts: number };
    'auth.logout': { userId: string; sessionDuration: number };
    'auth.mfa.enabled': { userId: string; method: string };
    'auth.mfa.disabled': { userId: string; reason: string };
    'auth.password.changed': { userId: string };
    'auth.password.reset': { userId: string; requestedBy: string };
    'auth.token.issued': { userId: string; tokenType: string; expiresIn: number };
    'auth.token.revoked': { userId: string; tokenId: string; reason: string };
  };

  // Authorization Events
  authorization: {
    'authz.access.granted': { userId: string; resource: string; action: string };
    'authz.access.denied': { userId: string; resource: string; action: string; reason: string };
    'authz.role.assigned': { userId: string; role: string; assignedBy: string };
    'authz.role.revoked': { userId: string; role: string; revokedBy: string };
    'authz.permission.changed': { userId: string; permission: string; action: 'grant' | 'revoke' };
  };

  // Data Access Events
  data_access: {
    'data.read': { userId: string; resource: string; dataType: string; recordCount: number };
    'data.write': { userId: string; resource: string; dataType: string; operation: string };
    'data.delete': { userId: string; resource: string; dataType: string; recordCount: number };
    'data.export': { userId: string; resource: string; format: string; recordCount: number };
    'data.bulk_operation': { userId: string; operation: string; recordCount: number };
  };

  // File Operation Events
  file_operation: {
    'file.created': { userId: string; path: string; size: number; encrypted: boolean };
    'file.read': { userId: string; path: string; size: number };
    'file.modified': { userId: string; path: string; oldSize: number; newSize: number };
    'file.deleted': { userId: string; path: string };
    'file.moved': { userId: string; oldPath: string; newPath: string };
    'file.permission_changed': { userId: string; path: string; oldPermissions: string; newPermissions: string };
  };

  // Sandbox Lifecycle Events
  sandbox_lifecycle: {
    'sandbox.created': { sandboxId: string; userId: string; template: string; resources: object };
    'sandbox.started': { sandboxId: string; userId: string; startTime: number };
    'sandbox.stopped': { sandboxId: string; userId: string; reason: string };
    'sandbox.hibernated': { sandboxId: string; userId: string };
    'sandbox.resumed': { sandboxId: string; userId: string; hibernationDuration: number };
    'sandbox.deleted': { sandboxId: string; userId: string; dataRetained: boolean };
    'sandbox.resource_scaled': { sandboxId: string; resource: string; oldValue: number; newValue: number };
  };

  // Security Events
  security_event: {
    'security.threat_detected': { type: string; severity: string; source: string; details: object };
    'security.anomaly_detected': { type: string; userId: string; details: object };
    'security.rate_limit_exceeded': { userId: string; endpoint: string; limit: number };
    'security.ip_blocked': { ip: string; reason: string; duration: number };
    'security.suspicious_activity': { userId: string; activity: string; riskScore: number };
  };

  // Key Management Events
  key_management: {
    'key.created': { keyId: string; keyType: string; purpose: string; createdBy: string };
    'key.rotated': { keyId: string; oldKeyId: string; rotatedBy: string };
    'key.deleted': { keyId: string; deletedBy: string; reason: string };
    'key.accessed': { keyId: string; accessedBy: string; operation: string };
    'key.exported': { keyId: string; exportedBy: string; format: string };
  };

  // Configuration Events
  configuration_change: {
    'config.updated': { component: string; setting: string; oldValue: any; newValue: any; updatedBy: string };
    'config.policy_changed': { policyId: string; changes: object; changedBy: string };
    'config.feature_toggled': { feature: string; enabled: boolean; toggledBy: string };
  };

  // Compliance Events
  compliance_event: {
    'compliance.dsar_received': { requestId: string; userId: string; type: string };
    'compliance.dsar_completed': { requestId: string; userId: string; dataExported: boolean };
    'compliance.data_retention_applied': { dataType: string; recordsDeleted: number };
    'compliance.consent_updated': { userId: string; consentType: string; granted: boolean };
  };
}
```

### Event Severity Levels

| Level | Description | Examples | Retention |
|-------|-------------|----------|-----------|
| **CRITICAL** | Security breach, data loss | Unauthorized access, data exfiltration | 10 years |
| **HIGH** | Security threat, policy violation | Failed auth attempts, rate limiting | 7 years |
| **MEDIUM** | Significant operations | Config changes, key operations | 5 years |
| **LOW** | Normal operations | File access, sandbox lifecycle | 3 years |
| **INFO** | Informational | Successful logins, routine operations | 1 year |

---

## Log Format and Structure

### Audit Log Schema

```typescript
// server/audit/schema.ts

interface AuditLogEntry {
  // Unique identifier
  id: string;                    // UUID v4
  
  // Timestamp
  timestamp: string;             // ISO 8601 with microseconds
  timestampUnix: number;         // Unix timestamp in milliseconds
  
  // Event identification
  eventType: string;             // e.g., 'auth.login.success'
  eventCategory: AuditEventCategory;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  
  // Actor information
  actor: {
    id: string;                  // User ID or service account
    type: 'user' | 'service' | 'system';
    name: string;
    email?: string;
    roles: string[];
  };
  
  // Source information
  source: {
    ip: string;
    userAgent?: string;
    geoLocation?: {
      country: string;
      region: string;
      city: string;
    };
    device?: {
      type: string;
      os: string;
      browser?: string;
    };
  };
  
  // Resource information
  resource: {
    type: string;                // e.g., 'sandbox', 'file', 'database'
    id: string;
    name?: string;
    path?: string;
  };
  
  // Action details
  action: {
    type: string;                // e.g., 'create', 'read', 'update', 'delete'
    status: 'success' | 'failure' | 'pending';
    statusCode?: number;
    errorMessage?: string;
  };
  
  // Event-specific data
  data: Record<string, any>;
  
  // Request context
  request: {
    id: string;                  // Correlation ID
    method?: string;
    path?: string;
    queryParams?: Record<string, string>;
  };
  
  // Compliance metadata
  compliance: {
    frameworks: string[];        // e.g., ['ISO27001', 'SOC2', 'FINMA']
    dataClassification: string;  // e.g., 'confidential', 'internal', 'public'
    retentionPolicy: string;
  };
  
  // Integrity
  integrity: {
    hash: string;                // SHA-256 of event content
    previousHash: string;        // Hash of previous event (chain)
    signature: string;           // Digital signature
  };
}
```

### Log Entry Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:45.123456Z",
  "timestampUnix": 1705315845123,
  "eventType": "sandbox.created",
  "eventCategory": "sandbox_lifecycle",
  "severity": "low",
  "actor": {
    "id": "user-123",
    "type": "user",
    "name": "John Doe",
    "email": "john@example.com",
    "roles": ["developer"]
  },
  "source": {
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "geoLocation": {
      "country": "CH",
      "region": "Zurich",
      "city": "Zurich"
    }
  },
  "resource": {
    "type": "sandbox",
    "id": "sandbox-456",
    "name": "my-project"
  },
  "action": {
    "type": "create",
    "status": "success"
  },
  "data": {
    "template": "vite-react",
    "resources": {
      "cpu": "2",
      "memory": "4Gi",
      "storage": "10Gi"
    }
  },
  "request": {
    "id": "req-789",
    "method": "POST",
    "path": "/api/sandboxes"
  },
  "compliance": {
    "frameworks": ["ISO27001", "SOC2"],
    "dataClassification": "internal",
    "retentionPolicy": "3-years"
  },
  "integrity": {
    "hash": "sha256:abc123...",
    "previousHash": "sha256:def456...",
    "signature": "sig:xyz789..."
  }
}
```

### Audit Logger Implementation

```typescript
// server/audit/logger.ts

import { createHash, createSign } from 'crypto';
import { Kafka } from 'kafkajs';

interface AuditLoggerConfig {
  kafka: {
    brokers: string[];
    topic: string;
  };
  signing: {
    privateKey: string;
    algorithm: string;
  };
  enrichment: {
    geoip: boolean;
    deviceDetection: boolean;
  };
}

class AuditLogger {
  private kafka: Kafka;
  private producer: Producer;
  private config: AuditLoggerConfig;
  private previousHash: string = '';

  constructor(config: AuditLoggerConfig) {
    this.config = config;
    this.kafka = new Kafka({
      brokers: config.kafka.brokers,
      ssl: true,
      sasl: {
        mechanism: 'scram-sha-512',
        username: process.env.KAFKA_USERNAME!,
        password: process.env.KAFKA_PASSWORD!,
      },
    });
  }

  /**
   * Log audit event
   */
  async log(event: Omit<AuditLogEntry, 'id' | 'timestamp' | 'integrity'>): Promise<void> {
    // Generate ID and timestamp
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const timestampUnix = Date.now();

    // Enrich event
    const enrichedEvent = await this.enrichEvent(event);

    // Calculate integrity
    const eventContent = JSON.stringify({
      ...enrichedEvent,
      id,
      timestamp,
      timestampUnix,
    });
    
    const hash = this.calculateHash(eventContent);
    const signature = this.sign(eventContent);

    const auditEntry: AuditLogEntry = {
      ...enrichedEvent,
      id,
      timestamp,
      timestampUnix,
      integrity: {
        hash,
        previousHash: this.previousHash,
        signature,
      },
    };

    // Update previous hash for chain
    this.previousHash = hash;

    // Send to Kafka
    await this.producer.send({
      topic: this.config.kafka.topic,
      messages: [
        {
          key: auditEntry.id,
          value: JSON.stringify(auditEntry),
          headers: {
            eventType: auditEntry.eventType,
            severity: auditEntry.severity,
          },
        },
      ],
    });
  }

  /**
   * Enrich event with additional context
   */
  private async enrichEvent(
    event: Omit<AuditLogEntry, 'id' | 'timestamp' | 'integrity'>
  ): Promise<typeof event> {
    const enriched = { ...event };

    // GeoIP enrichment
    if (this.config.enrichment.geoip && event.source?.ip) {
      enriched.source.geoLocation = await this.lookupGeoIP(event.source.ip);
    }

    // Device detection
    if (this.config.enrichment.deviceDetection && event.source?.userAgent) {
      enriched.source.device = this.parseUserAgent(event.source.userAgent);
    }

    return enriched;
  }

  /**
   * Calculate SHA-256 hash
   */
  private calculateHash(content: string): string {
    return `sha256:${createHash('sha256').update(content).digest('hex')}`;
  }

  /**
   * Sign event content
   */
  private sign(content: string): string {
    const sign = createSign(this.config.signing.algorithm);
    sign.update(content);
    return `sig:${sign.sign(this.config.signing.privateKey, 'base64')}`;
  }
}

// Singleton instance
export const auditLogger = new AuditLogger({
  kafka: {
    brokers: process.env.KAFKA_BROKERS!.split(','),
    topic: 'audit-logs',
  },
  signing: {
    privateKey: process.env.AUDIT_SIGNING_KEY!,
    algorithm: 'RSA-SHA256',
  },
  enrichment: {
    geoip: true,
    deviceDetection: true,
  },
});
```

### Middleware for Automatic Logging

```typescript
// server/audit/middleware.ts

import { auditLogger } from './logger';

/**
 * Express middleware for automatic audit logging
 */
function auditMiddleware(options: AuditMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();

    // Capture original end function
    const originalEnd = res.end;
    let responseBody: any;

    // Override end to capture response
    res.end = function(chunk: any, ...args: any[]) {
      responseBody = chunk;
      return originalEnd.apply(res, [chunk, ...args]);
    };

    // Log after response
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      // Determine if this request should be logged
      if (!shouldLog(req, res, options)) {
        return;
      }

      await auditLogger.log({
        eventType: determineEventType(req, res),
        eventCategory: determineCategory(req),
        severity: determineSeverity(res.statusCode),
        actor: {
          id: req.user?.id || 'anonymous',
          type: req.user ? 'user' : 'anonymous',
          name: req.user?.name || 'Anonymous',
          roles: req.user?.roles || [],
        },
        source: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
        resource: {
          type: determineResourceType(req),
          id: req.params.id || 'unknown',
          path: req.path,
        },
        action: {
          type: methodToAction(req.method),
          status: res.statusCode < 400 ? 'success' : 'failure',
          statusCode: res.statusCode,
          errorMessage: res.statusCode >= 400 ? extractError(responseBody) : undefined,
        },
        data: {
          method: req.method,
          path: req.path,
          queryParams: req.query,
          duration,
          responseSize: res.get('content-length'),
        },
        request: {
          id: requestId,
          method: req.method,
          path: req.path,
        },
        compliance: {
          frameworks: options.complianceFrameworks || [],
          dataClassification: determineClassification(req),
          retentionPolicy: determineRetention(req),
        },
      });
    });

    next();
  };
}
```

---

## Log Retention Policies

### Retention Configuration

```typescript
// server/audit/retention.ts

interface RetentionPolicy {
  name: string;
  eventCategories: AuditEventCategory[];
  severities: string[];
  retentionDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number;
  complianceFrameworks: string[];
}

const retentionPolicies: RetentionPolicy[] = [
  // Critical security events - 10 years
  {
    name: 'critical-security',
    eventCategories: ['security_event', 'key_management'],
    severities: ['critical', 'high'],
    retentionDays: 3650, // 10 years
    archiveAfterDays: 365,
    deleteAfterDays: 3650,
    complianceFrameworks: ['ISO27001', 'SOC2', 'FINMA'],
  },
  
  // Authentication events - 7 years
  {
    name: 'authentication',
    eventCategories: ['authentication', 'authorization'],
    severities: ['critical', 'high', 'medium', 'low'],
    retentionDays: 2555, // 7 years
    archiveAfterDays: 180,
    deleteAfterDays: 2555,
    complianceFrameworks: ['ISO27001', 'SOC2'],
  },
  
  // Data access events - 5 years
  {
    name: 'data-access',
    eventCategories: ['data_access', 'file_operation', 'database_operation'],
    severities: ['critical', 'high', 'medium'],
    retentionDays: 1825, // 5 years
    archiveAfterDays: 90,
    deleteAfterDays: 1825,
    complianceFrameworks: ['ISO27001', 'SOC2', 'FINMA'],
  },
  
  // Operational events - 3 years
  {
    name: 'operational',
    eventCategories: ['sandbox_lifecycle', 'resource_allocation'],
    severities: ['medium', 'low', 'info'],
    retentionDays: 1095, // 3 years
    archiveAfterDays: 30,
    deleteAfterDays: 1095,
    complianceFrameworks: ['ISO27001'],
  },
  
  // Configuration changes - 7 years
  {
    name: 'configuration',
    eventCategories: ['configuration_change', 'policy_change'],
    severities: ['critical', 'high', 'medium'],
    retentionDays: 2555, // 7 years
    archiveAfterDays: 90,
    deleteAfterDays: 2555,
    complianceFrameworks: ['ISO27001', 'SOC2', 'FINMA'],
  },
];
```

### Retention Manager

```typescript
// server/audit/retentionManager.ts

class RetentionManager {
  private s3Client: S3Client;
  private opensearchClient: OpenSearchClient;

  /**
   * Apply retention policies
   */
  async applyRetentionPolicies(): Promise<RetentionReport> {
    const report: RetentionReport = {
      archived: 0,
      deleted: 0,
      errors: [],
    };

    for (const policy of retentionPolicies) {
      try {
        // Archive old logs
        const archiveResult = await this.archiveLogs(policy);
        report.archived += archiveResult.count;

        // Delete expired logs
        const deleteResult = await this.deleteLogs(policy);
        report.deleted += deleteResult.count;

        // Log retention action
        await auditLogger.log({
          eventType: 'compliance.data_retention_applied',
          eventCategory: 'compliance_event',
          severity: 'info',
          actor: { id: 'system', type: 'system', name: 'Retention Manager', roles: [] },
          source: { ip: '127.0.0.1' },
          resource: { type: 'audit_logs', id: policy.name },
          action: { type: 'retention', status: 'success' },
          data: {
            policy: policy.name,
            archived: archiveResult.count,
            deleted: deleteResult.count,
          },
          request: { id: crypto.randomUUID() },
          compliance: {
            frameworks: policy.complianceFrameworks,
            dataClassification: 'internal',
            retentionPolicy: policy.name,
          },
        });
      } catch (error) {
        report.errors.push({
          policy: policy.name,
          error: error.message,
        });
      }
    }

    return report;
  }

  /**
   * Archive logs to cold storage
   */
  private async archiveLogs(policy: RetentionPolicy): Promise<{ count: number }> {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - policy.archiveAfterDays);

    // Query logs to archive
    const logsToArchive = await this.opensearchClient.search({
      index: 'audit-logs',
      body: {
        query: {
          bool: {
            must: [
              { terms: { eventCategory: policy.eventCategories } },
              { range: { timestamp: { lt: archiveDate.toISOString() } } },
              { term: { archived: false } },
            ],
          },
        },
      },
    });

    // Archive to S3 Glacier
    for (const log of logsToArchive.hits.hits) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: 'audit-logs-archive',
          Key: `${policy.name}/${log._source.timestamp.slice(0, 7)}/${log._id}.json`,
          Body: JSON.stringify(log._source),
          StorageClass: 'GLACIER',
        })
      );

      // Mark as archived in OpenSearch
      await this.opensearchClient.update({
        index: 'audit-logs',
        id: log._id,
        body: { doc: { archived: true, archivedAt: new Date().toISOString() } },
      });
    }

    return { count: logsToArchive.hits.total.value };
  }

  /**
   * Delete expired logs
   */
  private async deleteLogs(policy: RetentionPolicy): Promise<{ count: number }> {
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - policy.deleteAfterDays);

    // Delete from OpenSearch
    const deleteResult = await this.opensearchClient.deleteByQuery({
      index: 'audit-logs',
      body: {
        query: {
          bool: {
            must: [
              { terms: { eventCategory: policy.eventCategories } },
              { range: { timestamp: { lt: deleteDate.toISOString() } } },
            ],
          },
        },
      },
    });

    return { count: deleteResult.deleted };
  }
}
```

### S3 Lifecycle Configuration

```json
{
  "Rules": [
    {
      "ID": "audit-logs-lifecycle",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "audit-logs/"
      },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 2555,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 3650
      },
      "NoncurrentVersionTransitions": [
        {
          "NoncurrentDays": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 365
      }
    }
  ]
}
```

---

## Access to Logs

### Access Control Model

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT LOG ACCESS CONTROL                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ROLE-BASED ACCESS                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SECURITY_ADMIN                                                                 │   │
│  │  ├── Full access to all audit logs                                              │   │
│  │  ├── Can export logs                                                            │   │
│  │  ├── Can configure retention policies                                           │   │
│  │  └── Can grant access to others                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  COMPLIANCE_OFFICER                                                             │   │
│  │  ├── Read access to compliance-related logs                                     │   │
│  │  ├── Can generate compliance reports                                            │   │
│  │  ├── Can view retention policies                                                │   │
│  │  └── Cannot modify or delete logs                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  AUDITOR (External)                                                             │   │
│  │  ├── Read-only access to specified log categories                               │   │
│  │  ├── Time-limited access                                                        │   │
│  │  ├── Can export for audit purposes                                              │   │
│  │  └── All access is logged                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  DEVELOPER                                                                      │   │
│  │  ├── Access to own activity logs only                                           │   │
│  │  ├── Access to sandbox logs for owned sandboxes                                 │   │
│  │  └── Cannot access other users' logs                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Access Control Implementation

```typescript
// server/audit/accessControl.ts

interface AuditLogPermission {
  role: string;
  categories: AuditEventCategory[];
  actions: ('read' | 'export' | 'configure')[];
  filters: {
    ownDataOnly?: boolean;
    timeRange?: { maxDays: number };
    severities?: string[];
  };
}

const auditLogPermissions: AuditLogPermission[] = [
  {
    role: 'security_admin',
    categories: Object.values(AuditEventCategory),
    actions: ['read', 'export', 'configure'],
    filters: {},
  },
  {
    role: 'compliance_officer',
    categories: [
      'authentication',
      'authorization',
      'data_access',
      'compliance_event',
      'key_management',
    ],
    actions: ['read', 'export'],
    filters: {},
  },
  {
    role: 'auditor',
    categories: [
      'authentication',
      'authorization',
      'data_access',
      'configuration_change',
    ],
    actions: ['read', 'export'],
    filters: {
      timeRange: { maxDays: 365 },
    },
  },
  {
    role: 'developer',
    categories: ['sandbox_lifecycle', 'file_operation'],
    actions: ['read'],
    filters: {
      ownDataOnly: true,
    },
  },
];

class AuditLogAccessControl {
  /**
   * Check if user can access logs
   */
  canAccess(
    user: User,
    category: AuditEventCategory,
    action: 'read' | 'export' | 'configure'
  ): boolean {
    const permission = this.getPermission(user.role);
    
    if (!permission) return false;
    if (!permission.categories.includes(category)) return false;
    if (!permission.actions.includes(action)) return false;
    
    return true;
  }

  /**
   * Apply access filters to query
   */
  applyFilters(user: User, query: AuditLogQuery): AuditLogQuery {
    const permission = this.getPermission(user.role);
    
    if (!permission) {
      throw new Error('Access denied');
    }

    const filteredQuery = { ...query };

    // Filter to own data only
    if (permission.filters.ownDataOnly) {
      filteredQuery.actorId = user.id;
    }

    // Apply time range limit
    if (permission.filters.timeRange) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() - permission.filters.timeRange.maxDays);
      
      if (!filteredQuery.startDate || filteredQuery.startDate < maxDate) {
        filteredQuery.startDate = maxDate;
      }
    }

    // Filter categories
    if (query.categories) {
      filteredQuery.categories = query.categories.filter(c =>
        permission.categories.includes(c)
      );
    } else {
      filteredQuery.categories = permission.categories;
    }

    return filteredQuery;
  }
}
```

### Audit Log Query API

```typescript
// server/audit/api.ts

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';

export const auditRouter = router({
  /**
   * Query audit logs
   */
  query: protectedProcedure
    .input(z.object({
      categories: z.array(z.nativeEnum(AuditEventCategory)).optional(),
      severities: z.array(z.string()).optional(),
      actorId: z.string().optional(),
      resourceType: z.string().optional(),
      resourceId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      searchText: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Check access
      const accessControl = new AuditLogAccessControl();
      
      // Apply access filters
      const filteredInput = accessControl.applyFilters(ctx.user, input);
      
      // Log the access
      await auditLogger.log({
        eventType: 'data.read',
        eventCategory: 'data_access',
        severity: 'info',
        actor: {
          id: ctx.user.id,
          type: 'user',
          name: ctx.user.name,
          roles: ctx.user.roles,
        },
        source: { ip: ctx.ip },
        resource: { type: 'audit_logs', id: 'query' },
        action: { type: 'read', status: 'success' },
        data: { query: filteredInput },
        request: { id: ctx.requestId },
        compliance: {
          frameworks: ['ISO27001', 'SOC2'],
          dataClassification: 'confidential',
          retentionPolicy: 'audit-access',
        },
      });

      // Execute query
      return await auditLogService.query(filteredInput);
    }),

  /**
   * Export audit logs
   */
  export: protectedProcedure
    .input(z.object({
      categories: z.array(z.nativeEnum(AuditEventCategory)),
      startDate: z.date(),
      endDate: z.date(),
      format: z.enum(['json', 'csv', 'pdf']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check export permission
      const accessControl = new AuditLogAccessControl();
      
      for (const category of input.categories) {
        if (!accessControl.canAccess(ctx.user, category, 'export')) {
          throw new Error(`Export not allowed for category: ${category}`);
        }
      }

      // Log the export
      await auditLogger.log({
        eventType: 'data.export',
        eventCategory: 'data_access',
        severity: 'medium',
        actor: {
          id: ctx.user.id,
          type: 'user',
          name: ctx.user.name,
          roles: ctx.user.roles,
        },
        source: { ip: ctx.ip },
        resource: { type: 'audit_logs', id: 'export' },
        action: { type: 'export', status: 'success' },
        data: {
          categories: input.categories,
          dateRange: { start: input.startDate, end: input.endDate },
          format: input.format,
        },
        request: { id: ctx.requestId },
        compliance: {
          frameworks: ['ISO27001', 'SOC2'],
          dataClassification: 'confidential',
          retentionPolicy: 'audit-export',
        },
      });

      // Generate export
      return await auditLogService.export(input);
    }),
});
```

---

## Compliance Integration

### ISO 27001 Mapping

```typescript
// server/audit/compliance/iso27001.ts

interface ISO27001Control {
  controlId: string;
  controlName: string;
  auditEvents: string[];
  reportingRequirements: string[];
}

const iso27001Controls: ISO27001Control[] = [
  {
    controlId: 'A.12.4.1',
    controlName: 'Event logging',
    auditEvents: [
      'auth.login.*',
      'auth.logout',
      'authz.access.*',
      'data.*',
      'security.*',
    ],
    reportingRequirements: [
      'User activities logged',
      'Exceptions logged',
      'Information security events logged',
    ],
  },
  {
    controlId: 'A.12.4.2',
    controlName: 'Protection of log information',
    auditEvents: [
      'key.accessed',
      'config.updated',
    ],
    reportingRequirements: [
      'Logs protected against tampering',
      'Access to logs restricted',
    ],
  },
  {
    controlId: 'A.12.4.3',
    controlName: 'Administrator and operator logs',
    auditEvents: [
      'config.*',
      'user_management.*',
      'policy.*',
    ],
    reportingRequirements: [
      'System administrator activities logged',
      'System operator activities logged',
    ],
  },
  {
    controlId: 'A.9.4.2',
    controlName: 'Secure log-on procedures',
    auditEvents: [
      'auth.login.*',
      'auth.mfa.*',
    ],
    reportingRequirements: [
      'Authentication attempts logged',
      'MFA events logged',
    ],
  },
];

class ISO27001Reporter {
  /**
   * Generate ISO 27001 compliance report
   */
  async generateReport(period: { start: Date; end: Date }): Promise<ISO27001Report> {
    const controlResults: ControlResult[] = [];

    for (const control of iso27001Controls) {
      // Query relevant audit events
      const events = await this.queryEvents(control.auditEvents, period);
      
      // Analyze compliance
      const analysis = this.analyzeCompliance(control, events);
      
      controlResults.push({
        control,
        eventCount: events.length,
        compliance: analysis.compliant,
        findings: analysis.findings,
        evidence: events.slice(0, 10), // Sample evidence
      });
    }

    return {
      period,
      controls: controlResults,
      overallCompliance: this.calculateOverallCompliance(controlResults),
      generatedAt: new Date(),
    };
  }
}
```

### SOC 2 Integration

```typescript
// server/audit/compliance/soc2.ts

interface SOC2TrustServiceCriteria {
  category: 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy';
  criteriaId: string;
  description: string;
  auditEvents: string[];
}

const soc2Criteria: SOC2TrustServiceCriteria[] = [
  // Security
  {
    category: 'security',
    criteriaId: 'CC6.1',
    description: 'Logical and physical access controls',
    auditEvents: ['auth.*', 'authz.*'],
  },
  {
    category: 'security',
    criteriaId: 'CC6.2',
    description: 'System account management',
    auditEvents: ['user_management.*', 'auth.token.*'],
  },
  {
    category: 'security',
    criteriaId: 'CC6.6',
    description: 'Encryption of data',
    auditEvents: ['encryption.*', 'key.*'],
  },
  {
    category: 'security',
    criteriaId: 'CC7.2',
    description: 'Security incident monitoring',
    auditEvents: ['security.*'],
  },
  
  // Confidentiality
  {
    category: 'confidentiality',
    criteriaId: 'C1.1',
    description: 'Confidential information protection',
    auditEvents: ['data.*', 'file.*'],
  },
  
  // Privacy
  {
    category: 'privacy',
    criteriaId: 'P1.1',
    description: 'Privacy notice and consent',
    auditEvents: ['compliance.consent.*', 'compliance.dsar.*'],
  },
];

class SOC2Reporter {
  /**
   * Generate SOC 2 Type II report
   */
  async generateReport(period: { start: Date; end: Date }): Promise<SOC2Report> {
    const criteriaResults: CriteriaResult[] = [];

    for (const criteria of soc2Criteria) {
      const events = await this.queryEvents(criteria.auditEvents, period);
      const analysis = this.analyzeCriteria(criteria, events);
      
      criteriaResults.push({
        criteria,
        eventCount: events.length,
        effectiveness: analysis.effectiveness,
        exceptions: analysis.exceptions,
        evidence: this.selectEvidence(events),
      });
    }

    return {
      period,
      criteria: criteriaResults,
      overallEffectiveness: this.calculateEffectiveness(criteriaResults),
      auditorNotes: [],
      generatedAt: new Date(),
    };
  }
}
```

### FINMA Reporting

```typescript
// server/audit/compliance/finma.ts

interface FINMAReportingRequirement {
  requirementId: string;
  description: string;
  auditEvents: string[];
  reportingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

const finmaRequirements: FINMAReportingRequirement[] = [
  {
    requirementId: 'FINMA-2018/3-4',
    description: 'Outsourcing risk assessment',
    auditEvents: ['sandbox.*', 'resource.*'],
    reportingFrequency: 'quarterly',
  },
  {
    requirementId: 'FINMA-2018/3-10',
    description: 'Business continuity',
    auditEvents: ['sandbox.hibernated', 'sandbox.resumed', 'security.*'],
    reportingFrequency: 'monthly',
  },
  {
    requirementId: 'FINMA-2018/3-15',
    description: 'Cyber risk management',
    auditEvents: ['security.*', 'auth.*', 'key.*'],
    reportingFrequency: 'weekly',
  },
];

class FINMAReporter {
  /**
   * Generate FINMA compliance report
   */
  async generateReport(
    period: { start: Date; end: Date },
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  ): Promise<FINMAReport> {
    const applicableRequirements = finmaRequirements.filter(
      r => this.frequencyMatches(r.reportingFrequency, frequency)
    );

    const requirementResults: RequirementResult[] = [];

    for (const requirement of applicableRequirements) {
      const events = await this.queryEvents(requirement.auditEvents, period);
      
      requirementResults.push({
        requirement,
        eventCount: events.length,
        incidents: this.identifyIncidents(events),
        riskAssessment: this.assessRisk(events),
      });
    }

    return {
      period,
      frequency,
      requirements: requirementResults,
      overallRiskLevel: this.calculateOverallRisk(requirementResults),
      generatedAt: new Date(),
    };
  }
}
```

---

## Implementation Guide

### Implementation Checklist

```markdown
## Audit Logging Setup
- [ ] Deploy Kafka cluster for event streaming
- [ ] Configure OpenSearch for log storage and search
- [ ] Set up S3 with Object Lock for immutable storage
- [ ] Implement audit logger with cryptographic signing
- [ ] Configure log enrichment (GeoIP, device detection)

## Event Coverage
- [ ] Instrument authentication events
- [ ] Instrument authorization events
- [ ] Instrument data access events
- [ ] Instrument file operations
- [ ] Instrument sandbox lifecycle events
- [ ] Instrument security events
- [ ] Instrument key management events
- [ ] Instrument configuration changes

## Retention & Archival
- [ ] Define retention policies per event category
- [ ] Configure S3 lifecycle rules
- [ ] Implement automated archival
- [ ] Set up secure deletion process
- [ ] Test retention policy enforcement

## Access Control
- [ ] Define role-based access permissions
- [ ] Implement access control middleware
- [ ] Configure audit log query API
- [ ] Set up export functionality
- [ ] Log all access to audit logs

## Compliance Reporting
- [ ] Implement ISO 27001 report generator
- [ ] Implement SOC 2 report generator
- [ ] Implement FINMA report generator
- [ ] Set up automated report scheduling
- [ ] Configure compliance dashboards

## Monitoring & Alerting
- [ ] Set up real-time anomaly detection
- [ ] Configure security alerts
- [ ] Implement compliance violation alerts
- [ ] Create operational dashboards
- [ ] Set up SIEM integration
```

---

## Summary

### Audit Logging Coverage

| Category | Events | Retention | Compliance |
|----------|--------|-----------|------------|
| **Authentication** | Login, logout, MFA, tokens | 7 years | ISO 27001, SOC 2 |
| **Authorization** | Access granted/denied, roles | 7 years | ISO 27001, SOC 2 |
| **Data Access** | Read, write, delete, export | 5 years | ISO 27001, SOC 2, FINMA |
| **Security** | Threats, anomalies, rate limits | 10 years | ISO 27001, SOC 2, FINMA |
| **Key Management** | Create, rotate, access, delete | 10 years | ISO 27001, SOC 2, FINMA |
| **Configuration** | Settings, policies, features | 7 years | ISO 27001, SOC 2 |

### Key Features

| Feature | Implementation |
|---------|----------------|
| **Immutability** | S3 Object Lock, hash chaining |
| **Integrity** | Cryptographic signatures |
| **Searchability** | OpenSearch with full-text search |
| **Retention** | Automated lifecycle policies |
| **Access Control** | Role-based with audit trail |
| **Compliance** | ISO 27001, SOC 2, FINMA reports |
