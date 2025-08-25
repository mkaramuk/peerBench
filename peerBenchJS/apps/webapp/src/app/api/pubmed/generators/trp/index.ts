import { BaseLLMProvider } from "@peerbench/sdk";
import { AbstractTaskGenerator } from "../abstract-generator";
import { NEREntityType, PerformNERStep } from "./steps/perform-ner";
import {
  MergeParagraphsStep,
  ParagraphMergeStrategy,
  ParagraphMergeStrategyType,
} from "../common/steps/merge-paragraphs";
import {
  ReplaceEntitiesStep,
  ReplaceEntityStrategyType,
} from "./steps/replace-entities";

export class TRPTaskGenerator extends AbstractTaskGenerator {
  originalText: string = "";
  modifiedText: string = "";
  entities: string[] = [];
  provider: BaseLLMProvider;
  model: string;
  entityTypes?: NEREntityType[];
  systemPrompt?: string;
  replaceEntityStrategy?: ReplaceEntityStrategyType;
  paragraphMergeStrategy?: ParagraphMergeStrategyType;

  constructor(params: {
    provider: BaseLLMProvider;
    model: string;
    systemPrompt?: string;
    entityTypes?: NEREntityType[];
    replaceEntityStrategy?: ReplaceEntityStrategyType;
    paragraphMergeStrategy?: ParagraphMergeStrategyType;
  }) {
    super("trp");
    this.provider = params.provider;
    this.model = params.model;
    this.systemPrompt = params.systemPrompt;
    this.entityTypes = params.entityTypes;
    this.replaceEntityStrategy = params.replaceEntityStrategy;
    this.paragraphMergeStrategy = params.paragraphMergeStrategy;
  }

  init() {
    return [
      new MergeParagraphsStep<TRPTaskGenerator>(this, {
        entry: this.entry,
        strategy:
          this.paragraphMergeStrategy ||
          ParagraphMergeStrategy.TitlesWithinSentences,
      }).onFinish((result) => {
        this.originalText = result;
      }),
      new PerformNERStep(this, {
        provider: this.provider,
        model: this.model,
        systemPrompt: this.systemPrompt,
        entityTypes: this.entityTypes,
      }).onFinish((result) => {
        this.entities = result;
      }),
      new ReplaceEntitiesStep(this, {
        replaceEntityStrategy: this.replaceEntityStrategy,
      }).onFinish((result) => {
        this.modifiedText = result;
      }),
    ] as const;
  }
}
