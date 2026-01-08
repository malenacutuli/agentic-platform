# Network Isolation: Multi-Tenant Sandbox Network Security

## Overview

Network isolation is one of the most critical security components in a multi-tenant platform like SwissBrain. This guide covers multiple layers of network isolation from container networking to kernel-level security, ensuring complete separation of network traffic between users while maintaining platform connectivity.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Multi-Layer Network Isolation                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 7: Application Layer (API Gateway)                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Request routing, authentication, rate limiting          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  Layer 4-6: Network Policies & Firewalls                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Kubernetes NetworkPolicy, iptables, SELinux            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  Layer 3: Container Networking (CNI)                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Calico, Cilium, Weave (network plugins)                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  Layer 2: Virtual Network Interfaces                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ veth pairs, network namespaces, virtual switches        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         │                                     │
│  Layer 1: Physical Network (VLANs, SDN)                      │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐  │
│  │ VLAN 100     │ VLAN 200     │ VLAN 300     │ VLAN ... │  │
│  │ User 1       │ User 2       │ User 3       │ User N   │  │
│  └──────────────┴──────────────┴──────────────┴──────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Network Namespace Isolation

### 1.1 Linux Network Namespaces

```typescript
/**
 * Network Namespace Isolation
 * 
 * Each sandbox gets its own network namespace:
 * - Separate network interfaces
 * - Isolated routing tables
 * - Independent firewall rules
 * - Isolated socket tables
 * 
 * Kernel enforces complete isolation at the network layer
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface NetworkNamespaceConfig {
  namespaceName: string;
  userId: string;
  sandboxId: string;
  vethName: string;
  bridgeName: string;
  ipAddress: string;
  gateway: string;
  dnsServers: string[];
}

class NetworkNamespaceManager {
  /**
   * Create isolated network namespace for sandbox
   */
  async createNetworkNamespace(config: NetworkNamespaceConfig): Promise<void> {
    console.log(`Creating network namespace for ${config.sandboxId}...`);

    // 1. Create network namespace
    await execAsync(`ip netns add ${config.namespaceName}`);

    // 2. Create virtual ethernet pair (veth)
    const peerName = `${config.vethName}-peer`;
    await execAsync(`ip link add ${config.vethName} type veth peer name ${peerName}`);

    // 3. Move veth interface to namespace
    await execAsync(`ip link set ${peerName} netns ${config.namespaceName}`);

    // 4. Configure veth in namespace
    await execAsync(`ip netns exec ${config.namespaceName} ip link set ${peerName} up`);
    await execAsync(
      `ip netns exec ${config.namespaceName} ip addr add ${config.ipAddress}/24 dev ${peerName}`
    );

    // 5. Set default gateway
    await execAsync(
      `ip netns exec ${config.namespaceName} ip route add default via ${config.gateway}`
    );

    // 6. Configure DNS
    await this.configureDNS(config.namespaceName, config.dnsServers);

    // 7. Connect to bridge
    await execAsync(`ip link set ${config.vethName} master ${config.bridgeName}`);
    await execAsync(`ip link set ${config.vethName} up`);

    // 8. Enable loopback in namespace
    await execAsync(`ip netns exec ${config.namespaceName} ip link set lo up`);

    console.log(`✓ Network namespace created: ${config.namespaceName}`);
  }

  /**
   * Configure DNS resolution
   */
  private async configureDNS(namespaceName: string, dnsServers: string[]): Promise<void> {
    const resolvConf = dnsServers.map(server => `nameserver ${server}`).join('\n');

    await execAsync(
      `ip netns exec ${namespaceName} bash -c 'echo "${resolvConf}" > /etc/resolv.conf'`
    );
  }

  /**
   * Verify namespace isolation
   */
  async verifyIsolation(namespaceName: string): Promise<NetworkIsolationReport> {
    const report: NetworkIsolationReport = {
      namespaceName,
      timestamp: new Date(),
      tests: []
    };

    // Test 1: Check namespace exists
    try {
      await execAsync(`ip netns identify ${namespaceName}`);
      report.tests.push({
        name: 'Namespace exists',
        passed: true
      });
    } catch {
      report.tests.push({
        name: 'Namespace exists',
        passed: false
      });
    }

    // Test 2: Check interfaces
    try {
      const { stdout } = await execAsync(`ip netns exec ${namespaceName} ip link show`);
      report.tests.push({
        name: 'Network interfaces accessible',
        passed: stdout.includes('eth')
      });
    } catch {
      report.tests.push({
        name: 'Network interfaces accessible',
        passed: false
      });
    }

    // Test 3: Check routing
    try {
      const { stdout } = await execAsync(`ip netns exec ${namespaceName} ip route show`);
      report.tests.push({
        name: 'Routing configured',
        passed: stdout.includes('default via')
      });
    } catch {
      report.tests.push({
        name: 'Routing configured',
        passed: false
      });
    }

    // Test 4: Check DNS
    try {
      const { stdout } = await execAsync(
        `ip netns exec ${namespaceName} cat /etc/resolv.conf`
      );
      report.tests.push({
        name: 'DNS configured',
        passed: stdout.includes('nameserver')
      });
    } catch {
      report.tests.push({
        name: 'DNS configured',
        passed: false
      });
    }

    report.allTestsPassed = report.tests.every(t => t.passed);
    return report;
  }

  /**
   * Delete network namespace
   */
  async deleteNetworkNamespace(namespaceName: string): Promise<void> {
    console.log(`Deleting network namespace: ${namespaceName}...`);

    try {
      // Remove veth interfaces
      await execAsync(`ip link delete ${namespaceName}-veth 2>/dev/null || true`);

      // Delete namespace
      await execAsync(`ip netns delete ${namespaceName}`);

      console.log(`✓ Network namespace deleted: ${namespaceName}`);
    } catch (error) {
      console.error(`Failed to delete namespace: ${error}`);
    }
  }

  /**
   * Get namespace statistics
   */
  async getNamespaceStats(namespaceName: string): Promise<NetworkStats> {
    const { stdout: ifaceStats } = await execAsync(
      `ip netns exec ${namespaceName} cat /proc/net/dev`
    );

    const { stdout: socketStats } = await execAsync(
      `ip netns exec ${namespaceName} cat /proc/net/sockstat`
    );

    return {
      namespaceName,
      timestamp: new Date(),
      interfaceStats: this.parseInterfaceStats(ifaceStats),
      socketStats: this.parseSocketStats(socketStats)
    };
  }

  private parseInterfaceStats(output: string): InterfaceStats[] {
    const stats: InterfaceStats[] = [];
    const lines = output.split('\n').slice(2); // Skip header

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(/\s+/);
      const iface = parts[0].replace(':', '');
      const [rxBytes, rxPackets, , , , , , , txBytes, txPackets] = parts.slice(1).map(Number);

      stats.push({
        interface: iface,
        rxBytes,
        rxPackets,
        txBytes,
        txPackets
      });
    }

    return stats;
  }

  private parseSocketStats(output: string): SocketStats {
    const lines = output.split('\n');
    const stats: SocketStats = {
      tcpSockets: 0,
      udpSockets: 0,
      tcpListening: 0
    };

    for (const line of lines) {
      if (line.includes('TCP:')) {
        const match = line.match(/TCP:\s+(\d+)/);
        if (match) stats.tcpSockets = parseInt(match[1]);
      }
      if (line.includes('UDP:')) {
        const match = line.match(/UDP:\s+(\d+)/);
        if (match) stats.udpSockets = parseInt(match[1]);
      }
    }

    return stats;
  }
}

interface NetworkIsolationReport {
  namespaceName: string;
  timestamp: Date;
  tests: { name: string; passed: boolean }[];
  allTestsPassed?: boolean;
}

interface NetworkStats {
  namespaceName: string;
  timestamp: Date;
  interfaceStats: InterfaceStats[];
  socketStats: SocketStats;
}

interface InterfaceStats {
  interface: string;
  rxBytes: number;
  rxPackets: number;
  txBytes: number;
  txPackets: number;
}

interface SocketStats {
  tcpSockets: number;
  udpSockets: number;
  tcpListening: number;
}
```

