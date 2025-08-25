import { MaybePromise } from "@peerbench/sdk";
import { PubMedRSSArticle } from "../types";
import { AbstractStep } from "./abstract-step";

// Type utility to extract result types from step tuples (handles readonly arrays)
type StepResults<T extends readonly AbstractStep<any, any, any>[]> = {
  readonly [K in keyof T]: T[K] extends AbstractStep<any, infer R, any>
    ? R | undefined
    : never;
};

// Type utility to infer step types from init method
type InferSteps<T> = T extends { init(): MaybePromise<infer S> } ? S : never;

export abstract class AbstractTaskGenerator {
  name: string;
  entry!: PubMedRSSArticle;
  results: StepResults<InferSteps<this>> = [] as StepResults<InferSteps<this>>;
  steps: InferSteps<this> = [] as InferSteps<this>;
  protected _lastResult?: unknown;

  protected constructor(name: string) {
    this.name = name;
  }

  abstract init(): MaybePromise<readonly AbstractStep<any, any, any>[]>;

  async run(entry: PubMedRSSArticle) {
    this.entry = entry;
    this.steps = (await this.init()) as InferSteps<this>;
    this.results = this.steps.map(() => undefined) as StepResults<
      InferSteps<this>
    >;

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      this._lastResult = await step.execute();
      (this.results as any)[i] = this._lastResult;
    }
    return this.results;
  }

  tags() {
    return this.steps
      .map((step) => step?.tags)
      .filter(Boolean)
      .flat();
  }

  get lastResult() {
    return this._lastResult;
  }
}
