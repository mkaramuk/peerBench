import { config } from "@/config";
import { aggregate } from "@/core/aggregate";
import { logger } from "@/core/logger";
import {
  checkValidationError,
  getLatestFile,
  goIntoDir,
  readableTime,
  saveEntity,
  saveJobLog,
  readFile,
} from "@/core/utils";
import { program } from "@/core/program";
import { table as formatTable } from "table";
import { z } from "zod";
import { blue, cyan, green, magenta, red, yellow } from "ansis";
import { parseModelDID, parseProviderDID } from "@/core/parser";
import { v7 as uuidv7 } from "uuid";
import { join, basename, dirname } from "path";
import * as glob from "glob";
import * as fs from "fs";

// Config schema similar to prompt and score commands
const ConfigSchema = z.object({
  tasks: z.array(z.string()),
  models: z.array(z.string()),
});

program
  .command("aggregate")
  .alias("agg")
  .description("Aggregates the given scores")
  .option(
    "-n, --task <n>",
    "Task identifier name that is going to be used to find the correct files or place outputs."
  )
  .option("-o, --output <path>", "Writes results to the output file")
  .option(
    "-t, --type <json or csv>",
    "Defines output format. Must be used with --output option."
  )
  .option(
    "-c, --config <file>",
    "Config file that includes models and task files to be used (similar to prompt and score commands)"
  )
  .argument(
    "[score files...]",
    "Score files. If not given any, uses the responses from the given task."
  )
  .action(
    async (
      files: string[],
      rawOptions: {
        task?: string;
        output?: string;
        type?: string;
        config?: string;
      }
    ) => {
      const startedAt = Date.now();
      const options = checkValidationError(
        z
          .object({
            task: z.string().optional(), // Remove default, make it optional
            output: z.string().default("results.json"),
            type: z.enum(["json", "csv"]).default("json"),
            config: z.string().optional(),
          })
          .safeParse(rawOptions)
      );

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

          // If no explicit task was specified, try to derive it from config tasks
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

      if (files.length === 0) {
        if (configOptions) {
          // Find score files for each task and model in the config
          const scoreFiles: string[] = [];

          for (const taskPath of configOptions.tasks) {
            const taskFileName = basename(taskPath);
            const taskBase = taskFileName.replace(/\.[^/.]+$/, "");

            // For each model and each task, look for score files
            for (const model of configOptions.models) {
              // Extract model parts
              const [, modelPath] = model.split(":");
              if (!modelPath) continue;

              const [modelOwner, modelName] = modelPath.split("/");
              if (!modelOwner || !modelName) continue;

              // Look in all possible task subdirectories for score files
              const scorePatterns = [
                // Try with the derived task name if any
                ...(taskName
                  ? [
                      join(
                        config.OUTPUT_DIR,
                        `**/${taskName.replace(
                          "/",
                          "-"
                        )}/**/${modelOwner}/${modelName}/scores-${taskName}-${taskBase}-*.json`
                      ),
                    ]
                  : []),

                // Try with any task name pattern (more general search)
                join(
                  config.OUTPUT_DIR,
                  `**/**/${modelOwner}/${modelName}/scores-*-${taskBase}-*.json`
                ),
              ];

              for (const pattern of scorePatterns) {
                const matchingFiles = glob.sync(pattern);
                if (matchingFiles.length > 0) {
                  logger.debug(
                    `Found ${matchingFiles.length} score files matching pattern: ${pattern}`
                  );
                  scoreFiles.push(...matchingFiles);
                }
              }
            }
          }

          if (scoreFiles.length > 0) {
            logger.info(
              `Found ${scoreFiles.length} score files matching tasks and models in config`
            );
            files = scoreFiles;
          } else {
            logger.warning(
              "No score files found matching the config tasks and models. Run 'score' command first."
            );
          }
        } else if (taskName) {
          // Traditional behavior: find files based on task option
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
              const regex = new RegExp(`scores-${taskName}-[^-]+-\\d+`, "i");
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
          `No score files found for task "${taskName}". Please try to run "score" command first.`
        );
      }

      logger.info(`Aggregating ${files.length} score files...`);

      // If we have a config with multiple tasks, perform per-task aggregation first
      if (configOptions && configOptions.tasks.length > 1) {
        logger.info(
          `Config contains ${configOptions.tasks.length} tasks. Performing per-task aggregation...`
        );

        // Group score files by task
        const taskGroups: { [taskFile: string]: string[] } = {};

        for (const taskPath of configOptions.tasks) {
          const taskFileName = basename(taskPath);
          const taskBase = taskFileName.replace(/\.[^/.]+$/, "");

          // Find score files for this specific task
          const taskScoreFiles = files.filter((file) => {
            return basename(file).includes(`-${taskBase}-`);
          });

          if (taskScoreFiles.length > 0) {
            taskGroups[taskBase] = taskScoreFiles;
            logger.info(
              `Found ${taskScoreFiles.length} score files for task "${taskBase}"`
            );
          }
        }

        // Process each task group separately
        for (const [taskBase, taskFiles] of Object.entries(taskGroups)) {
          if (taskFiles.length === 0) continue;

          logger.info(
            `Aggregating results for task "${taskBase}" (${taskFiles.length} files)...`
          );
          const taskResults = await aggregate(taskFiles);

          if (taskResults.length > 0) {
            // Display table for this task
            console.log(
              yellow.bold(`\n=== Aggregation Results for Task: ${taskBase} ===`)
            );
            console.log("Task DID:", yellow.bold(taskResults[0].taskDID));
            console.log(
              formatTable(
                [
                  [
                    "Rank",
                    "Provider:Model",
                    "Total\nResponses",
                    "Total\nScore",
                    "Wrong\nAnswers",
                    "Failed\nAnswers",
                    "Avg.\nLatency",
                    "Avg.\nScore",
                  ],
                  ...taskResults.map((row, i) => [
                    cyan.bold(i + 1),
                    magenta.bold(
                      `${parseProviderDID(row.providerDID)}:${parseModelDID(
                        row.modelDID
                      )}`
                    ),
                    green.bold(row.totalResponse),
                    yellow.bold(row.score),
                    red.bold(row.wrongAnswers),
                    red.bold(row.missingAnswers),
                    blue.bold(readableTime(row.avgLatency)),
                    yellow(row.avgScore.toFixed(2)),
                  ]),
                ],
                {
                  border: {
                    topBody: `─`,
                    topJoin: `┬`,
                    topLeft: `╭`,
                    topRight: `╮`,
                    bottomBody: `─`,
                    bottomJoin: `┴`,
                    bottomLeft: `╰`,
                    bottomRight: `╯`,
                    bodyLeft: `│`,
                    bodyRight: `│`,
                    bodyJoin: `│`,
                    joinBody: `─`,
                    joinLeft: `├`,
                    joinRight: `┤`,
                    joinJoin: `┼`,
                  },
                }
              )
            );

            // Save per-task results
            const timestamp = Date.now();
            const taskOutputPrefix = `results-${taskBase}-${timestamp}`;
            const taskOutputPath = join(
              config.OUTPUT_DIR,
              "aggregates",
              `${taskOutputPrefix}.${options.type}`
            );

            // Ensure directory exists
            const outputDir = dirname(taskOutputPath);
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }

            const taskPath = await saveEntity(taskResults, options.type, {
              fileNamePrefix: taskOutputPrefix,
              fileNameSuffix: "",
              path: taskOutputPath,
              hash: true,
              sign: true,
            });

            logger.info(`Task "${taskBase}" results saved to ${taskPath}`);
          }
        }

        // Now show the full aggregation results header
        console.log(
          yellow.bold(`\n=== Combined Aggregation Results (All Tasks) ===`)
        );
      }

      // Perform the full aggregation (all files together)
      const results = await aggregate(files);

      if (results.length == 0) {
        throw new Error(`No results were generated (check your score files)`);
      }

      // If we displayed per-task results earlier, make it clear this is the combined view
      if (configOptions && configOptions.tasks.length > 1) {
        console.log(
          "Task DID:",
          yellow.bold(results[0].taskDID),
          cyan.bold("(Combined Results)")
        );
      } else {
        console.log("Task DID:", yellow.bold(results[0].taskDID));
      }

      // Extract and display all distinct runIds from the results
      const allRunIds = new Set<string>();
      results.forEach((result) => {
        result.score_runIds.forEach((runId) => allRunIds.add(runId));
      });

      console.log("Run IDs used in this aggregation:");
      Array.from(allRunIds).forEach((runId) => {
        console.log(`  - ${yellow.bold(runId)}`);
      });
      console.log();

      // Extract and display all distinct sourcePromptDatasetCIDs from the results
      const allSourcePromptDatasetCIDs = new Set<string>();
      results.forEach((result) => {
        result.sourcePromptDatasetCIDs.forEach((cid) =>
          allSourcePromptDatasetCIDs.add(cid)
        );
      });

      console.log("Source Prompt Dataset CIDs used in this aggregation:");
      Array.from(allSourcePromptDatasetCIDs).forEach((cid) => {
        console.log(`  - ${yellow.bold(cid)}`);
      });
      console.log();

      // Extract and display all distinct source file names from the results
      const allSourceFileNames = new Set<string>();
      results.forEach((result) => {
        if (result.sourceFileNames) {
          result.sourceFileNames.forEach((filename) =>
            allSourceFileNames.add(filename)
          );
        }
      });

      if (allSourceFileNames.size > 0) {
        console.log("Source File Names used in this aggregation:");
        Array.from(allSourceFileNames).forEach((filename) => {
          console.log(`  - ${green.bold(filename)}`);
        });
        console.log();
      }

      // Print the combined aggregated results table
      console.log(
        formatTable(
          [
            [
              "Rank",
              "Provider:Model",
              "Total\nResponses",
              "Total\nScore",
              "Wrong\nAnswers",
              "Failed\nAnswers",
              "Avg.\nLatency",
              "Avg.\nScore",
            ],
            ...results.map((row, i) => [
              cyan.bold(i + 1),
              magenta.bold(
                `${parseProviderDID(row.providerDID)}:${parseModelDID(
                  row.modelDID
                )}`
              ),
              green.bold(row.totalResponse),
              yellow.bold(row.score),
              red.bold(row.wrongAnswers),
              red.bold(row.missingAnswers),
              blue.bold(readableTime(row.avgLatency)),
              yellow(row.avgScore.toFixed(2)),
            ]),
          ],
          {
            border: {
              topBody: `─`,
              topJoin: `┬`,
              topLeft: `╭`,
              topRight: `╮`,

              bottomBody: `─`,
              bottomJoin: `┴`,
              bottomLeft: `╰`,
              bottomRight: `╯`,

              bodyLeft: `│`,
              bodyRight: `│`,
              bodyJoin: `│`,

              joinBody: `─`,
              joinLeft: `├`,
              joinRight: `┤`,
              joinJoin: `┼`,
            },
          }
        )
      );

      // Handle output file - always save by default
      // Try to auto detect file type
      if (rawOptions.type === undefined && options.output.endsWith(".csv")) {
        options.type = "csv";
      } else {
        options.type = "json"; // Default to JSON
      }

      // Use a simple epoch timestamp for the filename
      const timestamp = Date.now();
      const outputPrefix =
        rawOptions.output !== undefined
          ? options.output
          : `results-combined-${timestamp}`;

      const outputPath =
        rawOptions.output !== undefined
          ? options.output
          : join(
              config.OUTPUT_DIR,
              "aggregates",
              `${outputPrefix}.${options.type}`
            );

      // Ensure the output directory exists
      const outputDir = dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        logger.info(`Creating output directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const path = await saveEntity(results, options.type, {
        fileNamePrefix: outputPrefix,
        fileNameSuffix: "", // No additional suffix needed since timestamp is in prefix
        path: outputPath,
        hash: true,
        sign: true,
      });

      logger.info(`Results saved to ${path}`);

      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "aggregate",
          startedAt: +startedAt,
          completedAt: Date.now(),
          files,
          taskName,
          sourceFiles: Array.from(allSourceFileNames),
        },
        "aggregate",
        startedAt
      );

      logger.info(
        `Aggregation completed successfully for ${files.length} score files.`
      );
    }
  )
  .allowUnknownOption(true);
