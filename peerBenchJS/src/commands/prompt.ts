import { config } from "@/config";
import { logger } from "@/core/logger";
import { parseModelDID, parseProviderDID, parseTaskDID } from "@/core/parser";
import { prompt } from "@/core/prompt";
import { getProvider } from "@/core/providers";
import {
  checkValidationError,
  readFile,
  saveEntity,
  saveJobLog,
  generateCID,
} from "@/core/utils";
import { program } from "@/core/program";
import { PromptResponse } from "@/types";
import { yellow, green } from "ansis";
import { mkdirSync, writeFileSync } from "fs";
import { join, basename, parse as parsePath } from "path";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { statSync } from "fs";
import { convertTaskFormat } from "@/core/std";

const ConfigSchema = z.object({
  tasks: z.array(z.string()),
  models: z.array(z.string()),
});

// Helper function to check if a file exists
function fileExists(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() || false;
}

// Helper function to check if a file is already standardized
function isStandardized(filePath: string): boolean {
  try {
    const content = readFile(filePath);
    const data = JSON.parse(content);
    if (!Array.isArray(data) || data.length === 0) return false;

    const sample = data[0];
    // Check for standardized format (MedQA format)
    return (
      typeof sample.question === "string" &&
      typeof sample.options === "object" &&
      !Array.isArray(sample.options) &&
      "answer_idx" in sample
    );
  } catch {
    return false;
  }
}

// Helper function to standardize a task file if needed
async function ensureStandardized(taskPath: string): Promise<string> {
  if (isStandardized(taskPath)) {
    logger.info(`Task file ${yellow.bold(taskPath)} is already standardized`);
    return taskPath;
  }

  logger.warning(
    `The task file ${yellow.bold(
      taskPath
    )} doesn't have standard schema. Standardizing...`
  );
  const result = await convertTaskFormat({
    sourceTaskFile: taskPath,
    targetFormat: "medqa",
    output: `${taskPath}.std${parsePath(taskPath).ext}`,
  });

  logger.info(`Standardized version saved to ${green.bold(result.outputPath)}`);
  return result.outputPath;
}

// Helper function to calculate CID for a task file and create CID file if it doesn't exist
async function processTaskFile(taskPath: string) {
  // First ensure the file is standardized
  const standardizedPath = await ensureStandardized(taskPath);
  const content = readFile(standardizedPath);
  const cid = await generateCID(content);
  const cidString = cid.toString();
  const cidFilePath = `${standardizedPath}__${cidString}.cid`;

  // Check if CID file already exists
  if (!fileExists(cidFilePath)) {
    writeFileSync(cidFilePath, cidString, {
      encoding: "utf-8",
    });
    logger.debug(`Created CID file for task: ${cidFilePath}`);
  } else {
    logger.debug(`CID file already exists: ${cidFilePath}`);
  }

  return {
    path: standardizedPath,
    cid: cidString,
  };
}

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

      // Process task files and generate CIDs
      const taskFiles = await Promise.all(
        commandConfig.tasks.map((taskPath) => processTaskFile(taskPath))
      );

      // Process each task file separately
      for (let taskIndex = 0; taskIndex < taskFiles.length; taskIndex++) {
        const taskPath = taskFiles[taskIndex].path;
        const taskCID = taskFiles[taskIndex].cid;
        const taskFileName = basename(taskPath);
        logger.info(
          `Processing task ${taskIndex + 1}/${taskFiles.length}: ${yellow.bold(
            taskFileName
          )}`
        );

        // Create a separate response collection for each task
        const taskResponses: Record<string, PromptResponse[]> = {};

        const findResponseSavePath = async (res: PromptResponse) => {
          const provider = getProvider(parseProviderDID(res.providerDID))!;
          const model = await provider.parseModelIdentifier(
            parseModelDID(res.modelDID)
          );

          return join(
            parseTaskDID(res.taskDID).replace("/", "-"),
            config.VALIDATOR_ADDRESS,
            model.modelOwner,
            model.modelName
          );
        };

        const saveTaskResponses = async (logInfo?: boolean) => {
          for (const [dirPath, responses] of Object.entries(taskResponses)) {
            if (responses.length === 0) continue;

            mkdirSync(join(config.OUTPUT_DIR, dirPath), { recursive: true });
            const taskName = parseTaskDID(responses[0].taskDID).replace(
              "/",
              "-"
            );

            // Include the source task filename in the output filename
            const path = await saveEntity(responses, options.type, {
              fileNamePrefix: `responses-${taskName}-${taskFileName.replace(
                /\.[^/.]+$/,
                ""
              )}`,
              fileNameSuffix: startedAt,
              dirPath: dirPath,
              hash: true,
              sign: true,
            });

            if (logInfo) {
              logger.info(
                `${options.type.toUpperCase()} for task ${taskFileName} saved to ${path}`
              );
            }
          }

          if (!logInfo) {
            logger.debug(`Task ${taskFileName} responses saved`);
          }
        };

        // If the process takes too much time, save the responses periodically
        const saveInterval = setInterval(() => saveTaskResponses(), 60_000);

        try {
          // Process only the current task
          await prompt(commandConfig.models, [taskPath], {
            maxPrompt: options.maxPrompts,
            onResponseReceived: async (response) => {
              const path = await findResponseSavePath(response);
              if (!taskResponses[path]) {
                taskResponses[path] = [];
              }

              taskResponses[path].push(response);
            },
          });

          await saveTaskResponses(true);

          // Add task-specific job log
          await saveJobLog(
            {
              uuid: uuidv7(),
              jobType: "prompt",
              startedAt: +startedAt,
              completedAt: Date.now(),
              task: taskPath,
              taskFileName: taskFileName,
              models: commandConfig.models,
              task_CID: taskCID,
            },
            "prompt",
            `${startedAt}-task${taskIndex}`
          );
        } finally {
          clearInterval(saveInterval);
        }
      }

      // Final job log for the entire batch
      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "prompt-batch",
          startedAt: +startedAt,
          completedAt: Date.now(),
          tasks: commandConfig.tasks,
          models: commandConfig.models,
          task_CIDs: taskFiles.map((t) => t.cid),
        },
        "prompt",
        startedAt
      );

      logger.info(`All tasks processed successfully!`);
    }
  )
  .allowUnknownOption(true);
