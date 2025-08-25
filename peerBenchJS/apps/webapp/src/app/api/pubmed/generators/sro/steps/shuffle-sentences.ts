import { AbstractStep } from "../../abstract-step";
import { SROTaskGenerator } from "..";
import { cryptoRandom } from "@/utils/crypto-random";

export type ShuffleSentencesStepResult = string[];

export class ShuffleSentencesStep extends AbstractStep<
  unknown,
  ShuffleSentencesStepResult,
  SROTaskGenerator
> {
  constructor(taskGenerator: SROTaskGenerator) {
    super("shuffle-sentences", taskGenerator, {});
  }

  async run() {
    const sentences = this.generator.lastResult as string[];
    return [...sentences].sort(() => cryptoRandom() - 0.5);
  }
}
