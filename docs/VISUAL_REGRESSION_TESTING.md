# Visual Regression Testing

This guide provides comprehensive coverage of visual regression testing, including screenshot comparison, Storybook integration, and automated visual testing pipelines for cloud development environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Visual Testing Architecture](#visual-testing-architecture)
3. [Screenshot Comparison](#screenshot-comparison)
4. [Playwright Visual Testing](#playwright-visual-testing)
5. [Storybook Integration](#storybook-integration)
6. [Percy Integration](#percy-integration)
7. [Chromatic Integration](#chromatic-integration)
8. [Custom Visual Testing](#custom-visual-testing)
9. [Baseline Management](#baseline-management)
10. [CI/CD Integration](#cicd-integration)
11. [Diff Analysis](#diff-analysis)
12. [Best Practices](#best-practices)

---

## Overview

Visual regression testing ensures that UI changes don't introduce unintended visual differences by comparing screenshots of components and pages against approved baselines.

### Visual Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         VISUAL REGRESSION TESTING ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SOURCE                                              │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │  Component  │  │    Page     │  │  Storybook  │  │    E2E      │            │   │
│  │  │   Tests     │  │   Tests     │  │   Stories   │  │   Tests     │            │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │   │
│  │         │                │                │                │                    │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼────────────────────┘   │
│            │                │                │                │                         │
│            ▼                ▼                ▼                ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         SCREENSHOT CAPTURE                                       │   │
│  │                                                                                   │   │
│  │  • Playwright                                                                    │   │
│  │  • Puppeteer                                                                     │   │
│  │  • Cypress                                                                       │   │
│  │  • Storybook Test Runner                                                         │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         COMPARISON ENGINE                                        │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   Pixel     │  │  Perceptual │  │  Structural │  │    AI       │            │   │
│  │  │   Diff      │  │    Diff     │  │    Diff     │  │   Diff      │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         BASELINE MANAGEMENT                                      │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   Local     │  │    Git      │  │   Cloud     │  │   Review    │            │   │
│  │  │  Storage    │  │   LFS       │  │  Storage    │  │    UI       │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         REPORTING                                                │   │
│  │                                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │   HTML      │  │   PR        │  │   Slack     │  │  Dashboard  │            │   │
│  │  │  Report     │  │  Comment    │  │   Alert     │  │   View      │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Comparison Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Pixel Diff** | Exact pixel comparison | Precise UI validation |
| **Perceptual Diff** | Human-perceived differences | Anti-aliasing tolerance |
| **Structural Diff** | Layout and structure | Responsive testing |
| **AI Diff** | ML-based comparison | Intelligent filtering |

---

## Screenshot Comparison

### Comparison Algorithms

```typescript
// src/visual/comparison/pixelDiff.ts

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

interface ComparisonResult {
  match: boolean;
  diffPercentage: number;
  diffPixels: number;
  diffImage?: Buffer;
}

interface ComparisonOptions {
  threshold: number;        // 0-1, pixel matching threshold
  includeAA: boolean;       // Include anti-aliased pixels
  alpha: number;            // Alpha channel threshold
  diffColor: [number, number, number, number];  // RGBA
  diffColorAlt?: [number, number, number, number];
  diffMask: boolean;        // Output diff mask only
}

class PixelDiffComparator {
  private options: ComparisonOptions;

  constructor(options: Partial<ComparisonOptions> = {}) {
    this.options = {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.1,
      diffColor: [255, 0, 0, 255],
      diffMask: false,
      ...options,
    };
  }

  async compare(
    baseline: Buffer,
    current: Buffer
  ): Promise<ComparisonResult> {
    const baselineImg = PNG.sync.read(baseline);
    const currentImg = PNG.sync.read(current);

    // Check dimensions
    if (baselineImg.width !== currentImg.width || 
        baselineImg.height !== currentImg.height) {
      return {
        match: false,
        diffPercentage: 100,
        diffPixels: baselineImg.width * baselineImg.height,
        diffImage: this.createSizeMismatchImage(baselineImg, currentImg),
      };
    }

    const { width, height } = baselineImg;
    const diffImg = new PNG({ width, height });

    const diffPixels = pixelmatch(
      baselineImg.data,
      currentImg.data,
      diffImg.data,
      width,
      height,
      {
        threshold: this.options.threshold,
        includeAA: this.options.includeAA,
        alpha: this.options.alpha,
        diffColor: this.options.diffColor,
        diffColorAlt: this.options.diffColorAlt,
        diffMask: this.options.diffMask,
      }
    );

    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    return {
      match: diffPixels === 0,
      diffPercentage,
      diffPixels,
      diffImage: PNG.sync.write(diffImg),
    };
  }

  private createSizeMismatchImage(
    baseline: PNG,
    current: PNG
  ): Buffer {
    const maxWidth = Math.max(baseline.width, current.width);
    const maxHeight = Math.max(baseline.height, current.height);
    
    const img = new PNG({ width: maxWidth, height: maxHeight });
    
    // Fill with red to indicate size mismatch
    for (let y = 0; y < maxHeight; y++) {
      for (let x = 0; x < maxWidth; x++) {
        const idx = (y * maxWidth + x) * 4;
        img.data[idx] = 255;     // R
        img.data[idx + 1] = 0;   // G
        img.data[idx + 2] = 0;   // B
        img.data[idx + 3] = 128; // A
      }
    }

    return PNG.sync.write(img);
  }
}

export { PixelDiffComparator, ComparisonResult, ComparisonOptions };
```

### Perceptual Diff

```typescript
// src/visual/comparison/perceptualDiff.ts

import Jimp from 'jimp';

interface PerceptualDiffOptions {
  colorThreshold: number;    // Color difference threshold (0-1)
  luminanceWeight: number;   // Weight for luminance differences
  chrominanceWeight: number; // Weight for color differences
  edgeThreshold: number;     // Edge detection threshold
}

class PerceptualDiffComparator {
  private options: PerceptualDiffOptions;

  constructor(options: Partial<PerceptualDiffOptions> = {}) {
    this.options = {
      colorThreshold: 0.1,
      luminanceWeight: 0.7,
      chrominanceWeight: 0.3,
      edgeThreshold: 0.1,
      ...options,
    };
  }

  async compare(baseline: Buffer, current: Buffer): Promise<ComparisonResult> {
    const baselineImg = await Jimp.read(baseline);
    const currentImg = await Jimp.read(current);

    if (baselineImg.getWidth() !== currentImg.getWidth() ||
        baselineImg.getHeight() !== currentImg.getHeight()) {
      return {
        match: false,
        diffPercentage: 100,
        diffPixels: baselineImg.getWidth() * baselineImg.getHeight(),
      };
    }

    const width = baselineImg.getWidth();
    const height = baselineImg.getHeight();
    const diffImg = new Jimp(width, height);
    
    let diffPixels = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const baselineColor = Jimp.intToRGBA(baselineImg.getPixelColor(x, y));
        const currentColor = Jimp.intToRGBA(currentImg.getPixelColor(x, y));

        const diff = this.calculatePerceptualDiff(baselineColor, currentColor);

        if (diff > this.options.colorThreshold) {
          diffPixels++;
          diffImg.setPixelColor(Jimp.rgbaToInt(255, 0, 0, 255), x, y);
        } else {
          diffImg.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
        }
      }
    }

    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    return {
      match: diffPixels === 0,
      diffPercentage,
      diffPixels,
      diffImage: await diffImg.getBufferAsync(Jimp.MIME_PNG),
    };
  }

  private calculatePerceptualDiff(
    color1: { r: number; g: number; b: number; a: number },
    color2: { r: number; g: number; b: number; a: number }
  ): number {
    // Convert to LAB color space for perceptual comparison
    const lab1 = this.rgbToLab(color1.r, color1.g, color1.b);
    const lab2 = this.rgbToLab(color2.r, color2.g, color2.b);

    // Calculate CIE76 color difference
    const deltaL = lab1.l - lab2.l;
    const deltaA = lab1.a - lab2.a;
    const deltaB = lab1.b - lab2.b;

    const deltaE = Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);

    // Normalize to 0-1 range (max deltaE is ~100)
    return deltaE / 100;
  }

  private rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
    // RGB to XYZ
    let rLinear = r / 255;
    let gLinear = g / 255;
    let bLinear = b / 255;

    rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
    gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
    bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;

    const x = (rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805) / 0.95047;
    const y = (rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722) / 1.0;
    const z = (rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505) / 1.08883;

    // XYZ to LAB
    const xNorm = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    const yNorm = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    const zNorm = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

    return {
      l: (116 * yNorm) - 16,
      a: 500 * (xNorm - yNorm),
      b: 200 * (yNorm - zNorm),
    };
  }
}

export { PerceptualDiffComparator, PerceptualDiffOptions };
```

---

## Playwright Visual Testing

### Configuration

```typescript
// playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  
  // Snapshot configuration
  snapshotDir: './e2e/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
  
  expect: {
    // Visual comparison settings
    toHaveScreenshot: {
      // Maximum allowed pixel difference
      maxDiffPixels: 100,
      
      // Maximum allowed percentage difference
      maxDiffPixelRatio: 0.01,
      
      // Threshold for pixel comparison (0-1)
      threshold: 0.2,
      
      // Animation handling
      animations: 'disabled',
      
      // Caret blinking
      caret: 'hide',
      
      // Scale factor
      scale: 'css',
    },
    
    toMatchSnapshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Consistent viewport for snapshots
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],
});
```

### Visual Test Examples

```typescript
// e2e/visual/homepage.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Homepage Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('full page screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
    });
  });

  test('above the fold screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('homepage-above-fold.png');
  });

  test('hero section screenshot', async ({ page }) => {
    const hero = page.locator('[data-testid="hero-section"]');
    await expect(hero).toHaveScreenshot('hero-section.png');
  });

  test('navigation screenshot', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav).toHaveScreenshot('navigation.png');
  });

  test('footer screenshot', async ({ page }) => {
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveScreenshot('footer.png');
  });

  test('responsive screenshots', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-large' },
      { width: 1280, height: 720, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(100); // Allow layout to settle
      await expect(page).toHaveScreenshot(`homepage-${viewport.name}.png`);
    }
  });
});
```

### Component Visual Tests

```typescript
// e2e/visual/components.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Component Visual Tests', () => {
  test('button variants', async ({ page }) => {
    await page.goto('/components/button');

    const variants = ['primary', 'secondary', 'outline', 'ghost', 'destructive'];
    
    for (const variant of variants) {
      const button = page.locator(`[data-testid="button-${variant}"]`);
      await expect(button).toHaveScreenshot(`button-${variant}.png`);
    }
  });

  test('button states', async ({ page }) => {
    await page.goto('/components/button');

    const button = page.locator('[data-testid="button-primary"]');

    // Default state
    await expect(button).toHaveScreenshot('button-default.png');

    // Hover state
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');

    // Focus state
    await button.focus();
    await expect(button).toHaveScreenshot('button-focus.png');

    // Active state
    await button.click({ force: true, noWaitAfter: true });
    await expect(button).toHaveScreenshot('button-active.png');
  });

  test('form components', async ({ page }) => {
    await page.goto('/components/form');

    // Input states
    const input = page.locator('[data-testid="input-default"]');
    await expect(input).toHaveScreenshot('input-empty.png');

    await input.fill('Hello World');
    await expect(input).toHaveScreenshot('input-filled.png');

    // Error state
    const errorInput = page.locator('[data-testid="input-error"]');
    await expect(errorInput).toHaveScreenshot('input-error.png');

    // Disabled state
    const disabledInput = page.locator('[data-testid="input-disabled"]');
    await expect(disabledInput).toHaveScreenshot('input-disabled.png');
  });

  test('card component', async ({ page }) => {
    await page.goto('/components/card');

    const card = page.locator('[data-testid="card-default"]');
    await expect(card).toHaveScreenshot('card-default.png');

    // Card with image
    const cardWithImage = page.locator('[data-testid="card-with-image"]');
    await expect(cardWithImage).toHaveScreenshot('card-with-image.png');
  });

  test('modal component', async ({ page }) => {
    await page.goto('/components/modal');

    // Open modal
    await page.click('[data-testid="open-modal-button"]');
    await page.waitForSelector('[data-testid="modal"]');

    // Screenshot of modal
    const modal = page.locator('[data-testid="modal"]');
    await expect(modal).toHaveScreenshot('modal-open.png');

    // Full page with modal overlay
    await expect(page).toHaveScreenshot('modal-overlay.png');
  });
});
```

### Masking Dynamic Content

```typescript
// e2e/visual/dynamic-content.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Dynamic Content Visual Tests', () => {
  test('mask dynamic elements', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveScreenshot('dashboard.png', {
      mask: [
        page.locator('[data-testid="timestamp"]'),
        page.locator('[data-testid="user-avatar"]'),
        page.locator('[data-testid="random-id"]'),
        page.locator('.animated-element'),
      ],
      maskColor: '#FF00FF', // Magenta mask
    });
  });

  test('hide dynamic content with CSS', async ({ page }) => {
    await page.goto('/dashboard');

    // Add CSS to hide dynamic content
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="user-avatar"],
        .loading-spinner {
          visibility: hidden !important;
        }
      `,
    });

    await expect(page).toHaveScreenshot('dashboard-static.png');
  });

  test('replace dynamic content', async ({ page }) => {
    await page.goto('/dashboard');

    // Replace dynamic text with static text
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"]').forEach(el => {
        el.textContent = '2024-01-01 00:00:00';
      });
      
      document.querySelectorAll('[data-testid="random-id"]').forEach(el => {
        el.textContent = 'ID-12345';
      });
    });

    await expect(page).toHaveScreenshot('dashboard-normalized.png');
  });

  test('wait for animations', async ({ page }) => {
    await page.goto('/animated-page');

    // Wait for animations to complete
    await page.waitForFunction(() => {
      const animations = document.getAnimations();
      return animations.every(a => a.playState === 'finished');
    });

    await expect(page).toHaveScreenshot('animated-page-complete.png');
  });

  test('disable animations', async ({ page }) => {
    // Disable all animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    await page.goto('/animated-page');
    await expect(page).toHaveScreenshot('animated-page-static.png');
  });
});
```

---

## Storybook Integration

### Storybook Configuration

```typescript
// .storybook/main.ts

import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
};

