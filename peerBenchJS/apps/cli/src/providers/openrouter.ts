import { AbstractProvider } from "@/base/provider";
import { sleep } from "@/core/utils";
import { ModelResponse } from "@/types";
import OpenAI from "openai";
import { z } from "zod";

const OpenRouterEnv = {
  KEY: z.string().nonempty(),
  RATE_LIMIT: z.coerce.number().default(20),
  RATE_LIMIT_TIME_WINDOW: z.coerce.number().default(3000),
  TIMEOUT: z.coerce.number().default(60_0000), // 1 minute
  MAX_RETRIES: z.coerce.number().default(3),
};

export class OpenRouterProvider extends AbstractProvider<typeof OpenRouterEnv> {
  client: OpenAI;
  private timestamps: number[] = [];

  constructor() {
    super({
      name: "openrouter.ai",
      env: OpenRouterEnv,
    });

    // Initialize the client
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: this.env.KEY,
      maxRetries: this.env.MAX_RETRIES,
      timeout: this.env.TIMEOUT,
    });
  }

  async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    this.timestamps = this.timestamps.filter(
      (ts) => now - ts < this.env.RATE_LIMIT_TIME_WINDOW
    );

    if (this.timestamps.length < this.env.RATE_LIMIT) {
      this.timestamps.push(now);
      return;
    }

    const earliest = this.timestamps[0];
    const waitTime = this.env.RATE_LIMIT_TIME_WINDOW - (now - earliest);

    await sleep(waitTime);

    return this.enforceRateLimit();
  }

  async forward(
    prompt: string,
    model: string,
    system: string
  ): Promise<ModelResponse> {
    await this.enforceRateLimit();

    const startedAt = new Date();
    const response = await this.client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

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
  }

  parseModelIdentifier(identifier: string): {
    modelName: string;
    modelOwner: string;
    subProvider?: string;
  } {
    const regex = /^(?<owner>[^/]+)\/(?<model>[^:]+)(?::(?<tier>.+))?$/;
    const match = identifier.match(regex);

    if (match?.groups) {
      const modelOwner = match.groups.owner;
      const tier = match.groups.tier;
      let modelName = match.groups.model;

      if (tier) {
        modelName += "-" + tier;
      }

      return {
        modelOwner,
        modelName,
        subProvider: undefined, // TODO: parse sub provider if exists
      };
    }

    throw new Error(`Invalid identifier format: ${identifier}`);
  }
}
