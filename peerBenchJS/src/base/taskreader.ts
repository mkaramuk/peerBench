import { MaybePromise, Task } from "@/types";

/**
 * Base class to parse a task definition from string
 * to an actual object
 */
export abstract class AbstractTaskReader {
  /**
   * Read and parses the given file as a Task object
   */
  abstract parseFromFile(content: string): MaybePromise<Task>;

  /**
   * Returns `true` if the given content recognized by this class
   */
  abstract recognize(content: any): MaybePromise<boolean>;
}
