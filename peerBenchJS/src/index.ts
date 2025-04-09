import { red, yellow } from "ansis";
import { prompt } from "./core/prompt";
import { logger } from "./core/logger";
import { config } from "./config";
import { join } from "path";
import { writeFileSync } from "fs";
import * as csv from "csv";
import { score } from "./core/score";
import { PromptResponse, PromptScore } from "./types";
import { hashFile, signFile } from "./core/utils";
import { aggregate } from "./core/aggregate";

logger.info(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);

const taskFiles = [
  "./data/tasks/mmlu-pro_test.onlyHistory.jsonl",
  "./data/tasks/fever.json",
  "./data/tasks/social_iqa.json",
];

async function main() {
  const responses = await prompt(
    [
      // Identifier format: <provider name>:<model owner>/<model name>
      "openrouter.ai:google/gemini-2.0-flash-lite-001",
      "openrouter.ai:meta-llama/llama-4-scout",
      "openrouter.ai:meta-llama/llama-4-maverick",
    ],
    taskFiles,
    3 // Max prompt that is going to be used from the given task files
  );

  logger.info("Saving responses...");
  const { jsonPath: responsesJsonPath } = await saveArray(
    responses,
    "responses"
  );
  const scores = await score([responsesJsonPath]);
  const scoresNoData = scores.map<PromptScore>((score) => ({
    ...score,
    promptData: undefined,
    responseData: undefined,
    correctResponse: undefined,
  }));

  logger.info("Saving scores...");

  const timestamp = Date.now();
  await saveArray(scoresNoData, "scores.nodata", timestamp);
  const { jsonPath: scoresJsonPath } = await saveArray(
    scores,
    "scores",
    timestamp
  );

  await aggregate([scoresJsonPath], "AverageScore");
}

async function saveArray(
  arr: PromptResponse[] | PromptScore[],
  fileNamePrefix: string,
  timestamp?: number
) {
  const jsonPath = join(
    config.OUTPUT_DIR,
    `${fileNamePrefix}-${timestamp || Date.now()}.json`
  );
  const csvPath = join(
    config.OUTPUT_DIR,
    `${fileNamePrefix}-${timestamp || Date.now()}.csv`
  );

  const csvData = await new Promise<string>((res, rej) => {
    csv.stringify(arr, { quoted_string: true, header: true }, (err, out) => {
      if (err) {
        return rej(err);
      }
      res(out);
    });
  });

  writeFileSync(csvPath, csvData, { encoding: "utf-8" });
  writeFileSync(jsonPath, JSON.stringify(arr, null, 2), {
    encoding: "utf-8",
  });

  await signFile(jsonPath);
  await hashFile(jsonPath);

  await signFile(csvPath);
  await hashFile(csvPath);

  logger.info(`JSON output saved at ${jsonPath}`);
  logger.info(`CSV output saved at ${csvPath}`);

  return {
    jsonPath,
    csvPath,
  };
}

main().catch((err) => logger.error(red(err.message)));
