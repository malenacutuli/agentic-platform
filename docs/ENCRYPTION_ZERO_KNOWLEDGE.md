# Encryption and Zero-Knowledge Features

This guide covers data encryption at rest and in transit for sandbox file systems, database storage, and network traffic, along with zero-knowledge features including encrypted file storage, client-side encryption options, and key management for sandboxes.

---

## Table of Contents

1. [Encryption Architecture Overview](#encryption-architecture-overview)
2. [Encryption at Rest](#encryption-at-rest)
3. [Encryption in Transit](#encryption-in-transit)
4. [Zero-Knowledge Architecture](#zero-knowledge-architecture)
5. [Client-Side Encryption](#client-side-encryption)
6. [Key Management](#key-management)
7. [Implementation Guide](#implementation-guide)

---

## Encryption Architecture Overview

### Multi-Layer Encryption Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ENCRYPTION ARCHITECTURE                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: TRANSPORT ENCRYPTION (In Transit)                                     │   │
│  │  ├── TLS 1.3 for all external connections                                       │   │
│  │  ├── mTLS for internal service-to-service                                       │   │
│  │  └── Certificate pinning for critical services                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: STORAGE ENCRYPTION (At Rest)                                          │   │
│  │  ├── AES-256-GCM for file systems                                               │   │
│  │  ├── Transparent Data Encryption (TDE) for databases                            │   │
│  │  └── Server-side encryption for object storage                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: APPLICATION ENCRYPTION (Zero-Knowledge)                               │   │
│  │  ├── Client-side encryption before upload                                       │   │
│  │  ├── End-to-end encryption for sensitive data                                   │   │
│  │  └── User-controlled encryption keys                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  KEY MANAGEMENT                                                                 │   │
│  │  ├── HSM-backed master keys                                                     │   │
│  │  ├── Envelope encryption (DEK + KEK)                                            │   │
│  │  └── Automatic key rotation                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Encryption Standards

| Layer | Algorithm | Key Size | Purpose |
|-------|-----------|----------|---------|
| **Transport** | TLS 1.3 | 256-bit | Network traffic |
| **File System** | AES-256-GCM | 256-bit | Sandbox volumes |
| **Database** | AES-256-CBC | 256-bit | Database files |
| **Object Storage** | AES-256-GCM | 256-bit | S3 objects |
| **Client-Side** | AES-256-GCM | 256-bit | User data |
| **Key Wrapping** | RSA-OAEP | 4096-bit | Key encryption |

---

## Encryption at Rest

### Sandbox File System Encryption

```typescript
// server/encryption/filesystemEncryption.ts

interface FilesystemEncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-xts';
  keyDerivation: 'pbkdf2' | 'argon2id';
  keySize: 256;
  ivSize: 12;
  tagSize: 16;
}

class FilesystemEncryption {
  private config: FilesystemEncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'argon2id',
    keySize: 256,
    ivSize: 12,
    tagSize: 16,
  };

  /**
   * Encrypt sandbox volume
   */
  async encryptVolume(volumeId: string, masterKey: Buffer): Promise<EncryptedVolume> {
    // Generate unique Data Encryption Key (DEK) for this volume
    const dek = await this.generateDEK();
    
    // Wrap DEK with master key (Key Encryption Key - KEK)
    const wrappedDEK = await this.wrapKey(dek, masterKey);
    
    // Configure dm-crypt for volume encryption
    const dmCryptConfig = {
      cipher: 'aes-xts-plain64',
      keySize: 512, // 256-bit for each XTS key
      hash: 'sha256',
      offset: 0,
      skip: 0,
    };

    return {
      volumeId,
      wrappedDEK,
      dmCryptConfig,
      createdAt: new Date(),
    };
  }

  /**
   * Generate Data Encryption Key
   */
  private async generateDEK(): Promise<Buffer> {
    return crypto.randomBytes(32); // 256 bits
  }

  /**
   * Wrap DEK with KEK using AES-KW
   */
  private async wrapKey(dek: Buffer, kek: Buffer): Promise<Buffer> {
    const cipher = crypto.createCipheriv('aes-256-wrap', kek, Buffer.alloc(8, 0xa6));
    return Buffer.concat([cipher.update(dek), cipher.final()]);
  }
}
```

### LUKS Configuration for Volumes

```yaml
# kubernetes/encrypted-volume.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: sandbox-encrypted-volume
  annotations:
    encryption.kubernetes.io/type: "luks2"
    encryption.kubernetes.io/cipher: "aes-xts-plain64"
    encryption.kubernetes.io/key-size: "512"
    encryption.kubernetes.io/hash: "sha256"
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: encrypted-ssd
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: encrypted-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  encrypted: "true"
  kmsKeyId: "arn:aws:kms:eu-central-2:123456789:key/sandbox-volume-key"
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

### Database Encryption (TDE)

```typescript
// server/encryption/databaseEncryption.ts

interface DatabaseEncryptionConfig {
  provider: 'aws-kms' | 'hashicorp-vault' | 'local-hsm';
  algorithm: 'AES-256-CBC';
  keyRotationDays: number;
  tablespaceEncryption: boolean;
  columnEncryption: boolean;
}

class DatabaseEncryption {
  private config: DatabaseEncryptionConfig = {
    provider: 'aws-kms',
    algorithm: 'AES-256-CBC',
    keyRotationDays: 90,
    tablespaceEncryption: true,
    columnEncryption: true,
  };

  /**
   * Configure TDE for PostgreSQL
   */
  async configureTDE(databaseId: string): Promise<TDEConfiguration> {
    // Create master encryption key in KMS
    const masterKeyId = await this.createMasterKey(databaseId);
    
    // Configure pg_tde extension
    const tdeConfig = `
      -- Enable TDE extension
      CREATE EXTENSION IF NOT EXISTS pg_tde;
      
      -- Set master key
      SELECT pg_tde_set_master_key('${masterKeyId}');
      
      -- Enable encryption for tablespace
      ALTER TABLESPACE pg_default SET (encryption = on);
      
      -- Encrypt existing tables
      SELECT pg_tde_encrypt_table(relname::text)
      FROM pg_class
      WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace;
    `;

    return {
      databaseId,
      masterKeyId,
      algorithm: this.config.algorithm,
      enabled: true,
    };
  }

  /**
   * Column-level encryption for sensitive fields
   */
  async encryptColumn(
    table: string,
    column: string,
    data: string,
    keyId: string
  ): Promise<Buffer> {
    const key = await this.getKey(keyId);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    // Return IV + encrypted data
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt column data
   */
  async decryptColumn(encryptedData: Buffer, keyId: string): Promise<string> {
    const key = await this.getKey(keyId);
    const iv = encryptedData.slice(0, 16);
    const data = encryptedData.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]).toString('utf8');
  }
}
```

### Object Storage Encryption

```typescript
// server/encryption/storageEncryption.ts

interface S3EncryptionConfig {
  serverSideEncryption: 'AES256' | 'aws:kms';
  kmsKeyId?: string;
  bucketKeyEnabled: boolean;
  clientSideEncryption: boolean;
}

class StorageEncryption {
  private s3Client: S3Client;
  private kmsClient: KMSClient;

  /**
   * Upload with server-side encryption
   */
  async uploadEncrypted(
    bucket: string,
    key: string,
    data: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID,
      BucketKeyEnabled: true,
    });

    const result = await this.s3Client.send(command);
    
    return {
      key,
      versionId: result.VersionId,
      encryptionAlgorithm: 'aws:kms',
      kmsKeyId: process.env.KMS_KEY_ID,
    };
  }

  /**
   * Upload with client-side encryption
   */
  async uploadClientSideEncrypted(
    bucket: string,
    key: string,
    data: Buffer,
    userKey: Buffer
  ): Promise<UploadResult> {
    // Encrypt data client-side before upload
    const { encrypted, iv, authTag } = await this.encryptClientSide(data, userKey);
    
    // Store encryption metadata
    const metadata = {
      'x-amz-meta-encryption': 'client-side',
      'x-amz-meta-iv': iv.toString('base64'),
      'x-amz-meta-auth-tag': authTag.toString('base64'),
      'x-amz-meta-algorithm': 'AES-256-GCM',
    };

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: encrypted,
      Metadata: metadata,
      // Still use server-side encryption as additional layer
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID,
    });

    await this.s3Client.send(command);
    
    return {
      key,
      encryptionAlgorithm: 'client-side + aws:kms',
      clientSideEncrypted: true,
    };
  }

  /**
   * Client-side encryption using AES-256-GCM
   */
  private async encryptClientSide(
    data: Buffer,
    key: Buffer
  ): Promise<{ encrypted: Buffer; iv: Buffer; authTag: Buffer }> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return { encrypted, iv, authTag };
  }
}
```

---

## Encryption in Transit

### TLS Configuration

```typescript
// server/encryption/tlsConfig.ts

interface TLSConfiguration {
  minVersion: 'TLSv1.2' | 'TLSv1.3';
  cipherSuites: string[];
  certificateRotation: number; // days
  hsts: HSTSConfig;
}

const tlsConfig: TLSConfiguration = {
  minVersion: 'TLSv1.3',
  cipherSuites: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ],
  certificateRotation: 90,
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
};

