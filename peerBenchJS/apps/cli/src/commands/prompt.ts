import { config } from "@/config";
import { logger } from "@/core/logger";
import {
  parseModelDID,
  parseProviderConfig,
  parseProviderDID,
  parseValidationError,
} from "@/core/parser";
import {
  checkValidationError,
  csvStringify,
  generateCIDFile,
  generateSignatureFile,
  randomInteger,
  saveJobLog,
} from "@/core/utils";
import { program } from "@/core/program";
import { blue, yellow } from "ansis";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import {
  bufferToString,
  prompt,
  PromptResponse,
  readableTime,
  readFile,
  readTaskFromFile,
  SchemaName,
} from "@peerbench/sdk";
import { getProvider } from "@/core/providers";

program
  .command("prompt")
  .description("Prompts the given tasks to the given models")
  .option(
    "-f, --format <type>",
    'Changes the output file format. It can be either "json" or "csv". Default is json'
  )
  .option(
    "-w, --work-dir <path>",
    'The working directory for the outputs. Default is "<current directory>/output"'
  )
  .option(
    "-M, --max-prompts <number>",
    "The prompt count that will be used from the beginning of the given tasks. If not given, uses all of the prompts"
  )
  .option("-t, --task <...path>", "The path to the task file")
  .option("-m, --model <...model>", "The model to be used")
  .option(
    "-c, --config <path>",
    "Uses all the parameters from the given config file"
  )
  .action(
    async (rawOptions: {
      format?: string;
      task?: string[];
      model?: string[];
      workDir?: string;
      config?: string;
      maxPrompts?: number;
    }) => {
      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);

      const startedAt = Date.now();
      const options = checkValidationError(
        z
          .object({
            type: z.enum(["json", "csv"]).default("json"),
            tasks: z.string().array().default([]),
            models: z.string().array().default([]),
            workDir: z.string().default(join(process.cwd(), "output")),
            config: z.string().optional(),
            maxPrompts: z.number().optional(),
          })
          .safeParse({
            ...rawOptions,
            tasks: rawOptions.task,
            models: rawOptions.model,
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
        options.models = validationResult.data!.models;
      }

      if (options.tasks.length === 0) {
        throw new Error("No tasks provided");
      }

      if (options.models.length === 0) {
        throw new Error("No models provided");
      }

      // Read the given task files
      const taskDetails = await Promise.all(
        options.tasks.map((taskPath) => readTaskFromFile(taskPath))
      );
      const totalPromptCount =
        taskDetails.reduce((acc, t) => acc + t.task.prompts.length, 0) *
        options.models.length;

      logger.info(
        `Total prompt to be executed is ${yellow.bold(totalPromptCount)}`
      );

      // Check if any of the tasks that doesn't use the PB schema
      for (const details of taskDetails) {
        if (details.schema.name !== SchemaName.pb) {
          logger.error(
            `Task file ${details.task.fileName} doesn't follow peerBench's schema. Please use "peerbench std" command to convert it to the standard peerBench schema format.`
          );
          process.exitCode = 1;
          return;
        }
      }

      const promptPromises: Promise<void>[] = [];
      const responseFilePaths = new Set<string>();
      let processedPromptCount = 0;

      // Process each task file separately
      for (let taskIndex = 0; taskIndex < taskDetails.length; taskIndex++) {
        const task = taskDetails[taskIndex].task;
        const allResponses: Record<string, PromptResponse[]> = {};
        const taskName = task.fileName.replace(/[^a-zA-Z0-9.]/g, "-");

        const getSavePath = async (res: PromptResponse) => {
          const providerName = parseProviderDID(res.providerDID);
          const provider = getProvider(providerName)!;
          const modelIdentifier = parseModelDID(res.modelDID);
          const model = provider.parseModelIdentifier(modelIdentifier);

          return join(
            taskName,
            config.VALIDATOR_ADDRESS,
            model.modelOwner,
            model.modelName
          );
        };

        const saveResponses = async () => {
          for (const [dirPath, responses] of Object.entries(allResponses)) {
            // No responses for this path, skip
            if (responses.length === 0) continue;

            // Create the directory if it doesn't exist
            const baseDir = join(options.workDir, dirPath);
            mkdirSync(baseDir, { recursive: true });

            const responseFilePath = join(
              baseDir,
              `responses-${taskName}-${startedAt}.${options.type}`
            );

            // Generate output file content for the responses
            let content = "";
            if (options.type === "csv") {
              content = await csvStringify(responses);
            } else {
              content = JSON.stringify(responses);
            }

            // Save the content to the file
            writeFileSync(responseFilePath, content, { encoding: "utf-8" });

            // Save the file path to hash and sign it later
            responseFilePaths.add(responseFilePath);
          }
        };

        const providerAndModels = options.models.map((model) => {
          const providerConfig = parseProviderConfig(model);

          if (!providerConfig) {
            throw new Error(`Couldn't parse model configuration: ${model}`);
          }

          const provider = getProvider(providerConfig.providerName)!;
          const modelDetails = provider.parseModelIdentifier(
            providerConfig.modelIdentifier
          );

          let modelString = `${modelDetails.modelOwner}/${modelDetails.modelName}`;
          if (modelDetails.subProvider) {
            modelString = `${modelDetails.subProvider}/${modelString}`;
          }

          return {
            model: modelString,
            provider,
          };
        });

        promptPromises.push(
          prompt({
            tasks: [task],
            validatorDID: config.VALIDATOR_DID,
            systemPrompt:
              "You are an knowledge expert, you are supposed to answer the multi-choice question to derive your final answer as `The answer is ...` without any other additional text or explanation.",
            providerAndModels,
            onPromptSending: (prompt, details) => {
              logger.debug(
                `Sending prompt ${prompt.did} to ${details.model} of ${details.provider.name} for task ${task.fileName}`,
                {
                  context: `Provider(${details.provider.name}:${details.model})`,
                }
              );
            },
            onPromptResponse: async (response: PromptResponse, details) => {
              const loggerContext = `Provider(${details.provider.name}:${details.model})`;
              const path = await getSavePath(response);
              if (!allResponses[path]) {
                allResponses[path] = [];
              }
              allResponses[path].push(response);

              logger.info(
                `Prompt ${response.prompt.did} is completed in ${blue.bold(
                  readableTime(
                    (response.repliedAt! - response.promptedAt) / 1000
                  )
                )}`,
                { context: loggerContext }
              );
              logger.debug(`Response: ${response.data}`, {
                context: loggerContext,
              });

              processedPromptCount++;

              // Log the progress and save the responses periodically
              if (processedPromptCount % randomInteger(10, 20) === 0) {
                saveResponses();
              }
              if (processedPromptCount % 5 === 0) {
                logger.info(
                  `Processed ${processedPromptCount} prompts out of ${totalPromptCount}`,
                  { context: loggerContext }
                );
              }
            },
            onPromptError: (err, details) => {
              const loggerContext = `Provider(${details.provider.name}:${details.model})`;
              logger.error(`An error occurred while prompting: ${err}`, {
                context: loggerContext,
              });
            },
          })
            .then(() => saveResponses())
            .catch((err) => {
              logger.error(
                `An error occurred while prompting the task: ${err}`
              );
            })
        );
      }

      await Promise.all(promptPromises);

      for (const responseFilePath of responseFilePaths) {
        const cid = await generateCIDFile(responseFilePath);
        await generateSignatureFile(responseFilePath, cid);
        logger.info(`Response file is saved: ${responseFilePath}`);
      }

      logger.info("Done");

      // Final job log for the entire batch
      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "prompt",
          startedAt: +startedAt,
          completedAt: Date.now(),
          params: {
            tasks: options.tasks,
            models: options.models,
            taskCIDs: taskDetails.map((t) => t.task.cid),
          },
        },
        "prompt",
        startedAt
      );

      logger.info(`All tasks processed successfully!`);
    }
  )
  .allowUnknownOption(true);
