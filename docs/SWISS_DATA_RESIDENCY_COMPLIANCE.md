# Swiss Data Residency and Compliance

This guide covers adapting the agentic platform architecture for Swiss data residency requirements, including eu-central-2 (Zurich) deployment, compliance certifications (ISO 27001, SOC 2 Type II, Swiss FINMA), and cross-region considerations.

---

## Table of Contents

1. [Swiss Data Residency Overview](#swiss-data-residency-overview)
2. [Infrastructure Architecture for Switzerland](#infrastructure-architecture-for-switzerland)
3. [Compliance Certifications](#compliance-certifications)
4. [FINMA Alignment](#finma-alignment)
5. [Edge Compute Locations](#edge-compute-locations)
6. [Cross-Region Considerations](#cross-region-considerations)
7. [Implementation Checklist](#implementation-checklist)

---

## Swiss Data Residency Overview

### Regulatory Landscape

Switzerland has specific data protection requirements that differ from EU GDPR, governed primarily by the Federal Act on Data Protection (FADP/DSG) and sector-specific regulations like FINMA for financial services.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SWISS DATA RESIDENCY REQUIREMENTS                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  REGULATORY FRAMEWORK                                                           │   │
│  │  ├── FADP/DSG (Federal Data Protection Act)                                     │   │
│  │  ├── FINMA (Financial Market Supervisory Authority)                             │   │
│  │  ├── Banking Secrecy (Art. 47 Banking Act)                                      │   │
│  │  └── Sector-specific regulations (healthcare, insurance)                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  DATA RESIDENCY REQUIREMENTS                                                    │   │
│  │  ├── Data storage: Must be in Switzerland                                       │   │
│  │  ├── Data processing: Must be in Switzerland                                    │   │
│  │  ├── Data access: Restricted to authorized personnel                            │   │
│  │  └── Cross-border transfer: Requires adequacy or safeguards                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  COMPLIANCE CERTIFICATIONS                                                      │   │
│  │  ├── ISO 27001 (Information Security)                                           │   │
│  │  ├── SOC 2 Type II (Trust Services)                                             │   │
│  │  ├── ISAE 3402 (Service Organization Controls)                                  │   │
│  │  └── Swiss-specific: FINMA Circular 2018/3                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Requirements Summary

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| **Data Location** | All data must reside in Switzerland | Deploy in eu-central-2 (Zurich) |
| **Data Processing** | Processing must occur in Switzerland | Compute in Swiss region only |
| **Access Control** | Only authorized personnel | RBAC + audit logging |
| **Encryption** | Data encrypted at rest and in transit | AES-256 + TLS 1.3 |
| **Audit Trail** | Complete audit logging | Immutable audit logs |
| **Data Retention** | Defined retention periods | Automated lifecycle policies |

---

## Infrastructure Architecture for Switzerland

### Swiss Region Deployment

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SWISS INFRASTRUCTURE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SWITZERLAND (eu-central-2 / Zurich)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │   │
│  │  │  AZ-1 (ZRH-1)   │  │  AZ-2 (ZRH-2)   │  │  AZ-3 (ZRH-3)   │                │   │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │                │   │
│  │  │  │ K8s Nodes │  │  │  │ K8s Nodes │  │  │  │ K8s Nodes │  │                │   │
│  │  │  │ (Sandbox) │  │  │  │ (Sandbox) │  │  │  │ (Sandbox) │  │                │   │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │                │   │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │                │   │
│  │  │  │ Database  │  │  │  │ Database  │  │  │  │ Database  │  │                │   │
│  │  │  │ (Primary) │  │  │  │ (Replica) │  │  │  │ (Replica) │  │                │   │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │                │   │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │                │   │
│  │  │  │  Storage  │  │  │  │  Storage  │  │  │  │  Storage  │  │                │   │
│  │  │  │   (S3)    │  │  │  │   (S3)    │  │  │  │   (S3)    │  │                │   │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │                │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                │   │
│  │                                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  SHARED SERVICES (Swiss-only)                                           │   │   │
│  │  │  ├── Load Balancer (Swiss IPs only)                                     │   │   │
│  │  │  ├── Redis Cluster (encrypted)                                          │   │   │
│  │  │  ├── Kafka (encrypted, Swiss DCs)                                       │   │   │
│  │  │  └── Vault (HSM-backed, Swiss)                                          │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  NO DATA LEAVES SWITZERLAND                                                            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Kubernetes Configuration for Swiss Region

```yaml
# kubernetes/swiss-cluster-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: swiss-region-config
  namespace: platform
data:
  REGION: "eu-central-2"
  COUNTRY: "CH"
  DATA_RESIDENCY: "switzerland"
  ALLOWED_REGIONS: "eu-central-2"
  CROSS_REGION_REPLICATION: "disabled"
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: swiss-resource-quota
  namespace: sandboxes
spec:
  hard:
    requests.cpu: "1000"
    requests.memory: "2Ti"
    limits.cpu: "2000"
    limits.memory: "4Ti"
    persistentvolumeclaims: "10000"
---
# Node affinity for Swiss-only scheduling
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: swiss-data-residency
value: 1000000
globalDefault: false
description: "Priority class for Swiss data residency workloads"
---
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-swiss
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/region
            operator: In
            values:
            - eu-central-2
          - key: data-residency
            operator: In
            values:
            - switzerland
  tolerations:
  - key: "swiss-only"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

### Database Configuration

```typescript
// server/database/swissConfig.ts

interface SwissDatabaseConfig {
  primary: DatabaseConnection;
  replicas: DatabaseConnection[];
  encryption: EncryptionConfig;
  backup: BackupConfig;
}

const swissDatabaseConfig: SwissDatabaseConfig = {
  primary: {
    host: 'db-primary.eu-central-2.internal',
    port: 5432,
    database: 'platform',
    ssl: {
      mode: 'verify-full',
      ca: '/etc/ssl/swiss-ca.pem',
      cert: '/etc/ssl/client-cert.pem',
      key: '/etc/ssl/client-key.pem',
    },
    region: 'eu-central-2',
    availabilityZone: 'eu-central-2a',
  },
  replicas: [
    {
      host: 'db-replica-1.eu-central-2.internal',
      region: 'eu-central-2',
      availabilityZone: 'eu-central-2b',
    },
    {
      host: 'db-replica-2.eu-central-2.internal',
      region: 'eu-central-2',
      availabilityZone: 'eu-central-2c',
    },
  ],
  encryption: {
    atRest: {
      algorithm: 'AES-256-GCM',
      keyManagement: 'swiss-hsm',
      keyRotation: 90, // days
    },
    inTransit: {
      protocol: 'TLS 1.3',
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
      ],
    },
  },
  backup: {
    frequency: 'hourly',
    retention: 365, // days
    location: 's3://swiss-backups-eu-central-2',
    encryption: true,
    crossRegion: false, // No cross-region backup
  },
};
```

### Storage Configuration

```typescript
// server/storage/swissStorage.ts

interface SwissStorageConfig {
  bucket: string;
  region: string;
  encryption: StorageEncryption;
  replication: ReplicationConfig;
  lifecycle: LifecycleConfig;
}

const swissStorageConfig: SwissStorageConfig = {
  bucket: 'platform-data-eu-central-2',
  region: 'eu-central-2',
  encryption: {
    serverSide: {
      algorithm: 'aws:kms',
      keyId: 'arn:aws:kms:eu-central-2:123456789:key/swiss-key',
    },
    clientSide: {
      enabled: true,
      algorithm: 'AES-256-GCM',
    },
  },
  replication: {
    enabled: false, // No cross-region replication
    withinRegion: {
      enabled: true,
      targetBucket: 'platform-data-eu-central-2-replica',
    },
  },
  lifecycle: {
    rules: [
      {
        id: 'archive-old-data',
        prefix: 'archives/',
        transitions: [
          { days: 90, storageClass: 'GLACIER' },
        ],
      },
      {
        id: 'delete-temp',
        prefix: 'temp/',
        expiration: { days: 7 },
      },
    ],
  },
};
```

---

## Compliance Certifications

### ISO 27001 Implementation

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ISO 27001 CONTROL MAPPING                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  A.5 INFORMATION SECURITY POLICIES                                                     │
│  ├── A.5.1.1 Policies for information security                                         │
│  │   └── Implementation: Security policy documents, annual review                      │
│  └── A.5.1.2 Review of policies                                                        │
│      └── Implementation: Quarterly policy review process                               │
│                                                                                         │
│  A.6 ORGANIZATION OF INFORMATION SECURITY                                              │
│  ├── A.6.1.1 Information security roles and responsibilities                           │
│  │   └── Implementation: RACI matrix, role definitions                                 │
│  └── A.6.1.2 Segregation of duties                                                     │
│      └── Implementation: RBAC, separation of dev/prod                                  │
│                                                                                         │
│  A.8 ASSET MANAGEMENT                                                                  │
│  ├── A.8.1.1 Inventory of assets                                                       │
│  │   └── Implementation: CMDB, automated discovery                                     │
│  └── A.8.2.1 Classification of information                                             │
│      └── Implementation: Data classification labels                                    │
│                                                                                         │
│  A.9 ACCESS CONTROL                                                                    │
│  ├── A.9.1.1 Access control policy                                                     │
│  │   └── Implementation: Zero-trust, least privilege                                   │
│  ├── A.9.2.1 User registration and de-registration                                     │
│  │   └── Implementation: Automated provisioning/deprovisioning                         │
│  └── A.9.4.1 Information access restriction                                            │
│      └── Implementation: RBAC, attribute-based access                                  │
│                                                                                         │
│  A.10 CRYPTOGRAPHY                                                                     │
│  ├── A.10.1.1 Policy on use of cryptographic controls                                  │
│  │   └── Implementation: Encryption standards document                                 │
│  └── A.10.1.2 Key management                                                           │
│      └── Implementation: HSM, key rotation, secure storage                             │
│                                                                                         │
│  A.12 OPERATIONS SECURITY                                                              │
│  ├── A.12.1.1 Documented operating procedures                                          │
│  │   └── Implementation: Runbooks, SOPs                                                │
│  ├── A.12.4.1 Event logging                                                            │
│  │   └── Implementation: Centralized logging, SIEM                                     │
│  └── A.12.6.1 Management of technical vulnerabilities                                  │
│      └── Implementation: Vulnerability scanning, patching                              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### SOC 2 Type II Controls

```typescript
// server/compliance/soc2Controls.ts

interface SOC2Control {
  id: string;
  category: 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy';
  description: string;
  implementation: string;
  evidence: string[];
  testingFrequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

const soc2Controls: SOC2Control[] = [
  // Security
  {
    id: 'CC6.1',
    category: 'security',
    description: 'Logical and physical access controls',
    implementation: 'RBAC, MFA, network segmentation, physical security',
    evidence: ['access_logs', 'rbac_config', 'mfa_enrollment', 'network_diagrams'],
    testingFrequency: 'continuous',
  },
  {
    id: 'CC6.2',
    category: 'security',
    description: 'System account management',
    implementation: 'Automated provisioning, access reviews, privileged access management',
    evidence: ['provisioning_logs', 'access_review_reports', 'pam_logs'],
    testingFrequency: 'quarterly',
  },
  {
    id: 'CC6.6',
    category: 'security',
    description: 'Encryption of data',
    implementation: 'TLS 1.3, AES-256, HSM key management',
    evidence: ['encryption_config', 'certificate_inventory', 'hsm_audit_logs'],
    testingFrequency: 'monthly',
  },
  
  // Availability
  {
    id: 'A1.1',
    category: 'availability',
    description: 'System availability commitments',
    implementation: '99.9% SLA, multi-AZ deployment, auto-scaling',
    evidence: ['sla_reports', 'uptime_metrics', 'scaling_logs'],
    testingFrequency: 'continuous',
  },
  {
    id: 'A1.2',
    category: 'availability',
    description: 'Disaster recovery',
    implementation: 'DR plan, backup procedures, failover testing',
    evidence: ['dr_plan', 'backup_logs', 'failover_test_results'],
    testingFrequency: 'quarterly',
  },
  
  // Confidentiality
  {
    id: 'C1.1',
    category: 'confidentiality',
    description: 'Confidential information protection',
    implementation: 'Data classification, encryption, access controls',
    evidence: ['classification_policy', 'encryption_audit', 'access_logs'],
    testingFrequency: 'monthly',
  },
  
  // Privacy
  {
    id: 'P1.1',
    category: 'privacy',
    description: 'Privacy notice and consent',
    implementation: 'Privacy policy, consent management, data subject rights',
    evidence: ['privacy_policy', 'consent_logs', 'dsar_records'],
    testingFrequency: 'quarterly',
  },
];

class SOC2ComplianceManager {
  /**
   * Generate compliance report
   */
  async generateReport(period: { start: Date; end: Date }): Promise<SOC2Report> {
    const controlResults: ControlResult[] = [];

    for (const control of soc2Controls) {
      const evidence = await this.collectEvidence(control, period);
      const testResult = await this.testControl(control, evidence);
      
      controlResults.push({
        control,
        evidence,
        testResult,
        exceptions: testResult.exceptions,
      });
    }

    return {
      period,
      controls: controlResults,
      overallStatus: this.calculateOverallStatus(controlResults),
      generatedAt: new Date(),
    };
  }
}
```

---

## FINMA Alignment

### FINMA Circular 2018/3 Requirements

```typescript
// server/compliance/finmaCompliance.ts

interface FINMARequirement {
  id: string;
  section: string;
  requirement: string;
  implementation: string;
  riskCategory: 'high' | 'medium' | 'low';
}

const finmaRequirements: FINMARequirement[] = [
  // Outsourcing requirements
  {
    id: 'FINMA-2018/3-4',
    section: 'Outsourcing',
    requirement: 'Risk assessment for outsourced functions',
    implementation: 'Documented risk assessment, ongoing monitoring, exit strategy',
    riskCategory: 'high',
  },
  {
    id: 'FINMA-2018/3-5',
    section: 'Outsourcing',
    requirement: 'Contractual requirements',
    implementation: 'SLA, audit rights, data protection clauses, termination rights',
    riskCategory: 'high',
  },
  {
    id: 'FINMA-2018/3-6',
    section: 'Outsourcing',
    requirement: 'Data location and access',
    implementation: 'Swiss data residency, access logging, encryption',
    riskCategory: 'high',
  },
  
  // Operational risk
  {
    id: 'FINMA-2018/3-10',
    section: 'Operational Risk',
    requirement: 'Business continuity management',
    implementation: 'BCP, DR plan, regular testing, RTO/RPO targets',
    riskCategory: 'high',
  },
  {
    id: 'FINMA-2018/3-11',
    section: 'Operational Risk',
    requirement: 'Incident management',
    implementation: 'Incident response plan, escalation procedures, reporting',
    riskCategory: 'medium',
  },
  
  // Cybersecurity
  {
    id: 'FINMA-2018/3-15',
    section: 'Cybersecurity',
    requirement: 'Cyber risk management',
    implementation: 'Security controls, vulnerability management, penetration testing',
    riskCategory: 'high',
  },
  {
    id: 'FINMA-2018/3-16',
    section: 'Cybersecurity',
    requirement: 'Data protection',
    implementation: 'Encryption, access controls, data classification',
    riskCategory: 'high',
  },
];

class FINMAComplianceManager {
  /**
   * Assess FINMA compliance
   */
  async assessCompliance(): Promise<FINMAAssessment> {
    const results: RequirementResult[] = [];

    for (const req of finmaRequirements) {
      const status = await this.checkRequirement(req);
      results.push({
        requirement: req,
        status,
        gaps: status.gaps,
        remediationPlan: status.gaps.length > 0 ? await this.createRemediationPlan(req, status.gaps) : null,
      });
    }

    return {
      assessmentDate: new Date(),
      requirements: results,
      overallCompliance: this.calculateComplianceScore(results),
      criticalGaps: results.filter(r => r.requirement.riskCategory === 'high' && r.gaps.length > 0),
    };
  }

  /**
   * Generate FINMA report
   */
  async generateFINMAReport(): Promise<Buffer> {
    const assessment = await this.assessCompliance();
    
    return this.renderReport({
      title: 'FINMA Circular 2018/3 Compliance Report',
      date: new Date(),
      assessment,
      attestation: await this.getAttestation(),
    });
  }
}
```

### Banking Secrecy Compliance

```typescript
// server/compliance/bankingSecrecy.ts

interface BankingSecrecyControl {
  control: string;
  implementation: string;
  monitoring: string;
}

const bankingSecrecyControls: BankingSecrecyControl[] = [
  {
    control: 'Access restriction to client data',
    implementation: 'Role-based access, need-to-know principle, privileged access management',
    monitoring: 'Access logging, anomaly detection, quarterly access reviews',
  },
  {
    control: 'Data encryption',
    implementation: 'AES-256 encryption at rest, TLS 1.3 in transit, HSM key management',
    monitoring: 'Encryption audit, key rotation monitoring, certificate management',
  },
  {
    control: 'Audit trail',
    implementation: 'Immutable audit logs, tamper-evident storage, 10-year retention',
    monitoring: 'Log integrity verification, access monitoring, regular audits',
  },
  {
    control: 'Cross-border data transfer',
    implementation: 'No cross-border transfer without explicit consent and legal basis',
    monitoring: 'Network monitoring, DLP, transfer logging',
  },
  {
    control: 'Third-party access',
    implementation: 'Strict vendor management, contractual obligations, audit rights',
    monitoring: 'Vendor access logging, periodic assessments, contract reviews',
  },
];
```

---

## Edge Compute Locations

### Swiss Edge Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SWISS EDGE COMPUTE ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  EDGE LOCATIONS (Switzerland)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │   Zurich    │  │   Geneva    │  │    Basel    │  │    Bern     │           │   │
│  │  │   (ZRH)     │  │   (GVA)     │  │   (BSL)     │  │   (BRN)     │           │   │
│  │  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │           │   │
│  │  │  │ Edge  │  │  │  │ Edge  │  │  │  │ Edge  │  │  │  │ Edge  │  │           │   │
│  │  │  │ Node  │  │  │  │ Node  │  │  │  │ Node  │  │  │  │ Node  │  │           │   │
│  │  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │           │   │
│  │  │  Latency:   │  │  Latency:   │  │  Latency:   │  │  Latency:   │           │   │
│  │  │  <5ms       │  │  <10ms      │  │  <10ms      │  │  <10ms      │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  │                                                                                 │   │
│  │                              ▼                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │                    CORE REGION (eu-central-2 / Zurich)                  │   │   │
│  │  │  ├── Primary compute                                                    │   │   │
│  │  │  ├── Database (primary + replicas)                                      │   │   │
│  │  │  ├── Object storage                                                     │   │   │
│  │  │  └── Control plane                                                      │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ALL EDGE NODES WITHIN SWITZERLAND                                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Edge Node Configuration

```typescript
// server/edge/swissEdgeConfig.ts

interface SwissEdgeNode {
  id: string;
  location: string;
  city: string;
  coordinates: { lat: number; lng: number };
  capabilities: EdgeCapabilities;
  dataResidency: 'switzerland';
}

const swissEdgeNodes: SwissEdgeNode[] = [
  {
    id: 'edge-zrh-1',
    location: 'Zurich',
    city: 'ZRH',
    coordinates: { lat: 47.3769, lng: 8.5417 },
    capabilities: {
      compute: true,
      cache: true,
      waf: true,
      ddosProtection: true,
    },
    dataResidency: 'switzerland',
  },
  {
    id: 'edge-gva-1',
    location: 'Geneva',
    city: 'GVA',
    coordinates: { lat: 46.2044, lng: 6.1432 },
    capabilities: {
      compute: true,
      cache: true,
      waf: true,
      ddosProtection: true,
    },
    dataResidency: 'switzerland',
  },
  {
    id: 'edge-bsl-1',
    location: 'Basel',
    city: 'BSL',
    coordinates: { lat: 47.5596, lng: 7.5886 },
    capabilities: {
      compute: false,
      cache: true,
      waf: true,
      ddosProtection: true,
    },
    dataResidency: 'switzerland',
  },
];

class SwissEdgeManager {
  /**
   * Route request to nearest Swiss edge
   */
  routeToNearestEdge(clientLocation: { lat: number; lng: number }): SwissEdgeNode {
    let nearestEdge = swissEdgeNodes[0];
    let minDistance = Infinity;

    for (const edge of swissEdgeNodes) {
      const distance = this.calculateDistance(clientLocation, edge.coordinates);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEdge = edge;
      }
    }

    return nearestEdge;
  }

  /**
   * Ensure request stays within Switzerland
   */
  validateDataResidency(edge: SwissEdgeNode): boolean {
    return edge.dataResidency === 'switzerland';
  }
}
```

---

## Cross-Region Considerations

### Cross-Region Data Flow Restrictions

```typescript
// server/compliance/crossRegion.ts

interface CrossRegionPolicy {
  sourceRegion: string;
  targetRegion: string;
  allowed: boolean;
  conditions?: string[];
  dataTypes: string[];
}

const crossRegionPolicies: CrossRegionPolicy[] = [
  // Swiss data stays in Switzerland
  {
    sourceRegion: 'eu-central-2',
    targetRegion: '*',
    allowed: false,
    dataTypes: ['customer_data', 'financial_data', 'pii'],
  },
  // Metadata can be replicated for monitoring
  {
    sourceRegion: 'eu-central-2',
    targetRegion: 'eu-west-1',
    allowed: true,
    conditions: ['anonymized', 'aggregated', 'no_pii'],
    dataTypes: ['metrics', 'logs_anonymized'],
  },
  // Disaster recovery within Switzerland only
  {
    sourceRegion: 'eu-central-2',
    targetRegion: 'eu-central-2-dr',
    allowed: true,
    dataTypes: ['*'],
  },
];

class CrossRegionEnforcer {
  /**
   * Validate cross-region data transfer
   */
  validateTransfer(transfer: DataTransfer): ValidationResult {
    const policy = this.findApplicablePolicy(transfer);
    
    if (!policy) {
      return {
        allowed: false,
        reason: 'No policy found for this transfer',
      };
    }

    if (!policy.allowed) {
      return {
        allowed: false,
        reason: `Cross-region transfer not allowed: ${transfer.sourceRegion} → ${transfer.targetRegion}`,
      };
    }

    // Check conditions
    if (policy.conditions) {
      for (const condition of policy.conditions) {
        if (!this.checkCondition(condition, transfer)) {
          return {
            allowed: false,
            reason: `Condition not met: ${condition}`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Block unauthorized cross-region transfers
   */
  async enforcePolicy(transfer: DataTransfer): Promise<void> {
    const validation = this.validateTransfer(transfer);
    
    if (!validation.allowed) {
      await this.logBlockedTransfer(transfer, validation.reason);
      throw new Error(`Cross-region transfer blocked: ${validation.reason}`);
    }
  }
}
```

### Network Isolation

```yaml
# kubernetes/swiss-network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: swiss-data-residency
  namespace: platform
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    # Allow internal Swiss traffic only
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8  # Internal Swiss network
        - ipBlock:
            cidr: 172.16.0.0/12  # Swiss edge network
    # Block all external traffic by default
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 0.0.0.0/0  # Block everything external
      ports:
        - port: 443
          protocol: TCP
---
# Egress gateway for controlled external access
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: swiss-egress-gateway
spec:
  selector:
    istio: egressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      hosts:
        - "*.swiss-approved-services.ch"
      tls:
        mode: PASSTHROUGH
```

---

## Implementation Checklist

### Swiss Data Residency Checklist

```markdown
## Infrastructure
- [ ] Deploy all compute in eu-central-2 (Zurich)
- [ ] Configure node affinity for Swiss-only scheduling
- [ ] Set up multi-AZ deployment within Switzerland
- [ ] Disable cross-region replication
- [ ] Configure Swiss-only edge nodes

## Database
- [ ] Deploy database in eu-central-2
- [ ] Enable encryption at rest (AES-256)
- [ ] Configure TLS 1.3 for connections
- [ ] Set up Swiss-only backups
- [ ] Implement point-in-time recovery

## Storage
- [ ] Create Swiss-only S3 buckets
- [ ] Enable server-side encryption
- [ ] Disable cross-region replication
- [ ] Configure lifecycle policies
- [ ] Set up access logging

## Network
- [ ] Configure Swiss-only network policies
- [ ] Set up egress filtering
- [ ] Implement DLP controls
- [ ] Enable network flow logging
- [ ] Configure Swiss edge locations

## Compliance
- [ ] Complete ISO 27001 control mapping
- [ ] Implement SOC 2 controls
- [ ] Document FINMA alignment
- [ ] Set up audit logging
- [ ] Configure compliance reporting

## Monitoring
- [ ] Deploy monitoring in Switzerland
- [ ] Configure alerting
- [ ] Set up compliance dashboards
- [ ] Enable security monitoring
- [ ] Implement anomaly detection
```

---

## Summary

### Swiss Compliance Requirements

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Data Location** | eu-central-2 only | Required |
| **ISO 27001** | Full control implementation | Required |
| **SOC 2 Type II** | Annual audit | Required |
| **FINMA 2018/3** | Outsourcing controls | Required for FinServ |
| **Encryption** | AES-256 + TLS 1.3 | Required |
| **Audit Logging** | Immutable, 10-year retention | Required |

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Single-region deployment | Data residency requirement |
| No cross-region replication | Compliance with Swiss law |
| Swiss-only edge nodes | Latency + compliance |
| HSM key management | FINMA requirement |
| Immutable audit logs | Banking secrecy |
