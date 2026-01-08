# Streaming Error Handling: Mid-Stream Failure Recovery and Partial Response Management

## Overview

Streaming error handling is critical for production LLM platforms. Unlike traditional request-response APIs, streaming introduces unique challenges:

- **Partial responses**: Data already sent to client before failure
- **Network failures**: Connection drops mid-stream
- **Provider timeouts**: Server stops sending tokens
- **Client disconnects**: User closes connection
- **Resource exhaustion**: Memory/CPU limits exceeded

This guide covers complete error recovery strategies from detection to recovery.

## 1. Streaming Error Detection

### 1.1 Multi-Layer Error Detection

```typescript
/**
 * Comprehensive streaming error detection
 * 
 * Layers:
 * 1. Network layer (TCP/HTTP errors)
 * 2. Protocol layer (HTTP status codes)
 * 3. Application layer (LLM API errors)
 * 4. Data layer (malformed tokens)
 * 5. Resource layer (memory/CPU exhaustion)
 */

interface StreamingError {
  type: 'network' | 'protocol' | 'application' | 'data' | 'resource';
  code: string;
  message: string;
  timestamp: Date;
  bytesReceived: number;
  tokensReceived: number;
  recoverable: boolean;
  suggestedAction: 'retry' | 'resume' | 'fallback' | 'abort';
}

class StreamingErrorDetector {
  private errorThresholds = {
    networkRetries: 3,
    timeoutSeconds: 30,
    maxPartialResponseSize: 100 * 1024 * 1024, // 100MB
    maxMemoryUsagePercent: 90,
    maxCPUUsagePercent: 95
  };

  /**
   * Detect errors during streaming
   */
  async detectStreamingError(
    stream: ReadableStream,
    context: StreamingContext
  ): Promise<StreamingError | null> {
    try {
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await Promise.race([
          reader.read(),
          this.createTimeoutPromise(this.errorThresholds.timeoutSeconds * 1000)
        ]);

        if (done) {
          return null; // Stream completed successfully
        }

        // Check for errors
        const error = this.checkForErrors(value, context);
        if (error) {
          return error;
        }

        // Update context
        context.bytesReceived += value.length;
        context.tokensReceived += this.estimateTokens(value);

        // Check resource usage
        const resourceError = await this.checkResourceUsage(context);
        if (resourceError) {
          return resourceError;
        }
      }
    } catch (error) {
      return this.classifyError(error, context);
    }
  }

  /**
   * Classify error type and determine recoverability
   */
  private classifyError(error: any, context: StreamingContext): StreamingError {
    let type: StreamingError['type'] = 'application';
    let code = 'UNKNOWN_ERROR';
    let recoverable = false;
    let suggestedAction: StreamingError['suggestedAction'] = 'abort';

    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      type = 'network';
      code = error.code;
      recoverable = context.bytesReceived > 0; // Can resume if partial
      suggestedAction = context.bytesReceived > 0 ? 'resume' : 'retry';
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      type = 'network';
      code = 'TIMEOUT';
      recoverable = context.bytesReceived > 0;
      suggestedAction = context.bytesReceived > 0 ? 'resume' : 'retry';
    }

    // HTTP errors
    if (error.statusCode) {
      type = 'protocol';
      code = `HTTP_${error.statusCode}`;

      // Determine if recoverable based on status code
      if (error.statusCode >= 500) {
        recoverable = true;
        suggestedAction = 'retry';
      } else if (error.statusCode === 429) {
        recoverable = true;
        suggestedAction = 'retry'; // Rate limited, retry with backoff
      } else if (error.statusCode >= 400 && error.statusCode < 500) {
        recoverable = false;
        suggestedAction = 'abort';
      }
    }

    // LLM API errors
    if (error.error?.type) {
      type = 'application';
      code = error.error.type;
      recoverable = error.error.type === 'server_error';
      suggestedAction = recoverable ? 'retry' : 'abort';
    }

    return {
      type,
      code,
      message: error.message || 'Unknown error',
      timestamp: new Date(),
      bytesReceived: context.bytesReceived,
      tokensReceived: context.tokensReceived,
      recoverable,
      suggestedAction
    };
  }

  /**
   * Check for errors in received data
   */
  private checkForErrors(data: Uint8Array, context: StreamingContext): StreamingError | null {
    // Check size limits
    if (context.bytesReceived + data.length > this.errorThresholds.maxPartialResponseSize) {
      return {
        type: 'resource',
        code: 'RESPONSE_TOO_LARGE',
        message: `Response exceeds maximum size of ${this.errorThresholds.maxPartialResponseSize}`,
        timestamp: new Date(),
        bytesReceived: context.bytesReceived,
        tokensReceived: context.tokensReceived,
        recoverable: false,
        suggestedAction: 'abort'
      };
    }

    // Check for malformed data
    try {
      const text = new TextDecoder().decode(data);
      JSON.parse(text); // Validate JSON
    } catch (error) {
      return {
        type: 'data',
        code: 'MALFORMED_DATA',
        message: 'Received malformed JSON data',
        timestamp: new Date(),
        bytesReceived: context.bytesReceived,
        tokensReceived: context.tokensReceived,
        recoverable: false,
        suggestedAction: 'abort'
      };
    }

    return null;
  }

  /**
   * Check system resource usage
   */
  private async checkResourceUsage(context: StreamingContext): Promise<StreamingError | null> {
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memPercent > this.errorThresholds.maxMemoryUsagePercent) {
      return {
        type: 'resource',
        code: 'MEMORY_EXHAUSTION',
        message: `Memory usage at ${memPercent.toFixed(1)}%`,
        timestamp: new Date(),
        bytesReceived: context.bytesReceived,
        tokensReceived: context.tokensReceived,
        recoverable: true,
        suggestedAction: 'resume'
      };
    }

    return null;
  }

  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Stream timeout')), ms)
    );
  }

  private estimateTokens(data: Uint8Array): number {
    // Rough estimate: 1 token ≈ 4 bytes
    return Math.ceil(data.length / 4);
  }
}

interface StreamingContext {
  requestId: string;
  userId: string;
  model: string;
  provider: string;
  startTime: Date;
  bytesReceived: number;
  tokensReceived: number;
  partialResponse: string;
  checkpoint?: StreamingCheckpoint;
}

interface StreamingCheckpoint {
  bytesReceived: number;
  tokensReceived: number;
  lastValidToken: number;
  timestamp: Date;
  content: string;
}
```