class TLSManager {
  /**
   * Create TLS server options
   */
  createServerOptions(): https.ServerOptions {
    return {
      key: fs.readFileSync('/etc/ssl/private/server.key'),
      cert: fs.readFileSync('/etc/ssl/certs/server.crt'),
      ca: fs.readFileSync('/etc/ssl/certs/ca-chain.crt'),
      minVersion: 'TLSv1.3',
      ciphers: tlsConfig.cipherSuites.join(':'),
      honorCipherOrder: true,
      requestCert: false, // Set true for mTLS
      rejectUnauthorized: true,
    };
  }

  /**
   * Configure mTLS for internal services
   */
  createMTLSOptions(): https.ServerOptions {
    return {
      ...this.createServerOptions(),
      requestCert: true,
      rejectUnauthorized: true,
      ca: fs.readFileSync('/etc/ssl/certs/internal-ca.crt'),
    };
  }
}
```

### Envoy TLS Configuration

```yaml
# envoy/tls-config.yaml
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
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: backend
                      domains: ["*"]
                      routes:
                        - match:
                            prefix: "/"
                          route:
                            cluster: backend_cluster
          transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_params:
                  tls_minimum_protocol_version: TLSv1_3
                  tls_maximum_protocol_version: TLSv1_3
                  cipher_suites:
                    - TLS_AES_256_GCM_SHA384
                    - TLS_CHACHA20_POLY1305_SHA256
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/ssl/certs/server.crt
                    private_key:
                      filename: /etc/ssl/private/server.key
                validation_context:
                  trusted_ca:
                    filename: /etc/ssl/certs/ca-chain.crt

  clusters:
    - name: backend_cluster
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext
          common_tls_context:
            tls_params:
              tls_minimum_protocol_version: TLSv1_3
            tls_certificates:
              - certificate_chain:
                  filename: /etc/ssl/certs/client.crt
                private_key:
                  filename: /etc/ssl/private/client.key
            validation_context:
              trusted_ca:
                filename: /etc/ssl/certs/internal-ca.crt
      load_assignment:
        cluster_name: backend_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: backend.internal
                      port_value: 8443
