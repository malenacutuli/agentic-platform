# Code Editor Implementation

This guide provides comprehensive coverage of code editor implementation in cloud development environments, including Monaco Editor integration, CodeMirror alternatives, and custom implementations for specialized use cases.

---

## Table of Contents

1. [Overview](#overview)
2. [Editor Comparison](#editor-comparison)
3. [Monaco Editor Integration](#monaco-editor-integration)
4. [CodeMirror Integration](#codemirror-integration)
5. [Editor Architecture](#editor-architecture)
6. [Theming and Customization](#theming-and-customization)
7. [Performance Optimization](#performance-optimization)
8. [Multi-File Editing](#multi-file-editing)
9. [Collaborative Editing Integration](#collaborative-editing-integration)
10. [Mobile and Touch Support](#mobile-and-touch-support)
11. [Accessibility](#accessibility)
12. [Testing](#testing)
13. [Best Practices](#best-practices)

---

## Overview

The code editor is the central component of any cloud development environment. Choosing the right editor and implementing it correctly is crucial for developer experience.

### Editor Options

| Editor | Origin | Size | Features | Use Case |
|--------|--------|------|----------|----------|
| **Monaco** | VS Code | ~2MB | Full IDE features | Primary editor |
| **CodeMirror 6** | Independent | ~200KB | Modular, extensible | Lightweight, mobile |
| **Ace** | Cloud9 | ~300KB | Mature, stable | Legacy support |
| **Custom** | In-house | Variable | Specialized | Niche requirements |

### Primary Choice: Monaco Editor

Monaco Editor is the recommended choice for cloud IDEs because:

1. **VS Code Compatibility** - Same editor as VS Code
2. **Rich API** - Comprehensive programmatic control
3. **LSP Integration** - Native Language Server Protocol support
4. **TypeScript First** - Built with TypeScript, excellent types
5. **Active Development** - Regular updates from Microsoft

---

## Editor Comparison

### Feature Matrix

| Feature | Monaco | CodeMirror 6 | Ace |
|---------|--------|--------------|-----|
| **Syntax Highlighting** | ✅ 50+ languages | ✅ 100+ languages | ✅ 100+ languages |
| **IntelliSense** | ✅ Native | ⚠️ Plugin | ⚠️ Plugin |
| **LSP Support** | ✅ Native | ⚠️ Plugin | ⚠️ Plugin |
| **Minimap** | ✅ Built-in | ⚠️ Plugin | ❌ |
| **Diff Editor** | ✅ Built-in | ⚠️ Plugin | ⚠️ Plugin |
| **Multi-cursor** | ✅ | ✅ | ✅ |
| **Code Folding** | ✅ | ✅ | ✅ |
| **Find/Replace** | ✅ Regex | ✅ Regex | ✅ Regex |
| **Bracket Matching** | ✅ | ✅ | ✅ |
| **Mobile Support** | ⚠️ Limited | ✅ Good | ⚠️ Limited |
| **Bundle Size** | ~2MB | ~200KB | ~300KB |
| **Performance (large files)** | ✅ Excellent | ✅ Excellent | ⚠️ Good |
| **Accessibility** | ✅ Good | ✅ Excellent | ⚠️ Fair |
| **Collaborative Editing** | ⚠️ Plugin | ✅ Native (Yjs) | ⚠️ Plugin |

### Performance Benchmarks

| Metric | Monaco | CodeMirror 6 | Ace |
|--------|--------|--------------|-----|
| Initial Load | 150-300ms | 50-100ms | 100-150ms |
| 10K Lines Render | 50ms | 30ms | 80ms |
| 100K Lines Render | 200ms | 150ms | 500ms |
| Memory (10K lines) | 50MB | 30MB | 40MB |
| Memory (100K lines) | 150MB | 80MB | 200MB |

---

## Monaco Editor Integration

### Basic Setup

```typescript
// src/editor/MonacoEditor.tsx

import React, { useRef, useEffect, useState } from 'react';
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Configure Monaco loader
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
  }
});

interface MonacoEditorProps {
  value: string;
  language: string;
  theme?: 'vs-dark' | 'vs-light' | 'hc-black';
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  path?: string;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  theme = 'vs-dark',
  onChange,
  onSave,
  options = {},
  path,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value,
      language,
      theme,
      automaticLayout: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: "'Fira Code', 'Consolas', monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      ...options,
    });

    editorRef.current = editor;
    setIsReady(true);

    // Handle content changes
    const disposable = editor.onDidChangeModelContent(() => {
      onChange?.(editor.getValue());
    });

    // Handle save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.(editor.getValue());
    });

    return () => {
      disposable.dispose();
      editor.dispose();
    };
  }, []);

  // Update value when prop changes
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // Update language when prop changes
  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  // Update theme when prop changes
  useEffect(() => {
    monaco.editor.setTheme(theme);
  }, [theme]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }}
      data-testid="monaco-editor"
    />
  );
};
```

### Web Worker Configuration

Monaco requires web workers for syntax highlighting and language features:

```typescript
// src/editor/monacoWorkers.ts

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure workers
self.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// For Vite bundler
export function configureMonacoWorkers() {
  // Workers are configured via self.MonacoEnvironment
}
```

### Vite Configuration

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'css', 'html'],
      customWorkers: [
        {
          label: 'yaml',
          entry: 'monaco-yaml/yaml.worker',
        },
      ],
    }),
  ],
  optimizeDeps: {
    include: ['monaco-editor'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
});
```

### Model Management

```typescript
// src/editor/modelManager.ts

import * as monaco from 'monaco-editor';

interface FileModel {
  uri: monaco.Uri;
  model: monaco.editor.ITextModel;
  viewState?: monaco.editor.ICodeEditorViewState;
  isDirty: boolean;
}

class ModelManager {
  private models: Map<string, FileModel> = new Map();
  private currentPath: string | null = null;

  // Get or create model for a file
  getOrCreateModel(
    path: string,
    content: string,
    language?: string
  ): monaco.editor.ITextModel {
    const existing = this.models.get(path);
    if (existing) {
      return existing.model;
    }

    const uri = monaco.Uri.file(path);
    const detectedLanguage = language || this.detectLanguage(path);
    const model = monaco.editor.createModel(content, detectedLanguage, uri);

    this.models.set(path, {
      uri,
      model,
      isDirty: false,
    });

    // Track changes
    model.onDidChangeContent(() => {
      const fileModel = this.models.get(path);
      if (fileModel) {
        fileModel.isDirty = true;
      }
    });

    return model;
  }

  // Switch to a different file
  switchToFile(
    editor: monaco.editor.IStandaloneCodeEditor,
    path: string,
    content?: string
  ): void {
    // Save current view state
    if (this.currentPath) {
      const current = this.models.get(this.currentPath);
      if (current) {
        current.viewState = editor.saveViewState() || undefined;
      }
    }

    // Get or create target model
    const model = content !== undefined
      ? this.getOrCreateModel(path, content)
      : this.models.get(path)?.model;

    if (!model) {
      throw new Error(`Model not found for path: ${path}`);
    }

    // Set model and restore view state
    editor.setModel(model);
    
    const fileModel = this.models.get(path);
    if (fileModel?.viewState) {
      editor.restoreViewState(fileModel.viewState);
    }

    this.currentPath = path;
  }

  // Mark file as saved
  markSaved(path: string): void {
    const fileModel = this.models.get(path);
    if (fileModel) {
      fileModel.isDirty = false;
    }
  }

  // Get dirty files
  getDirtyFiles(): string[] {
    return Array.from(this.models.entries())
      .filter(([_, model]) => model.isDirty)
      .map(([path]) => path);
  }

  // Update file content (e.g., from external change)
  updateContent(path: string, content: string): void {
    const fileModel = this.models.get(path);
    if (fileModel) {
      fileModel.model.setValue(content);
      fileModel.isDirty = false;
    }
  }

  // Close file
  closeFile(path: string): void {
    const fileModel = this.models.get(path);
    if (fileModel) {
      fileModel.model.dispose();
      this.models.delete(path);
    }
  }

  // Detect language from file extension
  private detectLanguage(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'md': 'markdown',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'sql': 'sql',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sh': 'shell',
      'bash': 'shell',
      'dockerfile': 'dockerfile',
      'graphql': 'graphql',
      'vue': 'vue',
      'svelte': 'svelte',
    };

    return languageMap[extension || ''] || 'plaintext';
  }

  // Dispose all models
  dispose(): void {
    this.models.forEach(({ model }) => model.dispose());
    this.models.clear();
  }
}

export const modelManager = new ModelManager();
```

### Custom Actions and Commands

```typescript
// src/editor/customActions.ts

import * as monaco from 'monaco-editor';

export function registerCustomActions(
  editor: monaco.editor.IStandaloneCodeEditor
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  // Format document
  disposables.push(
    editor.addAction({
      id: 'format-document',
      label: 'Format Document',
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      ],
      contextMenuGroupId: 'modification',
      contextMenuOrder: 1,
      run: async (ed) => {
        await ed.getAction('editor.action.formatDocument')?.run();
      },
    })
  );

  // Toggle comment
  disposables.push(
    editor.addAction({
      id: 'toggle-comment',
      label: 'Toggle Line Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      run: (ed) => {
        ed.getAction('editor.action.commentLine')?.run();
      },
    })
  );

  // Duplicate line
  disposables.push(
    editor.addAction({
      id: 'duplicate-line',
      label: 'Duplicate Line',
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
      ],
      run: (ed) => {
        ed.getAction('editor.action.copyLinesDownAction')?.run();
      },
    })
  );

  // Move line up
  disposables.push(
    editor.addAction({
      id: 'move-line-up',
      label: 'Move Line Up',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: (ed) => {
        ed.getAction('editor.action.moveLinesUpAction')?.run();
      },
    })
  );

  // Move line down
  disposables.push(
    editor.addAction({
      id: 'move-line-down',
      label: 'Move Line Down',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: (ed) => {
        ed.getAction('editor.action.moveLinesDownAction')?.run();
      },
    })
  );

  // Go to line
  disposables.push(
    editor.addAction({
      id: 'go-to-line',
      label: 'Go to Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      run: (ed) => {
        ed.getAction('editor.action.gotoLine')?.run();
      },
    })
  );

  // Quick open (file picker)
  disposables.push(
    editor.addAction({
      id: 'quick-open',
      label: 'Quick Open',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
      run: () => {
        // Emit event for file picker
        window.dispatchEvent(new CustomEvent('editor:quickOpen'));
      },
    })
  );

  // Command palette
  disposables.push(
    editor.addAction({
      id: 'command-palette',
      label: 'Command Palette',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      ],
      run: (ed) => {
        ed.getAction('editor.action.quickCommand')?.run();
      },
    })
  );

  // Find in files (emit event)
  disposables.push(
    editor.addAction({
      id: 'find-in-files',
      label: 'Find in Files',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      ],
      run: () => {
        window.dispatchEvent(new CustomEvent('editor:findInFiles'));
      },
    })
  );

  return disposables;
}
```

---

## CodeMirror Integration

### Basic Setup

```typescript
// src/editor/CodeMirrorEditor.tsx

import React, { useRef, useEffect } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

interface CodeMirrorEditorProps {
  value: string;
  language: string;
  theme?: 'dark' | 'light';
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  readOnly?: boolean;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  language,
  theme = 'dark',
  onChange,
  onSave,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Get language extension
  const getLanguageExtension = (lang: string): Extension => {
    const languages: Record<string, () => Extension> = {
      javascript: () => javascript(),
      typescript: () => javascript({ typescript: true }),
      jsx: () => javascript({ jsx: true }),
      tsx: () => javascript({ jsx: true, typescript: true }),
      python: () => python(),
      html: () => html(),
      css: () => css(),
      json: () => json(),
      markdown: () => markdown(),
    };

    return languages[lang]?.() || [];
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle),
      lintGutter(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        {
          key: 'Mod-s',
          run: (view) => {
            onSave?.(view.state.doc.toString());
            return true;
          },
        },
      ]),
      getLanguageExtension(language),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange?.(update.state.doc.toString());
        }
      }),
    ];

    if (theme === 'dark') {
      extensions.push(oneDark);
    }

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [language, theme, readOnly]);

  // Update value when prop changes
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (value !== currentValue) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      data-testid="codemirror-editor"
    />
  );
};
```

### CodeMirror with Yjs (Collaborative)

```typescript
// src/editor/CollaborativeCodeMirror.tsx

