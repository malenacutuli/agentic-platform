# Editor Customization and Settings

This guide provides comprehensive coverage of editor customization capabilities, including theme selection, keybindings, editor configuration, and settings persistence in cloud development environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Settings Architecture](#settings-architecture)
3. [Theme System](#theme-system)
4. [Keybindings](#keybindings)
5. [Editor Configuration](#editor-configuration)
6. [Settings Persistence](#settings-persistence)
7. [Settings Sync](#settings-sync)
8. [User Preferences API](#user-preferences-api)
9. [Workspace Settings](#workspace-settings)
10. [Settings Migration](#settings-migration)
11. [Default Configurations](#default-configurations)
12. [Best Practices](#best-practices)

---

## Overview

Editor customization allows users to personalize their development environment to match their preferences and workflows. The settings system must handle persistence across sessions, synchronization across devices, and workspace-specific overrides.

### Customization Layers

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SETTINGS HIERARCHY                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  PRIORITY 1: Workspace Settings (Highest)                                        │   │
│  │  Location: .vscode/settings.json                                                 │   │
│  │  Scope: Current project only                                                     │   │
│  │                                                                                   │   │
│  │  Example: { "editor.tabSize": 4, "python.formatting.provider": "black" }        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  PRIORITY 2: User Settings                                                       │   │
│  │  Location: ~/.config/Code/User/settings.json                                     │   │
│  │  Scope: All projects for this user                                               │   │
│  │                                                                                   │   │
│  │  Example: { "editor.fontSize": 14, "workbench.colorTheme": "One Dark Pro" }     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │  PRIORITY 3: Default Settings (Lowest)                                           │   │
│  │  Location: Built into editor                                                     │   │
│  │  Scope: All users                                                                │   │
│  │                                                                                   │   │
│  │  Example: { "editor.fontSize": 12, "editor.tabSize": 4 }                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Customization Categories

| Category | Examples | Persistence |
|----------|----------|-------------|
| **Visual** | Themes, fonts, colors | User settings |
| **Behavior** | Tab size, auto-save, formatting | User/Workspace |
| **Keybindings** | Shortcuts, key mappings | User settings |
| **Language** | Formatters, linters, LSP | Workspace settings |
| **Extensions** | Extension settings | User/Workspace |

---

## Settings Architecture

### Settings Service Implementation

```typescript
// src/settings/settingsService.ts

import { EventEmitter } from 'events';

interface SettingsScope {
  default: Record<string, any>;
  user: Record<string, any>;
  workspace: Record<string, any>;
}

interface SettingDefinition {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default: any;
  description: string;
  scope: 'user' | 'workspace' | 'resource';
  enum?: any[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  deprecationMessage?: string;
}

interface SettingsChangeEvent {
  affectedKeys: string[];
  source: 'user' | 'workspace' | 'default';
}

class SettingsService extends EventEmitter {
  private scopes: SettingsScope;
  private definitions: Map<string, SettingDefinition> = new Map();
  private storage: SettingsStorage;

  constructor(storage: SettingsStorage) {
    super();
    this.storage = storage;
    this.scopes = {
      default: {},
      user: {},
      workspace: {},
    };
  }

  // Initialize settings
  async initialize(): Promise<void> {
    // Load default settings
    this.scopes.default = await this.loadDefaultSettings();
    
    // Load user settings
    this.scopes.user = await this.storage.loadUserSettings();
    
    // Load workspace settings
    this.scopes.workspace = await this.storage.loadWorkspaceSettings();
  }

  // Get setting value (with hierarchy)
  get<T>(key: string, defaultValue?: T): T {
    // Check workspace first
    if (this.hasKey(this.scopes.workspace, key)) {
      return this.getNestedValue(this.scopes.workspace, key);
    }

    // Check user settings
    if (this.hasKey(this.scopes.user, key)) {
      return this.getNestedValue(this.scopes.user, key);
    }

    // Check default settings
    if (this.hasKey(this.scopes.default, key)) {
      return this.getNestedValue(this.scopes.default, key);
    }

    // Return provided default
    return defaultValue as T;
  }

  // Set setting value
  async set(key: string, value: any, scope: 'user' | 'workspace' = 'user'): Promise<void> {
    const definition = this.definitions.get(key);
    
    // Validate value
    if (definition && !this.validateValue(value, definition)) {
      throw new Error(`Invalid value for setting ${key}`);
    }

    // Update scope
    this.setNestedValue(this.scopes[scope], key, value);

    // Persist
    if (scope === 'user') {
      await this.storage.saveUserSettings(this.scopes.user);
    } else {
      await this.storage.saveWorkspaceSettings(this.scopes.workspace);
    }

    // Emit change event
    this.emit('change', {
      affectedKeys: [key],
      source: scope,
    } as SettingsChangeEvent);
  }

  // Remove setting
  async remove(key: string, scope: 'user' | 'workspace' = 'user'): Promise<void> {
    this.removeNestedValue(this.scopes[scope], key);

    if (scope === 'user') {
      await this.storage.saveUserSettings(this.scopes.user);
    } else {
      await this.storage.saveWorkspaceSettings(this.scopes.workspace);
    }

    this.emit('change', {
      affectedKeys: [key],
      source: scope,
    } as SettingsChangeEvent);
  }

  // Get all settings for a section
  getSection(section: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, definition] of this.definitions) {
      if (key.startsWith(section + '.')) {
        const subKey = key.substring(section.length + 1);
        result[subKey] = this.get(key, definition.default);
      }
    }

    return result;
  }

  // Register setting definition
  registerSetting(definition: SettingDefinition): void {
    this.definitions.set(definition.key, definition);
    
    // Set default value
    if (definition.default !== undefined) {
      this.setNestedValue(this.scopes.default, definition.key, definition.default);
    }
  }

  // Get setting definition
  getDefinition(key: string): SettingDefinition | undefined {
    return this.definitions.get(key);
  }

  // Get all definitions
  getAllDefinitions(): SettingDefinition[] {
    return Array.from(this.definitions.values());
  }

  // Validate setting value
  private validateValue(value: any, definition: SettingDefinition): boolean {
    // Type check
    if (definition.type === 'string' && typeof value !== 'string') return false;
    if (definition.type === 'number' && typeof value !== 'number') return false;
    if (definition.type === 'boolean' && typeof value !== 'boolean') return false;
    if (definition.type === 'array' && !Array.isArray(value)) return false;
    if (definition.type === 'object' && typeof value !== 'object') return false;

    // Enum check
    if (definition.enum && !definition.enum.includes(value)) return false;

    // Range check
    if (definition.type === 'number') {
      if (definition.minimum !== undefined && value < definition.minimum) return false;
      if (definition.maximum !== undefined && value > definition.maximum) return false;
    }

    // Pattern check
    if (definition.pattern && typeof value === 'string') {
      const regex = new RegExp(definition.pattern);
      if (!regex.test(value)) return false;
    }

    return true;
  }

  private hasKey(obj: Record<string, any>, key: string): boolean {
    const parts = key.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null) return false;
      if (!(part in current)) return false;
      current = current[part];
    }
    
    return true;
  }

  private getNestedValue(obj: Record<string, any>, key: string): any {
    const parts = key.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    
    return current;
  }

  private setNestedValue(obj: Record<string, any>, key: string, value: any): void {
    const parts = key.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private removeNestedValue(obj: Record<string, any>, key: string): void {
    const parts = key.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) return;
      current = current[part];
    }
    
    delete current[parts[parts.length - 1]];
  }

  private async loadDefaultSettings(): Promise<Record<string, any>> {
    const defaults: Record<string, any> = {};
    
    for (const [key, definition] of this.definitions) {
      if (definition.default !== undefined) {
        this.setNestedValue(defaults, key, definition.default);
      }
    }
    
    return defaults;
  }
}

// Settings Storage Interface
interface SettingsStorage {
  loadUserSettings(): Promise<Record<string, any>>;
  saveUserSettings(settings: Record<string, any>): Promise<void>;
  loadWorkspaceSettings(): Promise<Record<string, any>>;
  saveWorkspaceSettings(settings: Record<string, any>): Promise<void>;
}

export { SettingsService, SettingDefinition, SettingsStorage, SettingsChangeEvent };
```

### Database Schema for Settings

```sql
-- Settings persistence schema

-- User settings table
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Workspace settings table
CREATE TABLE workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    settings_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id)
);

-- Settings history for audit
CREATE TABLE settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    workspace_id UUID REFERENCES workspaces(id),
    setting_key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_user_settings_user ON user_settings(user_id);
CREATE INDEX idx_workspace_settings_workspace ON workspace_settings(workspace_id);
CREATE INDEX idx_settings_history_user ON settings_history(user_id);
CREATE INDEX idx_settings_history_workspace ON settings_history(workspace_id);
CREATE INDEX idx_settings_history_key ON settings_history(setting_key);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_settings_timestamp();

CREATE TRIGGER workspace_settings_updated
    BEFORE UPDATE ON workspace_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_settings_timestamp();
```

---

## Theme System

### Theme Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              THEME SYSTEM ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            THEME DEFINITION                                      │   │
│  │                                                                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │   │
│  │  │  Color Theme    │  │  Icon Theme     │  │  Product Theme  │                  │   │
│  │  │                 │  │                 │  │                 │                  │   │
│  │  │  - Editor       │  │  - File icons   │  │  - UI colors    │                  │   │
│  │  │  - Syntax       │  │  - Folder icons │  │  - Fonts        │                  │   │
│  │  │  - UI colors    │  │  - Symbol icons │  │  - Spacing      │                  │   │
│  │  │                 │  │                 │  │                 │                  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            THEME SERVICE                                         │   │
│  │                                                                                   │   │
│  │  - Load themes from extensions                                                   │   │
│  │  - Apply theme to editor                                                         │   │
│  │  - Generate CSS variables                                                        │   │
│  │  - Handle theme switching                                                        │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                                         ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            CSS VARIABLES                                         │   │
│  │                                                                                   │   │
│  │  --vscode-editor-background: #1e1e1e;                                           │   │
│  │  --vscode-editor-foreground: #d4d4d4;                                           │   │
│  │  --vscode-activityBar-background: #333333;                                      │   │
│  │  ...                                                                             │   │
│  │                                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Theme Service Implementation

```typescript
// src/settings/themes/themeService.ts

interface ColorTheme {
  id: string;
  name: string;
  type: 'light' | 'dark' | 'hc' | 'hcLight';
  colors: Record<string, string>;
  tokenColors: TokenColor[];
  semanticHighlighting?: boolean;
  semanticTokenColors?: Record<string, string>;
}

interface TokenColor {
  name?: string;
  scope: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

interface IconTheme {
  id: string;
  name: string;
  iconDefinitions: Record<string, { iconPath: string }>;
  file: string;
  folder: string;
  folderExpanded: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  languageIds: Record<string, string>;
}

class ThemeService {
  private colorThemes: Map<string, ColorTheme> = new Map();
  private iconThemes: Map<string, IconTheme> = new Map();
  private currentColorTheme: ColorTheme | null = null;
  private currentIconTheme: IconTheme | null = null;
  private settingsService: SettingsService;

  constructor(settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  // Initialize themes
  async initialize(): Promise<void> {
    // Load built-in themes
    await this.loadBuiltInThemes();

    // Load extension themes
    await this.loadExtensionThemes();

    // Apply saved theme
    const savedColorTheme = this.settingsService.get<string>('workbench.colorTheme', 'Default Dark+');
    const savedIconTheme = this.settingsService.get<string>('workbench.iconTheme', 'vs-seti');

    await this.setColorTheme(savedColorTheme);
    await this.setIconTheme(savedIconTheme);
  }

  // Register color theme
  registerColorTheme(theme: ColorTheme): void {
    this.colorThemes.set(theme.id, theme);
  }

  // Register icon theme
  registerIconTheme(theme: IconTheme): void {
    this.iconThemes.set(theme.id, theme);
  }

  // Get available color themes
  getColorThemes(): ColorTheme[] {
    return Array.from(this.colorThemes.values());
  }

  // Get available icon themes
  getIconThemes(): IconTheme[] {
    return Array.from(this.iconThemes.values());
  }

  // Set color theme
  async setColorTheme(themeId: string): Promise<void> {
    const theme = this.colorThemes.get(themeId);
    if (!theme) {
      console.warn(`Theme not found: ${themeId}`);
      return;
    }

    this.currentColorTheme = theme;

    // Apply theme
    this.applyColorTheme(theme);

    // Save preference
    await this.settingsService.set('workbench.colorTheme', themeId);
  }

  // Set icon theme
  async setIconTheme(themeId: string): Promise<void> {
    const theme = this.iconThemes.get(themeId);
    if (!theme) {
      console.warn(`Icon theme not found: ${themeId}`);
      return;
    }

    this.currentIconTheme = theme;

    // Apply theme
    this.applyIconTheme(theme);

    // Save preference
    await this.settingsService.set('workbench.iconTheme', themeId);
  }

  // Get current color theme
  getCurrentColorTheme(): ColorTheme | null {
    return this.currentColorTheme;
  }

  // Get current icon theme
  getCurrentIconTheme(): IconTheme | null {
    return this.currentIconTheme;
  }

  // Apply color theme
  private applyColorTheme(theme: ColorTheme): void {
    // Generate CSS variables
    const cssVariables = this.generateCSSVariables(theme);

    // Apply to document
    const style = document.getElementById('theme-colors') || document.createElement('style');
    style.id = 'theme-colors';
    style.textContent = `:root { ${cssVariables} }`;
    
    if (!document.getElementById('theme-colors')) {
      document.head.appendChild(style);
    }

    // Set body class for theme type
    document.body.classList.remove('vscode-light', 'vscode-dark', 'vscode-high-contrast');
    switch (theme.type) {
      case 'light':
        document.body.classList.add('vscode-light');
        break;
      case 'dark':
        document.body.classList.add('vscode-dark');
        break;
      case 'hc':
      case 'hcLight':
        document.body.classList.add('vscode-high-contrast');
        break;
    }

    // Apply token colors to Monaco
    this.applyTokenColors(theme);
  }

  // Generate CSS variables from theme
  private generateCSSVariables(theme: ColorTheme): string {
    const variables: string[] = [];

    for (const [key, value] of Object.entries(theme.colors)) {
      const cssKey = `--vscode-${key.replace(/\./g, '-')}`;
      variables.push(`${cssKey}: ${value};`);
    }

    return variables.join('\n');
  }

  // Apply token colors to Monaco editor
  private applyTokenColors(theme: ColorTheme): void {
    // Convert VS Code token colors to Monaco theme
    const monacoTheme = {
      base: theme.type === 'light' ? 'vs' : 'vs-dark',
      inherit: true,
      rules: theme.tokenColors.map(tc => {
        const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope];
        return scopes.map(scope => ({
          token: scope,
          foreground: tc.settings.foreground?.replace('#', ''),
          background: tc.settings.background?.replace('#', ''),
          fontStyle: tc.settings.fontStyle,
        }));
      }).flat(),
      colors: theme.colors,
    };

    // Define Monaco theme
    monaco.editor.defineTheme(theme.id, monacoTheme as any);
    monaco.editor.setTheme(theme.id);
  }

  // Apply icon theme
  private applyIconTheme(theme: IconTheme): void {
    // Generate icon CSS
    const iconCSS = this.generateIconCSS(theme);

    const style = document.getElementById('theme-icons') || document.createElement('style');
    style.id = 'theme-icons';
    style.textContent = iconCSS;
    
    if (!document.getElementById('theme-icons')) {
      document.head.appendChild(style);
    }
  }

  // Generate icon CSS
  private generateIconCSS(theme: IconTheme): string {
    const rules: string[] = [];

    // Default file icon
    rules.push(`.file-icon { background-image: url('${theme.iconDefinitions[theme.file]?.iconPath}'); }`);

    // Default folder icon
    rules.push(`.folder-icon { background-image: url('${theme.iconDefinitions[theme.folder]?.iconPath}'); }`);
    rules.push(`.folder-icon.expanded { background-image: url('${theme.iconDefinitions[theme.folderExpanded]?.iconPath}'); }`);

    // File extension icons
    for (const [ext, iconId] of Object.entries(theme.fileExtensions)) {
      const icon = theme.iconDefinitions[iconId];
      if (icon) {
        rules.push(`.file-icon[data-ext="${ext}"] { background-image: url('${icon.iconPath}'); }`);
      }
    }

    // File name icons
    for (const [name, iconId] of Object.entries(theme.fileNames)) {
      const icon = theme.iconDefinitions[iconId];
      if (icon) {
        rules.push(`.file-icon[data-name="${name}"] { background-image: url('${icon.iconPath}'); }`);
      }
    }

    // Language icons
    for (const [lang, iconId] of Object.entries(theme.languageIds)) {
      const icon = theme.iconDefinitions[iconId];
      if (icon) {
        rules.push(`.file-icon[data-lang="${lang}"] { background-image: url('${icon.iconPath}'); }`);
      }
    }

    return rules.join('\n');
  }

  // Load built-in themes
  private async loadBuiltInThemes(): Promise<void> {
    // Default Dark+
    this.registerColorTheme({
      id: 'Default Dark+',
      name: 'Dark+ (default dark)',
      type: 'dark',
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'activityBar.background': '#333333',
        'activityBar.foreground': '#ffffff',
        'sideBar.background': '#252526',
        'sideBar.foreground': '#cccccc',
        'statusBar.background': '#007acc',
        'statusBar.foreground': '#ffffff',
        'titleBar.activeBackground': '#3c3c3c',
        'titleBar.activeForeground': '#cccccc',
        // ... more colors
      },
      tokenColors: [
        { scope: 'comment', settings: { foreground: '#6A9955' } },
        { scope: 'keyword', settings: { foreground: '#569CD6' } },
        { scope: 'string', settings: { foreground: '#CE9178' } },
        { scope: 'number', settings: { foreground: '#B5CEA8' } },
        { scope: 'variable', settings: { foreground: '#9CDCFE' } },
        { scope: 'function', settings: { foreground: '#DCDCAA' } },
        { scope: 'type', settings: { foreground: '#4EC9B0' } },
        // ... more token colors
      ],
    });

    // Default Light+
    this.registerColorTheme({
      id: 'Default Light+',
      name: 'Light+ (default light)',
      type: 'light',
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'activityBar.background': '#2c2c2c',
        'activityBar.foreground': '#ffffff',
        'sideBar.background': '#f3f3f3',
        'sideBar.foreground': '#6f6f6f',
        'statusBar.background': '#007acc',
        'statusBar.foreground': '#ffffff',
        'titleBar.activeBackground': '#dddddd',
        'titleBar.activeForeground': '#333333',
        // ... more colors
      },
      tokenColors: [
        { scope: 'comment', settings: { foreground: '#008000' } },
        { scope: 'keyword', settings: { foreground: '#0000FF' } },
        { scope: 'string', settings: { foreground: '#A31515' } },
        { scope: 'number', settings: { foreground: '#098658' } },
        { scope: 'variable', settings: { foreground: '#001080' } },
        { scope: 'function', settings: { foreground: '#795E26' } },
        { scope: 'type', settings: { foreground: '#267F99' } },
        // ... more token colors
      ],
    });
  }

  // Load themes from extensions
  private async loadExtensionThemes(): Promise<void> {
    // This would load themes from installed extensions
    // Implementation depends on extension system
  }
}

export { ThemeService, ColorTheme, IconTheme, TokenColor };
```

### Popular Theme Configurations

```typescript
// src/settings/themes/popularThemes.ts

// One Dark Pro theme
const oneDarkPro: ColorTheme = {
  id: 'one-dark-pro',
  name: 'One Dark Pro',
  type: 'dark',
  colors: {
    'editor.background': '#282c34',
    'editor.foreground': '#abb2bf',
    'activityBar.background': '#282c34',
    'activityBar.foreground': '#d7dae0',
    'sideBar.background': '#21252b',
    'sideBar.foreground': '#abb2bf',
    'statusBar.background': '#21252b',
    'statusBar.foreground': '#9da5b4',
    'tab.activeBackground': '#282c34',
    'tab.inactiveBackground': '#21252b',
    'editorLineNumber.foreground': '#495162',
    'editorLineNumber.activeForeground': '#abb2bf',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#5c6370', fontStyle: 'italic' } },
    { scope: 'keyword', settings: { foreground: '#c678dd' } },
    { scope: 'string', settings: { foreground: '#98c379' } },
    { scope: 'number', settings: { foreground: '#d19a66' } },
    { scope: 'variable', settings: { foreground: '#e06c75' } },
    { scope: 'function', settings: { foreground: '#61afef' } },
    { scope: 'type', settings: { foreground: '#e5c07b' } },
    { scope: 'class', settings: { foreground: '#e5c07b' } },
    { scope: 'constant', settings: { foreground: '#d19a66' } },
  ],
};

// Dracula theme
const dracula: ColorTheme = {
  id: 'dracula',
  name: 'Dracula',
  type: 'dark',
  colors: {
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'activityBar.background': '#343746',
    'activityBar.foreground': '#f8f8f2',
    'sideBar.background': '#21222c',
    'sideBar.foreground': '#f8f8f2',
    'statusBar.background': '#191a21',
    'statusBar.foreground': '#f8f8f2',
    'tab.activeBackground': '#282a36',
    'tab.inactiveBackground': '#21222c',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#6272a4' } },
    { scope: 'keyword', settings: { foreground: '#ff79c6' } },
    { scope: 'string', settings: { foreground: '#f1fa8c' } },
    { scope: 'number', settings: { foreground: '#bd93f9' } },
    { scope: 'variable', settings: { foreground: '#f8f8f2' } },
    { scope: 'function', settings: { foreground: '#50fa7b' } },
    { scope: 'type', settings: { foreground: '#8be9fd', fontStyle: 'italic' } },
  ],
};

// GitHub Dark theme
const githubDark: ColorTheme = {
  id: 'github-dark',
  name: 'GitHub Dark',
  type: 'dark',
  colors: {
    'editor.background': '#0d1117',
    'editor.foreground': '#c9d1d9',
    'activityBar.background': '#161b22',
    'activityBar.foreground': '#c9d1d9',
    'sideBar.background': '#010409',
    'sideBar.foreground': '#c9d1d9',
    'statusBar.background': '#161b22',
    'statusBar.foreground': '#8b949e',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#8b949e' } },
    { scope: 'keyword', settings: { foreground: '#ff7b72' } },
    { scope: 'string', settings: { foreground: '#a5d6ff' } },
    { scope: 'number', settings: { foreground: '#79c0ff' } },
    { scope: 'variable', settings: { foreground: '#ffa657' } },
    { scope: 'function', settings: { foreground: '#d2a8ff' } },
    { scope: 'type', settings: { foreground: '#79c0ff' } },
  ],
};

export { oneDarkPro, dracula, githubDark };
```

---

## Keybindings

### Keybinding Service

```typescript
// src/settings/keybindings/keybindingService.ts

interface Keybinding {
  key: string;
  command: string;
  when?: string;
  args?: any;
}

interface KeybindingItem extends Keybinding {
  source: 'default' | 'user' | 'extension';
  extensionId?: string;
}

interface KeyCombo {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
}

class KeybindingService {
  private keybindings: KeybindingItem[] = [];
  private userKeybindings: Keybinding[] = [];
  private commandService: CommandService;
  private contextService: ContextService;
  private storage: SettingsStorage;

  constructor(
    commandService: CommandService,
    contextService: ContextService,
    storage: SettingsStorage
  ) {
    this.commandService = commandService;
    this.contextService = contextService;
    this.storage = storage;
  }

  // Initialize keybindings
  async initialize(): Promise<void> {
    // Load default keybindings
    this.loadDefaultKeybindings();

    // Load user keybindings
    this.userKeybindings = await this.storage.loadKeybindings();
    this.applyUserKeybindings();

    // Set up keyboard listener
    this.setupKeyboardListener();
  }

  // Register keybinding
  registerKeybinding(keybinding: Keybinding, source: 'default' | 'extension', extensionId?: string): void {
    this.keybindings.push({
      ...keybinding,
      source,
      extensionId,
    });
  }

  // Set user keybinding
  async setUserKeybinding(keybinding: Keybinding): Promise<void> {
    // Remove existing binding for this key
    this.userKeybindings = this.userKeybindings.filter(
      kb => kb.key !== keybinding.key || kb.when !== keybinding.when
    );

    // Add new binding
    this.userKeybindings.push(keybinding);

    // Save
    await this.storage.saveKeybindings(this.userKeybindings);

    // Apply
    this.applyUserKeybindings();
  }

  // Remove user keybinding
  async removeUserKeybinding(key: string, when?: string): Promise<void> {
    this.userKeybindings = this.userKeybindings.filter(
      kb => kb.key !== key || kb.when !== when
    );

    await this.storage.saveKeybindings(this.userKeybindings);
    this.applyUserKeybindings();
  }

  // Get all keybindings
  getAllKeybindings(): KeybindingItem[] {
    return [...this.keybindings];
  }

  // Get keybindings for command
  getKeybindingsForCommand(command: string): KeybindingItem[] {
    return this.keybindings.filter(kb => kb.command === command);
  }

  // Get command for key
  getCommandForKey(key: string, when?: string): string | null {
    // Find matching keybinding (user bindings take priority)
    const binding = this.keybindings
      .filter(kb => kb.key === key)
      .filter(kb => !kb.when || this.evaluateWhen(kb.when))
      .sort((a, b) => {
        // User bindings first
        if (a.source === 'user' && b.source !== 'user') return -1;
        if (b.source === 'user' && a.source !== 'user') return 1;
        return 0;
      })[0];

    return binding?.command || null;
  }

  // Parse key string to KeyCombo
  parseKey(keyString: string): KeyCombo {
    const parts = keyString.toLowerCase().split('+');
    
    return {
      ctrlKey: parts.includes('ctrl') || parts.includes('cmd'),
      shiftKey: parts.includes('shift'),
      altKey: parts.includes('alt'),
      metaKey: parts.includes('meta') || parts.includes('cmd'),
      key: parts[parts.length - 1],
    };
  }

  // Format KeyCombo to string
  formatKey(combo: KeyCombo): string {
    const parts: string[] = [];
    
    if (combo.ctrlKey) parts.push('Ctrl');
    if (combo.shiftKey) parts.push('Shift');
    if (combo.altKey) parts.push('Alt');
    if (combo.metaKey) parts.push('Meta');
    parts.push(combo.key.toUpperCase());
    
    return parts.join('+');
  }

  // Set up keyboard listener
  private setupKeyboardListener(): void {
    document.addEventListener('keydown', (event) => {
      const combo: KeyCombo = {
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        key: event.key.toLowerCase(),
      };

      const keyString = this.formatKey(combo);
      const command = this.getCommandForKey(keyString);

      if (command) {
        event.preventDefault();
        event.stopPropagation();
        
        const binding = this.keybindings.find(kb => kb.command === command);
        this.commandService.executeCommand(command, binding?.args);
      }
    });
  }

  // Evaluate when clause
  private evaluateWhen(when: string): boolean {
    return this.contextService.evaluate(when);
  }

  // Load default keybindings
  private loadDefaultKeybindings(): void {
    const defaults: Keybinding[] = [
      // File operations
      { key: 'Ctrl+S', command: 'workbench.action.files.save' },
      { key: 'Ctrl+Shift+S', command: 'workbench.action.files.saveAs' },
      { key: 'Ctrl+N', command: 'workbench.action.files.newUntitledFile' },
      { key: 'Ctrl+O', command: 'workbench.action.files.openFile' },
      { key: 'Ctrl+W', command: 'workbench.action.closeActiveEditor' },
      
      // Edit operations
      { key: 'Ctrl+Z', command: 'undo' },
      { key: 'Ctrl+Y', command: 'redo' },
      { key: 'Ctrl+Shift+Z', command: 'redo' },
      { key: 'Ctrl+X', command: 'editor.action.clipboardCutAction' },
      { key: 'Ctrl+C', command: 'editor.action.clipboardCopyAction' },
      { key: 'Ctrl+V', command: 'editor.action.clipboardPasteAction' },
      { key: 'Ctrl+A', command: 'editor.action.selectAll' },
      { key: 'Ctrl+D', command: 'editor.action.addSelectionToNextFindMatch' },
      
      // Find/Replace
      { key: 'Ctrl+F', command: 'actions.find' },
      { key: 'Ctrl+H', command: 'editor.action.startFindReplaceAction' },
      { key: 'Ctrl+Shift+F', command: 'workbench.action.findInFiles' },
      { key: 'Ctrl+Shift+H', command: 'workbench.action.replaceInFiles' },
      
      // Navigation
      { key: 'Ctrl+G', command: 'workbench.action.gotoLine' },
      { key: 'Ctrl+P', command: 'workbench.action.quickOpen' },
      { key: 'Ctrl+Shift+P', command: 'workbench.action.showCommands' },
      { key: 'Ctrl+Shift+O', command: 'workbench.action.gotoSymbol' },
      { key: 'F12', command: 'editor.action.revealDefinition' },
      { key: 'Alt+F12', command: 'editor.action.peekDefinition' },
      { key: 'Shift+F12', command: 'editor.action.goToReferences' },
      
      // Editor
      { key: 'Ctrl+/', command: 'editor.action.commentLine' },
      { key: 'Ctrl+Shift+/', command: 'editor.action.blockComment' },
      { key: 'Alt+Up', command: 'editor.action.moveLinesUpAction' },
      { key: 'Alt+Down', command: 'editor.action.moveLinesDownAction' },
      { key: 'Shift+Alt+Up', command: 'editor.action.copyLinesUpAction' },
      { key: 'Shift+Alt+Down', command: 'editor.action.copyLinesDownAction' },
      { key: 'Ctrl+Shift+K', command: 'editor.action.deleteLines' },
      { key: 'Ctrl+Enter', command: 'editor.action.insertLineAfter' },
      { key: 'Ctrl+Shift+Enter', command: 'editor.action.insertLineBefore' },
      
      // Formatting
      { key: 'Shift+Alt+F', command: 'editor.action.formatDocument' },
      { key: 'Ctrl+K Ctrl+F', command: 'editor.action.formatSelection' },
      
      // View
      { key: 'Ctrl+B', command: 'workbench.action.toggleSidebarVisibility' },
      { key: 'Ctrl+J', command: 'workbench.action.togglePanel' },
      { key: 'Ctrl+`', command: 'workbench.action.terminal.toggleTerminal' },
      { key: 'Ctrl+Shift+E', command: 'workbench.view.explorer' },
      { key: 'Ctrl+Shift+G', command: 'workbench.view.scm' },
      { key: 'Ctrl+Shift+D', command: 'workbench.view.debug' },
      { key: 'Ctrl+Shift+X', command: 'workbench.view.extensions' },
      
      // Multi-cursor
      { key: 'Ctrl+Alt+Up', command: 'editor.action.insertCursorAbove' },
      { key: 'Ctrl+Alt+Down', command: 'editor.action.insertCursorBelow' },
      { key: 'Ctrl+Shift+L', command: 'editor.action.selectHighlights' },
      
      // Folding
      { key: 'Ctrl+Shift+[', command: 'editor.fold' },
      { key: 'Ctrl+Shift+]', command: 'editor.unfold' },
      { key: 'Ctrl+K Ctrl+0', command: 'editor.foldAll' },
      { key: 'Ctrl+K Ctrl+J', command: 'editor.unfoldAll' },
      
      // Tabs
      { key: 'Ctrl+Tab', command: 'workbench.action.nextEditor' },
      { key: 'Ctrl+Shift+Tab', command: 'workbench.action.previousEditor' },
      { key: 'Ctrl+1', command: 'workbench.action.openEditorAtIndex1' },
      { key: 'Ctrl+2', command: 'workbench.action.openEditorAtIndex2' },
      { key: 'Ctrl+3', command: 'workbench.action.openEditorAtIndex3' },
      
      // Split editor
      { key: 'Ctrl+\\', command: 'workbench.action.splitEditor' },
      { key: 'Ctrl+K Ctrl+\\', command: 'workbench.action.splitEditorOrthogonal' },
    ];

    for (const keybinding of defaults) {
      this.registerKeybinding(keybinding, 'default');
    }
  }

  // Apply user keybindings
  private applyUserKeybindings(): void {
    // Remove existing user bindings
    this.keybindings = this.keybindings.filter(kb => kb.source !== 'user');

    // Add user bindings
    for (const keybinding of this.userKeybindings) {
      this.registerKeybinding(keybinding, 'user');
    }
  }
}

export { KeybindingService, Keybinding, KeybindingItem, KeyCombo };
```

### Keymap Presets

```typescript
// src/settings/keybindings/keymapPresets.ts

interface KeymapPreset {
  id: string;
  name: string;
  description: string;
  keybindings: Keybinding[];
}

// Vim keymap
const vimKeymap: KeymapPreset = {
  id: 'vim',
  name: 'Vim',
  description: 'Vim-style keybindings',
  keybindings: [
    // Normal mode
    { key: 'i', command: 'vim.enterInsertMode', when: 'vim.mode == "Normal"' },
    { key: 'a', command: 'vim.enterInsertModeAfter', when: 'vim.mode == "Normal"' },
    { key: 'o', command: 'vim.insertLineBelow', when: 'vim.mode == "Normal"' },
    { key: 'O', command: 'vim.insertLineAbove', when: 'vim.mode == "Normal"' },
    { key: 'h', command: 'vim.left', when: 'vim.mode == "Normal"' },
    { key: 'j', command: 'vim.down', when: 'vim.mode == "Normal"' },
    { key: 'k', command: 'vim.up', when: 'vim.mode == "Normal"' },
    { key: 'l', command: 'vim.right', when: 'vim.mode == "Normal"' },
    { key: 'w', command: 'vim.wordForward', when: 'vim.mode == "Normal"' },
    { key: 'b', command: 'vim.wordBackward', when: 'vim.mode == "Normal"' },
    { key: 'gg', command: 'vim.gotoFirstLine', when: 'vim.mode == "Normal"' },
    { key: 'G', command: 'vim.gotoLastLine', when: 'vim.mode == "Normal"' },
    { key: 'dd', command: 'vim.deleteLine', when: 'vim.mode == "Normal"' },
    { key: 'yy', command: 'vim.yankLine', when: 'vim.mode == "Normal"' },
    { key: 'p', command: 'vim.paste', when: 'vim.mode == "Normal"' },
    { key: 'u', command: 'undo', when: 'vim.mode == "Normal"' },
    { key: 'Ctrl+r', command: 'redo', when: 'vim.mode == "Normal"' },
    { key: '/', command: 'vim.search', when: 'vim.mode == "Normal"' },
    { key: 'n', command: 'vim.searchNext', when: 'vim.mode == "Normal"' },
    { key: 'N', command: 'vim.searchPrevious', when: 'vim.mode == "Normal"' },
    
    // Visual mode
    { key: 'v', command: 'vim.enterVisualMode', when: 'vim.mode == "Normal"' },
    { key: 'V', command: 'vim.enterVisualLineMode', when: 'vim.mode == "Normal"' },
    { key: 'Ctrl+v', command: 'vim.enterVisualBlockMode', when: 'vim.mode == "Normal"' },
    
    // Escape to normal mode
    { key: 'Escape', command: 'vim.enterNormalMode', when: 'vim.mode != "Normal"' },
    { key: 'Ctrl+[', command: 'vim.enterNormalMode', when: 'vim.mode != "Normal"' },
  ],
};

// Sublime Text keymap
const sublimeKeymap: KeymapPreset = {
  id: 'sublime',
  name: 'Sublime Text',
  description: 'Sublime Text-style keybindings',
  keybindings: [
    { key: 'Ctrl+Shift+D', command: 'editor.action.copyLinesDownAction' },
    { key: 'Ctrl+Shift+K', command: 'editor.action.deleteLines' },
    { key: 'Ctrl+L', command: 'expandLineSelection' },
    { key: 'Ctrl+Shift+L', command: 'editor.action.insertCursorAtEndOfEachLineSelected' },
    { key: 'Ctrl+J', command: 'editor.action.joinLines' },
    { key: 'Ctrl+K Ctrl+K', command: 'deleteAllRight' },
    { key: 'Ctrl+K Ctrl+Backspace', command: 'deleteAllLeft' },
    { key: 'Ctrl+Shift+Up', command: 'editor.action.moveLinesUpAction' },
    { key: 'Ctrl+Shift+Down', command: 'editor.action.moveLinesDownAction' },
    { key: 'Ctrl+M', command: 'editor.action.jumpToBracket' },
    { key: 'Ctrl+Shift+M', command: 'editor.action.selectToBracket' },
    { key: 'Ctrl+K Ctrl+U', command: 'editor.action.transformToUppercase' },
    { key: 'Ctrl+K Ctrl+L', command: 'editor.action.transformToLowercase' },
  ],
};

// IntelliJ IDEA keymap
const intellijKeymap: KeymapPreset = {
  id: 'intellij',
  name: 'IntelliJ IDEA',
  description: 'IntelliJ IDEA-style keybindings',
  keybindings: [
    { key: 'Ctrl+Y', command: 'editor.action.deleteLines' },
    { key: 'Ctrl+D', command: 'editor.action.copyLinesDownAction' },
    { key: 'Ctrl+Shift+U', command: 'editor.action.transformToUppercase' },
    { key: 'Alt+Enter', command: 'editor.action.quickFix' },
    { key: 'Ctrl+Alt+L', command: 'editor.action.formatDocument' },
    { key: 'Ctrl+Alt+O', command: 'editor.action.organizeImports' },
    { key: 'Ctrl+Shift+F', command: 'workbench.action.findInFiles' },
    { key: 'Ctrl+Shift+R', command: 'workbench.action.replaceInFiles' },
    { key: 'Ctrl+N', command: 'workbench.action.gotoSymbol' },
    { key: 'Ctrl+Shift+N', command: 'workbench.action.quickOpen' },
    { key: 'Alt+Insert', command: 'editor.action.sourceAction' },
    { key: 'Ctrl+Alt+T', command: 'editor.action.surroundWith' },
    { key: 'Shift+F6', command: 'editor.action.rename' },
    { key: 'Ctrl+B', command: 'editor.action.revealDefinition' },
    { key: 'Ctrl+Alt+B', command: 'editor.action.goToImplementation' },
  ],
};

export { vimKeymap, sublimeKeymap, intellijKeymap, KeymapPreset };
```

---

## Editor Configuration

### Editor Settings Definitions

```typescript
// src/settings/editor/editorSettings.ts

const editorSettingsDefinitions: SettingDefinition[] = [
  // Font settings
  {
    key: 'editor.fontFamily',
    type: 'string',
    default: "'Fira Code', 'Consolas', 'Courier New', monospace",
    description: 'Controls the font family.',
    scope: 'user',
  },
  {
    key: 'editor.fontSize',
    type: 'number',
    default: 14,
    description: 'Controls the font size in pixels.',
    scope: 'user',
    minimum: 6,
    maximum: 100,
  },
  {
    key: 'editor.fontWeight',
    type: 'string',
    default: 'normal',
    description: 'Controls the font weight.',
    scope: 'user',
    enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
  },
  {
    key: 'editor.fontLigatures',
    type: 'boolean',
    default: true,
    description: 'Enables/Disables font ligatures.',
    scope: 'user',
  },
  {
    key: 'editor.lineHeight',
    type: 'number',
    default: 0,
    description: 'Controls the line height. Use 0 to compute from font size.',
    scope: 'user',
    minimum: 0,
    maximum: 150,
  },
  {
    key: 'editor.letterSpacing',
    type: 'number',
    default: 0,
    description: 'Controls the letter spacing in pixels.',
    scope: 'user',
    minimum: -5,
    maximum: 20,
  },

  // Tab settings
  {
    key: 'editor.tabSize',
    type: 'number',
    default: 4,
    description: 'The number of spaces a tab is equal to.',
    scope: 'resource',
    minimum: 1,
    maximum: 8,
  },
  {
    key: 'editor.insertSpaces',
    type: 'boolean',
    default: true,
    description: 'Insert spaces when pressing Tab.',
    scope: 'resource',
  },
  {
    key: 'editor.detectIndentation',
    type: 'boolean',
    default: true,
    description: 'Controls whether tabSize and insertSpaces will be automatically detected.',
    scope: 'resource',
  },

  // Cursor settings
  {
    key: 'editor.cursorStyle',
    type: 'string',
    default: 'line',
    description: 'Controls the cursor style.',
    scope: 'user',
    enum: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
  },
  {
    key: 'editor.cursorBlinking',
    type: 'string',
    default: 'blink',
    description: 'Controls the cursor animation style.',
    scope: 'user',
    enum: ['blink', 'smooth', 'phase', 'expand', 'solid'],
  },
  {
    key: 'editor.cursorWidth',
    type: 'number',
    default: 2,
    description: 'Controls the width of the cursor when cursorStyle is set to line.',
    scope: 'user',
    minimum: 1,
    maximum: 10,
  },
  {
    key: 'editor.cursorSmoothCaretAnimation',
    type: 'string',
    default: 'off',
    description: 'Controls whether the smooth caret animation should be enabled.',
    scope: 'user',
    enum: ['off', 'explicit', 'on'],
  },

  // Display settings
  {
    key: 'editor.lineNumbers',
    type: 'string',
    default: 'on',
    description: 'Controls the display of line numbers.',
    scope: 'user',
    enum: ['off', 'on', 'relative', 'interval'],
  },
  {
    key: 'editor.renderWhitespace',
    type: 'string',
    default: 'selection',
    description: 'Controls how the editor should render whitespace characters.',
    scope: 'user',
    enum: ['none', 'boundary', 'selection', 'trailing', 'all'],
  },
  {
    key: 'editor.renderControlCharacters',
    type: 'boolean',
    default: true,
    description: 'Controls whether the editor should render control characters.',
    scope: 'user',
  },
  {
    key: 'editor.renderIndentGuides',
    type: 'boolean',
    default: true,
    description: 'Controls whether the editor should render indent guides.',
    scope: 'user',
  },
  {
    key: 'editor.highlightActiveIndentGuide',
    type: 'boolean',
    default: true,
    description: 'Controls whether the editor should highlight the active indent guide.',
    scope: 'user',
  },
  {
    key: 'editor.renderLineHighlight',
    type: 'string',
    default: 'line',
    description: 'Controls how the editor should render the current line highlight.',
    scope: 'user',
    enum: ['none', 'gutter', 'line', 'all'],
  },

  // Minimap settings
  {
    key: 'editor.minimap.enabled',
    type: 'boolean',
    default: true,
    description: 'Controls whether the minimap is shown.',
    scope: 'user',
  },
  {
    key: 'editor.minimap.side',
    type: 'string',
    default: 'right',
    description: 'Controls the side where to render the minimap.',
    scope: 'user',
    enum: ['left', 'right'],
  },
  {
    key: 'editor.minimap.maxColumn',
    type: 'number',
    default: 120,
    description: 'Limit the width of the minimap to render at most a certain number of columns.',
    scope: 'user',
    minimum: 1,
    maximum: 300,
  },
  {
    key: 'editor.minimap.renderCharacters',
    type: 'boolean',
    default: true,
    description: 'Render the actual characters on a line as opposed to color blocks.',
    scope: 'user',
  },

  // Scrolling settings
  {
    key: 'editor.scrollBeyondLastLine',
    type: 'boolean',
    default: true,
    description: 'Controls whether the editor will scroll beyond the last line.',
    scope: 'user',
  },
  {
    key: 'editor.smoothScrolling',
    type: 'boolean',
    default: false,
    description: 'Controls whether the editor will scroll using an animation.',
    scope: 'user',
  },
  {
    key: 'editor.mouseWheelScrollSensitivity',
    type: 'number',
    default: 1,
    description: 'A multiplier to be used on the deltaX and deltaY of mouse wheel scroll events.',
    scope: 'user',
    minimum: 0.1,
    maximum: 10,
  },

  // Word wrap settings
  {
    key: 'editor.wordWrap',
    type: 'string',
    default: 'off',
    description: 'Controls how lines should wrap.',
    scope: 'resource',
    enum: ['off', 'on', 'wordWrapColumn', 'bounded'],
  },
  {
    key: 'editor.wordWrapColumn',
    type: 'number',
    default: 80,
    description: 'Controls the wrapping column of the editor when wordWrap is wordWrapColumn or bounded.',
    scope: 'resource',
    minimum: 1,
    maximum: 500,
  },
  {
    key: 'editor.wrappingIndent',
    type: 'string',
    default: 'same',
    description: 'Controls the indentation of wrapped lines.',
    scope: 'user',
    enum: ['none', 'same', 'indent', 'deepIndent'],
  },

  // Auto-features
  {
    key: 'editor.autoClosingBrackets',
    type: 'string',
    default: 'languageDefined',
    description: 'Controls whether the editor should automatically close brackets.',
    scope: 'user',
    enum: ['always', 'languageDefined', 'beforeWhitespace', 'never'],
  },
  {
    key: 'editor.autoClosingQuotes',
    type: 'string',
    default: 'languageDefined',
    description: 'Controls whether the editor should automatically close quotes.',
    scope: 'user',
    enum: ['always', 'languageDefined', 'beforeWhitespace', 'never'],
  },
  {
    key: 'editor.autoIndent',
    type: 'string',
    default: 'full',
    description: 'Controls whether the editor should automatically adjust the indentation.',
    scope: 'user',
    enum: ['none', 'keep', 'brackets', 'advanced', 'full'],
  },
  {
    key: 'editor.autoSurround',
    type: 'string',
    default: 'languageDefined',
    description: 'Controls whether the editor should automatically surround selections.',
    scope: 'user',
    enum: ['languageDefined', 'quotes', 'brackets', 'never'],
  },
  {
    key: 'editor.formatOnSave',
    type: 'boolean',
    default: false,
    description: 'Format a file on save.',
    scope: 'resource',
  },
  {
    key: 'editor.formatOnPaste',
    type: 'boolean',
    default: false,
    description: 'Controls whether the editor should automatically format the pasted content.',
    scope: 'user',
  },
  {
    key: 'editor.formatOnType',
    type: 'boolean',
    default: false,
    description: 'Controls whether the editor should automatically format the line after typing.',
    scope: 'user',
  },

  // IntelliSense settings
  {
    key: 'editor.quickSuggestions',
    type: 'object',
    default: { other: true, comments: false, strings: false },
    description: 'Controls whether suggestions should automatically show up while typing.',
    scope: 'user',
  },
  {
    key: 'editor.quickSuggestionsDelay',
    type: 'number',
    default: 10,
    description: 'Controls the delay in milliseconds after which quick suggestions will show up.',
    scope: 'user',
    minimum: 0,
    maximum: 1000,
  },
  {
    key: 'editor.suggestOnTriggerCharacters',
    type: 'boolean',
    default: true,
    description: 'Controls whether suggestions should automatically show up when typing trigger characters.',
    scope: 'user',
  },
  {
    key: 'editor.acceptSuggestionOnEnter',
    type: 'string',
    default: 'on',
    description: 'Controls whether suggestions should be accepted on Enter.',
    scope: 'user',
    enum: ['on', 'smart', 'off'],
  },
  {
    key: 'editor.acceptSuggestionOnCommitCharacter',
    type: 'boolean',
    default: true,
    description: 'Controls whether suggestions should be accepted on commit characters.',
    scope: 'user',
  },
  {
    key: 'editor.snippetSuggestions',
    type: 'string',
    default: 'inline',
    description: 'Controls whether snippets are shown with other suggestions.',
    scope: 'user',
    enum: ['top', 'bottom', 'inline', 'none'],
  },
  {
    key: 'editor.tabCompletion',
    type: 'string',
    default: 'off',
    description: 'Enables tab completions.',
    scope: 'user',
    enum: ['on', 'off', 'onlySnippets'],
  },
  {
    key: 'editor.parameterHints.enabled',
    type: 'boolean',
    default: true,
    description: 'Enables a pop-up that shows parameter documentation and type information.',
    scope: 'user',
  },
  {
    key: 'editor.inlayHints.enabled',
    type: 'string',
    default: 'on',
    description: 'Enables the inlay hints in the editor.',
    scope: 'user',
    enum: ['on', 'off', 'onUnlessPressed', 'offUnlessPressed'],
  },

  // Bracket settings
  {
    key: 'editor.bracketPairColorization.enabled',
    type: 'boolean',
    default: true,
    description: 'Controls whether bracket pair colorization is enabled.',
    scope: 'user',
  },
  {
    key: 'editor.guides.bracketPairs',
    type: 'string',
    default: 'active',
    description: 'Controls whether bracket pair guides are enabled.',
    scope: 'user',
    enum: ['true', 'active', 'false'],
  },
  {
    key: 'editor.matchBrackets',
    type: 'string',
    default: 'always',
    description: 'Highlight matching brackets.',
    scope: 'user',
    enum: ['always', 'near', 'never'],
  },

  // Files settings
  {
    key: 'files.autoSave',
    type: 'string',
    default: 'off',
    description: 'Controls auto save of editors.',
    scope: 'user',
    enum: ['off', 'afterDelay', 'onFocusChange', 'onWindowChange'],
  },
  {
    key: 'files.autoSaveDelay',
    type: 'number',
    default: 1000,
    description: 'Controls the delay in milliseconds after which an editor with unsaved changes is saved automatically.',
    scope: 'user',
    minimum: 0,
  },
  {
    key: 'files.trimTrailingWhitespace',
    type: 'boolean',
    default: false,
    description: 'When enabled, will trim trailing whitespace when saving a file.',
    scope: 'resource',
  },
  {
    key: 'files.insertFinalNewline',
    type: 'boolean',
    default: false,
    description: 'When enabled, insert a final new line at the end of the file when saving it.',
    scope: 'resource',
  },
  {
    key: 'files.trimFinalNewlines',
    type: 'boolean',
    default: false,
    description: 'When enabled, will trim all new lines after the final new line at the end of the file when saving it.',
    scope: 'resource',
  },
  {
    key: 'files.encoding',
    type: 'string',
    default: 'utf8',
    description: 'The default character set encoding to use when reading and writing files.',
    scope: 'resource',
    enum: ['utf8', 'utf8bom', 'utf16le', 'utf16be', 'windows1252', 'iso88591'],
  },
  {
    key: 'files.eol',
    type: 'string',
    default: 'auto',
    description: 'The default end of line character.',
    scope: 'resource',
    enum: ['\\n', '\\r\\n', 'auto'],
  },
];

export { editorSettingsDefinitions };
```

---

## Settings Persistence

### Cloud Storage Implementation

```typescript
// src/settings/storage/cloudStorage.ts

interface CloudStorageConfig {
  apiUrl: string;
  userId: string;
  authToken: string;
}

class CloudSettingsStorage implements SettingsStorage {
  private config: CloudStorageConfig;
  private localCache: Map<string, any> = new Map();
  private syncInProgress = false;

  constructor(config: CloudStorageConfig) {
    this.config = config;
  }

  // Load user settings
  async loadUserSettings(): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${this.config.apiUrl}/settings/user`, {
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const settings = await response.json();
      this.localCache.set('user', settings);
      return settings;
    } catch (error) {
      console.error('Failed to load user settings:', error);
      return this.localCache.get('user') || {};
    }
  }

  // Save user settings
  async saveUserSettings(settings: Record<string, any>): Promise<void> {
    this.localCache.set('user', settings);

    try {
      await fetch(`${this.config.apiUrl}/settings/user`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('Failed to save user settings:', error);
      // Queue for later sync
      this.queueSync('user', settings);
    }
  }

  // Load workspace settings
  async loadWorkspaceSettings(): Promise<Record<string, any>> {
    // Workspace settings are stored in the project
    try {
      const response = await fetch(`${this.config.apiUrl}/settings/workspace`, {
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
        },
      });

      if (!response.ok) {
        return {};
      }

      const settings = await response.json();
      this.localCache.set('workspace', settings);
      return settings;
    } catch (error) {
      console.error('Failed to load workspace settings:', error);
      return this.localCache.get('workspace') || {};
    }
  }

  // Save workspace settings
  async saveWorkspaceSettings(settings: Record<string, any>): Promise<void> {
    this.localCache.set('workspace', settings);

    try {
      await fetch(`${this.config.apiUrl}/settings/workspace`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('Failed to save workspace settings:', error);
      this.queueSync('workspace', settings);
    }
  }

  // Load keybindings
  async loadKeybindings(): Promise<Keybinding[]> {
    try {
      const response = await fetch(`${this.config.apiUrl}/settings/keybindings`, {
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const keybindings = await response.json();
      this.localCache.set('keybindings', keybindings);
      return keybindings;
    } catch (error) {
      console.error('Failed to load keybindings:', error);
      return this.localCache.get('keybindings') || [];
    }
  }

  // Save keybindings
  async saveKeybindings(keybindings: Keybinding[]): Promise<void> {
    this.localCache.set('keybindings', keybindings);

    try {
      await fetch(`${this.config.apiUrl}/settings/keybindings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keybindings),
      });
    } catch (error) {
      console.error('Failed to save keybindings:', error);
      this.queueSync('keybindings', keybindings);
    }
  }

  // Queue sync for offline support
  private queueSync(type: string, data: any): void {
    const queue = JSON.parse(localStorage.getItem('settingsSyncQueue') || '[]');
    queue.push({ type, data, timestamp: Date.now() });
    localStorage.setItem('settingsSyncQueue', JSON.stringify(queue));
  }

  // Process sync queue
  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const queue = JSON.parse(localStorage.getItem('settingsSyncQueue') || '[]');
      
      for (const item of queue) {
        try {
          switch (item.type) {
            case 'user':
              await this.saveUserSettings(item.data);
              break;
            case 'workspace':
              await this.saveWorkspaceSettings(item.data);
              break;
            case 'keybindings':
              await this.saveKeybindings(item.data);
              break;
          }
        } catch (error) {
          // Keep in queue for retry
          continue;
        }
      }

      localStorage.setItem('settingsSyncQueue', '[]');
    } finally {
      this.syncInProgress = false;
    }
  }
}

export { CloudSettingsStorage, CloudStorageConfig };
```

---

## Settings Sync

### Settings Sync Service

```typescript
// src/settings/sync/settingsSyncService.ts

interface SyncProfile {
  id: string;
  name: string;
  settings: Record<string, any>;
  keybindings: Keybinding[];
  extensions: string[];
  snippets: Record<string, any>;
  uiState: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface SyncConflict {
  key: string;
  localValue: any;
  remoteValue: any;
  localTimestamp: number;
  remoteTimestamp: number;
}

type ConflictResolution = 'local' | 'remote' | 'merge';

class SettingsSyncService {
  private apiUrl: string;
  private authToken: string;
  private localProfile: SyncProfile | null = null;
  private remoteProfile: SyncProfile | null = null;
  private syncEnabled = false;

  constructor(apiUrl: string, authToken: string) {
    this.apiUrl = apiUrl;
    this.authToken = authToken;
  }

  // Enable sync
  async enableSync(): Promise<void> {
    this.syncEnabled = true;
    await this.sync();
  }

  // Disable sync
  disableSync(): void {
    this.syncEnabled = false;
  }

  // Sync settings
  async sync(): Promise<SyncConflict[]> {
    if (!this.syncEnabled) return [];

    // Load remote profile
    this.remoteProfile = await this.loadRemoteProfile();

    // Load local profile
    this.localProfile = await this.loadLocalProfile();

    // Detect conflicts
    const conflicts = this.detectConflicts();

    if (conflicts.length === 0) {
      // No conflicts, merge and push
      await this.mergeAndPush();
    }

    return conflicts;
  }

  // Resolve conflicts
  async resolveConflicts(
    conflicts: SyncConflict[],
    resolutions: Map<string, ConflictResolution>
  ): Promise<void> {
    for (const conflict of conflicts) {
      const resolution = resolutions.get(conflict.key) || 'remote';

      switch (resolution) {
        case 'local':
          // Keep local value
          break;
        case 'remote':
          // Use remote value
          this.setLocalValue(conflict.key, conflict.remoteValue);
          break;
        case 'merge':
          // Attempt to merge
          const merged = this.mergeValues(conflict.localValue, conflict.remoteValue);
          this.setLocalValue(conflict.key, merged);
          break;
      }
    }

    await this.mergeAndPush();
  }

  // Get sync status
  getSyncStatus(): {
    enabled: boolean;
    lastSync: string | null;
    pendingChanges: number;
  } {
    return {
      enabled: this.syncEnabled,
      lastSync: localStorage.getItem('lastSettingsSync'),
      pendingChanges: this.getPendingChangesCount(),
    };
  }

  // Export settings
  async exportSettings(): Promise<string> {
    const profile = await this.loadLocalProfile();
    return JSON.stringify(profile, null, 2);
  }

  // Import settings
  async importSettings(data: string): Promise<void> {
    const profile = JSON.parse(data) as SyncProfile;
    await this.applyProfile(profile);
  }

  // Load remote profile
  private async loadRemoteProfile(): Promise<SyncProfile | null> {
    try {
      const response = await fetch(`${this.apiUrl}/sync/profile`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.error('Failed to load remote profile:', error);
      return null;
    }
  }

  // Load local profile
  private async loadLocalProfile(): Promise<SyncProfile> {
    // Gather all local settings
    return {
      id: localStorage.getItem('profileId') || crypto.randomUUID(),
      name: 'Local Profile',
      settings: JSON.parse(localStorage.getItem('userSettings') || '{}'),
      keybindings: JSON.parse(localStorage.getItem('keybindings') || '[]'),
      extensions: JSON.parse(localStorage.getItem('installedExtensions') || '[]'),
      snippets: JSON.parse(localStorage.getItem('snippets') || '{}'),
      uiState: JSON.parse(localStorage.getItem('uiState') || '{}'),
      createdAt: localStorage.getItem('profileCreated') || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Detect conflicts
  private detectConflicts(): SyncConflict[] {
    if (!this.localProfile || !this.remoteProfile) return [];

    const conflicts: SyncConflict[] = [];

    // Compare settings
    for (const key of Object.keys(this.localProfile.settings)) {
      const localValue = this.localProfile.settings[key];
      const remoteValue = this.remoteProfile.settings[key];

      if (remoteValue !== undefined && !this.valuesEqual(localValue, remoteValue)) {
        conflicts.push({
          key: `settings.${key}`,
          localValue,
          remoteValue,
          localTimestamp: new Date(this.localProfile.updatedAt).getTime(),
          remoteTimestamp: new Date(this.remoteProfile.updatedAt).getTime(),
        });
      }
    }

    return conflicts;
  }

  // Merge and push
  private async mergeAndPush(): Promise<void> {
    if (!this.localProfile) return;

    // Merge with remote
    const merged = this.mergeProfiles(this.localProfile, this.remoteProfile);

    // Push to remote
    await fetch(`${this.apiUrl}/sync/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(merged),
    });

    // Update local
    await this.applyProfile(merged);

    localStorage.setItem('lastSettingsSync', new Date().toISOString());
  }

  // Merge profiles
  private mergeProfiles(local: SyncProfile, remote: SyncProfile | null): SyncProfile {
    if (!remote) return local;

    return {
      ...local,
      settings: { ...remote.settings, ...local.settings },
      keybindings: this.mergeKeybindings(local.keybindings, remote.keybindings),
      extensions: [...new Set([...local.extensions, ...remote.extensions])],
      snippets: { ...remote.snippets, ...local.snippets },
      uiState: { ...remote.uiState, ...local.uiState },
      updatedAt: new Date().toISOString(),
    };
  }

  // Merge keybindings
  private mergeKeybindings(local: Keybinding[], remote: Keybinding[]): Keybinding[] {
    const merged = new Map<string, Keybinding>();

    // Add remote first
    for (const kb of remote) {
      merged.set(`${kb.key}:${kb.when || ''}`, kb);
    }

    // Override with local
    for (const kb of local) {
      merged.set(`${kb.key}:${kb.when || ''}`, kb);
    }

    return Array.from(merged.values());
  }

  // Apply profile
  private async applyProfile(profile: SyncProfile): Promise<void> {
    localStorage.setItem('profileId', profile.id);
    localStorage.setItem('userSettings', JSON.stringify(profile.settings));
    localStorage.setItem('keybindings', JSON.stringify(profile.keybindings));
    localStorage.setItem('installedExtensions', JSON.stringify(profile.extensions));
    localStorage.setItem('snippets', JSON.stringify(profile.snippets));
    localStorage.setItem('uiState', JSON.stringify(profile.uiState));
    localStorage.setItem('profileCreated', profile.createdAt);
  }

  // Helper methods
  private valuesEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private mergeValues(local: any, remote: any): any {
    if (typeof local === 'object' && typeof remote === 'object') {
      return { ...remote, ...local };
    }
    return local;
  }

  private setLocalValue(key: string, value: any): void {
    const [type, ...rest] = key.split('.');
    const settingKey = rest.join('.');

    if (type === 'settings') {
      const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
      settings[settingKey] = value;
      localStorage.setItem('userSettings', JSON.stringify(settings));
    }
  }

  private getPendingChangesCount(): number {
    const queue = JSON.parse(localStorage.getItem('settingsSyncQueue') || '[]');
    return queue.length;
  }
}

export { SettingsSyncService, SyncProfile, SyncConflict, ConflictResolution };
```

---

## Summary

### Customization Features Matrix

| Feature | User Scope | Workspace Scope | Sync Support |
|---------|------------|-----------------|--------------|
| **Color Theme** | ✅ | ❌ | ✅ |
| **Icon Theme** | ✅ | ❌ | ✅ |
| **Font Settings** | ✅ | ❌ | ✅ |
| **Tab Size** | ✅ | ✅ | ✅ |
| **Keybindings** | ✅ | ❌ | ✅ |
| **Extensions** | ✅ | ✅ | ✅ |
| **Snippets** | ✅ | ✅ | ✅ |
| **Formatters** | ✅ | ✅ | ✅ |

### Settings Persistence

| Storage | Use Case | Sync |
|---------|----------|------|
| **Cloud Database** | User settings | ✅ |
| **Project Files** | Workspace settings | Via Git |
| **Local Storage** | Cache, offline | ❌ |

### Popular Customizations

| Category | Top Settings |
|----------|--------------|
| **Themes** | One Dark Pro, Dracula, GitHub Dark |
| **Fonts** | Fira Code, JetBrains Mono, Cascadia Code |
| **Keymaps** | Vim, Sublime Text, IntelliJ |
| **Tab Size** | 2 (JS/TS), 4 (Python, Go) |