```

### Internal Service Mesh mTLS

```yaml
# istio/mtls-config.yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: platform
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: sandbox-access
  namespace: sandboxes
spec:
  selector:
    matchLabels:
      app: sandbox
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/platform/sa/sandbox-controller"
              - "cluster.local/ns/platform/sa/api-gateway"
      to:
        - operation:
            methods: ["GET", "POST", "PUT", "DELETE"]
            paths: ["/api/*"]
```

---

## Zero-Knowledge Architecture

### Zero-Knowledge Design Principles

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           ZERO-KNOWLEDGE ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PRINCIPLE: Platform cannot access user data in plaintext                              │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  USER DEVICE                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  1. User enters password                                                │   │   │
│  │  │  2. Derive encryption key locally (PBKDF2/Argon2)                       │   │   │
│  │  │  3. Encrypt data before upload                                          │   │   │
│  │  │  4. Key NEVER leaves device                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│                              │ Encrypted data only                                     │
│                              ▼                                                          │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  PLATFORM (Zero Knowledge)                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │  │  • Stores encrypted blobs only                                          │   │   │
│  │  │  • Cannot decrypt user data                                             │   │   │
│  │  │  • No access to encryption keys                                         │   │   │
│  │  │  • Metadata may be encrypted or minimal                                 │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  WHAT PLATFORM CAN SEE:                     WHAT PLATFORM CANNOT SEE:                  │
│  • Encrypted blob sizes                     • File contents                            │
│  • Upload/download timestamps               • File names (if encrypted)                │
│  • User identifiers                         • Encryption keys                          │
│  • Storage usage                            • Plaintext data                           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Zero-Knowledge File Storage

```typescript
// client/encryption/zeroKnowledge.ts

