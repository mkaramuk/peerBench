import { config } from "@/config";
import { logger } from "@/core/logger";
import { parseModelDID, parseProviderDID } from "@/core/parser";
import { getProvider } from "@/core/providers";
import {
  checkValidationError,
  readFile,
  saveEntity,
  saveJobLog,
  generateCID,
  randomInteger,
} from "@/core/utils";
import { program } from "@/core/program";
import { yellow, green } from "ansis";
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join, dirname, basename } from "path";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { parseProviderConfig } from "@/core/parser";

// Helper function to chunk array into groups of specified size
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

// Helper function to create the output filename
function createOutputFilename(inputPath: string, modelName: string): string {
  const dir = dirname(inputPath);
  const originalFilename = basename(inputPath);

  // Extract the shortened model name
  let shortModelName = modelName;
  if (modelName.includes("/")) {
    // Extract the part after the last slash
    shortModelName = modelName.split("/").pop() || modelName;
  }
  if (shortModelName.includes("-")) {
    // Keep up to the second hyphen if present
    const parts = shortModelName.split("-");
    if (parts.length > 2) {
      shortModelName = `${parts[0]}-${parts[1]}`;
    }
  }

  // Add timestamp
  const timestamp = Date.now();

  return join(
    dir,
    `REPHRASE__${shortModelName}_${timestamp}_${originalFilename}`
  );
}

// Helper function to append batch data to a file
async function appendBatchToFile(
  batchData: any[],
  outputPath: string,
  isJsonFormat: boolean,
  isFirstBatch: boolean
): Promise<void> {
  // Determine the content to write based on format
  let content: string;

  if (isJsonFormat) {
    // For JSON format, we need special handling:
    // - For first batch, write opening bracket + data + comma
    // - For other batches, write data + comma
    // The closing bracket will be added at the end

    if (isFirstBatch) {
      // Start the JSON array and add the first batch
      content = "[\n" + JSON.stringify(batchData, null, 2).slice(1, -1);
      if (content.endsWith("\n")) {
        content += ","; // Add comma if needed
      } else {
        content += ",\n";
      }
    } else {
      // Add batch to the existing array (without opening/closing brackets)
      content = JSON.stringify(batchData, null, 2).slice(1, -1);
      if (content.endsWith("\n")) {
        content += ","; // Add comma if needed
      } else {
        content += ",\n";
      }
    }
  } else {
    // For JSONL format, just join the items with newlines
    content = batchData.map((item) => JSON.stringify(item)).join("\n") + "\n";
  }

  // Append to the file
  if (isFirstBatch) {
    // For first batch, make sure the directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    // Write to file (create or overwrite)
    writeFileSync(outputPath, content);
  } else {
    // Append to existing file using imported appendFileSync instead of require
    appendFileSync(outputPath, content);
  }

  logger.info(`Batch data appended to ${outputPath}`);
}

// Helper function to finalize a JSON file by adding the closing bracket
function finalizeJsonFile(outputPath: string): void {
  // Use imported appendFileSync instead of require
  appendFileSync(outputPath, "\n]");
  logger.info(`Finalized JSON file ${outputPath}`);
}

// Helper function to check if a file is an MMLU-Pro task
function isMMLUProTask(filePath: string, data: any[]): boolean {
  // Check if the path contains mmlu-pro or mmlu_pro
  const isPathMatching =
    filePath.toLowerCase().includes("mmlu-pro") ||
    filePath.toLowerCase().includes("mmlu_pro");

  // If the path doesn't match, return false
  if (!isPathMatching) return false;

  // Check if at least one item has the expected MMLU-Pro structure
  if (data.length === 0) return false;

  // Check for typical MMLU-Pro fields
  const firstItem = data[0];
  return (
    typeof firstItem === "object" &&
    "options" in firstItem &&
    "answer_index" in firstItem &&
    "category" in firstItem &&
    "src" in firstItem &&
    "cot_content" in firstItem
  );
}