import React, { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { WebsocketProvider } from 'y-websocket';

interface CollaborativeEditorProps {
  documentId: string;
  websocketUrl: string;
  language: string;
  userName: string;
  userColor: string;
}

export const CollaborativeCodeMirror: React.FC<CollaborativeEditorProps> = ({
  documentId,
  websocketUrl,
  language,
  userName,
  userColor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create WebSocket provider
    const provider = new WebsocketProvider(
      websocketUrl,
      documentId,
      ydoc
    );
    providerRef.current = provider;

    // Set user awareness
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
    });

    // Get shared text
    const ytext = ydoc.getText('content');

    // Create editor
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        javascript({ typescript: true }),
        oneDark,
        yCollab(ytext, provider.awareness),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      provider.disconnect();
      ydoc.destroy();
    };
  }, [documentId, websocketUrl, userName, userColor]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
```

---

## Editor Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              EDITOR ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              IDE Shell                                           │   │
│  │  ┌─────────────┐  ┌─────────────────────────────────────┐  ┌─────────────────┐  │   │
│  │  │   Sidebar   │  │           Editor Area               │  │    Panel        │  │   │
│  │  │             │  │  ┌───────────────────────────────┐  │  │                 │  │   │
│  │  │  Explorer   │  │  │         Tab Bar               │  │  │  Terminal       │  │   │
│  │  │  Search     │  │  └───────────────────────────────┘  │  │  Problems       │  │   │
│  │  │  Git        │  │  ┌───────────────────────────────┐  │  │  Output         │  │   │
│  │  │  Extensions │  │  │                               │  │  │  Debug Console  │  │   │
│  │  │             │  │  │      Monaco Editor            │  │  │                 │  │   │
│  │  │             │  │  │                               │  │  │                 │  │   │
│  │  │             │  │  │  ┌─────────────────────────┐  │  │  │                 │  │   │
│  │  │             │  │  │  │    Editor Instance      │  │  │  │                 │  │   │
│  │  │             │  │  │  │                         │  │  │  │                 │  │   │
│  │  │             │  │  │  │  - Text Model           │  │  │  │                 │  │   │
│  │  │             │  │  │  │  - View State           │  │  │  │                 │  │   │
│  │  │             │  │  │  │  - Decorations          │  │  │  │                 │  │   │
│  │  │             │  │  │  │  - Language Services    │  │  │  │                 │  │   │
│  │  │             │  │  │  │                         │  │  │  │                 │  │   │
│  │  │             │  │  │  └─────────────────────────┘  │  │  │                 │  │   │
│  │  │             │  │  │                               │  │  │                 │  │   │
│  │  │             │  │  │      Minimap │ Scrollbar      │  │  │                 │  │   │
│  │  │             │  │  └───────────────────────────────┘  │  │                 │  │   │
│  │  │             │  │  ┌───────────────────────────────┐  │  │                 │  │   │
│  │  │             │  │  │         Status Bar            │  │  │                 │  │   │
│  │  │             │  │  └───────────────────────────────┘  │  │                 │  │   │
│  │  └─────────────┘  └─────────────────────────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### State Management

```typescript
// src/editor/editorState.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface EditorTab {
  id: string;
  path: string;
  name: string;
  language: string;
  isDirty: boolean;
  isPreview: boolean;
}

