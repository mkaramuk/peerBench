import {
  DbPrompt,
  DbPromptSet,
  promptSetsTable,
  promptsTable,
  userAnswersTable,
  promptFeedbacksTable,
  testResultsTable,
} from "@/database/schema";
import { db } from "../database/client";
import { Prompt, PromptType } from "@peerbench/sdk";
import {
  and,
  count,
  eq,
  getTableColumns,
  sql,
  desc,
  asc,
  inArray,
  isNotNull,
  or,
  ilike,
} from "drizzle-orm";
import { FeedbackFlag } from "@/types/feedback";

export interface PeerAggregation {
  modelId: string;
  runs: number[];
  statistics: {
    avgScore: number;
    stdDev: number;
  };
}

export class PromptService {
  /**
   * Retrieves a list of prompts that match with the given filters.
   */
  static async getPrompts(
    options: {
      promptSetId?: number;
      search?: string;
      type?: PromptType | PromptType[];
      page?: number;
      pageSize?: number;
      orderBy?: "createdAt" | "question";
      orderDirection?: "asc" | "desc";
    } = {}
  ) {
    let query = db.select().from(promptsTable).$dynamic();

    // Apply filters
    if (options.promptSetId) {
      query = query.where(eq(promptsTable.promptSetId, options.promptSetId));
    }

    if (options.search) {
      query = query.where(
        or(
          ilike(promptsTable.question, `%${options.search}%`),
          ilike(promptsTable.answer, `%${options.search}%`)
        )
      );
    }

    if (options.type) {
      query = query.where(
        inArray(
          promptsTable.type,
          Array.isArray(options.type) ? options.type : [options.type]
        )
      );
    }

    // Apply sorting
    if (options.orderBy) {
      const orderColumn =
        options.orderBy === "createdAt"
          ? promptsTable.createdAt
          : promptsTable.question;

      query = query.orderBy(
        options.orderDirection === "desc" ? desc(orderColumn) : asc(orderColumn)
      );
    } else {
      // Default sorting by createdAt desc
      query = query.orderBy(desc(promptsTable.createdAt));
    }

    // Apply pagination
    if (options.pageSize) {
      query = query.limit(options.pageSize);
    }

    if (options.page && options.pageSize) {
      query = query.offset((options.page - 1) * options.pageSize);
    }

    return await query;
  }
}

export class PromptSetService {
  /**
   * Retrieves all prompt sets that match with the given filters.
   */
  static async getPromptSets(filters?: {
    ownerId?: string;
  }): Promise<PromptSet[]> {
    let query = db
      .select({
        ...getTableColumns(promptSetsTable),
        questionCount: count(promptsTable.id),
        totalAnswers: count(userAnswersTable.id),
        firstPromptId: sql<string>`(
          SELECT id FROM ${promptsTable}
          WHERE ${promptsTable.promptSetId} = ${promptSetsTable.id}
          ORDER BY ${promptsTable.createdAt} ASC
          LIMIT 1
        )`.as("firstPromptId"),
      })
      .from(promptSetsTable)
      .leftJoin(promptsTable, eq(promptSetsTable.id, promptsTable.promptSetId))
      .leftJoin(
        userAnswersTable,
        eq(promptsTable.id, userAnswersTable.promptId)
      )
      .groupBy(promptSetsTable.id)
      .$dynamic();

    if (filters?.ownerId) {
      query = query.where(eq(promptSetsTable.ownerId, filters.ownerId));
    }

    return await query;
  }

  /**
   * Gets a prompt set with all its prompts for benchmarking
   */
  static async getPromptSetForBenchmark(promptSetId: number): Promise<{
    prompts: Prompt[];
    fileName: string;
  }> {
    const [promptSet] = await db
      .select()
      .from(promptSetsTable)
      .where(eq(promptSetsTable.id, promptSetId));

    if (!promptSet) {
      throw new Error("Prompt set not found");
    }

    const prompts = await db
      .select()
      .from(promptsTable)
      .where(eq(promptsTable.promptSetId, promptSetId));

    return {
      prompts: prompts.map((p) => ({
        did: p.id,
        question: {
          data: p.question,
          cid: p.cid,
          sha256: p.sha256,
        },
        type: p.type,
        fullPrompt: {
          data: p.fullPrompt,
          cid: p.fullPromptCID,
          sha256: p.fullPromptSHA256,
        },
        answer: p.answer,
        answerKey: p.answerKey,
        options: p.options,
        metadata: p.metadata || {},
      })),
      fileName: promptSet.title,
    };
  }

  /**
   * Returns all prompt IDs that belong to the given prompt set ID.
   */
  static async getPromptIds(promptSetId: number): Promise<string[]> {
    const ids = await db
      .select({ id: promptsTable.id })
      .from(promptsTable)
      .where(eq(promptsTable.promptSetId, promptSetId));

    return ids.map((id) => id.id);
  }

