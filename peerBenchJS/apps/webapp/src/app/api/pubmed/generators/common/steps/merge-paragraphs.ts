import { AbstractStep } from "../../abstract-step";
import { PubMedRSSArticle } from "../../../types";
import { AbstractTaskGenerator } from "../../abstract-generator";

export type MergeParagraphsStepResult = string;
export type MergeParagraphsStepArgs = {
  entry: PubMedRSSArticle;
  strategy: ParagraphMergeStrategyType;
};

export class MergeParagraphsStep<
  T extends AbstractTaskGenerator,
> extends AbstractStep<MergeParagraphsStepArgs, MergeParagraphsStepResult, T> {
  constructor(taskGenerator: T, args: MergeParagraphsStepArgs) {
    super(`merge-paragraphs-${args.strategy}`, taskGenerator, args);
  }

  async run() {
    switch (this.args.strategy) {
      case ParagraphMergeStrategy.WithoutTitles:
        return Object.entries(this.args.entry.paragraphs)
          .map(([, value]) => value)
          .join("\n");
      case ParagraphMergeStrategy.TitlesAsSentences:
        return Object.entries(this.args.entry.paragraphs)
          .map(([key, value]) => `${key}. ${value}`)
          .join("\n");
      case ParagraphMergeStrategy.TitlesWithinSentences:
        return Object.entries(this.args.entry.paragraphs)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
    }
  }
}

export const ParagraphMergeStrategy = {
  WithoutTitles: "without-titles",
  TitlesAsSentences: "with-titles-as-sentences",
  TitlesWithinSentences: "titles-within-sentences",
} as const;
export type ParagraphMergeStrategyType =
  (typeof ParagraphMergeStrategy)[keyof typeof ParagraphMergeStrategy];
