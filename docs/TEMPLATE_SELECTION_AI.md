# AI-Powered Template Selection Guide

## Overview

Template selection is a critical UX decision that determines project success. This guide covers three approaches: explicit user selection, AI inference from project descriptions, and a hybrid approach that combines both for optimal results.

---

## 1. Template Selection Approaches

### Comparison Matrix

| Approach | User Control | Accuracy | Speed | Complexity | Best For |
|----------|-------------|----------|-------|------------|----------|
| **Explicit Selection** | 100% | 100% | Fast | Low | Power users, specific needs |
| **AI Inference** | 0% | 85-95% | Medium | High | New users, vague requirements |
| **Hybrid** ⭐ | 50-100% | 95-99% | Medium | Medium | All users, best UX |

### Recommendation: **Hybrid Approach**

The hybrid approach provides the best user experience by:
1. AI suggests templates based on project description
2. User can accept, modify, or override suggestions
3. AI learns from user choices to improve future suggestions

---

## 2. Explicit User Selection

### Implementation

```typescript
// Template selection UI component
interface TemplateSelectionProps {
  templates: Template[];
  onSelect: (template: Template) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  features: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedSetupTime: string;
  popularity: number;
  rating: number;
}

type TemplateCategory = 
  | 'web-static'
  | 'web-db-user'
  | 'web-ai-agent'
  | 'mobile-app'
  | 'data-pipeline'
  | 'api-service'
  | 'dashboard';

class ExplicitTemplateSelector {
  private templates: Template[];

  constructor(templates: Template[]) {
    this.templates = templates;
  }

  // Get all templates
  getAllTemplates(): Template[] {
    return this.templates;
  }

  // Filter by category
  filterByCategory(category: TemplateCategory): Template[] {
    return this.templates.filter(t => t.category === category);
  }

  // Filter by tags
  filterByTags(tags: string[]): Template[] {
    return this.templates.filter(t => 
      tags.some(tag => t.tags.includes(tag))
    );
  }

  // Filter by features
  filterByFeatures(features: string[]): Template[] {
    return this.templates.filter(t =>
      features.every(feature => t.features.includes(feature))
    );
  }

  // Filter by complexity
  filterByComplexity(complexity: Template['complexity']): Template[] {
    return this.templates.filter(t => t.complexity === complexity);
  }

  // Search templates
  search(query: string): Template[] {
    const lowerQuery = query.toLowerCase();
    return this.templates.filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Sort by popularity
  sortByPopularity(): Template[] {
    return [...this.templates].sort((a, b) => b.popularity - a.popularity);
  }

  // Sort by rating
  sortByRating(): Template[] {
    return [...this.templates].sort((a, b) => b.rating - a.rating);
  }

  // Get recommended templates for beginners
  getBeginnerRecommendations(): Template[] {
    return this.templates
      .filter(t => t.complexity === 'beginner')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }
}

// Template catalog with all available templates
const templateCatalog: Template[] = [
  {
    id: 'web-static',
    name: 'Web Static',
    description: 'Fast, static websites and landing pages with React and Tailwind',
    category: 'web-static',
    tags: ['react', 'tailwind', 'vite', 'static', 'landing-page'],
    features: ['seo', 'responsive', 'fast-loading'],
    complexity: 'beginner',
    estimatedSetupTime: '5 minutes',
    popularity: 9500,
    rating: 4.8
  },
  {
    id: 'web-db-user',
    name: 'Web DB User',
    description: 'Full-stack web app with database, authentication, and real-time features',
    category: 'web-db-user',
    tags: ['react', 'express', 'mysql', 'auth', 'trpc', 'full-stack'],
    features: ['database', 'auth', 'real-time', 'dashboard'],
    complexity: 'intermediate',
    estimatedSetupTime: '15 minutes',
    popularity: 12000,
    rating: 4.9
  },
  {
    id: 'web-ai-agent',
    name: 'Web AI Agent',
    description: 'AI-powered applications with LLM integration and streaming responses',
    category: 'web-ai-agent',
    tags: ['react', 'openai', 'anthropic', 'llm', 'ai', 'chatbot'],
    features: ['llm', 'streaming', 'multi-provider', 'conversation'],
    complexity: 'advanced',
    estimatedSetupTime: '20 minutes',
    popularity: 8500,
    rating: 4.7
  },
  {
    id: 'mobile-app',
    name: 'Mobile App',
    description: 'Cross-platform mobile applications with React Native and Expo',
    category: 'mobile-app',
    tags: ['react-native', 'expo', 'ios', 'android', 'mobile'],
    features: ['cross-platform', 'native', 'offline'],
    complexity: 'intermediate',
    estimatedSetupTime: '15 minutes',
    popularity: 7000,
    rating: 4.6
  },
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'ETL workflows, batch jobs, and data processing pipelines',
    category: 'data-pipeline',
    tags: ['nodejs', 'bull', 'redis', 'etl', 'jobs'],
    features: ['job-queue', 'scheduling', 'monitoring'],
    complexity: 'advanced',
    estimatedSetupTime: '20 minutes',
    popularity: 4500,
    rating: 4.5
  },
  {
    id: 'api-service',
    name: 'API Service',
    description: 'RESTful APIs and microservices with Express and OpenAPI',
    category: 'api-service',
    tags: ['express', 'openapi', 'rest', 'microservice', 'api'],
    features: ['rest', 'openapi', 'validation', 'rate-limiting'],
    complexity: 'intermediate',
    estimatedSetupTime: '10 minutes',
    popularity: 6000,
    rating: 4.7
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Analytics dashboards with charts, tables, and real-time data',
    category: 'dashboard',
    tags: ['react', 'recharts', 'analytics', 'dashboard', 'admin'],
    features: ['charts', 'tables', 'real-time', 'export'],
    complexity: 'intermediate',
    estimatedSetupTime: '15 minutes',
    popularity: 5500,
    rating: 4.6
  }
];
```

