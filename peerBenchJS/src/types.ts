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

  evaluationDID: string;
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

export const MetricTypes = {
  ExactEquality: "exact-equality",
  MultipleChoice: "multiple-choice",
} as const;
export type MetricType = (typeof MetricTypes)[keyof typeof MetricTypes];

export type Task = {
  name: string;
  inputPrefix?: string;
  inputSuffix?: string;
  outputPrefix?: string;
  outputSuffix?: string;
  metricTypes: MetricType[];
  prompts: Prompt[];
  systemPrompt?: string;
};
