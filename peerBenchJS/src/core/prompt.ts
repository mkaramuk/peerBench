import { readTask } from "./reader";
import { generateCID, readableTime } from "./utils";
import { config } from "@/config";
import { AbstractProvider } from "@/base/provider";
import { MaybePromise, Prompt, PromptResponse, Task } from "@/types";
import { v7 as uuidv7 } from "uuid";
import { parseIdentifier } from "./parser";
import { logger } from "./logger";

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
    taskPaths.map((taskPath) => readTask(taskPath))
  );

  // Total amount of prompt request to be send
  let totalPromptCount =
    tasks.reduce((acc, t) => acc + t.prompts.length, 0) * identifiers.length;
  let responseCount = 0;

  if (options?.maxPrompt) {
    totalPromptCount = options.maxPrompt * tasks.length * identifiers.length;
    logger.warning(
      `Only ${options.maxPrompt} prompt will be used from each given task file`
    );
  }

  for (const task of tasks) {
    const evaluationRunId = uuidv7(); // New evaluation ID per given task

    logger.debug(`Found ${task.prompts.length} prompt in ${task.name}`);
    for (const identifier of identifiers) {
      const info = parseIdentifier(identifier);
      if (info === undefined) {
        continue;
      }

      if (options?.maxPrompt) {
        task.prompts = task.prompts.slice(0, options.maxPrompt);
      }

      const { provider, model } = info;
      promises.push(
        execPrompts(provider, task, model, evaluationRunId, (response) => {
          responseCount++;
          logger.info(
            `${responseCount} prompt done, ${
              totalPromptCount - responseCount
            } prompt left`
          );
          options?.onResponseReceived?.(response);
        })
      );
    }
  }

  await Promise.all(promises);
  logger.info(`Prompt done`);
}

async function execPrompt(
  task: Task,
  promptNumber: number,
  provider: AbstractProvider,
  prompt: Prompt,
  model: string,
  evaluationRunId: string
) {
  const providerLogger = provider.logger.child({
    context: `Provider(${provider.name}:${model})`,
  });
  const promptIdentifier = `${promptNumber} from "${task.name}"`;
  try {
    let input = prompt.input;
    let correctResponse = prompt.expectedAnswer || "";

    if (task.inputPrefix) {
      input = `${task.inputPrefix}${input}`;
    }
    if (task.inputSuffix) {
      input = `${input}${task.inputSuffix}`;
    }

    if (prompt.answers !== undefined) {
      input += "\n\n";
      let letterIndex = 0;
      for (const [answer, score] of Object.entries(prompt.answers)) {
        const letter = String.fromCharCode(65 + letterIndex);
        input += `${letter}: ${answer}\n`;

        if (score === 1) {
          correctResponse = letter;
        }
        letterIndex++;
      }
    }

    const result = await provider.forward(
      input,
      model,
      task.systemPrompt || // Use the given prompt by the task if there is any
        "You are an knowledge expert, you are supposed to answer the multi-choice question to derive your final answer that is chosen from the given answers. You always give the letter of your choice in your reply without any additional text, explanation or reasoning. Don't repeat yourself"
    );
    const elapsedSeconds =
      (result.completedAt.getTime() - result.startedAt.getTime()) / 1000;

    let response = result.response.trim();

    if (task.outputPrefix) {
      response = `${task.outputPrefix}${result.response}`;
    }
    if (task.outputSuffix) {
      response = `${result.response}${task.outputSuffix}`;
    }

    providerLogger.debug(`Result of prompt ${promptIdentifier}: ${response}`);
    providerLogger.info(
      `Prompt ${promptIdentifier} is completed in ${readableTime(
        elapsedSeconds
      )}`
    );

    const promptCID = (await generateCID(input)).toString();
    const responseCID = (await generateCID(response)).toString();
    const promptResponse: PromptResponse = {
      modelDID: `did:pb:${model}`,
      validatorDID: config.VALIDATOR_DID,
      providerDID: provider.did,

      evaluationRunId,

      correctResponse,
      promptCID,
      responseCID,

      promptData: input,
      responseData: response,

      promptedAt: result.startedAt.getTime(),
      repliedAt: result.completedAt.getTime(),

      evaluationDID: `did:eval:${task.name}`,
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