### Explicit Selection UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEMPLATE SELECTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔍 Search templates...                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Filter by:  [Category ▼]  [Features ▼]  [Complexity ▼]        │
│                                                                 │
│  Sort by:    ○ Popular  ○ Rating  ○ Newest                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  📄 Web Static  │  │  🗄️ Web DB User │  │  🤖 AI Agent    │ │
│  │                 │  │                 │  │                 │ │
│  │  Landing pages  │  │  Full-stack     │  │  AI chatbots    │ │
│  │  & static sites │  │  applications   │  │  & assistants   │ │
│  │                 │  │                 │  │                 │ │
│  │  ⭐ 4.8  👥 9.5k │  │  ⭐ 4.9  👥 12k │  │  ⭐ 4.7  👥 8.5k │ │
│  │                 │  │                 │  │                 │ │
│  │  [Select]       │  │  [Select]       │  │  [Select]       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  📱 Mobile App  │  │  🔄 Data Pipeline│  │  🔌 API Service │ │
│  │                 │  │                 │  │                 │ │
│  │  iOS & Android  │  │  ETL & batch    │  │  REST APIs &    │ │
│  │  applications   │  │  processing     │  │  microservices  │ │
│  │                 │  │                 │  │                 │ │
│  │  ⭐ 4.6  👥 7k  │  │  ⭐ 4.5  👥 4.5k │  │  ⭐ 4.7  👥 6k  │ │
│  │                 │  │                 │  │                 │ │
│  │  [Select]       │  │  [Select]       │  │  [Select]       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Inference from Project Description

### Implementation

