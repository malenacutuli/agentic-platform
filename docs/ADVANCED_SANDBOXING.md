# Advanced Sandboxing: Defense in Depth

This guide provides comprehensive coverage of multi-layer sandboxing for secure code execution, including gVisor, seccomp profiles, AppArmor/SELinux, and capability management.

---

## Table of Contents

1. [Overview](#overview)
2. [Defense in Depth Architecture](#defense-in-depth-architecture)
3. [Container Runtime Security](#container-runtime-security)
4. [gVisor Integration](#gvisor-integration)
5. [seccomp Profiles](#seccomp-profiles)
6. [AppArmor Profiles](#apparmor-profiles)
7. [SELinux Policies](#selinux-policies)
8. [Linux Capabilities](#linux-capabilities)
9. [Namespace Isolation](#namespace-isolation)
10. [Resource Limits](#resource-limits)
11. [Security Monitoring](#security-monitoring)
12. [Best Practices](#best-practices)

---

## Overview

Secure sandbox execution requires multiple layers of protection. No single security mechanism is sufficient; defense in depth ensures that if one layer fails, others continue to protect the system.

### Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        DEFENSE IN DEPTH - SANDBOXING LAYERS                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 6: APPLICATION SANDBOX                                                    │   │
│  │  • Node.js vm2/isolated-vm for JS execution                                     │   │
│  │  • Python RestrictedPython for Python code                                      │   │
│  │  • WebAssembly for untrusted code                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 5: MANDATORY ACCESS CONTROL (MAC)                                        │   │
│  │  • AppArmor profiles (Ubuntu/Debian)                                            │   │
│  │  • SELinux policies (RHEL/CentOS)                                               │   │
│  │  • Restrict file access, network, capabilities                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: SYSCALL FILTERING (seccomp-BPF)                                       │   │
│  │  • Whitelist allowed syscalls                                                   │   │
│  │  • Block dangerous operations                                                   │   │
│  │  • Argument filtering for fine-grained control                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: CONTAINER RUNTIME (gVisor/Kata)                                       │   │
│  │  • gVisor: User-space kernel (Sentry)                                           │   │
│  │  • Kata Containers: Lightweight VMs                                             │   │
│  │  • Intercept syscalls before host kernel                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: LINUX NAMESPACES & CGROUPS                                            │   │
│  │  • PID namespace: Process isolation                                             │   │
│  │  • Network namespace: Network isolation                                         │   │
│  │  • Mount namespace: Filesystem isolation                                        │   │
│  │  • User namespace: UID/GID mapping                                              │   │
│  │  • cgroups: Resource limits (CPU, memory, I/O)                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: HOST HARDENING                                                        │   │
│  │  • Minimal base image                                                           │   │
│  │  • Regular security updates                                                     │   │
│  │  • Kernel hardening (sysctl)                                                    │   │
│  │  • Read-only root filesystem                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Defense in Depth Architecture

### Attack Surface Comparison

| Attack Vector | Docker Only | + gVisor | + seccomp | + AppArmor | Full Stack |
|---------------|-------------|----------|-----------|------------|------------|
| Kernel exploit | ❌ High | ✅ Low | ✅ Low | ✅ Low | ✅ Minimal |
| Container escape | ⚠️ Medium | ✅ Low | ✅ Low | ✅ Low | ✅ Minimal |
| Syscall abuse | ⚠️ Medium | ✅ Low | ✅ Blocked | ✅ Blocked | ✅ Blocked |
| File access | ⚠️ Medium | ⚠️ Medium | ⚠️ Medium | ✅ Enforced | ✅ Enforced |
| Network abuse | ⚠️ Medium | ✅ Low | ✅ Low | ✅ Enforced | ✅ Enforced |
| Resource DoS | ✅ cgroups | ✅ | ✅ | ✅ | ✅ |
| Privilege escalation | ⚠️ Medium | ✅ Low | ✅ Blocked | ✅ Blocked | ✅ Blocked |

### Security Configuration

```typescript
// src/config/sandboxSecurity.ts

interface SandboxSecurityConfig {
  runtime: 'runc' | 'runsc' | 'kata';
  seccompProfile: string;
  apparmorProfile: string;
  capabilities: string[];
  readOnlyRootfs: boolean;
  noNewPrivileges: boolean;
  userNamespace: boolean;
  resourceLimits: ResourceLimits;
}

const defaultSecurityConfig: SandboxSecurityConfig = {
  runtime: 'runsc',  // gVisor
  seccompProfile: '/etc/seccomp/sandbox.json',
  apparmorProfile: 'sandbox-profile',
  capabilities: [],  // Drop ALL capabilities
  readOnlyRootfs: true,
  noNewPrivileges: true,
  userNamespace: true,
  resourceLimits: {
    cpuShares: 512,
    memoryLimit: '2Gi',
    pidsLimit: 100,
    nofileLimit: 1024,
  },
};
```

---

## Container Runtime Security

### Docker Security Options

```yaml
# docker-compose.yml
version: '3.8'
services:
  sandbox:
    image: sandbox:latest
    runtime: runsc  # gVisor
    security_opt:
      - no-new-privileges:true
      - seccomp:/etc/seccomp/sandbox.json
      - apparmor:sandbox-profile
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:size=100M,mode=1777
      - /home/sandbox:size=500M,mode=0755
    user: "1000:1000"
    userns_mode: "host"
    pids_limit: 100
    mem_limit: 2g
    cpus: 1.0
```

### Kubernetes Pod Security

```yaml
# kubernetes-sandbox-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
  annotations:
    container.apparmor.security.beta.kubernetes.io/sandbox: localhost/sandbox-profile
spec:
  runtimeClassName: gvisor  # Use gVisor runtime
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
          ephemeral-storage: "1Gi"
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

## gVisor Integration

### What is gVisor?

gVisor is a user-space kernel that intercepts application syscalls and implements them in a sandboxed environment, providing an additional layer of isolation between the application and the host kernel.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         gVisor ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  APPLICATION                                                                │
│       │                                                                     │
│       │ syscall()                                                           │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SENTRY (User-space Kernel)                        │   │
│  │                                                                       │   │
│  │  • Implements Linux syscall interface                                │   │
│  │  • Runs in user space (not kernel)                                   │   │
│  │  • Written in Go (memory-safe)                                       │   │
│  │  • ~200 syscalls implemented                                         │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       │ Limited syscalls (only ~50 needed)                                 │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GOFER (File System Proxy)                         │   │
│  │                                                                       │   │
│  │  • Handles file system operations                                    │   │
│  │  • Runs as separate process                                          │   │
│  │  • 9P protocol for communication                                     │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       │ Minimal host syscalls                                              │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    HOST KERNEL                                        │   │
│  │                                                                       │   │
│  │  • Only sees Sentry/Gofer processes                                  │   │
│  │  • Application syscalls never reach host                             │   │
│  │  • Kernel vulnerabilities don't affect sandbox                       │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### gVisor Installation

```bash
# Install gVisor (runsc)
wget https://storage.googleapis.com/gvisor/releases/release/latest/x86_64/runsc
chmod +x runsc
sudo mv runsc /usr/local/bin/

# Configure Docker to use gVisor
cat > /etc/docker/daemon.json << EOF
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc",
      "runtimeArgs": [
        "--platform=ptrace",
        "--network=sandbox"
      ]
    }
  }
}
EOF

sudo systemctl restart docker
```

### gVisor Configuration

```typescript
// src/services/gvisorConfig.ts

interface GVisorConfig {
  platform: 'ptrace' | 'kvm';
  network: 'sandbox' | 'host';
  fileAccess: 'exclusive' | 'shared';
  overlay: boolean;
  debug: boolean;
  strace: boolean;
}

const gvisorConfig: GVisorConfig = {
  platform: 'ptrace',      // Use ptrace for syscall interception
  network: 'sandbox',      // Isolated network stack
  fileAccess: 'exclusive', // Exclusive file access
  overlay: true,           // Use overlay filesystem
  debug: false,            // Disable debug logging
  strace: false,           // Disable syscall tracing
};

function buildRunscArgs(config: GVisorConfig): string[] {
  const args: string[] = [];
  
  args.push(`--platform=${config.platform}`);
  args.push(`--network=${config.network}`);
  args.push(`--file-access=${config.fileAccess}`);
  
  if (config.overlay) {
    args.push('--overlay');
  }
  
  if (config.debug) {
    args.push('--debug');
    args.push('--debug-log=/var/log/runsc/');
  }
  
  if (config.strace) {
    args.push('--strace');
  }
  
  return args;
}
```

### Kubernetes RuntimeClass

```yaml
# gvisor-runtimeclass.yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
scheduling:
  nodeSelector:
    sandbox.gvisor.dev/enabled: "true"
overhead:
  podFixed:
    cpu: "250m"
    memory: "64Mi"
```

---

## seccomp Profiles

### Profile Structure

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_X86",
    "SCMP_ARCH_AARCH64"
  ],
  "syscalls": [
    {
      "names": ["read", "write", "open", "close", "stat", "fstat", "lstat"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": ["clone"],
      "action": "SCMP_ACT_ALLOW",
      "args": [
        {
          "index": 0,
          "value": 2114060288,
          "op": "SCMP_CMP_MASKED_EQ"
        }
      ]
    }
  ]
}
```

### Comprehensive Sandbox Profile

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_AARCH64"
  ],
  "syscalls": [
    {
      "comment": "File I/O - Basic operations",
      "names": [
        "read", "write", "open", "openat", "close",
        "stat", "fstat", "lstat", "fstatat64",
        "lseek", "pread64", "pwrite64",
        "readv", "writev", "preadv", "pwritev",
        "access", "faccessat", "faccessat2"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "File I/O - Directory operations",
      "names": [
        "getdents", "getdents64",
        "mkdir", "mkdirat", "rmdir",
        "rename", "renameat", "renameat2",
        "link", "linkat", "unlink", "unlinkat",
        "symlink", "symlinkat", "readlink", "readlinkat",
        "chdir", "fchdir", "getcwd"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "File I/O - Permissions",
      "names": [
        "chmod", "fchmod", "fchmodat",
        "chown", "fchown", "lchown", "fchownat"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Memory management",
      "names": [
        "mmap", "munmap", "mprotect", "mremap",
        "brk", "madvise", "mlock", "munlock",
        "mlockall", "munlockall"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Process management - Basic",
      "names": [
        "getpid", "getppid", "gettid",
        "getuid", "geteuid", "getgid", "getegid",
        "getgroups", "setgroups",
        "getrlimit", "setrlimit", "prlimit64",
        "getrusage"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Process management - Fork/exec (restricted)",
      "names": ["clone", "clone3"],
      "action": "SCMP_ACT_ALLOW",
      "args": [
        {
          "index": 0,
          "value": 2114060288,
          "valueTwo": 0,
          "op": "SCMP_CMP_MASKED_EQ"
        }
      ]
    },
    {
      "comment": "Process management - Exec",
      "names": ["execve", "execveat"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Process management - Exit",
      "names": ["exit", "exit_group"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Process management - Wait",
      "names": ["wait4", "waitid"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Signals",
      "names": [
        "rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
        "rt_sigsuspend", "rt_sigpending", "rt_sigtimedwait",
        "sigaltstack", "kill", "tgkill", "tkill"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Network - Socket operations",
      "names": [
        "socket", "socketpair", "bind", "listen", "accept", "accept4",
        "connect", "getsockname", "getpeername",
        "sendto", "recvfrom", "sendmsg", "recvmsg",
        "shutdown", "setsockopt", "getsockopt"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Network - Polling",
      "names": [
        "select", "pselect6",
        "poll", "ppoll",
        "epoll_create", "epoll_create1", "epoll_ctl", "epoll_wait", "epoll_pwait"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Time",
      "names": [
        "time", "gettimeofday", "clock_gettime", "clock_getres",
        "nanosleep", "clock_nanosleep"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "IPC - Pipes and FIFOs",
      "names": ["pipe", "pipe2"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "IPC - Shared memory",
      "names": [
        "shmget", "shmat", "shmdt", "shmctl"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "IPC - Semaphores",
      "names": [
        "semget", "semop", "semtimedop", "semctl"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "Misc - Required for basic operation",
      "names": [
        "futex", "set_robust_list", "get_robust_list",
        "set_tid_address", "arch_prctl",
        "prctl", "seccomp",
        "getrandom", "uname",
        "ioctl", "fcntl"
      ],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "comment": "BLOCKED - Dangerous syscalls",
      "names": [
        "mount", "umount", "umount2", "pivot_root",
        "swapon", "swapoff",
        "reboot", "kexec_load", "kexec_file_load",
        "init_module", "finit_module", "delete_module",
        "acct", "settimeofday", "adjtimex", "clock_adjtime",
        "sethostname", "setdomainname",
        "iopl", "ioperm",
        "create_module", "query_module",
        "nfsservctl", "getpmsg", "putpmsg",
        "afs_syscall", "tuxcall", "security",
        "lookup_dcookie", "perf_event_open",
        "fanotify_init", "name_to_handle_at", "open_by_handle_at",
        "bpf", "userfaultfd", "membarrier",
        "pkey_mprotect", "pkey_alloc", "pkey_free",
        "ptrace", "process_vm_readv", "process_vm_writev",
        "kcmp", "keyctl", "request_key", "add_key"
      ],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    }
  ]
}
```

### Generating seccomp Profiles

```typescript
// src/tools/generateSeccompProfile.ts

interface SyscallRule {
  names: string[];
  action: 'SCMP_ACT_ALLOW' | 'SCMP_ACT_ERRNO' | 'SCMP_ACT_KILL' | 'SCMP_ACT_LOG';
  args?: SyscallArg[];
  comment?: string;
}

interface SyscallArg {
  index: number;
  value: number;
  valueTwo?: number;
  op: 'SCMP_CMP_EQ' | 'SCMP_CMP_NE' | 'SCMP_CMP_LT' | 'SCMP_CMP_LE' | 
      'SCMP_CMP_GT' | 'SCMP_CMP_GE' | 'SCMP_CMP_MASKED_EQ';
}

class SeccompProfileGenerator {
  private rules: SyscallRule[] = [];
  
  allowBasicFileIO(): this {
    this.rules.push({
      comment: 'Basic file I/O',
      names: ['read', 'write', 'open', 'openat', 'close', 'stat', 'fstat', 'lstat'],
      action: 'SCMP_ACT_ALLOW',
    });
    return this;
  }
  
  allowNetworking(): this {
    this.rules.push({
      comment: 'Network operations',
      names: ['socket', 'bind', 'listen', 'accept', 'connect', 'sendto', 'recvfrom'],
      action: 'SCMP_ACT_ALLOW',
    });
    return this;
  }
  
  allowProcessManagement(): this {
    this.rules.push({
      comment: 'Process management',
      names: ['fork', 'vfork', 'execve', 'exit', 'exit_group', 'wait4'],
      action: 'SCMP_ACT_ALLOW',
    });
    return this;
  }
  
  blockDangerous(): this {
    this.rules.push({
      comment: 'Dangerous syscalls',
      names: ['mount', 'umount', 'ptrace', 'init_module', 'reboot'],
      action: 'SCMP_ACT_ERRNO',
    });
    return this;
  }
  
  generate(): object {
    return {
      defaultAction: 'SCMP_ACT_ERRNO',
      defaultErrnoRet: 1,
      architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_AARCH64'],
      syscalls: this.rules,
    };
  }
}

// Usage
const profile = new SeccompProfileGenerator()
  .allowBasicFileIO()
  .allowNetworking()
  .allowProcessManagement()
  .blockDangerous()
  .generate();

fs.writeFileSync('/etc/seccomp/sandbox.json', JSON.stringify(profile, null, 2));
```

---

## AppArmor Profiles

### Profile Structure

```
#include <tunables/global>

profile sandbox-profile flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  
  # File access rules
  /home/sandbox/** rw,
  /tmp/** rw,
  
  # Network rules
  network inet stream,
  network inet dgram,
  
  # Capability rules
  deny capability sys_admin,
  deny capability sys_ptrace,
  
  # Deny dangerous operations
  deny mount,
  deny umount,
  deny pivot_root,
}
```

### Comprehensive Sandbox Profile

```
#include <tunables/global>

profile sandbox-profile flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  
  # ===========================================
  # FILE ACCESS RULES
  # ===========================================
  
  # Workspace directory (read/write)
  /home/sandbox/** rwkl,
  /home/sandbox/ r,
  
  # Temporary files
  /tmp/** rwk,
  /var/tmp/** rwk,
  
  # Read-only system files
  /etc/passwd r,
  /etc/group r,
  /etc/nsswitch.conf r,
  /etc/hosts r,
  /etc/resolv.conf r,
  /etc/ssl/** r,
  /etc/ca-certificates/** r,
  /usr/share/ca-certificates/** r,
  
  # Node.js / Python runtime
  /usr/bin/node rix,
  /usr/bin/python* rix,
  /usr/lib/** rm,
  /usr/share/** r,
  
  # Package managers (restricted)
  /usr/bin/npm rix,
  /usr/bin/pip* rix,
  /usr/local/lib/** rm,
  
  # Deny access to sensitive files
  deny /etc/shadow r,
  deny /etc/sudoers r,
  deny /etc/ssh/** rw,
  deny /root/** rw,
  
  # ===========================================
  # NETWORK RULES
  # ===========================================
  
  # Allow TCP/UDP for application use
  network inet stream,
  network inet dgram,
  network inet6 stream,
  network inet6 dgram,
  
  # Allow Unix sockets
  network unix stream,
  network unix dgram,
  
  # Deny raw sockets (no packet sniffing)
  deny network raw,
  deny network packet,
  deny network netlink,
  
  # ===========================================
  # CAPABILITY RULES
  # ===========================================
  
  # Deny all dangerous capabilities
  deny capability sys_admin,
  deny capability sys_ptrace,
  deny capability sys_module,
  deny capability sys_rawio,
  deny capability sys_boot,
  deny capability sys_nice,
  deny capability sys_resource,
  deny capability sys_time,
  deny capability sys_tty_config,
  deny capability mknod,
  deny capability lease,
  deny capability audit_write,
  deny capability audit_control,
  deny capability setfcap,
  deny capability mac_override,
  deny capability mac_admin,
  deny capability syslog,
  deny capability wake_alarm,
  deny capability block_suspend,
  deny capability audit_read,
  
  # Allow minimal capabilities for operation
  capability chown,
  capability dac_override,
  capability fowner,
  capability fsetid,
  capability setgid,
  capability setuid,
  capability net_bind_service,
  
  # ===========================================
  # MOUNT RULES
  # ===========================================
  
  # Deny all mount operations
  deny mount,
  deny umount,
  deny pivot_root,
  deny remount,
  
  # ===========================================
  # PTRACE RULES
  # ===========================================
  
  # Deny ptrace (no debugging other processes)
  deny ptrace,
  
  # ===========================================
  # SIGNAL RULES
  # ===========================================
  
  # Allow signals to own processes only
  signal (send, receive) peer=sandbox-profile,
  
  # ===========================================
  # DBUS RULES
  # ===========================================
  
  # Deny D-Bus access
  deny dbus,
  
  # ===========================================
  # EXECUTION RULES
  # ===========================================
  
  # Allow execution of specific binaries
  /usr/bin/* rix,
  /usr/local/bin/* rix,
  /bin/* rix,
  
  # Deny execution from writable directories
  deny /home/sandbox/** mx,
  deny /tmp/** mx,
}
```

### Loading AppArmor Profiles

```bash
# Load profile
sudo apparmor_parser -r /etc/apparmor.d/sandbox-profile

# Check profile status
sudo aa-status | grep sandbox

# Test profile in complain mode (logging only)
sudo aa-complain /etc/apparmor.d/sandbox-profile

# Enforce profile
sudo aa-enforce /etc/apparmor.d/sandbox-profile
```

---

## SELinux Policies

### Policy Module

```
# sandbox.te - SELinux Type Enforcement

policy_module(sandbox, 1.0.0)

# Define types
type sandbox_t;
type sandbox_exec_t;
type sandbox_data_t;

# Domain transition
domain_type(sandbox_t)
domain_entry_file(sandbox_t, sandbox_exec_t)

# Allow sandbox to read/write its data
allow sandbox_t sandbox_data_t:file { read write create unlink };
allow sandbox_t sandbox_data_t:dir { read write add_name remove_name };

# Network access
allow sandbox_t self:tcp_socket { create connect read write };
allow sandbox_t self:udp_socket { create read write };

# Deny dangerous operations
dontaudit sandbox_t self:capability { sys_admin sys_ptrace };
dontaudit sandbox_t kernel_t:system module_load;
```

### File Contexts

```
# sandbox.fc - SELinux File Contexts

/home/sandbox(/.*)?          gen_context(system_u:object_r:sandbox_data_t,s0)
/usr/bin/sandbox-runner      gen_context(system_u:object_r:sandbox_exec_t,s0)
```

### Compiling and Loading

```bash
# Compile policy module
checkmodule -M -m -o sandbox.mod sandbox.te
semodule_package -o sandbox.pp -m sandbox.mod -f sandbox.fc

# Load policy module
semodule -i sandbox.pp

# Apply file contexts
restorecon -R /home/sandbox
```

---

## Linux Capabilities

### Capability Overview

| Capability | Description | Risk Level |
|------------|-------------|------------|
| CAP_SYS_ADMIN | Broad system administration | Critical |
| CAP_SYS_PTRACE | Trace/debug processes | Critical |
| CAP_NET_ADMIN | Network configuration | High |
| CAP_SYS_MODULE | Load kernel modules | Critical |
| CAP_NET_RAW | Raw socket access | High |
| CAP_CHOWN | Change file ownership | Medium |
| CAP_DAC_OVERRIDE | Bypass file permissions | High |
| CAP_SETUID | Set UID | High |
| CAP_SETGID | Set GID | High |

### Dropping Capabilities

```typescript
// src/services/capabilityManager.ts

const ALL_CAPABILITIES = [
  'CAP_AUDIT_CONTROL',
  'CAP_AUDIT_READ',
  'CAP_AUDIT_WRITE',
  'CAP_BLOCK_SUSPEND',
  'CAP_CHOWN',
  'CAP_DAC_OVERRIDE',
  'CAP_DAC_READ_SEARCH',
  'CAP_FOWNER',
  'CAP_FSETID',
  'CAP_IPC_LOCK',
  'CAP_IPC_OWNER',
  'CAP_KILL',
  'CAP_LEASE',
  'CAP_LINUX_IMMUTABLE',
  'CAP_MAC_ADMIN',
  'CAP_MAC_OVERRIDE',
  'CAP_MKNOD',
  'CAP_NET_ADMIN',
  'CAP_NET_BIND_SERVICE',
  'CAP_NET_BROADCAST',
  'CAP_NET_RAW',
  'CAP_SETFCAP',
  'CAP_SETGID',
  'CAP_SETPCAP',
  'CAP_SETUID',
  'CAP_SYS_ADMIN',
  'CAP_SYS_BOOT',
  'CAP_SYS_CHROOT',
  'CAP_SYS_MODULE',
  'CAP_SYS_NICE',
  'CAP_SYS_PACCT',
  'CAP_SYS_PTRACE',
  'CAP_SYS_RAWIO',
  'CAP_SYS_RESOURCE',
  'CAP_SYS_TIME',
  'CAP_SYS_TTY_CONFIG',
  'CAP_SYSLOG',
  'CAP_WAKE_ALARM',
];

// Capabilities to keep for minimal operation
const SANDBOX_CAPABILITIES: string[] = [
  // None - drop ALL capabilities for maximum security
];

function getCapabilitiesToDrop(): string[] {
  return ALL_CAPABILITIES.filter(cap => !SANDBOX_CAPABILITIES.includes(cap));
}

// Docker run command
function buildDockerSecurityArgs(): string[] {
  const args: string[] = [];
  
  // Drop all capabilities
  args.push('--cap-drop=ALL');
  
  // Add back only what's needed (none for sandbox)
  // args.push('--cap-add=CHOWN');
  
  return args;
}
```

### Kubernetes Capability Configuration

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
    # add: []  # Add nothing back
```

---

## Namespace Isolation

### Linux Namespaces

| Namespace | Flag | Isolates |
|-----------|------|----------|
| PID | CLONE_NEWPID | Process IDs |
| Network | CLONE_NEWNET | Network stack |
| Mount | CLONE_NEWNS | Mount points |
| UTS | CLONE_NEWUTS | Hostname |
| IPC | CLONE_NEWIPC | IPC resources |
| User | CLONE_NEWUSER | User/group IDs |
| Cgroup | CLONE_NEWCGROUP | Cgroup root |

### User Namespace Configuration

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

const userNamespaceConfig: UserNamespaceConfig = {
  enabled: true,
  uidMap: [
    { containerUid: 0, hostUid: 100000, size: 65536 },  // Container root = host 100000
  ],
  gidMap: [
    { containerGid: 0, hostGid: 100000, size: 65536 },
  ],
};

// /etc/subuid
// sandbox:100000:65536

// /etc/subgid
// sandbox:100000:65536
```

### Docker User Namespace

```json
// /etc/docker/daemon.json
{
  "userns-remap": "sandbox"
}
```

---

## Resource Limits

### cgroups v2 Configuration

```typescript
// src/services/resourceLimits.ts

interface ResourceLimits {
  cpu: CpuLimits;
  memory: MemoryLimits;
  io: IoLimits;
  pids: PidsLimits;
}

interface CpuLimits {
  shares: number;        // Relative weight (default 1024)
  quota: number;         // Microseconds per period
  period: number;        // Period in microseconds
  cpus: string;          // CPU affinity (e.g., "0-1")
}

interface MemoryLimits {
  limit: string;         // Hard limit (e.g., "2Gi")
  reservation: string;   // Soft limit
  swap: string;          // Swap limit
  oomKillDisable: boolean;
}

interface IoLimits {
  weight: number;        // IO weight (1-10000)
  readBps: number;       // Read bytes per second
  writeBps: number;      // Write bytes per second
  readIops: number;      // Read IOPS
  writeIops: number;     // Write IOPS
}

interface PidsLimits {
  max: number;           // Maximum number of processes
}

const sandboxLimits: ResourceLimits = {
  cpu: {
    shares: 512,
    quota: 100000,       // 100ms
    period: 100000,      // per 100ms = 1 CPU
    cpus: '0-1',
  },
  memory: {
    limit: '2Gi',
    reservation: '512Mi',
    swap: '0',           // No swap
    oomKillDisable: false,
  },
  io: {
    weight: 100,
    readBps: 100 * 1024 * 1024,   // 100 MB/s
    writeBps: 50 * 1024 * 1024,   // 50 MB/s
    readIops: 1000,
    writeIops: 500,
  },
  pids: {
    max: 100,
  },
};
```

### Docker Resource Limits

```yaml
# docker-compose.yml
services:
  sandbox:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
          pids: 100
        reservations:
          cpus: '0.5'
          memory: 512M
    blkio_config:
      weight: 100
      device_read_bps:
        - path: /dev/sda
          rate: '100mb'
      device_write_bps:
        - path: /dev/sda
          rate: '50mb'
```

---

## Security Monitoring

### Audit Logging

```typescript
// src/services/securityAudit.ts

interface SecurityEvent {
  timestamp: Date;
  sandboxId: string;
  eventType: 'syscall_blocked' | 'capability_denied' | 'file_access_denied' | 'network_blocked';
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityAuditLogger {
  async logEvent(event: SecurityEvent): Promise<void> {
    // Log to structured logging system
    console.log(JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
    }));
    
    // Alert on high/critical events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.sendAlert(event);
    }
    
    // Store for analysis
    await this.storeEvent(event);
  }
  
  private async sendAlert(event: SecurityEvent): Promise<void> {
    // Send to alerting system
  }
  
  private async storeEvent(event: SecurityEvent): Promise<void> {
    // Store in database/SIEM
  }
}

export const securityAudit = new SecurityAuditLogger();
```

### Prometheus Metrics

```typescript
// src/services/securityMetrics.ts

const securityMetrics = {
  syscallsBlocked: new Counter({
    name: 'sandbox_syscalls_blocked_total',
    help: 'Total number of blocked syscalls',
    labelNames: ['sandbox_id', 'syscall'],
  }),
  
  capabilitiesDenied: new Counter({
    name: 'sandbox_capabilities_denied_total',
    help: 'Total number of denied capability requests',
    labelNames: ['sandbox_id', 'capability'],
  }),
  
  fileAccessDenied: new Counter({
    name: 'sandbox_file_access_denied_total',
    help: 'Total number of denied file access attempts',
    labelNames: ['sandbox_id', 'path'],
  }),
  
  securityViolations: new Counter({
    name: 'sandbox_security_violations_total',
    help: 'Total number of security violations',
    labelNames: ['sandbox_id', 'violation_type'],
  }),
};
```

---

## Best Practices

### 1. Layer Security Controls

```
Always use multiple layers:
1. gVisor or Kata for runtime isolation
2. seccomp for syscall filtering
3. AppArmor/SELinux for MAC
4. Capabilities dropped
5. User namespaces enabled
6. Resource limits enforced
```

### 2. Principle of Least Privilege

```typescript
// Start with nothing, add only what's needed
const securityConfig = {
  capabilities: [],           // Drop ALL
  syscalls: 'whitelist',      // Only allow needed syscalls
  fileAccess: 'restricted',   // Only workspace directory
  network: 'limited',         // Only required ports
};
```

### 3. Regular Security Audits

```bash
# Check for security misconfigurations
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image sandbox:latest

# Scan for vulnerabilities
grype sandbox:latest
```

### 4. Keep Systems Updated

```bash
# Regular updates
apt-get update && apt-get upgrade -y

# Update gVisor
wget https://storage.googleapis.com/gvisor/releases/release/latest/x86_64/runsc
```

### 5. Monitor and Alert

```yaml
# Alert on security events
alerts:
  - name: SecurityViolation
    condition: sandbox_security_violations_total > 0
    severity: critical
    action: page_oncall
```

---

## Summary

| Layer | Technology | Protection |
|-------|------------|------------|
| **Runtime** | gVisor (runsc) | Kernel isolation |
| **Syscall** | seccomp-BPF | Syscall filtering |
| **MAC** | AppArmor/SELinux | File/network restrictions |
| **Namespace** | Linux namespaces | Resource isolation |
| **Capabilities** | Drop ALL | Privilege restriction |
| **Resources** | cgroups v2 | DoS prevention |

### Security Checklist

- [ ] gVisor or Kata runtime enabled
- [ ] seccomp profile applied
- [ ] AppArmor/SELinux profile enforced
- [ ] All capabilities dropped
- [ ] User namespace enabled
- [ ] Read-only root filesystem
- [ ] Resource limits configured
- [ ] Security monitoring enabled
- [ ] Regular vulnerability scanning
- [ ] Incident response plan documented