interface ZeroKnowledgeConfig {
  keyDerivation: {
    algorithm: 'argon2id';
    memory: number;
    iterations: number;
    parallelism: number;
    saltLength: number;
  };
  encryption: {
    algorithm: 'aes-256-gcm';
    keyLength: 256;
    ivLength: 12;
    tagLength: 16;
  };
}

class ZeroKnowledgeClient {
  private config: ZeroKnowledgeConfig = {
    keyDerivation: {
      algorithm: 'argon2id',
      memory: 65536, // 64 MB
      iterations: 3,
      parallelism: 4,
      saltLength: 32,
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 256,
      ivLength: 12,
      tagLength: 16,
    },
  };

  /**
   * Derive encryption key from user password
   * Key derivation happens entirely on client
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // Use Argon2id for key derivation
    const keyMaterial = await argon2.hash({
      pass: password,
      salt: salt,
      type: argon2.ArgonType.Argon2id,
      hashLen: 32,
      mem: this.config.keyDerivation.memory,
      time: this.config.keyDerivation.iterations,
      parallelism: this.config.keyDerivation.parallelism,
    });

    // Import as CryptoKey for WebCrypto API
    return crypto.subtle.importKey(
      'raw',
      keyMaterial.hash,
      { name: 'AES-GCM', length: 256 },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt file client-side before upload
   */
  async encryptFile(
    file: File,
    encryptionKey: CryptoKey
  ): Promise<EncryptedFile> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();

    // Encrypt file content
    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      fileBuffer
    );

    // Encrypt filename
    const encryptedFilename = await this.encryptString(file.name, encryptionKey);

    // Encrypt metadata
    const metadata = {
      originalSize: file.size,
      mimeType: file.type,
      lastModified: file.lastModified,
    };
    const encryptedMetadata = await this.encryptString(
      JSON.stringify(metadata),
      encryptionKey
    );

    return {
      encryptedContent: new Uint8Array(encryptedContent),
      encryptedFilename,
      encryptedMetadata,
      iv,
      algorithm: 'AES-256-GCM',
    };
  }

  /**
   * Decrypt file client-side after download
   */
  async decryptFile(
    encryptedFile: EncryptedFile,
    encryptionKey: CryptoKey
  ): Promise<DecryptedFile> {
    // Decrypt content
    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encryptedFile.iv },
      encryptionKey,
      encryptedFile.encryptedContent
    );

    // Decrypt filename
    const filename = await this.decryptString(
      encryptedFile.encryptedFilename,
      encryptionKey
    );

    // Decrypt metadata
    const metadataJson = await this.decryptString(
      encryptedFile.encryptedMetadata,
      encryptionKey
    );
    const metadata = JSON.parse(metadataJson);

    return {
      content: new Uint8Array(decryptedContent),
      filename,
      metadata,
    };
  }

  /**
   * Encrypt string using AES-GCM
   */
  private async encryptString(
    plaintext: string,
    key: CryptoKey
  ): Promise<EncryptedString> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    return {
      ciphertext: new Uint8Array(encrypted),
      iv,
    };
  }

  /**
   * Decrypt string using AES-GCM
   */
  private async decryptString(
    encrypted: EncryptedString,
    key: CryptoKey
  ): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv },
      key,
      encrypted.ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }
}
```

### Zero-Knowledge Sandbox Encryption

```typescript
// server/encryption/sandboxZeroKnowledge.ts

interface ZeroKnowledgeSandbox {
  sandboxId: string;
  encryptedVolumeKey: Buffer;
  keyWrappingKeyId: string;
  userKeyRequired: boolean;
}

