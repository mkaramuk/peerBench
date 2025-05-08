import { AbstractTaskFormat } from "@/base/task-format";
import { parseJSONL, tryParseJson } from "@/core/parser";
import { checkValidationError, readFile, generateCID } from "@/core/utils";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { MaybePromise, Prompt, Task } from "@/types";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";
import { basename } from "path";
import { generatePromptMetaFields } from "@/core/std";
import { v7 as uuidv7 } from "uuid";

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

export class MMLUProTaskFormat extends AbstractTaskFormat {
  name = "mmlu-pro";

  async parseFromFile(path: string): Promise<Task> {
    const sourceFileName = basename(path);
    let sourceFileCID: string = "";

    // TODO: calculate CID for parquet file
    // Try to parse the file as Parquet
    let data = await this.tryParseParquet(path);

    // Not a Parquet file
    if (!data) {
      const content = readFile(path);

      // Calculate CID for the source file
      sourceFileCID = (await generateCID(content)).toString();

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
      const options: Record<string, string> = {};
      let answer_idx = "";

      for (let i = 0; i < prompt.options.length; i++) {
        const option = prompt.options[i];
        const letter = String.fromCharCode(65 + i);
        options[letter] = option;

        // Get the answer letter
        if (i === prompt.answer_index) {
          answer_idx = letter;
        }
      }

      const standardPrompt: Prompt = {
        question: prompt.question,
        answer: prompt.options[prompt.answer_index],
        answer_idx,
        options,
        meta_info: prompt.category,
        other: {
          ...generatePromptMetaFields({
            options,
            question: prompt.question,
            rowNumber: prompt.question_id,
            sourceFileCID,
            sourceFileName,
            uuid: uuidv7(),
          }),

          "mmlu-pro__question_id": prompt.question_id,
          "mmlu-pro__answer_index": prompt.answer_index,
          "mmlu-pro__cot_content": prompt.cot_content,
          "mmlu-pro__category": prompt.category,
          "mmlu-pro__src": prompt.src,
        },
      };

      for (const [name, value] of Object.entries(prompt)) {
        // If original object has fields other than those, include them in the standardized object as well
        if (
          ![
            "question",
            "options",
            "answer",
            "answer_index",
            "question_id",
            "cot_content",
            "category",
            "src",
          ].includes(name)
        ) {
          standardPrompt.other![`mmlu-pro__${name}`] = value;
        }
      }

      categories.add(prompt.category);
      prompts.push(standardPrompt);
    }

    let did = "did:task:mmlu-pro";

    // Not all of the categories are presented so update
    // the DID according to the found categories
    if (categories.size != 14) {
      const categoryNames = [...categories].map((category) =>
        category.replaceAll(" ", "-").toLowerCase()
      );
      did += `/${categoryNames.join("-")}`;
    }

    return {
      did,
      prompts,
      cid: sourceFileCID,
      fileName: sourceFileName,
      path,
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

  async convertTo(task: Task, targetFormat: string): Promise<any> {
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
            question_id:
              prompt.other?.src_row_number ||
              prompt.other?.question_id ||
              prompt.other?.["mmlu-pro__question_id"],
            question: prompt.question,
            options,
            answer: prompt.answer_idx, // Answer letter
            answer_index, // Index of the correct answer in the options array
            cot_content: "",
            category:
              prompt.meta_info ||
              prompt.other?.category ||
              prompt.other?.["mmlu-pro__category"],
            src: prompt.other?.["src"] || prompt.other?.["mmlu-pro__src"],
          };
        });
      case "medqa":
        // Since we are using MedQA as the unified schema, we can just return the prompts
        return [...task.prompts];

      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }
}
