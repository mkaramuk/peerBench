import { AbstractStep } from "../../abstract-step";
import { SROTaskGenerator } from "..";
import natural from "natural";

export type SplitSentencesStepResult = string[];

export class SplitSentencesStep extends AbstractStep<
  unknown,
  SplitSentencesStepResult,
  SROTaskGenerator
> {
  constructor(taskGenerator: SROTaskGenerator) {
    super("split-sentences", taskGenerator, {});
    this.tags.push("with-natural-library");
  }

  async run() {
    const input = this.generator.lastResult as string;
    const tokenizer = new natural.SentenceTokenizer([]);
    const sentences = tokenizer.tokenize(input);

    return sentences;
  }
}
