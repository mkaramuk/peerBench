import { MedQATaskSchema } from "./medqa";
import { MMLUProTaskSchema } from "./mmlu-pro";
import { OldPBTaskSchema } from "./oldpb";
import { PBTaskSchema } from "./pb";

/**
 * The names of the schemas that are available.
 */

export const SchemaName = {
  oldpb: "oldpb",
  medqa: "medqa",
  mmluPro: "mmlu-pro",
  pb: "pb",
} as const;
export type SchemaNameType = (typeof SchemaName)[keyof typeof SchemaName];

/**
 * The schema reader instances that are available.
 */
export const Schemas = {
  oldpb: new OldPBTaskSchema(),
  medqa: new MedQATaskSchema(),
  "mmlu-pro": new MMLUProTaskSchema(),
  pb: new PBTaskSchema(),
} as const;

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
export async function readTaskFromFile(path: string) {
  if (typeof window === "undefined") {
    const { statSync } = await import("node:fs");

    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Task file does not exist: ${path}`);
    }

    for (const schemaName in Schemas) {
      const schema = Schemas[schemaName as SchemaNameType];
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
      "File system operations are not supported in browser environment. Use readFromContent instead."
    );
  }
}

/**
 * Tries to read a task from a string or ArrayBuffer content with one of the available schemas.
 * @param content - The content to read, either as a string or ArrayBuffer.
 * @param filePath - Optional file path for metadata.
 * @returns A Promise that resolves to the Task object.
 * @throws Error if no schema can read the content.
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
export async function readTaskFromContent(
  content: string | ArrayBuffer,
  filePath?: string
) {
  for (const schemaName in Schemas) {
    const schema = Schemas[schemaName as SchemaNameType];
    try {
      return {
        task: await schema.readFromContent(content, filePath),
        schema,
      };
    } catch {
      continue;
    }
  }
  throw new Error("No schema could read the content");
}

export { MedQATaskZodSchema } from "./medqa";
export { MMLUProTaskZodSchema } from "./mmlu-pro";
export { OldPBTaskZodSchema } from "./oldpb";