// Helper function to shuffle answer options and update answer fields
function shuffleAnswerOptionsForMMLUPro(items: any[]): any[] {
  return items.map((item) => {
    // Make a copy to avoid modifying the original
    const newItem = { ...item };

    // Create a copy of the options array
    const options = [...newItem.options];

    // Remember the correct answer based on the current answer_index
    const correctAnswer = options[newItem.answer_index];

    // Create a shuffled version of the options array
    const shuffledOptions = [...options];

    // Perform Fisher-Yates shuffle
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledOptions[i], shuffledOptions[j]] = [
        shuffledOptions[j],
        shuffledOptions[i],
      ];
    }

    // Find the new index of the correct answer in the shuffled array
    const newAnswerIndex = shuffledOptions.indexOf(correctAnswer);

    // Update the item with the shuffled options and new answer index
    newItem.options = shuffledOptions;
    newItem.answer_index = newAnswerIndex;

    // Update the letter answer (A=0, B=1, C=2, etc.)
    newItem.answer = String.fromCharCode(65 + newAnswerIndex);

    return newItem;
  });
}

// Helper function to process a batch of items and append to output file
async function processBatch(
  batch: any[],
  provider: any,
  modelIdentifier: string,
  sourceFilename: string,
  outputPath: string,
  isJsonFormat: boolean,
  isFirstBatch: boolean,
  batchIndex: number,
  totalBatches: number,
  useHarderRephrase: boolean = true
): Promise<any[]> {
  logger.info(`Processing batch ${batchIndex + 1}/${totalBatches}`);

  // Create instruction prompt with the batch data
  let instructionPrompt = `Take the below sample of JSONL data and rephrase it without changing the meaning of the question or any of the answer choices. You should keep the same JSON format as the input example. This data is from the file "${sourceFilename}".`;

  // Add harder rephrase instructions if enabled
  if (useHarderRephrase) {
    instructionPrompt += ` You can add a sentence before and after the question that are related to this topic but they do not change the question or change the answer. Furthermore you can add some new on topic but irrelevant answer options to the list.`;
  }

  instructionPrompt += `\n\n${JSON.stringify(batch, null, 2)}\n\nPlease provide only the rephrased JSON with no additional text.`;

  // Forward to the AI model
  const result = await provider.forward(
    instructionPrompt,
    modelIdentifier,
    "You are an expert at rephrasing questions while maintaining their original meaning."
  );

  // Parse the response
  const responseText = result.response.trim();

  // Try to extract JSON from the response
  let rephrasedBatch: any[] = [];

  try {
    // Remove code fence blocks if present
    let cleanedResponse = responseText;

    // Debug log for troubleshooting
    logger.debug(
      `Response starts with: ${cleanedResponse.substring(0, 50)}...`
    );
    logger.debug(
      `Response ends with: ...${cleanedResponse.substring(cleanedResponse.length - 50)}`
    );

    // More extensive check for markdown code blocks with any language tag or no tag
    const codeBlockRegex = /```(?:\w*\s*)?\s*([\s\S]*?)```/;
    const codeBlockMatch = cleanedResponse.match(codeBlockRegex);

    if (codeBlockMatch && codeBlockMatch[1]) {
      cleanedResponse = codeBlockMatch[1].trim();
      logger.debug(
        `Extracted content from code block. Length: ${cleanedResponse.length}`
      );
    }

    // First try to parse the entire response as JSON
    if (cleanedResponse.startsWith("[") && cleanedResponse.endsWith("]")) {
      try {
        rephrasedBatch = JSON.parse(cleanedResponse);
        logger.debug(
          `Successfully parsed response as JSON array. Found ${rephrasedBatch.length} items.`
        );
      } catch (parseError: any) {
        // If direct parsing fails, try a more manual approach for common JSON issues
        logger.debug(
          `Direct JSON parse failed: ${parseError.message}. Attempting manual fixes...`
        );

        // Try fixing common JSON issues
        const fixedJson = cleanedResponse
          // Fix trailing commas in arrays/objects (common issue)
          .replace(/,(\s*[\]}])/g, "$1")
          // Fix missing quotes around property names
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

        try {
          rephrasedBatch = JSON.parse(fixedJson);
          logger.debug(
            `Successfully parsed response after fixing common JSON issues.`
          );
        } catch (fixedParseError: any) {
          // If that still fails, throw the original error
          logger.debug(
            `Fixed JSON parse also failed: ${fixedParseError.message}`
          );
          throw parseError;
        }
      }
    } else {
      // Try to extract JSON array using regex (more flexible pattern)
      const jsonArrayRegex = /(\[\s*\{.*\}\s*\])/s;
      const jsonMatch = cleanedResponse.match(jsonArrayRegex);

      if (jsonMatch) {
        try {
          const extracted = jsonMatch[0];
          logger.debug(
            `Extracted JSON array via regex. Length: ${extracted.length}`
          );

          // Try to parse the extracted JSON, with fallback to manual fixes
          try {
            rephrasedBatch = JSON.parse(extracted);
          } catch (extractError) {
            // Try fixing common JSON issues
            const fixedJson = extracted
              .replace(/,(\s*[\]}])/g, "$1")
              .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

            rephrasedBatch = JSON.parse(fixedJson);
          }
        } catch (error: any) {
          logger.debug(
            `Failed to parse extracted JSON array: ${error.message}`
          );
          throw error;
        }
      } else {
        // Try JSONL format (fallback)
        logger.debug(
          `Attempting to parse as JSONL (line-by-line JSON objects)`
        );

        const jsonLines = cleanedResponse
          .split("\n")
          .filter(
            (line: string) =>
              line.trim() && line.includes("{") && line.includes("}")
          );

        if (jsonLines.length === 0) {
          throw new Error("Could not find valid JSON objects in the response");
        }

        rephrasedBatch = jsonLines.map((line: string) => {
          try {
            // Extract JSON object from line if it's wrapped in other text
            const objMatch = line.match(/(\{.+\})/s);
            return objMatch ? JSON.parse(objMatch[0]) : JSON.parse(line);
          } catch (lineError: any) {
            logger.debug(`Failed to parse line as JSON: ${lineError.message}`);
            logger.debug(`Problematic line: ${line}`);

            // Try fixing common JSON issues in this line
            const fixedLine = line
              .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
              .replace(/,(\s*\})/g, "$1");

            return JSON.parse(fixedLine);
          }
        });
      }
    }

    // Verify that we actually have valid data
    if (!Array.isArray(rephrasedBatch) || rephrasedBatch.length === 0) {
      throw new Error("Failed to extract any valid data from the response");
    }

    // Additional validation: Check if we have the expected fields
    const hasExpectedStructure = rephrasedBatch.every(
      (item) =>
        item &&
        typeof item === "object" &&
        "question" in item &&
        "options" in item &&
        "answer_index" in item
    );

    if (!hasExpectedStructure) {
      logger.warn(
        "Some rephrased items are missing expected fields. This may cause issues later."
      );
    }

    // Append the rephrased batch to the output file
    await appendBatchToFile(
      rephrasedBatch,
      outputPath,
      isJsonFormat,
      isFirstBatch
    );

    logger.info(`Successfully rephrased batch ${batchIndex + 1}`);
    return rephrasedBatch;
  } catch (error: any) {
    logger.error(`Failed to parse model response as JSON: ${error.message}`);
    logger.debug(`Raw response: ${responseText}`);

    // Last resort: try to save the raw response to a debug file to examine later
    try {
      const debugFilePath = `${outputPath}.debug_batch_${batchIndex}.txt`;
      writeFileSync(debugFilePath, responseText);
      logger.info(
        `Saved problematic response to ${debugFilePath} for debugging`
      );
    } catch (saveError: any) {
      logger.error(`Also failed to save debug file: ${saveError.message}`);
    }

    throw new Error(
      `Could not parse rephrased data from model response: ${error.message}`
    );
  }
}

