import { AbstractTaskReader } from "@/base/taskreader";
import { parseJSONL, tryParseJson } from "@/core/parser";
import { checkValidationError, readFile } from "@/core/utils";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { MaybePromise, Prompt, Task, EvalTypes } from "@/types";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";

export const MMLUProTaskSchema = z.object({
  question_id: z.coerce.number(),
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  answer_index: z.coerce.number(),
  cot_content: z.string(),
  category: z.string(),
  src: z.string(),
});

export type MMLUProTask = z.infer<typeof MMLUProTaskSchema>;

export class MMLUProTaskReader extends AbstractTaskReader {
  async parseFromFile(path: string): Promise<Task> {
    // Try to parse the file as Parquet
    let data = await this.tryParseParquet(path);

    // Not a Parquet file
    if (!data) {
      const content = readFile(path);

      // Try to parse it as JSON or JSONL
      data = this.tryParseJSON(content);

      // Not a JSON file
      if (!data) {
        data = this.tryParseJSONL(content);
      }
    }

    if (!data || data.length == 0) {
      throw new InvalidTaskError();
    }

    if (!this.recognize(data)) {
      throw new TaskNotRecognizedError();
    }

    const categories = new Set<string>();
    const prompts: Prompt[] = [];
    const validatedData = checkValidationError(
      z.array(MMLUProTaskSchema).safeParse(data)
    );

    // Parse prompts
    for (const prompt of validatedData) {
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
        data: prompt.question,
        answers,
        correctResponse: prompt.answer,
        evalTypes: [EvalTypes.MultipleChoice],
      });
      categories.add(prompt.category);
    }

    let did = "did:task:mmlu-pro";

    // Not the all categories are presented so update
    // the DID according to the found categories
    if (categories.size != 14) {
      did += `/${[...categories].join("/")}`;
    }

    return {
      did,
      prompts,
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    if (Array.isArray(content)) {
      const json: MMLUProTask[] = content;
      for (const task of json) {
        // If any of the items is not valid
        // we cannot recognize this object as a whole
        if (!this.recognize(task)) {
          return false;
        }
      }
      return true;
    }

    if (typeof content !== "object") {
      return false;
    }

    const validation = MMLUProTaskSchema.safeParse(content);
    if (validation.error) {
      return false;
    }

    return true;
  }

  tryParseJSON(content: string) {
    return tryParseJson<unknown[]>(content);
  }

  tryParseJSONL(content: string) {
    return parseJSONL<unknown[]>(content);
  }

  async tryParseParquet(path: string): Promise<unknown[] | undefined> {
    try {
      const file = await asyncBufferFromFile(path);
      return await parquetReadObjects({ file });
    } catch {
      // Not a valid Parquet file
    }
  }
}
