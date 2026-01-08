# GitHub/GitLab Integration

This guide provides comprehensive coverage of integrating sandboxes with GitHub and GitLab, including OAuth connection flows, push/pull operations, webhook triggers, and repository management.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [OAuth Connection Flow](#oauth-connection-flow)
4. [Repository Operations](#repository-operations)
5. [Push/Pull Operations](#pushpull-operations)
6. [Webhook Integration](#webhook-integration)
7. [CI/CD Integration](#cicd-integration)
8. [GitHub Actions Integration](#github-actions-integration)
9. [GitLab CI Integration](#gitlab-ci-integration)
10. [Security Considerations](#security-considerations)
11. [API Reference](#api-reference)
12. [Best Practices](#best-practices)

---

## Overview

The platform integrates with GitHub and GitLab to enable seamless version control workflows, allowing users to connect their sandboxes to remote repositories for collaboration, backup, and CI/CD integration.

### Supported Platforms

| Platform | OAuth | Push/Pull | Webhooks | CI/CD |
|----------|-------|-----------|----------|-------|
| **GitHub** | ✅ | ✅ | ✅ | ✅ |
| **GitLab** | ✅ | ✅ | ✅ | ✅ |
| **Bitbucket** | ✅ | ✅ | ✅ | ✅ |
| **Azure DevOps** | ✅ | ✅ | ✅ | ✅ |

### Integration Features

| Feature | Description |
|---------|-------------|
| **OAuth Connection** | Secure authentication without storing passwords |
| **Repository Sync** | Push/pull changes to/from remote |
| **Webhooks** | Trigger sandbox actions on repository events |
| **CI/CD** | Run tests and deployments on push |
| **Pull Requests** | Create and manage PRs from sandbox |
| **Issues** | Link commits to issues |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        GITHUB/GITLAB INTEGRATION ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SANDBOX ENVIRONMENT                                 │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   Git CLI   │    │  Git        │    │  Remote     │    │  Webhook    │       │   │
│  │  │   Client    │───►│  Service    │───►│  Manager    │◄───│  Handler    │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │                                              │                    ▲              │   │
│  └──────────────────────────────────────────────┼────────────────────┼──────────────┘   │
│                                                 │                    │                  │
│                                                 ▼                    │                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              PLATFORM SERVICES                                   │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   OAuth     │    │   Token     │    │   API       │    │  Webhook    │       │   │
│  │  │   Service   │    │   Store     │    │   Gateway   │    │  Receiver   │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │        │                  │                  │                    │              │   │
│  └────────┼──────────────────┼──────────────────┼────────────────────┼──────────────┘   │
│           │                  │                  │                    │                  │
│           ▼                  ▼                  ▼                    │                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              EXTERNAL SERVICES                                   │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │   │
│  │  │   GitHub    │    │   GitLab    │    │  Bitbucket  │    │    Azure    │       │   │
│  │  │   OAuth     │    │   OAuth     │    │   OAuth     │    │   DevOps    │       │   │
│  │  │   API       │    │   API       │    │   API       │    │   OAuth     │       │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## OAuth Connection Flow

### OAuth 2.0 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              OAUTH 2.0 AUTHORIZATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  USER              PLATFORM              GITHUB/GITLAB              TOKEN STORE         │
│    │                  │                       │                         │               │
│    │  1. Connect      │                       │                         │               │
│    │ ───────────────► │                       │                         │               │
│    │                  │                       │                         │               │
│    │  2. Redirect     │                       │                         │               │
│    │ ◄─────────────── │                       │                         │               │
│    │                  │                       │                         │               │
│    │  3. Authorize    │                       │                         │               │
│    │ ─────────────────────────────────────────►                         │               │
│    │                  │                       │                         │               │
│    │  4. Auth Code    │                       │                         │               │
│    │ ◄─────────────────────────────────────── │                         │               │
│    │                  │                       │                         │               │
│    │  5. Callback     │                       │                         │               │
│    │ ───────────────► │                       │                         │               │
│    │                  │                       │                         │               │
│    │                  │  6. Exchange Code     │                         │               │
│    │                  │ ─────────────────────►│                         │               │
│    │                  │                       │                         │               │
│    │                  │  7. Access Token      │                         │               │
│    │                  │ ◄─────────────────────│                         │               │
│    │                  │                       │                         │               │
│    │                  │  8. Store Token       │                         │               │
│    │                  │ ─────────────────────────────────────────────────►              │
│    │                  │                       │                         │               │
│    │  9. Connected    │                       │                         │               │
│    │ ◄─────────────── │                       │                         │               │
│    │                  │                       │                         │               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### OAuth Service Implementation

```typescript
// src/services/oauthService.ts

import crypto from 'crypto';

interface OAuthConfig {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope: string;
}

interface OAuthState {
  state: string;
  userId: string;
  sandboxId: string;
  provider: string;
  createdAt: Date;
}

const oauthConfigs: Record<string, Partial<OAuthConfig>> = {
  github: {
    provider: 'github',
    scopes: ['repo', 'read:user', 'user:email', 'workflow'],
  },
  gitlab: {
    provider: 'gitlab',
    scopes: ['api', 'read_user', 'read_repository', 'write_repository'],
  },
  bitbucket: {
    provider: 'bitbucket',
    scopes: ['repository', 'repository:write', 'pullrequest', 'webhook'],
  },
  azure: {
    provider: 'azure',
    scopes: ['vso.code_write', 'vso.build_execute', 'vso.work_write'],
  },
};

class OAuthService {
  private states: Map<string, OAuthState> = new Map();
  private tokens: Map<string, OAuthToken> = new Map();
  
  getAuthorizationUrl(
    provider: string,
    userId: string,
    sandboxId: string
  ): { url: string; state: string } {
    const config = this.getConfig(provider);
    const state = this.generateState();
    
    // Store state for verification
    this.states.set(state, {
      state,
      userId,
      sandboxId,
      provider,
      createdAt: new Date(),
    });
    
    // Build authorization URL
    let authUrl: string;
    
    switch (provider) {
      case 'github':
        authUrl = 'https://github.com/login/oauth/authorize';
        break;
      case 'gitlab':
        authUrl = 'https://gitlab.com/oauth/authorize';
        break;
      case 'bitbucket':
        authUrl = 'https://bitbucket.org/site/oauth2/authorize';
        break;
      case 'azure':
        authUrl = 'https://app.vssps.visualstudio.com/oauth2/authorize';
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state,
      response_type: 'code',
    });
    
    return {
      url: `${authUrl}?${params.toString()}`,
      state,
    };
  }
  
  async handleCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<{ userId: string; sandboxId: string; token: OAuthToken }> {
    // Verify state
    const storedState = this.states.get(state);
    if (!storedState || storedState.provider !== provider) {
      throw new Error('Invalid state parameter');
    }
    
    // Check state expiration (10 minutes)
    const stateAge = Date.now() - storedState.createdAt.getTime();
    if (stateAge > 10 * 60 * 1000) {
      this.states.delete(state);
      throw new Error('State expired');
    }
    
    // Exchange code for token
    const token = await this.exchangeCodeForToken(provider, code);
    
    // Store token
    const tokenKey = `${storedState.userId}:${provider}`;
    this.tokens.set(tokenKey, token);
    
    // Clean up state
    this.states.delete(state);
    
    return {
      userId: storedState.userId,
      sandboxId: storedState.sandboxId,
      token,
    };
  }
  
  private async exchangeCodeForToken(provider: string, code: string): Promise<OAuthToken> {
    const config = this.getConfig(provider);
    
    let tokenUrl: string;
    let body: Record<string, string>;
    
    switch (provider) {
      case 'github':
        tokenUrl = 'https://github.com/login/oauth/access_token';
        body = {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        };
        break;
      case 'gitlab':
        tokenUrl = 'https://gitlab.com/oauth/token';
        body = {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
        };
        break;
      case 'bitbucket':
        tokenUrl = 'https://bitbucket.org/site/oauth2/access_token';
        body = {
          grant_type: 'authorization_code',
          code,
        };
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...(provider === 'bitbucket' && {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        }),
      },
      body: new URLSearchParams(body).toString(),
    });
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      tokenType: data.token_type || 'bearer',
      scope: data.scope || config.scopes.join(' '),
    };
  }
  
  async refreshToken(userId: string, provider: string): Promise<OAuthToken> {
    const tokenKey = `${userId}:${provider}`;
    const existingToken = this.tokens.get(tokenKey);
    
    if (!existingToken?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const config = this.getConfig(provider);
    
    let tokenUrl: string;
    let body: Record<string, string>;
    
    switch (provider) {
      case 'github':
        // GitHub tokens don't expire by default
        return existingToken;
      case 'gitlab':
        tokenUrl = 'https://gitlab.com/oauth/token';
        body = {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: existingToken.refreshToken,
          grant_type: 'refresh_token',
        };
        break;
      case 'bitbucket':
        tokenUrl = 'https://bitbucket.org/site/oauth2/access_token';
        body = {
          grant_type: 'refresh_token',
          refresh_token: existingToken.refreshToken,
        };
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(body).toString(),
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const newToken: OAuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || existingToken.refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      tokenType: data.token_type || 'bearer',
      scope: data.scope || existingToken.scope,
    };
    
    this.tokens.set(tokenKey, newToken);
    
    return newToken;
  }
  
  async getToken(userId: string, provider: string): Promise<OAuthToken | null> {
    const tokenKey = `${userId}:${provider}`;
    const token = this.tokens.get(tokenKey);
    
    if (!token) {
      return null;
    }
    
    // Check if token needs refresh
    if (token.expiresAt && token.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      return await this.refreshToken(userId, provider);
    }
    
    return token;
  }
  
  async revokeToken(userId: string, provider: string): Promise<void> {
    const tokenKey = `${userId}:${provider}`;
    const token = this.tokens.get(tokenKey);
    
    if (!token) return;
    
    // Revoke token on provider
    try {
      switch (provider) {
        case 'github':
          await fetch(`https://api.github.com/applications/${this.getConfig(provider).clientId}/token`, {
            method: 'DELETE',
            headers: {
              Authorization: `Basic ${Buffer.from(`${this.getConfig(provider).clientId}:${this.getConfig(provider).clientSecret}`).toString('base64')}`,
              Accept: 'application/vnd.github+json',
            },
            body: JSON.stringify({ access_token: token.accessToken }),
          });
          break;
        // Other providers...
      }
    } catch (error) {
      console.error('Failed to revoke token on provider:', error);
    }
    
    // Remove from local store
    this.tokens.delete(tokenKey);
  }
  
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  private getConfig(provider: string): OAuthConfig {
    const baseConfig = oauthConfigs[provider];
    if (!baseConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    return {
      ...baseConfig,
      clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`] || '',
      clientSecret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || '',
      redirectUri: process.env[`${provider.toUpperCase()}_REDIRECT_URI`] || '',
    } as OAuthConfig;
  }
  
  // Clean up expired states periodically
  cleanupExpiredStates(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [state, data] of this.states.entries()) {
      if (now - data.createdAt.getTime() > maxAge) {
        this.states.delete(state);
      }
    }
  }
}

export { OAuthService, OAuthConfig, OAuthToken };
```

### OAuth Scopes by Provider

| Provider | Scope | Description |
|----------|-------|-------------|
| **GitHub** | `repo` | Full repository access |
| | `read:user` | Read user profile |
| | `user:email` | Read user email |
| | `workflow` | Update GitHub Actions workflows |
| **GitLab** | `api` | Full API access |
| | `read_user` | Read user profile |
| | `read_repository` | Read repository |
| | `write_repository` | Write to repository |
| **Bitbucket** | `repository` | Read repositories |
| | `repository:write` | Write to repositories |
| | `pullrequest` | Manage pull requests |
| | `webhook` | Manage webhooks |

---

## Repository Operations

### Remote Manager Implementation

```typescript
// src/services/remoteManager.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RemoteConfig {
  name: string;
  url: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
  owner: string;
  repo: string;
}

interface Repository {
  id: number | string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  sshUrl: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date;
}

class RemoteManager {
  private projectPath: string;
  private oauthService: OAuthService;
  
  constructor(projectPath: string, oauthService: OAuthService) {
    this.projectPath = projectPath;
    this.oauthService = oauthService;
  }
  
  async listRemotes(): Promise<RemoteConfig[]> {
    const { stdout } = await execAsync('git remote -v', { cwd: this.projectPath });
    
    const remotes: Map<string, RemoteConfig> = new Map();
    
    for (const line of stdout.split('\n').filter(l => l.trim())) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (match && !remotes.has(match[1])) {
        const [, name, url] = match;
        remotes.set(name, {
          name,
          url,
          ...this.parseRemoteUrl(url),
        });
      }
    }
    
    return Array.from(remotes.values());
  }
  
  async addRemote(name: string, url: string): Promise<void> {
    await execAsync(`git remote add "${name}" "${url}"`, { cwd: this.projectPath });
  }
  
  async removeRemote(name: string): Promise<void> {
    await execAsync(`git remote remove "${name}"`, { cwd: this.projectPath });
  }
  
  async setRemoteUrl(name: string, url: string): Promise<void> {
    await execAsync(`git remote set-url "${name}" "${url}"`, { cwd: this.projectPath });
  }
  
  async listUserRepositories(userId: string, provider: string): Promise<Repository[]> {
    const token = await this.oauthService.getToken(userId, provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    switch (provider) {
      case 'github':
        return await this.listGitHubRepos(token.accessToken);
      case 'gitlab':
        return await this.listGitLabRepos(token.accessToken);
      case 'bitbucket':
        return await this.listBitbucketRepos(token.accessToken);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  private async listGitHubRepos(accessToken: string): Promise<Repository[]> {
    const repos: Repository[] = [];
    let page = 1;
    
    while (true) {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.length === 0) break;
      
      repos.push(...data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.default_branch,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        htmlUrl: repo.html_url,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
        pushedAt: new Date(repo.pushed_at),
      })));
      
      page++;
    }
    
    return repos;
  }
  
  private async listGitLabRepos(accessToken: string): Promise<Repository[]> {
    const response = await fetch(
      'https://gitlab.com/api/v4/projects?membership=true&per_page=100',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.path_with_namespace,
      description: repo.description,
      private: repo.visibility === 'private',
      defaultBranch: repo.default_branch,
      cloneUrl: repo.http_url_to_repo,
      sshUrl: repo.ssh_url_to_repo,
      htmlUrl: repo.web_url,
      createdAt: new Date(repo.created_at),
      updatedAt: new Date(repo.last_activity_at),
      pushedAt: new Date(repo.last_activity_at),
    }));
  }
  
  private async listBitbucketRepos(accessToken: string): Promise<Repository[]> {
    const response = await fetch(
      'https://api.bitbucket.org/2.0/repositories?role=member',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Bitbucket API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return data.values.map((repo: any) => ({
      id: repo.uuid,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.is_private,
      defaultBranch: repo.mainbranch?.name || 'main',
      cloneUrl: repo.links.clone.find((l: any) => l.name === 'https')?.href,
      sshUrl: repo.links.clone.find((l: any) => l.name === 'ssh')?.href,
      htmlUrl: repo.links.html.href,
      createdAt: new Date(repo.created_on),
      updatedAt: new Date(repo.updated_on),
      pushedAt: new Date(repo.updated_on),
    }));
  }
  
  async createRepository(
    userId: string,
    provider: string,
    options: {
      name: string;
      description?: string;
      private?: boolean;
      autoInit?: boolean;
    }
  ): Promise<Repository> {
    const token = await this.oauthService.getToken(userId, provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    switch (provider) {
      case 'github':
        return await this.createGitHubRepo(token.accessToken, options);
      case 'gitlab':
        return await this.createGitLabRepo(token.accessToken, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  private async createGitHubRepo(
    accessToken: string,
    options: { name: string; description?: string; private?: boolean; autoInit?: boolean }
  ): Promise<Repository> {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        private: options.private ?? true,
        auto_init: options.autoInit ?? false,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create repository: ${error.message}`);
    }
    
    const repo = await response.json();
    
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      htmlUrl: repo.html_url,
      createdAt: new Date(repo.created_at),
      updatedAt: new Date(repo.updated_at),
      pushedAt: new Date(repo.pushed_at),
    };
  }
  
  private async createGitLabRepo(
    accessToken: string,
    options: { name: string; description?: string; private?: boolean; autoInit?: boolean }
  ): Promise<Repository> {
    const response = await fetch('https://gitlab.com/api/v4/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        visibility: options.private ? 'private' : 'public',
        initialize_with_readme: options.autoInit,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create repository: ${error.message}`);
    }
    
    const repo = await response.json();
    
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.path_with_namespace,
      description: repo.description,
      private: repo.visibility === 'private',
      defaultBranch: repo.default_branch,
      cloneUrl: repo.http_url_to_repo,
      sshUrl: repo.ssh_url_to_repo,
      htmlUrl: repo.web_url,
      createdAt: new Date(repo.created_at),
      updatedAt: new Date(repo.last_activity_at),
      pushedAt: new Date(repo.last_activity_at),
    };
  }
  
  private parseRemoteUrl(url: string): { provider: 'github' | 'gitlab' | 'bitbucket' | 'azure'; owner: string; repo: string } {
    // HTTPS URL: https://github.com/owner/repo.git
    // SSH URL: git@github.com:owner/repo.git
    
    let match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { provider: 'github', owner: match[1], repo: match[2] };
    }
    
    match = url.match(/gitlab\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { provider: 'gitlab', owner: match[1], repo: match[2] };
    }
    
    match = url.match(/bitbucket\.org[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      return { provider: 'bitbucket', owner: match[1], repo: match[2] };
    }
    
    match = url.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/.]+)/);
    if (match) {
      return { provider: 'azure', owner: match[1], repo: match[3] };
    }
    
    throw new Error(`Unknown remote URL format: ${url}`);
  }
}

export { RemoteManager, RemoteConfig, Repository };
```

---

## Push/Pull Operations

### Sync Service Implementation

```typescript
// src/services/syncService.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SyncOptions {
  remote?: string;
  branch?: string;
  force?: boolean;
  rebase?: boolean;
  setUpstream?: boolean;
}

interface SyncResult {
  success: boolean;
  operation: 'push' | 'pull' | 'fetch';
  remote: string;
  branch: string;
  commits?: number;
  filesChanged?: number;
  error?: string;
  conflicts?: string[];
}

class SyncService {
  private projectPath: string;
  private oauthService: OAuthService;
  
  constructor(projectPath: string, oauthService: OAuthService) {
    this.projectPath = projectPath;
    this.oauthService = oauthService;
  }
  
  async push(userId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const remote = options.remote || 'origin';
    const branch = options.branch || await this.getCurrentBranch();
    
    try {
      // Configure credentials
      await this.configureCredentials(userId, remote);
      
      // Build push command
      let cmd = `git push ${remote} ${branch}`;
      
      if (options.force) {
        cmd += ' --force';
      }
      
      if (options.setUpstream) {
        cmd += ' --set-upstream';
      }
      
      const { stdout, stderr } = await execAsync(cmd, { cwd: this.projectPath });
      
      // Parse output
      const commitsMatch = (stdout + stderr).match(/(\d+) commits?/);
      
      return {
        success: true,
        operation: 'push',
        remote,
        branch,
        commits: commitsMatch ? parseInt(commitsMatch[1], 10) : undefined,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check for specific errors
      if (errorMessage.includes('rejected')) {
        return {
          success: false,
          operation: 'push',
          remote,
          branch,
          error: 'Push rejected. Pull latest changes first.',
        };
      }
      
      return {
        success: false,
        operation: 'push',
        remote,
        branch,
        error: errorMessage,
      };
    }
  }
  
  async pull(userId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const remote = options.remote || 'origin';
    const branch = options.branch || await this.getCurrentBranch();
    
    try {
      // Configure credentials
      await this.configureCredentials(userId, remote);
      
      // Build pull command
      let cmd = `git pull ${remote} ${branch}`;
      
      if (options.rebase) {
        cmd += ' --rebase';
      }
      
      const { stdout, stderr } = await execAsync(cmd, { cwd: this.projectPath });
      
      // Parse output
      const filesMatch = (stdout + stderr).match(/(\d+) files? changed/);
      
      return {
        success: true,
        operation: 'pull',
        remote,
        branch,
        filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check for merge conflicts
      if (errorMessage.includes('CONFLICT')) {
        const conflicts = await this.getConflictFiles();
        return {
          success: false,
          operation: 'pull',
          remote,
          branch,
          error: 'Merge conflicts detected',
          conflicts,
        };
      }
      
      return {
        success: false,
        operation: 'pull',
        remote,
        branch,
        error: errorMessage,
      };
    }
  }
  
  async fetch(userId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const remote = options.remote || 'origin';
    
    try {
      // Configure credentials
      await this.configureCredentials(userId, remote);
      
      await execAsync(`git fetch ${remote}`, { cwd: this.projectPath });
      
      return {
        success: true,
        operation: 'fetch',
        remote,
        branch: options.branch || '',
      };
    } catch (error) {
      return {
        success: false,
        operation: 'fetch',
        remote,
        branch: options.branch || '',
        error: (error as Error).message,
      };
    }
  }
  
  async clone(
    userId: string,
    provider: string,
    repoUrl: string,
    targetPath: string,
    options: { branch?: string; depth?: number } = {}
  ): Promise<SyncResult> {
    try {
      // Get token for authentication
      const token = await this.oauthService.getToken(userId, provider);
      if (!token) {
        throw new Error('Not authenticated with provider');
      }
      
      // Add token to URL for HTTPS clone
      const authenticatedUrl = this.addTokenToUrl(repoUrl, token.accessToken);
      
      // Build clone command
      let cmd = `git clone "${authenticatedUrl}" "${targetPath}"`;
      
      if (options.branch) {
        cmd += ` --branch ${options.branch}`;
      }
      
      if (options.depth) {
        cmd += ` --depth ${options.depth}`;
      }
      
      await execAsync(cmd);
      
      // Remove token from remote URL after clone
      await execAsync(`git remote set-url origin "${repoUrl}"`, { cwd: targetPath });
      
      return {
        success: true,
        operation: 'pull',
        remote: 'origin',
        branch: options.branch || 'main',
      };
    } catch (error) {
      return {
        success: false,
        operation: 'pull',
        remote: 'origin',
        branch: options.branch || 'main',
        error: (error as Error).message,
      };
    }
  }
  
  async syncStatus(): Promise<{
    ahead: number;
    behind: number;
    diverged: boolean;
  }> {
    try {
      // Fetch latest
      await execAsync('git fetch', { cwd: this.projectPath });
      
      const { stdout } = await execAsync(
        'git rev-list --left-right --count HEAD...@{upstream}',
        { cwd: this.projectPath }
      );
      
      const [ahead, behind] = stdout.trim().split(/\s+/).map(n => parseInt(n, 10));
      
      return {
        ahead,
        behind,
        diverged: ahead > 0 && behind > 0,
      };
    } catch {
      return { ahead: 0, behind: 0, diverged: false };
    }
  }
  
  private async configureCredentials(userId: string, remote: string): Promise<void> {
    // Get remote URL to determine provider
    const { stdout } = await execAsync(`git remote get-url ${remote}`, { cwd: this.projectPath });
    const url = stdout.trim();
    
    let provider: string;
    if (url.includes('github.com')) {
      provider = 'github';
    } else if (url.includes('gitlab.com')) {
      provider = 'gitlab';
    } else if (url.includes('bitbucket.org')) {
      provider = 'bitbucket';
    } else {
      throw new Error('Unknown remote provider');
    }
    
    const token = await this.oauthService.getToken(userId, provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    // Configure credential helper
    await execAsync(
      `git config credential.helper '!f() { echo "password=${token.accessToken}"; }; f'`,
      { cwd: this.projectPath }
    );
  }
  
  private addTokenToUrl(url: string, token: string): string {
    // https://github.com/owner/repo.git -> https://token@github.com/owner/repo.git
    return url.replace('https://', `https://oauth2:${token}@`);
  }
  
  private async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git branch --show-current', { cwd: this.projectPath });
    return stdout.trim();
  }
  
  private async getConflictFiles(): Promise<string[]> {
    const { stdout } = await execAsync(
      'git diff --name-only --diff-filter=U',
      { cwd: this.projectPath }
    );
    return stdout.split('\n').filter(f => f.trim());
  }
}

export { SyncService, SyncOptions, SyncResult };
```

### Auto-Sync Configuration

```typescript
// src/services/autoSyncService.ts

interface AutoSyncConfig {
  enabled: boolean;
  pullInterval: number;      // seconds
  pushOnCommit: boolean;
  pushOnIdle: boolean;
  idleTimeout: number;       // seconds
  conflictStrategy: 'stash' | 'abort' | 'notify';
}

class AutoSyncService {
  private config: AutoSyncConfig;
  private syncService: SyncService;
  private pullTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private pendingPush: boolean = false;
  
  constructor(syncService: SyncService, config: Partial<AutoSyncConfig> = {}) {
    this.syncService = syncService;
    this.config = {
      enabled: true,
      pullInterval: 300,        // 5 minutes
      pushOnCommit: true,
      pushOnIdle: true,
      idleTimeout: 60,          // 1 minute
      conflictStrategy: 'notify',
      ...config,
    };
  }
  
  start(userId: string): void {
    if (!this.config.enabled) return;
    
    // Start periodic pull
    this.pullTimer = setInterval(async () => {
      await this.autoPull(userId);
    }, this.config.pullInterval * 1000);
    
    console.log('[AutoSync] Started');
  }
  
  stop(): void {
    if (this.pullTimer) {
      clearInterval(this.pullTimer);
      this.pullTimer = null;
    }
    
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    
    console.log('[AutoSync] Stopped');
  }
  
  // Called when a commit is made
  onCommit(userId: string): void {
    if (this.config.pushOnCommit) {
      this.pendingPush = true;
      this.schedulePush(userId);
    }
  }
  
  // Called on user activity
  onActivity(userId: string): void {
    if (this.config.pushOnIdle && this.pendingPush) {
      this.schedulePush(userId);
    }
  }
  
  private schedulePush(userId: string): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    
    this.idleTimer = setTimeout(async () => {
      await this.autoPush(userId);
    }, this.config.idleTimeout * 1000);
  }
  
  private async autoPull(userId: string): Promise<void> {
    try {
      const result = await this.syncService.pull(userId, { rebase: true });
      
      if (!result.success && result.conflicts) {
        await this.handleConflicts(userId, result.conflicts);
      }
    } catch (error) {
      console.error('[AutoSync] Pull failed:', error);
    }
  }
  
  private async autoPush(userId: string): Promise<void> {
    if (!this.pendingPush) return;
    
    try {
      const result = await this.syncService.push(userId);
      
      if (result.success) {
        this.pendingPush = false;
        console.log('[AutoSync] Push successful');
      } else {
        console.error('[AutoSync] Push failed:', result.error);
      }
    } catch (error) {
      console.error('[AutoSync] Push failed:', error);
    }
  }
  
  private async handleConflicts(userId: string, conflicts: string[]): Promise<void> {
    switch (this.config.conflictStrategy) {
      case 'stash':
        // Stash local changes and retry pull
        await this.stashAndRetry(userId);
        break;
      case 'abort':
        // Abort merge and notify
        await this.abortMerge();
        break;
      case 'notify':
        // Just notify user
        await this.notifyConflicts(userId, conflicts);
        break;
    }
  }
  
  private async stashAndRetry(userId: string): Promise<void> {
    // Implementation
  }
  
  private async abortMerge(): Promise<void> {
    // Implementation
  }
  
  private async notifyConflicts(userId: string, conflicts: string[]): Promise<void> {
    // Send notification to user
  }
}

export { AutoSyncService, AutoSyncConfig };
```

---

## Webhook Integration

### Webhook Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              WEBHOOK INTEGRATION                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  GITHUB/GITLAB                    PLATFORM                      SANDBOX                 │
│       │                              │                             │                    │
│       │  1. Event (push, PR, etc)    │                             │                    │
│       │ ────────────────────────────►│                             │                    │
│       │                              │                             │                    │
│       │                              │  2. Verify signature        │                    │
│       │                              │ ─────────────────┐          │                    │
│       │                              │                  │          │                    │
│       │                              │ ◄────────────────┘          │                    │
│       │                              │                             │                    │
│       │                              │  3. Route to sandbox        │                    │
│       │                              │ ───────────────────────────►│                    │
│       │                              │                             │                    │
│       │                              │                             │  4. Execute action │
│       │                              │                             │ ─────────────────┐ │
│       │                              │                             │                  │ │
│       │                              │                             │ ◄────────────────┘ │
│       │                              │                             │                    │
│       │                              │  5. Status update           │                    │
│       │ ◄────────────────────────────│ ◄───────────────────────────│                    │
│       │                              │                             │                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Webhook Handler Implementation

```typescript
// src/services/webhookHandler.ts

import crypto from 'crypto';

interface WebhookConfig {
  sandboxId: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  secret: string;
  events: string[];
  actions: WebhookAction[];
}

interface WebhookAction {
  event: string;
  action: 'pull' | 'deploy' | 'test' | 'notify' | 'custom';
  config?: Record<string, any>;
}

interface WebhookPayload {
  provider: string;
  event: string;
  delivery: string;
  signature: string;
  payload: any;
}

class WebhookHandler {
  private configs: Map<string, WebhookConfig> = new Map();
  
  registerWebhook(config: WebhookConfig): string {
    const webhookId = this.generateWebhookId();
    this.configs.set(webhookId, config);
    return webhookId;
  }
  
  unregisterWebhook(webhookId: string): void {
    this.configs.delete(webhookId);
  }
  
  async handleWebhook(webhookId: string, payload: WebhookPayload): Promise<void> {
    const config = this.configs.get(webhookId);
    if (!config) {
      throw new Error('Webhook not found');
    }
    
    // Verify signature
    if (!this.verifySignature(payload, config.secret, config.provider)) {
      throw new Error('Invalid webhook signature');
    }
    
    // Check if event is subscribed
    if (!config.events.includes(payload.event)) {
      console.log(`[Webhook] Ignoring unsubscribed event: ${payload.event}`);
      return;
    }
    
    // Find matching actions
    const actions = config.actions.filter(a => a.event === payload.event || a.event === '*');
    
    // Execute actions
    for (const action of actions) {
      await this.executeAction(config.sandboxId, action, payload);
    }
  }
  
  private verifySignature(payload: WebhookPayload, secret: string, provider: string): boolean {
    switch (provider) {
      case 'github':
        return this.verifyGitHubSignature(payload, secret);
      case 'gitlab':
        return this.verifyGitLabSignature(payload, secret);
      case 'bitbucket':
        return this.verifyBitbucketSignature(payload, secret);
      default:
        return false;
    }
  }
  
  private verifyGitHubSignature(payload: WebhookPayload, secret: string): boolean {
    const signature = payload.signature;
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }
    
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload.payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
  
  private verifyGitLabSignature(payload: WebhookPayload, secret: string): boolean {
    return payload.signature === secret;
  }
  
  private verifyBitbucketSignature(payload: WebhookPayload, secret: string): boolean {
    // Bitbucket uses IP whitelisting instead of signatures
    return true;
  }
  
  private async executeAction(
    sandboxId: string,
    action: WebhookAction,
    payload: WebhookPayload
  ): Promise<void> {
    console.log(`[Webhook] Executing action: ${action.action} for sandbox: ${sandboxId}`);
    
    switch (action.action) {
      case 'pull':
        await this.executePullAction(sandboxId, payload);
        break;
      case 'deploy':
        await this.executeDeployAction(sandboxId, payload, action.config);
        break;
      case 'test':
        await this.executeTestAction(sandboxId, payload, action.config);
        break;
      case 'notify':
        await this.executeNotifyAction(sandboxId, payload, action.config);
        break;
      case 'custom':
        await this.executeCustomAction(sandboxId, payload, action.config);
        break;
    }
  }
  
  private async executePullAction(sandboxId: string, payload: WebhookPayload): Promise<void> {
    // Pull latest changes from remote
    // Implementation depends on sandbox service
  }
  
  private async executeDeployAction(
    sandboxId: string,
    payload: WebhookPayload,
    config?: Record<string, any>
  ): Promise<void> {
    // Trigger deployment
  }
  
  private async executeTestAction(
    sandboxId: string,
    payload: WebhookPayload,
    config?: Record<string, any>
  ): Promise<void> {
    // Run tests
  }
  
  private async executeNotifyAction(
    sandboxId: string,
    payload: WebhookPayload,
    config?: Record<string, any>
  ): Promise<void> {
    // Send notification
  }
  
  private async executeCustomAction(
    sandboxId: string,
    payload: WebhookPayload,
    config?: Record<string, any>
  ): Promise<void> {
    // Execute custom script
  }
  
  private generateWebhookId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Webhook event types by provider
const webhookEvents = {
  github: [
    'push',
    'pull_request',
    'pull_request_review',
    'issues',
    'issue_comment',
    'create',
    'delete',
    'release',
    'workflow_run',
  ],
  gitlab: [
    'push',
    'merge_request',
    'issue',
    'note',
    'tag_push',
    'pipeline',
    'job',
    'deployment',
  ],
  bitbucket: [
    'repo:push',
    'pullrequest:created',
    'pullrequest:updated',
    'pullrequest:fulfilled',
    'issue:created',
    'issue:updated',
  ],
};

export { WebhookHandler, WebhookConfig, WebhookAction, WebhookPayload, webhookEvents };
```

### Webhook Registration with Provider

```typescript
// src/services/webhookRegistration.ts

interface WebhookRegistrationResult {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

class WebhookRegistration {
  private oauthService: OAuthService;
  private baseWebhookUrl: string;
  
  constructor(oauthService: OAuthService, baseWebhookUrl: string) {
    this.oauthService = oauthService;
    this.baseWebhookUrl = baseWebhookUrl;
  }
  
  async registerWebhook(
    userId: string,
    provider: string,
    owner: string,
    repo: string,
    events: string[],
    secret: string
  ): Promise<WebhookRegistrationResult> {
    const token = await this.oauthService.getToken(userId, provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    const webhookUrl = `${this.baseWebhookUrl}/webhooks/${provider}/${owner}/${repo}`;
    
    switch (provider) {
      case 'github':
        return await this.registerGitHubWebhook(token.accessToken, owner, repo, webhookUrl, events, secret);
      case 'gitlab':
        return await this.registerGitLabWebhook(token.accessToken, owner, repo, webhookUrl, events, secret);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  private async registerGitHubWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    url: string,
    events: string[],
    secret: string
  ): Promise<WebhookRegistrationResult> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events,
          config: {
            url,
            content_type: 'json',
            secret,
            insecure_ssl: '0',
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to register webhook: ${error.message}`);
    }
    
    const hook = await response.json();
    
    return {
      id: hook.id.toString(),
      url: hook.config.url,
      events: hook.events,
      active: hook.active,
    };
  }
  
  private async registerGitLabWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    url: string,
    events: string[],
    secret: string
  ): Promise<WebhookRegistrationResult> {
    // Map events to GitLab format
    const gitlabEvents: Record<string, boolean> = {};
    for (const event of events) {
      switch (event) {
        case 'push':
          gitlabEvents.push_events = true;
          break;
        case 'merge_request':
          gitlabEvents.merge_requests_events = true;
          break;
        case 'issue':
          gitlabEvents.issues_events = true;
          break;
        case 'note':
          gitlabEvents.note_events = true;
          break;
        case 'pipeline':
          gitlabEvents.pipeline_events = true;
          break;
      }
    }
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}/hooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          token: secret,
          ...gitlabEvents,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to register webhook: ${error.message}`);
    }
    
    const hook = await response.json();
    
    return {
      id: hook.id.toString(),
      url: hook.url,
      events,
      active: true,
    };
  }
  
  async deleteWebhook(
    userId: string,
    provider: string,
    owner: string,
    repo: string,
    webhookId: string
  ): Promise<void> {
    const token = await this.oauthService.getToken(userId, provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    switch (provider) {
      case 'github':
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );
        break;
      case 'gitlab':
        await fetch(
          `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}/hooks/${webhookId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          }
        );
        break;
    }
  }
}

export { WebhookRegistration, WebhookRegistrationResult };
```

---

## CI/CD Integration

### CI/CD Trigger Service

```typescript
// src/services/cicdTriggerService.ts

interface CICDTriggerConfig {
  provider: 'github' | 'gitlab';
  owner: string;
  repo: string;
  workflow?: string;  // For GitHub Actions
  ref?: string;       // Branch or tag
  inputs?: Record<string, string>;
}

interface CICDRunResult {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  url: string;
  createdAt: Date;
}

class CICDTriggerService {
  private oauthService: OAuthService;
  
  constructor(oauthService: OAuthService) {
    this.oauthService = oauthService;
  }
  
  async triggerWorkflow(
    userId: string,
    config: CICDTriggerConfig
  ): Promise<CICDRunResult> {
    const token = await this.oauthService.getToken(userId, config.provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    switch (config.provider) {
      case 'github':
        return await this.triggerGitHubActions(token.accessToken, config);
      case 'gitlab':
        return await this.triggerGitLabPipeline(token.accessToken, config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
  
  private async triggerGitHubActions(
    accessToken: string,
    config: CICDTriggerConfig
  ): Promise<CICDRunResult> {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: config.ref || 'main',
          inputs: config.inputs || {},
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to trigger workflow: ${error.message}`);
    }
    
    // GitHub doesn't return the run ID immediately, need to poll
    const run = await this.getLatestGitHubRun(accessToken, config);
    
    return {
      id: run.id.toString(),
      status: this.mapGitHubStatus(run.status),
      url: run.html_url,
      createdAt: new Date(run.created_at),
    };
  }
  
  private async triggerGitLabPipeline(
    accessToken: string,
    config: CICDTriggerConfig
  ): Promise<CICDRunResult> {
    const projectPath = encodeURIComponent(`${config.owner}/${config.repo}`);
    
    const variables = config.inputs
      ? Object.entries(config.inputs).map(([key, value]) => ({ key, value }))
      : [];
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/pipeline`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: config.ref || 'main',
          variables,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to trigger pipeline: ${error.message}`);
    }
    
    const pipeline = await response.json();
    
    return {
      id: pipeline.id.toString(),
      status: this.mapGitLabStatus(pipeline.status),
      url: pipeline.web_url,
      createdAt: new Date(pipeline.created_at),
    };
  }
  
  async getRunStatus(
    userId: string,
    provider: string,
    owner: string,
    repo: string,
    runId: string
  ): Promise<CICDRunResult> {
    const token = await this.oauthService.getToken(userId, provider);
    if (!token) {
      throw new Error('Not authenticated with provider');
    }
    
    switch (provider) {
      case 'github':
        return await this.getGitHubRunStatus(token.accessToken, owner, repo, runId);
      case 'gitlab':
        return await this.getGitLabPipelineStatus(token.accessToken, owner, repo, runId);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  private async getGitHubRunStatus(
    accessToken: string,
    owner: string,
    repo: string,
    runId: string
  ): Promise<CICDRunResult> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    
    const run = await response.json();
    
    return {
      id: run.id.toString(),
      status: this.mapGitHubStatus(run.status, run.conclusion),
      url: run.html_url,
      createdAt: new Date(run.created_at),
    };
  }
  
  private async getGitLabPipelineStatus(
    accessToken: string,
    owner: string,
    repo: string,
    pipelineId: string
  ): Promise<CICDRunResult> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/pipelines/${pipelineId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    const pipeline = await response.json();
    
    return {
      id: pipeline.id.toString(),
      status: this.mapGitLabStatus(pipeline.status),
      url: pipeline.web_url,
      createdAt: new Date(pipeline.created_at),
    };
  }
  
  private async getLatestGitHubRun(
    accessToken: string,
    config: CICDTriggerConfig
  ): Promise<any> {
    // Wait a moment for the run to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/actions/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    
    const data = await response.json();
    return data.workflow_runs[0];
  }
  
  private mapGitHubStatus(status: string, conclusion?: string): CICDRunResult['status'] {
    if (status === 'completed') {
      return conclusion === 'success' ? 'completed' : 'failed';
    }
    if (status === 'queued') return 'queued';
    if (status === 'in_progress') return 'in_progress';
    return 'failed';
  }
  
  private mapGitLabStatus(status: string): CICDRunResult['status'] {
    switch (status) {
      case 'pending':
      case 'created':
        return 'queued';
      case 'running':
        return 'in_progress';
      case 'success':
        return 'completed';
      default:
        return 'failed';
    }
  }
}

export { CICDTriggerService, CICDTriggerConfig, CICDRunResult };
```

---

## GitHub Actions Integration

### GitHub Actions Workflow Template

```yaml
# .github/workflows/sandbox-deploy.yml
name: Sandbox Deploy

on:
  workflow_dispatch:
    inputs:
      sandbox_id:
        description: 'Sandbox ID to deploy to'
        required: true
        type: string
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - development
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Sandbox
        env:
          SANDBOX_API_KEY: ${{ secrets.SANDBOX_API_KEY }}
          SANDBOX_ID: ${{ inputs.sandbox_id }}
        run: |
          curl -X POST \
            -H "Authorization: Bearer $SANDBOX_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"action": "deploy", "artifact": "./dist"}' \
            "https://api.platform.dev/sandboxes/$SANDBOX_ID/deploy"
```

### GitHub Actions Status Check

```typescript
// src/services/githubActionsIntegration.ts

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
  headBranch: string;
  headSha: string;
}

class GitHubActionsIntegration {
  private oauthService: OAuthService;
  
  constructor(oauthService: OAuthService) {
    this.oauthService = oauthService;
  }
  
  async listWorkflows(
    userId: string,
    owner: string,
    repo: string
  ): Promise<Array<{ id: number; name: string; path: string }>> {
    const token = await this.oauthService.getToken(userId, 'github');
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    
    const data = await response.json();
    
    return data.workflows.map((w: any) => ({
      id: w.id,
      name: w.name,
      path: w.path,
    }));
  }
  
  async listRuns(
    userId: string,
    owner: string,
    repo: string,
    options: { workflow?: string; branch?: string; status?: string } = {}
  ): Promise<WorkflowRun[]> {
    const token = await this.oauthService.getToken(userId, 'github');
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }
    
    const params = new URLSearchParams();
    if (options.branch) params.set('branch', options.branch);
    if (options.status) params.set('status', options.status);
    
    let url = `https://api.github.com/repos/${owner}/${repo}/actions/runs`;
    if (options.workflow) {
      url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${options.workflow}/runs`;
    }
    
    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    
    const data = await response.json();
    
    return data.workflow_runs.map((run: any) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: new Date(run.created_at),
      updatedAt: new Date(run.updated_at),
      headBranch: run.head_branch,
      headSha: run.head_sha,
    }));
  }
  
  async cancelRun(
    userId: string,
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    const token = await this.oauthService.getToken(userId, 'github');
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }
    
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
  }
  
  async rerunRun(
    userId: string,
    owner: string,
    repo: string,
    runId: number
  ): Promise<void> {
    const token = await this.oauthService.getToken(userId, 'github');
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }
    
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/rerun`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
  }
  
  async getRunLogs(
    userId: string,
    owner: string,
    repo: string,
    runId: number
  ): Promise<string> {
    const token = await this.oauthService.getToken(userId, 'github');
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );
    
    // Returns a redirect to download URL
    const logsUrl = response.url;
    const logsResponse = await fetch(logsUrl);
    
    return await logsResponse.text();
  }
}

export { GitHubActionsIntegration, WorkflowRun };
```

---

## GitLab CI Integration

### GitLab CI Configuration Template

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  SANDBOX_API_URL: "https://api.platform.dev"

test:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm test
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'

build:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST \
        -H "Authorization: Bearer $SANDBOX_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"action\": \"deploy\", \"artifact\": \"./dist\"}" \
        "$SANDBOX_API_URL/sandboxes/$SANDBOX_ID/deploy"
  environment:
    name: $CI_ENVIRONMENT_NAME
    url: https://$SANDBOX_ID.platform.dev
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

### GitLab CI Integration Service

```typescript
// src/services/gitlabCIIntegration.ts

interface Pipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  webUrl: string;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

interface Job {
  id: number;
  name: string;
  stage: string;
  status: string;
  webUrl: string;
  duration: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

class GitLabCIIntegration {
  private oauthService: OAuthService;
  
  constructor(oauthService: OAuthService) {
    this.oauthService = oauthService;
  }
  
  async listPipelines(
    userId: string,
    owner: string,
    repo: string,
    options: { ref?: string; status?: string } = {}
  ): Promise<Pipeline[]> {
    const token = await this.oauthService.getToken(userId, 'gitlab');
    if (!token) {
      throw new Error('Not authenticated with GitLab');
    }
    
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    const params = new URLSearchParams();
    if (options.ref) params.set('ref', options.ref);
    if (options.status) params.set('status', options.status);
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/pipelines?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    
    return data.map((pipeline: any) => ({
      id: pipeline.id,
      status: pipeline.status,
      ref: pipeline.ref,
      sha: pipeline.sha,
      webUrl: pipeline.web_url,
      createdAt: new Date(pipeline.created_at),
      updatedAt: new Date(pipeline.updated_at),
      finishedAt: pipeline.finished_at ? new Date(pipeline.finished_at) : null,
    }));
  }
  
  async getPipelineJobs(
    userId: string,
    owner: string,
    repo: string,
    pipelineId: number
  ): Promise<Job[]> {
    const token = await this.oauthService.getToken(userId, 'gitlab');
    if (!token) {
      throw new Error('Not authenticated with GitLab');
    }
    
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/pipelines/${pipelineId}/jobs`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    
    return data.map((job: any) => ({
      id: job.id,
      name: job.name,
      stage: job.stage,
      status: job.status,
      webUrl: job.web_url,
      duration: job.duration,
      startedAt: job.started_at ? new Date(job.started_at) : null,
      finishedAt: job.finished_at ? new Date(job.finished_at) : null,
    }));
  }
  
  async cancelPipeline(
    userId: string,
    owner: string,
    repo: string,
    pipelineId: number
  ): Promise<void> {
    const token = await this.oauthService.getToken(userId, 'gitlab');
    if (!token) {
      throw new Error('Not authenticated with GitLab');
    }
    
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    
    await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/pipelines/${pipelineId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      }
    );
  }
  
  async retryPipeline(
    userId: string,
    owner: string,
    repo: string,
    pipelineId: number
  ): Promise<void> {
    const token = await this.oauthService.getToken(userId, 'gitlab');
    if (!token) {
      throw new Error('Not authenticated with GitLab');
    }
    
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    
    await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/pipelines/${pipelineId}/retry`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      }
    );
  }
  
  async getJobLog(
    userId: string,
    owner: string,
    repo: string,
    jobId: number
  ): Promise<string> {
    const token = await this.oauthService.getToken(userId, 'gitlab');
    if (!token) {
      throw new Error('Not authenticated with GitLab');
    }
    
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/jobs/${jobId}/trace`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      }
    );
    
    return await response.text();
  }
}

export { GitLabCIIntegration, Pipeline, Job };
```

---

## Security Considerations

### Token Security

```typescript
// src/services/tokenSecurity.ts

import crypto from 'crypto';

class TokenSecurity {
  private encryptionKey: Buffer;
  
  constructor(encryptionKeyHex: string) {
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
  }
  
  // Encrypt token before storing
  encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  // Decrypt token when retrieving
  decryptToken(encryptedToken: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  // Generate secure webhook secret
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Validate webhook signature timing-safe
  validateSignature(received: string, expected: string): boolean {
    if (received.length !== expected.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(received),
      Buffer.from(expected)
    );
  }
}

export { TokenSecurity };
```

### Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **Token Encryption** | AES-256-GCM at rest |
| **Token Rotation** | Automatic refresh before expiry |
| **Minimal Scopes** | Request only needed permissions |
| **Webhook Verification** | HMAC signature validation |
| **State Parameter** | CSRF protection in OAuth flow |
| **Secure Storage** | Encrypted database or vault |
| **Audit Logging** | Log all token operations |
| **Rate Limiting** | Prevent brute force attacks |

---

## API Reference

### REST API Endpoints

```yaml
# openapi.yaml (partial)
paths:
  /api/v1/oauth/{provider}/authorize:
    get:
      summary: Get OAuth authorization URL
      parameters:
        - name: provider
          in: path
          required: true
          schema:
            type: string
            enum: [github, gitlab, bitbucket]
      responses:
        '200':
          description: Authorization URL
          content:
            application/json:
              schema:
                type: object
                properties:
                  url:
                    type: string
                  state:
                    type: string

  /api/v1/oauth/{provider}/callback:
    get:
      summary: OAuth callback handler
      parameters:
        - name: provider
          in: path
          required: true
          schema:
            type: string
        - name: code
          in: query
          required: true
          schema:
            type: string
        - name: state
          in: query
          required: true
          schema:
            type: string
      responses:
        '302':
          description: Redirect to success page

  /api/v1/sandboxes/{sandboxId}/remotes:
    get:
      summary: List configured remotes
      responses:
        '200':
          description: Remote list
    post:
      summary: Add a remote
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                url:
                  type: string
      responses:
        '201':
          description: Remote added

  /api/v1/sandboxes/{sandboxId}/sync:
    post:
      summary: Sync with remote
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                operation:
                  type: string
                  enum: [push, pull, fetch]
                remote:
                  type: string
                branch:
                  type: string
      responses:
        '200':
          description: Sync result

  /api/v1/webhooks:
    post:
      summary: Register a webhook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WebhookConfig'
      responses:
        '201':
          description: Webhook registered

  /api/v1/webhooks/{provider}/{owner}/{repo}:
    post:
      summary: Webhook receiver endpoint
      responses:
        '200':
          description: Webhook processed
```

---

## Best Practices

### 1. OAuth Token Management

```typescript
// Always check token validity before API calls
async function makeApiCall(userId: string, provider: string): Promise<void> {
  const token = await oauthService.getToken(userId, provider);
  
  if (!token) {
    throw new Error('Please connect your account first');
  }
  
  // Token is automatically refreshed if needed
}
```

### 2. Webhook Security

```typescript
// Always verify webhook signatures
app.post('/webhooks/:provider', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!webhookHandler.verifySignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
});
```

### 3. Sync Strategy

```typescript
// Recommended sync workflow
async function syncWorkflow(userId: string): Promise<void> {
  // 1. Fetch to see what's new
  await syncService.fetch(userId);
  
  // 2. Check status
  const status = await syncService.syncStatus();
  
  // 3. Pull if behind
  if (status.behind > 0) {
    const result = await syncService.pull(userId, { rebase: true });
    if (result.conflicts) {
      // Handle conflicts
    }
  }
  
  // 4. Push if ahead
  if (status.ahead > 0) {
    await syncService.push(userId);
  }
}
```

---

## Summary

### Integration Features

| Feature | GitHub | GitLab | Bitbucket |
|---------|--------|--------|-----------|
| **OAuth** | ✅ | ✅ | ✅ |
| **Push/Pull** | ✅ | ✅ | ✅ |
| **Webhooks** | ✅ | ✅ | ✅ |
| **CI/CD Trigger** | ✅ | ✅ | ✅ |
| **PR/MR Management** | ✅ | ✅ | ✅ |
| **Issue Linking** | ✅ | ✅ | ✅ |

### OAuth Scopes

| Provider | Minimum Scopes |
|----------|---------------|
| GitHub | `repo`, `read:user` |
| GitLab | `api`, `read_repository`, `write_repository` |
| Bitbucket | `repository`, `repository:write` |

### Implementation Checklist

- [ ] OAuth service with token management
- [ ] Remote manager for repository operations
- [ ] Sync service for push/pull
- [ ] Webhook handler with signature verification
- [ ] CI/CD trigger service
- [ ] GitHub Actions integration
- [ ] GitLab CI integration
- [ ] Token encryption at rest
- [ ] API endpoints documented