export default config;
```

### Story with Visual Tests

```typescript
// src/components/Button/Button.stories.tsx

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    // Chromatic configuration
    chromatic: {
      viewports: [320, 768, 1200],
      delay: 300,
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive Button',
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

// All variants
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
  parameters: {
    chromatic: {
      // Capture all variants in one snapshot
      disableSnapshot: false,
    },
  },
};

// States
export const States: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Button>Default</Button>
      <Button disabled>Disabled</Button>
      <Button className="hover">Hover (simulated)</Button>
      <Button className="focus">Focus (simulated)</Button>
    </div>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <Button>
        <span>→</span> Next
      </Button>
      <Button>
        <span>←</span> Previous
      </Button>
      <Button>
        <span>+</span> Add
      </Button>
    </div>
  ),
};

// Loading state
export const Loading: Story = {
  args: {
    children: 'Loading...',
    disabled: true,
  },
  render: (args) => (
    <Button {...args}>
      <span className="animate-spin">⟳</span>
      Loading...
    </Button>
  ),
};
```

### Storybook Test Runner

```typescript
// .storybook/test-runner.ts

import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  
  async postVisit(page, context) {
    // Wait for fonts to load
    await page.waitForFunction(() => document.fonts.ready);
    
    // Wait for images to load
    await page.waitForFunction(() => {
      const images = Array.from(document.images);
      return images.every(img => img.complete);
    });

    // Take screenshot
    const image = await page.screenshot();
    
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir: `${process.cwd()}/__snapshots__`,
      customSnapshotIdentifier: context.id,
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  },
};

