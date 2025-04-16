import { z } from "zod";

export const NodeEnvs = ["dev", "production"] as const;
export type NodeEnv = (typeof NodeEnvs)[number];

export const LogLevels = ["error", "warning", "info", "debug"] as const;
export type LogLevel = (typeof LogLevels)[number];

export type MaybePromise<T> = T | Promise<T>;

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
  id: z.union([z.string(), z.number()]).optional(),
  data: z.string(),
  answers: z.record(z.string(), z.number()).optional(),
  correctResponse: z.string().optional(),
  evalTypes: z.array(
    z.enum(Object.values(EvalTypes) as [EvalType, ...EvalType[]])
  ),
});
export type Prompt = z.infer<typeof PromptSchema>;

export const TaskSchema = z.object({
  did: z.string().startsWith("did:task:"),
  prompts: z.array(PromptSchema),
});
export type Task = z.infer<typeof TaskSchema>;

export const PromptResponseSchema = z.object({
  validatorDID: z.string().startsWith("did:val:"),
  providerDID: z.string().startsWith("did:prov:"),
  modelDID: z.string().startsWith("did:model:"),
  taskDID: z.string().startsWith("did:task:"),
  evalTypes: z.array(
    z.enum(Object.values(EvalTypes) as [EvalType, ...EvalType[]])
  ),
  promptCID: z.string(),
  responseCID: z.string(),

  promptData: z.string(),
  responseData: z.string(),
  correctResponse: z.string(),

  promptedAt: z.number(),
  repliedAt: z.number(),

  runId: z.string(),
});

export type PromptResponse = z.infer<typeof PromptResponseSchema>;

export const PromptScoreSchema = PromptResponseSchema.extend({
  promptData: z.string().optional(),
  responseData: z.string().optional(),
  correctResponse: z.string().optional(),

  score: z.number(),
});
export type PromptScore = z.infer<typeof PromptScoreSchema>;