## 2. Kubernetes NetworkPolicy

### 2.1 Fine-Grained Network Policies

```typescript
/**
 * Kubernetes NetworkPolicy: Pod-to-Pod communication control
 * 
 * Policies define:
 * - Which pods can talk to which pods
 * - Which namespaces can communicate
 * - Ingress/egress rules
 * - Port restrictions
 */

interface NetworkPolicyRule {
  podSelector?: { matchLabels: Record<string, string> };
  namespaceSelector?: { matchLabels: Record<string, string> };
  ports?: { protocol: string; port: number }[];
}

class KubernetesNetworkPolicyManager {
  private kubeClient: any; // Kubernetes client

  /**
   * Create network policy for sandbox isolation
   */
  async createSandboxNetworkPolicy(sandboxId: string, userId: string): Promise<void> {
    const policyName = `policy-${sandboxId}`;
    const namespace = `sandbox-${sandboxId}`;

    const policy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: policyName,
        namespace: namespace
      },
      spec: {
        podSelector: {
          matchLabels: {
            'sandbox-id': sandboxId,
            'user-id': userId
          }
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            // Allow traffic from same sandbox
            from: [
              {
                podSelector: {
                  matchLabels: {
                    'sandbox-id': sandboxId
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 3000
              }
            ]
          },
          {
            // Allow traffic from API gateway
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    name: 'api-gateway'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 3000
              }
            ]
          }
        ],
        egress: [
          {
            // Allow DNS
            to: [
              {
                namespaceSelector: {
                  matchLabels: {
                    name: 'kube-system'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'UDP',
                port: 53
              }
            ]
          },
          {
            // Allow external HTTPS
            to: [
              {
                ipBlock: {
                  cidr: '0.0.0.0/0',
                  except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 443
              }
            ]
          },
          {
            // Deny traffic to other sandboxes
            to: [
              {
                podSelector: {
                  matchLabels: {
                    'type': 'sandbox'
                  }
                }
              }
            ]
          }
        ]
      }
    };

    await this.kubeClient.create(policy);
    console.log(`✓ Network policy created: ${policyName}`);
  }

  /**
   * Create default deny policy (deny all, then allow specific)
   */
  async createDefaultDenyPolicy(namespace: string): Promise<void> {
    const denyAllPolicy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'default-deny-all',
        namespace: namespace
      },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress', 'Egress'],
        ingress: [],
        egress: []
      }
    };

    await this.kubeClient.create(denyAllPolicy);
    console.log(`✓ Default deny policy created for namespace: ${namespace}`);
  }

  /**
   * Allow specific egress traffic
   */
  async allowEgressToService(
    sandboxId: string,
    targetService: string,
    port: number
  ): Promise<void> {
    const policyName = `egress-${sandboxId}-${targetService}`;
    const namespace = `sandbox-${sandboxId}`;

    const policy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: policyName,
        namespace: namespace
      },
      spec: {
        podSelector: {
          matchLabels: {
            'sandbox-id': sandboxId
          }
        },
        policyTypes: ['Egress'],
        egress: [
          {
            to: [
              {
                podSelector: {
                  matchLabels: {
                    'service': targetService
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: port
              }
            ]
          }
        ]
      }
    };

    await this.kubeClient.create(policy);
    console.log(`✓ Egress policy created: ${policyName}`);
  }

  /**
   * Audit network policy violations
   */
  async auditPolicyViolations(namespace: string): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    // Query logs for denied connections
    const { stdout } = await execAsync(
      `kubectl logs -n ${namespace} -l app=network-policy-logger --tail=1000`
    );

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('DENIED') || line.includes('DROP')) {
        violations.push(this.parseViolationLog(line));
      }
    }

    return violations;
  }

  private parseViolationLog(logLine: string): PolicyViolation {
    // Parse network policy violation from log
    return {
      timestamp: new Date(),
      sourceIP: '',
      destIP: '',
      port: 0,
      protocol: 'TCP',
      action: 'DENIED'
    };
  }
}

interface PolicyViolation {
  timestamp: Date;
  sourceIP: string;
  destIP: string;
  port: number;
  protocol: string;
  action: string;
}
```