export default config;
```

### Running Storybook Visual Tests

```bash
# Build Storybook
pnpm build-storybook

# Run test runner
pnpm test-storybook

# Run with specific stories
pnpm test-storybook --stories="**/Button.stories.tsx"

# Update snapshots
pnpm test-storybook --updateSnapshot

# Run in CI
pnpm test-storybook --ci
```

---

## Percy Integration

### Percy Configuration

```yaml
# percy.yml

version: 2
snapshot:
  widths:
    - 375
    - 768
    - 1280
  min-height: 1024
  percy-css: |
    /* Hide dynamic content */
    [data-percy-hide] {
      visibility: hidden !important;
    }
    /* Disable animations */
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }

discovery:
  allowed-hostnames:
    - localhost
    - fonts.googleapis.com
    - fonts.gstatic.com
  network-idle-timeout: 250
  disable-cache: true

upload:
  files: '**/*.{png,jpg,jpeg}'
  ignore: '**/node_modules/**'
```

### Percy with Playwright

```typescript
// e2e/visual/percy.spec.ts

import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Percy Visual Tests', () => {
  test('homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await percySnapshot(page, 'Homepage');
  });

  test('homepage responsive', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await percySnapshot(page, 'Homepage', {
      widths: [375, 768, 1280, 1920],
    });
  });

  test('component states', async ({ page }) => {
    await page.goto('/components/button');

    // Default state
    await percySnapshot(page, 'Button - Default');

    // Hover state
    await page.hover('[data-testid="button-primary"]');
    await percySnapshot(page, 'Button - Hover');

    // Focus state
    await page.focus('[data-testid="button-primary"]');
    await percySnapshot(page, 'Button - Focus');
  });

  test('dark mode', async ({ page }) => {
    await page.goto('/');
    
    // Light mode
    await percySnapshot(page, 'Homepage - Light Mode');

    // Toggle dark mode
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(100);
    
    await percySnapshot(page, 'Homepage - Dark Mode');
  });

  test('with Percy CSS', async ({ page }) => {
    await page.goto('/dashboard');
    
    await percySnapshot(page, 'Dashboard', {
      percyCSS: `
        [data-testid="timestamp"] { visibility: hidden; }
        [data-testid="avatar"] { visibility: hidden; }
        .loading { display: none; }
      `,
    });
  });
});
```

### Percy with Storybook

```typescript
// .storybook/percy.config.ts

