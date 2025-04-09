import { AbstractTaskReader } from "@/base/task";
import { parseJSONL, tryParseJson } from "@/core/parser";
import { checkValidationError } from "@/core/utils";
import { MaybePromise, Prompt, Task, EvaluationTypes } from "@/types";
import { z } from "zod";

export const MMLUTaskSchema = z.object({
  question_id: z.number(),
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  answer_index: z.number(),
  cot_content: z.string(),
  category: z.string(),
  src: z.string(),
});

export type MMLUTask = z.infer<typeof MMLUTaskSchema>;

export class MMLUTaskReader extends AbstractTaskReader {
  parse(content: string): MaybePromise<Task> {
    // TODO: Make it possible to load from parquet format
    const prompts: Prompt[] = [];
    let json = tryParseJson<unknown[]>(content);

    if (json === undefined) {
      // Might be in JSONL format
      json = parseJSONL(content);

      // There is no task found
      if (json.length == 0) {
        throw new Error(`Invalid task`);
      }
    }

    if (!this.recognize(json)) {
      throw new Error("Task is not recognized");
    }

    const data = checkValidationError(z.array(MMLUTaskSchema).safeParse(json));
    const name: string = ""; // data[0].src; // TODO: This field points to the sub-category of this task, so should we use it?

    // Parse prompts
    for (const prompt of data || []) {
      const answers: Record<string, number> = {};

      for (let i = 0; i < prompt.options.length; i++) {
        const option = prompt.options[i];
        if (i == prompt.answer_index) {
          answers[option] = 1;
        } else {
          answers[option] = 0;
        }
      }

      prompts.push({
        id: prompt.question_id,
        input: prompt.question,
        answers,
        expectedAnswer: prompt.answer,
      });
    }

    return {
      name,
      evaluationType: EvaluationTypes.MultipleChoice,
      prompts,
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    if (Array.isArray(content)) {
      const json: MMLUTask[] = content;
      for (const task of json) {
        // If any of the items doesn't meet with the schema
        // we cannot recognize this object
        if (!this.recognize(task)) {
          return false;
        }
      }
      return true;
    }

    if (typeof content !== "object") {
      return false;
    }

    const validation = MMLUTaskSchema.safeParse(content);
    if (validation.error) {
      return false;
    }

    return true;
  }
}
