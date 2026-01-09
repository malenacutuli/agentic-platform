# Template Hooks

This guide covers the template lifecycle hooks system, including pre-init and post-init hooks, supported languages (Bash, Node.js), hook execution environment, and best practices for template customization.

---

## Table of Contents

1. [Hook System Overview](#hook-system-overview)
2. [Pre-Init Hooks](#pre-init-hooks)
3. [Post-Init Hooks](#post-init-hooks)
4. [Hook Languages](#hook-languages)
5. [Hook Environment](#hook-environment)
6. [Hook Configuration](#hook-configuration)
7. [Advanced Patterns](#advanced-patterns)
8. [Security Considerations](#security-considerations)

---

## Hook System Overview

### Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE INITIALIZATION LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. TEMPLATE SELECTION                                                                  │
│     └── User selects template (e.g., web-react-vite)                                   │
│                                                                                         │
│  2. VERSION RESOLUTION                                                                  │
│     └── Resolve version tag (latest → v2.1.0)                                          │
│                                                                                         │
│  3. TEMPLATE FETCH                                                                      │
│     └── Download and extract template bundle                                           │
│                                                                                         │
│  4. USER PROMPTS                                                                        │
│     └── Collect user input (project name, options)                                     │
│                                                                                         │
│  5. ▶ PRE-INIT HOOK                                                                    │
│     └── Run hooks/pre-init.sh or hooks/pre-init.js                                     │
│     └── Validate environment, check prerequisites                                      │
│     └── Modify template files before copy                                              │
│                                                                                         │
│  6. TEMPLATE COPY                                                                       │
│     └── Copy template/ directory to target                                             │
│     └── Apply variable substitution                                                    │
│                                                                                         │
│  7. ▶ POST-INIT HOOK                                                                   │
│     └── Run hooks/post-init.sh or hooks/post-init.js                                   │
│     └── Install dependencies, run migrations                                           │
│     └── Initialize git, configure services                                             │
│                                                                                         │
│  8. COMPLETION                                                                          │
│     └── Display success message and next steps                                         │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Hook Types

| Hook | Timing | Purpose | Common Uses |
|------|--------|---------|-------------|
| **pre-init** | Before template copy | Preparation and validation | Check Node version, validate inputs |
| **post-init** | After template copy | Setup and configuration | Install deps, init git, run migrations |
| **pre-install** | Before dependency install | Dependency preparation | Configure registries, auth |
| **post-install** | After dependency install | Post-install setup | Build assets, generate types |

---

## Pre-Init Hooks

### Purpose

Pre-init hooks run **before** the template files are copied to the target directory. They are used for environment validation, prerequisite checking, and template file modification.

### Bash Implementation

```bash
#!/bin/bash
# hooks/pre-init.sh
# Pre-initialization hook for template setup

set -e  # Exit on error

# ============================================
# ENVIRONMENT VARIABLES (provided by system)
# ============================================
# TEMPLATE_NAME     - Name of the template
# TEMPLATE_VERSION  - Version being installed
# TARGET_DIR        - Target directory path
# PROJECT_NAME      - User-provided project name
# USER_OPTIONS      - JSON string of user selections
# TEMPLATE_DIR      - Path to extracted template

echo "🔍 Running pre-init hook for ${TEMPLATE_NAME}@${TEMPLATE_VERSION}"

# ============================================
# 1. CHECK NODE.JS VERSION
# ============================================
check_node_version() {
    local required_version="18.0.0"
    local current_version=$(node -v | sed 's/v//')
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed"
        exit 1
    fi
    
    # Compare versions
    if [ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" != "$required_version" ]; then
        echo "❌ Node.js version must be >= ${required_version} (current: ${current_version})"
        exit 1
    fi
    
    echo "✅ Node.js version: ${current_version}"
}

# ============================================
# 2. CHECK PACKAGE MANAGER
# ============================================
check_package_manager() {
    if ! command -v pnpm &> /dev/null; then
        echo "📦 Installing pnpm..."
        npm install -g pnpm
    fi
    
    echo "✅ pnpm version: $(pnpm -v)"
}

# ============================================
# 3. VALIDATE TARGET DIRECTORY
# ============================================
validate_target_dir() {
    if [ -d "$TARGET_DIR" ] && [ "$(ls -A $TARGET_DIR)" ]; then
        echo "⚠️  Target directory is not empty: ${TARGET_DIR}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Aborted by user"
            exit 1
        fi
    fi
    
    # Create target directory if it doesn't exist
    mkdir -p "$TARGET_DIR"
    echo "✅ Target directory ready: ${TARGET_DIR}"
}

# ============================================
# 4. CHECK EXTERNAL DEPENDENCIES
# ============================================
check_dependencies() {
    local deps=("git" "curl")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            echo "❌ Required dependency not found: ${dep}"
            exit 1
        fi
    done
    
    echo "✅ All dependencies available"
}

# ============================================
# 5. PARSE USER OPTIONS
# ============================================
parse_user_options() {
    # Parse JSON options using jq or Node.js
    if command -v jq &> /dev/null; then
        USE_AUTH=$(echo "$USER_OPTIONS" | jq -r '.useAuth // false')
        DATABASE=$(echo "$USER_OPTIONS" | jq -r '.database // "none"')
    else
        # Fallback to Node.js
        USE_AUTH=$(node -e "console.log(JSON.parse(process.env.USER_OPTIONS).useAuth || false)")
        DATABASE=$(node -e "console.log(JSON.parse(process.env.USER_OPTIONS).database || 'none')")
    fi
    
    echo "📋 Options: auth=${USE_AUTH}, database=${DATABASE}"
    
    # Export for use in template processing
    export USE_AUTH
    export DATABASE
}

# ============================================
# 6. MODIFY TEMPLATE FILES (conditional)
# ============================================
modify_template_files() {
    # Remove auth files if not needed
    if [ "$USE_AUTH" = "false" ]; then
        rm -rf "${TEMPLATE_DIR}/template/src/auth"
        rm -f "${TEMPLATE_DIR}/template/src/middleware/auth.ts"
        echo "🗑️  Removed auth files (not selected)"
    fi
    
    # Remove database files if not needed
    if [ "$DATABASE" = "none" ]; then
        rm -rf "${TEMPLATE_DIR}/template/drizzle"
        rm -f "${TEMPLATE_DIR}/template/src/db.ts"
        echo "🗑️  Removed database files (not selected)"
    fi
}

# ============================================
# MAIN EXECUTION
# ============================================
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Pre-Init Hook: ${TEMPLATE_NAME}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_node_version
    check_package_manager
    validate_target_dir
    check_dependencies
    parse_user_options
    modify_template_files
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Pre-init complete"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

main "$@"
```

### Node.js Implementation

```javascript
#!/usr/bin/env node
// hooks/pre-init.js
// Pre-initialization hook for template setup

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Environment variables provided by system
const {
  TEMPLATE_NAME,
  TEMPLATE_VERSION,
  TARGET_DIR,
  PROJECT_NAME,
  USER_OPTIONS,
  TEMPLATE_DIR,
} = process.env;

const userOptions = JSON.parse(USER_OPTIONS || '{}');

console.log(`🔍 Running pre-init hook for ${TEMPLATE_NAME}@${TEMPLATE_VERSION}`);

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const requiredVersion = '18.0.0';
  const currentVersion = process.version.replace('v', '');
  
  const required = requiredVersion.split('.').map(Number);
  const current = currentVersion.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (current[i] > required[i]) break;
    if (current[i] < required[i]) {
      console.error(`❌ Node.js version must be >= ${requiredVersion} (current: ${currentVersion})`);
      process.exit(1);
    }
  }
  
  console.log(`✅ Node.js version: ${currentVersion}`);
}

/**
 * Check package manager
 */
function checkPackageManager() {
  try {
    const version = execSync('pnpm -v', { encoding: 'utf-8' }).trim();
    console.log(`✅ pnpm version: ${version}`);
  } catch {
    console.log('📦 Installing pnpm...');
    execSync('npm install -g pnpm', { stdio: 'inherit' });
  }
}

/**
 * Validate target directory
 */
function validateTargetDir() {
  if (fs.existsSync(TARGET_DIR)) {
    const files = fs.readdirSync(TARGET_DIR);
    if (files.length > 0) {
      console.warn(`⚠️  Target directory is not empty: ${TARGET_DIR}`);
      // In non-interactive mode, continue anyway
    }
  } else {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }
  
  console.log(`✅ Target directory ready: ${TARGET_DIR}`);
}

/**
 * Check external dependencies
 */
function checkDependencies() {
  const deps = ['git', 'curl'];
  
  for (const dep of deps) {
    try {
      execSync(`which ${dep}`, { stdio: 'pipe' });
    } catch {
      console.error(`❌ Required dependency not found: ${dep}`);
      process.exit(1);
    }
  }
  
  console.log('✅ All dependencies available');
}

/**
 * Modify template files based on user options
 */
function modifyTemplateFiles() {
  const templatePath = path.join(TEMPLATE_DIR, 'template');
  
  // Remove auth files if not needed
  if (!userOptions.useAuth) {
    const authPaths = [
      path.join(templatePath, 'src', 'auth'),
      path.join(templatePath, 'src', 'middleware', 'auth.ts'),
    ];
    
    for (const authPath of authPaths) {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('🗑️  Removed auth files (not selected)');
      }
    }
  }
  
  // Remove database files if not needed
  if (userOptions.database === 'none' || !userOptions.database) {
    const dbPaths = [
      path.join(templatePath, 'drizzle'),
      path.join(templatePath, 'src', 'db.ts'),
    ];
    
    for (const dbPath of dbPaths) {
      if (fs.existsSync(dbPath)) {
        fs.rmSync(dbPath, { recursive: true, force: true });
        console.log('🗑️  Removed database files (not selected)');
      }
    }
  }
  
  // Modify package.json based on options
  const packageJsonPath = path.join(templatePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Remove unused dependencies
    if (!userOptions.useAuth) {
      delete packageJson.dependencies?.['next-auth'];
      delete packageJson.dependencies?.['@auth/core'];
    }
    
    if (userOptions.database === 'none') {
      delete packageJson.dependencies?.['drizzle-orm'];
      delete packageJson.dependencies?.['@planetscale/database'];
      delete packageJson.devDependencies?.['drizzle-kit'];
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('📝 Updated package.json');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Pre-Init Hook: ${TEMPLATE_NAME}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    checkNodeVersion();
    checkPackageManager();
    validateTargetDir();
    checkDependencies();
    modifyTemplateFiles();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Pre-init complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Pre-init failed:', error.message);
    process.exit(1);
  }
}

main();
```

---

## Post-Init Hooks

### Purpose

Post-init hooks run **after** the template files are copied to the target directory. They are used for dependency installation, service configuration, and project initialization.

### Bash Implementation

```bash
#!/bin/bash
# hooks/post-init.sh
# Post-initialization hook for project setup

set -e  # Exit on error

# ============================================
# ENVIRONMENT VARIABLES (provided by system)
# ============================================
# TEMPLATE_NAME     - Name of the template
# TEMPLATE_VERSION  - Version installed
# TARGET_DIR        - Target directory path (now contains project)
# PROJECT_NAME      - User-provided project name
# USER_OPTIONS      - JSON string of user selections

echo "🚀 Running post-init hook for ${PROJECT_NAME}"

# Change to project directory
cd "$TARGET_DIR"

# ============================================
# 1. INSTALL DEPENDENCIES
# ============================================
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # Detect package manager from lockfile
    if [ -f "pnpm-lock.yaml" ]; then
        pnpm install --frozen-lockfile
    elif [ -f "yarn.lock" ]; then
        yarn install --frozen-lockfile
    elif [ -f "package-lock.json" ]; then
        npm ci
    else
        pnpm install
    fi
    
    echo "✅ Dependencies installed"
}

# ============================================
# 2. INITIALIZE GIT REPOSITORY
# ============================================
init_git() {
    if [ ! -d ".git" ]; then
        echo "📂 Initializing git repository..."
        git init
        git add .
        git commit -m "Initial commit from ${TEMPLATE_NAME}@${TEMPLATE_VERSION}"
        echo "✅ Git repository initialized"
    else
        echo "ℹ️  Git repository already exists"
    fi
}

# ============================================
# 3. SETUP ENVIRONMENT FILES
# ============================================
setup_env() {
    if [ -f ".env.example" ] && [ ! -f ".env" ]; then
        echo "🔧 Creating .env file..."
        cp .env.example .env
        
        # Replace placeholders
        sed -i "s/PROJECT_NAME=.*/PROJECT_NAME=${PROJECT_NAME}/" .env
        sed -i "s/APP_NAME=.*/APP_NAME=${PROJECT_NAME}/" .env
        
        # Generate random secrets
        if command -v openssl &> /dev/null; then
            JWT_SECRET=$(openssl rand -hex 32)
            sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
        fi
        
        echo "✅ Environment file created"
    fi
}

# ============================================
# 4. DATABASE SETUP (if selected)
# ============================================
setup_database() {
    DATABASE=$(echo "$USER_OPTIONS" | jq -r '.database // "none"')
    
    if [ "$DATABASE" != "none" ]; then
        echo "🗄️  Setting up database..."
        
        case "$DATABASE" in
            postgresql)
                echo "DATABASE_URL=postgresql://localhost:5432/${PROJECT_NAME}" >> .env
                ;;
            mysql)
                echo "DATABASE_URL=mysql://localhost:3306/${PROJECT_NAME}" >> .env
                ;;
            sqlite)
                echo "DATABASE_URL=file:./data/${PROJECT_NAME}.db" >> .env
                mkdir -p data
                ;;
        esac
        
        # Run migrations if available
        if [ -f "drizzle.config.ts" ]; then
            echo "🔄 Running database migrations..."
            pnpm db:push || echo "⚠️  Database migration skipped (configure DATABASE_URL first)"
        fi
        
        echo "✅ Database configured"
    fi
}

# ============================================
# 5. GENERATE TYPES
# ============================================
generate_types() {
    if [ -f "package.json" ]; then
        # Check if type generation script exists
        if grep -q '"generate"' package.json; then
            echo "🔧 Generating types..."
            pnpm generate || true
        fi
        
        # Generate Prisma client if using Prisma
        if [ -f "prisma/schema.prisma" ]; then
            echo "🔧 Generating Prisma client..."
            pnpm prisma generate
        fi
    fi
    
    echo "✅ Types generated"
}

# ============================================
# 6. SETUP HUSKY (git hooks)
# ============================================
setup_husky() {
    if [ -d ".husky" ] || grep -q '"husky"' package.json 2>/dev/null; then
        echo "🐶 Setting up Husky..."
        pnpm husky install || npx husky install
        echo "✅ Husky configured"
    fi
}

# ============================================
# 7. DISPLAY NEXT STEPS
# ============================================
display_next_steps() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Project ${PROJECT_NAME} is ready!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps:"
    echo "  cd ${TARGET_DIR}"
    echo "  pnpm dev"
    echo ""
    echo "Available commands:"
    echo "  pnpm dev      - Start development server"
    echo "  pnpm build    - Build for production"
    echo "  pnpm test     - Run tests"
    echo "  pnpm lint     - Run linter"
    echo ""
}

# ============================================
# MAIN EXECUTION
# ============================================
main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Post-Init Hook: ${PROJECT_NAME}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    install_dependencies
    init_git
    setup_env
    setup_database
    generate_types
    setup_husky
    display_next_steps
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Post-init complete"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

main "$@"
```

### Node.js Implementation

```javascript
#!/usr/bin/env node
// hooks/post-init.js
// Post-initialization hook for project setup

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

const {
  TEMPLATE_NAME,
  TEMPLATE_VERSION,
  TARGET_DIR,
  PROJECT_NAME,
  USER_OPTIONS,
} = process.env;

const userOptions = JSON.parse(USER_OPTIONS || '{}');

console.log(`🚀 Running post-init hook for ${PROJECT_NAME}`);

// Change to project directory
process.chdir(TARGET_DIR);

/**
 * Execute command with output
 */
function exec(command, options = {}) {
  console.log(`  $ ${command}`);
  return execSync(command, {
    stdio: 'inherit',
    ...options,
  });
}

/**
 * Install dependencies
 */
async function installDependencies() {
  console.log('📦 Installing dependencies...');
  
  // Detect package manager
  let pm = 'pnpm';
  if (fs.existsSync('yarn.lock')) pm = 'yarn';
  if (fs.existsSync('package-lock.json')) pm = 'npm';
  
  const installCmd = {
    pnpm: 'pnpm install',
    yarn: 'yarn install --frozen-lockfile',
    npm: 'npm ci',
  };
  
  exec(installCmd[pm] || 'pnpm install');
  console.log('✅ Dependencies installed');
}

/**
 * Initialize git repository
 */
function initGit() {
  if (!fs.existsSync('.git')) {
    console.log('📂 Initializing git repository...');
    exec('git init');
    exec('git add .');
    exec(`git commit -m "Initial commit from ${TEMPLATE_NAME}@${TEMPLATE_VERSION}"`);
    console.log('✅ Git repository initialized');
  } else {
    console.log('ℹ️  Git repository already exists');
  }
}

/**
 * Setup environment files
 */
function setupEnv() {
  if (fs.existsSync('.env.example') && !fs.existsSync('.env')) {
    console.log('🔧 Creating .env file...');
    
    let envContent = fs.readFileSync('.env.example', 'utf-8');
    
    // Replace placeholders
    envContent = envContent.replace(/PROJECT_NAME=.*/g, `PROJECT_NAME=${PROJECT_NAME}`);
    envContent = envContent.replace(/APP_NAME=.*/g, `APP_NAME=${PROJECT_NAME}`);
    
    // Generate random secrets
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`);
    
    fs.writeFileSync('.env', envContent);
    console.log('✅ Environment file created');
  }
}

/**
 * Setup database
 */
async function setupDatabase() {
  const database = userOptions.database || 'none';
  
  if (database !== 'none') {
    console.log('🗄️  Setting up database...');
    
    const dbUrls = {
      postgresql: `postgresql://localhost:5432/${PROJECT_NAME}`,
      mysql: `mysql://localhost:3306/${PROJECT_NAME}`,
      sqlite: `file:./data/${PROJECT_NAME}.db`,
    };
    
    if (dbUrls[database]) {
      fs.appendFileSync('.env', `\nDATABASE_URL=${dbUrls[database]}\n`);
      
      if (database === 'sqlite') {
        fs.mkdirSync('data', { recursive: true });
      }
    }
    
    // Run migrations
    if (fs.existsSync('drizzle.config.ts')) {
      console.log('🔄 Running database migrations...');
      try {
        exec('pnpm db:push');
      } catch {
        console.log('⚠️  Database migration skipped (configure DATABASE_URL first)');
      }
    }
    
    console.log('✅ Database configured');
  }
}

/**
 * Generate types
 */
function generateTypes() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  // Run generate script if exists
  if (packageJson.scripts?.generate) {
    console.log('🔧 Generating types...');
    try {
      exec('pnpm generate');
    } catch {
      // Ignore errors
    }
  }
  
  // Generate Prisma client
  if (fs.existsSync('prisma/schema.prisma')) {
    console.log('🔧 Generating Prisma client...');
    exec('pnpm prisma generate');
  }
  
  console.log('✅ Types generated');
}

/**
 * Setup Husky
 */
function setupHusky() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  if (fs.existsSync('.husky') || packageJson.devDependencies?.husky) {
    console.log('🐶 Setting up Husky...');
    try {
      exec('pnpm husky install');
    } catch {
      try {
        exec('npx husky install');
      } catch {
        // Ignore
      }
    }
    console.log('✅ Husky configured');
  }
}

/**
 * Display next steps
 */
function displayNextSteps() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉 Project ${PROJECT_NAME} is ready!`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Next steps:');
  console.log(`  cd ${TARGET_DIR}`);
  console.log('  pnpm dev');
  console.log('');
  console.log('Available commands:');
  console.log('  pnpm dev      - Start development server');
  console.log('  pnpm build    - Build for production');
  console.log('  pnpm test     - Run tests');
  console.log('  pnpm lint     - Run linter');
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Post-Init Hook: ${PROJECT_NAME}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    await installDependencies();
    initGit();
    setupEnv();
    await setupDatabase();
    generateTypes();
    setupHusky();
    displayNextSteps();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Post-init complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Post-init failed:', error.message);
    process.exit(1);
  }
}

main();
```

---

## Hook Languages

### Supported Languages

| Language | File Extension | Interpreter | Best For |
|----------|---------------|-------------|----------|
| **Bash** | `.sh` | `/bin/bash` | Simple tasks, Unix commands |
| **Node.js** | `.js`, `.mjs` | `node` | Complex logic, JSON handling |
| **TypeScript** | `.ts` | `tsx` | Type-safe hooks |
| **Python** | `.py` | `python3` | Data processing, ML templates |

### Language Selection

```typescript
// templates/hooks/executor.ts

interface HookConfig {
  preInit?: string;
  postInit?: string;
  preInstall?: string;
  postInstall?: string;
}

class HookExecutor {
  private interpreters: Record<string, string> = {
    '.sh': '/bin/bash',
    '.bash': '/bin/bash',
    '.js': 'node',
    '.mjs': 'node',
    '.ts': 'tsx',
    '.py': 'python3',
  };
  
  /**
   * Execute hook file
   */
  async executeHook(
    hookPath: string,
    env: Record<string, string>
  ): Promise<void> {
    const ext = path.extname(hookPath);
    const interpreter = this.interpreters[ext];
    
    if (!interpreter) {
      throw new Error(`Unsupported hook language: ${ext}`);
    }
    
    // Make executable (for shell scripts)
    if (ext === '.sh' || ext === '.bash') {
      await fs.chmod(hookPath, 0o755);
    }
    
    // Execute hook
    const child = spawn(interpreter, [hookPath], {
      env: { ...process.env, ...env },
      stdio: 'inherit',
      cwd: env.TARGET_DIR,
    });
    
    return new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Hook exited with code ${code}`));
        }
      });
      
      child.on('error', reject);
    });
  }
  
  /**
   * Find hook file (supports multiple extensions)
   */
  findHook(hooksDir: string, hookName: string): string | null {
    const extensions = Object.keys(this.interpreters);
    
    for (const ext of extensions) {
      const hookPath = path.join(hooksDir, `${hookName}${ext}`);
      if (fs.existsSync(hookPath)) {
        return hookPath;
      }
    }
    
    return null;
  }
}
```

### TypeScript Hooks

```typescript
// hooks/post-init.ts
// TypeScript post-init hook with type safety

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface UserOptions {
  useAuth: boolean;
  database: 'none' | 'postgresql' | 'mysql' | 'sqlite';
  styling: 'tailwind' | 'css-modules' | 'styled-components';
}