interface EditorState {
  // Tabs
  tabs: EditorTab[];
  activeTabId: string | null;
  
  // Editor settings
  fontSize: number;
  fontFamily: string;
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  wordWrap: 'on' | 'off' | 'wordWrapColumn';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  
  // Actions
  openFile: (path: string, content: string, isPreview?: boolean) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  markDirty: (tabId: string, isDirty: boolean) => void;
  promotePreview: (tabId: string) => void;
  updateSettings: (settings: Partial<EditorState>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    tabs: [],
    activeTabId: null,
    fontSize: 14,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    theme: 'vs-dark',
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',

    openFile: (path, content, isPreview = false) => {
      const { tabs } = get();
      
      // Check if already open
      const existingTab = tabs.find(t => t.path === path);
      if (existingTab) {
        set({ activeTabId: existingTab.id });
        return;
      }

      // If opening preview, replace existing preview
      if (isPreview) {
        const previewIndex = tabs.findIndex(t => t.isPreview);
        if (previewIndex !== -1) {
          const newTabs = [...tabs];
          newTabs[previewIndex] = {
            id: `tab-${Date.now()}`,
            path,
            name: path.split('/').pop() || path,
            language: detectLanguage(path),
            isDirty: false,
            isPreview: true,
          };
          set({ tabs: newTabs, activeTabId: newTabs[previewIndex].id });
          return;
        }
      }

      // Add new tab
      const newTab: EditorTab = {
        id: `tab-${Date.now()}`,
        path,
        name: path.split('/').pop() || path,
        language: detectLanguage(path),
        isDirty: false,
        isPreview,
      };

      set({
        tabs: [...tabs, newTab],
        activeTabId: newTab.id,
      });
    },

    closeTab: (tabId) => {
      const { tabs, activeTabId } = get();
      const tabIndex = tabs.findIndex(t => t.id === tabId);
      
      if (tabIndex === -1) return;

      const newTabs = tabs.filter(t => t.id !== tabId);
      let newActiveId = activeTabId;

      if (activeTabId === tabId) {
        // Select adjacent tab
        if (newTabs.length > 0) {
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveId = newTabs[newIndex].id;
        } else {
          newActiveId = null;
        }
      }

      set({ tabs: newTabs, activeTabId: newActiveId });
    },

    closeAllTabs: () => {
      set({ tabs: [], activeTabId: null });
    },

    closeOtherTabs: (tabId) => {
      const { tabs } = get();
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        set({ tabs: [tab], activeTabId: tabId });
      }
    },

