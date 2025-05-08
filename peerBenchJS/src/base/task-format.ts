import { MaybePromise, Task } from "@/types";

/**
 * Abstract class that formats needs to implement
 */
export abstract class AbstractTaskFormat {
  /**
   * Name of the format
   */
  abstract name: string;

  /**
   * Read and parses the given file as a Task object
   */
  abstract parseFromFile(content: string): MaybePromise<Task>;

  /**
   * Returns `true` if the given content recognized by this class
   */
  abstract recognize(content: any): MaybePromise<boolean>;

  /**
   * Creates a raw object that can be parsed by the `targetFOrmat`.
   *
   * @param task The task to convert
   * @param targetFormat The format type to convert to
   * @returns The converted data in a format that the target format can parse
   */
  abstract convertTo(task: Task, targetFormat: string): MaybePromise<any>;
}