```typescript
import { invokeLLM } from './llm';

interface ProjectDescription {
  description: string;
  features?: string[];
  targetPlatform?: string;
  complexity?: string;
  timeline?: string;
}

interface TemplateRecommendation {
  templateId: string;
  confidence: number; // 0-1
  reasoning: string;
  matchedKeywords: string[];
  suggestedFeatures: string[];
  estimatedEffort: string;
}

interface AIInferenceResult {
  recommendations: TemplateRecommendation[];
  clarifyingQuestions?: string[];
  warnings?: string[];
}

class AITemplateInference {
  private templates: Template[];
  private keywordMap: Map<string, string[]>;

  constructor(templates: Template[]) {
    this.templates = templates;
    this.keywordMap = this.buildKeywordMap();
  }

  // Build keyword to template mapping
  private buildKeywordMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    
    // Web-static keywords
    const webStaticKeywords = [
      'landing page', 'marketing site', 'portfolio', 'blog', 'documentation',
      'static site', 'brochure', 'showcase', 'simple website', 'fast website',
      'seo', 'no database', 'no backend', 'html', 'css'
    ];
    map.set('web-static', webStaticKeywords);

    // Web-db-user keywords
    const webDbUserKeywords = [
      'saas', 'dashboard', 'admin panel', 'user accounts', 'login', 'signup',
      'authentication', 'database', 'crud', 'full-stack', 'web app',
      'user management', 'roles', 'permissions', 'real-time', 'notifications',
      'internal tool', 'productivity', 'task manager', 'project management'
    ];
    map.set('web-db-user', webDbUserKeywords);

    // Web-ai-agent keywords
    const webAiAgentKeywords = [
      'ai', 'chatbot', 'llm', 'gpt', 'openai', 'anthropic', 'claude',
      'conversation', 'assistant', 'ai-powered', 'intelligent', 'nlp',
      'text generation', 'content generation', 'ai search', 'rag',
      'embeddings', 'vector', 'semantic search', 'ai agent'
    ];
    map.set('web-ai-agent', webAiAgentKeywords);

    // Mobile-app keywords
    const mobileAppKeywords = [
      'mobile', 'ios', 'android', 'app', 'native', 'react native', 'expo',
      'smartphone', 'tablet', 'push notifications', 'offline', 'mobile-first'
    ];
    map.set('mobile-app', mobileAppKeywords);

    // Data-pipeline keywords
    const dataPipelineKeywords = [
      'etl', 'data pipeline', 'batch job', 'cron', 'scheduled', 'data processing',
      'import', 'export', 'sync', 'migration', 'data transformation', 'workflow',
      'job queue', 'background job', 'async processing'
    ];
    map.set('data-pipeline', dataPipelineKeywords);

    // API-service keywords
    const apiServiceKeywords = [
      'api', 'rest', 'restful', 'microservice', 'backend', 'server',
      'endpoint', 'webhook', 'integration', 'openapi', 'swagger',
      'graphql', 'grpc', 'service'
    ];
    map.set('api-service', apiServiceKeywords);

    // Dashboard keywords
    const dashboardKeywords = [
      'analytics', 'dashboard', 'charts', 'graphs', 'metrics', 'kpi',
      'reporting', 'visualization', 'data visualization', 'admin dashboard',
      'business intelligence', 'bi', 'monitoring'
    ];
    map.set('dashboard', dashboardKeywords);

    return map;
  }

  // Keyword-based scoring (fast, no LLM)
  private keywordScore(description: string): Map<string, number> {
    const lowerDesc = description.toLowerCase();
    const scores = new Map<string, number>();

    for (const [templateId, keywords] of this.keywordMap) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          score += keyword.split(' ').length; // Multi-word keywords score higher
          matchedKeywords.push(keyword);
        }
      }

      scores.set(templateId, score);
    }

    return scores;
  }

  // AI-powered inference using LLM
  async inferTemplate(project: ProjectDescription): Promise<AIInferenceResult> {
    // Step 1: Quick keyword scoring
    const keywordScores = this.keywordScore(project.description);
    
    // Step 2: LLM-based analysis for complex cases
    const llmAnalysis = await this.llmAnalysis(project);
    
    // Step 3: Combine scores
    const recommendations = this.combineScores(keywordScores, llmAnalysis);
    
    // Step 4: Generate clarifying questions if confidence is low
    const clarifyingQuestions = this.generateClarifyingQuestions(recommendations, project);
    
    // Step 5: Generate warnings if needed
    const warnings = this.generateWarnings(recommendations, project);

    return {
      recommendations,
      clarifyingQuestions,
      warnings
    };
  }

  // LLM-based analysis
  private async llmAnalysis(project: ProjectDescription): Promise<Map<string, number>> {
    const templateDescriptions = this.templates.map(t => 
      `- ${t.id}: ${t.description}. Features: ${t.features.join(', ')}. Tags: ${t.tags.join(', ')}`
    ).join('\n');

    const prompt = `You are a template selection assistant. Analyze the following project description and score each template from 0 to 100 based on how well it matches the project requirements.

PROJECT DESCRIPTION:
${project.description}

${project.features ? `REQUESTED FEATURES: ${project.features.join(', ')}` : ''}
${project.targetPlatform ? `TARGET PLATFORM: ${project.targetPlatform}` : ''}
${project.complexity ? `COMPLEXITY LEVEL: ${project.complexity}` : ''}
${project.timeline ? `TIMELINE: ${project.timeline}` : ''}

AVAILABLE TEMPLATES:
${templateDescriptions}

