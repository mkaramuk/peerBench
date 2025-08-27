import { AbstractScorer } from "@/scorers/abstract/abstract-scorer";
import { PromptResponse, PromptScore } from "@/types";

/**
 * Scores the given responses using the given scorer.
 *
 * @param scorer The scorer to use to score the responses.
 */
export async function score(
  responses: PromptResponse[],
  scorer: AbstractScorer,
  options: {
    /**
     * Whether include the prompt data in the output score objects
     * @default true
     */
    includeData?: boolean;
  } = { includeData: true }
) {
  const scores: PromptScore[] = [];

  for (const response of responses) {
    // TODO: Maybe also check the CIDs to be sure everything is correct?

    if (response.data === undefined) {
      throw new Error(`Response data not found, please check the input`);
    }

    if (response.prompt === undefined) {
      throw new Error(`Prompt data not found, please check the input`);
    }

    if (!(await scorer.canScore(response))) {
      throw new Error(
        `Scorer "${scorer.identifier}" cannot score the response of prompt ${response.prompt.did} (${response.prompt.type})`
      );
    }

    scores.push({
      ...response,
      score: await scorer.scoreOne(response),
      prompt: options.includeData ? response.prompt : undefined,
    });
  }

  return scores;
}
