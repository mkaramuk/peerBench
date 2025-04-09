import {
  EvaluationTypes,
  MaybePromise,
  PromptResponse,
  PromptScore,
} from "@/types";
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
    // If a scorer function is given, use it, otherwise check the "exact equality" between expected answer and response
    if (scorer) {
      score = await scorer(promptResponse);
    } else {
      // TODO: Maybe also check the CIDs to be sure everything is correct?
      if (promptResponse.responseData === promptResponse.correctResponse) {
        score = 1;
      }
    }

    scores.push({
      ...promptResponse,
      evaluationDID: EvaluationTypes.MultipleChoice, // TODO: Later use from the prompt response (so store it in there as well)
      score,
    });
  }

  return scores;
}