interface HookEnv {
  TEMPLATE_NAME: string;
  TEMPLATE_VERSION: string;
  TARGET_DIR: string;
  PROJECT_NAME: string;
  USER_OPTIONS: string;
}

const env = process.env as unknown as HookEnv;
const userOptions: UserOptions = JSON.parse(env.USER_OPTIONS);

async function main(): Promise<void> {
  console.log(`🚀 Running post-init for ${env.PROJECT_NAME}`);
  
  process.chdir(env.TARGET_DIR);
  
  // Type-safe option handling
  if (userOptions.useAuth) {
    await setupAuth();
  }
  
  if (userOptions.database !== 'none') {
    await setupDatabase(userOptions.database);
  }
  
  await setupStyling(userOptions.styling);
  
  console.log('✅ Post-init complete');
}

async function setupAuth(): Promise<void> {
  console.log('🔐 Setting up authentication...');
  // Auth setup logic
}

async function setupDatabase(
  db: 'postgresql' | 'mysql' | 'sqlite'
): Promise<void> {
  console.log(`🗄️  Setting up ${db} database...`);
  // Database setup logic
}

async function setupStyling(
  style: 'tailwind' | 'css-modules' | 'styled-components'
): Promise<void> {
  console.log(`🎨 Setting up ${style}...`);
  // Styling setup logic
}

