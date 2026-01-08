# Token Counting: Accurate LLM Token Management and Billing

## Overview

Token counting is fundamental to managing costs, enforcing rate limits, and accurate billing in an LLM platform. This guide covers:

- **When to count**: Before vs. after sending
- **Which libraries**: tiktoken, js-tiktoken, transformers
- **Accuracy**: Handling edge cases and model-specific encodings
- **Caching**: Optimizing repeated token counting
- **Multi-provider**: Handling different tokenizers

## 1. Token Counting Strategies

### 1.1 When to Count: Before vs. After

```typescript
/**
 * Token Counting Timing Strategy
 * 
 * BEFORE SENDING (Recommended):
 * - Validate request size before API call
 * - Enforce rate limits
 * - Estimate costs
 * - Prevent wasted API calls
 * - Fail fast on oversized requests
 * 
 * AFTER RECEIVING (Verification):
 * - Verify actual usage from provider
 * - Handle discrepancies
 * - Accurate billing
 * - Detect provider changes
 * 
 * BEST PRACTICE: Count both for accuracy and cost control
 */

interface TokenCountingStrategy {
  countBefore: boolean;      // Validate before sending
  countAfter: boolean;       // Verify after receiving
  cacheResults: boolean;     // Cache token counts
  enforceLimit: boolean;     // Reject if over limit
  estimateCost: boolean;     // Calculate cost upfront
}

class TokenCountingManager {
  private tokenCache: Map<string, number> = new Map();
  private costCache: Map<string, number> = new Map();

  /**
   * Complete token counting workflow
   */
  async processRequest(
    messages: Message[],
    model: string,
    provider: string,
    strategy: TokenCountingStrategy
  ): Promise<TokenCountingResult> {
    const result: TokenCountingResult = {
      model,
      provider,
      timestamp: new Date(),
      stages: {}
    };

    // Stage 1: Count tokens BEFORE sending
    if (strategy.countBefore) {
      result.stages.beforeSending = await this.countTokensBefore(messages, model, provider);

      // Check rate limits
      if (strategy.enforceLimit) {
        const limit = await this.getRateLimit(provider);
        if (result.stages.beforeSending.totalTokens > limit) {
          throw new Error(`Request exceeds rate limit: ${result.stages.beforeSending.totalTokens} > ${limit}`);
        }
      }

      // Estimate cost
      if (strategy.estimateCost) {
        result.estimatedCost = await this.estimateCost(
          result.stages.beforeSending.totalTokens,
          model,
          provider
        );
      }
    }

    // Stage 2: Send request to provider
    const response = await this.sendToProvider(messages, model, provider);

    // Stage 3: Count tokens AFTER receiving
    if (strategy.countAfter) {
      result.stages.afterReceiving = await this.countTokensAfter(response, model, provider);

      // Verify accuracy
      if (result.stages.beforeSending) {
        const discrepancy = Math.abs(
          result.stages.afterReceiving.totalTokens - result.stages.beforeSending.totalTokens
        );
        const discrepancyPercent = (discrepancy / result.stages.beforeSending.totalTokens) * 100;

        result.discrepancy = {
          tokens: discrepancy,
          percent: discrepancyPercent,
          acceptable: discrepancyPercent < 5 // Allow 5% variance
        };

        if (!result.discrepancy.acceptable) {
          console.warn(`Token count discrepancy detected: ${discrepancyPercent.toFixed(2)}%`);
        }
      }
    }

    // Stage 4: Record usage for billing
    await this.recordUsage({
      userId: response.userId,
      model,
      provider,
      inputTokens: result.stages.afterReceiving?.inputTokens || result.stages.beforeSending?.inputTokens || 0,
      outputTokens: result.stages.afterReceiving?.outputTokens || 0,
      totalTokens: result.stages.afterReceiving?.totalTokens || result.stages.beforeSending?.totalTokens || 0,
      cost: result.estimatedCost || 0,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Count tokens BEFORE sending to provider
   */
  private async countTokensBefore(
    messages: Message[],
    model: string,
    provider: string
  ): Promise<TokenCount> {
    const cacheKey = this.getCacheKey(messages, model);

    // Check cache
    if (this.tokenCache.has(cacheKey)) {
      return {
        inputTokens: this.tokenCache.get(cacheKey) || 0,
        outputTokens: 0,
        totalTokens: this.tokenCache.get(cacheKey) || 0,
        cached: true
      };
    }

    // Count using appropriate tokenizer
    const tokenizer = await this.getTokenizer(model, provider);
    const inputTokens = await tokenizer.countTokens(messages);

    // Estimate output tokens (typically 25-50% of input for most models)
    const estimatedOutputTokens = Math.ceil(inputTokens * 0.3);

    const result: TokenCount = {
      inputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens: inputTokens + estimatedOutputTokens,
      cached: false
    };

    // Cache result
    this.tokenCache.set(cacheKey, inputTokens);

    return result;
  }

  /**
   * Count tokens AFTER receiving from provider
   */
  private async countTokensAfter(
    response: LLMResponse,
    model: string,
    provider: string
  ): Promise<TokenCount> {
    // Use provider's reported usage if available
    if (response.usage) {
      return {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        fromProvider: true
      };
    }

    // Fall back to counting if provider doesn't report
    const tokenizer = await this.getTokenizer(model, provider);
    const outputTokens = await tokenizer.countTokens([
      { role: 'assistant', content: response.content }
    ]);

    return {
      inputTokens: 0,
      outputTokens,
      totalTokens: outputTokens,
      fromProvider: false
    };
  }

  private getCacheKey(messages: Message[], model: string): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(messages) + model)
      .digest('hex');
    return hash;
  }

  private async getTokenizer(model: string, provider: string): Promise<Tokenizer> {
    // Implementation in next section
    return new Tokenizer(model, provider);
  }

  private async getRateLimit(provider: string): Promise<number> {
    // Implementation
    return 100000;
  }

  private async estimateCost(tokens: number, model: string, provider: string): Promise<number> {
    // Implementation in pricing section
    return 0;
  }

  private async sendToProvider(messages: Message[], model: string, provider: string): Promise<LLMResponse> {
    // Implementation
    return {} as LLMResponse;
  }

  private async recordUsage(usage: UsageRecord): Promise<void> {
    // Implementation
  }
}

interface TokenCountingResult {
  model: string;
  provider: string;
  timestamp: Date;
  stages: {
    beforeSending?: TokenCount;
    afterReceiving?: TokenCount;
  };
  estimatedCost?: number;
  discrepancy?: {
    tokens: number;
    percent: number;
    acceptable: boolean;
  };
}

interface TokenCount {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cached?: boolean;
  fromProvider?: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  userId?: string;
}

interface UsageRecord {
  userId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
}
```