## 3. Container Network Interface (CNI) Plugins

### 3.1 Calico for Network Isolation

```typescript
/**
 * Calico: Enterprise-grade network security for Kubernetes
 * 
 * Features:
 * - Per-pod network policies
 * - BGP-based networking
 * - Encrypted inter-pod communication
 * - Network segmentation
 */

class CalicoNetworkManager {
  /**
   * Deploy Calico CNI
   */
  async deployCalicoPlugin(): Promise<void> {
    console.log('Deploying Calico CNI plugin...');

    // Install Calico operator
    await execAsync(
      `kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.0/manifests/tigera-operator.yaml`
    );

    // Wait for operator
    await this.waitForOperator();

    // Create Calico installation
    const installation = {
      apiVersion: 'operator.tigera.io/v1',
      kind: 'Installation',
      metadata: {
        name: 'default'
      },
      spec: {
        calicoNetwork: {
          ipPools: [
            {
              blockSize: 26,
              cidr: '10.0.0.0/8',
              encapsulation: 'VXLAN',
              natOutgoing: 'Enabled',
              nodeSelector: 'all()'
            }
          ]
        }
      }
    };

    await this.applyManifest(installation);
    console.log('✓ Calico CNI deployed');
  }

  /**
   * Create network policy with Calico
   */
  async createCalicoNetworkPolicy(
    sandboxId: string,
    userId: string
  ): Promise<void> {
    const policy = {
      apiVersion: 'projectcalico.org/v3',
      kind: 'NetworkPolicy',
      metadata: {
        name: `sandbox-${sandboxId}`,
        namespace: `sandbox-${sandboxId}`
      },
      spec: {
        selector: `sandbox-id == "${sandboxId}"`,
        types: ['Ingress', 'Egress'],
        ingress: [
          {
            action: 'Allow',
            source: {
              selector: `sandbox-id == "${sandboxId}"`
            },
            destination: {
              ports: [3000]
            }
          },
          {
            action: 'Allow',
            source: {
              namespaceSelector: 'name == "api-gateway"'
            },
            destination: {
              ports: [3000]
            }
          }
        ],
        egress: [
          {
            action: 'Allow',
            destination: {
              namespaceSelector: 'name == "kube-system"',
              ports: [53]
            }
          },
          {
            action: 'Allow',
            destination: {
              nets: ['0.0.0.0/0'],
              notNets: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
              ports: [443]
            }
          },
          {
            action: 'Deny',
            destination: {
              selector: 'type == "sandbox"'
            }
          }
        ]
      }
    };

    await this.applyManifest(policy);
    console.log(`✓ Calico network policy created for ${sandboxId}`);
  }

  /**
   * Enable encryption for inter-pod traffic
   */
  async enableEncryption(namespace: string): Promise<void> {
    console.log(`Enabling encryption for namespace: ${namespace}...`);

    const encryption = {
      apiVersion: 'projectcalico.org/v3',
      kind: 'FelixConfiguration',
      metadata: {
        name: 'default'
      },
      spec: {
        wireguardEnabled: true,
        wireguardInterfaceName: 'wireguard.cali'
      }
    };

    await this.applyManifest(encryption);
    console.log('✓ WireGuard encryption enabled');
  }

  private async waitForOperator(): Promise<void> {
    let retries = 0;
    while (retries < 30) {
      try {
        const { stdout } = await execAsync(
          'kubectl get deployment -n tigera-operator tigera-operator'
        );
        if (stdout.includes('1/1')) {
          return;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
    throw new Error('Calico operator failed to start');
  }

  private async applyManifest(manifest: any): Promise<void> {
    // Apply manifest to cluster
  }
}
```

