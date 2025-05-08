import { AbstractTaskFormat } from "@/base/task-format";
import { parseValidationError, tryParseJson } from "@/core/parser";
import { checkValidationError, readFile, generateCID } from "@/core/utils";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { MaybePromise, Prompt, Task, EvalType, EvalTypes } from "@/types";
import { z } from "zod";
import { basename } from "path";
import { generatePromptMetaFields } from "@/core/std";
import { v7 as uuidv7 } from "uuid";

export const BigBenchTaskSchema = z.object({
  canary: z.string().startsWith("BENCHMARK DATA SHOULD NEVER"),
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

export class BigBenchTaskFormat extends AbstractTaskFormat {
  name = "bigbench";

  async parseFromFile(path: string): Promise<Task> {
    const content = readFile(path);
    const sourceFileName = basename(path);
    const sourceFileCID = (await generateCID(content)).toString();
    const json = tryParseJson(content);

    if (json === undefined) {
      throw new InvalidTaskError();
    }

    if (!this.recognize(json)) {
      throw new TaskNotRecognizedError();
    }

    const task = checkValidationError(BigBenchTaskSchema.safeParse(json));
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
    let exampleRowNumber = 0;
    for (const example of task.examples || []) {
      const options: Record<string, string> = {};
      let data = example.input;
      let answer_idx = "";

      if (task.example_input_prefix) {
        data = `${task.example_input_prefix}${data}`;
      }
      if (task.example_input_suffix) {
        data = `${data}${task.example_input_suffix}`;
      }

      let answerLetterIndex = 0;
      for (const [answer, score] of Object.entries(example.target_scores)) {
        const letter = String.fromCharCode(65 + answerLetterIndex);

        if (score === 1) {
          answer_idx = letter;
        }

        options[letter] = answer;

        answerLetterIndex++;
      }

      prompts.push({
        question: data,
        options,
        answer_idx,
        answer: options[answer_idx],
        meta_info: task.name,
        other: {
          ...generatePromptMetaFields({
            options,
            question: data,
            rowNumber: exampleRowNumber,
            sourceFileCID,
            sourceFileName,
            uuid: uuidv7(),
          }),
        },
      });
      exampleRowNumber++;
    }

    return {
      did: `did:task:bigbench/${task.name.replaceAll(" ", "-")}`,
      prompts,
      path,
      cid: sourceFileCID,
      fileName: basename(path),
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    const err = parseValidationError(BigBenchTaskSchema.safeParse(content));

    if (err) {
      return false;
    }

    return true;
  }

  async convertTo(task: Task, targetFormat: string): Promise<any> {
    switch (targetFormat) {
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }
}