    setActiveTab: (tabId) => {
      set({ activeTabId: tabId });
    },

    markDirty: (tabId, isDirty) => {
      const { tabs } = get();
      set({
        tabs: tabs.map(t =>
          t.id === tabId ? { ...t, isDirty } : t
        ),
      });
    },

    promotePreview: (tabId) => {
      const { tabs } = get();
      set({
        tabs: tabs.map(t =>
          t.id === tabId ? { ...t, isPreview: false } : t
        ),
      });
    },

    updateSettings: (settings) => {
      set(settings);
    },

    reorderTabs: (fromIndex, toIndex) => {
      const { tabs } = get();
      const newTabs = [...tabs];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      set({ tabs: newTabs });
    },
  }))
);

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    py: 'python',
    // ... more mappings
  };
  return map[ext || ''] || 'plaintext';
}
```

---

## Theming and Customization

### Custom Theme Definition

```typescript
// src/editor/themes/customTheme.ts

import * as monaco from 'monaco-editor';

export const customDarkTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // Comments
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '6A9955' },
    { token: 'comment.line', foreground: '6A9955' },
    
    // Strings
    { token: 'string', foreground: 'CE9178' },
    { token: 'string.escape', foreground: 'D7BA7D' },
    { token: 'string.regexp', foreground: 'D16969' },
    
    // Numbers
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'number.hex', foreground: 'B5CEA8' },
    
    // Keywords
    { token: 'keyword', foreground: '569CD6' },
    { token: 'keyword.control', foreground: 'C586C0' },
    { token: 'keyword.operator', foreground: 'D4D4D4' },
    
    // Types
    { token: 'type', foreground: '4EC9B0' },
    { token: 'type.identifier', foreground: '4EC9B0' },
    
    // Functions
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'function.declaration', foreground: 'DCDCAA' },
    
    // Variables
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'variable.parameter', foreground: '9CDCFE' },
    { token: 'variable.constant', foreground: '4FC1FF' },
    
    // Classes
    { token: 'class', foreground: '4EC9B0' },
    { token: 'interface', foreground: '4EC9B0' },
    
    // Operators
    { token: 'operator', foreground: 'D4D4D4' },
    
    // Punctuation
    { token: 'delimiter', foreground: 'D4D4D4' },
    { token: 'delimiter.bracket', foreground: 'FFD700' },
    
    // Tags (HTML/JSX)
    { token: 'tag', foreground: '569CD6' },
    { token: 'tag.attribute.name', foreground: '9CDCFE' },
    { token: 'tag.attribute.value', foreground: 'CE9178' },
  ],
  colors: {
    // Editor
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2D2D2D',
    'editor.selectionBackground': '#264F78',
    'editor.inactiveSelectionBackground': '#3A3D41',
    
    // Cursor
    'editorCursor.foreground': '#AEAFAD',
    
    // Line numbers
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#C6C6C6',
    
    // Indentation guides
    'editorIndentGuide.background': '#404040',
    'editorIndentGuide.activeBackground': '#707070',
    
    // Brackets
    'editorBracketMatch.background': '#0064001A',
    'editorBracketMatch.border': '#888888',
    
    // Minimap
    'minimap.background': '#1E1E1E',
    'minimapSlider.background': '#79797933',
    'minimapSlider.hoverBackground': '#64646459',
    'minimapSlider.activeBackground': '#BFBFBF33',
    
    // Scrollbar
    'scrollbarSlider.background': '#79797966',
    'scrollbarSlider.hoverBackground': '#646464B3',
    'scrollbarSlider.activeBackground': '#BFBFBF66',
    
    // Gutter
    'editorGutter.background': '#1E1E1E',
    'editorGutter.modifiedBackground': '#0C7D9D',
    'editorGutter.addedBackground': '#587C0C',
    'editorGutter.deletedBackground': '#94151B',
    
    // Widgets
    'editorWidget.background': '#252526',
    'editorWidget.border': '#454545',
    'editorSuggestWidget.background': '#252526',
    'editorSuggestWidget.border': '#454545',
    'editorSuggestWidget.selectedBackground': '#062F4A',
    
    // Peek view
    'peekView.border': '#007ACC',
    'peekViewEditor.background': '#001F33',
    'peekViewResult.background': '#252526',
    'peekViewTitle.background': '#1E1E1E',
  },
};