import { percySnapshot } from '@percy/storybook';

export default {
  // Stories to include
  include: [
    'Components/**',
    'Pages/**',
  ],
  
  // Stories to exclude
  exclude: [
    '**/Docs',
    '**/*-disabled',
  ],
  
  // Global Percy options
  args: {
    widths: [375, 768, 1280],
  },
  
  // Per-story overrides
  storyArgs: {
    'Components/Button--all-variants': {
      waitForSelector: '.button',
    },
    'Components/Modal--open': {
      waitForTimeout: 500,
    },
  },
};
```

### Percy CI Integration

```yaml
# .github/workflows/percy.yml

name: Percy Visual Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  percy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      
      - name: Build application
        run: pnpm build
      
      - name: Start server
        run: pnpm preview &
        
      - name: Wait for server
        run: npx wait-on http://localhost:4173
      
      - name: Run Percy tests
        run: pnpm exec percy exec -- pnpm test:e2e:visual
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

---

## Chromatic Integration

### Chromatic Configuration

```javascript
// chromatic.config.js

module.exports = {
  projectToken: process.env.CHROMATIC_PROJECT_TOKEN,
  
  // Build options
  buildScriptName: 'build-storybook',
  outputDir: 'storybook-static',
  
  // Snapshot options
  delay: 300,
  diffThreshold: 0.063,
  
  // CI options
  exitZeroOnChanges: true,
  exitOnceUploaded: false,
  
  // Skip options
  skip: 'dependabot/**',
  
  // Only changed stories
  onlyChanged: true,
  
  // External snapshots
  externals: ['public/**'],
  
  // Viewports
  viewports: [320, 768, 1200],
};
```

### Chromatic Story Configuration

```typescript
// src/components/Card/Card.stories.tsx

import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    chromatic: {
      // Capture at multiple viewports
      viewports: [320, 768, 1200],
      
      // Delay before capture
      delay: 300,
      
      // Diff threshold
      diffThreshold: 0.063,
      
      // Disable for specific stories
      // disableSnapshot: true,
      
      // Pause animations
      pauseAnimationAtEnd: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Card Title',
    description: 'Card description text',
  },
};

export const WithImage: Story = {
  args: {
    title: 'Card with Image',
    description: 'This card has an image',
    image: '/placeholder.jpg',
  },
  parameters: {
    chromatic: {
      // Wait for image to load
      delay: 500,
    },
  },
};

export const Interactive: Story = {
  args: {
    title: 'Interactive Card',
    onClick: () => {},
  },
  parameters: {
    chromatic: {
      // Capture hover state
      modes: {
        hover: {
          hover: '[data-testid="card"]',
        },
      },
    },
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
  parameters: {
    chromatic: {
      // Disable snapshot for loading state
      disableSnapshot: true,
    },
  },
};
```

