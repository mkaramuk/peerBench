import { config } from "@/config";
import { logger } from "@/core/logger";
import { checkValidationError, saveJobLog } from "@/core/utils";
import { program } from "@/core/program";
import { table as formatTable } from "table";
import { z } from "zod";
import { blue, cyan, green, magenta, red, yellow } from "ansis";
import { parseDIDPrefix, parseValidationError } from "@/core/parser";
import { v7 as uuidv7 } from "uuid";
import { join, basename, dirname } from "path";
import * as glob from "glob";
import {
  aggregate,
  bufferToString,
  PromptScoreSchema,
  readableTime,
  readFile,
} from "@peerbench/sdk";
import { statSync } from "fs";

program
  .command("aggregate")
  .alias("agg")
  .description("Aggregates the given scores")
  .argument(
    "[files]",
    "The score files to be aggregated. If not provided, the command will try to find them in the work directory."
  )
  .option(
    "-f, --format <type>",
    'Changes the output file format. Valid values are"json", "table" and "csv". Default is "table"'
  )
  .option(
    "-w, --work-dir <path>",
    'The working directory for the outputs. Default is "<current directory>/output"'
  )
  .option("-t, --task <...path>", "The path to the task file")
  .option(
    "-c, --config <path>",
    "Uses all the parameters from the given config file"
  )
  .action(
    async (
      files: string[],
      rawOptions: {
        format?: string;
        task?: string[];
        workDir?: string;
        config?: string;
      }
    ) => {
      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);

      const startedAt = Date.now();
      const options = checkValidationError(
        z
          .object({
            type: z.enum(["json", "csv"]).default("json"),
            tasks: z.string().array().default([]),
            workDir: z.string().default(join(process.cwd(), "output")),
            config: z.string().optional(),
          })
          .safeParse({
            ...rawOptions,
            tasks: rawOptions.task,
          })
      );

      if (options.config) {
        const content = await readFile(options.config);
        const configJson = JSON.parse(bufferToString(content));
        const configSchema = z.object({
          tasks: z.string().array(),
          models: z.string().array(),
        });

        const validationResult = configSchema.safeParse(configJson);
        const parseError = parseValidationError(validationResult);
        if (parseError) {
          throw new Error(
            `Couldn't parse the given config file: ${parseError}`
          );
        }

        options.tasks = validationResult.data!.tasks;
      }

      if (options.tasks.length === 0) {
        throw new Error("No tasks provided");
      }

      const taskFileNames = options.tasks.map((task) => basename(task));
      let scoreFiles: string[] = files || [];

      // If no score files were provided, try to find them in the work directory
      if (scoreFiles.length === 0) {
        for (const taskFileName of taskFileNames) {
          const formattedTaskFileName = basename(taskFileName).replace(
            /[^a-zA-Z0-9.]/g,
            "-"
          );
          const scoreFileNameGlob = `scores-${formattedTaskFileName}-*.json`;
          const globPattern = join(
            options.workDir,
            "**",
            "**",
            scoreFileNameGlob
          );
          const matchedFiles = glob.sync(globPattern);

          // Group files by their base directory and get the latest one from each group
          const latestFilesByDir = matchedFiles.reduce((acc, filePath) => {
            const dirPath = dirname(filePath);
            const existingFile = acc.get(dirPath);

            if (
              !existingFile ||
              statSync(filePath).mtime > statSync(existingFile).mtime
            ) {
              acc.set(dirPath, filePath);
            }

            return acc;
          }, new Map<string, string>());
          scoreFiles = scoreFiles.concat(Array.from(latestFilesByDir.values()));
        }
      }

      // Show error message if we couldn't find even after the search
      if (scoreFiles.length === 0) {
        throw new Error("No score files found");
      }

      const allScores = (
        await Promise.all(
          scoreFiles.map(async (file) => {
            const content = await readFile(file);
            const json = JSON.parse(bufferToString(content));
            const validation = z.array(PromptScoreSchema).safeParse(json);
            const error = parseValidationError(validation);
            if (error) {
              throw new Error(`Invalid score file ${file}: ${error}`);
            }

            return validation.data!;
          })
        )
      ).flat();

      const aggregation = await aggregate(allScores);

      console.log(
        `Run IDs used in this aggregation:\n${yellow.bold(
          aggregation.runIds.map((runId) => `  - ${runId}`).join("\n")
        )}\n`
      );

      console.log("Task files used in this aggregation:");
      for (const [cid, name] of Object.entries(aggregation.taskFiles)) {
        console.log(green.bold(`  - ${name} (${cid})`));
      }
      console.log();

      console.log(
        formatTable(
          [
            [
              "Rank",
              "Provider:Model",
              "Total\nResponses",
              "Total\nScore",
              "Wrong\nAnswers",
              "Failed\nResponses",
              "Avg.\nLatency",
              "Avg.\nScore",
            ],
            ...aggregation.results.map((row, i) => [
              cyan.bold(i + 1),
              magenta.bold(
                `${parseDIDPrefix(row.providerDID)}:${parseDIDPrefix(row.modelDID)}`
              ),
              green.bold(row.totalResponses),
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

      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "aggregate",
          startedAt,
          completedAt: Date.now(),
          params: {
            files: aggregation.taskFiles,
            tasks: taskFileNames,
          },
        },
        "aggregate",
        startedAt
      );
    }
  )
  .allowUnknownOption(true);