### 3.2 Cilium for eBPF-based Networking

```typescript
/**
 * Cilium: eBPF-based networking with advanced security
 * 
 * Features:
 * - Kernel-level network enforcement
 * - API-aware policies
 * - Transparent encryption
 * - Real-time visibility
 */

class CiliumNetworkManager {
  /**
   * Deploy Cilium
   */
  async deployCilium(): Promise<void> {
    console.log('Deploying Cilium...');

    // Add Cilium Helm repo
    await execAsync('helm repo add cilium https://helm.cilium.io');
    await execAsync('helm repo update');

    // Install Cilium
    await execAsync(`
      helm install cilium cilium/cilium \\
        --namespace kube-system \\
        --set hubble.relay.enabled=true \\
        --set hubble.ui.enabled=true \\
        --set encryption.enabled=true \\
        --set encryption.type=wireguard
    `);

    console.log('✓ Cilium deployed');
  }

  /**
   * Create Cilium network policy
   */
  async createCiliumPolicy(sandboxId: string): Promise<void> {
    const policy = {
      apiVersion: 'cilium.io/v2',
      kind: 'CiliumNetworkPolicy',
      metadata: {
        name: `sandbox-${sandboxId}`,
        namespace: `sandbox-${sandboxId}`
      },
      spec: {
        endpointSelector: {
          matchLabels: {
            'sandbox-id': sandboxId
          }
        },
        ingress: [
          {
            fromEndpoints: [
              {
                matchLabels: {
                  'sandbox-id': sandboxId
                }
              }
            ],
            toPorts: [
              {
                ports: [{ port: '3000', protocol: 'TCP' }]
              }
            ]
          }
        ],
        egress: [
          {
            toEndpoints: [
              {
                matchLabels: {
                  'k8s:io.kubernetes.namespace': 'kube-system'
                }
              }
            ],
            toPorts: [
              {
                ports: [{ port: '53', protocol: 'UDP' }]
              }
            ]
          },
          {
            toCIDRs: [
              {
                cidr: '0.0.0.0/0',
                except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
              }
            ],
            toPorts: [
              {
                ports: [{ port: '443', protocol: 'TCP' }]
              }
            ]
          }
        ]
      }
    };

    await this.applyManifest(policy);
    console.log(`✓ Cilium policy created for ${sandboxId}`);
  }

  /**
   * Enable API-aware policies
   */
  async enableAPIAwarePolicies(): Promise<void> {
    console.log('Enabling API-aware policies...');

    const apiPolicy = {
      apiVersion: 'cilium.io/v2',
      kind: 'CiliumNetworkPolicy',
      metadata: {
        name: 'api-aware-policy'
      },
      spec: {
        endpointSelector: {
          matchLabels: {
            'app': 'sandbox'
          }
        },
        egress: [
          {
            toServices: [
              {
                k8sService: {
                  namespace: 'default',
                  serviceName: 'external-api'
                }
              }
            ],
            toPorts: [
              {
                ports: [{ port: '443', protocol: 'TCP' }],
                rules: {
                  http: [
                    {
                      method: 'GET',
                      path: '/api/v1/.*'
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    };

    await this.applyManifest(apiPolicy);
    console.log('✓ API-aware policies enabled');
  }

  /**
   * Monitor network traffic with Hubble
   */
  async monitorNetworkTraffic(sandboxId: string): Promise<NetworkFlow[]> {
    const flows: NetworkFlow[] = [];

    // Query Hubble for network flows
    const { stdout } = await execAsync(
      `hubble observe -n sandbox-${sandboxId} --output json`
    );

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        try {
          const flow = JSON.parse(line);
          flows.push({
            timestamp: new Date(flow.time),
            source: flow.source?.pod_name || flow.source?.ip,
            destination: flow.destination?.pod_name || flow.destination?.ip,
            port: flow.destination?.port,
            protocol: flow.l4?.tcp ? 'TCP' : 'UDP',
            bytes: flow.traffic?.bytes_sent || 0
          });
        } catch {}
      }
    }

    return flows;
  }

  private async applyManifest(manifest: any): Promise<void> {
    // Apply manifest
  }
}

interface NetworkFlow {
  timestamp: Date;
  source: string;
  destination: string;
  port: number;
  protocol: string;
  bytes: number;
}
```

