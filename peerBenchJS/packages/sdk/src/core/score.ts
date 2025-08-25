import { MaybePromise, PromptResponse, PromptScore } from "@/types";

/**
 * Scores the given responses and returns
 * @param responses
 * @param scorer If given, it will use this function to score the responses. Otherwise it uses the "multiple choice" approach to determine whether the response is correct or not.
 * @param includePrompt Whether to include the original prompt in the score object
 */
export async function score(
  responses: PromptResponse[],
  scorer?: (response: PromptResponse) => MaybePromise<number>,
  includePrompt: boolean = true
) {
  const scores: PromptScore[] = [];

  for (const response of responses) {
    let score = 0;
    // TODO: Maybe also check the CIDs to be sure everything is correct?

    // If the data is not present, that means the response was failed
    if (response.data === undefined) {
      scores.push(response);
      continue;
    }

    if (response.prompt === undefined) {
      throw new Error(`Undefined prompt found, please check the response data`);
    }

    // If the `scorer` function is presented, use it.
    if (scorer) {
      score = await scorer(response);
    } else {
      if (response.data === response.prompt.answerKey) {
        score = 1;
      } else {
        // Look for some patterns for the answer
        const answer = lookForAnswer(response.data, [
          {
            regex: /answer is\s+([A-Z])/gi,
            answerGroupIndex: 1,
          },
          {
            regex: /answer is\s+\**([A-Z])\**/gi,
            answerGroupIndex: 1,
          },
          {
            regex: /([A-Z]):.+/g,
            answerGroupIndex: 1,
          },
        ]);

        if (answer !== undefined && answer === response.prompt.answerKey) {
          score = 1;
        }
      }
    }

    scores.push({
      ...response,
      score,
      prompt: includePrompt ? response.prompt : undefined,
    });
  }

  return scores;
}

export function lookForAnswer(
  response: string,
  patterns: {
    regex: RegExp;
    answerGroupIndex: number;
  }[]
) {
  for (const pattern of patterns) {
    const matches = Array.from(response.matchAll(pattern.regex));
    const match = matches.at(-1); // Use the last match

    if (match) {
      return match[pattern.answerGroupIndex];
    }
  }
}
