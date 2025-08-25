import { BaseLLMProvider } from "@peerbench/sdk";
import { levenshteinDistance } from "../functions/llm";
import natural from "natural";
import { pipeline } from "@huggingface/transformers";

export async function trpScorer(params: {
  originalText: string;
  responseText: string;
  strategy: TRPScoreStrategyType;
  provider?: BaseLLMProvider;
  model?: string;
  systemPrompt?: string;
}) {
  switch (params.strategy) {
    case TRPScoreStrategy.LevenshteinDistance:
      return (
        1 -
        levenshteinDistance(params.originalText, params.responseText) /
          Math.max(params.originalText.length, params.responseText.length)
      );
    case TRPScoreStrategy.PerSentenceEquality:
      return perSentenceEquality(params.originalText, params.responseText);
    case TRPScoreStrategy.AskToLLM:
      if (!params.provider || !params.model) {
        throw new Error(
          "Provider and model are required for AskToLLM strategy"
        );
      }

      const { response } = await params.provider.forward(
        `ORIGINAL: ${params.originalText}\n------------\nNEW: ${params.responseText}`,
        params.model,
        {
          system:
            params.systemPrompt ||
            `Your task is giving a quality score between 0 and 100 to the NEW text about how much close it to the ORIGINAL one in terms of the meaning. Your output must be only and only the score as a valid number, nothing else.`,
        }
      );

      // Parse number from response with regex
      const score = response.match(/(\d+)/)?.[0];

      return score ? parseFloat(score) : 0;
    case TRPScoreStrategy.CosineSimilarity:
      return cosineSimilarity(params.originalText, params.responseText);
  }
}

async function cosineSimilarity(originalText: string, responseText: string) {
  const embed = await pipeline(
    "feature-extraction",
    "sentence-transformers/all-MiniLM-L6-v2"
  );

  const originalEmbeddings = await embed(originalText, {
    pooling: "mean",
    normalize: true,
  });

  const responseEmbeddings = await embed(responseText, {
    pooling: "mean",
    normalize: true,
  });

  // Calculate cosine similarity
  function cs(a: number[], b: number[]) {
    // Since normalized, just dot product suffices
    return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  }

  const similarity = cs(
    originalEmbeddings.data as number[],
    responseEmbeddings.data as number[]
  );

  return similarity;
}

function perSentenceEquality(originalText: string, responseText: string) {
  const tokenizer = new natural.SentenceTokenizer([]);
  const originalSentences = tokenizer.tokenize(originalText);
  const responseSentences = tokenizer.tokenize(responseText);

  let score = 0;
  for (let i = 0; i < originalSentences.length; i++) {
    const originalSentence = originalSentences[i];
    const responseSentence = responseSentences[i];

    if (originalSentence === responseSentence) {
      score += 1;
    }
  }

  return score / originalSentences.length;
}

export const TRPScoreStrategy = {
  LevenshteinDistance: "levenshtein-distance",
  PerSentenceEquality: "per-sentence-equality",
  AskToLLM: "ask-to-llm",
  CosineSimilarity: "cosine-similarity",
} as const;
export type TRPScoreStrategyType =
  (typeof TRPScoreStrategy)[keyof typeof TRPScoreStrategy];