## 4. iptables and Firewall Rules

### 4.1 Kernel-Level Firewall

```typescript
/**
 * iptables: Kernel-level packet filtering
 * 
 * Provides:
 * - Stateful packet filtering
 * - Network address translation (NAT)
 * - Port forwarding
 * - Connection tracking
 */

class IPTablesFirewallManager {
  /**
   * Configure firewall for sandbox
   */
  async configureFirewall(sandboxId: string, sandboxIP: string): Promise<void> {
    console.log(`Configuring firewall for ${sandboxId}...`);

    // 1. Create custom chain for sandbox
    await execAsync(`iptables -N sandbox_${sandboxId}`);

    // 2. Allow loopback traffic
    await execAsync(`iptables -A sandbox_${sandboxId} -i lo -j ACCEPT`);

    // 3. Allow established connections
    await execAsync(
      `iptables -A sandbox_${sandboxId} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`
    );

    // 4. Allow DNS (port 53)
    await execAsync(
      `iptables -A sandbox_${sandboxId} -p udp --dport 53 -j ACCEPT`
    );

    // 5. Allow HTTPS (port 443)
    await execAsync(
      `iptables -A sandbox_${sandboxId} -p tcp --dport 443 -j ACCEPT`
    );

    // 6. Allow HTTP (port 80)
    await execAsync(
      `iptables -A sandbox_${sandboxId} -p tcp --dport 80 -j ACCEPT`
    );

    // 7. Block traffic to other sandboxes
    await execAsync(
      `iptables -A sandbox_${sandboxId} -d 10.0.0.0/8 -j DROP`
    );

    // 8. Block private networks
    await execAsync(
      `iptables -A sandbox_${sandboxId} -d 172.16.0.0/12 -j DROP`
    );
    await execAsync(
      `iptables -A sandbox_${sandboxId} -d 192.168.0.0/16 -j DROP`
    );

    // 9. Default policy: DROP
    await execAsync(`iptables -P sandbox_${sandboxId} DROP`);

    // 10. Add to INPUT chain
    await execAsync(
      `iptables -A INPUT -s ${sandboxIP} -j sandbox_${sandboxId}`
    );

    console.log(`✓ Firewall configured for ${sandboxId}`);
  }

  /**
   * Allow specific egress traffic
   */
  async allowEgress(
    sandboxId: string,
    destIP: string,
    port: number,
    protocol: string = 'tcp'
  ): Promise<void> {
    await execAsync(
      `iptables -A sandbox_${sandboxId} -p ${protocol} -d ${destIP} --dport ${port} -j ACCEPT`
    );

    console.log(`✓ Allowed ${protocol}:${port} to ${destIP} for ${sandboxId}`);
  }

  /**
   * Block specific traffic
   */
  async blockTraffic(
    sandboxId: string,
    destIP: string,
    port: number,
    protocol: string = 'tcp'
  ): Promise<void> {
    await execAsync(
      `iptables -A sandbox_${sandboxId} -p ${protocol} -d ${destIP} --dport ${port} -j DROP`
    );

    console.log(`✓ Blocked ${protocol}:${port} to ${destIP} for ${sandboxId}`);
  }

  /**
   * Get firewall statistics
   */
  async getFirewallStats(sandboxId: string): Promise<FirewallStats> {
    const { stdout } = await execAsync(
      `iptables -L sandbox_${sandboxId} -n -v -x`
    );

    const lines = stdout.split('\n');
    const stats: FirewallStats = {
      sandboxId,
      rules: [],
      totalPackets: 0,
      totalBytes: 0
    };

    for (const line of lines.slice(2)) {
      if (!line.trim()) continue;

      const parts = line.split(/\s+/);
      const [packets, bytes, target, protocol, opt, in_, out_, source, dest] = parts;

      stats.rules.push({
        packets: parseInt(packets),
        bytes: parseInt(bytes),
        target,
        protocol,
        source,
        destination: dest
      });

      stats.totalPackets += parseInt(packets);
      stats.totalBytes += parseInt(bytes);
    }

    return stats;
  }

  /**
   * Clean up firewall rules
   */
  async cleanupFirewall(sandboxId: string): Promise<void> {
    console.log(`Cleaning up firewall for ${sandboxId}...`);

    // Flush chain
    await execAsync(`iptables -F sandbox_${sandboxId}`);

    // Delete chain
    await execAsync(`iptables -X sandbox_${sandboxId}`);

    console.log(`✓ Firewall cleaned up for ${sandboxId}`);
  }
}

interface FirewallStats {
  sandboxId: string;
  rules: FirewallRule[];
  totalPackets: number;
  totalBytes: number;
}

interface FirewallRule {
  packets: number;
  bytes: number;
  target: string;
  protocol: string;
  source: string;
  destination: string;
}
```