## 2. Partial Response Recovery

### 2.1 Checkpoint-Based Recovery

```typescript
/**
 * Checkpoint-based recovery for streaming
 * 
 * Strategy:
 * - Save checkpoints every N tokens
 * - On failure, resume from last checkpoint
 * - Avoid re-processing already received tokens
 */

class StreamingCheckpointManager {
  private checkpointInterval = 10; // Save checkpoint every 10 tokens
  private checkpoints: Map<string, StreamingCheckpoint[]> = new Map();

  /**
   * Create checkpoint during streaming
   */
  async createCheckpoint(
    requestId: string,
    content: string,
    tokensReceived: number,
    bytesReceived: number
  ): Promise<StreamingCheckpoint> {
    const checkpoint: StreamingCheckpoint = {
      bytesReceived,
      tokensReceived,
      lastValidToken: tokensReceived,
      timestamp: new Date(),
      content
    };

    // Store in memory
    if (!this.checkpoints.has(requestId)) {
      this.checkpoints.set(requestId, []);
    }
    this.checkpoints.get(requestId)!.push(checkpoint);

    // Store in persistent storage (Redis/Database)
    await this.persistCheckpoint(requestId, checkpoint);

    return checkpoint;
  }

  /**
   * Resume from checkpoint
   */
  async resumeFromCheckpoint(
    requestId: string,
    provider: string,
    model: string,
    originalMessages: Message[]
  ): Promise<ResumptionResult> {
    // Get last checkpoint
    const checkpoint = await this.getLastCheckpoint(requestId);

    if (!checkpoint) {
      return {
        success: false,
        reason: 'NO_CHECKPOINT_FOUND',
        shouldRetryFromBeginning: true
      };
    }

    // Verify checkpoint is valid
    const isValid = await this.verifyCheckpoint(checkpoint);
    if (!isValid) {
      return {
        success: false,
        reason: 'CHECKPOINT_CORRUPTED',
        shouldRetryFromBeginning: true
      };
    }

    // Create resume request
    const resumeMessages = this.createResumeMessages(
      originalMessages,
      checkpoint.content,
      model
    );

    // Resume streaming from checkpoint
    try {
      const stream = await this.resumeStream(
        provider,
        model,
        resumeMessages,
        checkpoint.tokensReceived
      );

      return {
        success: true,
        checkpoint,
        stream,
        tokensSkipped: checkpoint.tokensReceived,
        shouldRetryFromBeginning: false
      };
    } catch (error) {
      return {
        success: false,
        reason: 'RESUME_FAILED',
        error: error as Error,
        shouldRetryFromBeginning: true
      };
    }
  }

  /**
   * Create messages for resumption
   * 
   * Strategy: Tell the model what we've received so far
   * and ask it to continue from there
   */
  private createResumeMessages(
    originalMessages: Message[],
    partialContent: string,
    model: string
  ): Message[] {
    const resumeMessages = [...originalMessages];

    // Add partial response as context
    resumeMessages.push({
      role: 'assistant',
      content: partialContent
    });

    // Add continuation prompt
    resumeMessages.push({
      role: 'user',
      content: 'Continue from where you left off. Do not repeat what you already said.'
    });

    return resumeMessages;
  }

  /**
   * Verify checkpoint integrity
   */
  private async verifyCheckpoint(checkpoint: StreamingCheckpoint): Promise<boolean> {
    // Check if content is valid
    if (!checkpoint.content || checkpoint.content.length === 0) {
      return false;
    }

    // Check if timestamp is recent (not stale)
    const age = Date.now() - checkpoint.timestamp.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age > maxAge) {
      return false;
    }

    return true;
  }

  /**
   * Get last valid checkpoint
   */
  private async getLastCheckpoint(requestId: string): Promise<StreamingCheckpoint | null> {
    // Try memory first
    const memCheckpoints = this.checkpoints.get(requestId);
    if (memCheckpoints && memCheckpoints.length > 0) {
      return memCheckpoints[memCheckpoints.length - 1];
    }

    // Fall back to persistent storage
    return await this.retrieveCheckpoint(requestId);
  }

  private async persistCheckpoint(requestId: string, checkpoint: StreamingCheckpoint): Promise<void> {
    // Implementation: Save to Redis/Database
  }

  private async retrieveCheckpoint(requestId: string): Promise<StreamingCheckpoint | null> {
    // Implementation: Retrieve from Redis/Database
    return null;
  }

  private async resumeStream(
    provider: string,
    model: string,
    messages: Message[],
    tokensSkipped: number
  ): Promise<ReadableStream> {
    // Implementation: Resume streaming
    return new ReadableStream();
  }
}

interface ResumptionResult {
  success: boolean;
  reason?: string;
  checkpoint?: StreamingCheckpoint;
  stream?: ReadableStream;
  tokensSkipped?: number;
  error?: Error;
  shouldRetryFromBeginning: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

## 3. Retry Strategies

### 3.1 Exponential Backoff with Jitter

```typescript
/**
 * Intelligent retry strategy for streaming failures
 * 
 * Strategies:
 * 1. Exponential backoff: 1s, 2s, 4s, 8s, 16s
 * 2. Jitter: Add randomness to prevent thundering herd
 * 3. Circuit breaker: Stop retrying if too many failures
 * 4. Adaptive: Adjust based on error type
 */

