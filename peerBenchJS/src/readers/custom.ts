import { AbstractTaskReader } from "@/base/taskreader";
import { parseJSONL, tryParseJson } from "@/core/parser";
import { checkValidationError, readFile } from "@/core/utils";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { MaybePromise, Prompt, Task, MetricTypes } from "@/types";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";

export const CustomTaskSchema = z.object({
  promptData: z.string(),
  correctResponse: z.string(),
});

export type CustomTask = z.infer<typeof CustomTaskSchema>;

export class CustomTaskReader extends AbstractTaskReader {
  async parseFromFile(path: string): Promise<Task> {
    const prompts: Prompt[] = [];
    const content = readFile(path);
    const data = this.tryParseJSON(content);

    if (!data || data.length == 0) {
      throw new InvalidTaskError();
    }

    if (!this.recognize(data)) {
      throw new TaskNotRecognizedError();
    }

    const validatedData = checkValidationError(
      z.array(CustomTaskSchema).safeParse(data)
    );

    // Parse prompts
    for (const prompt of validatedData) {
      const answers: Record<string, number> = {};

      prompts.push({
        input: prompt.promptData,
        answers,
        expectedAnswer: prompt.correctResponse,
      });
    }

    return {
      name: "", // Use the filename (without extension)
      metricTypes: [MetricTypes.MultipleChoice],
      prompts,
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    const validation = z.array(CustomTaskSchema).safeParse(content);
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