Respond with a JSON object containing scores for each template and brief reasoning:
{
  "scores": {
    "web-static": { "score": 0-100, "reasoning": "brief explanation" },
    "web-db-user": { "score": 0-100, "reasoning": "brief explanation" },
    "web-ai-agent": { "score": 0-100, "reasoning": "brief explanation" },
    "mobile-app": { "score": 0-100, "reasoning": "brief explanation" },
    "data-pipeline": { "score": 0-100, "reasoning": "brief explanation" },
    "api-service": { "score": 0-100, "reasoning": "brief explanation" },
    "dashboard": { "score": 0-100, "reasoning": "brief explanation" }
  },
  "primaryRecommendation": "template-id",
  "suggestedFeatures": ["feature1", "feature2"],
  "estimatedEffort": "X days/weeks"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a helpful template selection assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'template_scores',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                scores: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      score: { type: 'number' },
                      reasoning: { type: 'string' }
                    },
                    required: ['score', 'reasoning']
                  }
                },
                primaryRecommendation: { type: 'string' },
                suggestedFeatures: { type: 'array', items: { type: 'string' } },
                estimatedEffort: { type: 'string' }
              },
              required: ['scores', 'primaryRecommendation', 'suggestedFeatures', 'estimatedEffort']
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from LLM');

      const parsed = JSON.parse(content);
      const scores = new Map<string, number>();
      
      for (const [templateId, data] of Object.entries(parsed.scores)) {
        scores.set(templateId, (data as any).score / 100); // Normalize to 0-1
      }

      return scores;
    } catch (error) {
      console.error('LLM analysis failed:', error);
      return new Map(); // Return empty map on failure
    }
  }

  // Combine keyword and LLM scores
  private combineScores(
    keywordScores: Map<string, number>,
    llmScores: Map<string, number>
  ): TemplateRecommendation[] {
    const recommendations: TemplateRecommendation[] = [];

    for (const template of this.templates) {
      const keywordScore = keywordScores.get(template.id) || 0;
      const llmScore = llmScores.get(template.id) || 0;
      
      // Normalize keyword score (max 10 keywords = 1.0)
      const normalizedKeywordScore = Math.min(keywordScore / 10, 1);
      
      // Weighted combination: 40% keyword, 60% LLM
      const combinedScore = llmScores.size > 0
        ? (normalizedKeywordScore * 0.4) + (llmScore * 0.6)
        : normalizedKeywordScore;

      const matchedKeywords = this.keywordMap.get(template.id)?.filter(kw =>
        template.description.toLowerCase().includes(kw.toLowerCase())
      ) || [];

      recommendations.push({
        templateId: template.id,
        confidence: combinedScore,
        reasoning: this.generateReasoning(template, combinedScore),
        matchedKeywords,
        suggestedFeatures: template.features,
        estimatedEffort: template.estimatedSetupTime
      });
    }

    // Sort by confidence descending
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  // Generate reasoning for recommendation
  private generateReasoning(template: Template, confidence: number): string {
    if (confidence > 0.8) {
      return `Excellent match! ${template.name} is ideal for this project based on the requirements.`;
    } else if (confidence > 0.6) {
      return `Good match. ${template.name} covers most of the requirements with some customization needed.`;
    } else if (confidence > 0.4) {
      return `Partial match. ${template.name} could work but may require significant customization.`;
    } else {
      return `Low match. ${template.name} is not recommended for this project.`;
    }
  }

  // Generate clarifying questions if confidence is low
  private generateClarifyingQuestions(
    recommendations: TemplateRecommendation[],
    project: ProjectDescription
  ): string[] {
    const questions: string[] = [];
    const topRecommendation = recommendations[0];

    // If top confidence is low, ask clarifying questions
    if (topRecommendation.confidence < 0.6) {
      questions.push('Could you provide more details about your project requirements?');
    }

    // If top two are close, ask for preference
    if (recommendations.length >= 2) {
      const diff = recommendations[0].confidence - recommendations[1].confidence;
      if (diff < 0.1) {
        questions.push(
          `We're considering both ${recommendations[0].templateId} and ${recommendations[1].templateId}. ` +
          `Do you have a preference for ${this.templates.find(t => t.id === recommendations[0].templateId)?.name} ` +
          `or ${this.templates.find(t => t.id === recommendations[1].templateId)?.name}?`
        );
      }
    }

    // Ask about specific features if not mentioned
    if (!project.features || project.features.length === 0) {
      questions.push('What specific features do you need? (e.g., user authentication, database, AI integration)');
    }

    // Ask about platform if not mentioned
    if (!project.targetPlatform) {
      questions.push('What platform are you targeting? (web, mobile, or both)');
    }

    return questions;
  }

  // Generate warnings
  private generateWarnings(
    recommendations: TemplateRecommendation[],
    project: ProjectDescription
  ): string[] {
    const warnings: string[] = [];
    const topRecommendation = recommendations[0];

    // Warn about complexity mismatch
    const topTemplate = this.templates.find(t => t.id === topRecommendation.templateId);
    if (topTemplate && project.complexity) {
      if (topTemplate.complexity === 'advanced' && project.complexity === 'beginner') {
        warnings.push(
          `Warning: ${topTemplate.name} is an advanced template. ` +
          `Consider starting with a simpler template if you're new to development.`
        );
      }
    }

    // Warn about timeline
    if (project.timeline && topTemplate) {
      const timelineMatch = project.timeline.match(/(\d+)\s*(day|week|month)/i);
      if (timelineMatch) {
        const amount = parseInt(timelineMatch[1]);
        const unit = timelineMatch[2].toLowerCase();
        const daysRequested = unit === 'day' ? amount : unit === 'week' ? amount * 7 : amount * 30;
        
        // Rough estimate: beginner = 2 days, intermediate = 5 days, advanced = 10 days
        const daysNeeded = topTemplate.complexity === 'beginner' ? 2 : 
                          topTemplate.complexity === 'intermediate' ? 5 : 10;
        
        if (daysRequested < daysNeeded) {
          warnings.push(
            `Warning: Your timeline of ${project.timeline} may be tight for ${topTemplate.name}. ` +
            `We estimate at least ${daysNeeded} days for initial setup and customization.`
          );
        }
      }
    }

    return warnings;
  }
}