## 2. Token Counting Libraries

### 2.1 tiktoken (Python) - OpenAI's Official Library

```typescript
/**
 * tiktoken: OpenAI's official token counting library
 * 
 * Pros:
 * - Official OpenAI library
 * - Accurate for all OpenAI models
 * - Handles special tokens
 * - Fast C implementation
 * 
 * Cons:
 * - Python only (need Node.js wrapper)
 * - Only for OpenAI models
 * - Requires model-specific encodings
 */

class TiktokenTokenizer {
  private encoding: any;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * Initialize tiktoken for model
   */
  async initialize(): Promise<void> {
    // In Node.js, use js-tiktoken instead (JavaScript port)
    const { encoding_for_model } = require('js-tiktoken');
    this.encoding = encoding_for_model(this.model);
  }

  /**
   * Count tokens for messages
   */
  async countTokens(messages: Message[]): Promise<number> {
    let tokenCount = 0;

    // Add overhead for message structure
    tokenCount += 4; // Message overhead

    for (const message of messages) {
      tokenCount += 4; // Per-message overhead

      // Count role tokens
      const roleTokens = this.encoding.encode(message.role).length;
      tokenCount += roleTokens;

      // Count content tokens
      const contentTokens = this.encoding.encode(message.content).length;
      tokenCount += contentTokens;
    }

    // Add final message overhead
    tokenCount += 2;

    return tokenCount;
  }

  /**
   * Count tokens for single string
   */
  countTokensString(text: string): number {
    return this.encoding.encode(text).length;
  }

  /**
   * Get token limit for model
   */
  getTokenLimit(model: string): number {
    const limits: Record<string, number> = {
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384
    };

    return limits[model] || 4096;
  }
}
```

### 2.2 js-tiktoken (JavaScript/TypeScript)

