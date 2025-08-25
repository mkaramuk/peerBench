import {
  DbTestResultInsert,
  testResultsTable,
  evaluationsTable,
  filesTable,
  promptsTable,
  promptSetsTable,
} from "@/database/schema";
import { db } from "@/database/client";
import {
  eq,
  desc,
  and,
  gte,
  lte,
  count,
  getTableColumns,
  sql,
  isNotNull,
  isNull,
  or,
  not,
  gt,
} from "drizzle-orm";
import {
  calculateCID,
  calculateSHA256,
  ModelInfo,
  NearAIProvider,
  OpenRouterProvider,
  PromptScoreSchema,
  removeDIDPrefix,
} from "@peerbench/sdk";
import { EvaluationSchema } from "@/validation/evaluation";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { EvaluationSource } from "@/types/evaluation-source";
import { FileType } from "@/types/file-type";
import { TestResult } from "@/validation/test-result";
import { PromptSetService } from "./promptset.service";

const GENERIC_LLM_PROTOCOL_ADDRESS =
  "0x263dE5ea24867C3aCFdd6D578d8f11b70Ca81756".toLowerCase();
const MEDQA_PROTOCOL_ADDRESS =
  "0xFf24e1259450D84727FB401C8fc036ce80Ac4721".toLowerCase();

// Provider to parse model info from model id
// Currently those protocols only support openrouter.ai
// Add more provider to parse model id if needed
const providers = [
  new OpenRouterProvider({ apiKey: "" }),
  new NearAIProvider({ apiKey: "" }),
];

/**
 * Service for managing validation results.
 */
export class EvaluationService {
  /**
   * Saves ForestAI validation results to the database.
   */
  static async saveForestAIEvaluations(params: {
    auditFiles: {
      commitHash?: string;
      content: string;
    }[];
    uploaderId: string;
  }) {
    return await db.transaction(async (tx) => {
      for (const file of params.auditFiles) {
        const fileCID = await calculateCID(file.content);
        const fileSHA256 = await calculateSHA256(file.content);
        const validation = z
          .array(EvaluationSchema)
          .safeParse(JSON.parse(file.content));

        if (!validation.success) {
          throw new Error(
            `Invalid validation result: ${validation.error.issues[0].path} ${validation.error.issues[0].message}`
          );
        }

        // Save the file to the database
        const [insertedFile] = await tx
          .insert(filesTable)
          .values({
            cid: fileCID.toString(),
            sha256: fileSHA256,
            content: file.content,
            uploaderId: params.uploaderId,
            type: FileType.Audit,
          })
          .returning({ id: filesTable.id });

        for (const evaluation of validation.data) {
          let promptSetId: number | undefined;
          const runId = uuidv7();

          // Try to find prompt set from the prompt
          // All of the test results have the same prompt set id
          // at least we assume that the validator implemented in that way.
          // So we can pick one of the test results.
          const promptId = evaluation.testResults[0]?.result?.promptId;

          // If the prompt id is found, that means this evaluation
          // comes from an LLM Protocol which uses peerBench prompt sets.
          if (promptId) {
            const [promptSet] = await tx
              .select({
                id: promptSetsTable.id,
              })
              .from(promptsTable)
              .innerJoin(
                promptSetsTable,
                eq(promptsTable.promptSetId, promptSetsTable.id)
              )
              .where(eq(promptsTable.id, promptId));

            if (promptSet) {
              promptSetId = promptSet.id;
            }
          }

          const [insertedEvaluation] = await tx
            .insert(evaluationsTable)
            .values({
              fileId: insertedFile.id,
              runId,
              source: EvaluationSource.ForestAI,
              commitHash: file.commitHash,
              finishedAt: evaluation.finishedAt,
              metadata: evaluation.metadata,
              score: evaluation.score,
              sessionId: evaluation.sessionId,
              validatorId: evaluation.validatorId,
              startedAt: evaluation.startedAt,

              agreementId: evaluation.agreementId,
              offerId: evaluation.offerId,
              providerId: evaluation.providerId,
              protocolAddress: evaluation.protocol?.address,
              protocolName: evaluation.protocol?.name,

              promptSetId,
            })
            .returning();

          for (const testResult of evaluation.testResults) {
            // Shared data for all Protocols
            const dbTestResult: DbTestResultInsert = {
              evaluationId: insertedEvaluation.id,
              startedAt: evaluation.startedAt,
              finishedAt: evaluation.finishedAt,
              score: testResult.isSuccess ? 1 : 0,
              provider: evaluation.providerName,
              raw: testResult.raw,
              testName: testResult.testName,
            };

            if (
              evaluation.protocol?.address.toLowerCase() ===
                GENERIC_LLM_PROTOCOL_ADDRESS ||
              evaluation.protocol?.address.toLowerCase() ===
                MEDQA_PROTOCOL_ADDRESS
            ) {
              // LLM Protocol specific data that can be expanded
              // to the DB columns
              dbTestResult.taskId = "multiple-choice";
              dbTestResult.modelId = testResult.result.modelId;
              dbTestResult.promptId = testResult.result.promptId;
              dbTestResult.response = testResult.result.response;

              if (!testResult.result.modelId || !testResult.result.response) {
                console.error(
                  "Test result didn't provide model id or response:",
                  JSON.stringify(testResult, null, 2)
                );
              }

              if (testResult.result.response) {
                const responseCID = await calculateCID(
                  testResult.result.response
                );
                const responseHash = await calculateSHA256(
                  testResult.result.response
                );
                dbTestResult.cid = responseCID.toString();
                dbTestResult.sha256 = responseHash;
              }

              // Try to parse model info with the providers
              let modelInfo: ModelInfo | undefined;
              let i = 0;
              while (
                testResult.result.modelId &&
                !modelInfo &&
                i < providers.length
              ) {
                modelInfo = await providers[i].parseModelInfo(
                  testResult.result.modelId
                );
                i++;
              }

              // If the model info is found then include the additional data there
              if (modelInfo) {
                dbTestResult.modelName = modelInfo.name;
                dbTestResult.modelHost = modelInfo.host;
                dbTestResult.modelOwner = modelInfo.owner;
              } else {
                // Otherwise just save the model id itself
                dbTestResult.modelName = testResult.result.modelId;
                dbTestResult.modelHost = testResult.result.modelId;
                dbTestResult.modelOwner = testResult.result.modelId;
                console.error("Unknown LLM model:", testResult.result.modelId);
              }
            } else {
              // If the protocol is not an LLM Protocol then we can save the result as is
              dbTestResult.result = testResult.result;
            }

            // Save the test result to the database
            await tx.insert(testResultsTable).values(dbTestResult);
          }
        }
      }
    });
  }

