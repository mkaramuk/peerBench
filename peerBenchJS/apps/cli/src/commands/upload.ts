import { logger } from "@/core/logger";
import { getUploader, uploaders } from "@/core/uploaders";
import { checkValidationError, saveJobLog } from "@/core/utils";
import { program } from "@/core/program";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";

program
  .command("upload")
  .description("Uploads the given files to a remote server")
  .requiredOption(
    "-t, --target <name>",
    `Points the target remote server name. Available targets servers ${uploaders
      .map((u) => u.name)
      .join(", ")}`
  )
  .option(
    "-s, --scores <files...>",
    "The score files that is going to be uploaded"
  )
  .option(
    "-r, --responses <files...>",
    "The response files that is going to be uploaded"
  )
  .action(
    async (rawOptions: {
      target: string;
      scores?: string[];
      responses?: string[];
    }) => {
      const options = checkValidationError(
        z
          .object({
            target: z.string(),
            task: z.string().default("default"),
            scores: z.array(z.string()).default([]),
            responses: z.array(z.string()).default([]),
          })
          .safeParse(rawOptions)
      );

      const startedAt = Date.now();
      const uploader = getUploader(options.target);

      if (uploader === undefined) {
        throw new Error(`Target "${options.target}" is not available`);
      }

      if (options.responses.length > 0) {
        await uploader.init();

        logger.info(`Uploading given responses to ${options.target}`);
        await Promise.all(
          options.responses.map((path) =>
            uploader.uploadPromptResponses(path, { batchSize: 20 })
          )
        );
      }

      if (options.scores.length > 0) {
        await uploader.init();

        logger.info(`Uploading given scores to ${options.target}`);
        await Promise.all(
          options.scores.map((path) =>
            uploader.uploadScores(path, { batchSize: 20 })
          )
        );
      }

      await saveJobLog(
        {
          uuid: uuidv7(),
          jobType: "upload",
          startedAt: +startedAt,
          completedAt: Date.now(),
          scoreFiles: options.scores,
          responseFiles: options.responses,
        },
        "upload",
        startedAt
      );
    }
  )
  .allowUnknownOption(true);
