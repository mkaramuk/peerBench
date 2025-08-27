import { AbstractTaskSchema } from "@/task-schemas/abstract/abstract-task-schema";
import { MaybePromise, Prompt, Task } from "@/types";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";
import { basename } from "path";
import { v7 as uuidv7 } from "uuid";
import { readFile } from "@/utils/file";
import { bufferToString } from "@/utils/string";
import { calculateCID } from "@/utils/cid";
import { parseJSONL, tryParseJson } from "@/utils/json";
import { calculateSHA256 } from "@/utils/sha256";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { checkValidationError, parseValidationError } from "@/utils/validation";
import { preparePrompt } from "@/utils/prompt";

export const MMLUProTaskZodSchema = z.object({
  question_id: z.coerce.number(),
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  answer_index: z.coerce.number(),
  cot_content: z.string(),
  category: z.string(),
  src: z.string(),
});

export type MMLUProTask = z.infer<typeof MMLUProTaskZodSchema>;

export class MMLUProTaskSchema extends AbstractTaskSchema {
  readonly identifier = "mmlu-pro";

  async readFromFile(path: string): Promise<Task> {
    const content = await readFile(path);
    return this.readFromContent(content, path);
  }

  async readFromContent(
    content: string | Uint8Array,
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
      z.array(MMLUProTaskZodSchema).safeParse(data)
    );

    let rowNumber = 0;
    // Parse prompts
    for (const rawPrompt of validatedData) {
      // Convert options array to record
      const options: Record<string, string> = {};
      let answerKey = "";

      for (let i = 0; i < rawPrompt.options.length; i++) {
        const option = rawPrompt.options[i];
        const letter = String.fromCharCode(65 + i);
        options[letter] = option;

        // Get the answer letter
        if (i === rawPrompt.answer_index) {
          answerKey = letter;
        }
      }

      const fullPrompt = preparePrompt(rawPrompt.question, options);

      prompts.push({
        did: uuidv7(),
        options,
        question: {
          data: rawPrompt.question,
          cid: (await calculateCID(rawPrompt.question)).toString(),
          sha256: await calculateSHA256(rawPrompt.question),
        },
        answer: rawPrompt.options[rawPrompt.answer_index],
        answerKey,
        fullPrompt: {
          data: fullPrompt,
          cid: (await calculateCID(fullPrompt)).toString(),
          sha256: await calculateSHA256(fullPrompt),
        },
        type: "multiple-choice",
        metadata: {
          mmluProCategory: rawPrompt.category,
          rowNumberInSource: rowNumber,
          originalSourceFile: {
            name: sourceFileName,
            cid: sourceFileCID,
            sha256: sourceFileSHA256,
          },
          mmluProQuestionId: rawPrompt.question_id,
          mmluProCotContent: rawPrompt.cot_content,
          mmluProSource: rawPrompt.src,
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
      z.array(MMLUProTaskZodSchema).safeParse(content)
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
      case "mmlu-pro":
        return task.prompts.map((prompt) => {
          // Convert options from object to array
          const options = Object.entries(prompt.options)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => value);
          const answer_index = options.findIndex(
            (option) => option === prompt.answer
          );

          return {
            question_id: prompt.metadata?.mmluProQuestionId,
            question: prompt.question.data,
            options,
            answer: prompt.answerKey, // Answer letter
            answer_index, // Index of the correct answer in the options array
            cot_content: prompt.metadata?.mmluProCotContent || "",
            category: prompt.metadata?.mmluProCategory,
            src: prompt.metadata?.mmluProSource,
          };
        });
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }
}
