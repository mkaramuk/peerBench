import { readTask } from "./format";
import { generateCID, readableTime } from "./utils";
import { config } from "@/config";
import { AbstractProvider } from "@/base/provider";
import {
  MaybePromise,
  Prompt,
  PromptOptions,
  PromptResponse,
  Task,
} from "@/types";
import { v7 as uuidv7 } from "uuid";
import { parseProviderConfig } from "./parser";
import { logger } from "./logger";
import { blue, yellow } from "ansis";
import { getProvider } from "./providers";
import { basename } from "path";
import { calculateSHA256 } from "./std";

/**
 * Sends the prompts from the given task files to the given Providers and
 * collects the responses.
 * @param identifiers Provider and model identifiers. Should be in `providerName:modelOwner/modelName` format
 * @param taskPaths Path of the task files in the local file system
 */
export async function prompt(
  identifiers: string[],
  taskPaths: string[],
  options?: {
    /**
     * Maximum amount of prompt that will be used from the beginning of the given tasks.
     * Uses all tasks if undefined
     * @default undefined
     */
    maxPrompt?: number;
    /**
     * Called whenever a response is received.
     */
    onResponseReceived?: (response: PromptResponse) => MaybePromise<unknown>;
  }
) {
  const promises: Promise<unknown>[] = [];

  // Read all the tasks and make them usable
  const tasks = await Promise.all(
    taskPaths.map(async (taskPath) => (await readTask(taskPath)).task)
  );

  // Total amount of prompt request to be sent
  let totalPromptCount =
    tasks.reduce((acc, t) => acc + t.prompts.length, 0) * identifiers.length;
  let responseCount = 0;

  if (options?.maxPrompt) {
    totalPromptCount = options.maxPrompt * tasks.length * identifiers.length;
    logger.warning(
      `Only ${options.maxPrompt} prompt will be used from each given task file`
    );
  }

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    const task = tasks[taskIndex];
    const taskPath = taskPaths[taskIndex];
    const taskFileName = basename(taskPath); // Ensure we always have a filename
    const runId = uuidv7(); // New evaluation ID per given task

    logger.debug(
      `Found ${task.prompts.length} prompt in ${yellow.bold(
        task.did
      )} (${yellow.bold(taskFileName)})`
    );

    for (const identifier of identifiers) {
      const info = parseProviderConfig(identifier);
      if (info === undefined) {
        continue;
      }

      const provider = getProvider(info.providerName);
      if (provider === undefined) {
        continue;
      }

      if (options?.maxPrompt) {
        task.prompts = task.prompts.slice(0, options.maxPrompt);
      }

      promises.push(
        execPrompts(provider, task, info.modelIdentifier, runId, (response) => {
          responseCount++;
          logger.info(
            `${responseCount} prompt done (from ${yellow.bold(
              taskFileName
            )}), ${totalPromptCount - responseCount} prompt left`
          );
          options?.onResponseReceived?.(response);
        })
      );
    }
  }

  await Promise.all(promises);
  logger.info(`Prompt phase is done`);
}

async function execPrompt(
  task: Task,
  promptNumber: number,
  provider: AbstractProvider,
  prompt: Prompt,
  model: string,
  runId: string
) {
  const providerLogger = provider.logger.child({
    context: `Provider(${provider.name}:${model})`,
  });
  const promptIdentifier = `${promptNumber} from ${yellow.bold(
    task.did
  )} (${yellow.bold(task.fileName)})`;

  try {
    const input = prompt.other.stdFullPromptText;
    const result = await provider.forward(
      input,
      model,
      // TODO: Change prompt based on the evaluation type
      "You are an knowledge expert, you are supposed to answer the multi-choice question to derive your final answer as `The answer is ...` without any other additional text or explanation."
    );
    const elapsedSeconds =
      (result.completedAt.getTime() - result.startedAt.getTime()) / 1000;
    const response = result.response.trim();

    providerLogger.debug(`Result of prompt ${promptIdentifier}: ${response}`);
    providerLogger.info(
      `Prompt ${promptIdentifier} is completed in ${blue.bold(
        readableTime(elapsedSeconds)
      )}`
    );

    const promptCID = (await generateCID(input)).toString();
    const responseCID = (await generateCID(response)).toString();
    const promptResponse: PromptResponse = {
      modelDID: `did:model:${model}`,
      validatorDID: config.VALIDATOR_DID,
      providerDID: provider.did,
      taskDID: task.did,

      runId,
      sourcePromptDatasetCID: task.cid,
      sourceFileName: task.fileName,

      correctResponse: prompt.answer_idx,
      promptCID,
      responseCID,

      promptData: input,
      responseData: response,

      promptedAt: result.startedAt.getTime(),
      repliedAt: result.completedAt.getTime(),

      questionUUID: prompt.other?.stdQuestionUUID || uuidv7(),
      questionHash: calculateSHA256(prompt.question),

      fullPromptData: input,
      fullPromptHash: calculateSHA256(input),
    };
    return promptResponse;
  } catch (err) {
    providerLogger.error(`Error on prompt ${promptIdentifier}: ${err}`);
  }
}

async function execPrompts(
  provider: AbstractProvider,
  task: Task,
  model: string,
  evaluationRunId: string,
  onResponseReceived?: (response: PromptResponse) => MaybePromise<unknown>
) {
  const promises: Promise<any>[] = [];
  for (let i = 0; i < task.prompts.length; i++) {
    const prompt = task.prompts[i];

    promises.push(
      execPrompt(task, i + 1, provider, prompt, model, evaluationRunId).then(
        (response) => {
          if (response) {
            onResponseReceived?.(response);
          }
        }
      )
    );
  }
  await Promise.all(promises);
}

/**
 * Prepares the whole prompt that is going to be asked to the model
 */
export function preparePrompt(question: string, options: PromptOptions) {
  // Append answers to the result
  let result = `${question}\n\n`;
  for (const [letter, answer] of Object.entries(options)) {
    result += `${letter}: ${answer}\n`;
  }

  return result;
}
