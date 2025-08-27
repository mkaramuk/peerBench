import { AbstractScorer } from "./abstract/abstract-scorer";
import { PromptResponse, PromptTypes } from "@/types";

/**
 * Scorer implementation for multiple choice questions. Parses the answer letter
 * from the response text by looking for patterns like `answer is <letter>` or
 * `<letter>:` and compares it with the `answerKey` of the prompt.
 */
export class MultipleChoiceScorer extends AbstractScorer {
  readonly identifier = "multiple-choice";

  /**
   * Score a multiple choice response
   */
  async scoreOne(response: PromptResponse) {
    if (!(await this.canScore(response))) {
      return undefined;
    }

    const { data, prompt } = response;

    if (!data || !prompt) {
      return undefined;
    }

    // Direct answer comparison
    if (data === prompt.answerKey) {
      return 1;
    }

    // Look for answer patterns in the response
    const extractedAnswer = this.lookForAnswer(data);
    if (extractedAnswer === prompt.answerKey) {
      return 1;
    }

    return 0;
  }

  async canScore(response: PromptResponse): Promise<boolean> {
    return (
      response.data !== undefined &&
      response.prompt !== undefined &&
      response.prompt.type === PromptTypes.MultipleChoice &&
      Object.keys(response.prompt.options).length > 0 &&
      response.prompt.answerKey !== ""
    );
  }

  /**
   * Extract answer from response text using regex patterns
   */
  private lookForAnswer(response: string): string | undefined {
    const patterns = [
      {
        regex: /answer is\s+([A-Z])/gi,
        answerGroupIndex: 1,
      },
      {
        regex: /answer is\s+\**([A-Z])\**/gi,
        answerGroupIndex: 1,
      },
      {
        regex: /([A-Z]):.+/g,
        answerGroupIndex: 1,
      },
    ];

    for (const pattern of patterns) {
      const matches = Array.from(response.matchAll(pattern.regex));
      const match = matches.at(-1); // Use the last match

      if (match) {
        return match[pattern.answerGroupIndex];
      }
    }
  }
}