// Example usage
async function selectTemplateWithAI(projectDescription: string): Promise<AIInferenceResult> {
  const inference = new AITemplateInference(templateCatalog);
  
  return await inference.inferTemplate({
    description: projectDescription
  });
}
```

### AI Inference Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI TEMPLATE INFERENCE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input:                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  "I want to build an AI-powered customer support        │   │
│  │   chatbot that can answer questions about our products  │   │
│  │   and integrate with our existing database"             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Step 1: Keyword Extraction                             │   │
│  │  - "AI-powered" → web-ai-agent                          │   │
│  │  - "chatbot" → web-ai-agent                             │   │
│  │  - "database" → web-db-user                             │   │
│  │  - "customer support" → web-ai-agent                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Step 2: LLM Analysis                                   │   │
│  │  - Semantic understanding of requirements               │   │
│  │  - Feature extraction                                   │   │
│  │  - Complexity assessment                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Step 3: Score Combination                              │   │
│  │  - web-ai-agent: 0.92 (92% confidence)                  │   │
│  │  - web-db-user: 0.45 (45% confidence)                   │   │
│  │  - dashboard: 0.20 (20% confidence)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  Result:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🤖 Recommended: Web AI Agent (92% confidence)          │   │
│  │                                                         │   │
│  │  "Excellent match! Web AI Agent is ideal for building   │   │
│  │   AI-powered chatbots with LLM integration and          │   │
│  │   database connectivity."                               │   │
│  │                                                         │   │
│  │  Suggested Features:                                    │   │
│  │  ✓ LLM integration (OpenAI/Anthropic)                   │   │
│  │  ✓ Streaming responses                                  │   │
│  │  ✓ Database integration                                 │   │
│  │  ✓ Conversation history                                 │   │
│  │                                                         │   │
│  │  Estimated Setup: 5-7 days                              │   │
│  │                                                         │   │
│  │  [Use This Template]  [See Alternatives]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Hybrid Approach (Recommended)

### Implementation

```typescript
interface HybridSelectionConfig {
  // AI inference settings
  enableAI: boolean;
  aiConfidenceThreshold: number; // Below this, show alternatives
  
  // User preference settings
  rememberUserPreferences: boolean;
  preferredTemplates: string[];
  
  // UI settings
  showAlternatives: boolean;
  maxAlternatives: number;
  showClarifyingQuestions: boolean;
}

interface HybridSelectionResult {
  // Primary recommendation
  primary: TemplateRecommendation;
  
  // Alternative recommendations
  alternatives: TemplateRecommendation[];
  
  // User can override
  userOverrideEnabled: boolean;
  
  // Clarifying questions (if needed)
  clarifyingQuestions: string[];
  
  // Warnings (if any)
  warnings: string[];
  
  // Selection method used
  selectionMethod: 'ai-inference' | 'user-preference' | 'explicit' | 'hybrid';
}

class HybridTemplateSelector {
  private aiInference: AITemplateInference;
  private explicitSelector: ExplicitTemplateSelector;
  private userPreferences: Map<string, UserPreference>;
  private config: HybridSelectionConfig;

  constructor(
    templates: Template[],
    config: Partial<HybridSelectionConfig> = {}
  ) {
    this.aiInference = new AITemplateInference(templates);
    this.explicitSelector = new ExplicitTemplateSelector(templates);
    this.userPreferences = new Map();
    this.config = {
      enableAI: true,
      aiConfidenceThreshold: 0.7,
      rememberUserPreferences: true,
      preferredTemplates: [],
      showAlternatives: true,
      maxAlternatives: 3,
      showClarifyingQuestions: true,
      ...config
    };
  }

  // Main selection method
  async selectTemplate(
    userId: string,
    project: ProjectDescription,
    explicitChoice?: string
  ): Promise<HybridSelectionResult> {
    // Step 1: Check for explicit user choice
    if (explicitChoice) {
      return this.handleExplicitChoice(explicitChoice);
    }

    // Step 2: Check user preferences
    const userPref = this.userPreferences.get(userId);
    if (userPref && this.config.rememberUserPreferences) {
      const prefResult = this.applyUserPreferences(userPref, project);
      if (prefResult.primary.confidence > this.config.aiConfidenceThreshold) {
        return prefResult;
      }
    }

    // Step 3: AI inference
    if (this.config.enableAI) {
      const aiResult = await this.aiInference.inferTemplate(project);
      return this.formatHybridResult(aiResult, 'hybrid');
    }

    // Step 4: Fallback to popularity-based
    return this.fallbackSelection();
  }

  // Handle explicit user choice
  private handleExplicitChoice(templateId: string): HybridSelectionResult {
    const template = this.explicitSelector.getAllTemplates().find(t => t.id === templateId);
    
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return {
      primary: {
        templateId: template.id,
        confidence: 1.0,
        reasoning: 'User explicitly selected this template.',
        matchedKeywords: [],
        suggestedFeatures: template.features,
        estimatedEffort: template.estimatedSetupTime
      },
      alternatives: [],
      userOverrideEnabled: false,
      clarifyingQuestions: [],
      warnings: [],
      selectionMethod: 'explicit'
    };
  }

