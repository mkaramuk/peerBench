import { AbstractTaskSchema } from "@/task-schemas/abstract/abstract-task-schema";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { Prompt, PromptOptions, Task } from "@/types";
import {
  AsyncBuffer,
  asyncBufferFromFile,
  parquetReadObjects,
} from "hyparquet";
import { z } from "zod";
import { basename } from "path";
import { v7 as uuidv7 } from "uuid";
import { readFile } from "@/utils/file";
import { bufferToString } from "@/utils/string";
import { calculateCID } from "@/utils/cid";
import { calculateSHA256 } from "@/utils/sha256";
import { tryParseJson, parseJSONL } from "@/utils/json";
import { checkValidationError } from "@/utils/validation";
import { preparePrompt } from "@/utils/prompt";

export const OldPBTaskZodSchema = z.object({
  question: z.string(),
  options: z.record(z.string(), z.string()),
  answer_idx: z.string(),
  answer: z.string(),
  meta_info: z.string().optional(),
  other: z
    .object({
      hash_full_question: z.string(),
      hash_first_sentence: z.string(),
      hash_first_question_sentence: z.string(),
      hash_last_sentence: z.string(),
      stdQuestionUUID: z.string(),
      stdFullPromptText: z.string(),
      stdFullPromptHash: z.string(),
      src_row_number: z.number(),
      preSTDsrcFileName: z.string(),
      preSTDsrcCID: z.string(),
    })
    .catchall(z.any()),
});

export type OldPBTask = z.infer<typeof OldPBTaskZodSchema>;

export class OldPBTaskSchema extends AbstractTaskSchema {
  readonly identifier = "oldpb";

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
    if (content instanceof Uint8Array) {
      try {
        data = await parquetReadObjects({
          file: content as unknown as AsyncBuffer,
        });
      } catch {
        // Not a valid Parquet file, continue with other formats
      }
    }

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

    if (!data || data.length === 0) {
      throw new InvalidTaskError();
    }

    if (!this.recognize(data)) {
      throw new TaskNotRecognizedError();
    }

    const prompts: Prompt[] = [];
    const validatedData = checkValidationError(
      z.array(OldPBTaskZodSchema).safeParse(data)
    );

    let rowNumber = 0;
    // Parse prompts
    for (const rawPrompt of validatedData) {
      if (this.hasStandardFields(rawPrompt)) {
        prompts.push({
          did: rawPrompt.other.stdQuestionUUID,
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
            data: rawPrompt.other.stdFullPromptText,
            cid: (
              await calculateCID(rawPrompt.other.stdFullPromptText)
            ).toString(),
            sha256: await calculateSHA256(rawPrompt.other.stdFullPromptText),
          },
          metadata: rawPrompt.other,
        });
      } else {
        const fullPrompt = preparePrompt(rawPrompt.question, rawPrompt.options);
        const hashes = this.calculateQuestionHashes(
          rawPrompt.question,
          rawPrompt.options
        );

        const uuid = uuidv7();
        prompts.push({
          did: uuid,
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
            hash_full_question: hashes.fullTextHash,
            hash_first_sentence: hashes.firstSentenceHash,
            hash_first_question_sentence: hashes.firstQuestionHash,
            hash_last_sentence: hashes.lastSentenceHash,
            src_row_number: rowNumber,
            preSTDsrcFileName: sourceFileName,
            preSTDsrcCID: sourceFileCID,
            stdQuestionUUID: uuid,
            stdFullPromptText: fullPrompt,
            stdFullPromptHash: hashes.fullPromptHash,
          },
        });
      }

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

  getFirstQuestionSentence(sentences: string[]): string {
    const questionSentence = sentences.find((sentence) =>
      sentence.trim().endsWith("?")
    );
    return questionSentence || sentences[0]; // Fallback to first sentence if no '?' found
  }

  splitIntoSentences(text: string): string[] {
    // This regex handles common sentence endings (., !, ?) and accounts for common abbreviations and edge cases
    const sentenceRegex = /[^.!?]+[.!?]+\s*/g;
    const matches = text.match(sentenceRegex);

    if (!matches) {
      return [text]; // Return the whole text as one sentence if no sentence boundaries found
    }

    // Join and check if we lost any text at the end (without punctuation)
    const joinedMatches = matches.join("");
    if (joinedMatches.length < text.length) {
      const remainder = text.substring(joinedMatches.length);
      if (remainder.trim()) {
        return [...matches, remainder];
      }
    }

    return matches;
  }

  calculateQuestionHashes(question: string, options: PromptOptions) {
    const sentences = this.splitIntoSentences(question);
    const firstSentence = sentences[0] || question;
    const firstQuestionSentence = this.getFirstQuestionSentence(sentences);
    const lastSentence =
      sentences.length > 1 ? sentences[sentences.length - 1] : firstSentence;

    return {
      fullTextHash: calculateSHA256(question),
      firstSentenceHash: calculateSHA256(firstSentence),
      firstQuestionHash: calculateSHA256(firstQuestionSentence),
      lastSentenceHash: calculateSHA256(lastSentence),
      fullPromptHash: calculateSHA256(preparePrompt(question, options)),
    };
  }

  hasStandardFields(task: OldPBTask): boolean {
    return (
      task.other !== undefined &&
      typeof task.other.hash_full_question === "string" &&
      typeof task.other.hash_first_sentence === "string" &&
      typeof task.other.hash_first_question_sentence === "string" &&
      typeof task.other.hash_last_sentence === "string" &&
      typeof task.other.stdQuestionUUID === "string" &&
      typeof task.other.stdFullPromptText === "string" &&
      typeof task.other.stdFullPromptHash === "string" &&
      typeof task.other.src_row_number === "number" &&
      typeof task.other.preSTDsrcFileName === "string" &&
      typeof task.other.preSTDsrcCID === "string"
    );
  }

  recognize(content: any): boolean {
    const validationError = z.array(OldPBTaskZodSchema).safeParse(content);
    if (!validationError.success) {
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
      return undefined;
    }
  }

  asRawObject(task: Task, targetFormat: string) {
    switch (targetFormat) {
      case "pb":
        return task.prompts;
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }
}