```typescript
/**
 * js-tiktoken: JavaScript port of tiktoken
 * 
 * Pros:
 * - Pure JavaScript implementation
 * - No Python dependency
 * - Works in Node.js and browsers
 * - Same accuracy as tiktoken
 * 
 * Cons:
 * - Slightly slower than C implementation
 * - Only for OpenAI models
 */

import { encoding_for_model, get_encoding } from 'js-tiktoken';

class JSTiktokenTokenizer implements Tokenizer {
  private encoding: any;
  private model: string;

  constructor(model: string) {
    this.model = model;
    this.encoding = encoding_for_model(model);
  }

  /**
   * Count tokens for messages (OpenAI format)
   */
  countTokens(messages: Message[]): number {
    let tokenCount = 0;

    // Different models have different overhead
    if (this.model.includes('gpt-4')) {
      tokenCount = 3; // gpt-4 overhead
    } else if (this.model.includes('gpt-3.5')) {
      tokenCount = 4; // gpt-3.5-turbo overhead
    }

    for (const message of messages) {
      tokenCount += 4; // Per-message overhead

      // Count tokens for role
      tokenCount += this.encoding.encode(message.role).length;

      // Count tokens for content
      tokenCount += this.encoding.encode(message.content).length;
    }

    return tokenCount;
  }

  /**
   * Count tokens for text
   */
  countTokensText(text: string): number {
    return this.encoding.encode(text).length;
  }

  /**
   * Encode text to tokens
   */
  encode(text: string): number[] {
    return this.encoding.encode(text);
  }

  /**
   * Decode tokens to text
   */
  decode(tokens: number[]): string {
    return this.encoding.decode(tokens);
  }
}
```

### 2.3 transformers (Hugging Face)

```typescript
/**
 * Hugging Face transformers: Universal tokenizer
 * 
 * Pros:
 * - Supports any model on Hugging Face
 * - Accurate for open-source models
 * - Handles special tokens
 * - Model-agnostic
 * 
 * Cons:
 * - Slower than tiktoken
 * - Requires model download
 * - Python dependency
 */

class HuggingFaceTokenizer implements Tokenizer {
  private tokenizer: any;
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * Initialize tokenizer from Hugging Face
   */
  async initialize(): Promise<void> {
    // Use Python subprocess to access transformers
    const { spawn } = require('child_process');

    const python = spawn('python3', [
      '-c',
      `
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained('${this.model}')
print(tokenizer.vocab_size)
      `
    ]);

    // This is simplified; in production, use proper IPC
  }

  /**
   * Count tokens for messages
   */
  countTokens(messages: Message[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      const text = `${message.role}: ${message.content}`;
      totalTokens += this.countTokensText(text);
    }

    return totalTokens;
  }

  /**
   * Count tokens for text
   */
  countTokensText(text: string): number {
    // Call Python tokenizer
    return 0; // Implementation
  }
}
```

### 2.4 Custom Multi-Provider Tokenizer

```typescript
/**
 * Multi-provider tokenizer that handles:
 * - OpenAI (GPT-4, GPT-3.5)
 * - Anthropic (Claude)
 * - Google (Gemini)
 * - Open-source models
 */

class MultiProviderTokenizer implements Tokenizer {
  private openaiTokenizer: JSTiktokenTokenizer | null = null;
  private anthropicTokenizer: AnthropicTokenizer | null = null;
  private googleTokenizer: GoogleTokenizer | null = null;
  private model: string;
  private provider: string;

  constructor(model: string, provider: string) {
    this.model = model;
    this.provider = provider;
  }

  /**
   * Count tokens based on provider
   */
  async countTokens(messages: Message[]): Promise<number> {
    switch (this.provider.toLowerCase()) {
      case 'openai':
        return this.countOpenAITokens(messages);
      case 'anthropic':
        return this.countAnthropicTokens(messages);
      case 'google':
        return this.countGoogleTokens(messages);
      default:
        return this.countGenericTokens(messages);
    }
  }

  /**
   * OpenAI token counting
   */
  private countOpenAITokens(messages: Message[]): number {
    if (!this.openaiTokenizer) {
      this.openaiTokenizer = new JSTiktokenTokenizer(this.model);
    }
    return this.openaiTokenizer.countTokens(messages);
  }

  /**
   * Anthropic token counting
   */
  private async countAnthropicTokens(messages: Message[]): Promise<number> {
    if (!this.anthropicTokenizer) {
      this.anthropicTokenizer = new AnthropicTokenizer(this.model);
    }
    return this.anthropicTokenizer.countTokens(messages);
  }

  /**
   * Google token counting
   */
  private async countGoogleTokens(messages: Message[]): Promise<number> {
    if (!this.googleTokenizer) {
      this.googleTokenizer = new GoogleTokenizer(this.model);
    }
    return this.googleTokenizer.countTokens(messages);
  }

  /**
   * Generic token counting (fallback)
   */
  private countGenericTokens(messages: Message[]): number {
    // Rough estimate: 1 token ≈ 4 characters
    let totalChars = 0;

    for (const message of messages) {
      totalChars += message.role.length + message.content.length;
    }

    return Math.ceil(totalChars / 4);
  }
}

class AnthropicTokenizer implements Tokenizer {
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * Count tokens for Anthropic Claude
   * 
   * Anthropic provides token counting via API
   */
  async countTokens(messages: Message[]): Promise<number> {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await client.messages.countTokens({
      model: this.model,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    });

    return response.input_tokens;
  }
}

class GoogleTokenizer implements Tokenizer {
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * Count tokens for Google Gemini
   */
  async countTokens(messages: Message[]): Promise<number> {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: this.model });

    const response = await model.countTokens({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    });

    return response.totalTokens;
  }
}

interface Tokenizer {
  countTokens(messages: Message[]): Promise<number> | number;
}
```

