import { CoServerUploader } from "@/uploaders/coserver";
import { logger } from "./logger";

export const uploaders = [new CoServerUploader()];

export function getUploader(name: string) {
  const uploader = uploaders.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (uploader === undefined) {
    logger.warning(`Uploader not found: ${name}`);
    return;
  }

  return uploader;
}
