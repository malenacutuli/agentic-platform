# Template Validation

This guide covers the validation process for user-submitted templates before marketplace approval, including security scanning, structure validation, dependency auditing, and quality checks.

---

## Table of Contents

1. [Validation Overview](#validation-overview)
2. [Structure Validation](#structure-validation)
3. [Security Scanning](#security-scanning)
4. [Dependency Auditing](#dependency-auditing)
5. [Code Quality Checks](#code-quality-checks)
6. [Metadata Validation](#metadata-validation)
7. [Build Verification](#build-verification)
8. [Approval Workflow](#approval-workflow)

---

## Validation Overview

### Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE VALIDATION PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SUBMISSION                                                                             │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 1: STRUCTURE VALIDATION                                                   │   │
│  │  • Required files present (template.json, package.json)                         │   │
│  │  • Directory structure correct                                                   │   │
│  │  • File naming conventions                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 2: SECURITY SCANNING                                                      │   │
│  │  • Malicious code detection                                                      │   │
│  │  • Secret/credential scanning                                                    │   │
│  │  • Dangerous pattern detection                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 3: DEPENDENCY AUDIT                                                       │   │
│  │  • Known vulnerability check (npm audit)                                        │   │
│  │  • License compliance                                                            │   │
│  │  • Outdated dependency detection                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 4: CODE QUALITY                                                           │   │
│  │  • Linting (ESLint, Prettier)                                                   │   │
│  │  • TypeScript type checking                                                      │   │
│  │  • Best practices validation                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 5: BUILD VERIFICATION                                                     │   │
│  │  • Clean install test                                                            │   │
│  │  • Build success verification                                                    │   │
│  │  • Test suite execution                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 6: METADATA VALIDATION                                                    │   │
│  │  • template.json schema validation                                              │   │
│  │  • README completeness                                                           │   │
│  │  • Screenshot/preview verification                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│      │                                                                                  │
│      ▼                                                                                  │
│  APPROVAL / REJECTION                                                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Validation Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Error** | Critical issue, must fix | Block submission |
| **Warning** | Potential issue | Require acknowledgment |
| **Info** | Suggestion | Optional improvement |

---

## Structure Validation

### Required Files

```typescript
// validation/structure-validator.ts

interface RequiredFile {
  path: string;
  required: boolean;
  description: string;
  validator?: (content: string) => ValidationResult;
}

const requiredFiles: RequiredFile[] = [
  {
    path: 'template.json',
    required: true,
    description: 'Template metadata and configuration',
    validator: validateTemplateJson,
  },
  {
    path: 'template/package.json',
    required: true,
    description: 'Project dependencies and scripts',
    validator: validatePackageJson,
  },
  {
    path: 'README.md',
    required: true,
    description: 'Template documentation',
    validator: validateReadme,
  },
  {
    path: 'template/.gitignore',
    required: true,
    description: 'Git ignore patterns',
  },
  {
    path: 'template/.env.example',
    required: false,
    description: 'Environment variable template',
  },
  {
    path: 'preview.png',
    required: false,
    description: 'Template preview image',
    validator: validatePreviewImage,
  },
  {
    path: 'hooks/pre-init.sh',
    required: false,
    description: 'Pre-initialization hook',
  },
  {
    path: 'hooks/post-init.js',
    required: false,
    description: 'Post-initialization hook',
  },
];

class StructureValidator {
  /**
   * Validate template structure
   */
  async validate(templatePath: string): Promise<ValidationReport> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(templatePath, file.path);
      const exists = await this.fileExists(filePath);

      if (!exists && file.required) {
        errors.push({
          code: 'MISSING_REQUIRED_FILE',
          message: `Missing required file: ${file.path}`,
          file: file.path,
          severity: 'error',
        });
      } else if (!exists && !file.required) {
        warnings.push({
          code: 'MISSING_OPTIONAL_FILE',
          message: `Missing optional file: ${file.path} - ${file.description}`,
          file: file.path,
          severity: 'warning',
        });
      } else if (exists && file.validator) {
        const content = await fs.readFile(filePath, 'utf-8');
        const result = file.validator(content);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    // Check directory structure
    const structureErrors = await this.validateDirectoryStructure(templatePath);
    errors.push(...structureErrors);

    // Check file naming conventions
    const namingErrors = await this.validateFileNaming(templatePath);
    warnings.push(...namingErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate directory structure
   */
  private async validateDirectoryStructure(
    templatePath: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Must have template/ directory
    const templateDir = path.join(templatePath, 'template');
    if (!await this.directoryExists(templateDir)) {
      errors.push({
        code: 'MISSING_TEMPLATE_DIR',
        message: 'Missing template/ directory containing project files',
        severity: 'error',
      });
    }

    // Check for forbidden directories
    const forbiddenDirs = ['node_modules', '.git', 'dist', 'build'];
    for (const dir of forbiddenDirs) {
      const dirPath = path.join(templatePath, 'template', dir);
      if (await this.directoryExists(dirPath)) {
        errors.push({
          code: 'FORBIDDEN_DIRECTORY',
          message: `Forbidden directory found: template/${dir}`,
          file: `template/${dir}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate file naming conventions
   */
  private async validateFileNaming(
    templatePath: string
  ): Promise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = [];
    const files = await this.getAllFiles(templatePath);

    for (const file of files) {
      // Check for spaces in filenames
      if (file.includes(' ')) {
        warnings.push({
          code: 'FILENAME_SPACES',
          message: `Filename contains spaces: ${file}`,
          file,
          severity: 'warning',
        });
      }

      // Check for uppercase extensions
      const ext = path.extname(file);
      if (ext !== ext.toLowerCase()) {
        warnings.push({
          code: 'UPPERCASE_EXTENSION',
          message: `File extension should be lowercase: ${file}`,
          file,
          severity: 'warning',
        });
      }
    }

    return warnings;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }
}

export { StructureValidator, requiredFiles };
```

### template.json Schema

```typescript
// validation/template-json-schema.ts

import Ajv from 'ajv';

const templateJsonSchema = {
  type: 'object',
  required: ['name', 'version', 'description', 'category'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      minLength: 3,
      maxLength: 50,
      description: 'Template identifier (lowercase, hyphens only)',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Semantic version (e.g., 1.0.0)',
    },
    displayName: {
      type: 'string',
      minLength: 3,
      maxLength: 100,
      description: 'Human-readable template name',
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
      description: 'Template description',
    },
    category: {
      type: 'string',
      enum: [
        'web-frontend',
        'web-fullstack',
        'api',
        'cli',
        'library',
        'mobile',
        'desktop',
        'data',
        'ai-ml',
        'other',
      ],
    },
    tags: {
      type: 'array',
      items: { type: 'string', maxLength: 30 },
      maxItems: 10,
    },
    author: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        url: { type: 'string', format: 'uri' },
      },
    },
    repository: {
      type: 'string',
      format: 'uri',
    },
    license: {
      type: 'string',
      enum: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'Unlicense'],
    },
    engines: {
      type: 'object',
      properties: {
        node: { type: 'string' },
        pnpm: { type: 'string' },
      },
    },
    features: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          default: { type: 'boolean' },
        },
      },
    },
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'message'],
        properties: {
          id: { type: 'string' },
          type: { 
            type: 'string',
            enum: ['text', 'select', 'multiselect', 'confirm'],
          },
          message: { type: 'string' },
          default: {},
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
        },
      },
    },
    hooks: {
      type: 'object',
      properties: {
        preInit: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            timeout: { type: 'number', minimum: 1000, maximum: 300000 },
          },
        },
        postInit: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            timeout: { type: 'number', minimum: 1000, maximum: 600000 },
          },
        },
      },
    },
  },
  additionalProperties: false,
};