## 3. Handling Edge Cases

### 3.1 Special Tokens and Formatting

```typescript
class TokenCountingEdgeCases {
  /**
   * Handle special tokens
   */
  countWithSpecialTokens(text: string, model: string): number {
    const tokenizer = new JSTiktokenTokenizer(model);

    let count = 0;

    // Add special token overhead
    if (text.includes('<|system|>')) count += 2;
    if (text.includes('<|user|>')) count += 2;
    if (text.includes('<|assistant|>')) count += 2;
    if (text.includes('<|end|>')) count += 1;

    // Count actual content
    count += tokenizer.countTokensText(text);

    return count;
  }

  /**
   * Handle function calling overhead
   */
  countFunctionCallingTokens(
    messages: Message[],
    functions: FunctionDefinition[],
    model: string
  ): number {
    const tokenizer = new JSTiktokenTokenizer(model);

    let count = tokenizer.countTokens(messages);

    // Add function definitions overhead
    for (const func of functions) {
      count += 20; // Approximate overhead per function
      count += tokenizer.countTokensText(JSON.stringify(func));
    }

    return count;
  }

  /**
   * Handle vision/image tokens
   */
  countVisionTokens(
    messages: Message[],
    images: ImageInput[],
    model: string
  ): number {
    const tokenizer = new JSTokenTokenizer(model);

    let count = tokenizer.countTokens(messages);

    // Add image tokens
    for (const image of images) {
      if (image.type === 'base64') {
        // Base64 image: ~85 tokens per 1KB
        const sizeKB = image.data.length / 1024;
        count += Math.ceil(sizeKB * 85);
      } else if (image.type === 'url') {
        // URL image: ~85 tokens
        count += 85;
      }
    }

    return count;
  }

  /**
   * Handle streaming tokens
   */
  countStreamingTokens(
    messages: Message[],
    streamChunks: string[],
    model: string
  ): number {
    const tokenizer = new JSTiktokenTokenizer(model);

    let count = tokenizer.countTokens(messages);

    // Count streamed content
    for (const chunk of streamChunks) {
      count += tokenizer.countTokensText(chunk);
    }

    return count;
  }
}

interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

interface ImageInput {
  type: 'base64' | 'url';
  data: string;
}
```

## 4. Token Counting Caching

### 4.1 Multi-Level Cache