class ZeroKnowledgeSandboxManager {
  /**
   * Create zero-knowledge sandbox
   * User provides encryption key, platform cannot access data
   */
  async createZeroKnowledgeSandbox(
    userId: string,
    userPublicKey: Buffer
  ): Promise<ZeroKnowledgeSandbox> {
    // Generate random volume encryption key
    const volumeKey = crypto.randomBytes(32);
    
    // Encrypt volume key with user's public key
    // Only user can decrypt with their private key
    const encryptedVolumeKey = crypto.publicEncrypt(
      {
        key: userPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      volumeKey
    );

    // Store only encrypted key - platform cannot decrypt
    const sandbox = await this.createSandbox({
      userId,
      encryptedVolumeKey,
      zeroKnowledge: true,
    });

    // Clear plaintext key from memory
    volumeKey.fill(0);

    return {
      sandboxId: sandbox.id,
      encryptedVolumeKey,
      keyWrappingKeyId: 'user-public-key',
      userKeyRequired: true,
    };
  }

  /**
   * Mount zero-knowledge volume
   * User must provide decrypted volume key
   */
  async mountZeroKnowledgeVolume(
    sandboxId: string,
    decryptedVolumeKey: Buffer
  ): Promise<MountResult> {
    // Verify key is correct by attempting to read header
    const isValid = await this.verifyVolumeKey(sandboxId, decryptedVolumeKey);
    
    if (!isValid) {
      throw new Error('Invalid volume key');
    }

    // Mount encrypted volume with user-provided key
    // Key is only in memory during session
    const mountResult = await this.mountVolume(sandboxId, decryptedVolumeKey);

    // Schedule key cleanup on session end
    this.scheduleKeyCleanup(sandboxId, decryptedVolumeKey);

    return mountResult;
  }

  /**
   * Clean up key from memory
   */
  private scheduleKeyCleanup(sandboxId: string, key: Buffer): void {
    // Register cleanup on session end
    this.onSessionEnd(sandboxId, () => {
      key.fill(0); // Overwrite key in memory
    });
  }
}
```

---

## Client-Side Encryption

### Client-Side Encryption SDK

```typescript
// client/encryption/clientSideSDK.ts

interface ClientSideEncryptionOptions {
  algorithm: 'AES-256-GCM';
  keySource: 'password' | 'keyfile' | 'hardware';
  keyDerivation?: KeyDerivationOptions;
}

class ClientSideEncryptionSDK {
  private masterKey: CryptoKey | null = null;
  private options: ClientSideEncryptionOptions;

  constructor(options: ClientSideEncryptionOptions) {
    this.options = options;
  }

  /**
   * Initialize encryption with password
   */
  async initializeWithPassword(password: string): Promise<void> {
    // Generate or retrieve salt
    const salt = await this.getSalt();
    
    // Derive key from password
    this.masterKey = await this.deriveKeyFromPassword(password, salt);
  }

  /**
   * Initialize encryption with key file
   */
  async initializeWithKeyFile(keyFile: File): Promise<void> {
    const keyData = await keyFile.arrayBuffer();
    
    this.masterKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Initialize with hardware security key (WebAuthn)
   */
  async initializeWithHardwareKey(): Promise<void> {
    // Use WebAuthn to derive encryption key
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        allowCredentials: [],
        userVerification: 'required',
      },
    }) as PublicKeyCredential;

    // Derive key from credential
    const keyMaterial = await crypto.subtle.digest(
      'SHA-256',
      credential.response.signature
    );

    this.masterKey = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data
   */
  async encrypt(data: ArrayBuffer): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      data
    );

    return {
      ciphertext: new Uint8Array(encrypted),
      iv,
      algorithm: 'AES-256-GCM',
    };
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData): Promise<ArrayBuffer> {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encryptedData.iv },
      this.masterKey,
      encryptedData.ciphertext
    );
  }

  /**
   * Encrypt stream for large files
   */
  async encryptStream(
    inputStream: ReadableStream<Uint8Array>
  ): Promise<ReadableStream<Uint8Array>> {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    const key = this.masterKey;
    let chunkIndex = 0;

    return inputStream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) {
          // Generate unique IV for each chunk
          const iv = new Uint8Array(12);
          iv.set(new Uint8Array(new BigInt64Array([BigInt(chunkIndex++)]).buffer));
          
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            chunk
          );

          // Prepend IV to encrypted chunk
          const output = new Uint8Array(iv.length + encrypted.byteLength);
          output.set(iv);
          output.set(new Uint8Array(encrypted), iv.length);
          
          controller.enqueue(output);
        },
      })
    );
  }

  /**
   * Clear key from memory
   */
  async destroy(): Promise<void> {
    this.masterKey = null;
    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
  }
}
```

### React Hook for Client-Side Encryption

```typescript
// client/hooks/useClientSideEncryption.ts

