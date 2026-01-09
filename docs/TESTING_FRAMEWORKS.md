# Testing Frameworks Support

This guide provides comprehensive coverage of testing framework support in cloud development environments, including unit testing, integration testing, and end-to-end testing capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Frameworks](#supported-frameworks)
3. [Jest Configuration](#jest-configuration)
4. [Vitest Configuration](#vitest-configuration)
5. [Playwright Configuration](#playwright-configuration)
6. [Cypress Configuration](#cypress-configuration)
7. [Framework Comparison](#framework-comparison)
8. [Template Integration](#template-integration)
9. [Test Discovery](#test-discovery)
10. [Coverage Reporting](#coverage-reporting)
11. [Mocking and Fixtures](#mocking-and-fixtures)
12. [Best Practices](#best-practices)

---

## Overview

Testing is a critical part of software development, and cloud development environments must support a variety of testing frameworks to accommodate different project needs and developer preferences.

### Testing Pyramid

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TESTING PYRAMID                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                                    ┌───────┐                                            │
│                                   /   E2E   \                                           │
│                                  /  (Slow)   \                                          │
│                                 /─────────────\                                         │
│                                /  Integration  \                                        │
│                               /    (Medium)     \                                       │
│                              /───────────────────\                                      │
│                             /     Unit Tests      \                                     │
│                            /       (Fast)          \                                    │
│                           /─────────────────────────\                                   │
│                                                                                         │
│  Recommended Distribution:                                                              │
│  • Unit Tests: 70% (Fast, isolated, many)                                              │
│  • Integration Tests: 20% (Medium speed, component interaction)                        │
│  • E2E Tests: 10% (Slow, full user flows)                                              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Framework Categories

| Category | Frameworks | Use Case |
|----------|------------|----------|
| **Unit Testing** | Jest, Vitest, Mocha | Testing individual functions/components |
| **Integration** | Jest, Vitest, Supertest | Testing component interactions |
| **E2E** | Playwright, Cypress | Full browser automation |
| **API Testing** | Supertest, Pactum | REST/GraphQL API testing |
| **Visual** | Playwright, Percy, Chromatic | Screenshot comparison |

---

## Supported Frameworks

### Out-of-Box Support Matrix

| Framework | Version | Language | Pre-installed | Auto-configured |
|-----------|---------|----------|---------------|-----------------|
| **Jest** | 29.x | JavaScript/TypeScript | ✅ | ✅ |
| **Vitest** | 1.x | JavaScript/TypeScript | ✅ | ✅ |
| **Playwright** | 1.40+ | JavaScript/TypeScript | ✅ | ✅ |
| **Cypress** | 13.x | JavaScript/TypeScript | ⚠️ Install | ✅ |
| **Mocha** | 10.x | JavaScript/TypeScript | ⚠️ Install | ⚠️ Manual |
| **pytest** | 8.x | Python | ✅ | ✅ |
| **Go test** | 1.21+ | Go | ✅ | ✅ |
| **RSpec** | 3.x | Ruby | ⚠️ Install | ⚠️ Manual |
| **JUnit** | 5.x | Java | ⚠️ Install | ⚠️ Manual |

### Framework Selection by Template

| Template | Default Framework | Alternatives |
|----------|-------------------|--------------|
| **React + Vite** | Vitest | Jest |
| **Next.js** | Jest | Vitest |
| **Express** | Vitest | Jest, Mocha |
| **FastAPI** | pytest | unittest |
| **Go** | go test | testify |
| **Django** | pytest | unittest |

---

## Jest Configuration

### Default Configuration

```javascript
// jest.config.js

/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'node', // or 'jsdom' for browser tests
  
  // File patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],
  
  // TypeScript support
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: true,
    }],
  },
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Performance
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Timeouts
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
};

module.exports = config;
```

### Jest Setup File

```javascript
// jest.setup.js

// Extend Jest matchers
import '@testing-library/jest-dom';

// Mock global objects
global.fetch = jest.fn();
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
```

### Jest React Testing Example

```typescript
// src/components/Button.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant styles correctly', () => {
    render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('shows loading spinner when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

---

## Vitest Configuration

### Default Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Environment
    environment: 'jsdom', // or 'node', 'happy-dom'
    
    // Global setup
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    
    // File patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    
    // Coverage
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts,jsx,tsx}',
        'src/**/*.stories.{js,ts,jsx,tsx}',
        'src/test/**',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    
    // Performance
    pool: 'threads', // or 'forks'
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Watch mode
    watch: false,
    
    // Reporter
    reporters: ['verbose'],
    
    // Mocking
    mockReset: true,
    restoreMocks: true,
    
    // Type checking
    typecheck: {
      enabled: false, // Enable for type testing
      checker: 'tsc',
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Vitest Setup File

```typescript
// vitest.setup.ts

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock global objects
vi.stubGlobal('fetch', vi.fn());

vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### Vitest Testing Example

```typescript
// src/services/api.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from './api';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('https://api.example.com');
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('fetches data successfully', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await client.get('/users/1');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('throws on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/users/1')).rejects.toThrow('Network error');
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(client.get('/users/1')).rejects.toThrow('404 Not Found');
    });
  });

  describe('post', () => {
    it('sends data correctly', async () => {
      const mockResponse = { id: 1, name: 'Created' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.post('/users', { name: 'Test' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ name: 'Test' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
```

---

## Playwright Configuration

### Default Configuration

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Test file patterns
  testMatch: '**/*.spec.ts',
  
  // Timeout settings
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  
  // Fail fast
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  
  // Shared settings
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Browser options
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Artifacts
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Navigation
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },
  
  // Projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Web server
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  // Output directory
  outputDir: 'test-results',
});
```

### Playwright Test Example

```typescript
// e2e/auth.spec.ts

import { test, expect, Page } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await page.click('text=Sign In');
    
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toHaveText('Sign In');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toHaveText('Invalid credentials');
    await expect(page).toHaveURL('/login');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Sign Out');
    
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Sign In')).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page).toHaveURL('/login?redirect=/dashboard');
  });

  test('should redirect back after login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login?redirect=/dashboard');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Playwright Page Object Model

```typescript
// e2e/pages/LoginPage.ts

import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
    this.forgotPasswordLink = page.locator('text=Forgot password?');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toHaveText(message);
  }

  async expectLoginSuccess() {
    await expect(this.page).toHaveURL('/dashboard');
  }
}

// e2e/pages/DashboardPage.ts

export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator('text=Welcome back');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.signOutButton = page.locator('text=Sign Out');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async signOut() {
    await this.userMenu.click();
    await this.signOutButton.click();
  }

  async expectVisible() {
    await expect(this.welcomeMessage).toBeVisible();
  }
}

// e2e/auth-pom.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Authentication with POM', () => {
  test('should login successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');
    await loginPage.expectLoginSuccess();
    await dashboardPage.expectVisible();
  });
});
```

---

## Cypress Configuration

### Default Configuration

```typescript
// cypress.config.ts

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    
    // Viewport
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    
    // Screenshots and videos
    screenshotOnRunFailure: true,
    video: true,
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    
    // Retries
    retries: {
      runMode: 2,
      openMode: 0,
    },
    
    // Experimental features
    experimentalStudio: true,
    
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        // Database seeding
        async seedDatabase(data) {
          // Seed database for tests
          return null;
        },
        async clearDatabase() {
          // Clear database after tests
          return null;
        },
      });
      
      return config;
    },
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
  },
});
```

### Cypress Support File

```typescript
// cypress/support/e2e.ts

import './commands';

// Global hooks
beforeEach(() => {
  // Clear cookies and local storage
  cy.clearCookies();
  cy.clearLocalStorage();
});

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  if (err.message.includes('ResizeObserver')) {
    return false;
  }
  return true;
});
```

### Cypress Custom Commands

```typescript
// cypress/support/commands.ts

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      interceptApi(method: string, url: string, response: any): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.contains('Sign Out').click();
  cy.url().should('eq', Cypress.config().baseUrl + '/');
});

// Get by test ID
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

// Intercept API calls
Cypress.Commands.add('interceptApi', (method: string, url: string, response: any) => {
  cy.intercept(method, `**/api${url}`, response).as('apiCall');
});

export {};
```

### Cypress Test Example

```typescript
// cypress/e2e/dashboard.cy.ts

describe('Dashboard', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/dashboard');
  });

  it('displays welcome message', () => {
    cy.contains('Welcome back').should('be.visible');
  });

  it('shows user statistics', () => {
    cy.getByTestId('stats-card').should('have.length.at.least', 1);
    cy.getByTestId('total-projects').should('be.visible');
    cy.getByTestId('active-tasks').should('be.visible');
  });

  it('allows creating new project', () => {
    cy.interceptApi('POST', '/projects', {
      statusCode: 201,
      body: { id: 1, name: 'New Project' },
    });

    cy.getByTestId('new-project-btn').click();
    cy.get('input[name="projectName"]').type('New Project');
    cy.get('button[type="submit"]').click();

    cy.wait('@apiCall');
    cy.contains('Project created successfully').should('be.visible');
  });

  it('navigates to project details', () => {
    cy.getByTestId('project-card').first().click();
    cy.url().should('match', /\/projects\/\d+/);
  });

  it('filters projects by status', () => {
    cy.getByTestId('status-filter').select('active');
    cy.getByTestId('project-card').each(($card) => {
      cy.wrap($card).should('contain', 'Active');
    });
  });
});
```

---

## Framework Comparison

### Feature Comparison

| Feature | Jest | Vitest | Playwright | Cypress |
|---------|------|--------|------------|---------|
| **Type** | Unit/Integration | Unit/Integration | E2E | E2E |
| **Speed** | Fast | Very Fast | Medium | Medium |
| **Browser** | jsdom | jsdom/happy-dom | Real browsers | Real browsers |
| **Watch Mode** | ✅ | ✅ | ✅ | ✅ |
| **Parallel** | ✅ | ✅ | ✅ | ✅ (paid) |
| **Snapshots** | ✅ | ✅ | ✅ | ✅ |
| **Coverage** | ✅ | ✅ | ❌ | ❌ |
| **Visual Testing** | ❌ | ❌ | ✅ | ✅ |
| **Network Mocking** | ✅ | ✅ | ✅ | ✅ |
| **Component Testing** | ✅ | ✅ | ✅ | ✅ |
| **Cross-browser** | ❌ | ❌ | ✅ | ✅ |
| **Mobile** | ❌ | ❌ | ✅ | ✅ |

### Performance Comparison

| Metric | Jest | Vitest | Playwright | Cypress |
|--------|------|--------|------------|---------|
| **Startup Time** | ~2s | ~0.5s | ~3s | ~5s |
| **Test Execution** | Fast | Fastest | Medium | Medium |
| **Memory Usage** | Medium | Low | High | High |
| **HMR Support** | ❌ | ✅ | N/A | N/A |

### When to Use Each

| Scenario | Recommended Framework |
|----------|----------------------|
| Unit testing React components | Vitest + Testing Library |
| Unit testing Node.js | Vitest or Jest |
| API integration tests | Vitest + Supertest |
| Full E2E user flows | Playwright |
| Visual regression | Playwright |
| Cross-browser testing | Playwright |
| Component testing in isolation | Cypress Component |
| Legacy Jest projects | Jest |

---

## Template Integration

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:cypress": "cypress run",
    "test:cypress:open": "cypress open",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

### Pre-configured Test Structure

```
project/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx      # Unit tests colocated
│   ├── services/
│   │   ├── api.ts
│   │   └── api.test.ts
│   └── __tests__/               # Integration tests
│       └── integration.test.ts
├── e2e/                         # Playwright E2E tests
│   ├── pages/                   # Page objects
│   │   ├── LoginPage.ts
│   │   └── DashboardPage.ts
│   ├── fixtures/                # Test data
│   │   └── users.json
│   └── specs/
│       ├── auth.spec.ts
│       └── dashboard.spec.ts
├── cypress/                     # Cypress tests (if used)
│   ├── e2e/
│   ├── fixtures/
│   └── support/
├── vitest.config.ts
├── playwright.config.ts
└── cypress.config.ts
```

---

## Test Discovery

### Automatic Test Discovery

```typescript
// src/testing/testDiscovery.ts

interface DiscoveredTest {
  file: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  framework: 'jest' | 'vitest' | 'playwright' | 'cypress';
  line: number;
}

class TestDiscoveryService {
  private patterns = {
    jest: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
    vitest: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
    playwright: ['**/e2e/**/*.spec.ts', '**/tests/**/*.spec.ts'],
    cypress: ['**/cypress/e2e/**/*.cy.{js,ts}'],
  };

  async discoverTests(projectPath: string): Promise<DiscoveredTest[]> {
    const tests: DiscoveredTest[] = [];

    for (const [framework, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const files = await this.findFiles(projectPath, pattern);
        
        for (const file of files) {
          const fileTests = await this.parseTestFile(file, framework);
          tests.push(...fileTests);
        }
      }
    }

    return tests;
  }

  private async parseTestFile(
    file: string,
    framework: string
  ): Promise<DiscoveredTest[]> {
    const content = await fs.readFile(file, 'utf-8');
    const tests: DiscoveredTest[] = [];

    // Parse describe/it/test blocks
    const testRegex = /(?:describe|it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    let line = 1;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      while ((match = testRegex.exec(lines[i])) !== null) {
        tests.push({
          file,
          name: match[1],
          type: this.inferTestType(file),
          framework: framework as any,
          line: i + 1,
        });
      }
    }

    return tests;
  }

  private inferTestType(file: string): 'unit' | 'integration' | 'e2e' {
    if (file.includes('/e2e/') || file.includes('.e2e.')) {
      return 'e2e';
    }
    if (file.includes('/integration/') || file.includes('.integration.')) {
      return 'integration';
    }
    return 'unit';
  }

  private async findFiles(basePath: string, pattern: string): Promise<string[]> {
    // Implementation using glob
    return [];
  }
}

export { TestDiscoveryService, DiscoveredTest };
```

---

## Coverage Reporting

### Coverage Configuration

```typescript
// vitest.config.ts coverage section

coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
  reportsDirectory: './coverage',
  
  // Include/exclude patterns
  include: ['src/**/*.{js,ts,jsx,tsx}'],
  exclude: [
    'src/**/*.d.ts',
    'src/**/*.test.{js,ts,jsx,tsx}',
    'src/**/*.spec.{js,ts,jsx,tsx}',
    'src/**/*.stories.{js,ts,jsx,tsx}',
    'src/test/**',
    'src/mocks/**',
  ],
  
  // Thresholds
  thresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // Per-file thresholds
    'src/utils/**': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // Skip files with no tests
  skipFull: false,
  
  // Clean coverage before running
  clean: true,
}
```

### Coverage Report Integration

```typescript
// src/testing/coverageReporter.ts

interface CoverageReport {
  summary: {
    lines: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    statements: { total: number; covered: number; percentage: number };
  };
  files: CoverageFile[];
}

interface CoverageFile {
  path: string;
  lines: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
  uncoveredLines: number[];
}

class CoverageReporter {
  async generateReport(coverageDir: string): Promise<CoverageReport> {
    const summaryPath = path.join(coverageDir, 'coverage-summary.json');
    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));

    return {
      summary: this.parseSummary(summary.total),
      files: Object.entries(summary)
        .filter(([key]) => key !== 'total')
        .map(([path, data]) => this.parseFile(path, data as any)),
    };
  }

  private parseSummary(total: any) {
    return {
      lines: this.parseMetric(total.lines),
      branches: this.parseMetric(total.branches),
      functions: this.parseMetric(total.functions),
      statements: this.parseMetric(total.statements),
    };
  }

  private parseMetric(metric: any) {
    return {
      total: metric.total,
      covered: metric.covered,
      percentage: metric.pct,
    };
  }

  private parseFile(filePath: string, data: any): CoverageFile {
    return {
      path: filePath,
      lines: this.parseMetric(data.lines),
      branches: this.parseMetric(data.branches),
      functions: this.parseMetric(data.functions),
      statements: this.parseMetric(data.statements),
      uncoveredLines: [], // Would need detailed report for this
    };
  }
}

export { CoverageReporter, CoverageReport, CoverageFile };
```

---

## Mocking and Fixtures

### Mock Service Worker (MSW) Integration

```typescript
// src/mocks/handlers.ts

import { http, HttpResponse } from 'msw';

export const handlers = [
  // User endpoints
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test User',
      email: 'test@example.com',
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 1, ...body },
      { status: 201 }
    );
  }),

  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    
    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        token: 'mock-jwt-token',
        user: { id: 1, email, name: 'Test User' },
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Error simulation
  http.get('/api/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),
];

// src/mocks/server.ts (for Node.js tests)
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// src/mocks/browser.ts (for browser tests)
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

### Test Fixtures

```typescript
// src/test/fixtures/users.ts

export const mockUsers = {
  admin: {
    id: 1,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
  },
  user: {
    id: 2,
    email: 'user@example.com',
    name: 'Regular User',
    role: 'user',
  },
  guest: {
    id: 3,
    email: 'guest@example.com',
    name: 'Guest User',
    role: 'guest',
  },
};

// src/test/fixtures/projects.ts

export const mockProjects = [
  {
    id: 1,
    name: 'Project Alpha',
    status: 'active',
    owner: mockUsers.admin,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Project Beta',
    status: 'completed',
    owner: mockUsers.user,
    createdAt: '2024-02-01T00:00:00Z',
  },
];

// src/test/factories/userFactory.ts

import { faker } from '@faker-js/faker';

export function createUser(overrides = {}) {
  return {
    id: faker.number.int({ min: 1, max: 10000 }),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: faker.helpers.arrayElement(['admin', 'user', 'guest']),
    createdAt: faker.date.past().toISOString(),
    ...overrides,
  };
}

export function createUsers(count: number, overrides = {}) {
  return Array.from({ length: count }, () => createUser(overrides));
}
```

---

## Best Practices

### Testing Guidelines

| Practice | Description |
|----------|-------------|
| **Arrange-Act-Assert** | Structure tests clearly |
| **One assertion per test** | Keep tests focused |
| **Descriptive names** | Test names should describe behavior |
| **Avoid implementation details** | Test behavior, not implementation |
| **Use data-testid** | Stable selectors for E2E |
| **Mock external services** | Isolate tests from dependencies |
| **Clean up after tests** | Prevent test pollution |
| **Run tests in CI** | Catch regressions early |

### Test Naming Convention

```typescript
// Good test names
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data');
    it('should throw ValidationError when email is invalid');
    it('should hash password before saving');
  });
});

// E2E test names
describe('Checkout Flow', () => {
  it('allows user to complete purchase with credit card');
  it('shows error when payment fails');
  it('sends confirmation email after successful purchase');
});
```

### Coverage Targets

| Type | Target | Minimum |
|------|--------|---------|
| **Unit Tests** | 80% | 70% |
| **Integration** | 70% | 60% |
| **E2E** | Critical paths | N/A |
| **Overall** | 75% | 65% |

---

## Summary

### Framework Selection Guide

| Need | Recommendation |
|------|----------------|
| Fast unit tests | Vitest |
| Legacy Jest project | Jest |
| Cross-browser E2E | Playwright |
| Visual testing | Playwright |
| Component testing | Cypress Component |
| API testing | Vitest + Supertest |

### Quick Start Commands

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run specific test file
pnpm test src/components/Button.test.tsx

# Run tests in watch mode
pnpm test:watch

# Debug E2E tests
pnpm test:e2e:debug
```
