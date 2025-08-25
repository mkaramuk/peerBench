import { NextRequest, NextResponse } from "next/server";
import {
  BaseLLMProvider,
  calculateCID,
  calculateSHA256,
  NearAIProvider,
  OpenRouterProvider,
  PromptTypes,
} from "@peerbench/sdk";
import { trpScorer, TRPScoreStrategy } from "../scorers/trp";
import { db } from "@/database/client";
import {
  DbPrompt,
  filesTable,
  promptsTable,
  testResultsTable,
} from "@/database/schema";
import { and, eq, getTableColumns, isNull, not } from "drizzle-orm";
import { sroScorer, SROScoreStrategy } from "../scorers/sro";
import { v7 as uuidv7 } from "uuid";
import {
  BenchmarkScore,
  EvaluationFile,
  EvaluationService,
} from "@/services/evaluation.service";
import { EvaluationSource } from "@/types/evaluation-source";
import { PromptSetService } from "@/services/promptset.service";
import { typScorer, TYPScoreStrategy } from "../scorers/typ";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  // Dummy user that uploads the scores
  const peerBenchAdminId = "c9439eab-d850-46bd-8ae1-211216395732";
  const nearai = new NearAIProvider({
    apiKey: process.env.NEARAI_API_KEY!,
  });
  const openrouter = new OpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY!,
  });
  const models = [
    {
      id: "fireworks::accounts/fireworks/models/llama4-maverick-instruct-basic",
      provider: nearai,
    },
    {
      id: "fireworks::accounts/fireworks/models/deepseek-v3",
      provider: nearai,
    },
    {
      id: "fireworks::accounts/fireworks/models/llama4-scout-instruct-basic",
      provider: nearai,
    },
    {
      id: "fireworks::accounts/fireworks/models/llama-v3p3-70b-instruct",
      provider: nearai,
    },
    {
      id: "google/gemini-2.0-flash-001",
      provider: openrouter,
    },
    {
      id: "meta-llama/llama-4-maverick",
      provider: openrouter,
    },
    {
      id: "meta-llama/llama-4-scout",
      provider: openrouter,
    },
    {
      id: "deepseek/deepseek-chat-v3-0324",
      provider: openrouter,
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct",
      provider: openrouter,
    },
    {
      id: "x-ai/grok-3",
      provider: openrouter,
    },
  ];

  const promptSet = await PromptSetService.getPromptSet({
    title: "PubMed",
  });

  if (!promptSet) {
    return NextResponse.json(
      { error: "Prompt set not found" },
      { status: 404 }
    );
  }

  // Retrieve all the prompts that haven't been scored yet
  const prompts = await db
    .select({
      ...getTableColumns(promptsTable),
      score: testResultsTable.score,
      fileName: filesTable.name,
      fileCID: filesTable.cid,
      fileSHA256: filesTable.sha256,
    })
    .from(promptsTable)
    .leftJoin(testResultsTable, eq(promptsTable.id, testResultsTable.promptId))
    .innerJoin(filesTable, eq(promptsTable.fileId, filesTable.id))
    .where(
      and(
        // Only the prompts from the PubMed prompt set
        eq(promptsTable.promptSetId, promptSet.id),

        // Only the ones that are not multiple choice
        not(eq(promptsTable.type, PromptTypes.MultipleChoice)),

        // Only the ones that hasn't been scored yet
        isNull(testResultsTable.id)
      )
    )
    .limit(30); // Use 30 prompts per call (evaluation)

  let savedScores = 0;
  let processedPrompts = 0;
  let runId = uuidv7();
  let scores: BenchmarkScore[] = [];

  for (const prompt of prompts) {
    await Promise.all(
      models.map(async (model) => {
        console.log(
          "Sending prompt",
          prompt.id,
          "to",
          model.provider.name,
          "model",
          model.id
        );

        const modelInfo = await model.provider.parseModelInfo(model.id);
        if (!modelInfo) {
          console.log("Model info couldn't be parsed from", model.id);
          return;
        }

        try {
          const result = await forwardPrompt(prompt, model.id, model.provider);

          for (const score of result.scores) {
            scores.push({
              score: score.value,
              data: result.response,
              cid: (await calculateCID(result.response)).toString(),
              sha256: await calculateSHA256(result.response),
              runId,
              startedAt: result.startedAt.getTime(),
              finishedAt: result.completedAt.getTime(),
              sourceTaskFile: {
                cid: prompt.fileCID,
                sha256: prompt.fileSHA256,
                fileName: prompt.fileName || "unknown",
              },

              modelHost: modelInfo.host || "auto",
              modelId: model.id,
              modelName: modelInfo.name,
              modelOwner: modelInfo.owner,
              taskId: "multiple-choice", // NOTE: Currently this one doesn't mean anything

              metadata: {
                scoreStrategy: score.strategy,
              },

              prompt: { did: prompt.id },
              provider: model.provider.name,
            });
          }
        } catch (error) {
          console.error("Error forwarding prompt", error);
        }
      })
    );
    processedPrompts++;

    // Save scores every 100 prompts
    if (processedPrompts % 100 === 0) {
      console.log("Saving scores");
      savedScores += await saveScores(
        scores,
        promptSet.id,
        peerBenchAdminId,
        runId
      );
      scores = [];
      runId = uuidv7();
    }
  }

  // Save the remaining scores
  if (scores.length > 0) {
    console.log("Saving scores");
    savedScores += await saveScores(
      scores,
      promptSet.id,
      peerBenchAdminId,
      runId
    );
  }

  return NextResponse.json({
    savedScores,
  });
}

