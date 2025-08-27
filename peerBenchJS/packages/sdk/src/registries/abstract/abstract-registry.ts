import { MaybePromise, Prompt, PromptResponse, PromptScore } from "@/types";

/**
 * Abstract Registry class
 *
 * A Registry implementation is responsible from sending, receiving and doing
 * other operations with an external service such as a remote server.
 */
export abstract class AbstractRegistry {
  /**
   * Uploads the given prompts to the Registry
   * @returns the number of prompts uploaded
   */
  abstract uploadPrompts(prompts: Prompt[]): MaybePromise<number>;

  /**
   * Uploads the given responses to the Registry
   * @returns the number of responses uploaded
   */
  abstract uploadResponses(responses: PromptResponse[]): MaybePromise<number>;

  /**
   * Uploads the given scores to the Registry
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
