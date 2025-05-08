import { config } from "@/config";
import { logger } from "@/core/logger";
import { parseModelDID, parseProviderDID, parseTaskDID } from "@/core/parser";
import { getProvider } from "@/core/providers";
import { score } from "@/core/score";
import {
  checkValidationError,
  getLatestFile,
  goIntoDir,
  saveEntity,
  saveJobLog,
  readFile,
} from "@/core/utils";
import { program } from "@/core/program";
import { PromptScore } from "@/types";
import { yellow, green } from "ansis";
import { mkdirSync } from "fs";
import { join, basename, dirname } from "path";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import * as glob from "glob";

// Config schema similar to the prompt command
const ConfigSchema = z.object({
  tasks: z.array(z.string()),
  models: z.array(z.string()),
});

// Helper function to check if a score file already exists for a given response file
function scoreFileExistsForResponse(
  responsePath: string,
  taskName: string
): boolean {
  const responseDir = dirname(responsePath);
  const responseBasename = basename(responsePath);

  // Extract the source filename from the response filename
  // Format: responses-taskname-sourcefilename-timestamp.json
  const match = responseBasename.match(/responses-[^-]+-([^-]+)-\d+/);
  const sourceFileBase = match ? match[1] : "";

  if (!sourceFileBase) return false;

  // Check if a corresponding score file exists
  const scorePattern = join(
    responseDir,
    `scores-${taskName}-${sourceFileBase}-*.json`
  );
  const existingScoreFiles = glob.sync(scorePattern);

  return existingScoreFiles.length > 0;
}

