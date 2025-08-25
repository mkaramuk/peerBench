/**
 * NOTE: Newer version of prompt.service.ts file
 */

import { db } from "@/database/client";
import { count, eq, getTableColumns, sql } from "drizzle-orm";
import {
  userAnswersTable,
  promptsTable,
  promptSetsTable,
  filesTable,
  DbPromptInsert,
  DbPromptSet,
} from "@/database/schema";
import { readTaskFromContent, removeDIDPrefix } from "@peerbench/sdk";
import { FileType } from "@/types/file-type";
import { Transaction } from "@/types/db";

export class PromptSetService {
  static async addPromptsToPromptSet(
    params: {
      promptSetId: number;
      fileName?: string;
      fileContent: string;
      uploaderId: string;
    },
    options?: {
      tx?: Transaction;
    }
  ): Promise<number> {
    const transaction = async (tx: Transaction) => {
      const { task } = await readTaskFromContent(
        params.fileContent,
        params.fileName
      );

      // Save file as it is
      const [file] = await tx
        .insert(filesTable)
        .values({
          name: params.fileName,
          content: params.fileContent,
          cid: task.cid,
          sha256: task.sha256,
          type: FileType.Prompt,
          uploaderId: params.uploaderId,

          // TODO: Get the file type from readTaskFromContent
          format: "json",
        })
        .onConflictDoUpdate({
          // This is a hacky solution, normally we don't
          // need to update something, but we want to return
          // the row that's why we are using onConflictDoUpdate
          target: [filesTable.cid],
          set: {
            cid: task.cid,
          },
        })
        .returning();

      // Save the extracted prompts from the file
      const prompts = await tx
        .insert(promptsTable)
        .values(
          task.prompts.map<DbPromptInsert>((prompt) => ({
            id: removeDIDPrefix(prompt.did),
            question: prompt.question.data,
            sha256: prompt.question.sha256,
            cid: prompt.question.cid,
            fileId: file.id,

            answerKey: prompt.answerKey,
            options: prompt.options,
            type: prompt.type,

            fullPrompt: prompt.fullPrompt.data,
            fullPromptCID: prompt.fullPrompt.cid,
            fullPromptSHA256: prompt.fullPrompt.sha256,
            answer: prompt.answer || "",

            promptSetId: params.promptSetId,
            metadata: prompt.metadata || {},
          }))
        )
        .onConflictDoNothing() // Ignore if the prompt already exists
        .returning();

      // Return the number of prompts saved
      return prompts.length;
    };

    if (options?.tx) {
      return await transaction(options.tx);
    }

    return await db.transaction(async (tx) => transaction(tx));
  }

  static async createNewPromptSet(
    data: {
      title: string;
      description: string;
      ownerId: string;
    },
    options: {
      /**
       * If provided, the function will use the provided database
       * transaction instead of creating a new one.
       */
      tx?: Transaction;

      /**
       * If true, the function will throw an error when the prompt set already exists.
       * @default false
       */
      throwIfExists?: boolean;
    } = {}
  ) {
    const { throwIfExists = false } = options;

    let query = (options.tx || db)
      .insert(promptSetsTable)
      .values({
        title: data.title,
        description: data.description,
        ownerId: data.ownerId,
      })
      .$dynamic();

    if (!throwIfExists) {
      query = query.onConflictDoUpdate({
        target: [promptSetsTable.title],
        set: {
          description: data.description,
          ownerId: data.ownerId,
          updatedAt: new Date(),
        },
      });
    }

    const [promptSet] = await query.returning();

    return promptSet;
  }

  static async getPromptSet(options: {
    id?: number;
    title?: string;
  }): Promise<DbPromptSet | undefined> {
    let query = db.select().from(promptSetsTable).$dynamic();

    if (options.id) {
      query = query.where(eq(promptSetsTable.id, options.id));
    }

    if (options.title) {
      query = query.where(eq(promptSetsTable.title, options.title));
    }

    const [promptSet] = await query;

    return promptSet;
  }

  /**
   * Retrieves the list of available prompt sets.
   */
  static async getPromptSetList(options: {
    ownerId?: string;
    page?: number;
    pageSize?: number;
  }) {
    let query = this.promptSetListSelectQuery;

    if (options.ownerId) {
      query = query.where(eq(promptSetsTable.ownerId, options.ownerId));
    }

    if (options.pageSize) {
      query = query.limit(options.pageSize);
    }

    if (options.page && options.pageSize) {
      query = query.offset((options.page - 1) * options.pageSize);
    }

    return await query;
  }

  /**
   * Retrieves the information about all prompt sets.
   */
  static async getAllPromptSetsInfo() {
    const [promptSet] = await db
      .select({
        promptSetCount: count(promptSetsTable),
      })
      .from(promptSetsTable);

    return promptSet;
  }

  /**
   * Retrieves the information about a specific prompt set.
   */
  static async getPromptSetInfo(promptSetId: number) {
    const [promptSet] = await db
      .select({
        promptCount: count(promptsTable),
      })
      .from(promptSetsTable)
      .leftJoin(promptsTable, eq(promptSetsTable.id, promptsTable.promptSetId))
      .where(eq(promptSetsTable.id, promptSetId));

    return promptSet;
  }

  private static get promptSetListSelectQuery() {
    return db
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
  }
}
