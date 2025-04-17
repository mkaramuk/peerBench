import { red, yellow } from "ansis";
import { prompt } from "./core/prompt";
import { logger } from "./core/logger";
import { config } from "./config";
import { join, ParsedPath, parse as parsePath } from "path";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "fs";
import * as csv from "csv";
import { score } from "./core/score";
import { PromptResponse, PromptScore } from "./types";
import {
  checkValidationError,
  hashFile,
  readFile,
  signFile,
} from "./core/utils";
import { aggregate } from "./core/aggregate";
import { Command } from "commander";
import { z } from "zod";
import { parseTaskDID, parseModelDID, parseProviderDID } from "./core/parser";
import { getProvider } from "./core/providers";

const ConfigSchema = z.object({
  tasks: z.array(z.string()),
  models: z.array(z.string()),
});

const program = new Command("peerbench")
  .allowUnknownOption(true)
  .configureHelp({
    showGlobalOptions: true,
  });

program
  .command("prompt")
  .description("Prompts the given tasks to the given models")
  .requiredOption(
    "-c, --config <file>",
    "Config file that includes models and task files to be used"
  )
  .option(
    "-t, --type <type>",
    'Output file type, "json" or "csv". Default is json'
  )
  .option(
    "-m, --max-prompts <number>",
    "The prompt count that will be used from the beginning of the given tasks. If not given, uses all of the prompts"
  )
  .action(
    async (rawOptions: {
      config: string;
      maxPrompts?: string;
      type?: string;
    }) => {
      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);
      const options = checkValidationError(
        z
          .object({
            config: z.string(),
            type: z.enum(["json", "csv"]).default("json"),
            maxPrompts: z.coerce.number().optional(),
          })
          .safeParse(rawOptions)
      );

      const startedAt = Date.now().toString();
      const commandConfig = checkValidationError(
        ConfigSchema.safeParse(JSON.parse(readFile(options.config)))
      );

      const allResponses: Record<string, PromptResponse[]> = {};
      const findResponseSavePath = async (res: PromptResponse) => {
        const provider = getProvider(parseProviderDID(res.providerDID))!;
        const model = await provider.parseModelIdentifier(
          parseModelDID(res.modelDID)
        );

        // TODO: include provider name into the path
        return join(
          parseTaskDID(res.taskDID).replace("/", "-"),
          config.VALIDATOR_ADDRESS,
          model.modelOwner,
          model.modelName
        );
      };

      const save = async (logInfo?: boolean) => {
        for (const [dirPath, responses] of Object.entries(allResponses)) {
          if (responses.length === 0) continue;

          mkdirSync(join(config.OUTPUT_DIR, dirPath), { recursive: true });
          const taskName = parseTaskDID(responses[0].taskDID).replace("/", "-");
          const path = await saveArray(
            // No need to store evaluation DID inside the schema since
            // it is available in the folder structure
            responses,
            options.type,
            {
              fileNamePrefix: `responses-${taskName}`,
              fileNameSuffix: startedAt,
              dirPath: dirPath,
            }
          );

          if (logInfo) {
            logger.info(`${options.type.toUpperCase()} saved to ${path}`);
          }
        }

        // If this is not the last log which is info, print a debug one
        if (!logInfo) {
          logger.debug("Saved");
        }
      };

      // If the process takes too much time, save the responses
      // in an interval in order to not to lose them
      const interval = setInterval(save, 60_000);
      try {
        await prompt(commandConfig.models, commandConfig.tasks, {
          maxPrompt: options.maxPrompts,
          onResponseReceived: async (response) => {
            const path = await findResponseSavePath(response);
            if (!allResponses[path]) {
              allResponses[path] = [];
            }

            allResponses[path].push(response);
          },
        });

        await save(true);
      } finally {
        clearInterval(interval);
      }
    }
  )
  .allowUnknownOption(true);

program
  .command("score")
  .description("Scores the given responses")
  .option(
    "-t, --type <type>",
    'Output file type, "json" or "csv". Default is json'
  )
  .option(
    "-n, --task <name>",
    "Task identifier name that is going to be used to find the correct files or place outputs."
  )
  .argument(
    "[response files...]",
    "Response files. If not given any, uses the responses from the given task name"
  )
  .action(
    async (files: string[], rawOptions: { type?: string; task?: string }) => {
      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);
      const options = checkValidationError(
        z
          .object({
            type: z.enum(["json", "csv"]).default("json"),
            task: z.string().default("default"),
          })
          .safeParse(rawOptions)
      );

      if (rawOptions.task === undefined) {
        logger.warning(
          `Task name is not given, using the default one which is "default"`
        );
      }

      const startedAt = Date.now().toString();

      if (files.length === 0) {
        files = goIntoDir(config.OUTPUT_DIR, {
          depth: 4,
          map: (files) => {
            const lastFile = getLatestFile(files);
            if (lastFile) {
              return [lastFile];
            }
            return [];
          },
          filter: (pathInfo) => {
            const regex = new RegExp(`responses-${options.task}-(\\d+)`, "i");
            const nameMatch = pathInfo.name.match(regex);

            return [".json", ".csv"].includes(pathInfo.ext) && nameMatch
              ? true
              : false;
          },
        });
      }

      if (files.length === 0) {
        throw new Error(
          `No response files found for task "${options.task}". Please try to run "prompt" command`
        );
      }

      const allScores = await score(files);
      const scorePaths: Record<string, PromptScore[]> = {};

      for (const score of allScores) {
        const taskName = parseTaskDID(score.taskDID).replace("/", "-");
        const provider = getProvider(parseProviderDID(score.providerDID))!;
        const model = await provider.parseModelIdentifier(
          parseModelDID(score.modelDID)
        );

        // TODO: include sub provider name into the path
        const dirPath = join(
          taskName,
          config.VALIDATOR_ADDRESS,
          model.modelOwner,
          model.modelName
        );

        if (!scorePaths[dirPath]) {
          scorePaths[dirPath] = [];
        }

        scorePaths[dirPath].push(score);
      }

      for (const [dirPath, scores] of Object.entries(scorePaths)) {
        mkdirSync(join(config.OUTPUT_DIR, dirPath), { recursive: true });
        const scoresPath = await saveArray(scores, options.type, {
          fileNamePrefix: `scores-${options.task}`,
          fileNameSuffix: startedAt,
          dirPath: dirPath,
        });
        const noDataPath = await saveArray(
          scores.map<PromptScore>((score) => ({
            ...score,
            promptData: undefined,
            responseData: undefined,
            correctResponse: undefined,
          })),
          options.type,
          {
            fileNamePrefix: `scores.nodata-${options.task}`,
            fileNameSuffix: startedAt,
            dirPath: dirPath,
          }
        );

        logger.info(`${options.type.toUpperCase()} saved to ${scoresPath}`);
        logger.info(`${options.type.toUpperCase()} saved to ${noDataPath}`);
      }
    }
  )
  .allowUnknownOption(true);