main().catch(console.error);
```

---

## Hook Environment

### Environment Variables

```typescript
// templates/hooks/environment.ts

interface HookEnvironment {
  // Template information
  TEMPLATE_NAME: string;        // e.g., "web-react-vite"
  TEMPLATE_VERSION: string;     // e.g., "2.1.0"
  TEMPLATE_DIR: string;         // Path to extracted template
  
  // Project information
  PROJECT_NAME: string;         // User-provided project name
  TARGET_DIR: string;           // Target directory path
  
  // User selections
  USER_OPTIONS: string;         // JSON string of user selections
  
  // System information
  NODE_VERSION: string;         // Node.js version
  NPM_VERSION: string;          // npm version
  PNPM_VERSION: string;         // pnpm version
  
  // Platform information
  PLATFORM: string;             // "linux", "darwin", "win32"
  ARCH: string;                 // "x64", "arm64"
  
  // Manus-specific
  MANUS_SANDBOX_ID: string;     // Sandbox identifier
  MANUS_USER_ID: string;        // User identifier
  MANUS_API_URL: string;        // API endpoint
}

/**
 * Build hook environment
 */
function buildHookEnvironment(context: InitContext): HookEnvironment {
  return {
    // Template info
    TEMPLATE_NAME: context.template.name,
    TEMPLATE_VERSION: context.template.version,
    TEMPLATE_DIR: context.templateDir,
    
    // Project info
    PROJECT_NAME: context.projectName,
    TARGET_DIR: context.targetDir,
    
    // User selections
    USER_OPTIONS: JSON.stringify(context.userOptions),
    
    // System info
    NODE_VERSION: process.version,
    NPM_VERSION: execSync('npm -v', { encoding: 'utf-8' }).trim(),
    PNPM_VERSION: execSync('pnpm -v', { encoding: 'utf-8' }).trim(),
    
    // Platform
    PLATFORM: process.platform,
    ARCH: process.arch,
    
    // Manus
    MANUS_SANDBOX_ID: context.sandboxId,
    MANUS_USER_ID: context.userId,
    MANUS_API_URL: process.env.MANUS_API_URL || '',
  };
}
```

### Sandbox Constraints

```typescript
// templates/hooks/sandbox.ts

