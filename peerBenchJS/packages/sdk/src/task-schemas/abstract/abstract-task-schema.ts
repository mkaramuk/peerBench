import { MaybePromise, Task } from "@/types";

/**
 * Abstract Task schema
 *
 * A Task schema is responsible for reading and parsing the Task information
 * and converting it to a usable Task object. Task objects are used to execute
 * the tasks and collect the responses.
 */
export abstract class AbstractTaskSchema {
  /**
   * Identifier of the schema
   */
  abstract readonly identifier: string;

  /**
   * Read and parses the given file to a Task object
   */
  abstract readFromFile(path: string): MaybePromise<Task>;

  /**
   * Read and parses the given buffer or string to a Task object
   * @param content - The content to parse, either as a string or byte array
   * @param filePath - Optional file path for additional metadata if the implementation desires
   */
  abstract readFromContent(
    content: string | Uint8Array,
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
