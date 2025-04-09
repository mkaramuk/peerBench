import { PromptScore } from "@/types";
import { parseModelDID, parseProviderDID, tryParseJson } from "./parser";
import { readableTime, readFile } from "./utils";
import { logger } from "./logger";
import { blue, cyan, green, magenta, yellow } from "ansis";
import { table as formatTable } from "table";

export async function aggregate(
  scoreFilePaths: string[],
  sortType: AggregationSortType
) {
  const scores = scoreFilePaths
    .map((path) => {
      try {
        const content = readFile(path);
        // TODO: Also validate the data with a Zod schema
        return tryParseJson<PromptScore[]>(content);
      } catch (err) {
        logger.warning(`Score file ${path} couldn't read: ${err}`);
      }
    })
    .filter((s) => s !== undefined)
    .flat();

  const results: Record<
    string,
    { score: number; latency: number; response: number }
  > = {};

  for (const score of scores) {
    const providerName = parseProviderDID(score.providerDID);
    const model = parseModelDID(score.modelDID);
    const key = `${providerName}:${model}`;

    if (!results[key]) {
      results[key] = { score: 0, latency: 0, response: 0 };
    }

    results[key].score += score.score;
    results[key].latency += score.repliedAt - score.promptedAt;
    results[key].response++;
  }

  const data: any[] = [];

  for (const [providerAndModel, values] of Object.entries(results)) {
    data.push([
      providerAndModel,
      values.response,
      values.score,
      readableTime(values.latency / values.response / 1000),
      (values.score / values.response).toFixed(2),
    ]);
  }

  switch (sortType) {
    case AggregationSortTypes.TotalResponses:
      data.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
      break;
    case AggregationSortTypes.TotalScore:
      data.sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));
      break;
    case AggregationSortTypes.AverageLatency:
      data.sort((a, b) => parseFloat(a[3]) - parseFloat(b[3]));
      break;
    case AggregationSortTypes.AverageScore:
      data.sort((a, b) => parseFloat(b[4]) - parseFloat(a[4]));
      break;
  }

  console.log(
    formatTable(
      [
        [
          "Rank",
          "Provider:Model",
          "Total Responses",
          "Total Score",
          "Avg. Latency",
          "Avg. Score",
        ],
        ...data.map((row, i) => [
          cyan.bold(i + 1),
          magenta.bold(row[0]),
          green.bold(row[1]),
          yellow.bold(row[2]),
          blue.bold(row[3]),
          yellow(row[4]),
        ]),
      ],
      {
        border: {
          topBody: `─`,
          topJoin: `┬`,
          topLeft: `╭`,
          topRight: `╮`,

          bottomBody: `─`,
          bottomJoin: `┴`,
          bottomLeft: `╰`,
          bottomRight: `╯`,

          bodyLeft: `│`,
          bodyRight: `│`,
          bodyJoin: `│`,

          joinBody: `─`,
          joinLeft: `├`,
          joinRight: `┤`,
          joinJoin: `┼`,
        },
      }
    )
  );
}

export const AggregationSortTypes = {
  TotalScore: "TotalScore",
  TotalResponses: "TotalResponses",
  AverageScore: "AverageScore",
  AverageLatency: "AverageLatency",
} as const;

export type AggregationSortType =
  (typeof AggregationSortTypes)[keyof typeof AggregationSortTypes];
