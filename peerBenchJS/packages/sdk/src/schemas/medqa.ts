import { AbstractTaskSchema } from "@/base/task-schema";
import { MaybePromise, Prompt, Task } from "@/types";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";
import { basename } from "path";
import { v7 as uuidv7 } from "uuid";
import { readFile, bufferToString } from "@/utils/file";
import { calculateCID } from "@/utils/cid";
import { parseJSONL, tryParseJson } from "@/utils/json";
import { calculateSHA256 } from "@/utils/sha256";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { checkValidationError, parseValidationError } from "@/utils/validation";
import { preparePrompt } from "@/utils/prompt";

export const MedQATaskZodSchema = z.object({
  question: z.string(),
  options: z.record(z.string(), z.string()),
  answer: z.string(),
  answer_idx: z.string(),
  meta_info: z.string().optional(),
});

export type MedQATask = z.infer<typeof MedQATaskZodSchema>;

export class MedQATaskSchema extends AbstractTaskSchema {
  name = "medqa";

  async readFromFile(path: string): Promise<Task> {
    const content = await readFile(path);
    return this.readFromContent(content, path);
  }

  async readFromContent(
    content: string | ArrayBuffer,
    filePath?: string
  ): Promise<Task> {
    const sourceFileName = basename(filePath || "memory");
    let sourceFileCID = "";
    let sourceFileSHA256 = "";
    let data: unknown[] | undefined;

    // Try to parse as Parquet first if it's an ArrayBuffer
    if (content instanceof ArrayBuffer) {
      try {
        data = await parquetReadObjects({ file: content });
      } catch {
        // Not a valid Parquet file, continue with other formats
      }
    }

    // If not Parquet or parsing failed, try other formats
    if (!data) {
      // Convert ArrayBuffer to string if needed
      const contentString =
        typeof content === "string" ? content : bufferToString(content);

      // Calculate CID and hash for the source content
      sourceFileCID = (await calculateCID(contentString)).toString();
      sourceFileSHA256 = await calculateSHA256(contentString);

      // Try to parse it as JSON or JSONL
      data = tryParseJson(contentString);
      if (!data) {
        data = parseJSONL(contentString);
      }
    } else {
      // Calculate hash and CID for parquet file which is a binary file
      sourceFileCID = (await calculateCID(content)).toString();
      sourceFileSHA256 = await calculateSHA256(content);
    }

    if (!data || data.length == 0) {
      throw new InvalidTaskError();
    }

    if (!this.recognize(data)) {
      throw new TaskNotRecognizedError();
    }

    const prompts: Prompt[] = [];
    const validatedData = checkValidationError(
      z.array(MedQATaskZodSchema).safeParse(data)
    );

    let rowNumber = 0;
    // Parse prompts
    for (const rawPrompt of validatedData) {
      const fullPrompt = preparePrompt(rawPrompt.question, rawPrompt.options);

      prompts.push({
        did: uuidv7(),
        options: rawPrompt.options,
        question: {
          data: rawPrompt.question,
          cid: (await calculateCID(rawPrompt.question)).toString(),
          sha256: await calculateSHA256(rawPrompt.question),
        },
        answer: rawPrompt.answer,
        answerKey: rawPrompt.answer_idx,
        type: "multiple-choice",
        fullPrompt: {
          data: fullPrompt,
          cid: (await calculateCID(fullPrompt)).toString(),
          sha256: await calculateSHA256(fullPrompt),
        },
        metadata: {
          medqaCategory: rawPrompt.meta_info,
          rowNumberInSource: rowNumber,
          originalSourceFile: {
            name: sourceFileName,
            cid: sourceFileCID,
            sha256: sourceFileSHA256,
          },
        },
      });
      rowNumber++;
    }

    return {
      did: "did:task:multiple-choice",
      prompts,
      path: filePath || "memory",
      cid: sourceFileCID,
      sha256: sourceFileSHA256,
      fileName: sourceFileName,
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    const validationError = parseValidationError(
      z.array(MedQATaskZodSchema).safeParse(content)
    );
    if (validationError) {
      return false;
    }

    return true;
  }

  async readParquet(path: string): Promise<unknown[] | undefined> {
    try {
      const file = await asyncBufferFromFile(path);
      return await parquetReadObjects({ file });
    } catch {
      // Not a valid Parquet file
    }
  }

  asRawObject(task: Task, targetFormat: string) {
    switch (targetFormat) {
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }
}
