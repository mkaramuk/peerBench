import { z } from "zod";

export const PromptTypes = {
  MultipleChoice: "multiple-choice",
  OrderSentences: "order-sentences",
  TextReplacement: "text-replacement",
  Typo: "typo",
} as const;

export type PromptType = (typeof PromptTypes)[keyof typeof PromptTypes];

export const PromptSchema = z.object({
  /**
   * Decentralized identifier of the Prompt
   */
  did: z.string(),

  /**
   * The question that is going to be asked to the model
   */
  question: z.object({
    /**
     * Question data itself
     */
    data: z.string(),

    /**
     * CID v1 calculation of the question string
     */
    cid: z.string(),

    /**
     * SHA256 hash of the question string
     */
    sha256: z.string(),
  }),

  /**
   * Multiple choice answers for the question where the keys are letters and the values are the answer itself.
   */
  options: z.record(z.string(), z.string()),

  /**
   * Full prompt that is going to be sent to the model
   */
  fullPrompt: z.object({
    /**
     * Full prompt itself
     */
    data: z.string(),

    /**
     * CID v1 calculation of the full prompt string
     */
    cid: z.string(),

    /**
     * SHA256 hash of the full prompt string
     */
    sha256: z.string(),
  }),

  /**
   * Type of the Prompt
   */
  type: z.nativeEnum(PromptTypes),

  /**
   * Expected option value for the question
   */
  answer: z.string(),

  /**
   * Expected letter of the answer (e.g "A", "B" or "C")
   */
  answerKey: z.string(),

  /**
   * Additional metadata related to the Prompt
   */
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * PeerBench Prompt object
 */
export type Prompt = z.infer<typeof PromptSchema>;

export const TaskSchema = z.object({
  /**
   * Decentralized identifier of the Task
   */
  did: z.string().startsWith("did:task:"),

  /**
   * The Prompts that the Task has
   */
  prompts: z.array(PromptSchema),

  /**
   * CID v1 calculation of the Task file
   */
  cid: z.string(),

  /**
   * SHA256 calculation of the Task file
   */
  sha256: z.string(),

  /**
   * Basename of the Task file
   */
  fileName: z.string(),

  /**
   * Full path of the Task file
   */
  path: z.string(),
});

/**
 * Task object that includes the prompts and the Task file metadata
 */
export type Task = z.infer<typeof TaskSchema>;

export const PromptResponseSchema = z.object({
  /**
   * Name of the Provider that the Response comes from
   */
  provider: z.string(),

  /**
   * Original ID of the Model that was used to get this Response
   */
  modelId: z.string(),

  /**
   * Known name of the model by peerBench
   */
  modelName: z.string(),

  /**
   * Owner of the model
   */
  modelOwner: z.string(),

  /**
   * The entity that responsible for hosting the model
   */
  modelHost: z.string(),

  /**
   * Task identifier
   */
  taskId: z.string(),

  /**
   * The Prompt that used to achieve this Response.
   */
  prompt: PromptSchema,

  /**
   * CID v1 calculation of the Response data. Undefined if the Response is failed.
   */
  cid: z.string().optional(),

  /**
   * SHA256 calculation of the Response data. Undefined if the Response is failed.
   */
  sha256: z.string().optional(),

  /**
   * Response data itself. Undefined if the Response is failed.
   */
  data: z.string().optional(),

  /**
   * Timestamp when the Prompt sent to the Model
   */
  startedAt: z.number(),

  /**
   * Timestamp when the Model responded this particular Prompt. Undefined if the Response is failed.
   */
  finishedAt: z.number().optional(),

  /**
   * Unique identifier of which run this Response belongs to
   */
  runId: z.string(),

  /**
   * Source Task file that the Prompt of this Response comes from
   */
  sourceTaskFile: z.object({
    /**
     * CID v1 calculation
     */
    cid: z.string(),

    /**
     * SHA256 calculation
     */
    sha256: z.string(),

    /**
     * Base file name
     */
    fileName: z.string(),
  }),
});

export type PromptResponse = z.infer<typeof PromptResponseSchema>;

export const PromptScoreSchema = PromptResponseSchema.extend({
  // Make those fields optional because for NoData version of Score, we shouldn't include them
  prompt: PromptSchema.extend({
    options: PromptSchema.shape.options.optional(),

    question: PromptSchema.shape.question.extend({
      data: z.string().optional(),
    }),

    fullPrompt: PromptSchema.shape.fullPrompt.extend({
      data: z.string().optional(),
    }),

    answer: z.string().optional(),
  }).optional(),
  data: z.string().optional(),

  /**
   * Score of the Response. Undefined if the Response is failed.
   */
  score: z.number().optional(),

  /**
   * Additional metadata
   */
  metadata: z.record(z.string(), z.any()).default({}).optional(),
});
export type PromptScore = z.infer<typeof PromptScoreSchema>;

export type MaybePromise<T> = T | Promise<T>;

export type PromptOptions = Record<string, string>;