  // Apply user preferences
  private applyUserPreferences(
    pref: UserPreference,
    project: ProjectDescription
  ): HybridSelectionResult {
    const preferredTemplate = this.explicitSelector
      .getAllTemplates()
      .find(t => t.id === pref.preferredTemplateId);

    if (!preferredTemplate) {
      return this.fallbackSelection();
    }

    // Check if preferred template matches project
    const keywordScore = this.calculateKeywordMatch(project.description, preferredTemplate);
    
    return {
      primary: {
        templateId: preferredTemplate.id,
        confidence: keywordScore,
        reasoning: `Based on your previous preference for ${preferredTemplate.name}.`,
        matchedKeywords: [],
        suggestedFeatures: preferredTemplate.features,
        estimatedEffort: preferredTemplate.estimatedSetupTime
      },
      alternatives: this.getAlternatives(preferredTemplate.id),
      userOverrideEnabled: true,
      clarifyingQuestions: keywordScore < 0.5 ? [
        `You usually prefer ${preferredTemplate.name}, but this project might be better suited for a different template. Would you like to see alternatives?`
      ] : [],
      warnings: [],
      selectionMethod: 'user-preference'
    };
  }

  // Calculate keyword match score
  private calculateKeywordMatch(description: string, template: Template): number {
    const lowerDesc = description.toLowerCase();
    let matches = 0;
    
    for (const tag of template.tags) {
      if (lowerDesc.includes(tag.toLowerCase())) {
        matches++;
      }
    }
    
    return Math.min(matches / template.tags.length, 1);
  }

  // Get alternatives
  private getAlternatives(excludeId: string): TemplateRecommendation[] {
    return this.explicitSelector
      .sortByPopularity()
      .filter(t => t.id !== excludeId)
      .slice(0, this.config.maxAlternatives)
      .map(t => ({
        templateId: t.id,
        confidence: t.popularity / 15000, // Normalize
        reasoning: `Popular alternative with ${t.popularity.toLocaleString()} users.`,
        matchedKeywords: [],
        suggestedFeatures: t.features,
        estimatedEffort: t.estimatedSetupTime
      }));
  }

  // Format AI result to hybrid result
  private formatHybridResult(
    aiResult: AIInferenceResult,
    method: HybridSelectionResult['selectionMethod']
  ): HybridSelectionResult {
    const [primary, ...alternatives] = aiResult.recommendations;

    return {
      primary,
      alternatives: alternatives.slice(0, this.config.maxAlternatives),
      userOverrideEnabled: true,
      clarifyingQuestions: this.config.showClarifyingQuestions 
        ? aiResult.clarifyingQuestions || []
        : [],
      warnings: aiResult.warnings || [],
      selectionMethod: method
    };
  }

  // Fallback selection
  private fallbackSelection(): HybridSelectionResult {
    const popular = this.explicitSelector.sortByPopularity();
    const [primary, ...rest] = popular;

    return {
      primary: {
        templateId: primary.id,
        confidence: 0.5,
        reasoning: 'Selected based on popularity. Please provide more details for better recommendations.',
        matchedKeywords: [],
        suggestedFeatures: primary.features,
        estimatedEffort: primary.estimatedSetupTime
      },
      alternatives: rest.slice(0, this.config.maxAlternatives).map(t => ({
        templateId: t.id,
        confidence: t.popularity / 15000,
        reasoning: `Popular template with ${t.popularity.toLocaleString()} users.`,
        matchedKeywords: [],
        suggestedFeatures: t.features,
        estimatedEffort: t.estimatedSetupTime
      })),
      userOverrideEnabled: true,
      clarifyingQuestions: [
        'Could you describe your project in more detail?',
        'What features do you need?'
      ],
      warnings: [],
      selectionMethod: 'hybrid'
    };
  }

