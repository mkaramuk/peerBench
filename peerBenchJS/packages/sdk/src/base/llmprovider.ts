import { AbstractProvider } from "@/base/provider";
import { MaybePromise, ModelResponse } from "@/types";
import { ForwardError } from "@/errors/provider";
import { sleep } from "@/utils/sleep";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Base class for LLM based providers which uses OpenAI's API interface
 */
export abstract class BaseLLMProvider extends AbstractProvider {
  client: OpenAI;
  protected timestamps: number[] = [];
  protected rateLimit: number;
  protected rateLimitTimeWindow: number;
  protected timeout: number;

  /**
   * Initialize a new LLM provider
   * @param options Options for the provider
   */
  constructor(options: BaseLLMProviderOptions) {
    super(options);

    this.rateLimit = options.rateLimit ?? 20;
    this.rateLimitTimeWindow = options.rateLimitTimeWindow ?? 3000;
    this.timeout = options.timeout ?? 5 * 60_000;

    // Initialize the client
    this.client = new OpenAI({
      baseURL: options.baseURL,
      apiKey: options.apiKey,
      maxRetries: options.maxRetries,
      timeout: options.timeout,
      dangerouslyAllowBrowser: true,
    });
  }

  async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    this.timestamps = this.timestamps.filter(
      (ts) => now - ts < this.rateLimitTimeWindow
    );

    if (this.timestamps.length < this.rateLimit) {
      this.timestamps.push(now);
      return;
    }

    const earliest = this.timestamps[0];
    const waitTime = this.rateLimitTimeWindow - (now - earliest);

    await sleep(waitTime);

