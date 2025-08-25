import {
  BaseLLMProvider,
  BaseLLMProviderOptions,
  LargeLanguageModel,
  LargeLanguageModelOwner,
  LargeLanguageModelOwnerType,
  LargeLanguageModelType,
  ModelInfo,
} from "@/base/llmprovider";
import OpenAI from "openai";

export type OpenRouterProviderOptions = Omit<
  BaseLLMProviderOptions,
  "baseURL" | "name"
>;

export class OpenRouterProvider extends BaseLLMProvider {
  constructor(options: OpenRouterProviderOptions) {
    super({
      ...options,
      baseURL: "https://openrouter.ai/api/v1",
      name: "openrouter.ai",
    });
  }

  parseModelInfo(
    modelOrId: OpenAI.Models.Model | string
  ): ModelInfo | undefined {
    const id = typeof modelOrId === "string" ? modelOrId : modelOrId.id;
    const [, modelName] = id.split("/");

    if (!modelName) {
      return;
    }

    let name: LargeLanguageModelType;
    let owner: LargeLanguageModelOwnerType;

    switch (modelName) {
      case "chatgpt-4o-latest":
        owner = LargeLanguageModelOwner.OpenAI;
        name = LargeLanguageModel[owner].ChatGPT_4o;
        break;
      case "gpt-4o-mini":
        owner = LargeLanguageModelOwner.OpenAI;
        name = LargeLanguageModel[owner].GPT_4o_Mini;
        break;
      case "deepseek-chat-v3-0324":
        owner = LargeLanguageModelOwner.Deepseek;
        name = LargeLanguageModel[owner].V3_0324;
        break;
      case "gpt-4o":
        owner = LargeLanguageModelOwner.OpenAI;
        name = LargeLanguageModel[owner].GPT_4o;
        break;
      case "claude-3.7-sonnet":
        owner = LargeLanguageModelOwner.Anthropic;
        name = LargeLanguageModel[owner].Claude_3_7_Sonnet;
        break;
      case "llama-3.3-70b-instruct":
        owner = LargeLanguageModelOwner.Meta;
        name = LargeLanguageModel[owner].Llama_3_3_70b_Instruct;
        break;
      case "llama-3.1-8b-instruct":
        owner = LargeLanguageModelOwner.Meta;
        name = LargeLanguageModel[owner].Llama_3_1_8b_Instruct;
        break;
      case "deepseek-chat":
        owner = LargeLanguageModelOwner.Deepseek;
        name = LargeLanguageModel[owner].V3;
        break;
      case "qwq-32b":
        owner = LargeLanguageModelOwner.Qwen;
        name = LargeLanguageModel[owner].QwQ_32b;
        break;
      case "gemini-2.0-flash-001":
        owner = LargeLanguageModelOwner.Google;
        name = LargeLanguageModel[owner].Gemini_2_0_Flash;
        break;
      case "grok-3-beta":
      case "grok-3":
        owner = LargeLanguageModelOwner.XAI;
        name = LargeLanguageModel[owner].Grok3_Beta;
        break;
      case "llama-4-maverick":
        owner = LargeLanguageModelOwner.Meta;
        name = LargeLanguageModel[owner].Llama_4_Maverick;
        break;
      case "llama-4-scout":
        owner = LargeLanguageModelOwner.Meta;
        name = LargeLanguageModel[owner].Llama_4_Scout;
        break;
      default:
        return;
    }

    return {
      id,
      name,
      owner,
      provider: this.name.toLowerCase(),
    };
  }
}
