import { AbstractProvider } from "@/base/provider";
import { sleep } from "@/core/utils";
import { ModelResponse } from "@/types";
import OpenAI from "openai";

export class OpenRouterProvider extends AbstractProvider {
  client: OpenAI;
  private timestamps: number[] = [];

  constructor() {
    super({
      name: "openrouter.ai",
    });

    // Initialize the client
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: this.apiKey,
      timeout: 60_0000, // 1 min
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

  async forward(
    prompt: string,
    model: string,
    system: string
  ): Promise<ModelResponse> {
    await this.enforceRateLimit();

    let response = "";
    const startedAt = new Date();
    try {
      const result = await this.client.chat.completions.create({
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

      if ("error" in result) {
        const err = result.error as any;
        throw new Error(
          `${err.message} - Code ${err.code} - ${JSON.stringify(err)}`
        );
      }

      response = result.choices[0].message.content || "";
    } catch (err) {
      this.logger.error(`Something went wrong: ${err}`);
    }
    const completedAt = new Date();

    return {
      response,
      startedAt,
      completedAt,
    };
  }
}
