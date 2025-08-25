import { levenshteinDistance } from "../functions/llm";

export function sroScorer(params: {
  originalOrder: string[];
  responseOrder: string[];
  strategy: SROScoreStrategyType;
}) {
  switch (params.strategy) {
    case SROScoreStrategy.LevenshteinDistance:
      const originalText = params.originalOrder.join(" ");
      const responseText = params.responseOrder.join(" ");
      return (
        1 -
        levenshteinDistance(originalText, responseText) /
          Math.max(originalText.length, responseText.length)
      );
    case SROScoreStrategy.CorrectOrder:
      return correctOrder(params.originalOrder, params.responseOrder);
  }
}

function correctOrder(originalOrder: string[], responseOrder: string[]) {
  let score = 0;
  for (let i = 0; i < originalOrder.length; i++) {
    const original = originalOrder[i];
    const response = responseOrder[i];

    if (original === response) {
      score += 1;
    }
  }

  return score / originalOrder.length;
}

export const SROScoreStrategy = {
  LevenshteinDistance: "levenshtein-distance",
  CorrectOrder: "correct-order",
} as const;
export type SROScoreStrategyType =
  (typeof SROScoreStrategy)[keyof typeof SROScoreStrategy];
