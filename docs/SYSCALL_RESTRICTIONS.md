# Syscall Restrictions for Sandbox Security

This guide provides comprehensive coverage of syscall filtering and restrictions for secure sandbox execution, including detailed analysis of blocked syscalls by category, seccomp-BPF implementation, and security implications.

---

## Table of Contents

1. [Overview](#overview)
2. [Syscall Filtering Architecture](#syscall-filtering-architecture)
3. [File System Syscalls](#file-system-syscalls)
4. [Network Syscalls](#network-syscalls)
5. [Process Management Syscalls](#process-management-syscalls)
6. [Memory Management Syscalls](#memory-management-syscalls)
7. [System Administration Syscalls](#system-administration-syscalls)
8. [IPC Syscalls](#ipc-syscalls)
9. [seccomp-BPF Implementation](#seccomp-bpf-implementation)
10. [Argument Filtering](#argument-filtering)
11. [Audit and Logging](#audit-and-logging)
12. [Best Practices](#best-practices)

---

## Overview

Syscall filtering is a critical security layer that restricts which kernel operations a sandboxed process can perform. By limiting syscalls, we reduce the attack surface and prevent many classes of exploits.

### Why Filter Syscalls?

| Threat | Dangerous Syscalls | Mitigation |
|--------|-------------------|------------|
| Container escape | `mount`, `pivot_root`, `unshare` | Block completely |
| Kernel exploit | `init_module`, `bpf`, `perf_event_open` | Block completely |
| Privilege escalation | `setuid`, `setgid`, `ptrace` | Restrict or block |
| Information disclosure | `ptrace`, `process_vm_readv` | Block completely |
| Resource abuse | `fork` (bomb), `mmap` (memory) | Limit with cgroups |

### Syscall Categories

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SYSCALL FILTERING ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  APPLICATION CODE                                                                       │
│       │                                                                                 │
│       │ syscall()                                                                       │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         seccomp-BPF FILTER                                       │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   ALLOW     │  │   ERRNO     │  │    KILL     │  │    LOG      │            │   │
│  │  │  (proceed)  │  │  (return    │  │  (terminate │  │  (allow +   │            │   │
│  │  │             │  │   error)    │  │   process)  │  │   audit)    │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  │  Categories:                                                                      │   │
│  │  • File I/O: ~60 syscalls (55 allowed, 5 blocked)                               │   │
│  │  • Network: ~25 syscalls (20 allowed, 5 blocked)                                │   │
│  │  • Process: ~30 syscalls (20 allowed, 10 restricted)                            │   │
│  │  • Memory: ~20 syscalls (18 allowed, 2 blocked)                                 │   │
│  │  • System: ~40 syscalls (10 allowed, 30 blocked)                                │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                                 │
│       │ (if allowed)                                                                   │
│       ▼                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         HOST KERNEL                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Syscall Filtering Architecture

### Filter Actions

| Action | Description | Use Case |
|--------|-------------|----------|
| `SCMP_ACT_ALLOW` | Allow syscall to proceed | Safe operations |
| `SCMP_ACT_ERRNO` | Return error code | Block with graceful failure |
| `SCMP_ACT_KILL` | Terminate process | Critical security violations |
| `SCMP_ACT_KILL_PROCESS` | Terminate entire process group | Severe violations |
| `SCMP_ACT_LOG` | Allow but log | Audit mode |
| `SCMP_ACT_TRACE` | Notify tracer | Debugging |

### Default Policy

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "comment": "Default deny - only explicitly allowed syscalls proceed"
}
```

---

## File System Syscalls

### Allowed File Operations

```json
{
  "comment": "File I/O - Basic operations",
  "names": [
    "read", "write", "open", "openat", "openat2", "close",
    "stat", "fstat", "lstat", "fstatat64", "newfstatat",
    "lseek", "pread64", "pwrite64",
    "readv", "writev", "preadv", "pwritev", "preadv2", "pwritev2",
    "access", "faccessat", "faccessat2"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Directory Operations

```json
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
}
```

### File Metadata Operations

```json
{
  "comment": "File I/O - Metadata",
  "names": [
    "chmod", "fchmod", "fchmodat",
    "chown", "fchown", "lchown", "fchownat",
    "utime", "utimes", "utimensat", "futimesat",
    "truncate", "ftruncate",
    "statfs", "fstatfs", "statx"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Blocked File Operations

```json
{
  "comment": "File I/O - BLOCKED (dangerous)",
  "names": [
    "mount",
    "umount", "umount2",
    "pivot_root",
    "chroot",
    "mknod", "mknodat"
  ],
  "action": "SCMP_ACT_ERRNO",
  "errnoRet": 1
}
```

### File Syscall Analysis

| Syscall | Status | Risk | Reason |
|---------|--------|------|--------|
| `mount` | ❌ Blocked | Critical | Container escape vector |
| `umount` | ❌ Blocked | Critical | Filesystem manipulation |
| `pivot_root` | ❌ Blocked | Critical | Root filesystem change |
| `chroot` | ❌ Blocked | High | Escape from chroot |
| `mknod` | ❌ Blocked | High | Device node creation |
| `open` | ✅ Allowed | Low | Basic file access |
| `read/write` | ✅ Allowed | Low | Basic I/O |

---

## Network Syscalls

### Allowed Network Operations

```json
{
  "comment": "Network - Socket operations",
  "names": [
    "socket", "socketpair",
    "bind", "listen", "accept", "accept4",
    "connect",
    "getsockname", "getpeername",
    "sendto", "recvfrom",
    "sendmsg", "recvmsg", "sendmmsg", "recvmmsg",
    "shutdown",
    "setsockopt", "getsockopt"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Socket Type Restrictions

```json
{
  "comment": "Network - Socket creation (restricted)",
  "names": ["socket"],
  "action": "SCMP_ACT_ALLOW",
  "args": [
    {
      "index": 0,
      "value": 2,
      "op": "SCMP_CMP_EQ",
      "comment": "AF_INET only"
    }
  ]
}
```

### Blocked Network Operations

```json
{
  "comment": "Network - BLOCKED (dangerous)",
  "names": [
    "socket"
  ],
  "action": "SCMP_ACT_ERRNO",
  "args": [
    {
      "index": 1,
      "value": 3,
      "op": "SCMP_CMP_EQ",
      "comment": "Block SOCK_RAW"
    }
  ]
}
```

### Network Syscall Analysis

| Syscall | Socket Type | Status | Risk | Reason |
|---------|-------------|--------|------|--------|
| `socket(AF_INET, SOCK_STREAM)` | TCP | ✅ Allowed | Low | Normal networking |
| `socket(AF_INET, SOCK_DGRAM)` | UDP | ✅ Allowed | Low | Normal networking |
| `socket(AF_INET, SOCK_RAW)` | Raw | ❌ Blocked | High | Packet sniffing |
| `socket(AF_NETLINK)` | Netlink | ❌ Blocked | High | Kernel communication |
| `socket(AF_PACKET)` | Packet | ❌ Blocked | High | Raw packet access |

### Detailed Network Restrictions

```typescript
// src/config/networkSyscalls.ts

const networkSyscallPolicy = {
  // Allowed socket domains
  allowedDomains: [
    'AF_INET',      // IPv4
    'AF_INET6',     // IPv6
    'AF_UNIX',      // Unix sockets
    'AF_LOCAL',     // Local sockets (alias for AF_UNIX)
  ],
  
  // Blocked socket domains
  blockedDomains: [
    'AF_NETLINK',   // Kernel communication
    'AF_PACKET',    // Raw packet access
    'AF_KEY',       // IPsec key management
    'AF_BLUETOOTH', // Bluetooth
    'AF_VSOCK',     // VM sockets
  ],
  
  // Allowed socket types
  allowedTypes: [
    'SOCK_STREAM',  // TCP
    'SOCK_DGRAM',   // UDP
    'SOCK_SEQPACKET', // Sequenced packets
  ],
  
  // Blocked socket types
  blockedTypes: [
    'SOCK_RAW',     // Raw sockets
    'SOCK_PACKET',  // Obsolete packet
  ],
};
```

---

## Process Management Syscalls

### Allowed Process Operations

```json
{
  "comment": "Process - Basic operations",
  "names": [
    "getpid", "getppid", "gettid",
    "getuid", "geteuid", "getgid", "getegid",
    "getgroups",
    "getrlimit", "setrlimit", "prlimit64",
    "getrusage",
    "times", "uname"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Restricted Clone Operations

```json
{
  "comment": "Process - Clone (restricted flags)",
  "names": ["clone", "clone3"],
  "action": "SCMP_ACT_ALLOW",
  "args": [
    {
      "index": 0,
      "value": 2114060288,
      "valueTwo": 0,
      "op": "SCMP_CMP_MASKED_EQ",
      "comment": "Block CLONE_NEWUSER, CLONE_NEWNS, etc."
    }
  ]
}
```

### Clone Flag Analysis

```typescript
// src/config/cloneFlags.ts

const CLONE_FLAGS = {
  // Allowed flags
  CLONE_VM: 0x00000100,           // Share memory
  CLONE_FS: 0x00000200,           // Share filesystem info
  CLONE_FILES: 0x00000400,        // Share file descriptors
  CLONE_SIGHAND: 0x00000800,      // Share signal handlers
  CLONE_THREAD: 0x00010000,       // Same thread group
  CLONE_SYSVSEM: 0x00040000,      // Share SysV semaphores
  CLONE_SETTLS: 0x00080000,       // Set TLS
  CLONE_PARENT_SETTID: 0x00100000,
  CLONE_CHILD_CLEARTID: 0x00200000,
  CLONE_CHILD_SETTID: 0x01000000,
  
  // BLOCKED flags (namespace creation)
  CLONE_NEWNS: 0x00020000,        // New mount namespace
  CLONE_NEWUTS: 0x04000000,       // New UTS namespace
  CLONE_NEWIPC: 0x08000000,       // New IPC namespace
  CLONE_NEWUSER: 0x10000000,      // New user namespace
  CLONE_NEWPID: 0x20000000,       // New PID namespace
  CLONE_NEWNET: 0x40000000,       // New network namespace
  CLONE_NEWCGROUP: 0x02000000,    // New cgroup namespace
};

// Mask to block namespace creation
const BLOCKED_CLONE_MASK = 
  CLONE_FLAGS.CLONE_NEWNS |
  CLONE_FLAGS.CLONE_NEWUTS |
  CLONE_FLAGS.CLONE_NEWIPC |
  CLONE_FLAGS.CLONE_NEWUSER |
  CLONE_FLAGS.CLONE_NEWPID |
  CLONE_FLAGS.CLONE_NEWNET |
  CLONE_FLAGS.CLONE_NEWCGROUP;
```

### Blocked Process Operations

```json
{
  "comment": "Process - BLOCKED (dangerous)",
  "names": [
    "ptrace",
    "process_vm_readv", "process_vm_writev",
    "kcmp",
    "unshare",
    "setns"
  ],
  "action": "SCMP_ACT_ERRNO",
  "errnoRet": 1
}
```

### Process Syscall Analysis

| Syscall | Status | Risk | Reason |
|---------|--------|------|--------|
| `fork` | ⚠️ Limited | Medium | Fork bomb prevention via pids.max |
| `clone` | ⚠️ Restricted | High | Block namespace flags |
| `clone3` | ⚠️ Restricted | High | Block namespace flags |
| `execve` | ✅ Allowed | Low | Required for execution |
| `ptrace` | ❌ Blocked | Critical | Debug/inspect other processes |
| `unshare` | ❌ Blocked | Critical | Create new namespaces |
| `setns` | ❌ Blocked | Critical | Join namespaces |
| `process_vm_readv` | ❌ Blocked | Critical | Read other process memory |

---

## Memory Management Syscalls

### Allowed Memory Operations

```json
{
  "comment": "Memory - Basic operations",
  "names": [
    "mmap", "munmap", "mprotect", "mremap",
    "brk",
    "madvise", "mlock", "munlock", "mlockall", "munlockall",
    "mincore",
    "msync"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Restricted mmap Operations

```json
{
  "comment": "Memory - mmap (no executable anonymous mappings)",
  "names": ["mmap"],
  "action": "SCMP_ACT_ALLOW",
  "args": [
    {
      "index": 2,
      "value": 4,
      "op": "SCMP_CMP_NE",
      "comment": "Block PROT_EXEC on anonymous mappings"
    }
  ]
}
```

### Blocked Memory Operations

```json
{
  "comment": "Memory - BLOCKED",
  "names": [
    "memfd_secret"
  ],
  "action": "SCMP_ACT_ERRNO",
  "errnoRet": 1
}
```

### Memory Syscall Analysis

| Syscall | Status | Risk | Reason |
|---------|--------|------|--------|
| `mmap` | ⚠️ Restricted | Medium | Block PROT_EXEC on anon |
| `mprotect` | ⚠️ Restricted | Medium | Block making pages executable |
| `brk` | ✅ Allowed | Low | Heap management |
| `munmap` | ✅ Allowed | Low | Memory cleanup |
| `memfd_secret` | ❌ Blocked | Medium | Secret memory areas |

---

## System Administration Syscalls

### Blocked System Operations

```json
{
  "comment": "System - BLOCKED (administrative)",
  "names": [
    "reboot",
    "kexec_load", "kexec_file_load",
    "init_module", "finit_module", "delete_module",
    "acct",
    "settimeofday", "adjtimex", "clock_adjtime",
    "sethostname", "setdomainname",
    "iopl", "ioperm",
    "swapon", "swapoff",
    "syslog",
    "vhangup",
    "quotactl",
    "nfsservctl"
  ],
  "action": "SCMP_ACT_ERRNO",
  "errnoRet": 1
}
```

### Blocked Security Operations

```json
{
  "comment": "Security - BLOCKED",
  "names": [
    "bpf",
    "perf_event_open",
    "lookup_dcookie",
    "fanotify_init",
    "name_to_handle_at", "open_by_handle_at",
    "userfaultfd",
    "keyctl", "request_key", "add_key"
  ],
  "action": "SCMP_ACT_ERRNO",
  "errnoRet": 1
}
```

### System Syscall Analysis

| Syscall | Status | Risk | Reason |
|---------|--------|------|--------|
| `reboot` | ❌ Blocked | Critical | System shutdown |
| `init_module` | ❌ Blocked | Critical | Load kernel modules |
| `bpf` | ❌ Blocked | Critical | eBPF programs |
| `perf_event_open` | ❌ Blocked | High | Performance monitoring |
| `settimeofday` | ❌ Blocked | High | Time manipulation |
| `sethostname` | ❌ Blocked | Medium | Hostname change |
| `syslog` | ❌ Blocked | Medium | Kernel log access |

---

## IPC Syscalls

### Allowed IPC Operations

```json
{
  "comment": "IPC - Pipes and FIFOs",
  "names": [
    "pipe", "pipe2"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Shared Memory (Restricted)

```json
{
  "comment": "IPC - Shared memory",
  "names": [
    "shmget", "shmat", "shmdt", "shmctl"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Semaphores (Restricted)

```json
{
  "comment": "IPC - Semaphores",
  "names": [
    "semget", "semop", "semtimedop", "semctl"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

### Message Queues (Restricted)

```json
{
  "comment": "IPC - Message queues",
  "names": [
    "msgget", "msgsnd", "msgrcv", "msgctl"
  ],
  "action": "SCMP_ACT_ALLOW"
}
```

---

## seccomp-BPF Implementation

### Complete Profile Generator

```typescript
// src/tools/seccompProfileGenerator.ts

interface SeccompProfile {
  defaultAction: string;
  defaultErrnoRet?: number;
  architectures: string[];
  syscalls: SyscallRule[];
}

interface SyscallRule {
  names: string[];
  action: string;
  args?: SyscallArg[];
  errnoRet?: number;
  comment?: string;
}

interface SyscallArg {
  index: number;
  value: number;
  valueTwo?: number;
  op: string;
}

class SeccompProfileGenerator {
  private profile: SeccompProfile = {
    defaultAction: 'SCMP_ACT_ERRNO',
    defaultErrnoRet: 1,
    architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_AARCH64'],
    syscalls: [],
  };
  
  // File I/O
  allowFileIO(): this {
    this.profile.syscalls.push({
      comment: 'File I/O - Basic',
      names: [
        'read', 'write', 'open', 'openat', 'close',
        'stat', 'fstat', 'lstat', 'newfstatat',
        'lseek', 'pread64', 'pwrite64',
        'readv', 'writev',
        'access', 'faccessat'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    this.profile.syscalls.push({
      comment: 'File I/O - Directory',
      names: [
        'getdents', 'getdents64',
        'mkdir', 'mkdirat', 'rmdir',
        'rename', 'renameat',
        'link', 'linkat', 'unlink', 'unlinkat',
        'symlink', 'symlinkat', 'readlink', 'readlinkat',
        'chdir', 'fchdir', 'getcwd'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    return this;
  }
  
  // Network
  allowNetworking(): this {
    this.profile.syscalls.push({
      comment: 'Network - Socket operations',
      names: [
        'socket', 'socketpair',
        'bind', 'listen', 'accept', 'accept4',
        'connect',
        'getsockname', 'getpeername',
        'sendto', 'recvfrom',
        'sendmsg', 'recvmsg',
        'shutdown',
        'setsockopt', 'getsockopt'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    // Block raw sockets
    this.profile.syscalls.push({
      comment: 'Network - Block raw sockets',
      names: ['socket'],
      action: 'SCMP_ACT_ERRNO',
      errnoRet: 1,
      args: [
        { index: 1, value: 3, op: 'SCMP_CMP_EQ' }, // SOCK_RAW
      ],
    });
    
    return this;
  }
  
  // Process management
  allowProcessManagement(): this {
    this.profile.syscalls.push({
      comment: 'Process - Basic',
      names: [
        'getpid', 'getppid', 'gettid',
        'getuid', 'geteuid', 'getgid', 'getegid',
        'getgroups',
        'exit', 'exit_group',
        'wait4', 'waitid'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    // Restricted clone
    this.profile.syscalls.push({
      comment: 'Process - Clone (restricted)',
      names: ['clone', 'clone3'],
      action: 'SCMP_ACT_ALLOW',
      args: [
        {
          index: 0,
          value: 0x7E020000, // Block namespace flags
          valueTwo: 0,
          op: 'SCMP_CMP_MASKED_EQ',
        },
      ],
    });
    
    return this;
  }
  
  // Memory management
  allowMemoryManagement(): this {
    this.profile.syscalls.push({
      comment: 'Memory - Basic',
      names: [
        'mmap', 'munmap', 'mprotect', 'mremap',
        'brk',
        'madvise', 'mlock', 'munlock'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    return this;
  }
  
  // Block dangerous syscalls
  blockDangerous(): this {
    this.profile.syscalls.push({
      comment: 'BLOCKED - System administration',
      names: [
        'mount', 'umount', 'umount2', 'pivot_root',
        'reboot', 'kexec_load',
        'init_module', 'finit_module', 'delete_module',
        'settimeofday', 'adjtimex',
        'sethostname', 'setdomainname'
      ],
      action: 'SCMP_ACT_ERRNO',
      errnoRet: 1,
    });
    
    this.profile.syscalls.push({
      comment: 'BLOCKED - Security sensitive',
      names: [
        'ptrace',
        'process_vm_readv', 'process_vm_writev',
        'bpf', 'perf_event_open',
        'unshare', 'setns'
      ],
      action: 'SCMP_ACT_ERRNO',
      errnoRet: 1,
    });
    
    return this;
  }
  
  // Signals
  allowSignals(): this {
    this.profile.syscalls.push({
      comment: 'Signals',
      names: [
        'rt_sigaction', 'rt_sigprocmask', 'rt_sigreturn',
        'rt_sigsuspend', 'rt_sigpending', 'rt_sigtimedwait',
        'sigaltstack',
        'kill', 'tgkill', 'tkill'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    return this;
  }
  
  // Time operations
  allowTime(): this {
    this.profile.syscalls.push({
      comment: 'Time - Read only',
      names: [
        'time', 'gettimeofday',
        'clock_gettime', 'clock_getres',
        'nanosleep', 'clock_nanosleep'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    return this;
  }
  
  // Misc required syscalls
  allowMisc(): this {
    this.profile.syscalls.push({
      comment: 'Misc - Required for operation',
      names: [
        'futex', 'set_robust_list', 'get_robust_list',
        'set_tid_address', 'arch_prctl',
        'prctl', 'seccomp',
        'getrandom', 'uname',
        'ioctl', 'fcntl',
        'dup', 'dup2', 'dup3',
        'epoll_create', 'epoll_create1', 'epoll_ctl', 'epoll_wait', 'epoll_pwait',
        'poll', 'ppoll', 'select', 'pselect6'
      ],
      action: 'SCMP_ACT_ALLOW',
    });
    
    return this;
  }
  
  generate(): SeccompProfile {
    return this.profile;
  }
  
  toJSON(): string {
    return JSON.stringify(this.profile, null, 2);
  }
}

// Usage
const generator = new SeccompProfileGenerator()
  .allowFileIO()
  .allowNetworking()
  .allowProcessManagement()
  .allowMemoryManagement()
  .allowSignals()
  .allowTime()
  .allowMisc()
  .blockDangerous();

const profile = generator.generate();
```

---

## Argument Filtering

### Socket Domain Filtering

```json
{
  "comment": "Block AF_NETLINK sockets",
  "names": ["socket"],
  "action": "SCMP_ACT_ERRNO",
  "errnoRet": 97,
  "args": [
    {
      "index": 0,
      "value": 16,
      "op": "SCMP_CMP_EQ"
    }
  ]
}
```

### ioctl Filtering

```json
{
  "comment": "Restrict ioctl commands",
  "names": ["ioctl"],
  "action": "SCMP_ACT_ALLOW",
  "args": [
    {
      "index": 1,
      "value": 21505,
      "op": "SCMP_CMP_EQ",
      "comment": "TCGETS - terminal get"
    }
  ]
}
```

### prctl Filtering

```json
{
  "comment": "Restrict prctl operations",
  "names": ["prctl"],
  "action": "SCMP_ACT_ALLOW",
  "args": [
    {
      "index": 0,
      "value": 38,
      "op": "SCMP_CMP_NE",
      "comment": "Block PR_SET_NO_NEW_PRIVS bypass"
    }
  ]
}
```

---

## Audit and Logging

### Audit Mode Profile

```json
{
  "defaultAction": "SCMP_ACT_LOG",
  "comment": "Audit mode - log all syscalls without blocking"
}
```

### Selective Logging

```json
{
  "comment": "Log but allow suspicious syscalls",
  "names": ["ptrace", "process_vm_readv"],
  "action": "SCMP_ACT_LOG"
}
```

### Audit Log Analysis

```typescript
// src/tools/auditLogAnalyzer.ts

interface AuditEvent {
  timestamp: Date;
  syscall: string;
  pid: number;
  uid: number;
  result: 'allowed' | 'blocked';
  args: number[];
}

class AuditLogAnalyzer {
  private events: AuditEvent[] = [];
  
  parseAuditLog(logPath: string): void {
    // Parse audit.log for seccomp events
    // type=SECCOMP msg=audit(timestamp): auid=uid uid=uid gid=gid
    // ses=session subj=label pid=pid comm="command" exe="path"
    // sig=signal arch=arch syscall=num compat=compat ip=ip code=action
  }
  
  getBlockedSyscalls(): Map<string, number> {
    const blocked = new Map<string, number>();
    
    for (const event of this.events) {
      if (event.result === 'blocked') {
        const count = blocked.get(event.syscall) || 0;
        blocked.set(event.syscall, count + 1);
      }
    }
    
    return blocked;
  }
  
  suggestProfileUpdates(): string[] {
    const suggestions: string[] = [];
    const blocked = this.getBlockedSyscalls();
    
    for (const [syscall, count] of blocked) {
      if (count > 100) {
        suggestions.push(
          `Consider allowing '${syscall}' - blocked ${count} times`
        );
      }
    }
    
    return suggestions;
  }
}
```

---

## Best Practices

### 1. Start with Default Deny

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "comment": "Block everything by default, whitelist needed syscalls"
}
```

### 2. Use Audit Mode First

```bash
# Run in audit mode to discover needed syscalls
docker run --security-opt seccomp=audit.json myapp

# Analyze audit logs
ausearch -m SECCOMP | audit2allow
```

### 3. Test Thoroughly

```typescript
// Test that blocked syscalls return expected errors
describe('seccomp profile', () => {
  it('should block mount syscall', async () => {
    const result = await exec('mount /dev/sda1 /mnt');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Operation not permitted');
  });
  
  it('should allow read syscall', async () => {
    const result = await exec('cat /etc/passwd');
    expect(result.exitCode).toBe(0);
  });
});
```

### 4. Monitor in Production

```typescript
// Track blocked syscalls
const blockedSyscalls = new Counter({
  name: 'seccomp_blocked_syscalls_total',
  help: 'Total blocked syscalls',
  labelNames: ['syscall', 'sandbox_id'],
});
```

### 5. Keep Profiles Updated

```bash
# Regularly review and update profiles
# New kernel versions may add syscalls that need consideration
```

---

## Summary

### Syscall Categories Summary

| Category | Total | Allowed | Blocked | Restricted |
|----------|-------|---------|---------|------------|
| File I/O | ~60 | 55 | 5 | 0 |
| Network | ~25 | 20 | 5 | 3 |
| Process | ~30 | 20 | 5 | 5 |
| Memory | ~20 | 18 | 2 | 0 |
| Signals | ~15 | 15 | 0 | 0 |
| Time | ~15 | 10 | 5 | 0 |
| System | ~40 | 10 | 30 | 0 |
| IPC | ~20 | 18 | 2 | 0 |
| **TOTAL** | ~330 | ~166 | ~54 | ~8 |

### Security Impact

| Threat | Blocked Syscalls | Impact |
|--------|------------------|--------|
| Container Escape | mount, pivot_root, unshare, setns | ✅ Prevented |
| Privilege Escalation | clone+NEWUSER, ptrace, setuid | ✅ Prevented |
| Kernel Exploit | init_module, bpf, perf_event_open | ✅ Mitigated |
| Network Attack | socket(RAW), socket(NETLINK) | ✅ Prevented |
| Time Manipulation | settimeofday, clock_settime | ✅ Prevented |
| Resource Abuse | fork bomb → pids.max limit | ✅ Mitigated |
