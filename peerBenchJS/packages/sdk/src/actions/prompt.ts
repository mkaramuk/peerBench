import { BaseLLMProvider } from "@/providers/llm/base-llm-provider";
import { MaybePromise, Prompt, PromptResponse, Task } from "@/types";
import { calculateCID } from "@/utils/cid";
import { preparePrompt } from "@/utils/prompt";
import { calculateSHA256 } from "@/utils/sha256";
import { v7 as uuidv7 } from "uuid";
import { ForwardError } from "@/errors/provider";
import { removeDIDPrefix } from "@/utils/did";

// TODO: Add support for Providers other than LLMs

/**
 * Sends the prompts from the given task files to the given Providers and
 * collects the responses.
 * @param identifiers Provider and model identifiers. Should be in `providerName:modelOwner/modelName` format
 * @param taskPaths Path of the task files in the local file system
 */
export async function prompt(params: {
  /**
   * Tasks to be executed
   */
  tasks: Task[];

  /**
   * Provider and model pairs that is going to be used to execute the tasks
   */
  providerAndModels: { modelId: string; provider: BaseLLMProvider }[];

  /**
   * Passed as system prompt to the LLM if presented. Otherwise uses the default one.
   */
  systemPrompt?: string;

  /**
   * Callback that is triggered when a prompt is sent to the provider
   */
  onPromptSending?: OnPromptSendingCallback;

  /**
   * Callback that is triggered when an error occurs while prompting the task
   */
  onPromptError?: OnPromptErrorCallback;

  /**
   * Callback that is triggered when a prompt is received from the provider
   */
  onPromptResponse?: OnPromptResponseCallback;

  /**
   * Signal to abort the execution
   */
  abortSignal?: AbortSignal;

  /**
   * Run ID to be used for the execution. Generated if not provided.
   */
  runId?: string;
}) {
  const promises: Promise<any>[] = [];
  const runId = params.runId ?? uuidv7();

  for (const task of params.tasks) {
    for (const providerAndModel of params.providerAndModels) {
      if (params.abortSignal?.aborted) {
        return;
      }

      promises.push(
        promptTask({
          task,
          provider: providerAndModel.provider,
          modelId: providerAndModel.modelId,
          runId,
          systemPrompt: params.systemPrompt,
          onPromptSending: params.onPromptSending,
          onPromptError: params.onPromptError,
          onPromptResponse: params.onPromptResponse,
          abortSignal: params.abortSignal,
        })
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Executes one task on one Provider and Model
 * @param params
 * @param callback
 * @param errorCallback
 */
async function promptTask(params: {
  task: Task;
  provider: BaseLLMProvider;
  modelId: string;
  runId: string;
  systemPrompt?: string;
  onPromptSending?: OnPromptSendingCallback;
  onPromptError?: OnPromptErrorCallback;
  onPromptResponse?: OnPromptResponseCallback;
  abortSignal?: AbortSignal;
}) {
  const promises: Promise<any>[] = [];
  for (const prompt of params.task.prompts) {
    if (params.abortSignal?.aborted) {
      return;
    }

    const input = preparePrompt(prompt.question.data, prompt.options);

    // Trigger the callback
    params.onPromptSending?.(prompt, {
      runId: params.runId,
      provider: params.provider,
      modelId: params.modelId,

      // Task field is only for metadata so no need to pass all of the prompts
      task: { ...params.task, prompts: [] },
    });

    // Send the prompt to the provider
    promises.push(
      params.provider
        .forward(input, {
          model: params.modelId,
          system: params.systemPrompt,
          abortSignal: params.abortSignal,
        })
        .then(async (res) => {
          // Trigger the callback
          if (res) {
            const modelInfo = await params.provider.parseModelInfo(
              params.modelId
            );
            const cid = (await calculateCID(res.data)).toString();
            const sha256 = await calculateSHA256(res.data);

            params.onPromptResponse?.(
              {
                cid,
                data: res.data,
                sha256,

                modelId: params.modelId,
                provider:
                  modelInfo?.provider ||
                  params.provider.identifier.toLowerCase(),
                taskId: removeDIDPrefix(params.task.did),
                modelName: modelInfo?.name || "unknown",
                modelOwner: modelInfo?.owner || "unknown",
                modelHost: modelInfo?.host || "auto",
                prompt,
                startedAt: res.startedAt.getTime(),
                finishedAt: res.completedAt.getTime(),
                runId: params.runId,
                sourceTaskFile: {
                  cid: params.task.cid,
                  fileName: params.task.fileName,
                  sha256: params.task.sha256,
                },
              },
              {
                modelId: params.modelId,
                runId: params.runId,
                task: { ...params.task, prompts: [] },
                provider: params.provider,
              }
            );
          }
        })
        .catch(async (err: ForwardError) => {
          const modelInfo = await params.provider.parseModelInfo(
            params.modelId
          );
          params.onPromptError?.(err, {
            prompt,
            failedResponse: {
              modelId: params.modelId,
              provider:
                modelInfo?.provider || params.provider.identifier.toLowerCase(),
              taskId: params.task.did,
              modelName: modelInfo?.name || "unknown",
              modelOwner: modelInfo?.owner || "unknown",
              modelHost: modelInfo?.host || "auto",
              prompt,
              startedAt: err.startedAt.getTime(),
              runId: params.runId,
              sourceTaskFile: {
                cid: params.task.cid,
                fileName: params.task.fileName,
                sha256: params.task.sha256,
              },
            },
            modelId: params.modelId,
            provider: params.provider,
            runId: params.runId,
            task: { ...params.task, prompts: [] },
          });
        })
    );
  }

  await Promise.all(promises);
}

export type OnPromptResponseCallback = (
  response: PromptResponse,
  details: {
    runId: string;
    provider: BaseLLMProvider;
    modelId: string;
    task: Task;
  }
) => MaybePromise<void>;

export type OnPromptErrorCallback = (
  err: any,
  details: {
    runId: string;
    provider: BaseLLMProvider;
    modelId: string;
    task: Task;
    prompt: Prompt;
    failedResponse: PromptResponse;
  }
) => MaybePromise<void>;

export type OnPromptSendingCallback = (
  prompt: Prompt,
  details: {
    runId: string;
    provider: BaseLLMProvider;
    modelId: string;
    task: Task;
  }
) => void;
