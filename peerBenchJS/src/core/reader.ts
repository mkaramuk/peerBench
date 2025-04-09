import { BigBenchTaskReader } from "@/readers/bigbench";
import { logger } from "./logger";
import { readFile } from "./utils";
import { parse as parsePath } from "path";
import { MMLUTaskReader } from "@/readers/mmlu";

/**
 * Add all the possible task file readers in this array
 */
const taskReaders = [new BigBenchTaskReader(), new MMLUTaskReader()];

/**
 * Loads and parses the given task file with the first possible reader from readers list.
 */
export async function readTask(path: string) {
  const content = readFile(path);

  for (const reader of taskReaders) {
    try {
      const task = await reader.parse(content);

      // If the task name doesn't exist, just use the file name as its name
      if (task.name === "") {
        task.name = parsePath(path).name;
      }

      return task;
    } catch (err) {
      logger.debug(
        `Reader ${reader.constructor.name} didn't work for the task file ${path}: ${err}`
      );
    }
  }

  throw new Error(`No valid task reader found for the given file: ${path}`);
}
