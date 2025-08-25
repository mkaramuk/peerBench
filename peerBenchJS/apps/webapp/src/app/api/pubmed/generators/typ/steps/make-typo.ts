import { AbstractStep } from "../../abstract-step";
import { cryptoRandom } from "@/utils/crypto-random";
import { TYPTaskGenerator } from "..";
import { PubMedRSSArticle } from "../../../types";
import natural from "natural";

export type MakeTypoStepResult = readonly [string, string];
export type MakeTypoStepArgs = {
  entry: PubMedRSSArticle;
  pickTextStrategy: PickTextStrategy;
  strategy: MakeTypoStrategy;
};

export class MakeTypoStep extends AbstractStep<
  MakeTypoStepArgs,
  MakeTypoStepResult,
  TYPTaskGenerator
> {
  typoTable: Record<string, string> = {};
  alphabetTable: Record<string, string> = {};
  strategy: MakeTypoStrategy;
  pickTextStrategy: PickTextStrategy;

  constructor(taskGenerator: TYPTaskGenerator, args: MakeTypoStepArgs) {
    super(`make-typo`, taskGenerator, args);
    this.strategy = args.strategy;
    this.pickTextStrategy = args.pickTextStrategy;

    const alphabet = "abcdefghijklmnopqrstuvwxyz";

    // Fill out the typo table
    for (const letter of alphabet) {
      const randomLetter =
        alphabet[Math.floor(cryptoRandom() * alphabet.length)];
      this.alphabetTable[letter] = randomLetter;
      this.alphabetTable[letter.toUpperCase()] = randomLetter.toUpperCase();
    }
  }

  async run() {
    let targets, parts;

    switch (this.pickTextStrategy) {
      case PickTextStrategies.Title:
        const pickTitle = this.pickTitle();
        targets = pickTitle.targets;
        parts = pickTitle.parts;
        break;
      case PickTextStrategies.RandomParagraph:
        const pickRandomParagraph = this.pickRandomParagraph();
        targets = pickRandomParagraph.targets;
        parts = pickRandomParagraph.parts;
        break;
      case PickTextStrategies.RandomSentences:
        const pickRandomSentences = this.pickRandomSentences();
        targets = pickRandomSentences.targets;
        parts = pickRandomSentences.parts;
        break;
    }

    const prepareText = () => {
      let finalText = "";
      for (let i = 0, j = 0; i < parts.length; i++) {
        if (parts[i] === undefined) {
          finalText += targets[j++];
        } else {
          finalText += parts[i];
        }

        if (i < parts.length - 1) {
          finalText += " ";
        }
      }

      return finalText;
    };

    const originalText = prepareText();
    for (let i = 0; i < targets.length; i++) {
      const words = targets[i].split(" ");
      const replacedIndexes: number[] = [];
      const totalWordsToBeReplaced = this.calculateAmount(
        "words-pick",
        words.length
      );

      for (let i = 0; i < totalWordsToBeReplaced; i++) {
        let wordIndex = -1;

        // Find an index that hasn't been replaced yet
        // and in range of the words array length
        do {
          wordIndex = Math.floor(cryptoRandom() * words.length);
        } while (
          replacedIndexes.includes(wordIndex) ||
          wordIndex > words.length - 1
        );

        // Replace the word
        words[wordIndex] = this.replaceWord(words[wordIndex]);
        replacedIndexes.push(wordIndex);
      }

      targets[i] = words.join(" ");
    }

    return [originalText, prepareText()] as const;
  }

  private pickRandomSentences() {
    const wholeText = Object.entries(this.args.entry.paragraphs)
      .map(([title, paragraph]) => `${title}: ${paragraph}`)
      .join("\n");

    // Split into sentences
    const tokenizer = new natural.SentenceTokenizer([]);
    const sentences = tokenizer.tokenize(wholeText);
    const totalSentencesToBeReplaced = this.calculateAmount(
      "sentences-pick",
      sentences.length
    );

    const targets = [];
    const parts: (string | undefined)[] = [];
    const targetSentenceIndexes: number[] = [];

    for (let i = 0; i < totalSentencesToBeReplaced; i++) {
      let sentenceIndex = -1;

      do {
        sentenceIndex = Math.floor(cryptoRandom() * sentences.length);
      } while (
        targetSentenceIndexes.includes(sentenceIndex) ||
        sentenceIndex > sentences.length - 1
      );

      targets.push({
        value: sentences[sentenceIndex],
        index: sentenceIndex,
      });
      targetSentenceIndexes.push(sentenceIndex);
    }

    for (let i = 0; i < sentences.length; i++) {
      if (targetSentenceIndexes.includes(i)) {
        parts.push(undefined);
      } else {
        parts.push(sentences[i]);
      }
    }

    return {
      targets: targets.sort((a, b) => a.index - b.index).map((t) => t.value),
      parts,
    };
  }

  private pickRandomParagraph() {
    let targets: string[] = [];
    const parts: (string | undefined)[] = [];
    const paragraphIndex = Math.floor(
      cryptoRandom() * Object.values(this.args.entry.paragraphs).length
    );

    let i = 0;
    for (const [title, paragraph] of Object.entries(
      this.args.entry.paragraphs
    )) {
      if (i === paragraphIndex) {
        targets = [`${title}: ${paragraph}`];
        parts.push(undefined);
      } else {
        parts.push(`${title}: ${paragraph}`);
      }
      i++;
    }

    return {
      targets,
      parts,
    };
  }

  private pickTitle() {
    const targets: (string | undefined)[] = [undefined];

    for (const [title, paragraph] of Object.entries(
      this.args.entry.paragraphs
    )) {
      targets.push(`${title}: ${paragraph}`);
    }

    return {
      targets: [this.args.entry.title],
      parts: targets,
    };
  }

  private replaceWord(word: string) {
    // If this word has already been replaced, use the same replaced value.
    if (this.typoTable[word] !== undefined) {
      return this.typoTable[word];
    }

    const totalCharToBeReplaced = this.calculateAmount(
      "characters-pick",
      word.length
    );

    for (let i = 0; i < totalCharToBeReplaced; i++) {
      const randomIndex = Math.floor(cryptoRandom() * word.length);
      const character = word[randomIndex];
      const replaceWith = this.alphabetTable[character] || character;

      word =
        word.slice(0, randomIndex) + replaceWith + word.slice(randomIndex + 1);
    }

    // Save the typo in case if we encounter with the same word again.
    this.typoTable[word] = word;
    return word;
  }

  private calculateAmount(
    context: "characters-pick" | "words-pick" | "sentences-pick",
    data: number
  ) {
    switch (context) {
      case "characters-pick":
        // Amount of characters to be replaced
        return Math.floor(
          this.strategy === MakeTypoStrategies.Easy ? data * 0.3 : data * 0.6
        );
      case "words-pick":
        // Amount of words to be replaced
        if (this.strategy === MakeTypoStrategies.Easy) {
          if (this.pickTextStrategy === PickTextStrategies.Title) {
            return Math.floor(data * 0.2);
          } else if (
            this.pickTextStrategy === PickTextStrategies.RandomParagraph
          ) {
            return Math.floor(data * 0.4);
          } else if (
            this.pickTextStrategy === PickTextStrategies.RandomSentences
          ) {
            return Math.floor(data * 0.4);
          }
        } /* if (this.strategy === MakeTypoStrategies.Hard) */ else {
          if (this.pickTextStrategy === PickTextStrategies.Title) {
            return Math.floor(data * 0.4);
          } else if (
            this.pickTextStrategy === PickTextStrategies.RandomParagraph
          ) {
            return Math.floor(data * 0.7);
          } /* if (
            this.pickTextStrategy === PickTextStrategies.RandomSentences
          ) */ else {
            return Math.floor(data * 0.7);
          }
        }
      case "sentences-pick":
        // Amount of sentences to be replaced
        if (this.strategy === MakeTypoStrategies.Easy) {
          if (this.pickTextStrategy === PickTextStrategies.Title) {
            return Math.floor(data * 1); // In title there is only one sentence
          } else if (
            this.pickTextStrategy === PickTextStrategies.RandomParagraph
          ) {
            return Math.floor(data * 0.5);
          }
          /* else if (
            this.pickTextStrategy === PickTextStrategies.RandomSentences
          ) */ {
            return Math.floor(data * 0.5);
          }
        } /* if (this.strategy === MakeTypoStrategies.Hard)  */ else {
          if (this.pickTextStrategy === PickTextStrategies.Title) {
            return Math.floor(data * 1); // In title there is only one sentence
          } else if (
            this.pickTextStrategy === PickTextStrategies.RandomParagraph
          ) {
            return Math.floor(data * 0.7);
          } /* if (
            this.pickTextStrategy === PickTextStrategies.RandomSentences
          )  */ else {
            return Math.floor(data * 0.7);
          }
        }
    }
  }
}

export const MakeTypoStrategies = {
  Easy: "easy",
  Hard: "hard",
} as const;
export type MakeTypoStrategy =
  (typeof MakeTypoStrategies)[keyof typeof MakeTypoStrategies];

export const PickTextStrategies = {
  Title: "title",
  RandomParagraph: "random-paragraph",
  RandomSentences: "random-sentences",
} as const;
export type PickTextStrategy =
  (typeof PickTextStrategies)[keyof typeof PickTextStrategies];