// Register theme
export function registerCustomThemes(): void {
  monaco.editor.defineTheme('custom-dark', customDarkTheme);
  
  // Light theme
  monaco.editor.defineTheme('custom-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F5F5F5',
      'editor.selectionBackground': '#ADD6FF',
    },
  });
}
```

### Dynamic Theme Switching

```typescript
// src/editor/themeManager.ts

import * as monaco from 'monaco-editor';

type ThemeName = 'vs-dark' | 'vs-light' | 'hc-black' | 'custom-dark' | 'custom-light';

interface ThemeConfig {
  name: ThemeName;
  displayName: string;
  type: 'dark' | 'light';
}

const themes: ThemeConfig[] = [
  { name: 'vs-dark', displayName: 'Dark+ (default dark)', type: 'dark' },
  { name: 'vs-light', displayName: 'Light+ (default light)', type: 'light' },
  { name: 'hc-black', displayName: 'High Contrast', type: 'dark' },
  { name: 'custom-dark', displayName: 'Custom Dark', type: 'dark' },
  { name: 'custom-light', displayName: 'Custom Light', type: 'light' },
];

class ThemeManager {
  private currentTheme: ThemeName = 'vs-dark';
  private listeners: Set<(theme: ThemeName) => void> = new Set();

  getThemes(): ThemeConfig[] {
    return themes;
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme;
  }

  setTheme(theme: ThemeName): void {
    this.currentTheme = theme;
    monaco.editor.setTheme(theme);
    
    // Update CSS variables for UI consistency
    const themeConfig = themes.find(t => t.name === theme);
    document.documentElement.setAttribute('data-theme', themeConfig?.type || 'dark');
    
    // Notify listeners
    this.listeners.forEach(listener => listener(theme));
    
    // Persist preference
    localStorage.setItem('editor-theme', theme);
  }

  loadSavedTheme(): void {
    const saved = localStorage.getItem('editor-theme') as ThemeName | null;
    if (saved && themes.some(t => t.name === saved)) {
      this.setTheme(saved);
    }
  }

  onThemeChange(listener: (theme: ThemeName) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Match system preference
  matchSystemTheme(): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      this.setTheme(e.matches ? 'vs-dark' : 'vs-light');
    };

    updateTheme(prefersDark);
    prefersDark.addEventListener('change', updateTheme);
  }
}

export const themeManager = new ThemeManager();
```

---

## Performance Optimization

### Large File Handling

```typescript
// src/editor/largeFileHandler.ts

import * as monaco from 'monaco-editor';

interface LargeFileOptions {
  maxTokenizationLineLength: number;
  maxHighlightingLineLength: number;
  disableFeatures: string[];
}

const LARGE_FILE_THRESHOLD = 100000; // 100KB
const VERY_LARGE_FILE_THRESHOLD = 1000000; // 1MB

export function configureLargeFileHandling(
  editor: monaco.editor.IStandaloneCodeEditor,
  fileSize: number
): void {
  const model = editor.getModel();
  if (!model) return;

  if (fileSize > VERY_LARGE_FILE_THRESHOLD) {
    // Very large file - disable most features
    editor.updateOptions({
      minimap: { enabled: false },
      folding: false,
      wordWrap: 'off',
      renderWhitespace: 'none',
      renderLineHighlight: 'none',
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      matchBrackets: 'never',
      renderIndentGuides: false,
      colorDecorators: false,
      quickSuggestions: false,
      parameterHints: { enabled: false },
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: 'off',
      tabCompletion: 'off',
      wordBasedSuggestions: 'off',
      links: false,
      hover: { enabled: false },
    });

    // Limit tokenization
    monaco.languages.setLanguageConfiguration(model.getLanguageId(), {
      // Disable bracket matching for performance
    });

  } else if (fileSize > LARGE_FILE_THRESHOLD) {
    // Large file - disable some features
    editor.updateOptions({
      minimap: { enabled: false },
      renderWhitespace: 'selection',
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      quickSuggestions: { other: false, comments: false, strings: false },
      wordBasedSuggestions: 'off',
    });
  }
}

// Chunked file loading for very large files
export async function loadLargeFile(
  path: string,
  fetchChunk: (start: number, end: number) => Promise<string>
): Promise<{
  initialContent: string;
  totalSize: number;
  loadMore: (start: number, end: number) => Promise<string>;
}> {
  const INITIAL_CHUNK_SIZE = 100000; // Load first 100KB initially
  
  const initialContent = await fetchChunk(0, INITIAL_CHUNK_SIZE);
  
  return {
    initialContent,
    totalSize: 0, // Would be set from response headers
    loadMore: fetchChunk,
  };
}

