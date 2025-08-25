import { BigBenchTaskFormat } from "@/formats/bigbench";
import { logger } from "./logger";
import { parse as parsePath } from "path";
import { MMLUProTaskFormat } from "@/formats/mmlu-pro";
import { MedQATaskFormat } from "@/formats/medQA";
import { parseTaskDID } from "./parser";
import { statSync } from "fs";

/**
 * Add all the possible task file formats
 */
export const taskFormats = [
  new BigBenchTaskFormat(),
  new MMLUProTaskFormat(),
  new MedQATaskFormat(),
];

export function getTaskFormat(name: string) {
  for (const tp of taskFormats) {
    if (tp.name === name) {
      return tp;
    }
  }
  throw new Error(`No task processor found called "${name}"`);
}

/**
 * Loads and parses the given task file with the first possible reader from readers list.
 */
export async function readTask(path: string) {
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`The task file doesn't exist: ${path}`);
  }

  for (const taskFormat of taskFormats) {
    try {
      const task = await taskFormat.parseFromFile(path);
      const taskName = parseTaskDID(task.did);

      // If the task name doesn't exist, just use the file name (without extension) as its name
      if (taskName === "") {
        task.did = `did:task:${parsePath(path).name}`;
      }

      return {
        formatName: taskFormat.name,
        task,
      };
    } catch (err) {
      logger.debug(
        `Task format "${taskFormat.name}" didn't work for the task file ${path}: ${err}`
      );
    }
  }

  throw new Error(`No valid task format found for the given file: ${path}`);
}
