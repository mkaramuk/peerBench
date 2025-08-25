import { MaybePromise } from "@peerbench/sdk";
import { AbstractTaskGenerator } from "./abstract-generator";

export abstract class AbstractStep<
  T = any,
  K = any,
  L extends AbstractTaskGenerator = AbstractTaskGenerator,
> {
  name: string;
  tags: string[] = [];
  generator!: L;
  args!: T;
  result?: K;
  onFinishHandlers: ((result: K) => MaybePromise<void>)[] = [];

  constructor(name: string, generator: L, args: T) {
    this.name = name;
    this.args = args;
    this.generator = generator;
    this.tags.push(this.name);
  }

  protected abstract run(): MaybePromise<K>;

  onFinish(handler: (result: K) => MaybePromise<void>) {
    this.onFinishHandlers.push(handler);
    return this;
  }

  async execute() {
    this.result = undefined;
    this.result = await this.run();

    for (const handler of this.onFinishHandlers) {
      await handler(this.result);
    }

    return this.result;
  }
}
