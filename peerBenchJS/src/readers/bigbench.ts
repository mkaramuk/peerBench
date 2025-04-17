import { AbstractTaskReader } from "@/base/taskreader";
import { tryParseJson } from "@/core/parser";
import { checkValidationError, readFile } from "@/core/utils";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { MaybePromise, Prompt, Task, EvalType, EvalTypes } from "@/types";
import { z } from "zod";

export const BigBenchTaskSchema = z.object({
  canary: z.string(),
  name: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  metrics: z.array(z.string()),
  preferred_score: z.string(),
  output_regex: z.string().optional(),
  example_input_suffix: z.string().optional(),
  example_input_prefix: z.string().optional(),
  example_output_suffix: z.string().optional(),
  example_output_prefix: z.string().optional(),
  choice_prefix: z.string().optional(),
  examples: z.array(
    z.object({
      id: z.coerce.number().optional(),
      input: z.string(),
      target: z.string().optional(),
      target_scores: z.record(z.string(), z.coerce.number()),
    })
  ),
});

export type BigBenchTask = z.infer<typeof BigBenchTaskSchema>;

export class BigBenchTaskReader extends AbstractTaskReader {
  parseFromFile(path: string): MaybePromise<Task> {
    const json = tryParseJson(readFile(path));

    if (json === undefined) {
      throw new InvalidTaskError();
    }

    const task = checkValidationError(BigBenchTaskSchema.safeParse(json));

    if (!this.recognize(task)) {
      throw new TaskNotRecognizedError();
    }

    const prompts: Prompt[] = [];
    const evalTypes: EvalType[] = [];

    for (const metric of task.metrics) {
      switch (metric) {
        case "multiple_choice_grade":
          evalTypes.push(EvalTypes.MultipleChoice);
          break;
        case "exact_str_match":
          evalTypes.push(EvalTypes.ExactEquality);
          break;

        default:
          // TODO: Check other metric types
          break;
      }
    }

    // Parse examples (aka prompts, tests)
    for (const example of task.examples || []) {
      let data = example.input;

      if (task.example_input_prefix) {
        data = `${task.example_input_prefix}${data}`;
      }
      if (task.example_input_suffix) {
        data = `${data}${task.example_input_suffix}`;
      }

      prompts.push({
        id: example.id,
        data: example.input,
        answers: example.target_scores,
        correctResponse: example.target,
        evalTypes,
      });
    }

    return {
      did: `did:task:bigbench/${task.name}`,
      prompts,
    };
  }

  recognize(content: BigBenchTask): MaybePromise<boolean> {
    if (typeof content !== "object") {
      return false;
    }

    if (content.canary.startsWith("BENCHMARK DATA SHOULD NEVER")) {
      return true;
    }

    return false;
  }
}