    return this.enforceRateLimit();
  }

  /**
   * Fetch all supported models from the provider
   * @returns Array of model information
   */
  async getSupportedModels(): Promise<ModelInfo[]> {
    await this.enforceRateLimit();

    try {
      const response = await this.client.models.list();
      const models = response.data;
      const parsedModels = await Promise.all(
        models.map(async (model) => {
          const parsed = await this.parseModelInfo(model);

          if (!parsed) {
            return;
          }

          return {
            ...parsed,
            metadata: {
              // These fields might not be available in all models
              contextWindow: (model as any).context_window,
              maxTokens: (model as any).max_tokens,
              pricing: (model as any).pricing
                ? {
                    input: (model as any).pricing.input,
                    output: (model as any).pricing.output,
                  }
                : undefined,
            },
          };
        })
      );

      // Filter out the models that are not mapped correctly and returned as undefined from parsing method
      return parsedModels.filter((model) => model !== undefined);
    } catch (error) {
      throw new Error(
        `Failed to fetch supported models: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async forward(
    prompt: string,
    model: string,
    options?: {
      system?: string;
      abortSignal?: AbortSignal;
    }
  ): Promise<ModelResponse> {
    await this.enforceRateLimit();

    const startedAt = new Date();
    try {
      const messages: ChatCompletionMessageParam[] = [];
      // Add system message if provided
      if (options?.system) {
        messages.push({
          role: "system",
          content: options.system,
        });
      }

      // Add user message
      messages.push({
        role: "user",
        content: prompt,
      });

      const response = await this.client.chat.completions.create(
        {
          model,
          messages,
        },
        { signal: options?.abortSignal, timeout: this.timeout }
      );

      if ("error" in response) {
        const err = response.error as any;
        throw new Error(
          `${err.message} - Code ${err.code} - ${JSON.stringify(err)}`
        );
      }

      return {
        response: response?.choices?.[0]?.message?.content || "",
        startedAt,
        completedAt: new Date(),
      };
    } catch (err) {
      // Wrap the error in a ForwardError to be able to include the startedAt time
      throw new ForwardError(
        `Failed to forward prompt to the model: ${err instanceof Error ? err.message : err}`,
        {
          cause: err,
          startedAt,
        }
      );
    }
  }

  /**
   * Parses the given model ID that includes the model name, owner, and sub-provider (if any).
   * @param id Model ID that has the format `<sub provider name if any>/<model owner>/<model name>`
   */
  abstract parseModelInfo(
    modelOrId: OpenAI.Models.Model | string
  ): MaybePromise<ModelInfo | undefined>;
}

export type BaseLLMProviderOptions = {
  /**
   * Name of the provider
   */
  name: string;

  /**
   * API key for the provider
   */
  apiKey: string;

  /**
   * Base URL for the provider
   */
  baseURL?: string;

  /**
   * Maximum number of retries for the provider
   */
  maxRetries?: number;

  /**
   * Timeout for the provider
   */
  timeout?: number;

  /**
   * Rate limit for the provider
   */
  rateLimit?: number;

  /**
   * Rate limit time window for the provider
   */
  rateLimitTimeWindow?: number;
};

/**
 * Parsed information about the model.
 */
export type ModelInfo = {
  /**
   * Original ID of the model that can be used in the requests
   */
  id: string;

  /**
   * Unified name of the model
   */
  name: LargeLanguageModelType;

  /**
   * Unified owner of the model
   */
  owner: LargeLanguageModelOwnerType;

  /**
   * Provider name of the model
   * TODO: This field might be redundant
   */
  provider: string;

  /**
   * The entity that responsible for hosting the model
   */
  host?: string;

  /**
   * The tier of the model (e.g free, max)
   */
  tier?: string;

  /**
   * Additional metadata (warning: not might be available always)
   */
  metadata?: Record<string, unknown>;
};

/**
 * Known LLM owners
 */
export const LargeLanguageModelOwner = {
  Meta: "meta",
  OpenAI: "openai",
  Deepseek: "deepseek",
  Qwen: "qwen",
  Google: "google",
  XAI: "x-ai",
  Anthropic: "anthropic",
} as const;

export type LargeLanguageModelOwnerType =
  (typeof LargeLanguageModelOwner)[keyof typeof LargeLanguageModelOwner];

/**
 * Known models of Meta
 */
export const MetaModels = {
  Llama_4_Maverick: "llama-4-maverick",
  Llama_4_Scout: "llama-4-scout",
  Llama_3_3_70b_Instruct: "llama-3.3-70b-instruct",
  Llama_3_1_8b_Instruct: "llama-3.1-8b-instruct",
} as const;

/**
 * Known models of Qwen
 */
export const QwenModels = {
  QwQ_32b: "qwq-32b",
} as const;

/**
 * Known models of DeepSeek
 */
export const DeepSeekModels = {
  V3: "deepseek-v3",
  V3_0324: "deepseek-v3-0324",
} as const;

/**
 * Known models of XAI
 */
export const XAIModels = {
  Grok3_Beta: "grok-3-beta",
} as const;

/**
 * Known models of Google
 */
export const GoogleModels = {
  Gemini_2_0_Flash: "gemini-2.0-flash",
} as const;

/**
 * Known models of Anthropic
 */
export const AnthropicModels = {
  Claude_3_7_Sonnet: "claude-3.7-sonnet",
} as const;

export const OpenAIModels = {
  ChatGPT_4o: "chatgpt-4o-latest",
  GPT_4o: "gpt-4o",
  GPT_4o_Mini: "gpt-4o-mini",
} as const;

/**
 * Known models of all providers
 */
export const LargeLanguageModel = {
  [LargeLanguageModelOwner.Meta]: MetaModels,
  [LargeLanguageModelOwner.Deepseek]: DeepSeekModels,
  [LargeLanguageModelOwner.Qwen]: QwenModels,
  [LargeLanguageModelOwner.Google]: GoogleModels,
  [LargeLanguageModelOwner.XAI]: XAIModels,
  [LargeLanguageModelOwner.OpenAI]: OpenAIModels,
  [LargeLanguageModelOwner.Anthropic]: AnthropicModels,
} as const;

export type LargeLanguageModelType =
  | (typeof MetaModels)[keyof typeof MetaModels]
  | (typeof DeepSeekModels)[keyof typeof DeepSeekModels]
  | (typeof QwenModels)[keyof typeof QwenModels]
  | (typeof GoogleModels)[keyof typeof GoogleModels]
  | (typeof XAIModels)[keyof typeof XAIModels]
  | (typeof AnthropicModels)[keyof typeof AnthropicModels]
  | (typeof OpenAIModels)[keyof typeof OpenAIModels];