async function saveScores(
  scores: BenchmarkScore[],
  promptSetId: number,
  peerBenchAdminId: string,
  runId: string
) {
  const evaluationFile: EvaluationFile = {
    runId,
    scores,
    startedAt: Math.min(...scores.map((s) => s.startedAt)),
    finishedAt: Math.max(...scores.map((s) => s.finishedAt)),
    source: EvaluationSource.PeerBench,
    score: scores.reduce((acc, s) => acc + s.score, 0),
  };

  const result = await EvaluationService.savePeerBenchScores({
    evaluationFileContent: JSON.stringify(evaluationFile),
    evaluationFileName: `evaluation-${Date.now()}.json`,
    uploaderId: peerBenchAdminId,
    promptSet: {
      id: promptSetId,
    },
  });

  return result.count;
}

async function forwardPrompt(
  prompt: DbPrompt,
  model: string,
  provider: BaseLLMProvider
) {
  let system;

  switch (prompt.type) {
    case PromptTypes.OrderSentences:
      system = `Your task is ordering the given sentences (each line is a sentence) in a correct order. Your output must be formatted as the input but with the sentences in the correct order. Markdown formatting is forbidden.`;
      break;
    case PromptTypes.TextReplacement:
      system = `Your task is placing all the entities that are provided in the ENTITIES section to the input text in a correct order. Your output only and only includes the modified text, nothing else. It is forbidden to modify anything else from the input text. Markdown formatting is forbidden too.`;
      break;
    case PromptTypes.Typo:
      system = `Your task is to find all the typos in the given text. Your output must include the corrected text, nothing else.`;
      break;
    default:
      throw new Error(`Unknown prompt type: ${prompt.type}`);
  }

  const { response, startedAt, completedAt } = await provider.forward(
    prompt.fullPrompt,
    model,
    { system }
  );

  const scores = [];

  switch (prompt.type) {
    case PromptTypes.OrderSentences:
      const originalOrder = prompt.answer.split("\n");
      const responseOrder = response.split("\n");

      for (const strategy of Object.values(SROScoreStrategy)) {
        const score = await sroScorer({
          originalOrder,
          responseOrder,
          strategy,
        });

        console.log("SRO score with strategy", strategy, score);
        scores.push({ value: score, strategy });
      }
      break;
    case PromptTypes.TextReplacement:
      const originalText = prompt.answer;
      const responseText = response;

      for (const strategy of Object.values(TRPScoreStrategy)) {
        // TODO: Don't use AskToLLM for now
        if (strategy === TRPScoreStrategy.AskToLLM) {
          continue;
        }

        const score = await trpScorer({
          originalText,
          responseText,
          strategy,
        });

        console.log("TRP score with strategy", strategy, score);
        scores.push({ value: score, strategy });
      }
      break;
    case PromptTypes.Typo:
      const correctText = prompt.answer;
      const correctedText = response;

      for (const strategy of Object.values(TYPScoreStrategy)) {
        const score = await typScorer({
          originalText: correctText,
          responseText: correctedText,
          strategy,
        });

        console.log("TYP score with strategy", strategy, score);
        scores.push({ value: score, strategy });
      }
      break;
    default:
      throw new Error(`Unknown prompt type: ${prompt.type}`);
  }

  return {
    scores,
    response,
    startedAt,
    completedAt,
  };
}
