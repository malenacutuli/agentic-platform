import {
  LLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  GoogleGeminiProvider,
  LLMRequest,
  LLMResponse,
  StreamChunk,
} from "./providers.js";
import { logger } from "../../utils/logger.js";

export interface ProviderConfig {
  name: "openai" | "anthropic" | "google";
  apiKey: string;
  enabled: boolean;
  priority: number;
  maxConcurrent: number;
  rateLimitPerMinute: number;
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private providerConfigs: ProviderConfig[];
  private activeRequests: Map<string, number> = new Map();
  private rateLimitTracker: Map<string, number[]> = new Map();

  constructor(configs: ProviderConfig[]) {
    this.providerConfigs = configs.sort((a, b) => a.priority - b.priority);
    this.initializeProviders();
  }

  /**
   * Initialize LLM providers
   */
  private initializeProviders(): void {
    for (const config of this.providerConfigs) {
      if (!config.enabled) {
        logger.info(`[LLMRouter] Provider ${config.name} disabled`);
        continue;
      }

      let provider: LLMProvider;

      switch (config.name) {
        case "openai":
          provider = new OpenAIProvider(config.apiKey);
          break;
        case "anthropic":
          provider = new AnthropicProvider(config.apiKey);
          break;
        case "google":
          provider = new GoogleGeminiProvider(config.apiKey);
          break;
        default:
          continue;
      }

      this.providers.set(config.name, provider);
      this.activeRequests.set(config.name, 0);
      this.rateLimitTracker.set(config.name, []);

      logger.info(`[LLMRouter] Provider ${config.name} initialized`);
    }
  }

  /**
   * Route request to best available provider
   */
  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const provider = await this.selectProvider(request);

    if (!provider) {
      throw new Error("No available LLM providers");
    }

    try {
      const providerName = this.getProviderName(provider);
      this.incrementActiveRequests(providerName);

      logger.info(`[LLMRouter] Invoking ${providerName}`, {
        model: request.model,
        messageCount: request.messages.length,
      });

      const response = await provider.invoke(request);

      await this.trackCost(providerName, response.usage);

      return response;
    } finally {
      const providerName = this.getProviderName(provider);
      this.decrementActiveRequests(providerName);
    }
  }

  /**
   * Stream response from provider
   */
  async *stream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    const provider = await this.selectProvider(request);

    if (!provider) {
      throw new Error("No available LLM providers");
    }

    const providerName = this.getProviderName(provider);
    this.incrementActiveRequests(providerName);

    logger.info(`[LLMRouter] Streaming from ${providerName}`, {
      model: request.model,
    });

    try {
      for await (const chunk of provider.stream(request)) {
        yield chunk;
      }
    } finally {
      this.decrementActiveRequests(providerName);
    }
  }

  /**
   * Select best provider based on availability and load
   */
  private async selectProvider(request: LLMRequest): Promise<LLMProvider | null> {
    const sortedProviders = Array.from(this.providers.entries()).sort((a, b) => {
      const configA = this.providerConfigs.find((c) => c.name === a[0]);
      const configB = this.providerConfigs.find((c) => c.name === b[0]);
      return (configA?.priority || 999) - (configB?.priority || 999);
    });

    for (const [name, provider] of sortedProviders) {
      // Check if provider is available
      if (!(await this.isProviderAvailable(name))) {
        logger.warn(`[LLMRouter] Provider ${name} not available, trying next...`);
        continue;
      }

      // Check rate limit
      if (!(await this.checkRateLimit(name))) {
        logger.warn(`[LLMRouter] Provider ${name} rate limited, trying next...`);
        continue;
      }

      // Check concurrent requests
      const config = this.providerConfigs.find((c) => c.name === name);
      const activeCount = this.activeRequests.get(name) || 0;

      if (config && activeCount >= config.maxConcurrent) {
        logger.warn(
          `[LLMRouter] Provider ${name} at capacity (${activeCount}/${config.maxConcurrent}), trying next...`
        );
        continue;
      }

      return provider;
    }

    return null;
  }

  /**
   * Check if provider is available
   */
  private async isProviderAvailable(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) return false;

    // For now, assume all initialized providers are available
    // In production, implement actual health checks
    return true;
  }

  /**
   * Check rate limit for provider
   */
  private async checkRateLimit(providerName: string): Promise<boolean> {
    const config = this.providerConfigs.find((c) => c.name === providerName);
    if (!config) return false;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const tracker = this.rateLimitTracker.get(providerName) || [];
    const recentRequests = tracker.filter((t) => t > oneMinuteAgo);

    if (recentRequests.length >= config.rateLimitPerMinute) {
      return false;
    }

    this.trackRequest(providerName);
    return true;
  }

  /**
   * Track request for rate limiting
   */
  private trackRequest(providerName: string): void {
    const tracker = this.rateLimitTracker.get(providerName) || [];
    tracker.push(Date.now());

    const oneMinuteAgo = Date.now() - 60000;
    const filtered = tracker.filter((t) => t > oneMinuteAgo);

    this.rateLimitTracker.set(providerName, filtered);
  }

  /**
   * Track cost for billing
   */
  private async trackCost(
    providerName: string,
    usage: { promptTokens: number; completionTokens: number }
  ): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) return;

    const cost = provider.getCost(usage.promptTokens, usage.completionTokens);

    logger.info(`[LLMRouter] Cost tracked`, {
      provider: providerName,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cost: `$${cost.toFixed(4)}`,
    });
  }

  /**
   * Increment active requests counter
   */
  private incrementActiveRequests(providerName: string): void {
    const current = this.activeRequests.get(providerName) || 0;
    this.activeRequests.set(providerName, current + 1);
  }

  /**
   * Decrement active requests counter
   */
  private decrementActiveRequests(providerName: string): void {
    const current = this.activeRequests.get(providerName) || 0;
    this.activeRequests.set(providerName, Math.max(0, current - 1));
  }

  /**
   * Get provider name from instance
   */
  private getProviderName(provider: LLMProvider): string {
    for (const [name, p] of this.providers.entries()) {
      if (p === provider) return name;
    }
    return "unknown";
  }

  /**
   * Get router status
   */
  getStatus(): {
    providers: Array<{
      name: string;
      active: number;
      available: boolean;
    }>;
  } {
    return {
      providers: Array.from(this.providers.entries()).map(([name, _]) => ({
        name,
        active: this.activeRequests.get(name) || 0,
        available: true,
      })),
    };
  }
}