```typescript
class TokenCountingCache {
  private memoryCache: Map<string, number> = new Map();
  private redisClient: any; // Redis client
  private db: any; // Database connection

  /**
   * Get token count with caching
   */
  async getTokenCount(
    text: string,
    model: string,
    cacheLevel: 'memory' | 'redis' | 'database' = 'memory'
  ): Promise<number> {
    const cacheKey = this.generateCacheKey(text, model);

    // Level 1: Memory cache (fastest)
    if (cacheLevel === 'memory' || cacheLevel === 'redis' || cacheLevel === 'database') {
      if (this.memoryCache.has(cacheKey)) {
        return this.memoryCache.get(cacheKey) || 0;
      }
    }

    // Level 2: Redis cache (medium speed)
    if (cacheLevel === 'redis' || cacheLevel === 'database') {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          const count = parseInt(cached);
          this.memoryCache.set(cacheKey, count); // Populate memory cache
          return count;
        }
      } catch (error) {
        console.warn('Redis cache miss:', error);
      }
    }

    // Level 3: Database cache (persistent)
    if (cacheLevel === 'database') {
      try {
        const result = await this.db.query(
          'SELECT token_count FROM token_cache WHERE cache_key = $1',
          [cacheKey]
        );
        if (result.rows.length > 0) {
          const count = result.rows[0].token_count;
          this.memoryCache.set(cacheKey, count);
          await this.redisClient.set(cacheKey, count, 'EX', 86400); // 24h TTL
          return count;
        }
      } catch (error) {
        console.warn('Database cache miss:', error);
      }
    }

    // Cache miss: count tokens
    const tokenizer = new JSTiktokenTokenizer(model);
    const count = tokenizer.countTokensText(text);

    // Store in all cache levels
    this.memoryCache.set(cacheKey, count);

    if (cacheLevel === 'redis' || cacheLevel === 'database') {
      await this.redisClient.set(cacheKey, count, 'EX', 86400);
    }

    if (cacheLevel === 'database') {
      await this.db.query(
        'INSERT INTO token_cache (cache_key, text, model, token_count, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [cacheKey, text, model, count]
      );
    }

    return count;
  }

  /**
   * Batch token counting with cache
   */
  async batchCountTokens(
    items: { text: string; model: string }[],
    cacheLevel: 'memory' | 'redis' | 'database' = 'memory'
  ): Promise<number[]> {
    const results: number[] = [];

    for (const item of items) {
      const count = await this.getTokenCount(item.text, item.model, cacheLevel);
      results.push(count);
    }

    return results;
  }

  /**
   * Clear cache
   */
  async clearCache(level: 'memory' | 'redis' | 'database' = 'all'): Promise<void> {
    if (level === 'memory' || level === 'all') {
      this.memoryCache.clear();
    }

    if (level === 'redis' || level === 'all') {
      await this.redisClient.flushdb();
    }

    if (level === 'database' || level === 'all') {
      await this.db.query('DELETE FROM token_cache');
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const memorySize = this.memoryCache.size;

    const redisSize = await this.redisClient.dbsize();

    const { rows } = await this.db.query('SELECT COUNT(*) as count FROM token_cache');
    const dbSize = rows[0].count;

    return {
      memoryCacheSize: memorySize,
      redisCacheSize: redisSize,
      databaseCacheSize: dbSize,
      totalCached: memorySize + redisSize + dbSize
    };
  }

  private generateCacheKey(text: string, model: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(text + model)
      .digest('hex');
  }
}

interface CacheStats {
  memoryCacheSize: number;
  redisCacheSize: number;
  databaseCacheSize: number;
  totalCached: number;
}
```

## 5. Cost Calculation

### 5.1 Multi-Provider Pricing

```typescript
class TokenPricingCalculator {
  /**
   * Get pricing for model
   */
  getPricing(model: string, provider: string): ModelPricing {
    const pricingMap: Record<string, Record<string, ModelPricing>> = {
      openai: {
        'gpt-4-turbo': {
          inputCostPer1kTokens: 0.01,
          outputCostPer1kTokens: 0.03
        },
        'gpt-4': {
          inputCostPer1kTokens: 0.03,
          outputCostPer1kTokens: 0.06
        },
        'gpt-3.5-turbo': {
          inputCostPer1kTokens: 0.0005,
          outputCostPer1kTokens: 0.0015
        }
      },
      anthropic: {
        'claude-3-opus': {
          inputCostPer1kTokens: 0.015,
          outputCostPer1kTokens: 0.075
        },
        'claude-3-sonnet': {
          inputCostPer1kTokens: 0.003,
          outputCostPer1kTokens: 0.015
        },
        'claude-3-haiku': {
          inputCostPer1kTokens: 0.00025,
          outputCostPer1kTokens: 0.00125
        }
      },
      google: {
        'gemini-pro': {
          inputCostPer1kTokens: 0.000125,
          outputCostPer1kTokens: 0.000375
        }
      }
    };

    return pricingMap[provider]?.[model] || {
      inputCostPer1kTokens: 0,
      outputCostPer1kTokens: 0
    };
  }

  /**
   * Calculate cost for request
   */
  calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: string,
    provider: string
  ): CostBreakdown {
    const pricing = this.getPricing(model, provider);

    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1kTokens;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1kTokens;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
      breakdown: {
        inputTokens,
        outputTokens,
        inputCostPer1kTokens: pricing.inputCostPer1kTokens,
        outputCostPer1kTokens: pricing.outputCostPer1kTokens
      }
    };
  }

  /**
   * Calculate cost per user
   */
  async calculateUserCost(userId: string, period: 'day' | 'month' | 'year'): Promise<UserCost> {
    const db = this.getDatabase();

    const query = `