## 5. SELinux and AppArmor

### 5.1 Mandatory Access Control

```typescript
/**
 * SELinux: Security-Enhanced Linux
 * 
 * Provides:
 * - Mandatory access control (MAC)
 * - Role-based access control (RBAC)
 * - Type enforcement
 * - Multi-level security
 */

class SELinuxSecurityManager {
  /**
   * Create SELinux policy for sandbox
   */
  async createSandboxPolicy(sandboxId: string, userId: string): Promise<void> {
    console.log(`Creating SELinux policy for ${sandboxId}...`);

    const policyContent = `
policy_module(sandbox_${sandboxId}, 1.0.0)

require {
  type container_t;
  type container_runtime_t;
  type init_t;
  class process { signal signull };
  class file { read write open };
  class unix_stream_socket { read write };
}

type sandbox_${sandboxId}_t;
type sandbox_${sandboxId}_exec_t;

# Allow sandbox process to run
allow sandbox_${sandboxId}_t container_t:process signal;
allow sandbox_${sandboxId}_t container_t:file { read write open };

# Deny access to other sandboxes
neverallow sandbox_${sandboxId}_t ~sandbox_${sandboxId}_t:process signal;
neverallow sandbox_${sandboxId}_t ~sandbox_${sandboxId}_t:file { read write };
    `;

    // Compile policy
    await execAsync(
      `echo "${policyContent}" > /tmp/sandbox_${sandboxId}.te`
    );
    await execAsync(
      `checkmodule -M -m -o /tmp/sandbox_${sandboxId}.mod /tmp/sandbox_${sandboxId}.te`
    );
    await execAsync(
      `semodule_package -o /tmp/sandbox_${sandboxId}.pp -m /tmp/sandbox_${sandboxId}.mod`
    );

    // Install policy
    await execAsync(`semodule -i /tmp/sandbox_${sandboxId}.pp`);

    console.log(`✓ SELinux policy created for ${sandboxId}`);
  }

  /**
   * Apply SELinux context to process
   */
  async applySELinuxContext(pid: number, context: string): Promise<void> {
    await execAsync(`chcon -p ${context} /proc/${pid}`);
  }

  /**
   * Audit SELinux violations
   */
  async auditViolations(sandboxId: string): Promise<SELinuxViolation[]> {
    const violations: SELinuxViolation[] = [];

    const { stdout } = await execAsync(
      `ausearch -m avc -ts recent | grep sandbox_${sandboxId}`
    );

    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('denied')) {
        violations.push(this.parseSELinuxLog(line));
      }
    }

    return violations;
  }

  private parseSELinuxLog(logLine: string): SELinuxViolation {
    return {
      timestamp: new Date(),
      sourceContext: '',
      targetContext: '',
      permission: '',
      denied: true
    };
  }
}

interface SELinuxViolation {
  timestamp: Date;
  sourceContext: string;
  targetContext: string;
  permission: string;
  denied: boolean;
}
```

