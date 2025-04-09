import { AbstractProvider } from "@/base/provider";
import { ModelResponse } from "@/types";
import OpenAI from "openai";

export class OpenRouterProvider extends AbstractProvider {
  client: OpenAI;

  constructor() {
    super({
      name: "openrouter.ai",
    });

    // Initialize the client
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: this.apiKey,
    });
  }

  async forward(prompt: string, model: string): Promise<ModelResponse> {
    let response = "";
    const startedAt = new Date();
    try {
      const result = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      response = result.choices[0].message.content || "";
    } catch (err) {
      this.logger.error(`Something went wrong: ${err}`);
    }

    return {
      response,
      startedAt,
      completedAt: new Date(),
    };
  }
}
