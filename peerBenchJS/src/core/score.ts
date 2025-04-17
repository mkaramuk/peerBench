import { MaybePromise, PromptResponse, PromptScore } from "@/types";
import { readFile } from "./utils";

export async function score(
  responseFilePaths: string[],
  scorer?: (response: PromptResponse) => MaybePromise<number>
) {
  const contents = responseFilePaths.map((path) => readFile(path));
  const promptResponses: PromptResponse[] = contents
    .map((content) =>
      // TODO: Ability to read CSV files
      JSON.parse(content)
    )
    .flat();
  // TODO: Validate the `promptResponses` schema via Zod

  const scores: PromptScore[] = [];

  for (const promptResponse of promptResponses) {
    let score = 0;
    // TODO: Maybe also check the CIDs to be sure everything is correct?

    // If the `scorer` function is presented, use it.
    if (scorer) {
      score = await scorer(promptResponse);
    } else {
      // TODO: Use different answer check approaches by using `promptResponse.evalType`
      if (promptResponse.responseData === promptResponse.correctResponse) {
        score = 1;
      } else {
        // Look for some patterns for the answer
        const answer = lookForAnswer(promptResponse.responseData, [
          {
            regex: /The (?:(best|final|correct) )?answer is ([A-Z])/i,
            answerGroupIndex: 2,
          },
          {
            regex: /([A-Z]):.+/,
            answerGroupIndex: 1,
          },
        ]);

        if (answer !== undefined && answer === promptResponse.correctResponse) {
          score = 1;
        }
      }
    }

    scores.push({
      ...promptResponse,
      score,
    });
  }

  return scores;
}

function lookForAnswer(
  response: string,
  patterns: {
    regex: RegExp;
    answerGroupIndex: number;
  }[]
) {
  for (const pattern of patterns) {
    const match = response.match(pattern.regex);
    if (match) {
      return match[pattern.answerGroupIndex];
    }
  }
}
