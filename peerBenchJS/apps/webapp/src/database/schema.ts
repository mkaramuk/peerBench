import { EvaluationSourceType } from "@/types/evaluation-source";
import { FileTypeType } from "@/types/file-type";
import { PromptOptions, PromptType } from "@peerbench/sdk";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  json,
  boolean,
  real,
  varchar,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

export const promptSetsTable = pgTable("prompt_sets", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  title: text().notNull().unique(),
  description: text().notNull(),
  ownerId: uuid("owner_id")
    .references(() => authUsers.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DbPromptSet = typeof promptSetsTable.$inferSelect;

export const promptsTable = pgTable("prompts", {
  id: uuid().primaryKey(),
  promptSetId: integer("prompt_set_id")
    .references(() => promptSetsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  fileId: integer("file_id")
    .references(() => filesTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),

  type: varchar({ length: 30 })
    .$type<PromptType>()
    .notNull()
    .default("multiple-choice"),

  question: text().notNull(),
  cid: text().notNull(),
  sha256: text().notNull(),

  options: json().$type<PromptOptions>().notNull(),
  answerKey: text("answer_key").notNull(),
  answer: text().notNull(),

  fullPrompt: text("full_prompt").notNull(),
  fullPromptCID: text("full_prompt_cid").notNull(),
  fullPromptSHA256: text("full_prompt_sha256").notNull(),

  metadata: jsonb().$type<any>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DbPrompt = typeof promptsTable.$inferSelect;
export type DbPromptInsert = typeof promptsTable.$inferInsert;

export const userAnswersTable = pgTable("user_answers", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: uuid("user_id")
    .references(() => authUsers.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  promptId: uuid("prompt_id")
    .references(() => promptsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promptFeedbacksTable = pgTable("prompt_feedbacks", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: uuid("user_id")
    .references(() => authUsers.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  promptId: uuid("prompt_id")
    .references(() => promptsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  feedback: text().notNull(),
  flag: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const filesTable = pgTable("files", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  cid: text().notNull().unique(),
  sha256: text().notNull(),
  content: text().notNull(),
  type: varchar({ length: 20 }).$type<FileTypeType>().notNull(),

  name: text(),
  uploaderId: uuid("uploader_id").references(() => authUsers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  format: text(),
  signature: text(),
  signedBy: uuid("signed_by").references(() => authUsers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DbFile = typeof filesTable.$inferSelect;
export type DbFileInsert = typeof filesTable.$inferInsert;

export const testResultsTable = pgTable("test_results", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),

  score: real("score"),
  evaluationId: bigint("evaluation_id", { mode: "number" })
    .references(() => evaluationsTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  provider: text("provider").notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  metadata: jsonb().$type<any>().default({}),

  // The following columns are filled out if
  // the test result is from ForestAI
  result: jsonb("result").$type<any>(),
  testName: text("test_name"),
  raw: text("raw"),

  // The following columns are filled out if
  // the test result is from peerBench or an LLM Protocol
  modelName: varchar("model_name", { length: 100 }),
  modelHost: text("model_host").default("auto"),
  modelOwner: text("model_owner"),
  modelId: text("model_id"),
  taskId: text("task_id"),
  response: text("response"),
  cid: text("cid"),
  sha256: text("sha256"),
  promptId: uuid("prompt_id").references(() => promptsTable.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DbTestResultInsert = typeof testResultsTable.$inferInsert;

export const evaluationsTable = pgTable("evaluations", {
  id: bigint({ mode: "number" })
    .primaryKey()
    .generatedByDefaultAsIdentity()
    .notNull(),
  source: varchar("source", { length: 20 })
    .$type<EvaluationSourceType>()
    .notNull(),
  runId: text("run_id").notNull(),
  score: real().notNull().default(0),
  metadata: jsonb().notNull().default({}),
  fileId: integer("file_id")
    .references(() => filesTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),

  // The following columns are filled out if
  // the evaluation is from ForestAI
  agreementId: integer("agreement_id"),
  offerId: integer("offer_id"),
  validatorId: integer("validator_id"),
  providerId: integer("provider_id"),
  commitHash: varchar("commit_hash", { length: 100 }),
  sessionId: varchar("session_id", { length: 15 }),
  protocolName: text("protocol_name"),
  protocolAddress: text("protocol_address"),

  // The following columns are filled out if
  // the evaluation is from peerBench or an LLM Protocol
  promptSetId: integer("prompt_set_id").references(() => promptSetsTable.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),

  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DbEvaluation = typeof evaluationsTable.$inferSelect;
export type DbEvaluationInsert = typeof evaluationsTable.$inferInsert;

export const rssArticlesTable = pgTable("rss_articles", {
  id: text("id").notNull().primaryKey(),
  content: jsonb("content").notNull(),
  isProcessed: boolean("is_processed").notNull().default(false),
  sourceURL: text("source_url").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DbRSSArticle = typeof rssArticlesTable.$inferSelect;
export type DbRSSArticleInsert = typeof rssArticlesTable.$inferInsert;