SELECT 
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  COUNT(*) as request_count,
  COUNT(DISTINCT model) as unique_models,
  COUNT(DISTINCT provider) as unique_providers
FROM usage_records
WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${period}'
    `;

    const result = await db.query(query, [userId]);
    const row = result.rows[0];

    const totalCost = row.total_input_tokens * 0.001 + row.total_output_tokens * 0.003; // Rough estimate

    return {
      userId,
      period,
      totalInputTokens: row.total_input_tokens,
      totalOutputTokens: row.total_output_tokens,
      totalCost,
      requestCount: row.request_count,
      uniqueModels: row.unique_models,
      uniqueProviders: row.unique_providers
    };
  }

  private getDatabase(): any {
    // Implementation
    return {};
  }
}

interface ModelPricing {
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
}

interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  breakdown: {
    inputTokens: number;
    outputTokens: number;
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
  };
}

interface UserCost {
  userId: string;
  period: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
  uniqueModels: number;
  uniqueProviders: number;
}
```

## 6. Best Practices

### 6.1 Token Counting Checklist

```typescript
class TokenCountingBestPractices {
  /**
   * Recommended token counting workflow
   */
  async implementBestPractices(): Promise<void> {
    // 1. Use js-tiktoken for OpenAI models
    const openaiTokenizer = new JSTiktokenTokenizer('gpt-4');

    // 2. Count tokens BEFORE sending
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' }
    ];
    const preCount = openaiTokenizer.countTokens(messages);
    console.log(`Pre-send token count: ${preCount}`);

    // 3. Enforce rate limits
    const rateLimit = 100000;
    if (preCount > rateLimit) {
      throw new Error('Request exceeds rate limit');
    }

    // 4. Estimate cost
    const pricing = new TokenPricingCalculator();
    const estimatedCost = pricing.calculateCost(preCount, preCount * 0.3, 'gpt-4', 'openai');
    console.log(`Estimated cost: $${estimatedCost.totalCost.toFixed(4)}`);

    // 5. Send request
    const response = await this.sendRequest(messages);

    // 6. Verify actual usage
    const actualCost = pricing.calculateCost(
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
      'gpt-4',
      'openai'
    );
    console.log(`Actual cost: $${actualCost.totalCost.toFixed(4)}`);

    // 7. Record for billing
    await this.recordUsage({
      userId: 'user123',
      model: 'gpt-4',
      provider: 'openai',
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      cost: actualCost.totalCost,
      timestamp: new Date()
    });

    // 8. Cache for future use
    const cache = new TokenCountingCache();
    await cache.getTokenCount(JSON.stringify(messages), 'gpt-4', 'database');
  }

  private async sendRequest(messages: Message[]): Promise<any> {
    // Implementation
    return {};
  }

  private async recordUsage(usage: UsageRecord): Promise<void> {
    // Implementation
  }
}
```

## 7. Comparison: Token Counting Libraries

| Library | Language | Accuracy | Speed | Support |
|---------|----------|----------|-------|---------|
| **tiktoken** | Python | 100% | Fast (C) | OpenAI only |
| **js-tiktoken** | JavaScript | 100% | Medium | OpenAI only |
| **transformers** | Python | 95%+ | Slow | All models |
| **API-based** | Any | 100% | Slow | Provider-specific |
| **Custom** | Any | 90%+ | Fast | Custom models |

## 8. Implementation Checklist

- [ ] Choose tokenizer library (js-tiktoken for OpenAI)
- [ ] Implement token counting BEFORE sending
- [ ] Verify token count AFTER receiving
- [ ] Set up token caching (memory → Redis → DB)
- [ ] Implement rate limiting
- [ ] Calculate costs accurately
- [ ] Record usage for billing
- [ ] Monitor token count discrepancies
- [ ] Alert on unusual patterns
- [ ] Optimize caching strategy

## 9. Recommendations for Manus-like Platform

**Token Counting Strategy:**
1. **Use js-tiktoken** for OpenAI models (100% accurate)
2. **Count BEFORE sending** to enforce limits and estimate costs
3. **Verify AFTER receiving** for billing accuracy
4. **Cache aggressively** (memory → Redis → database)
5. **Monitor discrepancies** (<5% acceptable)
6. **Calculate costs** in real-time
7. **Record usage** for all requests
8. **Alert on anomalies** (unusual token counts)

**Cost Optimization:**
- Batch requests to reduce overhead
- Use cheaper models when possible
- Cache repeated requests
- Implement token budgets per user
- Monitor cost trends

This ensures accurate token counting, fair billing, and cost control across your platform!
