import { AbstractTaskFormat } from "@/base/task-format";
import { parseJSONL, tryParseJson } from "@/core/parser";
import { checkValidationError, readFile, generateCID } from "@/core/utils";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { MaybePromise, Prompt, PromptSchema, Task } from "@/types";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { z } from "zod";
import { basename } from "path";
import { generatePromptMetaFields } from "@/core/std";
import { v7 as uuidv7 } from "uuid";

// Simply we are using MedQA as the unified schema so no need to create another one.
export const MedQATaskSchema = PromptSchema.extend({
  other: PromptSchema.shape.other.optional(),
});
export type MedQATask = z.infer<typeof MedQATaskSchema>;

export class MedQATaskFormat extends AbstractTaskFormat {
  name = "medqa";

  async parseFromFile(path: string): Promise<Task> {
    const sourceFileName = basename(path);
    let sourceFileCID: string = "";

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
      z.array(MedQATaskSchema).safeParse(data)
    );

    let rowNumber = 0;
    // Parse prompts
    for (const prompt of validatedData) {
      let standardizedPrompt: Prompt;

      // If all of the fields are presented, that means this prompt
      // uses our standardized schema so we can use it directly
      if (this.hasStandardFields(prompt)) {
        standardizedPrompt = prompt as Prompt;
      } else {
        // Otherwise standardize it (simply add metadata in `other` field)
        standardizedPrompt = {
          question: prompt.question,
          options: prompt.options,
          answer: prompt.answer,
          answer_idx: prompt.answer_idx,
          meta_info: prompt.meta_info || "",
          other: generatePromptMetaFields({
            options: prompt.options,
            question: prompt.question,
            rowNumber,
            sourceFileCID,
            sourceFileName,
            uuid: uuidv7(),
          }),
        };
      }

      prompts.push(standardizedPrompt);

      // Add category to categories set if it exists
      if (prompt.other?.medqa_category) {
        categories.add("medqa");
      } else if (prompt.other?.source_event) {
        const sourceEvent = prompt.other.source_event;
        if (sourceEvent.event) {
          // Extract a simple category if possible from event text
          const eventText = sourceEvent.event.toLowerCase();
          if (eventText.includes("war")) categories.add("war");
          else if (eventText.includes("battle")) categories.add("battle");
          else categories.add("history");
        } else {
          categories.add("history");
        }
      } else if (prompt.meta_info) {
        categories.add(prompt.meta_info);
      }

      rowNumber++;
    }

    let did = "did:task:medqa";

    // If category is presented, update DID of the task
    if (categories.size > 0) {
      const categoryNames = [...categories].map((category) =>
        category.replaceAll(" ", "-").toLowerCase()
      );
      did += `/${categoryNames.join("-")}`;
    }

    return {
      did,
      prompts,
      path,
      cid: sourceFileCID,
      fileName: basename(path),
    };
  }

  recognize(content: any): MaybePromise<boolean> {
    // First check if this is a medQA file by checking the path
    if (Array.isArray(content)) {
      const json: any[] = content;

      // Check for empty array
      if (json.length === 0) {
        return false;
      }

      // Get the first item
      const firstItem = json[0];

      // Check if it has the required keys for medQA format
      if (
        typeof firstItem === "object" &&
        firstItem.question &&
        firstItem.options &&
        typeof firstItem.options === "object" &&
        !Array.isArray(firstItem.options) &&
        firstItem.answer_idx &&
        // Check if options has keys like "A", "B", etc.
        Object.keys(firstItem.options).some((key) => /^[A-Z]$/.test(key))
      ) {
        return true;
      }

      return false;
    }

    if (typeof content !== "object") {
      return false;
    }

    const validation = MedQATaskSchema.safeParse(content);
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

  hasStandardFields(task: MedQATask): boolean {
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

  async convertTo(task: Task, targetFormat: string): Promise<any> {
    switch (targetFormat) {
      case "medqa":
        // Since we are using MedQA as the unified schema, we can just return the prompts
        return [...task.prompts];

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

      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  }
}
