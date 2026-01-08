import { logger } from "../../utils/logger.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | Array<{
        type: "text" | "image_url" | "file_url";
        text?: string;
        image_url?: { url: string; detail?: "auto" | "low" | "high" };
        file_url?: { url: string; mime_type?: string };
      }>;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  tools?: any[];
  toolChoice?: "auto" | "required" | "none";
  responseFormat?: {
    type: "json_schema" | "json_object" | "text";
    schema?: any;
  };
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  created: number;
}

export interface StreamChunk {
  type: "start" | "content" | "end" | "error";
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  error?: string;
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
  protected apiKey: string;
  protected baseUrl: string;
  protected modelName: string;
  protected costPer1kTokens: { input: number; output: number };

  constructor(
    apiKey: string,
    baseUrl: string,
    modelName: string,
    costPer1kTokens: { input: number; output: number }
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.modelName = modelName;
    this.costPer1kTokens = costPer1kTokens;
  }

  abstract invoke(request: LLMRequest): Promise<LLMResponse>;
  abstract stream(request: LLMRequest): AsyncGenerator<StreamChunk>;
  abstract countTokens(text: string): number;

  getCost(inputTokens: number, outputTokens: number): number {
    return (
      (inputTokens / 1000) * this.costPer1kTokens.input +
      (outputTokens / 1000) * this.costPer1kTokens.output
    );
  }
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider extends LLMProvider {
  constructor(apiKey: string) {
    super(
      apiKey,
      "https://api.openai.com/v1",
      "gpt-4-turbo",
      { input: 0.01, output: 0.03 }
    );
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model || this.modelName,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          tools: request.tools,
          tool_choice: request.toolChoice,
          response_format: request.responseFormat,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        model: data.model,
        choices: data.choices.map((choice: any) => ({
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finishReason: choice.finish_reason,
        })),
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        created: data.created,
      };
    } catch (error) {
      logger.error("OpenAI API error", { error });
      throw error;
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model || this.modelName,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      yield { type: "start" };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              if (data === "[DONE]") {
                yield { type: "end" };
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices[0]?.delta?.content) {
                  yield {
                    type: "content",
                    content: parsed.choices[0].delta.content,
                  };
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error("OpenAI streaming error", { error });
      yield { type: "error", error: String(error) };
    }
  }

  countTokens(text: string): number {
    // Approximate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider extends LLMProvider {
  constructor(apiKey: string) {
    super(
      apiKey,
      "https://api.anthropic.com",
      "claude-3-opus-20240229",
      { input: 0.015, output: 0.075 }
    );
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    try {
      const systemMessage = request.messages.find((m) => m.role === "system");
      const otherMessages = request.messages.filter((m) => m.role !== "system");

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model || this.modelName,
          max_tokens: request.maxTokens || 4096,
          system: systemMessage?.content,
          messages: otherMessages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          temperature: request.temperature,
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        model: data.model,
        choices: [
          {
            message: {
              role: "assistant",
              content: data.content[0].text,
            },
            finishReason: data.stop_reason,
          },
        ],
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        created: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      logger.error("Anthropic API error", { error });
      throw error;
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    try {
      const systemMessage = request.messages.find((m) => m.role === "system");
      const otherMessages = request.messages.filter((m) => m.role !== "system");

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model || this.modelName,
          max_tokens: request.maxTokens || 4096,
          system: systemMessage?.content,
          messages: otherMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      yield { type: "start" };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "content_block_delta") {
                  yield {
                    type: "content",
                    content: data.delta.text,
                  };
                }

                if (data.type === "message_stop") {
                  yield { type: "end" };
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error("Anthropic streaming error", { error });
      yield { type: "error", error: String(error) };
    }
  }

  countTokens(text: string): number {
    // Approximate: ~3.5 characters per token for Claude
    return Math.ceil(text.length / 3.5);
  }
}

/**
 * Google Gemini Provider
 */
export class GoogleGeminiProvider extends LLMProvider {
  constructor(apiKey: string) {
    super(
      apiKey,
      "https://generativelanguage.googleapis.com",
      "gemini-pro",
      { input: 0.0005, output: 0.0015 }
    );
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1beta/models/${request.model || this.modelName}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: request.messages.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
              topP: request.topP,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.candidates[0].index.toString(),
        model: request.model || this.modelName,
        choices: [
          {
            message: {
              role: "assistant",
              content: data.candidates[0].content.parts[0].text,
            },
            finishReason: data.candidates[0].finishReason,
          },
        ],
        usage: {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        },
        created: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      logger.error("Google API error", { error });
      throw error;
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1beta/models/${request.model || this.modelName}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: request.messages.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      yield { type: "start" };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                  yield {
                    type: "content",
                    content: data.candidates[0].content.parts[0].text,
                  };
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error("Google streaming error", { error });
      yield { type: "error", error: String(error) };
    }
  }

  countTokens(text: string): number {
    // Approximate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