// Process batches in parallel with a concurrency limit
async function processBatchesInParallel(
  batches: any[][],
  provider: any,
  modelIdentifier: string,
  sourceFilename: string,
  outputPath: string,
  isJsonFormat: boolean,
  maxConcurrent: number,
  useHarderRephrase: boolean = true
): Promise<any[]> {
  const allResults: any[] = [];
  // Process batches in chunks based on max concurrency
  const batchGroups = chunkArray(batches, maxConcurrent);

  for (let i = 0; i < batchGroups.length; i++) {
    const batchGroup = batchGroups[i];
    logger.info(
      `Processing parallel batch group ${i + 1}/${batchGroups.length} (${batchGroup.length} batches)`
    );

    // Process this group of batches in parallel
    const promises = batchGroup.map((batch, j) => {
      const batchIndex = i * maxConcurrent + j;
      const isFirstBatch = i === 0 && j === 0;
      return processBatch(
        batch,
        provider,
        modelIdentifier,
        sourceFilename,
        outputPath,
        isJsonFormat,
        isFirstBatch,
        batchIndex,
        batches.length,
        useHarderRephrase
      );
    });

    // Wait for all batches in this group to complete
    const batchResults = await Promise.all(promises);

    // Collect the results for further processing
    for (const batchResult of batchResults) {
      allResults.push(...batchResult);
    }
  }

  // If JSON format, finalize the file by adding the closing bracket
  if (isJsonFormat) {
    finalizeJsonFile(outputPath);
  }

  return allResults;
}