interface UseClientSideEncryptionResult {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  initialize: (password: string) => Promise<void>;
  encrypt: (data: ArrayBuffer) => Promise<EncryptedData>;
  decrypt: (data: EncryptedData) => Promise<ArrayBuffer>;
  encryptFile: (file: File) => Promise<EncryptedFile>;
  decryptFile: (encryptedFile: EncryptedFile) => Promise<File>;
  destroy: () => Promise<void>;
}

function useClientSideEncryption(): UseClientSideEncryptionResult {
  const [sdk, setSdk] = useState<ClientSideEncryptionSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newSdk = new ClientSideEncryptionSDK({
        algorithm: 'AES-256-GCM',
        keySource: 'password',
      });
      
      await newSdk.initializeWithPassword(password);
      setSdk(newSdk);
      setIsInitialized(true);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const encrypt = useCallback(async (data: ArrayBuffer) => {
    if (!sdk) throw new Error('Not initialized');
    return sdk.encrypt(data);
  }, [sdk]);

  const decrypt = useCallback(async (data: EncryptedData) => {
    if (!sdk) throw new Error('Not initialized');
    return sdk.decrypt(data);
  }, [sdk]);

  const encryptFile = useCallback(async (file: File) => {
    if (!sdk) throw new Error('Not initialized');
    
    const arrayBuffer = await file.arrayBuffer();
    const encrypted = await sdk.encrypt(arrayBuffer);
    
    return {
      ...encrypted,
      filename: await sdk.encrypt(new TextEncoder().encode(file.name)),
      metadata: {
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      },
    };
  }, [sdk]);

  const destroy = useCallback(async () => {
    if (sdk) {
      await sdk.destroy();
      setSdk(null);
      setIsInitialized(false);
    }
  }, [sdk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sdk) {
        sdk.destroy();
      }
    };
  }, [sdk]);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    encrypt,
    decrypt,
    encryptFile,
    decryptFile: async () => { throw new Error('Not implemented'); },
    destroy,
  };
}
```

---

## Key Management

### Key Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           KEY MANAGEMENT HIERARCHY                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LEVEL 1: ROOT KEY (HSM)                                                        │   │
│  │  ├── Stored in Hardware Security Module                                         │   │
│  │  ├── Never exported                                                             │   │
│  │  ├── Used to wrap Master Keys                                                   │   │
│  │  └── Rotation: Annual (with key ceremony)                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                          │
│                              ▼ wraps                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LEVEL 2: MASTER KEYS (KMS)                                                     │   │
│  │  ├── Per-service master keys                                                    │   │
│  │  ├── Stored encrypted in KMS                                                    │   │
│  │  ├── Used to wrap Data Encryption Keys                                          │   │
│  │  └── Rotation: Quarterly                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                          │
│                              ▼ wraps                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  LEVEL 3: DATA ENCRYPTION KEYS (DEK)                                            │   │
│  │  ├── Per-resource keys (sandbox, file, database)                                │   │
│  │  ├── Stored wrapped by Master Key                                               │   │
│  │  ├── Unwrapped in memory for operations                                         │   │
│  │  └── Rotation: On-demand or policy-based                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
│  ENVELOPE ENCRYPTION:                                                                  │
│  Data → Encrypted with DEK → DEK wrapped with Master Key → Master Key in HSM          │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Management Service

```typescript
// server/encryption/keyManagement.ts

interface KeyManagementConfig {
  provider: 'aws-kms' | 'hashicorp-vault' | 'azure-keyvault' | 'gcp-kms';
  region: string;
  keyRotationDays: number;
  auditLogging: boolean;
}

class KeyManagementService {
  private kmsClient: KMSClient;
  private vaultClient: VaultClient;
  private config: KeyManagementConfig;