program
  .command("aggregate")
  .alias("agg")
  .description("Aggregates the given scores")
  .option(
    "-n, --task <name>",
    "Task identifier name that is going to be used to find the correct files or place outputs."
  )
  .argument(
    "[score files...]",
    "Score files. If not given any, uses the responses from the given task"
  )
  .action(async (files: string[], rawOptions: { task?: string }) => {
    const options = checkValidationError(
      z
        .object({
          task: z.string().default("default"),
        })
        .safeParse(rawOptions)
    );

    if (rawOptions.task === undefined) {
      logger.warning(
        `Task name is not given, using the default one which is "default"`
      );
    }

    if (files.length === 0) {
      files = goIntoDir(config.OUTPUT_DIR, {
        depth: 4,
        map: (files) => {
          const lastFile = getLatestFile(files);
          if (lastFile) {
            return [lastFile];
          }
          return [];
        },
        filter: (pathInfo) => {
          const regex = new RegExp(`scores-${options.task}-(\\d+)`, "i");
          const nameMatch = pathInfo.name.match(regex);

          return [".json", ".csv"].includes(pathInfo.ext) && nameMatch
            ? true
            : false;
        },
      });
    }

    if (files.length === 0) {
      throw new Error(
        `No score files found for task "${options.task}". Please try to run "score" command`
      );
    }
    await aggregate(files, options.task);
  })
  .allowUnknownOption(true);

program.parseAsync().catch((err) => logger.error(red(err.message)));

/**
 * Returns the newest file path from the given paths.
 * Also works with directories.
 */
function getLatestFile(paths: string[]) {
  const files: { path: string; date: Date }[] = paths.map((p) => ({
    path: p,
    date: statSync(p).mtime,
  }));

  files.sort((a, b) => b.date.getTime() - a.date.getTime());
  return files[0]?.path;
}

/**
 * Recursively walks the given path until reaching the given depth.
 * Then returns the files inside that depth recursively.
 * @param path
 * @param options
 * @returns
 */
function goIntoDir(
  path: string,
  options: {
    filter: (pathInfo: ParsedPath) => boolean;
    map?: (files: string[]) => string[];
    depth: number;
  }
) {
  if (options.depth == 0) {
    const files = readdirSync(path, { recursive: true });
    const processed = files
      .map((fil) => join(path, fil.toString()))
      .filter((fil) => options.filter(parsePath(fil)));
    return options.map ? options.map(processed) : processed;
  }

  const files: string[] = [];
  const dirFiles = readdirSync(path);
  for (const dirFile of dirFiles) {
    const fullPath = join(path, dirFile.toString());
    if (statSync(fullPath, { throwIfNoEntry: false })?.isDirectory()) {
      files.push(
        ...goIntoDir(fullPath, {
          depth: options.depth - 1,
          filter: options.filter,
          map: options.map,
        })
      );
    }
  }

  return files;
}

/**
 * Saves the given array into the output directory as JSON or CSV formatted.
 * Also creates hash & signature files for the newly created file.
 * @returns Path of the saved file
 */
async function saveArray<T>(
  arr: T[],
  type: "json" | "csv",
  options: {
    fileNamePrefix: string | (() => string);
    fileNameSuffix?: string | (() => string);
    dirPath?: string;
  }
) {
  let prefix: () => string;
  let suffix: () => string;

  if (typeof options.fileNamePrefix === "function") {
    prefix = options.fileNamePrefix;
  } else {
    prefix = () => options.fileNamePrefix as string;
  }

  if (typeof options.fileNameSuffix === "function") {
    suffix = options.fileNameSuffix;
  } else {
    suffix = () => (options.fileNameSuffix as string) || Date.now.toString();
  }

  const path = join(
    ...[
      config.OUTPUT_DIR,
      options.dirPath,
      `${prefix()}-${suffix()}.${type}`,
    ].filter<string>((p) => p !== undefined)
  );

  let data = "";
  if (type === "csv") {
    data = await new Promise<string>((res, rej) => {
      csv.stringify(arr, { quoted_string: true, header: true }, (err, out) => {
        if (err) {
          return rej(err);
        }
        res(out);
      });
    });
  } else {
    data = JSON.stringify(arr, null, 2);
  }

  writeFileSync(path, data, {
    encoding: "utf-8",
  });

  const hash = await hashFile(path);
  await signFile(path, hash);

  return path;
}