interface HookSandboxConfig {
  // Timeout limits
  timeout: {
    preInit: number;   // 60 seconds
    postInit: number;  // 300 seconds (5 minutes)
  };
  
  // Resource limits
  resources: {
    maxMemory: string;     // "512Mi"
    maxCpu: string;        // "1"
    maxDiskWrite: string;  // "1Gi"
  };
  
  // Network restrictions
  network: {
    allowOutbound: boolean;
    allowedHosts: string[];  // npm, github, etc.
  };
  
  // File system restrictions
  filesystem: {
    readOnly: string[];      // Paths that are read-only
    writable: string[];      // Paths that are writable
    forbidden: string[];     // Paths that cannot be accessed
  };
}

const hookSandboxConfig: HookSandboxConfig = {
  timeout: {
    preInit: 60000,      // 60 seconds
    postInit: 300000,    // 5 minutes
  },
  resources: {
    maxMemory: '512Mi',
    maxCpu: '1',
    maxDiskWrite: '1Gi',
  },
  network: {
    allowOutbound: true,
    allowedHosts: [
      'registry.npmjs.org',
      'github.com',
      'raw.githubusercontent.com',
      'api.github.com',
    ],
  },
  filesystem: {
    readOnly: ['/usr', '/bin', '/lib'],
    writable: ['$TARGET_DIR', '/tmp'],
    forbidden: ['/etc/passwd', '/etc/shadow', '~/.ssh'],
  },
};
```

---

## Hook Configuration

### template.json Configuration

```json
{
  "name": "web-react-vite",
  "version": "2.1.0",
  "hooks": {
    "preInit": {
      "file": "hooks/pre-init.sh",
      "timeout": 60000,
      "optional": false,
      "env": {
        "CUSTOM_VAR": "value"
      }
    },
    "postInit": {
      "file": "hooks/post-init.js",
      "timeout": 300000,
      "optional": false,
      "runInBackground": false
    },
    "preInstall": {
      "file": "hooks/pre-install.sh",
      "timeout": 30000,
      "optional": true
    },
    "postInstall": {
      "file": "hooks/post-install.sh",
      "timeout": 120000,
      "optional": true
    }
  },
  "hookOptions": {
    "skipOnError": false,
    "continueOnOptionalFailure": true,
    "logLevel": "info"
  }
}
```

### Hook Execution Order

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           HOOK EXECUTION ORDER                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. pre-init.sh/js      ─────►  Validate environment, modify template                  │
│         │                                                                               │
│         ▼                                                                               │
│  2. [Template Copy]     ─────►  Copy files to target directory                         │
│         │                                                                               │
│         ▼                                                                               │
│  3. post-init.sh/js     ─────►  Initial setup (before deps)                            │
│         │                                                                               │
│         ▼                                                                               │
│  4. pre-install.sh/js   ─────►  Configure package manager                              │
│         │                                                                               │
│         ▼                                                                               │
│  5. [Dependency Install] ────►  pnpm install / npm ci                                  │
│         │                                                                               │
│         ▼                                                                               │
│  6. post-install.sh/js  ─────►  Generate types, run migrations                         │
│         │                                                                               │
│         ▼                                                                               │
│  7. [Git Init]          ─────►  Initialize repository                                  │
│         │                                                                               │
│         ▼                                                                               │
│  8. [Complete]          ─────►  Display success message                                │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Advanced Patterns

### Conditional Hook Execution

```javascript
// hooks/post-init.js
// Conditional execution based on user options