  /**
   * Create new Data Encryption Key
   */
  async createDEK(purpose: string): Promise<DataEncryptionKey> {
    // Generate DEK using KMS
    const response = await this.kmsClient.send(
      new GenerateDataKeyCommand({
        KeyId: process.env.MASTER_KEY_ID,
        KeySpec: 'AES_256',
        EncryptionContext: {
          purpose,
          createdAt: new Date().toISOString(),
        },
      })
    );

    return {
      keyId: crypto.randomUUID(),
      plaintext: response.Plaintext, // Use immediately, then clear
      ciphertext: response.CiphertextBlob, // Store this
      purpose,
      createdAt: new Date(),
      rotateAt: new Date(Date.now() + this.config.keyRotationDays * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Decrypt (unwrap) DEK for use
   */
  async decryptDEK(encryptedDEK: Buffer, context: Record<string, string>): Promise<Buffer> {
    const response = await this.kmsClient.send(
      new DecryptCommand({
        CiphertextBlob: encryptedDEK,
        EncryptionContext: context,
      })
    );

    return Buffer.from(response.Plaintext!);
  }

  /**
   * Rotate DEK
   */
  async rotateDEK(oldKeyId: string): Promise<DataEncryptionKey> {
    // Get old key metadata
    const oldKey = await this.getKeyMetadata(oldKeyId);
    
    // Create new DEK
    const newKey = await this.createDEK(oldKey.purpose);
    
    // Mark old key for deprecation
    await this.deprecateKey(oldKeyId, {
      replacedBy: newKey.keyId,
      deprecatedAt: new Date(),
    });

    // Log rotation event
    await this.logKeyEvent({
      type: 'rotation',
      oldKeyId,
      newKeyId: newKey.keyId,
      timestamp: new Date(),
    });

    return newKey;
  }

  /**
   * Re-encrypt data with new key
   */
  async reencryptData(
    encryptedData: Buffer,
    oldKeyId: string,
    newKeyId: string
  ): Promise<Buffer> {
    // Decrypt with old key
    const oldDEK = await this.decryptDEK(
      await this.getEncryptedDEK(oldKeyId),
      { keyId: oldKeyId }
    );
    
    const plaintext = await this.decryptWithDEK(encryptedData, oldDEK);
    
    // Clear old DEK from memory
    oldDEK.fill(0);

    // Encrypt with new key
    const newDEK = await this.decryptDEK(
      await this.getEncryptedDEK(newKeyId),
      { keyId: newKeyId }
    );
    
    const reencrypted = await this.encryptWithDEK(plaintext, newDEK);
    
    // Clear new DEK and plaintext from memory
    newDEK.fill(0);
    plaintext.fill(0);

    return reencrypted;
  }
}
```

### HashiCorp Vault Integration

```typescript
// server/encryption/vaultIntegration.ts

interface VaultConfig {
  address: string;
  namespace: string;
  authMethod: 'kubernetes' | 'approle' | 'token';
  transitEngine: string;
}

class VaultKeyManager {
  private client: VaultClient;
  private config: VaultConfig;

  /**
   * Initialize Vault client with Kubernetes auth
   */
  async initialize(): Promise<void> {
    // Read service account token
    const jwt = await fs.readFile(
      '/var/run/secrets/kubernetes.io/serviceaccount/token',
      'utf8'
    );

    // Authenticate with Vault
    const authResponse = await this.client.auth.kubernetes.login({
      role: 'sandbox-encryption',
      jwt,
    });

    this.client.token = authResponse.auth.client_token;
  }

  /**
   * Encrypt data using Vault Transit
   */
  async encrypt(keyName: string, plaintext: Buffer): Promise<string> {
    const response = await this.client.write(
      `${this.config.transitEngine}/encrypt/${keyName}`,
      {
        plaintext: plaintext.toString('base64'),
      }
    );

    return response.data.ciphertext;
  }

  /**
   * Decrypt data using Vault Transit
   */
  async decrypt(keyName: string, ciphertext: string): Promise<Buffer> {
    const response = await this.client.write(
      `${this.config.transitEngine}/decrypt/${keyName}`,
      {
        ciphertext,
      }
    );

    return Buffer.from(response.data.plaintext, 'base64');
  }

  /**
   * Generate data key (envelope encryption)
   */
  async generateDataKey(keyName: string): Promise<{
    plaintext: Buffer;
    ciphertext: string;
  }> {
    const response = await this.client.write(
      `${this.config.transitEngine}/datakey/plaintext/${keyName}`,
      {
        bits: 256,
      }
    );

    return {
      plaintext: Buffer.from(response.data.plaintext, 'base64'),
      ciphertext: response.data.ciphertext,
    };
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyName: string): Promise<void> {
    await this.client.write(
      `${this.config.transitEngine}/keys/${keyName}/rotate`,
      {}
    );

    // Log rotation
    await this.logKeyRotation(keyName);
  }
}
```

### Key Rotation Automation

```typescript
// server/encryption/keyRotation.ts

interface KeyRotationPolicy {
  keyType: 'master' | 'dek' | 'user';
  rotationInterval: number; // days
  gracePerion: number; // days to keep old key
  autoRotate: boolean;
}

class KeyRotationManager {
  private policies: Map<string, KeyRotationPolicy> = new Map([
    ['master', { keyType: 'master', rotationInterval: 365, gracePerion: 30, autoRotate: false }],
    ['dek', { keyType: 'dek', rotationInterval: 90, gracePerion: 7, autoRotate: true }],
    ['user', { keyType: 'user', rotationInterval: 180, gracePerion: 14, autoRotate: false }],
  ]);

  /**
   * Check and rotate keys based on policy
   */
  async checkAndRotateKeys(): Promise<RotationReport> {
    const report: RotationReport = {
      checked: 0,
      rotated: 0,
      errors: [],
    };

    for (const [keyType, policy] of this.policies) {
      if (!policy.autoRotate) continue;

      const keysToRotate = await this.findKeysNeedingRotation(keyType, policy);
      
      for (const key of keysToRotate) {
        try {
          await this.rotateKey(key);
          report.rotated++;
        } catch (error) {
          report.errors.push({
            keyId: key.id,
            error: error.message,
          });
        }
        report.checked++;
      }
    }

    return report;
  }

  /**
   * Rotate single key with re-encryption
   */
  async rotateKey(key: EncryptionKey): Promise<void> {
    // Create new key version
    const newKey = await this.keyManager.createDEK(key.purpose);
    
    // Find all data encrypted with this key
    const encryptedData = await this.findDataEncryptedWith(key.id);
    
    // Re-encrypt in batches
    for (const batch of this.batchData(encryptedData, 100)) {
      await Promise.all(
        batch.map(data => 
          this.keyManager.reencryptData(data.ciphertext, key.id, newKey.keyId)
        )
      );
    }

    // Update key status
    await this.deprecateKey(key.id);
    
    // Schedule old key deletion after grace period
    await this.scheduleKeyDeletion(key.id, this.policies.get(key.type)!.gracePerion);
  }
}
```

---

## Implementation Guide

### Encryption Implementation Checklist

```markdown
## At Rest Encryption
- [ ] Configure LUKS for sandbox volumes
- [ ] Enable TDE for databases
- [ ] Configure S3 server-side encryption
- [ ] Implement column-level encryption for sensitive fields
- [ ] Set up key rotation policies

## In Transit Encryption
- [ ] Configure TLS 1.3 for all external connections
- [ ] Enable mTLS for internal services
- [ ] Configure certificate rotation
- [ ] Implement HSTS

## Zero-Knowledge Features
- [ ] Implement client-side encryption SDK
- [ ] Set up key derivation (Argon2id)
- [ ] Configure encrypted file storage
- [ ] Implement encrypted metadata

## Key Management
- [ ] Set up HSM for root keys
- [ ] Configure KMS for master keys
- [ ] Implement envelope encryption
- [ ] Set up key rotation automation
- [ ] Configure audit logging for key operations
```

---

## Summary

### Encryption Standards

| Layer | Algorithm | Key Size | Rotation |
|-------|-----------|----------|----------|
| **Transport** | TLS 1.3 | 256-bit | 90 days |
| **File System** | AES-256-XTS | 512-bit | On-demand |
| **Database** | AES-256-CBC | 256-bit | 90 days |
| **Object Storage** | AES-256-GCM | 256-bit | Annual |
| **Client-Side** | AES-256-GCM | 256-bit | User-controlled |

### Zero-Knowledge Guarantees

| Feature | Implementation | Platform Access |
|---------|----------------|-----------------|
| **File Content** | Client-side encryption | None |
| **File Names** | Encrypted metadata | None |
| **User Keys** | Never transmitted | None |
| **Encryption Keys** | Derived client-side | None |