### Chromatic CI Integration

```yaml
# .github/workflows/chromatic.yml

name: Chromatic

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for Chromatic
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Publish to Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          buildScriptName: build-storybook
          onlyChanged: true
          exitZeroOnChanges: true
```

---

## Custom Visual Testing

### Custom Visual Test Framework

```typescript
// src/visual/VisualTestFramework.ts

import { chromium, Browser, Page } from 'playwright';
import { PixelDiffComparator } from './comparison/pixelDiff';
import { BaselineManager } from './baseline/BaselineManager';
import { ReportGenerator } from './reporting/ReportGenerator';

interface VisualTestConfig {
  baselineDir: string;
  outputDir: string;
  threshold: number;
  viewports: { width: number; height: number; name: string }[];
  browsers: ('chromium' | 'firefox' | 'webkit')[];
}

interface VisualTestResult {
  name: string;
  viewport: string;
  browser: string;
  passed: boolean;
  diffPercentage: number;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
}

class VisualTestFramework {
  private config: VisualTestConfig;
  private comparator: PixelDiffComparator;
  private baselineManager: BaselineManager;
  private reportGenerator: ReportGenerator;
  private results: VisualTestResult[] = [];

  constructor(config: VisualTestConfig) {
    this.config = config;
    this.comparator = new PixelDiffComparator({ threshold: config.threshold });
    this.baselineManager = new BaselineManager(config.baselineDir);
    this.reportGenerator = new ReportGenerator(config.outputDir);
  }

  async runTests(tests: VisualTest[]): Promise<VisualTestResult[]> {
    for (const browserType of this.config.browsers) {
      const browser = await this.launchBrowser(browserType);
      
      try {
        for (const viewport of this.config.viewports) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
          });
          const page = await context.newPage();

          for (const test of tests) {
            const result = await this.runTest(test, page, viewport.name, browserType);
            this.results.push(result);
          }

          await context.close();
        }
      } finally {
        await browser.close();
      }
    }

    await this.reportGenerator.generate(this.results);
    return this.results;
  }

  private async launchBrowser(type: string): Promise<Browser> {
    const playwright = require('playwright');
    return playwright[type].launch();
  }

  private async runTest(
    test: VisualTest,
    page: Page,
    viewport: string,
    browser: string
  ): Promise<VisualTestResult> {
    const testName = `${test.name}-${viewport}-${browser}`;
    
    // Navigate and setup
    await page.goto(test.url);
    if (test.setup) {
      await test.setup(page);
    }

    // Wait for stability
    await page.waitForLoadState('networkidle');
    if (test.waitFor) {
      await page.waitForSelector(test.waitFor);
    }

    // Apply masks
    if (test.masks) {
      for (const mask of test.masks) {
        await page.evaluate((selector) => {
          document.querySelectorAll(selector).forEach(el => {
            (el as HTMLElement).style.visibility = 'hidden';
          });
        }, mask);
      }
    }

    // Capture screenshot
    const element = test.selector ? page.locator(test.selector) : page;
    const screenshot = await (element as any).screenshot();

    // Compare with baseline
    const baselinePath = this.baselineManager.getPath(testName);
    const baseline = await this.baselineManager.load(testName);

    if (!baseline) {
      // No baseline, save current as baseline
      await this.baselineManager.save(testName, screenshot);
      return {
        name: test.name,
        viewport,
        browser,
        passed: true,
        diffPercentage: 0,
        baselinePath,
        currentPath: baselinePath,
      };
    }

    const comparison = await this.comparator.compare(baseline, screenshot);
    
    // Save current and diff
    const currentPath = `${this.config.outputDir}/${testName}-current.png`;
    const diffPath = `${this.config.outputDir}/${testName}-diff.png`;
    
    await fs.writeFile(currentPath, screenshot);
    if (comparison.diffImage) {
      await fs.writeFile(diffPath, comparison.diffImage);
    }

    return {
      name: test.name,
      viewport,
      browser,
      passed: comparison.match,
      diffPercentage: comparison.diffPercentage,
      baselinePath,
      currentPath,
      diffPath: comparison.diffImage ? diffPath : undefined,
    };
  }
}

interface VisualTest {
  name: string;
  url: string;
  selector?: string;
  setup?: (page: Page) => Promise<void>;
  waitFor?: string;
  masks?: string[];
}

export { VisualTestFramework, VisualTestConfig, VisualTest, VisualTestResult };
```

### Using Custom Framework