  static async savePeerBenchScores(params: {
    evaluationFileContent: string;
    evaluationFileName: string;
    uploaderId: string;
    promptFileName?: string;
    promptFileContent?: string;
    promptSet?: {
      id?: number;
      title?: string;
      description?: string;
    };
  }) {
    return await db.transaction(async (tx) => {
      let promptSetId = params.promptSet?.id;

      // Create a prompt set if id is not given
      if (!params.promptSet?.id) {
        if (!params.promptSet?.title || !params.promptSet?.description) {
          throw new Error(
            "Prompt set title and description are required when creating a new prompt set"
          );
        }

        const [promptSet] = await tx
          .insert(promptSetsTable)
          .values({
            ownerId: params.uploaderId,
            title: params.promptSet!.title!,
            description: params.promptSet!.description!,
          })
          .returning();
        promptSetId = promptSet.id;
      }

      if (params.promptFileContent) {
        if (!promptSetId) {
          throw new Error(
            "Prompt set id is required when adding prompts to a prompt set"
          );
        }

        await PromptSetService.addPromptsToPromptSet(
          {
            promptSetId,
            fileContent: params.promptFileContent,
            fileName: params.promptFileName,
            uploaderId: params.uploaderId,
          },
          {
            // Use the same transaction for adding prompts to the prompt set
            tx,
          }
        );
      }

      // Parse score file content
      const evaluationFileObject = JSON.parse(params.evaluationFileContent);
      const validation = EvaluationFileSchema.safeParse(evaluationFileObject);

      if (!validation.success) {
        throw new Error(
          `Invalid evaluation file content: ${validation.error.issues[0].path} ${validation.error.issues[0].message}`
        );
      }

      const fileCID = (
        await calculateCID(params.evaluationFileContent)
      ).toString();
      const fileSHA256 = await calculateSHA256(params.evaluationFileContent);

      const [file] = await tx
        .insert(filesTable)
        .values({
          cid: fileCID,
          sha256: fileSHA256,
          format: "json",
          type: FileType.Evaluation,
          name: params.evaluationFileName,
          content: params.evaluationFileContent,
          uploaderId: params.uploaderId,
        })
        .onConflictDoUpdate({
          target: [filesTable.cid],
          set: {
            cid: fileCID,
          },
        })
        .returning({ id: filesTable.id });

      const [evaluation] = await tx
        .insert(evaluationsTable)
        .values({
          fileId: file.id,
          runId: validation.data.runId,
          source: EvaluationSource.PeerBench,
          finishedAt: new Date(validation.data.finishedAt),
          score: validation.data.score,
          startedAt: new Date(validation.data.startedAt),
          promptSetId,
        })
        .returning({ id: evaluationsTable.id });

      // Save scores
      await tx.insert(testResultsTable).values(
        validation.data.scores.map<DbTestResultInsert>((score) => ({
          score: score.score,
          evaluationId: evaluation.id,
          provider: score.provider,
          startedAt: new Date(score.startedAt),
          finishedAt: score.finishedAt ? new Date(score.finishedAt) : null,

          modelName: score.modelName,
          modelHost: score.modelHost,
          modelOwner: score.modelOwner,
          modelId: score.modelId,
          taskId: score.taskId,
          response: score.data,
          cid: score.cid,
          sha256: score.sha256,
          promptId: removeDIDPrefix(score.prompt!.did),
          metadata: score.metadata,
        }))
      );

      return {
        evaluationId: evaluation.id,
        count: validation.data.scores.length,
      };
    });
  }