const userOptions = JSON.parse(process.env.USER_OPTIONS);

async function main() {
  // Always run
  await installDependencies();
  await initGit();
  
  // Conditional based on options
  if (userOptions.useAuth) {
    await setupAuth();
  }
  
  if (userOptions.database !== 'none') {
    await setupDatabase(userOptions.database);
  }
  
  if (userOptions.docker) {
    await setupDocker();
  }
  
  if (userOptions.ci) {
    await setupCI(userOptions.ci); // 'github', 'gitlab', 'circleci'
  }
  
  // Platform-specific
  if (process.platform === 'darwin') {
    await setupMacOS();
  }
}
```

### Interactive Hooks

```javascript
// hooks/post-init.js
// Interactive hook with user prompts

const readline = require('readline');

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  // Check if running interactively
  if (process.stdin.isTTY) {
    const setupDb = await prompt('Set up database now? (y/N) ');
    if (setupDb.toLowerCase() === 'y') {
      await setupDatabase();
    }
    
    const runMigrations = await prompt('Run migrations? (y/N) ');
    if (runMigrations.toLowerCase() === 'y') {
      await runMigrations();
    }
  } else {
    // Non-interactive: use defaults
    console.log('Running in non-interactive mode, using defaults');
  }
}
```

### Hook Composition

```javascript
// hooks/lib/common.js
// Shared hook utilities