program
  .command("rephrase")
  .description("Rephrases prompts in a task file using an AI model")
  .requiredOption(
    "-s, --source <file>",
    "Source file with prompt data to be rephrased"
  )
  .option(
    "-m, --model <model>",
    "Model to use for rephrasing (format: provider:model)",
    "openrouter.ai:openai/chatgpt-4o-latest"
  )
  .option(
    "-b, --batch-size <size>",
    "Number of prompts to process in each batch",
    "4"
  )
  .option(
    "-p, --parallel <count>",
    "Maximum number of concurrent LLM requests",
    "3"
  )
  .option(
    "--just-shuffle-answers",
    "Only shuffle answer options without rephrasing questions",
    false
  )
  .option(
    "--harder-rephrase",
    "Enable harder rephrasing with added context sentences and answer options (default: enabled)",
    true
  )
  .action(
    async (rawOptions: {
      source: string;
      model: string;
      batchSize: string;
      parallel: string;
      justShuffleAnswers: boolean;
      harderRephrase: boolean;
    }) => {
      // Log raw options for debugging
      logger.debug(`Raw options: ${JSON.stringify(rawOptions)}`);

      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);
      const options = checkValidationError(
        z
          .object({
            source: z.string(),
            model: z.string().default("openrouter.ai:openai/chatgpt-4o-latest"),
            batchSize: z.coerce.number().default(4),
            parallel: z.coerce
              .number()
              .default(3)
              .transform((val) => Math.max(1, Math.min(10, val))),
            justShuffleAnswers: z.boolean().default(false),
            harderRephrase: z.boolean().default(true),
          })
          .safeParse(rawOptions)
      );

      const startedAt = Date.now().toString();

      // Read the source file
      let sourceContent: string;
      try {
        sourceContent = readFile(options.source);
      } catch (error) {
        logger.error(`Could not read source file: ${options.source}`);
        throw error;
      }

      // Try to parse as JSON/JSONL
      let sourceData: any[];
      try {
        if (sourceContent.trim().startsWith("[")) {
          // Regular JSON array
          sourceData = JSON.parse(sourceContent);
        } else {
          // JSONL format (one JSON object per line)
          sourceData = sourceContent
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));
        }
      } catch (error) {
        logger.error(`Failed to parse source file as JSON/JSONL: ${error}`);
        throw new Error(`Invalid source file format. Expected JSON or JSONL.`);
      }

      // Check if this is an MMLU-Pro task
      const isMMLUPro = isMMLUProTask(options.source, sourceData);

      // Check for the ability to shuffle answers
      const canShuffleAnswers =
        isMMLUPro ||
        (sourceData.length > 0 &&
          sourceData[0].options &&
          sourceData[0].answer_index !== undefined);

      if (options.justShuffleAnswers) {
        if (!canShuffleAnswers) {
          throw new Error(
            "Cannot shuffle answer options: The data format doesn't support answer shuffling. " +
              "Need data with 'options' and 'answer_index' fields."
          );
        }

        logger.info(
          green.bold(`Just shuffling answer options without rephrasing.`)
        );

        // Skip rephrasing and go straight to shuffling
        let shuffledData = shuffleAnswerOptionsForMMLUPro(sourceData);

        // Determine if the source is JSON format
        const isJsonFormat = sourceContent.trim().startsWith("[");

        // Generate a simpler output filename for shuffle-only mode
        const dir = dirname(options.source);
        const originalFilename = basename(options.source);
        const outputPath = join(dir, `shuffle_${originalFilename}`);

        logger.info(`Output will be written to: ${outputPath}`);

        // Ensure output directory exists
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // Write the shuffled data
        let outputContent: string;
        if (isJsonFormat) {
          // Write as JSON if source was JSON
          outputContent = JSON.stringify(shuffledData, null, 2);
        } else {
          // Write as JSONL if source was JSONL
          outputContent = shuffledData
            .map((item) => JSON.stringify(item))
            .join("\n");
        }

        writeFileSync(outputPath, outputContent);
        logger.info(`Shuffled data saved to ${outputPath}`);

        // Calculate CID of the output file
        const outputCID = await generateCID(outputContent);
        logger.info(`Output file CID: ${outputCID.toString()}`);

        // Save job log
        await saveJobLog(
          {
            uuid: uuidv7(),
            jobType: "rephrase",
            startedAt: +startedAt,
            completedAt: Date.now(),
            sourceFile: options.source,
            outputFile: outputPath,
            model: "shuffle-only",
            batchSize: 0,
            parallel: 0,
            outputCID: outputCID.toString(),
            isMMLUPro: isMMLUPro,
            answersShuffled: true,
            justShuffleAnswers: true,
            harderRephrase: false,
          },
          "rephrase",
          startedAt
        );

        logger.info(`Shuffle-only job completed successfully`);
        return;
      }

      if (isMMLUPro) {
        logger.info(
          green.bold(
            `Detected MMLU-Pro task. Will create both a rephrased file AND a shuffled version after rephrasing.`
          )
        );
      }

      // Parse model info
      const modelInfo = parseProviderConfig(options.model);
      if (!modelInfo) {
        throw new Error(`Invalid model format: ${options.model}`);
      }

      // Determine if the source is JSON format
      const isJsonFormat = sourceContent.trim().startsWith("[");

      // Generate output filename with model name and timestamp
      const outputPath = createOutputFilename(
        options.source,
        modelInfo.modelIdentifier
      );
      logger.info(`Output will be incrementally written to: ${outputPath}`);

      // Batch the prompts
      const batches = chunkArray(sourceData, options.batchSize);
      logger.info(
        `Divided ${sourceData.length} prompts into ${batches.length} batches of up to ${options.batchSize}`
      );
      logger.info(
        `Will process with maximum ${options.parallel} concurrent LLM requests`
      );

      if (options.harderRephrase) {
        logger.info(
          green.bold(
            `Using harder rephrasing mode to add contextual sentences and answer options`
          )
        );
        logger.debug(
          `harderRephrase value: ${options.harderRephrase} (type: ${typeof options.harderRephrase})`
        );
      } else {
        logger.info(
          `Using standard rephrasing mode (harder rephrasing disabled)`
        );
        logger.debug(
          `harderRephrase value: ${options.harderRephrase} (type: ${typeof options.harderRephrase})`
        );
      }

      const provider = getProvider(modelInfo.providerName);
      if (!provider) {
        throw new Error(`Provider not found: ${modelInfo.providerName}`);
      }

      // Process batches in parallel and append to file as we go
      let rephrasedData: any[] = [];
      try {
        rephrasedData = await processBatchesInParallel(
          batches,
          provider,
          modelInfo.modelIdentifier,
          basename(options.source),
          outputPath,
          isJsonFormat,
          options.parallel,
          options.harderRephrase
        );
      } catch (error) {
        logger.error(`Error processing batches: ${error}`);
        throw error;
      }

      // If this is an MMLU-Pro task, shuffle the answer options and rewrite the file
      if (isMMLUPro) {
        logger.info(`Shuffling answer options for MMLU-Pro task...`);
        const finalData = shuffleAnswerOptionsForMMLUPro(rephrasedData);
        logger.info(
          `Successfully shuffled answer options for ${finalData.length} items.`
        );

        // Write the shuffled data to a new file
        const shuffledOutputPath = outputPath.replace(
          "REPHRASE__",
          "REPHRASE_SHUFFLED__"
        );

        // Write the rephrased and shuffled data
        let outputContent: string;
        if (isJsonFormat) {
          // Write as JSON if source was JSON
          outputContent = JSON.stringify(finalData, null, 2);
        } else {
          // Write as JSONL if source was JSONL
          outputContent = finalData
            .map((item) => JSON.stringify(item))
            .join("\n");
        }

        writeFileSync(shuffledOutputPath, outputContent);
        logger.info(
          green.bold(
            `*** MMLU-Pro: Shuffled answers saved to ${shuffledOutputPath} ***`
          )
        );

        // Calculate CID of the shuffled output file
        const outputCID = await generateCID(outputContent);
        logger.info(`Shuffled output file CID: ${outputCID.toString()}`);

        // Save job log with the shuffled file
        await saveJobLog(
          {
            uuid: uuidv7(),
            jobType: "rephrase",
            startedAt: +startedAt,
            completedAt: Date.now(),
            sourceFile: options.source,
            outputFile: shuffledOutputPath,
            originalOutputFile: outputPath,
            model: options.model,
            batchSize: options.batchSize,
            parallel: options.parallel,
            outputCID: outputCID.toString(),
            isMMLUPro: isMMLUPro,
            answersShuffled: true,
            harderRephrase: options.harderRephrase,
          },
          "rephrase",
          startedAt
        );

        // Add summary message for MMLU-Pro tasks
        logger.info(
          `Rephrase job completed successfully with answer shuffling`
        );
        logger.info(green.bold(`Two output files were created:`));
        logger.info(green.bold(`1. Original rephrased file: ${outputPath}`));
        logger.info(
          green.bold(`2. Shuffled answers file: ${shuffledOutputPath}`)
        );
      } else {
        // Calculate CID of the output file
        const fileContent = readFile(outputPath);
        const outputCID = await generateCID(fileContent);
        logger.info(`Output file CID: ${outputCID.toString()}`);

        // Save job log
        await saveJobLog(
          {
            uuid: uuidv7(),
            jobType: "rephrase",
            startedAt: +startedAt,
            completedAt: Date.now(),
            sourceFile: options.source,
            outputFile: outputPath,
            model: options.model,
            batchSize: options.batchSize,
            parallel: options.parallel,
            outputCID: outputCID.toString(),
            isMMLUPro: isMMLUPro,
            answersShuffled: false,
            harderRephrase: options.harderRephrase,
          },
          "rephrase",
          startedAt
        );

        // Add simple completion message for non-MMLU tasks
        logger.info(`Rephrase job completed successfully`);
      }
    }
  )
  .allowUnknownOption(true);