  static async getEvaluations(filters?: {
    id?: number;
    commitHash?: string;
    cid?: string;
  }) {
    const conditions = [];

    const query = db
      .select({
        ...getTableColumns(evaluationsTable),
        uploaderId: filesTable.uploaderId,
        promptSetName: promptSetsTable.title,
        testResults: sql<TestResult[]>`
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'isSuccess', (
                  CASE WHEN ${gt(testResultsTable.score, 0)}
                    THEN TRUE
                    ELSE FALSE
                  END
                ),
                'raw', ${testResultsTable.raw},
                'testName', (
                  CASE
                    WHEN ${isNotNull(testResultsTable.testName)} THEN ${testResultsTable.testName}
                    ELSE 'PeerBench Benchmark'
                  END
                ),
                'result', (
                  CASE
                    WHEN ${isNull(evaluationsTable.promptSetId)} THEN ${testResultsTable.result}
                    ELSE jsonb_build_object(
                      'promptId', ${testResultsTable.promptId},

                      -- Because of the test type, answerKey may not be available
                      'correctAnswer', (
                        CASE WHEN ${and(
                          not(eq(promptsTable.answerKey, "")),
                          isNotNull(promptsTable.answerKey)
                        )}
                          THEN ${promptsTable.answerKey}
                          ELSE ${promptsTable.answer}
                        END
                      ),
                      'prompt', ${promptsTable.fullPrompt},
                      'modelId', ${testResultsTable.modelId},
                      'response', ${testResultsTable.response},
                      -- TODO: Completely remove taskId from the db schema
                      -- 'taskId', ${testResultsTable.taskId},
                      'modelName', ${testResultsTable.modelName},
                      'modelHost', ${testResultsTable.modelHost},
                      'modelOwner', ${testResultsTable.modelOwner},
                      'provider', ${testResultsTable.provider},
                      'startedAt', ${testResultsTable.startedAt},
                      'finishedAt', ${testResultsTable.finishedAt},
                      'source', ${evaluationsTable.source},

                      -- Combine metadata from test result and prompt
                      'metadata', ${testResultsTable.metadata} || ${promptsTable.metadata},
                      'score', ${testResultsTable.score},
                      'type', ${promptsTable.type}
                    )
                  END
                )
              )
            ),
            '[]'::jsonb
          )
       `,
      })
      .from(evaluationsTable)
      .innerJoin(filesTable, eq(evaluationsTable.fileId, filesTable.id))
      .leftJoin(
        promptSetsTable,
        eq(evaluationsTable.promptSetId, promptSetsTable.id)
      )
      .leftJoin(
        testResultsTable,
        eq(evaluationsTable.id, testResultsTable.evaluationId)
      )
      .leftJoin(promptsTable, eq(testResultsTable.promptId, promptsTable.id))
      .groupBy(
        evaluationsTable.id,
        filesTable.id,
        filesTable.uploaderId,
        promptSetsTable.title
      )
      .$dynamic();

    if (filters?.commitHash) {
      conditions.push(eq(evaluationsTable.commitHash, filters.commitHash));
    }

    if (filters?.cid) {
      conditions.push(eq(filesTable.cid, filters.cid));
    }

    if (filters?.id) {
      conditions.push(eq(evaluationsTable.id, filters.id));
    }

    return await query.where(and(...conditions));
  }

