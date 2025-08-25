import { logger } from "@/core/logger";

/**
 * Base class for uploader classes
 */
export abstract class AbstractUploader {
  name = "Abstract";
  logger = logger.child({ context: `Uploader(${this.constructor.name})` });

  abstract init(): Promise<unknown>;

  abstract uploadPromptResponses(
    filePath: string,
    options?: UploadOptions
  ): Promise<unknown>;
  abstract uploadScores(
    filePath: string,
    options?: UploadOptions
  ): Promise<unknown>;

  // TODO: upload aggregation method
}

export type UploadOptions = {
  batchSize?: number;
};
