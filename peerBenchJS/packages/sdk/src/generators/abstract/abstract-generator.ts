import { MaybePromise, Prompt, PromptType } from "@/types";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { calculateCID } from "@/utils/cid";
import { calculateSHA256 } from "@/utils/sha256";

/**
 * Abstract prompt generator class
 */
export abstract class AbstractGenerator {
  abstract readonly identifier: string;
  abstract inputSchema: z.ZodSchema<unknown>;

  /**
   * Generate prompt from the collected source data
   * @param input - Raw input data that will be validated against inputSchema
   * @param options - Optional configuration options
   * @returns Promise resolving to an array of prompts
   */
  async generate(
    input: unknown,
    options?: Record<string, any>
  ): Promise<Prompt[]> {
    // Validate input using the schema
    const validatedInput = this.inputSchema.parse(input);

    // Call the protected method with validated input
    return this.generatePrompts(validatedInput, options);
  }

  /**
   * Abstract method that implementors MUST override.
   * This method receives already validated input data.
   */
  protected abstract generatePrompts(
    input: z.infer<(typeof this)["inputSchema"]>,
    options?: Record<string, any>
  ): Promise<Prompt[]>;

  /**
   * Checks whether the generator can handle the given input
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canHandle(input: any): MaybePromise<boolean> {
    return true;
  }

  /**
   * Initializes the generator (depends on the implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initialize(...args: any[]): Promise<void> {
    // Default implementation does nothing
    // Implement in subclasses if needed
  }

  async buildPrompt(params: {
    /**
     * Base question
     */
    question: string;

    /**
     * For multiple choice prompts, includes each option as letter-answer pairs
     */
    options?: Record<string, string>;

    /**
     * Correct answer that is expected. For multiple choice prompts,
     * this is the letter of the correct answer.
     */
    correctAnswer: string;

    /**
     * The full Prompt text that will be sent.
     */
    fullPrompt: string;

    /**
     * Prompt type
     */
    type: PromptType;

    /**
     * Metadata
     */
    metadata?: Record<string, any>;
  }): Promise<Prompt> {
    const questionCID = await calculateCID(params.question).then((cid) =>
      cid.toString()
    );
    const questionSHA256 = await calculateSHA256(params.question);

    const fullPromptCID = await calculateCID(params.fullPrompt).then((cid) =>
      cid.toString()
    );
    const fullPromptSHA256 = await calculateSHA256(params.fullPrompt);

    return {
      did: uuidv7(),
      question: {
        data: params.question,
        cid: questionCID,
        sha256: questionSHA256,
      },

      answer: params.correctAnswer,

      // Answer key is only valid when the options are provided
      answerKey: params.options === undefined ? "" : params.correctAnswer,

      options: params.options ?? {},

      fullPrompt: {
        data: params.fullPrompt,
        cid: fullPromptCID,
        sha256: fullPromptSHA256,
      },

      type: params.type,

      metadata: {
        generatorIdentifier: this.identifier,
        ...(params.metadata || {}),
      },
    };
  }
}