// Virtual scrolling for extremely large files
export class VirtualDocument {
  private chunks: Map<number, string> = new Map();
  private chunkSize: number = 50000; // 50KB per chunk
  private totalSize: number;
  private fetchChunk: (start: number, end: number) => Promise<string>;

  constructor(
    totalSize: number,
    fetchChunk: (start: number, end: number) => Promise<string>
  ) {
    this.totalSize = totalSize;
    this.fetchChunk = fetchChunk;
  }

  async getContent(startLine: number, endLine: number): Promise<string> {
    // Calculate which chunks are needed
    // Fetch and cache chunks
    // Return combined content
    return '';
  }

  invalidateCache(): void {
    this.chunks.clear();
  }
}
```

### Lazy Loading Languages

```typescript
// src/editor/languageLoader.ts

import * as monaco from 'monaco-editor';

interface LanguageModule {
  load: () => Promise<void>;
  loaded: boolean;
}

const languageModules: Record<string, LanguageModule> = {
  python: {
    load: async () => {
      const { pythonLanguage } = await import('./languages/python');
      monaco.languages.register({ id: 'python' });
      monaco.languages.setMonarchTokensProvider('python', pythonLanguage);
    },
    loaded: false,
  },
  rust: {
    load: async () => {
      const { rustLanguage } = await import('./languages/rust');
      monaco.languages.register({ id: 'rust' });
      monaco.languages.setMonarchTokensProvider('rust', rustLanguage);
    },
    loaded: false,
  },
  go: {
    load: async () => {
      const { goLanguage } = await import('./languages/go');
      monaco.languages.register({ id: 'go' });
      monaco.languages.setMonarchTokensProvider('go', goLanguage);
    },
    loaded: false,
  },
  // Add more languages...
};

export async function ensureLanguageLoaded(languageId: string): Promise<void> {
  const module = languageModules[languageId];
  
  if (!module) {
    // Language not in lazy-load list, assume it's built-in
    return;
  }

  if (module.loaded) {
    return;
  }

  await module.load();
  module.loaded = true;
}

// Preload common languages
export async function preloadCommonLanguages(): Promise<void> {
  const common = ['python', 'go', 'rust'];
  
  // Load in background after initial render
  requestIdleCallback(async () => {
    for (const lang of common) {
      await ensureLanguageLoaded(lang);
    }
  });
}
```

---

## Multi-File Editing

### Split Editor

```typescript
// src/editor/SplitEditor.tsx

import React, { useState } from 'react';
import { MonacoEditor } from './MonacoEditor';

type SplitDirection = 'horizontal' | 'vertical';

interface EditorPane {
  id: string;
  path: string;
  content: string;
}

interface SplitEditorProps {
  panes: EditorPane[];
  direction: SplitDirection;
  onPaneChange: (paneId: string, content: string) => void;
  onPaneClose: (paneId: string) => void;
}

