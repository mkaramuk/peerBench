import { logger } from "@/core/logger";
import { readTaskFromFile, SchemaName } from "@peerbench/sdk";
import { dirname, join, parse } from "path";
import { writeFileSync } from "fs";
import { program } from "@/core/program";
import { generateCIDFile, generateSignatureFile } from "@/core/utils";

program
  .command("std")
  .description("Convert task files to standard peerBench schema format")
  .argument("<files...>", "Task files to convert")
  .option(
    "-o, --output <path>",
    "Output directory. Default is the same as the input file"
  )
  .action(async (files: string[], options: { output?: string }) => {
    for (const file of files) {
      try {
        // Reading the task file is enough to convert it to the standard peerBench schema format
        // because Prompt data type is already in the desired format.
        const taskDetails = await readTaskFromFile(file);
        const dirName = dirname(file);
        const filePath = parse(file);
        const isPBTask = taskDetails.schema.name === SchemaName.pb;
        const stdTaskPath = join(
          options.output || dirName,

          // If the given task is already in the standard peerBench schema format,
          // we don't need to convert it so the target file name will be the same.
          isPBTask
            ? taskDetails.task.fileName
            : `${filePath.name}.peerbench.json`
        );

        // TODO: Output in different formats

        // Write the standard peerBench schema format to the target file if it is not already in that format.
        if (!isPBTask) {
          writeFileSync(
            stdTaskPath,
            JSON.stringify(taskDetails.task.prompts, null, 2)
          );
          logger.info(`Converted ${file} to ${stdTaskPath}`);
        }

        // Generate the CID and signature files
        const cid = await generateCIDFile(stdTaskPath);
        logger.info(`Generated CID for ${taskDetails.task.fileName}: ${cid}`);

        const signature = await generateSignatureFile(stdTaskPath, cid);
        logger.info(
          `Generated signature for ${taskDetails.task.fileName}: ${signature}`
        );
      } catch (err) {
        logger.error(`Error while processing ${file}: ${err}`);
      }
    }

    logger.info("Done");
  });