  /**
   * Returns a single prompt record by its ID.
   */
  static async getPrompt(promptId: string) {
    const [prompt] = await db
      .select()
      .from(promptsTable)
      .where(eq(promptsTable.id, promptId));

    return prompt;
  }

  /**
   * Saves a user's answer for a specific prompt.
   * @param data The answer data including promptId, userId, and selectedOption
   * @param isCorrectHandler Optional function to determine if the answer is correct
   * @returns The created answer record
   */
  static async saveUserAnswer(
    data: {
      promptId: string;
      userId: string;
      selectedOption: string;
    },
    isCorrectHandler?: (prompt: DbPrompt, selectedOption: string) => boolean
  ) {
    return await db.transaction(async (tx) => {
      // First get the prompt to check if the answer is correct
      const [prompt] = await tx
        .select()
        .from(promptsTable)
        .where(eq(promptsTable.id, data.promptId));

      if (!prompt) {
        throw new Error("Prompt not found");
      }

      const isCorrect = isCorrectHandler
        ? isCorrectHandler(prompt, data.selectedOption)
        : prompt.answerKey === data.selectedOption;

      const [answer] = await tx
        .insert(userAnswersTable)
        .values({
          promptId: data.promptId,
          userId: data.userId,
          selectedOption: data.selectedOption,
          isCorrect,
          createdAt: new Date(),
        })
        .returning();

      return answer;
    });
  }

  /**
   * Saves user feedback for a specific prompt.
   * @param data The feedback data including promptId, userId, feedback text, and flag
   * @returns The created feedback record
   */
  static async savePromptFeedback(data: {
    promptId: string;
    userId: string;
    feedback: string;
    flag: FeedbackFlag;
  }) {
    return await db.transaction(async (tx) => {
      const [feedback] = await tx
        .insert(promptFeedbacksTable)
        .values({
          promptId: data.promptId,
          userId: data.userId,
          feedback: data.feedback,
          flag: data.flag,
          createdAt: new Date(),
        })
        .returning();

      return feedback;
    });
  }

  /**
   * Get analytics data for all prompt sets
   */
  static async getAnalytics(): Promise<PromptSetAnalytics> {
    return await db.transaction(async (tx) => {
      // Total prompt sets
      const [{ count: totalPromptSets }] = await tx
        .select({ count: count() })
        .from(promptSetsTable);

      // Total prompts
      const [{ count: totalPrompts }] = await tx
        .select({ count: count() })
        .from(promptsTable);

      // Total answers
      const [{ count: totalAnswers }] = await tx
        .select({ count: count() })
        .from(userAnswersTable);

      // Average accuracy
      const [{ avg: averageAccuracy }] = await tx
        .select({
          avg: sql<number>`AVG(CASE WHEN ${userAnswersTable.isCorrect} THEN 1 ELSE 0 END)`,
        })
        .from(userAnswersTable);

      // Prompt sets by date
      const promptSetsByDate = await tx
        .select({
          date: sql<string>`DATE(${promptSetsTable.createdAt})`,
          count: count(),
        })
        .from(promptSetsTable)
        .groupBy(sql`DATE(${promptSetsTable.createdAt})`)
        .orderBy(asc(sql`DATE(${promptSetsTable.createdAt})`));

      // Top prompt sets
      const topPromptSets = await tx
        .select({
          id: promptSetsTable.id,
          title: promptSetsTable.title,
          promptCount: count(promptsTable.id),
          answerCount: count(userAnswersTable.id),
          accuracy: sql<number>`AVG(CASE WHEN ${userAnswersTable.isCorrect} THEN 1 ELSE 0 END)`,
        })
        .from(promptSetsTable)
        .leftJoin(
          promptsTable,
          eq(promptSetsTable.id, promptsTable.promptSetId)
        )
        .leftJoin(
          userAnswersTable,
          eq(promptsTable.id, userAnswersTable.promptId)
        )
        .groupBy(promptSetsTable.id, promptSetsTable.title)
        .orderBy(desc(sql`count(${userAnswersTable.id})`))
        .limit(5);

      // Answer distribution by prompt set
      const answerDistribution = await tx
        .select({
          promptSetId: promptSetsTable.id,
          title: promptSetsTable.title,
          promptCount: count(promptsTable.id),
          totalAnswers: count(userAnswersTable.id),
          correctAnswers: sql<number>`SUM(CASE WHEN ${userAnswersTable.isCorrect} THEN 1 ELSE 0 END)`,
        })
        .from(promptSetsTable)
        .leftJoin(
          promptsTable,
          eq(promptSetsTable.id, promptsTable.promptSetId)
        )
        .leftJoin(
          userAnswersTable,
          eq(promptsTable.id, userAnswersTable.promptId)
        )
        .groupBy(promptSetsTable.id, promptSetsTable.title)
        .orderBy(desc(sql`count(${userAnswersTable.id})`))
        .limit(10)
        .then((res) =>
          res.map((r) => ({
            ...r,
            accuracy:
              r.totalAnswers > 0 ? r.correctAnswers / r.totalAnswers : 0,
          }))
        );

      // Feedback statistics
      const feedbackStats = await tx
        .select({
          flag: promptFeedbacksTable.flag,
          count: count(),
        })
        .from(promptFeedbacksTable)
        .groupBy(promptFeedbacksTable.flag)
        .then((res) =>
          res.map((r) => ({
            ...r,
            flag: r.flag as FeedbackFlag,
          }))
        );

      return {
        totalPromptSets,
        totalPrompts,
        totalAnswers,
        averageAccuracy: averageAccuracy || 0,
        promptSetsByDate,
        topPromptSets,
        answerDistribution,
        feedbackStats,
      };
    });
  }

