import { AbstractTaskGenerator } from "../abstract-generator";
import {
  MakeTypoStep,
  MakeTypoStrategy,
  PickTextStrategy,
} from "./steps/make-typo";

export class TYPTaskGenerator extends AbstractTaskGenerator {
  strategy: PickTextStrategy;
  difficulty: MakeTypoStrategy;

  constructor(params: {
    strategy: PickTextStrategy;
    difficulty: MakeTypoStrategy;
  }) {
    super("trp");
    this.strategy = params.strategy;
    this.difficulty = params.difficulty;
  }

  init() {
    return [
      new MakeTypoStep(this, {
        entry: this.entry,
        strategy: this.difficulty,
        pickTextStrategy: this.strategy,
      }),
    ] as const;
  }
}
