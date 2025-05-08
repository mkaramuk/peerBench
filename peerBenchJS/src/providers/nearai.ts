import { AbstractProvider } from "@/base/provider";
import { readFile, sleep } from "@/core/utils";
import { ModelResponse } from "@/types";
import OpenAI from "openai";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";

const NearAIEnv = {
  CONFIG_PATH: z.string().default(join(homedir(), ".nearai", "config.json")),
  RATE_LIMIT: z.coerce.number().default(1),
  RATE_LIMIT_TIME_WINDOW: z.coerce.number().default(3000),
  TIMEOUT: z.coerce.number().default(60_0000), // 1 minute
  MAX_RETRIES: z.coerce.number().default(3),
};

export class NearAIProvider extends AbstractProvider<typeof NearAIEnv> {
  client: OpenAI;
  private timestamps: number[] = [];

  constructor() {
    super({
      name: "near.ai",
      env: NearAIEnv,
    });

    // Parse config file
    const config = JSON.parse(readFile(this.env.CONFIG_PATH));

    if (!config?.auth?.signature) {
      throw new Error(
        'Signature is not found. Please try to login via "nearai" CLI'
      );
    }

    // Initialize the client
    this.client = new OpenAI({
      baseURL: "https://api.near.ai/v1",
      apiKey: JSON.stringify(config?.auth),
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
    const regex =
      /^(?<providerName>[^:]+)::(?<modelOwner>[^/]+)\/(?<modelName>.+)$/;
    const match = identifier.match(regex);
    if (match?.groups) {
      const providerName = match.groups.providerName;
      let modelOwner = match.groups.modelOwner;
      let modelName = match.groups.modelName;

      if (modelOwner === "accounts") {
        // Model owner field is not available,
        // so just use the provider name for it.
        modelOwner = providerName;
      }

      // Delete redundant part
      if (modelName.startsWith(`${providerName}/models`)) {
        modelName = modelName.replaceAll(`${providerName}/models`, "");
      }

      return {
        modelOwner,
        modelName,
        subProvider: providerName,
      };
    }

    throw new Error(`Invalid identifier format: ${identifier}`);
  }
}