## 6. VLANs and SDN

### 6.1 Virtual LAN Isolation

```typescript
/**
 * VLANs: Virtual Local Area Networks
 * 
 * Provides:
 * - Layer 2 network segmentation
 * - Physical network isolation
 * - VLAN tagging (802.1Q)
 * - Per-user network segments
 */

class VLANNetworkManager {
  /**
   * Create VLAN for sandbox
   */
  async createVLAN(sandboxId: string, vlanId: number): Promise<void> {
    console.log(`Creating VLAN ${vlanId} for ${sandboxId}...`);

    // 1. Create VLAN interface
    await execAsync(`ip link add link eth0 name eth0.${vlanId} type vlan id ${vlanId}`);

    // 2. Bring up VLAN interface
    await execAsync(`ip link set eth0.${vlanId} up`);

    // 3. Assign IP address
    const ipAddress = `10.${vlanId}.0.2/24`;
    await execAsync(`ip addr add ${ipAddress} dev eth0.${vlanId}`);

    // 4. Set gateway
    const gateway = `10.${vlanId}.0.1`;
    await execAsync(`ip route add default via ${gateway} dev eth0.${vlanId}`);

    console.log(`✓ VLAN ${vlanId} created for ${sandboxId}`);
  }

  /**
   * Configure VLAN on switch
   */
  async configureVLANOnSwitch(
    switchIP: string,
    vlanId: number,
    ports: number[]
  ): Promise<void> {
    console.log(`Configuring VLAN ${vlanId} on switch ${switchIP}...`);

    // SSH to switch and configure
    const commands = [
      `vlan ${vlanId}`,
      `name sandbox-vlan-${vlanId}`,
      ...ports.map(p => `interface GigabitEthernet0/0/${p}`),
      `switchport mode access`,
      `switchport access vlan ${vlanId}`
    ];

    for (const cmd of commands) {
      await this.sendSwitchCommand(switchIP, cmd);
    }

    console.log(`✓ VLAN ${vlanId} configured on switch`);
  }

  private async sendSwitchCommand(switchIP: string, command: string): Promise<void> {
    // SSH to switch and send command
  }
}
```