export const SplitEditor: React.FC<SplitEditorProps> = ({
  panes,
  direction,
  onPaneChange,
  onPaneClose,
}) => {
  const [sizes, setSizes] = useState<number[]>(
    panes.map(() => 100 / panes.length)
  );

  const handleResize = (index: number, delta: number) => {
    const newSizes = [...sizes];
    const minSize = 10; // Minimum 10%

    newSizes[index] = Math.max(minSize, newSizes[index] + delta);
    newSizes[index + 1] = Math.max(minSize, newSizes[index + 1] - delta);

    setSizes(newSizes);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        width: '100%',
        height: '100%',
      }}
    >
      {panes.map((pane, index) => (
        <React.Fragment key={pane.id}>
          <div
            style={{
              [direction === 'horizontal' ? 'width' : 'height']: `${sizes[index]}%`,
              position: 'relative',
            }}
          >
            <div className="pane-header">
              <span>{pane.path.split('/').pop()}</span>
              <button onClick={() => onPaneClose(pane.id)}>×</button>
            </div>
            <MonacoEditor
              value={pane.content}
              language={detectLanguage(pane.path)}
              onChange={(value) => onPaneChange(pane.id, value)}
            />
          </div>
          {index < panes.length - 1 && (
            <Resizer
              direction={direction}
              onResize={(delta) => handleResize(index, delta)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface ResizerProps {
  direction: SplitDirection;
  onResize: (delta: number) => void;
}

const Resizer: React.FC<ResizerProps> = ({ direction, onResize }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' 
        ? moveEvent.clientX 
        : moveEvent.clientY;
      const delta = ((currentPos - startPos) / window.innerWidth) * 100;
      onResize(delta);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      style={{
        [direction === 'horizontal' ? 'width' : 'height']: '4px',
        backgroundColor: '#333',
        cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
      }}
      onMouseDown={handleMouseDown}
    />
  );
};

function detectLanguage(path: string): string {
  // Implementation from earlier
  return 'typescript';
}
```

### Diff Editor

```typescript
// src/editor/DiffEditor.tsx

import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface DiffEditorProps {
  original: string;
  modified: string;
  language: string;
  originalPath?: string;
  modifiedPath?: string;
  readOnly?: boolean;
  onModifiedChange?: (value: string) => void;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({
  original,
  modified,
  language,
  originalPath,
  modifiedPath,
  readOnly = false,
  onModifiedChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const originalModel = monaco.editor.createModel(
      original,
      language,
      originalPath ? monaco.Uri.file(originalPath) : undefined
    );

    const modifiedModel = monaco.editor.createModel(
      modified,
      language,
      modifiedPath ? monaco.Uri.file(modifiedPath) : undefined
    );

    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      automaticLayout: true,
      readOnly,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      originalEditable: false,
      diffWordWrap: 'on',
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      renderMarginRevertIcon: true,
    });

    editor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    editorRef.current = editor;

    // Track changes to modified
    if (onModifiedChange) {
      modifiedModel.onDidChangeContent(() => {
        onModifiedChange(modifiedModel.getValue());
      });
    }

    return () => {
      editor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, []);

  // Update content when props change
  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        if (model.original.getValue() !== original) {
          model.original.setValue(original);
        }
        if (model.modified.getValue() !== modified) {
          model.modified.setValue(modified);
        }
      }
    }
  }, [original, modified]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      data-testid="diff-editor"
    />
  );
};
```

---

## Collaborative Editing Integration

### Monaco + Yjs Integration

```typescript
// src/editor/collaborativeMonaco.ts

import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

interface CollaborativeSession {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  binding: MonacoBinding;
  awareness: any;
}

export function setupCollaborativeEditing(
  editor: monaco.editor.IStandaloneCodeEditor,
  documentId: string,
  websocketUrl: string,
  user: { name: string; color: string }
): CollaborativeSession {
  // Create Yjs document
  const ydoc = new Y.Doc();
  
  // Create WebSocket provider
  const provider = new WebsocketProvider(
    websocketUrl,
    documentId,
    ydoc
  );

  // Set user awareness
  provider.awareness.setLocalStateField('user', {
    name: user.name,
    color: user.color,
    colorLight: user.color + '33', // With transparency
  });

  // Get shared text type
  const ytext = ydoc.getText('content');

  // Create Monaco binding
  const binding = new MonacoBinding(
    ytext,
    editor.getModel()!,
    new Set([editor]),
    provider.awareness
  );

  return {
    ydoc,
    provider,
    binding,
    awareness: provider.awareness,
  };
}

export function destroyCollaborativeSession(session: CollaborativeSession): void {
  session.binding.destroy();
  session.provider.disconnect();
  session.ydoc.destroy();
}

// Remote cursor decorations
export function createCursorDecorations(
  editor: monaco.editor.IStandaloneCodeEditor,
  awareness: any
): monaco.IDisposable {
  let decorations: string[] = [];

  const updateDecorations = () => {
    const states = awareness.getStates();
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    states.forEach((state: any, clientId: number) => {
      if (clientId === awareness.clientID) return; // Skip self
      if (!state.user || !state.cursor) return;

      const { name, color } = state.user;
      const { line, column } = state.cursor;

      // Cursor decoration
      newDecorations.push({
        range: new monaco.Range(line, column, line, column + 1),
        options: {
          className: `remote-cursor`,
          beforeContentClassName: `remote-cursor-line`,
          hoverMessage: { value: name },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Selection decoration
      if (state.selection) {
        const { startLine, startColumn, endLine, endColumn } = state.selection;
        newDecorations.push({
          range: new monaco.Range(startLine, startColumn, endLine, endColumn),
          options: {
            className: `remote-selection`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    });

    decorations = editor.deltaDecorations(decorations, newDecorations);
  };

  awareness.on('change', updateDecorations);
  updateDecorations();

  return {
    dispose: () => {
      awareness.off('change', updateDecorations);
      editor.deltaDecorations(decorations, []);
    },
  };
}
```

---

## Mobile and Touch Support

### Touch-Optimized Editor

```typescript
// src/editor/MobileEditor.tsx

import React from 'react';
import { CodeMirrorEditor } from './CodeMirrorEditor';

interface MobileEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
}

export const MobileEditor: React.FC<MobileEditorProps> = ({
  value,
  language,
  onChange,
}) => {
  // Use CodeMirror for better mobile support
  return (
    <div className="mobile-editor-container">
      {/* Virtual keyboard toolbar */}
      <div className="keyboard-toolbar">
        <button onClick={() => insertText('\t')}>Tab</button>
        <button onClick={() => insertText('()')}>( )</button>
        <button onClick={() => insertText('{}')}>{ }</button>
        <button onClick={() => insertText('[]')}>[ ]</button>
        <button onClick={() => insertText("''")}>' '</button>
        <button onClick={() => insertText('""')}>" "</button>
        <button onClick={() => insertText(';')}>;</button>
        <button onClick={() => insertText(':')}>:</button>
      </div>
      
      <CodeMirrorEditor
        value={value}
        language={language}
        onChange={onChange}
        // Mobile-optimized options
      />
    </div>
  );
};

function insertText(text: string): void {
  // Implementation to insert text at cursor
}
```

---

## Accessibility

### Accessibility Configuration

```typescript
// src/editor/accessibility.ts

import * as monaco from 'monaco-editor';

export function configureAccessibility(
  editor: monaco.editor.IStandaloneCodeEditor
): void {
  editor.updateOptions({
    // Screen reader support
    accessibilitySupport: 'on',
    
    // High contrast
    // theme: 'hc-black',
    
    // Keyboard navigation
    tabFocusMode: true,
    
    // Larger cursor for visibility
    cursorWidth: 3,
    cursorBlinking: 'solid',
    
    // Line height for readability
    lineHeight: 24,
    
    // Font size
    fontSize: 16,
    
    // Disable animations for motion sensitivity
    cursorSmoothCaretAnimation: 'off',
    smoothScrolling: false,
  });

  // Add ARIA labels
  const container = editor.getDomNode();
  if (container) {
    container.setAttribute('role', 'textbox');
    container.setAttribute('aria-label', 'Code editor');
    container.setAttribute('aria-multiline', 'true');
  }
}

// Keyboard shortcuts for accessibility
export function registerAccessibilityShortcuts(
  editor: monaco.editor.IStandaloneCodeEditor
): monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  // Announce current line
  disposables.push(
    editor.addAction({
      id: 'announce-line',
      label: 'Announce Current Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyL],
      run: (ed) => {
        const position = ed.getPosition();
        if (position) {
          const line = ed.getModel()?.getLineContent(position.lineNumber);
          announceToScreenReader(`Line ${position.lineNumber}: ${line}`);
        }
      },
    })
  );

  // Announce cursor position
  disposables.push(
    editor.addAction({
      id: 'announce-position',
      label: 'Announce Cursor Position',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyP],
      run: (ed) => {
        const position = ed.getPosition();
        if (position) {
          announceToScreenReader(
            `Line ${position.lineNumber}, Column ${position.column}`
          );
        }
      },
    })
  );

  return disposables;
}

function announceToScreenReader(message: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}
```

---

## Testing

### Editor Test Suite

```typescript
// tests/editor.test.tsx

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MonacoEditor } from '../src/editor/MonacoEditor';
import { modelManager } from '../src/editor/modelManager';

// Mock Monaco
vi.mock('monaco-editor', () => ({
  editor: {
    create: vi.fn(() => ({
      getValue: vi.fn(() => 'test content'),
      setValue: vi.fn(),
      getModel: vi.fn(() => ({
        getLanguageId: vi.fn(() => 'typescript'),
      })),
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
      addCommand: vi.fn(),
      dispose: vi.fn(),
    })),
    setModelLanguage: vi.fn(),
    setTheme: vi.fn(),
    createModel: vi.fn(),
  },
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { KeyS: 49 },
}));

describe('MonacoEditor', () => {
  it('renders editor container', () => {
    render(
      <MonacoEditor
        value="const x = 1;"
        language="typescript"
      />
    );
    
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('calls onChange when content changes', async () => {
    const onChange = vi.fn();
    
    render(
      <MonacoEditor
        value="const x = 1;"
        language="typescript"
        onChange={onChange}
      />
    );

    // Simulate content change
    // ...
  });

  it('calls onSave when Ctrl+S is pressed', async () => {
    const onSave = vi.fn();
    
    render(
      <MonacoEditor
        value="const x = 1;"
        language="typescript"
        onSave={onSave}
      />
    );

    // Simulate Ctrl+S
    // ...
  });
});

describe('ModelManager', () => {
  beforeEach(() => {
    modelManager.dispose();
  });

  it('creates model for new file', () => {
    const model = modelManager.getOrCreateModel(
      '/test/file.ts',
      'const x = 1;'
    );
    
    expect(model).toBeDefined();
  });

  it('returns existing model for same path', () => {
    const model1 = modelManager.getOrCreateModel('/test/file.ts', 'content1');
    const model2 = modelManager.getOrCreateModel('/test/file.ts', 'content2');
    
    expect(model1).toBe(model2);
  });

  it('tracks dirty state', () => {
    modelManager.getOrCreateModel('/test/file.ts', 'content');
    
    // Simulate change
    // ...
    
    const dirtyFiles = modelManager.getDirtyFiles();
    expect(dirtyFiles).toContain('/test/file.ts');
  });
});
```

---

## Best Practices

### 1. Editor Initialization

```typescript
// DO: Initialize editor once, update via API
const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

useEffect(() => {
  if (!containerRef.current || editorRef.current) return;
  editorRef.current = monaco.editor.create(containerRef.current, options);
  return () => editorRef.current?.dispose();
}, []);

// DON'T: Recreate editor on every render
useEffect(() => {
  const editor = monaco.editor.create(containerRef.current, options);
  return () => editor.dispose();
}, [value, language]); // ❌ Too many dependencies
```

### 2. Model Management

```typescript
// DO: Reuse models across editor instances
const model = modelManager.getOrCreateModel(path, content);
editor.setModel(model);

// DON'T: Create new model for each edit
editor.setValue(newContent); // ❌ Loses undo history
```

### 3. Performance

```typescript
// DO: Batch decorations
const decorations = editor.deltaDecorations(oldDecorations, newDecorations);

// DON'T: Add decorations one by one
newDecorations.forEach(d => editor.deltaDecorations([], [d])); // ❌ Slow
```

### 4. Memory Management

```typescript
// DO: Dispose resources
useEffect(() => {
  const disposables: monaco.IDisposable[] = [];
  disposables.push(editor.onDidChangeModelContent(...));
  return () => disposables.forEach(d => d.dispose());
}, []);

// DON'T: Forget to dispose
editor.onDidChangeModelContent(...); // ❌ Memory leak
```

---

## Summary

### Editor Choice Matrix

| Requirement | Recommended Editor |
|-------------|-------------------|
| Full IDE experience | Monaco |
| Lightweight embedding | CodeMirror 6 |
| Mobile-first | CodeMirror 6 |
| Collaborative editing | CodeMirror 6 + Yjs |
| VS Code compatibility | Monaco |
| Custom language | Both (Monaco slightly easier) |

### Key Implementation Points

| Aspect | Implementation |
|--------|----------------|
| **Primary Editor** | Monaco Editor |
| **Mobile Fallback** | CodeMirror 6 |
| **Model Management** | Centralized ModelManager |
| **Theming** | Custom theme definitions |
| **Large Files** | Feature degradation |
| **Collaboration** | Yjs binding |
| **Accessibility** | ARIA labels, keyboard nav |
