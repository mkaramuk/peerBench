import { MaybePromise, Prompt, PromptResponse, PromptScore } from "@/types";

/**
 * Abstract class for registry implementations. A registry is a service that
 * communicates with the remote server and uploads or fetches data from it
 */
export abstract class AbstractRegistry {
  /**
   * Uploads the given prompts to the registry
   * @returns the number of prompts uploaded
   */
  abstract uploadPrompts(prompts: Prompt[]): MaybePromise<number>;

  /**
   * Uploads the given responses to the registry
   * @returns the number of responses uploaded
   */
  abstract uploadResponses(responses: PromptResponse[]): MaybePromise<number>;

  /**
   * Uploads the given scores to the registry
   * @returns the number of scores uploaded
   */
  abstract uploadScores(
    scores: PromptScore[],
    options?: {
      /**
       * Whether to include the response and prompt data in the scores
       */
      includeData?: boolean;
    }
  ): MaybePromise<number>;
}