```typescript
// visual-tests/run.ts

import { VisualTestFramework, VisualTest } from '../src/visual/VisualTestFramework';

const config = {
  baselineDir: './visual-tests/__baselines__',
  outputDir: './visual-tests/__output__',
  threshold: 0.1,
  viewports: [
    { width: 1280, height: 720, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 375, height: 667, name: 'mobile' },
  ],
  browsers: ['chromium'] as const,
};

const tests: VisualTest[] = [
  {
    name: 'homepage',
    url: 'http://localhost:3000',
    masks: ['[data-testid="timestamp"]', '[data-testid="avatar"]'],
  },
  {
    name: 'login-page',
    url: 'http://localhost:3000/login',
  },
  {
    name: 'dashboard',
    url: 'http://localhost:3000/dashboard',
    setup: async (page) => {
      // Login first
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'password');
      await page.click('[type="submit"]');
      await page.waitForURL('**/dashboard');
    },
    masks: ['.user-avatar', '.timestamp', '.notification-count'],
  },
  {
    name: 'button-component',
    url: 'http://localhost:6006/iframe.html?id=components-button--primary',
    selector: '#storybook-root',
  },
];

async function run() {
  const framework = new VisualTestFramework(config);
  const results = await framework.runTests(tests);
  
  const failed = results.filter(r => !r.passed);
  
  if (failed.length > 0) {
    console.log(`\n❌ ${failed.length} visual tests failed:`);
    for (const result of failed) {
      console.log(`  - ${result.name} (${result.viewport}/${result.browser}): ${result.diffPercentage.toFixed(2)}% diff`);
    }
    process.exit(1);
  }
  
  console.log(`\n✅ All ${results.length} visual tests passed`);
}

run().catch(console.error);
```

---

## Baseline Management

### Baseline Manager

```typescript
// src/visual/baseline/BaselineManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface BaselineMetadata {
  hash: string;
  createdAt: string;
  updatedAt: string;
  browser: string;
  viewport: string;
}

class BaselineManager {
  private baselineDir: string;
  private metadataFile: string;
  private metadata: Map<string, BaselineMetadata> = new Map();

  constructor(baselineDir: string) {
    this.baselineDir = baselineDir;
    this.metadataFile = path.join(baselineDir, 'metadata.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.baselineDir, { recursive: true });
    
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.metadata = new Map(Object.entries(parsed));
    } catch {
      // No metadata file yet
    }
  }

  getPath(name: string): string {
    return path.join(this.baselineDir, `${name}.png`);
  }

  async load(name: string): Promise<Buffer | null> {
    const filePath = this.getPath(name);
    
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async save(name: string, image: Buffer, meta?: Partial<BaselineMetadata>): Promise<void> {
    const filePath = this.getPath(name);
    await fs.writeFile(filePath, image);

    const hash = crypto.createHash('sha256').update(image).digest('hex');
    const now = new Date().toISOString();

    this.metadata.set(name, {
      hash,
      createdAt: this.metadata.get(name)?.createdAt || now,
      updatedAt: now,
      browser: meta?.browser || 'unknown',
      viewport: meta?.viewport || 'unknown',
    });

    await this.saveMetadata();
  }

  async update(name: string, image: Buffer): Promise<void> {
    const existing = this.metadata.get(name);
    await this.save(name, image, existing);
  }

  async delete(name: string): Promise<void> {
    const filePath = this.getPath(name);
    
    try {
      await fs.unlink(filePath);
      this.metadata.delete(name);
      await this.saveMetadata();
    } catch {
      // File doesn't exist
    }
  }

  async list(): Promise<string[]> {
    const files = await fs.readdir(this.baselineDir);
    return files
      .filter(f => f.endsWith('.png'))
      .map(f => f.replace('.png', ''));
  }

  async getMetadata(name: string): Promise<BaselineMetadata | undefined> {
    return this.metadata.get(name);
  }

  async verify(name: string, image: Buffer): Promise<boolean> {
    const meta = this.metadata.get(name);
    if (!meta) return false;

    const hash = crypto.createHash('sha256').update(image).digest('hex');
    return hash === meta.hash;
  }

  private async saveMetadata(): Promise<void> {
    const data = Object.fromEntries(this.metadata);
    await fs.writeFile(this.metadataFile, JSON.stringify(data, null, 2));
  }

  // Cleanup orphaned baselines
  async cleanup(): Promise<string[]> {
    const files = await this.list();
    const orphaned: string[] = [];

    for (const file of files) {
      if (!this.metadata.has(file)) {
        orphaned.push(file);
        await this.delete(file);
      }
    }

    return orphaned;
  }
}

export { BaselineManager, BaselineMetadata };
```

### Git LFS for Baselines

```bash
# .gitattributes

# Track visual test baselines with Git LFS
**/visual-tests/__baselines__/*.png filter=lfs diff=lfs merge=lfs -text
**/__snapshots__/*.png filter=lfs diff=lfs merge=lfs -text
**/screenshots/*.png filter=lfs diff=lfs merge=lfs -text
```

### Baseline Update Script

