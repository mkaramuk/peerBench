import { PromptScore } from "@/types";
import { parseModelDID, parseProviderDID, tryParseJson } from "./parser";
import { readableTime, readFile } from "./utils";
import { logger } from "./logger";
import { blue, cyan, green, magenta, red, yellow } from "ansis";
import { table as formatTable } from "table";

export async function aggregate(scoreFilePaths: string[], taskName: string) {
  const scores = scoreFilePaths
    .map((path) => {
      try {
        const content = readFile(path);
        // TODO: Also validate the data with a Zod schema
        // TODO: Make it possible to read CSV files
        return tryParseJson<PromptScore[]>(content);
      } catch (err) {
        logger.warning(`Score file ${path} couldn't read: ${err}`);
      }
    })
    .filter((s) => s !== undefined)
    .flat();

  const results: Record<
    string,
    { score: number; latency: number; response: number; wrongAnswers: number }
  > = {};

  for (const score of scores) {
    const providerName = parseProviderDID(score.providerDID);
    const model = parseModelDID(score.modelDID);
    const key = `${providerName}:${model}`;

    if (!results[key]) {
      results[key] = { score: 0, latency: 0, response: 0, wrongAnswers: 0 };
    }

    results[key].score += score.score;
    results[key].latency += score.repliedAt - score.promptedAt;
    results[key].response++;

    if (score.score === 0) {
      results[key].wrongAnswers++;
    }
  }

  const data: any[] = [];

  for (const [providerAndModel, values] of Object.entries(results)) {
    data.push([
      providerAndModel,
      values.response,
      values.score,
      values.wrongAnswers,
      readableTime(values.latency / values.response / 1000),
      (values.score / values.response).toFixed(2),
    ]);
  }

  data.sort((a, b) => {
    const aTotalResponse = parseFloat(a[1]);
    const bTotalResponse = parseFloat(b[1]);

    const aTotalScore = parseFloat(a[2]);
    const bTotalScore = parseFloat(b[2]);

    const aAverageLatency = parseFloat(a[4]);
    const bAverageLatency = parseFloat(b[4]);

    const aAverageScore = parseFloat(a[5]);
    const bAverageScore = parseFloat(b[5]);

    const order = [
      [bTotalScore, aTotalScore],
      [aAverageScore, bAverageScore],
      [aAverageLatency, bAverageLatency],
      [bTotalResponse, aTotalResponse],
    ];

    for (const values of order) {
      if (values[0] !== values[1]) {
        return values[0] - values[1];
      }
    }

    const lastOrderColumn = order[order.length - 1];
    return lastOrderColumn[0] - lastOrderColumn[1];
  });

  console.log("Task:", taskName);
  console.log(
    formatTable(
      [
        [
          "Rank",
          "Provider:Model",
          "Total Responses",
          "Total Score",
          "Wrong Answers",
          "Avg. Latency",
          "Avg. Score",
        ],
        ...data.map((row, i) => [
          cyan.bold(i + 1),
          magenta.bold(row[0]),
          green.bold(row[1]),
          yellow.bold(row[2]),
          red.bold(row[3]),
          blue.bold(row[4]),
          yellow(row[5]),
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

  return results;
}
