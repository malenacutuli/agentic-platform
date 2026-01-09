# Agent Planning Strategy

This guide provides comprehensive coverage of AI agent planning strategies, including the todo.md approach, step-by-step execution, self-correction mechanisms, and adaptive planning.

---

## Table of Contents

1. [Overview](#overview)
2. [Planning Architecture](#planning-architecture)
3. [Todo.md Approach](#todomd-approach)
4. [Step-by-Step Execution](#step-by-step-execution)
5. [Phase Management](#phase-management)
6. [Self-Correction Mechanisms](#self-correction-mechanisms)
7. [Adaptive Planning](#adaptive-planning)
8. [Progress Tracking](#progress-tracking)
9. [Best Practices](#best-practices)

---

## Overview

AI agents require structured planning to effectively complete complex development tasks. The planning strategy ensures tasks are broken down into manageable phases, progress is tracked, and the agent can adapt to changing requirements or unexpected obstacles.

### Planning Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT PLANNING PHILOSOPHY                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PRINCIPLES                                                                             │
│  ├── 1. Plan before executing                                                           │
│  ├── 2. Break complex tasks into phases                                                 │
│  ├── 3. Track progress explicitly                                                       │
│  ├── 4. Adapt when new information emerges                                              │
│  ├── 5. Self-correct on failures                                                        │
│  └── 6. Communicate progress to users                                                   │
│                                                                                         │
│  ANTI-PATTERNS                                                                          │
│  ├── ✗ Diving into code without planning                                                │
│  ├── ✗ Ignoring errors and continuing                                                   │
│  ├── ✗ Not updating plan when requirements change                                       │
│  ├── ✗ Repeating failed actions without adjustment                                      │
│  └── ✗ Losing track of completed work                                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Planning Lifecycle

| Phase | Description | Duration |
|-------|-------------|----------|
| **Analysis** | Understand requirements | 1-2 iterations |
| **Planning** | Create task plan | 1 iteration |
| **Execution** | Work through phases | Variable |
| **Verification** | Check completeness | 1-2 iterations |
| **Delivery** | Present results | 1 iteration |

---

## Planning Architecture

### Plan Tool Schema

```typescript
// types/plan.ts

interface TaskPlan {
  goal: string;
  phases: Phase[];
  currentPhaseId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Phase {
  id: number;
  title: string;
  capabilities: PhaseCapabilities;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
}

interface PhaseCapabilities {
  technical_writing?: boolean;
  creative_writing?: boolean;
  data_analysis?: boolean;
  web_development?: boolean;
  deep_research?: boolean;
  parallel_processing?: boolean;
  media_generation?: boolean;
  image_processing?: boolean;
  slides_content_writing?: boolean;
  slides_generation?: boolean;
}

interface PlanAction {
  action: 'update' | 'advance';
  goal?: string;
  phases?: Phase[];
  current_phase_id: number;
  next_phase_id?: number;
}
```

### Plan Manager Implementation

```typescript
// server/agent/planManager.ts

import { TaskPlan, Phase, PlanAction } from '../types/plan';

/**
 * Manage task planning and phase progression
 */
class PlanManager {
  private currentPlan: TaskPlan | null = null;
  private planHistory: TaskPlan[] = [];

  /**
   * Create or update task plan
   */
  update(action: PlanAction): TaskPlan {
    if (!action.goal || !action.phases) {
      throw new Error('Goal and phases required for plan update');
    }

    // Validate phases
    this.validatePhases(action.phases);

    // Create new plan
    const plan: TaskPlan = {
      goal: action.goal,
      phases: action.phases.map(p => ({
        ...p,
        status: p.id === action.current_phase_id ? 'in_progress' : 'pending',
      })),
      currentPhaseId: action.current_phase_id,
      createdAt: this.currentPlan?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Archive previous plan
    if (this.currentPlan) {
      this.planHistory.push(this.currentPlan);
    }

    this.currentPlan = plan;
    return plan;
  }

  /**
   * Advance to next phase
   */
  advance(action: PlanAction): TaskPlan {
    if (!this.currentPlan) {
      throw new Error('No active plan to advance');
    }

    if (!action.next_phase_id) {
      throw new Error('next_phase_id required for advance action');
    }

    // Validate advancement
    const currentPhase = this.getPhase(action.current_phase_id);
    const nextPhase = this.getPhase(action.next_phase_id);

    if (!currentPhase || !nextPhase) {
      throw new Error('Invalid phase IDs');
    }

    if (action.next_phase_id !== action.current_phase_id + 1) {
      throw new Error('Cannot skip phases - use update to revise plan');
    }

    // Update phase statuses
    currentPhase.status = 'completed';
    currentPhase.completedAt = new Date();
    nextPhase.status = 'in_progress';
    nextPhase.startedAt = new Date();

    this.currentPlan.currentPhaseId = action.next_phase_id;
    this.currentPlan.updatedAt = new Date();

    return this.currentPlan;
  }

  /**
   * Get current plan
   */
  getCurrentPlan(): TaskPlan | null {
    return this.currentPlan;
  }

  /**
   * Get phase by ID
   */
  getPhase(id: number): Phase | undefined {
    return this.currentPlan?.phases.find(p => p.id === id);
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): Phase | undefined {
    if (!this.currentPlan) return undefined;
    return this.getPhase(this.currentPlan.currentPhaseId);
  }

  /**
   * Check if plan is complete
   */
  isComplete(): boolean {
    if (!this.currentPlan) return false;
    return this.currentPlan.phases.every(
      p => p.status === 'completed' || p.status === 'skipped'
    );
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    if (!this.currentPlan) return 0;
    const completed = this.currentPlan.phases.filter(
      p => p.status === 'completed'
    ).length;
    return Math.round((completed / this.currentPlan.phases.length) * 100);
  }

  /**
   * Validate phases
   */
  private validatePhases(phases: Phase[]): void {
    // Check IDs are sequential
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].id !== i + 1) {
        throw new Error(`Phase IDs must be sequential starting from 1`);
      }
    }

    // Check for required fields
    for (const phase of phases) {
      if (!phase.title) {
        throw new Error(`Phase ${phase.id} missing title`);
      }
    }

    // Validate capability combinations
    for (const phase of phases) {
      if (phase.capabilities.slides_content_writing && 
          phase.capabilities.slides_generation) {
        throw new Error(
          'slides_content_writing and slides_generation must be in separate phases'
        );
      }
      if (phase.capabilities.web_development && 
          phase.capabilities.parallel_processing) {
        throw new Error(
          'web_development and parallel_processing cannot coexist in same phase'
        );
      }
    }
  }

  /**
   * Format plan for display
   */
  formatPlan(): string {
    if (!this.currentPlan) return 'No active plan';

    let output = `Goal: ${this.currentPlan.goal}\n\n`;
    output += `Phases:\n`;

    for (const phase of this.currentPlan.phases) {
      const status = phase.status === 'completed' ? '✓' :
                     phase.status === 'in_progress' ? '→' :
                     phase.status === 'skipped' ? '○' : '·';
      output += `${status} ${phase.id}. ${phase.title}\n`;
    }

    output += `\nProgress: ${this.getProgress()}%`;
    return output;
  }
}

export const planManager = new PlanManager();
```

---

## Todo.md Approach

### Todo.md Structure

The todo.md file serves as a persistent, human-readable record of task progress that survives across agent sessions and provides clear visibility into what has been completed.

```markdown
# Project TODO

## Features
- [x] Basic homepage layout
- [x] Navigation menu
- [x] User authentication system
- [ ] Dashboard with analytics
- [ ] API integration
- [ ] Payment processing

## Bug Fixes
- [x] Fix login redirect loop
- [ ] Handle empty state in user list
- [ ] Fix mobile menu z-index

## Improvements
- [ ] Add loading skeletons
- [ ] Optimize image loading
- [ ] Add error boundaries
```

### Todo Manager Implementation

```typescript
// server/agent/todoManager.ts

interface TodoItem {
  text: string;
  completed: boolean;
  category?: string;
  addedAt: Date;
  completedAt?: Date;
}

interface TodoFile {
  path: string;
  categories: Map<string, TodoItem[]>;
}

/**
 * Manage todo.md file for task tracking
 */
class TodoManager {
  private todoPath = '/home/ubuntu/project/todo.md';

  /**
   * Parse todo.md file
   */
  async parse(): Promise<TodoFile> {
    const content = await this.readFile();
    const categories = new Map<string, TodoItem[]>();
    
    let currentCategory = 'General';
    const lines = content.split('\n');

    for (const line of lines) {
      // Category header
      if (line.startsWith('## ')) {
        currentCategory = line.slice(3).trim();
        if (!categories.has(currentCategory)) {
          categories.set(currentCategory, []);
        }
        continue;
      }

      // Todo item
      const completedMatch = line.match(/^- \[x\] (.+)$/i);
      const pendingMatch = line.match(/^- \[ \] (.+)$/);

      if (completedMatch) {
        categories.get(currentCategory)?.push({
          text: completedMatch[1],
          completed: true,
          category: currentCategory,
          addedAt: new Date(),
          completedAt: new Date(),
        });
      } else if (pendingMatch) {
        categories.get(currentCategory)?.push({
          text: pendingMatch[1],
          completed: false,
          category: currentCategory,
          addedAt: new Date(),
        });
      }
    }

    return { path: this.todoPath, categories };
  }

  /**
   * Add new todo item
   */
  async addItem(text: string, category: string = 'Features'): Promise<void> {
    const content = await this.readFile();
    const categoryHeader = `## ${category}`;
    
    if (content.includes(categoryHeader)) {
      // Add under existing category
      const lines = content.split('\n');
      const categoryIndex = lines.findIndex(l => l === categoryHeader);
      
      // Find last item in category
      let insertIndex = categoryIndex + 1;
      while (insertIndex < lines.length && 
             (lines[insertIndex].startsWith('- [') || lines[insertIndex] === '')) {
        insertIndex++;
      }
      
      lines.splice(insertIndex, 0, `- [ ] ${text}`);
      await this.writeFile(lines.join('\n'));
    } else {
      // Create new category
      const newContent = content + `\n\n## ${category}\n- [ ] ${text}`;
      await this.writeFile(newContent);
    }
  }

  /**
   * Mark item as completed
   */
  async completeItem(text: string): Promise<boolean> {
    const content = await this.readFile();
    const pendingPattern = `- [ ] ${text}`;
    const completedPattern = `- [x] ${text}`;

    if (content.includes(pendingPattern)) {
      const newContent = content.replace(pendingPattern, completedPattern);
      await this.writeFile(newContent);
      return true;
    }

    return false;
  }

  /**
   * Get all pending items
   */
  async getPendingItems(): Promise<TodoItem[]> {
    const todo = await this.parse();
    const pending: TodoItem[] = [];

    for (const items of todo.categories.values()) {
      pending.push(...items.filter(i => !i.completed));
    }

    return pending;
  }

  /**
   * Get completion statistics
   */
  async getStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    percentage: number;
  }> {
    const todo = await this.parse();
    let total = 0;
    let completed = 0;

    for (const items of todo.categories.values()) {
      total += items.length;
      completed += items.filter(i => i.completed).length;
    }

    return {
      total,
      completed,
      pending: total - completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Initialize todo.md for new project
   */
  async initialize(features: string[]): Promise<void> {
    let content = '# Project TODO\n\n## Features\n';
    
    for (const feature of features) {
      content += `- [ ] ${feature}\n`;
    }

    content += '\n## Bug Fixes\n';
    content += '\n## Improvements\n';

    await this.writeFile(content);
  }

  /**
   * Sync todo with plan phases
   */
  async syncWithPlan(phases: Phase[]): Promise<void> {
    const content = await this.readFile();
    const lines = content.split('\n');
    
    // Find or create Phases section
    let phasesIndex = lines.findIndex(l => l === '## Phases');
    
    if (phasesIndex === -1) {
      lines.push('', '## Phases');
      phasesIndex = lines.length - 1;
    }

    // Remove old phase items
    let endIndex = phasesIndex + 1;
    while (endIndex < lines.length && !lines[endIndex].startsWith('## ')) {
      endIndex++;
    }
    lines.splice(phasesIndex + 1, endIndex - phasesIndex - 1);

    // Add current phases
    const phaseItems = phases.map(p => {
      const status = p.status === 'completed' ? 'x' : ' ';
      return `- [${status}] Phase ${p.id}: ${p.title}`;
    });
    lines.splice(phasesIndex + 1, 0, ...phaseItems);

    await this.writeFile(lines.join('\n'));
  }

  /**
   * Read todo file
   */
  private async readFile(): Promise<string> {
    try {
      const fs = await import('fs/promises');
      return await fs.readFile(this.todoPath, 'utf-8');
    } catch {
      return '# Project TODO\n';
    }
  }

  /**
   * Write todo file
   */
  private async writeFile(content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(this.todoPath, content);
  }
}

export const todoManager = new TodoManager();
```

### Todo.md Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TODO.MD WORKFLOW                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. PROJECT START                                                                       │
│     │                                                                                   │
│     ├── Create todo.md with initial features                                            │
│     └── Sync with task plan phases                                                      │
│                                                                                         │
│  2. NEW REQUIREMENTS                                                                    │
│     │                                                                                   │
│     ├── User requests new feature                                                       │
│     ├── Add [ ] item to todo.md IMMEDIATELY                                             │
│     └── Update task plan if needed                                                      │
│                                                                                         │
│  3. FEATURE COMPLETION                                                                  │
│     │                                                                                   │
│     ├── Implement feature                                                               │
│     ├── Mark [x] in todo.md IMMEDIATELY                                                 │
│     └── Advance plan phase if applicable                                                │
│                                                                                         │
│  4. BEFORE CHECKPOINT                                                                   │
│     │                                                                                   │
│     ├── Read todo.md                                                                    │
│     ├── Verify all completed items marked [x]                                           │
│     └── Save checkpoint                                                                 │
│                                                                                         │
│  5. SESSION RESUME                                                                      │
│     │                                                                                   │
│     ├── Read todo.md to understand state                                                │
│     └── Continue with pending items                                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Execution

### Execution Engine

```typescript
// server/agent/executionEngine.ts

interface ExecutionStep {
  id: string;
  description: string;
  tool: string;
  params: Record<string, any>;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

interface ExecutionPlan {
  steps: ExecutionStep[];
  currentStepIndex: number;
}

/**
 * Execute tasks step by step
 */
class ExecutionEngine {
  private plan: ExecutionPlan | null = null;
  private stepHistory: ExecutionStep[] = [];

  /**
   * Create execution plan from high-level task
   */
  createPlan(task: string, context: any): ExecutionPlan {
    // This would typically involve LLM reasoning
    // Simplified example:
    const steps = this.decomposeTask(task, context);
    
    this.plan = {
      steps,
      currentStepIndex: 0,
    };

    return this.plan;
  }

  /**
   * Execute next step
   */
  async executeNextStep(): Promise<ExecutionStep | null> {
    if (!this.plan) return null;
    if (this.plan.currentStepIndex >= this.plan.steps.length) return null;

    const step = this.plan.steps[this.plan.currentStepIndex];

    // Check dependencies
    if (!this.areDependenciesMet(step)) {
      step.status = 'skipped';
      step.error = 'Dependencies not met';
      this.plan.currentStepIndex++;
      return step;
    }

    step.status = 'running';

    try {
      // Execute the step
      const result = await this.executeStep(step);
      step.status = 'completed';
      step.result = result;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.stepHistory.push({ ...step });
    this.plan.currentStepIndex++;

    return step;
  }

  /**
   * Execute all remaining steps
   */
  async executeAll(): Promise<ExecutionStep[]> {
    const results: ExecutionStep[] = [];

    while (this.plan && this.plan.currentStepIndex < this.plan.steps.length) {
      const step = await this.executeNextStep();
      if (step) results.push(step);

      // Stop on critical failure
      if (step?.status === 'failed' && this.isCriticalStep(step)) {
        break;
      }
    }

    return results;
  }

  /**
   * Decompose task into steps
   */
  private decomposeTask(task: string, context: any): ExecutionStep[] {
    // Example decomposition for "Create a React component"
    if (task.includes('React component')) {
      return [
        {
          id: 'step-1',
          description: 'Create component file',
          tool: 'file.write',
          params: { path: 'src/components/NewComponent.tsx' },
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step-2',
          description: 'Add component to exports',
          tool: 'file.edit',
          params: { path: 'src/components/index.ts' },
          dependencies: ['step-1'],
          status: 'pending',
        },
        {
          id: 'step-3',
          description: 'Create test file',
          tool: 'file.write',
          params: { path: 'src/components/NewComponent.test.tsx' },
          dependencies: ['step-1'],
          status: 'pending',
        },
        {
          id: 'step-4',
          description: 'Run tests',
          tool: 'shell.exec',
          params: { command: 'pnpm test NewComponent' },
          dependencies: ['step-3'],
          status: 'pending',
        },
      ];
    }

    // Default single step
    return [{
      id: 'step-1',
      description: task,
      tool: 'shell.exec',
      params: { command: task },
      dependencies: [],
      status: 'pending',
    }];
  }

  /**
   * Check if step dependencies are met
   */
  private areDependenciesMet(step: ExecutionStep): boolean {
    if (!this.plan) return false;

    for (const depId of step.dependencies) {
      const dep = this.plan.steps.find(s => s.id === depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: ExecutionStep): Promise<any> {
    // This would call the actual tool
    // Simplified placeholder
    return { success: true };
  }

  /**
   * Check if step failure is critical
   */
  private isCriticalStep(step: ExecutionStep): boolean {
    // Steps that must succeed
    const criticalPatterns = [
      'database',
      'migration',
      'authentication',
      'security',
    ];

    return criticalPatterns.some(p => 
      step.description.toLowerCase().includes(p)
    );
  }

  /**
   * Get execution summary
   */
  getSummary(): {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    pending: number;
  } {
    if (!this.plan) {
      return { total: 0, completed: 0, failed: 0, skipped: 0, pending: 0 };
    }

    const steps = this.plan.steps;
    return {
      total: steps.length,
      completed: steps.filter(s => s.status === 'completed').length,
      failed: steps.filter(s => s.status === 'failed').length,
      skipped: steps.filter(s => s.status === 'skipped').length,
      pending: steps.filter(s => s.status === 'pending').length,
    };
  }
}

export const executionEngine = new ExecutionEngine();
```

### Step Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           STEP-BY-STEP EXECUTION FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  TASK: "Add user authentication"                                                        │
│                                                                                         │
│  Step 1: Update database schema                                                         │
│  ├── Tool: file.edit                                                                    │
│  ├── Target: drizzle/schema.ts                                                          │
│  ├── Dependencies: none                                                                 │
│  └── Status: ✓ Completed                                                                │
│                                                                                         │
│  Step 2: Run database migration                                                         │
│  ├── Tool: shell.exec                                                                   │
│  ├── Command: pnpm db:push                                                              │
│  ├── Dependencies: Step 1                                                               │
│  └── Status: ✓ Completed                                                                │
│                                                                                         │
│  Step 3: Create auth router                                                             │
│  ├── Tool: file.write                                                                   │
│  ├── Target: server/routers/auth.ts                                                     │
│  ├── Dependencies: Step 2                                                               │
│  └── Status: → Running                                                                  │
│                                                                                         │
│  Step 4: Add auth middleware                                                            │
│  ├── Tool: file.edit                                                                    │
│  ├── Target: server/_core/context.ts                                                    │
│  ├── Dependencies: Step 3                                                               │
│  └── Status: · Pending                                                                  │
│                                                                                         │
│  Step 5: Create login UI                                                                │
│  ├── Tool: file.write                                                                   │
│  ├── Target: client/src/pages/Login.tsx                                                 │
│  ├── Dependencies: Step 3                                                               │
│  └── Status: · Pending                                                                  │
│                                                                                         │
│  Step 6: Write tests                                                                    │
│  ├── Tool: file.write                                                                   │
│  ├── Target: server/auth.test.ts                                                        │
│  ├── Dependencies: Step 3, Step 4                                                       │
│  └── Status: · Pending                                                                  │
│                                                                                         │
│  Step 7: Run tests                                                                      │
│  ├── Tool: shell.exec                                                                   │
│  ├── Command: pnpm test auth                                                            │
│  ├── Dependencies: Step 6                                                               │
│  └── Status: · Pending                                                                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Management

### Phase Complexity Guidelines

| Complexity | Phase Count | Example Tasks |
|------------|-------------|---------------|
| **Simple** | 2-3 | Fix typo, add button |
| **Typical** | 4-6 | Add feature, create page |
| **Complex** | 7-10 | Full CRUD, authentication |
| **Large** | 10+ | Multi-feature project |

### Phase Transitions

```typescript
// server/agent/phaseTransition.ts

interface PhaseTransitionRule {
  fromPhase: string;
  toPhase: string;
  conditions: TransitionCondition[];
  actions: TransitionAction[];
}

interface TransitionCondition {
  type: 'all_steps_complete' | 'tests_pass' | 'no_errors' | 'user_approval';
  params?: Record<string, any>;
}

interface TransitionAction {
  type: 'save_checkpoint' | 'notify_user' | 'run_tests' | 'update_todo';
  params?: Record<string, any>;
}

/**
 * Manage phase transitions
 */
class PhaseTransitionManager {
  private rules: PhaseTransitionRule[] = [];

  /**
   * Add transition rule
   */
  addRule(rule: PhaseTransitionRule): void {
    this.rules.push(rule);
  }

  /**
   * Check if transition is allowed
   */
  async canTransition(
    fromPhase: Phase,
    toPhase: Phase,
    context: any
  ): Promise<{ allowed: boolean; blockers: string[] }> {
    const blockers: string[] = [];

    // Find applicable rules
    const rules = this.rules.filter(r => 
      r.fromPhase === fromPhase.title || r.fromPhase === '*'
    );

    for (const rule of rules) {
      for (const condition of rule.conditions) {
        const met = await this.checkCondition(condition, context);
        if (!met) {
          blockers.push(this.describeCondition(condition));
        }
      }
    }

    return {
      allowed: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Execute transition
   */
  async executeTransition(
    fromPhase: Phase,
    toPhase: Phase,
    context: any
  ): Promise<void> {
    // Find applicable rules
    const rules = this.rules.filter(r => 
      r.fromPhase === fromPhase.title || r.fromPhase === '*'
    );

    // Execute actions
    for (const rule of rules) {
      for (const action of rule.actions) {
        await this.executeAction(action, context);
      }
    }
  }

  /**
   * Check a condition
   */
  private async checkCondition(
    condition: TransitionCondition,
    context: any
  ): Promise<boolean> {
    switch (condition.type) {
      case 'all_steps_complete':
        return context.steps?.every((s: any) => 
          s.status === 'completed' || s.status === 'skipped'
        );

      case 'tests_pass':
        return context.testResults?.success === true;

      case 'no_errors':
        return !context.errors || context.errors.length === 0;

      case 'user_approval':
        return context.userApproved === true;

      default:
        return true;
    }
  }

  /**
   * Execute a transition action
   */
  private async executeAction(
    action: TransitionAction,
    context: any
  ): Promise<void> {
    switch (action.type) {
      case 'save_checkpoint':
        // Save checkpoint
        break;

      case 'notify_user':
        // Send notification
        break;

      case 'run_tests':
        // Execute tests
        break;

      case 'update_todo':
        // Update todo.md
        break;
    }
  }

  /**
   * Describe condition for error message
   */
  private describeCondition(condition: TransitionCondition): string {
    const descriptions: Record<string, string> = {
      all_steps_complete: 'All steps must be completed',
      tests_pass: 'All tests must pass',
      no_errors: 'No errors must be present',
      user_approval: 'User approval required',
    };

    return descriptions[condition.type] || condition.type;
  }
}

export const phaseTransitionManager = new PhaseTransitionManager();

// Default rules
phaseTransitionManager.addRule({
  fromPhase: '*',
  toPhase: '*',
  conditions: [
    { type: 'all_steps_complete' },
  ],
  actions: [
    { type: 'update_todo' },
  ],
});

phaseTransitionManager.addRule({
  fromPhase: 'Implementation',
  toPhase: 'Testing',
  conditions: [
    { type: 'no_errors' },
  ],
  actions: [
    { type: 'run_tests' },
  ],
});

phaseTransitionManager.addRule({
  fromPhase: 'Testing',
  toPhase: 'Delivery',
  conditions: [
    { type: 'tests_pass' },
  ],
  actions: [
    { type: 'save_checkpoint' },
    { type: 'notify_user' },
  ],
});
```

---

## Self-Correction Mechanisms

### Error Detection and Recovery

```typescript
// server/agent/selfCorrection.ts

interface CorrectionStrategy {
  errorPattern: RegExp;
  correction: (error: string, context: CorrectionContext) => Promise<CorrectionAction>;
}

interface CorrectionContext {
  lastAction: {
    tool: string;
    params: Record<string, any>;
    result: any;
  };
  history: Array<{
    tool: string;
    params: Record<string, any>;
    result: any;
  }>;
  attempt: number;
}

interface CorrectionAction {
  type: 'retry' | 'modify' | 'alternative' | 'abort' | 'ask_user';
  modifiedParams?: Record<string, any>;
  alternativeAction?: {
    tool: string;
    params: Record<string, any>;
  };
  message?: string;
}

/**
 * Self-correction system for agent errors
 */
class SelfCorrectionSystem {
  private strategies: CorrectionStrategy[] = [];
  private maxAttempts = 3;

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Initialize built-in correction strategies
   */
  private initializeStrategies(): void {
    // File not found - try to find correct path
    this.strategies.push({
      errorPattern: /no such file or directory|ENOENT/i,
      correction: async (error, context) => {
        const path = context.lastAction.params.path;
        
        if (context.attempt >= 2) {
          return {
            type: 'alternative',
            alternativeAction: {
              tool: 'shell.exec',
              params: {
                command: `find /home/ubuntu -name "${path.split('/').pop()}" 2>/dev/null | head -5`,
                brief: 'Search for file',
              },
            },
            message: 'File not found, searching for alternatives',
          };
        }

        // Try common path corrections
        const corrections = [
          path.replace('/home/ubuntu/', './'),
          path.replace('./', '/home/ubuntu/'),
          `/home/ubuntu/${path}`,
        ];

        return {
          type: 'modify',
          modifiedParams: {
            ...context.lastAction.params,
            path: corrections[context.attempt],
          },
        };
      },
    });

    // Syntax error - ask for review
    this.strategies.push({
      errorPattern: /syntax error|unexpected token|parsing error/i,
      correction: async (error, context) => {
        return {
          type: 'alternative',
          alternativeAction: {
            tool: 'file.read',
            params: {
              path: context.lastAction.params.path,
              brief: 'Read file to review syntax',
            },
          },
          message: 'Syntax error detected, reviewing file content',
        };
      },
    });

    // Command not found - try to install
    this.strategies.push({
      errorPattern: /command not found|not recognized/i,
      correction: async (error, context) => {
        const command = context.lastAction.params.command?.split(' ')[0];
        
        return {
          type: 'alternative',
          alternativeAction: {
            tool: 'shell.exec',
            params: {
              command: `which ${command} || apt-cache search ${command} | head -5`,
              brief: `Check if ${command} is available`,
            },
          },
          message: `Command "${command}" not found, checking availability`,
        };
      },
    });

    // Permission denied - suggest sudo
    this.strategies.push({
      errorPattern: /permission denied|EACCES/i,
      correction: async (error, context) => {
        if (context.lastAction.tool === 'shell.exec') {
          const command = context.lastAction.params.command;
          
          // Don't auto-sudo dangerous commands
          if (/rm|mv|chmod|chown/.test(command)) {
            return {
              type: 'ask_user',
              message: `Permission denied. Should I retry with sudo? Command: ${command}`,
            };
          }

          return {
            type: 'modify',
            modifiedParams: {
              ...context.lastAction.params,
              command: `sudo ${command}`,
            },
          };
        }

        return { type: 'abort', message: 'Permission denied' };
      },
    });

    // Timeout - increase timeout and retry
    this.strategies.push({
      errorPattern: /timeout|timed out/i,
      correction: async (error, context) => {
        const currentTimeout = context.lastAction.params.timeout || 30000;
        const newTimeout = currentTimeout * 2;

        if (newTimeout > 300000) {
          return {
            type: 'abort',
            message: 'Operation timed out after maximum retries',
          };
        }

        return {
          type: 'modify',
          modifiedParams: {
            ...context.lastAction.params,
            timeout: newTimeout,
          },
        };
      },
    });

    // Import/module not found - try to install
    this.strategies.push({
      errorPattern: /cannot find module|module not found|import error/i,
      correction: async (error, context) => {
        // Extract module name from error
        const moduleMatch = error.match(/['"]([^'"]+)['"]/);
        const moduleName = moduleMatch?.[1];

        if (moduleName) {
          return {
            type: 'alternative',
            alternativeAction: {
              tool: 'shell.exec',
              params: {
                command: `pnpm add ${moduleName}`,
                brief: `Install missing module: ${moduleName}`,
              },
            },
            message: `Module "${moduleName}" not found, attempting to install`,
          };
        }

        return { type: 'abort', message: 'Could not determine missing module' };
      },
    });
  }

  /**
   * Attempt to correct an error
   */
  async correct(
    error: string,
    context: CorrectionContext
  ): Promise<CorrectionAction> {
    // Check attempt limit
    if (context.attempt >= this.maxAttempts) {
      return {
        type: 'abort',
        message: `Max correction attempts (${this.maxAttempts}) exceeded`,
      };
    }

    // Check for repeated errors
    if (this.isRepeatedError(error, context)) {
      return {
        type: 'abort',
        message: 'Same error repeated, stopping to avoid infinite loop',
      };
    }

    // Find matching strategy
    for (const strategy of this.strategies) {
      if (strategy.errorPattern.test(error)) {
        return strategy.correction(error, context);
      }
    }

    // No matching strategy
    return {
      type: 'ask_user',
      message: `Unexpected error: ${error}. How should I proceed?`,
    };
  }

  /**
   * Check if error is repeated
   */
  private isRepeatedError(error: string, context: CorrectionContext): boolean {
    const recentErrors = context.history
      .slice(-3)
      .filter(h => h.result?.error)
      .map(h => h.result.error);

    const similarErrors = recentErrors.filter(e => 
      this.errorSimilarity(e, error) > 0.8
    );

    return similarErrors.length >= 2;
  }

  /**
   * Calculate error similarity
   */
  private errorSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  /**
   * Add custom correction strategy
   */
  addStrategy(strategy: CorrectionStrategy): void {
    this.strategies.unshift(strategy); // Add to front for priority
  }
}

export const selfCorrectionSystem = new SelfCorrectionSystem();
```

### Self-Correction Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SELF-CORRECTION FLOW                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  1. ERROR DETECTED                                                                      │
│     │                                                                                   │
│     ▼                                                                                   │
│  2. CLASSIFY ERROR                                                                      │
│     ├── File not found?                                                                 │
│     ├── Syntax error?                                                                   │
│     ├── Permission denied?                                                              │
│     ├── Timeout?                                                                        │
│     └── Unknown?                                                                        │
│     │                                                                                   │
│     ▼                                                                                   │
│  3. CHECK ATTEMPT COUNT                                                                 │
│     ├── < 3 attempts → Continue                                                         │
│     └── >= 3 attempts → Abort                                                           │
│     │                                                                                   │
│     ▼                                                                                   │
│  4. CHECK FOR LOOPS                                                                     │
│     ├── Same error repeated? → Abort                                                    │
│     └── New error → Continue                                                            │
│     │                                                                                   │
│     ▼                                                                                   │
│  5. SELECT CORRECTION                                                                   │
│     ├── Retry with modifications                                                        │
│     ├── Try alternative approach                                                        │
│     ├── Ask user for guidance                                                           │
│     └── Abort with explanation                                                          │
│     │                                                                                   │
│     ▼                                                                                   │
│  6. EXECUTE CORRECTION                                                                  │
│     │                                                                                   │
│     ▼                                                                                   │
│  7. EVALUATE RESULT                                                                     │
│     ├── Success → Continue task                                                         │
│     └── Failure → Return to step 1                                                      │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Adaptive Planning

### Plan Revision Triggers

```typescript
// server/agent/adaptivePlanning.ts

interface RevisionTrigger {
  name: string;
  check: (context: AdaptiveContext) => boolean;
  action: (context: AdaptiveContext) => PlanRevision;
}

interface AdaptiveContext {
  currentPlan: TaskPlan;
  executionHistory: ExecutionStep[];
  userMessages: string[];
  errors: string[];
  elapsedTime: number;
}

interface PlanRevision {
  type: 'add_phase' | 'remove_phase' | 'reorder' | 'replace' | 'complete_replan';
  reason: string;
  changes: any;
}

/**
 * Adaptive planning system
 */
class AdaptivePlanningSystem {
  private triggers: RevisionTrigger[] = [];

  constructor() {
    this.initializeTriggers();
  }

  /**
   * Initialize built-in triggers
   */
  private initializeTriggers(): void {
    // New user requirement
    this.triggers.push({
      name: 'new_requirement',
      check: (ctx) => {
        const recentMessages = ctx.userMessages.slice(-3);
        return recentMessages.some(m => 
          /add|include|also|another|new feature/i.test(m)
        );
      },
      action: (ctx) => ({
        type: 'add_phase',
        reason: 'New user requirement detected',
        changes: {
          newPhase: {
            title: 'Implement new requirement',
            capabilities: { web_development: true },
          },
        },
      }),
    });

    // Repeated failures
    this.triggers.push({
      name: 'repeated_failures',
      check: (ctx) => {
        const recentSteps = ctx.executionHistory.slice(-5);
        const failures = recentSteps.filter(s => s.status === 'failed');
        return failures.length >= 3;
      },
      action: (ctx) => ({
        type: 'replace',
        reason: 'Multiple failures indicate approach needs revision',
        changes: {
          replacePhase: ctx.currentPlan.currentPhaseId,
          withAlternative: true,
        },
      }),
    });

    // Taking too long
    this.triggers.push({
      name: 'time_exceeded',
      check: (ctx) => {
        const expectedTime = ctx.currentPlan.phases.length * 60000; // 1 min per phase
        return ctx.elapsedTime > expectedTime * 2;
      },
      action: (ctx) => ({
        type: 'reorder',
        reason: 'Task taking longer than expected, prioritizing critical phases',
        changes: {
          prioritize: ['core_functionality', 'delivery'],
          defer: ['optimization', 'documentation'],
        },
      }),
    });

    // Scope creep detection
    this.triggers.push({
      name: 'scope_creep',
      check: (ctx) => {
        const originalPhases = 5; // Assume original
        return ctx.currentPlan.phases.length > originalPhases * 1.5;
      },
      action: (ctx) => ({
        type: 'complete_replan',
        reason: 'Significant scope expansion detected',
        changes: {
          consolidate: true,
          focusOnCore: true,
        },
      }),
    });

    // User frustration signals
    this.triggers.push({
      name: 'user_frustration',
      check: (ctx) => {
        const recentMessages = ctx.userMessages.slice(-3);
        return recentMessages.some(m => 
          /not working|wrong|broken|fix|issue|problem|bug/i.test(m)
        );
      },
      action: (ctx) => ({
        type: 'add_phase',
        reason: 'User reported issues, adding debugging phase',
        changes: {
          insertBefore: ctx.currentPlan.currentPhaseId,
          newPhase: {
            title: 'Debug and fix reported issues',
            capabilities: { web_development: true },
          },
        },
      }),
    });
  }

  /**
   * Check for plan revision needs
   */
  checkForRevision(context: AdaptiveContext): PlanRevision | null {
    for (const trigger of this.triggers) {
      if (trigger.check(context)) {
        return trigger.action(context);
      }
    }
    return null;
  }

  /**
   * Apply plan revision
   */
  applyRevision(
    plan: TaskPlan,
    revision: PlanRevision
  ): TaskPlan {
    const newPlan = { ...plan, phases: [...plan.phases] };

    switch (revision.type) {
      case 'add_phase':
        const insertIndex = revision.changes.insertBefore 
          ? revision.changes.insertBefore - 1 
          : newPlan.phases.length;
        
        newPlan.phases.splice(insertIndex, 0, {
          id: insertIndex + 1,
          ...revision.changes.newPhase,
          status: 'pending',
        });
        
        // Renumber phases
        newPlan.phases.forEach((p, i) => { p.id = i + 1; });
        break;

      case 'remove_phase':
        newPlan.phases = newPlan.phases.filter(
          p => p.id !== revision.changes.phaseId
        );
        newPlan.phases.forEach((p, i) => { p.id = i + 1; });
        break;

      case 'reorder':
        // Sort by priority
        newPlan.phases.sort((a, b) => {
          const aPriority = revision.changes.prioritize.includes(a.title) ? 0 : 1;
          const bPriority = revision.changes.prioritize.includes(b.title) ? 0 : 1;
          return aPriority - bPriority;
        });
        newPlan.phases.forEach((p, i) => { p.id = i + 1; });
        break;

      case 'complete_replan':
        // This would trigger a full replanning with LLM
        break;
    }

    newPlan.updatedAt = new Date();
    return newPlan;
  }

  /**
   * Add custom trigger
   */
  addTrigger(trigger: RevisionTrigger): void {
    this.triggers.push(trigger);
  }
}

export const adaptivePlanningSystem = new AdaptivePlanningSystem();
```

---

## Progress Tracking

### Progress Reporter

```typescript
// server/agent/progressReporter.ts

interface ProgressUpdate {
  phase: string;
  step: string;
  percentage: number;
  message: string;
  timestamp: Date;
}

interface ProgressSummary {
  overallProgress: number;
  currentPhase: string;
  completedPhases: number;
  totalPhases: number;
  estimatedTimeRemaining: number;
  recentUpdates: ProgressUpdate[];
}

/**
 * Track and report task progress
 */
class ProgressReporter {
  private updates: ProgressUpdate[] = [];
  private startTime: Date = new Date();
  private phaseStartTimes: Map<string, Date> = new Map();

  /**
   * Report progress update
   */
  report(update: Omit<ProgressUpdate, 'timestamp'>): void {
    this.updates.push({
      ...update,
      timestamp: new Date(),
    });

    // Track phase start
    if (!this.phaseStartTimes.has(update.phase)) {
      this.phaseStartTimes.set(update.phase, new Date());
    }
  }

  /**
   * Get progress summary
   */
  getSummary(plan: TaskPlan): ProgressSummary {
    const completedPhases = plan.phases.filter(p => p.status === 'completed').length;
    const currentPhase = plan.phases.find(p => p.status === 'in_progress');

    // Calculate overall progress
    const phaseProgress = completedPhases / plan.phases.length;
    const currentPhaseProgress = this.getCurrentPhaseProgress(currentPhase);
    const overallProgress = Math.round(
      (phaseProgress + currentPhaseProgress / plan.phases.length) * 100
    );

    // Estimate time remaining
    const elapsed = Date.now() - this.startTime.getTime();
    const progressRate = overallProgress / elapsed;
    const estimatedTimeRemaining = progressRate > 0 
      ? (100 - overallProgress) / progressRate 
      : 0;

    return {
      overallProgress,
      currentPhase: currentPhase?.title || 'Unknown',
      completedPhases,
      totalPhases: plan.phases.length,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining / 1000), // seconds
      recentUpdates: this.updates.slice(-5),
    };
  }

  /**
   * Get current phase progress
   */
  private getCurrentPhaseProgress(phase?: Phase): number {
    if (!phase) return 0;

    const phaseUpdates = this.updates.filter(u => u.phase === phase.title);
    if (phaseUpdates.length === 0) return 0;

    return phaseUpdates[phaseUpdates.length - 1].percentage / 100;
  }

  /**
   * Format progress for user display
   */
  formatForUser(summary: ProgressSummary): string {
    const bar = this.createProgressBar(summary.overallProgress);
    
    let output = `Progress: ${bar} ${summary.overallProgress}%\n`;
    output += `Phase: ${summary.currentPhase} (${summary.completedPhases}/${summary.totalPhases})\n`;
    
    if (summary.estimatedTimeRemaining > 0) {
      output += `Est. remaining: ${this.formatTime(summary.estimatedTimeRemaining)}\n`;
    }

    return output;
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Format time duration
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  /**
   * Reset progress tracking
   */
  reset(): void {
    this.updates = [];
    this.startTime = new Date();
    this.phaseStartTimes.clear();
  }
}

export const progressReporter = new ProgressReporter();
```

---

## Best Practices

### Planning Guidelines

| Aspect | Best Practice | Anti-Pattern |
|--------|---------------|--------------|
| **Initial Plan** | Create before any execution | Start coding immediately |
| **Phase Size** | 1-3 major tasks per phase | Too granular or too broad |
| **Dependencies** | Explicit in plan | Implicit assumptions |
| **Updates** | When requirements change | Ignore new information |
| **Todo.md** | Update immediately | Batch updates at end |

### Self-Correction Rules

| Error Type | Max Retries | Strategy |
|------------|-------------|----------|
| File not found | 3 | Search for alternatives |
| Syntax error | 2 | Review and fix |
| Timeout | 2 | Increase timeout |
| Permission | 1 | Ask user |
| Unknown | 1 | Ask user |

### Progress Communication

| Event | Communication Type | Content |
|-------|-------------------|---------|
| Phase start | Info message | "Starting phase X..." |
| Milestone | Info message | "Completed Y..." |
| Error | Info message | "Encountered issue, retrying..." |
| Blocker | Ask message | "Need input on..." |
| Completion | Result message | Final deliverables |

---

## Summary

### Planning Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              PLANNING STRATEGY SUMMARY                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PLAN TOOL                    TODO.MD                      EXECUTION                    │
│  ├── Goal definition          ├── Feature tracking         ├── Step-by-step            │
│  ├── Phase breakdown          ├── Bug tracking             ├── Dependency order         │
│  ├── Capability mapping       ├── Progress markers         ├── Error handling           │
│  └── Phase advancement        └── Session persistence      └── Result capture           │
│                                                                                         │
│  SELF-CORRECTION              ADAPTIVE PLANNING            PROGRESS                     │
│  ├── Error classification     ├── Trigger detection        ├── Phase tracking           │
│  ├── Strategy selection       ├── Plan revision            ├── Time estimation          │
│  ├── Retry with mods          ├── Scope management         ├── User updates             │
│  └── Loop prevention          └── Priority adjustment      └── Summary reports          │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