program
  .command("score")
  .description("Scores the given responses")
  .option(
    "-t, --type <type>",
    'Output file type, "json" or "csv". Default is json'
  )
  .option(
    "-n, --task <n>",
    "Task identifier name that is going to be used to find the correct files or place outputs."
  )
  .option(
    "-c, --config <file>",
    "Config file that includes models and task files to be used (similar to prompt command)"
  )
  .argument(
    "[response files...]",
    "Response files. If not given any, uses the responses from the given task name"
  )
  .action(
    async (
      files: string[],
      rawOptions: { type?: string; task?: string; config?: string }
    ) => {
      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);

      // Remove default for task - require it to be explicitly provided unless a config is used
      const options = checkValidationError(
        z
          .object({
            type: z.enum(["json", "csv"]).default("json"),
            task: z.string().optional(), // Remove default value
            config: z.string().optional(),
          })
          .safeParse(rawOptions)
      );

      const startedAt = Date.now().toString();

      // Process config file if provided
      let configOptions: { tasks: string[]; models: string[] } | undefined;
      let taskName = options.task;

      if (options.config) {
        logger.info(`Loading config from ${options.config}`);
        try {
          configOptions = checkValidationError(
            ConfigSchema.safeParse(JSON.parse(readFile(options.config)))
          );
          logger.info(
            `Config loaded with ${configOptions.tasks.length} tasks and ${configOptions.models.length} models`
          );

          // If no explicit task was specified, use a task type that covers all tasks in the config
          if (!taskName && configOptions.tasks.length > 0) {
            // Extract potential common task type (e.g., "medqa" from "medqa-task1.json")
            const firstTaskFile = configOptions.tasks[0];
            const match = basename(firstTaskFile).match(/^([a-zA-Z0-9-_]+)-/);
            if (match && match[1]) {
              taskName = match[1];
              logger.info(
                `Using task type "${taskName}" derived from config tasks`
              );
            }
          }
        } catch (error) {
          logger.error(`Failed to parse config file: ${error}`);
          throw new Error(`Invalid config file: ${error}`);
        }
      }

      // Ensure we have a task name one way or another
      if (!taskName && !configOptions) {
        throw new Error(
          "No task specified. Please provide a task with -n/--task or use a config file with -c/--config"
        );
      }

      // If we're using a config but couldn't derive a task, use a default identifier
      taskName = taskName || "config-based";

      // If no explicit files were provided
      if (files.length === 0) {
        if (configOptions) {
          // Find response files for each task and model in the config
          const responseFiles: string[] = [];

          for (const taskPath of configOptions.tasks) {
            const taskFileName = basename(taskPath);
            const taskBase = taskFileName.replace(/\.[^/.]+$/, "");

            // For each model and each task, look for response files
            for (const model of configOptions.models) {
              // Extract model parts
              const [, modelPath] = model.split(":");
              if (!modelPath) continue;

              const [modelOwner, modelName] = modelPath.split("/");
              if (!modelOwner || !modelName) continue;

              // Look in all possible task subdirectories for response files
              const responsePatterns = [
                // Try with the derived task name if any
                ...(taskName
                  ? [
                      join(
                        config.OUTPUT_DIR,
                        `**/${taskName.replace(
                          "/",
                          "-"
                        )}/**/${modelOwner}/${modelName}/responses-*-${taskBase}-*.json`
                      ),
                    ]
                  : []),

                // Try with any task name pattern (more general search)
                join(
                  config.OUTPUT_DIR,
                  `**/**/${modelOwner}/${modelName}/responses-*-${taskBase}-*.json`
                ),
              ];

              for (const pattern of responsePatterns) {
                const matchingFiles = glob.sync(pattern);
                if (matchingFiles.length > 0) {
                  logger.debug(
                    `Found ${matchingFiles.length} response files matching pattern: ${pattern}`
                  );
                  responseFiles.push(...matchingFiles);
                }
              }
            }
          }

          if (responseFiles.length > 0) {
            logger.info(
              `Found ${responseFiles.length} response files matching tasks and models in config`
            );
            files = responseFiles;
          } else {
            logger.warning(
              "No response files found matching the config tasks and models"
            );
          }
        } else if (taskName) {
          // Traditional behavior: find files based on task option
          files = goIntoDir(config.OUTPUT_DIR, {
            depth: 3,
            map: (files) => {
              const lastFile = getLatestFile(files);
              if (lastFile) {
                return [lastFile];
              }
              return [];
            },
            filter: (pathInfo) => {
              const regex = new RegExp(`responses-${taskName}-[^-]+-\\d+`, "i");
              const nameMatch = pathInfo.name.match(regex);

              return [".json", ".csv"].includes(pathInfo.ext) && nameMatch
                ? true
                : false;
            },
          });
        }
      }

      if (files.length === 0) {
        throw new Error(
          `No response files found for task "${taskName}". Please try to run "prompt" command`
        );
      }

      // Filter out response files that already have corresponding score files
      const filesToProcess = files.filter(
        (file) => !scoreFileExistsForResponse(file, taskName)
      );

      if (filesToProcess.length === 0) {
        logger.info(
          "All response files already have corresponding score files. Nothing to do."
        );
        return;
      } else {
        logger.info(
          `Processing ${filesToProcess.length} response files (${
            files.length - filesToProcess.length
          } already have score files)`
        );
      }

      const allScores = await score(filesToProcess);

      // Group scores by source file name to create separate output files
      const scoresBySourceFile: Record<
        string,
        Record<string, PromptScore[]>
      > = {};

      for (const score of allScores) {
        const scoreTaskName = parseTaskDID(score.taskDID).replace("/", "-");
        const provider = getProvider(parseProviderDID(score.providerDID))!;
        const model = await provider.parseModelIdentifier(
          parseModelDID(score.modelDID)
        );

        // Path structure without the source file name
        const basePath = join(
          scoreTaskName,
          config.VALIDATOR_ADDRESS,
          model.modelOwner,
          model.modelName
        );

        // Get source file name or use a default
        const sourceFileName = score.sourceFileName || "unknown-source";

        // Initialize the structures if they don't exist
        if (!scoresBySourceFile[sourceFileName]) {
          scoresBySourceFile[sourceFileName] = {};
        }

        if (!scoresBySourceFile[sourceFileName][basePath]) {
          scoresBySourceFile[sourceFileName][basePath] = [];
        }

        // Add the score to the appropriate collection
        scoresBySourceFile[sourceFileName][basePath].push(score);
      }

      // Now save each group of scores separately
      let totalScoreFiles = 0;
      for (const [sourceFileName, pathScores] of Object.entries(
        scoresBySourceFile
      )) {
        const sourceFileBase = basename(sourceFileName).replace(
          /\.[^/.]+$/,
          ""
        );

        for (const [dirPath, scores] of Object.entries(pathScores)) {
          mkdirSync(join(config.OUTPUT_DIR, dirPath), { recursive: true });

          // Include source file name in the output filename
          const scoresPath = await saveEntity(scores, options.type, {
            fileNamePrefix: `scores-${taskName}-${sourceFileBase}`,
            fileNameSuffix: startedAt,
            dirPath: dirPath,
            hash: true,
            sign: true,
          });

          // Also include source file name in the no-data version
          const noDataPath = await saveEntity(
            scores.map<PromptScore>((score) => ({
              ...score,
              promptData: undefined,
              responseData: undefined,
              correctResponse: undefined,
              fullPromptData: undefined,
            })),
            options.type,
            {
              fileNamePrefix: `scores.nodata-${taskName}-${sourceFileBase}`,
              fileNameSuffix: startedAt,
              dirPath: dirPath,
              hash: true,
              sign: true,
            }
          );

          totalScoreFiles += 2; // We created 2 files (regular and no-data)
          logger.info(
            `${options.type.toUpperCase()} for ${sourceFileName} saved to ${scoresPath}`
          );
          logger.info(
            `${options.type.toUpperCase()} no-data for ${sourceFileName} saved to ${noDataPath}`
          );
        }
      }

      logger.info(
        `${green.bold(totalScoreFiles.toString())} score files created for ${
          Object.keys(scoresBySourceFile).length
        } source files`
      );

      // Save job log
      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "score",
          startedAt: +startedAt,
          completedAt: Date.now(),
          files: filesToProcess,
          inputTasks: Object.keys(scoresBySourceFile),
          taskName,
        },
        "score",
        startedAt
      );
    }
  )
  .allowUnknownOption(true);