class StreamingRetryManager {
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second
  private maxDelay = 60000; // 60 seconds
  private circuitBreakerThreshold = 5;
  private failureCount: Map<string, number> = new Map();

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: RetryContext
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (this.isCircuitOpen(context.provider)) {
          throw new Error('Circuit breaker open: Too many failures');
        }

        // Execute function
        const result = await fn();

        // Reset failure count on success
        this.failureCount.set(context.provider, 0);

        return result;
      } catch (error) {
        lastError = error as Error;

        // Increment failure count
        const count = (this.failureCount.get(context.provider) || 0) + 1;
        this.failureCount.set(context.provider, count);

        // Check if we should retry
        const shouldRetry = this.shouldRetry(error as Error, attempt, context);

        if (!shouldRetry) {
          throw error;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, error as Error);

        console.log(
          `Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms: ${(error as Error).message}`
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw new Error(`Failed after ${this.maxRetries} retries: ${lastError?.message}`);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, error: Error): number {
    // Exponential backoff: 2^attempt
    let delay = this.baseDelay * Math.pow(2, attempt);

    // Add jitter: ±10%
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    delay += jitter;

    // Cap at max delay
    delay = Math.min(delay, this.maxDelay);

    // Adjust for specific error types
    if (error.message.includes('rate_limit')) {
      // Rate limit: use longer delay
      delay *= 2;
    } else if (error.message.includes('timeout')) {
      // Timeout: use shorter delay
      delay *= 0.5;
    }

    return Math.round(delay);
  }

  /**
   * Determine if we should retry
   */
  private shouldRetry(error: Error, attempt: number, context: RetryContext): boolean {
    // Don't retry if max attempts reached
    if (attempt >= this.maxRetries) {
      return false;
    }

    // Retry on network errors
    if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
      return true;
    }

    // Retry on rate limits
    if (error.message.includes('rate_limit') || error.message.includes('429')) {
      return true;
    }

    // Retry on server errors
    if (error.message.includes('500') || error.message.includes('503')) {
      return true;
    }

    // Don't retry on client errors
    if (error.message.includes('400') || error.message.includes('401')) {
      return false;
    }

    return false;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(provider: string): boolean {
    const failureCount = this.failureCount.get(provider) || 0;
    return failureCount >= this.circuitBreakerThreshold;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface RetryContext {
  provider: string;
  model: string;
  requestId: string;
  attempt: number;
}
```

## 4. Fallback Strategies

### 4.1 Provider Fallback

```typescript
/**
 * Fallback to alternative providers on failure
 * 
 * Strategy:
 * - Primary provider fails → Try secondary provider
 * - Secondary fails → Try tertiary
 * - All fail → Return error
 */

class ProviderFallbackManager {
  /**
   * Execute with provider fallback
   */
  async executeWithFallback(
    messages: Message[],
    primaryProvider: string,
    fallbackProviders: string[],
    model: string
  ): Promise<StreamingResult> {
    const providers = [primaryProvider, ...fallbackProviders];
    const errors: Map<string, Error> = new Map();

    for (const provider of providers) {
      try {
        console.log(`Attempting with provider: ${provider}`);

        const stream = await this.createStream(provider, model, messages);

        return {
          success: true,
          provider,
          stream,
          fallbackUsed: provider !== primaryProvider
        };
      } catch (error) {
        errors.set(provider, error as Error);
        console.warn(`Provider ${provider} failed: ${(error as Error).message}`);

        // Continue to next provider
      }
    }

    // All providers failed
    return {
      success: false,
      errors,
      fallbackUsed: false
    };
  }

  /**
   * Select best provider based on availability
   */
  async selectBestProvider(
    providers: ProviderConfig[],
    model: string
  ): Promise<ProviderConfig> {
    const availability: Map<string, ProviderAvailability> = new Map();

    for (const provider of providers) {
      try {
        const health = await this.checkProviderHealth(provider);
        availability.set(provider.name, health);
      } catch (error) {
        availability.set(provider.name, {
          available: false,
          latency: Infinity,
          errorRate: 1.0
        });
      }
    }

    // Select provider with best score
    let bestProvider = providers[0];
    let bestScore = -Infinity;

    for (const provider of providers) {
      const health = availability.get(provider.name);
      if (!health) continue;

      // Score: availability - latency - error rate
      const score = (health.available ? 100 : 0) - health.latency - health.errorRate * 100;

      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  private async createStream(
    provider: string,
    model: string,
    messages: Message[]
  ): Promise<ReadableStream> {
    // Implementation
    return new ReadableStream();
  }

  private async checkProviderHealth(provider: ProviderConfig): Promise<ProviderAvailability> {
    // Implementation
    return {
      available: true,
      latency: 100,
      errorRate: 0.01
    };
  }
}

interface StreamingResult {
  success: boolean;
  provider?: string;
  stream?: ReadableStream;
  errors?: Map<string, Error>;
  fallbackUsed: boolean;
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  models: string[];
  priority: number;
}

interface ProviderAvailability {
  available: boolean;
  latency: number;
  errorRate: number;
}
```

## 5. Complete Streaming Error Handler

### 5.1 Unified Error Handler

```typescript
/**
 * Complete streaming error handler combining all strategies
 */

class UnifiedStreamingErrorHandler {
  private errorDetector: StreamingErrorDetector;
  private checkpointManager: StreamingCheckpointManager;
  private retryManager: StreamingRetryManager;
  private fallbackManager: ProviderFallbackManager;

  constructor() {
    this.errorDetector = new StreamingErrorDetector();
    this.checkpointManager = new StreamingCheckpointManager();
    this.retryManager = new StreamingRetryManager();
    this.fallbackManager = new ProviderFallbackManager();
  }

  /**
   * Handle streaming with complete error recovery
   */
  async handleStreamingWithRecovery(
    messages: Message[],
    provider: string,
    model: string,
    fallbackProviders: string[],
    userId: string
  ): Promise<StreamingResponse> {
    const requestId = this.generateRequestId();
    const context: StreamingContext = {
      requestId,
      userId,
      model,
      provider,
      startTime: new Date(),
      bytesReceived: 0,
      tokensReceived: 0,
      partialResponse: ''
    };

    try {
      // Try primary provider
      return await this.executeStreamingWithRetry(
        messages,
        provider,
        model,
        context
      );
    } catch (error) {
      console.warn(`Primary provider failed: ${(error as Error).message}`);

      // Try fallback providers
      if (fallbackProviders.length > 0) {
        return await this.executeWithFallback(
          messages,
          fallbackProviders,
          model,
          context
        );
      }

      throw error;
    }
  }

  /**
   * Execute streaming with retry and checkpoint recovery
   */
  private async executeStreamingWithRetry(
    messages: Message[],
    provider: string,
    model: string,
    context: StreamingContext
  ): Promise<StreamingResponse> {
    return await this.retryManager.executeWithRetry(
      async () => {
        // Create stream
        const stream = await this.createStream(provider, model, messages);

        // Handle streaming with error detection
        return await this.handleStreamWithErrorDetection(
          stream,
          context,
          provider,
          model,
          messages
        );
      },
      {
        provider,
        model,
        requestId: context.requestId,
        attempt: 0
      }
    );
  }

  /**
   * Handle stream with error detection and recovery
   */
  private async handleStreamWithErrorDetection(
    stream: ReadableStream,
    context: StreamingContext,
    provider: string,
    model: string,
    messages: Message[]
  ): Promise<StreamingResponse> {
    const response: StreamingResponse = {
      requestId: context.requestId,
      content: '',
      tokensReceived: 0,
      success: false,
      recovered: false
    };

    try {
      const reader = stream.getReader();
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          response.success = true;
          response.content = context.partialResponse;
          response.tokensReceived = context.tokensReceived;
          return response;
        }

        // Process chunk
        const text = new TextDecoder().decode(value);
        context.partialResponse += text;
        context.bytesReceived += value.length;
        tokenCount += this.estimateTokens(text);

        // Create checkpoint every 10 tokens
        if (tokenCount % 10 === 0) {
          await this.checkpointManager.createCheckpoint(
            context.requestId,
            context.partialResponse,
            tokenCount,
            context.bytesReceived
          );
        }

        // Check for errors
        const error = await this.errorDetector.detectStreamingError(
          stream,
          context
        );

        if (error) {
          return await this.handleStreamingError(
            error,
            context,
            provider,
            model,
            messages,
            response
          );
        }
      }
    } catch (error) {
      return await this.handleStreamingError(
        this.errorDetector['classifyError'](error, context),
        context,
        provider,
        model,
        messages,
        response
      );
    }
  }

  /**
   * Handle streaming error with recovery
   */
  private async handleStreamingError(
    error: StreamingError,
    context: StreamingContext,
    provider: string,
    model: string,
    messages: Message[],
    response: StreamingResponse
  ): Promise<StreamingResponse> {
    console.error(`Streaming error: ${error.type} - ${error.code}`);

    // Strategy 1: Resume from checkpoint
    if (error.suggestedAction === 'resume' && context.bytesReceived > 0) {
      console.log('Attempting to resume from checkpoint...');

      const resumption = await this.checkpointManager.resumeFromCheckpoint(
        context.requestId,
        provider,
        model,
        messages
      );

      if (resumption.success && resumption.stream) {
        response.recovered = true;
        response.tokensSkipped = resumption.tokensSkipped;

        // Continue streaming from checkpoint
        return await this.handleStreamWithErrorDetection(
          resumption.stream,
          context,
          provider,
          model,
          messages
        );
      }
    }

    // Strategy 2: Retry from beginning
    if (error.suggestedAction === 'retry') {
      console.log('Retrying from beginning...');

      return await this.executeStreamingWithRetry(
        messages,
        provider,
        model,
        context
      );
    }

    // Strategy 3: Return partial response
    if (error.suggestedAction === 'fallback' && context.partialResponse.length > 0) {
      console.log('Returning partial response...');

      response.success = true;
      response.content = context.partialResponse;
      response.tokensReceived = context.tokensReceived;
      response.partial = true;
      response.error = error;

      return response;
    }

    // Strategy 4: Abort
    response.success = false;
    response.error = error;

    return response;
  }

  private async executeWithFallback(
    messages: Message[],
    fallbackProviders: string[],
    model: string,
    context: StreamingContext
  ): Promise<StreamingResponse> {
    // Implementation
    return {
      requestId: context.requestId,
      content: '',
      tokensReceived: 0,
      success: false,
      recovered: false
    };
  }

  private async createStream(
    provider: string,
    model: string,
    messages: Message[]
  ): Promise<ReadableStream> {
    // Implementation
    return new ReadableStream();
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface StreamingResponse {
  requestId: string;
  content: string;
  tokensReceived: number;
  success: boolean;
  recovered: boolean;
  partial?: boolean;
  error?: StreamingError;
  tokensSkipped?: number;
}
```

## 6. Client-Side Handling

### 6.1 Client Reconnection Logic

```typescript
/**
 * Client-side streaming with automatic reconnection
 */

class ClientStreamingHandler {
  /**
   * Stream with client-side error handling
   */
  async streamWithReconnection(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    while (reconnectAttempts < maxReconnectAttempts) {
      try {
        await this.stream(messages, onChunk);
        onComplete();
        return;
      } catch (error) {
        reconnectAttempts++;

        if (reconnectAttempts >= maxReconnectAttempts) {
          onError(error as Error);
          return;
        }

        // Wait before reconnecting
        const delay = 1000 * Math.pow(2, reconnectAttempts - 1);
        console.log(`Reconnecting in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Stream with progress tracking
   */
  async stream(
    messages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const text = new TextDecoder().decode(value);
        onChunk(text);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 7. Error Recovery Decision Tree

```
Streaming Error Detected
├─ Network Error?
│  ├─ Bytes Received > 0?
│  │  └─ YES → Resume from Checkpoint
│  │  └─ NO → Retry from Beginning
│  └─ Retry Count < Max?
│     └─ YES → Exponential Backoff
│     └─ NO → Try Fallback Provider
│
├─ Timeout Error?
│  ├─ Bytes Received > 0?
│  │  └─ YES → Resume from Checkpoint
│  │  └─ NO → Retry with Longer Timeout
│  └─ Retry Count < Max?
│     └─ YES → Retry
│     └─ NO → Fallback Provider
│
├─ Rate Limit Error?
│  └─ Retry with Exponential Backoff (longer delays)
│
├─ Server Error (5xx)?
│  └─ Retry with Exponential Backoff
│
├─ Client Error (4xx)?
│  └─ Abort (not recoverable)
│
├─ Malformed Data?
│  └─ Abort (not recoverable)
│
└─ Resource Exhaustion?
   └─ Return Partial Response + Error
```

## 8. Monitoring and Observability

### 8.1 Error Metrics

```typescript
class StreamingErrorMetrics {
  /**
   * Track streaming errors
   */
  async trackStreamingError(
    error: StreamingError,
    context: StreamingContext
  ): Promise<void> {
    const metrics = {
      errorType: error.type,
      errorCode: error.code,
      provider: context.provider,
      model: context.model,
      bytesReceived: context.bytesReceived,
      tokensReceived: context.tokensReceived,
      recoverable: error.recoverable,
      timestamp: new Date()
    };

    // Send to monitoring system
    await this.sendMetrics(metrics);
  }

  /**
   * Get error statistics
   */
  async getErrorStats(period: 'hour' | 'day' | 'week'): Promise<ErrorStats> {
    const query = `
SELECT 
  error_type,
  error_code,
  COUNT(*) as count,
  AVG(bytes_received) as avg_bytes,
  AVG(tokens_received) as avg_tokens,
  SUM(CASE WHEN recoverable THEN 1 ELSE 0 END) as recoverable_count
FROM streaming_errors
WHERE created_at >= NOW() - INTERVAL '1 ${period}'
GROUP BY error_type, error_code
ORDER BY count DESC
    `;

    // Execute query and return results
    return {};
  }

  private async sendMetrics(metrics: any): Promise<void> {
    // Implementation
  }
}

interface ErrorStats {
  [key: string]: any;
}
```

## 9. Implementation Checklist

- [ ] Implement multi-layer error detection
- [ ] Set up checkpoint-based recovery
- [ ] Implement exponential backoff retry
- [ ] Configure provider fallback
- [ ] Add circuit breaker pattern
- [ ] Implement client-side reconnection
- [ ] Add error monitoring and metrics
- [ ] Test failure scenarios
- [ ] Document recovery procedures
- [ ] Set up alerts for repeated failures

## 10. Recommendations for Manus-like Platform

**Streaming Error Handling Strategy:**

1. **Detect Errors Early** - Multi-layer detection (network, protocol, application, data, resource)
2. **Save Checkpoints** - Every 10 tokens during streaming
3. **Resume from Checkpoint** - If bytes received > 0
4. **Retry with Backoff** - Exponential backoff with jitter
5. **Fallback Providers** - Try alternative providers on failure
6. **Return Partial** - Return partial response rather than fail completely
7. **Monitor Closely** - Track all errors and recovery attempts
8. **Alert on Patterns** - Detect systemic issues early

**Recovery Priority:**
1. Resume from checkpoint (fastest, best UX)
2. Retry from beginning (slower, but reliable)
3. Fallback provider (different provider)
4. Return partial response (degraded but functional)
5. Abort (last resort)

This comprehensive approach ensures streaming reliability while providing excellent user experience even during failures!