function validateTemplateJson(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const json = JSON.parse(content);
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(templateJsonSchema);
    
    if (!validate(json)) {
      for (const error of validate.errors || []) {
        errors.push({
          code: 'SCHEMA_VALIDATION',
          message: `${error.instancePath} ${error.message}`,
          file: 'template.json',
          severity: 'error',
        });
      }
    }

    // Additional semantic validations
    if (json.version === '0.0.0') {
      warnings.push({
        code: 'VERSION_ZERO',
        message: 'Version 0.0.0 suggests template is not ready for release',
        file: 'template.json',
        severity: 'warning',
      });
    }

  } catch (e) {
    errors.push({
      code: 'INVALID_JSON',
      message: `Invalid JSON: ${(e as Error).message}`,
      file: 'template.json',
      severity: 'error',
    });
  }

  return { errors, warnings };
}

export { templateJsonSchema, validateTemplateJson };
```

---

## Security Scanning

### Security Scanner

```typescript
// validation/security-scanner.ts

interface SecurityIssue {
  type: 'malicious' | 'secret' | 'dangerous' | 'suspicious';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  message: string;
  pattern?: string;
}

class SecurityScanner {
  // Patterns for detecting malicious code
  private maliciousPatterns = [
    // Code execution
    { pattern: /eval\s*\(/g, message: 'eval() usage detected', severity: 'high' as const },
    { pattern: /new\s+Function\s*\(/g, message: 'new Function() usage detected', severity: 'high' as const },
    { pattern: /child_process\.exec\s*\(/g, message: 'Uncontrolled command execution', severity: 'critical' as const },
    { pattern: /execSync\s*\([^)]*\$\{/g, message: 'Command injection risk', severity: 'critical' as const },
    
    // Network exfiltration
    { pattern: /fetch\s*\(\s*['"`]https?:\/\/[^'"]+['"`]\s*,\s*\{[^}]*body:/g, message: 'Data exfiltration risk', severity: 'high' as const },
    { pattern: /XMLHttpRequest/g, message: 'XMLHttpRequest usage (review for data exfiltration)', severity: 'medium' as const },
    
    // File system access
    { pattern: /fs\.(writeFile|appendFile|unlink|rmdir)\s*\(\s*['"`]\/(?!tmp)/g, message: 'Writing to system paths', severity: 'critical' as const },
    { pattern: /process\.env\.(HOME|USER|PATH)/g, message: 'Accessing sensitive environment variables', severity: 'medium' as const },
    
    // Crypto mining
    { pattern: /coinhive|cryptonight|monero/gi, message: 'Potential crypto mining code', severity: 'critical' as const },
    
    // Obfuscation
    { pattern: /\\x[0-9a-f]{2}/gi, message: 'Hex-encoded strings (potential obfuscation)', severity: 'medium' as const },
    { pattern: /atob\s*\(\s*['"`][A-Za-z0-9+/=]{50,}/g, message: 'Base64-encoded payload', severity: 'high' as const },
  ];

  // Patterns for detecting secrets
  private secretPatterns = [
    // API Keys
    { pattern: /['"`]sk-[a-zA-Z0-9]{32,}['"`]/g, message: 'OpenAI API key detected', type: 'api_key' },
    { pattern: /['"`]AKIA[0-9A-Z]{16}['"`]/g, message: 'AWS Access Key ID detected', type: 'aws_key' },
    { pattern: /['"`][0-9a-zA-Z/+]{40}['"`]/g, message: 'Potential AWS Secret Key', type: 'aws_secret' },
    { pattern: /['"`]ghp_[a-zA-Z0-9]{36}['"`]/g, message: 'GitHub Personal Access Token', type: 'github_token' },
    { pattern: /['"`]gho_[a-zA-Z0-9]{36}['"`]/g, message: 'GitHub OAuth Token', type: 'github_oauth' },
    { pattern: /['"`]glpat-[a-zA-Z0-9-_]{20,}['"`]/g, message: 'GitLab Personal Access Token', type: 'gitlab_token' },
    
    // Database credentials
    { pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g, message: 'MongoDB connection string with credentials', type: 'db_creds' },
    { pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@/g, message: 'PostgreSQL connection string with credentials', type: 'db_creds' },
    { pattern: /mysql:\/\/[^:]+:[^@]+@/g, message: 'MySQL connection string with credentials', type: 'db_creds' },
    
    // Private keys
    { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, message: 'Private key detected', type: 'private_key' },
    { pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g, message: 'PGP private key detected', type: 'pgp_key' },
    
    // JWT secrets
    { pattern: /['"`]eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*['"`]/g, message: 'JWT token detected', type: 'jwt' },
  ];

  // Dangerous patterns
  private dangerousPatterns = [
    { pattern: /rm\s+-rf\s+\//g, message: 'Dangerous rm -rf / command', severity: 'critical' as const },
    { pattern: /sudo\s+/g, message: 'sudo usage detected', severity: 'high' as const },
    { pattern: /chmod\s+777/g, message: 'Overly permissive chmod', severity: 'medium' as const },
    { pattern: /curl\s+.*\|\s*bash/g, message: 'Piping curl to bash', severity: 'critical' as const },
    { pattern: /wget\s+.*\|\s*sh/g, message: 'Piping wget to sh', severity: 'critical' as const },
  ];

  /**
   * Scan template for security issues
   */
  async scan(templatePath: string): Promise<SecurityScanResult> {
    const issues: SecurityIssue[] = [];
    const files = await this.getScannableFiles(templatePath);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(templatePath, file);

      // Scan for malicious patterns
      for (const { pattern, message, severity } of this.maliciousPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const line = this.getLineNumber(content, match.index!);
          issues.push({
            type: 'malicious',
            severity,
            file: relativePath,
            line,
            message,
            pattern: match[0].substring(0, 50),
          });
        }
      }

      // Scan for secrets
      for (const { pattern, message, type } of this.secretPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const line = this.getLineNumber(content, match.index!);
          issues.push({
            type: 'secret',
            severity: 'critical',
            file: relativePath,
            line,
            message,
            pattern: this.maskSecret(match[0]),
          });
        }
      }

      // Scan for dangerous patterns
      for (const { pattern, message, severity } of this.dangerousPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const line = this.getLineNumber(content, match.index!);
          issues.push({
            type: 'dangerous',
            severity,
            file: relativePath,
            line,
            message,
            pattern: match[0],
          });
        }
      }
    }

    // Scan hook files with extra scrutiny
    const hookIssues = await this.scanHooks(templatePath);
    issues.push(...hookIssues);

    return {
      passed: !issues.some(i => i.severity === 'critical' || i.severity === 'high'),
      issues,
      summary: this.generateSummary(issues),
    };
  }

  /**
   * Scan hook files with extra scrutiny
   */
  private async scanHooks(templatePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const hooksDir = path.join(templatePath, 'hooks');

    if (!await this.directoryExists(hooksDir)) {
      return issues;
    }

    const hookFiles = await fs.readdir(hooksDir);
    
    for (const hookFile of hookFiles) {
      const hookPath = path.join(hooksDir, hookFile);
      const content = await fs.readFile(hookPath, 'utf-8');

      // Extra patterns for hooks
      const hookPatterns = [
        { pattern: /curl\s+/g, message: 'Network request in hook', severity: 'medium' as const },
        { pattern: /wget\s+/g, message: 'Network request in hook', severity: 'medium' as const },
        { pattern: /npm\s+install\s+(?!--)/g, message: 'npm install without flags', severity: 'low' as const },
        { pattern: /git\s+clone/g, message: 'Git clone in hook', severity: 'medium' as const },
      ];

      for (const { pattern, message, severity } of hookPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          issues.push({
            type: 'suspicious',
            severity,
            file: `hooks/${hookFile}`,
            line: this.getLineNumber(content, match.index!),
            message,
            pattern: match[0],
          });
        }
      }
    }

    return issues;
  }

  /**
   * Get files to scan
   */
  private async getScannableFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const scannableExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
      '.json', '.yaml', '.yml',
      '.sh', '.bash', '.zsh',
      '.py', '.rb',
      '.env', '.env.example', '.env.local',
    ];

    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...await this.getScannableFiles(fullPath));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (scannableExtensions.includes(ext) || entry.name.startsWith('.')) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Mask secret for display
   */
  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '***';
    }
    return secret.substring(0, 4) + '...' + secret.substring(secret.length - 4);
  }

  /**
   * Generate summary
   */
  private generateSummary(issues: SecurityIssue[]): SecuritySummary {
    return {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      byType: {
        malicious: issues.filter(i => i.type === 'malicious').length,
        secret: issues.filter(i => i.type === 'secret').length,
        dangerous: issues.filter(i => i.type === 'dangerous').length,
        suspicious: issues.filter(i => i.type === 'suspicious').length,
      },
    };
  }

  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

export { SecurityScanner, SecurityIssue, SecurityScanResult };
```

---

## Dependency Auditing

### Dependency Auditor

```typescript
// validation/dependency-auditor.ts

interface VulnerabilityInfo {
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  url: string;
  fixAvailable: boolean;
  fixVersion?: string;
}

interface LicenseInfo {
  package: string;
  version: string;
  license: string;
  allowed: boolean;
  reason?: string;
}

interface DependencyAuditResult {
  vulnerabilities: VulnerabilityInfo[];
  licenses: LicenseInfo[];
  outdated: OutdatedPackage[];
  passed: boolean;
  summary: AuditSummary;
}

class DependencyAuditor {
  // Allowed licenses
  private allowedLicenses = [
    'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause',
    'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0',
    'WTFPL', 'CC-BY-4.0', 'CC-BY-3.0',
  ];

  // Restricted licenses (require review)
  private restrictedLicenses = [
    'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0',
    'AGPL-3.0', 'MPL-2.0',
  ];

  // Banned licenses
  private bannedLicenses = [
    'UNLICENSED', 'PROPRIETARY', 'Commercial',
  ];

  /**
   * Audit dependencies
   */
  async audit(templatePath: string): Promise<DependencyAuditResult> {
    const packageJsonPath = path.join(templatePath, 'template', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    // Run npm audit
    const vulnerabilities = await this.runNpmAudit(templatePath);

    // Check licenses
    const licenses = await this.checkLicenses(templatePath);

    // Check for outdated packages
    const outdated = await this.checkOutdated(templatePath);

    const passed = 
      !vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high') &&
      !licenses.some(l => !l.allowed);

    return {
      vulnerabilities,
      licenses,
      outdated,
      passed,
      summary: this.generateSummary(vulnerabilities, licenses, outdated),
    };
  }

  /**
   * Run npm audit
   */
  private async runNpmAudit(templatePath: string): Promise<VulnerabilityInfo[]> {
    const vulnerabilities: VulnerabilityInfo[] = [];
    
    try {
      const templateDir = path.join(templatePath, 'template');
      const { execSync } = require('child_process');
      
      // Run npm audit in JSON format
      const result = execSync('npm audit --json', {
        cwd: templateDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const auditData = JSON.parse(result);
      
      for (const [, advisory] of Object.entries(auditData.vulnerabilities || {})) {
        const adv = advisory as any;
        vulnerabilities.push({
          package: adv.name,
          version: adv.range,
          severity: adv.severity,
          title: adv.title || 'Unknown vulnerability',
          url: adv.url || '',
          fixAvailable: adv.fixAvailable !== false,
          fixVersion: adv.fixAvailable?.version,
        });
      }
    } catch (error) {
      // npm audit returns non-zero exit code if vulnerabilities found
      try {
        const stderr = (error as any).stdout?.toString() || '';
        const auditData = JSON.parse(stderr);
        
        for (const [, advisory] of Object.entries(auditData.vulnerabilities || {})) {
          const adv = advisory as any;
          vulnerabilities.push({
            package: adv.name,
            version: adv.range,
            severity: adv.severity,
            title: adv.title || 'Unknown vulnerability',
            url: adv.url || '',
            fixAvailable: adv.fixAvailable !== false,
            fixVersion: adv.fixAvailable?.version,
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    return vulnerabilities;
  }

  /**
   * Check package licenses
   */
  private async checkLicenses(templatePath: string): Promise<LicenseInfo[]> {
    const licenses: LicenseInfo[] = [];
    const templateDir = path.join(templatePath, 'template');
    
    try {
      const { execSync } = require('child_process');
      
      // Install dependencies first
      execSync('npm install --package-lock-only', {
        cwd: templateDir,
        stdio: 'pipe',
      });

      // Use license-checker
      const result = execSync('npx license-checker --json', {
        cwd: templateDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const licenseData = JSON.parse(result);
      
      for (const [pkgVersion, info] of Object.entries(licenseData)) {
        const [pkg] = pkgVersion.split('@');
        const licenseInfo = info as any;
        const license = licenseInfo.licenses || 'UNKNOWN';
        
        let allowed = true;
        let reason: string | undefined;
        
        if (this.bannedLicenses.includes(license)) {
          allowed = false;
          reason = 'Banned license';
        } else if (this.restrictedLicenses.includes(license)) {
          allowed = false;
          reason = 'Restricted license (requires review)';
        } else if (!this.allowedLicenses.includes(license) && license !== 'UNKNOWN') {
          allowed = false;
          reason = 'Unknown license';
        }
        
        licenses.push({
          package: pkg,
          version: pkgVersion.split('@')[1] || '',
          license,
          allowed,
          reason,
        });
      }
    } catch (error) {
      // Ignore errors, return empty
    }

    return licenses;
  }

  /**
   * Check for outdated packages
   */
  private async checkOutdated(templatePath: string): Promise<OutdatedPackage[]> {
    const outdated: OutdatedPackage[] = [];
    const templateDir = path.join(templatePath, 'template');
    
    try {
      const { execSync } = require('child_process');
      
      const result = execSync('npm outdated --json', {
        cwd: templateDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const outdatedData = JSON.parse(result || '{}');
      
      for (const [pkg, info] of Object.entries(outdatedData)) {
        const pkgInfo = info as any;
        outdated.push({
          package: pkg,
          current: pkgInfo.current,
          wanted: pkgInfo.wanted,
          latest: pkgInfo.latest,
          type: pkgInfo.type,
        });
      }
    } catch (error) {
      // npm outdated returns non-zero if packages are outdated
      try {
        const stdout = (error as any).stdout?.toString() || '{}';
        const outdatedData = JSON.parse(stdout);
        
        for (const [pkg, info] of Object.entries(outdatedData)) {
          const pkgInfo = info as any;
          outdated.push({
            package: pkg,
            current: pkgInfo.current,
            wanted: pkgInfo.wanted,
            latest: pkgInfo.latest,
            type: pkgInfo.type,
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    return outdated;
  }

  /**
   * Generate audit summary
   */
  private generateSummary(
    vulnerabilities: VulnerabilityInfo[],
    licenses: LicenseInfo[],
    outdated: OutdatedPackage[]
  ): AuditSummary {
    return {
      vulnerabilities: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
      },
      licenses: {
        total: licenses.length,
        allowed: licenses.filter(l => l.allowed).length,
        restricted: licenses.filter(l => !l.allowed).length,
      },
      outdated: {
        total: outdated.length,
        major: outdated.filter(o => this.isMajorUpdate(o)).length,
        minor: outdated.filter(o => this.isMinorUpdate(o)).length,
        patch: outdated.filter(o => this.isPatchUpdate(o)).length,
      },
    };
  }

  private isMajorUpdate(pkg: OutdatedPackage): boolean {
    const current = semver.major(pkg.current || '0.0.0');
    const latest = semver.major(pkg.latest || '0.0.0');
    return latest > current;
  }

  private isMinorUpdate(pkg: OutdatedPackage): boolean {
    const current = semver.minor(pkg.current || '0.0.0');
    const latest = semver.minor(pkg.latest || '0.0.0');
    return latest > current && !this.isMajorUpdate(pkg);
  }

  private isPatchUpdate(pkg: OutdatedPackage): boolean {
    return !this.isMajorUpdate(pkg) && !this.isMinorUpdate(pkg);
  }
}

export { DependencyAuditor, DependencyAuditResult, VulnerabilityInfo, LicenseInfo };
```

---

## Code Quality Checks

### Code Quality Validator

```typescript
// validation/code-quality-validator.ts

interface QualityIssue {
  rule: string;
  severity: 'error' | 'warning';
  file: string;
  line: number;
  column: number;
  message: string;
}

interface QualityResult {
  passed: boolean;
  issues: QualityIssue[];
  metrics: QualityMetrics;
}

interface QualityMetrics {
  totalFiles: number;
  totalLines: number;
  lintErrors: number;
  lintWarnings: number;
  typeErrors: number;
  testCoverage?: number;
}

class CodeQualityValidator {
  /**
   * Run all quality checks
   */
  async validate(templatePath: string): Promise<QualityResult> {
    const issues: QualityIssue[] = [];
    const templateDir = path.join(templatePath, 'template');

    // Run ESLint
    const eslintIssues = await this.runEslint(templateDir);
    issues.push(...eslintIssues);

    // Run TypeScript type checking
    const tsIssues = await this.runTypeCheck(templateDir);
    issues.push(...tsIssues);

    // Check for best practices
    const practiceIssues = await this.checkBestPractices(templateDir);
    issues.push(...practiceIssues);

    // Calculate metrics
    const metrics = await this.calculateMetrics(templateDir, issues);

    return {
      passed: !issues.some(i => i.severity === 'error'),
      issues,
      metrics,
    };
  }

  /**
   * Run ESLint
   */
  private async runEslint(templateDir: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    try {
      const { execSync } = require('child_process');
      
      // Check if ESLint config exists
      const hasEslint = await this.fileExists(path.join(templateDir, '.eslintrc.js')) ||
                        await this.fileExists(path.join(templateDir, '.eslintrc.json')) ||
                        await this.fileExists(path.join(templateDir, 'eslint.config.js'));

      if (!hasEslint) {
        // Use default config
        const result = execSync(
          'npx eslint . --ext .js,.jsx,.ts,.tsx --format json --no-eslintrc --config @eslint/js',
          {
            cwd: templateDir,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        
        const eslintOutput = JSON.parse(result);
        issues.push(...this.parseEslintOutput(eslintOutput, templateDir));
      } else {
        // Use project config
        const result = execSync(
          'npx eslint . --ext .js,.jsx,.ts,.tsx --format json',
          {
            cwd: templateDir,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        
        const eslintOutput = JSON.parse(result);
        issues.push(...this.parseEslintOutput(eslintOutput, templateDir));
      }
    } catch (error) {
      // ESLint returns non-zero on errors
      try {
        const stdout = (error as any).stdout?.toString() || '[]';
        const eslintOutput = JSON.parse(stdout);
        issues.push(...this.parseEslintOutput(eslintOutput, templateDir));
      } catch {
        // Ignore parse errors
      }
    }

    return issues;
  }

  /**
   * Parse ESLint output
   */
  private parseEslintOutput(output: any[], templateDir: string): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    for (const file of output) {
      for (const message of file.messages || []) {
        issues.push({
          rule: message.ruleId || 'unknown',
          severity: message.severity === 2 ? 'error' : 'warning',
          file: path.relative(templateDir, file.filePath),
          line: message.line || 0,
          column: message.column || 0,
          message: message.message,
        });
      }
    }
    
    return issues;
  }

  /**
   * Run TypeScript type checking
   */
  private async runTypeCheck(templateDir: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Check if TypeScript is used
    const hasTsConfig = await this.fileExists(path.join(templateDir, 'tsconfig.json'));
    
    if (!hasTsConfig) {
      return issues;
    }

    try {
      const { execSync } = require('child_process');
      
      execSync('npx tsc --noEmit', {
        cwd: templateDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      const stderr = (error as any).stderr?.toString() || '';
      const stdout = (error as any).stdout?.toString() || '';
      const output = stderr + stdout;
      
      // Parse TypeScript errors
      const errorRegex = /(.+)\((\d+),(\d+)\): error (TS\d+): (.+)/g;
      let match;
      
      while ((match = errorRegex.exec(output)) !== null) {
        issues.push({
          rule: match[4],
          severity: 'error',
          file: path.relative(templateDir, match[1]),
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[5],
        });
      }
    }

    return issues;
  }

  /**
   * Check for best practices
   */
  private async checkBestPractices(templateDir: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Check package.json
    const packageJsonPath = path.join(templateDir, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Check for missing scripts
      const recommendedScripts = ['dev', 'build', 'lint'];
      for (const script of recommendedScripts) {
        if (!packageJson.scripts?.[script]) {
          issues.push({
            rule: 'missing-script',
            severity: 'warning',
            file: 'package.json',
            line: 0,
            column: 0,
            message: `Missing recommended script: ${script}`,
          });
        }
      }

      // Check for engines field
      if (!packageJson.engines?.node) {
        issues.push({
          rule: 'missing-engines',
          severity: 'warning',
          file: 'package.json',
          line: 0,
          column: 0,
          message: 'Missing engines.node field',
        });
      }
    }

    // Check for README
    const readmePath = path.join(templateDir, 'README.md');
    if (await this.fileExists(readmePath)) {
      const readme = await fs.readFile(readmePath, 'utf-8');
      
      if (readme.length < 500) {
        issues.push({
          rule: 'short-readme',
          severity: 'warning',
          file: 'README.md',
          line: 0,
          column: 0,
          message: 'README is too short (< 500 characters)',
        });
      }

      // Check for required sections
      const requiredSections = ['## Installation', '## Usage'];
      for (const section of requiredSections) {
        if (!readme.includes(section)) {
          issues.push({
            rule: 'missing-readme-section',
            severity: 'warning',
            file: 'README.md',
            line: 0,
            column: 0,
            message: `Missing recommended section: ${section}`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Calculate quality metrics
   */
  private async calculateMetrics(
    templateDir: string,
    issues: QualityIssue[]
  ): Promise<QualityMetrics> {
    const files = await this.getAllSourceFiles(templateDir);
    let totalLines = 0;
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      totalLines += content.split('\n').length;
    }

    return {
      totalFiles: files.length,
      totalLines,
      lintErrors: issues.filter(i => i.severity === 'error' && !i.rule.startsWith('TS')).length,
      lintWarnings: issues.filter(i => i.severity === 'warning' && !i.rule.startsWith('TS')).length,
      typeErrors: issues.filter(i => i.rule.startsWith('TS')).length,
    };
  }

  private async getAllSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...await this.getAllSourceFiles(fullPath));
      } else {
        const ext = path.extname(entry.name);
        if (sourceExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export { CodeQualityValidator, QualityResult, QualityIssue, QualityMetrics };
```

---

## Metadata Validation

### Metadata Validator

```typescript
// validation/metadata-validator.ts

interface MetadataValidationResult {
  passed: boolean;
  errors: MetadataError[];
  warnings: MetadataWarning[];
  suggestions: string[];
}

class MetadataValidator {
  /**
   * Validate template metadata
   */
  async validate(templatePath: string): Promise<MetadataValidationResult> {
    const errors: MetadataError[] = [];
    const warnings: MetadataWarning[] = [];
    const suggestions: string[] = [];

    // Validate template.json
    const templateJsonResult = await this.validateTemplateJson(templatePath);
    errors.push(...templateJsonResult.errors);
    warnings.push(...templateJsonResult.warnings);

    // Validate README
    const readmeResult = await this.validateReadme(templatePath);
    errors.push(...readmeResult.errors);
    warnings.push(...readmeResult.warnings);
    suggestions.push(...readmeResult.suggestions);

    // Validate preview image
    const previewResult = await this.validatePreview(templatePath);
    errors.push(...previewResult.errors);
    warnings.push(...previewResult.warnings);

    // Validate CHANGELOG
    const changelogResult = await this.validateChangelog(templatePath);
    warnings.push(...changelogResult.warnings);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate template.json metadata
   */
  private async validateTemplateJson(templatePath: string): Promise<{
    errors: MetadataError[];
    warnings: MetadataWarning[];
  }> {
    const errors: MetadataError[] = [];
    const warnings: MetadataWarning[] = [];
    
    const templateJsonPath = path.join(templatePath, 'template.json');
    
    try {
      const content = await fs.readFile(templateJsonPath, 'utf-8');
      const json = JSON.parse(content);

      // Check name format
      if (!/^[a-z0-9-]+$/.test(json.name)) {
        errors.push({
          field: 'name',
          message: 'Name must be lowercase with hyphens only',
        });
      }

      // Check description length
      if (json.description && json.description.length < 20) {
        warnings.push({
          field: 'description',
          message: 'Description is too short (< 20 characters)',
        });
      }

      // Check for displayName
      if (!json.displayName) {
        warnings.push({
          field: 'displayName',
          message: 'Missing displayName field',
        });
      }

      // Check tags
      if (!json.tags || json.tags.length === 0) {
        warnings.push({
          field: 'tags',
          message: 'No tags specified',
        });
      } else if (json.tags.length > 10) {
        warnings.push({
          field: 'tags',
          message: 'Too many tags (max 10)',
        });
      }

      // Check author
      if (!json.author || !json.author.name) {
        errors.push({
          field: 'author',
          message: 'Author name is required',
        });
      }

      // Check license
      if (!json.license) {
        warnings.push({
          field: 'license',
          message: 'No license specified',
        });
      }

    } catch (e) {
      errors.push({
        field: 'template.json',
        message: `Failed to parse: ${(e as Error).message}`,
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate README
   */
  private async validateReadme(templatePath: string): Promise<{
    errors: MetadataError[];
    warnings: MetadataWarning[];
    suggestions: string[];
  }> {
    const errors: MetadataError[] = [];
    const warnings: MetadataWarning[] = [];
    const suggestions: string[] = [];
    
    const readmePath = path.join(templatePath, 'README.md');
    
    try {
      const content = await fs.readFile(readmePath, 'utf-8');

      // Check minimum length
      if (content.length < 500) {
        warnings.push({
          field: 'README.md',
          message: 'README is too short',
        });
      }

      // Check for required sections
      const requiredSections = [
        { heading: '# ', message: 'Missing main title' },
        { heading: '## Features', message: 'Missing Features section' },
        { heading: '## Getting Started', message: 'Missing Getting Started section' },
      ];

      for (const section of requiredSections) {
        if (!content.includes(section.heading)) {
          warnings.push({
            field: 'README.md',
            message: section.message,
          });
        }
      }

      // Suggestions
      if (!content.includes('## Prerequisites')) {
        suggestions.push('Consider adding a Prerequisites section');
      }
      
      if (!content.includes('## License')) {
        suggestions.push('Consider adding a License section');
      }

      if (!content.includes('```')) {
        suggestions.push('Consider adding code examples');
      }

    } catch {
      errors.push({
        field: 'README.md',
        message: 'README.md not found',
      });
    }

    return { errors, warnings, suggestions };
  }

  /**
   * Validate preview image
   */
  private async validatePreview(templatePath: string): Promise<{
    errors: MetadataError[];
    warnings: MetadataWarning[];
  }> {
    const errors: MetadataError[] = [];
    const warnings: MetadataWarning[] = [];
    
    const previewPath = path.join(templatePath, 'preview.png');
    
    try {
      const stat = await fs.stat(previewPath);
      
      // Check file size (max 2MB)
      if (stat.size > 2 * 1024 * 1024) {
        warnings.push({
          field: 'preview.png',
          message: 'Preview image is too large (> 2MB)',
        });
      }

      // Check dimensions using sharp or similar
      // This is a simplified check
      if (stat.size < 10 * 1024) {
        warnings.push({
          field: 'preview.png',
          message: 'Preview image may be too small',
        });
      }

    } catch {
      warnings.push({
        field: 'preview.png',
        message: 'No preview image provided',
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate CHANGELOG
   */
  private async validateChangelog(templatePath: string): Promise<{
    warnings: MetadataWarning[];
  }> {
    const warnings: MetadataWarning[] = [];
    
    const changelogPath = path.join(templatePath, 'CHANGELOG.md');
    
    try {
      await fs.access(changelogPath);
    } catch {
      warnings.push({
        field: 'CHANGELOG.md',
        message: 'No CHANGELOG.md found',
      });
    }

    return { warnings };
  }
}

export { MetadataValidator, MetadataValidationResult };
```

---

## Build Verification

### Build Verifier

```typescript
// validation/build-verifier.ts

interface BuildVerificationResult {
  passed: boolean;
  installSuccess: boolean;
  buildSuccess: boolean;
  testSuccess: boolean;
  startSuccess: boolean;
  logs: BuildLog[];
  timing: BuildTiming;
}

interface BuildLog {
  stage: 'install' | 'build' | 'test' | 'start';
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
}

interface BuildTiming {
  install: number;
  build: number;
  test: number;
  total: number;
}

class BuildVerifier {
  private logs: BuildLog[] = [];
  private timing: BuildTiming = { install: 0, build: 0, test: 0, total: 0 };

  /**
   * Verify template builds successfully
   */
  async verify(templatePath: string): Promise<BuildVerificationResult> {
    this.logs = [];
    const startTime = Date.now();
    const templateDir = path.join(templatePath, 'template');

    // Create isolated test directory
    const testDir = await this.createTestEnvironment(templateDir);

    try {
      // Test clean install
      const installSuccess = await this.testInstall(testDir);
      
      if (!installSuccess) {
        return this.buildResult(false, false, false, false, startTime);
      }

      // Test build
      const buildSuccess = await this.testBuild(testDir);
      
      if (!buildSuccess) {
        return this.buildResult(true, false, false, false, startTime);
      }

      // Test tests (if available)
      const testSuccess = await this.testTests(testDir);

      // Test start (dev server)
      const startSuccess = await this.testStart(testDir);

      return this.buildResult(true, true, testSuccess, startSuccess, startTime);

    } finally {
      // Cleanup
      await this.cleanup(testDir);
    }
  }

  /**
   * Create isolated test environment
   */
  private async createTestEnvironment(templateDir: string): Promise<string> {
    const testDir = path.join(os.tmpdir(), `template-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Copy template files
    await this.copyDirectory(templateDir, testDir);
    
    this.log('install', 'info', `Created test environment: ${testDir}`);
    
    return testDir;
  }

  /**
   * Test clean install
   */
  private async testInstall(testDir: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      this.log('install', 'info', 'Starting clean install...');
      
      const { execSync } = require('child_process');
      
      // Detect package manager
      const hasPnpmLock = await this.fileExists(path.join(testDir, 'pnpm-lock.yaml'));
      const hasYarnLock = await this.fileExists(path.join(testDir, 'yarn.lock'));
      
      let installCmd = 'npm ci';
      if (hasPnpmLock) installCmd = 'pnpm install --frozen-lockfile';
      if (hasYarnLock) installCmd = 'yarn install --frozen-lockfile';
      
      execSync(installCmd, {
        cwd: testDir,
        stdio: 'pipe',
        timeout: 300000, // 5 minutes
      });
      
      this.timing.install = Date.now() - startTime;
      this.log('install', 'info', `Install completed in ${this.timing.install}ms`);
      
      return true;
    } catch (error) {
      this.timing.install = Date.now() - startTime;
      this.log('install', 'error', `Install failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Test build
   */
  private async testBuild(testDir: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      this.log('build', 'info', 'Starting build...');
      
      const packageJson = JSON.parse(
        await fs.readFile(path.join(testDir, 'package.json'), 'utf-8')
      );
      
      if (!packageJson.scripts?.build) {
        this.log('build', 'warn', 'No build script found');
        return true; // Not an error if no build script
      }
      
      const { execSync } = require('child_process');
      
      execSync('npm run build', {
        cwd: testDir,
        stdio: 'pipe',
        timeout: 600000, // 10 minutes
        env: { ...process.env, NODE_ENV: 'production' },
      });
      
      this.timing.build = Date.now() - startTime;
      this.log('build', 'info', `Build completed in ${this.timing.build}ms`);
      
      return true;
    } catch (error) {
      this.timing.build = Date.now() - startTime;
      this.log('build', 'error', `Build failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Test tests
   */
  private async testTests(testDir: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(testDir, 'package.json'), 'utf-8')
      );
      
      if (!packageJson.scripts?.test) {
        this.log('test', 'info', 'No test script found');
        return true; // Not an error if no test script
      }
      
      this.log('test', 'info', 'Running tests...');
      
      const { execSync } = require('child_process');
      
      execSync('npm test', {
        cwd: testDir,
        stdio: 'pipe',
        timeout: 300000, // 5 minutes
        env: { ...process.env, CI: 'true' },
      });
      
      this.timing.test = Date.now() - startTime;
      this.log('test', 'info', `Tests completed in ${this.timing.test}ms`);
      
      return true;
    } catch (error) {
      this.timing.test = Date.now() - startTime;
      this.log('test', 'error', `Tests failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Test dev server start
   */
  private async testStart(testDir: string): Promise<boolean> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(testDir, 'package.json'), 'utf-8')
      );
      
      if (!packageJson.scripts?.dev && !packageJson.scripts?.start) {
        this.log('start', 'info', 'No dev/start script found');
        return true;
      }
      
      this.log('start', 'info', 'Testing dev server start...');
      
      const { spawn } = require('child_process');
      
      const script = packageJson.scripts?.dev ? 'dev' : 'start';
      const child = spawn('npm', ['run', script], {
        cwd: testDir,
        stdio: 'pipe',
      });

      // Wait for server to start (look for common patterns)
      return new Promise((resolve) => {
        let output = '';
        const timeout = setTimeout(() => {
          child.kill();
          this.log('start', 'warn', 'Server start timed out (30s)');
          resolve(false);
        }, 30000);

        child.stdout.on('data', (data: Buffer) => {
          output += data.toString();
          
          // Check for common "ready" patterns
          if (
            output.includes('ready') ||
            output.includes('listening') ||
            output.includes('started') ||
            output.includes('localhost:')
          ) {
            clearTimeout(timeout);
            child.kill();
            this.log('start', 'info', 'Dev server started successfully');
            resolve(true);
          }
        });

        child.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });

        child.on('error', () => {
          clearTimeout(timeout);
          this.log('start', 'error', 'Failed to start dev server');
          resolve(false);
        });
      });
    } catch (error) {
      this.log('start', 'error', `Start test failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Build result object
   */
  private buildResult(
    installSuccess: boolean,
    buildSuccess: boolean,
    testSuccess: boolean,
    startSuccess: boolean,
    startTime: number
  ): BuildVerificationResult {
    this.timing.total = Date.now() - startTime;
    
    return {
      passed: installSuccess && buildSuccess,
      installSuccess,
      buildSuccess,
      testSuccess,
      startSuccess,
      logs: this.logs,
      timing: this.timing,
    };
  }

  /**
   * Log message
   */
  private log(
    stage: 'install' | 'build' | 'test' | 'start',
    level: 'info' | 'warn' | 'error',
    message: string
  ): void {
    this.logs.push({
      stage,
      level,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Cleanup test environment
   */
  private async cleanup(testDir: string): Promise<void> {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.cp(src, dest, { recursive: true });
  }
}

export { BuildVerifier, BuildVerificationResult, BuildLog, BuildTiming };
```

---

## Approval Workflow

### Approval Process

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE APPROVAL WORKFLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SUBMISSION                                                                             │
│      │                                                                                  │
│      ▼                                                                                  │
│  ┌─────────────────┐                                                                   │
│  │  Auto Validation │ ──── All stages pass? ───► YES ──┐                              │
│  └─────────────────┘                                    │                              │
│      │ NO                                               │                              │
│      ▼                                                  │                              │
│  ┌─────────────────┐                                    │                              │
│  │ Return to Author │                                   │                              │
│  │ with feedback    │                                   │                              │
│  └─────────────────┘                                    │                              │
│                                                         │                              │
│                                                         ▼                              │
│                                                  ┌─────────────────┐                   │
│                                                  │  Queue for      │                   │
│                                                  │  Manual Review  │                   │
│                                                  └─────────────────┘                   │
│                                                         │                              │
│                                                         ▼                              │
│                                                  ┌─────────────────┐                   │
│                                                  │  Human Review   │                   │
│                                                  │  (if required)  │                   │
│                                                  └─────────────────┘                   │
│                                                         │                              │
│                                           ┌─────────────┴─────────────┐                │
│                                           ▼                           ▼                │
│                                    ┌─────────────┐             ┌─────────────┐         │
│                                    │  APPROVED   │             │  REJECTED   │         │
│                                    └─────────────┘             └─────────────┘         │
│                                           │                           │                │
│                                           ▼                           ▼                │
│                                    ┌─────────────┐             ┌─────────────┐         │
│                                    │  Publish to │             │  Notify     │         │
│                                    │  Marketplace│             │  Author     │         │
│                                    └─────────────┘             └─────────────┘         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Approval Criteria

| Criteria | Required | Auto-Check |
|----------|----------|------------|
| Structure validation passes | Yes | Yes |
| No critical security issues | Yes | Yes |
| No high-severity vulnerabilities | Yes | Yes |
| No banned licenses | Yes | Yes |
| Build succeeds | Yes | Yes |
| Tests pass (if present) | No | Yes |
| README complete | No | Yes |
| Preview image provided | No | Yes |
| Code quality acceptable | No | Partial |
| Human review (for new authors) | Conditional | No |

---

## Summary

### Validation Stages

| Stage | Checks | Blocking |
|-------|--------|----------|
| **Structure** | Required files, directory layout | Yes |
| **Security** | Malicious code, secrets, dangerous patterns | Yes (critical/high) |
| **Dependencies** | Vulnerabilities, licenses, outdated | Yes (critical/high) |
| **Code Quality** | Linting, type checking, best practices | No |
| **Metadata** | template.json, README, preview | Partial |
| **Build** | Install, build, test, start | Yes (install/build) |

### Severity Levels

| Level | Action | Examples |
|-------|--------|----------|
| **Critical** | Block, require fix | Malicious code, secrets, critical CVE |
| **High** | Block, require fix | High CVE, dangerous patterns |
| **Medium** | Warn, recommend fix | Outdated deps, code quality |
| **Low** | Info only | Suggestions, best practices |

### Best Practices

1. **Run validation locally** before submission
2. **Fix all critical/high issues** before submitting
3. **Include comprehensive README** with examples
4. **Add preview image** for better discoverability
5. **Keep dependencies updated** and secure
6. **Follow code quality standards** (linting, types)
