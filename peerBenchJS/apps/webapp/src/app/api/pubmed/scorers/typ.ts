import { levenshteinDistance } from "../functions/llm";

export async function typScorer(params: {
  originalText: string;
  responseText: string;
  strategy: TYPScoreStrategy;
}) {
  switch (params.strategy) {
    case TYPScoreStrategy.LevenshteinDistance:
      return (
        1 -
        levenshteinDistance(params.originalText, params.responseText) /
          Math.max(params.originalText.length, params.responseText.length)
      );
    case TYPScoreStrategy.PerWordEquality:
      const originalWords = params.originalText.split(" ");
      const responseWords = params.responseText.split(" ");

      let score = 0;
      for (let i = 0; i < originalWords.length; i++) {
        if (originalWords[i] === responseWords[i]) {
          score++;
        }
      }

      return score / originalWords.length;
  }
}

export const TYPScoreStrategy = {
  LevenshteinDistance: "levenshtein-distance",
  PerWordEquality: "per-word-equality",
} as const;
export type TYPScoreStrategy =
  (typeof TYPScoreStrategy)[keyof typeof TYPScoreStrategy];
