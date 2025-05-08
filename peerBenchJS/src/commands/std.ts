import { config } from "@/config";
import { logger } from "@/core/logger";
import { checkValidationError } from "@/core/utils";
import { program } from "@/core/program";
import { yellow } from "ansis";
import { z } from "zod";
import { convertTaskFormat } from "@/core/std";
import { taskFormats } from "@/core/format";

const taskFormatNames = taskFormats.map((t) => t.name);

program
  .command("std")
  .description("Standardize data format between different schemas")
  .requiredOption(
    "-s, --source <file>",
    "Source file with data to be standardized"
  )
  .option(
    "-t, --to <schema>",
    `Target schema type: ${taskFormatNames.map((t) => `"${t}"`).join(", ")}`,
    "medqa"
  )
  .option(
    "-o, --output <file>",
    "Output file path (default: derived from source filename)"
  )
  .action(
    async (rawOptions: {
      source: string;
      from: string;
      to: string;
      output?: string;
    }) => {
      logger.debug(`Validator DID ${yellow.bold(config.VALIDATOR_DID)}`);
      const options = checkValidationError(
        z
          .object({
            source: z.string(),
            to: z
              .string()
              .default("medqa")
              .transform((value, ctx) => {
                if (!taskFormatNames.includes(value)) {
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Invalid target schema type",
                  });
                  return z.NEVER;
                }

                return value;
              }),
            output: z.string().optional(),
          })
          .safeParse(rawOptions)
      );

      await convertTaskFormat({
        sourceTaskFile: options.source,
        output: options.output,
        targetFormat: options.to,
      });
    }
  )
  .allowUnknownOption(true);
