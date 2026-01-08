# Reverse Proxy Architecture

This guide provides comprehensive coverage of reverse proxy architecture for agentic platforms, including proxy selection, configuration management, health checking, and dynamic routing.

---

## Table of Contents

1. [Overview](#overview)
2. [Proxy Selection](#proxy-selection)
3. [Envoy Proxy Configuration](#envoy-proxy-configuration)
4. [Dynamic Configuration with xDS](#dynamic-configuration-with-xds)
5. [Health Checking](#health-checking)
6. [Load Balancing](#load-balancing)
7. [Circuit Breaking](#circuit-breaking)
8. [Observability](#observability)
9. [High Availability](#high-availability)
10. [Best Practices](#best-practices)

---

## Overview

The reverse proxy is the gateway between the internet and sandbox environments. It handles SSL termination, routing, load balancing, and health checking.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           REVERSE PROXY ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  INTERNET                                                                               │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        CLOUDFLARE (Edge/CDN)                                     │   │
│  │  • DDoS protection                                                               │   │
│  │  • Edge caching                                                                  │   │
│  │  • WAF rules                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        ENVOY PROXY (L7 Gateway)                                  │   │
│  │  • SSL termination                                                               │   │
│  │  • Dynamic routing (xDS)                                                         │   │
│  │  • Health checking                                                               │   │
│  │  • Circuit breaking                                                              │   │
│  │  • Observability                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ├──────────────────────┬──────────────────────┬────────────────────┐              │
│      ▼                      ▼                      ▼                    ▼              │
│  ┌────────┐            ┌────────┐            ┌────────┐           ┌────────┐          │
│  │Sandbox │            │Sandbox │            │Sandbox │           │Sandbox │          │
│  │  001   │            │  002   │            │  003   │           │  ...   │          │
│  │ :3000  │            │ :3000  │            │ :3000  │           │ :3000  │          │
│  └────────┘            └────────┘            └────────┘           └────────┘          │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Proxy Selection

### Comparison Matrix

| Feature | Envoy | nginx | HAProxy | Traefik |
|---------|-------|-------|---------|---------|
| Dynamic config | xDS API | Reload | Runtime API | Native |
| WebSocket | Excellent | Good | Good | Good |
| HTTP/2 | Full | Full | Limited | Full |
| gRPC | Native | Proxy | Limited | Native |
| Observability | Excellent | Basic | Good | Good |
| Service mesh | Istio/Linkerd | - | - | Consul |
| Config complexity | High | Low | Medium | Low |
| Performance | Excellent | Excellent | Excellent | Good |

### Why Envoy?

Envoy is the recommended choice for agentic platforms because:

1. **Dynamic configuration** - xDS API allows zero-downtime config updates
2. **WebSocket support** - Critical for HMR tunneling
3. **Observability** - Built-in metrics, tracing, logging
4. **Circuit breaking** - Automatic failure isolation
5. **Service mesh ready** - Integrates with Istio, Linkerd

---

## Envoy Proxy Configuration

### Basic Configuration

```yaml
# envoy.yaml
static_resources:
  listeners:
    - name: https_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                codec_type: AUTO
                
                # WebSocket support
                upgrade_configs:
                  - upgrade_type: websocket
                
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: sandbox_routing
                      domains: ["*.manus.computer"]
                      routes:
                        - match:
                            prefix: "/"
                          route:
                            cluster: sandbox_cluster
                            timeout: 0s  # No timeout for WebSocket
                
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
          
          transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/ssl/certs/wildcard.crt
                    private_key:
                      filename: /etc/ssl/private/wildcard.key

  clusters:
    - name: sandbox_cluster
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      load_assignment:
        cluster_name: sandbox_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: sandbox-service
                      port_value: 3000
```

### WebSocket Configuration

```yaml
# WebSocket-specific configuration
http_connection_manager:
  upgrade_configs:
    - upgrade_type: websocket
      enabled: true
  
  # Increase timeouts for long-lived connections
  stream_idle_timeout: 0s
  request_timeout: 0s
  
  # Enable WebSocket stats
  stat_prefix: websocket_ingress
```

### Dynamic Routing Based on Subdomain

```yaml
route_config:
  virtual_hosts:
    - name: sandbox_routing
      domains: ["*.manus.computer"]
      routes:
        - match:
            prefix: "/"
            headers:
              - name: ":authority"
                string_match:
                  safe_regex:
                    google_re2: {}
                    regex: "^(\\d+)-([a-zA-Z0-9]+)\\..*"
          route:
            cluster_header: "x-sandbox-cluster"
          request_headers_to_add:
            - header:
                key: "x-sandbox-id"
                value: "%REQ(:authority)%"
```

---

## Dynamic Configuration with xDS

### xDS Protocol Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          xDS PROTOCOL FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │   Control   │◄──gRPC──│   Envoy     │         │   Sandbox   │           │
│  │   Plane     │         │   Proxy     │◄──HTTP──│   Service   │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                        ▲                                           │
│        │                        │                                           │
│        ▼                        │                                           │
│  ┌─────────────┐                │                                           │
│  │   Service   │                │                                           │
│  │   Registry  │────────────────┘                                           │
│  │   (Redis)   │   Push config updates                                      │
│  └─────────────┘                                                            │
│                                                                             │
│  xDS Types:                                                                 │
│  • LDS (Listener Discovery Service) - Listener configuration               │
│  • RDS (Route Discovery Service) - Route configuration                     │
│  • CDS (Cluster Discovery Service) - Cluster configuration                 │
│  • EDS (Endpoint Discovery Service) - Endpoint addresses                   │
│  • SDS (Secret Discovery Service) - TLS certificates                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Control Plane Implementation

```typescript
// src/services/envoyControlPlane.ts
import { Server, ServerCredentials } from '@grpc/grpc-js';
import { AggregatedDiscoveryServiceService } from './generated/ads_grpc_pb';

interface Endpoint {
  sandboxId: string;
  address: string;
  port: number;
  healthy: boolean;
}

class EnvoyControlPlane {
  private endpoints: Map<string, Endpoint> = new Map();
  private subscribers: Set<any> = new Set();
  
  constructor(private redis: Redis) {
    this.subscribeToUpdates();
  }
  
  private subscribeToUpdates(): void {
    // Listen for sandbox registration events
    this.redis.subscribe('sandbox:registered', (message) => {
      const endpoint = JSON.parse(message);
      this.addEndpoint(endpoint);
    });
    
    this.redis.subscribe('sandbox:deregistered', (message) => {
      const { sandboxId } = JSON.parse(message);
      this.removeEndpoint(sandboxId);
    });
  }
  
  addEndpoint(endpoint: Endpoint): void {
    this.endpoints.set(endpoint.sandboxId, endpoint);
    this.pushUpdate();
  }
  
  removeEndpoint(sandboxId: string): void {
    this.endpoints.delete(sandboxId);
    this.pushUpdate();
  }
  
  private pushUpdate(): void {
    const config = this.generateConfig();
    
    for (const subscriber of this.subscribers) {
      subscriber.write(config);
    }
  }
  
  private generateConfig(): any {
    // Generate EDS (Endpoint Discovery Service) response
    return {
      version_info: Date.now().toString(),
      resources: [{
        '@type': 'type.googleapis.com/envoy.config.endpoint.v3.ClusterLoadAssignment',
        cluster_name: 'sandbox_cluster',
        endpoints: [{
          lb_endpoints: Array.from(this.endpoints.values())
            .filter(e => e.healthy)
            .map(e => ({
              endpoint: {
                address: {
                  socket_address: {
                    address: e.address,
                    port_value: e.port,
                  },
                },
              },
              health_status: 'HEALTHY',
            })),
        }],
      }],
    };
  }
  
  // gRPC stream handler
  handleStream(stream: any): void {
    this.subscribers.add(stream);
    
    // Send initial config
    stream.write(this.generateConfig());
    
    stream.on('end', () => {
      this.subscribers.delete(stream);
    });
  }
}
```

### Envoy Bootstrap for xDS

```yaml
# envoy-bootstrap.yaml
node:
  id: envoy-proxy-1
  cluster: sandbox-gateway

dynamic_resources:
  lds_config:
    resource_api_version: V3
    api_config_source:
      api_type: GRPC
      transport_api_version: V3
      grpc_services:
        - envoy_grpc:
            cluster_name: xds_cluster
  
  cds_config:
    resource_api_version: V3
    api_config_source:
      api_type: GRPC
      transport_api_version: V3
      grpc_services:
        - envoy_grpc:
            cluster_name: xds_cluster

static_resources:
  clusters:
    - name: xds_cluster
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      typed_extension_protocol_options:
        envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
          "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
          explicit_http_config:
            http2_protocol_options: {}
      load_assignment:
        cluster_name: xds_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: control-plane
                      port_value: 18000
```

---

## Health Checking

### Active Health Checks

```yaml
clusters:
  - name: sandbox_cluster
    health_checks:
      - timeout: 3s
        interval: 10s
        unhealthy_threshold: 3
        healthy_threshold: 2
        
        http_health_check:
          path: /health
          expected_statuses:
            - start: 200
              end: 299
        
        # For WebSocket endpoints
        custom_health_check:
          name: envoy.health_checkers.tcp
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.health_checkers.tcp.v3.Tcp
```

### Passive Health Checks (Outlier Detection)

```yaml
clusters:
  - name: sandbox_cluster
    outlier_detection:
      # Consecutive errors before ejection
      consecutive_5xx: 5
      
      # Time between ejection analysis
      interval: 10s
      
      # Base ejection time
      base_ejection_time: 30s
      
      # Maximum ejection percentage
      max_ejection_percent: 50
      
      # Consecutive gateway errors
      consecutive_gateway_failure: 3
      
      # Success rate based ejection
      enforcing_success_rate: 100
      success_rate_minimum_hosts: 3
      success_rate_request_volume: 100
      success_rate_stdev_factor: 1900
```

### Health Check Implementation

```typescript
// src/services/healthChecker.ts
import axios from 'axios';

interface HealthStatus {
  sandboxId: string;
  healthy: boolean;
  lastCheck: Date;
  latency: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

class HealthChecker {
  private status: Map<string, HealthStatus> = new Map();
  private readonly HEALTHY_THRESHOLD = 2;
  private readonly UNHEALTHY_THRESHOLD = 3;
  
  async checkHealth(sandboxId: string, url: string): Promise<boolean> {
    const start = Date.now();
    let healthy = false;
    
    try {
      const response = await axios.get(`${url}/health`, {
        timeout: 3000,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      
      healthy = true;
    } catch (error) {
      healthy = false;
    }
    
    const latency = Date.now() - start;
    this.updateStatus(sandboxId, healthy, latency);
    
    return this.isHealthy(sandboxId);
  }
  
  private updateStatus(sandboxId: string, checkPassed: boolean, latency: number): void {
    const current = this.status.get(sandboxId) || {
      sandboxId,
      healthy: false,
      lastCheck: new Date(),
      latency: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };
    
    if (checkPassed) {
      current.consecutiveSuccesses++;
      current.consecutiveFailures = 0;
      
      if (current.consecutiveSuccesses >= this.HEALTHY_THRESHOLD) {
        current.healthy = true;
      }
    } else {
      current.consecutiveFailures++;
      current.consecutiveSuccesses = 0;
      
      if (current.consecutiveFailures >= this.UNHEALTHY_THRESHOLD) {
        current.healthy = false;
      }
    }
    
    current.lastCheck = new Date();
    current.latency = latency;
    
    this.status.set(sandboxId, current);
  }
  
  isHealthy(sandboxId: string): boolean {
    return this.status.get(sandboxId)?.healthy ?? false;
  }
  
  getStatus(sandboxId: string): HealthStatus | undefined {
    return this.status.get(sandboxId);
  }
  
  getAllStatus(): HealthStatus[] {
    return Array.from(this.status.values());
  }
}

export const healthChecker = new HealthChecker();
```

---

## Load Balancing

### Load Balancing Policies

```yaml
clusters:
  - name: sandbox_cluster
    # Round Robin (default)
    lb_policy: ROUND_ROBIN
    
    # Least Requests
    # lb_policy: LEAST_REQUEST
    
    # Random
    # lb_policy: RANDOM
    
    # Ring Hash (for sticky sessions)
    # lb_policy: RING_HASH
    # ring_hash_lb_config:
    #   minimum_ring_size: 1024
```

### Sticky Sessions for WebSocket

```yaml
route_config:
  virtual_hosts:
    - name: sandbox_routing
      routes:
        - match:
            prefix: "/"
          route:
            cluster: sandbox_cluster
            hash_policy:
              - header:
                  header_name: "x-sandbox-id"
              - connection_properties:
                  source_ip: true
```

### Weighted Load Balancing

```yaml
clusters:
  - name: sandbox_cluster
    load_assignment:
      endpoints:
        - locality:
            region: us-east-1
          lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: sandbox-1
                    port_value: 3000
              load_balancing_weight: 100
            - endpoint:
                address:
                  socket_address:
                    address: sandbox-2
                    port_value: 3000
              load_balancing_weight: 50  # Half the traffic
```

---

## Circuit Breaking

### Configuration

```yaml
clusters:
  - name: sandbox_cluster
    circuit_breakers:
      thresholds:
        - priority: DEFAULT
          # Maximum concurrent connections
          max_connections: 1000
          
          # Maximum pending requests
          max_pending_requests: 1000
          
          # Maximum concurrent requests
          max_requests: 1000
          
          # Maximum concurrent retries
          max_retries: 3
          
          # Track remaining resources
          track_remaining: true
        
        - priority: HIGH
          max_connections: 2000
          max_pending_requests: 2000
          max_requests: 2000
          max_retries: 5
```

### Circuit Breaker States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CIRCUIT BREAKER STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────┐                                     │
│                    │                  │                                     │
│        Success     │     CLOSED       │     Failure threshold              │
│       ◄────────────│   (Normal)       │────────────────►                   │
│                    │                  │                                     │
│                    └──────────────────┘                                     │
│                             │                                               │
│                             │ Failures exceed threshold                     │
│                             ▼                                               │
│                    ┌──────────────────┐                                     │
│                    │                  │                                     │
│                    │      OPEN        │                                     │
│                    │   (Failing)      │                                     │
│                    │                  │                                     │
│                    └──────────────────┘                                     │
│                             │                                               │
│                             │ Timeout expires                               │
│                             ▼                                               │
│                    ┌──────────────────┐                                     │
│        Failure     │                  │     Success                         │
│       ◄────────────│   HALF-OPEN      │────────────────►                   │
│       (Back to     │   (Testing)      │    (Back to CLOSED)                │
│        OPEN)       │                  │                                     │
│                    └──────────────────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Observability

### Metrics Configuration

```yaml
admin:
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 9901

stats_config:
  stats_tags:
    - tag_name: sandbox_id
      regex: "^cluster\\.(\\w+)\\."
  
  use_all_default_tags: true

stats_sinks:
  - name: envoy.stat_sinks.statsd
    typed_config:
      "@type": type.googleapis.com/envoy.config.metrics.v3.StatsdSink
      address:
        socket_address:
          address: statsd
          port_value: 8125
      prefix: envoy
```

### Key Metrics to Monitor

```typescript
const keyMetrics = {
  // Request metrics
  'envoy_cluster_upstream_rq_total': 'Total requests',
  'envoy_cluster_upstream_rq_xx': 'Requests by status code',
  'envoy_cluster_upstream_rq_time': 'Request latency',
  
  // Connection metrics
  'envoy_cluster_upstream_cx_active': 'Active connections',
  'envoy_cluster_upstream_cx_total': 'Total connections',
  'envoy_cluster_upstream_cx_connect_fail': 'Connection failures',
  
  // Health check metrics
  'envoy_cluster_health_check_success': 'Health check successes',
  'envoy_cluster_health_check_failure': 'Health check failures',
  
  // Circuit breaker metrics
  'envoy_cluster_circuit_breakers_default_cx_open': 'Circuit breaker open',
  'envoy_cluster_circuit_breakers_default_rq_pending_open': 'Pending requests limited',
  
  // Outlier detection
  'envoy_cluster_outlier_detection_ejections_active': 'Currently ejected hosts',
  'envoy_cluster_outlier_detection_ejections_total': 'Total ejections',
};
```

### Distributed Tracing

```yaml
tracing:
  http:
    name: envoy.tracers.zipkin
    typed_config:
      "@type": type.googleapis.com/envoy.config.trace.v3.ZipkinConfig
      collector_cluster: zipkin
      collector_endpoint: "/api/v2/spans"
      collector_endpoint_version: HTTP_JSON
```

### Access Logging

```yaml
http_connection_manager:
  access_log:
    - name: envoy.access_loggers.file
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
        path: /var/log/envoy/access.log
        log_format:
          json_format:
            timestamp: "%START_TIME%"
            method: "%REQ(:METHOD)%"
            path: "%REQ(X-ENVOY-ORIGINAL-PATH?:PATH)%"
            protocol: "%PROTOCOL%"
            response_code: "%RESPONSE_CODE%"
            response_flags: "%RESPONSE_FLAGS%"
            bytes_received: "%BYTES_RECEIVED%"
            bytes_sent: "%BYTES_SENT%"
            duration: "%DURATION%"
            upstream_host: "%UPSTREAM_HOST%"
            x_forwarded_for: "%REQ(X-FORWARDED-FOR)%"
            user_agent: "%REQ(USER-AGENT)%"
            sandbox_id: "%REQ(X-SANDBOX-ID)%"
```

---

## High Availability

### Multi-Instance Deployment

```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: envoy-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: envoy-proxy
  template:
    metadata:
      labels:
        app: envoy-proxy
    spec:
      containers:
        - name: envoy
          image: envoyproxy/envoy:v1.28.0
          ports:
            - containerPort: 443
            - containerPort: 9901
          resources:
            requests:
              cpu: "500m"
              memory: "256Mi"
            limits:
              cpu: "2000m"
              memory: "1Gi"
          readinessProbe:
            httpGet:
              path: /ready
              port: 9901
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /server_info
              port: 9901
            initialDelaySeconds: 10
            periodSeconds: 30
```

### Graceful Shutdown

```yaml
# Drain connections before shutdown
admin:
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 9901

# In Kubernetes
lifecycle:
  preStop:
    exec:
      command:
        - /bin/sh
        - -c
        - "wget -qO- http://localhost:9901/drain_listeners && sleep 30"
```

---

## Best Practices

### 1. Use Dynamic Configuration

```yaml
# Prefer xDS over static configuration
dynamic_resources:
  lds_config:
    resource_api_version: V3
    api_config_source:
      api_type: GRPC
```

### 2. Configure Appropriate Timeouts

```yaml
clusters:
  - name: sandbox_cluster
    connect_timeout: 5s
    
http_connection_manager:
  stream_idle_timeout: 300s  # 5 minutes for WebSocket
  request_timeout: 60s       # 1 minute for HTTP
```

### 3. Enable Circuit Breaking

```yaml
circuit_breakers:
  thresholds:
    - max_connections: 1000
      max_pending_requests: 1000
```

### 4. Implement Health Checks

```yaml
health_checks:
  - timeout: 3s
    interval: 10s
    unhealthy_threshold: 3
    healthy_threshold: 2
```

### 5. Monitor Key Metrics

```typescript
const alertThresholds = {
  error_rate: 0.01,        // 1% error rate
  p99_latency: 1000,       // 1 second
  circuit_breaker_open: 0, // Any open circuit
};
```

---

## Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Primary Proxy** | Envoy | L7 routing, WebSocket, observability |
| **Config Management** | xDS API | Zero-downtime updates |
| **Health Check** | Active + Passive | Comprehensive monitoring |
| **Load Balancing** | Round Robin/Least Conn | Traffic distribution |
| **Circuit Breaking** | Envoy built-in | Failure isolation |
| **Observability** | Prometheus + Zipkin | Metrics and tracing |

### Key Configuration Points

| Setting | Recommended Value | Notes |
|---------|-------------------|-------|
| Connect timeout | 5s | Fast failure detection |
| Health check interval | 10s | Balance accuracy vs load |
| Unhealthy threshold | 3 | Avoid flapping |
| Circuit breaker max_connections | 1000 | Per cluster |
| WebSocket idle timeout | 300s | Keep connections alive |