  static async getEvaluationsListFilterValues(options?: { model?: string }) {
    const { model } = options || {};
    const conditions = [];

    let query = db
      .select({
        promptSetTitle: promptSetsTable.title,
        promptSetId: evaluationsTable.promptSetId,
        provider: testResultsTable.provider,
        protocolName: sql<string | null>`
          CASE
            WHEN ${isNull(evaluationsTable.promptSetId)}
            THEN ${evaluationsTable.protocolName}
            ELSE NULL
          END
        `,
        protocolAddress: sql<string | null>`
          CASE
            WHEN ${isNull(evaluationsTable.promptSetId)}
            THEN ${evaluationsTable.protocolAddress}
            ELSE NULL
          END
        `,
      })
      .from(testResultsTable)
      .innerJoin(
        evaluationsTable,
        eq(testResultsTable.evaluationId, evaluationsTable.id)
      )
      .leftJoin(
        promptSetsTable,
        eq(evaluationsTable.promptSetId, promptSetsTable.id)
      )
      .groupBy(
        promptSetsTable.title,
        evaluationsTable.protocolName,
        evaluationsTable.promptSetId,
        evaluationsTable.protocolAddress,
        testResultsTable.provider
      )
      .$dynamic();

    if (model) {
      conditions.push(
        or(
          eq(testResultsTable.modelName, model),
          eq(testResultsTable.provider, model)
        )
      );
    }

    query = query.where(and(...conditions));

    const results = await query;
    const promptSets: Record<number, string> = {};
    const protocols: Record<string, string> = {};
    const providers = new Set<string>();

    for (const result of results) {
      if (result.promptSetId && result.promptSetTitle) {
        promptSets[result.promptSetId] = result.promptSetTitle;
      }
      if (result.protocolAddress && result.protocolName) {
        protocols[result.protocolAddress] = result.protocolName;
      }

      providers.add(result.provider);
    }

    return {
      providers: Array.from(providers),
      promptSets: Object.entries(promptSets).map(([id, title]) => ({
        id: parseInt(id),
        title,
      })),
      protocols: Object.entries(protocols).map(([address, name]) => ({
        address,
        name,
      })),
    };
  }

