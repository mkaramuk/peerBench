import { AbstractStep } from "../../abstract-step";
import { TRPTaskGenerator } from "..";
import { BaseLLMProvider } from "@peerbench/sdk";
import { parseResponseAsJSON } from "../../../functions/llm";

export type PerformNERStepResult = string[];
export type PerformNERStepArgs = {
  provider: BaseLLMProvider;
  model: string;
  systemPrompt?: string;
  entityTypes?: NEREntityType[];
};

export class PerformNERStep extends AbstractStep<
  PerformNERStepArgs,
  PerformNERStepResult,
  TRPTaskGenerator
> {
  constructor(taskGenerator: TRPTaskGenerator, args: PerformNERStepArgs) {
    const entityTypes = args.entityTypes || [
      "nouns",
      "verbs",
      "adjectives",
      "medical-related-entities",
      "named-entities",
    ];

    super(`perform-ner`, taskGenerator, args);
    this.args.entityTypes = entityTypes;
    this.tags.push(...entityTypes.map((e) => `ner-for-${e}`));
  }

  async run() {
    const text = this.generator.lastResult as string;
    const { response } = await this.args.provider.forward(
      text,
      this.args.model,
      {
        system:
          this.args.systemPrompt ||
          `You are a Named Entity Recognition model which is specialized on medical relevant texts. Your task is extracting all; ${this.args.entityTypes?.map((e) => e.replaceAll("-", " ")).join(", ")}. Your output strictly forced to be a JSON array of strings where each item represents a single entity that you've extracted. Markdown formatting is forbidden. JSON output must be minified.`,
      }
    );

    return parseResponseAsJSON<string[]>(response);
  }
}

export const NEREntityTypes = [
  "nouns",
  "verbs",
  "adjectives",
  "named-entities",
  "medical-related-entities",
] as const;
export type NEREntityType = (typeof NEREntityTypes)[number];