  // Record user choice for learning
  recordUserChoice(userId: string, templateId: string, projectType: string): void {
    const existing = this.userPreferences.get(userId);
    
    if (existing) {
      existing.templateUsageCount.set(
        templateId,
        (existing.templateUsageCount.get(templateId) || 0) + 1
      );
      existing.lastUsedTemplate = templateId;
      existing.projectTypes.push(projectType);
    } else {
      this.userPreferences.set(userId, {
        userId,
        preferredTemplateId: templateId,
        templateUsageCount: new Map([[templateId, 1]]),
        lastUsedTemplate: templateId,
        projectTypes: [projectType],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

interface UserPreference {
  userId: string;
  preferredTemplateId: string;
  templateUsageCount: Map<string, number>;
  lastUsedTemplate: string;
  projectTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Hybrid Selection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID TEMPLATE SELECTION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Describe your project:                                 │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  "I want to build a task management app with    │   │   │
│  │  │   user accounts, team collaboration, and        │   │   │
│  │  │   real-time notifications"                      │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  [Analyze Project]  or  [Choose Template Manually]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           ↓                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎯 AI Recommendation                                   │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  🗄️ Web DB User                                 │   │   │
│  │  │     95% confidence                               │   │   │
│  │  │                                                  │   │   │
│  │  │  "Excellent match! Web DB User is perfect for   │   │   │
│  │  │   task management apps with user accounts,      │   │   │
│  │  │   team features, and real-time capabilities."   │   │   │
│  │  │                                                  │   │   │
│  │  │  ✓ User authentication                          │   │   │
│  │  │  ✓ Database integration                         │   │   │
│  │  │  ✓ Real-time updates                            │   │   │
│  │  │  ✓ Dashboard layout                             │   │   │
│  │  │                                                  │   │   │
│  │  │  [Use This Template]                             │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  Alternatives:                                          │   │
│  │  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │ 📊 Dashboard     │  │ 🔌 API Service   │            │   │
│  │  │    45% match     │  │    30% match     │            │   │
│  │  │ [Select]         │  │ [Select]         │            │   │
│  │  └──────────────────┘  └──────────────────┘            │   │
│  │                                                         │   │
│  │  [Browse All Templates]                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Machine Learning Enhancement

### Learning from User Choices

```typescript
interface TemplateSelectionEvent {
  eventId: string;
  userId: string;
  timestamp: Date;
  
  // Input
  projectDescription: string;
  extractedFeatures: string[];
  
  // AI recommendation
  aiRecommendation: string;
  aiConfidence: number;
  
  // User action
  userChoice: string;
  userAcceptedAI: boolean;
  
  // Outcome (tracked later)
  projectSuccess?: boolean;
  projectCompletionTime?: number;
  userSatisfaction?: number;
}

class TemplateSelectionLearner {
  private events: TemplateSelectionEvent[] = [];
  private featureWeights: Map<string, Map<string, number>> = new Map();

  // Record selection event
  recordEvent(event: TemplateSelectionEvent): void {
    this.events.push(event);
    this.updateWeights(event);
  }

  // Update feature weights based on user choices
  private updateWeights(event: TemplateSelectionEvent): void {
    const learningRate = 0.1;
    
    for (const feature of event.extractedFeatures) {
      if (!this.featureWeights.has(feature)) {
        this.featureWeights.set(feature, new Map());
      }
      
      const weights = this.featureWeights.get(feature)!;
      const currentWeight = weights.get(event.userChoice) || 0;
      
      // Increase weight for chosen template
      weights.set(event.userChoice, currentWeight + learningRate);
      
      // Decrease weight for AI recommendation if user rejected
      if (!event.userAcceptedAI && event.aiRecommendation !== event.userChoice) {
        const aiWeight = weights.get(event.aiRecommendation) || 0;
        weights.set(event.aiRecommendation, Math.max(0, aiWeight - learningRate * 0.5));
      }
    }
  }

  // Get learned weights for features
  getFeatureWeights(features: string[]): Map<string, number> {
    const templateScores = new Map<string, number>();
    
    for (const feature of features) {
      const weights = this.featureWeights.get(feature);
      if (weights) {
        for (const [templateId, weight] of weights) {
          templateScores.set(
            templateId,
            (templateScores.get(templateId) || 0) + weight
          );
        }
      }
    }
    
    return templateScores;
  }

  // Calculate AI accuracy
  getAIAccuracy(): number {
    if (this.events.length === 0) return 0;
    
    const accepted = this.events.filter(e => e.userAcceptedAI).length;
    return accepted / this.events.length;
  }

  // Get most common user overrides
  getCommonOverrides(): Array<{ from: string; to: string; count: number }> {
    const overrides = new Map<string, number>();
    
    for (const event of this.events) {
      if (!event.userAcceptedAI) {
        const key = `${event.aiRecommendation}→${event.userChoice}`;
        overrides.set(key, (overrides.get(key) || 0) + 1);
      }
    }
    
    return Array.from(overrides.entries())
      .map(([key, count]) => {
        const [from, to] = key.split('→');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);
  }

  // Export model for persistence
  exportModel(): object {
    return {
      featureWeights: Object.fromEntries(
        Array.from(this.featureWeights.entries()).map(([k, v]) => [
          k,
          Object.fromEntries(v)
        ])
      ),
      eventCount: this.events.length,
      aiAccuracy: this.getAIAccuracy(),
      commonOverrides: this.getCommonOverrides().slice(0, 10)
    };
  }

  // Import model from persistence
  importModel(model: any): void {
    if (model.featureWeights) {
      this.featureWeights = new Map(
        Object.entries(model.featureWeights).map(([k, v]) => [
          k,
          new Map(Object.entries(v as object))
        ])
      );
    }
  }
}
```

---

## 6. API Endpoints

```typescript
import express from 'express';

const router = express.Router();
const hybridSelector = new HybridTemplateSelector(templateCatalog);
const learner = new TemplateSelectionLearner();

// Get all templates
router.get('/templates', (req, res) => {
  const selector = new ExplicitTemplateSelector(templateCatalog);
  
  const { category, features, complexity, search, sort } = req.query;
  
  let templates = selector.getAllTemplates();
  
  if (category) {
    templates = selector.filterByCategory(category as TemplateCategory);
  }
  
  if (features) {
    templates = selector.filterByFeatures((features as string).split(','));
  }
  
  if (complexity) {
    templates = selector.filterByComplexity(complexity as Template['complexity']);
  }
  
  if (search) {
    templates = selector.search(search as string);
  }
  
  if (sort === 'popularity') {
    templates = selector.sortByPopularity();
  } else if (sort === 'rating') {
    templates = selector.sortByRating();
  }
  
  res.json({ templates });
});

// AI-powered template recommendation
router.post('/templates/recommend', async (req, res) => {
  const { userId, description, features, targetPlatform, complexity, timeline } = req.body;
  
  try {
    const result = await hybridSelector.selectTemplate(
      userId,
      { description, features, targetPlatform, complexity, timeline }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to recommend template' });
  }
});

// Record user choice
router.post('/templates/choice', (req, res) => {
  const { userId, templateId, projectDescription, aiRecommendation, aiConfidence } = req.body;
  
  // Record for learning
  learner.recordEvent({
    eventId: `evt_${Date.now()}`,
    userId,
    timestamp: new Date(),
    projectDescription,
    extractedFeatures: [], // Extract from description
    aiRecommendation,
    aiConfidence,
    userChoice: templateId,
    userAcceptedAI: templateId === aiRecommendation
  });
  
  // Record user preference
  hybridSelector.recordUserChoice(userId, templateId, 'web-app');
  
  res.json({ success: true });
});

// Get learning statistics
router.get('/templates/stats', (req, res) => {
  res.json({
    aiAccuracy: learner.getAIAccuracy(),
    commonOverrides: learner.getCommonOverrides(),
    model: learner.exportModel()
  });
});

export default router;
```

---

## 7. Best Practices

### Template Selection Best Practices

| Practice | Description | Implementation |
|----------|-------------|----------------|
| **Default to AI** | Use AI inference as default | `enableAI: true` |
| **Allow Override** | Always let users override AI | `userOverrideEnabled: true` |
| **Show Alternatives** | Display 2-3 alternatives | `maxAlternatives: 3` |
| **Ask Questions** | Clarify when confidence is low | `showClarifyingQuestions: true` |
| **Learn from Users** | Track and learn from choices | `TemplateSelectionLearner` |
| **Explain Reasoning** | Show why template was chosen | `reasoning` field |
| **Warn About Mismatches** | Alert on complexity/timeline issues | `warnings` field |

### Confidence Thresholds

| Confidence | Action |
|------------|--------|
| **> 0.9** | Auto-select, minimal alternatives |
| **0.7 - 0.9** | Recommend with alternatives |
| **0.5 - 0.7** | Show alternatives prominently |
| **< 0.5** | Ask clarifying questions |

### User Experience Guidelines

1. **Fast First Impression**: Show AI recommendation within 2 seconds
2. **Progressive Disclosure**: Start simple, reveal complexity on demand
3. **Undo Support**: Allow changing template after selection
4. **Feedback Loop**: Ask for satisfaction after project completion
5. **Personalization**: Remember user preferences over time

---

## 8. Summary

### Template Selection Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                 TEMPLATE SELECTION DECISION TREE                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User provides project description                              │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────┐                       │
│  │  Did user explicitly select         │                       │
│  │  a template?                        │                       │
│  └─────────────────────────────────────┘                       │
│           │ Yes              │ No                               │
│           ▼                  ▼                                  │
│  ┌─────────────┐   ┌─────────────────────────────┐             │
│  │ Use explicit│   │ Check user preferences      │             │
│  │ selection   │   │ (if enabled)                │             │
│  └─────────────┘   └─────────────────────────────┘             │
│                              │                                  │
│                    ┌─────────┴─────────┐                       │
│                    │ Has preference?   │                       │
│                    └───────────────────┘                       │
│                    │ Yes        │ No                            │
│                    ▼            ▼                               │
│           ┌─────────────┐  ┌─────────────────────┐             │
│           │ Apply pref  │  │ Run AI inference    │             │
│           │ with boost  │  │ (keyword + LLM)     │             │
│           └─────────────┘  └─────────────────────┘             │
│                    │                │                           │
│                    └────────┬───────┘                          │
│                             ▼                                   │
│              ┌─────────────────────────────┐                   │
│              │ Confidence > 0.7?           │                   │
│              └─────────────────────────────┘                   │
│                    │ Yes        │ No                            │
│                    ▼            ▼                               │
│           ┌─────────────┐  ┌─────────────────────┐             │
│           │ Recommend   │  │ Show alternatives   │             │
│           │ primary     │  │ + ask questions     │             │
│           └─────────────┘  └─────────────────────┘             │
│                    │                │                           │
│                    └────────┬───────┘                          │
│                             ▼                                   │
│              ┌─────────────────────────────┐                   │
│              │ User makes final choice     │                   │
│              └─────────────────────────────┘                   │
│                             │                                   │
│                             ▼                                   │
│              ┌─────────────────────────────┐                   │
│              │ Record choice for learning  │                   │
│              └─────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Takeaways

1. **Hybrid is Best**: Combine AI inference with user control
2. **Always Allow Override**: Users know their needs best
3. **Learn Continuously**: Improve AI from user choices
4. **Explain Recommendations**: Build trust with transparency
5. **Handle Edge Cases**: Low confidence, mismatches, warnings
6. **Fast and Responsive**: AI inference < 2 seconds
7. **Personalize Over Time**: Remember user preferences

This comprehensive template selection system provides the best user experience by combining AI intelligence with user control!
