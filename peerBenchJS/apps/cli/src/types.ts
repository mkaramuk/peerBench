import { z } from "zod";

export const NodeEnvs = ["dev", "production"] as const;
export type NodeEnv = (typeof NodeEnvs)[number];

export const LogLevels = ["error", "warning", "info", "debug"] as const;
export type LogLevel = (typeof LogLevels)[number];

export type MaybePromise<T> = T | Promise<T>;

export type PromptOptions = Record<string, string>;

export type ModelResponse = {
  startedAt: Date;
  completedAt: Date;
  response: string;
};

export const EvalTypes = {
  ExactEquality: "exact-equality",
  MultipleChoice: "multiple-choice",
} as const;
export type EvalType = (typeof EvalTypes)[keyof typeof EvalTypes];

export const PromptSchema = z.object({
  question: z.string(),
  options: z.record(z.string(), z.string()),
  answer_idx: z.string(),
  answer: z.string(),
  meta_info: z.string().optional(),
  // TODO: Rename `other` to `metadata`
  other: z
    .object({
      hash_full_question: z.string(),
      hash_first_sentence: z.string(),
      hash_first_question_sentence: z.string(),
      hash_last_sentence: z.string(),
      stdQuestionUUID: z.string(),
      stdFullPromptText: z.string(),
      stdFullPromptHash: z.string(),
      src_row_number: z.number(),
      preSTDsrcFileName: z.string(),
      preSTDsrcCID: z.string(),
    })
    .catchall(z.any()),
});

export type Prompt = z.infer<typeof PromptSchema>;

export const TaskSchema = z.object({
  did: z.string().startsWith("did:task:"),
  prompts: z.array(PromptSchema),
  cid: z.string(),
  fileName: z.string(),
  path: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const PromptResponseSchema = z.object({
  validatorDID: z.string().startsWith("did:val:"),
  providerDID: z.string().startsWith("did:prov:"),
  modelDID: z.string().startsWith("did:model:"),
  taskDID: z.string().startsWith("did:task:"),

  promptCID: z.string(),
  responseCID: z.string(),

  promptData: z.string(),
  responseData: z.string(),
  correctResponse: z.string(),

  promptedAt: z.number(),
  repliedAt: z.number(),

  runId: z.string(),

  questionUUID: z.string(),
  questionHash: z.string(),

  fullPromptData: z.string(),
  fullPromptHash: z.string(),

  // aka taskFileCID
  sourcePromptDatasetCID: z.string(),

  // aka taskFileName
  sourceFileName: z.string().optional(),
});

export type PromptResponse = z.infer<typeof PromptResponseSchema>;

export const PromptScoreSchema = PromptResponseSchema.extend({
  promptData: z.string().optional(),
  responseData: z.string().optional(),
  correctResponse: z.string().optional(),
  sourcePromptDatasetCID: z.string().optional(),
  fullPromptData: z.string().optional(),

  score: z.number(),
});
export type PromptScore = z.infer<typeof PromptScoreSchema>;

export const AggregationResultSchema = z.array(
  z.object({
    taskDID: z.string(),
    providerDID: z.string(),
    modelDID: z.string(),
    totalResponse: z.number(),
    score: z.number(),
    wrongAnswers: z.number(),
    missingAnswers: z.number(),
    avgLatency: z.number(),
    avgScore: z.number(),
    score_runIds: z.array(z.string()),
    sourcePromptDatasetCIDs: z.array(z.string()),
    sourceFileNames: z.array(z.string()),
  })
);

export type AggregationResult = z.infer<typeof AggregationResultSchema>;
