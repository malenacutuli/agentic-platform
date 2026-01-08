# Privilege Escalation Prevention

This guide provides comprehensive coverage of privilege escalation prevention techniques for secure sandbox execution, including user namespace configuration, capability management, root prevention, and defense-in-depth strategies.

---

## Table of Contents

1. [Overview](#overview)
2. [Attack Vectors](#attack-vectors)
3. [User Namespace Configuration](#user-namespace-configuration)
4. [Capability Management](#capability-management)
5. [Root Prevention](#root-prevention)
6. [NO_NEW_PRIVS Flag](#no_new_privs-flag)
7. [Setuid Binary Prevention](#setuid-binary-prevention)
8. [Defense in Depth](#defense-in-depth)
9. [Monitoring and Detection](#monitoring-and-detection)
10. [Best Practices](#best-practices)

---

## Overview

Privilege escalation is one of the most critical security threats in sandboxed environments. An attacker who gains elevated privileges can escape the sandbox, access sensitive data, or compromise the host system.

### Privilege Escalation Chain

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                      PRIVILEGE ESCALATION PREVENTION LAYERS                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ATTACKER GOAL: uid 1000 (sandbox) → uid 0 (root) → host access                        │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: NON-ROOT USER                                                          │   │
│  │  • Run as uid 1000, not root                                                     │   │
│  │  • No default root access                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: setuid binaries, sudo, su                                      │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: NO SETUID BINARIES                                                     │   │
│  │  • Mount with nosuid                                                             │   │
│  │  • Remove setuid bits from binaries                                              │   │
│  │  • No sudo, su, ping, etc.                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: exploit kernel, load module                                    │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: NO_NEW_PRIVS                                                           │   │
│  │  • prctl(PR_SET_NO_NEW_PRIVS)                                                    │   │
│  │  • Prevents privilege gain via execve                                            │   │
│  │  • Inherited by children                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: use capabilities                                               │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: CAPABILITIES DROPPED                                                   │   │
│  │  • Drop ALL capabilities                                                         │   │
│  │  • No CAP_SYS_ADMIN, CAP_NET_RAW, etc.                                          │   │
│  │  • Bounding set cleared                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: syscall to setuid(0)                                           │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 5: SECCOMP FILTERING                                                      │   │
│  │  • Block setuid, setgid syscalls                                                 │   │
│  │  • Block ptrace, process_vm_*                                                    │   │
│  │  • Block namespace creation                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: create user namespace                                          │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 6: USER NAMESPACE ISOLATION                                               │   │
│  │  • Container root ≠ host root                                                    │   │
│  │  • UID mapping: container 0 → host 100000                                        │   │
│  │  • Even if root in container, unprivileged on host                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: modify files, persist                                          │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 7: READ-ONLY FILESYSTEM                                                   │   │
│  │  • Root filesystem read-only                                                     │   │
│  │  • Only /tmp and /home writable                                                  │   │
│  │  • Cannot modify system binaries                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ Attacker tries: MAC bypass                                                     │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 8: APPARMOR/SELINUX                                                       │   │
│  │  • Mandatory Access Control                                                      │   │
│  │  • Restricts even root                                                           │   │
│  │  • File, network, capability restrictions                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  RESULT: Even if one layer fails, others prevent escalation                            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Attack Vectors

### Common Privilege Escalation Techniques

| Attack Vector | Description | Prevention |
|---------------|-------------|------------|
| Setuid binaries | Exploit sudo, su, ping | nosuid mount, remove binaries |
| Kernel exploits | Exploit kernel vulnerabilities | gVisor, seccomp, updates |
| Capability abuse | Use CAP_SYS_ADMIN | Drop all capabilities |
| User namespace | Create namespace as root | Block CLONE_NEWUSER |
| ptrace | Debug privileged process | Block ptrace syscall |
| /proc exploitation | Access /proc/sys | Restrict /proc mount |
| Cgroup escape | Manipulate cgroups | Read-only cgroup |
| Docker socket | Access docker.sock | Don't mount socket |

### Attack Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRIVILEGE ESCALATION ATTACK TIMELINE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: RECONNAISSANCE                                                    │
│  ├── Check current user: id, whoami                                        │
│  ├── Find setuid binaries: find / -perm -4000                              │
│  ├── Check sudo access: sudo -l                                            │
│  ├── Enumerate capabilities: capsh --print                                 │
│  └── Check kernel version: uname -a                                        │
│                                                                             │
│  PHASE 2: EXPLOITATION ATTEMPTS                                            │
│  ├── Try setuid binaries: sudo, su, pkexec                                │
│  ├── Try capability abuse: setcap, getcap                                  │
│  ├── Try namespace creation: unshare -r                                    │
│  ├── Try ptrace: gdb -p <pid>                                              │
│  └── Try kernel exploit: CVE-XXXX-XXXX                                     │
│                                                                             │
│  PHASE 3: BLOCKED BY DEFENSES                                              │
│  ├── setuid: "Operation not permitted" (nosuid)                            │
│  ├── sudo: "command not found" (not installed)                             │
│  ├── unshare: "Operation not permitted" (seccomp)                          │
│  ├── ptrace: "Operation not permitted" (seccomp)                           │
│  └── kernel: syscall blocked (seccomp/gVisor)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Namespace Configuration

### What is User Namespace?

User namespaces allow mapping container UIDs/GIDs to different host UIDs/GIDs. This means:
- Container root (UID 0) maps to unprivileged host user (e.g., UID 100000)
- Even if attacker becomes root inside container, they have no privileges on host

### UID/GID Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER NAMESPACE MAPPING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONTAINER                              HOST                                │
│  ─────────                              ────                                │
│  UID 0 (root)        ───────────────►   UID 100000 (unprivileged)          │
│  UID 1000 (sandbox)  ───────────────►   UID 101000 (unprivileged)          │
│  UID 65534 (nobody)  ───────────────►   UID 165534 (unprivileged)          │
│                                                                             │
│  GID 0 (root)        ───────────────►   GID 100000 (unprivileged)          │
│  GID 1000 (sandbox)  ───────────────►   GID 101000 (unprivileged)          │
│                                                                             │
│  RESULT: Container "root" has NO host privileges                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration Files

```bash
# /etc/subuid - Subordinate user IDs
sandbox:100000:65536

# /etc/subgid - Subordinate group IDs
sandbox:100000:65536
```

### Docker User Namespace Configuration

```json
// /etc/docker/daemon.json
{
  "userns-remap": "sandbox"
}
```

### Kubernetes User Namespace

```yaml
# kubernetes-userns.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  hostUsers: false  # Enable user namespace
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
    - name: sandbox
      image: sandbox:latest
      securityContext:
        runAsNonRoot: true
```

### Implementation

```typescript
// src/services/userNamespace.ts

interface UserNamespaceConfig {
  enabled: boolean;
  uidMap: UidMapping[];
  gidMap: GidMapping[];
}

interface UidMapping {
  containerUid: number;
  hostUid: number;
  size: number;
}

interface GidMapping {
  containerGid: number;
  hostGid: number;
  size: number;
}

class UserNamespaceManager {
  private config: UserNamespaceConfig;
  
  constructor() {
    this.config = {
      enabled: true,
      uidMap: [
        { containerUid: 0, hostUid: 100000, size: 65536 },
      ],
      gidMap: [
        { containerGid: 0, hostGid: 100000, size: 65536 },
      ],
    };
  }
  
  getDockerArgs(): string[] {
    if (!this.config.enabled) return [];
    
    return ['--userns=host'];  // Or use daemon-level remapping
  }
  
  getKubernetesSpec(): object {
    return {
      hostUsers: false,
      securityContext: {
        runAsUser: 1000,
        runAsGroup: 1000,
        fsGroup: 1000,
      },
    };
  }
  
  mapContainerUidToHost(containerUid: number): number {
    for (const mapping of this.config.uidMap) {
      if (containerUid >= mapping.containerUid && 
          containerUid < mapping.containerUid + mapping.size) {
        return mapping.hostUid + (containerUid - mapping.containerUid);
      }
    }
    return 65534;  // nobody
  }
  
  isHostRoot(containerUid: number): boolean {
    return this.mapContainerUidToHost(containerUid) === 0;
  }
}

export const userNamespaceManager = new UserNamespaceManager();
```

---

## Capability Management

### Linux Capabilities Overview

Linux capabilities divide root privileges into distinct units. Instead of all-or-nothing root, processes can have specific capabilities.

### Capability Categories

| Category | Capabilities | Risk Level |
|----------|--------------|------------|
| **System Admin** | CAP_SYS_ADMIN, CAP_SYS_BOOT, CAP_SYS_MODULE | Critical |
| **Process Control** | CAP_SYS_PTRACE, CAP_KILL, CAP_SYS_NICE | High |
| **Network** | CAP_NET_ADMIN, CAP_NET_RAW, CAP_NET_BIND_SERVICE | High |
| **File System** | CAP_CHOWN, CAP_DAC_OVERRIDE, CAP_FOWNER | Medium |
| **User/Group** | CAP_SETUID, CAP_SETGID, CAP_SETPCAP | High |
| **Audit** | CAP_AUDIT_CONTROL, CAP_AUDIT_WRITE | Medium |

### Complete Capability List

```typescript
// src/config/capabilities.ts

const ALL_CAPABILITIES = [
  // System administration
  'CAP_SYS_ADMIN',        // Broad system administration
  'CAP_SYS_BOOT',         // Reboot system
  'CAP_SYS_MODULE',       // Load/unload kernel modules
  'CAP_SYS_RAWIO',        // Raw I/O operations
  'CAP_SYS_CHROOT',       // Use chroot
  'CAP_SYS_PTRACE',       // Trace processes
  'CAP_SYS_PACCT',        // Process accounting
  'CAP_SYS_NICE',         // Set process priority
  'CAP_SYS_RESOURCE',     // Override resource limits
  'CAP_SYS_TIME',         // Set system time
  'CAP_SYS_TTY_CONFIG',   // Configure TTY
  
  // Network
  'CAP_NET_ADMIN',        // Network administration
  'CAP_NET_RAW',          // Raw sockets
  'CAP_NET_BIND_SERVICE', // Bind to ports < 1024
  'CAP_NET_BROADCAST',    // Broadcast/multicast
  
  // File system
  'CAP_CHOWN',            // Change file ownership
  'CAP_DAC_OVERRIDE',     // Bypass file permissions
  'CAP_DAC_READ_SEARCH',  // Bypass read/search permissions
  'CAP_FOWNER',           // Bypass ownership checks
  'CAP_FSETID',           // Set file capabilities
  'CAP_LINUX_IMMUTABLE',  // Set immutable flag
  'CAP_MKNOD',            // Create device nodes
  
  // User/Group
  'CAP_SETUID',           // Set UID
  'CAP_SETGID',           // Set GID
  'CAP_SETPCAP',          // Set capabilities
  'CAP_SETFCAP',          // Set file capabilities
  
  // IPC
  'CAP_IPC_LOCK',         // Lock memory
  'CAP_IPC_OWNER',        // Bypass IPC ownership
  
  // Process
  'CAP_KILL',             // Send signals
  'CAP_LEASE',            // File leases
  
  // Audit
  'CAP_AUDIT_CONTROL',    // Audit control
  'CAP_AUDIT_READ',       // Read audit log
  'CAP_AUDIT_WRITE',      // Write audit log
  
  // MAC
  'CAP_MAC_ADMIN',        // MAC administration
  'CAP_MAC_OVERRIDE',     // Override MAC
  
  // Misc
  'CAP_SYSLOG',           // Syslog operations
  'CAP_WAKE_ALARM',       // Set wake alarm
  'CAP_BLOCK_SUSPEND',    // Block suspend
];

// Capabilities to DROP (all of them for sandbox)
const CAPABILITIES_TO_DROP = ALL_CAPABILITIES;

// Capabilities to ADD (none for maximum security)
const CAPABILITIES_TO_ADD: string[] = [];
```

### Docker Capability Configuration

```yaml
# docker-compose.yml
services:
  sandbox:
    cap_drop:
      - ALL
    # cap_add: []  # Add nothing back
```

### Kubernetes Capability Configuration

```yaml
# kubernetes-capabilities.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  containers:
    - name: sandbox
      image: sandbox:latest
      securityContext:
        capabilities:
          drop:
            - ALL
          # add: []  # Add nothing back
```

### Capability Verification

```typescript
// src/tools/verifyCapabilities.ts

import { execSync } from 'child_process';

function verifyCapabilities(containerId: string): void {
  // Get capabilities inside container
  const result = execSync(
    `docker exec ${containerId} capsh --print`,
    { encoding: 'utf-8' }
  );
  
  console.log('Container capabilities:');
  console.log(result);
  
  // Parse and verify
  const lines = result.split('\n');
  for (const line of lines) {
    if (line.startsWith('Current:')) {
      const caps = line.split('=')[1]?.trim();
      if (caps && caps !== '') {
        console.error('WARNING: Container has capabilities:', caps);
      } else {
        console.log('OK: Container has no capabilities');
      }
    }
    
    if (line.startsWith('Bounding set')) {
      const caps = line.split('=')[1]?.trim();
      if (caps && caps !== '') {
        console.error('WARNING: Bounding set not empty:', caps);
      } else {
        console.log('OK: Bounding set is empty');
      }
    }
  }
}
```

---

## Root Prevention

### Running as Non-Root

```dockerfile
# Dockerfile
FROM ubuntu:22.04

# Create non-root user
RUN groupadd -g 1000 sandbox && \
    useradd -u 1000 -g sandbox -m -s /bin/bash sandbox

# Set ownership
RUN chown -R sandbox:sandbox /home/sandbox

# Switch to non-root user
USER sandbox
WORKDIR /home/sandbox

CMD ["/bin/bash"]
```

### Docker Configuration

```yaml
# docker-compose.yml
services:
  sandbox:
    user: "1000:1000"
    read_only: true
    tmpfs:
      - /tmp:size=100M,mode=1777
      - /home/sandbox:size=500M,mode=0755
```

### Kubernetes Configuration

```yaml
# kubernetes-nonroot.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
    - name: sandbox
      image: sandbox:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
```

### Root Prevention Verification

```typescript
// src/tools/verifyNonRoot.ts

import { execSync } from 'child_process';

function verifyNonRoot(containerId: string): void {
  // Check current user
  const uid = execSync(
    `docker exec ${containerId} id -u`,
    { encoding: 'utf-8' }
  ).trim();
  
  if (uid === '0') {
    console.error('FAIL: Container running as root');
  } else {
    console.log(`OK: Container running as UID ${uid}`);
  }
  
  // Check if can become root
  try {
    execSync(`docker exec ${containerId} su - root -c "id"`, {
      encoding: 'utf-8',
    });
    console.error('FAIL: Can escalate to root via su');
  } catch {
    console.log('OK: Cannot escalate to root via su');
  }
  
  // Check sudo
  try {
    execSync(`docker exec ${containerId} sudo id`, {
      encoding: 'utf-8',
    });
    console.error('FAIL: sudo is available');
  } catch {
    console.log('OK: sudo not available');
  }
}
```

---

## NO_NEW_PRIVS Flag

### What is NO_NEW_PRIVS?

The `NO_NEW_PRIVS` flag prevents a process from gaining new privileges through `execve()`. Once set, it cannot be unset and is inherited by all child processes.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NO_NEW_PRIVS PROTECTION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WITHOUT NO_NEW_PRIVS:                                                      │
│  ─────────────────────                                                      │
│  Process (uid 1000) ──execve(/usr/bin/sudo)──► Process (uid 0)             │
│                         setuid bit allows                                   │
│                         privilege escalation                                │
│                                                                             │
│  WITH NO_NEW_PRIVS:                                                         │
│  ──────────────────                                                         │
│  Process (uid 1000) ──execve(/usr/bin/sudo)──► Process (uid 1000)          │
│                         setuid bit IGNORED                                  │
│                         no privilege gain                                   │
│                                                                             │
│  ALSO BLOCKS:                                                               │
│  • File capabilities (CAP_SETUID, etc.)                                    │
│  • Ambient capabilities                                                     │
│  • Setuid/setgid bits                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Setting NO_NEW_PRIVS

```c
// C code
#include <sys/prctl.h>

int main() {
    // Set NO_NEW_PRIVS - cannot be unset
    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) {
        perror("prctl");
        return 1;
    }
    
    // Now execve() cannot gain privileges
    execve("/usr/bin/sudo", args, env);
    // sudo will fail even with setuid bit
}
```

### Docker Configuration

```yaml
# docker-compose.yml
services:
  sandbox:
    security_opt:
      - no-new-privileges:true
```

### Kubernetes Configuration

```yaml
# kubernetes-nonewprivs.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  containers:
    - name: sandbox
      image: sandbox:latest
      securityContext:
        allowPrivilegeEscalation: false  # Sets NO_NEW_PRIVS
```

### Verification

```typescript
// src/tools/verifyNoNewPrivs.ts

import { execSync } from 'child_process';

function verifyNoNewPrivs(containerId: string): void {
  // Check NO_NEW_PRIVS status
  const result = execSync(
    `docker exec ${containerId} cat /proc/self/status | grep NoNewPrivs`,
    { encoding: 'utf-8' }
  ).trim();
  
  if (result.includes('NoNewPrivs:\t1')) {
    console.log('OK: NO_NEW_PRIVS is set');
  } else {
    console.error('FAIL: NO_NEW_PRIVS is not set');
  }
  
  // Try to execute setuid binary
  try {
    execSync(
      `docker exec ${containerId} /usr/bin/sudo id`,
      { encoding: 'utf-8' }
    );
    console.error('FAIL: setuid binary executed successfully');
  } catch {
    console.log('OK: setuid binary blocked');
  }
}
```

---

## Setuid Binary Prevention

### Removing Setuid Binaries

```dockerfile
# Dockerfile
FROM ubuntu:22.04

# Remove all setuid/setgid bits
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

# Remove sudo, su, and other dangerous binaries
RUN apt-get purge -y sudo su passwd && \
    rm -f /usr/bin/sudo /usr/bin/su /usr/bin/passwd /usr/bin/chsh /usr/bin/chfn

# Verify no setuid binaries remain
RUN find / -perm /4000 -type f 2>/dev/null | wc -l | grep -q '^0$'
```

### Mount with nosuid

```yaml
# docker-compose.yml
services:
  sandbox:
    tmpfs:
      - /tmp:size=100M,mode=1777,nosuid,noexec
      - /home/sandbox:size=500M,mode=0755,nosuid
```

### Kubernetes Volume Configuration

```yaml
# kubernetes-nosuid.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
spec:
  containers:
    - name: sandbox
      image: sandbox:latest
      volumeMounts:
        - name: workspace
          mountPath: /home/sandbox
          # Note: nosuid is default for emptyDir
  volumes:
    - name: workspace
      emptyDir:
        sizeLimit: 500Mi
```

### Setuid Binary Scanner

```typescript
// src/tools/scanSetuidBinaries.ts

import { execSync } from 'child_process';

function scanSetuidBinaries(containerId: string): string[] {
  const result = execSync(
    `docker exec ${containerId} find / -perm /4000 -type f 2>/dev/null`,
    { encoding: 'utf-8' }
  );
  
  const binaries = result.trim().split('\n').filter(Boolean);
  
  if (binaries.length > 0) {
    console.error('WARNING: Found setuid binaries:');
    binaries.forEach(b => console.error(`  - ${b}`));
  } else {
    console.log('OK: No setuid binaries found');
  }
  
  return binaries;
}

function scanSetgidBinaries(containerId: string): string[] {
  const result = execSync(
    `docker exec ${containerId} find / -perm /2000 -type f 2>/dev/null`,
    { encoding: 'utf-8' }
  );
  
  const binaries = result.trim().split('\n').filter(Boolean);
  
  if (binaries.length > 0) {
    console.error('WARNING: Found setgid binaries:');
    binaries.forEach(b => console.error(`  - ${b}`));
  } else {
    console.log('OK: No setgid binaries found');
  }
  
  return binaries;
}
```

---

## Defense in Depth

### Complete Security Configuration

```typescript
// src/config/securityConfig.ts

interface SecurityConfig {
  // User configuration
  runAsUser: number;
  runAsGroup: number;
  runAsNonRoot: boolean;
  
  // Privilege escalation prevention
  allowPrivilegeEscalation: boolean;
  noNewPrivileges: boolean;
  
  // Capabilities
  capabilitiesDrop: string[];
  capabilitiesAdd: string[];
  
  // Filesystem
  readOnlyRootFilesystem: boolean;
  
  // User namespace
  userNamespaceEnabled: boolean;
  
  // seccomp
  seccompProfile: string;
  
  // AppArmor
  apparmorProfile: string;
  
  // SELinux
  selinuxOptions?: {
    type: string;
    level: string;
  };
}

const sandboxSecurityConfig: SecurityConfig = {
  // Run as non-root
  runAsUser: 1000,
  runAsGroup: 1000,
  runAsNonRoot: true,
  
  // Prevent privilege escalation
  allowPrivilegeEscalation: false,
  noNewPrivileges: true,
  
  // Drop all capabilities
  capabilitiesDrop: ['ALL'],
  capabilitiesAdd: [],
  
  // Read-only filesystem
  readOnlyRootFilesystem: true,
  
  // User namespace
  userNamespaceEnabled: true,
  
  // seccomp profile
  seccompProfile: '/etc/seccomp/sandbox.json',
  
  // AppArmor profile
  apparmorProfile: 'sandbox-profile',
  
  // SELinux (if applicable)
  selinuxOptions: {
    type: 'sandbox_t',
    level: 's0:c123,c456',
  },
};
```

### Docker Compose with Full Security

```yaml
# docker-compose-secure.yml
version: '3.8'
services:
  sandbox:
    image: sandbox:latest
    
    # Runtime
    runtime: runsc  # gVisor
    
    # User
    user: "1000:1000"
    
    # Security options
    security_opt:
      - no-new-privileges:true
      - seccomp:/etc/seccomp/sandbox.json
      - apparmor:sandbox-profile
    
    # Capabilities
    cap_drop:
      - ALL
    
    # Filesystem
    read_only: true
    tmpfs:
      - /tmp:size=100M,mode=1777,nosuid,noexec
      - /home/sandbox:size=500M,mode=0755,nosuid
    
    # Resources
    pids_limit: 100
    mem_limit: 2g
    cpus: 1.0
    
    # Network
    networks:
      - sandbox_network
    
networks:
  sandbox_network:
    driver: bridge
    internal: true  # No external access
```

### Kubernetes Pod with Full Security

```yaml
# kubernetes-secure-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
  annotations:
    container.apparmor.security.beta.kubernetes.io/sandbox: localhost/sandbox-profile
spec:
  runtimeClassName: gvisor
  
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: Localhost
      localhostProfile: sandbox.json
  
  containers:
    - name: sandbox
      image: sandbox:latest
      
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      
      resources:
        limits:
          cpu: "1"
          memory: "2Gi"
        requests:
          cpu: "0.5"
          memory: "512Mi"
      
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: workspace
          mountPath: /home/sandbox
  
  volumes:
    - name: tmp
      emptyDir:
        medium: Memory
        sizeLimit: 100Mi
    - name: workspace
      emptyDir:
        sizeLimit: 500Mi
```

---

## Monitoring and Detection

### Privilege Escalation Detection

```typescript
// src/services/privEscDetection.ts

interface PrivEscEvent {
  timestamp: Date;
  sandboxId: string;
  eventType: 'setuid_attempt' | 'capability_request' | 'namespace_creation' | 'ptrace_attempt';
  details: Record<string, any>;
  blocked: boolean;
}

class PrivilegeEscalationDetector {
  private events: PrivEscEvent[] = [];
  
  async detectSetuidAttempt(sandboxId: string, binary: string): Promise<void> {
    const event: PrivEscEvent = {
      timestamp: new Date(),
      sandboxId,
      eventType: 'setuid_attempt',
      details: { binary },
      blocked: true,
    };
    
    this.events.push(event);
    await this.alert(event);
  }
  
  async detectCapabilityRequest(sandboxId: string, capability: string): Promise<void> {
    const event: PrivEscEvent = {
      timestamp: new Date(),
      sandboxId,
      eventType: 'capability_request',
      details: { capability },
      blocked: true,
    };
    
    this.events.push(event);
    await this.alert(event);
  }
  
  async detectNamespaceCreation(sandboxId: string, nsType: string): Promise<void> {
    const event: PrivEscEvent = {
      timestamp: new Date(),
      sandboxId,
      eventType: 'namespace_creation',
      details: { namespaceType: nsType },
      blocked: true,
    };
    
    this.events.push(event);
    await this.alert(event);
  }
  
  async detectPtraceAttempt(sandboxId: string, targetPid: number): Promise<void> {
    const event: PrivEscEvent = {
      timestamp: new Date(),
      sandboxId,
      eventType: 'ptrace_attempt',
      details: { targetPid },
      blocked: true,
    };
    
    this.events.push(event);
    await this.alert(event);
  }
  
  private async alert(event: PrivEscEvent): Promise<void> {
    console.error(`[SECURITY] Privilege escalation attempt detected:`, event);
    
    // Send to alerting system
    // await alertingService.send(event);
    
    // Log to SIEM
    // await siemService.log(event);
  }
  
  getRecentEvents(sandboxId?: string): PrivEscEvent[] {
    if (sandboxId) {
      return this.events.filter(e => e.sandboxId === sandboxId);
    }
    return this.events;
  }
}

export const privEscDetector = new PrivilegeEscalationDetector();
```

### Prometheus Metrics

```typescript
// src/services/securityMetrics.ts

import { Counter, Gauge } from 'prom-client';

const securityMetrics = {
  privEscAttempts: new Counter({
    name: 'sandbox_privilege_escalation_attempts_total',
    help: 'Total privilege escalation attempts',
    labelNames: ['sandbox_id', 'attempt_type'],
  }),
  
  blockedSyscalls: new Counter({
    name: 'sandbox_blocked_syscalls_total',
    help: 'Total blocked syscalls',
    labelNames: ['sandbox_id', 'syscall'],
  }),
  
  capabilityDenials: new Counter({
    name: 'sandbox_capability_denials_total',
    help: 'Total capability denials',
    labelNames: ['sandbox_id', 'capability'],
  }),
  
  securityViolations: new Counter({
    name: 'sandbox_security_violations_total',
    help: 'Total security violations',
    labelNames: ['sandbox_id', 'violation_type'],
  }),
};

export { securityMetrics };
```

### Audit Log Analysis

```typescript
// src/tools/auditAnalysis.ts

interface AuditLogEntry {
  timestamp: Date;
  type: string;
  result: 'success' | 'fail';
  syscall: string;
  uid: number;
  gid: number;
  pid: number;
  exe: string;
}

class AuditLogAnalyzer {
  parseAuditLog(logPath: string): AuditLogEntry[] {
    // Parse Linux audit log
    // type=SYSCALL msg=audit(timestamp): arch=arch syscall=num success=yes/no
    // exit=code a0=arg0 a1=arg1 ... uid=uid gid=gid ...
    return [];
  }
  
  detectPrivEscPatterns(entries: AuditLogEntry[]): string[] {
    const patterns: string[] = [];
    
    // Detect setuid attempts
    const setuidAttempts = entries.filter(e => 
      e.syscall === 'setuid' || e.syscall === 'setreuid' || e.syscall === 'setresuid'
    );
    if (setuidAttempts.length > 0) {
      patterns.push(`Detected ${setuidAttempts.length} setuid attempts`);
    }
    
    // Detect ptrace attempts
    const ptraceAttempts = entries.filter(e => e.syscall === 'ptrace');
    if (ptraceAttempts.length > 0) {
      patterns.push(`Detected ${ptraceAttempts.length} ptrace attempts`);
    }
    
    // Detect namespace creation attempts
    const nsAttempts = entries.filter(e => 
      e.syscall === 'unshare' || e.syscall === 'setns'
    );
    if (nsAttempts.length > 0) {
      patterns.push(`Detected ${nsAttempts.length} namespace creation attempts`);
    }
    
    return patterns;
  }
}
```

---

## Best Practices

### 1. Defense in Depth

```
Always implement multiple layers:
1. Non-root user
2. NO_NEW_PRIVS
3. Capabilities dropped
4. seccomp filtering
5. User namespace
6. AppArmor/SELinux
7. Read-only filesystem
8. gVisor runtime
```

### 2. Principle of Least Privilege

```typescript
// Start with nothing, add only what's needed
const securityConfig = {
  capabilities: [],           // Drop ALL
  syscalls: 'whitelist',      // Only allow needed syscalls
  fileAccess: 'restricted',   // Only workspace directory
  network: 'limited',         // Only required ports
  user: 1000,                 // Non-root
};
```

### 3. Regular Security Audits

```bash
# Scan for vulnerabilities
trivy image sandbox:latest

# Check for misconfigurations
docker bench security

# Verify security settings
./verify-sandbox-security.sh
```

### 4. Monitor and Alert

```yaml
# Alert on privilege escalation attempts
alerts:
  - name: PrivilegeEscalationAttempt
    condition: sandbox_privilege_escalation_attempts_total > 0
    severity: critical
    action: page_oncall
```

### 5. Keep Systems Updated

```bash
# Regular updates
apt-get update && apt-get upgrade -y

# Update container images
docker pull sandbox:latest
```

---

## Summary

### Prevention Layers

| Layer | Technology | Protection |
|-------|------------|------------|
| **User** | Non-root (uid 1000) | No default root |
| **Setuid** | nosuid mount, remove binaries | No setuid escalation |
| **NO_NEW_PRIVS** | prctl flag | No execve escalation |
| **Capabilities** | Drop ALL | No capability abuse |
| **seccomp** | Syscall filtering | Block dangerous syscalls |
| **User Namespace** | UID remapping | Container root ≠ host root |
| **Filesystem** | Read-only root | No persistence |
| **MAC** | AppArmor/SELinux | Mandatory restrictions |

### Security Checklist

- [ ] Running as non-root user (uid 1000)
- [ ] NO_NEW_PRIVS flag set
- [ ] All capabilities dropped
- [ ] seccomp profile applied
- [ ] User namespace enabled
- [ ] Read-only root filesystem
- [ ] No setuid binaries
- [ ] AppArmor/SELinux profile enforced
- [ ] gVisor runtime (optional)
- [ ] Security monitoring enabled

### Attack Surface Reduction

| Attack Vector | Status | Prevention |
|---------------|--------|------------|
| Setuid binaries | ✅ Blocked | nosuid, NO_NEW_PRIVS |
| Capability abuse | ✅ Blocked | Drop ALL capabilities |
| Kernel exploits | ✅ Mitigated | gVisor, seccomp |
| User namespace | ✅ Blocked | seccomp, UID remapping |
| ptrace | ✅ Blocked | seccomp |
| /proc exploitation | ✅ Blocked | Restricted /proc |
| File persistence | ✅ Blocked | Read-only filesystem |
