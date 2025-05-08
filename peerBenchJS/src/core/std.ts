import { logger } from "@/core/logger";
import { saveJobLog, generateCID } from "@/core/utils";
import { yellow, green } from "ansis";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";
import { v7 as uuidv7 } from "uuid";
import { createHash } from "crypto";
import { PromptOptions } from "@/types";
import { preparePrompt } from "./prompt";
import { getTaskFormat, readTask } from "./format";
import { AbstractTaskFormat } from "@/base/task-format";

// Special fields that should be preserved in other
export const specialOtherFields = [
  "hash_full_question",
  "hash_first_sentence",
  "hash_first_question_sentence",
  "hash_last_sentence",
  "stdQuestionUUID",
  "preSTDsrcFileName",
  "preSTDsrcCID",
  "src_row_number",
] as const;

type SpecialOtherField = (typeof specialOtherFields)[number];

// Helper function to check if a key is a special field
function isSpecialField(key: string): key is SpecialOtherField {
  return specialOtherFields.includes(key as SpecialOtherField);
}

// Helper function to calculate SHA-256 hash of a string
export function calculateSHA256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Helper function to split text into sentences
export function splitIntoSentences(text: string): string[] {
  // This regex handles common sentence endings (., !, ?) and accounts for common abbreviations and edge cases
  const sentenceRegex = /[^.!?]+[.!?]+\s*/g;
  const matches = text.match(sentenceRegex);

  if (!matches) {
    return [text]; // Return the whole text as one sentence if no sentence boundaries found
  }

  // Join and check if we lost any text at the end (without punctuation)
  const joinedMatches = matches.join("");
  if (joinedMatches.length < text.length) {
    const remainder = text.substring(joinedMatches.length);
    if (remainder.trim()) {
      return [...matches, remainder];
    }
  }

  return matches;
}

// Helper function to get the first question sentence (ending with '?')
export function getFirstQuestionSentence(sentences: string[]): string {
  const questionSentence = sentences.find((sentence) =>
    sentence.trim().endsWith("?")
  );
  return questionSentence || sentences[0]; // Fallback to first sentence if no '?' found
}

// Helper function to calculate all hash values for a question
export function calculateQuestionHashes(
  question: string,
  options: PromptOptions
) {
  const sentences = splitIntoSentences(question);
  const firstSentence = sentences[0] || question;
  const firstQuestionSentence = getFirstQuestionSentence(sentences);
  const lastSentence =
    sentences.length > 1 ? sentences[sentences.length - 1] : firstSentence;

  return {
    fullTextHash: calculateSHA256(question),
    firstSentenceHash: calculateSHA256(firstSentence),
    firstQuestionHash: calculateSHA256(firstQuestionSentence),
    lastSentenceHash: calculateSHA256(lastSentence),
    fullPromptHash: calculateSHA256(preparePrompt(question, options)),
  };
}

// Helper function to get existing UUID or generate a new one
export function getOrCreateUUID(item: any): string {
  // Check if UUID exists at root level
  if (item.stdQuestionUUID) {
    return item.stdQuestionUUID;
  }

  // Check if UUID exists in other
  if (item.other && item.other.stdQuestionUUID) {
    return item.other.stdQuestionUUID;
  }

  // Generate a new UUID if none exists
  return uuidv7();
}

// Helper function to get existing row number or use provided index
export function getOrCreateRowNumber(item: any, index: number): number {
  // Check if row number exists at root level with various possible field names
  if (typeof item.src_row_number === "number") {
    return item.src_row_number;
  }
  if (typeof item.row_number === "number") {
    return item.row_number;
  }

  // Check if row number exists in other
  if (item.other) {
    if (typeof item.other.src_row_number === "number") {
      return item.other.src_row_number;
    }
    if (typeof item.other.row_number === "number") {
      return item.other.row_number;
    }
  }

  // Use the provided index if no row number exists
  return index;
}

