import { PromptResponse, MaybePromise } from "@/types";

/**
 * Abstract base class for scorers
 */
export abstract class AbstractScorer {
  /**
   * Unique identifier for the scorer
   */
  abstract readonly identifier: string;

  /**
   * Score a single response
   * @param response The response to score
   * @param options Additional options for scoring
   * @returns A score between 0 and 1, or undefined if it fails
   */
  abstract scoreOne(
    response: PromptResponse,
    options?: Record<string, any>
  ): MaybePromise<number | undefined>;

  /**
   * Checks whether the scorer is eligible to score the given response
   */
  abstract canScore(response: PromptResponse): MaybePromise<boolean>;
}
