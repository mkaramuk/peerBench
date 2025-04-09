import { AbstractTaskReader } from "@/base/task";
import { tryParseJson } from "@/core/parser";
import {
  MaybePromise,
  Prompt,
  Task,
  EvaluationType,
  EvaluationTypes,
} from "@/types";

export type BigBenchTask = {
  canary: string;
  name: string;
  description: string;
  keywords: string[];
  metrics: string[];
  preferred_score?: string;
  output_regex?: string;
};

export class BigBenchTaskReader extends AbstractTaskReader {
  parse(content: string): MaybePromise<Task> {
    const json = tryParseJson(content);

    if (json === undefined) {
      throw new Error(`Invalid task`);
    }

    if (!this.recognize(json)) {
      throw new Error("Task is not recognized");
    }

    const prompts: Prompt[] = [];

    const name: string = json?.name || "";
    const inputSuffix: string | undefined = json?.example_input_suffix; // May not be available, check it again
    const inputPrefix: string | undefined = json?.example_input_prefix;
    const outputSuffix: string | undefined = json?.example_output_suffix; // May not be available, check it again
    const outputPrefix: string | undefined = json?.example_output_prefix;
    const outputRegex =
      json?.output_regex !== undefined
        ? new RegExp(json?.output_regex)
        : undefined;

    let evaluationType: EvaluationType;

    switch (json?.preferred_score) {
      case "multiple_choice_grade":
        evaluationType = EvaluationTypes.MultipleChoice;
        break;
      case "exact_str_match":
        evaluationType = EvaluationTypes.ExactEquality;
        break;

      default:
        // TODO: Throw error?
        evaluationType = EvaluationTypes.MultipleChoice;
        break;
    }

    // Parse examples (aka prompts, tests)
    for (const example of json?.examples || []) {
      prompts.push({
        id: example.id,
        input: example.input,
        answers: example.target_scores,
        expectedAnswer: example.target,
      });
    }

    return {
      name,
      inputPrefix,
      inputSuffix,
      outputSuffix,
      outputPrefix,
      outputRegex,
      evaluationType: evaluationType!,
      prompts,
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    if (typeof content !== "object") {
      return false;
    }

    if (
      typeof content.canary === "string" &&
      content.canary.startsWith("BENCHMARK DATA SHOULD NEVER")
    ) {
      return true;
    }

    return true;
  }
}