// Generates metadata information
export function generatePromptMetaFields(params: {
  question: string;
  options: PromptOptions;
  uuid: string;
  rowNumber: number;
  sourceFileName: string;
  sourceFileCID: string;
}) {
  // Calculate hash values for the question
  const hashes = calculateQuestionHashes(params.question, params.options);

  return {
    hash_full_question: hashes.fullTextHash,
    hash_first_sentence: hashes.firstSentenceHash,
    hash_first_question_sentence: hashes.firstQuestionHash,
    hash_last_sentence: hashes.lastSentenceHash,
    src_row_number: params.rowNumber,
    preSTDsrcFileName: params.sourceFileName,
    preSTDsrcCID: params.sourceFileCID,
    stdQuestionUUID: params.uuid,
    stdFullPromptText: preparePrompt(params.question, params.options),
    stdFullPromptHash: hashes.fullPromptHash,

    // TODO.FUTURE: Better structure for the metadata
    // hashes: {
    //   fullQuestion: hashes.fullTextHash,
    //   firstSentence: hashes.firstSentenceHash,
    //   firstQuestionSentence: hashes.firstQuestionHash,
    //   lastSentence: hashes.lastSentenceHash,
    //   fullPrompt: hashes.fullPromptHash,
    // },
    // questionUUID: params.uuid,
    // rowNumber: params.rowNumber,
    // fullPromptText: preparePrompt(params.question, params.options),
    // sourceTaskFileName: params.sourceFileName,
    // sourceTaskFileCID: params.sourceFileCID,
  };
}

// Converts from MMLU-Pro format to MedQA format
function convertMMLUProToMedQA(
  item: any,
  sourceFilename: string,
  sourceCID: string,
  index: number
): any {
  const result: any = {
    question: item.question,
    options: {},
    answer_idx: item.answer,
    answer: item.options[item.answer_index],
    meta_info: "",
    other: {},
  };

  // Calculate hash values for the question
  const hashes = calculateQuestionHashes(item.question, {});

  // Add hash values to "other"
  result.other["hash_full_question"] = hashes.fullTextHash;
  result.other["hash_first_sentence"] = hashes.firstSentenceHash;
  result.other["hash_first_question_sentence"] = hashes.firstQuestionHash;
  result.other["hash_last_sentence"] = hashes.lastSentenceHash;

  // Get or create UUID
  result.other["stdQuestionUUID"] = getOrCreateUUID(item);

  // Get or create row number
  result.other["src_row_number"] = getOrCreateRowNumber(item, index);

  // Convert options from array to object with letter keys
  item.options.forEach((option: string, index: number) => {
    const letterKey = String.fromCharCode(65 + index); // A, B, C, ...
    result.options[letterKey] = option;
  });

  // Move additional fields to "other" with prefix
  if ("question_id" in item)
    result.other["mmlu-pro__question_id"] = item.question_id;
  if ("answer_index" in item)
    result.other["mmlu-pro__answer_index"] = item.answer_index;
  if ("cot_content" in item)
    result.other["mmlu-pro__cot_content"] = item.cot_content;
  if ("category" in item) result.other["mmlu-pro__category"] = item.category;
  if ("src" in item) result.other["mmlu-pro__src"] = item.src;

  // Add any other fields that may be present
  Object.keys(item).forEach((key) => {
    if (
      ![
        "question",
        "options",
        "answer",
        "answer_index",
        "question_id",
        "cot_content",
        "category",
        "src",
      ].includes(key)
    ) {
      result.other[`mmlu-pro__${key}`] = item[key];
    }
  });

  // Copy over existing special fields from item.other if they exist
  if (item.other) {
    specialOtherFields.forEach((field) => {
      if (field in item.other) {
        result.other[field] = item.other[field];
      }
    });

    // Copy over all other fields with prefix
    Object.keys(item.other).forEach((key) => {
      if (!isSpecialField(key)) {
        result.other[`mmlu-pro__other__${key}`] = item.other[key];
      }
    });
  }

  // Add source filename and source CID to "other"
  result.other["preSTDsrcFileName"] = sourceFilename;
  result.other["preSTDsrcCID"] = sourceCID;

  return result;
}