```typescript
// scripts/update-baselines.ts

import { BaselineManager } from '../src/visual/baseline/BaselineManager';
import { VisualTestFramework } from '../src/visual/VisualTestFramework';
import * as readline from 'readline';

async function updateBaselines() {
  const baselineManager = new BaselineManager('./visual-tests/__baselines__');
  await baselineManager.initialize();

  const args = process.argv.slice(2);
  const updateAll = args.includes('--all');
  const pattern = args.find(a => a.startsWith('--pattern='))?.split('=')[1];

  // Get list of baselines to update
  let baselines = await baselineManager.list();
  
  if (pattern) {
    const regex = new RegExp(pattern);
    baselines = baselines.filter(b => regex.test(b));
  }

  if (baselines.length === 0) {
    console.log('No baselines to update');
    return;
  }

  console.log(`Found ${baselines.length} baselines to update:`);
  baselines.forEach(b => console.log(`  - ${b}`));

  if (!updateAll) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>(resolve => {
      rl.question('\nUpdate all baselines? (y/N) ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Cancelled');
      return;
    }
  }

  // Run visual tests and update baselines
  const framework = new VisualTestFramework({
    baselineDir: './visual-tests/__baselines__',
    outputDir: './visual-tests/__output__',
    threshold: 0.1,
    viewports: [{ width: 1280, height: 720, name: 'desktop' }],
    browsers: ['chromium'],
  });

  console.log('\nCapturing new baselines...');
  
  // This would run the tests and save new baselines
  // Implementation depends on your test setup

  console.log('\n✅ Baselines updated');
}

updateBaselines().catch(console.error);
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/visual-tests.yml

name: Visual Regression Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true  # Fetch LFS files (baselines)
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      
      - name: Build application
        run: pnpm build
      
      - name: Start server
        run: pnpm preview &
      
      - name: Wait for server
        run: npx wait-on http://localhost:4173
      
      - name: Run visual tests
        run: pnpm test:visual
      
      - name: Upload diff artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diff
          path: |
            visual-tests/__output__/
            playwright-report/
          retention-days: 7
      
      - name: Comment on PR
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            
            // Read diff results
            const results = JSON.parse(
              fs.readFileSync('visual-tests/__output__/results.json', 'utf-8')
            );
            
            const failed = results.filter(r => !r.passed);
            
            let body = '## ❌ Visual Regression Tests Failed\n\n';
            body += `${failed.length} visual differences detected:\n\n`;
            
            for (const result of failed) {
              body += `- **${result.name}** (${result.viewport}): ${result.diffPercentage.toFixed(2)}% diff\n`;
            }
            
            body += '\n[View full report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})';
            
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body,
            });

  update-baselines:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'update-baselines')
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
          ref: ${{ github.head_ref }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      
      - name: Build application
        run: pnpm build
      
      - name: Update baselines
        run: pnpm test:visual:update
      
      - name: Commit updated baselines
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add visual-tests/__baselines__/
          git commit -m "chore: update visual baselines" || exit 0
          git push
```

---

## Diff Analysis

### Diff Report Generator

