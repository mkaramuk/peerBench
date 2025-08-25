import { MaybePromise, Task } from "@/types";

/**
 * Abstract Task schema class that needs to be implemented by each schema
 */
export abstract class AbstractTaskSchema {
  /**
   * Name of the schema
   */
  abstract name: string;

  /**
   * Read and parses the given file to a Task object
   */
  abstract readFromFile(path: string): MaybePromise<Task>;

  /**
   * Read and parses the given buffer or string to a Task object
   * @param content - The content to parse, either as a string or ArrayBuffer
   * @param filePath - Optional file path for additional metadata if the implementation desires
   */
  abstract readFromContent(
    content: string | ArrayBuffer,
    filePath?: string
  ): MaybePromise<Task>;

  /**
   * Returns `true` if the given content is recognized by this schema
   */
  abstract recognize(content: any): MaybePromise<boolean>;

  /**
   * Converts the given Task object to a raw object that can be parsed by the `targetSchema`.
   */
  abstract asRawObject(task: Task, targetSchema: string): MaybePromise<any>;
}
