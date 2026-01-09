# AI Agent Safety Rails

This guide provides comprehensive coverage of safety mechanisms for AI agents, including command whitelisting/blacklisting, confirmation workflows for destructive operations, rate limiting, and guardrails to prevent harmful actions.

---

## Table of Contents

1. [Overview](#overview)
2. [Command Filtering](#command-filtering)
3. [Destructive Operation Confirmation](#destructive-operation-confirmation)
4. [Rate Limiting](#rate-limiting)
5. [Content Filtering](#content-filtering)
6. [Guardrail System](#guardrail-system)
7. [Monitoring and Alerting](#monitoring-and-alerting)

---

## Overview

### Safety Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AI AGENT SAFETY ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER REQUEST                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: INPUT VALIDATION                                          │   │
│  │  • Content filtering • Prompt injection detection                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: PLANNING VALIDATION                                       │   │
│  │  • Action whitelist check • Resource limit verification             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: EXECUTION VALIDATION                                      │   │
│  │  • Command filtering • Rate limiting • Confirmation dialogs         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: OUTPUT VALIDATION                                         │   │
│  │  • Response filtering • Sensitive data masking                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  SAFE EXECUTION                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Safety Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Defense in Depth** | Multiple layers of protection | 4-layer validation |
| **Least Privilege** | Minimal required permissions | Scoped tool access |
| **Fail Secure** | Default to denial on uncertainty | Whitelist approach |
| **Explicit Confirmation** | User approval for risky actions | Confirmation dialogs |
| **Audit Trail** | Log all actions | Comprehensive logging |

---

## Command Filtering

### Whitelist/Blacklist System

```typescript
// server/agent/safety/commandFilter.ts

interface CommandRule {
  pattern: string | RegExp;
  action: 'allow' | 'deny' | 'confirm';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class CommandFilter {
  // Explicitly allowed commands (whitelist)
  private whitelist: CommandRule[] = [
    // File operations
    { pattern: /^ls\s/, action: 'allow', reason: 'List files', severity: 'low' },
    { pattern: /^cat\s/, action: 'allow', reason: 'Read file', severity: 'low' },
    { pattern: /^grep\s/, action: 'allow', reason: 'Search files', severity: 'low' },
    
    // Development tools
    { pattern: /^npm\s/, action: 'allow', reason: 'NPM package manager', severity: 'low' },
    { pattern: /^pnpm\s/, action: 'allow', reason: 'PNPM package manager', severity: 'low' },
    { pattern: /^node\s/, action: 'allow', reason: 'Node.js runtime', severity: 'low' },
    { pattern: /^python3?\s/, action: 'allow', reason: 'Python runtime', severity: 'low' },
    
    // Git operations
    { pattern: /^git\s+status/, action: 'allow', reason: 'Git status', severity: 'low' },
    { pattern: /^git\s+add/, action: 'allow', reason: 'Git add', severity: 'low' },
    { pattern: /^git\s+commit/, action: 'allow', reason: 'Git commit', severity: 'low' },
  ];

  // Explicitly denied commands (blacklist)
  private blacklist: CommandRule[] = [
    // System modification
    { pattern: /\bsudo\b/, action: 'deny', reason: 'Privilege escalation', severity: 'critical' },
    { pattern: /\bsu\b/, action: 'deny', reason: 'User switching', severity: 'critical' },
    
    // Dangerous operations
    { pattern: /\brm\s+-rf\s+\//, action: 'deny', reason: 'Recursive root deletion', severity: 'critical' },
    { pattern: /\bmkfs\b/, action: 'deny', reason: 'Filesystem creation', severity: 'critical' },
    
    // Network attacks
    { pattern: /\bnmap\b/, action: 'deny', reason: 'Network scanning', severity: 'high' },
    
    // Crypto mining
    { pattern: /\bxmrig\b/, action: 'deny', reason: 'Crypto miner', severity: 'critical' },
    
    // Reverse shells
    { pattern: /\bbash\s+-i\s+>&/, action: 'deny', reason: 'Reverse shell', severity: 'critical' },
    { pattern: /\/dev\/tcp\//, action: 'deny', reason: 'Bash TCP', severity: 'critical' },
    
    // System files
    { pattern: /\/etc\/shadow/, action: 'deny', reason: 'Password file access', severity: 'critical' },
    { pattern: /~\/\.ssh/, action: 'deny', reason: 'SSH key access', severity: 'critical' },
  ];

  // Commands requiring confirmation
  private confirmList: CommandRule[] = [
    { pattern: /\brm\s+-r/, action: 'confirm', reason: 'Recursive deletion', severity: 'high' },
    { pattern: /\bgit\s+push/, action: 'confirm', reason: 'Push to remote', severity: 'medium' },
    { pattern: /\bgit\s+reset\s+--hard/, action: 'confirm', reason: 'Hard reset', severity: 'high' },
    { pattern: /DROP\s+TABLE/i, action: 'confirm', reason: 'Drop table', severity: 'critical' },
    { pattern: /DELETE\s+FROM/i, action: 'confirm', reason: 'Delete records', severity: 'medium' },
  ];

  filter(command: string): FilterResult {
    const normalizedCommand = command.trim().toLowerCase();

    // Check blacklist first (deny takes precedence)
    for (const rule of this.blacklist) {
      if (this.matchesRule(normalizedCommand, rule)) {
        return { allowed: false, requiresConfirmation: false, reason: rule.reason };
      }
    }

    // Check confirmation list
    for (const rule of this.confirmList) {
      if (this.matchesRule(normalizedCommand, rule)) {
        return { allowed: true, requiresConfirmation: true, reason: rule.reason };
      }
    }

    // Check whitelist
    for (const rule of this.whitelist) {
      if (this.matchesRule(normalizedCommand, rule)) {
        return { allowed: true, requiresConfirmation: false };
      }
    }

    // Default: allow but log
    return { allowed: true, requiresConfirmation: false };
  }
}
```

---

## Destructive Operation Confirmation

### Confirmation Manager

```typescript
// server/agent/safety/confirmationManager.ts

interface ConfirmationRequest {
  id: string;
  taskId: string;
  operation: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: OperationContext;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

// Operations requiring confirmation by severity
const confirmationRules = {
  // File operations
  'file.delete': { severity: 'medium', description: 'Delete file' },
  'file.delete_recursive': { severity: 'high', description: 'Delete directory recursively' },
  
  // Database operations
  'db.drop_table': { severity: 'critical', description: 'Drop database table' },
  'db.truncate': { severity: 'high', description: 'Truncate table data' },
  
  // Git operations
  'git.force_push': { severity: 'high', description: 'Force push to remote' },
  'git.hard_reset': { severity: 'high', description: 'Hard reset branch' },
  
  // Deployment
  'deploy.production': { severity: 'critical', description: 'Deploy to production' },
  
  // External services
  'payment.charge': { severity: 'critical', description: 'Process payment' },
};
```

### Confirmation UI Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONFIRMATION DIALOG                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🟠 CONFIRMATION REQUIRED                                                   │
│                                                                             │
│  Operation: Delete directory recursively                                    │
│  Severity: HIGH                                                             │
│                                                                             │
│  Command:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ rm -rf ./old-project                                               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Affected Resources:                                                        │
│  • ./old-project (127 files, 15 directories)                               │
│                                                                             │
│  Reversible: No                                                             │
│                                                                             │
│  ┌──────────────┐                              ┌──────────────┐            │
│  │    Deny      │                              │   Approve    │            │
│  └──────────────┘                              └──────────────┘            │
│                                                                             │
│  Expires in: 4:32                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Rate Limiting

### Rate Limiter Configuration

```typescript
// server/agent/safety/rateLimiter.ts

// Default limits by category
const limits = {
  // Tool-level limits
  'shell.exec': { windowMs: 60000, maxRequests: 60 },      // 60/min
  'file.write': { windowMs: 60000, maxRequests: 100 },     // 100/min
  'file.read': { windowMs: 60000, maxRequests: 200 },      // 200/min
  'browser.navigate': { windowMs: 60000, maxRequests: 30 }, // 30/min
  'search.query': { windowMs: 60000, maxRequests: 20 },    // 20/min
  
  // API-level limits
  'llm.invoke': { windowMs: 60000, maxRequests: 30 },      // 30/min
  'api.external': { windowMs: 60000, maxRequests: 100 },   // 100/min
  
  // Global limits
  'global.actions': { windowMs: 60000, maxRequests: 500 }, // 500/min total
};
```

### Rate Limit Tiers

| Tier | Shell | File Write | Browser | LLM | Global |
|------|-------|------------|---------|-----|--------|
| **Free** | 30/min | 50/min | 15/min | 15/min | 200/min |
| **Pro** | 60/min | 100/min | 30/min | 30/min | 500/min |
| **Enterprise** | 120/min | 200/min | 60/min | 60/min | 1000/min |

---

## Content Filtering

### Content Filter Patterns

```typescript
// server/agent/safety/contentFilter.ts

const patterns = {
  // Personal information
  personalInfo: [
    /\b\d{3}-\d{2}-\d{4}\b/,                    // SSN
    /\b\d{16}\b/,                                // Credit card
    /\b\d{3}-\d{3}-\d{4}\b/,                     // Phone
  ],
  
  // Credentials
  credentials: [
    /password\s*[:=]\s*['"]?[^\s'"]+/i,
    /api[_-]?key\s*[:=]\s*['"]?[^\s'"]+/i,
    /\bAKIA[0-9A-Z]{16}\b/,                      // AWS Access Key
    /\bghp_[a-zA-Z0-9]{36}\b/,                   // GitHub token
  ],
  
  // Prompt injection
  promptInjection: [
    /ignore\s+(previous|all)\s+instructions/i,
    /disregard\s+(previous|all)/i,
    /new\s+instructions:/i,
    /\[INST\]/i,
  ],
};
```

---

## Guardrail System

### Default Guardrails

```typescript
// server/agent/safety/guardrailManager.ts

const guardrails = [
  {
    id: 'scope_boundary',
    name: 'Scope Boundary',
    description: 'Prevent actions outside project directory',
    check: (ctx) => {
      if (ctx.tool === 'file' && ctx.params.path) {
        const projectRoot = '/home/ubuntu/project';
        if (!ctx.params.path.startsWith(projectRoot)) {
          return { passed: false, message: 'File operation outside project' };
        }
      }
      return { passed: true };
    },
  },
  
  {
    id: 'repetition_detection',
    name: 'Repetition Detection',
    description: 'Detect and prevent action loops',
    check: (ctx) => {
      const recentActions = ctx.history.slice(-10);
      const actionKey = `${ctx.tool}:${JSON.stringify(ctx.params)}`;
      const repetitions = recentActions.filter(
        a => `${a.tool}:${JSON.stringify(a.params)}` === actionKey
      ).length;
      if (repetitions >= 3) {
        return { passed: false, message: 'Action repeated too many times' };
      }
      return { passed: true };
    },
  },
  
  {
    id: 'resource_exhaustion',
    name: 'Resource Exhaustion Prevention',
    description: 'Prevent resource exhaustion attacks',
    check: (ctx) => {
      if (ctx.tool === 'shell') {
        const command = ctx.params.command || '';
        // Check for fork bombs
        if (/:\(\)\{.*\|.*&\s*\};:/.test(command)) {
          return { passed: false, message: 'Fork bomb detected' };
        }
      }
      return { passed: true };
    },
  },
];
```

---

## Monitoring and Alerting

### Safety Monitor

```typescript
// server/agent/safety/safetyMonitor.ts

interface SafetyEvent {
  id: string;
  timestamp: Date;
  taskId: string;
  type: 'block' | 'warn' | 'confirm' | 'rate_limit' | 'guardrail';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
}

// Alert thresholds
const thresholds = {
  blocksPerMinute: 5,
  warningsPerMinute: 10,
  rateLimitsPerMinute: 20,
};
```

### Safety Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SAFETY MONITORING DASHBOARD                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAST HOUR SUMMARY                                                          │
│  ├── Total Events: 127                                                      │
│  ├── Blocks: 3                                                              │
│  ├── Warnings: 12                                                           │
│  ├── Confirmations: 8                                                       │
│  └── Rate Limits: 2                                                         │
│                                                                             │
│  ACTIVE ALERTS                                                              │
│  ├── 🔴 Critical: 0                                                         │
│  ├── 🟠 High: 1                                                             │
│  ├── 🟡 Medium: 2                                                           │
│  └── ⚪ Low: 5                                                              │
│                                                                             │
│  TOP BLOCKED COMMANDS                                                       │
│  1. sudo apt install (12 attempts)                                          │
│  2. rm -rf / (3 attempts)                                                   │
│  3. cat /etc/shadow (2 attempts)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Safety Configuration

| Category | Setting | Recommended Value |
|----------|---------|-------------------|
| **Commands** | Whitelist mode | Enabled |
| **Confirmation** | Auto-approve low | Disabled |
| **Rate Limits** | Global actions | 500/min |
| **Guardrails** | All enabled | Yes |
| **Monitoring** | Alert threshold | 5 blocks/min |

### Severity Levels

| Level | Examples | Response |
|-------|----------|----------|
| **Low** | File overwrite | Log only |
| **Medium** | Recursive delete | Confirm |
| **High** | Database truncate | Confirm + log |
| **Critical** | Drop database | Block + alert |