```typescript
// src/visual/reporting/DiffReportGenerator.ts

interface DiffReport {
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    new: number;
  };
  results: DiffResult[];
}

interface DiffResult {
  name: string;
  status: 'passed' | 'failed' | 'new';
  diffPercentage: number;
  baseline: string;
  current: string;
  diff?: string;
  viewport: string;
  browser: string;
}

class DiffReportGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generate(results: VisualTestResult[]): Promise<void> {
    const report: DiffReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed && r.diffPercentage > 0).length,
        new: results.filter(r => !r.passed && r.diffPercentage === 0).length,
      },
      results: results.map(r => ({
        name: r.name,
        status: r.passed ? 'passed' : (r.diffPercentage > 0 ? 'failed' : 'new'),
        diffPercentage: r.diffPercentage,
        baseline: r.baselinePath,
        current: r.currentPath,
        diff: r.diffPath,
        viewport: r.viewport,
        browser: r.browser,
      })),
    };

    // Save JSON report
    await fs.writeFile(
      path.join(this.outputDir, 'results.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate HTML report
    await this.generateHtmlReport(report);
  }

  private async generateHtmlReport(report: DiffReport): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Regression Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
    .stats { display: flex; gap: 20px; margin-top: 20px; }
    .stat { background: rgba(255,255,255,0.1); padding: 15px 25px; border-radius: 6px; }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat.passed .stat-value { color: #4ade80; }
    .stat.failed .stat-value { color: #f87171; }
    .stat.new .stat-value { color: #60a5fa; }
    .results { display: grid; gap: 20px; }
    .result { background: white; border-radius: 8px; overflow: hidden; }
    .result-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
    .result-status { width: 12px; height: 12px; border-radius: 50%; }
    .result-status.passed { background: #4ade80; }
    .result-status.failed { background: #f87171; }
    .result-status.new { background: #60a5fa; }
    .result-name { font-weight: 600; flex: 1; }
    .result-meta { color: #666; font-size: 14px; }
    .result-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 20px; }
    .result-image { text-align: center; }
    .result-image img { max-width: 100%; border: 1px solid #eee; border-radius: 4px; }
    .result-image-label { font-size: 12px; color: #666; margin-top: 5px; }
    .slider-container { padding: 20px; }
    .slider { position: relative; overflow: hidden; }
    .slider img { width: 100%; }
    .slider-overlay { position: absolute; top: 0; left: 0; width: 50%; height: 100%; overflow: hidden; border-right: 2px solid #f87171; }
    .slider-overlay img { width: 200%; max-width: none; }
    .slider-handle { position: absolute; top: 0; bottom: 0; width: 40px; left: calc(50% - 20px); cursor: ew-resize; display: flex; align-items: center; justify-content: center; }
    .slider-handle::before { content: ''; width: 4px; height: 40px; background: #f87171; border-radius: 2px; }
    .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; }
    .filter-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #e5e5e5; }
    .filter-btn.active { background: #1a1a2e; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Visual Regression Report</h1>
      <p>Generated at ${report.timestamp}</p>
      <div class="stats">
        <div class="stat passed">
          <div class="stat-value">${report.summary.passed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat failed">
          <div class="stat-value">${report.summary.failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat new">
          <div class="stat-value">${report.summary.new}</div>
          <div class="stat-label">New</div>
        </div>
      </div>
    </div>
    
    <div class="filter-bar">
      <button class="filter-btn active" data-filter="all">All (${report.summary.total})</button>
      <button class="filter-btn" data-filter="passed">Passed (${report.summary.passed})</button>
      <button class="filter-btn" data-filter="failed">Failed (${report.summary.failed})</button>
      <button class="filter-btn" data-filter="new">New (${report.summary.new})</button>
    </div>
    
    <div class="results">
      ${report.results.map(r => this.renderResult(r)).join('')}
    </div>
  </div>
  
  <script>
    // Filter functionality
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.result').forEach(result => {
          if (filter === 'all' || result.dataset.status === filter) {
            result.style.display = 'block';
          } else {
            result.style.display = 'none';
          }
        });
      });
    });
    
    // Slider functionality
    document.querySelectorAll('.slider').forEach(slider => {
      const handle = slider.querySelector('.slider-handle');
      const overlay = slider.querySelector('.slider-overlay');
      
      let isDragging = false;
      
      handle.addEventListener('mousedown', () => isDragging = true);
      document.addEventListener('mouseup', () => isDragging = false);
      
      slider.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = slider.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        
        overlay.style.width = percent + '%';
        handle.style.left = 'calc(' + percent + '% - 20px)';
      });
    });
  </script>
</body>
</html>
    `;

    await fs.writeFile(path.join(this.outputDir, 'report.html'), html);
  }

  private renderResult(result: DiffResult): string {
    if (result.status === 'passed') {
      return `
        <div class="result" data-status="passed">
          <div class="result-header">
            <div class="result-status passed"></div>
            <div class="result-name">${result.name}</div>
            <div class="result-meta">${result.viewport} / ${result.browser}</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="result" data-status="${result.status}">
        <div class="result-header">
          <div class="result-status ${result.status}"></div>
          <div class="result-name">${result.name}</div>
          <div class="result-meta">
            ${result.viewport} / ${result.browser}
            ${result.diffPercentage > 0 ? ` - ${result.diffPercentage.toFixed(2)}% diff` : ''}
          </div>
        </div>
        
        ${result.diff ? `
          <div class="slider-container">
            <div class="slider">
              <img src="${result.current}" alt="Current">
              <div class="slider-overlay">
                <img src="${result.baseline}" alt="Baseline">
              </div>
              <div class="slider-handle"></div>
            </div>
          </div>
        ` : ''}
        
        <div class="result-images">
          <div class="result-image">
            <img src="${result.baseline}" alt="Baseline">
            <div class="result-image-label">Baseline</div>
          </div>
          <div class="result-image">
            <img src="${result.current}" alt="Current">
            <div class="result-image-label">Current</div>
          </div>
          ${result.diff ? `
            <div class="result-image">
              <img src="${result.diff}" alt="Diff">
              <div class="result-image-label">Diff</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

export { DiffReportGenerator, DiffReport, DiffResult };
```

---

## Best Practices

### Visual Testing Guidelines

| Practice | Description |
|----------|-------------|
| **Stable selectors** | Use data-testid attributes |
| **Consistent environment** | Same browser, viewport, fonts |
| **Mask dynamic content** | Hide timestamps, avatars, ads |
| **Disable animations** | Prevent flaky tests |
| **Wait for stability** | Network idle, fonts loaded |
| **Meaningful names** | Descriptive snapshot names |

### Threshold Configuration

| Content Type | Recommended Threshold |
|--------------|----------------------|
| **Text-heavy** | 0.01 (1%) |
| **Images** | 0.05 (5%) |
| **Charts/graphs** | 0.1 (10%) |
| **Animations** | 0.2 (20%) or mask |

### CI/CD Best Practices

| Practice | Implementation |
|----------|----------------|
| **Run on PRs** | Catch regressions early |
| **Parallel execution** | Speed up test runs |
| **Artifact storage** | Save diffs for review |
| **PR comments** | Notify on failures |
| **Baseline updates** | Label-triggered workflow |

---

## Summary

### Tool Comparison

| Tool | Type | Pricing | Features |
|------|------|---------|----------|
| **Playwright** | Built-in | Free | Local snapshots, CI integration |
| **Percy** | Cloud | Paid | Cross-browser, review UI |
| **Chromatic** | Cloud | Paid | Storybook-focused, UI review |
| **Custom** | Self-hosted | Free | Full control |

### Quick Reference

```bash
# Playwright visual tests
pnpm test:visual                    # Run visual tests
pnpm test:visual --update-snapshots # Update baselines

# Percy
pnpm exec percy exec -- pnpm test:e2e:visual

# Chromatic
pnpm exec chromatic --project-token=xxx

# Storybook test runner
pnpm test-storybook
pnpm test-storybook --updateSnapshot
```

### Recommended Setup

1. **Component level**: Storybook + Chromatic
2. **Page level**: Playwright visual tests
3. **E2E flows**: Percy or Playwright
4. **CI/CD**: GitHub Actions with artifact storage