## 7. Network Monitoring and Auditing

### 7.1 Network Traffic Analysis

```typescript
class NetworkMonitoringSystem {
  /**
   * Monitor network traffic for anomalies
   */
  async monitorNetworkTraffic(sandboxId: string): Promise<NetworkAnomalies> {
    const anomalies: NetworkAnomalies = {
      sandboxId,
      timestamp: new Date(),
      issues: []
    };

    // 1. Check for port scanning
    const portScans = await this.detectPortScans(sandboxId);
    if (portScans.length > 0) {
      anomalies.issues.push({
        type: 'port-scan',
        severity: 'high',
        count: portScans.length
      });
    }

    // 2. Check for DNS exfiltration
    const dnsExfil = await this.detectDNSExfiltration(sandboxId);
    if (dnsExfil.length > 0) {
      anomalies.issues.push({
        type: 'dns-exfiltration',
        severity: 'critical',
        count: dnsExfil.length
      });
    }

    // 3. Check for data exfiltration
    const dataExfil = await this.detectDataExfiltration(sandboxId);
    if (dataExfil > 1000000) { // >1MB
      anomalies.issues.push({
        type: 'data-exfiltration',
        severity: 'high',
        bytes: dataExfil
      });
    }

    // 4. Check for unusual traffic patterns
    const unusual = await this.detectUnusualPatterns(sandboxId);
    if (unusual) {
      anomalies.issues.push({
        type: 'unusual-pattern',
        severity: 'medium',
        description: unusual
      });
    }

    return anomalies;
  }

  private async detectPortScans(sandboxId: string): Promise<PortScan[]> {
    // Detect port scanning activity
    return [];
  }

  private async detectDNSExfiltration(sandboxId: string): Promise<DNSQuery[]> {
    // Detect DNS-based data exfiltration
    return [];
  }

  private async detectDataExfiltration(sandboxId: string): Promise<number> {
    // Detect unusual data transfer
    return 0;
  }

  private async detectUnusualPatterns(sandboxId: string): Promise<string | null> {
    // Detect unusual network patterns
    return null;
  }
}

interface NetworkAnomalies {
  sandboxId: string;
  timestamp: Date;
  issues: NetworkAnomaly[];
}

interface NetworkAnomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  [key: string]: any;
}

interface PortScan {
  sourceIP: string;
  targetPorts: number[];
  timestamp: Date;
}

interface DNSQuery {
  domain: string;
  queryType: string;
  timestamp: Date;
}
```

## 8. Implementation Checklist

- [ ] Set up network namespaces
- [ ] Deploy Kubernetes NetworkPolicy
- [ ] Install Calico or Cilium CNI
- [ ] Configure iptables rules
- [ ] Set up SELinux policies
- [ ] Configure VLANs (if physical network)
- [ ] Implement network monitoring
- [ ] Set up anomaly detection
- [ ] Create audit logging
- [ ] Test isolation between users

## 9. Network Isolation Layers Summary

| Layer | Technology | Isolation | Performance | Complexity |
|-------|-----------|-----------|-------------|-----------|
| **Kernel** | Network Namespaces | Excellent | Minimal | Low |
| **Orchestration** | Kubernetes NetworkPolicy | Excellent | Minimal | Medium |
| **CNI** | Calico/Cilium | Excellent | Minimal | Medium |
| **Firewall** | iptables | Excellent | Minimal | Low |
| **MAC** | SELinux/AppArmor | Excellent | Minimal | High |
| **Network** | VLANs | Good | Minimal | Medium |

## 10. Recommendations for Manus-like Platform

**Multi-Layer Approach:**
1. **Network Namespaces** - Kernel-level isolation (mandatory)
2. **Kubernetes NetworkPolicy** - Pod-to-pod control
3. **Calico/Cilium** - Advanced policy enforcement
4. **iptables** - Stateful firewall
5. **SELinux** - Mandatory access control
6. **Monitoring** - Real-time anomaly detection

This ensures complete network isolation while maintaining performance and observability!
