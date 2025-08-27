import { AbstractTaskSchema } from "@/task-schemas/abstract/abstract-task-schema";
import { MedQATaskSchema } from "./medqa";
import { MMLUProTaskSchema } from "./mmlu-pro";
import { OldPBTaskSchema } from "./oldpb";
import { PBTaskSchema } from "./pb";

/**
 * Reader class for automatically detect and read the tasks
 * with the appropriate schema.
 */
export class TaskReader {
  static schemas: Map<string, AbstractTaskSchema> = new Map();

  static {
    const medqa = new MedQATaskSchema();
    this.schemas.set(medqa.identifier, medqa);

    const mmluPro = new MMLUProTaskSchema();
    this.schemas.set(mmluPro.identifier, mmluPro);

    const oldpb = new OldPBTaskSchema();
    this.schemas.set(oldpb.identifier, oldpb);

    const pb = new PBTaskSchema();
    this.schemas.set(pb.identifier, pb);

    // TODO: Add more default schemas here
  }

  /**
   * Tries to read a task from a file path with one of the available schemas.
   * @param path - The path to the file containing the task.
   * @returns A Promise that resolves to the Task object.
   * @throws Error if no schema can read the file.
   * @example
   * ```typescript
   * const task = await readTaskFromFile("path/to/file.json");
   * ```
   */
  static async readFromFile(path: string) {
    if (typeof window === "undefined") {
      const { statSync } = await import("node:fs");

      if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
        throw new Error(`Task file does not exist: ${path}`);
      }

      for (const schema of this.schemas.values()) {
        try {
          return {
            task: await schema.readFromFile(path),
            schema,
          };
        } catch {
          continue;
        }
      }
      throw new Error(`No schema could read the file: ${path}`);
    } else {
      throw new Error(
        "File system operations are not supported in browser environment. Use `readFromContent` instead."
      );
    }
  }

  /**
   * Tries to read a task from a string or ArrayBuffer content with one of the available schemas.
   * @param content - The content to read, either as a string or ArrayBuffer.
   * @param filePath - Optional file path for metadata if desired.
   * @example
   * ```typescript
   * // With string content
   * const task = await readTaskFromContent('{"question": "What is...", ...}', "data.json");
   *
   * // With file upload in browser
   * const file = event.target.files[0];
   * const content = await file.arrayBuffer();
   * const task = await readTaskFromContent(content, file.name);
   * ```
   */
  static async readFromContent(
    content: string | Uint8Array,
    filePath?: string
  ) {
    for (const schema of this.schemas.values()) {
      try {
        return {
          task: await schema.readFromContent(content, filePath),
          schema,
        };
      } catch {
        continue;
      }
    }
    throw new Error("No task schema could read the content");
  }
}
