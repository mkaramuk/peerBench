export const NodeEnvs = ["dev", "production"] as const;
export type NodeEnv = (typeof NodeEnvs)[number];

export const LogLevels = ["error", "warning", "info", "debug"] as const;
export type LogLevel = (typeof LogLevels)[number];

export type MaybePromise<T> = T | Promise<T>;

export type OutputFile = {
  validatorDid: `did:val:${string}`;

  providerDid: `did:prov:${string}`;

  modelDid: `did:model:${string}`;

  promptCid: string;
  responseCid: string;
  promptData: string;
};

export type ModelResponse = {
  startedAt: Date;
  completedAt: Date;
  response: string;
};

export const TaskFileFormats = {
  BIG_BENCH: "BIG_BENCH",
} as const;

export type TaskFileFormat =
  (typeof TaskFileFormats)[keyof typeof TaskFileFormats];

export type Prompt = {
  id?: number | string;
  input: string;
  expectedAnswer?: string;
  answers?: Record<string, number>;
};

export type PromptResponse = {
  validatorDID: string;
  providerDID: string;
  modelDID: string;

  promptCID: string;
  responseCID: string;

  promptData: string;
  responseData: string;
  correctResponse: string;

  promptedAt: number;
  repliedAt: number;

  evaluationRunId: string;
};

export type PromptScore = Omit<
  PromptResponse,
  "promptData" | "responseData" | "correctResponse"
> & {
  promptData?: string;
  responseData?: string;
  correctResponse?: string;

  evaluationDID: string;
  score: number;
};

/**
 * DID of the evaluation types
 */
export const EvaluationTypes = {
  ExactEquality: "did:eval:exact-equality",
  MultipleChoice: "did:eval:multiple-choice",
} as const;

export type EvaluationType =
  (typeof EvaluationTypes)[keyof typeof EvaluationTypes];

export type Task = {
  name: string;
  inputPrefix?: string;
  inputSuffix?: string;
  outputPrefix?: string;
  outputSuffix?: string;
  evaluationType: EvaluationType;
  outputRegex?: RegExp;
  prompts: Prompt[];
};
