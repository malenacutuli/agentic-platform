# Shell Configuration and Customization

This guide provides comprehensive coverage of shell configuration in cloud development environments, including supported shells, custom configurations, environment setup, and shell history management.

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Shells](#supported-shells)
3. [Shell Configuration Files](#shell-configuration-files)
4. [Environment Variables](#environment-variables)
5. [Custom Shell Prompts](#custom-shell-prompts)
6. [Shell Aliases and Functions](#shell-aliases-and-functions)
7. [Shell Plugins and Extensions](#shell-plugins-and-extensions)
8. [Shell History Configuration](#shell-history-configuration)
9. [User Preferences Persistence](#user-preferences-persistence)
10. [Best Practices](#best-practices)

---

## Overview

Shell configuration in cloud development environments must balance user customization with security, performance, and isolation requirements. This guide covers how to provide flexible shell environments while maintaining platform integrity.

### Shell Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SHELL CONFIGURATION ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              USER PREFERENCES                                    │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │    Shell     │  │    Theme     │  │   Aliases    │  │   Plugins    │        │   │
│  │  │   Choice     │  │   & Prompt   │  │  & Functions │  │ & Extensions │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │         │                 │                 │                 │                 │   │
│  │         └─────────────────┴─────────────────┴─────────────────┘                 │   │
│  │                                    │                                            │   │
│  └────────────────────────────────────┼────────────────────────────────────────────┘   │
│                                       │                                                 │
│                          ┌────────────┴────────────┐                                   │
│                          │                         │                                   │
│                          ▼                         ▼                                   │
│                   ┌─────────────┐           ┌─────────────┐                           │
│                   │   Cloud     │           │   Local     │                           │
│                   │   Storage   │           │   Config    │                           │
│                   │  (Persist)  │           │   Files     │                           │
│                   └─────────────┘           └─────────────┘                           │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SHELL INSTANCES                                     │   │
│  │                                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │    Bash      │  │     Zsh      │  │    Fish      │  │     Sh       │        │   │
│  │  │   (Default)  │  │  (Popular)   │  │  (Friendly)  │  │   (POSIX)    │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Shell Selection Criteria

| Shell | Default | Use Case | Pros | Cons |
|-------|---------|----------|------|------|
| **Bash** | Yes | General purpose | Universal, stable | Basic completion |
| **Zsh** | No | Power users | Plugins, themes | Slower startup |
| **Fish** | No | Beginners | Auto-suggestions | Non-POSIX |
| **Sh** | No | Scripts | POSIX compliant | Minimal features |

---

## Supported Shells

### Shell Installation and Management

```typescript
// server/shell/shellManager.ts

import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ShellInfo {
  name: string;
  path: string;
  version: string;
  installed: boolean;
  configFiles: string[];
}

/**
 * Manage available shells in the sandbox
 */
class ShellManager {
  private readonly supportedShells: Record<string, {
    paths: string[];
    configFiles: string[];
    installCmd?: string;
  }> = {
    bash: {
      paths: ['/bin/bash', '/usr/bin/bash'],
      configFiles: ['.bashrc', '.bash_profile', '.bash_aliases'],
    },
    zsh: {
      paths: ['/bin/zsh', '/usr/bin/zsh'],
      configFiles: ['.zshrc', '.zprofile', '.zshenv'],
      installCmd: 'apt-get install -y zsh',
    },
    fish: {
      paths: ['/usr/bin/fish'],
      configFiles: ['.config/fish/config.fish'],
      installCmd: 'apt-get install -y fish',
    },
    sh: {
      paths: ['/bin/sh', '/usr/bin/sh'],
      configFiles: ['.profile'],
    },
  };

  /**
   * Get all available shells
   */
  async getAvailableShells(): Promise<ShellInfo[]> {
    const shells: ShellInfo[] = [];

    for (const [name, config] of Object.entries(this.supportedShells)) {
      const shellInfo = await this.getShellInfo(name, config);
      shells.push(shellInfo);
    }

    return shells;
  }

  /**
   * Get info for specific shell
   */
  private async getShellInfo(
    name: string,
    config: { paths: string[]; configFiles: string[] }
  ): Promise<ShellInfo> {
    let path: string | null = null;
    let version = '';
    let installed = false;

    // Find installed path
    for (const p of config.paths) {
      try {
        await fs.access(p);
        path = p;
        installed = true;
        break;
      } catch {
        continue;
      }
    }

    // Get version
    if (path) {
      try {
        const { stdout } = await execAsync(`${path} --version 2>&1 | head -1`);
        version = stdout.trim();
      } catch {
        version = 'unknown';
      }
    }

    return {
      name,
      path: path || config.paths[0],
      version,
      installed,
      configFiles: config.configFiles,
    };
  }

  /**
   * Install shell if not present
   */
  async installShell(name: string): Promise<boolean> {
    const config = this.supportedShells[name];
    if (!config || !config.installCmd) {
      throw new Error(`Shell ${name} cannot be installed`);
    }

    try {
      await execAsync(`sudo ${config.installCmd}`);
      return true;
    } catch (error) {
      console.error(`Failed to install ${name}:`, error);
      return false;
    }
  }

  /**
   * Set default shell for user
   */
  async setDefaultShell(username: string, shell: string): Promise<void> {
    const shellInfo = await this.getShellInfo(
      shell,
      this.supportedShells[shell]
    );

    if (!shellInfo.installed) {
      throw new Error(`Shell ${shell} is not installed`);
    }

    // Update /etc/passwd
    await execAsync(`sudo chsh -s ${shellInfo.path} ${username}`);
  }

  /**
   * Get current default shell
   */
  async getDefaultShell(username: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `getent passwd ${username} | cut -d: -f7`
      );
      return stdout.trim();
    } catch {
      return '/bin/bash';
    }
  }

  /**
   * Validate shell path
   */
  async isValidShell(path: string): Promise<boolean> {
    try {
      // Check if in /etc/shells
      const { stdout } = await execAsync('cat /etc/shells');
      return stdout.includes(path);
    } catch {
      return false;
    }
  }
}

export { ShellManager, ShellInfo };
```

### Shell-Specific Configurations

```typescript
// server/shell/shellConfigurator.ts

import * as fs from 'fs/promises';
import * as path from 'path';

interface ShellConfig {
  shell: string;
  theme?: string;
  plugins?: string[];
  aliases?: Record<string, string>;
  functions?: Record<string, string>;
  envVars?: Record<string, string>;
  options?: Record<string, boolean>;
}

/**
 * Configure shell environments
 */
class ShellConfigurator {
  private homeDir: string;

  constructor(homeDir = '/home/ubuntu') {
    this.homeDir = homeDir;
  }

  /**
   * Apply shell configuration
   */
  async applyConfig(config: ShellConfig): Promise<void> {
    switch (config.shell) {
      case 'bash':
        await this.configureBash(config);
        break;
      case 'zsh':
        await this.configureZsh(config);
        break;
      case 'fish':
        await this.configureFish(config);
        break;
      default:
        throw new Error(`Unsupported shell: ${config.shell}`);
    }
  }

  /**
   * Configure Bash
   */
  private async configureBash(config: ShellConfig): Promise<void> {
    const bashrcPath = path.join(this.homeDir, '.bashrc');
    let content = await this.readFileOrDefault(bashrcPath, this.getDefaultBashrc());

    // Add custom section marker
    const customStart = '# === PLATFORM CUSTOM CONFIG START ===';
    const customEnd = '# === PLATFORM CUSTOM CONFIG END ===';

    // Remove existing custom config
    const startIdx = content.indexOf(customStart);
    const endIdx = content.indexOf(customEnd);
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + content.slice(endIdx + customEnd.length);
    }

    // Build custom config
    let customConfig = `\n${customStart}\n`;

    // Environment variables
    if (config.envVars) {
      for (const [key, value] of Object.entries(config.envVars)) {
        customConfig += `export ${key}="${value}"\n`;
      }
    }

    // Aliases
    if (config.aliases) {
      for (const [name, command] of Object.entries(config.aliases)) {
        customConfig += `alias ${name}='${command}'\n`;
      }
    }

    // Functions
    if (config.functions) {
      for (const [name, body] of Object.entries(config.functions)) {
        customConfig += `${name}() {\n${body}\n}\n`;
      }
    }

    // Shell options
    if (config.options) {
      for (const [option, enabled] of Object.entries(config.options)) {
        customConfig += `shopt -${enabled ? 's' : 'u'} ${option}\n`;
      }
    }

    // Theme/prompt
    if (config.theme) {
      customConfig += this.getBashPrompt(config.theme);
    }

    customConfig += `${customEnd}\n`;

    content += customConfig;
    await fs.writeFile(bashrcPath, content);
  }

  /**
   * Configure Zsh
   */
  private async configureZsh(config: ShellConfig): Promise<void> {
    const zshrcPath = path.join(this.homeDir, '.zshrc');
    let content = await this.readFileOrDefault(zshrcPath, this.getDefaultZshrc());

    // Add custom section
    const customStart = '# === PLATFORM CUSTOM CONFIG START ===';
    const customEnd = '# === PLATFORM CUSTOM CONFIG END ===';

    // Remove existing custom config
    const startIdx = content.indexOf(customStart);
    const endIdx = content.indexOf(customEnd);
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + content.slice(endIdx + customEnd.length);
    }

    let customConfig = `\n${customStart}\n`;

    // Oh My Zsh plugins
    if (config.plugins && config.plugins.length > 0) {
      customConfig += `plugins=(${config.plugins.join(' ')})\n`;
    }

    // Theme
    if (config.theme) {
      customConfig += `ZSH_THEME="${config.theme}"\n`;
    }

    // Environment variables
    if (config.envVars) {
      for (const [key, value] of Object.entries(config.envVars)) {
        customConfig += `export ${key}="${value}"\n`;
      }
    }

    // Aliases
    if (config.aliases) {
      for (const [name, command] of Object.entries(config.aliases)) {
        customConfig += `alias ${name}='${command}'\n`;
      }
    }

    // Functions
    if (config.functions) {
      for (const [name, body] of Object.entries(config.functions)) {
        customConfig += `${name}() {\n${body}\n}\n`;
      }
    }

    // Zsh options
    if (config.options) {
      for (const [option, enabled] of Object.entries(config.options)) {
        customConfig += `${enabled ? 'setopt' : 'unsetopt'} ${option}\n`;
      }
    }

    customConfig += `${customEnd}\n`;

    content += customConfig;
    await fs.writeFile(zshrcPath, content);
  }

  /**
   * Configure Fish
   */
  private async configureFish(config: ShellConfig): Promise<void> {
    const fishConfigDir = path.join(this.homeDir, '.config/fish');
    const fishConfigPath = path.join(fishConfigDir, 'config.fish');

    // Ensure directory exists
    await fs.mkdir(fishConfigDir, { recursive: true });

    let content = await this.readFileOrDefault(fishConfigPath, this.getDefaultFishConfig());

    // Add custom section
    const customStart = '# === PLATFORM CUSTOM CONFIG START ===';
    const customEnd = '# === PLATFORM CUSTOM CONFIG END ===';

    // Remove existing custom config
    const startIdx = content.indexOf(customStart);
    const endIdx = content.indexOf(customEnd);
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + content.slice(endIdx + customEnd.length);
    }

    let customConfig = `\n${customStart}\n`;

    // Environment variables
    if (config.envVars) {
      for (const [key, value] of Object.entries(config.envVars)) {
        customConfig += `set -gx ${key} "${value}"\n`;
      }
    }

    // Aliases (Fish uses abbreviations or functions)
    if (config.aliases) {
      for (const [name, command] of Object.entries(config.aliases)) {
        customConfig += `abbr -a ${name} '${command}'\n`;
      }
    }

    // Functions
    if (config.functions) {
      for (const [name, body] of Object.entries(config.functions)) {
        customConfig += `function ${name}\n${body}\nend\n`;
      }
    }

    customConfig += `${customEnd}\n`;

    content += customConfig;
    await fs.writeFile(fishConfigPath, content);
  }

  /**
   * Read file or return default content
   */
  private async readFileOrDefault(filePath: string, defaultContent: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return defaultContent;
    }
  }

  /**
   * Get default .bashrc content
   */
  private getDefaultBashrc(): string {
    return `# ~/.bashrc: executed by bash(1) for non-login shells.

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# History settings
HISTCONTROL=ignoreboth
HISTSIZE=10000
HISTFILESIZE=20000
shopt -s histappend

# Check window size after each command
shopt -s checkwinsize

# Enable color support
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
fi

# Default prompt
PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '

# Enable programmable completion
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi
`;
  }

  /**
   * Get default .zshrc content
   */
  private getDefaultZshrc(): string {
    return `# ~/.zshrc

# Path to Oh My Zsh installation
export ZSH="$HOME/.oh-my-zsh"

# Theme
ZSH_THEME="robbyrussell"

# Plugins
plugins=(git node npm docker)

# Load Oh My Zsh if installed
[ -f $ZSH/oh-my-zsh.sh ] && source $ZSH/oh-my-zsh.sh

# History settings
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt SHARE_HISTORY

# Enable completion
autoload -Uz compinit && compinit

# Key bindings
bindkey -e

# Aliases
alias ll='ls -la'
alias la='ls -A'
`;
  }

  /**
   * Get default Fish config
   */
  private getDefaultFishConfig(): string {
    return `# ~/.config/fish/config.fish

# Disable greeting
set -g fish_greeting

# Environment
set -gx EDITOR vim
set -gx VISUAL vim

# Path
fish_add_path ~/.local/bin

# Aliases
abbr -a ll 'ls -la'
abbr -a la 'ls -A'
abbr -a g 'git'
abbr -a gs 'git status'
`;
  }

  /**
   * Get Bash prompt for theme
   */
  private getBashPrompt(theme: string): string {
    const prompts: Record<string, string> = {
      default: `PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '`,
      minimal: `PS1='\\w \\$ '`,
      powerline: `
# Powerline-style prompt
__git_branch() {
  git branch 2>/dev/null | sed -e '/^[^*]/d' -e 's/* \\(.*\\)/ (\\1)/'
}
PS1='\\[\\033[48;5;236m\\]\\[\\033[38;5;250m\\] \\u \\[\\033[48;5;31m\\]\\[\\033[38;5;236m\\]\\[\\033[38;5;231m\\] \\w \\[\\033[48;5;236m\\]\\[\\033[38;5;31m\\]\\[\\033[38;5;148m\\]$(__git_branch) \\[\\033[00m\\]\\[\\033[38;5;236m\\]\\[\\033[00m\\] '
`,
      git: `
# Git-aware prompt
parse_git_branch() {
  git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \\(.*\\)/(\\1)/'
}
PS1='\\[\\033[01;32m\\]\\u\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[33m\\]$(parse_git_branch)\\[\\033[00m\\]\\$ '
`,
    };

    return prompts[theme] || prompts.default;
  }
}

export { ShellConfigurator, ShellConfig };
```

---

## Shell Configuration Files

### Configuration File Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         SHELL CONFIGURATION FILE HIERARCHY                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  BASH                                                                                   │
│  ├── /etc/profile          (system-wide, login shells)                                 │
│  ├── /etc/bash.bashrc      (system-wide, interactive)                                  │
│  ├── ~/.bash_profile       (user, login shells)                                        │
│  ├── ~/.bashrc             (user, interactive)                                         │
│  └── ~/.bash_aliases       (user, aliases)                                             │
│                                                                                         │
│  ZSH                                                                                    │
│  ├── /etc/zsh/zshenv       (system-wide, all shells)                                   │
│  ├── /etc/zsh/zprofile     (system-wide, login shells)                                 │
│  ├── /etc/zsh/zshrc        (system-wide, interactive)                                  │
│  ├── ~/.zshenv             (user, all shells)                                          │
│  ├── ~/.zprofile           (user, login shells)                                        │
│  └── ~/.zshrc              (user, interactive)                                         │
│                                                                                         │
│  FISH                                                                                   │
│  ├── /etc/fish/config.fish           (system-wide)                                     │
│  ├── ~/.config/fish/config.fish      (user)                                            │
│  ├── ~/.config/fish/functions/       (user functions)                                  │
│  └── ~/.config/fish/completions/     (user completions)                                │
│                                                                                         │
│  LOAD ORDER                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Login Shell:    /etc/profile → ~/.bash_profile → ~/.bashrc                     │   │
│  │  Non-Login:      /etc/bash.bashrc → ~/.bashrc                                   │   │
│  │  Script:         (none, unless explicitly sourced)                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Configuration File Manager

```typescript
// server/shell/configFileManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

interface ConfigFile {
  path: string;
  content: string;
  checksum: string;
  lastModified: Date;
}

/**
 * Manage shell configuration files
 */
class ConfigFileManager {
  private homeDir: string;
  private backupDir: string;

  constructor(homeDir = '/home/ubuntu') {
    this.homeDir = homeDir;
    this.backupDir = path.join(homeDir, '.config-backups');
  }

  /**
   * Get all config files for shell
   */
  async getConfigFiles(shell: string): Promise<ConfigFile[]> {
    const files: string[] = this.getConfigFilePaths(shell);
    const configs: ConfigFile[] = [];

    for (const filePath of files) {
      const fullPath = filePath.startsWith('/') 
        ? filePath 
        : path.join(this.homeDir, filePath);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const stats = await fs.stat(fullPath);
        
        configs.push({
          path: fullPath,
          content,
          checksum: this.calculateChecksum(content),
          lastModified: stats.mtime,
        });
      } catch {
        // File doesn't exist
        configs.push({
          path: fullPath,
          content: '',
          checksum: '',
          lastModified: new Date(0),
        });
      }
    }

    return configs;
  }

  /**
   * Get config file paths for shell
   */
  private getConfigFilePaths(shell: string): string[] {
    const paths: Record<string, string[]> = {
      bash: [
        '.bashrc',
        '.bash_profile',
        '.bash_aliases',
        '.profile',
      ],
      zsh: [
        '.zshrc',
        '.zprofile',
        '.zshenv',
        '.zsh_aliases',
      ],
      fish: [
        '.config/fish/config.fish',
      ],
    };

    return paths[shell] || [];
  }

  /**
   * Save config file with backup
   */
  async saveConfigFile(
    filePath: string,
    content: string,
    createBackup = true
  ): Promise<void> {
    const fullPath = filePath.startsWith('/')
      ? filePath
      : path.join(this.homeDir, filePath);

    // Create backup if file exists
    if (createBackup) {
      try {
        const existing = await fs.readFile(fullPath, 'utf-8');
        await this.createBackup(fullPath, existing);
      } catch {
        // File doesn't exist, no backup needed
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write new content
    await fs.writeFile(fullPath, content);
  }

  /**
   * Create backup of config file
   */
  private async createBackup(filePath: string, content: string): Promise<string> {
    await fs.mkdir(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basename = path.basename(filePath);
    const backupPath = path.join(this.backupDir, `${basename}.${timestamp}`);

    await fs.writeFile(backupPath, content);
    return backupPath;
  }

  /**
   * List backups for config file
   */
  async listBackups(filePath: string): Promise<{
    path: string;
    timestamp: Date;
  }[]> {
    const basename = path.basename(filePath);

    try {
      const files = await fs.readdir(this.backupDir);
      const backups = files
        .filter(f => f.startsWith(basename + '.'))
        .map(f => {
          const timestamp = f.slice(basename.length + 1);
          return {
            path: path.join(this.backupDir, f),
            timestamp: new Date(timestamp.replace(/-/g, ':')),
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return backups;
    } catch {
      return [];
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    const content = await fs.readFile(backupPath, 'utf-8');
    await this.saveConfigFile(targetPath, content, true);
  }

  /**
   * Calculate checksum
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Validate config syntax
   */
  async validateConfig(shell: string, content: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Basic syntax checks
    switch (shell) {
      case 'bash':
      case 'zsh':
        // Check for unclosed quotes
        const singleQuotes = (content.match(/'/g) || []).length;
        const doubleQuotes = (content.match(/"/g) || []).length;
        if (singleQuotes % 2 !== 0) {
          errors.push('Unclosed single quote');
        }
        if (doubleQuotes % 2 !== 0) {
          errors.push('Unclosed double quote');
        }

        // Check for unclosed braces
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
          errors.push('Mismatched braces');
        }
        break;

      case 'fish':
        // Check for unclosed blocks
        const begins = (content.match(/\bbegin\b/g) || []).length;
        const ends = (content.match(/\bend\b/g) || []).length;
        if (begins !== ends) {
          errors.push('Mismatched begin/end blocks');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export { ConfigFileManager, ConfigFile };
```

---

## Environment Variables

### Environment Variable Management

```typescript
// server/shell/envManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';

interface EnvVariable {
  name: string;
  value: string;
  scope: 'session' | 'user' | 'system';
  sensitive: boolean;
}

/**
 * Manage environment variables
 */
class EnvironmentManager {
  private homeDir: string;
  private sensitiveVars = new Set([
    'API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'CREDENTIAL',
    'AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'GITHUB_TOKEN',
  ]);

  constructor(homeDir = '/home/ubuntu') {
    this.homeDir = homeDir;
  }

  /**
   * Get all environment variables
   */
  async getEnvironment(): Promise<EnvVariable[]> {
    const env: EnvVariable[] = [];

    // Get current process environment
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env.push({
          name,
          value: this.isSensitive(name) ? '***' : value,
          scope: 'session',
          sensitive: this.isSensitive(name),
        });
      }
    }

    // Get user environment from .profile
    const userEnv = await this.loadUserEnvironment();
    for (const [name, value] of Object.entries(userEnv)) {
      const existing = env.find(e => e.name === name);
      if (existing) {
        existing.scope = 'user';
      } else {
        env.push({
          name,
          value: this.isSensitive(name) ? '***' : value,
          scope: 'user',
          sensitive: this.isSensitive(name),
        });
      }
    }

    return env;
  }

  /**
   * Set environment variable
   */
  async setVariable(
    name: string,
    value: string,
    scope: 'session' | 'user' = 'user'
  ): Promise<void> {
    // Validate name
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error('Invalid environment variable name');
    }

    if (scope === 'session') {
      // Set in current process
      process.env[name] = value;
    } else {
      // Persist to user profile
      await this.saveUserVariable(name, value);
    }
  }

  /**
   * Remove environment variable
   */
  async removeVariable(name: string, scope: 'session' | 'user' = 'user'): Promise<void> {
    if (scope === 'session') {
      delete process.env[name];
    } else {
      await this.removeUserVariable(name);
    }
  }

  /**
   * Load user environment from profile
   */
  private async loadUserEnvironment(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    const profilePath = path.join(this.homeDir, '.profile');

    try {
      const content = await fs.readFile(profilePath, 'utf-8');
      const exportRegex = /^export\s+([A-Za-z_][A-Za-z0-9_]*)=["']?([^"'\n]*)["']?/gm;

      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        env[match[1]] = match[2];
      }
    } catch {
      // File doesn't exist
    }

    return env;
  }

  /**
   * Save variable to user profile
   */
  private async saveUserVariable(name: string, value: string): Promise<void> {
    const profilePath = path.join(this.homeDir, '.profile');
    let content = '';

    try {
      content = await fs.readFile(profilePath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    // Check if variable already exists
    const regex = new RegExp(`^export\\s+${name}=.*$`, 'm');
    const exportLine = `export ${name}="${value}"`;

    if (regex.test(content)) {
      // Update existing
      content = content.replace(regex, exportLine);
    } else {
      // Add new
      content = content.trimEnd() + '\n' + exportLine + '\n';
    }

    await fs.writeFile(profilePath, content);
  }

  /**
   * Remove variable from user profile
   */
  private async removeUserVariable(name: string): Promise<void> {
    const profilePath = path.join(this.homeDir, '.profile');

    try {
      let content = await fs.readFile(profilePath, 'utf-8');
      const regex = new RegExp(`^export\\s+${name}=.*\\n?`, 'gm');
      content = content.replace(regex, '');
      await fs.writeFile(profilePath, content);
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Check if variable is sensitive
   */
  private isSensitive(name: string): boolean {
    const upperName = name.toUpperCase();
    return Array.from(this.sensitiveVars).some(
      pattern => upperName.includes(pattern)
    );
  }

  /**
   * Get default environment for new sessions
   */
  getDefaultEnvironment(): Record<string, string> {
    return {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      EDITOR: 'vim',
      VISUAL: 'vim',
      PAGER: 'less',
      HOME: this.homeDir,
      USER: 'ubuntu',
      SHELL: '/bin/bash',
      PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
    };
  }

  /**
   * Merge environment with defaults
   */
  mergeEnvironment(custom: Record<string, string>): Record<string, string> {
    return {
      ...this.getDefaultEnvironment(),
      ...custom,
    };
  }
}

export { EnvironmentManager, EnvVariable };
```

---

## Custom Shell Prompts

### Prompt Themes

```typescript
// server/shell/promptThemes.ts

interface PromptTheme {
  name: string;
  description: string;
  shell: 'bash' | 'zsh' | 'fish' | 'all';
  preview: string;
  config: string;
}

/**
 * Pre-defined prompt themes
 */
const promptThemes: PromptTheme[] = [
  // Bash themes
  {
    name: 'default',
    description: 'Standard colored prompt',
    shell: 'bash',
    preview: 'user@host:~/path$',
    config: `PS1='\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '`,
  },
  {
    name: 'minimal',
    description: 'Clean, minimal prompt',
    shell: 'bash',
    preview: '~/path $',
    config: `PS1='\\[\\033[01;34m\\]\\w\\[\\033[00m\\] \\$ '`,
  },
  {
    name: 'git-aware',
    description: 'Shows git branch and status',
    shell: 'bash',
    preview: 'user:~/path (main)$',
    config: `
# Git branch in prompt
parse_git_branch() {
  git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \\(.*\\)/ (\\1)/'
}
parse_git_dirty() {
  [[ $(git status --porcelain 2> /dev/null) ]] && echo "*"
}
PS1='\\[\\033[01;32m\\]\\u\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[33m\\]$(parse_git_branch)\\[\\033[31m\\]$(parse_git_dirty)\\[\\033[00m\\]\\$ '
`,
  },
  {
    name: 'powerline',
    description: 'Powerline-style with segments',
    shell: 'bash',
    preview: '▶ user ▶ ~/path ▶ main ▶',
    config: `
# Powerline-style prompt
__powerline_ps1() {
  local EXIT="$?"
  local RESET='\\[\\033[0m\\]'
  local BG_BLUE='\\[\\033[44m\\]'
  local BG_GREEN='\\[\\033[42m\\]'
  local BG_RED='\\[\\033[41m\\]'
  local FG_WHITE='\\[\\033[97m\\]'
  local FG_BLUE='\\[\\033[34m\\]'
  local FG_GREEN='\\[\\033[32m\\]'
  
  local PS=""
  
  # User segment
  PS+="\${BG_GREEN}\${FG_WHITE} \\u \${RESET}\${FG_GREEN}\${BG_BLUE}▶\${RESET}"
  
  # Path segment
  PS+="\${BG_BLUE}\${FG_WHITE} \\w \${RESET}\${FG_BLUE}▶\${RESET}"
  
  # Git segment
  local branch=$(git branch 2>/dev/null | grep '^*' | cut -d' ' -f2)
  if [ -n "$branch" ]; then
    PS+=" \${FG_GREEN}$branch\${RESET} ▶"
  fi
  
  PS+=" "
  echo -e "$PS"
}
PROMPT_COMMAND='PS1=$(__powerline_ps1)'
`,
  },
  {
    name: 'timestamp',
    description: 'Shows current time',
    shell: 'bash',
    preview: '[14:30:45] user@host:~$',
    config: `PS1='\\[\\033[90m\\][\\t]\\[\\033[00m\\] \\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '`,
  },

  // Zsh themes (Oh My Zsh compatible)
  {
    name: 'robbyrussell',
    description: 'Oh My Zsh default theme',
    shell: 'zsh',
    preview: '➜ path git:(main)',
    config: `ZSH_THEME="robbyrussell"`,
  },
  {
    name: 'agnoster',
    description: 'Powerline-inspired theme',
    shell: 'zsh',
    preview: '▶ user ▶ path ▶ main ▶',
    config: `ZSH_THEME="agnoster"`,
  },
  {
    name: 'spaceship',
    description: 'Feature-rich prompt',
    shell: 'zsh',
    preview: '🚀 path on main [node] ❯',
    config: `
# Install spaceship if not present
if [ ! -d "$ZSH_CUSTOM/themes/spaceship-prompt" ]; then
  git clone https://github.com/spaceship-prompt/spaceship-prompt.git "$ZSH_CUSTOM/themes/spaceship-prompt" --depth=1
  ln -s "$ZSH_CUSTOM/themes/spaceship-prompt/spaceship.zsh-theme" "$ZSH_CUSTOM/themes/spaceship.zsh-theme"
fi
ZSH_THEME="spaceship"
`,
  },
  {
    name: 'pure',
    description: 'Pretty, minimal, fast',
    shell: 'zsh',
    preview: '❯ ~/path',
    config: `
# Install pure if not present
if [ ! -d "$HOME/.zsh/pure" ]; then
  mkdir -p "$HOME/.zsh"
  git clone https://github.com/sindresorhus/pure.git "$HOME/.zsh/pure"
fi
fpath+=($HOME/.zsh/pure)
autoload -U promptinit; promptinit
prompt pure
`,
  },

  // Fish themes
  {
    name: 'default',
    description: 'Fish default prompt',
    shell: 'fish',
    preview: 'user@host ~/path>',
    config: `# Use default fish prompt`,
  },
  {
    name: 'informative',
    description: 'Shows git and status info',
    shell: 'fish',
    preview: '~/path (main) ❯',
    config: `
function fish_prompt
  set -l last_status $status
  set -l cwd (prompt_pwd)
  
  # Git info
  set -l git_branch (git branch 2>/dev/null | grep '^*' | cut -d' ' -f2)
  
  # Build prompt
  set_color blue
  echo -n $cwd
  
  if test -n "$git_branch"
    set_color yellow
    echo -n " ($git_branch)"
  end
  
  if test $last_status -ne 0
    set_color red
  else
    set_color green
  end
  
  echo -n ' ❯ '
  set_color normal
end
`,
  },
];

/**
 * Get themes for specific shell
 */
function getThemesForShell(shell: string): PromptTheme[] {
  return promptThemes.filter(t => t.shell === shell || t.shell === 'all');
}

/**
 * Get theme by name
 */
function getTheme(name: string, shell: string): PromptTheme | undefined {
  return promptThemes.find(t => t.name === name && (t.shell === shell || t.shell === 'all'));
}

export { promptThemes, getThemesForShell, getTheme, PromptTheme };
```

---

## Shell Aliases and Functions

### Alias Manager

```typescript
// server/shell/aliasManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';

interface Alias {
  name: string;
  command: string;
  description?: string;
  category?: string;
}

interface ShellFunction {
  name: string;
  body: string;
  description?: string;
  category?: string;
}

/**
 * Manage shell aliases and functions
 */
class AliasManager {
  private homeDir: string;

  // Default aliases
  private defaultAliases: Alias[] = [
    // Navigation
    { name: '..', command: 'cd ..', category: 'navigation', description: 'Go up one directory' },
    { name: '...', command: 'cd ../..', category: 'navigation', description: 'Go up two directories' },
    { name: '~', command: 'cd ~', category: 'navigation', description: 'Go to home directory' },

    // Listing
    { name: 'll', command: 'ls -la', category: 'listing', description: 'Long listing with hidden files' },
    { name: 'la', command: 'ls -A', category: 'listing', description: 'List all except . and ..' },
    { name: 'l', command: 'ls -CF', category: 'listing', description: 'List with indicators' },

    // Git
    { name: 'g', command: 'git', category: 'git', description: 'Git shortcut' },
    { name: 'gs', command: 'git status', category: 'git', description: 'Git status' },
    { name: 'ga', command: 'git add', category: 'git', description: 'Git add' },
    { name: 'gc', command: 'git commit', category: 'git', description: 'Git commit' },
    { name: 'gp', command: 'git push', category: 'git', description: 'Git push' },
    { name: 'gl', command: 'git pull', category: 'git', description: 'Git pull' },
    { name: 'gd', command: 'git diff', category: 'git', description: 'Git diff' },
    { name: 'gco', command: 'git checkout', category: 'git', description: 'Git checkout' },
    { name: 'gb', command: 'git branch', category: 'git', description: 'Git branch' },
    { name: 'glog', command: 'git log --oneline --graph', category: 'git', description: 'Git log graph' },

    // Docker
    { name: 'd', command: 'docker', category: 'docker', description: 'Docker shortcut' },
    { name: 'dc', command: 'docker-compose', category: 'docker', description: 'Docker Compose' },
    { name: 'dps', command: 'docker ps', category: 'docker', description: 'Docker ps' },
    { name: 'dimg', command: 'docker images', category: 'docker', description: 'Docker images' },

    // Node.js
    { name: 'ni', command: 'npm install', category: 'node', description: 'npm install' },
    { name: 'nr', command: 'npm run', category: 'node', description: 'npm run' },
    { name: 'nt', command: 'npm test', category: 'node', description: 'npm test' },
    { name: 'pi', command: 'pnpm install', category: 'node', description: 'pnpm install' },
    { name: 'pr', command: 'pnpm run', category: 'node', description: 'pnpm run' },

    // Safety
    { name: 'rm', command: 'rm -i', category: 'safety', description: 'Interactive rm' },
    { name: 'cp', command: 'cp -i', category: 'safety', description: 'Interactive cp' },
    { name: 'mv', command: 'mv -i', category: 'safety', description: 'Interactive mv' },

    // Misc
    { name: 'c', command: 'clear', category: 'misc', description: 'Clear screen' },
    { name: 'h', command: 'history', category: 'misc', description: 'Show history' },
    { name: 'j', command: 'jobs -l', category: 'misc', description: 'List jobs' },
  ];

  // Default functions
  private defaultFunctions: ShellFunction[] = [
    {
      name: 'mkcd',
      body: 'mkdir -p "$1" && cd "$1"',
      category: 'navigation',
      description: 'Create directory and cd into it',
    },
    {
      name: 'extract',
      body: `
case "$1" in
  *.tar.bz2) tar xjf "$1" ;;
  *.tar.gz)  tar xzf "$1" ;;
  *.tar.xz)  tar xJf "$1" ;;
  *.bz2)     bunzip2 "$1" ;;
  *.gz)      gunzip "$1" ;;
  *.tar)     tar xf "$1" ;;
  *.tbz2)    tar xjf "$1" ;;
  *.tgz)     tar xzf "$1" ;;
  *.zip)     unzip "$1" ;;
  *.Z)       uncompress "$1" ;;
  *.7z)      7z x "$1" ;;
  *)         echo "'$1' cannot be extracted" ;;
esac`,
      category: 'archive',
      description: 'Extract various archive formats',
    },
    {
      name: 'backup',
      body: 'cp "$1" "$1.bak.$(date +%Y%m%d%H%M%S)"',
      category: 'file',
      description: 'Create timestamped backup of file',
    },
    {
      name: 'serve',
      body: 'python3 -m http.server ${1:-8000}',
      category: 'web',
      description: 'Start simple HTTP server',
    },
    {
      name: 'ports',
      body: 'netstat -tulanp 2>/dev/null | grep LISTEN',
      category: 'network',
      description: 'Show listening ports',
    },
    {
      name: 'weather',
      body: 'curl -s "wttr.in/${1:-}"',
      category: 'misc',
      description: 'Show weather for location',
    },
  ];

  constructor(homeDir = '/home/ubuntu') {
    this.homeDir = homeDir;
  }

  /**
   * Get all aliases
   */
  async getAliases(shell: string): Promise<Alias[]> {
    const userAliases = await this.loadUserAliases(shell);
    return [...this.defaultAliases, ...userAliases];
  }

  /**
   * Get all functions
   */
  async getFunctions(shell: string): Promise<ShellFunction[]> {
    const userFunctions = await this.loadUserFunctions(shell);
    return [...this.defaultFunctions, ...userFunctions];
  }

  /**
   * Add custom alias
   */
  async addAlias(shell: string, alias: Alias): Promise<void> {
    const aliasFile = this.getAliasFile(shell);
    let content = '';

    try {
      content = await fs.readFile(aliasFile, 'utf-8');
    } catch {
      // File doesn't exist
    }

    // Add alias
    const aliasLine = shell === 'fish'
      ? `abbr -a ${alias.name} '${alias.command}'`
      : `alias ${alias.name}='${alias.command}'`;

    // Check if alias already exists
    const regex = new RegExp(`^(alias|abbr)\\s+${alias.name}[=\\s]`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, aliasLine);
    } else {
      content = content.trimEnd() + '\n' + aliasLine + '\n';
    }

    await fs.writeFile(aliasFile, content);
  }

  /**
   * Remove alias
   */
  async removeAlias(shell: string, name: string): Promise<void> {
    const aliasFile = this.getAliasFile(shell);

    try {
      let content = await fs.readFile(aliasFile, 'utf-8');
      const regex = new RegExp(`^(alias|abbr)\\s+${name}[=\\s].*\\n?`, 'gm');
      content = content.replace(regex, '');
      await fs.writeFile(aliasFile, content);
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Add custom function
   */
  async addFunction(shell: string, func: ShellFunction): Promise<void> {
    const funcFile = this.getFunctionFile(shell);
    let content = '';

    try {
      content = await fs.readFile(funcFile, 'utf-8');
    } catch {
      // File doesn't exist
    }

    // Format function based on shell
    let funcDef: string;
    if (shell === 'fish') {
      funcDef = `function ${func.name}\n${func.body}\nend`;
    } else {
      funcDef = `${func.name}() {\n${func.body}\n}`;
    }

    // Check if function already exists
    const regex = shell === 'fish'
      ? new RegExp(`function\\s+${func.name}[\\s\\n]`, 'm')
      : new RegExp(`${func.name}\\s*\\(\\)\\s*{`, 'm');

    if (regex.test(content)) {
      // Replace existing - this is simplified, real implementation would be more robust
      console.warn(`Function ${func.name} already exists, skipping`);
    } else {
      content = content.trimEnd() + '\n\n' + funcDef + '\n';
    }

    await fs.writeFile(funcFile, content);
  }

  /**
   * Get alias file path
   */
  private getAliasFile(shell: string): string {
    const files: Record<string, string> = {
      bash: path.join(this.homeDir, '.bash_aliases'),
      zsh: path.join(this.homeDir, '.zsh_aliases'),
      fish: path.join(this.homeDir, '.config/fish/conf.d/aliases.fish'),
    };
    return files[shell] || files.bash;
  }

  /**
   * Get function file path
   */
  private getFunctionFile(shell: string): string {
    const files: Record<string, string> = {
      bash: path.join(this.homeDir, '.bash_functions'),
      zsh: path.join(this.homeDir, '.zsh_functions'),
      fish: path.join(this.homeDir, '.config/fish/conf.d/functions.fish'),
    };
    return files[shell] || files.bash;
  }

  /**
   * Load user aliases from file
   */
  private async loadUserAliases(shell: string): Promise<Alias[]> {
    const aliasFile = this.getAliasFile(shell);
    const aliases: Alias[] = [];

    try {
      const content = await fs.readFile(aliasFile, 'utf-8');
      
      if (shell === 'fish') {
        const regex = /abbr\s+-a\s+(\w+)\s+'([^']+)'/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          aliases.push({ name: match[1], command: match[2] });
        }
      } else {
        const regex = /alias\s+(\w+)='([^']+)'/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          aliases.push({ name: match[1], command: match[2] });
        }
      }
    } catch {
      // File doesn't exist
    }

    return aliases;
  }

  /**
   * Load user functions from file
   */
  private async loadUserFunctions(shell: string): Promise<ShellFunction[]> {
    const funcFile = this.getFunctionFile(shell);
    const functions: ShellFunction[] = [];

    try {
      const content = await fs.readFile(funcFile, 'utf-8');
      
      if (shell === 'fish') {
        const regex = /function\s+(\w+)\n([\s\S]*?)\nend/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          functions.push({ name: match[1], body: match[2].trim() });
        }
      } else {
        const regex = /(\w+)\s*\(\)\s*{\n([\s\S]*?)\n}/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          functions.push({ name: match[1], body: match[2].trim() });
        }
      }
    } catch {
      // File doesn't exist
    }

    return functions;
  }
}

export { AliasManager, Alias, ShellFunction };
```

---

## Shell Plugins and Extensions

### Plugin Manager

```typescript
// server/shell/pluginManager.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface ShellPlugin {
  name: string;
  description: string;
  shell: 'bash' | 'zsh' | 'fish';
  installed: boolean;
  enabled: boolean;
  url?: string;
}

/**
 * Manage shell plugins and extensions
 */
class PluginManager {
  private homeDir: string;

  // Available plugins
  private availablePlugins: Omit<ShellPlugin, 'installed' | 'enabled'>[] = [
    // Zsh plugins (Oh My Zsh)
    { name: 'git', shell: 'zsh', description: 'Git aliases and functions' },
    { name: 'docker', shell: 'zsh', description: 'Docker aliases and completion' },
    { name: 'node', shell: 'zsh', description: 'Node.js aliases' },
    { name: 'npm', shell: 'zsh', description: 'npm aliases and completion' },
    { name: 'yarn', shell: 'zsh', description: 'Yarn aliases and completion' },
    { name: 'python', shell: 'zsh', description: 'Python aliases' },
    { name: 'golang', shell: 'zsh', description: 'Go aliases' },
    { name: 'rust', shell: 'zsh', description: 'Rust/Cargo aliases' },
    { name: 'kubectl', shell: 'zsh', description: 'Kubernetes aliases' },
    { name: 'aws', shell: 'zsh', description: 'AWS CLI completion' },
    { name: 'terraform', shell: 'zsh', description: 'Terraform aliases' },
    { name: 'vscode', shell: 'zsh', description: 'VS Code aliases' },
    { name: 'sudo', shell: 'zsh', description: 'Press ESC twice to add sudo' },
    { name: 'history', shell: 'zsh', description: 'History search aliases' },
    { name: 'colored-man-pages', shell: 'zsh', description: 'Colorize man pages' },
    { name: 'command-not-found', shell: 'zsh', description: 'Suggest packages for unknown commands' },
    
    // Zsh custom plugins
    {
      name: 'zsh-autosuggestions',
      shell: 'zsh',
      description: 'Fish-like autosuggestions',
      url: 'https://github.com/zsh-users/zsh-autosuggestions',
    },
    {
      name: 'zsh-syntax-highlighting',
      shell: 'zsh',
      description: 'Fish-like syntax highlighting',
      url: 'https://github.com/zsh-users/zsh-syntax-highlighting',
    },
    {
      name: 'zsh-completions',
      shell: 'zsh',
      description: 'Additional completions',
      url: 'https://github.com/zsh-users/zsh-completions',
    },

    // Fish plugins
    {
      name: 'fisher',
      shell: 'fish',
      description: 'Fish plugin manager',
      url: 'https://github.com/jorgebucaran/fisher',
    },
    {
      name: 'z',
      shell: 'fish',
      description: 'Directory jumping',
      url: 'https://github.com/jethrokuan/z',
    },
    {
      name: 'fzf',
      shell: 'fish',
      description: 'Fuzzy finder integration',
      url: 'https://github.com/PatrickF1/fzf.fish',
    },
    {
      name: 'done',
      shell: 'fish',
      description: 'Notify when long commands finish',
      url: 'https://github.com/franciscolourenco/done',
    },

    // Bash plugins
    {
      name: 'bash-completion',
      shell: 'bash',
      description: 'Programmable completion',
    },
    {
      name: 'bash-git-prompt',
      shell: 'bash',
      description: 'Informative git prompt',
      url: 'https://github.com/magicmonty/bash-git-prompt',
    },
    {
      name: 'fzf',
      shell: 'bash',
      description: 'Fuzzy finder',
      url: 'https://github.com/junegunn/fzf',
    },
  ];

  constructor(homeDir = '/home/ubuntu') {
    this.homeDir = homeDir;
  }

  /**
   * Get all plugins for shell
   */
  async getPlugins(shell: string): Promise<ShellPlugin[]> {
    const plugins = this.availablePlugins.filter(p => p.shell === shell);
    const result: ShellPlugin[] = [];

    for (const plugin of plugins) {
      const installed = await this.isInstalled(plugin.name, shell);
      const enabled = await this.isEnabled(plugin.name, shell);
      result.push({ ...plugin, installed, enabled });
    }

    return result;
  }

  /**
   * Install plugin
   */
  async installPlugin(name: string, shell: string): Promise<boolean> {
    const plugin = this.availablePlugins.find(
      p => p.name === name && p.shell === shell
    );

    if (!plugin) {
      throw new Error(`Plugin ${name} not found for ${shell}`);
    }

    try {
      switch (shell) {
        case 'zsh':
          await this.installZshPlugin(plugin);
          break;
        case 'fish':
          await this.installFishPlugin(plugin);
          break;
        case 'bash':
          await this.installBashPlugin(plugin);
          break;
      }
      return true;
    } catch (error) {
      console.error(`Failed to install ${name}:`, error);
      return false;
    }
  }

  /**
   * Enable plugin
   */
  async enablePlugin(name: string, shell: string): Promise<void> {
    switch (shell) {
      case 'zsh':
        await this.enableZshPlugin(name);
        break;
      case 'fish':
        await this.enableFishPlugin(name);
        break;
      case 'bash':
        await this.enableBashPlugin(name);
        break;
    }
  }

  /**
   * Disable plugin
   */
  async disablePlugin(name: string, shell: string): Promise<void> {
    switch (shell) {
      case 'zsh':
        await this.disableZshPlugin(name);
        break;
      case 'fish':
        await this.disableFishPlugin(name);
        break;
      case 'bash':
        await this.disableBashPlugin(name);
        break;
    }
  }

  /**
   * Check if plugin is installed
   */
  private async isInstalled(name: string, shell: string): Promise<boolean> {
    switch (shell) {
      case 'zsh':
        // Check Oh My Zsh plugins directory
        const omzPath = path.join(this.homeDir, '.oh-my-zsh/plugins', name);
        const customPath = path.join(this.homeDir, '.oh-my-zsh/custom/plugins', name);
        try {
          await fs.access(omzPath);
          return true;
        } catch {
          try {
            await fs.access(customPath);
            return true;
          } catch {
            return false;
          }
        }

      case 'fish':
        // Check Fisher plugins
        try {
          const { stdout } = await execAsync('fish -c "fisher list"');
          return stdout.includes(name);
        } catch {
          return false;
        }

      case 'bash':
        // Check if sourced in bashrc
        try {
          const bashrc = await fs.readFile(
            path.join(this.homeDir, '.bashrc'),
            'utf-8'
          );
          return bashrc.includes(name);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Check if plugin is enabled
   */
  private async isEnabled(name: string, shell: string): Promise<boolean> {
    switch (shell) {
      case 'zsh':
        try {
          const zshrc = await fs.readFile(
            path.join(this.homeDir, '.zshrc'),
            'utf-8'
          );
          const match = zshrc.match(/plugins=\(([^)]+)\)/);
          return match ? match[1].includes(name) : false;
        } catch {
          return false;
        }

      case 'fish':
        return this.isInstalled(name, shell);

      case 'bash':
        return this.isInstalled(name, shell);

      default:
        return false;
    }
  }

  /**
   * Install Zsh plugin
   */
  private async installZshPlugin(plugin: { name: string; url?: string }): Promise<void> {
    if (plugin.url) {
      // Custom plugin - clone to custom plugins directory
      const customDir = path.join(this.homeDir, '.oh-my-zsh/custom/plugins');
      await fs.mkdir(customDir, { recursive: true });
      await execAsync(`git clone ${plugin.url} ${path.join(customDir, plugin.name)}`);
    }
    // Built-in plugins don't need installation
  }

  /**
   * Install Fish plugin
   */
  private async installFishPlugin(plugin: { name: string; url?: string }): Promise<void> {
    if (plugin.name === 'fisher') {
      // Install Fisher first
      await execAsync(
        'fish -c "curl -sL https://git.io/fisher | source && fisher install jorgebucaran/fisher"'
      );
    } else if (plugin.url) {
      await execAsync(`fish -c "fisher install ${plugin.url}"`);
    }
  }

  /**
   * Install Bash plugin
   */
  private async installBashPlugin(plugin: { name: string; url?: string }): Promise<void> {
    if (plugin.url) {
      const pluginDir = path.join(this.homeDir, '.bash-plugins', plugin.name);
      await fs.mkdir(path.dirname(pluginDir), { recursive: true });
      await execAsync(`git clone ${plugin.url} ${pluginDir}`);
    }
  }

  /**
   * Enable Zsh plugin
   */
  private async enableZshPlugin(name: string): Promise<void> {
    const zshrcPath = path.join(this.homeDir, '.zshrc');
    let content = await fs.readFile(zshrcPath, 'utf-8');

    const match = content.match(/plugins=\(([^)]*)\)/);
    if (match) {
      const plugins = match[1].split(/\s+/).filter(p => p);
      if (!plugins.includes(name)) {
        plugins.push(name);
        content = content.replace(
          /plugins=\([^)]*\)/,
          `plugins=(${plugins.join(' ')})`
        );
        await fs.writeFile(zshrcPath, content);
      }
    }
  }

  /**
   * Disable Zsh plugin
   */
  private async disableZshPlugin(name: string): Promise<void> {
    const zshrcPath = path.join(this.homeDir, '.zshrc');
    let content = await fs.readFile(zshrcPath, 'utf-8');

    const match = content.match(/plugins=\(([^)]*)\)/);
    if (match) {
      const plugins = match[1].split(/\s+/).filter(p => p && p !== name);
      content = content.replace(
        /plugins=\([^)]*\)/,
        `plugins=(${plugins.join(' ')})`
      );
      await fs.writeFile(zshrcPath, content);
    }
  }

  /**
   * Enable Fish plugin
   */
  private async enableFishPlugin(name: string): Promise<void> {
    // Fish plugins are enabled when installed
  }

  /**
   * Disable Fish plugin
   */
  private async disableFishPlugin(name: string): Promise<void> {
    await execAsync(`fish -c "fisher remove ${name}"`);
  }

  /**
   * Enable Bash plugin
   */
  private async enableBashPlugin(name: string): Promise<void> {
    const bashrcPath = path.join(this.homeDir, '.bashrc');
    let content = await fs.readFile(bashrcPath, 'utf-8');

    const pluginPath = path.join(this.homeDir, '.bash-plugins', name);
    const sourceLine = `\n# ${name} plugin\n[ -f "${pluginPath}/*.sh" ] && source "${pluginPath}/*.sh"\n`;

    if (!content.includes(name)) {
      content += sourceLine;
      await fs.writeFile(bashrcPath, content);
    }
  }

  /**
   * Disable Bash plugin
   */
  private async disableBashPlugin(name: string): Promise<void> {
    const bashrcPath = path.join(this.homeDir, '.bashrc');
    let content = await fs.readFile(bashrcPath, 'utf-8');

    const regex = new RegExp(`\\n# ${name} plugin\\n.*\\n`, 'g');
    content = content.replace(regex, '');
    await fs.writeFile(bashrcPath, content);
  }

  /**
   * Install Oh My Zsh
   */
  async installOhMyZsh(): Promise<void> {
    const omzPath = path.join(this.homeDir, '.oh-my-zsh');
    
    try {
      await fs.access(omzPath);
      // Already installed
    } catch {
      await execAsync(
        'sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended'
      );
    }
  }
}

export { PluginManager, ShellPlugin };
```

---

## Shell History Configuration

### History Manager

```typescript
// server/shell/historyConfig.ts

import * as fs from 'fs/promises';
import * as path from 'path';

interface HistoryConfig {
  size: number;
  fileSize: number;
  ignoreDups: boolean;
  ignoreSpace: boolean;
  timestamps: boolean;
  share: boolean;
  append: boolean;
}

const defaultHistoryConfig: HistoryConfig = {
  size: 10000,
  fileSize: 20000,
  ignoreDups: true,
  ignoreSpace: true,
  timestamps: false,
  share: true,
  append: true,
};

/**
 * Configure shell history settings
 */
class HistoryConfigurator {
  private homeDir: string;

  constructor(homeDir = '/home/ubuntu') {
    this.homeDir = homeDir;
  }

  /**
   * Get current history config
   */
  async getConfig(shell: string): Promise<HistoryConfig> {
    switch (shell) {
      case 'bash':
        return this.getBashHistoryConfig();
      case 'zsh':
        return this.getZshHistoryConfig();
      case 'fish':
        return this.getFishHistoryConfig();
      default:
        return defaultHistoryConfig;
    }
  }

  /**
   * Apply history config
   */
  async applyConfig(shell: string, config: Partial<HistoryConfig>): Promise<void> {
    const fullConfig = { ...defaultHistoryConfig, ...config };

    switch (shell) {
      case 'bash':
        await this.applyBashHistoryConfig(fullConfig);
        break;
      case 'zsh':
        await this.applyZshHistoryConfig(fullConfig);
        break;
      case 'fish':
        await this.applyFishHistoryConfig(fullConfig);
        break;
    }
  }

  /**
   * Get Bash history config
   */
  private async getBashHistoryConfig(): Promise<HistoryConfig> {
    const config = { ...defaultHistoryConfig };
    
    try {
      const bashrc = await fs.readFile(
        path.join(this.homeDir, '.bashrc'),
        'utf-8'
      );

      const sizeMatch = bashrc.match(/HISTSIZE=(\d+)/);
      if (sizeMatch) config.size = parseInt(sizeMatch[1]);

      const fileSizeMatch = bashrc.match(/HISTFILESIZE=(\d+)/);
      if (fileSizeMatch) config.fileSize = parseInt(fileSizeMatch[1]);

      const controlMatch = bashrc.match(/HISTCONTROL=(\S+)/);
      if (controlMatch) {
        config.ignoreDups = controlMatch[1].includes('ignoredups');
        config.ignoreSpace = controlMatch[1].includes('ignorespace');
      }

      config.timestamps = bashrc.includes('HISTTIMEFORMAT');
      config.append = bashrc.includes('shopt -s histappend');
    } catch {
      // Use defaults
    }

    return config;
  }

  /**
   * Apply Bash history config
   */
  private async applyBashHistoryConfig(config: HistoryConfig): Promise<void> {
    const bashrcPath = path.join(this.homeDir, '.bashrc');
    let content = '';

    try {
      content = await fs.readFile(bashrcPath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    // Build history configuration
    const historyConfig = `
# History configuration
HISTSIZE=${config.size}
HISTFILESIZE=${config.fileSize}
HISTCONTROL=${[
      config.ignoreDups ? 'ignoredups' : '',
      config.ignoreSpace ? 'ignorespace' : '',
    ].filter(Boolean).join(':') || 'ignoreboth'}
${config.timestamps ? 'HISTTIMEFORMAT="%F %T "' : ''}
${config.append ? 'shopt -s histappend' : ''}
`;

    // Remove existing history config
    content = content.replace(/# History configuration[\s\S]*?(?=\n[^H]|\n$)/g, '');

    // Add new config
    content = historyConfig + '\n' + content;

    await fs.writeFile(bashrcPath, content);
  }

  /**
   * Get Zsh history config
   */
  private async getZshHistoryConfig(): Promise<HistoryConfig> {
    const config = { ...defaultHistoryConfig };

    try {
      const zshrc = await fs.readFile(
        path.join(this.homeDir, '.zshrc'),
        'utf-8'
      );

      const sizeMatch = zshrc.match(/HISTSIZE=(\d+)/);
      if (sizeMatch) config.size = parseInt(sizeMatch[1]);

      const fileSizeMatch = zshrc.match(/SAVEHIST=(\d+)/);
      if (fileSizeMatch) config.fileSize = parseInt(fileSizeMatch[1]);

      config.ignoreDups = zshrc.includes('HIST_IGNORE_DUPS');
      config.ignoreSpace = zshrc.includes('HIST_IGNORE_SPACE');
      config.share = zshrc.includes('SHARE_HISTORY');
      config.append = zshrc.includes('APPEND_HISTORY');
    } catch {
      // Use defaults
    }

    return config;
  }

  /**
   * Apply Zsh history config
   */
  private async applyZshHistoryConfig(config: HistoryConfig): Promise<void> {
    const zshrcPath = path.join(this.homeDir, '.zshrc');
    let content = '';

    try {
      content = await fs.readFile(zshrcPath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    const historyConfig = `
# History configuration
HISTSIZE=${config.size}
SAVEHIST=${config.fileSize}
HISTFILE=~/.zsh_history
${config.ignoreDups ? 'setopt HIST_IGNORE_DUPS' : ''}
${config.ignoreSpace ? 'setopt HIST_IGNORE_SPACE' : ''}
${config.share ? 'setopt SHARE_HISTORY' : ''}
${config.append ? 'setopt APPEND_HISTORY' : ''}
`;

    // Remove existing history config
    content = content.replace(/# History configuration[\s\S]*?(?=\n[^Hs]|\n$)/g, '');

    // Add new config
    content = historyConfig + '\n' + content;

    await fs.writeFile(zshrcPath, content);
  }

  /**
   * Get Fish history config
   */
  private async getFishHistoryConfig(): Promise<HistoryConfig> {
    // Fish uses different history mechanism
    return {
      ...defaultHistoryConfig,
      size: 10000,
      fileSize: 10000,
    };
  }

  /**
   * Apply Fish history config
   */
  private async applyFishHistoryConfig(config: HistoryConfig): Promise<void> {
    const fishConfigPath = path.join(this.homeDir, '.config/fish/config.fish');
    let content = '';

    try {
      content = await fs.readFile(fishConfigPath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    const historyConfig = `
# History configuration
set -g fish_history_max_size ${config.size}
`;

    // Remove existing history config
    content = content.replace(/# History configuration[\s\S]*?(?=\n[^s]|\n$)/g, '');

    // Add new config
    content = historyConfig + '\n' + content;

    await fs.writeFile(fishConfigPath, content);
  }

  /**
   * Clear history
   */
  async clearHistory(shell: string): Promise<void> {
    const historyFiles: Record<string, string> = {
      bash: path.join(this.homeDir, '.bash_history'),
      zsh: path.join(this.homeDir, '.zsh_history'),
      fish: path.join(this.homeDir, '.local/share/fish/fish_history'),
    };

    const historyFile = historyFiles[shell];
    if (historyFile) {
      try {
        await fs.writeFile(historyFile, '');
      } catch {
        // File doesn't exist
      }
    }
  }
}

export { HistoryConfigurator, HistoryConfig };
```

---

## User Preferences Persistence

### Preferences Storage

```typescript
// server/shell/preferencesStorage.ts

import { Pool } from 'pg';
import { Redis } from 'ioredis';

interface ShellPreferences {
  userId: string;
  defaultShell: string;
  theme: string;
  plugins: string[];
  aliases: Record<string, string>;
  functions: Record<string, string>;
  envVars: Record<string, string>;
  historyConfig: {
    size: number;
    ignoreDups: boolean;
    ignoreSpace: boolean;
  };
  editorSettings: {
    tabSize: number;
    insertSpaces: boolean;
  };
}

/**
 * Store and retrieve user shell preferences
 */
class PreferencesStorage {
  private postgres: Pool;
  private redis: Redis;

  constructor(postgres: Pool, redis: Redis) {
    this.postgres = postgres;
    this.redis = redis;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<ShellPreferences | null> {
    // Try cache first
    const cached = await this.redis.get(`shell:prefs:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Load from database
    const result = await this.postgres.query(
      'SELECT preferences FROM user_shell_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const prefs = result.rows[0].preferences;

    // Cache for 1 hour
    await this.redis.setex(
      `shell:prefs:${userId}`,
      3600,
      JSON.stringify(prefs)
    );

    return prefs;
  }

  /**
   * Save user preferences
   */
  async savePreferences(userId: string, prefs: Partial<ShellPreferences>): Promise<void> {
    const existing = await this.getPreferences(userId);
    const merged = { ...existing, ...prefs, userId };

    await this.postgres.query(`
      INSERT INTO user_shell_preferences (user_id, preferences, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        preferences = $2,
        updated_at = NOW()
    `, [userId, JSON.stringify(merged)]);

    // Update cache
    await this.redis.setex(
      `shell:prefs:${userId}`,
      3600,
      JSON.stringify(merged)
    );
  }

  /**
   * Apply preferences to sandbox
   */
  async applyPreferences(userId: string, homeDir: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs) return;

    // Apply shell configuration
    const { ShellConfigurator } = await import('./shellConfigurator');
    const configurator = new ShellConfigurator(homeDir);

    await configurator.applyConfig({
      shell: prefs.defaultShell,
      theme: prefs.theme,
      plugins: prefs.plugins,
      aliases: prefs.aliases,
      functions: prefs.functions,
      envVars: prefs.envVars,
    });

    // Apply history configuration
    const { HistoryConfigurator } = await import('./historyConfig');
    const historyConfig = new HistoryConfigurator(homeDir);

    await historyConfig.applyConfig(prefs.defaultShell, prefs.historyConfig);
  }

  /**
   * Export preferences
   */
  async exportPreferences(userId: string): Promise<string> {
    const prefs = await this.getPreferences(userId);
    return JSON.stringify(prefs, null, 2);
  }

  /**
   * Import preferences
   */
  async importPreferences(userId: string, data: string): Promise<void> {
    const prefs = JSON.parse(data);
    await this.savePreferences(userId, prefs);
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<void> {
    await this.postgres.query(
      'DELETE FROM user_shell_preferences WHERE user_id = $1',
      [userId]
    );

    await this.redis.del(`shell:prefs:${userId}`);
  }
}

export { PreferencesStorage, ShellPreferences };
```

### Database Schema

```sql
-- migrations/002_shell_preferences.sql

CREATE TABLE user_shell_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for JSON queries
CREATE INDEX idx_shell_prefs_default_shell ON user_shell_preferences 
    USING btree ((preferences->>'defaultShell'));

-- Trigger for updated_at
CREATE TRIGGER user_shell_preferences_updated_at
    BEFORE UPDATE ON user_shell_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

---

## Best Practices

### Shell Configuration Checklist

| Feature | Priority | Implementation |
|---------|----------|----------------|
| **Multiple shells** | Required | Bash, Zsh, Fish support |
| **Default configs** | Required | Sensible defaults |
| **User customization** | High | Aliases, functions, themes |
| **Plugin support** | High | Oh My Zsh, Fisher |
| **History persistence** | High | Cross-session history |
| **Environment management** | High | Secure env vars |
| **Preferences sync** | Medium | Cloud storage |
| **Backup/restore** | Medium | Config versioning |

### Security Considerations

| Risk | Mitigation |
|------|------------|
| **Sensitive env vars** | Mask in UI, encrypt at rest |
| **Malicious aliases** | Validate commands |
| **Plugin security** | Whitelist sources |
| **History exposure** | User isolation |

### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| **Shell startup** | <100ms | <500ms |
| **Config apply** | <50ms | <200ms |
| **Plugin load** | <200ms | <1s |
| **History search** | <50ms | <200ms |

---

## Summary

### Quick Reference

```bash
# Change default shell
chsh -s /bin/zsh

# Install Oh My Zsh
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Install Fish
sudo apt install fish

# Install Fisher (Fish plugin manager)
curl -sL https://git.io/fisher | source && fisher install jorgebucaran/fisher

# Common aliases
alias ll='ls -la'
alias g='git'
alias dc='docker-compose'

# History settings (Bash)
HISTSIZE=10000
HISTFILESIZE=20000
HISTCONTROL=ignoreboth
shopt -s histappend
```

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SHELL CONFIGURATION SUMMARY                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SHELLS              CONFIG FILES           PLUGINS              PERSISTENCE            │
│  ├── Bash            ├── .bashrc            ├── Oh My Zsh        ├── PostgreSQL        │
│  ├── Zsh             ├── .zshrc             ├── Fisher           ├── Redis             │
│  ├── Fish            ├── config.fish        ├── bash-completion  ├── Cloud sync        │
│  └── Sh              └── .profile           └── Custom           └── Backups           │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
