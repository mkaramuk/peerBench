import { AbstractTaskSchema } from "@/base/task-schema";
import { InvalidTaskError, TaskNotRecognizedError } from "@/errors/task";
import { Task } from "@/types";
import { z } from "zod";
import { basename } from "path";
import { readFile } from "@/utils/file";
import { bufferToString } from "@/utils/file";
import { calculateCID } from "@/utils/cid";
import { calculateSHA256 } from "@/utils/sha256";
import { tryParseJson, parseJSONL } from "@/utils/json";
import { checkValidationError } from "@/utils/validation";
import { PromptSchema } from "@/types";

export class PBTaskSchema extends AbstractTaskSchema {
  name = "pb";

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

    if (!data || data.length === 0) {
      throw new InvalidTaskError();
    }

    if (!this.recognize(data)) {
      throw new TaskNotRecognizedError();
    }

    const validatedData = checkValidationError(
      z.array(PromptSchema).safeParse(data)
    );

    if (validatedData.length === 0) {
      throw new InvalidTaskError();
    }

    return {
      did: "did:task:multiple-choice",
      prompts: validatedData,
      path: filePath || "memory",
      cid: sourceFileCID,
      sha256: sourceFileSHA256,
      fileName: sourceFileName,
    };
  }

  recognize(content: any): boolean {
    const validationError = z.array(PromptSchema).safeParse(content);
    if (!validationError.success) {
      return false;
    }
    return true;
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
