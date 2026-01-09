# Security Implementation Details

This guide covers syscall auditing, network egress control, DNS resolution, secrets injection, and container escape testing.

---

## Table of Contents

1. [Syscall Auditing](#syscall-auditing)
2. [Network Egress Control](#network-egress-control)
3. [DNS Resolution](#dns-resolution)
4. [Secrets Injection](#secrets-injection)
5. [Container Escape Testing](#container-escape-testing)

---

## Syscall Auditing

### Strategy: Log All Blocked Syscalls

We log **all blocked syscalls** for security monitoring and threat detection.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SYSCALL AUDIT ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX PROCESS                                                                        │
│       │                                                                                 │
│       │ syscall()                                                                       │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SECCOMP-BPF FILTER                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐│   │
│  │  │  if (syscall in ALLOWED) → ALLOW                                            ││   │
│  │  │  if (syscall in BLOCKED) → LOG + ERRNO                                      ││   │
│  │  │  if (syscall in KILL_LIST) → LOG + KILL                                     ││   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  AUDIT LOG (auditd / syslog)                                                     │   │
│  │  ├── Timestamp                                                                   │   │
│  │  ├── Sandbox ID                                                                  │   │
│  │  ├── Process name/PID                                                            │   │
│  │  ├── Syscall number/name                                                         │   │
│  │  ├── Arguments                                                                   │   │
│  │  └── Action taken (ERRNO/KILL)                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SECURITY MONITORING (SIEM)                                                      │   │
│  │  ├── Real-time alerting                                                          │   │
│  │  ├── Anomaly detection                                                           │   │
│  │  └── Threat correlation                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Seccomp Profile with Audit

```json
{
  "defaultAction": "SCMP_ACT_LOG",
  "defaultErrnoRet": 1,
  "archMap": [
    {
      "architecture": "SCMP_ARCH_X86_64",
      "subArchitectures": ["SCMP_ARCH_X86", "SCMP_ARCH_X32"]
    }
  ],
  "syscalls": [
    {
      "names": [
        "read", "write", "open", "close", "stat", "fstat",
        "lstat", "poll", "lseek", "mmap", "mprotect", "munmap",
        "brk", "rt_sigaction", "rt_sigprocmask", "ioctl",
        "access", "pipe", "select", "sched_yield", "mremap",
        "msync", "mincore", "madvise", "dup", "dup2",
        "nanosleep", "getpid", "socket", "connect", "accept",
        "sendto", "recvfrom", "bind", "listen", "getsockname",
        "getpeername", "socketpair", "setsockopt", "getsockopt",
        "clone", "fork", "vfork", "execve", "exit", "wait4",
        "kill", "uname", "fcntl", "flock", "fsync", "fdatasync",
        "truncate", "ftruncate", "getdents", "getcwd", "chdir",
        "rename", "mkdir", "rmdir", "creat", "link", "unlink",
        "symlink", "readlink", "chmod", "fchmod", "chown", "fchown",
        "lchown", "umask", "gettimeofday", "getrlimit", "getrusage",
        "sysinfo", "times", "getuid", "getgid", "geteuid", "getegid",
        "setpgid", "getppid", "getpgrp", "setsid", "setreuid",
        "setregid", "getgroups", "setgroups", "setresuid", "getresuid",
        "setresgid", "getresgid", "getpgid", "setfsuid", "setfsgid",
        "getsid", "capget", "rt_sigpending", "rt_sigtimedwait",
        "rt_sigqueueinfo", "rt_sigsuspend", "sigaltstack", "utime",
        "mknod", "statfs", "fstatfs", "sysfs", "getpriority",
        "setpriority", "sched_setparam", "sched_getparam",
        "sched_setscheduler", "sched_getscheduler", "sched_get_priority_max",
        "sched_get_priority_min", "sched_rr_get_interval", "mlock",
        "munlock", "mlockall", "munlockall", "prctl", "arch_prctl",
        "setrlimit", "sync", "acct", "settimeofday", "swapon",
        "swapoff", "reboot", "sethostname", "setdomainname",
        "ioperm", "iopl", "create_module", "init_module",
        "delete_module", "get_kernel_syms", "query_module",
        "quotactl", "nfsservctl", "getpmsg", "putpmsg", "afs_syscall",
        "tuxcall", "security", "gettid", "readahead", "setxattr",
        "lsetxattr", "fsetxattr", "getxattr", "lgetxattr", "fgetxattr",
        "listxattr", "llistxattr", "flistxattr", "removexattr",
        "lremovexattr", "fremovexattr", "tkill", "time", "futex",
        "sched_setaffinity", "sched_getaffinity", "set_thread_area",
        "get_thread_area", "io_setup", "io_destroy", "io_getevents",
        "io_submit", "io_cancel", "lookup_dcookie", "epoll_create",
        "epoll_ctl_old", "epoll_wait_old", "remap_file_pages",
        "getdents64", "set_tid_address", "restart_syscall", "semtimedop",
        "fadvise64", "timer_create", "timer_settime", "timer_gettime",
        "timer_getoverrun", "timer_delete", "clock_settime",
        "clock_gettime", "clock_getres", "clock_nanosleep",
        "exit_group", "epoll_wait", "epoll_ctl", "tgkill", "utimes",
        "mbind", "set_mempolicy", "get_mempolicy", "mq_open",
        "mq_unlink", "mq_timedsend", "mq_timedreceive", "mq_notify",
        "mq_getsetattr", "kexec_load", "waitid", "add_key",
        "request_key", "keyctl", "ioprio_set", "ioprio_get",
        "inotify_init", "inotify_add_watch", "inotify_rm_watch",
        "migrate_pages", "openat", "mkdirat", "mknodat", "fchownat",
        "futimesat", "newfstatat", "unlinkat", "renameat", "linkat",
        "symlinkat", "readlinkat", "fchmodat", "faccessat", "pselect6",
        "ppoll", "unshare", "set_robust_list", "get_robust_list",
        "splice", "tee", "sync_file_range", "vmsplice", "move_pages",
        "utimensat", "epoll_pwait", "signalfd", "timerfd_create",
        "eventfd", "fallocate", "timerfd_settime", "timerfd_gettime",
        "accept4", "signalfd4", "eventfd2", "epoll_create1", "dup3",
        "pipe2", "inotify_init1", "preadv", "pwritev", "rt_tgsigqueueinfo",
        "perf_event_open", "recvmmsg", "fanotify_init", "fanotify_mark",
        "prlimit64", "name_to_handle_at", "open_by_handle_at",
        "clock_adjtime", "syncfs", "sendmmsg", "setns", "getcpu",
        "process_vm_readv", "process_vm_writev", "kcmp", "finit_module",
        "sched_setattr", "sched_getattr", "renameat2", "seccomp",
        "getrandom", "memfd_create", "kexec_file_load", "bpf",
        "execveat", "userfaultfd", "membarrier", "mlock2", "copy_file_range",
        "preadv2", "pwritev2", "pkey_mprotect", "pkey_alloc", "pkey_free",
        "statx", "io_pgetevents", "rseq"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": [
        "mount", "umount2", "pivot_root", "swapon", "swapoff",
        "reboot", "sethostname", "setdomainname", "init_module",
        "delete_module", "acct", "kexec_load", "kexec_file_load",
        "bpf", "perf_event_open", "lookup_dcookie", "quotactl",
        "nfsservctl", "add_key", "request_key", "keyctl"
      ],
      "action": "SCMP_ACT_LOG",
      "errnoRet": 1
    },
    {
      "names": [
        "ptrace"
      ],
      "action": "SCMP_ACT_TRACE",
      "errnoRet": 1
    }
  ]
}
```

### Audit Log Implementation

```typescript
// syscall-auditor.ts

import { createLogger, format, transports } from 'winston';

interface SyscallAuditEvent {
  timestamp: string;
  sandboxId: string;
  processName: string;
  pid: number;
  syscall: string;
  syscallNumber: number;
  arguments: string[];
  action: 'ALLOW' | 'ERRNO' | 'KILL' | 'TRACE';
  errno?: number;
  severity: 'info' | 'warning' | 'critical';
}

class SyscallAuditor {
  private logger: any;
  private alertThresholds: Map<string, number> = new Map();
  private eventCounts: Map<string, number> = new Map();
  
  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        // Local file
        new transports.File({ 
          filename: '/var/log/sandbox/syscall-audit.log',
          maxsize: 100 * 1024 * 1024,  // 100 MB
          maxFiles: 10,
        }),
        // Remote SIEM
        new transports.Http({
          host: 'siem.internal',
          port: 8080,
          path: '/api/events',
        }),
      ],
    });
    
    // Set alert thresholds
    this.alertThresholds.set('ptrace', 1);      // Alert on any ptrace
    this.alertThresholds.set('mount', 1);       // Alert on any mount
    this.alertThresholds.set('init_module', 1); // Alert on any module load
    this.alertThresholds.set('bpf', 5);         // Alert on 5+ bpf calls
  }
  
  /**
   * Log syscall event
   */
  async logEvent(event: SyscallAuditEvent): Promise<void> {
    // Log to file/SIEM
    this.logger.log({
      level: event.severity,
      message: `Syscall ${event.action}: ${event.syscall}`,
      ...event,
    });
    
    // Track event counts
    const key = `${event.sandboxId}:${event.syscall}`;
    const count = (this.eventCounts.get(key) || 0) + 1;
    this.eventCounts.set(key, count);
    
    // Check alert thresholds
    const threshold = this.alertThresholds.get(event.syscall);
    if (threshold && count >= threshold) {
      await this.triggerAlert(event, count);
    }
    
    // Check for suspicious patterns
    await this.detectAnomalies(event);
  }
  
  /**
   * Trigger security alert
   */
  private async triggerAlert(
    event: SyscallAuditEvent,
    count: number
  ): Promise<void> {
    const alert = {
      type: 'syscall_alert',
      severity: 'high',
      sandboxId: event.sandboxId,
      syscall: event.syscall,
      count,
      message: `Suspicious syscall activity: ${event.syscall} called ${count} times`,
      timestamp: new Date().toISOString(),
    };
    
    // Send to alerting system
    await this.sendAlert(alert);
    
    // Log alert
    this.logger.warn('Security alert triggered', alert);
  }
  
  /**
   * Detect anomalous patterns
   */
  private async detectAnomalies(event: SyscallAuditEvent): Promise<void> {
    // Pattern: Rapid syscall attempts (potential exploit)
    const recentKey = `${event.sandboxId}:recent`;
    const recentCount = (this.eventCounts.get(recentKey) || 0) + 1;
    this.eventCounts.set(recentKey, recentCount);
    
    // Reset counter every minute
    setTimeout(() => {
      this.eventCounts.set(recentKey, 0);
    }, 60000);
    
    if (recentCount > 100) {
      await this.triggerAlert({
        ...event,
        syscall: 'RAPID_SYSCALLS',
      }, recentCount);
    }
    
    // Pattern: Privilege escalation attempt
    const privEscSyscalls = ['setuid', 'setgid', 'setreuid', 'setregid', 'capset'];
    if (privEscSyscalls.includes(event.syscall) && event.action !== 'ALLOW') {
      await this.triggerAlert(event, 1);
    }
    
    // Pattern: Container escape attempt
    const escapeAttempts = ['unshare', 'setns', 'pivot_root', 'mount'];
    if (escapeAttempts.includes(event.syscall)) {
      await this.triggerAlert(event, 1);
    }
  }
  
  /**
   * Send alert to alerting system
   */
  private async sendAlert(alert: any): Promise<void> {
    // PagerDuty
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        routing_key: process.env.PAGERDUTY_ROUTING_KEY,
        event_action: 'trigger',
        payload: {
          summary: alert.message,
          severity: alert.severity,
          source: `sandbox-${alert.sandboxId}`,
          custom_details: alert,
        },
      }),
    });
    
    // Slack
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `:warning: Security Alert: ${alert.message}`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Sandbox', value: alert.sandboxId, short: true },
            { title: 'Syscall', value: alert.syscall, short: true },
            { title: 'Count', value: alert.count.toString(), short: true },
          ],
        }],
      }),
    });
  }
  
  /**
   * Get audit summary for sandbox
   */
  async getAuditSummary(sandboxId: string): Promise<{
    totalEvents: number;
    blockedEvents: number;
    topSyscalls: Array<{ syscall: string; count: number }>;
    alerts: number;
  }> {
    // Query from log storage
    const events = await this.queryEvents(sandboxId);
    
    const syscallCounts = new Map<string, number>();
    let blockedCount = 0;
    
    for (const event of events) {
      const count = (syscallCounts.get(event.syscall) || 0) + 1;
      syscallCounts.set(event.syscall, count);
      
      if (event.action !== 'ALLOW') {
        blockedCount++;
      }
    }
    
    const topSyscalls = Array.from(syscallCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([syscall, count]) => ({ syscall, count }));
    
    return {
      totalEvents: events.length,
      blockedEvents: blockedCount,
      topSyscalls,
      alerts: 0,  // Query from alert system
    };
  }
}

export { SyscallAuditor, SyscallAuditEvent };
```

---

## Network Egress Control

### Strategy: Allow with Monitoring

We **allow arbitrary outbound HTTP/HTTPS requests** but with comprehensive monitoring.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           NETWORK EGRESS ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX                                                                                │
│  ┌─────────────────────────┐                                                            │
│  │  Application            │                                                            │
│  │  ├── HTTP request       │                                                            │
│  │  └── DNS query          │                                                            │
│  └───────────┬─────────────┘                                                            │
│              │                                                                          │
│              ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  NETWORK POLICY (Calico/Cilium)                                                  │   │
│  │  ├── Allow: TCP 80, 443 (HTTP/HTTPS)                                            │   │
│  │  ├── Allow: UDP 53 (DNS to internal resolver)                                   │   │
│  │  ├── Allow: TCP 22 (SSH to approved hosts)                                      │   │
│  │  ├── Block: All other egress                                                    │   │
│  │  └── Log: All connections                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│              │                                                                          │
│              ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  EGRESS PROXY (Envoy/Squid)                                                      │   │
│  │  ├── TLS inspection (optional)                                                   │   │
│  │  ├── URL filtering                                                               │   │
│  │  ├── Rate limiting                                                               │   │
│  │  └── Request logging                                                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│              │                                                                          │
│              ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  INTERNET                                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Kubernetes Network Policy

```yaml
# egress-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sandbox-egress
  namespace: sandboxes
spec:
  podSelector:
    matchLabels:
      app: sandbox
  policyTypes:
  - Egress
  egress:
  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  
  # Allow HTTP/HTTPS to anywhere
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8      # Block internal networks
        - 172.16.0.0/12
        - 192.168.0.0/16
        - 169.254.0.0/16  # Block link-local
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
  
  # Allow SSH to approved hosts
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
    ports:
    - protocol: TCP
      port: 22
```

### Egress Proxy Implementation

```typescript
// egress-proxy.ts

import express from 'express';
import httpProxy from 'http-proxy';
import { URL } from 'url';

interface EgressConfig {
  blockedDomains: string[];
  blockedPatterns: RegExp[];
  rateLimitPerMinute: number;
  maxRequestSize: number;
  logAllRequests: boolean;
}

const defaultEgressConfig: EgressConfig = {
  blockedDomains: [
    'localhost',
    '127.0.0.1',
    '*.internal',
    '*.local',
    'metadata.google.internal',
    '169.254.169.254',  // AWS metadata
  ],
  blockedPatterns: [
    /cryptocurrency/i,
    /mining/i,
    /torrent/i,
  ],
  rateLimitPerMinute: 1000,
  maxRequestSize: 100 * 1024 * 1024,  // 100 MB
  logAllRequests: true,
};

class EgressProxy {
  private config: EgressConfig;
  private proxy: httpProxy;
  private requestCounts: Map<string, number> = new Map();
  private logger: any;
  
  constructor(config: Partial<EgressConfig> = {}) {
    this.config = { ...defaultEgressConfig, ...config };
    this.proxy = httpProxy.createProxyServer({});
    this.setupProxy();
  }
  
  private setupProxy(): void {
    // Log proxy errors
    this.proxy.on('error', (err, req, res) => {
      this.logger.error('Proxy error', { error: err.message, url: req.url });
      (res as any).writeHead(502, { 'Content-Type': 'text/plain' });
      (res as any).end('Bad Gateway');
    });
    
    // Log responses
    this.proxy.on('proxyRes', (proxyRes, req, res) => {
      this.logRequest(req, proxyRes.statusCode || 0);
    });
  }
  
  /**
   * Create Express middleware
   */
  middleware(): express.RequestHandler {
    return async (req, res, next) => {
      const sandboxId = req.headers['x-sandbox-id'] as string;
      const targetUrl = req.headers['x-target-url'] as string;
      
      if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target URL' });
      }
      
      // Validate URL
      const validation = this.validateUrl(targetUrl);
      if (!validation.allowed) {
        this.logBlockedRequest(sandboxId, targetUrl, validation.reason);
        return res.status(403).json({ error: validation.reason });
      }
      
      // Check rate limit
      if (!this.checkRateLimit(sandboxId)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      
      // Proxy request
      const url = new URL(targetUrl);
      this.proxy.web(req, res, {
        target: url.origin,
        changeOrigin: true,
        headers: {
          host: url.host,
        },
      });
    };
  }
  
  /**
   * Validate target URL
   */
  private validateUrl(targetUrl: string): { allowed: boolean; reason?: string } {
    try {
      const url = new URL(targetUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { allowed: false, reason: 'Invalid protocol' };
      }
      
      // Check blocked domains
      for (const blocked of this.config.blockedDomains) {
        if (blocked.startsWith('*.')) {
          const suffix = blocked.slice(2);
          if (url.hostname.endsWith(suffix)) {
            return { allowed: false, reason: `Domain blocked: ${url.hostname}` };
          }
        } else if (url.hostname === blocked) {
          return { allowed: false, reason: `Domain blocked: ${url.hostname}` };
        }
      }
      
      // Check blocked patterns
      for (const pattern of this.config.blockedPatterns) {
        if (pattern.test(targetUrl)) {
          return { allowed: false, reason: 'URL matches blocked pattern' };
        }
      }
      
      // Check for internal IPs
      if (this.isInternalIP(url.hostname)) {
        return { allowed: false, reason: 'Internal IP addresses not allowed' };
      }
      
      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }
  }
  
  /**
   * Check if IP is internal
   */
  private isInternalIP(hostname: string): boolean {
    // Check if it's an IP address
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(hostname)) {
      return false;
    }
    
    const parts = hostname.split('.').map(Number);
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    
    return false;
  }
  
  /**
   * Check rate limit
   */
  private checkRateLimit(sandboxId: string): boolean {
    const key = `${sandboxId}:${Math.floor(Date.now() / 60000)}`;
    const count = (this.requestCounts.get(key) || 0) + 1;
    this.requestCounts.set(key, count);
    
    return count <= this.config.rateLimitPerMinute;
  }
  
  /**
   * Log request
   */
  private logRequest(req: any, statusCode: number): void {
    if (!this.config.logAllRequests) return;
    
    this.logger.info('Egress request', {
      sandboxId: req.headers['x-sandbox-id'],
      method: req.method,
      url: req.headers['x-target-url'],
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Log blocked request
   */
  private logBlockedRequest(
    sandboxId: string,
    url: string,
    reason: string
  ): void {
    this.logger.warn('Blocked egress request', {
      sandboxId,
      url,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}

export { EgressProxy, EgressConfig };
```

---

## DNS Resolution

### Strategy: Custom Internal Resolver

We use a **custom DNS resolver** for sandboxes with filtering and logging.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           DNS RESOLUTION ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SANDBOX                                                                                │
│  ┌─────────────────────────┐                                                            │
│  │  /etc/resolv.conf       │                                                            │
│  │  nameserver 10.0.0.53   │──────────────────────────────────────────────┐            │
│  └─────────────────────────┘                                              │            │
│                                                                           ▼            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  INTERNAL DNS RESOLVER (CoreDNS)                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐│   │
│  │  │  1. Query logging                                                           ││   │
│  │  │  2. Blocklist filtering (malware, ads, tracking)                           ││   │
│  │  │  3. Internal service resolution (*.internal)                               ││   │
│  │  │  4. Rate limiting                                                          ││   │
│  │  │  5. Forward to upstream (Cloudflare/Google)                                ││   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                              │                                          │
│                                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  UPSTREAM DNS                                                                    │   │
│  │  ├── 1.1.1.1 (Cloudflare)                                                       │   │
│  │  ├── 8.8.8.8 (Google)                                                           │   │
│  │  └── 9.9.9.9 (Quad9 - malware filtering)                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### CoreDNS Configuration

```
# Corefile
.:53 {
    # Logging
    log . {
        class all
    }
    
    # Prometheus metrics
    prometheus :9153
    
    # Health check
    health :8080
    
    # Ready check
    ready :8181
    
    # Error handling
    errors
    
    # Cache responses
    cache 300
    
    # Block malicious domains
    hosts /etc/coredns/blocklist.hosts {
        fallthrough
    }
    
    # Internal service resolution
    template IN A internal {
        match ^(?P<service>[a-z0-9-]+)\.internal\.$
        answer "{{ .Name }} 60 IN A 10.0.0.{{ .Group.service | hash | mod 254 | add 1 }}"
    }
    
    # Block metadata endpoints
    template IN A {
        match ^metadata\.google\.internal\.$
        rcode NXDOMAIN
    }
    
    template IN A {
        match ^169\.254\.169\.254$
        rcode NXDOMAIN
    }
    
    # Forward to upstream
    forward . 1.1.1.1 8.8.8.8 9.9.9.9 {
        policy round_robin
        health_check 5s
        max_concurrent 1000
    }
    
    # Rate limiting
    ratelimit 100 {
        whitelist 10.0.0.0/8
    }
}
```

### DNS Resolver Implementation

```typescript
// dns-resolver.ts

import dgram from 'dgram';
import dns from 'dns';
import { promisify } from 'util';

interface DNSConfig {
  listenPort: number;
  upstreamServers: string[];
  blocklist: Set<string>;
  rateLimit: number;
  cacheTTL: number;
}

const defaultDNSConfig: DNSConfig = {
  listenPort: 53,
  upstreamServers: ['1.1.1.1', '8.8.8.8', '9.9.9.9'],
  blocklist: new Set([
    'metadata.google.internal',
    '169.254.169.254',
    'localhost',
  ]),
  rateLimit: 100,  // queries per second
  cacheTTL: 300,   // 5 minutes
};

class DNSResolver {
  private config: DNSConfig;
  private server: dgram.Socket;
  private cache: Map<string, { response: Buffer; expires: number }> = new Map();
  private rateLimiter: Map<string, number> = new Map();
  private logger: any;
  
  constructor(config: Partial<DNSConfig> = {}) {
    this.config = { ...defaultDNSConfig, ...config };
    this.server = dgram.createSocket('udp4');
    this.setupServer();
  }
  
  private setupServer(): void {
    this.server.on('message', async (msg, rinfo) => {
      try {
        await this.handleQuery(msg, rinfo);
      } catch (error) {
        this.logger.error('DNS query error', { error });
      }
    });
    
    this.server.on('error', (error) => {
      this.logger.error('DNS server error', { error });
    });
  }
  
  /**
   * Start DNS server
   */
  start(): void {
    this.server.bind(this.config.listenPort, '0.0.0.0', () => {
      this.logger.info(`DNS server listening on port ${this.config.listenPort}`);
    });
  }
  
  /**
   * Handle DNS query
   */
  private async handleQuery(msg: Buffer, rinfo: dgram.RemoteInfo): Promise<void> {
    const query = this.parseQuery(msg);
    const clientIP = rinfo.address;
    
    // Log query
    this.logQuery(clientIP, query.name, query.type);
    
    // Rate limiting
    if (!this.checkRateLimit(clientIP)) {
      this.logger.warn('DNS rate limit exceeded', { clientIP });
      return;  // Drop query
    }
    
    // Check blocklist
    if (this.isBlocked(query.name)) {
      this.logger.info('DNS query blocked', { domain: query.name, clientIP });
      const response = this.createNXDOMAINResponse(msg);
      this.server.send(response, rinfo.port, rinfo.address);
      return;
    }
    
    // Check cache
    const cacheKey = `${query.name}:${query.type}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      // Update transaction ID
      const response = Buffer.from(cached.response);
      response.writeUInt16BE(msg.readUInt16BE(0), 0);
      this.server.send(response, rinfo.port, rinfo.address);
      return;
    }
    
    // Forward to upstream
    const response = await this.forwardQuery(msg);
    
    // Cache response
    this.cache.set(cacheKey, {
      response,
      expires: Date.now() + this.config.cacheTTL * 1000,
    });
    
    // Send response
    this.server.send(response, rinfo.port, rinfo.address);
  }
  
  /**
   * Parse DNS query
   */
  private parseQuery(msg: Buffer): { name: string; type: number } {
    // Skip header (12 bytes)
    let offset = 12;
    
    // Parse domain name
    const labels: string[] = [];
    while (msg[offset] !== 0) {
      const length = msg[offset];
      offset++;
      labels.push(msg.slice(offset, offset + length).toString());
      offset += length;
    }
    offset++;  // Skip null terminator
    
    const type = msg.readUInt16BE(offset);
    
    return {
      name: labels.join('.'),
      type,
    };
  }
  
  /**
   * Check if domain is blocked
   */
  private isBlocked(domain: string): boolean {
    // Exact match
    if (this.config.blocklist.has(domain)) {
      return true;
    }
    
    // Wildcard match
    const parts = domain.split('.');
    for (let i = 0; i < parts.length; i++) {
      const wildcard = '*.' + parts.slice(i).join('.');
      if (this.config.blocklist.has(wildcard)) {
        return true;
      }
    }
    
    // Check for internal/metadata patterns
    if (domain.endsWith('.internal') || domain.includes('metadata')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check rate limit
   */
  private checkRateLimit(clientIP: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const key = `${clientIP}:${now}`;
    
    const count = (this.rateLimiter.get(key) || 0) + 1;
    this.rateLimiter.set(key, count);
    
    // Cleanup old entries
    for (const [k] of this.rateLimiter) {
      if (!k.endsWith(`:${now}`)) {
        this.rateLimiter.delete(k);
      }
    }
    
    return count <= this.config.rateLimit;
  }
  
  /**
   * Forward query to upstream
   */
  private async forwardQuery(msg: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const upstream = this.config.upstreamServers[
        Math.floor(Math.random() * this.config.upstreamServers.length)
      ];
      
      const client = dgram.createSocket('udp4');
      
      client.on('message', (response) => {
        client.close();
        resolve(response);
      });
      
      client.on('error', (error) => {
        client.close();
        reject(error);
      });
      
      // Timeout
      setTimeout(() => {
        client.close();
        reject(new Error('DNS query timeout'));
      }, 5000);
      
      client.send(msg, 53, upstream);
    });
  }
  
  /**
   * Create NXDOMAIN response
   */
  private createNXDOMAINResponse(query: Buffer): Buffer {
    const response = Buffer.from(query);
    
    // Set response flags
    response[2] = 0x81;  // QR=1, OPCODE=0, AA=0, TC=0, RD=1
    response[3] = 0x83;  // RA=1, RCODE=3 (NXDOMAIN)
    
    // Set answer count to 0
    response.writeUInt16BE(0, 6);
    
    return response;
  }
  
  /**
   * Log DNS query
   */
  private logQuery(clientIP: string, domain: string, type: number): void {
    this.logger.info('DNS query', {
      clientIP,
      domain,
      type: this.getTypeName(type),
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Get DNS type name
   */
  private getTypeName(type: number): string {
    const types: Record<number, string> = {
      1: 'A',
      28: 'AAAA',
      5: 'CNAME',
      15: 'MX',
      16: 'TXT',
      2: 'NS',
      6: 'SOA',
    };
    return types[type] || `TYPE${type}`;
  }
}

export { DNSResolver, DNSConfig };
```

---

## Secrets Injection

### Strategy: Secure Environment Variables

We inject secrets via **environment variables** with secure handling.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SECRETS INJECTION ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER                                                                                   │
│  ┌─────────────────────────┐                                                            │
│  │  Set secret via UI/API  │                                                            │
│  └───────────┬─────────────┘                                                            │
│              │                                                                          │
│              ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SECRETS MANAGER (HashiCorp Vault / AWS Secrets Manager)                         │   │
│  │  ├── Encrypted at rest (AES-256)                                                 │   │
│  │  ├── Access control (per-sandbox)                                                │   │
│  │  ├── Audit logging                                                               │   │
│  │  └── Automatic rotation                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│              │                                                                          │
│              │ Sandbox start                                                            │
│              ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SECRETS INJECTOR (Init Container / Sidecar)                                     │   │
│  │  ├── Fetch secrets from Vault                                                    │   │
│  │  ├── Inject as environment variables                                             │   │
│  │  ├── Mount as files (optional)                                                   │   │
│  │  └── Mask in logs                                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│              │                                                                          │
│              ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  SANDBOX                                                                         │   │
│  │  ├── process.env.API_KEY = "***"                                                │   │
│  │  ├── process.env.DATABASE_URL = "***"                                           │   │
│  │  └── /run/secrets/api_key (file mount)                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Secrets Manager Implementation

```typescript
// secrets-manager.ts

import Vault from 'node-vault';
import crypto from 'crypto';

interface Secret {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface SecretsConfig {
  vaultAddr: string;
  vaultToken: string;
  encryptionKey: string;
  secretsPath: string;
}

class SecretsManager {
  private vault: any;
  private config: SecretsConfig;
  private encryptionKey: Buffer;
  
  constructor(config: SecretsConfig) {
    this.config = config;
    this.vault = Vault({
      apiVersion: 'v1',
      endpoint: config.vaultAddr,
      token: config.vaultToken,
    });
    this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
  }
  
  /**
   * Store secret for sandbox
   */
  async storeSecret(
    sandboxId: string,
    key: string,
    value: string
  ): Promise<void> {
    // Encrypt value before storing
    const encrypted = this.encrypt(value);
    
    const path = `${this.config.secretsPath}/${sandboxId}/${key}`;
    
    await this.vault.write(path, {
      data: {
        value: encrypted,
        createdAt: new Date().toISOString(),
      },
    });
    
    // Audit log
    await this.auditLog('store', sandboxId, key);
  }
  
  /**
   * Get secret for sandbox
   */
  async getSecret(sandboxId: string, key: string): Promise<string | null> {
    try {
      const path = `${this.config.secretsPath}/${sandboxId}/${key}`;
      const result = await this.vault.read(path);
      
      if (!result?.data?.data?.value) {
        return null;
      }
      
      // Decrypt value
      const decrypted = this.decrypt(result.data.data.value);
      
      // Audit log
      await this.auditLog('read', sandboxId, key);
      
      return decrypted;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Get all secrets for sandbox
   */
  async getAllSecrets(sandboxId: string): Promise<Record<string, string>> {
    const path = `${this.config.secretsPath}/${sandboxId}`;
    
    try {
      const result = await this.vault.list(path);
      const keys = result?.data?.keys || [];
      
      const secrets: Record<string, string> = {};
      
      for (const key of keys) {
        const value = await this.getSecret(sandboxId, key);
        if (value) {
          secrets[key] = value;
        }
      }
      
      return secrets;
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return {};
      }
      throw error;
    }
  }
  
  /**
   * Delete secret
   */
  async deleteSecret(sandboxId: string, key: string): Promise<void> {
    const path = `${this.config.secretsPath}/${sandboxId}/${key}`;
    await this.vault.delete(path);
    
    // Audit log
    await this.auditLog('delete', sandboxId, key);
  }
  
  /**
   * Delete all secrets for sandbox
   */
  async deleteAllSecrets(sandboxId: string): Promise<void> {
    const secrets = await this.getAllSecrets(sandboxId);
    
    for (const key of Object.keys(secrets)) {
      await this.deleteSecret(sandboxId, key);
    }
  }
  
  /**
   * Encrypt value
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  /**
   * Decrypt value
   */
  private decrypt(encrypted: string): string {
    const [ivHex, authTagHex, data] = encrypted.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Audit log
   */
  private async auditLog(
    action: string,
    sandboxId: string,
    key: string
  ): Promise<void> {
    // Log to audit system
    console.log(JSON.stringify({
      type: 'secrets_audit',
      action,
      sandboxId,
      key,
      timestamp: new Date().toISOString(),
    }));
  }
}

export { SecretsManager, Secret, SecretsConfig };
```

### Kubernetes Secrets Injection

```yaml
# secrets-injection-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-abc123
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "sandbox"
    vault.hashicorp.com/agent-inject-secret-api-key: "secret/sandboxes/abc123/API_KEY"
    vault.hashicorp.com/agent-inject-template-api-key: |
      {{- with secret "secret/sandboxes/abc123/API_KEY" -}}
      export API_KEY="{{ .Data.data.value }}"
      {{- end -}}
spec:
  serviceAccountName: sandbox-sa
  containers:
  - name: sandbox
    image: sandbox:latest
    env:
    # Non-sensitive config
    - name: NODE_ENV
      value: "production"
    # Secrets from Kubernetes secrets
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: sandbox-abc123-secrets
          key: DATABASE_URL
    volumeMounts:
    - name: secrets
      mountPath: /run/secrets
      readOnly: true
  volumes:
  - name: secrets
    secret:
      secretName: sandbox-abc123-secrets
      defaultMode: 0400
```

---

## Container Escape Testing

### Strategy: Regular Automated Testing

We **regularly test for container escapes** using multiple tools and techniques.

### Testing Tools

| Tool | Purpose | Frequency |
|------|---------|-----------|
| **Trivy** | Container vulnerability scanning | Every build |
| **Falco** | Runtime security monitoring | Continuous |
| **kube-hunter** | Kubernetes penetration testing | Weekly |
| **Peirates** | Kubernetes attack toolkit | Monthly |
| **Deepfence** | Cloud-native security | Continuous |
| **Custom scripts** | Escape attempt simulation | Daily |

### Automated Escape Testing

```typescript
// escape-tester.ts

interface EscapeTestResult {
  testName: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

class ContainerEscapeTester {
  private sandboxId: string;
  private results: EscapeTestResult[] = [];
  
  constructor(sandboxId: string) {
    this.sandboxId = sandboxId;
  }
  
  /**
   * Run all escape tests
   */
  async runAllTests(): Promise<EscapeTestResult[]> {
    this.results = [];
    
    // Namespace escape tests
    await this.testNamespaceEscape();
    
    // Filesystem escape tests
    await this.testFilesystemEscape();
    
    // Network escape tests
    await this.testNetworkEscape();
    
    // Privilege escalation tests
    await this.testPrivilegeEscalation();
    
    // Kernel exploit tests
    await this.testKernelExploits();
    
    // Metadata service tests
    await this.testMetadataAccess();
    
    return this.results;
  }
  
  /**
   * Test namespace escape attempts
   */
  private async testNamespaceEscape(): Promise<void> {
    // Test: unshare syscall
    try {
      await execInSandbox(this.sandboxId, 'unshare -U id');
      this.results.push({
        testName: 'unshare_user_namespace',
        passed: false,
        details: 'unshare succeeded - potential escape vector',
        severity: 'critical',
      });
    } catch {
      this.results.push({
        testName: 'unshare_user_namespace',
        passed: true,
        details: 'unshare blocked as expected',
        severity: 'critical',
      });
    }
    
    // Test: setns syscall
    try {
      await execInSandbox(this.sandboxId, 
        'nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/sh -c "id"'
      );
      this.results.push({
        testName: 'nsenter_host_namespace',
        passed: false,
        details: 'nsenter to host namespace succeeded',
        severity: 'critical',
      });
    } catch {
      this.results.push({
        testName: 'nsenter_host_namespace',
        passed: true,
        details: 'nsenter blocked as expected',
        severity: 'critical',
      });
    }
  }
  
  /**
   * Test filesystem escape attempts
   */
  private async testFilesystemEscape(): Promise<void> {
    // Test: /proc/1/root access
    try {
      await execInSandbox(this.sandboxId, 'cat /proc/1/root/etc/passwd');
      this.results.push({
        testName: 'proc_root_access',
        passed: false,
        details: 'Accessed host filesystem via /proc/1/root',
        severity: 'critical',
      });
    } catch {
      this.results.push({
        testName: 'proc_root_access',
        passed: true,
        details: '/proc/1/root access blocked',
        severity: 'critical',
      });
    }
    
    // Test: mount syscall
    try {
      await execInSandbox(this.sandboxId, 'mount -t proc proc /mnt');
      this.results.push({
        testName: 'mount_syscall',
        passed: false,
        details: 'mount syscall succeeded',
        severity: 'critical',
      });
    } catch {
      this.results.push({
        testName: 'mount_syscall',
        passed: true,
        details: 'mount syscall blocked',
        severity: 'critical',
      });
    }
    
    // Test: symlink escape
    try {
      await execInSandbox(this.sandboxId, 
        'ln -s /proc/1/root/etc/shadow /tmp/shadow && cat /tmp/shadow'
      );
      this.results.push({
        testName: 'symlink_escape',
        passed: false,
        details: 'Symlink escape succeeded',
        severity: 'high',
      });
    } catch {
      this.results.push({
        testName: 'symlink_escape',
        passed: true,
        details: 'Symlink escape blocked',
        severity: 'high',
      });
    }
  }
  
  /**
   * Test network escape attempts
   */
  private async testNetworkEscape(): Promise<void> {
    // Test: access to internal services
    try {
      const result = await execInSandbox(this.sandboxId, 
        'curl -s --connect-timeout 2 http://10.0.0.1:6443/api'
      );
      if (result.stdout.includes('Unauthorized') || result.stdout.includes('api')) {
        this.results.push({
          testName: 'kubernetes_api_access',
          passed: false,
          details: 'Kubernetes API accessible from sandbox',
          severity: 'critical',
        });
      }
    } catch {
      this.results.push({
        testName: 'kubernetes_api_access',
        passed: true,
        details: 'Kubernetes API not accessible',
        severity: 'critical',
      });
    }
    
    // Test: access to metadata service
    try {
      await execInSandbox(this.sandboxId, 
        'curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/'
      );
      this.results.push({
        testName: 'metadata_service_access',
        passed: false,
        details: 'Cloud metadata service accessible',
        severity: 'critical',
      });
    } catch {
      this.results.push({
        testName: 'metadata_service_access',
        passed: true,
        details: 'Metadata service blocked',
        severity: 'critical',
      });
    }
  }
  
  /**
   * Test privilege escalation attempts
   */
  private async testPrivilegeEscalation(): Promise<void> {
    // Test: setuid
    try {
      await execInSandbox(this.sandboxId, 
        'cp /bin/sh /tmp/sh && chmod u+s /tmp/sh && /tmp/sh -c "id"'
      );
      this.results.push({
        testName: 'setuid_binary',
        passed: false,
        details: 'setuid binary creation succeeded',
        severity: 'high',
      });
    } catch {
      this.results.push({
        testName: 'setuid_binary',
        passed: true,
        details: 'setuid blocked (nosuid mount)',
        severity: 'high',
      });
    }
    
    // Test: capabilities
    try {
      const result = await execInSandbox(this.sandboxId, 'capsh --print');
      if (result.stdout.includes('cap_sys_admin') || 
          result.stdout.includes('cap_net_admin')) {
        this.results.push({
          testName: 'dangerous_capabilities',
          passed: false,
          details: 'Dangerous capabilities present',
          severity: 'critical',
        });
      } else {
        this.results.push({
          testName: 'dangerous_capabilities',
          passed: true,
          details: 'No dangerous capabilities',
          severity: 'critical',
        });
      }
    } catch {
      this.results.push({
        testName: 'dangerous_capabilities',
        passed: true,
        details: 'capsh not available (good)',
        severity: 'critical',
      });
    }
  }
  
  /**
   * Test kernel exploit vectors
   */
  private async testKernelExploits(): Promise<void> {
    // Test: /dev access
    const dangerousDevices = ['/dev/mem', '/dev/kmem', '/dev/port'];
    
    for (const device of dangerousDevices) {
      try {
        await execInSandbox(this.sandboxId, `cat ${device} 2>/dev/null | head -c 1`);
        this.results.push({
          testName: `device_access_${device.replace(/\//g, '_')}`,
          passed: false,
          details: `${device} is accessible`,
          severity: 'critical',
        });
      } catch {
        this.results.push({
          testName: `device_access_${device.replace(/\//g, '_')}`,
          passed: true,
          details: `${device} blocked`,
          severity: 'critical',
        });
      }
    }
    
    // Test: kernel module loading
    try {
      await execInSandbox(this.sandboxId, 'insmod /tmp/test.ko');
      this.results.push({
        testName: 'kernel_module_load',
        passed: false,
        details: 'Kernel module loading possible',
        severity: 'critical',
      });
    } catch {
      this.results.push({
        testName: 'kernel_module_load',
        passed: true,
        details: 'Kernel module loading blocked',
        severity: 'critical',
      });
    }
  }
  
  /**
   * Test metadata service access
   */
  private async testMetadataAccess(): Promise<void> {
    const metadataEndpoints = [
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://169.254.169.254/metadata/instance',
    ];
    
    for (const endpoint of metadataEndpoints) {
      try {
        await execInSandbox(this.sandboxId, 
          `curl -s --connect-timeout 2 -H "Metadata-Flavor: Google" "${endpoint}"`
        );
        this.results.push({
          testName: `metadata_${new URL(endpoint).hostname}`,
          passed: false,
          details: `Metadata endpoint accessible: ${endpoint}`,
          severity: 'critical',
        });
      } catch {
        this.results.push({
          testName: `metadata_${new URL(endpoint).hostname}`,
          passed: true,
          details: `Metadata endpoint blocked: ${endpoint}`,
          severity: 'critical',
        });
      }
    }
  }
  
  /**
   * Generate test report
   */
  generateReport(): string {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const critical = this.results.filter(r => !r.passed && r.severity === 'critical').length;
    
    let report = `# Container Escape Test Report\n\n`;
    report += `**Sandbox ID:** ${this.sandboxId}\n`;
    report += `**Date:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Passed:** ${passed}\n`;
    report += `- **Failed:** ${failed}\n`;
    report += `- **Critical Failures:** ${critical}\n\n`;
    report += `## Results\n\n`;
    
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      report += `### ${status} ${result.testName}\n`;
      report += `- **Severity:** ${result.severity}\n`;
      report += `- **Details:** ${result.details}\n\n`;
    }
    
    return report;
  }
}

export { ContainerEscapeTester, EscapeTestResult };
```

### CI/CD Integration

```yaml
# .github/workflows/security-tests.yml
name: Container Security Tests

on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  push:
    branches: [main]

jobs:
  escape-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Build test container
      run: docker build -t sandbox-test .
    
    - name: Run Trivy scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: sandbox-test
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
    
    - name: Run escape tests
      run: |
        docker run --rm \
          --security-opt seccomp=seccomp-profile.json \
          --security-opt apparmor=sandbox-profile \
          --cap-drop ALL \
          sandbox-test \
          /tests/run-escape-tests.sh
    
    - name: Run kube-hunter
      run: |
        kubectl apply -f kube-hunter-job.yaml
        kubectl wait --for=condition=complete job/kube-hunter
        kubectl logs job/kube-hunter
    
    - name: Upload results
      uses: actions/upload-artifact@v3
      with:
        name: security-test-results
        path: results/
```

---

## Summary

### Security Implementation Overview

| Area | Implementation | Monitoring |
|------|---------------|------------|
| **Syscalls** | seccomp-bpf with audit | All blocked syscalls logged |
| **Network Egress** | Allow HTTP/S with proxy | All requests logged |
| **DNS** | Custom resolver with filtering | All queries logged |
| **Secrets** | Vault + encrypted injection | Access audited |
| **Escape Testing** | Automated daily tests | CI/CD integration |

### Syscall Audit Events

| Event Type | Action | Alert Threshold |
|------------|--------|-----------------|
| ptrace | Log + Block | 1 attempt |
| mount | Log + Block | 1 attempt |
| init_module | Log + Kill | 1 attempt |
| bpf | Log + Block | 5 attempts |
| Rapid syscalls | Log | 100/minute |

### Network Egress Rules

| Protocol | Port | Action |
|----------|------|--------|
| HTTP | 80 | Allow + Log |
| HTTPS | 443 | Allow + Log |
| SSH | 22 | Allow + Log |
| DNS | 53 | Internal only |
| Other | * | Block |

### Escape Test Categories

| Category | Tests | Frequency |
|----------|-------|-----------|
| Namespace | unshare, setns, nsenter | Daily |
| Filesystem | /proc, mount, symlink | Daily |
| Network | K8s API, metadata | Daily |
| Privilege | setuid, capabilities | Daily |
| Kernel | devices, modules | Daily |