  static async getPromptSetFeedback(
    promptSetIds: number[]
  ): Promise<PromptSetFeedback[]> {
    return await db
      .select({
        question: promptsTable.question,
        promptSetTitle: promptSetsTable.title,
        feedback: promptFeedbacksTable.feedback,
        flag: promptFeedbacksTable.flag,
        createdAt: promptFeedbacksTable.createdAt,
      })
      .from(promptsTable)
      .innerJoin(
        promptFeedbacksTable,
        eq(promptsTable.id, promptFeedbacksTable.promptId)
      )
      .innerJoin(
        promptSetsTable,
        eq(promptsTable.promptSetId, promptSetsTable.id)
      )
      .where(inArray(promptsTable.promptSetId, promptSetIds))
      .orderBy(desc(promptFeedbacksTable.createdAt))
      .groupBy(
        promptFeedbacksTable.id,
        promptsTable.question,
        promptSetsTable.title
      );
  }

  /**
   * Gets peer aggregations for a specific prompt set to compare with new benchmark results.
   * @param promptSetId The ID of the prompt set to get scores for
   * @returns Array of scores grouped by model
   */
  static async getPeerAggregations(
    promptSetId: number
  ): Promise<PeerAggregation[]> {
    return await db.transaction(async (tx) => {
      // Get all scores for the specified prompts
      const results = await tx
        .select({
          avgScore: sql<number>`avg(${testResultsTable.score})`,

          // Model ID will be there since we exclude Forest AI results
          // So use sql`` for type cast
          modelId: sql<string>`${testResultsTable.modelId}`,
        })
        .from(testResultsTable)
        .innerJoin(promptsTable, eq(testResultsTable.promptId, promptsTable.id))
        .where(
          and(
            eq(promptsTable.promptSetId, promptSetId),

            // Exclude the scores from Forest AI
            isNotNull(testResultsTable.promptId)
          )
        )
        .groupBy(testResultsTable.evaluationId, testResultsTable.modelId);

      return this.computePeerAggregations(results);
    });
  }

  private static computePeerAggregations(
    scores: { avgScore: number; modelId: string }[]
  ) {
    // Group scores by model
    const modelScores = scores.reduce(
      (acc, score) => {
        if (!acc[score.modelId]) {
          acc[score.modelId] = [];
        }
        if (score.avgScore !== null) {
          acc[score.modelId].push(score.avgScore);
        }
        return acc;
      },
      {} as Record<string, number[]> // modelId -> scores
    );

    // Calculate statistics for each model
    const aggregations = Object.entries(modelScores).map(
      ([modelId, scores]) => {
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const stdDev = Math.sqrt(
          scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) /
            scores.length
        );

        const result = {
          modelId,
          runs: scores,
          statistics: {
            avgScore,
            stdDev,
          },
        };

        return result;
      }
    );

    return aggregations;
  }
}

export interface PromptSetFeedback {
  question: string;
  promptSetTitle: string;
  feedback: string | null;
  flag: string | null;
  createdAt: Date | null;
}

export type PromptSet = DbPromptSet & {
  firstPromptId: string;
  totalAnswers: number;
  questionCount: number;
};

export interface PromptSetAnalytics {
  totalPromptSets: number;
  totalPrompts: number;
  totalAnswers: number;
  averageAccuracy: number;
  promptSetsByDate: {
    date: string;
    count: number;
  }[];
  topPromptSets: {
    id: number;
    title: string;
    promptCount: number;
    answerCount: number;
    accuracy: number;
  }[];
  answerDistribution: {
    promptSetId: number;
    title: string;
    totalAnswers: number;
    correctAnswers: number;
    accuracy: number;
    promptCount: number;
  }[];
  feedbackStats: {
    flag: FeedbackFlag;
    count: number;
  }[];
}
