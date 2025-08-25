import { AbstractStep } from "../../abstract-step";
import { TRPTaskGenerator } from "..";

export type ReplaceEntitiesStepResult = string;
export type ReplaceEntitiesStepArgs = {
  replaceEntityStrategy?: ReplaceEntityStrategyType;
};

export class ReplaceEntitiesStep extends AbstractStep<
  ReplaceEntitiesStepArgs,
  ReplaceEntitiesStepResult,
  TRPTaskGenerator
> {
  constructor(taskGenerator: TRPTaskGenerator, args: ReplaceEntitiesStepArgs) {
    super(
      `replace-entities-${args.replaceEntityStrategy || "with-placeholder"}`,
      taskGenerator,
      args
    );
  }

  async run() {
    let modifiedText = this.generator.originalText;

    // We need to start replacing from the longest entity
    // to avoid replacing short entities that are overlapping
    // on the longer ones
    const entities = [...this.generator.entities].sort(
      (a, b) => b.length - a.length
    );

    for (const entity of entities) {
      switch (this.args?.replaceEntityStrategy) {
        case ReplaceEntityStrategy.WithSpace:
          modifiedText = modifiedText.replaceAll(entity, " ");
          break;
        default:
          modifiedText = modifiedText.replaceAll(entity, "{}");
          break;
      }
    }

    return modifiedText;
  }
}

export const ReplaceEntityStrategy = {
  WithSpace: "with-space",
  WithPlaceholder: "with-placeholder",
} as const;
export type ReplaceEntityStrategyType =
  (typeof ReplaceEntityStrategy)[keyof typeof ReplaceEntityStrategy];