  static async getEvaluationsList(
    options: {
      page?: number;
      pageSize?: number;
      minScore?: number;
      maxScore?: number;
      model?: string;
      provider?: string;
      promptSetId?: number;
      protocolAddress?: string;
      protocolName?: string;
      uploaderId?: string;
      providerId?: number;
      offerId?: number;
    } = {}
  ) {
    const {
      page = 1,
      pageSize = 10,
      minScore,
      maxScore,
      model,
      promptSetId,
      protocolAddress,
      protocolName,
      uploaderId,
      providerId,
      offerId,
      provider,
    } = options;
    const offset = (page - 1) * pageSize;
    const conditions = [];

    let query = db
      .select({
        id: evaluationsTable.id,
        score: evaluationsTable.score,
        fileId: evaluationsTable.fileId,
        fileCID: filesTable.cid,
        source: evaluationsTable.source,
        startedAt: evaluationsTable.startedAt,
        finishedAt: evaluationsTable.finishedAt,
        protocolName: evaluationsTable.protocolName,
        providerId: evaluationsTable.providerId,
        promptSetId: evaluationsTable.promptSetId,
        promptSetTitle: promptSetsTable.title,
        uploaderId: filesTable.uploaderId,
        uploadedAt: filesTable.createdAt,
        providers: sql<string[]>`
          jsonb_agg(DISTINCT ${testResultsTable.provider})
        `,
      })
      .from(evaluationsTable)
      .innerJoin(filesTable, eq(evaluationsTable.fileId, filesTable.id))
      .leftJoin(
        testResultsTable,
        eq(evaluationsTable.id, testResultsTable.evaluationId)
      )
      .leftJoin(
        promptSetsTable,
        eq(evaluationsTable.promptSetId, promptSetsTable.id)
      )
      .orderBy(desc(evaluationsTable.startedAt))
      .limit(pageSize)
      .offset(offset)
      .groupBy(
        evaluationsTable.id,
        filesTable.id,
        filesTable.cid,
        promptSetsTable.title
      )
      .$dynamic();

    let totalCountQuery = db
      .select({
        count: count(sql`DISTINCT ${evaluationsTable.id}`),
      })
      .from(evaluationsTable)
      .$dynamic();

    if (minScore !== undefined) {
      conditions.push(gte(evaluationsTable.score, minScore));
    }
    if (maxScore !== undefined) {
      conditions.push(lte(evaluationsTable.score, maxScore));
    }
    if (promptSetId !== undefined || model !== undefined) {
      totalCountQuery = totalCountQuery.leftJoin(
        testResultsTable,
        eq(testResultsTable.evaluationId, evaluationsTable.id)
      );

      if (promptSetId !== undefined) {
        conditions.push(eq(evaluationsTable.promptSetId, promptSetId));
      }
      if (model !== undefined) {
        conditions.push(
          or(
            eq(testResultsTable.modelName, model),
            eq(testResultsTable.provider, model)
          )
        );
      }
      if (provider !== undefined) {
        conditions.push(eq(testResultsTable.provider, provider));
      }
    }
    if (uploaderId !== undefined) {
      conditions.push(eq(filesTable.uploaderId, uploaderId));
    }
    if (providerId !== undefined) {
      conditions.push(eq(evaluationsTable.providerId, providerId));
    }
    if (offerId !== undefined) {
      conditions.push(eq(evaluationsTable.offerId, offerId));
    }
    if (protocolAddress !== undefined) {
      conditions.push(
        eq(
          sql`LOWER(${evaluationsTable.protocolAddress})`,
          protocolAddress.toLowerCase()
        )
      );
    }
    if (protocolName !== undefined) {
      conditions.push(eq(evaluationsTable.protocolName, protocolName));
    }

    query = query.where(and(...conditions));
    totalCountQuery = totalCountQuery.where(and(...conditions));

    const results = await query;
    const totalCount = (await totalCountQuery)[0].count;

    return {
      results,
      total: totalCount,
    };
  }
}

export type EvaluationData = Awaited<
  ReturnType<(typeof EvaluationService)["getEvaluations"]>
>[number];

export type EvaluationListItem = Awaited<
  ReturnType<(typeof EvaluationService)["getEvaluationsList"]>
>["results"][number];

export type SavePeerBenchResultsParams = Parameters<
  (typeof EvaluationService)["savePeerBenchScores"]
>[0];

export const BenchmarkScoreSchema = PromptScoreSchema.extend({
  score: z.number(),
  data: z.string(),
  cid: z.string(),
  sha256: z.string(),
  finishedAt: z.number(),
  prompt: z.object({
    did: z.string(),
  }),
});

/**
 * Evaluation file generated by the peerBench benchmark
 */
export const EvaluationFileSchema = z.object({
  runId: z.string(),
  source: z.nativeEnum(EvaluationSource),
  startedAt: z.number(),
  finishedAt: z.number(),
  score: z.number(),
  scores: z.array(BenchmarkScoreSchema),
});

export type EvaluationFile = z.infer<typeof EvaluationFileSchema>;

export type BenchmarkScore = z.infer<typeof BenchmarkScoreSchema>;