// Converts from MedQA format to MMLU-Pro format
function convertMedQAToMMLUPro(
  item: any,
  sourceFilename: string,
  sourceCID: string,
  index: number
): any {
  // Generate a question_id or try to reuse one from mmlu-pro data if available

  const result: any = {
    question_id: 0,
    question: item.question,
    options: [],
    answer: "",
    answer_index: 0,
    cot_content: "",
    category: "",
    src: "",
    other: {}, // Add other field for MMLU-Pro as well
  };

  // Calculate hash values for the question
  const hashes = calculateQuestionHashes(item.question, {});

  // Add hash values to "other"
  result.other["hash_full_question"] = hashes.fullTextHash;
  result.other["hash_first_sentence"] = hashes.firstSentenceHash;
  result.other["hash_first_question_sentence"] = hashes.firstQuestionHash;
  result.other["hash_last_sentence"] = hashes.lastSentenceHash;

  // Get or create UUID
  result.other["stdQuestionUUID"] = getOrCreateUUID(item);

  // Get or create row number
  result.other["src_row_number"] = getOrCreateRowNumber(item, index);

  result.questionId = result.other["src_row_number"];
  if (item.other && item.other["question_id"]) {
    result.questionId = item.other["question_id"];
  } else if (item.other && item.other["mmlu-pro__question_id"]) {
    result.questionId = item.other["mmlu-pro__question_id"];
  }

  // Extract meta_info if it's a string and use it as category
  if (item.meta_info && typeof item.meta_info === "string") {
    result.category = item.meta_info;
  }

  // Check if mmlu-pro__src exists in other and use it directly
  if (item.src && typeof item.src === "string") {
    result.src = item.src;
  } else if (item.other && item.other["src"]) {
    result.src = item.other["src"];
  } else if (item.other && item.other["mmlu-pro__src"]) {
    result.src = item.other["mmlu-pro__src"];
  }

  // Otherwise, leave src as an empty string

  // Handle category and metadata
  if (item.other && item.other["mmlu-pro__category"]) {
    // Store the whole category object in other
    result.other["medqa_category"] = item.other["mmlu-pro__category"];

    // Don't automatically set src from event - moved to separate code above
  } else if (item.category && typeof item.category === "object") {
    // Store the whole category object in other
    result.other["medqa_category"] = item.category;

    // Don't automatically set src from event - moved to separate code above
  }

  // Store category related objects separately for reference
  if (
    item.other &&
    item.other["mmlu-pro__category"] &&
    item.other["mmlu-pro__category"].source_event
  ) {
    result.other["source_event"] =
      item.other["mmlu-pro__category"].source_event;
  } else if (
    item.category &&
    typeof item.category === "object" &&
    item.category.source_event
  ) {
    result.other["source_event"] = item.category.source_event;
  }

  // Convert options from object to array
  const optionKeys = Object.keys(item.options).sort(); // Sort to ensure A, B, C order
  optionKeys.forEach((key) => {
    result.options.push(item.options[key]);
  });

  // If mmlu-pro__answer_index is available, use it
  if (item.other && typeof item.other["mmlu-pro__answer_index"] === "number") {
    result.answer_index = item.other["mmlu-pro__answer_index"];
    // Set the answer letter from the index
    if (result.answer_index >= 0 && result.answer_index < optionKeys.length) {
      result.answer = optionKeys[result.answer_index];
    }
  } else if (item.answer_idx && optionKeys.includes(item.answer_idx)) {
    // Set answer to the letter (e.g. "A", "B", etc.)
    result.answer = item.answer_idx;

    // Find the index of the answer in the options array
    result.answer_index = optionKeys.indexOf(item.answer_idx);
  }

  // Try to recover mmlu-pro fields from other if present
  if (item.other) {
    // Look for mmlu-pro specific fields in other
    Object.keys(item.other).forEach((key) => {
      if (
        key.startsWith("mmlu-pro__") &&
        !key.startsWith("mmlu-pro__other__")
      ) {
        const originalKey = key.replace("mmlu-pro__", "");
        if (
          originalKey !== "category" &&
          originalKey !== "other" &&
          originalKey !== "answer_index" &&
          originalKey !== "src"
        ) {
          result[originalKey] = item.other[key];
        }
      }
    });

    // Copy special fields directly
    specialOtherFields.forEach((field) => {
      if (field in item.other) {
        result.other[field] = item.other[field];
      }
    });

    // Copy over other fields that aren't special, hash or mmlu-pro specific
    Object.keys(item.other).forEach((key) => {
      if (
        !isSpecialField(key) &&
        !key.startsWith("hash_") &&
        !key.startsWith("mmlu-pro__")
      ) {
        result.other[key] = item.other[key];
      }
    });
  }

  // Add source filename and source CID to "other" if they don't already exist
  if (!result.other["preSTDsrcFileName"]) {
    result.other["preSTDsrcFileName"] = sourceFilename;
  }
  if (!result.other["preSTDsrcCID"]) {
    result.other["preSTDsrcCID"] = sourceCID;
  }

  return result;
}

