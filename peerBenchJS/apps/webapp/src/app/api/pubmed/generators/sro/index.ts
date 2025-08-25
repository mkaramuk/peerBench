import { AbstractTaskGenerator } from "../abstract-generator";
import {
  ParagraphMergeStrategy,
  MergeParagraphsStep,
  ParagraphMergeStrategyType,
} from "../common/steps/merge-paragraphs";
import { ShuffleSentencesStep } from "./steps/shuffle-sentences";
import { SplitSentencesStep } from "./steps/split-sentences";

export class SROTaskGenerator extends AbstractTaskGenerator {
  paragraphMergeStrategy: ParagraphMergeStrategyType;
  originalOrder: string[] = [];

  constructor(paragraphMergeStrategy?: ParagraphMergeStrategyType) {
    super("sro");
    this.paragraphMergeStrategy =
      paragraphMergeStrategy ?? ParagraphMergeStrategy.WithoutTitles;
  }

  init() {
    return [
      new MergeParagraphsStep<SROTaskGenerator>(this, {
        entry: this.entry,
        strategy: this.paragraphMergeStrategy,
      }),
      new SplitSentencesStep(this).onFinish((result) => {
        this.originalOrder = [...result];
      }),
      new ShuffleSentencesStep(this),
    ] as const;
  }
}
