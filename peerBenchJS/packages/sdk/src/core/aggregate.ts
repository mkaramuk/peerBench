import { PromptScore } from "../types";

/**
 * The result of the aggregation of the scores for a single model.
 */
export type AggregatedResult = {
  provider: string;
  modelId: string;
  modelName: string;
  modelOwner: string;
  modelHost: string;
  totalResponses: number;
  totalLatency: number;
  avgLatency: number;
  score: number;
  avgScore: number;
  missingAnswers: number;
  wrongAnswers: number;
  runIds: string[];
  taskFiles: Record<string, string>;
};

/**
 * The result of the aggregation of the scores.
 */
export type AggregationResult = {
  results: AggregatedResult[];
  runIds: string[];
  taskFiles: Record<string, string>;
};

export type AggregationOptions = {
  /**
   * TODO: Add more options when we have
   */
};

/**
 * Aggregates the given scores and generates a result to interpret the
 * performance of a model.
 *
 * @param scores - The scores to aggregate.
 * @returns The aggregated results.
 */
export async function aggregate(
  scores: PromptScore[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: AggregationOptions
): Promise<AggregationResult> {
  const runIds = new Set<string>();
  const taskFiles: Record<string, string> = {};
  const modelResults: Record<string, AggregatedResult> = {};

  for (const score of scores) {
    const key = `${score.provider}:${score.modelId}`;

    if (!modelResults[key]) {
      modelResults[key] = {
        provider: score.provider,
        modelId: score.modelId,
        modelName: score.modelName,
        modelOwner: score.modelOwner,
        modelHost: score.modelHost,
        score: 0,
        totalLatency: 0,
        wrongAnswers: 0,
        missingAnswers: 0,
        totalResponses: 0,
        avgLatency: 0,
        avgScore: 0,
        runIds: [],
        taskFiles: {},
      };
    }

    // Make sure each runId is unique for the model
    const modelRunIds = new Set<string>(modelResults[key].runIds);
    modelRunIds.add(score.runId);

    modelResults[key].runIds = Array.from(modelRunIds);
    if (score.score !== undefined && score.finishedAt !== undefined) {
      modelResults[key].score += score.score;
      modelResults[key].totalLatency += score.finishedAt - score.startedAt;
    } else {
      modelResults[key].missingAnswers++;
    }

    modelResults[key].totalResponses++;
    if (score.score === 0) {
      modelResults[key].wrongAnswers++;
    }

    // Add the task file to the model result
    modelResults[key].taskFiles[score.sourceTaskFile.cid] =
      score.sourceTaskFile.fileName;

    // Add the task file to the list that contains all task files
    taskFiles[score.sourceTaskFile.cid] = score.sourceTaskFile.fileName;

    if (score.runId) {
      runIds.add(score.runId);
    }
  }

  const results: AggregatedResult[] = [];
  for (const [, values] of Object.entries(modelResults)) {
    results.push({
      ...values,
      avgLatency: values.totalLatency / values.totalResponses,
      avgScore: values.score / values.totalResponses,
    });
  }

  // Sort results by score (descending), then by average score (ascending),
  // then by average latency (ascending), then by total responses (descending)
  results.sort((a, b) => {
    const order = [
      [b.score, a.score],
      [a.avgScore, b.avgScore],
      [a.avgLatency, b.avgLatency],
      [b.totalResponses, a.totalResponses],
    ];

    for (const values of order) {
      if (values[0] !== values[1]) {
        return values[0] - values[1];
      }
    }

    const lastOrderColumn = order[order.length - 1];
    return lastOrderColumn[0] - lastOrderColumn[1];
  });

  return {
    results,
    runIds: Array.from(runIds),
    taskFiles,
  };
}
