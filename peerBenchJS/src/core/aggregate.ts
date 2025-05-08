import {
  AggregationResult as AggregationResults,
  PromptScoreSchema,
} from "@/types";
import { checkValidationError, readFile } from "./utils";
import { logger } from "./logger";
import { z } from "zod";

export async function aggregate(
  scoreFilePaths: string[]
): Promise<AggregationResults> {
  const scores = scoreFilePaths
    .map((path) => {
      try {
        // TODO: Make it possible to read CSV files
        const content = readFile(path);
        const arraySchema = z.array(PromptScoreSchema);
        const json = JSON.parse(content);

        return checkValidationError(arraySchema.safeParse(json));
      } catch (err) {
        logger.warning(`Score file ${path} couldn't read: ${err}`);
      }
    })
    .filter((s) => s !== undefined)
    .flat();

  if (scores.length === 0) {
    throw new Error(`No scores read to aggregate`);
  }

  // We assume that all of the scores come from the same task
  // otherwise they wouldn't be comparable so we can simply find
  // the taskDID by just looking at any of the score from the array.
  const taskDID = scores[0].taskDID;
  const results: Record<
    string,
    {
      score: number;
      latency: number;
      responseCount: number;
      wrongAnswers: number;
      modelDID: string;
      providerDID: string;
      runIds: Set<string>;
      sourcePromptDatasetCIDs: Set<string>;
      sourceFileNames: Set<string>;
    }
  > = {};

  const result: AggregationResults = [];

  for (const score of scores) {
    const key = `${score.providerDID}:${score.modelDID}`;

    if (!results[key]) {
      results[key] = {
        providerDID: score.providerDID,
        modelDID: score.modelDID,
        score: 0,
        latency: 0,
        responseCount: 0,
        wrongAnswers: 0,
        runIds: new Set<string>(),
        sourcePromptDatasetCIDs: new Set<string>(),
        sourceFileNames: new Set<string>(),
      };
    }

    results[key].score += score.score;
    results[key].latency += score.repliedAt - score.promptedAt;
    results[key].responseCount++;

    // Add runId to the set (this will handle duplicates automatically)
    if (score.runId) {
      results[key].runIds.add(score.runId);
    }

    // Add sourcePromptDatasetCID to the set
    if (score.sourcePromptDatasetCID) {
      results[key].sourcePromptDatasetCIDs.add(score.sourcePromptDatasetCID);
    }

    // Add sourceFileName to the set
    if (score.sourceFileName) {
      results[key].sourceFileNames.add(score.sourceFileName);
    }

    if (score.score === 0) {
      results[key].wrongAnswers++;
    }
  }

  for (const [, values] of Object.entries(results)) {
    result.push({
      providerDID: values.providerDID,
      modelDID: values.modelDID,
      taskDID,
      avgLatency: values.latency / values.responseCount / 1000,
      avgScore: parseFloat((values.score / values.responseCount).toFixed(2)),
      missingAnswers: Math.abs(
        values.responseCount - values.score - values.wrongAnswers
      ),
      score: values.score,
      totalResponse: values.responseCount,
      wrongAnswers: values.wrongAnswers,
      score_runIds: Array.from(values.runIds),
      sourcePromptDatasetCIDs: Array.from(values.sourcePromptDatasetCIDs),
      sourceFileNames: Array.from(values.sourceFileNames),
    });
  }

  result.sort((a, b) => {
    const order = [
      [b.score, a.score],
      [a.avgScore, b.avgScore],
      [a.avgLatency, b.avgLatency],
      [b.totalResponse, a.totalResponse],
    ];

    for (const values of order) {
      if (values[0] !== values[1]) {
        return values[0] - values[1];
      }
    }

    const lastOrderColumn = order[order.length - 1];
    return lastOrderColumn[0] - lastOrderColumn[1];
  });

  return result;
}
