import { readTask } from "./reader";
import { generateCID, readableTime, sleep } from "./utils";
import { config } from "@/config";
import { AbstractProvider } from "@/base/provider";
import { PromptResponse, Task } from "@/types";
import { v7 as uuidv7 } from "uuid";
import { parseIdentifier } from "./parser";
import { logger } from "./logger";

/**
 * Sends the prompts from the given task files to the given Providers and
 * collects the responses.
 */
export async function prompt(
  identifiers: string[],
  taskPaths: string[],
  maxPrompt?: number
): Promise<PromptResponse[]> {
  const responses: PromptResponse[] = [];
  let promises: Promise<PromptResponse[]>[] = [];

  if (maxPrompt) {
    logger.warning(
      `Only ${maxPrompt} prompt will be used from the given task files`
    );
  }

  for (const taskPath of taskPaths) {
    const task = await readTask(taskPath);
    const evaluationRunId = uuidv7(); // New evaluation ID per given task

    for (const identifier of identifiers) {
      const info = parseIdentifier(identifier);
      if (info === undefined) {
        continue;
      }

      if (maxPrompt) {
        task.prompts = task.prompts.slice(0, maxPrompt);
      }

      const { provider, model } = info;
      promises.push(execPrompts(provider, task, model, evaluationRunId));
    }

    responses.push(...(await Promise.all(promises)).flat());
    promises = [];
  }

  return responses;
}

async function execPrompts(
  provider: AbstractProvider,
  task: Task,
  model: string,
  evaluationRunId: string
) {
  const responses: PromptResponse[] = [];
  const providerLogger = provider.logger.child({
    context: `Provider(${provider.name}/${model})`,
  });

  for (let i = 0; i < task.prompts.length; i++) {
    const prompt = task.prompts[i];
    const promptIdentifier = `${i + 1} from "${task.name}"`;
    try {
      providerLogger.info(`Sending prompt ${promptIdentifier}...`);

      let input = prompt.input;
      let correctResponse = prompt.expectedAnswer || "";

      if (task.inputPrefix) {
        input = `${task.inputPrefix}${input}`;
      }
      if (task.inputSuffix) {
        input = `${input}${task.inputSuffix}`;
      }

      if (prompt.answers !== undefined) {
        const letters = "ABCDEFGHIJKL";
        let letterIndex = 0;
        input +=
          "\nOnly answer with the letter of one of the given choices, don't add additional text, character, reasoning or explanations, ONLY ONE LETTER with ONLY ONE ANSWER:\n";

        for (const [answer, score] of Object.entries(prompt.answers)) {
          const letter = letters[letterIndex];
          input += `${letter}: ${answer}\n`;

          if (score === 1) {
            correctResponse = letter;
          }

          letterIndex++;
        }
      }

      const result = await provider.forward(input, model);
      const elapsedSeconds =
        (result.completedAt.getTime() - result.startedAt.getTime()) / 1000;

      // Delete redundant characters and trim it
      let response = result.response.replace(".", "").replace(",", "").trim();

      if (task.outputPrefix) {
        response = `${task.outputPrefix}${result.response}`;
      }
      if (task.outputSuffix) {
        response = `${result.response}${task.outputSuffix}`;
      }

      providerLogger.debug(`Result of prompt ${promptIdentifier}: ${response}`);
      providerLogger.info(
        `Prompt ${promptIdentifier} completed in ${readableTime(
          elapsedSeconds
        )}`
      );

      const promptCID = (await generateCID(input)).toString();
      const responseCID = (await generateCID(response)).toString();

      responses.push({
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
      });
      await sleep(config.COOL_DOWN_INTERVAL);
    } catch (err) {
      providerLogger.error(`Error on prompt ${promptIdentifier}: ${err}`);
    }
  }
  return responses;
}