// Helper function to generate output filename
function createOutputFilename(
  inputPath: string,
  targetTaskSchemaName: string
): string {
  const dir = dirname(inputPath);
  const originalFilename = basename(inputPath);
  const extension = originalFilename.includes(".")
    ? originalFilename.substring(originalFilename.lastIndexOf("."))
    : ".json";

  // Remove extension for the base name
  const baseName = originalFilename.includes(".")
    ? originalFilename.substring(0, originalFilename.lastIndexOf("."))
    : originalFilename;

  return join(dir, `${baseName}_${targetTaskSchemaName}Formatted${extension}`);
}

/**
 * Converts a given task file to another format. Throws error either source
 * task file or target format is not supported. If `output` param is not given
 * Saves the converted format in the same directory as the source file with
 * a name `<source-file-name>.std.<source-file-extension>`
 */
export async function convertTaskFormat(params: {
  sourceTaskFile: string;
  targetFormat?: string;
  output?: string;
}): Promise<{
  outputPath: string;
  outputCID: string;
  convertedData: any[];
}> {
  const startedAt = Date.now().toString();
  const { task, formatName: formatName } = await readTask(
    params.sourceTaskFile
  );
  const sourceFormat: AbstractTaskFormat = getTaskFormat(formatName);

  logger.info(`Source file CID: ${task.cid.toString()}`);

  const targetTaskFormatName = params.targetFormat || "medqa";

  // Skip conversion if source and target schemas are the same
  if (targetTaskFormatName === sourceFormat.name) {
    logger.info(
      yellow.bold(
        `Source and target schemas are the same (${sourceFormat.name}). No conversion needed.`
      )
    );
    return {
      outputPath: params.sourceTaskFile,
      outputCID: task.cid,
      convertedData: task.prompts,
    };
  }

  // Convert the data with sourceFilename and sourceCID
  const convertedData = await sourceFormat.convertTo(
    task,
    targetTaskFormatName
  );
  logger.info(
    `Successfully converted ${convertedData.length} items from ${sourceFormat.name} to ${targetTaskFormatName} schema`
  );

  // Determine output file path
  const outputPath =
    params.output ||
    createOutputFilename(params.sourceTaskFile, targetTaskFormatName);

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write the converted data
  const outputContent = JSON.stringify(convertedData, null, 2);
  writeFileSync(outputPath, outputContent);
  logger.info(`Converted data saved to ${green.bold(outputPath)}`);

  // Calculate CID of the output file
  const outputCID = await generateCID(outputContent);
  logger.info(`Output file CID: ${outputCID.toString()}`);

  // Save job log
  await saveJobLog(
    {
      uuid: uuidv7(),
      jobType: "std",
      startedAt: +startedAt,
      completedAt: Date.now(),
      sourceFile: params.sourceTaskFile,
      outputFile: outputPath,
      fromSchema: formatName,
      toSchema: targetTaskFormatName,
      outputCID: outputCID.toString(),
    },
    "std", // Custom job type
    startedAt
  );

  logger.info(`Standardization job completed successfully`);

  return {
    outputPath,
    outputCID: outputCID.toString(),
    convertedData,
  };
}
