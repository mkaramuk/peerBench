# Implementing a Scorer

This guide demonstrates how to implement a new Scorer for the peerBench SDK.

## Overview

Scorers are responsible for taking a Response that is made for a Prompt and giving a score between 0 and 1. The given score represents how well the model performed on that particular Prompt.

## Basic Example

Here's a very simple scorer implementation that demonstrates the basic structure:

```typescript
import { AbstractScorer } from "@/scorers/abstract/abstract-scorer";
import { PromptResponse } from "@/types";

export class SimpleExactMatchScorer extends AbstractScorer {
  readonly identifier = "simple-exact-match";

  async scoreOne(
    response: PromptResponse,
    options?: Record<string, any>
  ): Promise<number | undefined> {
    // Extract the correct answer from the prompt
    const correctAnswer = response.prompt.answer;

    // Get the model's response
    const modelResponse = response.response.content;

    // Simple exact match scoring (case-insensitive)
    const isCorrect =
      correctAnswer.toLowerCase().trim() === modelResponse.toLowerCase().trim();

    // Return 1.0 for correct answers, 0.0 for incorrect
    return isCorrect ? 1.0 : 0.0;
  }

  async canScore(response: PromptResponse): Promise<boolean> {
    // This scorer can handle any response that has content
    return (
      response.response.content && typeof response.response.content === "string"
    );
  }
}
```

### Required Properties

**`readonly identifier: string`**

- A unique string that identifies your Scorer
- Should be descriptive and unique across all Scorers
- Useful when you try to find this Scorer among the others

### Abstract Methods

**`scoreOne(response: PromptResponse, options?: Record<string, any>): Promise<number | undefined>`**

- This is the main scoring method you must implement
- Takes a `PromptResponse` object containing both the Prompt and Response
- Optional `options` parameter for configurable scoring behavior
- Must return a number between 0 and 1, or `undefined` if scoring fails
- The number represents the score: 1.0 = perfect, 0.0 = completely wrong

**`canScore(response: PromptResponse): Promise<boolean>`**

- This method determines if your Scorer can handle a specific Response
- Returns `true` if your Scorer implementation is eligible to score the Response and `false` if it isn't.

## Examples

See the `examples/scorers/` directory for complete working examples:

- `exact-match-scorer.ts` - Exact match scoring
- `semantic-similarity-scorer.ts` - Semantic similarity scoring

These examples demonstrate real-world implementations and can serve as templates for your own Scorers.
