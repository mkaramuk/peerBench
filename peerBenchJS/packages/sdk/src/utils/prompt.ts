import { PromptOptions } from "@/types";

/**
 * Prepares the whole prompt that is going to be asked to the model
 */
export function preparePrompt(question: string, options: PromptOptions) {
  // Append answers to the result
  let result = `${question}\n\n`;
  for (const [letter, answer] of Object.entries(options)) {
    result += `${letter}: ${answer}\n`;
  }

  return result;
}