module.exports = {
  async installDependencies() {
    // Shared implementation
  },
  
  async initGit(message) {
    // Shared implementation
  },
  
  async setupEnv(overrides = {}) {
    // Shared implementation
  },
};

// hooks/post-init.js
const { installDependencies, initGit, setupEnv } = require('./lib/common');

async function main() {
  await installDependencies();
  await initGit(`Initial commit from ${process.env.TEMPLATE_NAME}`);
  await setupEnv({ APP_NAME: process.env.PROJECT_NAME });
}
```

---

## Security Considerations

### Hook Sandboxing

```typescript
// templates/hooks/security.ts

interface HookSecurityConfig {
  // Allowed commands
  allowedCommands: string[];
  
  // Blocked commands
  blockedCommands: string[];
  
  // Environment variable filtering
  envFilter: {
    passthrough: string[];  // Vars to pass through
    block: string[];        // Vars to block
    sanitize: string[];     // Vars to sanitize
  };
  
  // File access control
  fileAccess: {
    allowRead: string[];
    allowWrite: string[];
    deny: string[];
  };
}

const hookSecurityConfig: HookSecurityConfig = {
  allowedCommands: [
    'node', 'npm', 'pnpm', 'yarn',
    'git', 'curl', 'wget',
    'mkdir', 'cp', 'mv', 'rm', 'cat', 'echo',
    'sed', 'awk', 'grep',
  ],
  
  blockedCommands: [
    'sudo', 'su', 'chmod 777',
    'rm -rf /',
    'curl | bash', 'wget | bash',
    'eval', 'exec',
  ],
  
  envFilter: {
    passthrough: [
      'PATH', 'HOME', 'USER',
      'NODE_VERSION', 'NPM_VERSION',
      'TEMPLATE_*', 'PROJECT_*', 'TARGET_*',
    ],
    block: [
      'AWS_*', 'GITHUB_TOKEN', 'NPM_TOKEN',
      'DATABASE_URL', 'API_KEY',
    ],
    sanitize: [
      'USER_OPTIONS', // Remove sensitive data
    ],
  },
  
  fileAccess: {
    allowRead: ['$TEMPLATE_DIR', '$TARGET_DIR', '/tmp'],
    allowWrite: ['$TARGET_DIR', '/tmp'],
    deny: [
      '/etc', '/var', '/root',
      '~/.ssh', '~/.aws', '~/.config',
    ],
  },
};
```

### Hook Validation

```typescript
// templates/hooks/validator.ts

