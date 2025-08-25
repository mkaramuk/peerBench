import { config } from "@/config";
import { logger } from "@/core/logger";
import { program } from "@/core/program";
import { yellow } from "ansis";
import { statSync, writeFileSync } from "fs";
import { join, basename, dirname } from "path";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import * as glob from "glob";
import {
  bufferToString,
  PromptResponseSchema,
  PromptScore,
  readFile,
  score,
} from "@peerbench/sdk";
import {
  checkValidationError,
  csvStringify,
  generateCIDFile,
  generateSignatureFile,
  saveJobLog,
} from "@/core/utils";
import { parseValidationError } from "@/core/parser";

program
  .command("score")
  .description("Scores the given response files")
  .argument(
    "[files]",
    "The response files to be scored. If not provided, the command will try to find them in the work directory."
  )
  .option(
    "-f, --format <type>",
    'Changes the output file format. It can be either "json" or "csv". Default is json'
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
      let responseFiles: string[] = files || [];

      // If no response files were provided, try to find them in the work directory
      if (responseFiles.length === 0) {
        for (const taskFileName of taskFileNames) {
          const formattedTaskFileName = basename(taskFileName).replace(
            /[^a-zA-Z0-9.]/g,
            "-"
          );
          const responseFileNameGlob = `responses-${formattedTaskFileName}-*.json`;
          const globPattern = join(
            options.workDir,
            "**",
            "**",
            responseFileNameGlob
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
          responseFiles = responseFiles.concat(
            Array.from(latestFilesByDir.values())
          );
        }
      }

      // Show error message if we couldn't find even after the search
      if (responseFiles.length === 0) {
        throw new Error("No response files found");
      }

      const allResponses = await Promise.all(
        responseFiles.map(async (file) => {
          const content = await readFile(file);
          const json = JSON.parse(bufferToString(content));
          const validation = z.array(PromptResponseSchema).safeParse(json);
          const error = parseValidationError(validation);
          if (error) {
            throw new Error(`Invalid response file ${file}: ${error}`);
          }

          return {
            file,
            data: validation.data!,
          };
        })
      );

      for (const responses of allResponses) {
        const scores = await score(responses.data);
        const dirName = dirname(responses.file);
        const match = basename(responses.file).match(
          /^responses-(?<taskName>.*)-(?<timestamp>\d+)/
        );

        // If the response file name follows the schema above, use it
        // otherwise use default values
        const taskName = match?.groups?.taskName || basename(responses.file);
        const timestamp = match?.groups?.timestamp || Date.now();

        const saveScoreFile = async (
          scores: PromptScore[],
          nodata?: boolean
        ) => {
          const scoreFilePath = join(
            dirName,
            `scores${nodata ? ".nodata" : ""}-${taskName}-${timestamp}.json`
          );

          if (statSync(scoreFilePath, { throwIfNoEntry: false })?.isFile()) {
            logger.warning(
              `${nodata ? "No data " : ""}Score file already exists for response file ${responses.file}: ${scoreFilePath}. Skipping...`
            );
            return;
          }

          // Generate output file content for the responses
          let content = "";
          if (options.type === "csv") {
            content = await csvStringify(scores);
          } else {
            content = JSON.stringify(scores);
          }

          // Save the content to the file
          writeFileSync(scoreFilePath, content, { encoding: "utf-8" });

          const cid = await generateCIDFile(scoreFilePath);
          const signature = await generateSignatureFile(scoreFilePath, cid);
          logger.info(`Score file is saved: ${scoreFilePath}`);
          logger.info(`CID: ${cid}`);
          logger.info(`Signature: ${signature}`);
        };

        await saveScoreFile(scores);
        await saveScoreFile(
          scores.map((score) => ({
            ...score,
            data: undefined,
            prompt: {
              ...score.prompt,
              question: {
                ...score.prompt.question,
                data: undefined,
              },
              answer: undefined,
              fullPrompt: {
                ...score.prompt.fullPrompt,
                data: undefined,
              },
              options: undefined,
            },
          })),
          true
        );
      }

      // Save job log
      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "score",
          startedAt,
          completedAt: Date.now(),
          params: {
            tasks: options.tasks,
            responseFiles,
          },
        },
        "score",
        startedAt
      );
    }
  )
  .allowUnknownOption(true);