class HookValidator {
  /**
   * Validate hook file before execution
   */
  async validate(hookPath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const content = await fs.readFile(hookPath, 'utf-8');
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /sudo\s/,
      /rm\s+-rf\s+\//,
      /chmod\s+777/,
      /eval\s*\(/,
      /\$\(.*curl.*\|.*bash\)/,
      /process\.env\.(AWS_|GITHUB_TOKEN|NPM_TOKEN)/,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push(`Dangerous pattern detected: ${pattern}`);
      }
    }
    
    // Check for best practices
    if (!content.includes('set -e') && hookPath.endsWith('.sh')) {
      warnings.push('Shell script should include "set -e" for error handling');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

---

## Summary

### Hook Types

| Hook | Timing | Timeout | Use Case |
|------|--------|---------|----------|
| **pre-init** | Before copy | 60s | Validation, template modification |
| **post-init** | After copy | 300s | Setup, configuration |
| **pre-install** | Before deps | 30s | Registry config |
| **post-install** | After deps | 120s | Type generation, migrations |

### Language Support

| Language | Extension | Best For |
|----------|-----------|----------|
| Bash | `.sh` | Simple tasks, Unix commands |
| Node.js | `.js` | Complex logic, JSON |
| TypeScript | `.ts` | Type-safe hooks |
| Python | `.py` | Data processing |

### Security Checklist

- [ ] Use `set -e` in shell scripts
- [ ] Avoid `sudo` and privilege escalation
- [ ] Don't access sensitive environment variables
- [ ] Validate user input before use
- [ ] Use timeouts for all operations
- [ ] Log actions for debugging
